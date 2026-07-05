// services/ai/index.js
//
// Factory for the active AI provider. This is the one place that knows
// OpenRouter is the current backend — everything else in the app depends
// only on the AIProvider contract, so swapping providers later means
// adding a new class under providers/ and changing the two lines below.

const OpenRouterProvider = require('./providers/OpenRouterProvider');

let cachedProvider = null;

function getAIProvider() {
    if (!cachedProvider) {
        cachedProvider = new OpenRouterProvider({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: process.env.OPENROUTER_BASE_URL,
            model: process.env.OPENROUTER_MODEL,
        });
    }
    return cachedProvider;
}

module.exports = { getAIProvider };
