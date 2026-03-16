// api/save.js
// Salva análise de reunião no Supabase
// POST body: { coordenador, analise }

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
    // ── Apenas POST ───────────────────────────────────────────────────────
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    // ── Verificar sessão ──────────────────────────────────────────────────
    const session = getSession(req);
    if (!session) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    // ── Validar body ──────────────────────────────────────────────────────
    const { coordenador, analise } = req.body;

    if (!coordenador || !analise) {
        return res.status(400).json({ error: 'Coordenador e análise são obrigatórios' });
    }

    // ── Detectar mal qualificado pelo veredicto ───────────────────────────
    const verd = (analise.qual_veredicto || '').toUpperCase();
    const malQualificado = verd.includes('MAL') || verd.includes('FORA');

    // ── Montar registro para o Supabase ───────────────────────────────────
    const registro = {
        // Identificação
        coordenador,
        vendedor_nome:        analise.vendedor_nome || 'Não identificado',
        produto:              analise.qual_produto_identificado || null,

        // Notas de vendas
        media_final:          analise.media_final || 0,
        nota_rapport:         analise.nota_rapport || null,
        nota_produto:         analise.nota_produto || null,
        nota_apresentacao:    analise.nota_apresentacao || null,
        nota_pre_fechamento:  analise.nota_pre_fechamento || null,
        nota_fechamento:      analise.nota_fechamento || null,

        // Qualificação SDR
        qual_veredicto:       analise.qual_veredicto || null,
        qual_nota_sdr:        analise.qual_nota_sdr || null,
        chance_fechamento:    analise.chance_fechamento || null,

        // Flag derivada
        mal_qualificado:      malQualificado,

        // JSON completo para histórico e detalhes
        analise_json:         analise
    };

    // ── Inserir no Supabase ───────────────────────────────────────────────
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

        console.log('Análise salva:', { id, vendedor: registro.vendedor_nome, media: registro.media_final });

        return res.status(201).json({ ok: true, id });

    } catch (error) {
        console.error('Save error:', error);
        return res.status(500).json({ error: error.message });
    }
}
