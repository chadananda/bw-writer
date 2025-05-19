/**
 * SEO Optimization Tool
 * --------------------
 * Input: title, draft, targetKeywords
 * Output: optimizedContent, keywordSuggestions, seoScore, seoImprovements
 */
import { z } from 'zod';
import { getLLMClient, quickLLM, quickLLMJSON, quickLLMBool } from '../../utils/mcp-base.js';
import { createTool, splitBlocksMD, blockIsProse } from '../framework/utils.js';
// Import DataForSEO client
import * as DataForSEOClient from 'dataforseo-client';
// Import markdown-it for proper markdown parsing
import MarkdownIt from 'markdown-it';

// Tool metadata & LLM config
const TOOL_NAME = 'optimize_seo';
const TOOL_DESCRIPTION = 'Optimize content for search engines with keyword suggestions and improvements';

// Environment variables needed for this tool
const REQUIRED_KEYS = ['DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD'];

const CLAUDE_CONFIG = {
  provider: 'Anthropic',
  model: 'claude-3-sonnet-20240229',
  max_tokens: 6000,
  temperature: 0.2
};

// Constants for SEO optimization
const MIN_ACCEPTABLE_SEO_SCORE = 75;
const MAX_OPTIMIZATION_ITERATIONS = 2; // Limit iterations to prevent excessive API usage

// String-based parameter schema
export const parameters = z.object({
  title: z.string().describe('Article title'),
  draft: z.string().describe('Article content in markdown'),
  targetKeywords: z.string().describe('Comma-separated target keywords (optional)').optional(),
  domain: z.string().describe('Domain for SEO analysis (optional)').optional(),
});


const uniqueKeywords = (arr) => [...new Set( [...arr].map(k => k?.trim()).filter(Boolean))];



/** Optimize content for SEO */
export async function optimizeSEOImpl(params, context = {}) {
  const { title, draft, targetKeywords = '', domain = 'https://example.com' } = parameters.parse(params);
  const dataForSEOCredentials = {
    login: process.env.DATAFORSEO_LOGIN || context.DATAFORSEO_LOGIN,
    password: process.env.DATAFORSEO_PASSWORD || context.DATAFORSEO_PASSWORD
  };

  // Step 1: Generate initial keywords for exploration
  const baseKeywords = targetKeywords || '';
  const { expandedKeywords, topKeywords } = await generateExpandedKeywords(title, baseKeywords, {
    topKeywordCount: 5 // Configure how many top keywords to use for SERP analysis
  });

  // Step 2: Get SERP data for our top keywords to find competitors
  const serpData = await getSERPData(topKeywords, dataForSEOCredentials);
  const competitorKeywords = await extractCompetitorKeywords(serpData, title, dataForSEOCredentials);

  // Combine all keyword sources
  const keywords = uniqueKeywords([...topKeywords, ...competitorKeywords, ...expandedKeywords]);

  // Get keyword metrics and sort by relevance
  const analyzedKeywords = await getDataForSEOKeywords(keywords, draft, dataForSEOCredentials);

  // Get initial SEO score to track improvements
  const initialAnalysis = await analyzeContentSEO(draft, domain, dataForSEOCredentials);
  let seoScore = initialAnalysis?.seo_score?.score || 50;

  // Optimize title and content using Sonnet to integrate keywords naturally
  const result = await optimizeContentUntilTargetScore(draft, analyzedKeywords, seoScore, dataForSEOCredentials, {
    title,
    targetScore: MIN_ACCEPTABLE_SEO_SCORE,
    maxIterations: MAX_OPTIMIZATION_ITERATIONS,
    optimizeTitle: true // Enable title optimization
  });

  // Return the optimized results including optimized title
  return {
    optimizedTitle: result.title || title, // Include optimized title
    optimizedContent: result.content,
    keywordSuggestions: analyzedKeywords.slice(0, 20),
    seoScore: result.score || 60,
    seoImprovements: result.improvements,
    dataSource: 'SERP Analysis + DataForSEO + Claude'
  };
}

/**
 * Optimize content until target SEO score is reached
 * @param {string} content - Original content
 * @param {Array} keywords - Analyzed keywords
 * @param {number} initialScore - Starting score
 * @param {Object} credentials - API credentials
 * @param {Object} options - Optimization options
 * @returns {Object} Optimized content and metrics
 */
async function optimizeContentUntilTargetScore(content, keywords, initialScore, credentials, options = {}) {
  const {
    title = '',
    targetScore = MIN_ACCEPTABLE_SEO_SCORE,
    maxIterations = MAX_OPTIMIZATION_ITERATIONS,
    optimizeTitle = true,
    domain = 'https://example.com'
  } = options;

  // Initialize optimization state
  let currentContent = content;
  let currentScore = initialScore;
  let currentTitle = title;
  let usedKeywords = [];
  let improvements = [];
  let keywordsToUse = [...keywords];

  // Optimize title if requested
  if (optimizeTitle && title) {
    const titleResult = await optimizeTitleWithKeywords(title, keywordsToUse.slice(0, 10));
    currentTitle = titleResult.optimizedTitle;

    // Track keyword usage from title optimization
    if (titleResult.keywordsUsed?.length) {
      usedKeywords.push(...titleResult.keywordsUsed.map(k => ({ keyword: k, location: 'title' })));

      // Update keyword usage counts
      titleResult.keywordsUsed.forEach(keyword => {
        const idx = keywordsToUse.findIndex(k =>
          k.keyword.toLowerCase() === keyword.toLowerCase());
        if (idx > -1) {
          keywordsToUse[idx].currentUsage = (keywordsToUse[idx].currentUsage || 0) + 1;
        }
      });
    }
  }

  // Iterative content optimization
  for (let i = 0; i < maxIterations && currentScore < targetScore; i++) {
    // Integrate keywords into content
    const result = await integrateKeywords(currentContent, keywordsToUse);

    // No more keywords to insert, end optimization
    if (!result.insertions.length) break;

    // Apply changes and track improvements
    currentContent = result.content;
    usedKeywords.push(...result.insertions);
    keywordsToUse = result.remainingKeywords;
    improvements.push(`Added ${result.insertions.length} keywords to content`);

    // Evaluate new SEO score
    try {
      const analysis = await analyzeContentSEO(currentContent, domain, credentials);
      const newScore = analysis?.seo_score?.score || currentScore;
      improvements.push(`SEO score: ${currentScore} → ${newScore}`);
      currentScore = newScore;
    } catch {
      // Continue optimization even if scoring fails
    }
  }

  return {
    content: currentContent,
    title: currentTitle,
    score: seoScore,
    improvements: [...new Set(improvements)] // Deduplicate
  };
}

/**
 * Generate expanded SEO keywords based on article title
 * @param {string} title - Article title
 * @param {string} baseKeywords - Initial keywords (comma-separated)
 * @param {Object} options - Additional options
 * @returns {Object} - Expanded keywords and top keywords for analysis
 */
async function generateExpandedKeywords(title, baseKeywords = '', options = {}) {
  // Extract base keywords as an array
  const baseKeywordsArray = baseKeywords ? baseKeywords.split(',').map(k => k.trim()).filter(k => k) : [];
  if (!title) return { expandedKeywords: baseKeywordsArray, topKeywords: baseKeywordsArray };

  const prompt =
    `Generate SEO keywords related to: "${title}"
    ${baseKeywords ? `Expand from: ${baseKeywords}` : ''}

    Consider search intent, user psychology, and content relevance.
    Include both short-tail and long-tail keyword phrases.
    Focus on phrases people would actually search for.

    Return only a JSON array of keyword strings.`;

  try {
    const keywords = await quickLLMJSON(prompt, { schema: { type: 'array', items: { type: 'string' } } });
    const expandedKeywords = Array.isArray(keywords) ? keywords.filter(k => k?.trim()) : [];

      // Create top keywords for SERP analysis (combining base keywords with top expanded keywords)
    const topKeywords = uniqueKeywords([
      ...baseKeywordsArray,
      ...expandedKeywords.slice(0, options.topKeywordCount || 5)
    ]);

    return { expandedKeywords, topKeywords };
  } catch {
    return {
      expandedKeywords: baseKeywordsArray,
      topKeywords: baseKeywordsArray
    };
  }
}

/**
 * Analyze content using DataForSEO ContentAnalysis API with proper markdown conversion
 * @param {string} markdown - Content in markdown format
 * @param {string} url - Domain for analysis
 * @param {Object} credentials - DataForSEO credentials
 * @returns {Object} - SEO analysis results
 */
async function analyzeContentSEO(markdown, url = 'https://example.com', credentials) {
  if (!credentials?.login || !credentials?.password) return null;

  try {
    // We'll still need MarkdownIt for HTML conversion since that's what DataForSEO expects
    // Our utilities are for block-level processing, not HTML rendering
    const md = new MarkdownIt({ html: true });
    const htmlContent = md.render(markdown);

    // Create structured HTML document
    const htmlDoc = `<!DOCTYPE html><html><head><title>SEO Analysis</title></head><body>${htmlContent}</body></html>`;

    // Configure client and API
    const client = DataForSEOClient.ApiClient.instance;
    client.authentications.basicAuth.username = credentials.login;
    client.authentications.basicAuth.password = credentials.password;

    // Send analysis request
    const result = await new DataForSEOClient.ContentAnalysisApi().contentAnalysisCheckLive({
      data: [{
        content_info: { type: "html", content: htmlDoc },
        params: {
          url,
          calculate_seo_score: true,
          calculate_content_quality_score: true,
          calculate_relevance: true,
          calculate_readability: true,
          calculate_keyword_density: true,
          check_grammar: true
        }
      }]
    });

    return result?.tasks?.[0]?.result?.[0] || null;
  } catch (error) {
    return null;
  }
}

/**
 * Retrieves SERP data for a set of keywords
 * @param {string[]} keywords - Keywords to analyze
 * @param {Object} credentials - DataForSEO credentials
 * @returns {Array} - SERP results with competitor pages
 */
async function getSERPData(keywords, credentials) {
  if (!keywords?.length || !credentials?.login) return [];

  try {
    // Configure API client
    const serpApi = new DataForSEOClient.SerpApi();
    DataForSEOClient.ApiClient.instance.authentications.basicAuth.username = credentials.login;
    DataForSEOClient.ApiClient.instance.authentications.basicAuth.password = credentials.password;

    // Process in small batches (rate limit management)
    const batchSize = 3;
    const taskData = [];

    // Step 1: Create SERP tasks
    for (let i = 0; i < keywords.length; i += batchSize) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit pause

      const tasks = keywords.slice(i, i + batchSize).map(keyword => ({
        keyword,
        language_code: "en",
        location_code: 2840, // US
        se_domain: "google.com",
        depth: 20
      }));

      // Submit batch of tasks
      const results = await Promise.all(
        tasks.map(task => serpApi.googleOrganicTasksFixed({ data: [task] }).catch(() => null))
      );

      // Collect task IDs
      results.forEach((result, idx) => {
        const taskId = result?.tasks?.[0]?.id;
        if (taskId) taskData.push({ keyword: keywords[i + idx], taskId });
      });
    }

    // Step 2: Retrieve results with polling
    const serpResults = [];
    for (const { keyword, taskId } of taskData) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for processing

      try {
        const result = await serpApi.googleOrganicTasksReady({ id: taskId });
        const organicResults = result?.tasks?.[0]?.result?.[0]?.organic_results;

        if (organicResults?.length) {
          serpResults.push({
            keyword,
            results: organicResults.slice(0, 10) // Top 10 results only
          });
        }
      } catch {/* Continue with next task */}
    }

    return serpResults;
  } catch {
    return [];
  }
}

/**
 * Extract unique keywords from competitor content in SERP results
 * @param {Array} serpData - SERP data from top-ranking pages
 * @param {string} title - Original article title
 * @param {Object} credentials - DataForSEO credentials
 * @returns {Array} - Unique competitor keywords
 */
async function extractCompetitorKeywords(serpData, title, credentials) {
  if (!serpData?.length || !credentials?.login) return [];

  // Configure client
  DataForSEOClient.ApiClient.instance.authentications.basicAuth.username = credentials.login;
  DataForSEOClient.ApiClient.instance.authentications.basicAuth.password = credentials.password;

  // Extract unique top competitor URLs (top 3 per keyword)
  const topUrls = [...new Set(
    serpData.flatMap(item =>
      (item.results || []).slice(0, 3)
        .filter(page => page.url)
        .map(page => ({ url: page.url, keyword: item.keyword }))
    )
  )].slice(0, 5); // Limit to 5 pages for efficiency

  // Analyze competitor content for keywords
  const contentApi = new DataForSEOClient.ContentAnalysisApi();
  const keywordSets = await Promise.all(
    topUrls.map(async ({ url }) => {
      try {
        const result = await contentApi.contentAnalysisCheckLive({
          data: [{
            params: {
              url,
              calculate_keyword_density: true
            }
          }]
        });

        return result?.tasks?.[0]?.result?.[0]?.keyword_density
          ?.filter(item => item.density > 0.2)
          ?.map(item => item.keyword) || [];
      } catch {
        return [];
      }
    })
  );

  // Extract unique keywords from all competitor pages
  const extractedKeywords = uniqueKeywords(keywordSets.flat());

  if (extractedKeywords.length >= 10) {
    // Already have enough keywords, return them
    return extractedKeywords.filter(k => k?.trim());
  }

  // Fallback: Use LLM to analyze SERP results and extract additional keywords
  try {
    // Create a concise summary of top results
    const serpSummary = serpData.map(item => {
      const topResults = (item.results || []).slice(0, 3)
        .map(r => `- ${r.title || 'Untitled'}: ${r.snippet || 'No snippet'}`)
        .join('\n');
      return `"${item.keyword}":\n${topResults}`;
    }).join('\n\n');

    // Get additional keywords from LLM
    const llmKeywords = await quickLLMJSON(
      `Extract valuable SEO keywords from these search results for an article titled "${title}":\n\n${serpSummary}\n\n` +
      `Return only a JSON array of keyword strings.`,
      { schema: { type: 'array', items: { type: 'string' } } }
    );

    // Combine API-extracted and LLM-generated keywords into a unique set
    const combinedKeywords = [...extractedKeywords];
    if (Array.isArray(llmKeywords)) {
      llmKeywords.forEach(k => {
        if (k?.trim()) combinedKeywords.push(k.trim());
      });
    }

    return uniqueKeywords(combinedKeywords);
  } catch {
    // Return API-extracted keywords if LLM fails
    return extractedKeywords.filter(k => k?.trim());
  }
}

/**
 * Analyze keywords with DataForSEO API and determine usage metrics
 * @param {string[]} keywordList - Keywords to research
 * @param {string} content - Article content to analyze
 * @param {Object} credentials - API credentials
 * @returns {Array} - Prioritized keywords with metrics
 */
async function getDataForSEOKeywords(keywordList, content, credentials) {
  if (!keywordList?.length || !credentials?.login) return [];

  try {
    // Setup API client
    DataForSEOClient.ApiClient.instance.authentications.basicAuth.username = credentials.login;
    DataForSEOClient.ApiClient.instance.authentications.basicAuth.password = credentials.password;
    const keywordApi = new DataForSEOClient.KeywordResearchApi();

    // Process keywords in batches (rate limit management)
    const results = [];
    const batchSize = 5;

    for (let i = 0; i < keywordList.length; i += batchSize) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit pause

      // Create batch of keyword queries
      const batch = keywordList.slice(i, i + batchSize);
      const batchResponses = await Promise.all(
        batch.map(keyword => {
          const payload = {
            keyword,
            language_code: "en",
            location_code: 2840, // US
            include_serp_info: true
          };
          return keywordApi.keywordResearchV3KeywordInfoLive({ data: [payload] }).catch(() => null);
        })
      );

      // Process each keyword's data
      batch.forEach((keyword, idx) => {
        const keywordInfo = batchResponses[idx]?.tasks?.[0]?.result?.[0]?.keyword_info;
        if (!keywordInfo) return;

        // Extract metrics
        const searchVolume = keywordInfo.search_volume || 0;
        const cpc = keywordInfo.cpc || 0;
        const competition = keywordInfo.competition_index ? keywordInfo.competition_index / 100 : 0.5;

        // Count current usage in content
        const currentUsage = (content.match(new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi')) || []).length;

        // Calculate relevance score (1-10)
        let relevance = 5;
        if (searchVolume > 1000) relevance += 2;
        else if (searchVolume > 500) relevance += 1;
        if (competition < 0.3) relevance += 2;
        else if (competition < 0.6) relevance += 1;
        if (cpc > 2) relevance += 1;

        // Determine optimal usage
        const suggestedUsage = Math.max(2, Math.min(4, currentUsage + 2));
        const placement = relevance >= 7 ? "heading+body" : "body";

        results.push({
          keyword,
          relevance: Math.min(10, relevance),
          currentUsage,
          suggestedUsage: relevance >= 8 ? Math.min(suggestedUsage + 1, 5) : suggestedUsage,
          placement,
          searchVolume,
          cpc,
          competition
        });
      });
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  } catch {
    return [];
  }
}

/**
 * Integrate keywords using markdown-aware processing
 * @param {string} content - Original markdown content
 * @param {Array} keywordSuggestions - Keywords with usage metrics
 * @returns {Object} Updated content and insertion statistics
 */
async function integrateKeywords(content, keywordSuggestions) {
  if (!content || !keywordSuggestions?.length) return { content, insertions: [] };

  // Filter and prioritize keywords
  const keywords = [...keywordSuggestions]
    .map(k => ({ ...k, remainingInsertions: Math.max(0, k.suggestedUsage - k.currentUsage) }))
    .filter(k => k.remainingInsertions > 0)
    .sort((a, b) => b.relevance - a.relevance);

  if (!keywords.length) return { content, insertions: [] };

  // Get prose blocks from markdown
  const proseBlocks = splitBlocksMD(content).filter(blockIsProse);
  const blockData = proseBlocks.map((block, index) => ({ ...block, index }));
  const insertions = [];

  // Process blocks in batches of 3 for API efficiency
  for (let i = 0; i < blockData.length; i += 3) {
    const results = await Promise.all(
      blockData.slice(i, i + 3).map(block =>
        integrateKeywordsInBlock(block.content, keywords, block.index, block.type, block.level)
      )
    );

    // Update blocks and track keyword usage
    results.forEach((result, idx) => {
      const blockIndex = i + idx;
      if (blockIndex < blockData.length) blockData[blockIndex].content = result.enhancedBlock;

      // Track used keywords and update remaining counts
      result.keywordsUsed.forEach(used => {
        const keywordIdx = keywords.findIndex(
          k => k.keyword.toLowerCase() === used.keyword.toLowerCase()
        );

        if (keywordIdx >= 0) {
          // Record insertion and update remaining count
          insertions.push({ ...used });

          if (--keywords[keywordIdx].remainingInsertions <= 0) {
            keywords.splice(keywordIdx, 1);
          }
        }
      });
    });
  }

  // Reconstruct content preserving original structure
  let updatedContent = '';
  let proseIdx = 0;

  // Map enhanced content back to original structure
  splitBlocksMD(content).forEach(block => {
    if (blockIsProse(block)) {
      // Use enhanced version of prose blocks when available
      const enhanced = proseIdx < blockData.length ? blockData[proseIdx].content : block.content;
      const prefix = block.type === 'heading' ? '#'.repeat(block.level) + ' ' : '';
      updatedContent += prefix + enhanced + '\n\n';
      proseIdx++;
    } else if (block.type === 'code') {
      // Preserve code blocks
      updatedContent += '```' + (block.language || '') + '\n' + block.content + '\n```\n\n';
    } else if (block.type === 'unordered_list' || block.type === 'ordered_list') {
      // Preserve lists
      const prefix = block.type === 'unordered_list' ? '- ' : '1. ';
      updatedContent += block.items.map(item => prefix + item).join('\n') + '\n\n';
    } else {
      // Preserve other block types
      updatedContent += block.raw || (block.content + '\n\n');
    }
  });

  return { content: updatedContent.trim(), insertions, remainingKeywords: keywords };
}

/**
 * Optimize article title with SEO keywords
 * @param {string} title - Original title
 * @param {Array} keywords - Candidate keywords
 * @returns {Object} Enhanced title and keywords used
 */
async function optimizeTitleWithKeywords(title, keywords) {
  if (!title || !keywords?.length) return { optimizedTitle: title, keywordsUsed: [] };

  // Compact prompt focused on natural keyword integration
  const prompt = `Optimize this title for SEO:

"${title}"

Keywords (by priority):
${keywords.slice(0, 5).map(k => `- "${k.keyword}" (priority: ${k.relevance}/10)`).join('\n')}

Requirements:
- Include 1-2 keywords naturally
- Keep compelling and readable
- Aim for 50-60 character length
- No keyword stuffing

Respond with JSON: { "optimizedTitle": string, "keywordsUsed": string[] }`;

  try {
    const llm = getLLMClient();
    const response = await llm.complete(prompt, {
      ...CLAUDE_CONFIG,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response);
    return {
      optimizedTitle: result.optimizedTitle || title,
      keywordsUsed: Array.isArray(result.keywordsUsed) ? result.keywordsUsed : []
    };
  } catch {
    return { optimizedTitle: title, keywordsUsed: [] };
  }
}

/**
 * Integrate keywords into content block
 * @param {string} block - Content block text
 * @param {Array} keywords - Available keywords
 * @param {number} blockIndex - Position index
 * @param {string} blockType - 'paragraph' or 'heading'
 * @param {number} headingLevel - Heading level (1-6)
 * @returns {Object} Enhanced content and used keywords
 */
async function integrateKeywordsInBlock(block, keywords, blockIndex, blockType = 'paragraph', headingLevel = 0) {
  if (!block?.trim() || !keywords?.length) return { enhancedBlock: block, keywordsUsed: [] };

  // Select appropriate keywords for block type
  const isHeading = blockType === 'heading';
  const candidates = keywords
    .filter(k => !isHeading || k.placement.includes('heading'))
    .slice(0, isHeading ? 2 : 5); // Fewer keywords for headings

  if (!candidates.length) return { enhancedBlock: block, keywordsUsed: [] };

  // Create concise prompt
  const prompt = `Add SEO keywords to this ${isHeading ? `level ${headingLevel} heading` : 'paragraph'}:

${block}

Keywords to consider (by priority):
${candidates.map(k => `- "${k.keyword}" (priority: ${k.relevance}/10)`).join('\n')}

Rules:
- Add 1-2 keywords naturally if they fit
- Preserve ALL markdown formatting including:
  * Links: [text](url) - never modify URLs,
  * Code: \`code\` - never modify code,
  * Formatting: *text* or **text** - keep markers,
  * Lists and numbering - maintain structure,
  * Blockquotes: > text - preserve markers,
  * Images: ![alt](url) - never modify
- Keep headings concise
- Don't force awkward insertions
- Only modify text content, not formatting

Respond with JSON: { "enhancedContent": string, "keywordsUsed": [{"keyword": string, "context": string}] }`;

  try {
    const llm = getLLMClient();
    const response = await llm.complete(prompt, {
      ...CLAUDE_CONFIG,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response);
    return {
      enhancedBlock: result.enhancedContent || block,
      keywordsUsed: (result.keywordsUsed || []).map(used => ({
        ...used,
        location: `${blockType}-${blockIndex}`
      }))
    };
  } catch {
    return { enhancedBlock: block, keywordsUsed: [] };
  }
}

export default createTool({
  name: TOOL_NAME,
  description: TOOL_DESCRIPTION,
  parameters,
  handler: optimizeSEOImpl,
  keys: REQUIRED_KEYS
});
