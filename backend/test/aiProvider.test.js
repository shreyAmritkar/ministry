// test/aiProvider.test.js
//
// Tests for the OpenRouter AI provider abstraction. No real network calls
// are made — the OpenAI SDK client's chat.completions.create method is
// stubbed so these run offline and deterministically.

const OpenRouterProvider = require('../services/ai/providers/OpenRouterProvider');
const { validateAnalysisResult } = require('../services/ai/categorizationSchema');

describe('OpenRouterProvider', () => {
    test('throws if no API key is configured', () => {
        expect(() => new OpenRouterProvider({ apiKey: undefined }))
            .toThrow('OPENROUTER_API_KEY is not configured.');
    });

    test('defaults model when not provided', () => {
        const provider = new OpenRouterProvider({ apiKey: 'test-key' });
        expect(provider.model).toBe('openai/gpt-4o-mini');
    });

    test('respects a custom model from config', () => {
        const provider = new OpenRouterProvider({ apiKey: 'test-key', model: 'anthropic/claude-3-haiku' });
        expect(provider.model).toBe('anthropic/claude-3-haiku');
    });

    test('analyzeReportText parses and validates a well-formed LLM response', async () => {
        const provider = new OpenRouterProvider({ apiKey: 'test-key' });

        const fakeResponse = {
            title: 'Pothole on Main Street',
            description: 'A large pothole is causing traffic hazards near the Main Street intersection.',
            category: 'Road_Damage',
            priority: 'High',
            reasoning: 'Large pothole poses an immediate safety risk to vehicles.',
        };

        // Stub the SDK call - no network involved.
        provider.client.chat.completions.create = jest.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(fakeResponse) } }],
        });

        const result = await provider.analyzeReportText('pothole', 'big hole in the road');
        expect(result).toEqual(fakeResponse);
        expect(provider.client.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    test('throws an ApiError when the LLM returns an invalid category', async () => {
        const provider = new OpenRouterProvider({ apiKey: 'test-key' });

        provider.client.chat.completions.create = jest.fn().mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        title: 'x', description: 'y', category: 'Not_A_Real_Category', priority: 'High', reasoning: 'z',
                    }),
                },
            }],
        });

        await expect(provider.analyzeReportText('title', 'description'))
            .rejects.toThrow('Failed to run AI analysis for categorization.');
    });
});

describe('validateAnalysisResult', () => {
    test('rejects a response missing required fields', () => {
        expect(() => validateAnalysisResult({
            title: 'x', description: 'y', category: 'Road_Damage', priority: 'High',
        })).toThrow('missing required field: reasoning');
    });

    test('rejects an out-of-enum priority', () => {
        expect(() => validateAnalysisResult({
            title: 'x', description: 'y', category: 'Road_Damage', priority: 'Extreme', reasoning: 'z',
        })).toThrow('invalid priority');
    });
});
