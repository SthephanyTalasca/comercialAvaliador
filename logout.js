// api/logout.js
// Apaga o cookie de sessão e retorna 200 (redirect feito pelo frontend)

export default function handler(req, res) {
    res.setHeader('Set-Cookie', 'nibo_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
    return res.status(200).json({ ok: true });
}



