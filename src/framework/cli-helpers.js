/**
 * CLI UI Utilities for MCP servers
 * Generic utilities that don't contain application-specific code
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Load package.json metadata
 * @returns {Object} Package metadata
 */
export function loadPackageMetadata() {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const packagePath = path.resolve(__dirname, '../../package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return {
      name: packageData.name,
      version: packageData.version,
      description: packageData.description || 'MCP Server',
      vendor: packageData.vendor || packageData.author || 'Unknown',
      displayName: packageData.displayName || packageData.name
    };
  } catch (error) {
    console.error('Error loading package metadata:', error);
    return {
      name: 'mcp-server',
      version: '0.0.0',
      description: 'MCP Server',
      vendor: 'Unknown',
      displayName: 'MCP Server'
    };
  }
}

/**
 * Load all tools from the tools directory
 * @param {Object} options - Options for loading tools
 * @returns {Object} Tool handlers with debug and mock options
 */
export async function loadTools(options = {}) {
  const { debug = console.log, mockMode = false } = options;
  const toolHandlers = {};
  
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const toolsDir = path.resolve(__dirname, '../tools');
    const toolFiles = fs.readdirSync(toolsDir)
      .filter(file => file.endsWith('Tool.js'));
    
    for (const file of toolFiles) {
      try {
        const toolModule = await import(`../tools/${file}`);
        const toolName = file.replace(/Tool\\.js$/, '');
        const camelCaseName = toolName.charAt(0).toLowerCase() + toolName.slice(1);
        
        if (toolModule.default && typeof toolModule.default.handler === 'function') {
          toolHandlers[camelCaseName] = (params) => 
            toolModule.default.handler(params, { debug, mockMode });
        }
      } catch (err) {
        debug(`Error loading tool ${file}: ${err.message}`);
      }
    }
    
    return toolHandlers;
  } catch (error) {
    debug(`Error loading tools: ${error.message}`);
    return {};
  }
}

/**
 * CLI UI utilities for displaying information
 * These are generic UI components that can be used by any MCP CLI
 */
export const cliUI = {
  /**
   * Show command start banner
   * @param {string} command - Command being executed
   * @param {string} topic - Topic being processed
   * @param {Object} options - Command options
   * @param {Object} dependencies - Dependencies like chalk and figlet
   * @param {Object} metadata - Application metadata
   */
  showCommandBanner(command, topic, options, { chalk, figlet }, metadata = {}) {
    // Clear console for a clean start
    console.clear();
    
    // Use metadata or fallback to default
    const title = metadata.displayName || metadata.name || 'MCP Server';
    
    console.log(chalk.blue(figlet.textSync(title, {
      font: 'Slant',
      horizontalLayout: 'default',
      width: 80
    })));
    
    // Generic command actions mapping
    const commandActions = {
      'help': 'Showing help for',
      'version': 'Displaying version information for'
      // Other commands will use the default action
    };
    
    const action = commandActions[command] || `Running ${command} on`;
    
    console.log(chalk.cyan(`\n${action}: ${chalk.white.bold(topic || metadata.name)}\n`));
    
    // Show selected options
    if (Object.keys(options).length > 0) {
      console.log(chalk.dim('Options:'));
      for (const [key, value] of Object.entries(options)) {
        if (typeof value === 'string' && value.length > 50) {
          const displayValue = `${value.substring(0, 50)}...`;
          console.log(chalk.dim(`  ${key}: "${displayValue}"`));
        } else {
          console.log(chalk.dim(`  ${key}: ${value}`));
        }
      }
      console.log('');
    }
    
    console.log(chalk.yellow('⏳ Processing... Please wait ⏳'));
    console.log('');
  },

  /**
   * Show error message with styling
   * @param {string} message - Error message to display
   * @param {Object} dependencies - Dependencies like chalk
   */
  showError(message, { chalk }) {
    console.log(chalk.red.bold('\n❌ ERROR:'));
    console.log(chalk.red(`  ${message}\n`));
  },

  /**
   * Show success message with results
   * @param {string} message - Success message
   * @param {string} content - Content to display
   * @param {Object} dependencies - Dependencies like chalk
   */
  showSuccess(message, content, { chalk }) {
    console.log(chalk.green.bold(`\n✅ ${message}:`));
    console.log(chalk.white('='.repeat(message.length + 3)));
    
    // Handle different content types
    if (typeof content === 'string') {
      console.log(content);
    } else if (content && typeof content === 'object') {
      try {
        console.log(JSON.stringify(content, null, 2));
      } catch (e) {
        console.log(content);
      }
    } else {
      console.log('No content to display');
    }
  },

  /**
   * Display ASCII art logo and help information
   * @param {Object} dependencies - Dependencies like chalk and figlet
   * @param {Object} metadata - Application metadata
   */
  showHelp({ chalk, figlet }, metadata = {}, commands = {}) {
    // Generate ASCII art title
    const title = metadata.displayName || metadata.name || 'MCP Server';
    const description = metadata.description || 'MCP Server';
    const vendor = metadata.vendor || 'Unknown';
    
    console.log(chalk.blue(figlet.textSync(title, {
      font: 'Standard',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80
    })));
    
    console.log(chalk.cyan(`${metadata.name || 'mcp-server'}: ${description}`));
    console.log(chalk.gray(`Part of the ${vendor} MCP server ecosystem`));
    
    console.log(chalk.cyan('✨ MCP Server CLI ✨\n'));
    
    console.log(chalk.white.bold('USAGE:'));
    console.log(`  ${chalk.green(metadata.name || 'mcp')} ${chalk.yellow('[command]')} ${chalk.magenta('<args>')} ${chalk.cyan('[options]')}\n`);
    
    // Display commands
    if (Object.keys(commands).length > 0) {
      console.log(chalk.white.bold('COMMANDS:'));
      
      Object.entries(commands).forEach(([cmd, info]) => {
        const description = typeof info === 'string' ? info : (info.description || 'No description');
        const args = info.args || '';
        console.log(`  ${chalk.yellow(cmd.padEnd(8))}  ${chalk.magenta(args.padEnd(10))}  ${chalk.white(description)}`);
      });
      
      console.log('');
    }
    
    // Always show help command
    if (!commands.help) {
      console.log(chalk.white.bold('COMMANDS:'));
      console.log(`  ${chalk.yellow('help')}                ${chalk.white('Show this help message')}`);
      console.log('');
    }
    
    // Show common options
    console.log(chalk.white.bold('COMMON OPTIONS:'));
    console.log(`  ${chalk.cyan('--debug')}           ${chalk.white('Enable debug logging')}`);
    console.log(`  ${chalk.cyan('--mock')}            ${chalk.white('Use mock data instead of making API calls')}`);
    console.log('');
  },

  /**
   * Parse command options
   * @param {Array<string>} args - Command-line arguments
   * @returns {Object} Parsed options
   */
  parseOptions(args) {
    const options = {};
    
    for (const arg of args) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        options[key] = value || true;
      }
    }
    
    return options;
  }
};
