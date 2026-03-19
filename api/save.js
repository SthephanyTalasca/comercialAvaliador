// api/save.js
// POST → salva análise no Supabase
// Body: { coordenador, analise }

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
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    if (!getSession(req)) return res.status(401).json({ error: 'Não autorizado' });

    const { coordenador, analise } = req.body;

    if (!coordenador || !analise) {
        return res.status(400).json({ error: 'coordenador e analise são obrigatórios' });
    }

    // ── Detecta mal qualificado ─────────────────────────────────────────────
    const veredicto = (analise.qual_veredicto || '').toUpperCase();
    const mal_qualificado = analise._mal_qualificado === true
        || veredicto.includes('MAL')
        || veredicto.includes('FORA');

    // ── Monta o registro ────────────────────────────────────────────────────
    // Etapas salvas nas colunas existentes:
    //   nota_rapport     → nota_etapa1
    //   nota_produto     → nota_etapa2
    //   nota_apresentacao → nota_etapa3
    // nota_pre_fechamento e nota_fechamento ficam null (novo formato)
    const registro = {
        coordenador,
        vendedor_nome:      analise.vendedor_nome     || 'Não identificado',
        produto:            analise.qual_produto_identificado || null,
        media_final:        analise.media_final        || 0,

        // Etapas (novo formato — 3 etapas)
        nota_rapport:       analise.nota_etapa1        || null,
        nota_produto:       analise.nota_etapa2        || null,
        nota_apresentacao:  analise.nota_etapa3        || null,
        nota_pre_fechamento: null,
        nota_fechamento:    null,

        // SDR
        qual_veredicto:     analise.qual_veredicto     || null,
        qual_nota_sdr:      analise.qual_nota_sdr      || null,

        // Flag mal qualificado
        mal_qualificado,

        // JSON completo da análise (para consulta posterior)
        analise_json: analise
    };

    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/reunioes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey':        SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer':        'return=representation'
            },
            body: JSON.stringify(registro)
        });

        if (!r.ok) {
            const err = await r.text();
            console.error('Supabase save error:', err);
            return res.status(500).json({ error: 'Erro ao salvar: ' + err });
        }

        const saved = await r.json();
        return res.status(200).json({ ok: true, id: saved[0]?.id });

    } catch (err) {
        console.error('Save handler error:', err);
        return res.status(500).json({ error: err.message });
    }
}
