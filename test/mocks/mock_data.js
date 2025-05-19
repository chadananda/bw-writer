/**
 * Mock data for testing
 * This module provides mock responses for various API endpoints when running in mock mode
 */

/**
 * Get mock data for a specific request
 * @param {string} name - The name of the MCP function
 * @param {Object} parameters - The parameters sent with the request
 * @returns {Object} Mock result data
 * @throws {Error} With appropriate error type and message for error cases
 */
export function getMockData(name, parameters) {
  // Handle unknown functions with appropriate error
  // This is critical for Windsurf MCP compliance
  const knownFunctions = [
    'create_session', 'get_session', 'get_all_sessions', 'delete_session',
    'gather_sources', 'validate_sources', 'generate_angles', 'create_outline',
    'draft_section', 'improve_readability', 'embed_media',
    'list_resources', 'read_resource'
  ];
  
  if (!knownFunctions.includes(name)) {
    const error = new Error(`Function "${name}" is not supported`);
    error.name = 'UnknownFunction';
    throw error;
  }
  
  // Handle read_resource with invalid URI
  if (name === 'read_resource' && parameters.uri && parameters.uri !== 'schema' && !parameters.uri.startsWith('examples/') && parameters.uri !== 'server-info') {
    const error = new Error(`Resource ${parameters.uri} not found`);
    error.name = 'ResourceNotFound';
    throw error;
  }
  switch (name) {
    case 'create_session':
      const sessionId = `mock-session-${Date.now()}`;
      return {
        id: sessionId,  // For server.test.js and integration.test.js
        sessionId: sessionId,  // For sdk.test.js
        topic: parameters.topic || 'Mock Topic',
        style: parameters.style || 'informative',
        length: parameters.length || 'medium',
        message: `Created new writing session for topic: ${parameters.topic || 'Mock Topic'}`
      };
    
    case 'gather_sources':
      // Return object with sources array for backward compatibility with integration tests
      return {
        topic: parameters.topic || 'Mock Topic',
        sources: [
          {
            title: 'Mock Source 1',
            url: 'https://example.com/source1',
            date: '2025-01-15',
            author: 'Mock Author 1',
            summary: 'This is a mock source for testing purposes.',
            credibility: 'high',
            content: 'Sample content for mock source 1'
          },
          {
            title: 'Mock Source 2',
            url: 'https://example.com/source2',
            date: '2025-02-20',
            author: 'Mock Author 2',
            summary: 'This is another mock source for testing purposes.',
            credibility: 'medium',
            content: 'Sample content for mock source 2'
          }
        ]
      };
    
    case 'generate_angles':
      // Return object with angles array for backward compatibility with integration tests
      return {
        angles: [
          {
            title: 'The Future of Mock Topics in Testing',
            description: 'How mock data is revolutionizing test-driven development',
            perspective: 'analytical',
            keyPoint: 'Mock data improves test reliability and speed'
          },
          {
            title: 'Mock Data: The Silent Revolution',
            description: 'Why developers are turning to mock data for better testing',
            perspective: 'narrative',
            keyPoint: 'Mock data reduces external dependencies'
          }
        ]
      };
    
    case 'create_outline':
      return {
        title: 'The Future of Mock Topics in Testing',
        introduction: 'Introduction to mock data in testing',
        conclusion: 'Conclusion about the future of mock data',
        sections: [
          {
            title: 'Understanding Mock Data',
            points: ['What is mock data?', 'Why use mock data in tests?']
          },
          {
            title: 'Implementing Mock Data',
            points: ['Strategies for effective mocking', 'Tools and libraries']
          },
          {
            title: 'The Future of Mocking',
            points: ['Upcoming trends in mock data', 'AI-powered mocks']
          }
        ]
      };
    
    case 'draft_section':
      return {
        sectionTitle: parameters.sectionTitle,
        content: `# ${parameters.sectionTitle}\n\nThis is mock content for the "${parameters.sectionTitle}" section. It would typically include several paragraphs of content, with proper formatting, citations, and examples.\n\n## Subsection Example\n\nThis is a subsection with more detailed information. In a real article, this would contain relevant information about the topic.\n\n* Bullet point 1\n* Bullet point 2\n* Bullet point 3\n\n> This is a blockquote that might contain an important insight or quote from a source.`
      };
    
    case 'improve_readability':
      return {
        original: parameters.text,
        improved: parameters.text + "\n\n[Readability improvements would be applied here]",
        readabilityScore: {
          before: 65.4,
          after: 78.9
        }
      };
    
    case 'embed_media':
      return [
        {
          type: 'image',
          title: 'Mock Image Suggestion',
          description: 'This would be a relevant image for the section.',
          source: 'https://example.com/images/mock-image.jpg',
          alt: 'Description of mock image'
        },
        {
          type: 'chart',
          title: 'Mock Chart Suggestion',
          description: 'This would be a relevant chart visualizing data mentioned in the text.',
          data: {
            type: 'bar',
            labels: ['Category A', 'Category B', 'Category C'],
            values: [45, 32, 67]
          }
        }
      ];
    
    case 'get_session':
      return {
        id: parameters.sessionId || 'mock-session-123',
        topic: 'Mock Topic',
        detailedPrompt: '',
        promptContent: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'in-progress',
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
        },
        progress: 90
      };
    
    case 'get_all_sessions':
      return [
        {
          id: 'mock-session-1',
          topic: 'Mock Topic 1',
          createdAt: new Date().toISOString(),
          progress: 90
        },
        {
          id: 'mock-session-2',
          topic: 'Mock Topic 2',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          progress: 50
        }
      ];
    
    case 'delete_session':
      return { deleted: true };
    
    case 'list_resources':
      return {
        resources: [
          {
            name: 'server-info',
            description: 'Information about the MCP server',
            parameters: {}
          },
          {
            name: 'schema',
            description: 'JSON schema for the MCP API',
            parameters: {}
          }
        ]
      };
    
    case 'read_resource':
      if (parameters.uri === 'server-info') {
        return {
          serverName: 'bw-writer',
          version: '0.2.1',
          description: 'BlogWorks.ai Writer MCP Server',
          capabilities: ['article-writing', 'research', 'planning']
        };
      } else if (parameters.uri === 'schema') {
        return {
          title: 'BlogWorks.ai Writer API Schema',
          version: '0.2.1',
          endpoints: [
            'create_session',
            'gather_sources',
            'generate_angles',
            'create_outline',
            'draft_section',
            'improve_readability',
            'embed_media'
          ]
        };
      }
      break;
    
    default:
      return { message: 'Mock data not implemented for this function' };
  }
}
