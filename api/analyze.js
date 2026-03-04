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
        
        // Aqui está o "cérebro" atualizado com os seus novos critérios de auditoria!
        const systemInstruction = `Você é um auditor de vendas sênior especialista no Manual Nibo. 
        Analise a transcrição de vendas fornecida e retorne uma avaliação rigorosa, baseando as notas (0 a 10) e a justificativa nos seguintes blocos:

        1. POSTURA E CLAREZA DA APRESENTAÇÃO: Avalie a didática, linguagem comercial simplificada e conexão com o cenário do cliente. Sinais de excelência: analogias, explicações limpas, ausência de termos técnicos desnecessários. Oportunidades de melhoria: excesso de jargões, fala corrida ou confusa, falha na pedagogia da venda.
        2. PRODUTO E PERSONALIZAÇÃO DO PITCH: Avalie a adaptação do discurso à realidade do cliente, dores e momento de negócio. Sinais de excelência: pitch com exemplos próximos, similaridade com contexto do lead. Oportunidades de melhoria: apresentação padrão, sem customização.
        3. ESCUTA E PERGUNTAS PODEROSAS: Avalie a profundidade na investigação da dor, abertura de espaço para reflexão. Sinais de excelência: perguntas que geram silêncio reflexivo ou expandem o discurso do lead. Oportunidades de melhoria: perguntas rasas, genéricas ou de sim/não.
        4. EXPANSÃO E CONTORNO DE OBJEÇÕES: Avalie a antecipação, escuta ativa, técnica de espelhamento e argumento estruturado. Sinais de excelência: abordagem empática, clara e baseada em cases/dados. Oportunidades de melhoria: reatividade, confronto, argumentação fraca. (Regra: Se não tiver objeções na call, não penalize esta nota).
        5. FECHAMENTO, PRÉ-FECHAMENTO E JORNADA DO CLIENTE: Avalie perguntas de validação ("faz sentido?", "algo te trava?"), clareza nos próximos passos, expectativas de onboarding e implementação. Sinais de excelência: timeline clara, prazos definidos, tranquilidade transmitida. Oportunidades de melhoria: avanço direto sem validar o termômetro do cliente, final solto, sem cronograma, deixando dúvidas abertas.
        6. RAPPORT: Avalie a conexão humana, quebra-gelo e empatia natural durante a conversa.

        Gere as notas de 0 a 10 para cada bloco principal. Extraia pontos fortes, pontos de atenção e identifique riscos reais. 
        Na "justificativa_detalhada", escreva um relatório completo em Markdown detalhando a performance do consultor com base nesses critérios específicos de excelência e melhoria.`;

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
