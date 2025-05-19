// Centralized framework exports for MCP tools
// Each export is annotated with the tools that use it for clarity

// --- llm-utils.js ---
export {
  callLLM,              // Used in: createOutline.tool.js, draftArticle.tool.js, generateProposals.tool.js, improveReadability.tool.js
  loadKey,              // Used in: (potentially for env validation in tools)
  DEFAULT_LLM_CONFIG    // Used as the single default LLM config
} from './llm-utils.js';

// --- utils.js ---
export {
  extractYamlFrontMatter, // Used in: analyzeRequest.tool.js
  createTool,             // Used in: all tool definitions
  createHttpClient,       // Used in: (for custom API integrations)
  apiRequest              // Used in: optimizeSEO.tool.js, deepResearch.tool.js (for API calls)
} from './utils.js';

// --- tool-utils.js ---
export {
  createToolHandler       // Used in: (for tool handler wrappers)
} from './tool-utils.js';

// --- log.js ---
export {
  debugLog               // Used in: all tools for debug logging
} from './log.js';

// --- Additional utility exports (add as needed) ---
// e.g. export { wordCountMD, splitBlocksMD, blockIsProse } from './utils.js';
