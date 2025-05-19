import 'dotenv/config';
import { describe, it, expect, vi } from 'vitest';
/**
 * Tests for the createOutline tool
 */
import createOutlineTool, { 
  createOutlineImpl,
  parameters
} from '../src/app/tools/createOutline.tool.js';

describe('createOutline Tool', () => {
  // Mock context and data
  const context = { debug: false, mockMode: true };
  
  // Mock input parameters
  const mockTopic = 'Climate Change';
  const mockTitle = 'The Impact of Climate Change on Global Ecosystems';
  const mockDescription = 'An exploration of how climate change affects various ecosystems around the world.';
  const mockResearchData = 'Climate change overview here.\n\n===\n\nCategory: Impacts | Fact: Coral reefs are dying | Reference: Marine Biology Journal 2023';
  const mockStyle = 'informative';
  const mockAuthor = '{"name":"Dr. Jane Smith"}';
  const mockTargetLen = '2000';
  
  it('should have the correct name and description', () => {
    expect(createOutlineTool.name).toBe('create_outline');
    expect(createOutlineTool.description).toContain('outline');
  });
  
  it('should handle optional parameters correctly', async () => {
    // Test with minimal parameters
    const minimalParams = {
      topic: mockTopic,
      title: mockTitle,
      description: mockDescription,
      researchData: mockResearchData,
    };
    
    const mockOutline = '### Test Outline';
    const callLLMMock = vi.fn().mockResolvedValue(mockOutline);
    
    const result = await createOutlineImpl(minimalParams, {
      ...context,
      callLLM: callLLMMock
    });
    
    expect(result).toHaveProperty('outline');
    // Verify we used the default style
    expect(callLLMMock).toHaveBeenCalledTimes(1);
    const promptArg = callLLMMock.mock.calls[0][0];
    expect(promptArg).toContain('informative'); // Default style
  });
  
  it('should generate an outline with markdown formatting', async () => {
    const mockOutline = '### Introduction\n- Key points\n\n### Conclusion';
    const callLLMMock = vi.fn().mockResolvedValue(mockOutline);
    
    const params = {
      topic: mockTopic,
      title: mockTitle,
      description: mockDescription,
      researchData: mockResearchData,
      style: mockStyle,
      author: mockAuthor,
      targetLen: mockTargetLen
    };
    
    const result = await createOutlineImpl(params, {
      ...context,
      callLLM: callLLMMock
    });
    
    expect(result).toHaveProperty('outline');
    expect(result.outline).toBe(mockOutline);
    
    // Verify that all parameters were included in the prompt
    const promptArg = callLLMMock.mock.calls[0][0];
    expect(promptArg).toContain(mockTopic);
    expect(promptArg).toContain(mockTitle);
    expect(promptArg).toContain(mockDescription);
    expect(promptArg).toContain(mockResearchData);
    expect(promptArg).toContain(mockStyle);
    expect(promptArg).toContain(mockAuthor); // Raw JSON is passed to the prompt
    expect(promptArg).toContain(mockTargetLen);
  });
  
  it('should handle errors gracefully with fallback outline', async () => {
    const params = {
      topic: mockTopic,
      title: mockTitle,
      description: mockDescription,
      researchData: mockResearchData
    };
    
    // Mock a failing LLM call
    const callLLMError = vi.fn().mockRejectedValue(new Error('API error'));
    
    const result = await createOutlineImpl(params, {
      ...context,
      callLLM: callLLMError
    });
    
    expect(result).toHaveProperty('outline');
    expect(typeof result.outline).toBe('string');
    expect(result.outline).toContain('Introduction'); // Fallback outline format
    expect(result.outline).toContain(mockTitle); // Should include title in fallback
  });
  
  // Skip this test in CI environments to avoid API rate limits
  it.skipIf(process.env.CI || !process.env.ANTHROPIC_API_KEY)('should work in live mode with API key', async () => {
    // Only run this test if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping live test: No ANTHROPIC_API_KEY available');
      return;
    }
    
    const liveContext = { debug: false, mockMode: false };
    
    const params = { 
      topic: mockTopic,
      title: mockTitle,
      description: mockDescription,
      researchData: mockResearchData,
    };
    
    const result = await createOutlineTool.handler(params, liveContext);
    
    expect(result).toHaveProperty('outline');
    expect(typeof result.outline).toBe('string');
    expect(result.outline).toContain('###'); // Should have markdown headings
  });
});
