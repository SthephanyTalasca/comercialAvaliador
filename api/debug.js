// api/debug.js
// ATENÇÃO: DELETE este arquivo após resolver o problema!
// Acesse: https://seu-app.vercel.app/api/debug

export default function handler(req, res) {
    res.status(200).json({
        GOOGLE_CLIENT_ID:     process.env.GOOGLE_CLIENT_ID     ? '✅ definido' : '❌ UNDEFINED',
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✅ definido' : '❌ UNDEFINED',
        GOOGLE_REDIRECT_URI:  process.env.GOOGLE_REDIRECT_URI  || '❌ UNDEFINED',
        GEMINI_API_KEY:       process.env.GEMINI_API_KEY       ? '✅ definido' : '❌ UNDEFINED',
    });
}
