// services/ai/providers/OpenRouterProvider.js
//
// Concrete AIProvider backed by OpenRouter's OpenAI-compatible /chat/completions
// endpoint. Uses the official `openai` SDK pointed at OpenRouter's base URL —
// OpenRouter is a drop-in replacement for the OpenAI API surface.

const OpenAI = require('openai');
const AIProvider = require('../AIProvider');
const ApiError = require('../../../utils/ApiError');
const {
    SYSTEM_INSTRUCTION,
    buildUserPrompt,
    validateAnalysisResult,
} = require('../categorizationSchema');

class OpenRouterProvider extends AIProvider {
    constructor({ apiKey, baseURL, model } = {}) {
        super();

        if (!apiKey) {
            throw new ApiError('OPENROUTER_API_KEY is not configured.', 500);
        }

        this.model = model || 'openai/gpt-4o-mini';
        this.client = new OpenAI({
            apiKey,
            baseURL: baseURL || 'https://openrouter.ai/api/v1',
        });
    }

    async analyzeReportText(title, description) {
        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: SYSTEM_INSTRUCTION },
                    { role: 'user', content: buildUserPrompt(title, description) },
                ],
            });

            const raw = completion.choices?.[0]?.message?.content;
            if (!raw) {
                throw new Error('Empty response from OpenRouter.');
            }

            const analysisResult = JSON.parse(raw);
            return validateAnalysisResult(analysisResult);
        } catch (error) {
            console.error('AI Categorization Failed:', error.message);
            throw new ApiError('Failed to run AI analysis for categorization.', 500);
        }
    }
}

module.exports = OpenRouterProvider;
