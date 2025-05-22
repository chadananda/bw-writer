/**
 * Tests for the MCP HTTP interface
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// Skipped: required 'supertest' for HTTP integration, which is not allowed by project policy.
import { application } from '../src/application.js';


// Import the MCP HTTP module directly
import app from '../src/app/mcp-http.js';

describe('MCP HTTP Interface', () => {
  let server;
  const port = 3001; // Use a different port than the main API

  beforeAll(async () => {
    // Start the server
    server = app.listen(port);
  });

  afterAll(async () => {
    // Close the server after tests
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('should respond to the hello message', async () => {
    const response = await request(app)
      .post('/')
      .send({ hello: true });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('hello');
    expect(response.body).toHaveProperty('models');
    expect(response.body).toHaveProperty('tools');
    expect(Array.isArray(response.body.tools)).toBe(true);
  });

  it('should list available tools', async () => {
    const response = await request(app)
      .post('/')
      .send({ hello: true });
    
    expect(response.body.tools.length).toBeGreaterThan(0);
    
    // Verify that all tools from the application are included
    const toolNames = application.tools.map(tool => tool.name);
    response.body.tools.forEach(tool => {
      expect(toolNames).toContain(tool.name);
    });
  });

  it('should execute a tool', async () => {
    const response = await request(app)
      .post('/')
      .send({
        tool: 'create_session',
        params: { topic: 'Test Topic' }
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('result');
    expect(response.body.result).toHaveProperty('sessionId');
    expect(response.body.result).toHaveProperty('topic', 'Test Topic');
  });

  it('should return an error for invalid tool name', async () => {
    const response = await request(app)
      .post('/')
      .send({
        tool: 'non_existent_tool',
        params: {}
      });
    
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });

  it('should validate tool parameters', async () => {
    const response = await request(app)
      .post('/')
      .send({
        tool: 'gather_sources',
        params: {} // Missing required 'topic' parameter
      });
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});
