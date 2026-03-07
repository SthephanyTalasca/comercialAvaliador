// api/dashboard.js
// Retorna dados agregados para o dashboard

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

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

    const { coordenador, periodo } = req.query;

    try {
        // ── Montar filtros ───────────────────────────────────────────────────
        let filter = '';

        if (coordenador && coordenador !== 'todos') {
            filter += `&coordenador=eq.${encodeURIComponent(coordenador)}`;
        }

        // Período: 7d | 30d | 90d | todos
        if (periodo && periodo !== 'todos') {
            const days = parseInt(periodo);
            const since = new Date(Date.now() - days * 86400000).toISOString();
            filter += `&created_at=gte.${since}`;
        }

        // ── Buscar reuniões ──────────────────────────────────────────────────
        const url = `${SUPABASE_URL}/rest/v1/reunioes?select=*&order=created_at.desc${filter}`;
        const response = await fetch(url, {
            headers: {
                'apikey':         SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!response.ok) {
            const err = await response.text();
            return res.status(500).json({ error: 'Erro ao buscar dados: ' + err });
        }

        const reunioes = await response.json();

        if (!reunioes.length) {
            return res.status(200).json({ reunioes: [], stats: null });
        }

        // ── Calcular stats ───────────────────────────────────────────────────
        const stats = calcStats(reunioes);

        return res.status(200).json({ reunioes, stats });

    } catch (error) {
        console.error('Dashboard error:', error);
        return res.status(500).json({ error: error.message });
    }
}

function calcStats(reunioes) {
    const total = reunioes.length;
    const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
    const medias = reunioes.map(r => r.media_final).filter(Boolean);

    // ── Por coordenador ──────────────────────────────────────────────────────
    const porCoordenador = {};
    for (const r of reunioes) {
        if (!porCoordenador[r.coordenador]) {
            porCoordenador[r.coordenador] = { total: 0, medias: [], sdr_notas: [], mal_qualificados: 0 };
        }
        const c = porCoordenador[r.coordenador];
        c.total++;
        if (r.media_final) c.medias.push(r.media_final);
        if (r.qual_nota_sdr) c.sdr_notas.push(r.qual_nota_sdr);
        if (r.qual_veredicto?.includes('MAL') || r.qual_veredicto?.includes('FORA')) c.mal_qualificados++;
    }
    for (const k of Object.keys(porCoordenador)) {
        const c = porCoordenador[k];
        c.media_vendas = +avg(c.medias).toFixed(1);
        c.media_sdr    = +avg(c.sdr_notas).toFixed(1);
    }

    // ── Ranking vendedores ───────────────────────────────────────────────────
    const porVendedor = {};
    for (const r of reunioes) {
        if (!porVendedor[r.vendedor_nome]) {
            porVendedor[r.vendedor_nome] = {
                nome: r.vendedor_nome,
                coordenador: r.coordenador,
                total: 0, medias: [],
                rapport: [], produto: [], apresentacao: [],
                pre_fechamento: [], fechamento: []
            };
        }
        const v = porVendedor[r.vendedor_nome];
        v.total++;
        if (r.media_final)         v.medias.push(r.media_final);
        if (r.nota_rapport)        v.rapport.push(r.nota_rapport);
        if (r.nota_produto)        v.produto.push(r.nota_produto);
        if (r.nota_apresentacao)   v.apresentacao.push(r.nota_apresentacao);
        if (r.nota_pre_fechamento) v.pre_fechamento.push(r.nota_pre_fechamento);
        if (r.nota_fechamento)     v.fechamento.push(r.nota_fechamento);
    }

    const ranking = Object.values(porVendedor).map(v => ({
        ...v,
        media:          +avg(v.medias).toFixed(1),
        avg_rapport:    +avg(v.rapport).toFixed(1),
        avg_produto:    +avg(v.produto).toFixed(1),
        avg_apresentacao: +avg(v.apresentacao).toFixed(1),
        avg_pre_fechamento: +avg(v.pre_fechamento).toFixed(1),
        avg_fechamento: +avg(v.fechamento).toFixed(1),
    })).sort((a,b) => b.media - a.media);

    // ── Evolução temporal (por semana) ───────────────────────────────────────
    const porSemana = {};
    for (const r of reunioes) {
        const d   = new Date(r.created_at);
        const mon = new Date(d);
        mon.setDate(d.getDate() - d.getDay());
        const key = mon.toISOString().split('T')[0];
        if (!porSemana[key]) porSemana[key] = { semana: key, medias: [], total: 0 };
        porSemana[key].total++;
        if (r.media_final) porSemana[key].medias.push(r.media_final);
    }
    const evolucao = Object.values(porSemana)
        .map(s => ({ semana: s.semana, media: +avg(s.medias).toFixed(1), total: s.total }))
        .sort((a,b) => a.semana.localeCompare(b.semana));

    // ── SDR stats ────────────────────────────────────────────────────────────
    const veredictos = { QUALIFICADO: 0, PARCIALMENTE: 0, MAL: 0, FORA: 0, SEM: 0 };
    for (const r of reunioes) {
        const v = r.qual_veredicto || '';
        if (v.includes('FORA'))  veredictos.FORA++;
        else if (v.includes('MAL'))   veredictos.MAL++;
        else if (v.includes('PARC'))  veredictos.PARCIALMENTE++;
        else if (v.includes('QUAL'))  veredictos.QUALIFICADO++;
        else                          veredictos.SEM++;
    }

    return {
        total,
        media_geral:    +avg(medias).toFixed(1),
        porCoordenador,
        ranking,
        evolucao,
        veredictos
    };
}
