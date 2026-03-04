import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // ==========================================
    // 1. CORS E VALIDAÇÕES INICIAIS
    // ==========================================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'Chave de API não configurada.' });

    const { prompt: userPrompt } = req.body || {};
    if (!userPrompt) return res.status(400).json({ error: "Transcrição inválida ou vazia." });

    // ==========================================
    // 2. INSTRUÇÕES DO SISTEMA E SCHEMA
    // ==========================================
    const systemInstruction = `
Você é um auditor especialista em Inside Sales B2B para o ecossistema contábil (Nibo). 
Sua função é analisar transcrições de reuniões de vendas e preencher um relatório técnico rigoroso.

DIRETRIZES DE AVALIAÇÃO DE RAPPORT:
- Conexão Emocional: O consultor usou o nome do cliente e estabeleceu empatia inicial?
- Leveza e Genuinidade: A quebra de gelo foi personalizada ou mecânica? 
- Sinais de Excelência: Linguagem acessível, escuta genuína e acolhimento.
- Alerta de Falha: Abordagem excessivamente robótica ou falta de sintonia com o momento do cliente.

DIRETRIZES DE PRODUTO (Nibo):
- Use a base de conhecimento (ajuda.nibo.com.br) para validar o item "Domínio de Produto". 
- O foco é a estratégia de substituição do concorrente 'Acessórias'. 
- Diferenciais Nibo: Sem robô local (nuvem), cobrança automatizada integrada, App com e-CAC e dashboards.

PERFIS COMPORTAMENTAIS (CLIENTE):
- Analítico: Foco em dados, segurança, processos.
- Pragmático: Foco em ROI, velocidade, objetividade.
- Afável: Foco em relacionamento, confiança, harmonia.
- Expressivo: Foco em visão de futuro, entusiasmo, status.

Sua análise deve ser fria, técnica e baseada estritamente em evidências da transcrição.
Retorne os dados EXATAMENTE no formato JSON solicitado.`;

    // ==========================================
    // 3. EXECUÇÃO DA API GEMINI
    // ==========================================
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash", // Modelo rápido e estável para a Vercel
            generationConfig: { 
                responseMimeType: "application/json",
                // Passando o schema diretamente na configuração para garantir a estrutura
                responseSchema: {
                    type: "object",
                    properties: {
                        perfil_comportamental_cliente: {
                            type: "object",
                            properties: {
                                tipo_identificado: { type: "string", enum: ["Analítico", "Pragmático", "Afável", "Expressivo"] },
                                leitura_do_consultor: { type: "string" },
                                adaptacao_do_discurso: { type: "string" },
                                ajuste_futuro: { type: "string" }
                            },
                            required: ["tipo_identificado", "leitura_do_consultor", "adaptacao_do_discurso"]
                        },
                        avaliacao_detalhada: {
                            type: "object",
                            properties: {
                                rapport_conexao: { 
                                    type: "object",
                                    properties: {
                                        status: { type: "string", enum: ["Excelente", "Bom", "Regular", "Insuficiente"] },
                                        evidencia_positiva: { type: "string", description: "Trecho ou sinal de conexão emocional e empatia." },
                                        oportunidade_melhoria: { type: "string", description: "Identificação de travas emocionais ou abordagem mecânica." },
                                        uso_do_nome: { type: "boolean" }
                                    },
                                    required: ["status", "evidencia_positiva"]
                                },
                                autoridade_comercial: { type: "string" },
                                clareza_apresentacao: { type: "string" },
                                gatilhos_mentais: { type: "string" },
                                pre_fechamento: { type: "string" },
                                tecnicas_fechamento: { type: "string" },
                                contorno_objecoes: { type: "string" },
                                escuta_ativa: { type: "string" },
                                perguntas_poderosas: { type: "string" },
                                personalizacao_pitch: { type: "string" },
                                conexao_negocio: { type: "string" },
                                jornada_cliente: { type: "string" },
                                gestao_tempo: { type: "string" },
                                encantamento_comercial: { type: "string" },
                                postura_profissional: { type: "string" },
                                dominio_produto_nibo: { type: "string" },
                                portfolio_estrategico: { type: "string" }
                            }
                        },
                        estrategia_tomada_de_conta: {
                            type: "object",
                            properties: {
                                ataque_acessorias: { type: "string" },
                                vulnerabilidade_cobranca: { type: "string" },
                                nota_tecnica_substituicao: { type: "number" }
                            }
                        },
                        resumo_executivo: {
                            type: "object",
                            properties: {
                                pontos_fortes: { type: "string" },
                                oportunidades_melhoria: { type: "string" },
                                sugestao_pratica_proxima_call: { type: "string" }
                            }
                        }
                    },
                    required: ["perfil_comportamental_cliente", "avaliacao_detalhada", "estrategia_tomada_de_conta", "resumo_executivo"]
                }
            }
        });

        const fullPrompt = `ANALISE A SEGUINTE TRANSCRIÇÃO:\n${userPrompt}\n\nConsidere os 17 critérios de avaliação comercial e identifique o perfil comportamental do cliente. Foque especialmente na transição técnica de Acessórias para Nibo e na capacidade do vendedor de realizar o cross-sell (Portfólio Estratégico).`;

        const result = await model.generateContent([
            { text: systemInstruction }, 
            { text: fullPrompt }
        ]);
        
        const responseText = await result.response.text();
        const data = JSON.parse(responseText);
        
        return res.status(200).json(data);

    } catch (error) {
        console.error("Erro na execução do Gemini:", error);
        return res.status(500).json({ error: "Falha ao analisar transcrição.", details: error.message });
    }
}
