#!/usr/bin/env node
console.error('[DEBUG] mcp-stdio.js loaded (after shebang)');

// Global error handlers to surface fatal errors in test logs
process.on('uncaughtException', err => {
  console.error('[FATAL] Uncaught Exception:', err && err.stack ? err.stack : err);
  process.exit(1);
});
process.on('unhandledRejection', err => {
  console.error('[FATAL] Unhandled Rejection:', err && err.stack ? err.stack : err);
  process.exit(1);
});
/**
 * MCP Server for Article Writing (Stdio Mode)
 * 
 * Streamlined implementation using the Windsurf MCP library
 * Uses the application object from application.js
 */
import 'dotenv/config';
import { McpServer, createTool } from '../utils/mcp-base.js';
import { application } from '../application.js';


// Create MCP server instance
const server = new McpServer({
  debug: true, // Force debug logging for tests
  mockMode: true, // Force mock mode for tests
  serverName: application.config.name,
  version: application.config.version,
  vendor: application.config.vendor || 'BlogWorks.ai',
  getMockData
});

// Debug: log all tool names at startup
console.error('[DEBUG] Registering tools:', application.tools.map(t => t.name));

// Register API key validation schema
server.addApiKeyValidation(application.apiKeyValidation);

// Convert tool definitions to MCP tools with context
const mcpTools = application.tools.map(tool => {
  return createTool(
    tool.name,
    tool.description,
    tool.parameters,
    async params => {
      console.error(`[DEBUG] Invoking tool: ${tool.name} with params:`, JSON.stringify(params));
      try {
        const result = await tool.handler(params);
        console.error(`[DEBUG] Tool ${tool.name} result:`, JSON.stringify(result));
        return result;
      } catch (err) {
        console.error(`[DEBUG] Tool ${tool.name} error:`, err && err.stack ? err.stack : err);
        throw err;
      }
    }
  );
});

// Register tools
server.registerTools(mcpTools);

// Always start the server when this file is loaded (for test and production compatibility)
console.error('[DEBUG] About to start MCP server');
server.start();
console.error('[DEBUG] MCP server started (this line should not print if start() blocks as expected)');

// No exports to maintain compatibility with the windsurf mcpServer library
