export default async function handler(req, res) {
    // =========================
    // CORS SEGURO
    // =========================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'Chave de API não configurada.' });
    }

    // =========================
    // VALIDAÇÃO DE INPUT
    // =========================
    const { prompt: userPrompt } = req.body || {};

    if (!userPrompt || typeof userPrompt !== "string") {
        return res.status(400).json({ error: "Transcrição inválida ou vazia." });
    }

    if (userPrompt.length > 120000) {
        return res.status(400).json({ error: "Transcrição excede o tamanho permitido." });
    }

    // =========================
    // RETRY + TIMEOUT
    // =========================
    const fetchWithRetry = async (url, options, retries = 5) => {
        const delays = [1000, 2000, 4000, 8000, 16000];

        for (let i = 0; i < retries; i++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 60000);

                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (![429, 503].includes(response.status)) {
                    return response;
                }

                if (i < retries - 1) {
                    await new Promise(r => setTimeout(r, delays[i]));
                }

            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(r => setTimeout(r, delays[i]));
            }
        }
    };

    // =========================
    // PROMPT MASTER
    // =========================
    const systemInstruction = `
Você é um avaliador especialista em performance comercial B2B para contabilidades.

Sua análise deve conter 3 blocos obrigatórios:
1) RAPPORT E CONEXÃO
2) VALIDAÇÃO DE PRODUTO (baseado exclusivamente nos manuais oficiais)
3) AVALIAÇÃO ESTRATÉGICA DA DEMONSTRAÇÃO NIBO

As análises devem ser técnicas, objetivas, sem elogios genéricos e baseadas exclusivamente na transcrição fornecida.
`;

    const fullPrompt = `
TRANSCRIÇÃO DA REUNIÃO:
${userPrompt}

===============================
BLOCO 1 — RAPPORT E CONEXÃO
Analise:
- Nível de abertura do cliente
- Qualidade da empatia do consultor
- Profundidade da conexão emocional
- Impacto emocional no cliente
Nota final de 0 a 5 com justificativa estratégica

===============================
BLOCO 2 — VALIDAÇÃO DE PRODUTO
Verifique se houve divergência em relação aos manuais oficiais.
Se houve erro, identifique qual.
Atribua nota de 0 a 5 conforme:
1: +5 erros
2: 4 erros
3: 3 erros
4: 1-2 erros
5: Nenhuma divergência

===============================
BLOCO 3 — AVALIAÇÃO DA DEMONSTRAÇÃO NIBO
Avalie detalhadamente os 10 pilares:
1. Contextualização da dor
2. Demonstração da automação
3. Formas de entrada
4. Experiência do app
5. Segurança e LGPD
6. Cobrança automatizada
7. Centralização
8. Padronização
9. Condução consultiva
10. Impacto percebido

Ao final:
- Pontos fortes
- Pontos de melhoria
- Sugestões práticas
- Nota final de 0 a 5 com justificativa estratégica
`;

    // CORREÇÃO 1: Todos os 'type' alterados para MAIÚSCULAS
    const responseSchema = {
        type: "OBJECT",
        properties: {
            rapport: {
                type: "OBJECT",
                properties: {
                    analise_detalhada: { type: "STRING" },
                    nota_final: { type: "NUMBER" }
                },
                required: ["analise_detalhada", "nota_final"]
            },
            produto: {
                type: "OBJECT",
                properties: {
                    houve_divergencia: { type: "BOOLEAN" },
                    quais_erros: { type: "STRING" },
                    nota_final: { type: "NUMBER" }
                },
                required: ["houve_divergencia", "quais_erros", "nota_final"]
            },
            demonstracao: {
                type: "OBJECT",
                properties: {
                    analise_por_pilar: { type: "STRING" },
                    pontos_fortes: { type: "STRING" },
                    pontos_melhoria: { type: "STRING" },
                    sugestoes_praticas: { type: "STRING" },
                    nota_final: { type: "NUMBER" }
                },
                required: [
                    "analise_por_pilar",
                    "pontos_fortes",
                    "pontos_melhoria",
                    "sugestoes_praticas",
                    "nota_final"
                ]
            }
        },
        required: ["rapport", "produto", "demonstracao"]
    };

    try {
        // CORREÇÃO 2: Modelo atualizado para um válido
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;

        const response = await fetchWithRetry(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                // CORREÇÃO 3: Uso do formato snake_case esperado pela API REST
                system_instruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                    response_mime_type: "application/json",
                    response_schema: responseSchema,
                    temperature: 0.2
                }
            })
        });

        if (!response) {
            return res.status(500).json({ error: "Falha após múltiplas tentativas." });
        }

        const data = await response.json();

        if (data.error) {
            return res.status(500).json({ error: data.error.message });
        }

        if (!data.candidates || !data.candidates.length) {
            return res.status(500).json({ error: "A IA não gerou resposta." });
        }

        let textResponse = data.candidates[0]?.content?.parts?.[0]?.text;

        if (!textResponse) {
            return res.status(500).json({ error: "Resposta vazia da IA." });
        }

        // CORREÇÃO 4: Strip de markdown antes do parse, caso a IA envie ```json
        textResponse = textResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

        try {
            const parsed = JSON.parse(textResponse);
            return res.status(200).json(parsed);
        } catch (parseError) {
            return res.status(500).json({
                error: "Erro ao interpretar resposta estruturada da IA.",
                raw: textResponse
            });
        }

    } catch (error) {
        console.error("Erro no handler:", error);
        return res.status(500).json({ error: "Erro interno: " + error.message });
    }
}
