// Function to transform Gemini response
const transformGeminiResponse = (response) => {
    // Correct the transformation logic to match the frontend requirements
    return response.map(item => {
        return {
            id: item.id,
            name: item.name,
            media_final: calculateMediaFinal(item.scores), // Function to calculate media_final
            field1: item.field1,
            field2: item.field2,
            // Map other required fields here
        };
    });
};

// Helper function to calculate media_final
const calculateMediaFinal = (scores) => {
    // Implement the logic for calculating media_final
a   if (scores && scores.length) {
        const total = scores.reduce((acc, score) => acc + score, 0);
        const media = total / scores.length;
        return media;
    }
    return 0;
};