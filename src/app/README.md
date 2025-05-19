# BlogWorks Writer Application (bw-writer)

This folder contains all application-specific code, workflow logic, and tools for the BlogWorks MCP server.

## Structure
- `tools/` — All tool implementations (each as a .tool.js module)
- `app-utils.js` — Application-specific utilities for tool composition, validation, YAML, etc.
- `README.md` — This documentation file
- `main.js` — Main workflow and tool orchestration logic

## Workflow
The article generation workflow is as follows:

1. **Session Creation** (in `main.js`): The session object is created first and coordinates all subsequent steps.
2. **analyze_request** (`analyzeRequest.tool.js`): Extracts topic, title, style, YAML frontmatter, and author voice from the prompt.
3. **deepResearch** (`deepResearch.tool.js`): Gathers and summarizes research sources for the topic.
4. **createOutline** (`createOutline.tool.js`): Produces a structured outline for the article using prompt metadata and research data.
5. **draftSection** (`draftSection.tool.js`): Drafts article sections (or the whole article) using the outline and research.
6. **improveReadability** (`improveReadability.tool.js`): Enhances text readability and structure.
7. **embedMedia** (`embedMedia.tool.js`): Suggests and embeds media content (images, infographics, etc.).

## Notes
- All tool registration and workflow logic is dynamic; tools are auto-discovered from the `tools/` folder.
- Utility functions used by tools are in `app-utils.js`.
- See the root README for framework and deployment instructions.
