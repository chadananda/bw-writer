# MCP Server Framework Architecture

This directory contains a reusable MCP server framework designed to be easily adapted for different applications. The architecture separates the generic framework code from application-specific code, making it simple to create new MCP servers with minimal effort.

## Directory Structure

```
src/
├── app/                  # Interface implementations
│   ├── api.js            # REST API interface (OpenAPI-compliant)
│   ├── cli.js            # Command-line interface
│   ├── mcp-http.js       # HTTP-based MCP server
│   ├── mcp-stdio.js      # Standard I/O based MCP server
│   └── package.js        # NPM package interface
├── utils/                # Reusable framework utilities
│   ├── cli-core.js       # CLI implementation
│   ├── cli-helpers.js    # CLI UI utilities
│   ├── mcp-base.js       # MCP protocol implementation
│   └── metadata-loader.js # Package metadata utilities
├── tools/                # Application-specific tools
├── index.js              # Main entry point and application definition
└── README.md             # This file
```

## Key Components

### index.js

This is the heart of your MCP server application. It defines:

1. **Configuration**: Application metadata, debug settings, and environment variables
2. **Tools**: The MCP tools your server provides
3. **Workflows**: Command-line workflows that combine tools into useful operations
4. **Exports**: All interfaces and components for use by other modules

This is the primary file you'll modify when creating a new MCP server application.

### utils/ Directory

Contains the reusable framework utilities that shouldn't need to be modified between different MCP applications:

- **mcp-base.js**: Core MCP protocol implementation
- **metadata-loader.js**: Package metadata and configuration utilities
- **cli-core.js**: CLI framework that dynamically builds commands from the application object
- **cli-helpers.js**: Common UI utilities for the CLI

### app/ Directory

Contains different interfaces to your application:

- **mcp-stdio.js**: Standard I/O based MCP server (the primary interface)
- **cli.js**: Command-line interface wrapper
- **api.js**: REST API with OpenAPI specification
- **mcp-http.js**: HTTP-based MCP server
- **package.js**: NPM package interface for direct integration

### tools/ Directory

Contains your application-specific tool implementations that are referenced by `application.js`.

## Creating a New MCP Server Application

To create a new MCP server application:

1. **Define your application**: Modify `index.js` to define your configuration, tools, and workflows
2. **Implement your tools**: Create tool implementations in the `tools/` directory
3. **Update package.json**: Update the name, description, and other metadata

The framework will automatically:

- Generate a CLI with commands based on your workflows
- Create an MCP server with tools based on your definitions
- Provide a REST API with OpenAPI documentation
- Handle validation, error handling, and other common tasks

## Example: Minimal index.js

```javascript
/**
 * MCP Server Example
 */
import { z } from 'zod';
import { McpServer, createTool } from './utils/mcp-base.js';

// Import tools directly
import helloWorldTool from './tools/helloWorldTool.js';

// Create array of all tools
const tools = [
  helloWorldTool
];

/**
 * Application definition
 */
export const application = {
  // Configuration
  config: {
    name: 'my-mcp-server',
    displayName: 'My MCP Server',
    description: 'My custom MCP server',
    version: '1.0.0',
    vendor: 'Your Name',
    debug: process.env.DEBUG_LOGS === 'true',
    mock: process.env.MOCK_MODE === '1'
  },
  
  // Tool definitions
  tools: tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    handler: (params, context) => tool.handler(params, context)
  })),
  
  // Workflow definitions
  workflows: {
    greet: {
      description: 'Greet someone by name',
      handler: async (name, options, deps) => {
        const result = await deps.helloWorld({ name });
        return { content: result.message };
      }
    }
  }
};

// Export interfaces
export { default as mcpStdio } from './app/mcp-stdio.js';
export { default as mcpHttp } from './app/mcp-http.js';
export { default as api } from './app/api.js';

// Export base components
export { McpServer, createTool };

// Re-export the default interface for backward compatibility
export { default } from './app/mcp-stdio.js';
```

## Best Practices

1. **Keep index.js focused**: It should primarily contain configuration, tool definitions, workflow handlers, and exports
2. **Implement complex logic in tools**: Keep the workflow handlers simple by moving complex logic to tools
3. **Use the debug flag**: Enable debug logging with `DEBUG_LOGS=true` for development
4. **Use mock mode**: Enable mock mode with `MOCK_MODE=1` for testing without external dependencies
5. **Add OpenAPI metadata**: Enhance your workflows with examples and option definitions for better API documentation
6. **Maintain clear separation**: Keep application-specific code in index.js and tools/, while framework code stays in utils/

## Running Your MCP Server

- **MCP Server**: `npm run mcp`
- **CLI**: `npm run cli -- <command> <topic> [options]`
- **REST API**: `npm run api`
- **HTTP MCP Server**: `npm run http`
