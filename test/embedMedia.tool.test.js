// embedMedia.tool.test.js
// Test suite for the Embed Media Tool

import { describe, it, expect } from "vitest";
import { z } from 'zod';
import embedMediaTool, {
  TOOL_NAME,
  TOOL_DESCRIPTION,
  strategizeMediaWithLLM,
  transformAndStoreImage,
  searchMediaUrl,
  mediaMarkdownBlock,
  insertMedia,
  generateInfographicImage,
  embedMediaImpl
} from '../src/tools/embedMedia.tool.js';

// Minimal mock for required params
const minimalParams = {
  article: '# Test Article\n\nThis is a test paragraph.',
  style: 'modern',
  s3Config: {
    bucket: 'test-bucket',
    region: 'us-east-1',
    accessKeyId: 'FAKEKEY',
    secretAccessKey: 'FAKESECRET',
  }
};

describe('Embed Media Tool', () => {
  it('should export all major functions', () => {
    expect(typeof strategizeMediaWithLLM).toBe('function');
    expect(typeof transformAndStoreImage).toBe('function');
    expect(typeof searchMediaUrl).toBe('function');
    expect(typeof mediaMarkdownBlock).toBe('function');
    expect(typeof insertMedia).toBe('function');
    expect(typeof generateInfographicImage).toBe('function');
    expect(typeof embedMediaImpl).toBe('function');
  });
  it('should export correct tool name and description', () => {
    expect(TOOL_NAME).toBeTypeOf('string');
    expect(TOOL_DESCRIPTION).toBeTypeOf('string');
  });

  it('should validate minimal parameters with zod schema', () => {
    const { parameters } = embedMediaTool;
    expect(() => parameters.parse(minimalParams)).not.toThrow();
  });

  it('should throw if required parameters are missing', () => {
    const { parameters } = embedMediaTool;
    expect(() => parameters.parse({})).toThrow();
  });

  it('should run insertMedia pipeline and return expected keys (mocked)', async () => {
    // This test assumes a mock or stub for image generation and S3 upload
    const result = await insertMedia('# Test\nParagraph.', ['image'], 'modern');
    expect(result).toBeTypeOf('object');
    expect(Object.keys(result)).toEqual(expect.arrayContaining(['mediaContent', 'mediaAssets']));
  });

  it('should run embedMediaImpl pipeline and return expected keys (mocked)', async () => {
    const params = { seoContent: '# Test\nParagraph.', imageStyle: 'modern' };
    const result = await embedMediaImpl(params, { mock: true });
    expect(result).toBeTypeOf('object');
    expect(Object.keys(result)).toEqual(expect.arrayContaining(['mediaContent', 'mediaAssets']));
  });

  it('should return enhanced article and media suggestions (mocked)', async () => {
    // This test assumes a mock or stub for image generation and S3 upload
    // For now, just check that the handler runs and returns expected keys
    const { handler } = embedMediaTool;
    const result = await handler(minimalParams, { mock: true });
    expect(result).toBeTypeOf('object');
    // Accept either old or new key sets for compatibility
    expect(
      Object.keys(result)
    ).toEqual(
      expect.arrayContaining([
        'mediaContent', 'mediaAssets'
      ])
    );
  });
});
