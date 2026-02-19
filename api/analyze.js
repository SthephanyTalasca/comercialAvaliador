export default async function handler(req, res) {
  // 1. Segurança: Só aceita requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { transcript, ccName, analysisType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY; // A chave nunca aparece no navegador
  const modelId = "gemini-2.0-flash"; // Versão atualizada

  // Aqui você define os prompts baseados no tipo de análise escolhido
  let prompt = "";
  let schema = {};

  if (analysisType === 'rapport-analysis') {
    prompt = `Analise o rapport da reunião para o consultor ${ccName}: ${transcript}`;
    schema = {
      type: "object",
      properties: {
        nota: { type: "number" },
        sintese: { type: "string" },
        pontosFortes: { type: "array", items: { type: "string" } },
        pontosMelhoria: { type: "array", items: { type: "string" } }
      },
      required: ["nota", "sintese", "pontosFortes", "pontosMelhoria"]
    };
  } else {
    // Adicione os outros prompts (Pitch e Full) seguindo a mesma lógica
    // Use os schemas JSON que você já tinha no código original
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: "application/json",
          responseSchema: schema 
        }
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0].content) {
      const resultText = data.candidates[0].content.parts[0].text;
      return res.status(200).json(JSON.parse(resultText));
    } else {
      throw new Error("Falha na resposta da IA");
    }
  } catch (error) {
    return res.status(500).json({ error: "Erro ao processar análise: " + error.message });
  }
}
