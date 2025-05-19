/**
 * Simple workflow function to execute a series of tool calls with shared session state
 * 
 * @param {Object} tools - Tool functions to execute 
 * @param {Object} initialParams - Initial parameters for the workflow
 * @param {boolean} debug - Whether to include debug information in response
 * @returns {Object} Final formatted result
 */
export function runWorkflow(tools, initialParams, debug = false) {
  return async () => {
    // Create session state with data property to store all results
    const session = { 
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      data: {},
      keys: {}
    };

    try {
      // Step 1: Analyze the request
      session.data.analyze = await tools.analyze_request({ 
        detailedPrompt: initialParams.detailedPrompt || initialParams.prompt || initialParams.topic
      });

      // Step 2: Research the topic
      session.data.research = await tools.deepResearch({
        topic: session.data.analyze.topic,
        sessionId: session.id
      });

      // Step 3: Create outline
      session.data.outline = await tools.create_outline({
        topic: session.data.analyze.topic,
        title: session.data.analyze.title,
        style: session.data.analyze.style,
        length: session.data.analyze.length,
        contentInstructions: session.data.analyze.contentInstructions,
        researchData: session.data.research.researchData,
        sessionId: session.id
      });

      // Step 4: Draft the article
      session.data.draft = await tools.draft_section({
        outline: session.data.outline,
        sectionTitle: 'article',
        researchData: session.data.research.researchData,
        articleSoFar: '',
        style: session.data.analyze.style,
        length: session.data.analyze.length,
        author: session.data.analyze.author,
        sessionId: session.id
      });

      // Step 5: Improve readability
      session.data.improved = await tools.improve_readability({
        title: session.data.analyze.title,
        text: session.data.draft.content || session.data.draft,
        style: session.data.analyze.style,
        proposalSummary: session.data.outline.summary || '',
        researchData: session.data.research.researchData,
        sessionId: session.id
      });

      // Step 6: Embed media suggestions
      session.data.withMedia = await tools.embed_media({
        content: session.data.improved.content || session.data.improved,
        researchData: session.data.research.researchData,
        sessionId: session.id
      });

      // Extract final content and assets
      const finalContent = session.data.withMedia.content || 
                         (session.data.improved && session.data.improved.content) || '';
      
      const assets = [];
      const mediaMatches = finalContent.match(/\[\!MEDIA\](.*?)\[\/MEDIA\]/g) || [];
      mediaMatches.forEach(match => {
        const assetData = match.replace(/\[\!MEDIA\]|\/MEDIA\]/g, '').trim();
        if (assetData.includes('s3://') || assetData.includes('http')) {
          assets.push(assetData);
        }
      });

      // Format the response
      const result = {
        title: session.data.analyze.title || session.data.analyze.topic,
        description: session.data.outline?.summary || '',
        style: session.data.analyze.style,
        author: session.data.analyze.author || {},
        length: session.data.analyze.length || 0,
        keywords: session.data.analyze.yamlMetadata?.keywords || [],
        body: finalContent,
        assets: assets,
        markdown: generateMarkdown({
          title: session.data.analyze.title || session.data.analyze.topic,
          description: session.data.outline?.summary || '',
          style: session.data.analyze.style,
          author: session.data.analyze.author || {},
          length: session.data.analyze.length || 0, 
          keywords: session.data.analyze.yamlMetadata?.keywords || [],
          content: finalContent
        })
      };

      // Add debug info if requested
      if (debug) {
        result.debug = { session };
      }

      return result;
    } catch (error) {
      console.error('Workflow error:', error);
      return { 
        error: error.message || String(error),
        session: debug ? session : undefined
      };
    }
  };
}

/**
 * Generate markdown with YAML frontmatter
 */
function generateMarkdown({ title, description, style, author, length, keywords, content }) {
  // Format YAML frontmatter
  const frontmatter = {
    title: title,
    description: description,
    author: author || {},
    style: typeof style === 'object' ? style : 
           typeof style === 'string' && style.length > 30 ? style : 
           { type: style || 'informative', description: 'Standard article format' },
    length: length || 0,
    keywords: keywords || [],
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
  return yamlHeader + content;
}
