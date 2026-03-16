// api/analyze.js
// ─────────────────────────────────────────────────────────────────────────────
// NOVA ESTRUTURA DE AVALIAÇÃO (3 etapas, 12 critérios)
//
//  Etapa 1 – Consultividade / SPIN (3 critérios)
//    • Rapport         (nota_rapport)
//    • SPIN            (nota_spin)
//    • Comunicação     (nota_comunicacao)
//    → nota_etapa1
//
//  Etapa 2 – Apresentação da Ferramenta (4 critérios)
//    • Produto                    (nota_produto)
//    • Objeções                   (nota_objecoes)
//    • Solução da Dor             (nota_solucao_dor)
//    • Encantamento/Emoção        (nota_encantamento)
//    → nota_etapa2
//
//  Etapa 3 – Negociação (5 critérios)
//    • Pré-Fechamento             (nota_pre_fechamento)
//    • Escuta Ativa               (nota_escuta_ativa)
//    • Resiliência                (nota_resiliencia)
//    • Gestão do Tempo            (nota_gestao_tempo)
//    • Regras de Fechamento       (nota_regras_fechamento)
//    → nota_etapa3
//
//  media_final = média dos 12 critérios
//
//  + AUDITORIA DE OBJEÇÕES:
//    Array de até 10 objeções identificadas, com avaliação de contorno.
// ─────────────────────────────────────────────────────────────────────────────

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
    if (!prompt) return res.status(400).json({ error: "O texto da transcrição é obrigatório." });

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

                        // ── IDENTIFICAÇÃO ────────────────────────────────────
                        vendedor_nome:           { type: Type.STRING },
                        media_final:             { type: Type.NUMBER },
                        resumo_executivo:        { type: Type.STRING },
                        chance_fechamento:       { type: Type.STRING },
                        alerta_cancelamento:     { type: Type.STRING },
                        concorrentes_detectados: { type: Type.ARRAY, items: { type: Type.STRING } },

                        // ══════════════════════════════════════════════════════
                        // ETAPA 1 — Consultividade / SPIN (3 critérios)
                        // ══════════════════════════════════════════════════════
                        nota_rapport:           { type: Type.NUMBER },
                        porque_rapport:         { type: Type.STRING },
                        melhoria_rapport:       { type: Type.STRING },

                        nota_spin:              { type: Type.NUMBER },
                        porque_spin:            { type: Type.STRING },
                        melhoria_spin:          { type: Type.STRING },

                        nota_comunicacao:       { type: Type.NUMBER },
                        porque_comunicacao:     { type: Type.STRING },
                        melhoria_comunicacao:   { type: Type.STRING },

                        nota_etapa1:            { type: Type.NUMBER },
                        porque_etapa1:          { type: Type.STRING },
                        melhoria_etapa1:        { type: Type.STRING },

                        // ══════════════════════════════════════════════════════
                        // ETAPA 2 — Apresentação da Ferramenta (4 critérios)
                        // ══════════════════════════════════════════════════════
                        nota_produto:           { type: Type.NUMBER },
                        porque_produto:         { type: Type.STRING },
                        melhoria_produto:       { type: Type.STRING },

                        nota_objecoes:          { type: Type.NUMBER },
                        porque_objecoes:        { type: Type.STRING },
                        melhoria_objecoes:      { type: Type.STRING },

                        nota_solucao_dor:       { type: Type.NUMBER },
                        porque_solucao_dor:     { type: Type.STRING },
                        melhoria_solucao_dor:   { type: Type.STRING },

                        nota_encantamento:      { type: Type.NUMBER },
                        porque_encantamento:    { type: Type.STRING },
                        melhoria_encantamento:  { type: Type.STRING },

                        nota_etapa2:            { type: Type.NUMBER },
                        porque_etapa2:          { type: Type.STRING },
                        melhoria_etapa2:        { type: Type.STRING },

                        // ══════════════════════════════════════════════════════
                        // ETAPA 3 — Negociação (5 critérios)
                        // ══════════════════════════════════════════════════════
                        nota_pre_fechamento:    { type: Type.NUMBER },
                        porque_pre_fechamento:  { type: Type.STRING },
                        melhoria_pre_fechamento:{ type: Type.STRING },

                        nota_escuta_ativa:      { type: Type.NUMBER },
                        porque_escuta_ativa:    { type: Type.STRING },
                        melhoria_escuta_ativa:  { type: Type.STRING },

                        nota_resiliencia:       { type: Type.NUMBER },
                        porque_resiliencia:     { type: Type.STRING },
                        melhoria_resiliencia:   { type: Type.STRING },

                        nota_gestao_tempo:      { type: Type.NUMBER },
                        porque_gestao_tempo:    { type: Type.STRING },
                        melhoria_gestao_tempo:  { type: Type.STRING },

                        nota_regras_fechamento: { type: Type.NUMBER },
                        porque_regras_fechamento:{ type: Type.STRING },
                        melhoria_regras_fechamento:{ type: Type.STRING },

                        nota_etapa3:            { type: Type.NUMBER },
                        porque_etapa3:          { type: Type.STRING },
                        melhoria_etapa3:        { type: Type.STRING },

                        // ══════════════════════════════════════════════════════
                        // AUDITORIA DE OBJEÇÕES (até 10 objeções)
                        // ══════════════════════════════════════════════════════
                        auditoria_objecoes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    numero:      { type: Type.NUMBER },
                                    tipo:        { type: Type.STRING },  // duvida, resistencia, preco, concorrente, urgencia, interesse, tecnica
                                    descricao:   { type: Type.STRING },
                                    contornada:  { type: Type.BOOLEAN },
                                    sugestao:    { type: Type.STRING }   // preenchido se não contornada
                                }
                            }
                        },
                        total_objecoes:            { type: Type.NUMBER },
                        objecoes_contornadas:      { type: Type.NUMBER },
                        objecoes_nao_contornadas:  { type: Type.NUMBER },
                        taxa_contorno_objecoes:    { type: Type.NUMBER },  // % de sucesso
                        analise_objecoes_resumo:   { type: Type.STRING },

                        // ── EXTRAS ───────────────────────────────────────────
                        tempo_fala_consultor:   { type: Type.NUMBER },
                        tempo_fala_cliente:     { type: Type.NUMBER },

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

                        pontos_fortes:          { type: Type.ARRAY, items: { type: Type.STRING } },
                        pontos_atencao:         { type: Type.ARRAY, items: { type: Type.STRING } },
                        justificativa_detalhada: { type: Type.STRING },

                        // ── QUALIFICAÇÃO SDR ─────────────────────────────────
                        qual_produto_identificado:  { type: Type.STRING },
                        qual_produto_no_portfolio:  { type: Type.BOOLEAN },
                        qual_produto_alerta:        { type: Type.STRING },

                        qual_contexto: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    label: { type: Type.STRING },
                                    valor: { type: Type.STRING }
                                }
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
                        "vendedor_nome", "media_final", "resumo_executivo", "chance_fechamento", "alerta_cancelamento",
                        "concorrentes_detectados",

                        // Etapa 1
                        "nota_rapport", "porque_rapport", "melhoria_rapport",
                        "nota_spin", "porque_spin", "melhoria_spin",
                        "nota_comunicacao", "porque_comunicacao", "melhoria_comunicacao",
                        "nota_etapa1", "porque_etapa1", "melhoria_etapa1",

                        // Etapa 2
                        "nota_produto", "porque_produto", "melhoria_produto",
                        "nota_objecoes", "porque_objecoes", "melhoria_objecoes",
                        "nota_solucao_dor", "porque_solucao_dor", "melhoria_solucao_dor",
                        "nota_encantamento", "porque_encantamento", "melhoria_encantamento",
                        "nota_etapa2", "porque_etapa2", "melhoria_etapa2",

                        // Etapa 3
                        "nota_pre_fechamento", "porque_pre_fechamento", "melhoria_pre_fechamento",
                        "nota_escuta_ativa", "porque_escuta_ativa", "melhoria_escuta_ativa",
                        "nota_resiliencia", "porque_resiliencia", "melhoria_resiliencia",
                        "nota_gestao_tempo", "porque_gestao_tempo", "melhoria_gestao_tempo",
                        "nota_regras_fechamento", "porque_regras_fechamento", "melhoria_regras_fechamento",
                        "nota_etapa3", "porque_etapa3", "melhoria_etapa3",

                        // Auditoria de Objeções
                        "auditoria_objecoes", "total_objecoes", "objecoes_contornadas",
                        "objecoes_nao_contornadas", "taxa_contorno_objecoes", "analise_objecoes_resumo",

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
            const rawText = typeof response.text === 'function' ? response.text() : response.text;
            console.log("RAW length:", rawText?.length, "| first 100:", rawText?.substring(0,100));
            analysisData = JSON.parse(rawText);
        } catch (parseError) {
            const rawText = typeof response.text === 'function' ? response.text() : response.text;
            console.error("Parse error:", parseError.message, "| raw:", rawText?.substring(0,300));
            return res.status(500).json({ error: "Erro ao processar resposta da IA: " + parseError.message });
        }

        // ── Inject UI config (hidden from frontend source) ─────────────────
        analysisData._config = {
            fields: [
                {
                    l: 'Consultividade / SPIN',
                    k: 'etapa1',
                    icon: 'search',
                    color: 'blue',
                    criterios: [
                        { l: 'Rapport',            k: 'rapport',     desc: 'Criou conexão inicial genuína com o cliente?' },
                        { l: 'SPIN',               k: 'spin',        desc: 'Aplicou perguntas de Situação, Problema, Implicação e Necessidade?' },
                        { l: 'Comunicação Eficaz', k: 'comunicacao', desc: 'Demonstrou clareza, empatia e escuta ativa?' }
                    ]
                },
                {
                    l: 'Apresentação da Ferramenta',
                    k: 'etapa2',
                    icon: 'presentation',
                    color: 'violet',
                    criterios: [
                        { l: 'Produto',                 k: 'produto',      desc: 'Apresentou funcionalidades relevantes para o cenário do cliente?' },
                        { l: 'Objeções',                k: 'objecoes',     desc: 'Contornou objeções de forma amistosa e convincente?' },
                        { l: 'Solução da Dor',          k: 'solucao_dor',  desc: 'Conectou a dor identificada à solução oferecida?' },
                        { l: 'Encantamento e Emoção',   k: 'encantamento', desc: 'Gerou entusiasmo e emoção comercial no cliente?' }
                    ]
                },
                {
                    l: 'Negociação',
                    k: 'etapa3',
                    icon: 'handshake',
                    color: 'emerald',
                    criterios: [
                        { l: 'Pré-Fechamento',       k: 'pre_fechamento',    desc: 'Preparou o terreno para o fechamento com técnicas adequadas?' },
                        { l: 'Escuta Ativa',         k: 'escuta_ativa',      desc: 'Exerceu escuta ativa com pausas para feedback do lead?' },
                        { l: 'Resiliência',          k: 'resiliencia',       desc: 'Demonstrou firmeza com bons argumentos para fechar?' },
                        { l: 'Gestão do Tempo',      k: 'gestao_tempo',      desc: 'Geriu bem o tempo garantindo call de qualidade em 60 min?' },
                        { l: 'Regras de Fechamento', k: 'regras_fechamento', desc: 'Seguiu as regras de fechamento do manual Nibo?' }
                    ]
                }
            ],
            objecaoTipos: {
                duvida:      { color: 'bg-sky-100 text-sky-800 border-sky-300',      icon: 'help-circle' },
                resistencia: { color: 'bg-amber-100 text-amber-800 border-amber-300', icon: 'shield' },
                preco:       { color: 'bg-red-100 text-red-800 border-red-300',       icon: 'dollar-sign' },
                concorrente: { color: 'bg-purple-100 text-purple-800 border-purple-300', icon: 'users' },
                urgencia:    { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: 'clock' },
                interesse:   { color: 'bg-slate-100 text-slate-800 border-slate-300',    icon: 'eye-off' },
                tecnica:     { color: 'bg-blue-100 text-blue-800 border-blue-300',       icon: 'settings' }
            },
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

        // ── Flag de mal qualificado para uso no save ──────────────────────
        const veredicto = (analysisData.qual_veredicto || '').toUpperCase();
        analysisData._mal_qualificado = veredicto.includes('MAL') || veredicto.includes('FORA');

        return res.status(200).json(analysisData);

    } catch (error) {
        console.error("Erro na API:", error);
        return res.status(500).json({ error: "Erro do Google Gemini: " + error.message });
    }
}
