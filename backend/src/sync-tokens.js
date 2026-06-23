/**
 * sync-tokens.js
 * Читает токены из хостового Redis (порт 6450) и копирует их
 * в контейнерный Redis через прямое TCP-соединение (порт 6450 = тот же Redis).
 * 
 * ПРОБЛЕМА: docker exec redis-cli не справляется с JWT-токенами из-за
 * специальных символов (точки, дефисы, Base64). Этот скрипт использует
 * redis npm-клиент для надёжного чтения и записи.
 *
 * Запуск: node src/sync-tokens.js
 */
const { createClient } = require('redis');

async function syncTokens() {
  // Оба Redis — один и тот же контейнер, маппинг: хост:6450 -> контейнер:6379
  const redis = createClient({ url: 'redis://localhost:6450' });
  await redis.connect();
  console.log('✅ Connected to Redis (localhost:6450 → container:6379)');

  const qwenToken = await redis.get('free-ai:qwen:token');
  const dsToken = await redis.get('free-ai:deepseek:token');
  const dsCookies = await redis.get('free-ai:deepseek:cookies');

  console.log(`Qwen token: ${qwenToken ? `${qwenToken.substring(0, 20)}... (${qwenToken.length} chars)` : 'MISSING'}`);
  console.log(`DS token: ${dsToken ? `${dsToken.substring(0, 20)}... (${dsToken.length} chars)` : 'MISSING'}`);
  console.log(`DS cookies: ${dsCookies ? `${dsCookies.substring(0, 50)}... (${dsCookies.length} chars)` : 'MISSING'}`);

  if (!qwenToken && !dsToken) {
    console.error('❌ No tokens found in Redis. Please run node src/host-login.js first.');
    await redis.disconnect();
    process.exit(1);
  }

  // Re-write with fresh TTL to ensure they are present
  if (qwenToken) {
    await redis.set('free-ai:qwen:token', qwenToken, { EX: 3600 * 6 });
    console.log('✅ Qwen token refreshed TTL (6h)');
  }
  if (dsToken) {
    await redis.set('free-ai:deepseek:token', dsToken, { EX: 3600 * 4 });
    console.log('✅ DeepSeek token refreshed TTL (4h)');
  }
  if (dsCookies) {
    await redis.set('free-ai:deepseek:cookies', dsCookies, { EX: 3600 * 4 });
    console.log('✅ DeepSeek cookies refreshed TTL (4h)');
  }

  // Verify
  const allKeys = await redis.keys('free-ai:*');
  console.log(`\n📋 Keys in Redis: ${allKeys.join(', ')}`);

  await redis.disconnect();
  console.log('\n🌟 Sync completed!');
}

syncTokens().catch(console.error);
