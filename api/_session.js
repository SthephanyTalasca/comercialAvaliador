// api/_session.js
// Helper centralizado para leitura de sessão + verificação de role
// Importar com: import { getSession, requireAdmin } from './_session.js';

export function getSession(req) {
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

// Retorna true se o usuário é admin
export function isAdmin(session) {
    return session?.role === 'admin';
}

// Responde 403 se não for admin; retorna false para o handler parar
export function requireAdmin(session, res) {
    if (!isAdmin(session)) {
        res.status(403).json({ error: 'Permissão negada. Apenas coordenadores podem realizar esta ação.' });
        return false;
    }
    return true;
}
