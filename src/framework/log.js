// Simple debug logger for bw-writer
// Only logs if process.env.DEBUG or --debug flag is set

import fs from 'fs';
import path from 'path';

function isDebug() {
  if (process.env.DEBUG === '1' || process.env.DEBUG === 'true') return true;
  if (process.argv.includes('--debug')) return true;
  return false;
}

export function debugLog(...args) {
  if (isDebug()) {
    // Use stderr so it doesn't interfere with stdio-based tool output
    // eslint-disable-next-line no-console
    console.error('[DEBUG]', ...args);
  }
}

// Log tool input and output to a dedicated file for each call
export function logToolCall(toolName, input, output, context = {}) {
  if (!context.debug && !isDebug()) return;
  
  try {
    const logsDir = path.join(process.cwd(), 'logs', 'tools');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create a unique filename for this tool call
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logsDir, `${toolName}-${timestamp}.log`);
    
    // Format the input and output for logging
    const inputStr = typeof input === 'object' ? JSON.stringify(input, null, 2) : input;
    const outputStr = typeof output === 'object' ? JSON.stringify(output, null, 2) : output;
    
    const logContent = `TOOL: ${toolName}\n\nINPUT:\n${inputStr}\n\nOUTPUT:\n${outputStr}\n`;
    
    // Write to a dedicated log file
    fs.writeFileSync(logFile, logContent);
    debugLog(`Logged tool call for ${toolName} to ${logFile}`);
    return logFile;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Error logging tool call: ${err.message}`);
    return null;
  }
}
