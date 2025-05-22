import 'dotenv/config';
import { z } from 'zod';
import { callLLM } from '../src/framework/llm-utils.js';

const cases = [
  {
    name: 'string',
    prompt: 'Return a JSON object with a single string field: { "value": "foobar" }',
    schema: z.object({ value: z.string() })
  },
  {
    name: 'number',
    prompt: 'Return a JSON object with a single number field: { "num": 123 }',
    schema: z.object({ num: z.number() })
  },
  {
    name: 'boolean',
    prompt: 'Return a JSON object with a single boolean field: { "ok": true }',
    schema: z.object({ ok: z.boolean() })
  },
  {
    name: 'array',
    prompt: 'Return a JSON object with an array of numbers: { "arr": [1,2,3] }',
    schema: z.object({ arr: z.array(z.number()) })
  },
  {
    name: 'nested',
    prompt: 'Return a JSON object with a nested object: { "foo": { "bar": 42 } }',
    schema: z.object({ foo: z.object({ bar: z.number() }) })
  },
  {
    name: 'mixed',
    prompt: 'Return a JSON object with string, number, and boolean: { "a": "x", "b": 2, "c": false }',
    schema: z.object({ a: z.string(), b: z.number(), c: z.boolean() })
  }
];

async function runAll() {
  for (const { name, prompt, schema } of cases) {
    console.log(`\n=== Anthropic Test: ${name} ===`);
    try {
      const result = await callLLM(prompt, 'claude3haiku', { schema, temperature: 0 });
      console.log('Result:', JSON.stringify(result, null, 2));
      const valid = schema.safeParse(result).success;
      console.log(valid ? '✅ Pass' : '❌ Fail: Invalid schema');
    } catch (e) {
      console.error('❌ Error:', e);
    }
  }
}

runAll();
