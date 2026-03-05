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

        const systemInstruction = `Você é um auditor sênior de Vendas do Nibo. Avalie a transcrição de uma reunião de vendas e dê notas de 1 a 5 para os seguintes 12 pilares:

        1. Postura: Profissionalismo, confiança e presença do consultor.
        2. Clareza da Apresentação: Comunicação objetiva e didática do produto.
        3. Conhecimento de Produto: Domínio técnico e fluência na demonstração do Nibo.
        4. Personalização do Pitch: Adaptação da abordagem à realidade do cliente.
        5. Escuta Ativa: Atenção às necessidades, dores e sinais do cliente.
        6. Perguntas Poderosas: Uso de perguntas que aprofundam dores e criam consciência de valor.
        7. Contorno de Objeções: Capacidade de neutralizar resistências com calma e argumentação sólida.
        8. Expansão: Identificação e exploração de oportunidades de upsell/cross-sell.
        9. Pré-Fechamento: Criação de urgência, validação de interesse e encaminhamento da decisão.
        10. Fechamento: Pedido claro de compra ou avanço concreto no negócio.
        11. Jornada do Cliente: Alinhamento de próximos passos, prazos e expectativas.
        12. Rapport: Conexão humana, empatia e tom de parceria com o cliente.

        Para CADA PILAR, forneça:
        - A nota de 1 a 5.
        - O motivo da nota ("porque_..."). Máximo 2 frases, seja direto.
        - O que faltou para a nota 5 ("melhoria_..."). Se nota for 5, escreva "Critério de excelência atingido."

        Indique também:
        - chance_fechamento: avaliação da probabilidade de fechamento deste negócio (ex: "Alta — cliente demonstrou forte interesse").
        - alerta_cancelamento: principal risco que pode fazer o negócio cair (ex: "Sócio não estava na reunião").
        - concorrentes_detectados: lista de concorrentes mencionados na conversa (array de strings, vazio se nenhum).
        - tempo_fala_consultor e tempo_fala_cliente como strings no formato "XX%" (ex: "65%").
        - checklist_fechamento com 6 critérios booleanos.
        - pontos_fortes e pontos_atencao como arrays de strings.
        - justificativa_detalhada: relatório em Markdown com análise completa da venda.
        
        Mantenha os textos diretos e objetivos. É vital que a resposta não seja cortada.`;

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
                        media_final:            { type: Type.NUMBER },
                        resumo_executivo:       { type: Type.STRING },
                        chance_fechamento:      { type: Type.STRING },
                        alerta_cancelamento:    { type: Type.STRING },
                        concorrentes_detectados:{ type: Type.ARRAY, items: { type: Type.STRING } },

                        // 12 Pilares
                        nota_postura:               { type: Type.NUMBER }, porque_postura:               { type: Type.STRING }, melhoria_postura:               { type: Type.STRING },
                        nota_clareza_apresentacao:  { type: Type.NUMBER }, porque_clareza_apresentacao:  { type: Type.STRING }, melhoria_clareza_apresentacao:  { type: Type.STRING },
                        nota_conhecimento:          { type: Type.NUMBER }, porque_conhecimento:          { type: Type.STRING }, melhoria_conhecimento:          { type: Type.STRING },
                        nota_personalizacao_pitch:  { type: Type.NUMBER }, porque_personalizacao_pitch:  { type: Type.STRING }, melhoria_personalizacao_pitch:  { type: Type.STRING },
                        nota_escuta:                { type: Type.NUMBER }, porque_escuta:                { type: Type.STRING }, melhoria_escuta:                { type: Type.STRING },
                        nota_perguntas_poderosas:   { type: Type.NUMBER }, porque_perguntas_poderosas:   { type: Type.STRING }, melhoria_perguntas_poderosas:   { type: Type.STRING },
                        nota_contorno_objecoes:     { type: Type.NUMBER }, porque_contorno_objecoes:     { type: Type.STRING }, melhoria_contorno_objecoes:     { type: Type.STRING },
                        nota_expansao:              { type: Type.NUMBER }, porque_expansao:              { type: Type.STRING }, melhoria_expansao:              { type: Type.STRING },
                        nota_pre_fechamento:        { type: Type.NUMBER }, porque_pre_fechamento:        { type: Type.STRING }, melhoria_pre_fechamento:        { type: Type.STRING },
                        nota_fechamento:            { type: Type.NUMBER }, porque_fechamento:            { type: Type.STRING }, melhoria_fechamento:            { type: Type.STRING },
                        nota_jornada_cliente:       { type: Type.NUMBER }, porque_jornada_cliente:       { type: Type.STRING }, melhoria_jornada_cliente:       { type: Type.STRING },
                        nota_rapport:               { type: Type.NUMBER }, porque_rapport:               { type: Type.STRING }, melhoria_rapport:               { type: Type.STRING },

                        tempo_fala_consultor: { type: Type.STRING },
                        tempo_fala_cliente:   { type: Type.STRING },

                        checklist_fechamento: {
                            type: Type.OBJECT,
                            properties: {
                                resolveu_pontos_iniciais:           { type: Type.BOOLEAN },
                                pediu_feedback_ferramenta:          { type: Type.BOOLEAN },
                                pediu_voto_confianca:               { type: Type.BOOLEAN },
                                tratou_objecao_socio:               { type: Type.BOOLEAN },
                                validou_mensalidade_vs_setup:       { type: Type.BOOLEAN },
                                mencionou_gestao_financeira_gratuita: { type: Type.BOOLEAN }
                            }
                        },

                        pontos_fortes:         { type: Type.ARRAY, items: { type: Type.STRING } },
                        pontos_atencao:        { type: Type.ARRAY, items: { type: Type.STRING } },
                        justificativa_detalhada: { type: Type.STRING }
                    },
                    required: [
                        "media_final", "resumo_executivo", "chance_fechamento", "alerta_cancelamento", "concorrentes_detectados",
                        "nota_postura", "porque_postura", "melhoria_postura",
                        "nota_clareza_apresentacao", "porque_clareza_apresentacao", "melhoria_clareza_apresentacao",
                        "nota_conhecimento", "porque_conhecimento", "melhoria_conhecimento",
                        "nota_personalizacao_pitch", "porque_personalizacao_pitch", "melhoria_personalizacao_pitch",
                        "nota_escuta", "porque_escuta", "melhoria_escuta",
                        "nota_perguntas_poderosas", "porque_perguntas_poderosas", "melhoria_perguntas_poderosas",
                        "nota_contorno_objecoes", "porque_contorno_objecoes", "melhoria_contorno_objecoes",
                        "nota_expansao", "porque_expansao", "melhoria_expansao",
                        "nota_pre_fechamento", "porque_pre_fechamento", "melhoria_pre_fechamento",
                        "nota_fechamento", "porque_fechamento", "melhoria_fechamento",
                        "nota_jornada_cliente", "porque_jornada_cliente", "melhoria_jornada_cliente",
                        "nota_rapport", "porque_rapport", "melhoria_rapport",
                        "tempo_fala_consultor", "tempo_fala_cliente",
                        "checklist_fechamento", "pontos_fortes", "pontos_atencao", "justificativa_detalhada"
                    ]
                }
            }
        });

        let analysisData;
        try {
            analysisData = JSON.parse(response.text);
        } catch (parseError) {
            console.error("Erro ao fazer parse do JSON (texto cortado?):", response.text);
            return res.status(500).json({ error: "A IA gerou um texto muito longo e foi cortada. Tente com uma transcrição menor." });
        }

        return res.status(200).json(analysisData);

    } catch (error) {
        console.error("Erro na API:", error);
        return res.status(500).json({ error: "Erro do Google Gemini: " + error.message });
    }
}
