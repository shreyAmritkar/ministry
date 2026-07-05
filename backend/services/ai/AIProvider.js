// services/ai/AIProvider.js
//
// Base contract for an LLM provider used for report categorization.
// Any provider (OpenRouter today, something else tomorrow) implements
// this shape so the rest of the app never talks to a vendor SDK directly.

class AIProvider {
    /**
     * Classify a civic report into category/priority and polish its text.
     * @param {string} title
     * @param {string} description
     * @returns {Promise<{title: string, description: string, category: string, priority: string, reasoning: string}>}
     */
    async analyzeReportText(title, description) {
        throw new Error('analyzeReportText() must be implemented by the AI provider');
    }
}

module.exports = AIProvider;
