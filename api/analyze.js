import { GoogleGenAI, Type } from '@google/genai';

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
        const systemInstruction = `Você é um auditor de vendas sênior especialista no Manual Nibo. Analise a transcrição de vendas fornecida e retorne uma avaliação rigorosa, extraindo as notas, feedbacks, tempo de fala e preenchendo o checklist. Seja analítico, direto e identifique riscos reais.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        media_final: { type: Type.NUMBER },
                        resumo_executivo: { type: Type.STRING },
                        chance_fechamento: { type: Type.STRING },
                        alerta_cancelamento: { type: Type.STRING },
                        concorrentes_detectados: { type: Type.ARRAY, items: { type: Type.STRING } },
                        nota_postura: { type: Type.NUMBER },
                        porque_postura: { type: Type.STRING },
                        nota_conhecimento: { type: Type.NUMBER },
                        porque_conhecimento: { type: Type.STRING },
                        nota_escuta: { type: Type.NUMBER },
                        porque_escuta: { type: Type.STRING },
                        nota_expansao: { type: Type.NUMBER },
                        porque_expansao: { type: Type.STRING },
                        nota_fechamento: { type: Type.NUMBER },
                        porque_fechamento: { type: Type.STRING },
                        nota_rapport: { type: Type.NUMBER },
                        porque_rapport: { type: Type.STRING },
                        tempo_fala_consultor: { type: Type.NUMBER },
                        tempo_fala_cliente: { type: Type.NUMBER },
                        checklist_fechamento: {
                            type: Type.OBJECT,
                            properties: {
                                resolveu_pontos_iniciais: { type: Type.BOOLEAN },
                                pediu_feedback_ferramenta: { type: Type.BOOLEAN },
                                pediu_voto_confianca: { type: Type.BOOLEAN },
                                tratou_objecao_socio: { type: Type.BOOLEAN },
                                validou_mensalidade_vs_setup: { type: Type.BOOLEAN },
                                mencionou_gestao_financeira_gratuita: { type: Type.BOOLEAN }
                            }
                        },
                        pontos_fortes: { type: Type.ARRAY, items: { type: Type.STRING } },
                        pontos_atencao: { type: Type.ARRAY, items: { type: Type.STRING } },
                        justificativa_detalhada: { type: Type.STRING }
                    },
                    required: ["media_final", "resumo_executivo", "chance_fechamento", "alerta_cancelamento", "concorrentes_detectados", "nota_postura", "porque_postura", "nota_conhecimento", "porque_conhecimento", "nota_escuta", "porque_escuta", "nota_expansao", "porque_expansao", "nota_fechamento", "porque_fechamento", "nota_rapport", "porque_rapport", "tempo_fala_consultor", "tempo_fala_cliente", "checklist_fechamento", "pontos_fortes", "pontos_atencao", "justificativa_detalhada"]
                }
            }
        });

        const analysisData = JSON.parse(response.text);
        return res.status(200).json(analysisData);

    } catch (error) {
        console.error("Erro na API:", error);
        return res.status(500).json({ error: "Falha ao analisar a transcrição." });
    }
}
