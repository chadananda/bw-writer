import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { callLLM } from '../src/framework/llm-utils.js';
import { z } from 'zod';

// Skip tests if no API keys are set
const hasRequiredKeys = {
  openai: !!process.env.OPENAI_API_KEY,
  anthropic: !!process.env.ANTHROPIC_API_KEY,
  perplexity: !!process.env.PERPLEXITY_API_KEY
};

// Test cases for different data types
const testCases = [
  { 
    name: 'string', 
    prompt: 'Return a JSON object with a single string field', 
    schema: z.object({ value: z.string() }),
    expected: { value: 'foobar' }
  },
  { 
    name: 'number', 
    prompt: 'Return a JSON object with a single number field', 
    schema: z.object({ num: z.number() }),
    expected: { num: 123 }
  },
  { 
    name: 'boolean', 
    prompt: 'Return a JSON object with a single boolean field', 
    schema: z.object({ ok: z.boolean() }),
    expected: { ok: true }
  },
  { 
    name: 'array', 
    prompt: 'Return a JSON object with an array of numbers', 
    schema: z.object({ arr: z.array(z.number()) }),
    expected: { arr: [1, 2, 3] }
  },
  { 
    name: 'nested', 
    prompt: 'Return a JSON object with a nested object', 
    schema: z.object({ foo: z.object({ bar: z.number() }) }),
    expected: { foo: { bar: 42 } }
  },
  { 
    name: 'mixed', 
    prompt: 'Return a JSON object with string, number, and boolean fields', 
    schema: z.object({ a: z.string(), b: z.number(), c: z.boolean() }),
    expected: { a: 'x', b: 2, c: false }
  }
];

// Test runner for each provider
const testProvider = (providerName, modelKey) => {
  const providerKey = providerName.toLowerCase();
  if (!hasRequiredKeys[providerKey]) {
    describe.skip(`${providerName} (no API key)`, () => it('skipped - no API key', () => {}));
    return;
  }

  describe(providerName, () => {
    // Basic data type tests
    testCases.forEach(({ name, prompt, schema, expected }) => {
      it(`should handle ${name}`, async () => {
        console.log(`\n=== TESTING ${providerName} - ${name} ===`);
        const fullPrompt = `${prompt} like this: ${JSON.stringify(expected)}`;
        const result = await callLLM(fullPrompt, modelKey, { 
          schema, temperature: 0.3, max_tokens: 500 
        });
        console.log('API Response:', JSON.stringify(result, null, 2));
        expect(schema.safeParse(result).success).toBe(true);
      });
    });

    // Long text response test - skip for Perplexity as it has issues with long structured responses
    if (providerKey !== 'perplexity') {
      it('should handle long text responses', async () => {
        const prompt = `Provide a detailed analysis (3-5 paragraphs) about the impact of artificial 
          intelligence on modern society, including key benefits and challenges.`;
        
        const schema = z.object({
          analysis: z.string().min(500),
          benefits: z.array(z.string()).min(3),
          challenges: z.array(z.string()).min(3)
        });

        console.log(`\n=== TESTING ${providerName} - Long Text ===`);
        const result = await callLLM(prompt, modelKey, { 
          schema, temperature: 0.5, max_tokens: 1000 
        });
        
        console.log(`Received ${result.analysis.length} characters of analysis`);
        console.log(`Benefits: ${result.benefits.length}, Challenges: ${result.challenges.length}`);
        
        expect(result.analysis.length).toBeGreaterThan(500);
        expect(result.benefits.length).toBeGreaterThanOrEqual(3);
        expect(result.challenges.length).toBeGreaterThanOrEqual(3);
      }, 60000); // 60 second timeout
    } else {
      // Perplexity works better with simpler, more direct prompts
      it('should handle basic text response', async () => {
        const prompt = `In one sentence, describe artificial intelligence.`;
        const schema = z.object({
          response: z.string()
        });

        console.log(`\n=== TESTING ${providerName} - Basic Text ===`);
        const result = await callLLM(prompt, modelKey, {
          schema, temperature: 0.3, max_tokens: 100
        });

        console.log(`Received response: ${result.response}`);
        expect(result.response.length).toBeGreaterThan(10);
      }, 10000); // 10 second timeout
    }
  });
};

// Main test suite
describe('LLM Utils', () => {
  // Test all providers with their default models
  testProvider('OpenAI', 'gpt4oMini');
  testProvider('Anthropic', 'claude3sonnet');
  testProvider('Perplexity', 'ppxsonarlarge');
});
