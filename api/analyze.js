export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Atenção: Mudei o nome da variável de ambiente para a chave da OpenAI
    const API_KEY = process.env.OPENAI_API_KEY; 
    if (!API_KEY) return res.status(500).json({ error: 'Chave de API ausente.' });

    try {
        const { prompt: userPrompt } = req.body;
        // Limpa a transcrição removendo o prefixo se existir
        const transcriptText = userPrompt.includes("TRANSCRIÇÃO:") ? userPrompt.split("TRANSCRIÇÃO:")[1] : userPrompt;

        // DEFINIÇÃO DO SCHEMA (Adaptado para o formato "Structured Outputs" da OpenAI)
        const responseSchema = {
            name: "avaliacao_cs",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    nota_postura: { type: "number", description: "Nota de 0 a 10 para Postura e Empatia" },
                    nota_conhecimento: { type: "number", description: "Nota de 0 a 10 para Conhecimento Contábil" },
                    nota_escuta: { type: "number", description: "Nota de 0 a 10 para Escuta Ativa" },
                    nota_expansao: { type: "number", description: "Nota de 0 a 10 para Radar de Expansão" },
                    nota_fechamento: { type: "number", description: "Nota de 0 a 10 para Fechamento" },
                    soma_total: { type: "number", description: "Soma das 5 notas acima" },
                    media_final: { type: "number", description: "Soma total dividida por 5" },
                    justificativa_detalhada: { type: "string", description: "Explicação detalhada para cada nota aplicada" }
                },
                required: ["nota_postura", "nota_conhecimento", "nota_escuta", "nota_expansao", "nota_fechamento", "soma_total", "media_final", "justificativa_detalhada"],
                additionalProperties: false // Obrigatório na OpenAI quando 'strict' é true
            }
        };

        const enhancedPrompt = `
        VOCÊ É UM AUDITOR MATEMÁTICO DE QUALIDADE. 
        Sua missão é analisar a transcrição e atribuir notas de 0 a 10 para cada critério.

        ### REGRA DE OURO:
        - Problemas técnicos (Bugs, lentidão, erro de sistema) = Nota 10 no critério técnico (Conhecimento Contábil), pois a falha não é do CS.
        - Se não houver oportunidade de expansão (venda/gatilho) = Nota 10 automático no Radar de Expansão.

        ### MÉTODO DE CÁLCULO OBRIGATÓRIO:
        1. Atribua as 5 notas individuais.
        2. Realize a SOMA de todas as notas.
        3. Realize a MÉDIA (Soma / 5).
        
        TRANSCRIÇÃO:
        ${transcriptText}
        `;

        // URL da API da OpenAI
        const url = 'https://api.openai.com/v1/chat/completions';

        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}` // Padrão de autenticação OpenAI
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // Modelo equivalente de baixo custo e alta velocidade
                temperature: 0.1,
                messages: [
                    { role: "user", content: enhancedPrompt }
                ],
                response_format: {
                    type: "json_schema",
                    json_schema: responseSchema
                }
            })
        });

        const data = await response.json();

        // Tratamento de erro retornado pela API da OpenAI
        if (data.error) {
            return res.status(response.status).json({ error: data.error.message });
        }

        // A OpenAI retorna o JSON como uma string dentro de choices[0].message.content
        // Precisamos fazer o parse para devolver um objeto JSON limpo para o seu frontend
        const resultadoFormatado = JSON.parse(data.choices[0].message.content);

        res.status(200).json(resultadoFormatado);

    } catch (error) {
        console.error("Erro no Handler:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
}
