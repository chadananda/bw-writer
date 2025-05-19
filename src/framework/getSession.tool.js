/**
 * getSession Tool
 * Retrieve details about an existing writing session (generic MCP utility)
 */

/**
 * Implementation of get_session functionality
 * @param {Object} params - Session parameters
 * @param {Object} context - Tool execution context
 */
async function getSessionImpl(params, context) {
  // Validate required parameters
  if (!params.sessionId) {
    const error = new Error('Required parameter "sessionId" is missing');
    error.name = 'InvalidParams';
    throw error;
  }

  try {
    // Get session from the session manager if available
    if (context.server && context.server.sessionManager) {
      const session = context.server.sessionManager.getSession(params.sessionId);
      if (session) {
        return session;
      }
    }
    
    // If session not found or no session manager
    return { error: 'Session not found' };
  } catch (error) {
    throw new Error(`Failed to get session: ${error.message}`);
  }
}

/**
 * Tool definition for initialize_article_session
 */
export default {
  name: 'get_session',
  description: 'Get details about an existing writing session',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the session to retrieve'
      }
    },
    required: ['sessionId']
  },
  handler: async (params, { debug, mockMode, server }) => {
    debug(`Executing get_session with params: ${JSON.stringify(params)}`);
    
    if (mockMode) {
      return {
        id: params.sessionId,
        topic: 'Mock Topic',
        detailedPrompt: '',
        promptContent: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'in-progress',
        progress: 75,
        steps: {
          research: { status: 'completed', data: { sources: [] } },
          angles: { status: 'completed', data: { angles: [] } },
          outline: { status: 'completed', data: { sections: [] } },
          draft: { status: 'completed', data: {} },
          review: { status: 'completed', data: {} },
          final: { status: 'pending', data: null }
        },
        metadata: {
          yamlMetadata: {},
          authorVoice: {},
          contentInstructions: {},
          stylePreferences: {}
        }
      };
    }
    
    return getSessionImpl(params, { server });
  }
};
