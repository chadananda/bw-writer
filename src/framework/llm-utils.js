// LLM client utilities using llm.js
// https://github.com/themaximalist/llm.js

import { z } from 'zod';
import ky from 'ky';
import LLM from '@themaximalist/llm.js';
import { debugLog } from './log.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { LLM_CONFIGS } from './llm-configs.js';


// Default model to use when none specified
export const DEFAULT_LLM_CONFIG = 'gpt4oMini';


// Define schema for LLM config validation
const LLMConfigSchema = z.object({
  // Required fields
  provider: z.string(),
  model: z.string(),

  // Optional with defaults
  temperature: z.number().optional().default(0.7),
  max_tokens: z.number().optional().default(1000),

  // API and schema
  key: z.string().optional(),
  apiKey: z.string().optional(),
  schema: z.any().optional(),

  // Pricing information (per 1M tokens)
  price_input: z.number().optional(),
  price_output: z.number().optional(),

  // Capabilities
  tool_calls_supported: z.boolean().optional().default(false),

  // Other metadata
  description: z.string().optional(),
  context_length: z.number().optional()
}).strict();

/**
 * Validates LLM config using Zod schema
 * @param {object} config - The config object to validate
 * @returns {object} The validated and parsed config
 * @throws {Error} If validation fails
 */
export function llmConfigValidator(config) {
  return LLMConfigSchema.parse(config);
}

/** Reads API key from environment variables */
export function readKey(keyName) {
  const key = process.env[keyName];
  if (!key) debugLog(`WARNING: API key ${keyName} not found in environment variables`);
  return key || '';
}


export async function callLLM(prompt, llm = DEFAULT_LLM_CONFIG, cfg={}) {
  let { systemMessage = '', schema = null, maxTries = 3, ...rest } = cfg;

  // set up config, apiKey, schema
  const config = { ...(typeof llm === 'string' ? LLM_CONFIGS[llm || DEFAULT_LLM_CONFIG] : llm), ...rest };
  config.apiKey = config.apiKey || readKey(config.key);
  if (!config.apiKey) throw new Error(`No API key found for ${config.model}`);
  if (!schema) schema = z.object({ result: z.string() });
  config.schema = zodToJsonSchema(schema); // Convert Zod schema to JSON schema

  // set up prompt and system messages
  prompt += `\n\n Return only a valid JSON object (no extra text) matching this schema: \n\n======\n\n${JSON.stringify(config.schema)} \n\n=======\n\n`;
  const systemMessages = systemMessage.trim() ? [{ role: 'system', content: systemMessage }] : [];
  // add additional json system message here if needed
  const messages = [...systemMessages, { role: 'user', content: prompt }];

  // set up the handler depending on the provider
  let handler;
  if(config.provider==='openai')handler=openai_handler;
  else if(config.provider==='anthropic')handler=anthropic_handler;
  else if(config.provider==='perplexity')handler=perplexity_handler;
  else throw new Error(`Unsupported provider: ${config.provider}`);

  // try to get a validated response
  let lastErr, lastRes;
  for (let i = 0; i < maxTries; i++) {
    try {
      const result = await handler(messages, config);
      if (result && Object.keys(result).length > 0) {
        debugLog(`Attempt ${i + 1} succeeded with result:`, JSON.stringify(result).substring(0, 200));
        return result;
      }
      debugLog(`Attempt ${i + 1} returned empty result`);
    } catch (e) {
      lastErr = e;
      debugLog(`Attempt ${i + 1} failed:`, e.message);
    }
  }

  const errorMsg = lastErr ?
    `Failed after ${maxTries} attempts. Last error: ${lastErr.message}` :
    `Failed after ${maxTries} attempts. No valid response received.`;

  throw new Error(`${errorMsg} Last response: ${JSON.stringify(lastRes)}`);
}


/**
 * Direct OpenAI API call with JSON mode and schema support for debugging.
 * @param {string} prompt
 * @param {object} config
 * @returns {Promise<object|string>} Parsed JSON or raw string
 */
// Handler for OpenAI chat completions with JSON response support
export const openai_handler = async (messages, config) => {
  // Extract relevant parameters from config
  const { schema: parameters, apiKey, model, temperature, max_tokens } = config;
  const openai = new OpenAI({ apiKey });

  // Send chat completion request with function/tool call and JSON response format
  const response = await openai.chat.completions.create({
    model, messages, temperature, max_tokens,
    response_format: { type: 'json_object' },
    tools: [{ type: 'function', function: { name: 'extract', description: 'Extracts JSON object', parameters } }]
  });

  // Try to parse tool call arguments from the response (preferred way)
  const args = response.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (args) return JSON.parse(args);
  // Fallback: If tool call is missing, try to extract JSON from content
  return extractJson(response.choices?.[0]?.message?.content);
};

// --- Perplexity API Handler ---
// Extracts first JSON object from Perplexity API response
export async function perplexity_handler(messages, config) {
  // Setup variables and validate
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY environment variable not set');
  let { model, temperature = 0.7, max_tokens = 2048 } = config;
  messages = Array.isArray(messages) ? messages : [{ role: 'user', content: messages }];
  temperature = Math.min(Math.max(config.temperature || 0.7, 0), 1);
  max_tokens = Math.min(Math.max(parseInt(config.max_tokens || 2048), 1), 4096);

  // Make API request
  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const body = { model, messages, temperature, max_tokens, stream: false};
  const timeout = config.timeout || 30000;
  const throwHttpErrors = config.throwHttpErrors || false;
  const perplexity_url = 'https://api.perplexity.ai/chat/completions';
  const response = await ky.post(perplexity_url, {headers, json: body, timeout, throwHttpErrors})
       .catch(() => ({}));
  if (!response?.ok) return {};

  // Process response and extract content
  const data = await response.json().catch(() => null);
  if (!data?.choices?.[0]) return {};
  const content = data.choices[0]?.message?.content || data.choices[0]?.text || '';
  return extractJson(content);
}

// --- Anthropic API Handler ---
// Extracts first valid JSON from Claude's response
export const anthropic_handler = async (messages, config) => {
  const apiKey = config.apiKey || readKey(config.key);
  if (!apiKey) throw new Error('No API key');
  const { model, temperature, max_tokens } = config;
  const anthropic = new Anthropic({ apiKey });
  const r = await anthropic.messages.create({ model, messages, max_tokens, temperature }).catch(() => null);
  if (!r) return {};
  const content = r.content?.[0]?.text || r.completion || '';
  return extractJson(content);
};







// Helper function for quick LLM calls
export const quickLLM = async (prompt, model = DEFAULT_LLM_CONFIG) => {
  return callLLM(prompt, model);
};

// Helper function for boolean responses (yes/no questions)
export const quickLLMBool = async (prompt, model = DEFAULT_LLM_CONFIG) => {
  const result = await callLLM(prompt, model, {
    jsonSchema: z.object({ answer: z.boolean() })
  });
  return result.answer === true || String(result.answer).toLowerCase().includes('yes');
};

// Extracts JSON from text with markdown code block support
export function extractJson(text) {
  if (!text) return null;

  // Helper to parse and validate JSON
  const tryParse = str => {
    try {
      const result = JSON.parse(str);
      return result && typeof result === 'object' ? result : null;
    } catch { return null; }
  };

  // Try direct parse first
  const direct = tryParse(text);
  if (direct) return direct;

  // Try extracting from markdown code blocks (```json or ```)
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) {
    const parsed = tryParse(codeBlock[1]);
    if (parsed) return parsed;
  }

  // Try extracting any JSON object
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) return tryParse(jsonMatch[0]);

  return null;
}

// Helper function for JSON responses
export const quickLLMJSON = async (prompt, schema, model = DEFAULT_LLM_CONFIG) => {
  return callLLM(prompt, model, { jsonSchema: schema });
};
