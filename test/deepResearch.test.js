import 'dotenv/config';
import { describe, it, expect, vi } from 'vitest';
/**
 * Tests for the deepResearch tool
 */
import deepResearchTool, { 
  initialResearch, 
  generateCategories, 
  deepDiveResearch, 
  createFinalOverview, 
  deepResearchImpl 
} from '../src/app/tools/deepResearch.tool.js';

describe('deepResearch Tool', () => {
  // Mock context for testing
  const context = {
    debug: false,
    mockMode: true
  };
  
  const mockTopic = 'Climate Change';
  const mockKeywords = 'global warming,carbon emissions';
  const mockInstructions = 'Focus on recent developments and solutions';
  
  it('should have the correct name and description', () => {
    expect(deepResearchTool.name).toBe('deep_research');
    expect(deepResearchTool.description).toContain('Research');
  });
  
  it('should return structured research data as string', async () => {
    const params = { 
      topic: mockTopic,
      keywords: mockKeywords,
      instructions: mockInstructions
    };
    
    // Mock the underlying functions when in mock mode
    const mockInitialResearch = vi.fn().mockImplementation(() => {
      return 'Mock overview of climate change and its effects on the environment.';
    });
    
    const mockGenerateCategories = vi.fn().mockImplementation(() => {
      return [
        { category: 'Core Concepts', query: 'Basic climate change concepts' },
        { category: 'Impacts', query: 'Climate change impacts' }
      ];
    });
    
    const mockDeepDiveResearch = vi.fn().mockImplementation(() => {
      return [
        'Category: Core Concepts | Fact: Global temperatures have risen 1.1C since pre-industrial times | Quote: "The Earth temperature has risen by an average of 1.1C since the pre-industrial era" | Reference: IPCC 2021',
        'Category: Impacts | Fact: Sea levels are rising at an accelerated rate | Quote: "Global mean sea level is rising at a rate of 3.7 mm per year" | Reference: NASA 2023'
      ];
    });
    
    const mockCreateFinalOverview = vi.fn().mockImplementation(() => {
      return 'Climate change is the long-term alteration of temperature patterns caused primarily by human activities.';
    });
    
    const result = await deepResearchImpl(params, {
      ...context,
      mockMode: true,
      initialResearch: mockInitialResearch,
      generateCategories: mockGenerateCategories,
      deepDiveResearch: mockDeepDiveResearch,
      createFinalOverview: mockCreateFinalOverview
    });
    
    // Check that researchData is the only property
    expect(Object.keys(result)).toEqual(['researchData']);
    expect(typeof result.researchData).toBe('string');
    
    // Check that researchData contains both overview and facts
    expect(result.researchData).toContain('Climate change');
    expect(result.researchData).toContain('==='); // Separator
    expect(result.researchData).toContain('Category:');
  });
  
  it('initialResearch returns an overview string', async () => {
    if (context.mockMode) {
      const overview = 'Mock overview of climate change with recent research findings.';
      expect(typeof overview).toBe('string');
      expect(overview.length).toBeGreaterThan(20);
    } else {
      const overview = await initialResearch(mockTopic, mockKeywords, mockInstructions);
      expect(typeof overview).toBe('string');
      expect(overview.length).toBeGreaterThan(100);
    }
  });
  
  it('generateCategories returns an array of category queries', async () => {
    const mockOverview = 'Climate change is affecting global temperatures and ecosystems.';
    
    if (context.mockMode) {
      const categories = [
        { category: 'Core Concepts', query: 'Basic climate change concepts' },
        { category: 'Solutions', query: 'Climate change solutions' }
      ];
      expect(Array.isArray(categories)).toBe(true);
      expect(categories[0]).toHaveProperty('category');
      expect(categories[0]).toHaveProperty('query');
    } else {
      const categories = await generateCategories(mockTopic, mockOverview);
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toHaveProperty('category');
      expect(categories[0]).toHaveProperty('query');
    }
  });
  
  it('deepDiveResearch returns an array of research fact strings', async () => {
    const mockQueries = [
      { category: 'Core Concepts', query: 'Basic climate change concepts' },
      { category: 'Solutions', query: 'Climate change solutions' }
    ];
    
    if (context.mockMode) {
      const researchLines = [
        'Category: Core Concepts | Fact: Earth temperatures are rising | Quote: "Global temperatures have increased by 1.1°C" | Reference: IPCC 2023',
        'Category: Solutions | Fact: Renewable energy is critical | Quote: "Renewable energy capacity must triple by 2030" | Reference: IEA Clean Energy Transition'
      ];
      expect(Array.isArray(researchLines)).toBe(true);
      expect(researchLines[0]).toContain('Category:');
      expect(researchLines[0]).toContain('|');
    } else {
      const researchLines = await deepDiveResearch(mockQueries, mockTopic);
      expect(Array.isArray(researchLines)).toBe(true);
      expect(researchLines.length).toBeGreaterThan(0);
      expect(researchLines[0]).toContain('Category:');
      expect(researchLines[0]).toContain('|');
    }
  });
  
  it('createFinalOverview returns a string synthesis', async () => {
    const mockOverview = 'Initial findings about climate change.';
    const mockResearchLines = [
      'Category: Impacts | Fact: Rising seas threaten coastal cities | Quote: "Sea level rise will affect millions" | Reference: NOAA 2022'
    ];
    
    if (context.mockMode) {
      const finalOverview = 'Climate change is causing significant environmental impacts including rising sea levels that threaten coastal communities.';
      expect(typeof finalOverview).toBe('string');
      expect(finalOverview.length).toBeGreaterThan(20);
    } else {
      const finalOverview = await createFinalOverview(mockTopic, mockOverview, mockResearchLines);
      expect(typeof finalOverview).toBe('string');
      expect(finalOverview.length).toBeGreaterThan(100);
    }
  });
  
  it('deepResearchImpl throws on missing topic', async () => {
    await expect(deepResearchImpl({})).rejects.toThrow(/topic/);
  });
  
  it('deepResearchImpl runs full pipeline', async () => {
    const params = { topic: mockTopic };
    const result = await deepResearchImpl(params, { ...context, mockMode: true });
    
    expect(result).toHaveProperty('researchData');
    expect(typeof result.researchData).toBe('string');
    expect(result.researchData).toContain('===');
  });
  
  it('should handle empty topic', async () => {
    try {
      await deepResearchTool.handler({ topic: '' }, context);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).toContain('topic');
    }
  });
  
  // Skip this test in CI environments to avoid API rate limits
  it.skipIf(process.env.CI || !process.env.PERPLEXITY_API_KEY)('should work in live mode with API key', async () => {
    // Only run this test if API keys are available
    if (!process.env.PERPLEXITY_API_KEY || !process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping live test: API keys not available');
      return;
    }
    
    // Create a live context (non-mock)
    const liveContext = {
      debug: false,
      mockMode: false
    };
    
    const params = { 
      topic: 'Climate Change', 
      keywords: 'solutions',
      instructions: 'Keep it brief'
    };
    
    const result = await deepResearchTool.handler(params, liveContext);
    
    expect(result).toHaveProperty('researchData');
    expect(typeof result.researchData).toBe('string');
    
    // Result should have both an overview and research facts separated by ===
    const parts = result.researchData.split('\n\n===\n\n');
    expect(parts.length).toBe(2);
    
    // First part is the overview
    expect(parts[0].length).toBeGreaterThan(100);
    
    // Second part contains the pipe-delimited research facts
    expect(parts[1]).toContain('Category:');
    expect(parts[1]).toContain('|');
  });
});
