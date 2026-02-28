export default async function handler(req, res) {
    // Configuração de Headers CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'Chave de API GEMINI_API_KEY não configurada na Vercel.' });

    // Lógica de Retry para evitar erros de limite de quota
    const fetchWithRetry = async (url, options, retries = 5) => {
        const delays = [1000, 2000, 4000, 8000, 16000];
        for (let i = 0; i < retries; i++) {
            const response = await fetch(url, options);
            if (response.status !== 429 && response.status !== 503) return response;
            if (i < retries - 1) await new Promise(res => setTimeout(res, delays[i]));
        }
        return fetch(url, options);
    };

    try {
        const { prompt: userPrompt } = req.body;
        if (!userPrompt) return res.status(400).json({ error: "A transcrição é obrigatória para a análise." });

        const transcriptText = userPrompt.includes("TRANSCRIÇÃO:") 
            ? userPrompt.split("TRANSCRIÇÃO:")[1] 
            : userPrompt;

        const responseSchema = {
            type: "object",
            properties: {
                resumo_executivo: { type: "string" },
                nota_postura: { type: "number" },
                porque_postura: { type: "string" },
                nota_conhecimento: { type: "number" },
                porque_conhecimento: { type: "string" },
                nota_escuta: { type: "number" },
                porque_escuta: { type: "string" },
                nota_expansao: { type: "number" },
                porque_expansao: { type: "string" },
                nota_fechamento: { type: "number" },
                porque_fechamento: { type: "string" },
                media_final: { type: "number" },
                chance_fechamento: { type: "string" },
                tempo_fala_consultor: { type: "string" },
                tempo_fala_cliente: { type: "string" },
                alerta_cancelamento: { type: "string" },
                pontos_fortes: { type: "array", items: { type: "string" } },
                pontos_atencao: { type: "array", items: { type: "string" } },
                checklist_fechamento: {
                    type: "object",
                    properties: {
                        resolveu_pontos_iniciais: { type: "boolean" },
                        pediu_feedback_ferramenta: { type: "boolean" },
                        pediu_voto_confianca: { type: "boolean" },
                        tratou_objecao_socio: { type: "boolean" },
                        validou_mensalidade_vs_setup: { type: "boolean" },
                        mencionou_gestao_financeira_gratuita: { type: "boolean" }
                    }
                },
                justificativa_detalhada: { type: "string" }
            },
            required: ["resumo_executivo", "nota_postura", "porque_postura", "nota_conhecimento", "porque_conhecimento", "nota_escuta", "porque_escuta", "nota_expansao", "porque_expansao", "nota_fechamento", "porque_fechamento", "media_final", "chance_fechamento", "tempo_fala_consultor", "tempo_fala_cliente", "alerta_cancelamento", "pontos_fortes", "pontos_atencao", "checklist_fechamento", "justificativa_detalhada"]
        };

        const systemInstruction = `
            VOCÊ É UM AUDITOR DE VENDAS NIBO DE ELITE.
            Analise a transcrição rigorosamente com base no MANUAL DE VENDAS NIBO.

            ESTRUTURA DE ANÁLISE:
            1. **Justificativa Individual**: Para cada uma das 5 notas, escreva uma explicação curta e direta no campo 'porque_...'.
            2. **Probabilidade de Fecho**: Analise a temperatura do cliente e o uso das técnicas de fechamento para estimar a chance de fechar venda (Baixa, Média, Alta).
            3. **Pontos Fortes e Fracos**: Identifique o que foi excelente e o que foi um erro técnico ou de script.
            4. **Argumentos Chave**: Verifique se o consultor usou o 'Voto de Confiança', se isolou a objeção entre 'Setup' e 'Mensalidade', e se contrastou a interface do Nibo com a interface poluída da concorrência (ex: Acessórias).
            5. **Idioma**: Responda estritamente em Português de Portugal.
        `;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;

        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `INSTRUÇÃO: ${systemInstruction}\n\nTRANSCRIÇÃO:\n${transcriptText}` }] }],
                generationConfig: { 
                    response_mime_type: "application/json", 
                    response_schema: responseSchema, 
                    temperature: 0.1 
                }
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const aiOutput = JSON.parse(data.candidates[0].content.parts[0].text);
        res.status(200).json(aiOutput);

    } catch (error) {
        console.error("Erro Backend:", error);
        res.status(500).json({ error: error.message });
    }
}
