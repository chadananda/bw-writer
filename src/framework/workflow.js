/**
 * Workflow Orchestrator Framework
 * ------------------------------
 * Provides utilities for building multi-step workflow pipelines
 * Coordinates tool execution, session management, and response formatting
 */

import { z } from 'zod';

/**
 * Creates a standardized article response from workflow outputs
 * 
 * @param {Object} params - Parameters for the response formatter
 * @param {Object} params.metadata - Article metadata (title, author, etc.)
 * @param {Object} params.content - Content objects from pipeline steps
 * @param {Boolean} params.debug - Whether to include debug information
 * @returns {Object} Standardized response object
 */
export function formatArticleResponse({
  metadata = {},
  content = {},
  assets = [],
  debug = false
}) {
  const {
    topic,
    title,
    style,
    length,
    author,
    yamlMetadata,
    outline
  } = metadata;

  // Extract the final article content
  const finalContent = content.body || content.withMedia?.content || content.improved?.content || '';
  
  // Format YAML frontmatter
  const frontmatter = {
    title: title || topic,
    description: outline?.summary || '',
    author: author || {},
    style: typeof style === 'object' ? style : 
           typeof style === 'string' && style.length > 30 ? style : 
           { type: style || 'informative', description: 'Standard article format' },
    length: length || 0,
    keywords: yamlMetadata?.keywords || [],
    created: new Date().toISOString()
  };
  
  // Generate the markdown with frontmatter
  const yamlHeader = '---\n' + 
    Object.entries(frontmatter)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map(item => `  - ${item}`).join('\n')}`;
        } else if (typeof value === 'object') {
          return `${key}:\n${Object.entries(value)
            .filter(([_, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `  ${k}: ${v}`).join('\n')}`;
        }
        return `${key}: ${value}`;
      }).join('\n') + '\n---\n\n';
  
  // Combine the YAML frontmatter with the article body
  const markdown = yamlHeader + finalContent;
  
  // Create streamlined response
  const streamlinedResponse = {
    title: title || topic,
    description: outline?.summary || '',
    style: typeof style === 'object' ? style : 
           typeof style === 'string' && style.length > 30 ? style : 
           { type: style || 'informative', description: 'Standard article format' },
    author: author || {},
    length: length || 0,
    keywords: yamlMetadata?.keywords || [],
    body: finalContent,
    assets: assets,
    markdown: markdown
  };
  
  // If debug mode, include all intermediate results
  if (debug) {
    return {
      ...streamlinedResponse,
      debug: {
        metadata,
        content
      }
    };
  }
  
  // Return streamlined output for normal use
  return streamlinedResponse;
}

/**
 * Creates a new workflow pipeline that can be executed with dependencies
 * 
 * @param {Object} steps - Object mapping step names to async functions
 * @param {Function} formatter - Function to format the final result
 * @returns {Function} Pipeline executor function
 */
export function createWorkflow(steps, formatter = null) {
  return async (params, context = {}) => {
    const results = {};
    const debug = context.debug || false;
    
    // Initialize session
    const sessionId = context.sessionId || 
      (typeof crypto !== 'undefined' && crypto.randomUUID) ? 
        crypto.randomUUID() :
        Math.random().toString(36).slice(2);
    
    const session = { 
      sessionId, 
      created: new Date().toISOString(), 
      status: 'initialized', 
      progress: 0, 
      metadata: {}, 
      keys: {} 
    };
    
    results.session = session;
    
    // Execute each step in order
    for (const [name, stepFn] of Object.entries(steps)) {
      try {
        // Update session progress
        session.status = `executing_${name}`;
        session.progress = Math.floor(Object.keys(results).length / Object.keys(steps).length * 100);
        
        // Execute the step with all previous results available
        results[name] = await stepFn({ ...params, ...results });
        
      } catch (error) {
        session.status = 'error';
        session.error = error.message || String(error);
        
        if (debug) {
          throw error;
        } else {
          console.error(`Error in workflow step '${name}':`, error);
          break;
        }
      }
    }
    
    // Update final session status
    session.status = 'completed';
    session.progress = 100;
    
    // Format and return the results
    return formatter ? formatter(results) : results;
  };
}

/**
 * Maps tool handlers to workflow step functions
 * 
 * @param {Object} deps - Tool dependencies object (from MCP handler)
 * @param {Object} mapping - Maps step names to tool names and param transformers
 * @returns {Object} Step functions for workflow
 */
export function mapToolsToSteps(deps, mapping) {
  const steps = {};
  
  for (const [stepName, config] of Object.entries(mapping)) {
    const { 
      tool, 
      params = (input) => input,
      output = (result) => result
    } = typeof config === 'string' ? { tool: config } : config;
    
    // Skip if tool doesn't exist
    if (!deps[tool]) {
      continue;
    }
    
    steps[stepName] = async (input) => {
      const preparedParams = await params(input);
      const result = await deps[tool](preparedParams);
      return output(result);
    };
  }
  
  return steps;
}

/**
 * Creates a simple workflow executor that follows the extract-call-save pattern
 * This approach provides more explicit control over data flow between steps
 * 
 * @param {Function} executeSteps - Function containing the workflow steps with session state
 * @returns {Function} Workflow executor function
 */
export function createSimpleWorkflow(executeSteps) {
  return async (params, context = {}) => {
    // Initialize session
    const sessionId = context.sessionId || 
      (typeof crypto !== 'undefined' && crypto.randomUUID) ? 
        crypto.randomUUID() :
        Math.random().toString(36).slice(2);
    
    // Create initial session state
    const session = { 
      sessionId, 
      created: new Date().toISOString(), 
      status: 'initialized', 
      progress: 0,
      data: {}, // Store all workflow data here
    };
    
    try {
      // Execute steps with the session state
      const result = await executeSteps(params, session, context);
      
      // Mark session as completed
      session.status = 'completed';
      session.progress = 100;
      
      return result;
    } catch (error) {
      // Handle errors
      session.status = 'error';
      session.error = error.message || String(error);
      
      if (context.debug) {
        throw error;
      } else {
        console.error(`Error in workflow:`, error);
        return { error: error.message, session };
      }
    }
  };
}

/**
 * Extracts data from a session for a tool call
 * 
 * @param {Object} session - Session state object
 * @param {Array<string>} fields - Fields to extract 
 * @returns {Object} Extracted parameters
 */
export function extractFromSession(session, fields) {
  const result = {};
  for (const field of fields) {
    // Support dot notation for nested fields (e.g., "analyze.topic")
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (session.data[parent] && session.data[parent][child] !== undefined) {
        result[child] = session.data[parent][child];
      }
    } else if (session.data[field] !== undefined) {
      result[field] = session.data[field];
    }
  }
  
  // Always include session ID
  result.sessionId = session.sessionId;
  
  return result;
}

/**
 * Save tool result to session data
 * 
 * @param {Object} session - Session state object
 * @param {string} key - Key to store result under
 * @param {Object} data - Data to store
 */
export function saveToSession(session, key, data) {
  session.data[key] = data;
  // Update progress
  session.progress = Object.keys(session.data).length * 10;
}

/**
 * Combines extract-call-save into a single function call
 * 
 * @param {Object} deps - Tool dependencies object (from MCP handler)
 * @param {Object} session - Session state object
 * @param {string} toolName - Name of the tool to call
 * @param {string} saveKey - Key to save results under
 * @param {Array<string>|Object} params - Either field names to extract or direct params
 * @param {Object} context - Optional additional context to pass to the tool
 * @returns {Promise<Object>} Tool result
 */
export async function callTool(deps, session, toolName, saveKey, params, context = {}) {
  // Ensure tool exists
  if (!deps[toolName]) {
    throw new Error(`Tool '${toolName}' not found in dependencies`);
  }
  
  // Extract parameters if it's an array of field names
  const toolParams = Array.isArray(params) ? 
    extractFromSession(session, params) : 
    params;
    
  // Add context to parameters
  const finalParams = { 
    ...toolParams, 
    ...context,
    sessionId: session.sessionId
  };
  
  // Call the tool
  const result = await deps[toolName](finalParams);
  
  // Save results to session
  saveToSession(session, saveKey, result);
  
  return result;
}

export default {
  createWorkflow,
  formatArticleResponse,
  mapToolsToSteps,
  createSimpleWorkflow,
  extractFromSession,
  saveToSession,
  callTool
};
