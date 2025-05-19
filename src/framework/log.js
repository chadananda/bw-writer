// Simple debug logger for bw-writer
// Only logs if process.env.DEBUG or --debug flag is set

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
