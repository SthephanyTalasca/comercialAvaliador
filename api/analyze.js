export default async function handler(req, res) {
    // CORS e Validações Iniciais (Mantidos conforme seu original)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    const API_KEY = process.env.GEMINI_API_KEY;
    const { prompt: userPrompt } = req.body || {};
    if (!userPrompt) return res.status(400).json({ error: "Transcrição inválida." });

    // ==========================================
    // 1. SYSTEM INSTRUCTION: O CÉREBRO DA IA
    // ==========================================
    const systemInstruction = `
Você é um auditor especialista em Inside Sales B2B para o ecossistema contábil (Nibo). 
Sua função é analisar transcrições de reuniões de vendas e preencher um relatório técnico rigoroso.

DIRETRIZES DE PRODUTO (Nibo):
- Use a base de conhecimento (ajuda.nibo.com.br) para validar o item "Domínio de Produto". 
- O foco é a estratégia de substituição do concorrente 'Acessórias'. 
- Diferenciais Nibo: Sem robô local (nuvem), cobrança automatizada integrada, App com e-CAC e dashboards.

PERFIS COMPORTAMENTAIS (CLIENTE):
- Analítico: Foco em dados, segurança, processos.
- Pragmático: Foco em ROI, velocidade, objetividade.
- Afável: Foco em relacionamento, confiança, harmonia.
- Expressivo: Foco em visão de futuro, entusiasmo, status.

Sua análise deve ser fria, técnica e baseada em evidências da transcrição.
`;

    // ==========================================
    // 2. RESPONSE SCHEMA: A ESTRUTURA DECISIVA
    // ==========================================
    const responseSchema = {
        type: "OBJECT",
        properties: {
            perfil_comportamental_cliente: {
                type: "OBJECT",
                properties: {
                    tipo_identificado: { type: "STRING", enum: ["Analítico", "Pragmático", "Afável", "Expressivo"] },
                    leitura_do_consultor: { type: "STRING" }, // O consultor leu os sinais corretamente?
                    adaptacao_do_discurso: { type: "STRING" }, // Ajustou ritmo e profundidade?
                    ajuste_futuro: { type: "STRING" } // Como personalizar melhor para esse perfil?
                },
                required: ["tipo_identificado", "leitura_do_consultor", "adaptacao_do_discurso"]
            },
            avaliacao_detalhada: {
                type: "OBJECT",
                properties: {
                    rapport_conexao: { type: "STRING" },
                    autoridade_comercial: { type: "STRING" },
                    clareza_apresentacao: { type: "STRING" },
                    gatilhos_mentais: { type: "STRING" },
                    pre_fechamento: { type: "STRING" },
                    tecnicas_fechamento: { type: "STRING" },
                    contorno_objecoes: { type: "STRING" },
                    escuta_ativa: { type: "STRING" },
                    perguntas_poderosas: { type: "STRING" },
                    personalizacao_pitch: { type: "STRING" },
                    conexao_negocio: { type: "STRING" },
                    jornada_cliente: { type: "STRING" },
                    gestao_tempo: { type: "STRING" },
                    encantamento_comercial: { type: "STRING" },
                    postura_profissional: { type: "STRING" },
                    dominio_produto_nibo: { type: "STRING" }, // Validar via ajuda.nibo.com.br
                    portfolio_estrategico: { type: "STRING" } // Cross-sell: GF, COF, Emissor
                }
            },
            estrategia_tomada_de_conta: {
                type: "OBJECT",
                properties: {
                    ataque_acessorias: { type: "STRING" }, // Comparação E-contínuo vs Nibo Assistente
                    vulnerabilidade_cobranca: { type: "STRING" },
                    nota_tecnica_substituicao: { type: "NUMBER" }
                }
            },
            resumo_executivo: {
                type: "OBJECT",
                properties: {
                    pontos_fortes: { type: "STRING" },
                    oportunidades_melhoria: { type: "STRING" },
                    sugestao_pratica_proxima_call: { type: "STRING" }
                }
            }
        },
        required: ["perfil_comportamental_cliente", "avaliacao_detalhada", "estrategia_tomada_de_conta", "resumo_executivo"]
    };

    const fullPrompt = `
ANALISE A SEGUINTE TRANSCRIÇÃO:
${userPrompt}

Considere os 17 critérios de avaliação comercial e identifique o perfil comportamental do cliente para preencher o JSON conforme o schema.
Foque especialmente na transição técnica de Acessórias para Nibo e na capacidade do vendedor de realizar o cross-sell (Portfólio Estratégico).
`;

    // Chamada para a API Gemini (Utilizando o modelo 2.0 ou 1.5 conforme disponibilidade)
    // ... restante do código de fetch e retorno ...
}
