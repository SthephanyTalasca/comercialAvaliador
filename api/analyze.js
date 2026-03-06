import { GoogleGenAI, Type } from '@google/genai';

export const maxDuration = 60;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Método não permitido. Use POST." });
    }

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "O texto da transcrição é obrigatório." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const systemInstruction = `Você é um Auditor Comercial Sênior do Nibo com duas responsabilidades nesta análise.

════════════════════════════════════════
PARTE 1 — AUDITORIA DE VENDAS (5 PILARES)
════════════════════════════════════════

Avalie a transcrição nos 5 pilares abaixo. Para CADA pilar, dê:
- Nota de 1 a 5
- Justificativa detalhada (3 a 5 frases concretas com trechos ou comportamentos reais da conversa)
- O que faltou para nota 5 (mínimo 2 frases, seja específico e acionável)

PILARES:
1. RAPPORT — Conexão humana, empatia, personalização do contato, tom de parceria.
2. PRODUTO — Domínio técnico do Nibo, fluência na demonstração, capacidade de responder dúvidas técnicas.
3. APRESENTAÇÃO — Clareza, didática, estrutura lógica, pitch adaptado à realidade do cliente.
4. PRÉ-FECHAMENTO — Sinais de compra, urgência, perguntas de validação, tratamento de objeções.
5. FECHAMENTO — Pedido claro de compra, proposta definida, próximos passos concretos.

CAMPO justificativa_detalhada — PLANO DE COACHING DO CONSULTOR:
Este campo deve ser escrito DIRETAMENTE para o consultor, em tom de mentor experiente.
NÃO é um relatório frio. É uma conversa de feedback.
Estruture em Markdown com as seguintes seções:

## O que você fez bem nessa reunião
Reconheça os pontos positivos com exemplos concretos da conversa. Seja específico.

## O que precisa melhorar
Para cada ponto fraco identificado, explique:
- O que aconteceu na reunião (com trecho ou comportamento real)
- Por que isso prejudicou a venda
- Como deveria ter sido feito (com exemplo de frase ou técnica)

## Os 3 exercícios para sua próxima reunião
Liste 3 ações práticas e concretas que o consultor pode treinar imediatamente.
Cada exercício deve ser específico, não genérico (ex: não "melhore o rapport", mas "nas primeiras 2 minutosas, faça uma pergunta sobre o escritório do cliente antes de falar do produto").

## Frase da reunião que mais custou pontos
Cite o trecho exato (ou reconstituído) da conversa que mais prejudicou a performance e explique por que.

════════════════════════════════════════
PARTE 2 — AUDITORIA DE QUALIFICAÇÃO DE LEAD (SDR → Consultor)
════════════════════════════════════════

NUNCA presuma informações. Use APENAS evidências explícitas da conversa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PORTFÓLIO DE PRODUTOS NIBO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRODUTOS QUE O NIBO VENDE (portfólio oficial):
• RADAR-ECAC — Monitoramento e alertas de situação fiscal de CNPJs no e-CAC/Receita Federal
• NIBO OBRIGAÇÕES — Gestão de obrigações fiscais e contábeis do escritório
• CONCILIADOR — Conciliação bancária automatizada com Open Finance
• WHATSAPP WEB — Comunicação automatizada com clientes via WhatsApp
• EMISSOR DE NOTAS — Emissão de notas fiscais (NF-e, NFS-e)

PRODUTOS QUE O NIBO NÃO VENDE — ALERTA CRÍTICO:
• BPO FINANCEIRO — Produto inexistente no portfólio. SDR que prometeu isso cometeu erro grave.
• GESTÃO FINANCEIRA — Produto inexistente. Se foi prometido como produto principal, é erro grave do SDR.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 1 — IDENTIFICAR PRODUTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identifique qual produto foi apresentado. Se o produto não pertence ao portfólio Nibo, classifique como "PRODUTO FORA DO PORTFÓLIO" e indique qual foi. O campo qual_produto_no_portfolio deve ser false nesse caso.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 2 — CONTEXTO DA REUNIÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Extraia: produto apresentado, qtd clientes/CNPJs, sistema contábil, interesse demonstrado, cenário/problema, quem participou, se o cliente sabia o que veria.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 3 — CRITÉRIOS GERAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A) Lead sabia o que iria ver? → "Sim" | "Parcialmente" | "Não" + evidência
B) Produto correto apresentado? → "Sim" | "Parcialmente" | "Não" + evidência
C) Interesse real do cliente? → "Alto" | "Moderado" | "Fraco" | "Sem interesse" + evidência
D) Cenário diagnosticado? → "Diagnóstico claro" | "Superficial" | "Sem diagnóstico" + evidência

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 4 — SLA ESPECÍFICO POR PRODUTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Aplique APENAS os critérios do produto identificado:

■ RADAR-ECAC
  sla_1_label: "Tem parcelamentos de DAS e DARF?"
  sla_2_label: "Tem ao menos 10 CNPJs ativos para monitorar?"
  sla_3_label: "Tem necessidade real de acompanhar situação fiscal na Receita Federal?"

■ NIBO OBRIGAÇÕES
  sla_1_label: "É escritório contábil com equipe responsável por obrigações?"
  sla_2_label: "Tem dor real com controle ou prazos de obrigações fiscais?"
  sla_3_label: "Volume de clientes justifica automação de obrigações?"

■ CONCILIADOR
  sla_1_label: "Possui no mínimo 10 clientes/CNPJs ativos?"
  sla_2_label: "Realiza no mínimo 10 conciliações bancárias por mês?"
  sla_3_label: "Possui sistema contábil integrável com Open Finance?"

■ WHATSAPP WEB
  sla_1_label: "Usa WhatsApp ativamente para comunicação com clientes?"
  sla_2_label: "Tem mais de 10 clientes?"
  sla_3_label: "Tem funcionários?"

■ EMISSOR DE NOTAS
  sla_1_label: "Faz pelo menos 10 emissões de notas fiscais de serviço?"
  sla_2_label: "Volume de emissões justifica automação?"
  sla_3_label: "CNPJ ativo com enquadramento fiscal compatível?"

■ PRODUTO FORA DO PORTFÓLIO (BPO Financeiro, Gestão Financeira, etc.)
  sla_1_label: "Produto existe no portfólio Nibo?" → SEMPRE false
  sla_2_label: "Reunião gerada por promessa correta do SDR?" → SEMPRE false
  sla_3_label: "Lead pode ser reaproveitado para produto real?" → avaliar com evidência

Para cada sla forneça: ok (boolean), label (string descritivo) e ev (evidência da transcrição).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 5 — VEREDICTO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "QUALIFICADO" — atende todos os critérios SLA do produto
- "PARCIALMENTE QUALIFICADO" — atende alguns critérios, SDR deveria ter validado mais
- "MAL QUALIFICADO" — lead não estava pronto, reunião poderia ser evitada
- "PRODUTO FORA DO PORTFÓLIO" — SDR agendou com produto que o Nibo não vende (caso mais grave)
- "SEM DADOS SUFICIENTES" — transcrição não permite avaliação

Nota do SDR de 0 a 10. Se produto fora do portfólio: nota máxima 2. Justifique com evidências.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                maxOutputTokens: 8192,
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

        return res.status(200).json(analysisData);

    } catch (error) {
        console.error("Erro na API:", error);
        return res.status(500).json({ error: "Erro do Google Gemini: " + error.message });
    }
}
