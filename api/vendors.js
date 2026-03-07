// api/vendors.js
// GET    → lista vendedores
// POST   → cadastra/reativa
// PATCH  → edita nome e/ou coordenador
// DELETE → soft-delete (excluir)

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

    // GET
    if (req.method === 'GET') {
        const { incluir_inativos } = req.query;
        const filter = incluir_inativos === '1' ? '' : '&ativo=eq.true';
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/vendedores?select=*&order=coordenador.asc,nome.asc${filter}`,
            { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        return res.status(200).json(await r.json());
    }

    // POST — criar ou reativar
    if (req.method === 'POST') {
        const { nome, coordenador } = req.body;
        if (!nome?.trim() || !coordenador)
            return res.status(400).json({ error: 'Nome e coordenador são obrigatórios' });
        if (!['Simone Rangel','Jonathan Dornelas'].includes(coordenador))
            return res.status(400).json({ error: 'Coordenador inválido' });

        const checkR = await fetch(
            `${SUPABASE_URL}/rest/v1/vendedores?nome=ilike.${encodeURIComponent(nome.trim())}&select=id,ativo`,
            { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        const existing = await checkR.json();

        if (existing.length > 0) {
            const v = existing[0];
            if (v.ativo) return res.status(409).json({ error: 'Vendedor já cadastrado' });
            const r = await fetch(`${SUPABASE_URL}/rest/v1/vendedores?id=eq.${v.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=representation' },
                body: JSON.stringify({ ativo: true, coordenador })
            });
            return res.status(200).json({ ok: true, reativado: true, vendedor: (await r.json())[0] });
        }

        const r = await fetch(`${SUPABASE_URL}/rest/v1/vendedores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=representation' },
            body: JSON.stringify({ nome: nome.trim(), coordenador, ativo: true })
        });
        if (!r.ok) return res.status(500).json({ error: await r.text() });
        return res.status(201).json({ ok: true, vendedor: (await r.json())[0] });
    }

    // PATCH — editar nome e/ou coordenador
    if (req.method === 'PATCH') {
        const { id, nome, coordenador } = req.body;
        if (!id) return res.status(400).json({ error: 'ID obrigatório' });
        const updates = {};
        if (nome?.trim())  updates.nome = nome.trim();
        if (coordenador && ['Simone Rangel','Jonathan Dornelas'].includes(coordenador))
            updates.coordenador = coordenador;
        if (!Object.keys(updates).length)
            return res.status(400).json({ error: 'Nada para atualizar' });

        const r = await fetch(`${SUPABASE_URL}/rest/v1/vendedores?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=representation' },
            body: JSON.stringify(updates)
        });
        if (!r.ok) return res.status(500).json({ error: await r.text() });
        return res.status(200).json({ ok: true, vendedor: (await r.json())[0] });
    }

    // DELETE — soft delete
    if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID obrigatório' });
        const r = await fetch(`${SUPABASE_URL}/rest/v1/vendedores?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=representation' },
            body: JSON.stringify({ ativo: false })
        });
        if (!r.ok) return res.status(500).json({ error: await r.text() });
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
}
