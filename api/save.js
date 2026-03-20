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

async function detectarCoordenador(vendedorNome, supabaseUrl, supabaseKey) {
    if (!vendedorNome || vendedorNome === 'Não identificado') return '';
    try {
        const r = await fetch(
            `${supabaseUrl}/rest/v1/vendedores?nome=ilike.${encodeURIComponent(vendedorNome)}&select=coordenador&limit=1`,
            { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        );
        const rows = await r.json();
        return rows[0]?.coordenador || '';
    } catch { return ''; }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado' });

    const { coordenador, analise } = req.body;
    if (!analise) return res.status(400).json({ error: 'analise é obrigatório' });

    // Detecta mal qualificado
    const veredicto = (analise.qual_veredicto || '').toUpperCase();
    const mal_qualificado =
        analise._mal_qualificado === true ||
        veredicto.includes('MAL') ||
        veredicto.includes('FORA');

    // Coordenador: usa o informado, ou detecta pelo vendedor, ou usa quem está logado
    let coordenadorFinal = (coordenador || '').trim();
    if (!coordenadorFinal) {
        coordenadorFinal = await detectarCoordenador(
            analise.vendedor_nome, SUPABASE_URL, SUPABASE_KEY
        );
    }
    // Se ainda vazio, registra o próprio email logado como referência
    if (!coordenadorFinal) {
        coordenadorFinal = session.name || session.email;
    }

    const registro = {
        coordenador:         coordenadorFinal,
        vendedor_nome:       analise.vendedor_nome             || 'Não identificado',
        produto:             analise.qual_produto_identificado || null,
        media_final:         analise.media_final               || 0,
        nota_rapport:        analise.nota_etapa1               || null,
        nota_produto:        analise.nota_etapa2               || null,
        nota_apresentacao:   analise.nota_etapa3               || null,
        nota_pre_fechamento: null,
        nota_fechamento:     null,
        qual_veredicto:      analise.qual_veredicto            || null,
        qual_nota_sdr:       analise.qual_nota_sdr             || null,
        mal_qualificado,
        analise_json:        analise,
        // Registra quem fez a auditoria
        auditado_por:        session.email
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
            // Se a coluna auditado_por não existir, tenta sem ela
            if (err.includes('auditado_por')) {
                delete registro.auditado_por;
                const r2 = await fetch(`${SUPABASE_URL}/rest/v1/reunioes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=representation' },
                    body: JSON.stringify(registro)
                });
                if (!r2.ok) return res.status(500).json({ error: 'Erro ao salvar: ' + await r2.text() });
                const saved2 = await r2.json();
                return res.status(200).json({ ok: true, id: saved2[0]?.id });
            }
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
