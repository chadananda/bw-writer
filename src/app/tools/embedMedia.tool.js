/**
 * Embed Media Tool
 *
 * Enhances article content with relevant media at optimal positions.
 * Analyzes content structure, suggests media placements, and inserts
 * properly formatted markdown references with high-quality images.
 */
import { z } from 'zod';
import { createTool, saveToS3, splitBlocksMD, blockIsProse } from '../../framework/utils.js';
import { quickLLMJSON, restyleImage } from '../../framework/llm-utils.js';
import ky from 'ky';

// Tool metadata
const TOOL_NAME = 'embed_media';
const TOOL_DESCRIPTION = 'Add media suggestions to article content';
const REQUIRED_KEYS = [
  'OPENAI_API_KEY', 'AWS_BUCKET_NAME',
  'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET_REGION'
];
const MEDIA_TYPES = ['image', 'chart', 'infographic', 'video'];
const MEDIA_DEFAULT_STYLE = 'impressionist colored ink pen sketch';


// Parameter schema
export const TOOL_PARAMETERS = z.object({
  seoContent: z.string().describe('The article content to enhance with media'),
  imageStyle: z.string().optional().describe('Style guide for images')
});

/**
 * Get media suggestions from LLM
 * @param {string[]} blocks - Content blocks
 * @param {string[]} mediaTypes - Media types to consider
 * @param {string} research - Research data
 * @param {object} session - Session with credentials
 * @returns {Promise<Array>} Media suggestions
 */
export async function strategizeMediaWithLLM(blocks, mediaTypes) {
  if (!blocks?.length) return [];

  // Define schema for media suggestions
  const MediaSuggestionSchema = z.array(z.object({
    index: z.number().int().min(0),
    type: z.enum(['image', 'chart', 'infographic', 'video']),
    description: z.string(),
    alt: z.string(),
    keywords: z.array(z.string()),
    statsDescription: z.string().optional()
  }));

  // Format blocks for prompt
  const contentSummary = blocks
    .map((block, i) => `[Block #${i}] ${block}`)
    .join('\n\n')
    .substring(0, 7000);

  const prompt = `Analyze these article blocks and suggest media insertions:

${contentSummary}${contentSummary.length >= 7000 ? '\n... [content truncated]' : ''}

Media types: ${mediaTypes.join(', ')}

Return 3-5 suggestions as JSON array:
[{
  "index": number, // Block index (0-${blocks.length - 1})
  "type": string, // image, chart, infographic, video
  "description": string, // What the media should contain
  "alt": string, // Accessibility text
  "keywords": string[], // Search terms
  "statsDescription": string // Only for infographics
}]

Guidelines: Place at relevant points, distribute evenly, be specific not generic, descriptive alt text.`;

  try {
    const suggestions = await quickLLMJSON(prompt);
    return MediaSuggestionSchema.parse(suggestions);
  } catch (error) {
    console.error('Media planning error:', error);
    return [];
  }
}

/**
 * Transform and store image in S3
 * @param {string} imageUrl - Source image URL
 * @param {string} imageStyle - Style description
 * @returns {<string>} S3 URL
 */
export async function transformAndStoreImage(imageUrl, imageStyle) {
  if (!imageUrl) return 'https://via.placeholder.com/800x450?text=Missing+Image+URL';
  const imageBuffer = await ky.get(imageUrl).arrayBuffer();
  const styledImageBuffer = Buffer.from(await restyleImage(imageBuffer, imageStyle));
  return await saveToS3(styledImageBuffer) || imageUrl;
}

/**
 * Find and process image URL
 * @param {object} suggestion - Media suggestion
 * @param {object} session - Session with credentials
 * @param {string} imageStyle - Style description
 * @returns {Promise<string>} Image URL
 */
export async function searchMediaUrl(suggestion, imageStyle = '') {
  const ImageUrlSchema = z.object({ url: z.string().url() });

  const prompt = `Find a relevant image URL for:
Keywords: ${suggestion.keywords.join(', ')}
Type: ${suggestion.type}
Description: ${suggestion.description}
Return as: { "url": "image_url_here" }`;

  try {
    const response = await quickLLMJSON(prompt, ImageUrlSchema);
    return await transformAndStoreImage(response.url, imageStyle);
  } catch (err) {
    console.error('Image search error:', err);
    return 'https://via.placeholder.com/800x450?text=Image+Unavailable';
  }
}

/**
 * Generate markdown for media
 * @param {object} suggestion - Media suggestion
 * @returns {string} Markdown block
 */
export function mediaMarkdownBlock(suggestion) {
  if (!suggestion.url) return '';

  if (suggestion.type === 'image' || suggestion.type === 'chart') {
    return `![${suggestion.alt}](${suggestion.url})\n*${suggestion.description}*\n\n`;
  }

  if (suggestion.type === 'infographic') {
    return `![${suggestion.alt}](${suggestion.url})\n*${suggestion.description}*\n\n`;
  }

  // For video or other types
  return `**[${suggestion.type.toUpperCase()}]**: ${suggestion.description}\n\n`;
}

/**
 * Insert media into content, process images, and return enhanced content and asset list
 * @param {string} content - The article content
 * @param {string[]} mediaTypes - Allowed media types
 * @param {string} imageStyle - Style guide for images
 * @returns {Promise<{mediaContent: string, mediaAssets: string, mediaSuggestions: object[]}>}
 */
export async function insertMedia(content, mediaTypes, imageStyle) {
  // 1. Split into blocks and index
  const allBlocks = splitBlocksMD(content);
  const proseBlocksWithIndex = allBlocks.map((block, idx) => ({ block: block.trim(), idx }))
    .filter(({ block }) => blockIsProse(block));
  if (!proseBlocksWithIndex.length) {
    return { mediaContent: content, mediaAssets: '', mediaSuggestions: [] };
  }

  // 2. Plan media insertions with LLM
  const mediaSuggestions = await strategizeMediaWithLLM(
    proseBlocksWithIndex.map(b => b.block),
    mediaTypes
  );

  // 3. Process each suggestion: get or generate image, upload to S3, attach URL
  const processedSuggestions = await Promise.all(
    mediaSuggestions.map(async s => {
      let url;
      if (s.type === 'infographic') url = await generateInfographicImage(s.statsDescription);
        else url = await searchMediaUrl(s, imageStyle);
      return { ...s, url };
    })
  );

  // 4. Insert media markdown after the corresponding blocks (reverse insertions for correct indexes)
  const enhancedBlocks = [...allBlocks];
  const insertions = processedSuggestions.filter(s => s.url).sort((a, b) => b.index - a.index);
  insertions.forEach(s => {
    const i = Math.min(s.index, enhancedBlocks.length - 1);
    enhancedBlocks.splice(i + 1, 0, mediaMarkdownBlock(s));
  });

  // 5. Return enhanced content and asset list
  return {
    mediaContent: enhancedBlocks.map(b => b.trim()).filter(Boolean).join("\n\n"),
    mediaAssets: processedSuggestions.map(s => s.url).filter(Boolean).join(',')
  };
}


/**
 * Generate infographic image
 * @param {string} statsDescription - Statistics to visualize
 * @param {object} session - Session with credentials
 * @returns {Promise<string>} Image URL
 */
export async function generateInfographicImage(statsDescription, session = {}) {
  const ImageUrlSchema = z.object({ url: z.string().url() });

  const prompt = `Generate a data visualization for:
${statsDescription}

Requirements: Clean design, clear data representation, minimal text, easy to understand.
Return as: { "url": "image_url_here" }`;

  try {
    const result = await quickLLMJSON(prompt, ImageUrlSchema, session);
    return result.url;
  } catch (err) {
    console.error('Infographic generation error:', err);
    return 'https://via.placeholder.com/800x500?text=Data+Visualization';
  }
}

/**
 * Main tool handler
 * @param {object} params - Tool parameters
 * @param {object} context - Additional context
 * @returns {object} Enhanced content with media
 */
export async function embedMediaImpl(params, context = {}) {
  const { seoContent, imageStyle } = TOOL_PARAMETERS.parse(params);
  const mediaTypes = MEDIA_TYPES;

  // Insert media into content, process images, and return enhanced content and asset list
  const { mediaContent, mediaAssets, mediaSuggestions } = await insertMedia(seoContent, mediaTypes, imageStyle);
  return { mediaContent, mediaAssets, mediaSuggestions };
}

/**
 * Tool definition
 */
export default createTool({
  name: TOOL_NAME,
  description: TOOL_DESCRIPTION,
  parameters: TOOL_PARAMETERS,
  handler: embedMediaImpl,
  keys: REQUIRED_KEYS
});
