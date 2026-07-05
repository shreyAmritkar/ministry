// services/aiService.js
//
// Thin integration point used by workers/report.worker.js. Delegates the
// actual LLM call to the configured AI provider (see services/ai/) so this
// file never needs to know which vendor is behind it.

const { getAIProvider } = require('./ai');

/**
 * Analyzes report text to predict category and priority using an LLM.
 * @param {string} title - The report title.
 * @param {string} description - The detailed report description.
 * @returns {Promise<object>} Structured output containing category, priority, and reasoning.
 */
exports.analyzeReportText = async (title, description) => {
    const provider = getAIProvider();
    return provider.analyzeReportText(title, description);
};
