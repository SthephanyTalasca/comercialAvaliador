export default async function handler(req, res) {
    // =========================
    // CORS SEGURO
    // =========================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'Chave de API não configurada.' });

    const { prompt: userPrompt } = req.body || {};
    if (!userPrompt || typeof userPrompt !== "string") {
        return res.status(400).json({ error: "Transcrição inválida." });
    }

    // =========================
    // PROMPT MASTER ATUALIZADO
    // =========================
    const systemInstruction = `
Você é um avaliador especialista em performance comercial B2B para contabilidades, focado em estratégias de substituição de concorrentes (especificamente Acessórias) e fechamento de vendas.

Sua missão é analisar se o consultor executou a estratégia de "Tomada de Conta", gerando insegurança sobre o uso da Acessórias e posicionando o Nibo como uma evolução tecnológica superior.
As análises devem ser técnicas, sem elogios genéricos, baseadas estritamente na transcrição.
`;

    const fullPrompt = `
TRANSCRIÇÃO DA REUNIÃO:
${userPrompt}

===============================
OBJETIVO DA ANÁLISE:
1. ESTRATÉGIA DE SUBSTITUIÇÃO (ACESSÓRIAS):
   - Avalie o ataque ao visual/experiência (complexidade vs simplicidade).
   - Verifique a comparação técnica: E-Contínuo vs Nibo Assistente (sem robô local).
   - Analise o pilar crítico: Cobrança Automatizada (fraqueza da Acessórias).
   - Cheque se houve diferenciação no App (Integração e-CAC, Notas, Dashboards).

2. PRÉ-FECHAMENTO E FEEDBACK:
   - O consultor amarrou as dores iniciais (X, Y, Z) com a solução antes de falar de preço?
   - Pediu feedback direto ("O que achou da ferramenta?")?
   - Usou o "voto de confiança" e a "referência da cidade"?

3. FECHAMENTO E NEGOCIAÇÃO:
   - Como foi a apresentação do valor (Mensalidade + Setup)?
   - Tratou objeção de sócio corretamente (não dar preço, agendar nova reunião)?
   - Identificou se o peso era Mensalidade ou Setup?
   - Usou a ancoragem da Gestão Financeira gratuita como benefício de parceria?
   - Aplicou o fechamento condicional ("Se eu conseguir isso, podemos avançar?")?

Analise detalhadamente cada bloco conforme o esquema JSON solicitado.
`;

    const responseSchema = {
        type: "OBJECT",
        properties: {
            substituicao_acessorias: {
                type: "OBJECT",
                properties: {
                    diagnostico_estrategico: { type: "STRING" },
                    ataque_vulnerabilidades: { type: "STRING" }, // Automação, Robô, Cobrança
                    percepcao_de_ruptura: { type: "STRING" }, // Gerou desejo de migrar?
                    nota_tecnica: { type: "NUMBER" } // 0 a 5
                },
                required: ["diagnostico_estrategico", "ataque_vulnerabilidades", "nota_tecnica"]
            },
            pre_fechamento: {
                type: "OBJECT",
                properties: {
                    validacao_das_dores: { type: "STRING" },
                    coleta_de_feedback: { type: "STRING" },
                    execucao_voto_confianca: { type: "BOOLEAN" }
                },
                required: ["validacao_das_dores", "coleta_de_feedback", "execucao_voto_confianca"]
            },
            negociacao_fechamento: {
                type: "OBJECT",
                properties: {
                    postura_em_vendas: { type: "STRING" },
                    manejo_de_objecoes: { type: "STRING" }, // Sócio, preço, setup
                    uso_de_gatilhos: { type: "STRING" }, // Parceria, coordenador, desconto condicional
                    nota_final: { type: "NUMBER" }
                },
                required: ["postura_em_vendas", "manejo_de_objecoes", "nota_final"]
            },
            resumo_executivo: {
                type: "OBJECT",
                properties: {
                    pontos_fortes: { type: "STRING" },
                    oportunidades_perdidas: { type: "STRING" },
                    sugestao_pratica: { type: "STRING" }
                },
                required: ["pontos_fortes", "oportunidades_perdidas", "sugestao_pratica"]
            }
        },
        required: ["substituicao_acessorias", "pre_fechamento", "negociacao_fechamento", "resumo_executivo"]
    };

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                system_instruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                    response_mime_type: "application/json",
                    response_schema: responseSchema,
                    temperature: 0.2
                }
            })
        });

        const data = await response.json();
        if (data.error) return res.status(500).json({ error: data.error.message });

        let textResponse = data.candidates[0]?.content?.parts?.[0]?.text;
        const parsed = JSON.parse(textResponse);
        
        return res.status(200).json(parsed);

    } catch (error) {
        return res.status(500).json({ error: "Erro interno: " + error.message });
    }
}
