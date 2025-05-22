export const LLM_CONFIGS = {
  // ==== OpenAI ====
  gpt4o: {
    provider: 'openai', model: 'gpt-4o', key: 'OPENAI_API_KEY',
    temperature: 0.7, max_tokens: 2048,
    price_input: 5.00, price_output: 15.00,
    tool_calls_supported: true
  },
  gpt4turbo: {
    provider: 'openai', model: 'gpt-4-turbo', key: 'OPENAI_API_KEY',
    temperature: 0.7, max_tokens: 2048,
    price_input: 10.00, price_output: 30.00,
    tool_calls_supported: true
  },
  gpt4oMini: {
    provider: 'openai', model: 'gpt-4o-mini', key: 'OPENAI_API_KEY',
    temperature: 0.7, max_tokens: 2048,
    price_input: 1.00, price_output: 3.00,
    tool_calls_supported: true
  },
  gpt35turbo: {
    provider: 'openai', model: 'gpt-3.5-turbo-0125', key: 'OPENAI_API_KEY',
    temperature: 0.7, max_tokens: 2048,
    price_input: 0.50, price_output: 1.50,
    tool_calls_supported: true
  },

  // ==== Anthropic ====
  claude3opus: {
    provider: 'anthropic', model: 'claude-3-opus-20240229', key: 'ANTHROPIC_API_KEY',
    temperature: 0.3, max_tokens: 2048,
    price_input: 15.00, price_output: 75.00,
    tool_calls_supported: true
  },
  claude3sonnet: {
    provider: 'anthropic', model: 'claude-3-5-sonnet-20240620', key: 'ANTHROPIC_API_KEY',
    temperature: 0.2, max_tokens: 2048,
    price_input: 3.00, price_output: 15.00,
    tool_calls_supported: true
  },
  claude3haiku: {
    provider: 'anthropic', model: 'claude-3-haiku-20240307', key: 'ANTHROPIC_API_KEY',
    temperature: 0.2, max_tokens: 2048,
    price_input: 0.25, price_output: 1.25,
    tool_calls_supported: true
  },
  claude2: {
    provider: 'anthropic', model: 'claude-2.1', key: 'ANTHROPIC_API_KEY',
    temperature: 0.2, max_tokens: 2048,
    price_input: 0.80, price_output: 2.40,
    tool_calls_supported: false
  },

  // ==== Google Gemini ====
  gemini15pro: {
    provider: 'google', model: 'gemini-1.5-pro-latest', key: 'GOOGLE_API_KEY',
    temperature: 0.7, max_tokens: 2048,
    price_input: 7.00, price_output: 21.00,
    tool_calls_supported: true
  },
  gemini15flash: {
    provider: 'google', model: 'gemini-1.5-flash-latest', key: 'GOOGLE_API_KEY',
    temperature: 0.7, max_tokens: 2048,
    price_input: 0.35, price_output: 1.05,
    tool_calls_supported: true
  },
  gemini10pro: {
    provider: 'google', model: 'gemini-1.0-pro', key: 'GOOGLE_API_KEY',
    temperature: 0.7, max_tokens: 2048,
    price_input: 0.50, price_output: 1.50,
    tool_calls_supported: false
  },

  // ==== Perplexity ====
  ppxsonarlarge: {
    provider: 'perplexity', model: 'llama-3.1-sonar-large-128k-online',
    key: 'PERPLEXITY_API_KEY', temperature: 0.2,
    max_tokens: 2048, price_input: 0.60,
    price_output: 2.00, tool_calls_supported: false,
    json_output_supported: true
  },
  ppxsonarsmall: {
    provider: 'perplexity', model: 'llama-3.1-sonar-small-128k-online',
    key: 'PERPLEXITY_API_KEY', temperature: 0.2,
    max_tokens: 2048, price_input: 0.20,
    price_output: 0.80, tool_calls_supported: false,
    json_output_supported: true
  },
  ppxsonarlargechat: {
    provider: 'perplexity', model: 'llama-3.1-sonar-large-128k-chat',
    key: 'PERPLEXITY_API_KEY', temperature: 0.2,
    max_tokens: 2048, price_input: 0.60,
    price_output: 2.00, tool_calls_supported: false,
    json_output_supported: true
  },
  ppxsonarsmallchat: {
    provider: 'perplexity', model: 'llama-3.1-sonar-small-128k-chat',
    key: 'PERPLEXITY_API_KEY', temperature: 0.2,
    max_tokens: 2048, price_input: 0.20,
    price_output: 0.80, tool_calls_supported: false,
    json_output_supported: true
  },


  // ==== Mistral ====
  mistrallarge: {
    provider: 'mistral', model: 'mistral-large-latest', key: 'MISTRAL_API_KEY',
    temperature: 0.3, max_tokens: 2048,
    price_input: 2.00, price_output: 8.00,
    tool_calls_supported: false
  },
  mistralmedium: {
    provider: 'mistral', model: 'mistral-medium-latest', key: 'MISTRAL_API_KEY',
    temperature: 0.3, max_tokens: 2048,
    price_input: 0.70, price_output: 2.80,
    tool_calls_supported: false
  },
  mistralsmall: {
    provider: 'mistral', model: 'mistral-small-latest', key: 'MISTRAL_API_KEY',
    temperature: 0.3, max_tokens: 2048,
    price_input: 0.15, price_output: 0.60,
    tool_calls_supported: false
  },

  // ==== Meta Llama ====
  llama3: {
    provider: 'groq', model: 'llama3-70b-8192', key: 'GROQ_API_KEY',
    temperature: 0.3, max_tokens: 2048,
    price_input: 0.50, price_output: 0.50,
    tool_calls_supported: false
  },
  llama3_8b: {
    provider: 'groq', model: 'llama3-8b-8192', key: 'GROQ_API_KEY',
    temperature: 0.3, max_tokens: 2048,
    price_input: 0.10, price_output: 0.10,
    tool_calls_supported: false
  },

  // ==== Cohere ====
  commandrplus: {
    provider: 'cohere', model: 'command-r-plus', key: 'COHERE_API_KEY',
    temperature: 0.3, max_tokens: 2048,
    price_input: 3.00, price_output: 15.00,
    tool_calls_supported: true
  },
  commandr: {
    provider: 'cohere', model: 'command-r', key: 'COHERE_API_KEY',
    temperature: 0.3, max_tokens: 2048,
    price_input: 0.50, price_output: 1.50,
    tool_calls_supported: true
  },

  // ==== OpenRouter (proxy for OpenAI) ====
  openroutergpt4o: {
    provider: 'openrouter', model: 'openai/gpt-4o', key: 'OPENROUTER_API_KEY',
    temperature: 0.3, max_tokens: 2048,
    price_input: 5.00, price_output: 15.00,
    tool_calls_supported: true
  },
  openroutergpt35: {
    provider: 'openrouter', model: 'openai/gpt-3.5-turbo', key: 'OPENROUTER_API_KEY',
    temperature: 0.3, max_tokens: 2048,
    price_input: 0.50, price_output: 1.50,
    tool_calls_supported: true
  }
 }
