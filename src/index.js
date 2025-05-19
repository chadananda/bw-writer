// Entrypoint for npm consumers. Exports the article writer, tools, and interface components.

// full article writing workflow
export { default as articleWriter } from './app/main.js';

// individual tools
export { default as generateProposals } from './app/tools/generateProposals.tool.js';
export { default as createOutline } from './app/tools/createOutline.tool.js';
export { default as deepResearch } from './app/tools/deepResearch.tool.js';
export { default as draftSection } from './app/tools/draftSection.tool.js';
export { default as embedMedia } from './app/tools/embedMedia.tool.js';
export { default as analyzeRequest } from './app/tools/analyzeRequest.tool.js';
export { default as improveReadability } from './app/tools/improveReadability.tool.js';

// framework interfaces
export { default as mcpServer } from './framework/interface/mcp-server.js';

