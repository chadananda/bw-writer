import 'dotenv/config';
import { debugLog } from '../src/framework/log.js';
import { describe, it, expect } from 'vitest';
/**
 * Tests for the analyzeRequest tool
 */
import analyzeRequestTool, {
  analyzeRequestImpl,
  extractTopic,
  extractWritingStyle,
  extractInstructions,
  extractImageStyle,
  extractCombinedMetadata
} from '../src/app/tools/analyzeRequest.tool.js';

describe('analyzeRequest Tool', () => {
  // Context for testing with debug logging
  const context = {
    debug: true
  };

  const samplePrompt = `
Hey, I've been thinking about getting an article written about climate change. You know, something that really digs into what's been happening lately with all exaggeration in the press and all the grifting by lobbyists and politicians and non-profits who take billions of dollars from taxpayers and give it to their friends and allies.

I'm thinking this should be substantial - maybe around 2000 words or so? Not too technical though - I want regular people to understand it, but still have some academic credibility, you know what I mean?

Oh, and I'd like it to be authored by Dr. Sarah Chen. She's an environmental scientist and economist with a knack for making complex topics approachable and follow the money. Her writing typically weaves in personal anecdotes with hard data. She's got that perfect blend of authority and relatability that I'm looking for.

I think readers would be interested in things like who is getting rich from carbon credits, renewable transition casts, climate justice excuses, and maybe what the real tipping points might be that non-institutional economists keep warning about. And definitely include some fresh statistics and mention how policies are evolving - and who is getting rich!

Our site uses a cool pen and ink style for article pictures which has touches of color that look like watercolor wash.

Basically, I want something that'll make people think, but not something so depressing that they lose hope. Does that make sense?
`;

  it('should have the correct name and description', () => {
    expect(analyzeRequestTool.name).toBe('analyze_request');
    expect(analyzeRequestTool.description).toBeTruthy();
  });

  it('should extract topic correctly', { timeout: 15000 }, async () => {
    const result = await extractTopic(samplePrompt, context);
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('topic');
    expect(result.topic.toLowerCase()).toContain('climate');
  });

  it('should extract writing style correctly', { timeout: 15000 }, async () => {
    const result = await extractWritingStyle(samplePrompt, context);
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('style');
    // Use a regex pattern to match any of several likely style-related terms
    expect(result.style.toLowerCase()).toMatch(/(informative|conversational|authoritative|accessible|engaging|approachable)/);
  });

  it('should extract instructions correctly', { timeout: 15000 }, async () => {
    const result = await extractInstructions(samplePrompt, context);
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('instructions');
    
    // With structured output, the climate change topic should always be present
    const instructionsText = typeof result.instructions === 'string' ? 
      result.instructions.toLowerCase() : 
      String(result.instructions).toLowerCase();
    expect(instructionsText).toMatch(/(climate)/);
  });

  it('should extract image style as a string if present', { timeout: 15000 }, async () => {
    const result = await extractImageStyle(samplePrompt, context);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
  it('should return empty string for image style if not present', async () => {
    const result = await extractImageStyle('Write an article about climate change.', context);
    expect(result).toBe('');
  });

  it('should extract combined metadata correctly', { timeout: 15000 }, async () => {
    const metadata = await extractCombinedMetadata(samplePrompt, context);
    expect(typeof metadata).toBe('object');
    expect(metadata).toHaveProperty('title');
    expect(metadata).toHaveProperty('keywords');
    expect(metadata).toHaveProperty('targetLen');
    expect(metadata).toHaveProperty('author');
    expect(metadata).toHaveProperty('extraMeta');
    expect(Number(metadata.targetLen)).toBeGreaterThan(1000);
    expect(Array.isArray(metadata.keywords)).toBe(true);
    expect(metadata.keywords.some(k => k.toLowerCase().includes('climate') ||
                             k.toLowerCase().includes('carbon') ||
                             k.toLowerCase().includes('warming'))).toBeTruthy();
    expect(typeof metadata.title).toBe('string');
    expect(metadata.title.length).toBeGreaterThan(0);
  });
  it('should return empty title and keywords if not present', async () => {
    const metadata = await extractCombinedMetadata('Just write an article.', context);
    expect(metadata.title).toBe('');
    expect(Array.isArray(metadata.keywords)).toBe(true);
    expect(metadata.keywords.length).toBe(0);
  });

  it('should handle empty prompts gracefully', async () => {
    const emptyResult = await analyzeRequestImpl({ userPrompt: '' }, context);
    expect(emptyResult).toHaveProperty('topic');
    expect(emptyResult).toHaveProperty('title');
    expect(emptyResult).toHaveProperty('author');
    expect(emptyResult).toHaveProperty('style');
    expect(emptyResult).toHaveProperty('keywords');
    expect(emptyResult).toHaveProperty('targetLen');
    expect(emptyResult).toHaveProperty('instructions');
    expect(emptyResult).toHaveProperty('imageStyle');
    expect(emptyResult).toHaveProperty('extraMeta');
  });

  it('should return all expected fields from analyzeRequestImpl', { timeout: 15000 }, async () => {
    const params = { userPrompt: samplePrompt };
    const result = await analyzeRequestImpl(params, context);

    expect(result).toHaveProperty('topic');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('author');
    expect(result).toHaveProperty('style');
    expect(result).toHaveProperty('keywords');
    expect(result).toHaveProperty('targetLen');
    expect(result).toHaveProperty('instructions');
    expect(result).toHaveProperty('imageStyle');
    expect(result).toHaveProperty('extraMeta');

    // All fields should exist
    Object.values(result).forEach(value => {
      expect(value).not.toBeUndefined();
    });

    // Check specific field content
    expect(result.topic.toLowerCase()).toContain('climate');

    // Keywords should always be an array
    expect(Array.isArray(result.keywords)).toBe(true);
    expect(result.keywords.some(k =>
      k.toLowerCase().includes('climate') ||
      k.toLowerCase().includes('carbon') ||
      k.toLowerCase().includes('warming')
    )).toBeTruthy();

    // Check style contains relevant content - could be writing style or image style
    expect(result.style.toLowerCase()).toMatch(/(academic|approach|access|conversational|informative|pen|ink|watercolor|sketch)/);
    expect(parseInt(result.targetLen)).toBeGreaterThan(1000);

    // Check that author is an object with expected properties
    const authorObj = result.author;
    expect(authorObj).toHaveProperty('name');
    expect(authorObj).toHaveProperty('bio');
    // Link and imgUrl might be optional but should exist
    expect(authorObj).toHaveProperty('link');
    expect(authorObj).toHaveProperty('imgUrl');
  });

  // This test only runs in environments with access to API keys
  it('should work with real LLMs', { timeout: 15000 }, async () => {

    // This test uses real LLM calls
    const realContext = {
      debug: true
    };

    const params = { userPrompt: samplePrompt };
    const result = await analyzeRequestImpl(params, realContext);

    expect(result).toHaveProperty('topic');
    expect(result.topic.toLowerCase()).toContain('climate');

    // Keywords should always be an array
    expect(Array.isArray(result.keywords)).toBe(true);
    expect(result.keywords.some(k =>
      k.toLowerCase().includes('climate') ||
      k.toLowerCase().includes('carbon') ||
      k.toLowerCase().includes('warming')
    )).toBeTruthy();
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

    // Author should be a proper object, not a JSON string
    expect(typeof result.author).toBe('object');
    expect(result.author.name).toContain('Jane');

    expect(Array.isArray(result.keywords)).toBe(true);
    expect(result.keywords.some(k => k.toLowerCase().includes('melting ice caps'))).toBeTruthy();
  });

  it('should extract structured data from documents with YAML and tables', { timeout: 15000 }, async () => {
    // Create a test prompt with YAML frontmatter AND a table structure
    const structuredPrompt = `---
title: Climate Crisis Data Analysis
author:
  name: Dr. Richard Feynman
  bio: Theoretical Physicist
keywords: climate data, analysis, historical trends
targetLen: 2500
custom_field1: special value 1
custom_field2: special value 2
source: Peer-reviewed journals
---

Please write an article analyzing climate data with the following criteria:

| Aspect | Requirement |
|--------|-------------|
| Data Sources | Include data from NASA and NOAA |
| Time Period | Cover 1950-2023 |
| Focus Areas | Arctic ice melt, Sea level rise, Temperature anomalies |
| Visualization | Include 3 charts and 2 tables |

Make sure to address how the data contradicts common misconceptions about climate change.`;

    // Test with direct extractCombinedMetadata call
    const metadata = await extractCombinedMetadata(structuredPrompt, context);
    expect(typeof metadata).toBe('object');
    
    // Verify basic fields are extracted
    expect(metadata.title).toContain('Climate Crisis');
    expect(Number(metadata.targetLen)).toBe(2500);
    expect(metadata.author.name).toContain('Feynman');
    
    // Verify keywords are extracted
    expect(Array.isArray(metadata.keywords)).toBe(true);
    expect(metadata.keywords.some(k => k.toLowerCase().includes('climate'))).toBe(true);
    
    // Verify the result from analyzeRequestImpl has the title
    const result = await analyzeRequestImpl({ userPrompt: structuredPrompt }, context);
    expect(result.title).toContain('Climate');
    
    // Verify instructions were extracted from the table data
    const instructionsText = typeof result.instructions === 'string'
      ? result.instructions.toLowerCase()
      : String(result.instructions).toLowerCase();
    expect(instructionsText).toMatch(/(nasa|noaa|data sources|visualization|charts|tables)/);
  });
});
