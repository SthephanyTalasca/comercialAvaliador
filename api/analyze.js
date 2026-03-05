import { GoogleGenAI, Type } from '@google/genai';

export const maxDuration = 300; // 5 min — requer Vercel Pro; no Hobby o limite é 60s

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const COMPRESS_THRESHOLD = 12000; // ~2000 palavras; acima disso comprime primeiro

// ─── FASE 1: Extrai evidências por pilar — reduz tokens sem perder qualidade ──
async function compressTranscript(transcript) {
    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: transcript,
        config: {
            maxOutputTokens: 4096,
            systemInstruction: `Você receberá a transcrição completa de uma reunião de Onboarding/CS do Nibo.
Sua tarefa é extrair e preservar APENAS as informações necessárias para avaliar os 17 pilares de CS.
NÃO resuma genericamente. Extraia evidências concretas e falas representativas de cada pilar.

Pilares a cobrir:
Consultividade, Escuta Ativa, Jornada do Cliente, Encantamento, Objeções/Bugs, Rapport,
Autoridade, Postura, Gestão de Tempo, Contextualização, Clareza, Objetividade,
Flexibilidade, Domínio de Produto, Domínio de Negócio, Ecossistema Nibo, Universo Contábil.

Para cada pilar cite 1–3 trechos ou comportamentos observados (diretos ou parafraseados).
Além disso, extraia:
- Sistemas/ferramentas citados pelo cliente
- Estimativa de % de fala do Analista CS vs Cliente
- Evidências de: definição de prazo, dever de casa, validação de acesso/certificado,
  agendamento de próxima reunião, retomada da dor de vendas, explicação do canal de suporte.

Formato: texto estruturado com seções por pilar. Máximo 3000 palavras.`
        }
    });
    return res.text;
}

// ─── FASE 2: Análise dos 17 pilares ──────────────────────────────────────────
async function analyzeContent(content) {
    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: content,
        config: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            systemInstruction: `Você é um auditor sênior de Customer Success do Nibo.
Avalie o conteúdo fornecido (transcrição ou resumo estruturado de reunião de Onboarding/Implementação)
e dê notas de 1 a 5 para os 17 pilares de CS:

1. Consultividade  2. Escuta Ativa  3. Jornada do Cliente  4. Encantamento  5. Objeções/Bugs
6. Rapport  7. Autoridade  8. Postura  9. Gestão de Tempo  10. Contextualização
11. Clareza  12. Objetividade  13. Flexibilidade  14. Domínio de Produto
15. Domínio de Negócio  16. Ecossistema Nibo  17. Universo Contábil

Para CADA PILAR forneça nota (1–5), motivo ("porque_...") em até 2 frases e o que faltou para 5 ("melhoria_...").
Se nota for 5, escreva "Critério de excelência atingido." em melhoria.
É vital que a resposta não seja cortada.`,
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    media_final:      { type: Type.NUMBER },
                    resumo_executivo: { type: Type.STRING },
                    saude_cliente:    { type: Type.STRING },
                    risco_churn:      { type: Type.STRING },
                    sistemas_citados: { type: Type.ARRAY, items: { type: Type.STRING } },

                    nota_consultividade:    { type: Type.NUMBER }, porque_consultividade:    { type: Type.STRING }, melhoria_consultividade:    { type: Type.STRING },
                    nota_escuta_ativa:      { type: Type.NUMBER }, porque_escuta_ativa:      { type: Type.STRING }, melhoria_escuta_ativa:      { type: Type.STRING },
                    nota_jornada_cliente:   { type: Type.NUMBER }, porque_jornada_cliente:   { type: Type.STRING }, melhoria_jornada_cliente:   { type: Type.STRING },
                    nota_encantamento:      { type: Type.NUMBER }, porque_encantamento:      { type: Type.STRING }, melhoria_encantamento:      { type: Type.STRING },
                    nota_objecoes:          { type: Type.NUMBER }, porque_objecoes:          { type: Type.STRING }, melhoria_objecoes:          { type: Type.STRING },
                    nota_rapport:           { type: Type.NUMBER }, porque_rapport:           { type: Type.STRING }, melhoria_rapport:           { type: Type.STRING },
                    nota_autoridade:        { type: Type.NUMBER }, porque_autoridade:        { type: Type.STRING }, melhoria_autoridade:        { type: Type.STRING },
                    nota_postura:           { type: Type.NUMBER }, porque_postura:           { type: Type.STRING }, melhoria_postura:           { type: Type.STRING },
                    nota_gestao_tempo:      { type: Type.NUMBER }, porque_gestao_tempo:      { type: Type.STRING }, melhoria_gestao_tempo:      { type: Type.STRING },
                    nota_contextualizacao:  { type: Type.NUMBER }, porque_contextualizacao:  { type: Type.STRING }, melhoria_contextualizacao:  { type: Type.STRING },
                    nota_clareza:           { type: Type.NUMBER }, porque_clareza:           { type: Type.STRING }, melhoria_clareza:           { type: Type.STRING },
                    nota_objetividade:      { type: Type.NUMBER }, porque_objetividade:      { type: Type.STRING }, melhoria_objetividade:      { type: Type.STRING },
                    nota_flexibilidade:     { type: Type.NUMBER }, porque_flexibilidade:     { type: Type.STRING }, melhoria_flexibilidade:     { type: Type.STRING },
                    nota_dominio_produto:   { type: Type.NUMBER }, porque_dominio_produto:   { type: Type.STRING }, melhoria_dominio_produto:   { type: Type.STRING },
                    nota_dominio_negocio:   { type: Type.NUMBER }, porque_dominio_negocio:   { type: Type.STRING }, melhoria_dominio_negocio:   { type: Type.STRING },
                    nota_ecossistema_nibo:  { type: Type.NUMBER }, porque_ecossistema_nibo:  { type: Type.STRING }, melhoria_ecossistema_nibo:  { type: Type.STRING },
                    nota_universo_contabil: { type: Type.NUMBER }, porque_universo_contabil: { type: Type.STRING }, melhoria_universo_contabil: { type: Type.STRING },

                    tempo_fala_cs:      { type: Type.STRING },
                    tempo_fala_cliente: { type: Type.STRING },

                    checklist_cs: {
                        type: Type.OBJECT,
                        properties: {
                            definiu_prazo_implementacao:   { type: Type.BOOLEAN },
                            alinhou_dever_de_casa:         { type: Type.BOOLEAN },
                            validou_certificado_digital:   { type: Type.BOOLEAN },
                            agendou_proximo_passo:         { type: Type.BOOLEAN },
                            conectou_com_dor_vendas:       { type: Type.BOOLEAN },
                            explicou_canal_suporte:        { type: Type.BOOLEAN }
                        }
                    },

                    pontos_fortes:           { type: Type.ARRAY, items: { type: Type.STRING } },
                    pontos_atencao:          { type: Type.ARRAY, items: { type: Type.STRING } },
                    justificativa_detalhada: { type: Type.STRING }
                },
                required: [
                    "media_final","resumo_executivo","saude_cliente","risco_churn","sistemas_citados",
                    "nota_consultividade","porque_consultividade","melhoria_consultividade",
                    "nota_escuta_ativa","porque_escuta_ativa","melhoria_escuta_ativa",
                    "nota_jornada_cliente","porque_jornada_cliente","melhoria_jornada_cliente",
                    "nota_encantamento","porque_encantamento","melhoria_encantamento",
                    "nota_objecoes","porque_objecoes","melhoria_objecoes",
                    "nota_rapport","porque_rapport","melhoria_rapport",
                    "nota_autoridade","porque_autoridade","melhoria_autoridade",
                    "nota_postura","porque_postura","melhoria_postura",
                    "nota_gestao_tempo","porque_gestao_tempo","melhoria_gestao_tempo",
                    "nota_contextualizacao","porque_contextualizacao","melhoria_contextualizacao",
                    "nota_clareza","porque_clareza","melhoria_clareza",
                    "nota_objetividade","porque_objetividade","melhoria_objetividade",
                    "nota_flexibilidade","porque_flexibilidade","melhoria_flexibilidade",
                    "nota_dominio_produto","porque_dominio_produto","melhoria_dominio_produto",
                    "nota_dominio_negocio","porque_dominio_negocio","melhoria_dominio_negocio",
                    "nota_ecossistema_nibo","porque_ecossistema_nibo","melhoria_ecossistema_nibo",
                    "nota_universo_contabil","porque_universo_contabil","melhoria_universo_contabil",
                    "tempo_fala_cs","tempo_fala_cliente",
                    "checklist_cs","pontos_fortes","pontos_atencao","justificativa_detalhada"
                ]
            }
        }
    });
    return res.text;
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Método não permitido. Use POST." });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: "O texto da transcrição é obrigatório." });
    }

    try {
        const isLong = prompt.length > COMPRESS_THRESHOLD;
        const contentToAnalyze = isLong
            ? await compressTranscript(prompt)
            : prompt;

        const rawJson = await analyzeContent(contentToAnalyze);

        let analysisData;
        try {
            analysisData = JSON.parse(rawJson);
        } catch (parseError) {
            console.error("Erro parse JSON:", rawJson?.slice(0, 500));
            return res.status(500).json({
                error: "A IA retornou JSON inválido. Tente novamente."
            });
        }

        analysisData._compressed = isLong; // badge no frontend
        return res.status(200).json(analysisData);

    } catch (error) {
        console.error("Erro na API:", error);
        return res.status(500).json({ error: "Erro do Google Gemini: " + error.message });
    }
}
