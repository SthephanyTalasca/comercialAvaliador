// api/vendors.js
// GET    → lista todos os vendedores ativos
// POST   → cadastra novo vendedor
// PATCH  → reativa vendedor demitido
// DELETE → desativa vendedor (soft delete — mantém histórico de análises)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

function getSession(req) {
    const cookie = req.headers.cookie || '';
    const match  = cookie.match(/nibo_session=([^;]+)/);
    if (!match) return null;
    try {
        const s = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
        if (s.exp && Date.now() > s.exp) return null;
        const domain = s.email.toLowerCase().split('@')[1];
        if (domain !== 'nibo.com.br') return null;
        return s;
    } catch { return null; }
}

export default async function handler(req, res) {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado' });

    // ── GET: listar vendedores ────────────────────────────────────────────────
    if (req.method === 'GET') {
        const { incluir_inativos } = req.query;
        const filter = incluir_inativos === '1' ? '' : '&ativo=eq.true';
        const url = `${SUPABASE_URL}/rest/v1/vendedores?select=*&order=coordenador.asc,nome.asc${filter}`;
        const r = await fetch(url, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await r.json();
        return res.status(200).json(data);
    }

    // ── POST: cadastrar novo vendedor ─────────────────────────────────────────
    if (req.method === 'POST') {
        const { nome, coordenador } = req.body;
        if (!nome?.trim() || !coordenador) {
            return res.status(400).json({ error: 'Nome e coordenador são obrigatórios' });
        }
        if (!['Simone Rangel', 'Jonathan Dornelas'].includes(coordenador)) {
            return res.status(400).json({ error: 'Coordenador inválido' });
        }
        // Verificar se já existe (pode estar inativo)
        const checkUrl = `${SUPABASE_URL}/rest/v1/vendedores?nome=ilike.${encodeURIComponent(nome.trim())}&select=id,ativo`;
        const checkR = await fetch(checkUrl, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const existing = await checkR.json();
        if (existing.length > 0) {
            const v = existing[0];
            if (v.ativo) return res.status(409).json({ error: 'Vendedor já cadastrado' });
            // Reativar
            const reactivate = await fetch(`${SUPABASE_URL}/rest/v1/vendedores?id=eq.${v.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ ativo: true, coordenador })
            });
            const reactivated = await reactivate.json();
            return res.status(200).json({ ok: true, reativado: true, vendedor: reactivated[0] });
        }
        // Criar novo
        const createR = await fetch(`${SUPABASE_URL}/rest/v1/vendedores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ nome: nome.trim(), coordenador, ativo: true })
        });
        if (!createR.ok) {
            const err = await createR.text();
            return res.status(500).json({ error: err });
        }
        const created = await createR.json();
        return res.status(201).json({ ok: true, vendedor: created[0] });
    }

    // ── DELETE: desativar vendedor (soft delete) ───────────────────────────────
    if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID do vendedor é obrigatório' });
        const r = await fetch(`${SUPABASE_URL}/rest/v1/vendedores?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ ativo: false })
        });
        if (!r.ok) return res.status(500).json({ error: await r.text() });
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
}
