import 'dotenv/config';
import { describe, it, expect, vi } from 'vitest';
/**
 * Tests for the draftArticle tool
 */
import draftArticleTool, { 
  draftArticleImpl,
  parameters
} from '../src/app/tools/draftArticle.tool.js';

describe('draftArticle Tool', () => {
  // Mock context and data
  const context = { debug: false, mockMode: true };
  
  // Mock input parameters
  const mockTitle = 'The Impact of Climate Change on Global Ecosystems';
  const mockDescription = 'An exploration of climate change effects on ecosystems';
  const mockOutline = '### Introduction\n- Overview of climate change\n\n### Key Impacts\n- Rising temperatures\n- Sea level rise\n\n### Conclusion\n- Summary of findings';
  const mockResearchData = 'Climate change overview.\n\n===\n\nCategory: Impacts | Fact: Rising temperatures | Reference: IPCC 2021\nCategory: Solutions | Fact: Renewable energy | Reference: IEA 2023';
  const mockStyle = 'academic';
  const mockAuthor = '{"name":"Dr. Jane Smith"}';
  
  it('should have the correct name and description', () => {
    expect(draftArticleTool.name).toBe('draft_article');
    expect(draftArticleTool.description).toContain('article');
  });
  
  it('should generate an article based on outline and research', async () => {
    // Mock with h2/h3 headers and blockquote as specified in updated guidelines
    const mockContent = '# The Impact of Climate Change on Global Ecosystems\n\n' + 
      '## Introduction\n\nClimate change represents one of the most significant global challenges...\n\n' +
      '> "The rate of warming since 1970 is unprecedented in at least the last 2000 years" - [IPCC Climate Report 2021](https://ipcc.ch)\n\n' +
      '## Key Impacts\n\n### Rising Temperatures\n\nGlobal temperatures have increased by approximately 1.1°C since pre-industrial times...\n\n' +
      '### Sea Level Rise\n\nRising sea levels threaten coastal communities worldwide...\n\n' +
      '## Conclusion\n\nThe evidence clearly shows that climate change requires immediate action...';
    
    const callLLMMock = vi.fn().mockResolvedValue(mockContent);
    
    const params = {
      title: mockTitle,
      description: mockDescription,
      outline: mockOutline,
      researchData: mockResearchData,
      style: mockStyle,
      author: mockAuthor
    };
    
    const result = await draftArticleImpl(params, {
      ...context,
      callLLM: callLLMMock
    });
    
    expect(result).toHaveProperty('content');
    expect(result.content).toBe(mockContent);
    
    // Verify that all parameters were included in the prompt
    const promptArg = callLLMMock.mock.calls[0][0];
    expect(promptArg).toContain(mockTitle);
    expect(promptArg).toContain(mockDescription);
    expect(promptArg).toContain(mockOutline);
    expect(promptArg).toContain(mockResearchData);
    expect(promptArg).toContain(mockStyle);
    expect(promptArg).toContain(mockAuthor);
    
    // Verify that updated guidelines are in the prompt
    expect(promptArg).toContain('h2 sections and h3 sub-headers');
    expect(promptArg).toContain('blockquotes with interesting corroborating citations');
    expect(promptArg).toContain('brief inline links');
  });
  
  it('should handle optional parameters correctly', async () => {
    const mockContent = '# The Impact of Climate Change on Global Ecosystems\n\nArticle content...';
    const callLLMMock = vi.fn().mockResolvedValue(mockContent);
    
    // Test with minimal parameters
    const minimalParams = {
      title: mockTitle,
      description: mockDescription,
      outline: mockOutline,
      researchData: mockResearchData
    };
    
    const result = await draftArticleImpl(minimalParams, {
      ...context,
      callLLM: callLLMMock
    });
    
    expect(result).toHaveProperty('content');
    
    // Verify we used the default style
    const promptArg = callLLMMock.mock.calls[0][0];
    expect(promptArg).toContain('informative'); // Default style
    expect(promptArg).toContain('Not specified'); // Default author
  });
  
  it('should handle errors gracefully with fallback content', async () => {
    const callLLMError = vi.fn().mockRejectedValue(new Error('API error'));
    
    const params = {
      title: mockTitle,
      description: mockDescription,
      outline: mockOutline,
      researchData: mockResearchData
    };
    
    const result = await draftArticleImpl(params, {
      ...context,
      callLLM: callLLMError
    });
    
    expect(result).toHaveProperty('content');
    expect(result.content).toContain(mockTitle);
    expect(result.content).toContain('Error generating content');
    expect(result.content).toContain(mockOutline);
  });
  
  // Skip this test in CI environments to avoid API rate limits
  it.skipIf(process.env.CI || !process.env.ANTHROPIC_API_KEY)('should work in live mode with API key', async () => {
    // Only run this test if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping live test: No ANTHROPIC_API_KEY available');
      return;
    }
    
    const liveContext = { debug: false, mockMode: false };
    
    // Use minimal parameters to keep the test faster
    const params = { 
      title: 'Test Article',
      description: 'A very brief test article',
      outline: '### Intro\n- Test point\n\n### Conclusion',
      researchData: 'Test data.\n\n===\n\nCategory: Test | Fact: Test fact | Reference: Test 2023'
    };
    
    const result = await draftArticleTool.handler(params, liveContext);
    
    expect(result).toHaveProperty('content');
    expect(typeof result.content).toBe('string');
    expect(result.content).toContain('Test Article');
  });
});
