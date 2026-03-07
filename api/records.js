// api/records.js
// DELETE ?id=uuid        → exclui registro específico
// DELETE ?modo=nao_id    → exclui todos "Não identificado"

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

    const { id, modo } = req.query;

    try {
        let url;

        if (modo === 'nao_id') {
            // Delete all unidentified
            url = `${SUPABASE_URL}/rest/v1/reunioes?vendedor_nome=eq.Não identificado`;
        } else if (id) {
            // Delete single record
            url = `${SUPABASE_URL}/rest/v1/reunioes?id=eq.${id}`;
        } else {
            return res.status(400).json({ error: 'Informe id ou modo=nao_id' });
        }

        const r = await fetch(url, {
            method: 'DELETE',
            headers: {
                'apikey':         SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer':        'return=representation'
            }
        });

        if (!r.ok) {
            const err = await r.text();
            return res.status(500).json({ error: err });
        }

        const deleted = await r.json();
        return res.status(200).json({ ok: true, count: deleted.length });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
