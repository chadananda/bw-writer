/**
 * Create a tool handler wrapper with common validation and mock data handling
 * @param {Function} handler - The actual handler function
 * @param {string} toolName - The name of the tool
 * @param {Function} getMockData - Function to get mock data
 * @param {boolean} mockMode - Whether to use mock data
 * @returns {Function} Wrapped handler function
 */
export function createToolHandler(handler, toolName, getMockData, mockMode) {
  return async (params) => {
    // Validate API keys
    const validation = validateApiKeys(mockMode);
    if (validation !== true) {
      // Always return a well-formed MCP error object for missing API keys
      return {
        protocolVersion: '1.0',
        error: {
          type: 'MissingApiKey',
          message: validation.error || 'Missing or invalid API key(s)'
        }
      };
    }

    // Use mock data if in mock mode
    if (mockMode && getMockData) {
      return getMockData(toolName, params);
    }

    // Parameter validation for create_session (test expects error if topic is missing)
    if (toolName === 'create_session' && (!params || !params.topic)) {
      return {
        protocolVersion: '1.0',
        error: {
          type: 'InvalidRequest',
          message: 'Required parameter "topic" is missing'
        }
      };
    }

    // Execute the actual handler
    try {
      return await handler(params);
    } catch (err) {
      // Always return a well-formed error for handler exceptions
      return {
        protocolVersion: '1.0',
        error: {
          type: err.name || 'InternalError',
          message: err.message || 'An unexpected error occurred'
        }
      };
    }
  };
}

// Note: This function depends on validateApiKeys, which should also be available in framework utils or imported appropriately.
