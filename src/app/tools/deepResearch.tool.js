/**
 * deepResearch Tool (bw-writer MCP)
 *
 * Input:
 * - topic: Main research topic string
 * - keywords: Comma-delimited list to focus the research
 * - instructions: Additional research guidance
 *
 * Output:
 * - researchData: Single string with overview + pipe-delimited research facts
 *
 * Uses Perplexity for web search-backed research and Claude 3.7 for organization.
 */
import { callLLM } from '../../framework/llm-utils.js';
import { debugLog } from '../../framework/log.js';
import { createTool } from '../../framework/utils.js';
import pLimit from 'p-limit';
import { z } from 'zod';

// Concurrency limit for parallel research requests
const limit = pLimit(3);

// Tool metadata
const TOOL_NAME = 'deep_research';
const TOOL_DESCRIPTION = 'Research a topic and gather comprehensive facts and citations.';
const REQUIRED_KEYS = ['PERPLEXITY_API_KEY', 'ANTHROPIC_API_KEY'];



// String-based parameter schema
const parameters = z.object({
  topic: z.string().describe('The main topic to research'),
  keywords: z.string().describe('Comma-delimited list of keywords to focus research').default(''),
  instructions: z.string().describe('Additional guidance for research direction').optional().default(''),
});

// Schemas for JSON response validation
const categorySchema = z.array(z.object({
  category: z.string(),
  query: z.string()
}));

const factSchema = z.array(z.object({
  fact: z.string(),
  quote: z.string(),
  reference: z.string()
}));

/**
 * Stage 1: Initial Research using Perplexity's web search capabilities
 * @param {string} topic - Main research topic
 * @param {string} keywords - Comma-delimited list of keywords
 * @param {string} instructions - Additional research guidance
 * @returns {Promise<string>} - Initial research with citations
 */
export async function initialResearch(topic, keywords = '', instructions = '', context = {}) {
  const debug = context.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true';
  // Format keywords and instructions for better search context
  const keywordsList = keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : [];
  const keywordsText = keywordsList.length > 0 ? `\nFocus on these aspects: ${keywordsList.join(', ')}` : '';
  const instructionsText = instructions ? `\nSpecial requirements: ${instructions}` : '';

  // Create search-optimized prompt for Perplexity
  const prompt = `As a research assistant, conduct comprehensive web research on this topic:

TOPIC: ${topic}${keywordsText}${instructionsText}

Provide a detailed analysis with recent information, facts, statistics, and direct citations from reputable sources. Include multiple perspectives where relevant.`;

  if (debug) debugLog('initialResearch callLLM prompt:', prompt, 'model:', 'perplexity');
  // Use Perplexity with web search capability
  return await callLLM(prompt, 'perplexity');
}

/**
 * Stage 2: Generate category queries for focused research using Claude 3.7
 * @param {string} topic - Research topic
 * @param {string} overview - Initial research overview
 * @returns {Promise<Array>} - Category query objects
 */
export async function generateCategories(topic, overview, context = {}) {
  const debug = context.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true';
  if (debug) debugLog('generateCategories invoked for topic:', topic);
  // Essential research categories for comprehensive coverage
  const categories = [
    'Core Concepts & Definitions',
    'Historical Context & Development',
    'Current Trends & Innovations',
    'Key Statistics & Data Points',
    'Expert Opinions & Perspectives',
    'Practical Applications',
    'Controversies & Challenges'
  ];

  // Craft prompt for Claude 3.7 with JSON response format
  const prompt = `You are a research assistant generating targeted research queries.

==========
RESEARCH TOPIC:
==========
${topic}

==========
KEYWORDS:
==========
${keywords || 'None provided'}

==========
CATEGORIES:
==========
${categories.map(cat => `- ${cat}`).join('\n')}

==========
INITIAL OVERVIEW:
==========
${overview.substring(0, 2000)}

==========
TASK:
==========
Create targeted research queries for the categories listed above. For each category, generate a clear, specific query that will yield valuable insights about the topic.

Return a JSON array where each object has the following structure:
- "category": The name of the category
- "query": A specific, focused query for that category

Generate queries for all categories that are relevant to the topic.`;

  try {
    // Use Claude 3.7 with JSON mode and schema validation
    if (debug) debugLog('generateCategories callLLM prompt:', prompt, 'model:', CLAUDE_3_7_CONFIG, 'response_format: json', 'schema:', categorySchema);
    const result = await callLLM(prompt, {
      ...CLAUDE_3_7_CONFIG,
      response_format: 'json',
      schema: categorySchema
    });
    if (debug) debugLog('generateCategories LLM result:', result);
    if (!Array.isArray(result)) {
      if (debug) debugLog('generateCategories: LLM result is not array:', result);
      throw new Error('LLM did not return array of categories');
    }
    return result;
  } catch (e) {
    if (debug) debugLog('Error generating categories:', e);
    // Fallback to basic queries if there's an error
    return categories.map(cat => ({
      category: cat,
      query: `${cat} related to ${topic}`
    }));
  }
}

/**
 * Stage 3: Deep research on each category using Perplexity's web search
 * @param {Array} categoryQueries - Category query objects
 * @param {string} topic - Main research topic
 * @returns {Promise<Array<string>>} - Research findings by category
 */
export async function deepDiveResearch(categoryQueries, topic, context = {}) {
  const debug = context.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true';
  if (debug) debugLog('deepDiveResearch invoked for topic:', topic, 'categoryQueries:', categoryQueries);
  const researchLines = [];

  await Promise.all(
    categoryQueries.map(({ category, query }) =>
      limit(async () => {
        // Create search query focused on this category
        // Prompt designed for web search-backed research
        const prompt = `You are conducting research on a specific topic category.

==========
TOPIC:
==========
${topic}

==========
CATEGORY:
==========
${category}

==========
FOCUS QUERY:
==========
${query}

==========
TASK:
==========
Find 3-5 key facts from credible web sources related to this topic and category.

For each fact, provide:
1. A concise fact summary (1-2 sentences)
2. A direct quote from a reputable source supporting this fact
3. Complete reference information for the source

Return your findings as a JSON array where each object contains:
- "fact": The concise fact summary
- "quote": The supporting quote
- "reference": The citation information`;

        try {
          // Use Perplexity for deep research on this category
          if (debug) debugLog('deepDiveResearch callLLM prompt:', prompt, 'model:', 'perplexity', 'response_format: json', 'schema:', factSchema);
          if (debug) debugLog('deepDiveResearch callLLM options:', { model: 'perplexity', response_format: 'json', schema: factSchema });
          const facts = await callLLM(prompt, 'perplexity', { response_format: 'json', schema: factSchema });
          if (debug) debugLog(`deepDiveResearch LLM facts for category ${category}:`, facts);
          if (!Array.isArray(facts)) {
            if (debug) debugLog(`deepDiveResearch: LLM facts is not array for category ${category}:`, facts);
            throw new Error('LLM did not return array of facts');
          }
          facts.forEach(f => {
            // Format with pipe delimiters, escaping any pipe characters in content
            researchLines.push(
              `Category: ${category} | Fact: ${(f.fact||'').replace(/\|/g,'/')} | Quote: "${(f.quote||'').replace(/\|/g,'/')}" | Reference: ${(f.reference||'').replace(/\|/g,'/')}`
            );
          });
        } catch (e) {
          if (debug) debugLog(`Error researching category ${category}:`, e);
          // Add fallback entry for this category
          researchLines.push(
            `Category: ${category} | Fact: Error retrieving research data | Quote: "N/A" | Reference: Error during web search`
          );
        }
      })
    )
  );

  return researchLines;
}

/**
 * Stage 4: Create comprehensive final overview using Claude 3 Opus
 * @param {string} topic - Research topic
 * @param {string} initialOverview - Initial research
 * @param {Array<string>} researchLines - Detailed research findings
 * @returns {Promise<string>} - Synthesized comprehensive overview
 */
export async function createFinalOverview(topic, initialOverview, researchLines, context = {}) {
  const debug = context.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true';
  if (debug) debugLog('createFinalOverview invoked for topic:', topic);
  // Create a synthesis prompt with initial overview and key findings
  const prompt = `You are creating a comprehensive research overview.

==========
TOPIC:
==========
${topic}

==========
INITIAL RESEARCH:
==========
${initialOverview.substring(0, 1500)}

==========
KEY FINDINGS:
==========
${researchLines.slice(0, 15).join('\n')}

==========
TASK:
==========
Synthesize the above information into a well-structured, factual overview that covers the most important aspects, trends, perspectives, and includes proper citations.

IMPORTANT GUIDELINES:
- Be thorough but concise
- Present information in a logical flow
- Include the most significant insights from the research
- Ensure all factual claims are supported by the research
- Format your response as a single cohesive prose overview without headings or sections
- Do not use markdown or other formatting, just plain text`;

  try {
    // Use Claude 3 Opus for high-quality synthesis
    if (debug) debugLog('createFinalOverview callLLM prompt:', prompt, 'model:', 'anthropic');
    const finalOverview = await callLLM(prompt, 'anthropic');
    return finalOverview;
  } catch (e) {
    console.error('Error creating final overview:', e);
    return initialOverview; // Fallback to initial overview if synthesis fails
  }
}

/**
 * Main implementation function - processes string inputs and returns single string output
 * @param {Object} params - Tool parameters
 * @param {Object} context - Context object
 * @returns {Object} - Object with single researchData string
 */
export async function deepResearchImpl(params, context = {}) {
  const debug = context.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true';
  if (debug) debugLog('deepResearchImpl called with params:', params);
  if (debug) debugLog('PERPLEXITY_API_KEY:', process.env.PERPLEXITY_API_KEY ? 'set' : 'missing', 'ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'set' : 'missing');
  // Extract parameters with defaults
  const { topic, keywords = '', instructions = '' } = params;

  // Validate required parameters
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    throw new Error("Parameter 'topic' is required and must be a non-empty string");
  }

  try {
    // Stage 1: Get initial research with Perplexity web search
    if (debug) debugLog('Stage 1: initialResearch');
    const initialOverview = await initialResearch(topic, keywords, instructions, context);

    // Stage 2: Generate category queries with Claude 3.7
    if (debug) debugLog('Stage 2: generateCategories');
    const categoryQueries = await generateCategories(topic, initialOverview, context);

    // Stage 3: Conduct deep research on each category with Perplexity
    if (debug) debugLog('Stage 3: deepDiveResearch');
    const researchLines = await deepDiveResearch(categoryQueries, topic, context);

    // Stage 4: Create final comprehensive overview with Claude 3 Opus
    if (debug) debugLog('Stage 4: createFinalOverview');
    const finalOverview = await createFinalOverview(topic, initialOverview, researchLines, context);

    // Combine overview with research data in the specified format
    const researchData = `${finalOverview}\n\n===\n\n${researchLines.join('\n')}`;

    // Return only the researchData string
    return { researchData };
  } catch (error) {
    console.error('Research error:', error);
    return {
      researchData: `Error researching topic "${topic}": ${error.message || 'Unknown error'}`
    };
  }
}

// Export the tool definition
export default createTool({
  name: TOOL_NAME,
  description: TOOL_DESCRIPTION,
  parameters,
  handler: deepResearchImpl,
  keys: REQUIRED_KEYS
});
