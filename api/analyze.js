export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'Chave de API não configurada.' });

    const fetchWithRetry = async (url, options, retries = 5) => {
        const delays = [1000, 2000, 4000, 8000, 16000];
        for (let i = 0; i < retries; i++) {
            const response = await fetch(url, options);
            if (response.status !== 429 && response.status !== 503) return response;
            if (i < retries - 1) await new Promise(res => setTimeout(res, delays[i]));
        }
        return fetch(url, options);
    };

    try {
        const { prompt: userPrompt } = req.body;
        if (!userPrompt) return res.status(400).json({ error: "Transcrição vazia." });

        // --- BASE DE CONHECIMENTO NIBO OBRIGAÇÕES (FONTE: AJUDA.NIBO.COM.BR) ---
        const NIBO_KNOWLEDGE_BASE = `
        1. NIBO OBRIGAÇÕES - FUNCIONALIDADES CHAVE:
           - TELA DE CONFERÊNCIA: Coração do sistema. Valida automaticamente guias (DARF, GPS, DAS, etc.), identificando cliente, competência e valor. Permite "Drag and Drop" para processamento em massa.
           - RECÁLCULO AUTOMÁTICO: O cliente pode atualizar guias vencidas com 1 clique. Suporta Simples Nacional (DAS), DAS MEI, DARF Sicalc e DCTFWeb. O sistema valida se o valor recalculado bate com o original antes de liberar.
           - CALENDÁRIO DINÂMICO: Diferencia "Vencimento Legal" de "Meta Interna" (prazo de segurança do escritório). Permite filtros por responsável ou departamento.
           - ARMAZENAMENTO E SEGURANÇA: Usa nuvem Microsoft Azure. Armazenamento ilimitado. Possui "Arquivo Permanente" para documentos como Contratos Sociais que não expiram.
           - RELATÓRIOS GERENCIAIS: Mapa de Pendências (visualização por cores), Relatório de Produtividade, Relatório Completo de Protocolos e Auditoria de processos.

        2. AUTOMAÇÃO E INTEGRAÇÃO:
           - NIBO ASSISTENTE: Substitui robôs locais. Mapeia pastas do computador diretamente para a nuvem. Detecta automaticamente obrigações geradas pelo sistema contábil.
           - INTEGRAÇÃO DOMÍNIO: Botão exclusivo "Publicar na pasta" dentro da Domínio que envia o documento direto para a conferência do Nibo.
           - NIBO IMPRESSORA: Driver virtual que permite enviar qualquer PDF de qualquer site/sistema para o Nibo via CTRL+P.

        3. CONCORRENTES (ARGUMENTOS DE COMBATE):
           - ACESSÓRIAS: Nibo não precisa de robô local (Nuvem pura). Visual moderno vs. Visual "Matrix". Nibo aceita qualquer arquivo; Acessórias foca em PDF/TXT.
           - GCLICK / GESTTA / VERI: O diferencial do Nibo é o ECOSSISTEMA integrado (Financeiro + Obrigações + App + WhatsApp). Nibo permite áudio no atendimento; os outros geralmente não.

        4. SCRIPT DE FECHAMENTO (OBRIGATÓRIO):
           - Voto de Confiança: Deve usar a frase sobre o orçamento e a "foto de referência na cidade".
           - Objeção Financeira: Isolar entre "Mensalidade" e "Setup". Oferecer Gestão Financeira Gratuita como bônus final ("Cereja do bolo").
        `;

        const responseSchema = {
            type: "object",
            properties: {
                resumo_executivo: { type: "string" },
                concorrentes_detectados: { type: "array", items: { type: "string" } },
                nota_postura: { type: "number" },
                porque_postura: { type: "string" },
                nota_conhecimento: { type: "number" },
                porque_conhecimento: { type: "string", description: "Avalie se o consultor usou os detalhes técnicos da base de conhecimento (Recálculo DCTFWeb, Nibo Assistente, etc)." },
                nota_escuta: { type: "number" },
                porque_escuta: { type: "string" },
                nota_expansao: { type: "number" },
                porque_expansao: { type: "string" },
                nota_fechamento: { type: "number" },
                porque_fechamento: { type: "string" },
                media_final: { type: "number" },
                chance_fechamento: { type: "string" },
                tempo_fala_consultor: { type: "string" },
                tempo_fala_cliente: { type: "string" },
                alerta_cancelamento: { type: "string" },
                pontos_fortes: { type: "array", items: { type: "string" } },
                pontos_atencao: { type: "array", items: { type: "string" } },
                checklist_fechamento: {
                    type: "object",
                    properties: {
                        resolveu_pontos_iniciais: { type: "boolean" },
                        pediu_feedback_ferramenta: { type: "boolean" },
                        pediu_voto_confianca: { type: "boolean" },
                        tratou_objecao_socio: { type: "boolean" },
                        validou_mensalidade_vs_setup: { type: "boolean" },
                        mencionou_gestao_financeira_gratuita: { type: "boolean" }
                    }
                },
                justificativa_detalhada: { type: "string" }
            },
            required: ["resumo_executivo", "concorrentes_detectados", "nota_postura", "porque_postura", "nota_conhecimento", "porque_conhecimento", "nota_escuta", "porque_escuta", "nota_expansao", "porque_expansao", "nota_fechamento", "porque_fechamento", "media_final", "chance_fechamento", "tempo_fala_consultor", "tempo_fala_cliente", "alerta_cancelamento", "pontos_fortes", "pontos_atencao", "checklist_fechamento", "justificativa_detalhada"]
        };

        const systemInstruction = `
            VOCÊ É O AUDITOR CHEFE DA NIBO.
            Sua missão é garantir que o consultor use TODO o potencial técnico do Nibo Obrigações.

            BASE TÉCNICA ATUALIZADA:
            ${NIBO_KNOWLEDGE_BASE}

            DIRETRIZES:
            1. Se o cliente falar de 'Multas', verifique se o consultor falou do 'Recálculo Automático (Sicalc/DCTFWeb)' e da 'Meta Interna' no calendário.
            2. Se o cliente usar 'Domínio', o consultor DEVE mencionar o botão de publicar direto.
            3. Analise se o consultor combateu a 'Acessórias' citando a ausência de robô local e o visual moderno.
            4. Desconte pontos se o consultor for vago. Ele deve ser um especialista técnico.
            
            IDIOMA: Português Brasil.
        `;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/2.5-flash-lite:generateContent?key=${API_KEY}`;

        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `TRANSCRIÇÃO:\n${userPrompt}` }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { response_mime_type: "application/json", response_schema: responseSchema, temperature: 0.1 }
            })
        });

        const data = await response.json();
        res.status(200).json(JSON.parse(data.candidates[0].content.parts[0].text));

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
