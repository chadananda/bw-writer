# Article Generation Demo

This directory contains sample data and scripts to demonstrate the BlogWorks.ai Writer MCP server's article generation capabilities.

## Contents

- `article_topics.json` - Sample article topics with detailed prompts
- `generate_article.js` - Script to generate a complete article using the MCP server
- Generated articles (markdown files) - Output from running the script

## Using the Article Generator

The `generate_article.js` script demonstrates a complete article generation workflow using the MCP server. It:

1. Starts the MCP server
2. Runs through the entire article generation process:
   - Creating a session
   - Gathering sources
   - Generating creative angles
   - Creating an outline
   - Drafting each section (intro, body sections, conclusion)
   - Improving readability
3. Saves the final article as a markdown file

### Running the Script

```bash
# Generate an article with a random topic
node test/data/generate_article.js

# Generate an article with a specific topic (0-4)
node test/data/generate_article.js 2
```

### Real API Calls

The script uses real API calls to Perplexity and Anthropic by default, which requires valid API keys.

**Important**: Before running the script, ensure you have valid API keys in your `.env` file:
```
PERPLEXITY_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
```

If you want to run in mock mode (for testing without using API credits):

1. Edit the `generate_article.js` script
2. Change the `NODE_ENV: 'production'` line to `MOCK_MCP: '1'`

### Example Output

The script will generate a markdown file with the complete article, including:

- YAML frontmatter with metadata
- Article title and subtitle
- Introduction
- Body sections
- Conclusion

The output file is saved with a timestamp: `article_YYYY-MM-DDTHH-MM-SS.md`
