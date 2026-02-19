export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { transcript, ccName, analysisType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY; // A chave fica segura aqui
  const modelId = "gemini-2.0-flash-exp"; // Versão 2.0 Flash

  // Aqui você deve colar os Prompts e os Schemas que estavam no seu HTML original
  // (Omiti por brevidade, mas use as variáveis evaluationPrompt e schema baseadas no analysisType)
  
  // Exemplo de chamada para o Google vindo do Servidor:
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: evaluationPrompt }] }], // evaluationPrompt montado com o transcript
        generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: schema // Mantenha os schemas que você já tem
        }
      })
    });

    const data = await googleResponse.json();
    
    if (data.candidates && data.candidates[0].content) {
      const resultText = data.candidates[0].content.parts[0].text;
      return res.status(200).json(JSON.parse(resultText));
    } else {
      throw new Error("Resposta inválida do Gemini");
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
