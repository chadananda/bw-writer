# BlogWorks.ai Writer (bw-writer)

A powerful Model Context Protocol (MCP) server and CLI for generating well-researched blog articles using Perplexity for research and Claude 3.7 for writing.

---

## CLI & MCP Server Usage

### Installation

**Local (project only):**
```bash
npm install
dotenv .env
```

**Global (system-wide):**
```bash
npm install -g /path/to/bw-writer
```

**Via npx:**
```bash
npx bw-writer <args>
```

### Running the CLI

- **Local:**
  ```bash
  npx bw-writer <args>
  # or
  npm run cli -- <args>
  ```
- **Global:**
  ```bash
  bw-writer <args>
  ```

### Running the MCP Server

- **Local:**
  ```bash
  npx bw-writer-server
  # or
  npm run mcp
  ```
- **Global:**
  ```bash
  bw-writer-server
  ```

---

## Using with Cursor

**Quick (npx):**
- Set your MCP server path to:
  ```json
  "command": "npx bw-writer-server"
  ```

**Config-based:**
- In your Cursor MCP config:
  ```json
  {
    "servers": [
      {
        "name": "bw-writer",
        "serverPath": "/absolute/path/to/bw-writer-server"
      }
    ]
  }
  ```

---

## Using with WindSurf

**Quick (npx):**
- In WindSurf, set your server command to:
  ```json
  "command": "npx bw-writer-server"
  ```

**Config-based:**
- In `mcp_config.json`:
  ```json
  {
    "servers": [
      {
        "name": "bw-writer",
        "serverPath": "/absolute/path/to/bw-writer-server",
        "cmdArgs": [],
        "env": { "WINDSURF_MODE": "1" }
      }
    ]
  }
  ```

---

- `bw-writer` is the CLI for generating and managing articles.
- `bw-writer-server` is the MCP stdio server for integration with Cursor, WindSurf, and other MCP clients.

See below for full workflow and tool documentation.

## JavaScript SDK Usage

You can use bw-writer programmatically in your JavaScript applications without the MCP server interface. The system automatically extracts metadata, author information, keywords, and content directions from natural language prompts - ideal for voice interfaces or conversational inputs:

```javascript
import { articleWriter } from 'bw-writer';
import 'dotenv/config';

async function generateArticle() {
  // Natural language prompt (as might be dictated via voice interface)
  const detailedPrompt = `Let's write a medium-length article about the future of renewable energy. The author will be Dr. Sarah Chen, who is a fast-talking enthusiastic tech writer from New York who loves new ideas and pizza. The article will target keywords like renewable energy, wind energy and solar power. It's going to be a slightly academic article, but should include a few anecdotes from manufacturers about the competition in the field as well as some customers who have gone 100% solar. Make sure to tantalize the reader with prospects of new, cutting edge technology breakthroughs. Sarah has a blog at sarahchen.org. She sometimes shows up in podcasts, so if you can find a video podcast it would be helpful for media inclusion.`;

  try {
    const result = await articleWriter({
      detailedPrompt,
      llm: {
        model: "claude-3-opus-20240229",
        provider: "anthropic"
        // API key from ANTHROPIC_API_KEY environment variable
      }
    });
    
    // Return object structure:
    // {
    //   title: string,            // Article title
    //   description: string,      // Brief article description/summary
    //   style: string,            // Writing style (academic, conversational, etc.)
    //   length: number,           // Approximate word count
    //   author: {                 // Author information
    //     name: string,           // Author name
    //     bio: string,            // Author bio
    //     link: string            // Author website/link
    //   },
    //   keywords: string[],       // SEO keywords for the article
    //   body: string,             // Main article content in markdown format
    //   assets: string[],         // Array of asset URLs (images, media, etc.)
    //   markdown: string          // Complete markdown with YAML frontmatter
    // }
    //
    // When run with DEBUG=true, additional fields are available under 'debug'
    // including all intermediate research, outline, and draft data.
    
    // Access article properties
    console.log('Title:', result.title);
    console.log('Author:', result.author.name);
    console.log('Description:', result.description);
    console.log('Keywords:', result.keywords.join(', '));
    console.log('Body length:', result.body.length);
    console.log('Assets:', result.assets);
    
    // Access complete markdown (with frontmatter)
    console.log('Markdown:', result.markdown);
    
    // Debug data available when run with DEBUG=true
    // console.log('Research data:', result.debug?.research.researchData);
    
    return result;
  } catch (error) {
    console.error('Error generating article:', error);
  }
}

generateArticle();
```

This approach allows you to integrate professional article generation directly into your applications, websites, or content management systems.

## Streamlined MCP Implementation

This MCP server has been refactored with a lightweight, consolidated MCP implementation that ensures full compatibility with all MCP clients including Windsurf, Claude, and others. Benefits include:

1. **100% Protocol Compliance**: Follows the MCP specification exactly
2. **Cross-Platform Compatibility**: Works on Windows, macOS, Linux, and cloud environments
3. **Streamlined Code**: Focuses on business logic rather than protocol details
4. **Maintainable Architecture**: Single file implementation reduces complexity

## Features

- **Multi-Step Article Creation**: Research, planning, drafting, and editing
- **Mock Mode**: Test without making actual API calls using `--mock` flag
- **Debug Logging**: Enable detailed logs with `--debug` flag
- **API Key Validation**: Ensures required API keys are present
- **Error Handling**: Consistent error format for better client integration
- **HTTP Client**: Uses Ky for API requests with smart retry logic and caching

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/bw-writer.git
cd bw-writer

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

## Usage

### Running the Server

```bash
# Run in normal mode
npm start

# Run with debug logging
npm start -- --debug

# Run in mock mode (no API calls)
npm start -- --mock

# Run with both debug and mock
npm start -- --debug --mock
```

### Article Generation Workflow & Tools

The MCP server provides the following tools, orchestrated by the `article_writer` workflow:

1. **Session Creation** (handled in `main.js`): The session object is created first and coordinates all subsequent steps.
2. **analyze_request**: Extracts topic, title, style, YAML frontmatter, and author voice from the prompt.
3. **deepResearch**: Gathers and summarizes research sources for the topic.
4. **createOutline**: Produces a structured outline for the article using prompt metadata and research data.
5. **draftSection**: Drafts article sections (or the whole article) using the outline and research.
6. **improveReadability**: Enhances text readability and structure.
7. **embedMedia**: Suggests and embeds media content (images, infographics, etc.).

All tools are implemented as modular files in `src/app/tools/` and registered automatically. The workflow is orchestrated in `main.js`, passing the session and outputs between steps.

### Using with WindSurf

To use this MCP server with WindSurf:

1. Clone this repository
2. Install dependencies: `npm install`
3. Set the following in mcp_config.json for WindSurf:

```json
{
  "servers": [
    {
      "name": "bw-writer",
      "serverPath": "/path/to/mcp-servers/bw-writer/src/index.js",
      "cmdArgs": [],
      "env": {
        "WINDSURF_MODE": "1"
      }
    }
  ]
}
```

4. Restart WindSurf to detect the new MCP server

## Extending the MCP Server

Adding new tools to the MCP server is straightforward thanks to the official SDK. Follow these steps:

### 1. Create a Service Module

Create a new service module in the `src` directory (e.g., `service_new_feature.js`):

```javascript
// Example service module
export async function myNewTool(params) {
  // Implement your tool logic here
  return {
    result: "Success!",
    data: { /* your result data */ }
  };
}
```

### 2. Add the Tool to index.js

Import your service module and add a new tool definition to the `tools` array in `index.js` using the `createTool` helper function:

```javascript
import { myNewTool } from './service_new_feature.js';

// Add to the tools array
createTool(
  'my_new_tool',
  'Description of what your tool does',
  {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Description of parameter 1'
      },
      param2: {
        type: 'number',
        description: 'Description of parameter 2'
      }
    },
    required: ['param1']
  },
  async (params) => {
    debug(`Executing my_new_tool with params: ${JSON.stringify(params)}`);
    const validation = validateApiKeys();
    if (validation !== true) {
      throw new Error(validation.error);
    }
    
    if (CONFIG.mock) {
      return getMockData('my_new_tool', params);
    }
    
    return await myNewTool(params);
  }
)
```

### 3. Add Mock Data (Optional)

If you want to support mock mode, add mock data for your tool in `test/mocks/mock_data.js`.

## The BlogWorks.ai Ecosystem

BlogWorks.ai is planned as a comprehensive suite of MCP servers designed to handle all aspects of blog content creation and maintenance. Each server follows a consistent naming convention with the `bw-` prefix:

- **bw-writer** (this server): Research and write high-quality blog articles
- **bw-editor** (planned): Edit, proofread, and improve existing content
- **bw-seo** (planned): Optimize content for search engines
- **bw-translate** (planned): Translate content into multiple languages
- **bw-narrate** (planned): Convert written content to audio narration
- **bw-promote** (planned): Create social media content from articles
- **bw-video** (planned): Generate videos from scripts, images, and custom voice

Each server can be used independently or as part of an integrated workflow to make blog maintenance effortless and AI-powered.

## Features

## LLM API Integration

This MCP server uses a custom LLM client with [Ky](https://github.com/sindresorhus/ky) for HTTP requests, offering several advantages:

- **Unified Client Interface**: Consistent API for working with multiple LLM providers
- **Automatic Rate Limiting**: Prevents API quota exhaustion with configurable limits
- **Response Caching**: Improves performance and reduces costs by caching identical requests
- **Automatic Retries**: Handles transient API errors with configurable retry policies
- **Request Metadata**: Support for tracking and debugging with request metadata
- **Multi-provider Support**: Easily switch between Anthropic, Perplexity, and OpenAI

The HTTP client is implemented in `src/http_client.js` using Ky, a modern fetch-based HTTP client with:

- Smart retry logic with exponential backoff
- Timeout handling with configurable limits
- Response caching to improve performance
- Comprehensive error handling with detailed information

The LLM client is configured in `src/mcp_tools.js` with sensible defaults for:

- Cache settings (enabled by default)
- Timeout settings (60 seconds)
- Retry logic (3 retries with exponential backoff)

---

## MCP Stdio Protocol Usage

This server communicates **exclusively over stdio** (standard input/output):

- Reads one JSON request per line from stdin
- Writes one JSON response per line to stdout
- All debug/info/error logs are sent to stderr, never stdout
- All responses include a `protocolVersion` field for compatibility

### Example Usage

```bash
# Start the server and send a single request
$ echo '{"name": "create_session", "parameters": {"topic": "AI"}}' | node src/index.js

# Start the server, send multiple requests interactively
$ node src/index.js
{"name": "create_session", "parameters": {"topic": "AI"}}
{"name": "get_session", "parameters": {"sessionId": "..."}}
```

### Response Format

All responses are single-line JSON objects:

```
{"protocolVersion": "1.0", "result": { ... }}
```

On error:
```
{"protocolVersion": "1.0", "error": { "type": "InvalidJSON", "message": "Could not parse input as JSON" }}
```

### Environment Variables
- `PERPLEXITY_API_KEY`: Required for research endpoints (unless in mock mode)
- `ANTHROPIC_API_KEY`: Required for writing endpoints (unless in mock mode)
- `OPENAI_API_KEY`: Optional, for OpenAI-based operations (if implemented)
- `DEBUG_LOGS`: Set to '1' to enable debug logging to stderr (default: off)
- `WINDSURF_MODE`: Set to '1' for WindSurf compatibility
- `MOCK_MODE`: Set to '1' to use mock API responses (no API keys needed)

---

- **Multi-step Writing Pipeline**: Research → Planning → Writing → Editing
- **Free-form Detailed Prompting**: Full control over content style, tone, and structure
- **YAML Metadata Support**: Include titles, descriptions, keywords, and author information
- **Session Management**: Track progress and maintain context throughout the workflow
- **Research Module**: Gather authoritative sources with Perplexity
- **Creative Planning**: Generate multiple article angles and outlines
- **Section-based Writing**: Draft and refine content section by section
- **Readability Improvements**: AI-powered editing for clear, accessible content
- **CLI and API Support**: Flexible usage options

## Project Structure

```
bw-writer/
├── src/
│   ├── index.js             # Main server entry point (MCP handler)
│   ├── mcp.js               # Consolidated MCP implementation
│   ├── service_article.js   # Article creation and improvement
│   ├── service_sources.js   # Perplexity research functionality
│   ├── service_planning.js  # Article angles and outline generation
│   ├── service_writing.js   # Draft sections and improve readability
│   ├── service_article.js   # Complete article generation
│   ├── session_manager.js   # Multi-step session management
│   └── utils.js             # Utilities including YAML handling
├── .env                     # Environment variables (API keys)
├── .env.example             # Example environment file
├── package.json             # Project configuration
└── README.md                # Documentation
```

## Prerequisites

- Node.js (v18 or higher)
- Perplexity API key (for research)
- Anthropic API key (for Claude 3.7)

## Environment Variables

Copy `.env.example` to `.env` and add your API keys:

```
PERPLEXITY_API_KEY="your_perplexity_api_key"
ANTHROPIC_API_KEY="your_anthropic_api_key"
DEBUG_LOGS=0  # Set to 1 to enable debug logging
WINDSURF_MODE=0  # Set to 1 for WindSurf compatibility
MOCK_MODE=0  # Set to 1 to use mock API responses
```

The Perplexity and Anthropic API keys are required for full functionality, unless running in mock mode.

## Installation

### Global Installation

```bash
npm install -g bw-writer
```

After global installation, you can run the tool directly:

```bash
node src/index.js      # Start the server
```

Or use without installation:

```bash
node src/index.js
```

### Local Development Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your API keys
4. Start the server:
   ```
   node src/index.js
   ```

## Usage

### Command Line Interface

The CLI features a colorful, user-friendly interface with ASCII art and progress indicators:

```bash
# Display help with available commands
node src/index.js help

# Start the server
node src/index.js

# Using npm scripts after cloning
npm run cli
```

The CLI displays a beautiful ASCII art banner, colorful progress indicators, and clear results formatting. Running without arguments automatically shows the help screen.

### With Free-form Detailed Prompt

```bash
node src/index.js write "Machine Learning" --prompt="Write in the style of a university professor explaining concepts to undergraduate students. Include code examples in Python."
```

### With YAML Metadata

```bash
node src/index.js write "AI Ethics" --prompt="---
title: Ethical Considerations in Modern AI Development
description: A comprehensive look at the ethical challenges facing AI researchers today
keywords:
  - artificial intelligence
  - ethics
  - responsible AI
  - bias
author:
  name: Dr. Emily Chen
  bio: AI Ethics Researcher at Tech University
  email: emily@example.com
---

Write in a balanced tone, presenting multiple perspectives on each issue. Include real-world examples of ethical failures and successes."
```

### MCP API Functions

The MCP server exposes these functions through the `/mcp` endpoint:

#### 1. `research-topic`

Research a topic using Perplexity:

```json
{
  "name": "research-topic",
  "parameters": {
    "topic": "Quantum Computing Basics",
    "maxAgeDays": 365,
    "depth": "medium"
  }
}
```

#### 2. `generate-angles`

Generate creative angles based on research:

```json
{
  "name": "generate-angles",
  "parameters": {
    "topic": "Quantum Computing",
    "researchData": [...], // Output from research-topic
    "style": "conversational",
    "detailedPrompt": "Focus on real-world applications"
  }
}
```

#### 3. `create-outline`

Create a structured outline:

```json
{
  "name": "create-outline",
  "parameters": {
    "topic": "Quantum Computing",
    "angles": [...], // Output from generate-angles
    "research": [...], // Output from research-topic
    "style": "academic",
    "detailedPrompt": "Include historical context"
  }
}
```

#### 4. `draft-section`

Draft a specific section based on the outline:

```json
{
  "name": "draft-section",
  "parameters": {
    "outline": {...}, // Output from create-outline
    "sectionTitle": "Introduction", // or any section title from outline
    "research": [...], // Output from research-topic
    "style": "conversational",
    "detailedPrompt": "Begin with an engaging hook"
  }
}
```

#### 5. `improve-readability`

Improve content readability:

```json
{
  "name": "improve-readability",
  "parameters": {
    "text": "Content to improve...",
    "targetScore": 70,
    "detailedPrompt": "Maintain technical accuracy while simplifying language"
  }
}
```

#### 6. `create-session`

Create a persistent session to track the article creation process:

```json
{
  "name": "create-session",
  "parameters": {
    "topic": "Quantum Computing",
    "detailedPrompt": "---
title: Understanding Quantum Computing
---
Write for a general audience with analogies."
  }
}
```

#### 7. `write-article` (Full Pipeline)

Execute the entire article generation pipeline:

```json
{
  "name": "write-article",
  "parameters": {
    "topic": "Quantum Computing",
    "depth": "deep",
    "style": "conversational",
    "detailedPrompt": "Focus on recent breakthroughs and practical applications"
  }
}
```

## WindSurf Integration

### Configuration

To add this MCP server to WindSurf, update your WindSurf configuration to use the `command` field (not `url`). Example:

```json
{
  "bw-writer": {
    "command": "node /absolute/path/to/src/index.js",
    "env": {
      "PERPLEXITY_API_KEY": "your_perplexity_api_key",
      "ANTHROPIC_API_KEY": "your_anthropic_api_key"
    },
    "description": "BlogWorks.ai article writer with research, planning and drafting"
  }
}
```

- Windsurf will launch the MCP server as a subprocess and communicate via stdio.
- API keys are provided via the `env` block.
- No HTTP configuration or port is required.


## Free-form Prompting

The `detailedPrompt` parameter accepts flexible instructions that guide every step of the article creation:

- **Author Voice**: "Write in the style of a tech enthusiast"
- **Content Requirements**: "Include sections on X, Y, and Z"
- **Style Guidelines**: "Use metaphors and analogies"
- **Tone Preferences**: "Maintain a balanced, objective tone"

## YAML Metadata Support

Include YAML front matter in your `detailedPrompt` to provide structured metadata:

```yaml
---
title: Your Article Title
description: A brief description of the article
keywords:
  - keyword1
  - keyword2
author:
  name: Author Name
  bio: Short author biography
  email: author@example.com
---

Your detailed instructions continue here...
```

This metadata will be used to:
- Structure the article with the specified title
- Guide content creation based on description and keywords
- Add an author bio at the end of the article

## Server Startup

Start the server using one of the following methods:

```bash
# Using npm script
npm start

# Direct execution
node src/index.js

# With debug logging
node src/index.js --debug

# With mock mode (no API calls)
node src/index.js --mock
```

The server runs silently, communicating only through the standard MCP protocol channels (stdin/stdout) without unnecessary output that could interfere with automated systems.

## License

MIT
