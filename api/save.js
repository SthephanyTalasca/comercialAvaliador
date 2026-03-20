// api/save.js
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

    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado' });

    const { coordenador, analise } = req.body;

    // analise é obrigatório — coordenador é opcional
    if (!analise) {
        return res.status(400).json({ error: 'analise é obrigatório' });
    }

    // Detecta mal qualificado
    const veredicto = (analise.qual_veredicto || '').toUpperCase();
    const mal_qualificado =
        analise._mal_qualificado === true ||
        veredicto.includes('MAL') ||
        veredicto.includes('FORA');

    // coordenador: usa o que veio, ou string vazia
    const coordenadorFinal = (coordenador || '').trim();

    const registro = {
        coordenador:         coordenadorFinal,
        vendedor_nome:       analise.vendedor_nome             || 'Não identificado',
        produto:             analise.qual_produto_identificado || null,
        media_final:         analise.media_final               || 0,
        // Etapas mapeadas para colunas existentes
        nota_rapport:        analise.nota_etapa1               || null,
        nota_produto:        analise.nota_etapa2               || null,
        nota_apresentacao:   analise.nota_etapa3               || null,
        nota_pre_fechamento: null,
        nota_fechamento:     null,
        qual_veredicto:      analise.qual_veredicto            || null,
        qual_nota_sdr:       analise.qual_nota_sdr             || null,
        mal_qualificado,
        analise_json:        analise
    };

    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/reunioes`, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':         SUPABASE_KEY,
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
