import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'src', 'app', 'mcp-stdio.js');

// Utility to start the stdio MCP server with custom env
function startServer(customEnv = {}) {
  return spawn('node', [serverPath, '--mock'], {
    cwd: process.cwd(),
    env: { ...process.env, ...customEnv },
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

// Helper to send a JSON request and receive a JSON response
async function sendMCP(server, req) {
  return new Promise((resolve, reject) => {
    let output = '';
    const onData = (data) => {
      output += data.toString();
      // MCP server responds 1 line per request
      if (output.includes('\n')) {
        server.stdout.off('data', onData);
        try {
          const resp = JSON.parse(output.trim());
          resolve(resp);
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + output));
        }
      }
    };
    
    server.stdout.on('data', onData);
    server.stdin.write(JSON.stringify(req) + '\n');
  });
}

describe('MCP Server with Official SDK', () => {
  let serverProcess = null;

  beforeAll(() => {
    // Start the server in mock mode
    serverProcess = startServer({ MOCK_MODE: 'true' });
    
    // Log any stderr output for debugging
    serverProcess.stderr.on('data', (data) => {
      console.error(`[SERVER]: ${data.toString().trim()}`);
    });
    
    // Give the server time to start
    return new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(() => {
    // Shut down the server
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should respond to initialize request', async () => {
    const response = await sendMCP(serverProcess, {
      jsonrpc: '2.0',
      id: '1',
      method: 'initialize'
    });
    
    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', '1');
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('name', 'bw-writer');
    expect(response.result).toHaveProperty('version');
    expect(response.result).toHaveProperty('vendor', 'BlogWorks.ai');
  });

  it('should list available tools', async () => {
    const response = await sendMCP(serverProcess, {
      jsonrpc: '2.0',
      id: '2',
      method: 'tools/list'
    });
    
    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', '2');
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('tools');
    expect(response.result.tools).toBeInstanceOf(Array);
    expect(response.result.tools.length).toBeGreaterThan(0);
    
    // Verify that all expected tools are present
    const toolNames = response.result.tools.map(tool => tool.name);
    expect(toolNames).toContain('create_session');
    expect(toolNames).toContain('gather_sources');
    expect(toolNames).toContain('generate_angles');
    expect(toolNames).toContain('create_outline');
    expect(toolNames).toContain('draft_section');
    expect(toolNames).toContain('improve_readability');
    expect(toolNames).toContain('embed_media');
  });

  it('should execute create_session tool (JSON-RPC)', async () => {
    const response = await sendMCP(serverProcess, {
      jsonrpc: '2.0',
      id: '3',
      method: 'tools/execute',
      params: {
        name: 'create_session',
        parameters: {
          topic: 'Artificial Intelligence in Healthcare',
          style: 'academic'
        }
      }
    });
    
    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', '3');
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('sessionId');
  });

  it('should execute gather_sources tool (standard MCP format)', async () => {
    const response = await sendMCP(serverProcess, {
      name: 'gather_sources',
      parameters: {
        sessionId: 'mock-session-id',
        count: 3
      }
    });
    
    expect(response).toHaveProperty('protocolVersion', '1.0');
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('sources');
    expect(response.result.sources).toBeInstanceOf(Array);
  });

  it('should handle errors correctly', async () => {
    const response = await sendMCP(serverProcess, {
      jsonrpc: '2.0',
      id: '4',
      method: 'tools/execute',
      params: {
        name: 'create_session',
        parameters: {
          // Missing required 'topic' parameter
          style: 'academic'
        }
      }
    });
    
    expect(response).toHaveProperty('jsonrpc', '2.0');
    expect(response).toHaveProperty('id', '4');
    expect(response).toHaveProperty('error');
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
  });
});
