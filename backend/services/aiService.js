// **backend/services/aiService.js**

const { GoogleGenAI } = require('@google/genai');
const ApiError = require('../utils/ApiError');

// Initialize the Google Gen AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Define the Expected Output Schema ---
const categorizationSchema = {
    type: "object",
    properties: {
        title:{
            type: "string",
            description: "improve title as professional title ",
        },
        description:{
            type: "string",
            description: "improve description as professional description ",
        },
        category: {
            type: "string",
            description: "The most relevant category for the reported issue.",
            enum: [
                'Road_Damage',
                'Garbage_Collection',
                'Street_Lighting',
                'Water_Supply',
                'Drainage',
                'Illegal_Construction',
                'Public_Property_Damage',
                'Other'
            ]
        },
        priority: {
            type: "string",
            description: "The urgency level based on the description.",
            enum: ['Low', 'Medium', 'High', 'Critical']
        },
        reasoning: {
            type: "string",
            description: "A brief, one-sentence explanation for the selected category and priority."
        }
    },
    required: ["category", "priority", "reasoning" , "title","description"],
};

/**
 * Analyzes report text to predict category and priority using an LLM.
 * @param {string} title - The report title.
 * @param {string} description - The detailed report description.
 * @returns {object} The structured JSON output containing category, priority, and reasoning.
 */
exports.analyzeReportText = async (title, description) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new ApiError('GEMINI_API_KEY is not configured.', 500);
    }

    // Construct the user prompt
    const userPrompt = `Analyze the following civic report details and classify them into the best matching category and assign a priority level. 
        Title: "${title}"
        Description: "${description}"
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Fast model suitable for classification
            contents: userPrompt,
            config: {
                // Enforce JSON output format
                responseMimeType: "application/json",
                // Guide the model on the output structure
                responseSchema: categorizationSchema,
                // Define the system instructions for better performance
                systemInstruction: "You are an expert Civic Analyst. Your task is to accurately classify city reports based on the provided raw title and description and output the result in the requested JSON format strictly.",
            },
        });

        // The response text is guaranteed to be a valid JSON string matching the schema
        const analysisResult = JSON.parse(response.text);

        // Basic validation against enums in the schema (though Gemini is usually compliant)
        if (!analysisResult.category || !analysisResult.priority) {
            throw new Error("LLM returned incomplete data.");
        }

        return analysisResult;

    } catch (error) {
        console.error("AI Categorization Failed:", error.message);
        // Throw a specific error or fall back gracefully
        throw new ApiError('Failed to run AI analysis for categorization.', 500);
    }
};