# Creating Tools for the MCP Server

This directory contains all the tools used by the MCP server. Each tool is a self-contained module that exports a tool definition object.

## Tool Implementation Principles & Conventions

To ensure clarity, maintainability, and consistency, all tools must follow these conventions:

### LLM and API Usage Guidelines (MANDATORY)
- **Always use the LLM client (`getLLMClient`) for all LLM completions** (e.g., Claude, Perplexity, GPT-4) that require robust, high-quality outputs. This ensures consistency and proper model routing.
- **Use the API helper (`apiRequest`)** for direct REST API calls or data service requests that are NOT LLM completions.
- **Use the quickLLM helpers (`quickLLM`, `quickLLMBool`, `quickLLMJSON`) ONLY for fast, lightweight, or decision-making calls** (e.g., simple boolean checks, schema validation, or quick parsing)—never for deep research, analysis, or content generation.

> These points are required for all tool creation and code review. Any LLM-powered research or content generation must use the LLM client abstraction, not direct API requests or quickLLM helpers.

### 1. **Imports at the Top**
Always place all `import` statements at the very top of the file.

### 2. **File-Level Comments**
Immediately after imports, include a comment block explaining the theory, concept, and purpose of the tool. This should help future contributors understand why the tool exists and how it fits into the workflow.

### 3. **Name, Description, and Required Keys**
Define the tool's `name` and `description` as `const` values directly after the file-level comments. Also define a `REQUIRED_KEYS` array containing all required `.env` variable names (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

### 4. **Prompt and LLM Settings as Constants**
Define the LLM prompt and settings (such as model, temperature, etc.) as top-level constants. **Always add comments to settings objects explaining each option and its default value.**

### 5. **Parameter Schema with Conceptual Comments**
Define the tool's parameters using a Zod schema. Above the schema, add a comment block explaining each parameter conceptually.

### 6. **Minimal, LLM-Driven Implementation**
The implementation should:
- Validate parameters with Zod
- Prepare the LLM input and compose the prompt
- Use only generic helpers from utils (e.g., `callLLM`)
- Return results in a clear, structured format
- **Never use hard-coded heuristics or mock data in production code**

### 7. **Export Using `createTool`**
Export the tool using the `createTool` helper from utils. Pass `name`, `description`, `parameters`, `handler`, and `keys` as appropriate.

### 8. **Utils Directory: Only Generic Helpers**
Utils files (e.g., `tool-utils.js`) must only contain generic, reusable helpers. Never put tool-specific logic, prompts, or formatting in utils.

### 9. **Required Keys: .env Variable Names**
The `keys` property for each tool must be an array of the exact `.env` variable names required for the tool to run (e.g., `['OPENAI_API_KEY']`).

## Tool Structure

A tool is a JavaScript module that exports an object with the following properties:

```javascript
export default {
  name: 'tool_name',
  description: 'Description of what the tool does',
  parameters: {
    // Zod schema for parameters
  },
  handler: async (params, context) => {
    // Implementation of the tool
    return result;
  }
};
```

## Tool Properties

- **name**: The name of the tool, used to identify it in the MCP server. Use snake_case.
- **description**: A human-readable description of what the tool does.
- **parameters**: A Zod schema that defines the parameters the tool accepts.
- **handler**: An async function that implements the tool's functionality.

## Handler Context

The handler function receives a context object with the following properties:

- **debug**: Boolean indicating whether debug mode is enabled.
- **mockMode**: Boolean indicating whether mock mode is enabled.
- **getMockData**: Function to get mock data for testing.
- **server**: Reference to the MCP server instance.

## Helper Functions

### API Utilities

The `tool-utils.js` file provides several helper functions for making API requests:

```javascript
import { apiRequest, apiRequest } from './tool-utils.js';

// Make an API request with authentication
const result = await apiRequest({
  url: 'https://api.example.com/endpoint',
  method: 'POST',
  data: { key: 'value' },
  apiKey: process.env.API_KEY,
  headers: { 'Custom-Header': 'value' }
});

// Create a configured HTTP client with retry logic
const client = apiRequest({
  prefixUrl: 'https://api.example.com',
  timeout: 30000,
  retry: 3
});
```

### LLM Utilities

For interacting with language models, use the LLM utilities:

```javascript
import { callLLM, formatPrompt } from './tool-utils.js';

// Call a language model with a prompt
const response = await callLLM({
  model: 'claude-3-opus-20240229',
  prompt: 'Generate ideas for an article about climate change',
  temperature: 0.7,
  maxTokens: 1000,
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Format a prompt with variables
const prompt = formatPrompt(
  'Write an article about {topic} in a {style} style',
  { topic: 'artificial intelligence', style: 'conversational' }
);
```

### Session Management

For tools that need to maintain state between calls:

```javascript
import { getSession, saveSession } from './tool-utils.js';

// Get the current session
const session = await getSession(sessionId);

// Update and save the session
session.data.articleOutline = outline;
await saveSession(session);
```

## Example Tool

Here's an example of a simple tool that generates a greeting:

```javascript
import { z } from 'zod';

export default {
  name: 'greet',
  description: 'Generate a greeting for a person',
  parameters: z.object({
    name: z.string().describe('The name of the person to greet'),
    language: z.enum(['en', 'es', 'fr']).default('en').describe('The language to use')
  }),
  handler: async (params, context) => {
    const { name, language } = params;

    // Use mock data in mock mode
    if (context.mockMode) {
      return context.getMockData('greet', { name, language });
    }

    // Log debug information
    if (context.debug) {
      console.log(`Generating greeting for ${name} in ${language}`);
    }

    // Generate greeting based on language
    let greeting;
    switch (language) {
      case 'es':
        greeting = `¡Hola, ${name}!`;
        break;
      case 'fr':
        greeting = `Bonjour, ${name}!`;
        break;
      default:
        greeting = `Hello, ${name}!`;
    }

    return { greeting };
  }
};
```

## Best Practices

1. **Validate inputs**: Always use Zod to validate inputs to ensure your tool receives the expected parameters.
2. **Handle errors gracefully**: Catch and handle errors appropriately, providing meaningful error messages.
3. **Support mock mode**: Implement mock data support for testing without external dependencies.
4. **Use debug logging**: Add debug logs to help troubleshoot issues.
5. **Keep tools focused**: Each tool should do one thing well, following the single responsibility principle.
6. **Document your tool**: Include a clear description and parameter documentation.
7. **Use async/await**: All handlers should be async functions to support asynchronous operations.
8. **Rate limiting**: Implement rate limiting for tools that make external API calls.
9. **Caching**: Consider caching results for expensive operations.
10. **Stateless design**: Tools should be stateless when possible, using the session for state management.



