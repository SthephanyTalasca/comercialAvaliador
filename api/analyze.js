export default async function handler(req, res) {
    // Configuração de Headers CORS para permitir chamadas do Frontend
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Resposta rápida para o pre-flight do navegador
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Verificação da Chave de API nas variáveis de ambiente
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'Chave de API (GEMINI_API_KEY) não configurada no servidor.' });
    }

    try {
        const { prompt: userPrompt } = req.body;

        // Validação de segurança para garantir que o texto foi enviado
        if (!userPrompt) {
            return res.status(400).json({ error: "O campo 'prompt' está vazio ou não foi enviado corretamente." });
        }

        // Limpeza básica da transcrição
        const transcriptText = userPrompt.includes("TRANSCRIÇÃO:") 
            ? userPrompt.split("TRANSCRIÇÃO:")[1] 
            : userPrompt;

        // Definição do Schema de Resposta Dinâmico e Detalhado
        const responseSchema = {
            type: "object",
            properties: {
                nota_postura: { type: "number", description: "Nota de 0 a 10 para Postura e Empatia" },
                nota_conhecimento: { type: "number", description: "Nota de 0 a 10 para Conhecimento Contábil/Nibo" },
                nota_escuta: { type: "number", description: "Nota de 0 a 10 para Escuta Ativa" },
                nota_expansao: { type: "number", description: "Nota de 0 a 10 para Radar de Expansão" },
                nota_fechamento: { type: "number", description: "Nota de 0 a 10 para Técnica de Fechamento" },
                soma_total: { type: "number" },
                media_final: { type: "number" },
                tempo_fala_consultor: { type: "string", description: "Estimativa em % do tempo de fala do consultor" },
                tempo_fala_cliente: { type: "string", description: "Estimativa em % do tempo de fala do cliente" },
                alerta_cancelamento: { type: "string", description: "Análise de risco de perda do negócio ou pontos críticos (churn/lost)" },
                checklist_fechamento: {
                    type: "object",
                    properties: {
                        resolveu_pontos_iniciais: { type: "boolean", description: "Retomou os pontos X, Y, Z resolvidos?" },
                        pediu_feedback_ferramenta: { type: "boolean", description: "Perguntou 'O que você achou da solução?'" },
                        pediu_voto_confianca: { type: "boolean", description: "Usou a frase do 'voto de confiança' e menção à 'foto'?" },
                        tratou_objecao_socio: { type: "boolean", description: "Identificou e agendou com o sócio se necessário?" },
                        validou_mensalidade_vs_setup: { type: "boolean", description: "Perguntou o que pesou mais (mensalidade ou setup)?" },
                        mencionou_gestao_financeira_gratuita: { type: "boolean", description: "Ofereceu o Nibo Gestão Financeira como bônus (Cereja do bolo)?" }
                    }
                },
                comparativo_concorrencia: {
                    type: "object",
                    properties: {
                        visual_poluido_vs_moderno: { type: "boolean", description: "Contrastou o visual 'Matrix' da concorrência com o design moderno do Nibo?" },
                        facilidade_uso_vs_cliques: { type: "boolean", description: "Mencionou a redução de cliques e facilidade operacional?" },
                        automacao_sem_robo_local: { type: "boolean", description: "Explicou que não precisa de robô instalado localmente?" },
                        integracao_ecac_app: { type: "boolean", description: "Destacou diferenciais do App como recalcular DAS/DARF e ECAC?" }
                    }
                },
                justificativa_detalhada: { type: "string", description: "Análise crítica completa baseada no manual de vendas, em português de Portugal." }
            },
            required: [
                "nota_postura", "nota_conhecimento", "nota_escuta", 
                "nota_expansao", "nota_fechamento", "soma_total", 
                "media_final", "tempo_fala_consultor", "tempo_fala_cliente",
                "alerta_cancelamento", "checklist_fechamento", "justificativa_detalhada"
            ]
        };

        const systemInstruction = `
            VOCÊ É UM AUDITOR DE QUALIDADE DE VENDAS DA NIBO.
            Analise a transcrição com base no MANUAL DE VENDAS e directrizes de produto.

            DIRETRIZES TÉCNICAS:
            1. **Tempo de Fala**: Estime a percentagem de fala do consultor vs cliente (volume de texto).
            2. **Argumentação Comparativa**: Verifique se o consultor destacou:
               - O visual poluído/antigo da concorrência (ex: Acessórias) vs Interface intuitiva do Nibo.
               - A vantagem de ter automação em nuvem sem necessidade de instalar robôs locais.
               - Diferenciais exclusivos do App Nibo: Integração direta com ECAC, recálculo de guias e emissão de notas.
            3. **Script de Fechamento (Obrigatório)**:
               - Validar se retomou as dores do cliente (pontos X, Y, Z).
               - Perguntar o feedback sobre a solução antes de falar de valores.
               - O uso da técnica do "Voto de Confiança".
               - Na negociação, perguntar o que pesou (Mensalidade vs Setup) para isolar objecções.
               - Oferecer a Gestão Financeira Gratuita como fechamento especial.
            4. **Alerta de Perda**: Sinalize se o consultor foi muito agressivo, se o cliente não validou valor ou se faltou alinhar com o sócio.

            REGRAS DE OURO:
            - Erro de sistema/técnico = Nota 10 em Conhecimento.
            - Sem oportunidade de expansão na conversa = Nota 10 em Expansão.
        `;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ 
                    parts: [{ text: `INSTRUÇÃO: ${systemInstruction}\n\nTRANSCRIÇÃO:\n${transcriptText}` }] 
                }],
                generationConfig: {
                    response_mime_type: "application/json",
                    response_schema: responseSchema,
                    temperature: 0.1 
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Erro Google API:", data.error);
            return res.status(response.status || 500).json({ 
                error: data.error.message || "Erro na comunicação com a IA." 
            });
        }

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const aiResponse = JSON.parse(data.candidates[0].content.parts[0].text);
            return res.status(200).json(aiResponse);
        } else {
            throw new Error("Resposta da IA formatada incorretamente.");
        }

    } catch (error) {
        console.error("Erro no Handler:", error);
        res.status(500).json({ error: "Erro interno no servidor ao processar a análise." });
    }
}
