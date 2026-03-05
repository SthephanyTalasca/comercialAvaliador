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
        
        const systemInstruction = `Você é um auditor de vendas sênior. Avalie a transcrição e dê notas de 1 a 5 para os seguintes 12 pilares:
        1. Postura: Profissionalismo e condução geral.
        2. Produto (Conhecimento): Domínio da ferramenta.
        3. Escuta: Atenção ao que o cliente diz.
        4. Expansão: Capacidade de fazer up-sell ou cross-sell.
        5. Fechamento: Chamada para ação final.
        6. Rapport: Conexão humana e quebra-gelo.
        7. Pré-Fechamento: Perguntas de validação ("faz sentido?").
        8. Jornada do Cliente: Clareza nos próximos passos.
        9. Personalização do Pitch: Adaptação à realidade e dores do cliente.
        10. Perguntas Poderosas: Profundidade na investigação, gerar reflexão.
        11. Contorno de Objeções: Antecipação, empatia, espelhamento. (Se não houver objeções, nota 5).
        12. Clareza da Apresentação: Didática, sem jargões desnecessários, analogias.
        
        Para CADA PILAR, forneça:
        1. A nota de 1 a 5.
        2. O motivo da nota ("porque_...").
        3. O que faltou para a nota máxima 5 ("melhoria_..."). Se a nota for 5, escreva "Critério de excelência atingido."

        Calcule a média final de 1 a 5. Identifique concorrentes, risco de cancelamento, pontos fortes e fracos, e escreva um relatório completo em Markdown.`;

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
                        
                        nota_postura: { type: Type.NUMBER }, porque_postura: { type: Type.STRING }, melhoria_postura: { type: Type.STRING },
                        nota_conhecimento: { type: Type.NUMBER }, porque_conhecimento: { type: Type.STRING }, melhoria_conhecimento: { type: Type.STRING },
                        nota_escuta: { type: Type.NUMBER }, porque_escuta: { type: Type.STRING }, melhoria_escuta: { type: Type.STRING },
                        nota_expansao: { type: Type.NUMBER }, porque_expansao: { type: Type.STRING }, melhoria_expansao: { type: Type.STRING },
                        nota_fechamento: { type: Type.NUMBER }, porque_fechamento: { type: Type.STRING }, melhoria_fechamento: { type: Type.STRING },
                        nota_rapport: { type: Type.NUMBER }, porque_rapport: { type: Type.STRING }, melhoria_rapport: { type: Type.STRING },
                        nota_pre_fechamento: { type: Type.NUMBER }, porque_pre_fechamento: { type: Type.STRING }, melhoria_pre_fechamento: { type: Type.STRING },
                        nota_jornada_cliente: { type: Type.NUMBER }, porque_jornada_cliente: { type: Type.STRING }, melhoria_jornada_cliente: { type: Type.STRING },
                        nota_personalizacao_pitch: { type: Type.NUMBER }, porque_personalizacao_pitch: { type: Type.STRING }, melhoria_personalizacao_pitch: { type: Type.STRING },
                        nota_perguntas_poderosas: { type: Type.NUMBER }, porque_perguntas_poderosas: { type: Type.STRING }, melhoria_perguntas_poderosas: { type: Type.STRING },
                        nota_contorno_objecoes: { type: Type.NUMBER }, porque_contorno_objecoes: { type: Type.STRING }, melhoria_contorno_objecoes: { type: Type.STRING },
                        nota_clareza_apresentacao: { type: Type.NUMBER }, porque_clareza_apresentacao: { type: Type.STRING }, melhoria_clareza_apresentacao: { type: Type.STRING },
                        
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
                    required: [
                        "media_final", "resumo_executivo", "chance_fechamento", "alerta_cancelamento", "concorrentes_detectados", 
                        "nota_postura", "porque_postura", "melhoria_postura",
                        "nota_conhecimento", "porque_conhecimento", "melhoria_conhecimento",
                        "nota_escuta", "porque_escuta", "melhoria_escuta",
                        "nota_expansao", "porque_expansao", "melhoria_expansao",
                        "nota_fechamento", "porque_fechamento", "melhoria_fechamento",
                        "nota_rapport", "porque_rapport", "melhoria_rapport",
                        "nota_pre_fechamento", "porque_pre_fechamento", "melhoria_pre_fechamento",
                        "nota_jornada_cliente", "porque_jornada_cliente", "melhoria_jornada_cliente",
                        "nota_personalizacao_pitch", "porque_personalizacao_pitch", "melhoria_personalizacao_pitch",
                        "nota_perguntas_poderosas", "porque_perguntas_poderosas", "melhoria_perguntas_poderosas",
                        "nota_contorno_objecoes", "porque_contorno_objecoes", "melhoria_contorno_objecoes",
                        "nota_clareza_apresentacao", "porque_clareza_apresentacao", "melhoria_clareza_apresentacao",
                        "tempo_fala_consultor", "tempo_fala_cliente", "checklist_fechamento", "pontos_fortes", "pontos_atencao", "justificativa_detalhada"
                    ]
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
