const fs = require('fs');
const path = require('path');
const { createClient } = require('redis');

async function run() {
  console.log('🔌 Connecting to Redis at redis://localhost:6450...');
  const redis = createClient({ url: 'redis://localhost:6450' });
  redis.on('error', (err) => console.error('Redis Client Error:', err));
  await redis.connect();
  console.log('✅ Connected to Redis!');

  const qwenRaw = await redis.get('free-ai:qwen:token');
  const dsRawToken = await redis.get('free-ai:deepseek:token');
  const dsRawCookies = await redis.get('free-ai:deepseek:cookies');

  if (!qwenRaw || !dsRawToken || !dsRawCookies) {
    console.error('⚠️ Missing some keys in Redis. Cannot perform complete sync.');
    await redis.disconnect();
    return;
  }

  // Parse JSON values from Redis since they were saved using JSON.stringify
  const qwenToken = JSON.parse(qwenRaw);
  const dsToken = JSON.parse(dsRawToken);
  const dsCookies = JSON.parse(dsRawCookies);

  console.log(`Parsed credentials:`);
  console.log(`  Qwen Token: ${qwenToken.substring(0, 15)}... (${qwenToken.length} chars)`);
  console.log(`  DeepSeek Token: ${dsToken.substring(0, 15)}... (${dsToken.length} chars)`);
  console.log(`  DeepSeek Cookies: ${Object.keys(dsCookies).length} cookies`);

  const now = Date.now();
  const sessionData = {
    qwen: {
      token: qwenToken,
      updatedAt: now
    },
    deepseek: {
      token: dsToken,
      cookies: dsCookies,
      updatedAt: now
    }
  };

  const targets = [
    path.resolve(__dirname, '../../../freeai-chat/session.json'),
    path.resolve(__dirname, '../../../freeai-mcp/session.json')
  ];

  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(sessionData, null, 2), 'utf8');
    console.log(`💾 Saved updated credentials to: ${target}`);
  }

  await redis.disconnect();
  console.log('🎉 Token sync completed successfully!');
}

run().catch(console.error);
