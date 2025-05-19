/**
 * Tests for the generateProposals tool
 */
import { describe, it, expect } from 'vitest';
import generateProposalsTool, {
  parseResearchData,
  buildProposalsPrompt,
  generateProposals,
  selectBestProposal,
  generateTitleOptions,
  selectBestTitle,
  generateProposalsImpl,
  parameters
} from '../src/app/tools/generateProposals.tool.js';
import { z } from 'zod';

describe('generateProposals Tool', () => {
  it('should export all core functions for testing', () => {
    expect(typeof parseResearchData).toBe('function');
    expect(typeof buildProposalsPrompt).toBe('function');
    expect(typeof generateProposals).toBe('function');
    expect(typeof selectBestProposal).toBe('function');
    expect(typeof generateTitleOptions).toBe('function');
    expect(typeof selectBestTitle).toBe('function');
    expect(typeof generateProposalsImpl).toBe('function');
    expect(parameters).toBeInstanceOf(Object);
  });

  // Mock research data in string format
  const mockOverview = "Climate change is the long-term alteration of temperature and typical weather patterns. It is primarily caused by human activities, especially the burning of fossil fuels.";
  const mockFacts = [
    "Category: Overview | Fact: Climate change is accelerating faster than previously predicted | Quote: \"Recent data suggests climate change is occurring at a pace faster than most climate models predicted\" | Reference: IPCC Report 2023",
    "Category: Impacts | Fact: Sea levels continue to rise at an alarming rate | Quote: \"Global mean sea level increased by 0.2m between 1901 and 2018\" | Reference: NASA Global Climate Change",
    "Category: Solutions | Fact: Renewable energy costs have fallen dramatically | Quote: \"Solar PV costs decreased by 85% between 2010 and 2020\" | Reference: International Renewable Energy Agency"
  ];
  const mockResearchData = `${mockOverview}\n\n===\n\n${mockFacts.join('\n')}`;

  // Mock context for testing
  const context = {
    debug: false,
    mockMode: true
  };

  it('should have valid parameters schema', () => {
    expect(parameters).toBeInstanceOf(Object);
    // Validate that the schema has the expected properties
    expect(parameters.shape).toHaveProperty('topic');
    expect(parameters.shape).toHaveProperty('researchData');
    expect(parameters.shape).toHaveProperty('style');
    expect(parameters.shape).toHaveProperty('author');
    expect(parameters.shape).toHaveProperty('targetLen');
  });

  it('should correctly parse research data string', () => {
    const { overview, facts } = parseResearchData(mockResearchData);
    expect(overview).toBe(mockOverview);
    expect(Array.isArray(facts)).toBe(true);
    expect(facts.length).toBe(3);
    expect(facts[0]).toContain('Category: Overview');
  });

  it('should compose a detailed LLM prompt for proposals', () => {
    const params = { 
      topic: 'Climate Change', 
      researchData: mockResearchData, 
      style: 'informative',
      author: '{}',
      targetLen: '1500'
    };
    const prompt = buildProposalsPrompt(params);
    expect(prompt).toMatch(/TOPIC:/i);
    expect(prompt).toMatch(/RESEARCH OVERVIEW:/i);
    expect(prompt).toMatch(/RESEARCH FACTS:/i);
    expect(prompt).toMatch(/Climate Change/);
    expect(prompt).toMatch(/1500 words/);
  });

  it('should generate mock proposals with detailed, engaging titles and descriptions', async () => {
    const params = { 
      topic: 'Climate Change', 
      researchData: mockResearchData, 
      style: 'informative',
      author: '{}',
      targetLen: '1500'
    };
    const result = await generateProposals(params, { mockMode: true });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const proposal of result) {
      expect(typeof proposal.title).toBe('string');
      expect(typeof proposal.description).toBe('string');
      expect(proposal.title.length).toBeGreaterThan(10);
      expect(proposal.description.length).toBeGreaterThan(30);
    }
  });

  it('should select the best proposal (mock mode)', async () => {
    const proposals = [
      { title: 'Best Title', description: 'Best description of the approach.' },
      { title: 'Other Title', description: 'Other description.' }
    ];
    const params = { topic: 'Climate Change', style: 'informative', targetLen: '1500' };
    const best = await selectBestProposal(proposals, params, { mockMode: true });
    expect(best).toHaveProperty('title');
    expect(best).toHaveProperty('description');
  });

  it('should generate multiple title options (mock mode)', async () => {
    const proposal = { 
      title: 'Climate Change Solutions', 
      description: 'A detailed exploration of the most promising solutions to climate change.' 
    };
    const params = { 
      topic: 'Climate Change', 
      researchData: mockResearchData, 
      style: 'informative' 
    };
    const titleOptions = await generateTitleOptions(proposal, params, { mockMode: true });
    expect(Array.isArray(titleOptions)).toBe(true);
    expect(titleOptions.length).toBeGreaterThanOrEqual(1);
    expect(typeof titleOptions[0]).toBe('string');
  });

  it('should select the best title (mock mode)', async () => {
    const titleOptions = [
      'The Comprehensive Guide to Climate Change Solutions',
      'Tackling the Climate Crisis: Effective Solutions for a Sustainable Future',
      'Climate Solutions: A Roadmap for Action'
    ];
    const proposal = { 
      title: 'Climate Change Solutions', 
      description: 'A detailed exploration of the most promising solutions to climate change.' 
    };
    const params = { topic: 'Climate Change', style: 'informative' };
    const bestTitle = await selectBestTitle(titleOptions, proposal, params, { mockMode: true });
    expect(typeof bestTitle).toBe('string');
    expect(bestTitle.length).toBeGreaterThan(10);
  });

  it('should run the full generateProposalsImpl pipeline (mock mode)', async () => {
    const params = { 
      topic: 'Climate Change', 
      researchData: mockResearchData, 
      style: 'informative',
      author: '{}',
      targetLen: '1500'
    };
    const result = await generateProposalsImpl(params, { mockMode: true });
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('description');
    expect(typeof result.title).toBe('string');
    expect(typeof result.description).toBe('string');
  });

  // Skip this test in CI environments to avoid API rate limits
  it.skipIf(process.env.CI)('should work in live mode with API key', async () => {
    // Only run this test if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping live test: No ANTHROPIC_API_KEY available');
      return;
    }
    
    // Create a live context (non-mock)
    const liveContext = {
      debug: false,
      mockMode: false
    };
    
    const params = { 
      topic: 'Climate Change', 
      researchData: mockResearchData,
      style: 'informative',
      author: '{}',
      targetLen: '1500'
    };
    
    const result = await generateProposalsTool.handler(params, liveContext);
    
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('description');
    expect(typeof result.title).toBe('string');
    expect(typeof result.description).toBe('string');
  });
});
