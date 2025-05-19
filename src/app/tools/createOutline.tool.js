/**
 * Article Outline Generation Tool
 * --------------------------------
 * Input: topic, title, description, researchData, style, author, targetLen
 * Output: outline (markdown string)
 */
import { callLLM } from '../framework/llm-utils.js';
import { createTool } from '../framework/utils.js';
import { z } from 'zod';

// Tool metadata & LLM config
const TOOL_NAME = 'create_outline';
const TOOL_DESCRIPTION = 'Create a structured outline for an article based on research and chosen angle.';
const REQUIRED_KEYS = ['ANTHROPIC_API_KEY'];


// String-based parameter schema
export const parameters = z.object({
  topic: z.string().describe('Article topic'),
  title: z.string().describe('Selected article title'),
  description: z.string().describe('Selected article approach/angle description'),
  researchData: z.string().describe('Research data with overview and pipe-delimited facts'),
  style: z.string().describe('Writing style for the article').optional(),
  author: z.string().describe('Author information as JSON string').optional(),
  targetLen: z.string().describe('Target article length in words').optional().default('1500'),
});

/** Create outline based on topic, title, description, and research */
export async function createOutlineImpl(params, context = {}) {
  const { topic, title, description, researchData, style, author, targetLen } = parameters.parse(params);
  const effectiveStyle = style || 'informative';

  // Create outline prompt
  const prompt = `You are an expert writer creating an article outline.

==========
ARTICLE TOPIC:
==========
${topic}

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
TARGET LENGTH:
==========
${targetLen} words

==========
RESEARCH DATA:
==========
${researchData}

==========
TASK:
==========
Create a comprehensive, well-structured outline for this article that:
1) Follows a logical progression of ideas
2) Incorporates the key research findings
3) Matches the specified title and approach
4) Fits the target length and writing style
5) Will engage and inform the reader effectively

Format the outline as follows:
- Use markdown heading level 3 (###) for section titles
- Under each section, provide bullet points describing:
  * Key points to cover
  * Research facts to include
  * Examples or case studies to feature
  * Questions to address
  * Arguments or analysis to develop

Make sure the outline includes:
- A compelling introduction section
- 3-6 main content sections
- A conclusion section`;

  try {
    const outline = await callLLM(prompt, 'anthropic');
    return { outline };
  } catch (error) {
    console.error('Error generating outline:', error);
    return { outline: `# ${title}\n\n### Introduction\n- Introduce the topic of ${topic}\n- Present the main thesis\n- Outline the structure of the article\n\n### Main Body\n- Key point 1\n- Key point 2\n- Key point 3\n\n### Conclusion\n- Summarize main arguments\n- Final thoughts` };
  }
}

export default createTool({
  name: TOOL_NAME,
  description: TOOL_DESCRIPTION,
  parameters,
  handler: createOutlineImpl,
  keys: REQUIRED_KEYS
});
