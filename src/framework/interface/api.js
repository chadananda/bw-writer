#!/usr/bin/env node
/**
 * REST API for Article Writing
 * 
 * OpenAPI-compliant REST API for direct integration with other applications
 * Uses the application object from application.js
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import expressOpenApiValidator from 'express-openapi-validator';
const { OpenApiValidator } = expressOpenApiValidator;
import { loadPackageMetadata } from '../utils/metadata-loader.js';

import { application } from '../application.js';

/**
 * Generate OpenAPI specification from application object
 */
function generateOpenApiSpec() {
  // Basic specification structure
  const spec = {
    openapi: '3.0.0',
    info: {
      title: `${application.config.displayName || application.config.name} API`,
      description: application.config.description,
      version: application.config.version,
      contact: {
        name: application.config.vendor
      }
    },
    servers: [
      {
        url: '/api',
        description: 'API Base URL'
      }
    ],
    tags: [
      {
        name: 'workflows',
        description: 'Article writing workflows'
      },
      {
        name: 'info',
        description: 'API information'
      }
    ],
    paths: {},
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string'
            }
          }
        },
        ApiInfo: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            vendor: { type: 'string' },
            version: { type: 'string' },
            workflows: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  };
  
  // Add info endpoint
  spec.paths['/info'] = {
    get: {
      tags: ['info'],
      summary: 'Get API information',
      description: 'Get information about the API, including available workflows',
      operationId: 'getInfo',
      responses: {
        '200': {
          description: 'API information',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiInfo'
              }
            }
          }
        }
      }
    }
  };
  
  // Generate paths and schemas for each workflow
  Object.entries(application.workflows).forEach(([name, workflow]) => {
    // Create request schema
    const requestSchemaName = `${name.charAt(0).toUpperCase() + name.slice(1)}Request`;
    spec.components.schemas[requestSchemaName] = {
      type: 'object',
      required: ['topic'],
      properties: {
        topic: {
          type: 'string',
          description: `The topic for the ${name} operation`,
          example: workflow.example || 'Example topic'
        }
      }
    };
    
    // Add common options to request schema
    if (workflow.options) {
      Object.entries(workflow.options).forEach(([optName, optConfig]) => {
        spec.components.schemas[requestSchemaName].properties[optName] = {
          type: optConfig.type || 'string',
          description: optConfig.description || `Option for ${optName}`,
          ...(optConfig.enum ? { enum: optConfig.enum } : {}),
          ...(optConfig.default !== undefined ? { default: optConfig.default } : {})
        };
      });
    }
    
    // Create response schema
    const responseSchemaName = `${name.charAt(0).toUpperCase() + name.slice(1)}Response`;
    spec.components.schemas[responseSchemaName] = {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The generated content'
        },
        metadata: {
          type: 'object',
          properties: {
            wordCount: { type: 'integer' },
            readingTime: { type: 'integer' }
          }
        }
      }
    };
    
    // Add path for workflow
    spec.paths[`/${name}`] = {
      post: {
        tags: ['workflows'],
        summary: workflow.description || `${name} operation`,
        description: workflow.longDescription || workflow.description || `Perform the ${name} operation`,
        operationId: name,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: `#/components/schemas/${requestSchemaName}`
              }
            }
          }
        },
        responses: {
          '200': {
            description: `Successful ${name} operation`,
            content: {
              'application/json': {
                schema: {
                  $ref: `#/components/schemas/${responseSchemaName}`
                }
              }
            }
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      }
    };
  });
  
  return spec;
}

// Create Express app
const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Generate OpenAPI spec
const apiSpec = generateOpenApiSpec();

// Serve OpenAPI spec
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiSpec));
app.get('/api-spec', (req, res) => {
  res.json(apiSpec);
});

// Install OpenAPI validator
app.use(OpenApiValidator.middleware({
  apiSpec,
  validateRequests: true,
  validateResponses: true
}));

// Create API routes based on application workflows
Object.entries(application.workflows).forEach(([name, workflow]) => {
  app.post(`/api/${name}`, async (req, res) => {
    try {
      const { topic, ...options } = req.body;
      
      // Create tool dependencies
      const toolDeps = {};
      application.tools.forEach(tool => {
        const camelCaseName = tool.name.replace(/(^|_)([a-z])/g, (_, p1, p2) => p2.toUpperCase())
                                .replace(/_/g, '')
                                .replace(/^([A-Z])/, (_, p1) => p1.toLowerCase());
        
        toolDeps[camelCaseName] = (params) => tool.handler(params, {
          debug: application.config.debug,
          mockMode: application.config.mock,
          getMockData
        });
      });
      
      // Execute workflow
      const result = await workflow.handler(topic, options, toolDeps);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Create route for application metadata
app.get('/api/info', (req, res) => {
  res.json({
    name: application.config.name,
    description: application.config.description,
    vendor: application.config.vendor,
    version: application.config.version,
    workflows: Object.keys(application.workflows)
  });
});

// Error handler for OpenAPI validation errors
app.use((err, req, res, next) => {
  // Format error
  res.status(err.status || 500).json({
    error: err.message,
    errors: err.errors
  });
});

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(port);
}

// No exports to maintain compatibility with the windsurf mcpServer library
