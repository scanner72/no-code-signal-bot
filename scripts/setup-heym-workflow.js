#!/usr/bin/env node
/**
 * setup-heym-workflow.js
 *
 * One-time setup script: creates the "Signal Validator" workflow in heym
 * and outputs the workflow ID to add to .env (HEYM_SIGNAL_VALIDATOR_ID).
 *
 * Usage:
 *   node scripts/setup-heym-workflow.js
 *
 * Prerequisites:
 *   - heym running at http://localhost:4017
 *   - HEYM_API_KEY set in environment or .env file
 *     (generate it at: http://localhost:4017 → MCP tab → Generate)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env if exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const [k, ...v] = line.split('=');
    if (k && v.length && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join('=').trim();
    }
  }
}

const HEYM_BASE = process.env.HEYM_API_URL || 'http://localhost:4017/api';
const HEYM_KEY  = process.env.HEYM_API_KEY  || '';

if (!HEYM_KEY) {
  console.error('❌ HEYM_API_KEY is not set.');
  console.error('   1. Open http://localhost:4017 → MCP tab → click "Generate"');
  console.error('   2. Add HEYM_API_KEY=<key> to your .env file');
  process.exit(1);
}

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : undefined;

    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Key': HEYM_KEY,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, data: chunks }); }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const SIGNAL_VALIDATOR_WORKFLOW = {
  name: 'Signal Validator',
  description: 'Validates Cyber-Quant trading signals using AI analysis. Called automatically before trade execution.',
  nodes: [
    {
      id: 'start-1',
      type: 'startNode',
      position: { x: 100, y: 200 },
      data: { name: 'Input', description: 'Signal validation request' },
    },
    {
      id: 'llm-1',
      type: 'llmNode',
      position: { x: 400, y: 200 },
      data: {
        name: 'Signal AI Validator',
        systemPrompt:
          'You are a professional crypto trading signal validator. ' +
          'Analyze the given trading signal context and determine if it should be executed. ' +
          'Consider: market trend alignment, RSI overbought/oversold conditions, volume confirmation, ' +
          'and overall market conditions. ' +
          'ALWAYS respond with valid JSON only, no other text: ' +
          '{"decision": "PASS" or "BLOCK", "confidence": 0.0-1.0, "reason": "concise explanation max 100 chars"}',
        prompt: '{{input}}',
        temperature: 0.2,
      },
    },
    {
      id: 'end-1',
      type: 'endNode',
      position: { x: 700, y: 200 },
      data: { name: 'Output' },
    },
  ],
  edges: [
    { id: 'e1', source: 'start-1', target: 'llm-1' },
    { id: 'e2', source: 'llm-1', target: 'end-1' },
  ],
};

async function main() {
  console.log(`\n🔗 Connecting to heym at ${HEYM_BASE}...\n`);

  // 1. Check connectivity
  try {
    const health = await request('GET', `${HEYM_BASE}/workflows`);
    if (health.status >= 400) {
      throw new Error(`HTTP ${health.status}`);
    }
    console.log('✅ heym is reachable');
  } catch (err) {
    console.error(`❌ Cannot reach heym: ${err.message}`);
    console.error(`   Make sure heym is running at http://localhost:4017`);
    process.exit(1);
  }

  // 2. Create workflow
  console.log('\n📋 Creating "Signal Validator" workflow...');
  try {
    const create = await request('POST', `${HEYM_BASE}/workflows`, SIGNAL_VALIDATOR_WORKFLOW);

    if (create.status === 201 || create.status === 200) {
      const workflowId = create.data?.id || create.data?.workflowId;
      console.log(`✅ Workflow created! ID: ${workflowId}`);

      // 3. Enable in MCP
      console.log('\n🔌 Enabling workflow in MCP...');
      try {
        const enable = await request('POST', `${HEYM_BASE}/mcp/workflows/${workflowId}/enable`, {});
        if (enable.status < 400) {
          console.log('✅ Workflow enabled in MCP');
        } else {
          console.warn('⚠️  Could not auto-enable in MCP — please enable manually in heym UI → MCP tab');
        }
      } catch {
        console.warn('⚠️  Could not auto-enable in MCP — please enable manually in heym UI → MCP tab');
      }

      console.log('\n' + '═'.repeat(60));
      console.log('🎉 Setup complete! Add this to your .env:');
      console.log('═'.repeat(60));
      console.log(`HEYM_SIGNAL_VALIDATOR_ID=${workflowId}`);
      console.log('═'.repeat(60));
      console.log('\nNext steps:');
      console.log('  1. Add the line above to your .env file');
      console.log('  2. Restart the backend service');
      console.log('  3. In Strategy Builder → drag "⚡ heym Validator" node onto canvas');
      console.log('  4. Connect it before your signal output node');
      console.log('  5. Watch Traces at http://localhost:4017 → Traces tab\n');

    } else if (create.status === 409) {
      console.log('ℹ️  Workflow "Signal Validator" already exists');
      console.log('   Find its ID in heym UI → Workflows and set HEYM_SIGNAL_VALIDATOR_ID=<id>');
    } else {
      console.warn(`⚠️  Unexpected response: HTTP ${create.status}`);
      console.log('Response:', JSON.stringify(create.data, null, 2));
      console.log('\nPlease create the workflow manually in heym UI:');
      console.log('  Input → LLM (with signal validation prompt) → Output');
    }
  } catch (err) {
    console.error(`❌ Failed to create workflow: ${err.message}`);
    console.log('\nPlease create "Signal Validator" workflow manually in heym UI.');
  }
}

main();
