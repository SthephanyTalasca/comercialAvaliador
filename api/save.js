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

// Converte para inteiro — colunas nota_* são smallint no Supabase
function toInt(v) {
    if (v === null || v === undefined) return null;
    const n = Math.round(Number(v));
    return isNaN(n) ? null : n;
}

async function detectarCoordenador(vendedorNome) {
    if (!vendedorNome || vendedorNome === 'Não identificado') return '';
    try {
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/vendedores?nome=ilike.${encodeURIComponent(vendedorNome)}&select=coordenador&limit=1`,
            { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
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

    const veredicto = (analise.qual_veredicto || '').toUpperCase();
    const mal_qualificado =
        analise._mal_qualificado === true ||
        veredicto.includes('MAL') ||
        veredicto.includes('FORA');

    // Resolve coordenador em cascata
    let coordenadorFinal = (coordenador || '').trim();
    if (!coordenadorFinal) {
        coordenadorFinal = await detectarCoordenador(analise.vendedor_nome);
    }
    if (!coordenadorFinal) {
        coordenadorFinal = session.name || session.email;
    }

    // Salva auditor dentro do JSON (sem precisar de coluna extra)
    const analiseComAuditor = {
        ...analise,
        _auditado_por:  session.email,
        _auditado_nome: session.name
    };

 // DIFF: api/save.js
// Dentro do objeto `registro`, após nota_apresentacao, adicionar:

nota_spin_s:         toInt(analise.nota_spin_s),
nota_spin_p:         toInt(analise.nota_spin_p),
nota_spin_i:         toInt(analise.nota_spin_i),
nota_spin_n:         toInt(analise.nota_spin_n),
nota_etapa_spin:     analise.nota_etapa_spin    || null,


const registro = {
    coordenador:         coordenadorFinal,
    vendedor_nome:       analise.vendedor_nome             || 'Não identificado',
    produto:             analise.qual_produto_identificado || null,
    media_final:         analise.media_final               || 0,
    nota_rapport:        toInt(analise.nota_etapa1),
    nota_produto:        toInt(analise.nota_etapa2),
    nota_apresentacao:   toInt(analise.nota_etapa3),
    nota_spin_s:         toInt(analise.nota_spin_s),
    nota_spin_p:         toInt(analise.nota_spin_p),
    nota_spin_i:         toInt(analise.nota_spin_i),
    nota_spin_n:         toInt(analise.nota_spin_n),
    nota_etapa_spin:     analise.nota_etapa_spin            || null,
    nota_pre_fechamento: null,
    nota_fechamento:     null,
    qual_veredicto:      analise.qual_veredicto            || null,
    qual_nota_sdr:       toInt(analise.qual_nota_sdr),
    mal_qualificado,
    analise_json:        analiseComAuditor
};
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
