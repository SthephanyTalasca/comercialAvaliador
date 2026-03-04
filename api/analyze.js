export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'Chave de API não configurada.' });

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
        if (!userPrompt) return res.status(400).json({ error: "Transcrição vazia." });

        const NIBO_KNOWLEDGE_BASE = `
        1. NIBO OBRIGAÇÕES - FUNCIONALIDADES CHAVE:
           - TELA DE CONFERÊNCIA: Coração do sistema. Valida automaticamente guias (DARF, GPS, DAS, etc.). Permite "Drag and Drop".
           - RECÁLCULO AUTOMÁTICO: Atualiza guias vencidas com 1 clique (Sicalc, DCTFWeb, DAS).
           - CALENDÁRIO DINÂMICO: Diferencia "Vencimento Legal" de "Meta Interna".
           - ARMAZENAMENTO: Nuvem Microsoft Azure. Armazenamento ilimitado.
        2. AUTOMAÇÃO:
           - NIBO ASSISTENTE: Sem robô local. Mapeia pastas para a nuvem.
           - INTEGRAÇÃO DOMÍNIO: Botão "Publicar na pasta" envia direto ao Nibo.
        3. CONCORRENTES:
           - ACESSÓRIAS: Nibo é Nuvem pura (sem robô local) e visual moderno.
           - GCLICK / GESTTA / VERI: Nibo é ECOSSISTEMA integrado. Permite ÁUDIO.
        4. SCRIPT DE FECHAMENTO:
           - Voto de Confiança: Foto de referência e orçamento.
           - Negociação: Isolar Mensalidade vs Setup.
        `;

        const responseSchema = {
            type: "object",
            properties: {
                resumo_executivo: { type: "string" },
                concorrentes_detectados: { type: "array", items: { type: "string" } },
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
            required: ["resumo_executivo", "concorrentes_detectados", "nota_postura", "porque_postura", "nota_conhecimento", "porque_conhecimento", "nota_escuta", "porque_escuta", "nota_expansao", "porque_expansao", "nota_fechamento", "porque_fechamento", "media_final", "chance_fechamento", "tempo_fala_consultor", "tempo_fala_cliente", "alerta_cancelamento", "pontos_fortes", "pontos_atencao", "checklist_fechamento", "justificativa_detalhada"]
        };

        const systemInstruction = `VOCÊ É O AUDITOR CHEFE DA NIBO. IDIOMA: Português Brasil. BASE TÉCNICA: ${NIBO_KNOWLEDGE_BASE}`;

        // Correção na URL do modelo
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;

        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `TRANSCRIÇÃO:\n${userPrompt}` }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { response_mime_type: "application/json", response_schema: responseSchema, temperature: 0.1 }
            })
        });

        const data = await response.json();

        // Verificação robusta da resposta
        if (data.error) {
            return res.status(500).json({ error: `Erro na API do Google: ${data.error.message}` });
        }

        if (!data.candidates || data.candidates.length === 0) {
            return res.status(500).json({ error: "A IA não gerou uma resposta. Verifique se a transcrição não viola as políticas de segurança." });
        }

        const candidate = data.candidates[0];
        if (candidate.finishReason === "SAFETY") {
            return res.status(500).json({ error: "A análise foi bloqueada pelos filtros de segurança do Google." });
        }

        const textResponse = candidate.content?.parts?.[0]?.text;
        if (!textResponse) {
            return res.status(500).json({ error: "Resposta da IA veio vazia ou em formato inesperado." });
        }

        res.status(200).json(JSON.parse(textResponse));

    } catch (error) {
        console.error("Erro no Handler:", error);
        res.status(500).json({ error: "Erro interno: " + error.message });
    }
}
