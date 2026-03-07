// api/reassign.js
// PATCH → corrige o vendedor de uma análise já salva
// Apenas coordenadores (@nibo.com.br) podem fazer isso

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
    if (req.method !== 'PATCH') return res.status(405).json({ error: 'Método não permitido' });

    // ── Verificar sessão ─────────────────────────────────────────────────────
    const cookie = req.headers.cookie || '';
    const match  = cookie.match(/nibo_session=([^;]+)/);
    if (!match) return res.status(401).json({ error: 'Não autorizado' });
    try {
        const s = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
        if (!s.exp || Date.now() > s.exp) return res.status(401).json({ error: 'Sessão expirada' });
        if (s.email.toLowerCase().split('@')[1] !== 'nibo.com.br') return res.status(403).json({ error: 'Acesso negado' });
    } catch { return res.status(401).json({ error: 'Sessão inválida' }); }

    const { reuniao_id, vendedor_nome } = req.body;

    if (!reuniao_id || !vendedor_nome?.trim()) {
        return res.status(400).json({ error: 'reuniao_id e vendedor_nome são obrigatórios' });
    }

    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/reunioes?id=eq.${reuniao_id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ vendedor_nome: vendedor_nome.trim() })
        });

        if (!r.ok) {
            const err = await r.text();
            return res.status(500).json({ error: 'Erro ao reatribuir: ' + err });
        }

        const updated = await r.json();
        return res.status(200).json({ ok: true, updated: updated[0] });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
