import 'dotenv/config';
import 'dotenv/config';
import { describe, it, expect, vi } from 'vitest';
/**
 * Tests for the optimizeSEO tool
 */
import optimizeSEOTool, { 
  optimizeSEOImpl,
  parameters,
  getDataForSEOKeywords,
  // Include other exports we might need to test
  generateExpandedKeywords,
  optimizeTitleWithKeywords
} from '../src/app/tools/optimizeSEO.tool.js';

// Mock the DataForSEO client
vi.mock('dataforseo-client', () => {
  return {
    ApiClient: {
      instance: {
        authentications: {
          basicAuth: {}
        }
      }
    },
    KeywordResearchApi: vi.fn().mockImplementation(() => ({
      keywordResearchV3RelatedKeywordsLive: vi.fn().mockResolvedValue({
        tasks: [{
          result: [{
            items: [
              { keyword: 'climate biodiversity', search_volume: 1000, cpc: 0.5, competition: 0.3 },
              { keyword: 'biodiversity loss effects', search_volume: 800, cpc: 0.7, competition: 0.4 },
              { keyword: 'climate change species extinction', search_volume: 1200, cpc: 0.9, competition: 0.5 }
            ]
          }]
        }]
      })
    }))
  };
});

describe('optimizeSEO Tool', () => {
  // Define helper for uniqueKeywords function
  const uniqueKeywords = (arr) => [...new Set(arr.map(k => k?.trim()).filter(Boolean))];
  // Mock context and data
  const context = { debug: false, mockMode: true };
  
  // Mock input parameters
  const mockTitle = 'Climate Change Impact on Biodiversity';
  const mockDraft = '# Climate Change Impact on Biodiversity\n\nClimate change is affecting biodiversity worldwide. Rising temperatures are forcing species to migrate. Habitat loss is another key factor.\n\n## Impacts\n\nStudies show declining populations of many species.\n\n## Solutions\n\nConservation efforts and policy changes are needed.';
  const mockTargetKeywords = 'climate change,biodiversity loss,ecological impact';
  
  it('should have the correct name and description', () => {
    expect(optimizeSEOTool.name).toBe('optimize_seo');
    expect(optimizeSEOTool.description).toContain('SEO');
  });
  
  it('should optimize content and provide keyword suggestions', async () => {
    const mockResponse = JSON.stringify({
      optimizedTitle: 'Climate Change Impact on Biodiversity: Effects on Global Ecosystems',
      optimizedContent: '# Climate Change Impact on Biodiversity\n\n## Introduction\n\nClimate change is significantly affecting biodiversity worldwide. Rising global temperatures are forcing numerous species to migrate beyond their natural habitats, while accelerating habitat loss threatens thousands of plant and animal species. These ecological impacts have far-reaching consequences for our planet\'s ecosystems.\n\n## Impacts\n\nRecent studies reveal alarming declines in populations across various species groups due to climate-related biodiversity loss. Coral reefs, polar regions, and rainforests are experiencing the most severe ecological impacts.\n\n## Solutions\n\nComprehensive conservation efforts combined with robust policy changes are urgently needed to address biodiversity loss. Protecting critical habitats and implementing sustainable practices can help mitigate the negative effects of climate change on global ecosystems.',
      keywordSuggestions: [
        {"keyword": "global warming", "relevance": 9, "currentUsage": 0, "suggestedUsage": 2, "placement": "body"},
        {"keyword": "species extinction", "relevance": 8, "currentUsage": 0, "suggestedUsage": 2, "placement": "body"},
        {"keyword": "ecological impact", "relevance": 9, "currentUsage": 0, "suggestedUsage": 3, "placement": "heading+body"},
        {"keyword": "biodiversity loss", "relevance": 10, "currentUsage": 0, "suggestedUsage": 4, "placement": "heading+body"},
        {"keyword": "habitat destruction", "relevance": 7, "currentUsage": 0, "suggestedUsage": 2, "placement": "body"}
      ],
      seoScore: 65,
      seoImprovements: [
        "Added more semantically relevant keywords",
        "Improved heading structure with H2 sections",
        "Expanded content length for better depth",
        "Added ecosystem references for relevance",
        "Incorporated target keywords naturally throughout"
      ]
    });
    
    const callLLMMock = vi.fn().mockResolvedValue(mockResponse);
    
    const params = {
      title: mockTitle,
      draft: mockDraft,
      targetKeywords: mockTargetKeywords
    };
    
    const result = await optimizeSEOImpl(params, {
      ...context,
      callLLM: callLLMMock,
      // No DataForSEO credentials in this test
      DATAFORSEO_LOGIN: undefined,
      DATAFORSEO_PASSWORD: undefined
    });
    
    // Check that all expected fields are returned
    expect(result).toHaveProperty('optimizedTitle');
    expect(result).toHaveProperty('optimizedContent');
    expect(result).toHaveProperty('keywordSuggestions');
    expect(result).toHaveProperty('seoScore');
    expect(result).toHaveProperty('seoImprovements');
    expect(result).toHaveProperty('dataSource');
    
    // Test for optimized title - should be different from original
    expect(result.optimizedTitle).not.toBe(mockTitle);
    expect(result.optimizedTitle).toContain('Ecosystems');
    
    // Verify content was optimized
    expect(result.optimizedContent.length).toBeGreaterThan(mockDraft.length);
    
    // Verify keyword suggestions
    expect(Array.isArray(result.keywordSuggestions)).toBe(true);
    expect(result.keywordSuggestions.length).toBeGreaterThan(0);
    expect(result.keywordSuggestions[0]).toHaveProperty('keyword');
    expect(result.keywordSuggestions[0]).toHaveProperty('relevance');
    
    // Verify SEO score and improvements
    expect(typeof result.seoScore).toBe('number');
    expect(Array.isArray(result.seoImprovements)).toBe(true);
    expect(result.dataSource).toBe('Claude'); // Should be Claude since no API was used
    
    // Verify that all parameters were included in the prompt
    const promptArg = callLLMMock.mock.calls[0][0];
    expect(promptArg).toContain(mockTitle);
    expect(promptArg).toContain(mockDraft);
    expect(promptArg).toContain(mockTargetKeywords);
    expect(promptArg).toContain('No keyword research data available');
  });
  
  it('should handle optional targetKeywords parameter', async () => {
    const mockResponse = JSON.stringify({
      optimizedTitle: 'Climate Change and Biodiversity: A Comprehensive Analysis',
      optimizedContent: '# Climate Change Impact on Biodiversity\n\nImproved content without target keywords.',
      keywordSuggestions: [{ keyword: 'test' }],
      seoScore: 60,
      seoImprovements: ['Test improvement']
    });
    
    const callLLMMock = vi.fn().mockResolvedValue(mockResponse);
    
    // Test without target keywords
    const minimalParams = {
      title: mockTitle,
      draft: mockDraft
    };
    
    const result = await optimizeSEOImpl(minimalParams, {
      ...context,
      callLLM: callLLMMock
    });
    
    expect(result).toHaveProperty('optimizedContent');
    expect(result).toHaveProperty('keywordSuggestions');
    expect(result).toHaveProperty('dataSource');
    
    // Verify that the prompt handles missing keywords
    const promptArg = callLLMMock.mock.calls[0][0];
    expect(promptArg).toContain('None specified');
  });
  
  it('should handle errors gracefully', async () => {
    const callLLMError = vi.fn().mockRejectedValue(new Error('API error'));
    
    const params = {
      title: mockTitle,
      draft: mockDraft,
      targetKeywords: mockTargetKeywords
    };
    
    const result = await optimizeSEOImpl(params, {
      ...context,
      callLLM: callLLMError
    });
    
    // Should return the original content and title on error
    expect(result.optimizedContent).toBe(mockDraft);
    expect(result.optimizedTitle).toBe(mockTitle);
    
    // Should still provide some basic keyword suggestions and improvements
    expect(Array.isArray(result.keywordSuggestions)).toBe(true);
    expect(typeof result.seoScore).toBe('number');
    expect(Array.isArray(result.seoImprovements)).toBe(true);
  });
  
  it('should integrate with DataForSEO when credentials are provided', async () => {
    // Mock response for DataForSEO integration test
    const mockResponse = JSON.stringify({
      optimizedTitle: 'Climate Change and Biodiversity Conservation: A Critical Analysis',
      optimizedContent: '# Climate Change Impact on Biodiversity\n\nOptimized with DataForSEO keywords.',
      keywordSuggestions: [{ keyword: 'biodiversity conservation', relevance: 9 }],
      seoScore: 75,
      seoImprovements: ['Incorporated DataForSEO keywords']
    });
    
    const callLLMMock = vi.fn().mockResolvedValue(mockResponse);
    
    // Since we mocked the DataForSEO client, we don't need actual credentials
    // The test will use our mock implementation
    const params = {
      title: mockTitle,
      draft: mockDraft,
      targetKeywords: mockTargetKeywords
    };
    
    const result = await optimizeSEOImpl(params, {
      ...context,
      callLLM: callLLMMock,
      DATAFORSEO_LOGIN: 'test_login',
      DATAFORSEO_PASSWORD: 'test_password'
    });
    
    // Check that all expected fields are returned
    expect(result).toHaveProperty('optimizedTitle');
    expect(result).toHaveProperty('optimizedContent');
    expect(result).toHaveProperty('keywordSuggestions');
    expect(result).toHaveProperty('dataSource');
    
    // Should include DataForSEO in the data source
    expect(result.dataSource).toContain('DataForSEO');
    
    // Check for optimized title
    expect(result.optimizedTitle).toContain('Conservation');
    
    // Verify keyword suggestions contain data from API
    const promptArg = callLLMMock.mock.calls[0][0];
    expect(promptArg).toContain('KEYWORD RESEARCH DATA');
    expect(promptArg).not.toContain('No keyword research data available');
    expect(promptArg).toContain('climate biodiversity');
  });
  
  // Skip this test in CI environments to avoid API rate limits
  it.skipIf(process.env.CI || !process.env.ANTHROPIC_API_KEY || !process.env.DATAFORSEO_LOGIN)('should work in live mode with API key', async () => {
    // Only run this test if API keys are available
    const haveRequiredKeys = process.env.ANTHROPIC_API_KEY && process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD;
    if (!haveRequiredKeys) {
      console.log('Skipping live test: Required API keys not available');
      return;
    }
    
    const liveContext = { debug: false, mockMode: false };
    
    // Use minimal test content
    const minimalDraft = '# Test SEO Article\n\nThis is a test article about search engine optimization.';
    
    const params = { 
      title: 'SEO Best Practices',
      draft: minimalDraft,
      targetKeywords: 'SEO,optimization'
    };
    
    const result = await optimizeSEOTool.handler(params, liveContext);
    
    expect(result).toHaveProperty('optimizedTitle');
    expect(result).toHaveProperty('optimizedContent');
    expect(result).toHaveProperty('keywordSuggestions');
    expect(result).toHaveProperty('seoScore');
    expect(result).toHaveProperty('seoImprovements');
    expect(result).toHaveProperty('dataSource');
  });
  
  // Add test for the title optimization functionality
  it('should optimize article titles with keywords', async () => {
    const mockKeywords = [
      {keyword: 'biodiversity loss', relevance: 10},
      {keyword: 'ecosystem impact', relevance: 9},
      {keyword: 'global warming effects', relevance: 8}
    ];
    
    const mockResponse = JSON.stringify({
      optimizedTitle: 'Climate Change and Biodiversity Loss: Ecosystem Impacts',
      keywordsUsed: ['biodiversity loss', 'ecosystem impact']
    });
    
    const callLLMMock = vi.fn().mockResolvedValue(mockResponse);
    
    const result = await optimizeSEOImpl(
      { title: mockTitle, draft: mockDraft },
      { ...context, callLLM: callLLMMock }
    );
    
    // Verify the title was optimized
    expect(result).toHaveProperty('optimizedTitle');
    expect(result.optimizedTitle).not.toBe(mockTitle);
    expect(result.optimizedTitle).toContain('Biodiversity Loss');
  });
});
