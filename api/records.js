// api/records.js
// DELETE body: { modo: 'nao_id' }               → exclui todos "Não identificado"
// DELETE body: { modo: 'vendedor', nome: '...' } → exclui registros de um vendedor
// DELETE body: { modo: 'single', id: 'uuid' }   → exclui registro único

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
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido' });

    const { modo, id, nome } = req.body || {};

    try {
        let url;

        if (modo === 'nao_id') {
            url = `${SUPABASE_URL}/rest/v1/reunioes?vendedor_nome=ilike.*identificado*`;
        } else if (modo === 'vendedor' && nome?.trim()) {
            const encoded = encodeURIComponent(nome.trim());
            url = `${SUPABASE_URL}/rest/v1/reunioes?vendedor_nome=eq.${encoded}`;
        } else if (modo === 'single' && id) {
            url = `${SUPABASE_URL}/rest/v1/reunioes?id=eq.${id}`;
        } else {
            return res.status(400).json({ error: 'Parâmetros inválidos.' });
        }

        const r = await fetch(url, {
            method: 'DELETE',
            headers: {
                'apikey':         SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer':        'return=representation',
                'Content-Type':  'application/json'
            }
        });

        if (!r.ok) {
            const err = await r.text();
            console.error('Supabase DELETE error:', err);
            return res.status(500).json({ error: 'Erro no banco: ' + err });
        }

        const deleted = await r.json();
        return res.status(200).json({ ok: true, count: Array.isArray(deleted) ? deleted.length : 0 });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
