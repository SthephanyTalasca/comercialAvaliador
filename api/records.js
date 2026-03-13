// api/records.js
// GET  ?id=uuid                                   → registro único
// GET  ?coordenador=...&vendedor=...&periodo=...  → lista paginada
// DELETE body: { id }                             → exclui por id (modo legado)
// DELETE body: { modo: 'nao_identificados' }      → exclui todos não identificados
// DELETE body: { modo: 'nao_id' }                 → alias acima (compat)
// DELETE body: { modo: 'vendedor', nome: '...' }  → exclui registros de um vendedor
// DELETE body: { modo: 'single', id: 'uuid' }     → exclui registro único

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
    if (!getSession(req)) return res.status(401).json({ error: 'Não autorizado' });

    // ── GET ────────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
        const {
            id,
            coordenador, vendedor, search,
            periodo, data_inicio, data_fim,
            limit = '50', offset = '0'
        } = req.query;

        try {
            // Single record by ID
            if (id) {
                const r = await fetch(
                    `${SUPABASE_URL}/rest/v1/reunioes?id=eq.${id}&select=*`,
                    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
                );
                const rows = await r.json();
                if (!rows.length) return res.status(404).json({ error: 'Registro não encontrado' });
                return res.status(200).json({ record: rows[0] });
            }

            // List with filters
            let filters = '';

            if (coordenador && coordenador !== 'todos')
                filters += `&coordenador=eq.${encodeURIComponent(coordenador)}`;

            if (vendedor && vendedor !== 'todos')
                filters += `&vendedor_nome=eq.${encodeURIComponent(vendedor)}`;

            if (search?.trim())
                filters += `&vendedor_nome=ilike.*${encodeURIComponent(search.trim())}*`;

            // Período
            if (data_inicio) filters += `&created_at=gte.${data_inicio}`;
            if (data_fim)    filters += `&created_at=lte.${data_fim}T23:59:59`;
            if (periodo && periodo !== 'todos' && !data_inicio) {
                const dias = parseInt(periodo, 10);
                if (!isNaN(dias)) {
                    const desde = new Date(Date.now() - dias * 86400000).toISOString();
                    filters += `&created_at=gte.${desde}`;
                }
            }

            const lim = Math.min(parseInt(limit, 10) || 50, 200);
            const off = parseInt(offset, 10) || 0;

            const url = `${SUPABASE_URL}/rest/v1/reunioes?select=*${filters}&order=created_at.desc&limit=${lim}&offset=${off}`;

            const r = await fetch(url, {
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
            });

            if (!r.ok) return res.status(500).json({ error: await r.text() });
            const records = await r.json();
            return res.status(200).json({ records });

        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ── DELETE ─────────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
        const body = req.body || {};
        const { modo, id, nome } = body;

        try {
            let url;

            // modo: 'nao_identificados' ou 'nao_id' (alias)
            if (modo === 'nao_identificados' || modo === 'nao_id') {
                url = `${SUPABASE_URL}/rest/v1/reunioes?vendedor_nome=ilike.*identificado*`;

            // modo: 'vendedor'
            } else if (modo === 'vendedor' && nome?.trim()) {
                url = `${SUPABASE_URL}/rest/v1/reunioes?vendedor_nome=eq.${encodeURIComponent(nome.trim())}`;

            // modo: 'single' OU id direto (compat com frontend novo e legado)
            } else if (id) {
                url = `${SUPABASE_URL}/rest/v1/reunioes?id=eq.${id}`;

            } else {
                return res.status(400).json({ error: 'Parâmetros inválidos.' });
            }

            const r = await fetch(url, {
                method: 'DELETE',
                headers: {
                    apikey:          SUPABASE_KEY,
                    Authorization:  `Bearer ${SUPABASE_KEY}`,
                    Prefer:         'return=representation',
                    'Content-Type': 'application/json'
                }
            });

            if (!r.ok) return res.status(500).json({ error: await r.text() });
            const deleted = await r.json();
            return res.status(200).json({ ok: true, count: Array.isArray(deleted) ? deleted.length : 0 });

        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Método não permitido' });
}
