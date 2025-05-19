#!/usr/bin/env node
/**
 * Command Line Interface for MCP Server
 * This tool enables direct interaction with MCP server functionality
 * It uses the application object exported by application.js
 */
import chalk from 'chalk';
import figlet from 'figlet';
import 'dotenv/config';
import { validateTopic, validateApiKeys } from '../tools/tool-utils.js';
import { cliUI, loadPackageMetadata } from './cli-helpers.js';
import { application } from '../application.js';

/**
 * Create UI utilities with dependencies
 */
const metadata = loadPackageMetadata();
const ui = {
  showBanner: (command, topic, options) => 
    cliUI.showCommandBanner(command, topic, options, { chalk, figlet }, metadata),
  showError: (message) => 
    cliUI.showError(message, { chalk }),
  showSuccess: (message, content) => 
    cliUI.showSuccess(message, content, { chalk }),
  showHelp: () => {
    // Create command descriptions from application workflows
    const commands = {};
    Object.entries(application.workflows).forEach(([cmd, info]) => {
      commands[cmd] = {
        description: info.description,
        args: info.args || '<topic>'
      };
    });
    commands.help = 'Show this help message';
    
    cliUI.showHelp({ chalk, figlet }, metadata, commands);
  },
  parseOptions: cliUI.parseOptions
};

/**
 * Create tool handler dependencies
 */
const createToolDependencies = () => {
  const toolDeps = {};
  
  // Map tool handlers from application
  application.tools.forEach(tool => {
    const camelCaseName = tool.name.replace(/(^|_)([a-z])/g, (_, p1, p2) => p2.toUpperCase())
                              .replace(/_/g, '')
                              .replace(/^([A-Z])/, (_, p1) => p1.toLowerCase());
    
    toolDeps[camelCaseName] = (params) => tool.handler(params);
  });
  
  return {
    ...toolDeps,
    ui,
    chalk
  };
};

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === 'help')) {
    ui.showHelp();
    return;
  }
  
  try {
    // Process command and arguments
    const command = args[0];
    const topic = args[1] ? args[1].trim() : null;
    const options = ui.parseOptions(args.slice(2));
    
    // Validate API keys if not in mock mode
    if (!application.config.mock) {
      const validation = validateApiKeys(false);
      if (validation !== true) {
        ui.showError(validation.error);
        return;
      }
    }
    
    // Get available commands from application workflows
    const commands = [...Object.keys(application.workflows), 'help'];
    
    // Check if command is valid
    if (!commands.includes(command)) {
      ui.showError(`Unknown command: ${command}`);
      ui.showHelp();
      return;
    }
    
    if (command !== 'help' && !topic) {
      ui.showError('Topic is required');
      ui.showHelp();
      return;
    }
    
    // Validate topic format if provided
    if (topic) {
      try {
        validateTopic(topic);
      } catch (error) {
        ui.showError(error.message);
        return;
      }
    }
    
    // Show command banner
    ui.showBanner(command, topic, options);
    
    // Create tool dependencies
    const deps = createToolDependencies();
    
    // Execute the appropriate workflow
    if (command in application.workflows) {
      const result = await application.workflows[command].handler(topic, options, deps);
      ui.showSuccess(`${command.charAt(0).toUpperCase() + command.slice(1)} Complete`, 
                    result.content || JSON.stringify(result, null, 2));
    } else {
      ui.showError(`Command ${command} is not implemented yet`);
    }
  } catch (error) {
    ui.showError(`Error: ${error.message}`);
    if (application.config.debug) {
      console.error(error);
    }
  } finally {
    // Use application metadata for the footer
    const appName = application.config.displayName || application.config.name;
    console.log(chalk.dim(`\n${appName} - Made with ❤️  ${new Date().getFullYear()}`));
  }
}

// Run the CLI
main().catch(error => {
  console.error(chalk.red(`Fatal error: ${error.message}`));
  if (process.env.DEBUG_LOGS === 'true') {
    console.error(error);
  }
  process.exit(1);
});
