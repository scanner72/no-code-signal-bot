const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

const chatSessionFile = path.resolve(__dirname, '../../../freeai-chat/session.json');
const mcpSessionFile = path.resolve(__dirname, '../../../freeai-mcp/session.json');

async function run() {
  console.log('🔌 Connecting to Redis to migrate tokens...');
  const client = createClient({ url: 'redis://127.0.0.1:6450' });
  client.on('error', (err) => console.error('Redis error:', err));
  await client.connect();
  console.log('✅ Connected to Redis!');

  const qwenTokenRaw = await client.get('free-ai:qwen:token');
  const dsTokenRaw = await client.get('free-ai:deepseek:token');
  const dsCookiesRaw = await client.get('free-ai:deepseek:cookies');

  if (!qwenTokenRaw && !dsTokenRaw) {
    console.log('⚠️ No active tokens found in Redis. Migration skipped.');
    await client.disconnect();
    return;
  }

  const sessionData = {};

  if (qwenTokenRaw) {
    let token = qwenTokenRaw;
    try { token = JSON.parse(qwenTokenRaw); } catch(e){}
    sessionData.qwen = {
      token,
      updatedAt: Date.now()
    };
    console.log(`- Found Qwen Token (${token.length} chars)`);
  }

  if (dsTokenRaw && dsCookiesRaw) {
    let token = dsTokenRaw;
    try { token = JSON.parse(dsTokenRaw); } catch(e){}
    let cookies = {};
    try { cookies = JSON.parse(dsCookiesRaw); } catch(e){}

    sessionData.deepseek = {
      token,
      cookies,
      updatedAt: Date.now()
    };
    console.log(`- Found DeepSeek Token & Cookies (${Object.keys(cookies).length} cookies)`);
  }

  const jsonStr = JSON.stringify(sessionData, null, 2);
  
  // Write to both folders
  fs.writeFileSync(chatSessionFile, jsonStr);
  console.log(`🎉 Migrated session to ${chatSessionFile}`);

  fs.writeFileSync(mcpSessionFile, jsonStr);
  console.log(`🎉 Migrated session to ${mcpSessionFile}`);

  await client.disconnect();
}

run().catch(console.error);
