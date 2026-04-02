// api/dashboard.js
// ─────────────────────────────────────────────────────────────────────────────
// REGRA MAL QUALIFICADO:
//   Reuniões onde mal_qualificado = true (lead Mal Qualificado ou Fora de
//   Portfólio) NÃO contabilizam na média do vendedor nem no ranking.
//   Elas aparecem apenas em stats.reunioes_mal_qualificadas para relatório
//   separado.
// ─────────────────────────────────────────────────────────────────────────────

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
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
    if (!getSession(req)) return res.status(401).json({ error: 'Não autorizado' });

const { coordenador, periodo, vendedor, produto } = req.query;
const inicio = req.query.inicio || req.query.data_inicio || '';
const fim    = req.query.fim    || req.query.data_fim    || '';
    
    let filter = '';

    if (coordenador && coordenador !== 'todos') {
        filter += `&coordenador=eq.${encodeURIComponent(coordenador)}`;
    }
    if (vendedor && vendedor !== 'todos') {
        filter += `&vendedor_nome=eq.${encodeURIComponent(vendedor)}`;
    }
    // ── Filtro por produto ────────────────────────────────────────────────────
    if (produto && produto !== 'todos') {
        filter += `&produto=ilike.*${encodeURIComponent(produto)}*`;
    }

    // Filtro de período
    if (periodo && periodo !== 'todos') {
        const now   = new Date();
        let   desde = null;
        if (periodo === '7d')  { desde = new Date(now); desde.setDate(now.getDate() - 7); }
        if (periodo === '30d') { desde = new Date(now); desde.setDate(now.getDate() - 30); }
        if (periodo === '90d') { desde = new Date(now); desde.setDate(now.getDate() - 90); }
        if (periodo === 'mes') { desde = new Date(now.getFullYear(), now.getMonth(), 1); }
        if (periodo === 'custom' && inicio && fim) {
            filter += `&created_at=gte.${new Date(inicio).toISOString()}&created_at=lte.${new Date(fim + 'T23:59:59').toISOString()}`;
        } else if (desde) {
            filter += `&created_at=gte.${desde.toISOString()}`;
        }
    }
    // suporte a periodo numérico (ex: "30", "7", "90") vindo dos filtros de histórico
    if (periodo && !isNaN(parseInt(periodo, 10))) {
        const dias = parseInt(periodo, 10);
        const desde = new Date(Date.now() - dias * 86400000).toISOString();
        filter += `&created_at=gte.${desde}`;
    }

    try {
        const url = `${SUPABASE_URL}/rest/v1/reunioes?select=*&order=created_at.desc${filter}`;
        const response = await fetch(url, {
            headers: {
                'apikey':        SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!response.ok) {
            const err = await response.text();
            return res.status(500).json({ error: 'Erro ao buscar dados: ' + err });
        }

        const reunioes = await response.json();
        if (!reunioes.length) return res.status(200).json({ reunioes: [], stats: null });

        const stats = calcStats(reunioes);
        return res.status(200).json({ reunioes, stats });

    } catch (error) {
        console.error('Dashboard error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// ── Helper: detecta mal qualificado (campo novo ou derivado do veredicto) ─────
function isMalQualificado(r) {
    if (r.mal_qualificado === true) return true;
    const v = (r.qual_veredicto || '').toUpperCase();
    return v.includes('MAL') || v.includes('FORA');
}

function calcStats(reunioes) {
    const total = reunioes.length;
    const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    // Separar bem qualificados das RDs com lead mal qualificado
    const reunioesBoas = reunioes.filter(r => !isMalQualificado(r));
    const reunioesMalQ = reunioes.filter(r => isMalQualificado(r));

    // Média geral só conta reuniões bem qualificadas
    const medias = reunioesBoas.map(r => r.media_final).filter(Boolean);

    // ── Por coordenador ──────────────────────────────────────────────────────
    const porCoordenador = {};
    for (const r of reunioes) {
        if (!porCoordenador[r.coordenador]) {
            porCoordenador[r.coordenador] = { total: 0, medias: [], sdr_notas: [], mal_qualificados: 0 };
        }
        const c = porCoordenador[r.coordenador];
        c.total++;
        if (isMalQualificado(r)) {
            c.mal_qualificados++;
        } else {
            if (r.media_final) c.medias.push(r.media_final);
        }
        if (r.qual_nota_sdr) c.sdr_notas.push(r.qual_nota_sdr);
    }
    for (const k of Object.keys(porCoordenador)) {
        const c = porCoordenador[k];
        c.media_vendas = +avg(c.medias).toFixed(1);
        c.media_sdr    = +avg(c.sdr_notas).toFixed(1);
    }

    // ── Ranking vendedores (EXCLUI reuniões mal qualificadas da média) ────────
    const porVendedor = {};
    for (const r of reunioes) {
        if (!porVendedor[r.vendedor_nome]) {
            porVendedor[r.vendedor_nome] = {
                nome:              r.vendedor_nome,
                coordenador:       r.coordenador,
                total:             0,
                total_validas:     0,
                total_mal_qualif:  0,
                medias: [],
                etapa1: [], etapa2: [], etapa3: [],
                rapport: [], produto: [], apresentacao: [],
                pre_fechamento: [], fechamento: []
            };
        }
        const v = porVendedor[r.vendedor_nome];
        v.total++;

        if (isMalQualificado(r)) {
            v.total_mal_qualif++;
        } else {
            v.total_validas++;
            if (r.media_final) v.medias.push(r.media_final);

            const temEtapas = r.nota_pre_fechamento === null && r.nota_fechamento === null;
            if (temEtapas) {
                if (r.nota_rapport)      v.etapa1.push(r.nota_rapport);
                if (r.nota_produto)      v.etapa2.push(r.nota_produto);
                if (r.nota_apresentacao) v.etapa3.push(r.nota_apresentacao);
            } else {
                if (r.nota_rapport)        v.rapport.push(r.nota_rapport);
                if (r.nota_produto)        v.produto.push(r.nota_produto);
                if (r.nota_apresentacao)   v.apresentacao.push(r.nota_apresentacao);
                if (r.nota_pre_fechamento) v.pre_fechamento.push(r.nota_pre_fechamento);
                if (r.nota_fechamento)     v.fechamento.push(r.nota_fechamento);
            }
        }
    }

    const ranking = Object.values(porVendedor).map(v => ({
        ...v,
        media:              +avg(v.medias).toFixed(1),
        avg_etapa1:         +avg(v.etapa1).toFixed(1),
        avg_etapa2:         +avg(v.etapa2).toFixed(1),
        avg_etapa3:         +avg(v.etapa3).toFixed(1),
        avg_rapport:        +avg(v.rapport).toFixed(1),
        avg_produto:        +avg(v.produto).toFixed(1),
        avg_apresentacao:   +avg(v.apresentacao).toFixed(1),
        avg_pre_fechamento: +avg(v.pre_fechamento).toFixed(1),
        avg_fechamento:     +avg(v.fechamento).toFixed(1),
    })).sort((a, b) => b.media - a.media);

    // ── Evolução temporal (por semana) ───────────────────────────────────────
    const porSemana = {};
    for (const r of reunioesBoas) {
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
        .sort((a, b) => a.semana.localeCompare(b.semana));

    // ── SDR stats ────────────────────────────────────────────────────────────
    const veredictos = { QUALIFICADO: 0, PARCIALMENTE: 0, MAL: 0, FORA: 0, SEM: 0 };
    for (const r of reunioes) {
        const v = (r.qual_veredicto || '').toUpperCase();
        if (v.includes('FORA'))       veredictos.FORA++;
        else if (v.includes('MAL'))   veredictos.MAL++;
        else if (v.includes('PARC'))  veredictos.PARCIALMENTE++;
        else if (v.includes('QUAL'))  veredictos.QUALIFICADO++;
        else                          veredictos.SEM++;
    }

    return {
        total,
        total_validas:    reunioesBoas.length,
        total_mal_qualif: reunioesMalQ.length,
        media_geral:      +avg(medias).toFixed(1),
        porCoordenador,
        ranking,
        evolucao,
        veredictos,
        reunioes_mal_qualificadas: reunioesMalQ.map(r => ({
            id:             r.id,
            coordenador:    r.coordenador,
            vendedor_nome:  r.vendedor_nome,
            produto:        r.produto,
            qual_veredicto: r.qual_veredicto,
            qual_nota_sdr:  r.qual_nota_sdr,
            chance_fechamento: r.chance_fechamento,
            created_at:     r.created_at
        }))
    };
}
