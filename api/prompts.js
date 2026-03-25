
// GET   → lista todos os prompts (chave + valor + updated_at)
// PATCH → atualiza o valor de um prompt pelo chave
// Acesso restrito a @nibo.com.br

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

    // ── GET — lista todos ─────────────────────────────────────────────────
    if (req.method === 'GET') {
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/prompts?select=id,chave,valor,updated_at&order=chave.asc`,
            { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        if (!r.ok) return res.status(500).json({ error: await r.text() });
        return res.status(200).json(await r.json());
    }

    // ── PATCH — atualiza valor ────────────────────────────────────────────
    if (req.method === 'PATCH') {
        const { chave, valor } = req.body;
        if (!chave || valor === undefined || valor === null)
            return res.status(400).json({ error: 'chave e valor são obrigatórios' });
        if (!valor.trim())
            return res.status(400).json({ error: 'valor não pode estar vazio' });

        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/prompts?chave=eq.${encodeURIComponent(chave)}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type':  'application/json',
                    apikey:           SUPABASE_KEY,
                    Authorization:   `Bearer ${SUPABASE_KEY}`,
                    Prefer:          'return=representation'
                },
                body: JSON.stringify({ valor: valor.trim(), updated_at: new Date().toISOString() })
            }
        );

        if (!r.ok) return res.status(500).json({ error: await r.text() });

        const updated = await r.json();
        if (!updated.length)
            return res.status(404).json({ error: `Prompt '${chave}' não encontrado` });

        return res.status(200).json({ ok: true, prompt: updated[0] });
    }

    return res.status(405).json({ error: 'Método não permitido' });
}
