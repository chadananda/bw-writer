/**
 * Improve Readability Tool
 * -----------------------
 * Input: title, draft, style, author, description
 * Output: improvedContent, pageDescription, tldrDescription, authorBio, wordCount
 */
import { callLLM } from '../framework/llm-utils.js';
import { createTool, wordCountMD } from '../framework/utils.js';
import { z } from 'zod';

// Tool metadata & LLM config
const TOOL_NAME = 'improve_readability';
const TOOL_DESCRIPTION = 'Enhance article readability, add metadata, and humanize content';
const REQUIRED_KEYS = ['ANTHROPIC_API_KEY'];


// String-based parameter schema
export const parameters = z.object({
  title: z.string().describe('Article title'),
  draft: z.string().describe('Draft article content in markdown'),
  style: z.string().describe('Writing style for the article').optional(),
  author: z.string().describe('Author information as JSON string').optional(),
  description: z.string().describe('Article approach/angle description').optional(),
});



/** Improve article readability and add metadata */
export async function improveReadabilityImpl(params, context = {}) {
  const { title, draft, style, author, description } = parameters.parse(params);
  const effectiveStyle = style || 'informative';

  // Create the improvement prompt
  const prompt = `You are an expert editor enhancing an article for readability, engagement, and metadata.

==========
ARTICLE TITLE:
==========
${title}

==========
ARTICLE DESCRIPTION:
==========
${description || 'Not provided'}

==========
WRITING STYLE:
==========
${effectiveStyle}

==========
AUTHOR:
==========
${author || 'Not specified'}

==========
DRAFT ARTICLE:
==========
${draft}

==========
TASK:
==========
Your job is to improve this article and generate metadata:

1) IMPROVE THE ARTICLE:
- Enhance readability and flow
- Fix any grammatical or structural issues
- Ensure consistent tone matching the specified style
- Maintain all factual information and citations
- Keep the same overall structure and headings
- Return the article in clean markdown format

2) GENERATE METADATA:
- Create a concise page description (150-160 characters)
- Write a TL;DR summary (1-2 sentences)
- Compose an author bio (if author information provided)
- Calculate the word count

Return your response as a JSON object with these fields:
{
  "improvedContent": "the enhanced article in markdown",
  "pageDescription": "SEO-friendly page description",
  "tldrDescription": "Brief TL;DR summary",
  "authorBio": "Short author biography based on provided info (or empty string if none)",
  "wordCount": "approximate word count as string"
}`;

  try {
    // Call the LLM with JSON response format
    const response = await callLLM(prompt, 'anthropic');
    
    // Parse the response
    const result = JSON.parse(response);
    
    // Ensure all expected fields are present
    return {
      improvedContent: result.improvedContent || draft,
      pageDescription: result.pageDescription || `Article about ${title}`,
      tldrDescription: result.tldrDescription || `Article about ${title}`,
      authorBio: result.authorBio || '',
      wordCount: result.wordCount || `${wordCountMD(draft)}`
    };
  } catch (error) {
    console.error('Error improving readability:', error);
    
    // Calculate a fallback word count
    const wordCount = wordCountMD(draft);
    
    // Return fallback values on error
    return {
      improvedContent: draft,
      pageDescription: `${title} - An informative article about ${description || title}`,
      tldrDescription: `An article about ${title}.`,
      authorBio: '',
      wordCount: `${wordCount}`
    };
  }
}

export default createTool({
  name: TOOL_NAME,
  description: TOOL_DESCRIPTION,
  parameters,
  handler: improveReadabilityImpl,
  keys: REQUIRED_KEYS
});
