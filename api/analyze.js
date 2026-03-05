import { GoogleGenAI, Type } from '@google/genai';

// Aumenta o tempo limite da Vercel
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
        
        const systemInstruction = `Você é um auditor sênior de Customer Success (Sucesso do Cliente) do Nibo. Avalie a transcrição de implementação/onboarding e dê notas de 1 a 5 para os seguintes 17 pilares:

        1. Consultividade: Age como parceiro estratégico.
        2. Escuta Ativa: Ouve necessidades e adapta a conversa.
        3. Jornada do Cliente: Estabelece prazos e próximos passos.
        4. Encantamento: Entrega valor e cria momentos "uau".
        5. Objeções: Lida com problemas (bugs, falta de certificado) com calma e solução.
        6. Rapport: Conexão humana, empatia e tom amigável.
        7. Autoridade: Confiança, ritmo diretivo e segurança técnica.
        8. Postura: Profissionalismo e resiliência diante de bugs.
        9. Gestão de Tempo: Cobre a pauta adequadamente.
        10. Contextualização: Explica o "porquê" de cada função.
        11. Clareza: Comunicação didática para diferentes níveis.
        12. Objetividade: Respostas assertivas e diretas.
        13. Flexibilidade: Adapta o roteiro caso o cliente trave.
        14. Domínio de Produto: Navegação fluida no Nibo.
        15. Domínio do Negócio: Entende os modelos contábeis e conecta com o Nibo.
        16. Compreensão do Ecossistema Nibo: Diferencia Obrigações, Financeiro, BPO, etc.
        17. Universo da Contabilidade: Usa linguagem contábil com naturalidade.

        Para CADA PILAR, forneça:
        1. A nota de 1 a 5.
        2. O motivo da nota ("porque_..."). Seja conciso (máximo 2 frases).
        3. O que faltou para a nota 5 ("melhoria_..."). Se a nota for 5, escreva "Critério de excelência atingido." Seja conciso.
        
        Indique também o Risco de Churn, a Saúde do Cliente e gere um relatório estruturado em Markdown. É vital que a resposta não seja cortada, mantenha os textos diretos e objetivos.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                maxOutputTokens: 8192, // <--- AQUI ESTÁ A SOLUÇÃO DO CORTE DE TEXTO
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        media_final: { type: Type.NUMBER },
                        resumo_executivo: { type: Type.STRING },
                        saude_cliente: { type: Type.STRING },
                        risco_churn: { type: Type.STRING },
                        sistemas_citados: { type: Type.ARRAY, items: { type: Type.STRING } },
                        
                        nota_consultividade: { type: Type.NUMBER }, porque_consultividade: { type: Type.STRING }, melhoria_consultividade: { type: Type.STRING },
                        nota_escuta_ativa: { type: Type.NUMBER }, porque_escuta_ativa: { type: Type.STRING }, melhoria_escuta_ativa: { type: Type.STRING },
                        nota_jornada_cliente: { type: Type.NUMBER }, porque_jornada_cliente: { type: Type.STRING }, melhoria_jornada_cliente: { type: Type.STRING },
                        nota_encantamento: { type: Type.NUMBER }, porque_encantamento: { type: Type.STRING }, melhoria_encantamento: { type: Type.STRING },
                        nota_objecoes: { type: Type.NUMBER }, porque_objecoes: { type: Type.STRING }, melhoria_objecoes: { type: Type.STRING },
                        nota_rapport: { type: Type.NUMBER }, porque_rapport: { type: Type.STRING }, melhoria_rapport: { type: Type.STRING },
                        nota_autoridade: { type: Type.NUMBER }, porque_autoridade: { type: Type.STRING }, melhoria_autoridade: { type: Type.STRING },
                        nota_postura: { type: Type.NUMBER }, porque_postura: { type: Type.STRING }, melhoria_postura: { type: Type.STRING },
                        nota_gestao_tempo: { type: Type.NUMBER }, porque_gestao_tempo: { type: Type.STRING }, melhoria_gestao_tempo: { type: Type.STRING },
                        nota_contextualizacao: { type: Type.NUMBER }, porque_contextualizacao: { type: Type.STRING }, melhoria_contextualizacao: { type: Type.STRING },
                        nota_clareza: { type: Type.NUMBER }, porque_clareza: { type: Type.STRING }, melhoria_clareza: { type: Type.STRING },
                        nota_objetividade: { type: Type.NUMBER }, porque_objetividade: { type: Type.STRING }, melhoria_objetividade: { type: Type.STRING },
                        nota_flexibilidade: { type: Type.NUMBER }, porque_flexibilidade: { type: Type.STRING }, melhoria_flexibilidade: { type: Type.STRING },
                        nota_dominio_produto: { type: Type.NUMBER }, porque_dominio_produto: { type: Type.STRING }, melhoria_dominio_produto: { type: Type.STRING },
                        nota_dominio_negocio: { type: Type.NUMBER }, porque_dominio_negocio: { type: Type.STRING }, melhoria_dominio_negocio: { type: Type.STRING },
                        nota_ecossistema_nibo: { type: Type.NUMBER }, porque_ecossistema_nibo: { type: Type.STRING }, melhoria_ecossistema_nibo: { type: Type.STRING },
                        nota_universo_contabil: { type: Type.NUMBER }, porque_universo_contabil: { type: Type.STRING }, melhoria_universo_contabil: { type: Type.STRING },
                        
                        tempo_fala_cs: { type: Type.NUMBER },
                        tempo_fala_cliente: { type: Type.NUMBER },
                        checklist_cs: {
                            type: Type.OBJECT,
                            properties: {
                                definiu_prazo_implementacao: { type: Type.BOOLEAN },
                                alinhou_dever_de_casa: { type: Type.BOOLEAN },
                                validou_certificado_digital: { type: Type.BOOLEAN },
                                agendou_proximo_passo: { type: Type.BOOLEAN },
                                conectou_com_dor_vendas: { type: Type.BOOLEAN },
                                explicou_canal_suporte: { type: Type.BOOLEAN }
                            }
                        },
                        pontos_fortes: { type: Type.ARRAY, items: { type: Type.STRING } },
                        pontos_atencao: { type: Type.ARRAY, items: { type: Type.STRING } },
                        justificativa_detalhada: { type: Type.STRING }
                    },
                    required: [
                        "media_final", "resumo_executivo", "saude_cliente", "risco_churn", "sistemas_citados", 
                        "nota_consultividade", "porque_consultividade", "melhoria_consultividade",
                        "nota_escuta_ativa", "porque_escuta_ativa", "melhoria_escuta_ativa",
                        "nota_jornada_cliente", "porque_jornada_cliente", "melhoria_jornada_cliente",
                        "nota_encantamento", "porque_encantamento", "melhoria_encantamento",
                        "nota_objecoes", "porque_objecoes", "melhoria_objecoes",
                        "nota_rapport", "porque_rapport", "melhoria_rapport",
                        "nota_autoridade", "porque_autoridade", "melhoria_autoridade",
                        "nota_postura", "porque_postura", "melhoria_postura",
                        "nota_gestao_tempo", "porque_gestao_tempo", "melhoria_gestao_tempo",
                        "nota_contextualizacao", "porque_contextualizacao", "melhoria_contextualizacao",
                        "nota_clareza", "porque_clareza", "melhoria_clareza",
                        "nota_objetividade", "porque_objetividade", "melhoria_objetividade",
                        "nota_flexibilidade", "porque_flexibilidade", "melhoria_flexibilidade",
                        "nota_dominio_produto", "porque_dominio_produto", "melhoria_dominio_produto",
                        "nota_dominio_negocio", "porque_dominio_negocio", "melhoria_dominio_negocio",
                        "nota_ecossistema_nibo", "porque_ecossistema_nibo", "melhoria_ecossistema_nibo",
                        "nota_universo_contabil", "porque_universo_contabil", "melhoria_universo_contabil",
                        "tempo_fala_cs", "tempo_fala_cliente", "checklist_cs", "pontos_fortes", "pontos_atencao", "justificativa_detalhada"
                    ]
                }
            }
        });

        let analysisData;
        try {
            analysisData = JSON.parse(response.text);
        } catch (parseError) {
            console.error("Erro ao fazer parse do JSON (Texto cortado?):", response.text);
            return res.status(500).json({ error: "A IA gerou um texto muito longo e foi cortada. Tente com uma transcrição um pouco menor." });
        }
        
        return res.status(200).json(analysisData);

    } catch (error) {
        console.error("Erro na API:", error);
        return res.status(500).json({ error: "Erro do Google Gemini: " + error.message });
    }
}
