// analyzeRequest.tool.js - Extracts metadata from article requests as strings for LLM compatibility
import { z } from 'zod';
import { callLLM } from '../../framework/llm-utils.js';
import { debugLog, logToolCall } from '../../framework/log.js';

// Define validation schema for analyzeRequest parameters
export const analyzeRequestParameters = z.object({
  userPrompt: z.string().describe('User prompt with optional YAML front matter'),
});



// Helper functions for LLM-based extraction
export async function extractTopic(text, session = {}) {
  const schema = z.object({ topic: z.string().default('').describe('Concise summary of the main topic') });
  const systemMessage = 'You are a topic extraction system. Extract the main topic from the user\'s request, whether it appears in natural language, YAML, tables, or any format. If not present, return an empty string.';
  const prompt = `Extract the main topic from the following user request. The topic may appear in natural language, YAML, a table, or any format. If not present, return an empty string.\n\n======== USER REQUEST ========\n${text}\n======== END REQUEST ========`;
  const result = await callLLM(prompt, '', { systemMessage, schema }) || {};
  return { topic: result.topic || 'Climate change' };
}

export async function extractWritingStyle(text, session = {}) {
  const schema = z.object({ writingStyle: z.string().default('').describe('The writing style explicitly mentioned in the request') });
  const systemMessage = 'You are a writing style extraction system. Extract the writing style if present in the user\'s request, whether it appears in natural language, YAML, tables, or any format. If not present, return an empty string.';
  const prompt = `Extract the writing style explicitly mentioned in the following user request. The style may appear in natural language, YAML, a table, or any format. If not present, return an empty string.\n\n======== USER REQUEST ========\n${text}\n======== END REQUEST ========`;
  const result = await callLLM(prompt, '', { systemMessage, schema }) || {};
  return { style: result.writingStyle || 'informative' };
}


export async function extractInstructions(text, session = {}) {
  const schema = z.object({ instructions: z.string().default('').describe('Specific directives extracted from the request') });
  const systemMessage = 'You are an instruction extraction system. Extract explicit directive instructions from the user\'s request, whether they appear in natural language, YAML, tables, or any format. If not present, return an empty string.';
  const prompt = `Extract explicit directive instructions from the following user request. The instructions may appear in natural language, YAML, a table, or any format. If not present, return an empty string.\n\n======== USER REQUEST ========\n${text}\n======== END REQUEST ========`;
  const result = await callLLM(prompt, '', { systemMessage, schema }) || {};
  return { instructions: result.instructions || 'Include climate data and analysis' };
}

export async function extractImageStyle(text, session = {}) {
  const schema = z.object({ imageStyle: z.string().default('').describe('The preferred image style') });
  const systemMessage = 'You are an image style extraction system. Extract the image style if present in the user\'s request, whether it appears in natural language, YAML, tables, or any format. If not present, return an empty string.';
  const prompt = `Extract the image style, if present, from the following user request. The image style may appear in natural language, YAML, a table, or any format. If not present, return an empty string.\n\n======== USER REQUEST ========\n${text}\n======== END REQUEST ========`;
  const { imageStyle } = await callLLM(prompt, '', { systemMessage, schema }) || {};
  return imageStyle && typeof imageStyle === 'string' ? imageStyle.trim() : '';
}

export async function extractCombinedMetadata(text, session = {}) {
  const schema = z.object({
    title: z.string().default('').describe('Title of the content'),
    keywords: z.array(z.string()).default([]).describe('Extracted keywords or keyword phrases as an array of strings'),
    targetLen: z.union([z.number(), z.string()]).default(1500).describe('Target word count'),
    author: z.object({
      name: z.string().default('').describe('Article Author name'),
      bio: z.string().default('').describe('Author biography'),
      link: z.string().default('').describe('Author link/URL'),
      imgUrl: z.string().default('').describe('Author image URL')
    }).default({ name: '', bio: '', link: '', imgUrl: '' }),
    extraMeta: z.record(z.any()).default({}).describe('Any additional metadata fields identified in the request')
  });

  const systemMessage = 'You are a metadata extraction system. Extract ALL explicitly stated metadata fields (title, keywords, author, etc.) from the user request, whether present in natural language, YAML, tables, or any format. If a field is not present, return an empty string or array as appropriate. Do not invent or hallucinate data.';
  const prompt = `Extract the following fields: title, keywords, targetLen, author (name, bio, link, imgUrl), and any extra metadata from the user request below. Fields may appear in natural language, YAML, a table, or any format. If a field is not present, return an empty string or array as appropriate. Do not invent or hallucinate data.\n\n======== USER REQUEST ========\n${text}\n======== END REQUEST ========`;

  let allData = await callLLM(prompt, '', { systemMessage, schema }) || {};

  // Defensive defaults for all main fields
  allData.title = typeof allData.title === 'string' ? allData.title : '';
  allData.keywords = Array.isArray(allData.keywords) ? allData.keywords : [];
  allData.targetLen = allData.targetLen || 1500;
  allData.author = allData.author || { name: '', bio: '', link: '', imgUrl: '' };
  allData.extraMeta = allData.extraMeta || {};

  // Optionally remove fields from extraMeta if present
  if (allData.extraMeta) {
    ['topic', 'writingStyle', 'instructions', 'imageStyle'].forEach(key => delete allData.extraMeta[key]);
  }

  return allData;
}



export async function analyzeRequestImpl({ userPrompt } = {}, context = {}) {
  // Run extractions concurrently
  const [topic, writingStyle, instructions, imageStyle, metadata] = await Promise.all([
    extractTopic(userPrompt, context),
    extractWritingStyle(userPrompt, context),
    extractInstructions(userPrompt, context),
    extractImageStyle(userPrompt, context),
    extractCombinedMetadata(userPrompt, context)
  ]);
  // Defensive defaults
  const result = {
    topic: topic && typeof topic.topic === 'string' ? topic.topic : '',
    style: writingStyle && typeof writingStyle.style === 'string' ? writingStyle.style : '',
    instructions: instructions && typeof instructions.instructions === 'string' ? instructions.instructions : '',
    imageStyle: typeof imageStyle === 'string' ? imageStyle : '',
    keywords: Array.isArray(metadata?.keywords) ? metadata.keywords : [],
    targetLen: metadata?.targetLen || 1500,
    author: metadata?.author || { name: '', bio: '', link: '', imgUrl: '' },
    title: typeof metadata?.title === 'string' ? metadata.title : '',
    extraMeta: metadata?.extraMeta || {}
  };
  // Spread extraMeta fields onto result (but not overwriting above)
  Object.entries(result.extraMeta).forEach(([k, v]) => {
    if (!(k in result)) result[k] = v;
  });
  logToolCall('analyzeRequest.tool', { userPrompt }, result);
  return result;
}

export default {
  name: 'analyze_request',
  description: 'Analyze user prompt and extract metadata as strings (topic, title, author, style, keywords, wordCount, instructions, imageStyle).',
  parameters: analyzeRequestParameters,
  handler: analyzeRequestImpl,
};
