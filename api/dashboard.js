// api/dashboard.js
// ─────────────────────────────────────────────────────────────────────────────
// NOVA ESTRUTURA: 12 critérios em 3 etapas + auditoria de objeções
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

    const { coordenador, periodo, vendedor } = req.query;
    const inicio = req.query.inicio || req.query.data_inicio || null;
    const fim    = req.query.fim    || req.query.data_fim    || null;

    let filter = '';

    if (coordenador && coordenador !== 'todos') {
        filter += `&coordenador=eq.${encodeURIComponent(coordenador)}`;
    }
    if (vendedor && vendedor !== 'todos') {
        filter += `&vendedor_nome=eq.${encodeURIComponent(vendedor)}`;
    }

    if (periodo && periodo !== 'todos') {
        const now   = new Date();
        let   desde = null;
        if (periodo === '7d'  || periodo === '7')  { desde = new Date(now); desde.setDate(now.getDate() - 7); }
        if (periodo === '30d' || periodo === '30') { desde = new Date(now); desde.setDate(now.getDate() - 30); }
        if (periodo === '90d' || periodo === '90') { desde = new Date(now); desde.setDate(now.getDate() - 90); }
        if (periodo === 'mes') { desde = new Date(now.getFullYear(), now.getMonth(), 1); }
        if (periodo === 'custom' && inicio && fim) {
            filter += `&created_at=gte.${new Date(inicio).toISOString()}&created_at=lte.${new Date(fim + 'T23:59:59').toISOString()}`;
        } else if (desde) {
            filter += `&created_at=gte.${desde.toISOString()}`;
        }
    }

    try {
        const url = `${SUPABASE_URL}/rest/v1/reunioes?select=*&order=created_at.desc${filter}`;
        const response = await fetch(url, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
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

function isMalQualificado(r) {
    if (r.mal_qualificado === true) return true;
    const v = (r.qual_veredicto || '').toUpperCase();
    return v.includes('MAL') || v.includes('FORA');
}

function isNovoFormato(r) {
    return r.nota_pre_fechamento === null && r.nota_fechamento === null;
}

function extrairCriterios(r) {
    const j = r.analise_json || {};
    return {
        rapport: j.nota_rapport||0, spin: j.nota_spin||0, comunicacao: j.nota_comunicacao||0, etapa1: j.nota_etapa1||0,
        produto: j.nota_produto||0, objecoes: j.nota_objecoes||0, solucao_dor: j.nota_solucao_dor||0, encantamento: j.nota_encantamento||0, etapa2: j.nota_etapa2||0,
        pre_fechamento: j.nota_pre_fechamento||0, escuta_ativa: j.nota_escuta_ativa||0, resiliencia: j.nota_resiliencia||0,
        gestao_tempo: j.nota_gestao_tempo||0, regras_fechamento: j.nota_regras_fechamento||0, etapa3: j.nota_etapa3||0,
        total_objecoes: j.total_objecoes||0, objecoes_contornadas: j.objecoes_contornadas||0,
        objecoes_nao_contornadas: j.objecoes_nao_contornadas||0, taxa_contorno: j.taxa_contorno_objecoes||0
    };
}

function calcStats(reunioes) {
    const total = reunioes.length;
    const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
    const reunioesBoas = reunioes.filter(r => !isMalQualificado(r));
    const reunioesMalQ = reunioes.filter(r => isMalQualificado(r));
    const medias = reunioesBoas.map(r => r.media_final).filter(Boolean);

    let totalObjecoes=0, totalContornadas=0, totalNaoContornadas=0;
    reunioes.forEach(r => { const c=extrairCriterios(r); totalObjecoes+=c.total_objecoes; totalContornadas+=c.objecoes_contornadas; totalNaoContornadas+=c.objecoes_nao_contornadas; });
    const taxaContornoGlobal = totalObjecoes>0 ? Math.round((totalContornadas/totalObjecoes)*100) : 0;

    const porCoordenador = {};
    for (const r of reunioes) {
        if (!porCoordenador[r.coordenador]) porCoordenador[r.coordenador] = { total:0, medias:[], sdr_notas:[], mal_qualificados:0 };
        const c = porCoordenador[r.coordenador]; c.total++;
        if (isMalQualificado(r)) { c.mal_qualificados++; } else { if (r.media_final) c.medias.push(r.media_final); }
        if (r.qual_nota_sdr) c.sdr_notas.push(r.qual_nota_sdr);
    }
    for (const k of Object.keys(porCoordenador)) { const c=porCoordenador[k]; c.media_vendas=+avg(c.medias).toFixed(1); c.media_sdr=+avg(c.sdr_notas).toFixed(1); }

    const porVendedor = {};
    for (const r of reunioes) {
        if (!porVendedor[r.vendedor_nome]) {
            porVendedor[r.vendedor_nome] = {
                nome:r.vendedor_nome, coordenador:r.coordenador, total:0, total_validas:0, total_mal_qualif:0, medias:[],
                etapa1:[], etapa2:[], etapa3:[],
                rapport:[], spin:[], comunicacao:[], produto:[], objecoes:[], solucao_dor:[], encantamento:[],
                pre_fechamento:[], escuta_ativa:[], resiliencia:[], gestao_tempo:[], regras_fechamento:[],
                objecoes_total:0, objecoes_contornadas:0, objecoes_nao_contornadas:0,
                leg_rapport:[], leg_produto:[], leg_apresentacao:[], leg_pre_fechamento:[], leg_fechamento:[]
            };
        }
        const v = porVendedor[r.vendedor_nome]; v.total++;
        if (isMalQualificado(r)) { v.total_mal_qualif++; }
        else {
            v.total_validas++; if (r.media_final) v.medias.push(r.media_final);
            if (isNovoFormato(r)) {
                const cr=extrairCriterios(r);
                if(cr.etapa1)v.etapa1.push(cr.etapa1); if(cr.etapa2)v.etapa2.push(cr.etapa2); if(cr.etapa3)v.etapa3.push(cr.etapa3);
                if(cr.rapport)v.rapport.push(cr.rapport); if(cr.spin)v.spin.push(cr.spin); if(cr.comunicacao)v.comunicacao.push(cr.comunicacao);
                if(cr.produto)v.produto.push(cr.produto); if(cr.objecoes)v.objecoes.push(cr.objecoes);
                if(cr.solucao_dor)v.solucao_dor.push(cr.solucao_dor); if(cr.encantamento)v.encantamento.push(cr.encantamento);
                if(cr.pre_fechamento)v.pre_fechamento.push(cr.pre_fechamento); if(cr.escuta_ativa)v.escuta_ativa.push(cr.escuta_ativa);
                if(cr.resiliencia)v.resiliencia.push(cr.resiliencia); if(cr.gestao_tempo)v.gestao_tempo.push(cr.gestao_tempo);
                if(cr.regras_fechamento)v.regras_fechamento.push(cr.regras_fechamento);
                v.objecoes_total+=cr.total_objecoes; v.objecoes_contornadas+=cr.objecoes_contornadas; v.objecoes_nao_contornadas+=cr.objecoes_nao_contornadas;
            } else {
                if(r.nota_rapport)v.leg_rapport.push(r.nota_rapport); if(r.nota_produto)v.leg_produto.push(r.nota_produto);
                if(r.nota_apresentacao)v.leg_apresentacao.push(r.nota_apresentacao);
                if(r.nota_pre_fechamento)v.leg_pre_fechamento.push(r.nota_pre_fechamento); if(r.nota_fechamento)v.leg_fechamento.push(r.nota_fechamento);
            }
        }
    }

    const ranking = Object.values(porVendedor).map(v => {
        const tc = v.objecoes_total>0 ? Math.round((v.objecoes_contornadas/v.objecoes_total)*100) : 0;
        return { ...v, media:+avg(v.medias).toFixed(1),
            avg_etapa1:+avg(v.etapa1).toFixed(1), avg_etapa2:+avg(v.etapa2).toFixed(1), avg_etapa3:+avg(v.etapa3).toFixed(1),
            avg_rapport:+avg(v.rapport).toFixed(1), avg_spin:+avg(v.spin).toFixed(1), avg_comunicacao:+avg(v.comunicacao).toFixed(1),
            avg_produto:+avg(v.produto).toFixed(1), avg_objecoes:+avg(v.objecoes).toFixed(1), avg_solucao_dor:+avg(v.solucao_dor).toFixed(1),
            avg_encantamento:+avg(v.encantamento).toFixed(1), avg_pre_fechamento:+avg(v.pre_fechamento).toFixed(1),
            avg_escuta_ativa:+avg(v.escuta_ativa).toFixed(1), avg_resiliencia:+avg(v.resiliencia).toFixed(1),
            avg_gestao_tempo:+avg(v.gestao_tempo).toFixed(1), avg_regras_fechamento:+avg(v.regras_fechamento).toFixed(1),
            taxa_contorno:tc,
            avg_leg_rapport:+avg(v.leg_rapport).toFixed(1), avg_leg_produto:+avg(v.leg_produto).toFixed(1),
            avg_leg_apresentacao:+avg(v.leg_apresentacao).toFixed(1), avg_leg_pre_fechamento:+avg(v.leg_pre_fechamento).toFixed(1),
            avg_leg_fechamento:+avg(v.leg_fechamento).toFixed(1),
        };
    }).sort((a,b) => b.media - a.media);

    const porSemana = {};
    for (const r of reunioesBoas) {
        const d=new Date(r.created_at); const mon=new Date(d); mon.setDate(d.getDate()-d.getDay());
        const key=mon.toISOString().split('T')[0];
        if(!porSemana[key]) porSemana[key]={semana:key,medias:[],total:0};
        porSemana[key].total++; if(r.media_final) porSemana[key].medias.push(r.media_final);
    }
    const evolucao = Object.values(porSemana).map(s=>({semana:s.semana,media:+avg(s.medias).toFixed(1),total:s.total})).sort((a,b)=>a.semana.localeCompare(b.semana));

    const veredictos = {QUALIFICADO:0,PARCIALMENTE:0,MAL:0,FORA:0,SEM:0};
    for (const r of reunioes) {
        const v=(r.qual_veredicto||'').toUpperCase();
        if(v.includes('FORA'))veredictos.FORA++; else if(v.includes('MAL'))veredictos.MAL++;
        else if(v.includes('PARC'))veredictos.PARCIALMENTE++; else if(v.includes('QUAL'))veredictos.QUALIFICADO++; else veredictos.SEM++;
    }

    return {
        total, total_validas:reunioesBoas.length, total_mal_qualif:reunioesMalQ.length,
        media_geral:+avg(medias).toFixed(1),
        objecoes:{total:totalObjecoes,contornadas:totalContornadas,nao_contornadas:totalNaoContornadas,taxa_contorno:taxaContornoGlobal},
        porCoordenador, porVendedor, ranking, evolucao, veredictos,
        reunioes_mal_qualificadas: reunioesMalQ.map(r=>({
            id:r.id, coordenador:r.coordenador, vendedor_nome:r.vendedor_nome, produto:r.produto,
            qual_veredicto:r.qual_veredicto, qual_nota_sdr:r.qual_nota_sdr, chance_fechamento:r.chance_fechamento, created_at:r.created_at
        }))
    };
}
