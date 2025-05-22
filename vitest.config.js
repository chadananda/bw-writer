export default {
  test: {
    include: ['test/llm-utils.test.js'],
    testTimeout: 30000,
    environment: 'node',
    globals: true,
    setupFiles: ['dotenv/config']
  }
}
