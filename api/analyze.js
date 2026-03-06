import { GoogleGenAI, Type } from '@google/genai';

export const maxDuration = 60;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Método não permitido. Use POST." });
    }

    // ── Verificar sessão ────────────────────────────────────────────────────
    const cookie = req.headers.cookie || '';
    const match  = cookie.match(/nibo_session=([^;]+)/);
    if (!match) return res.status(401).json({ error: "Não autorizado." });
    try {
        const session = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
        if (!session.exp || Date.now() > session.exp) return res.status(401).json({ error: "Sessão expirada." });
        const domain = session.email.toLowerCase().split('@')[1];
        if (domain !== 'nibo.com.br') return res.status(403).json({ error: "Acesso negado." });
    } catch { return res.status(401).json({ error: "Sessão inválida." }); }
    // ────────────────────────────────────────────────────────────────────────

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "O texto da transcrição é obrigatório." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const systemInstruction = process.env.SYSTEM_PROMPT;
        if (!systemInstruction) return res.status(500).json({ error: "Prompt não configurado no servidor." });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                maxOutputTokens: 65536,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {

                        // ── PARTE 1: VENDAS ──────────────────────────────────
                        media_final:             { type: Type.NUMBER },
                        resumo_executivo:        { type: Type.STRING },
                        chance_fechamento:       { type: Type.STRING },
                        alerta_cancelamento:     { type: Type.STRING },
                        concorrentes_detectados: { type: Type.ARRAY, items: { type: Type.STRING } },

                        nota_rapport:            { type: Type.NUMBER },
                        porque_rapport:          { type: Type.STRING },
                        melhoria_rapport:        { type: Type.STRING },

                        nota_produto:            { type: Type.NUMBER },
                        porque_produto:          { type: Type.STRING },
                        melhoria_produto:        { type: Type.STRING },

                        nota_apresentacao:       { type: Type.NUMBER },
                        porque_apresentacao:     { type: Type.STRING },
                        melhoria_apresentacao:   { type: Type.STRING },

                        nota_pre_fechamento:     { type: Type.NUMBER },
                        porque_pre_fechamento:   { type: Type.STRING },
                        melhoria_pre_fechamento: { type: Type.STRING },

                        nota_fechamento:         { type: Type.NUMBER },
                        porque_fechamento:       { type: Type.STRING },
                        melhoria_fechamento:     { type: Type.STRING },

                        tempo_fala_consultor:    { type: Type.STRING },
                        tempo_fala_cliente:      { type: Type.STRING },

                        checklist_fechamento: {
                            type: Type.OBJECT,
                            properties: {
                                resolveu_pontos_iniciais:             { type: Type.BOOLEAN },
                                pediu_feedback_ferramenta:            { type: Type.BOOLEAN },
                                pediu_voto_confianca:                 { type: Type.BOOLEAN },
                                tratou_objecao_socio:                 { type: Type.BOOLEAN },
                                validou_mensalidade_vs_setup:         { type: Type.BOOLEAN },
                                mencionou_gestao_financeira_gratuita: { type: Type.BOOLEAN }
                            }
                        },

                        pontos_fortes:           { type: Type.ARRAY, items: { type: Type.STRING } },
                        pontos_atencao:          { type: Type.ARRAY, items: { type: Type.STRING } },
                        justificativa_detalhada: { type: Type.STRING },

                        // ── PARTE 2: QUALIFICAÇÃO ────────────────────────────
                        qual_produto_identificado:  { type: Type.STRING },
                        qual_produto_no_portfolio:  { type: Type.BOOLEAN },
                        qual_produto_alerta:        { type: Type.STRING },

                        qual_contexto: {
                            type: Type.OBJECT,
                            properties: {
                                produto_apresentado:   { type: Type.STRING },
                                qtd_clientes_cnpjs:    { type: Type.STRING },
                                sistema_contabil:      { type: Type.STRING },
                                interesse_demonstrado: { type: Type.STRING },
                                cenario_problema:      { type: Type.STRING },
                                participantes:         { type: Type.STRING },
                                sabia_o_que_veria:     { type: Type.STRING }
                            }
                        },

                        qual_sabia_o_que_veria:      { type: Type.STRING },
                        qual_sabia_evidencia:        { type: Type.STRING },
                        qual_produto_correto:        { type: Type.STRING },
                        qual_produto_evidencia:      { type: Type.STRING },
                        qual_interesse_real:         { type: Type.STRING },
                        qual_interesse_evidencia:    { type: Type.STRING },
                        qual_cenario_diagnosticado:  { type: Type.STRING },
                        qual_cenario_evidencia:      { type: Type.STRING },

                        qual_sla_1_label: { type: Type.STRING },
                        qual_sla_1_ok:    { type: Type.BOOLEAN },
                        qual_sla_1_ev:    { type: Type.STRING },

                        qual_sla_2_label: { type: Type.STRING },
                        qual_sla_2_ok:    { type: Type.BOOLEAN },
                        qual_sla_2_ev:    { type: Type.STRING },

                        qual_sla_3_label: { type: Type.STRING },
                        qual_sla_3_ok:    { type: Type.BOOLEAN },
                        qual_sla_3_ev:    { type: Type.STRING },

                        qual_veredicto:              { type: Type.STRING },
                        qual_nota_sdr:               { type: Type.NUMBER },
                        qual_nota_sdr_justificativa: { type: Type.STRING },
                        qual_analise_completa:       { type: Type.STRING }
                    },
                    required: [
                        "media_final", "resumo_executivo", "chance_fechamento", "alerta_cancelamento",
                        "concorrentes_detectados",
                        "nota_rapport", "porque_rapport", "melhoria_rapport",
                        "nota_produto", "porque_produto", "melhoria_produto",
                        "nota_apresentacao", "porque_apresentacao", "melhoria_apresentacao",
                        "nota_pre_fechamento", "porque_pre_fechamento", "melhoria_pre_fechamento",
                        "nota_fechamento", "porque_fechamento", "melhoria_fechamento",
                        "tempo_fala_consultor", "tempo_fala_cliente",
                        "checklist_fechamento", "pontos_fortes", "pontos_atencao",
                        "justificativa_detalhada",
                        "qual_produto_identificado", "qual_produto_no_portfolio", "qual_produto_alerta",
                        "qual_contexto",
                        "qual_sabia_o_que_veria", "qual_sabia_evidencia",
                        "qual_produto_correto", "qual_produto_evidencia",
                        "qual_interesse_real", "qual_interesse_evidencia",
                        "qual_cenario_diagnosticado", "qual_cenario_evidencia",
                        "qual_sla_1_label", "qual_sla_1_ok", "qual_sla_1_ev",
                        "qual_sla_2_label", "qual_sla_2_ok", "qual_sla_2_ev",
                        "qual_sla_3_label", "qual_sla_3_ok", "qual_sla_3_ev",
                        "qual_veredicto", "qual_nota_sdr", "qual_nota_sdr_justificativa",
                        "qual_analise_completa"
                    ]
                }
            }
        });

        let analysisData;
        try {
            analysisData = JSON.parse(response.text);
        } catch (parseError) {
            console.error("Erro ao fazer parse do JSON:", response.text);
            return res.status(500).json({ error: "A IA gerou um texto muito longo e foi cortada. Tente com uma transcrição menor." });
        }

        // ── Inject UI config into response (hides from frontend source) ────────
        analysisData._config = {
            fields: [
                { l: 'Rapport',        k: 'rapport',       icon: 'heart-handshake' },
                { l: 'Produto',        k: 'produto',        icon: 'layers' },
                { l: 'Apresentação',   k: 'apresentacao',   icon: 'presentation' },
                { l: 'Pré-Fechamento', k: 'pre_fechamento', icon: 'funnel' },
                { l: 'Fechamento',     k: 'fechamento',     icon: 'handshake' }
            ],
            prodConfig: {
                'RADAR-ECAC':       { color: 'bg-sky-100 text-sky-800 border-sky-300',             icon: 'radar' },
                'NIBO OBRIGAÇÕES':  { color: 'bg-violet-100 text-violet-800 border-violet-300',    icon: 'file-text' },
                'CONCILIADOR':      { color: 'bg-blue-100 text-blue-800 border-blue-300',          icon: 'git-merge' },
                'WHATSAPP WEB':     { color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'message-circle' },
                'EMISSOR DE NOTAS': { color: 'bg-orange-100 text-orange-800 border-orange-300',    icon: 'file-plus' },
                'FORA':             { color: 'bg-red-100 text-red-800 border-red-300',             icon: 'alert-triangle' }
            },
            ckLabels: {
                resolveu_pontos_iniciais:             'Retomou problemas',
                pediu_feedback_ferramenta:            'Pediu Feedback',
                pediu_voto_confianca:                 'Voto de Confiança',
                tratou_objecao_socio:                 'Alinhou Sócios',
                validou_mensalidade_vs_setup:         'Isolou Objeção',
                mencionou_gestao_financeira_gratuita: 'Cereja do Bolo'
            }
        };

        return res.status(200).json(analysisData);

    } catch (error) {
        console.error("Erro na API:", error);
        return res.status(500).json({ error: "Erro do Google Gemini: " + error.message });
    }
}
