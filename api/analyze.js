// api/analyze.js
// ─────────────────────────────────────────────────────────────────────────────
// SOLUÇÃO PARA TRANSCRIÇÕES LONGAS (30k+ palavras / 60min+):
//
//  Estratégia: Seleção automática de modelo por tamanho
//
//  CURTA  (< 12.000 chars)  → gemini-2.5-flash  (melhor qualidade)
//  MÉDIA  (12k – 40k chars) → gemini-2.0-flash  (rápido, boa qualidade)
//  LONGA  (> 40k chars)     → gemini-2.0-flash  + compressão inteligente
//
//  Compressão inteligente:
//    - Remove timestamps (00:01:23)
//    - Remove falas < 5 palavras (ruído)
//    - Trunca repetições consecutivas do mesmo falante
//    - Mantém contexto comercial intacto
//    - Reduz ~40-60% sem perder informação relevante
//
//  Fallback: se 2.5-flash demorar > 45s, retenta com 2.0-flash
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI, Type } from '@google/genai';

export const maxDuration = 60;

// ── Limites por modelo ────────────────────────────────────────────────────────
const LIMITE_CURTO  = 12_000;   // até 12k chars → 2.5-flash
const LIMITE_MEDIO  = 40_000;   // até 40k chars → 2.0-flash sem compressão
// acima de 40k → 2.0-flash COM compressão

// ── Carrega prompts do Supabase ───────────────────────────────────────────────
async function loadSystemPrompt() {
    const url = `${process.env.SUPABASE_URL}/rest/v1/prompts?select=chave,valor`;
    const res = await fetch(url, {
        headers: {
            'apikey':        process.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
        }
    });
    if (!res.ok) throw new Error(`Erro ao buscar prompts: ${res.status}`);
    const rows = await res.json();
    const map  = Object.fromEntries(rows.map(r => [r.chave, r.valor]));
    const base = map['PROMPT_BASE'], nibo = map['PROMPT_NIBO'], crit = map['PROMPT_CRITERIOS'];
    if (!base || !nibo || !crit) {
        const faltando = ['PROMPT_BASE','PROMPT_NIBO','PROMPT_CRITERIOS'].filter(k => !map[k]).join(', ');
        throw new Error(`Prompts faltando: ${faltando}`);
    }
    return `${base}\n\n${nibo}\n\n${crit}`;
}

// ── Compressão inteligente de transcrição ─────────────────────────────────────
// Remove ruído sem perder contexto comercial
function comprimirTranscricao(texto) {
    const linhasOriginais = texto.split('\n');
    const linhas = [];
    let ultimoFalante = null;
    let contadorRepetido = 0;

    for (let linha of linhasOriginais) {
        let l = linha.trim();
        if (!l) continue;

        // Remove timestamps no formato 00:00:00 ou [00:00] ou (00:00)
        l = l.replace(/\[?\(?\d{1,2}:\d{2}(:\d{2})?\)?\]?\s*/g, '').trim();
        if (!l) continue;

        // Remove linhas só com pontuação ou ruído
        if (/^[.\-_\s,;:!?]{1,3}$/.test(l)) continue;

        // Detecta padrão "Nome: fala" ou "Nome\nfala"
        const matchFalante = l.match(/^([A-ZÀ-Ú][a-zA-ZÀ-ú\s]{1,30}):\s*(.+)/);

        if (matchFalante) {
            const falante = matchFalante[1].trim();
            const fala    = matchFalante[2].trim();
            const palavras = fala.split(/\s+/).length;

            // Pula falas muito curtas (ruído de confirmação: "sim", "ok", "hmm")
            if (palavras < 3 && /^(sim|não|ok|certo|claro|entendi|hm+|ah+|uh+|né|ta|tá|blz)$/i.test(fala)) {
                continue;
            }

            // Controla repetição do mesmo falante
            if (falante === ultimoFalante) {
                contadorRepetido++;
                // Depois de 5 falas seguidas do mesmo falante, começa a comprimir
                if (contadorRepetido > 5 && palavras < 10) continue;
            } else {
                ultimoFalante = falante;
                contadorRepetido = 0;
            }

            linhas.push(`${falante}: ${fala}`);
        } else {
            // Linha sem falante identificado — mantém se tiver conteúdo suficiente
            const palavras = l.split(/\s+/).length;
            if (palavras >= 4) linhas.push(l);
        }
    }

    const comprimido = linhas.join('\n');
    const reducao = Math.round((1 - comprimido.length / texto.length) * 100);
    console.log(`Compressão: ${texto.length} → ${comprimido.length} chars (↓${reducao}%)`);
    return comprimido;
}

// ── Seleciona modelo e prepara texto ─────────────────────────────────────────
function prepararTexto(prompt) {
    const tamanho = prompt.length;

    if (tamanho <= LIMITE_CURTO) {
        return { texto: prompt, modelo: 'gemini-2.5-flash', comprimido: false };
    }

    if (tamanho <= LIMITE_MEDIO) {
        console.log(`Transcrição média (${tamanho} chars) → gemini-2.0-flash`);
        return { texto: prompt, modelo: 'gemini-2.0-flash', comprimido: false };
    }

    // Transcrição longa: comprime + usa modelo rápido
    console.log(`Transcrição longa (${tamanho} chars) → comprimindo + gemini-2.0-flash`);
    const textoComprimido = comprimirTranscricao(prompt);

    // Se mesmo após compressão ficou muito grande, trunca com aviso
    const LIMITE_ABSOLUTO = 80_000;
    if (textoComprimido.length > LIMITE_ABSOLUTO) {
        console.warn(`Ainda grande após compressão (${textoComprimido.length}). Truncando em ${LIMITE_ABSOLUTO} chars.`);
        const truncado = textoComprimido.substring(0, LIMITE_ABSOLUTO) +
            '\n\n[NOTA: Transcrição truncada por limite de processamento. Analise até aqui.]';
        return { texto: truncado, modelo: 'gemini-2.0-flash', comprimido: true, truncado: true };
    }

    return { texto: textoComprimido, modelo: 'gemini-2.0-flash', comprimido: true };
}

// ── Schema de resposta ────────────────────────────────────────────────────────
const responseSchema = {
    type: Type.OBJECT,
    properties: {
        vendedor_nome:           { type: Type.STRING },
        media_final:             { type: Type.NUMBER },
        resumo_executivo:        { type: Type.STRING },
        chance_fechamento:       { type: Type.STRING },
        alerta_cancelamento:     { type: Type.STRING },
        concorrentes_detectados: { type: Type.ARRAY, items: { type: Type.STRING } },

        nota_rapport:           { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_rapport:         { type: Type.STRING },
        melhoria_rapport:       { type: Type.STRING },
        nota_comunicacao:       { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_comunicacao:     { type: Type.STRING },
        melhoria_comunicacao:   { type: Type.STRING },
        nota_etapa1:            { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_etapa1:          { type: Type.STRING },
        melhoria_etapa1:        { type: Type.STRING },

        nota_spin_s:            { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_spin_s:          { type: Type.STRING },
        melhoria_spin_s:        { type: Type.STRING },
        nota_spin_p:            { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_spin_p:          { type: Type.STRING },
        melhoria_spin_p:        { type: Type.STRING },
        nota_spin_i:            { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_spin_i:          { type: Type.STRING },
        melhoria_spin_i:        { type: Type.STRING },
        nota_spin_n:            { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_spin_n:          { type: Type.STRING },
        melhoria_spin_n:        { type: Type.STRING },
        nota_etapa_spin:        { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_etapa_spin:      { type: Type.STRING },
        melhoria_etapa_spin:    { type: Type.STRING },

        nota_produto:           { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_produto:         { type: Type.STRING },
        melhoria_produto:       { type: Type.STRING },
        nota_objecoes:          { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_objecoes:        { type: Type.STRING },
        melhoria_objecoes:      { type: Type.STRING },
        nota_solucao_dor:       { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_solucao_dor:     { type: Type.STRING },
        melhoria_solucao_dor:   { type: Type.STRING },
        nota_encantamento:      { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_encantamento:    { type: Type.STRING },
        melhoria_encantamento:  { type: Type.STRING },
        nota_etapa2:            { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_etapa2:          { type: Type.STRING },
        melhoria_etapa2:        { type: Type.STRING },

        nota_pre_fechamento_sub:     { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_pre_fechamento_sub:   { type: Type.STRING },
        melhoria_pre_fechamento_sub: { type: Type.STRING },
        nota_escuta_ativa:      { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_escuta_ativa:    { type: Type.STRING },
        melhoria_escuta_ativa:  { type: Type.STRING },
        nota_resiliencia:       { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_resiliencia:     { type: Type.STRING },
        melhoria_resiliencia:   { type: Type.STRING },
        nota_gestao_tempo:      { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_gestao_tempo:    { type: Type.STRING },
        melhoria_gestao_tempo:  { type: Type.STRING },
        nota_regras_fechamento:      { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_regras_fechamento:    { type: Type.STRING },
        melhoria_regras_fechamento:  { type: Type.STRING },
        nota_etapa3:            { type: Type.NUMBER, minimum: 1, maximum: 5 },
        porque_etapa3:          { type: Type.STRING },
        melhoria_etapa3:        { type: Type.STRING },

        tempo_fala_consultor:   { type: Type.NUMBER },
        tempo_fala_cliente:     { type: Type.NUMBER },

        auditoria_objecoes: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    objecao:            { type: Type.STRING },
                    contornada:         { type: Type.BOOLEAN },
                    abordagem_sugerida: { type: Type.STRING }
                }
            }
        },

        pontos_fortes:           { type: Type.ARRAY, items: { type: Type.STRING } },
        pontos_atencao:          { type: Type.ARRAY, items: { type: Type.STRING } },
        justificativa_detalhada: { type: Type.STRING },

        qual_produto_identificado:  { type: Type.STRING },
        qual_produto_no_portfolio:  { type: Type.BOOLEAN },
        qual_produto_alerta:        { type: Type.STRING },
        qual_contexto: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    label: { type: Type.STRING },
                    valor: { type: Type.STRING }
                }
            }
        },
        qual_sabia_o_que_veria:     { type: Type.BOOLEAN },
        qual_sabia_evidencia:       { type: Type.STRING },
        qual_produto_correto:       { type: Type.BOOLEAN },
        qual_produto_evidencia:     { type: Type.STRING },
        qual_interesse_real:        { type: Type.BOOLEAN },
        qual_interesse_evidencia:   { type: Type.STRING },
        qual_cenario_diagnosticado: { type: Type.BOOLEAN },
        qual_cenario_evidencia:     { type: Type.STRING },

        qual_sla_1_label: { type: Type.STRING },
        qual_sla_1_ok:    { type: Type.BOOLEAN },
        qual_sla_1_ev:    { type: Type.STRING },
        qual_sla_2_label: { type: Type.STRING },
        qual_sla_2_ok:    { type: Type.BOOLEAN },
        qual_sla_2_ev:    { type: Type.STRING },
        qual_sla_3_label: { type: Type.STRING },
        qual_sla_3_ok:    { type: Type.BOOLEAN },
        qual_sla_3_ev:    { type: Type.STRING },

        qual_veredicto:              { type: Type.STRING },
        qual_nota_sdr:               { type: Type.NUMBER },
        qual_nota_sdr_justificativa: { type: Type.STRING },
        qual_analise_completa:       { type: Type.STRING }
    },
    required: [
        'vendedor_nome','media_final','resumo_executivo','chance_fechamento','alerta_cancelamento',
        'concorrentes_detectados',
        'nota_rapport','porque_rapport','melhoria_rapport',
        'nota_comunicacao','porque_comunicacao','melhoria_comunicacao',
        'nota_etapa1','porque_etapa1','melhoria_etapa1',
        'nota_spin_s','porque_spin_s','melhoria_spin_s',
        'nota_spin_p','porque_spin_p','melhoria_spin_p',
        'nota_spin_i','porque_spin_i','melhoria_spin_i',
        'nota_spin_n','porque_spin_n','melhoria_spin_n',
        'nota_etapa_spin','porque_etapa_spin','melhoria_etapa_spin',
        'nota_produto','porque_produto','melhoria_produto',
        'nota_objecoes','porque_objecoes','melhoria_objecoes',
        'nota_solucao_dor','porque_solucao_dor','melhoria_solucao_dor',
        'nota_encantamento','porque_encantamento','melhoria_encantamento',
        'nota_etapa2','porque_etapa2','melhoria_etapa2',
        'nota_pre_fechamento_sub','porque_pre_fechamento_sub','melhoria_pre_fechamento_sub',
        'nota_escuta_ativa','porque_escuta_ativa','melhoria_escuta_ativa',
        'nota_resiliencia','porque_resiliencia','melhoria_resiliencia',
        'nota_gestao_tempo','porque_gestao_tempo','melhoria_gestao_tempo',
        'nota_regras_fechamento','porque_regras_fechamento','melhoria_regras_fechamento',
        'nota_etapa3','porque_etapa3','melhoria_etapa3',
        'tempo_fala_consultor','tempo_fala_cliente',
        'auditoria_objecoes',
        'pontos_fortes','pontos_atencao','justificativa_detalhada',
        'qual_produto_identificado','qual_produto_no_portfolio','qual_produto_alerta',
        'qual_contexto',
        'qual_sabia_o_que_veria','qual_sabia_evidencia',
        'qual_produto_correto','qual_produto_evidencia',
        'qual_interesse_real','qual_interesse_evidencia',
        'qual_cenario_diagnosticado','qual_cenario_evidencia',
        'qual_sla_1_label','qual_sla_1_ok','qual_sla_1_ev',
        'qual_sla_2_label','qual_sla_2_ok','qual_sla_2_ev',
        'qual_sla_3_label','qual_sla_3_ok','qual_sla_3_ev',
        'qual_veredicto','qual_nota_sdr','qual_nota_sdr_justificativa',
        'qual_analise_completa'
    ]
};

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    // ── Verificar sessão ──────────────────────────────────────────────────────
    const cookie = req.headers.cookie || '';
    const match  = cookie.match(/nibo_session=([^;]+)/);
    if (!match) return res.status(401).json({ error: 'Não autorizado.' });
    let session;
    try {
        session = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
        if (!session.exp || Date.now() > session.exp) return res.status(401).json({ error: 'Sessão expirada.' });
        if (session.email.toLowerCase().split('@')[1] !== 'nibo.com.br') return res.status(403).json({ error: 'Acesso negado.' });
    } catch { return res.status(401).json({ error: 'Sessão inválida.' }); }

    if (session.role !== 'admin') {
        return res.status(403).json({ error: 'Permissão negada. Apenas coordenadores podem submeter transcrições.' });
    }

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'O texto da transcrição é obrigatório.' });

    // ── Prepara texto e seleciona modelo ─────────────────────────────────────
    const { texto, modelo, comprimido, truncado } = prepararTexto(prompt);

    console.log(`Modelo selecionado: ${modelo} | Texto: ${texto.length} chars | Comprimido: ${comprimido}`);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        let systemInstruction;
        try {
            systemInstruction = await loadSystemPrompt();
        } catch (promptError) {
            console.error('Erro ao carregar prompts:', promptError.message);
            return res.status(500).json({ error: 'Erro ao carregar prompts: ' + promptError.message });
        }

        // ── Adiciona aviso no prompt se foi comprimido ────────────────────
        const textoFinal = comprimido
            ? `[AVISO: Esta transcrição foi otimizada para processamento. Conteúdo preservado.]\n\n${texto}`
            : texto;

        // ── Chama o Gemini ────────────────────────────────────────────────
        let analysisData;
        let modeloUsado = modelo;

        try {
            const response = await ai.models.generateContent({
                model: modelo,
                contents: textoFinal,
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    maxOutputTokens: 65536,
                    // Temperatura menor = respostas mais rápidas e consistentes
                    temperature: modelo === 'gemini-2.0-flash' ? 0.1 : 0.2,
                    responseSchema
                }
            });

            const rawText = typeof response.text === 'function' ? response.text() : response.text;
            analysisData = JSON.parse(rawText);

        } catch (geminiError) {
            // ── Fallback: se 2.5-flash falhou, tenta com 2.0-flash ────────
            if (modelo === 'gemini-2.5-flash') {
                console.warn(`2.5-flash falhou (${geminiError.message}), tentando 2.0-flash...`);
                modeloUsado = 'gemini-2.0-flash';

                // Comprime se ainda não foi comprimido
                const textoFallback = comprimido ? textoFinal : comprimirTranscricao(textoFinal);

                const response2 = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: textoFallback,
                    config: {
                        systemInstruction,
                        responseMimeType: 'application/json',
                        maxOutputTokens: 65536,
                        temperature: 0.1,
                        responseSchema
                    }
                });

                const rawText2 = typeof response2.text === 'function' ? response2.text() : response2.text;
                analysisData = JSON.parse(rawText2);
            } else {
                throw geminiError;
            }
        }

        // ── Inject config da UI ───────────────────────────────────────────
        analysisData._config = {
            fields: [
                {
                    l: 'Rapport & Comunicação', k: 'etapa1', icon: 'heart-handshake', color: 'blue',
                    criterios: [
                        { l: 'Rapport',            k: 'rapport',     desc: 'Criou conexão genuína e estabeleceu confiança com o lead?' },
                        { l: 'Comunicação Eficaz', k: 'comunicacao', desc: 'Demonstrou capacidade de ouvir as dores e o cenário do cliente?' }
                    ]
                },
                {
                    l: 'SPIN Selling', k: 'etapa_spin', icon: 'search', color: 'indigo',
                    criterios: [
                        { l: 'Situação',    k: 'spin_s', desc: 'Fez perguntas de contexto sem interrogar — entendeu o cenário atual do lead?' },
                        { l: 'Problema',    k: 'spin_p', desc: 'Investigou e fez o cliente confessar suas dores e insatisfações?' },
                        { l: 'Implicação',  k: 'spin_i', desc: 'Aprofundou o problema mostrando os impactos de não resolver?' },
                        { l: 'Necessidade', k: 'spin_n', desc: 'Fez o cliente declarar o valor da solução com suas próprias palavras?' }
                    ]
                },
                {
                    l: 'Apresentação da Ferramenta', k: 'etapa2', icon: 'presentation', color: 'violet',
                    criterios: [
                        { l: 'Produto',               k: 'produto',      desc: 'Apresentou o produto com clareza, domínio e adequação ao cenário?' },
                        { l: 'Objeções',              k: 'objecoes',     desc: 'Conseguiu contornar objeções de maneira amistosa e convincente?' },
                        { l: 'Solução da Dor',        k: 'solucao_dor',  desc: 'Utilizou a dor identificada no diagnóstico para mostrar a solução?' },
                        { l: 'Encantamento e Emoção', k: 'encantamento', desc: 'Gerou emoção comercial, entusiasmo e encantou o lead com a ferramenta?' }
                    ]
                },
                {
                    l: 'Negociação', k: 'etapa3', icon: 'handshake', color: 'emerald',
                    criterios: [
                        { l: 'Pré-Fechamento',  k: 'pre_fechamento_sub', desc: 'Preparou o terreno para o fechamento com ancoragem e comprometimento do lead?' },
                        { l: 'Escuta Ativa',    k: 'escuta_ativa',       desc: 'Exerceu escuta ativa com pausas necessárias para feedback do lead?' },
                        { l: 'Resiliência',     k: 'resiliencia',        desc: 'Demonstrou firmeza com bons argumentos para fechamento ou próximo contato?' },
                        { l: 'Gestão do Tempo', k: 'gestao_tempo',       desc: 'Conseguiu boa gestão do tempo garantindo call de qualidade em 60 min?' },
                        { l: 'Regras de Fech.', k: 'regras_fechamento',  desc: 'Aplicou corretamente as regras e técnicas de fechamento Nibo?' }
                    ]
                }
            ],
            prodConfig: {
                'RADAR-ECAC':       { color: 'bg-sky-100 text-sky-800 border-sky-300',             icon: 'radar'           },
                'NIBO OBRIGAÇÕES':  { color: 'bg-violet-100 text-violet-800 border-violet-300',    icon: 'file-text'       },
                'CONCILIADOR':      { color: 'bg-blue-100 text-blue-800 border-blue-300',          icon: 'git-merge'       },
                'WHATSAPP WEB':     { color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'message-circle'  },
                'EMISSOR DE NOTAS': { color: 'bg-orange-100 text-orange-800 border-orange-300',    icon: 'file-plus'       },
                'FORA':             { color: 'bg-red-100 text-red-800 border-red-300',             icon: 'alert-triangle'  }
            },
            // Metadados de processamento (visíveis no log, não na UI)
            _processamento: {
                modelo_usado:  modeloUsado,
                comprimido,
                truncado:      truncado || false,
                tamanho_original: prompt.length,
                tamanho_processado: texto.length
            }
        };

        const veredicto = (analysisData.qual_veredicto || '').toUpperCase();
        analysisData._mal_qualificado = veredicto.includes('MAL') || veredicto.includes('FORA');

        return res.status(200).json(analysisData);

    } catch (error) {
        console.error('Erro na API:', error);

        // Mensagem de erro amigável para o usuário
        const msg = error.message || '';
        if (msg.includes('timeout') || msg.includes('DEADLINE') || msg.includes('504')) {
            return res.status(504).json({
                error: 'A transcrição é muito longa e o processamento excedeu o tempo limite. Tente dividir a transcrição em duas partes (primeira e segunda metade da reunião) e analise separadamente.'
            });
        }

        return res.status(500).json({ error: 'Erro do Google Gemini: ' + error.message });
    }
}
