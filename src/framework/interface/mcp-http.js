#!/usr/bin/env node
/**
 * MCP Server for Article Writing (HTTP Mode)
 * 
 * HTTP implementation of the MCP protocol
 * Uses the application object from application.js
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createTool } from '../utils/mcp-base.js';
import { application } from '../application.js';
import { getMockData } from '../../test/mocks/mock_data.js';

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Convert tool definitions to MCP tools with context
const mcpTools = application.tools.reduce((acc, tool) => {
  acc[tool.name] = (params) => tool.handler(params, { 
    debug: application.config.debug, 
    mockMode: application.config.mock, 
    getMockData
  });
  return acc;
}, {});

// Create route for tool invocation
app.post('/api/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const params = req.body;
  
  if (!mcpTools[toolName]) {
    return res.status(404).json({ error: `Tool ${toolName} not found` });
  }
  
  try {
    const result = await mcpTools[toolName](params);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create route for listing available tools
app.get('/api/tools', (req, res) => {
  const tools = application.tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
  
  res.json(tools);
});

// Create route for application metadata
app.get('/api/metadata', (req, res) => {
  res.json({
    name: application.config.name,
    description: application.config.description,
    vendor: application.config.vendor,
    version: application.config.version
  });
});

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(port);
}

// No exports to maintain compatibility with the windsurf mcpServer library
