/**
 * Configuration utilities for MCP server
 * Generic configuration that doesn't contain application-specific values
 */
import { program } from 'commander';
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
      vendor: packageData.vendor || packageData.author || 'Unknown'
    };
  } catch (error) {
    console.error('Error loading package metadata:', error);
    return {
      name: 'mcp-server',
      version: '0.0.0',
      description: 'MCP Server',
      vendor: 'Unknown'
    };
  }
}

/**
 * Parse command line arguments and set up configuration
 * @returns {Object} Configuration object
 */
export function setupConfig() {
  // Parse command line arguments
  program
    .option('--debug', 'Enable debug logging')
    .option('--mock', 'Use mock data instead of making API calls')
    .parse(process.argv);

  // Load metadata from package.json
  const metadata = loadPackageMetadata();

  const config = {
    debug: program.opts().debug || process.env.DEBUG_LOGS === 'true',
    mock: program.opts().mock || process.env.MOCK_MODE === 'true' || process.env.MOCK_MODE === '1',
    version: metadata.version,
    serverName: metadata.name,
    vendor: metadata.vendor
  };

  return config;
}
