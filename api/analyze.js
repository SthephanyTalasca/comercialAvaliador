import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // Só aceita requisições POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const { transcript, ccName, analysisType } = req.body;
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // Usando o modelo Gemini 2.0 Flash
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `Você é um avaliador comercial sênior. Analise a performance de ${ccName}. 
        Tipo de análise: ${analysisType}. 
        Transcrição: ${transcript}. 
        Retorne um JSON estruturado com nota, pontos fortes e pontos de melhoria.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        return res.status(200).json(JSON.parse(response.text()));

    } catch (error) {
        console.error("Erro na API:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
}
