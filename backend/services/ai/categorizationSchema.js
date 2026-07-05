// services/ai/categorizationSchema.js
//
// Provider-agnostic definition of what report categorization must return.
// Kept separate from any single provider so swapping providers never
// requires redefining the contract.

const CATEGORY_VALUES = [
    'Road_Damage',
    'Garbage_Collection',
    'Street_Lighting',
    'Water_Supply',
    'Drainage',
    'Illegal_Construction',
    'Public_Property_Damage',
    'Other',
];

const PRIORITY_VALUES = ['Low', 'Medium', 'High', 'Critical'];

const REQUIRED_FIELDS = ['title', 'description', 'category', 'priority', 'reasoning'];

const SYSTEM_INSTRUCTION =
    'You are an expert Civic Analyst. Classify city reports based on the raw title and ' +
    'description provided, then reply with ONLY a JSON object (no markdown, no commentary) ' +
    'containing exactly these fields: ' +
    '"title" (a polished, professional version of the title), ' +
    '"description" (a polished, professional version of the description), ' +
    `"category" (one of: ${CATEGORY_VALUES.join(', ')}), ` +
    `"priority" (one of: ${PRIORITY_VALUES.join(', ')}), ` +
    '"reasoning" (a one-sentence explanation for the chosen category and priority).';

function buildUserPrompt(title, description) {
    return (
        'Analyze the following civic report details and classify them:\n' +
        `Title: "${title}"\n` +
        `Description: "${description}"`
    );
}

/**
 * Validates a parsed LLM response against the categorization contract.
 * Throws if the response is missing required fields or uses an out-of-enum value.
 */
function validateAnalysisResult(result) {
    for (const field of REQUIRED_FIELDS) {
        if (!result || !result[field]) {
            throw new Error(`LLM response missing required field: ${field}`);
        }
    }
    if (!CATEGORY_VALUES.includes(result.category)) {
        throw new Error(`LLM returned an invalid category: ${result.category}`);
    }
    if (!PRIORITY_VALUES.includes(result.priority)) {
        throw new Error(`LLM returned an invalid priority: ${result.priority}`);
    }
    return result;
}

module.exports = {
    CATEGORY_VALUES,
    PRIORITY_VALUES,
    REQUIRED_FIELDS,
    SYSTEM_INSTRUCTION,
    buildUserPrompt,
    validateAnalysisResult,
};
