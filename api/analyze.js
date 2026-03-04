function transformGeminiResponse(response) {
    return {
        media_final: response.mediaFinal,
        resumo_executivo: response.resumoExecutivo,
        chance_fechamento: response.chanceFechamento,
        nota_postura: response.notaPostura,
        nota_conhecimento: response.notaConhecimento,
    };
}

// Add your existing analyze.js code below this line
