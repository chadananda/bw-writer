// analyzeRequest.tool.js - Extracts metadata from article requests as strings for LLM compatibility
import { z } from 'zod';
import { extractYamlFrontMatter } from '../../framework/utils.js';
import { callLLM, CLAUDE_CONFIG } from '../../framework/llm-utils.js';



export const analyzeRequestParameters = z.object({
  userPrompt: z.string().describe('User prompt with optional YAML front matter'),
});

// Define validation schema for combined metadata extraction
const metadataSchema = z.object({
  title: z.string().default(''),
  keywords: z.string().default(''),
  targetLen: z.number().int().positive().default(1500),
  author: z.object({
    name: z.string().default('Unknown'),
    bio: z.string().default(''),
    link: z.string().default(''),
    imgUrl: z.string().default('')
  }).default({ name: 'Unknown', bio: '', link: '', imgUrl: '' }),
  meta: z.record(z.string(), z.any()).default({})
});

// Helper functions for LLM-based extraction
export async function extractTopic(text, session = {}) {
  if (!text) return '';
  const prompt = `Extract the intended topic of this article, expressed tersely but completely: ${text}`;
  if (session.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
    console.error('[DEBUG][extractTopic] prompt:', prompt, 'model: anthropic');
  }
  let result;
  try {
    result = await callLLM(prompt, CLAUDE_CONFIG);
    if (session.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
      console.error('[DEBUG][extractTopic] result:', result);
    }
    return result;
  } catch (err) {
    console.error('[DEBUG][extractTopic] error:', err);
    throw err;
  }
}

export async function extractStyle(text, session = {}) {
  if (!text) return 'conversational';
  const prompt = `What writing style should be used? Choose from: conversational, academic, informative, persuasive, or another specific style: ${text}`;
  if (session.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
    console.error('[DEBUG][extractStyle] prompt:', prompt, 'model: anthropic');
  }
  let result;
  try {
    result = await callLLM(prompt, CLAUDE_CONFIG);
    if (session.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
      console.error('[DEBUG][extractStyle] result:', result);
    }
    return result;
  } catch (err) {
    console.error('[DEBUG][extractStyle] error:', err);
    throw err;
  }
}

export async function extractInstructions(text, session = {}) {
  if (!text) return '';
  const prompt = `Extract specific instructions for this article - including requirements, key points, and note if this is a rewrite request. Return as a bullet list: ${text}`;
  if (session.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
    console.error('[DEBUG][extractInstructions] prompt:', prompt, 'model: anthropic');
  }
  let result;
  try {
    result = await callLLM(prompt, CLAUDE_CONFIG);
    if (session.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
      console.error('[DEBUG][extractInstructions] result:', result);
    }
    return result;
  } catch (err) {
    console.error('[DEBUG][extractInstructions] error:', err);
    throw err;
  }
}

export async function extractImageStyle(text, session = {}) {
  if (!text) return 'impressionist colored ink pen sketch';
  const prompt = `What style of images should be used? Consider artistic style, tone, and visual elements. Default to "impressionist colored ink pen sketch" if unspecified: ${text}`;
  if (session.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
    console.error('[DEBUG][extractImageStyle] prompt:', prompt, 'model: anthropic');
  }
  let result;
  try {
    result = await callLLM(prompt, CLAUDE_CONFIG);
    if (session.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
      console.error('[DEBUG][extractImageStyle] result:', result);
    }
    return result;
  } catch (err) {
    console.error('[DEBUG][extractImageStyle] error:', err);
    throw err;
  }
}

export async function extractCombinedMetadata(text, session = {}) {
  if (!text) {
    return JSON.stringify({
      title: '', keywords: '', targetLen: 1500,
      author: { name: 'Unknown', bio: '', link: '', imgUrl: '' }, meta: {}
    });
  }
  const prompt = `Analyze this article request and extract in JSON format:\n\n${text}\n\nExtract:\n1. title: try to figure out the title based on the prompt\n2. keywords: if suggested keywords exist\n3. targetLen: Target word count as a number (1500=medium, 800=short, 2500+=long)\n4. author: Object with {name, bio, link, imgUrl} fields\n5. meta: Object with any additional metadata identified\n\nReturn ONLY valid JSON.`;
  if (session.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
    console.error('[DEBUG][extractCombinedMetadata] prompt:', prompt, 'model: anthropic');
  }
  let result;
  try {
    result = await callLLM(prompt, CLAUDE_CONFIG);
    if (session.debug || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
      console.error('[DEBUG][extractCombinedMetadata] result:', result);
    }
    return JSON.stringify(result);
  } catch (error) {
    console.error('[DEBUG][extractCombinedMetadata] error:', error);
    return JSON.stringify({
      title: '', keywords: '', targetLen: 1500,
      author: { name: 'Unknown', bio: '', link: '', imgUrl: '' }, meta: {}
    });
  }
}

// Main implementation function
export async function analyzeRequestImpl(params) {
  const { userPrompt = '' } = params;
  const { metadata: yamlMetadata, content: promptContent } = extractYamlFrontMatter(userPrompt);
  const context = params.session || {};
  const textToAnalyze = promptContent || userPrompt;

  // Process extractions in parallel
  const [topic, style, instructions, imageStyle, combinedMetadataStr] = await Promise.all([
    extractTopic(textToAnalyze, context),
    extractStyle(textToAnalyze, context),
    extractInstructions(textToAnalyze, context),
    extractImageStyle(textToAnalyze, context),
    extractCombinedMetadata(textToAnalyze, context)
  ]);
  
  // Parse combined metadata with fallback
  let combinedMetadata = {};
  try {
    combinedMetadata = JSON.parse(combinedMetadataStr);
  } catch (error) {
    console.error('Failed to parse metadata JSON:', error);
    combinedMetadata = { title: '', keywords: '', targetLen: 1500, author: {}, meta: {} };
  }
  
  // Extract title from multiple sources
  let title = combinedMetadata.title;
  if (!title && yamlMetadata?.title) {
    title = yamlMetadata.title;
  } else if (!title && promptContent) {
    const headingMatch = promptContent.match(/^#\s*(.+)$/m);
    const titleMatch = promptContent.match(/^title:\s*(.+)$/im);
    title = (headingMatch?.[1] || titleMatch?.[1] || '').trim();
  }
  
  // Merge additional metadata
  const extraMeta = { ...combinedMetadata.meta };
  if (yamlMetadata) {
    Object.keys(yamlMetadata).forEach(key => {
      if (!['title', 'topic', 'style', 'author', 'keywords', 'targetLen', 'imageStyle'].includes(key)) {
        extraMeta[key] = yamlMetadata[key];
      }
    });
  }

  // Return everything as strings
  return {
    topic,
    title,
    author: JSON.stringify(combinedMetadata.author || { name: 'Unknown', bio: '', link: '', imgUrl: '' }),
    style,
    keywords: combinedMetadata.keywords || '',
    wordCount: combinedMetadata.targetLen?.toString() || '1500',
    instructions,
    imageStyle,
    extraMeta: Object.keys(extraMeta).length > 0 ? JSON.stringify(extraMeta) : '{}'
  };
}

export default {
  name: 'analyze_request',
  description: 'Analyze user prompt and extract metadata as strings (topic, title, author, style, keywords, wordCount, instructions, imageStyle).',
  parameters: analyzeRequestParameters,
  handler: analyzeRequestImpl,
};
