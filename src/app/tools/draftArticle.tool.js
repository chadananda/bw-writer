/**
 * Draft Article Tool
 * ----------------
 * Input: outline, title, description, researchData, style, author
 * Output: content (markdown string)
 */
import { callLLM } from '../framework/llm-utils.js';
import { createTool } from '../framework/utils.js';
import { z } from 'zod';

// Tool metadata & LLM config
const TOOL_NAME = 'draft_article';
const TOOL_DESCRIPTION = 'Draft a complete article based on outline and research data';
const REQUIRED_KEYS = ['ANTHROPIC_API_KEY'];


// String-based parameter schema
export const parameters = z.object({
  outline: z.string().describe('Article outline in markdown format'),
  title: z.string().describe('Article title'),
  description: z.string().describe('Article approach/angle description'),
  researchData: z.string().describe('Research data with overview and facts'),
  style: z.string().describe('Writing style for the article').optional(),
  author: z.string().describe('Author information as JSON string').optional(),
});

/** Draft complete article based on outline and research */
export async function draftArticleImpl(params, context = {}) {
  const { outline, title, description, researchData, style, author } = parameters.parse(params);
  const effectiveStyle = style || 'informative';

  // Create article drafting prompt
  const prompt = `You are an expert writer creating a complete article.

==========
ARTICLE TITLE:
==========
${title}

==========
ARTICLE APPROACH:
==========
${description}

==========
WRITING STYLE:
==========
${effectiveStyle}

==========
AUTHOR:
==========
${author || 'Not specified'}

==========
ARTICLE OUTLINE:
==========
${outline}

==========
RESEARCH DATA:
==========
${researchData}

==========
TASK:
==========
Draft a complete article following these guidelines:
1) Follow the outline structure exactly, using the same headings
2) Incorporate relevant research findings, citing sources where appropriate with brief inline links
3) Use the specified writing style throughout
4) Create smooth transitions between sections
5) Include a compelling introduction and conclusion
6) Format the article in clean markdown with h2 sections and h3 sub-headers
7) When appropriate include blockquotes with interesting corroborating citations or anecdotes, always appending a link to the source

Write the complete article using the research data and outline provided. The article should be well-structured, engaging, and comprehensive, covering all points in the outline while maintaining a cohesive narrative.`;

  try {
    const content = await callLLM(prompt, 'anthropic');
    return { content };
  } catch (error) {
    console.error('Error generating article draft:', error);
    return {
      content: `# ${title}\n\n## Introduction\n\n[Error generating content: ${error.message}]\n\n` +
               `This article will explore ${description}.\n\n` +
               `## Outline\n\n${outline}`
    };
  }
}

export default createTool({
  name: TOOL_NAME,
  description: TOOL_DESCRIPTION,
  parameters,
  handler: draftArticleImpl,
  keys: REQUIRED_KEYS
});
