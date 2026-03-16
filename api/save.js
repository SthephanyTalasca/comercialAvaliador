// api/save.js
// ─────────────────────────────────────────────────────────────────────────────
// Salva análise de reunião no Supabase
// POST body: { coordenador, analise }
//
// MAPEAMENTO DE COLUNAS (novo formato 12 critérios → colunas existentes):
//   nota_etapa1 → nota_rapport (coluna existente)
//   nota_etapa2 → nota_produto (coluna existente)
//   nota_etapa3 → nota_apresentacao (coluna existente)
//   nota_pre_fechamento = null  → indica formato novo (não legado)
//   nota_fechamento = null      → indica formato novo (não legado)
//
// O analise_json contém TODOS os 12 critérios detalhados + auditoria de objeções.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

function getSession(req) {
    const cookie = req.headers.cookie || '';
    const match  = cookie.match(/nibo_session=([^;]+)/);
    if (!match) return null;
    try {
        const s = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
        if (s.exp && Date.now() > s.exp) return null;
        if (s.email.toLowerCase().split('@')[1] !== 'nibo.com.br') return null;
        return s;
    } catch { return null; }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    const session = getSession(req);
    if (!session) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    const { coordenador, analise } = req.body;

    if (!coordenador || !analise) {
        return res.status(400).json({ error: 'Coordenador e análise são obrigatórios' });
    }

    // ── Detectar mal qualificado pelo veredicto ───────────────────────────
    const verd = (analise.qual_veredicto || '').toUpperCase();
    const malQualificado = verd.includes('MAL') || verd.includes('FORA');

    // ── Detectar formato (novo 12 critérios vs legado) ────────────────────
    // Se tem nota_etapa1 definida, é novo formato
    const isNovoFormato = analise.nota_etapa1 !== undefined;

    // ── Calcular stats de objeções para persistência ──────────────────────
    const objecoesStats = {
        total:        analise.total_objecoes || 0,
        contornadas:  analise.objecoes_contornadas || 0,
        naoContornadas: analise.objecoes_nao_contornadas || 0,
        taxa:         analise.taxa_contorno_objecoes || 0
    };

    const registro = {
        coordenador,
        vendedor_nome:        analise.vendedor_nome || 'Não identificado',
        produto:              analise.qual_produto_identificado || null,
        media_final:          analise.media_final || 0,

        // ── Mapeamento para colunas existentes ────────────────────────────
        // Novo formato: usar nota_etapa* → colunas rapport/produto/apresentacao
        // Mantém nota_pre_fechamento e nota_fechamento = null para distinguir do legado
        nota_rapport:         isNovoFormato ? (analise.nota_etapa1 || null) : (analise.nota_rapport || null),
        nota_produto:         isNovoFormato ? (analise.nota_etapa2 || null) : (analise.nota_produto || null),
        nota_apresentacao:    isNovoFormato ? (analise.nota_etapa3 || null) : (analise.nota_apresentacao || null),
        nota_pre_fechamento:  isNovoFormato ? null : (analise.nota_pre_fechamento || null),
        nota_fechamento:      isNovoFormato ? null : (analise.nota_fechamento || null),

        qual_veredicto:       analise.qual_veredicto || null,
        qual_nota_sdr:        analise.qual_nota_sdr || null,
        chance_fechamento:    analise.chance_fechamento || null,
        alerta_cancelamento:  analise.alerta_cancelamento || null,

        mal_qualificado:      malQualificado,

        // ── JSON completo com todos os 12 critérios + auditoria ───────────
        analise_json:         analise
    };

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/reunioes`, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer':        'return=representation'
            },
            body: JSON.stringify(registro)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Supabase save error:', err);
            return res.status(500).json({ error: 'Erro ao salvar no banco: ' + err });
        }

        const saved = await response.json();
        const id = saved[0]?.id || null;

        console.log('Análise salva:', { 
            id, 
            vendedor: registro.vendedor_nome, 
            media: registro.media_final,
            objecoes: objecoesStats.total,
            taxaContorno: objecoesStats.taxa + '%'
        });

        return res.status(201).json({ ok: true, id });

    } catch (error) {
        console.error('Save error:', error);
        return res.status(500).json({ error: error.message });
    }
}
