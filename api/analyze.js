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

        const systemInstruction = `Você é um Auditor Comercial Sênior do Nibo com duas responsabilidades nesta análise:

════════════════════════════════════════
PARTE 1 — AUDITORIA DE VENDAS (5 PILARES)
════════════════════════════════════════

Avalie a transcrição nos 5 pilares abaixo. Para CADA pilar, dê:
- Nota de 1 a 5
- Justificativa detalhada (3 a 5 frases concretas, com trechos ou comportamentos da conversa)
- O que faltou para nota 5 (seja específico e acionável, mínimo 2 frases)

PILARES:

1. RAPPORT
   Avalie: conexão humana, empatia, personalização do contato, tom de parceria. O consultor criou confiança genuína? Usou o nome do cliente? Identificou contexto pessoal?

2. PRODUTO
   Avalie: domínio técnico do Nibo, fluência na demonstração, uso de funcionalidades corretas para o perfil do cliente, capacidade de responder dúvidas técnicas sem hesitar.

3. APRESENTAÇÃO
   Avalie: clareza e didática na comunicação, estrutura lógica da apresentação, se o pitch foi adaptado à realidade do cliente, se evitou jargão desnecessário.

4. PRÉ-FECHAMENTO
   Avalie: identificação de sinais de compra, criação de urgência, perguntas de validação de interesse, tratamento de objeções, encaminhamento da decisão.

5. FECHAMENTO
   Avalie: pedido claro de compra ou avanço no negócio, proposta definida, próximos passos concretos, confirmação de timeline e responsáveis.

════════════════════════════════════════
PARTE 2 — AUDITORIA DE QUALIFICAÇÃO DE LEAD (SDR → Consultor)
════════════════════════════════════════

Analise se o lead foi corretamente qualificado pelo pré-vendas antes de chegar ao consultor.
NUNCA presuma informações. Use apenas evidências explícitas da conversa.

ETAPA 1 — CONTEXTO DA REUNIÃO
Extraia da conversa:
- Produto apresentado na reunião
- Quantidade de clientes/CNPJs do escritório contábil
- Sistema contábil utilizado
- Interesse demonstrado pelo cliente
- Cenário ou problema mencionado
- Quem participou (cargo/função)
- Se o cliente sabia o que iria ver

ETAPA 2 — CRITÉRIOS DE QUALIFICAÇÃO

A) O lead sabia o que iria ver?
   Classifique: "Sim" | "Parcialmente" | "Não"
   Indícios de problema: cliente pergunta "o que é essa reunião?", "o que vocês fazem?", não reconhece o produto.
   Cite o trecho exato que comprova.

B) O produto apresentado foi o mesmo prospectado?
   Classifique: "Sim" | "Parcialmente" | "Não"
   Verifique: mudança de produto, confusão de solução, reunião genérica.
   Cite evidência.

C) O cliente demonstrava interesse real?
   Classifique: "Alto" | "Moderado" | "Fraco" | "Sem interesse"
   Avalie: perguntas feitas, curiosidade, participação ativa, respostas curtas/evasivas.

D) Existia cenário diagnosticado?
   Classifique: "Diagnóstico claro" | "Superficial" | "Sem diagnóstico"
   Verifique se SDR identificou: situação atual, problema e dor clara.

ETAPA 3 — SLA DE QUALIFICAÇÃO (Conciliador Open Finance)
Valide CADA critério abaixo com Sim/Não + evidência:
- Mínimo 10 clientes/CNPJs
- Realiza pelo menos 10 conciliações por mês
- Possui sistema contábil integrável

ETAPA 4 — VEREDICTO FINAL DA QUALIFICAÇÃO
Classifique o lead como:
- "QUALIFICADO" — atende todos os critérios SLA
- "PARCIALMENTE QUALIFICADO" — atende alguns critérios, SDR deveria ter validado mais
- "MAL QUALIFICADO" — lead não estava pronto, reunião poderia ser evitada
- "SEM DADOS SUFICIENTES" — transcrição não permite avaliação

Dê uma nota de 0 a 10 para a qualidade da qualificação do SDR e justifique.

Seja extremamente crítico, direto e baseado em evidências. Toda afirmação deve ter respaldo na transcrição.`;

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
                        media_final:            { type: Type.NUMBER },
                        resumo_executivo:       { type: Type.STRING },
                        chance_fechamento:      { type: Type.STRING },
                        alerta_cancelamento:    { type: Type.STRING },
                        concorrentes_detectados:{ type: Type.ARRAY, items: { type: Type.STRING } },

                        // 5 Pilares
                        nota_rapport:           { type: Type.NUMBER },
                        porque_rapport:         { type: Type.STRING },
                        melhoria_rapport:       { type: Type.STRING },

                        nota_produto:           { type: Type.NUMBER },
                        porque_produto:         { type: Type.STRING },
                        melhoria_produto:       { type: Type.STRING },

                        nota_apresentacao:      { type: Type.NUMBER },
                        porque_apresentacao:    { type: Type.STRING },
                        melhoria_apresentacao:  { type: Type.STRING },

                        nota_pre_fechamento:    { type: Type.NUMBER },
                        porque_pre_fechamento:  { type: Type.STRING },
                        melhoria_pre_fechamento:{ type: Type.STRING },

                        nota_fechamento:        { type: Type.NUMBER },
                        porque_fechamento:      { type: Type.STRING },
                        melhoria_fechamento:    { type: Type.STRING },

                        tempo_fala_consultor:   { type: Type.STRING },
                        tempo_fala_cliente:     { type: Type.STRING },

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

                        // ── PARTE 2: QUALIFICAÇÃO DE LEAD ───────────────────
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

                        qual_sabia_o_que_veria:           { type: Type.STRING },
                        qual_sabia_evidencia:             { type: Type.STRING },
                        qual_produto_correto:             { type: Type.STRING },
                        qual_produto_evidencia:           { type: Type.STRING },
                        qual_interesse_real:              { type: Type.STRING },
                        qual_interesse_evidencia:         { type: Type.STRING },
                        qual_cenario_diagnosticado:       { type: Type.STRING },
                        qual_cenario_evidencia:           { type: Type.STRING },

                        qual_sla_minimo_10_clientes:      { type: Type.BOOLEAN },
                        qual_sla_minimo_10_clientes_ev:   { type: Type.STRING },
                        qual_sla_10_conciliacoes:         { type: Type.BOOLEAN },
                        qual_sla_10_conciliacoes_ev:      { type: Type.STRING },
                        qual_sla_sistema_integravel:      { type: Type.BOOLEAN },
                        qual_sla_sistema_integravel_ev:   { type: Type.STRING },

                        qual_veredicto:                   { type: Type.STRING },
                        qual_nota_sdr:                    { type: Type.NUMBER },
                        qual_nota_sdr_justificativa:      { type: Type.STRING },
                        qual_analise_completa:            { type: Type.STRING }
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
                        "qual_contexto",
                        "qual_sabia_o_que_veria", "qual_sabia_evidencia",
                        "qual_produto_correto", "qual_produto_evidencia",
                        "qual_interesse_real", "qual_interesse_evidencia",
                        "qual_cenario_diagnosticado", "qual_cenario_evidencia",
                        "qual_sla_minimo_10_clientes", "qual_sla_minimo_10_clientes_ev",
                        "qual_sla_10_conciliacoes", "qual_sla_10_conciliacoes_ev",
                        "qual_sla_sistema_integravel", "qual_sla_sistema_integravel_ev",
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
