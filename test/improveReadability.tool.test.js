import { describe, it, expect, vi, beforeEach } from 'vitest';
import { improveReadabilityImpl } from '../src/tools/improveReadability.tool.js';

// Mock getLLMClient to avoid real API calls
vi.mock('../src/tools/improveReadability.tool.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getLLMClient: () => ({
      complete: vi.fn(async ({ prompt }) => ({
        text: JSON.stringify({ version: 1 })
      }))
    })
  };
});

describe('improveReadabilityImpl', () => {
  const params = {
    title: 'Test Title',
    text: 'This is a test block.',
    style: 'concise',
    proposalSummary: 'A summary of the proposal.',
    researchData: 'Some research.'
  };

  it('should return a result without throwing', async () => {
    await expect(improveReadabilityImpl(params)).resolves.toBeDefined();
  });

  it('should throw if required fields are missing', async () => {
    await expect(improveReadabilityImpl({})).rejects.toThrow();
    await expect(improveReadabilityImpl({ title: 'Only title' })).rejects.toThrow();
  });

  it('should accept optional fields as undefined', async () => {
    const minimal = { title: 'T', text: 'X' };
    await expect(improveReadabilityImpl(minimal)).resolves.toBeDefined();
  });
});
