/**
 * Tests for the MCP stdio interface
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { application } from '../src/application.js';

describe('MCP Stdio Interface', () => {
  let serverProcess;

  // Utility to start the stdio MCP server
  function startServer(customEnv = {}) {
    return spawn('node', ['src/app/mcp-stdio.js'], {
      cwd: process.cwd(),
      env: { ...process.env, ...customEnv },
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }

  // Helper to send a JSON request and receive a JSON response
  async function sendMCP(server, req) {
    return new Promise((resolve, reject) => {
      let output = '';
      
      server.stdout.on('data', (data) => {
        output += data.toString();
        
        try {
          // Check if we have a complete JSON response
          const response = JSON.parse(output);
          resolve(response);
        } catch (e) {
          // Not a complete JSON response yet, continue collecting
        }
      });
      
      server.stderr.on('data', (data) => {
        console.error(`Server stderr: ${data}`);
      });
      
      server.on('error', (err) => {
        reject(err);
      });
      
      server.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });
      
      // Send the request
      server.stdin.write(JSON.stringify(req) + '\n');
    });
  }

  beforeEach(() => {
    // Start a new server for each test
    serverProcess = startServer({ MOCK_MODE: '1' });
  });

  afterEach(() => {
    // Kill the server after each test
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should respond to the hello message', async () => {
    const response = await sendMCP(serverProcess, { hello: true });
    expect(response).toHaveProperty('hello');
    expect(response).toHaveProperty('models');
    expect(response).toHaveProperty('tools');
    expect(Array.isArray(response.tools)).toBe(true);
  });

  it('should list available tools', async () => {
    const response = await sendMCP(serverProcess, { hello: true });
    expect(response.tools.length).toBeGreaterThan(0);
    
    // Verify that all tools from the application are included
    const toolNames = application.tools.map(tool => tool.name);
    response.tools.forEach(tool => {
      expect(toolNames).toContain(tool.name);
    });
  });

  it('should execute a tool', async () => {
    const response = await sendMCP(serverProcess, {
      tool: 'create_session',
      params: { topic: 'Test Topic' }
    });
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('sessionId');
    expect(response.result).toHaveProperty('topic', 'Test Topic');
  });

  it('should return an error for invalid tool name', async () => {
    const response = await sendMCP(serverProcess, {
      tool: 'non_existent_tool',
      params: {}
    });
    
    expect(response).toHaveProperty('error');
  });

  it('should validate tool parameters', async () => {
    const response = await sendMCP(serverProcess, {
      tool: 'gather_sources',
      params: {} // Missing required 'topic' parameter
    });
    
    expect(response).toHaveProperty('error');
  });
});
