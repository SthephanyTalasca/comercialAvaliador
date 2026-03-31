// api/auth.js
// Google OAuth via troca de código de autorização
// Qualquer conta @nibo.com.br tem acesso
// Role: 'admin' → coordenadores | 'viewer' → demais usuários Nibo

// ─── Lista de emails com acesso admin ───────────────────────────────────────
// Adicione aqui todos os coordenadores/gestores que devem ter acesso total
const ADMIN_EMAILS = [
    'simone.rangel@nibo.com.br',
    'jonathan.dornelas@nibo.com.br',
    // adicione outros admins aqui se necessário
];

export default async function handler(req, res) {
    const { code, error } = req.query;

    // ── Erro vindo do Google ──────────────────────────────────────────────
    if (error) {
        return res.redirect('/?auth_error=acesso_negado');
    }

    // ── Passo 1: redirecionar para o Google ───────────────────────────────
    if (!code) {
        const params = new URLSearchParams({
            client_id:     process.env.GOOGLE_CLIENT_ID,
            redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
            response_type: 'code',
            scope:         'openid email profile',
            access_type:   'offline',
            prompt:        'select_account'
        });
        return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    }

    // ── Passo 2: trocar código por token ──────────────────────────────────
    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id:     process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
                grant_type:    'authorization_code'
            })
        });

        const tokens = await tokenRes.json();
        if (!tokens.access_token) throw new Error('Token inválido');

        // ── Passo 3: buscar email do usuário ──────────────────────────────
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        const user = await userRes.json();

        // ── Passo 4: verificar domínio @nibo.com.br ───────────────────────
        const domain = user.email.toLowerCase().split('@')[1];
        if (domain !== 'nibo.com.br') {
            return res.redirect(`/?auth_error=dominio_invalido&email=${encodeURIComponent(user.email)}`);
        }

        // ── Passo 5: definir role ─────────────────────────────────────────
        // admin   → pode tudo (submeter, editar, excluir, dashboard, gestão)
        // viewer  → só pode VER análises já salvas (histórico, dashboard read-only)
        const role = ADMIN_EMAILS.includes(user.email.toLowerCase()) ? 'admin' : 'viewer';

        // ── Passo 6: criar sessão com role via cookie ─────────────────────
        const session = Buffer.from(JSON.stringify({
            email:   user.email,
            name:    user.name,
            picture: user.picture,
            role,                                           // ← NOVO
            exp:     Date.now() + 24 * 60 * 60 * 1000      // 24 horas
        })).toString('base64');

        res.setHeader('Set-Cookie',
            `nibo_session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
        );

        return res.redirect('/');

    } catch (err) {
        console.error('Auth error:', err);
        return res.redirect('/?auth_error=erro_interno');
    }
}
