import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // =============================
  // 1️⃣ CORS
  // =============================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido." });

  // =============================
  // 2️⃣ Validação API KEY
  // =============================
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY não configurada na Vercel."
    });
  }

  const { prompt: userPrompt } = req.body;

  if (!userPrompt || userPrompt.trim().length === 0) {
    return res.status(400).json({
      error: "Transcrição vazia."
    });
  }

  // Proteção contra timeout
  if (userPrompt.length > 20000) {
    return res.status(400).json({
      error: "Transcrição muito longa. Reduza o tamanho."
    });
  }

  // =============================
  // 3️⃣ Inicializa Gemini 2.5 Flash
  // =============================
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4
    }
  });

  // =============================
  // 4️⃣ System Instruction
  // =============================
  const systemInstruction = `
Você é um auditor especialista em Inside Sales B2B para o ecossistema contábil (Nibo). 
Sua missão é analisar se o consultor executou a estratégia de "Tomada de Conta" contra o concorrente Acessórias.

DIRETRIZES TÉCNICAS (Nibo):
- Diferenciais: Nuvem total (sem robô local/E-Contínuo), cobrança automatizada integrada, App com e-CAC.
- Portfólio: Identificar fit para Gestão Financeira (GF), COF, WhatsApp e Emissor.

PERFIS DO CLIENTE:
- Analítico (dados/segurança)
- Pragmático (ROI/direto)
- Afável (relacional)
- Expressivo (propósito/futuro)

Retorne OBRIGATORIAMENTE um JSON válido no seguinte formato:

{
  "perfil_comportamental_cliente": {
    "tipo_identificado": "Analítico | Pragmático | Afável | Expressivo",
    "leitura_do_consultor": "string",
    "adaptacao_do_discurso": "string",
    "ajuste_futuro": "string"
  },
  "substituicao_acessorias": {
    "diagnostico_estrategico": "string",
    "ataque_vulnerabilidades": "string",
    "nota_tecnica": 0
  },
  "negociacao_fechamento": {
    "manejo_de_objecoes": "string",
    "uso_de_gatilhos": "string",
    "nota_final": 0
  },
  "pre_fechamento": {
    "validacao_das_dores": "string",
    "coleta_de_feedback": "string",
    "execucao_voto_confianca": true
  },
  "resumo_executivo": {
    "pontos_fortes": "string",
    "oportunidades_perdidas": "string",
    "sugestao_pratica": "string"
  }
}

Retorne APENAS o JSON.
`;

  try {
    // =============================
    // 5️⃣ Chamada para Gemini
    // =============================
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analise a seguinte transcrição:\n\n${userPrompt}`
            }
          ]
        }
      ],
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }]
      }
    });

    const response = await result.response;
    let text = response.text().trim();

    // Remove possível markdown ```json
    if (text.startsWith("```")) {
      text = text.replace(/```json|```/g, "").trim();
    }

    const data = JSON.parse(text);

    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro na API Gemini:", error);

    return res.status(500).json({
      error: "Falha na análise técnica.",
      details: error.message
    });
  }
}import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // 1. Configuração de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    // 2. Inicialização do Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Usamos o gemini-1.5-flash por ser mais rápido e estável para o limite de tempo da Vercel
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { 
            responseMimeType: "application/json"
        }
    });

    const { prompt: userPrompt } = req.body;
    if (!userPrompt) return res.status(400).json({ error: "Transcrição vazia." });

    // 3. Definição das Instruções do Sistema (Consolidado)
    const systemInstruction = `
Você é um auditor especialista em Inside Sales B2B para o ecossistema contábil (Nibo). 
Sua missão é analisar se o consultor executou a estratégia de "Tomada de Conta" contra o concorrente Acessórias.

DIRETRIZES TÉCNICAS (Nibo):
- Diferenciais: Nuvem total (sem robô local/E-Contínuo), cobrança automatizada integrada, App com e-CAC.
- Portfólio: Identificar fit para Gestão Financeira (GF), COF, WhatsApp e Emissor.

PERFIS DO CLIENTE:
- Analítico (dados/segurança), Pragmático (ROI/direto), Afável (relacional), Expressivo (propósito/futuro).

Retorne OBRIGATORIAMENTE um JSON neste formato:
{
  "perfil_comportamental_cliente": {
    "tipo_identificado": "Analítico | Pragmático | Afável | Expressivo",
    "leitura_do_consultor": "string",
    "adaptacao_do_discurso": "string",
    "ajuste_futuro": "string"
  },
  "substituicao_acessorias": {
    "diagnostico_estrategico": "string",
    "ataque_vulnerabilidades": "string",
    "nota_tecnica": 0
  },
  "negociacao_fechamento": {
    "manejo_de_objecoes": "string",
    "uso_de_gatilhos": "string",
    "nota_final": 0
  },
  "pre_fechamento": {
    "validacao_das_dores": "string",
    "coleta_de_feedback": "string",
    "execucao_voto_confianca": true
  },
  "resumo_executivo": {
    "pontos_fortes": "string",
    "oportunidades_perdidas": "string",
    "sugestao_pratica": "string"
  }
}`;

    // 4. Execução da análise
    try {
        const fullPrompt = `Analise esta transcrição de reunião:\n${userPrompt}`;
        
        const result = await model.generateContent([systemInstruction, fullPrompt]);
        const response = await result.response;
        const text = response.text();
        
        // Tenta parsear o JSON retornado
        const data = JSON.parse(text);
        return res.status(200).json(data);

    } catch (error) {
        console.error("Erro na API Gemini:", error);
        return res.status(500).json({ 
            error: "Falha na análise técnica.", 
            details: error.message 
        });
    }
}
