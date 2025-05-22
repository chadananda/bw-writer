#!/usr/bin/env node
import { analyzeRequestImpl } from '../src/app/tools/analyzeRequest.tool.js';
import util from 'util';
import { debugLog } from '../src/framework/log.js';

// Sample prompt with structured data
const structuredPrompt = `---
title: Climate Crisis Data Analysis
author:
  name: Dr. Richard Feynman
  bio: Theoretical Physicist
keywords: climate data, analysis, historical trends
targetLen: 2500
custom_field1: special value 1
custom_field2: special value 2
source: Peer-reviewed journals
---

Please write an article analyzing climate data with the following criteria:

| Aspect | Requirement |
|--------|-------------|
| Data Sources | Include data from NASA and NOAA |
| Time Period | Cover 1950-2023 |
| Focus Areas | Arctic ice melt, Sea level rise, Temperature anomalies |
| Visualization | Include 3 charts and 2 tables |

Make sure to address how the data contradicts common misconceptions about climate change.`;

// Simple prompt without structured data
const simplePrompt = `
Hey, I've been thinking about getting an article written about climate change. You know, something that really digs into what's been happening lately with all exaggeration in the press and all the grifting by lobbyists and politicians and non-profits.

I'm thinking this should be substantial - maybe around 2000 words or so? Not too technical though - I want regular people to understand it, but still have some academic credibility.

Oh, and I'd like it to be authored by Dr. Sarah Chen. She's an environmental scientist and economist with a knack for making complex topics approachable.

Basically, I want something that'll make people think, but not something so depressing that they lose hope.
`;

async function runFullTest() {
  console.log('\n========== ANALYZING STRUCTURED PROMPT ==========\n');
  console.log('INPUT:');
  console.log(structuredPrompt);
  
  // Run with debug disabled to suppress logs from extraction functions
  const structuredResult = await analyzeRequestImpl({ userPrompt: structuredPrompt }, { debug: false });
  
  console.log('\nRESULT:');
  console.log(util.inspect(structuredResult, { depth: null, colors: true }));

  // Display specific sections in detail
  console.log('\nExtraMeta object:');
  console.log(util.inspect(structuredResult.extraMeta, { depth: null, colors: true }));

  console.log('\nAuthor object:');
  console.log(util.inspect(structuredResult.author, { depth: null, colors: true }));

  console.log('\n\n========== ANALYZING SIMPLE PROMPT ==========\n');
  console.log('INPUT:');
  console.log(simplePrompt);
  
  // Run with debug disabled to suppress logs from extraction functions
  const simpleResult = await analyzeRequestImpl({ userPrompt: simplePrompt }, { debug: false });
  
  console.log('\nRESULT:');
  console.log(util.inspect(simpleResult, { depth: null, colors: true }));

  // Display specific sections in detail
  console.log('\nExtraMeta object:');
  console.log(util.inspect(simpleResult.extraMeta, { depth: null, colors: true }));

  console.log('\nAuthor object:');
  console.log(util.inspect(simpleResult.author, { depth: null, colors: true }));
}

runFullTest().catch(err => {
  console.error('Error running full test:', err);
  process.exit(1);
});
