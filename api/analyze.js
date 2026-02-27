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

        // Definição do Schema de Resposta para garantir JSON estruturado
        const responseSchema = {
            type: "object",
            properties: {
                nota_postura: { type: "number", description: "Nota de 0 a 10 para Postura e Empatia" },
                nota_conhecimento: { type: "number", description: "Nota de 0 a 10 para Conhecimento Contábil" },
                nota_escuta: { type: "number", description: "Nota de 0 a 10 para Escuta Ativa" },
                nota_expansao: { type: "number", description: "Nota de 0 a 10 para Radar de Expansão" },
                nota_fechamento: { type: "number", description: "Nota de 0 a 10 para Fechamento" },
                soma_total: { type: "number", description: "Soma das 5 notas individuais" },
                media_final: { type: "number", description: "Média final (Soma / 5)" },
                justificativa_detalhada: { type: "string", description: "Explicação em português de cada nota aplicada" }
            },
            required: [
                "nota_postura", "nota_conhecimento", "nota_escuta", 
                "nota_expansao", "nota_fechamento", "soma_total", 
                "media_final", "justificativa_detalhada"
            ]
        };

        const systemInstruction = `
            VOCÊ É UM AUDITOR MATEMÁTICO DE QUALIDADE ESPECIALIZADO EM VENDAS.
            Sua missão é analisar a transcrição da reunião e atribuir notas de 0 a 10.

            REGRAS CRÍTICAS:
            1. Problemas técnicos do sistema = Nota 10 em Conhecimento Contábil (a falha não é do consultor).
            2. Sem oportunidade de expansão detectada = Nota 10 automático em Radar de Expansão.
            3. O cálculo da média deve ser rigoroso (Soma das 5 notas / 5).
            4. Responda estritamente em Português no campo de justificativa.
        `;

        // URL da API do Gemini atualizada para gemini-2.5-flash-lite
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

        // Tratamento de erros vindos da API do Google
        if (data.error) {
            console.error("Erro Google API:", data.error);
            return res.status(response.status || 500).json({ 
                error: data.error.message || "Erro na comunicação com a IA." 
            });
        }

        // Extração do conteúdo JSON gerado
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
