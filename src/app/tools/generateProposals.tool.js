/**
 * generateProposals Tool (bw-writer MCP)
 * -------------------------------------
 * Input:
 * - topic: Main article topic string
 * - researchData: String containing research overview and pipe-delimited facts
 * - style: Writing style (informative, conversational, academic, persuasive)
 * - author: Author information as JSON string
 * - targetLen: Target article length in words
 *
 * Output:
 * - title: Best article title
 * - description: Description of the article angle/approach
 */
import { createTool } from '../framework/utils.js';
import { callLLM } from '../framework/index.js';
import { z } from 'zod';

// Tool metadata
const TOOL_NAME = 'generate_proposals';
const TOOL_DESCRIPTION = 'Generate potential angles for an article based on research.';
const REQUIRED_KEYS = ['ANTHROPIC_API_KEY'];

// String-based parameter schema
export const parameters = z.object({
  topic: z.string().describe('The article topic'),
  researchData: z.string().describe('Research data as a string with overview and pipe-delimited facts'),
  style: z.string().describe('Writing style for the article').default('informative'),
  author: z.string().describe('Author information as JSON string').optional().default('{}'),
  targetLen: z.string().describe('Target article length in words').optional().default('1500'),
});

/**
 * Simple helper to extract overview and research lines from researchData string
 * @param {string} researchData - Research data string from deepResearch
 * @returns {object} - Contains overview and facts
 */
export function parseResearchData(researchData) {
  // Split at the separator
  const parts = researchData.split('\n\n===\n\n');

  // The first part is the overview
  const overview = parts[0] || '';

  // The second part contains the research lines
  const facts = parts[1] ? parts[1].split('\n').filter(Boolean) : [];

  return { overview, facts };
}

/**
 * Compose the LLM prompt for generating article proposals
 * @param {object} params - Parameters for proposal generation
 * @returns {string} - Formatted LLM prompt
 */
export function buildProposalsPrompt({ topic, researchData, style, author, targetLen }) {
  const { overview, facts } = parseResearchData(researchData);

  // Parse author information if present
  let authorInfo = {};
  try {
    authorInfo = JSON.parse(author);
  } catch (e) {}

  const authorName = authorInfo.name || 'Not specified';
  const authorBio = authorInfo.bio || '';

  return `You are a content strategist developing article concepts based on research.

==========
TOPIC:
==========
${topic}

==========
WRITING STYLE:
==========
${style}

==========
AUTHOR:
==========
Name: ${authorName}
${authorBio ? `Bio: ${authorBio}` : ''}

==========
TARGET LENGTH:
==========
${targetLen} words

==========
RESEARCH OVERVIEW:
==========
${overview.substring(0, 1500)}

==========
RESEARCH FACTS:
==========
${facts.slice(0, 20).join('\n')}

==========
TASK:
==========
Generate 10 distinct, compelling article proposals that:
1) Match the topic and research data
2) Fit the specified writing style
3) Would be appropriate for the author's expertise (if known)
4) Could be covered well in ${targetLen} words
5) Would be interesting and engaging to readers
6) Would be factually accurate and well-researched

For each angle, provide:
- A descriptive title (not just clickbait, but highly informative and slightly open-ended)
- A 2-3 sentence description of the approach and key points and why this would be the best angle of approach with this for an article.

Return a JSON array of objects with 'title' and 'description' fields.`;
}

/**
 * Generate article proposals based on research
 * @param {object} params - Parameters for proposal generation
 * @param {object} context - Context object
 * @returns {Promise<Array>} - Array of proposal objects
 */
export async function generateProposals(params, context = {}) {
  const { topic, researchData, style, author, targetLen } = params;

  // Generate proposals using Claude 3.7
  const prompt = buildProposalsPrompt({ topic, researchData, style, author, targetLen });

  try {
    const result = await callLLM(prompt, {
      ...CLAUDE_3_7_CONFIG,
      response_format: 'json',
      schema: z.array(z.object({
        title: z.string(),
        description: z.string()
      }))
    });

    if (Array.isArray(result) && result.length > 0) {
      return result;
    }

    // Fallback for any parsing issues
    return [{
      title: `The Complete Guide to ${topic}`,
      description: `A comprehensive exploration of ${topic}, covering key aspects and insights from research.`
    }];
  } catch (error) {
    console.error('Error generating proposals:', error);

    // Fallback proposal
    return [{
      title: `Understanding ${topic}`,
      description: `An exploration of the key aspects of ${topic} and their significance.`
    }];
  }
}

/**
 * Select the best proposal using criteria-based evaluation
 * @param {Array} proposals - List of proposal objects
 * @param {object} params - Original parameters
 * @returns {Promise<object>} - Selected best proposal
 */
export async function selectBestProposal(proposals, params) {
  const { topic, style, targetLen } = params;

  if (proposals.length === 1) return proposals[0];

  const prompt = `You are an editor selecting the best article proposal from several options.

==========
TOPIC:
==========
${topic}

==========
WRITING STYLE:
==========
${style}

==========
TARGET LENGTH:
==========
${targetLen} words

==========
PROPOSALS:
==========
${proposals.map((p, i) => `${i+1}. TITLE: ${p.title}\nDESCRIPTION: ${p.description}`).join('\n\n')}

==========
SELECTION CRITERIA:
==========
1. Most closely aligned with the core topic
2. Most interesting angle for readers
3. Most effectively covers important aspects of the topic
4. Most suitable for the target length and writing style
5. Most likely to be bookmarked by the reader and to win awards for quality and originality

==========
TASK:
==========
Select the single best proposal from the list above. Return a JSON object with:
- "selectedIndex": The number of the selected proposal (1-${proposals.length})`;

  try {
    const result = await callLLM(prompt, {
      ...CLAUDE_CONFIG,
      response_format: 'json',
      schema: z.object({
        selectedIndex: z.number().int().min(1).max(proposals.length)
      })
    });

    // Select the best proposal based on the index
    const selectedIndex = (result.selectedIndex || 1) - 1;
    return proposals[selectedIndex] || proposals[0];
  } catch (error) {
    console.error('Error selecting best proposal:', error);
    return proposals[0];
  }
}

/**
 * Generate multiple title options for the selected proposal
 * @param {object} proposal - Selected proposal object
 * @param {object} params - Original parameters
 * @returns {Promise<Array<string>>} - Array of title options
 */
export async function generateTitleOptions(proposal, params) {
  const { topic, style, researchData, author } = params;
  const { overview } = parseResearchData(researchData);

  const prompt = `You are a headline editor generating diverse, high-quality title options.

==========
ARTICLE TOPIC:
==========
${topic}

==========
WRITING STYLE:
==========
${style}

==========
ARTICLE CONCEPT:
==========
${proposal.title}

${proposal.description}

==========
RESEARCH SUMMARY:
==========
${overview.substring(0, 800)}

==========
TASK:
==========
Create 10 distinct, compelling title options for this article. Each title should be:
- Unique in approach and framing
- Informative and accurately reflect the content
- Engaging but not clickbait
- Between 40-80 characters in length
- Appropriate for the writing style

Return a JSON array of exactly 10 strings, each string being a title option.`;

  try {
    const result = await callLLM(prompt, 'anthropic');

    if (Array.isArray(result) && result.length === 10) {
      return result;
    }

    // Fallback titles if the LLM doesn't return properly formatted results
    return [
      proposal.title,
      `The Complete Guide to ${topic}`,
      `Understanding ${topic}: Key Insights and Perspectives`,
      `Exploring the World of ${topic}`,
      `${topic}: A Comprehensive Analysis`,
      `The Ultimate Guide to ${topic}`,
      `${topic} Explained: Everything You Need to Know`,
      `The Definitive Guide to ${topic}`,
      `${topic} Insights: A Deep Dive`,
      `Mastering ${topic}: Essential Knowledge`
    ];
  } catch (error) {
    console.error('Error generating title options:', error);
    return [proposal.title];
  }
}

/**
 * Select the best title from multiple options
 * @param {Array<string>} titleOptions - Array of title options
 * @param {object} proposal - Selected proposal object
 * @param {object} params - Original parameters
 * @returns {Promise<string>} - Best selected title
 */
export async function selectBestTitle(titleOptions, proposal, params) {
  const { topic, style } = params;

  if (titleOptions.length === 1) return titleOptions[0];

  const prompt = `You are a senior editor selecting the perfect title for an article.

==========
ARTICLE TOPIC:
==========
${topic}

==========
WRITING STYLE:
==========
${style}

==========
ARTICLE CONCEPT:
==========
${proposal.title}

${proposal.description}

==========
TITLE OPTIONS:
==========
${titleOptions.map((title, i) => `${i+1}. ${title}`).join('\n')}

==========
SELECTION CRITERIA:
==========
1. Most effectively captures the essence of the article concept
2. Most likely to engage the target audience
3. Most memorable and distinctive
4. Most appropriate for the writing style
5. Best balance of informativeness and intrigue

==========
TASK:
==========
Select the single best title from the options above. Return a JSON object with:
- "selectedIndex": The number of the selected title (1-${titleOptions.length})`;

  try {
    const result = await callLLM(prompt, 'anthropic');

    const selectedIndex = (result.selectedIndex || 1) - 1;
    return titleOptions[selectedIndex] || titleOptions[0];
  } catch (error) {
    console.error('Error selecting best title:', error);
    return titleOptions[0];
  }
}

/**
 * Main implementation function
 * @param {object} params - Tool parameters
 * @param {object} context - Context object
 * @returns {object} - Object with title and description strings
 */
export async function generateProposalsImpl(params, context = {}) {
  const validParams = parameters.parse(params);

  try {
    // Stage 1: Generate multiple proposals
    const proposals = await generateProposals(validParams, context);

    // Stage 2: Select the best proposal
    const bestProposal = await selectBestProposal(proposals, validParams);

    // Stage 3: Generate multiple title options
    const titleOptions = await generateTitleOptions(bestProposal, validParams);

    // Stage 4: Select the best title
    const bestTitle = await selectBestTitle(titleOptions, bestProposal, validParams);

    // Return title and description as strings
    return {
      title: bestTitle,
      description: bestProposal.description
    };
  } catch (error) {
    console.error('Error in generate proposals workflow:', error);

    // Fallback return
    return {
      title: `The Complete Guide to ${params.topic || 'the Topic'}`,
      description: 'A comprehensive exploration of the topic, examining its key aspects based on the available research.'
    };
  }
}

// Export the tool definition
export default createTool({
  name: TOOL_NAME,
  description: TOOL_DESCRIPTION,
  parameters,
  handler: generateProposalsImpl,
  keys: REQUIRED_KEYS
});
