#!/usr/bin/env node

/**
 * Windsurf MCP Protocol Validator
 * 
 * A specialized validator for testing MCP servers against the Windsurf MCP specification.
 * This tool performs a comprehensive validation of your MCP server implementation
 * to ensure it's compatible with Windsurf's requirements.
 * 
 * Usage:
 *   node windsurf-mcp-validator.js [server-command]
 * 
 * Example:
 *   node windsurf-mcp-validator.js "node src/index.js"
 */

import { spawn } from 'child_process';
import readline from 'readline';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Configuration
const DEFAULT_SERVER_COMMAND = 'node src/index.js';
const TEST_TIMEOUT = 15000; // 15 seconds

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_FILE = path.join(logsDir, 'windsurf-mcp-validation.log');

// Parse command line arguments
const serverCommand = process.argv[2] || DEFAULT_SERVER_COMMAND;

// Create a log file stream
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });
const log = (message) => {
  console.log(message);
  logStream.write(message + '\n');
};

log(chalk.blue('Windsurf MCP Protocol Validator'));
log(chalk.blue('============================='));
log(`Testing server command: ${chalk.yellow(serverCommand)}`);
log(`Log file: ${chalk.yellow(LOG_FILE)}`);
log('');

// Windsurf-specific MCP test cases
const testCases = [
  // Basic protocol compliance
  {
    name: 'Protocol Version Check',
    description: 'Verifies that responses include the protocolVersion field',
    input: { name: 'list_resources', parameters: {} },
    validate: (response) => {
      if (!response.protocolVersion) {
        throw new Error('Response missing required protocolVersion field');
      }
      if (response.protocolVersion !== '1.0') {
        throw new Error(`Expected protocolVersion "1.0", got "${response.protocolVersion}"`);
      }
      return true;
    }
  },
  
  // JSON-RPC Protocol Tests
  {
    name: 'JSON-RPC Initialize',
    description: 'Verifies that the server properly handles JSON-RPC initialize requests',
    input: {
      jsonrpc: '2.0',
      id: 100,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        },
        capabilities: {}
      }
    },
    validate: (response) => {
      if (!response.jsonrpc || response.jsonrpc !== '2.0') {
        throw new Error('Response missing or incorrect jsonrpc version');
      }
      if (response.id !== 100) {
        throw new Error(`Response id mismatch: expected 100, got ${response.id}`);
      }
      if (!response.result) {
        throw new Error('Response missing result object');
      }
      if (!response.result.capabilities) {
        throw new Error('Response missing capabilities object');
      }
      if (!response.result.serverInfo) {
        throw new Error('Response missing serverInfo object');
      }
      if (!response.result.serverInfo.name || !response.result.serverInfo.version) {
        throw new Error('ServerInfo missing name or version');
      }
      return true;
    }
  },
  
  {
    name: 'JSON-RPC Tools List',
    description: 'Verifies that the server properly handles tools/list requests',
    input: {
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/list',
      params: {}
    },
    validate: (response) => {
      if (!response.jsonrpc || response.jsonrpc !== '2.0') {
        throw new Error('Response missing or incorrect jsonrpc version');
      }
      if (response.id !== 101) {
        throw new Error(`Response id mismatch: expected 101, got ${response.id}`);
      }
      if (!response.result) {
        throw new Error('Response missing result object');
      }
      if (!response.result.tools || !Array.isArray(response.result.tools)) {
        throw new Error('Response missing tools array');
      }
      if (response.result.tools.length === 0) {
        throw new Error('Tools array is empty');
      }
      
      // Validate each tool has the required fields
      for (const tool of response.result.tools) {
        if (!tool.name) {
          throw new Error('Tool missing name');
        }
        if (!tool.description) {
          throw new Error('Tool missing description');
        }
        if (!tool.parameters) {
          throw new Error('Tool missing parameters schema');
        }
      }
      return true;
    }
  },
  
  {
    name: 'JSON-RPC Unknown Method',
    description: 'Verifies that the server properly handles unknown JSON-RPC methods',
    input: {
      jsonrpc: '2.0',
      id: 102,
      method: 'unknown_method_xyz',
      params: {}
    },
    validate: (response) => {
      if (!response.jsonrpc || response.jsonrpc !== '2.0') {
        throw new Error('Response missing or incorrect jsonrpc version');
      }
      if (response.id !== 102) {
        throw new Error(`Response id mismatch: expected 102, got ${response.id}`);
      }
      if (!response.error) {
        throw new Error('Response missing error object for unknown method');
      }
      if (!response.error.code) {
        throw new Error('Error missing code');
      }
      if (!response.error.message) {
        throw new Error('Error missing message');
      }
      return true;
    }
  },
  
  {
    name: 'JSON-RPC Tools Execute',
    description: 'Verifies that the server properly handles tools/execute requests',
    input: {
      jsonrpc: '2.0',
      id: 103,
      method: 'tools/execute',
      params: {
        name: 'create_session',
        parameters: {
          topic: 'Artificial Intelligence'
        }
      }
    },
    validate: (response) => {
      if (!response.jsonrpc || response.jsonrpc !== '2.0') {
        throw new Error('Response missing or incorrect jsonrpc version');
      }
      if (response.id !== 103) {
        throw new Error(`Response id mismatch: expected 103, got ${response.id}`);
      }
      
      // Either result or error should be present
      if (!response.result && !response.error) {
        throw new Error('Response missing both result and error objects');
      }
      
      return true;
    }
  },
  
  // Required MCP endpoints
  {
    name: 'List Resources Endpoint',
    description: 'Checks that list_resources returns properly formatted resources',
    input: { name: 'list_resources', parameters: {} },
    validate: (response) => {
      if (!response.result) {
        throw new Error('list_resources should return a result object');
      }
      if (!response.result.resources || !Array.isArray(response.result.resources)) {
        throw new Error('list_resources should return a resources array');
      }
      // Check that resources have required fields
      for (const resource of response.result.resources) {
        if (!resource.name || !resource.uri || !resource.description) {
          throw new Error('Each resource must have name, uri, and description fields');
        }
      }
      return true;
    }
  },
  
  {
    name: 'Read Resource Endpoint',
    description: 'Checks that read_resource handles both valid and invalid URIs',
    input: { name: 'read_resource', parameters: { uri: 'schema' } },
    validate: (response) => {
      if (!response.result) {
        throw new Error('read_resource with uri=schema should return a result');
      }
      return true;
    }
  },
  
  {
    name: 'Read Resource - Invalid URI',
    description: 'Checks that read_resource returns proper error for invalid URIs',
    input: { name: 'read_resource', parameters: { uri: 'nonexistent-resource' } },
    validate: (response) => {
      if (!response.error) {
        throw new Error('read_resource with invalid URI should return an error');
      }
      if (response.error.type !== 'ResourceNotFound') {
        throw new Error(`Expected error type "ResourceNotFound", got "${response.error.type}"`);
      }
      return true;
    }
  },
  
  // Error handling
  {
    name: 'Unknown Function Error',
    description: 'Checks that server returns proper error for unknown functions',
    input: { name: 'unknown_function_xyz', parameters: {} },
    validate: (response) => {
      if (!response.error) {
        throw new Error('Server should return error for unknown functions');
      }
      if (response.error.type !== 'UnknownFunction') {
        throw new Error(`Expected error type "UnknownFunction", got "${response.error.type}"`);
      }
      return true;
    }
  },
  
  {
    name: 'Invalid JSON Error',
    description: 'Checks that server handles malformed JSON properly',
    input: '{ "name": "list_resources", "parameters": {', // Malformed JSON
    validate: (response) => {
      if (!response.error) {
        throw new Error('Server should return error for malformed JSON');
      }
      if (!['InvalidJSON', 'ParseError'].includes(response.error.type)) {
        throw new Error(`Expected error type "InvalidJSON" or "ParseError", got "${response.error.type}"`);
      }
      return true;
    }
  },
  
  {
    name: 'Missing Function Name Error',
    description: 'Checks that server requires the name field',
    input: { parameters: {} }, // Missing name field
    validate: (response) => {
      if (!response.error) {
        throw new Error('Server should return error for missing function name');
      }
      if (!['InvalidRequest', 'MissingParameter'].includes(response.error.type)) {
        throw new Error(`Expected error type "InvalidRequest" or "MissingParameter", got "${response.error.type}"`);
      }
      return true;
    }
  },
  
  // Windsurf-specific requirements
  {
    name: 'No Extraneous Stdout Output',
    description: 'Checks that server only outputs valid JSON responses to stdout',
    input: { name: 'list_resources', parameters: {} },
    validate: (response, stdout) => {
      // Parse each line of stdout as JSON
      const lines = stdout.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          JSON.parse(line);
        } catch (e) {
          throw new Error(`Non-JSON output detected in stdout: "${line}"`);
        }
      }
      return true;
    }
  },
  
  {
    name: 'Proper Error Response Structure',
    description: 'Checks that error responses have the correct structure',
    input: { name: 'unknown_function_xyz', parameters: {} },
    validate: (response) => {
      if (!response.error) {
        throw new Error('Server should return error for unknown functions');
      }
      if (!response.error.type || !response.error.message) {
        throw new Error('Error response must include type and message fields');
      }
      if (response.result) {
        throw new Error('Error response should not include a result field');
      }
      return true;
    }
  }
];

/**
 * Run a single test case against the MCP server
 */
async function runTest(testCase) {
  return new Promise((resolve, reject) => {
    log(`\n[TEST] Running test: ${chalk.cyan(testCase.name)}`);
    log(`Description: ${testCase.description}`);
    
    // Start the server process
    const cmdParts = serverCommand.split(' ');
    const serverProcess = spawn(cmdParts[0], cmdParts.slice(1), {
      env: {
        ...process.env,
        WINDSURF_MODE: '1',
        MOCK_MODE: '1' // Use mock mode for faster testing
      },
      shell: true
    });
    
    let stdoutData = '';
    let stderrData = '';
    let testPassed = false;
    
    // Set timeout
    const timeout = setTimeout(() => {
      serverProcess.kill();
      reject(new Error(`Test "${testCase.name}" timed out after ${TEST_TIMEOUT}ms`));
    }, TEST_TIMEOUT);
    
    // Collect stdout data
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutData += output;
      
      // Log raw output for debugging
      log(`[STDOUT] ${output.trim()}`);
      
      // Try to parse each line as JSON
      const lines = output.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          
          // Run validation function
          try {
            if (testCase.validate(response, stdoutData)) {
              testPassed = true;
              clearTimeout(timeout);
              serverProcess.kill();
              resolve({ passed: true, response });
            }
          } catch (validationError) {
            clearTimeout(timeout);
            serverProcess.kill();
            reject(validationError);
          }
        } catch (parseError) {
          // Not valid JSON or incomplete line - we'll handle this in the validation
          if (testCase.name !== 'No Extraneous Stdout Output' && 
              testCase.name !== 'Invalid JSON Error') {
            log(chalk.red(`Invalid JSON in stdout: ${line}`));
          }
        }
      }
    });
    
    // Collect stderr data (for debugging)
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderrData += output;
      log(`[STDERR] ${output.trim()}`);
    });
    
    // Handle server process exit
    serverProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      if (!testPassed) {
        if (code !== 0) {
          reject(new Error(`Server process exited with code ${code}`));
        } else if (!stdoutData.trim()) {
          reject(new Error('Server did not produce any output'));
        } else {
          reject(new Error('Server output did not pass validation'));
        }
      }
    });
    
    // Send test input to the server
    const input = typeof testCase.input === 'function' ? testCase.input() : testCase.input;
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    log(`[INPUT] ${inputStr}`);
    serverProcess.stdin.write(inputStr + '\n');
  });
}

/**
 * Run all tests
 */
async function runAllTests() {
  let passCount = 0;
  let failCount = 0;
  const results = [];
  
  for (const testCase of testCases) {
    try {
      const result = await runTest(testCase);
      log(chalk.green(`✓ PASS: ${testCase.name}`));
      passCount++;
      results.push({ name: testCase.name, passed: true });
    } catch (error) {
      log(chalk.red(`✗ FAIL: ${testCase.name}`));
      log(chalk.red(`  Error: ${error.message}`));
      failCount++;
      results.push({ name: testCase.name, passed: false, error: error.message });
    }
  }
  
  // Generate summary
  log('\n====================');
  log(`Tests completed: ${passCount + failCount}`);
  log(`${chalk.green(`Passed: ${passCount}`)}, ${chalk.red(`Failed: ${failCount}`)}`);
  
  if (failCount === 0) {
    log(chalk.green('\n✓ WINDSURF MCP VALIDATION PASSED'));
    log(chalk.green('Your server implementation appears to be compliant with the Windsurf MCP protocol.'));
    log(chalk.green('It should work correctly with Windsurf integration.'));
  } else {
    log(chalk.red('\n✗ WINDSURF MCP VALIDATION FAILED'));
    log(chalk.red('Your server implementation has issues with Windsurf MCP protocol compliance.'));
    log(chalk.yellow('Common issues:'));
    log(chalk.yellow('1. Extraneous output to stdout (should ONLY be valid JSON responses)'));
    log(chalk.yellow('2. Missing or incorrect protocolVersion field'));
    log(chalk.yellow('3. Incorrect error response structure'));
    log(chalk.yellow('4. Missing required endpoints (list_resources, read_resource)'));
    log(chalk.yellow('\nFix the failed tests and run the validator again.'));
  }
  
  // Write results to JSON file
  const resultsFile = path.join(logsDir, 'windsurf-mcp-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    command: serverCommand,
    summary: {
      total: passCount + failCount,
      passed: passCount,
      failed: failCount
    },
    results
  }, null, 2));
  
  log(`\nDetailed results saved to: ${chalk.yellow(resultsFile)}`);
  log(`Full validation log: ${chalk.yellow(LOG_FILE)}`);
}

// Run all tests
runAllTests().catch(error => {
  log(chalk.red(`Fatal error: ${error.message}`));
  process.exit(1);
}).finally(() => {
  logStream.end();
});
