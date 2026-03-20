// api/reassign.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
// Service role key bypassa RLS — necessário para UPDATE
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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
    if (req.method !== 'PATCH') return res.status(405).json({ error: 'Método não permitido' });

    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado' });

    const { reuniao_id, vendedor_nome } = req.body;
    if (!reuniao_id || !vendedor_nome?.trim()) {
        return res.status(400).json({ error: 'reuniao_id e vendedor_nome são obrigatórios' });
    }

    try {
        // Usa service role key para bypasár RLS no UPDATE
        const r = await fetch(`${SUPABASE_URL}/rest/v1/reunioes?id=eq.${reuniao_id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type':  'application/json',
                'apikey':         SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Prefer':        'return=representation'
            },
            body: JSON.stringify({ vendedor_nome: vendedor_nome.trim() })
        });

        const text = await r.text();
        console.log('Supabase PATCH status:', r.status, '| body:', text.substring(0, 200));

        if (!r.ok) {
            return res.status(500).json({ error: 'Erro ao reatribuir: ' + text });
        }

        let updated;
        try { updated = JSON.parse(text); } catch { updated = []; }

        if (!updated.length) {
            // Retornou ok mas array vazio — RLS bloqueou silenciosamente
            return res.status(500).json({ error: 'Registro não encontrado ou sem permissão de atualização. Verifique as políticas RLS no Supabase.' });
        }

        return res.status(200).json({ ok: true, updated: updated[0] });

    } catch (err) {
        console.error('Reassign error:', err);
        return res.status(500).json({ error: err.message });
    }
}
