// LLM client utilities for MCP server tools using any-llm
// https://www.npmjs.com/package/any-llm

import { z } from 'zod';
import { Client } from 'any-llm';
import { debugLog } from './log.js';

// Error messages are now logged directly with debugLog

// Predefined LLM configurations - key is model name for easy reference
export const LLM_CONFIGS = {
  // OpenAI models
  'gpt4o': {
    provider: 'openai', model: 'gpt-4o', temperature: 0.7,
    max_tokens: 2048, key: 'OPENAI_API_KEY'
  },
  'gpt4turbo': {
    provider: 'openai', model: 'gpt-4-turbo-preview', temperature: 0.7,
    max_tokens: 2048, key: 'OPENAI_API_KEY'
  },
  // Anthropic models
  'claude3sonnet': {
    provider: 'anthropic', model: 'claude-3-5-sonnet-20240620', temperature: 0.2,
    max_tokens: 2048, key: 'ANTHROPIC_API_KEY'
  },
  'claude3opus': {
    provider: 'anthropic', model: 'claude-3-opus-20240229', temperature: 0.3,
    max_tokens: 2048, key: 'ANTHROPIC_API_KEY'
  },
  // Other providers
  'perplexity': {
    provider: 'perplexity', model: 'sonar-large-chat', temperature: 0.2,
    max_tokens: 2048, key: 'PERPLEXITY_API_KEY', apiBaseUrl: 'https://api.perplexity.ai'
  },
  'mistral': {
    provider: 'mistral', model: 'mistral-large-latest', temperature: 0.3,
    max_tokens: 2048, key: 'MISTRAL_API_KEY', apiBaseUrl: 'https://api.mistral.ai/v1'
  },
  'llama3': {
    provider: 'groq', model: 'llama3-70b-8192', temperature: 0.3,
    max_tokens: 2048, key: 'GROQ_API_KEY', apiBaseUrl: 'https://api.groq.com/openai/v1'
  },
  'commandr': {
    provider: 'cohere', model: 'command-r-plus', temperature: 0.3,
    max_tokens: 2048, key: 'COHERE_API_KEY'
  },
  'openrouter': {
    provider: 'openrouter', model: 'openai/gpt-4-turbo-preview', temperature: 0.3,
    max_tokens: 2048, key: 'OPENROUTER_API_KEY'
  }
};

// Default model to use when none specified
export const DEFAULT_LLM_CONFIG = 'gpt4o';

// Schema for LLM config validation
const LLMConfigSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  model: z.string().min(1, 'Model is required'),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  key: z.string().min(1, 'API key environment variable name is required'),
  apiBaseUrl: z.string().url().optional(),
  // Add other common LLM parameters as needed
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

// Loads a key value by name (future-proof for other sources)
export function loadAPIKey(keyName) {
  // In future, could check key vaults, files, etc.
  return process.env[keyName] || '';
}


/**
 * Extracts JSON from a string by finding the first { and last }
 * @param {string} str - The string to extract JSON from
 * @returns {string} The extracted JSON string
 */
function extractJSON(str) {
  const firstBrace = str.indexOf('{');
  const lastBrace = str.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in the response');
  }
  return str.slice(firstBrace, lastBrace + 1);
}

/**
 * Robust LLM call using any-llm. Handles env keys, config, and provider-specific logic.
 * @param {string} prompt - The user's input prompt
 * @param {string|object} [modelOrConfig='gpt4o'] - Model name (from LLM_CONFIGS) or full config object
 * @param {object} [options={}] - Additional options
 * @param {string} [options.systemMessage] - Optional system message
 * @param {z.ZodSchema} [options.jsonSchema] - Optional JSON schema for JSON mode
 * @param {number} [options.maxRetries=2] - Maximum number of retries for JSON validation
 * @returns {Promise<any>} LLM completion (parsed JSON if jsonSchema is provided, otherwise string)
 */
export async function callLLM(prompt, cfg = DEFAULT_LLM_CONFIG, options = {}) {
  const { systemMessage, jsonSchema, maxRetries = 2, ...otherOptions } = options;
  let config;
  try {
    if (typeof cfg === 'string') {
      config = LLM_CONFIGS[cfg];
      if (!config) throw new Error(`Unknown model: ${cfg}. Available models: ${Object.keys(LLM_CONFIGS).join(', ')}`);
    } else config = llmConfigValidator(cfg);
  } catch (error) { throw new Error(`LLM config validation failed: ${error.message}`); }

  // Load API key
  const apiKey = loadAPIKey(config.key);
  if (!apiKey) throw new Error(`Key not found. Please set ${config.key} in your environment.`);

  // Prepare messages
  const messages = [];
  if (systemMessage) messages.push({ role: 'system', content: systemMessage });
  // Add JSON schema to system message if provided
  if (jsonSchema) {
    messages.push({
      role: 'system',
      content: `You MUST respond with a valid JSON object that matches the following schema. Do not include any text outside the JSON: ${JSON.stringify(jsonSchema)}`
    });
  }
  messages.push({ role: 'user', content: prompt });
  debugLog(`Calling LLM (${config.provider}/${config.model}) with prompt:`, prompt);

  const client = new Client(config.provider, { [config.key]: apiKey });
  const openAICompatible = ['openai', 'anthropic', 'google', 'groq', 'mistral', 'openrouter', 'cohere'];
  const isOpenAI = openAICompatible.includes(config.provider);
  let attempts = 0, lastError;

  while (attempts <= maxRetries) {
    const request = {
      ...config,
      ...(jsonSchema && { response_format: { type: 'json_object' } }),
      ...otherOptions,
      ...(isOpenAI ? {} : { messages })
    };

    const response = await (isOpenAI
      ? client.createChatCompletionNonStreaming(request, messages)
      : client.createChatCompletionNonStreaming(request));

    if (!jsonSchema) return response;

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      debugLog('ERROR: No JSON found in response');
      attempts++;
      if (attempts > maxRetries) break;
      messages.push({ role: 'system', content: 'Please respond with valid JSON.' });
      await new Promise(r => setTimeout(r, 500 * attempts));
      continue;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const result = jsonSchema.safeParse(parsed);
      if (result.success) return result.data;
      debugLog('ERROR: JSON validation failed:', result.error.message);
      if (++attempts > maxRetries) break;
      messages.push({ role: 'system', content: `JSON validation failed: ${result.error.message}. Please correct.` });
    } catch (e) {
      debugLog('ERROR: Failed to parse JSON:', e.message);
      if (++attempts > maxRetries) break;
      messages.push({ role: 'system', content: 'Invalid JSON format. Please respond with valid JSON.' });
    }
    await new Promise(r => setTimeout(r, 500 * attempts));
  }

  debugLog('ERROR: LLM call failed after max retries');
  return null;
}


// wrap an llm call in a helper function for quick calls
export const quickLLM = async (prompt, model = DEFAULT_LLM_CONFIG) => {
  return callLLM(prompt, model);
}

// now for one that does JSON to answer yes or no questions as boolean
export const quickLLMBool = async (prompt, model = DEFAULT_LLM_CONFIG) => {
  // should return answer as yes or no and we translate that into a boolean
  const result = await callLLM(prompt, model, { jsonSchema: z.object({ answer: z.boolean() }) });
  // regex to see if contains yes, case insensitive
  return result.answer.match(/yes/i) !== null;
};

// now for one that returns a json object
export const quickLLMJSON = async (prompt, schema, model = DEFAULT_LLM_CONFIG) => {
  return callLLM(prompt, model, { jsonSchema: schema });
};


