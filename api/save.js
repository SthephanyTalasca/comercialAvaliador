// api/save.js
// Salva uma análise no Supabase após ser gerada

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    // ── Verificar sessão ─────────────────────────────────────────────────────
    const cookie = req.headers.cookie || '';
    const match  = cookie.match(/nibo_session=([^;]+)/);
    if (!match) return res.status(401).json({ error: 'Não autorizado' });
    try {
        const session = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
        if (!session.exp || Date.now() > session.exp) return res.status(401).json({ error: 'Sessão expirada' });
        const domain = session.email.toLowerCase().split('@')[1];
        if (domain !== 'nibo.com.br') return res.status(403).json({ error: 'Acesso negado' });
    } catch { return res.status(401).json({ error: 'Sessão inválida' }); }
    // ─────────────────────────────────────────────────────────────────────────

    const { coordenador, analise } = req.body;

    if (!coordenador || !analise) {
        return res.status(400).json({ error: 'Coordenador e análise são obrigatórios' });
    }

    if (!['Simone Rangel', 'Jonathan Dornelas'].includes(coordenador)) {
        return res.status(400).json({ error: 'Coordenador inválido' });
    }

    try {
        const row = {
            coordenador,
            vendedor_nome:       analise.vendedor_nome       || 'Não identificado',
            produto:             analise.qual_produto_identificado || null,
            media_final:         analise.media_final         || null,
            nota_rapport:        analise.nota_rapport        || null,
            nota_produto:        analise.nota_produto        || null,
            nota_apresentacao:   analise.nota_apresentacao   || null,
            nota_pre_fechamento: analise.nota_pre_fechamento || null,
            nota_fechamento:     analise.nota_fechamento     || null,
            tempo_fala_consultor: analise.tempo_fala_consultor || null,
            tempo_fala_cliente:   analise.tempo_fala_cliente   || null,
            chance_fechamento:   analise.chance_fechamento   || null,
            alerta_cancelamento: analise.alerta_cancelamento || null,
            qual_veredicto:      analise.qual_veredicto      || null,
            qual_nota_sdr:       analise.qual_nota_sdr       || null,
            analise_json:        analise
        };

        const response = await fetch(`${SUPABASE_URL}/rest/v1/reunioes`, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':         SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer':        'return=representation'
            },
            body: JSON.stringify(row)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Supabase error:', err);
            return res.status(500).json({ error: 'Erro ao salvar no banco: ' + err });
        }

        const saved = await response.json();
        return res.status(200).json({ ok: true, id: saved[0]?.id });

    } catch (error) {
        console.error('Save error:', error);
        return res.status(500).json({ error: error.message });
    }
}
