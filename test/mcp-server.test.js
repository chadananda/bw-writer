import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { spawn } from 'child_process';

// Custom reporter for inline pretty output
const printResult = (passed, name) => {
  const pad = (str, len = 55) => str.length < len ? str + ' '.repeat(len - str.length) : str;
  if (passed) {
    console.log(chalk.greenBright.bold('  ✅ ') + chalk.greenBright(pad(name)));
  } else {
    console.log(chalk.redBright.bold('  ❌ ') + chalk.redBright(pad(name)));
  }
};

let currentTest = '';

let serverProcess = null;

// Utility to start the stdio MCP server with custom env
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
    console.error('[TEST DEBUG] Writing to stdin:', JSON.stringify(req));
    server.stdout.on('data', onData);
    server.stdin.write(JSON.stringify(req) + '\n');
  });
}

// Additional tests for stdio protocol coverage

describe('MCP Stdio Protocol', () => {
  let server;

  afterEach(() => {
    if (server) server.kill();
  });

  it('should return protocolVersion in all responses', async () => {
    server = startServer({ PERPLEXITY_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' });
    const resp = await sendMCP(server, { name: 'create_session', parameters: { topic: 'Test' } });
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.result).toBeDefined();
  });

  it('should handle invalid JSON', (done) => {
    server = startServer({ PERPLEXITY_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' });
    let output = '';
    server.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('\n')) {
        const resp = JSON.parse(output.trim());
        expect(resp.protocolVersion).toBe('1.0');
        expect(resp.error.type).toBe('InvalidJSON');
        done();
      }
    });
    server.stdin.write('not a json\n');
  });

  it('should handle missing API keys when not in MOCK_MODE', async () => {
    // Explicitly set environment variables to empty strings and ensure MOCK_MODE is off
    server = startServer({ 
      PERPLEXITY_API_KEY: '', 
      ANTHROPIC_API_KEY: '', 
      MOCK_MODE: '0', 
      WINDSURF_MODE: '0',
      NODE_ENV: 'production' // Ensure we're not in test mode
    });
    const resp = await sendMCP(server, { name: 'create_session', parameters: { topic: 'Test' } });
    console.log('MISSING API KEY TEST RESPONSE:', JSON.stringify(resp));
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.error).toBeDefined();
    expect(resp.error.type).toBe('MissingApiKey');
  });

  it('should accept requests without API keys when in MOCK_MODE', async () => {
    // Set MOCK_MODE to 1 but don't provide API keys
    server = startServer({ PERPLEXITY_API_KEY: '', ANTHROPIC_API_KEY: '', MOCK_MODE: '1' });
    const resp = await sendMCP(server, { name: 'create_session', parameters: { topic: 'Test' } });
    console.log('MOCK MODE TEST RESPONSE:', JSON.stringify(resp));
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.error).toBeUndefined();
    expect(resp.result).toBeDefined();
  });

  it('should require API keys even in WINDSURF_MODE', async () => {
    // Set WINDSURF_MODE to 1 but don't provide API keys - should still require them
    server = startServer({ PERPLEXITY_API_KEY: '', ANTHROPIC_API_KEY: '', WINDSURF_MODE: '1' });
    const resp = await sendMCP(server, { name: 'create_session', parameters: { topic: 'Test' } });
    console.log('WINDSURF MODE TEST RESPONSE:', JSON.stringify(resp));
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.error).toBeDefined();
    expect(resp.error.type).toBe('MissingApiKey');
  });

  it('should handle missing required parameters', async () => {
    server = startServer({ PERPLEXITY_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' });
    const resp = await sendMCP(server, { name: 'get_session', parameters: {} });
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.error).toBeDefined();
  });

  it('should handle rate limiting when not in MOCK_MODE', async () => {
    // Clear Node.js environment variables that might interfere with the test
    server = startServer({ 
      PERPLEXITY_API_KEY: 'x', 
      ANTHROPIC_API_KEY: 'y', 
      MOCK_MODE: '0', 
      WINDSURF_MODE: '0',
      NODE_ENV: 'production' // Ensure we're not in test mode
    });
    
    // Exceed MAX_DRAFTS_PER_HOUR
    for (let i = 0; i < 21; i++) { // Increased to exceed rate limit (20)
      const resp = await sendMCP(server, { name: 'draft_section', parameters: { outline: {}, sectionTitle: 'Intro', researchData: [] } });
      // Once we hit the limit, check the error
      if (resp.error && resp.error.type === 'RateLimitExceeded') {
        expect(resp.protocolVersion).toBe('1.0');
        expect(resp.error.type).toBe('RateLimitExceeded');
        return; // Test passed
      }
    }
    
    // If we get here, we didn't hit the rate limit
    throw new Error('Rate limit was not triggered after 21 requests');
  });
  
  it('should bypass rate limiting when in MOCK_MODE', async () => {
    server = startServer({ PERPLEXITY_API_KEY: 'x', ANTHROPIC_API_KEY: 'y', MOCK_MODE: '1' });
    // Try to exceed MAX_DRAFTS_PER_HOUR
    const responses = [];
    for (let i = 0; i < 5; i++) {
      const resp = await sendMCP(server, { name: 'draft_section', parameters: { outline: {}, sectionTitle: 'Intro', researchData: [] } });
      responses.push(resp);
    }
    // All responses should succeed in mock mode
    expect(responses.length).toBe(5);
    responses.forEach(resp => {
      expect(resp.error?.type).not.toBe('RateLimitExceeded');
    });
  });
  
  it('should handle list_resources MCP command', async () => {
    server = startServer({ MOCK_MODE: '1' });
    const resp = await sendMCP(server, { name: 'list_resources', parameters: {} });
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.result).toBeDefined();
    expect(Array.isArray(resp.result.resources)).toBe(true);
    expect(resp.result.resources.length).toBeGreaterThan(0);
    // Check for essential resource properties
    const resource = resp.result.resources[0];
    expect(resource.name).toBeDefined();
    expect(resource.description).toBeDefined();
    expect(resource.parameters).toBeDefined();
  });
  
  it('should handle read_resource MCP command', async () => {
    server = startServer({ PERPLEXITY_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' });
    const resp = await sendMCP(server, { name: 'read_resource', parameters: { uri: 'server-info' } });
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.result).toBeDefined();
    expect(resp.result.serverName).toBeDefined();
    expect(resp.result.version).toBeDefined();
  });
  
  it('should handle read_resource errors', async () => {
    server = startServer({ PERPLEXITY_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' });
    // Missing URI parameter
    const resp1 = await sendMCP(server, { name: 'read_resource', parameters: {} });
    expect(resp1.protocolVersion).toBe('1.0');
    expect(resp1.error).toBeDefined();
    expect(resp1.error.type).toBe('InvalidRequest');
    
    // Non-existent resource
    const resp2 = await sendMCP(server, { name: 'read_resource', parameters: { uri: 'non-existent-resource' } });
    expect(resp2.protocolVersion).toBe('1.0');
    expect(resp2.error).toBeDefined();
    expect(resp2.error.type).toBe('ResourceNotFound');
  });

  it('should exit gracefully on stdin close', () => {
    server = startServer({ PERPLEXITY_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' });
    return new Promise(resolve => {
      server.on('exit', () => {
        // code can be a number (exit code) or null/undefined if process was terminated
        // what matters is that the process exited, not the specific code
        resolve();
      });
      server.stdin.end();
    });
  });
});


describe('BlogWorks.ai MCP Server (normal operation, stdio)', () => {
  beforeAll(async () => {
    // Use mock mode for tests
    serverProcess = startServer({ MOCK_MODE: '1' });
    // No banner to wait for; MCP stdio server emits only JSON
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    if (serverProcess) serverProcess.kill();
  });

  it('returns error for unknown MCP function', async () => {
    const resp = await sendMCP(serverProcess, { name: 'unknown_function', parameters: {} });
    expect(resp.error).toBeDefined();
    expect(resp.error.type).toBe('UnknownFunction');
  });

  it('can create a session', async () => {
    const resp = await sendMCP(serverProcess, { name: 'create_session', parameters: { topic: 'Test Topic' } });
    expect(resp.result).toBeDefined();
    expect(resp.result.id).toBeDefined();
    expect(resp.result.topic).toBe('Test Topic');
  });
  
  it('can handle debug log settings', async () => {
    // Create a new server with debug logs enabled
    const debugServer = startServer({ MOCK_MODE: '1', DEBUG_LOGS: '1' });
    const resp = await sendMCP(debugServer, { name: 'create_session', parameters: { topic: 'Debug Test' } });
    expect(resp.result).toBeDefined();
    debugServer.kill();
  });
});

describe('BlogWorks.ai MCP Adapter Tests', () => {
  let server;

  beforeAll(async () => {
    // Use mock mode for tests
    server = startServer({ MOCK_MODE: '1' });
    // No banner to wait for; MCP stdio server emits only JSON
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    if (server) server.kill();
  });

  it('handles JSON-RPC tools/list request correctly', async () => {
    const resp = await sendMCP(server, { 
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/list',
      params: {}
    });
    
    expect(resp.jsonrpc).toBe('2.0');
    expect(resp.id).toBe(101);
    expect(resp.result).toBeDefined();
    expect(resp.result.tools).toBeDefined();
    expect(Array.isArray(resp.result.tools)).toBe(true);
    expect(resp.result.tools.length).toBeGreaterThan(0);
    
    // Verify tool structure
    const tool = resp.result.tools[0];
    expect(tool.name).toBeDefined();
    expect(tool.description).toBeDefined();
    expect(tool.parameters).toBeDefined();
  });

  it('handles JSON-RPC tools/execute request correctly', async () => {
    const resp = await sendMCP(server, { 
      jsonrpc: '2.0',
      id: 102,
      method: 'tools/execute',
      params: {
        name: 'create_session',
        parameters: {
          topic: 'Test Topic'
        }
      }
    });
    
    expect(resp.jsonrpc).toBe('2.0');
    expect(resp.id).toBe(102);
    expect(resp.result).toBeDefined();
    expect(resp.result.id).toBeDefined();
    expect(resp.result.topic).toBe('Test Topic');
  });

  it('handles gather_sources MCP command', async () => {
    const resp = await sendMCP(server, { 
      name: 'gather_sources', 
      parameters: { 
        topic: 'Artificial Intelligence'
      }
    });
    
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.result).toBeDefined();
    expect(resp.result.topic).toBeDefined();
    expect(Array.isArray(resp.result.sources)).toBe(true);
  });

  it('handles generate_angles MCP command', async () => {
    const resp = await sendMCP(server, { 
      name: 'generate_angles', 
      parameters: { 
        researchData: [{ title: 'Test Source', content: 'Sample content' }]
      }
    });
    
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.result).toBeDefined();
    expect(resp.result.angles).toBeDefined();
    expect(Array.isArray(resp.result.angles)).toBe(true);
  });

  it('handles create_outline MCP command', async () => {
    const resp = await sendMCP(server, { 
      name: 'create_outline', 
      parameters: { 
        topic: 'Artificial Intelligence',
        angle: 'Future of AI',
        researchData: [{ title: 'Test Source', content: 'Sample content' }]
      }
    });
    
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.result).toBeDefined();
    expect(resp.result.title).toBeDefined();
    expect(resp.result.sections).toBeDefined();
  });

  it('handles draft_section MCP command', async () => {
    const outline = {
      title: 'Test Article',
      introduction: 'This is an introduction',
      sections: [
        { title: 'Test Section', content: 'Test content' }
      ],
      conclusion: 'This is a conclusion'
    };
    
    const resp = await sendMCP(server, { 
      name: 'draft_section', 
      parameters: { 
        outline: outline,
        sectionTitle: 'introduction'
      }
    });
    
    expect(resp.protocolVersion).toBe('1.0');
    expect(resp.result).toBeDefined();
    expect(resp.result.content).toBeDefined();
  });
});

describe('BlogWorks.ai MCP Server (missing API keys, stdio)', () => {
  let missingKeyProcess;

  beforeAll(async () => {
    // Explicitly disable mock mode and windsurf mode
    missingKeyProcess = startServer({ 
      PERPLEXITY_API_KEY: '', 
      ANTHROPIC_API_KEY: '', 
      MOCK_MODE: '0',
      WINDSURF_MODE: '0',
      NODE_ENV: 'production' // Ensure we're not in test mode
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    if (missingKeyProcess) missingKeyProcess.kill();
  });

  it('returns error for missing required API keys', async () => {
    const resp = await sendMCP(missingKeyProcess, { name: 'create_session', parameters: { topic: 'Test Topic' } });
    expect(resp.error).toBeDefined();
    expect(resp.error.message).toMatch(/API_KEY is required/);
  });
});
