/**
 * Tests for the REST API interface
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// Skipped: required 'supertest' for HTTP integration, which is not allowed by project policy.
import express from 'express';
import { application } from '../src/application.js';
import { getMockData } from './mocks/mock_data.js';

// Import the API module
import apiSetup from '../src/app/api.js';

describe('REST API Interface', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Create an Express app for testing
    app = express();
    
    // Set up the API routes with the application object
    apiSetup(app, application, { getMockData });
    
    // Start the server
    server = app.listen(0);
  });

  afterAll(async () => {
    // Close the server after tests
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('should return API documentation at /api-docs', async () => {
    const response = await request(app).get('/api-docs');
    expect(response.status).toBe(200);
    expect(response.type).toContain('text/html');
  });

  it('should return OpenAPI specification at /api-docs/swagger.json', async () => {
    const response = await request(app).get('/api-docs/swagger.json');
    expect(response.status).toBe(200);
    expect(response.type).toContain('application/json');
    expect(response.body).toHaveProperty('openapi');
    expect(response.body).toHaveProperty('paths');
  });

  it('should list available tools at /api/tools', async () => {
    const response = await request(app).get('/api/tools');
    expect(response.status).toBe(200);
    expect(response.type).toContain('application/json');
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('name');
    expect(response.body[0]).toHaveProperty('description');
    expect(response.body[0]).toHaveProperty('parameters');
  });

  it('should execute a tool at /api/tools/:toolName', async () => {
    // Test with a simple tool like create_session
    const response = await request(app)
      .post('/api/tools/create_session')
      .send({ topic: 'Test Topic' });
    
    expect(response.status).toBe(200);
    expect(response.type).toContain('application/json');
    expect(response.body).toHaveProperty('sessionId');
    expect(response.body).toHaveProperty('topic', 'Test Topic');
  });

  it('should return 404 for non-existent tools', async () => {
    const response = await request(app)
      .post('/api/tools/non_existent_tool')
      .send({});
    
    expect(response.status).toBe(404);
  });

  it('should validate parameters for tools', async () => {
    // Test with missing required parameters
    const response = await request(app)
      .post('/api/tools/gather_sources')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});
