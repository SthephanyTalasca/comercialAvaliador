// api/me.js
// Retorna os dados do usuário logado a partir do cookie de sessão
// Inclui o campo `role` (admin | viewer) para o frontend controlar permissões

export default function handler(req, res) {
    const cookie = req.headers.cookie || '';
    const match  = cookie.match(/nibo_session=([^;]+)/);

    if (!match) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    try {
        const session = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));

        // Verificar expiração
        if (session.exp && Date.now() > session.exp) {
            res.setHeader('Set-Cookie', 'nibo_session=; Max-Age=0; Path=/');
            return res.status(401).json({ error: 'Sessão expirada' });
        }

        // Verificar domínio @nibo.com.br
        const domain = session.email.toLowerCase().split('@')[1];
        if (domain !== 'nibo.com.br') {
            res.setHeader('Set-Cookie', 'nibo_session=; Max-Age=0; Path=/');
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        return res.status(200).json({
            email:   session.email,
            name:    session.name,
            picture: session.picture,
            role:    session.role || 'viewer'   // ← NOVO: fallback seguro para sessões antigas
        });

    } catch {
        return res.status(401).json({ error: 'Sessão inválida' });
    }
}
