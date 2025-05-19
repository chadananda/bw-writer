import 'dotenv/config';
import { debugLog } from '../src/framework/log.js';
debugLog('OPENAI_API_KEY loaded:', process.env.OPENAI_API_KEY ? '[set]' : '[not set]');
import { describe, it, expect } from 'vitest';
/**
 * Tests for the analyzeRequest tool
 */
import analyzeRequestTool, { 
  analyzeRequestImpl, 
  extractTopic,
  extractStyle,
  extractInstructions,
  extractImageStyle,
  extractCombinedMetadata
} from '../src/app/tools/analyzeRequest.tool.js';

describe('analyzeRequest Tool', () => {
  // Mock context for testing
  const context = {
    debug: false,
    mockMode: true
  };

  const samplePrompt = `
# Write an article about climate change
I need a comprehensive article about climate change focusing on recent developments.
Keywords: global warming, paris agreement, carbon emissions
Style: Academic but accessible
Length: Around 2000 words
Include recent statistics and policy changes.
`;

  it('should have the correct name and description', () => {
    expect(analyzeRequestTool.name).toBe('analyze_request');
    expect(analyzeRequestTool.description).toBeTruthy();
  });

  it('should extract topic correctly', async () => {
    const result = await extractTopic(samplePrompt, context);
    expect(typeof result).toBe('string');
    expect(result.toLowerCase()).toContain('climate change');
  });

  it('should extract style correctly', async () => {
    const result = await extractStyle(samplePrompt, context);
    expect(typeof result).toBe('string');
    expect(result.toLowerCase()).toContain('academic');
  });

  it('should extract instructions correctly', async () => {
    const result = await extractInstructions(samplePrompt, context);
    expect(typeof result).toBe('string');
    expect(result).toContain('recent');
  });

  it('should extract image style with default when not specified', async () => {
    const result = await extractImageStyle(samplePrompt, context);
    expect(typeof result).toBe('string');
  });

  it('should extract combined metadata correctly', async () => {
    const result = await extractCombinedMetadata(samplePrompt, context);
    expect(typeof result).toBe('string');
    
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('title');
    expect(parsed).toHaveProperty('keywords');
    expect(parsed).toHaveProperty('targetLen');
    expect(parsed).toHaveProperty('author');
    expect(parsed).toHaveProperty('meta');
    
    expect(parsed.targetLen).toBeGreaterThan(1000);
    expect(parsed.keywords.toLowerCase()).toContain('global warming');
  });

  it('should handle empty prompts gracefully', async () => {
    const emptyResult = await analyzeRequestImpl({ userPrompt: '' }, context);
    expect(emptyResult).toHaveProperty('topic');
    expect(emptyResult).toHaveProperty('title');
    expect(emptyResult).toHaveProperty('author');
    expect(emptyResult).toHaveProperty('style');
    expect(emptyResult).toHaveProperty('keywords');
    expect(emptyResult).toHaveProperty('wordCount');
    expect(emptyResult).toHaveProperty('instructions');
    expect(emptyResult).toHaveProperty('imageStyle');
    expect(emptyResult).toHaveProperty('extraMeta');
  });

  it('should return all expected fields from analyzeRequestImpl', async () => {
    const params = { userPrompt: samplePrompt };
    const result = await analyzeRequestImpl(params, context);
    
    expect(result).toHaveProperty('topic');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('author');
    expect(result).toHaveProperty('style');
    expect(result).toHaveProperty('keywords');
    expect(result).toHaveProperty('wordCount');
    expect(result).toHaveProperty('instructions');
    expect(result).toHaveProperty('imageStyle');
    expect(result).toHaveProperty('extraMeta');

    // Ensure all values are strings for LLM compatibility
    Object.values(result).forEach(value => {
      expect(typeof value).toBe('string');
    });
    
    // Check specific field content
    expect(result.topic.toLowerCase()).toContain('climate');
    expect(result.keywords.toLowerCase()).toContain('global warming');
    expect(result.style.toLowerCase()).toContain('academic');
    expect(parseInt(result.wordCount)).toBeGreaterThan(1000);
    
    // Check that author is a valid JSON string
    const authorObj = JSON.parse(result.author);
    expect(authorObj).toHaveProperty('name');
    expect(authorObj).toHaveProperty('bio');
    expect(authorObj).toHaveProperty('link');
    expect(authorObj).toHaveProperty('imgUrl');
  });

  // This test only runs in environments with access to API keys
  it.skipIf(process.env.CI || !process.env.ANTHROPIC_API_KEY)('should work with real LLMs', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping live test: No ANTHROPIC_API_KEY available');
      return;
    }
    
    const liveContext = {
      debug: false,
      mockMode: false
    };
    
    const params = { userPrompt: samplePrompt };
    const result = await analyzeRequestTool.handler(params, liveContext);
    
    expect(result).toHaveProperty('topic');
    expect(result.topic.toLowerCase()).toContain('climate');
    expect(result.keywords.toLowerCase()).toContain('global warming');
  });

  it('should extract YAML frontmatter if present', async () => {
    const yamlPrompt = `---
title: Climate Crisis
author: 
  name: Dr. Jane Smith
  bio: Environmental Scientist
keywords: melting ice caps, sea level rise, extreme weather
---

Please write an in-depth article about the effects of climate change.`;

    const result = await analyzeRequestImpl({ userPrompt: yamlPrompt }, context);
    
    expect(result.title.toLowerCase()).toContain('climate');
    
    const authorObj = JSON.parse(result.author);
    expect(authorObj.name).toContain('Jane');
    
    expect(result.keywords.toLowerCase()).toContain('melting ice caps');
  });
});
