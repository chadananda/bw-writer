#!/usr/bin/env node

/**
 * Simple test script for the bw-writer MCP server
 * This script tests the MCP server by sending a request to create a session
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_DIR = path.resolve(__dirname, '..');

// Path to the MCP server
const SERVER_PATH = path.join(PROJECT_DIR, 'src', 'index.js');

// Start the MCP server process
console.log(`Starting MCP server: ${SERVER_PATH}`);
const serverProcess = spawn('node', [SERVER_PATH], {
  env: {
    ...process.env,
    MOCK_MODE: '1', // Use mock mode for testing
    DEBUG_LOGS: '1' // Enable debug logs
  }
});

// Handle server output
serverProcess.stdout.on('data', (data) => {
  try {
    const response = JSON.parse(data.toString());
    console.log('Received response:');
    console.log(JSON.stringify(response, null, 2));
    
    // If we got a successful response, exit the process
    if (response.result) {
      console.log('Test successful!');
      serverProcess.kill();
      process.exit(0);
    }
  } catch (error) {
    console.error('Error parsing server response:', error);
    console.error('Raw response:', data.toString());
  }
});

serverProcess.stderr.on('data', (data) => {
  console.log(`Server log: ${data}`);
});

serverProcess.on('error', (error) => {
  console.error(`Server error: ${error.message}`);
  process.exit(1);
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Wait a moment for the server to start
setTimeout(() => {
  console.log('Sending test request...');
  
  // Test the create_session endpoint
  const request = {
    name: 'create_session',
    parameters: {
      topic: 'Freirean takeover of churches in America',
      detailedPrompt: 'Write an academic article about how Paulo Freire\'s critical pedagogy has influenced American churches, particularly in progressive denominations.'
    }
  };
  
  // Send the request to the server
  serverProcess.stdin.write(JSON.stringify(request) + '\n');
}, 1000);

// Set a timeout to kill the server if the test takes too long
setTimeout(() => {
  console.error('Test timed out after 10 seconds');
  serverProcess.kill();
  process.exit(1);
}, 10000);
