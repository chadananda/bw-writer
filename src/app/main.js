/*
 * BW-Writer MCP Server: Main Application Entry Point
 * --------------------------------------------------
 *
 * Overview:
 * This file is the central entry point for the bw-writer Model Context Protocol (MCP) server.
 * It defines the high-level application structure, imports all article-writing tools, and
 * coordinates the article-writing process.
 *
 * Key Concepts:
 * - Direct Tool Integration: Each step in the article writing process directly calls the
 *   appropriate tool with explicit parameter passing.
 * - Clear Data Flow: Results from each step are stored in variables and passed to the next step.
 * - Simplified Error Handling: A single try/catch block handles errors for the entire process.
 * - Consistent Session Tracking: A session ID is created and passed to each tool.
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import framework utilities
import { getLLMConfig } from '../framework/llm-utils.js';
import { createToolHandler } from '../framework/tool-utils.js';

// Import tools directly
import analyzeRequest from './tools/analyzeRequest.tool.js';
import deepResearch from './tools/deepResearch.tool.js';
import createOutline from './tools/createOutline.tool.js';
import draftSection from './tools/draftSection.tool.js';
import improveReadability from './tools/improveReadability.tool.js';
import embedMedia from './tools/embedMedia.tool.js';
import generateProposals from './tools/generateProposals.tool.js';

// Import mock data for testing


// Load environment variables
dotenv.config();

// Configuration
export const CONFIG = {
  debug: process.env.DEBUG === 'true' || false,
  mock: process.env.MOCK === 'true' || false,
  useMockTextResponses: process.env.USE_MOCK_TEXT_RESPONSES === 'true' || false,
};

// Dirname helper for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Schema for the article writer - simplest possible interface
export const articleWriterSchema = z.object({
  // The only field is prompt - can be any text description of what to write
  prompt: z.string()
});

/**
 * Generates YAML frontmatter for an article and combines it with content
 *
 * @param {Object} metadata - Article metadata
 * @param {string} metadata.title - Article title
 * @param {string} metadata.description - Article description
 * @param {Object|string} metadata.style - Article style
 * @param {Object} metadata.author - Author information
 * @param {number} metadata.length - Article length
 * @param {Array} metadata.keywords - Article keywords
 * @param {string} content - Article content
 * @returns {Object} Object containing frontmatter object and full markdown
 */
function generateYamlFrontmatter(metadata, content) {
  // Format the frontmatter object
  const frontmatter = {
    title: metadata.title,
    description: metadata.description || '',
    author: metadata.author || {},
    style: typeof metadata.style === 'object' ? metadata.style :
           typeof metadata.style === 'string' && metadata.style.length > 30 ? metadata.style :
           { type: metadata.style || 'informative', description: 'Standard article format' },
    length: metadata.length || 0,
    keywords: metadata.keywords || [],
    created: new Date().toISOString()
  };

  // Generate the markdown with frontmatter
  const yamlHeader = '---\n' +
    Object.entries(frontmatter)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map(item => `  - ${item}`).join('\n')}`;
        } else if (typeof value === 'object') {
          return `${key}:\n${Object.entries(value)
            .filter(([_, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `  ${k}: ${v}`).join('\n')}`;
        }
        return `${key}: ${value}`;
      }).join('\n') + '\n---\n\n';

  // Combine the YAML frontmatter with the article body
  const markdown = yamlHeader + content;

  return { frontmatter, markdown };
}

/**
 * Extract media asset URLs from article content
 *
 * @param {string} content - Article content with media tags
 * @returns {Array} Array of asset URLs
 */
function extractMediaAssets(content) {
  const assets = [];
  const mediaMatches = content.match(/\[\!MEDIA\](.*?)\[\/MEDIA\]/g) || [];

  mediaMatches.forEach(match => {
    const assetData = match.replace(/\[\!MEDIA\]|\[\/MEDIA\]/g, '').trim();
    if (assetData.includes('s3://') || assetData.includes('http')) {
      assets.push(assetData);
    }
  });

  return assets;
}

/**
 * Article writer - Full article writing workflow
 *
 * @param {Object} params - Input parameters
 * @param {string} params.prompt - Text prompt describing what to write
 * @returns {Promise<Object>} Article output
 */
export async function articleWriter(params, context = {}) {
  try {
    // Create a session ID for tracking
    context.sessionId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    const s = {...params}; // session starts with a copy of params


    // Step 1: Analyze the prompt to extract topic, author, keywords, style, and content instructions
    // params: { userPrompt }
    const { userPrompt } = params; // extract only the fields we need
    s.analyze = await analyzeRequest({userPrompt}, context);
    // returns: { topic, title, author<json {name, bio, link, imgurl}>, style, keywords, wordCount<int>, instructions, extraMeta<json> }
    // extract only the fields we need
    const { topic, author, style, keywords, targetLen, instructions, imageStyle } = s.analyze;
    const authorObj = parseJson(author);


    // Step 2: Research the topic
    // params: { topic, keywords<cdl>, instructions }
    s.research = await deepResearch({topic, keywords, instructions}, context);
    // returns: { researchData }
    const { researchData } = s.research;


    // Step 3: Generate article proposal (generates proposals and titles and returns the best)
    // params: { topic, researchData, style }
    s.proposal = await generateProposals({topic, researchData, style, author, targetLen}, context);
    // returns: { title, description }
    const { title, description } = s.proposal;


    // Step 4: Create outline
    params = {topic, title, description, researchData, style, author, targetLen}
    s.outline = await createOutline(params, context);
    // returns: { outline<md> }
    const { outline } = s.outline;


    // Step 5: Draft the article
    // Note: we should replace draftSection tool with draftArticle for simplicity
    s.draft = await draftArticle({outline, title, description, researchData, style, author}, context);
    // returns: { content<md> }
    const draft = s.draft.content;


    // Step 6: Improve readability, match the author style, humanize
    // params: { title, draft, style, author, description }
    s.humanized = await improveReadability({title, draft, style, author, description}, context);
    const { improvedContent, pageDescription, tldrDescription, authorBio, wordCount } = s.humanized;


    // Step 7: Improve seo by researching keywords and title
    // params: { title, content, keywords }
    s.seoContent = await improveSEO({title, content:improvedContent, keywords}, context);
    // returns: { content<md>, keywordTargets<cdl> }
    const { seoContent, keywordTargets, optimizedTitle } = s.seoContent;


    // Step 8: Find and embed media, then convert images to our style and upload to S3
    // params: { mediaContent, mediaAssets<cdl> }
    s.withMedia = await embedMedia({seoContent, imageStyle}, context);
    // returns: { mediaContent<md>, mediaAssets<cld> }
    const { mediaContent, mediaAssets } = s.withMedia.content;


    // Format return object like {meta<obj>, body<md>, markdown<yaml+md>, yaml<yaml>, debug<obj>}
    const wordCountInt = parseInt(wordCount);
    const keywordArr = keywordTargets.split(',').map(k => k.trim()).filter(Boolean);
    const mediaAssetsArr = mediaAssets.split(',').map(a => a.trim()).filter(Boolean);
    const createdAt = new Date().toISOString();

    const meta = {title: optimizedTitle, author: {name: authorObj.name, bio: authorBio, link: authorObj.link},
          description: pageDescription, tldr: tldrDescription, style,
          wordCount: wordCountInt, keywords: keywordArr, media: mediaAssetsArr, createdAt};
    const yaml = generateYamlFrontmatter(meta);
    const body = mediaContent;
    const markdown = yaml.markdown + '\n\n' + body;
    const result = {meta, body, markdown, yaml};
    if (context.debug) result.debug = session   // Add debug info if requested
    return result;

  } catch (error) {
    console.error('Article workflow error:', error);
    return {
      error: error.message || String(error),
      debug: CONFIG.debug ? { error: error.stack, session } : undefined
    };
  }
}

// Tools export object for reference
const tools = {
  // Analysis tool for initial request processing
  analyze_request: analyzeRequest,

  // Research tools
  deepResearch,
  webSearch,

  // Content generation tools
  create_outline: createOutline,
  draft_section: draftSection,
  improve_readability: improveReadability,

  // Media tools
  embed_media: embedMedia,
  suggest_images: suggestImages,
};

// LLM config
export const llmConfig = {
  provider: process.env.LLM_PROVIDER || 'openai',
  model: process.env.LLM_MODEL || 'gpt-4o',
  key: process.env.OPENAI_API_KEY || '', // Set to empty string if not present
  temperature: 0.7,
  max_tokens: 2048,
};

/**
 * Tool handler for the MCP server
 */
export default async ({ input = {}, name, token }) => {
  // Use mock data if enabled
  if (CONFIG.mock) {
    // In mock mode, just return the mock data
    console.log('[MOCK MODE ENABLED] - Returning mock data');
    return getMockData(name, input);
  }

  try {
    // Handle article_writer as the main workflow
    if (name === 'article_writer') {
      // Validate input based on schema
      const parsedInput = articleWriterSchema.parse(input);
      // Call the article writer directly
      return await articleWriter(parsedInput);
    }

    // Handle individual tool calls
    const tool = tools[name];
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    // Create and execute the tool handler
    const handler = createToolHandler(name, tool, getLLMConfig(token));
    return await handler(input);
  } catch (error) {
    console.error(`Error in ${name} handler:`, error);
    return {
      error: error.message || JSON.stringify(error),
      input,
      name
    };
  }
};
