/**
 * host-login.js
 * Интерактивная авторизация в Qwen и DeepSeek через Playwright на хост-системе.
 * Сохраняет сессионные токены в Redis (порт 6450 = контейнерный Redis).
 * Синхронизирует профили браузера в Docker контейнер.
 *
 * Запуск: node src/host-login.js
 */
const { chromium } = require('playwright');
const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ключи Redis — должны совпадать с QwenAuthManager и DeepSeekAuthManager
const REDIS_QWEN_TOKEN = 'free-ai:qwen:token';
const REDIS_DS_TOKEN = 'free-ai:deepseek:token';
const REDIS_DS_COOKIES = 'free-ai:deepseek:cookies';
const TTL_QWEN = 3600 * 6;   // 6 часов
const TTL_DS   = 3600 * 4;   // 4 часа

async function cleanLocks(dir) {
  try { fs.rmSync(path.join(dir, 'SingletonLock'), { force: true }); } catch (e) {}
  try { fs.rmSync(path.join(dir, 'SingletonSocket'), { force: true }); } catch (e) {}
  try { fs.rmSync(path.join(dir, 'SingletonCookie'), { force: true }); } catch (e) {}
}

async function run() {
  console.log('🔌 Connecting to Redis on host port 6450...');
  // Порт 6450 маппится на 6379 внутри контейнера — это один и тот же Redis!
  const redis = createClient({ url: 'redis://localhost:6450' });
  redis.on('error', (err) => console.error('Redis Client Error:', err));
  await redis.connect();
  console.log('✅ Connected to Redis!');

  const qwenDir = path.resolve(__dirname, '../.free-ai/qwen-profile');
  const dsDir   = path.resolve(__dirname, '../.free-ai/deepseek-profile');

  fs.mkdirSync(qwenDir, { recursive: true });
  fs.mkdirSync(dsDir, { recursive: true });

  await cleanLocks(qwenDir);
  await cleanLocks(dsDir);

  // ─────────────────────────────────────────
  // 1. QWEN AUTHENTICATION
  // ─────────────────────────────────────────
  console.log('\n--- 1. AUTHENTICATING QWEN ---');
  console.log('🚀 Launching Chromium for Qwen...');

  const qwenContext = await chromium.launchPersistentContext(qwenDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const qwenPage = await qwenContext.newPage();
  await qwenPage.goto('https://chat.qwen.ai', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

  const qwenToken = await new Promise((resolve) => {
    let resolved = false;

    // Strategy 1: Intercept outgoing Authorization header
    qwenContext.on('request', (req) => {
      if (resolved) return;
      try {
        const auth = req.headers()['authorization'];
        if (auth && auth.startsWith('Bearer ') && req.url().includes('qwen.ai')) {
          resolved = true;
          resolve(auth.substring(7));
        }
      } catch (e) {}
    });

    // Strategy 2: Poll localStorage
    const checkInterval = setInterval(async () => {
      if (resolved) { clearInterval(checkInterval); return; }
      try {
        const token = await qwenPage.evaluate(() =>
          localStorage.getItem('token') ||
          localStorage.getItem('__token') ||
          localStorage.getItem('qwen_token')
        );
        if (token && token.startsWith('eyJ')) {
          clearInterval(checkInterval);
          resolved = true;
          resolve(token);
        }
      } catch (e) {}
    }, 1500);
  });

  console.log(`✅ Captured Qwen Token! (${qwenToken.length} chars)`);

  // ВАЖНО: cache-manager-redis-yet ожидает JSON-сериализованные значения!
  // Строки должны быть записаны как JSON строки: '"eyJ..."' а не 'eyJ...'
  await redis.set(REDIS_QWEN_TOKEN, JSON.stringify(qwenToken), { EX: TTL_QWEN });
  console.log(`💾 Qwen Token saved to Redis key "${REDIS_QWEN_TOKEN}" (TTL: ${TTL_QWEN}s)`);
  await qwenContext.close();
  await cleanLocks(qwenDir);

  // ─────────────────────────────────────────
  // 2. DEEPSEEK AUTHENTICATION
  // ─────────────────────────────────────────
  console.log('\n--- 2. AUTHENTICATING DEEPSEEK ---');
  console.log('🚀 Launching Chromium for DeepSeek (up to 3 minutes)...');

  await cleanLocks(dsDir);
  const dsContext = await chromium.launchPersistentContext(dsDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const dsPage = await dsContext.newPage();
  await dsPage.goto('https://chat.deepseek.com', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  }).catch((e) => {
    console.warn('⚠️ DeepSeek navigation warning (non-fatal):', e.message.split('\n')[0]);
  });

  console.log('⏳ Waiting for DeepSeek session (token + cookies)...');

  const dsSession = await new Promise((resolve, reject) => {
    let capturedToken = null;
    const TIMEOUT_MS = 180000;

    const handler = (req) => {
      try {
        const auth = req.headers()['authorization'];
        if (auth && auth.startsWith('Bearer ') && auth.length > 30 && req.url().includes('deepseek.com')) {
          capturedToken = auth.substring(7);
        }
      } catch (e) {}
    };

    dsContext.on('request', handler);

    const checkInterval = setInterval(async () => {
      try {
        const rawCookies = await dsContext.cookies();
        const cookies = {};
        for (const c of rawCookies) cookies[c.name] = c.value;

        if (capturedToken && cookies['ds_session_id']) {
          process.stdout.write('\n');
          clearInterval(checkInterval);
          clearTimeout(timeoutHandle);
          resolve({ token: capturedToken, cookies });
        } else {
          const url = dsPage.url();
          const title = await dsPage.title().catch(() => '');
          console.log(`\n⏳ Waiting... Page: ${url} | Title: "${title}" | Token: ${capturedToken ? '✅' : '❌'} | ds_session_id: ${cookies['ds_session_id'] ? '✅' : '❌'}`);
        }
      } catch (e) {}
    }, 2000);

    const timeoutHandle = setTimeout(async () => {
      clearInterval(checkInterval);
      if (capturedToken) {
        const rawCookies = await dsContext.cookies().catch(() => []);
        const cookies = {};
        for (const c of rawCookies) cookies[c.name] = c.value;
        console.warn('\n⚠️  Timeout: proceeding with partial session (no ds_session_id)...');
        resolve({ token: capturedToken, cookies });
      } else {
        reject(new Error('DeepSeek auth timeout after 3 minutes. Please log in.'));
      }
    }, TIMEOUT_MS);
  });

  console.log(`✅ Captured DeepSeek Token! (${dsSession.token.length} chars)`);

  // ВАЖНО: cache-manager-redis-yet ожидает JSON-сериализованные значения!
  // token — JSON строка: '"VQbq..."'
  // cookies — JSON объект: '{"aws-waf-token":"..."}'
  await redis.set(REDIS_DS_TOKEN, JSON.stringify(dsSession.token), { EX: TTL_DS });
  await redis.set(REDIS_DS_COOKIES, JSON.stringify(dsSession.cookies), { EX: TTL_DS });
  console.log('💾 DeepSeek session saved to Redis.');
  await dsContext.close();
  await cleanLocks(dsDir);

  // ─────────────────────────────────────────
  // 3. VERIFY TOKENS IN REDIS
  // ─────────────────────────────────────────
  console.log('\n--- 3. VERIFYING REDIS TOKENS ---');
  const verifyQwen = await redis.get(REDIS_QWEN_TOKEN);
  const verifyDs   = await redis.get(REDIS_DS_TOKEN);
  const verifyDsCookies = await redis.get(REDIS_DS_COOKIES);
  console.log(`  Qwen token: ${verifyQwen ? `✅ ${verifyQwen.substring(0, 20)}... (${verifyQwen.length} chars)` : '❌ MISSING'}`);
  console.log(`  DS token:   ${verifyDs   ? `✅ ${verifyDs.substring(0, 20)}... (${verifyDs.length} chars)` : '❌ MISSING'}`);
  console.log(`  DS cookies: ${verifyDsCookies ? `✅ (${verifyDsCookies.length} chars)` : '❌ MISSING'}`);

  // ─────────────────────────────────────────
  // 4. COPY BROWSER PROFILES TO DOCKER
  // ─────────────────────────────────────────
  console.log('\n--- 4. COPYING PROFILES TO DOCKER CONTAINER ---');
  try {
    const qwenSrc = path.resolve(__dirname, '../.free-ai/qwen-profile');
    const dsSrc   = path.resolve(__dirname, '../.free-ai/deepseek-profile');

    // Удаляем Singleton блокировки перед копированием
    const cleanLocks = (dir) => {
      try { fs.rmSync(path.join(dir, 'SingletonLock'), { force: true }); } catch(e){}
      try { fs.rmSync(path.join(dir, 'SingletonSocket'), { force: true }); } catch(e){}
      try { fs.rmSync(path.join(dir, 'SingletonCookie'), { force: true }); } catch(e){}
    };
    cleanLocks(qwenSrc);
    cleanLocks(dsSrc);

    execSync('docker exec signal-bot-backend-1 mkdir -p /app/.free-ai');
    
    // Удаляем старые локи в контейнере тоже
    try { execSync('docker exec signal-bot-backend-1 rm -f /app/.free-ai/qwen-profile/SingletonLock /app/.free-ai/qwen-profile/SingletonSocket /app/.free-ai/qwen-profile/SingletonCookie', { stdio: 'ignore' }); } catch(e){}
    try { execSync('docker exec signal-bot-backend-1 rm -f /app/.free-ai/deepseek-profile/SingletonLock /app/.free-ai/deepseek-profile/SingletonSocket /app/.free-ai/deepseek-profile/SingletonCookie', { stdio: 'ignore' }); } catch(e){}

    execSync(`docker cp "${qwenSrc}" signal-bot-backend-1:/app/.free-ai/`);
    execSync(`docker cp "${dsSrc}" signal-bot-backend-1:/app/.free-ai/`);
    console.log('🎉 Browser profiles synced to container!');
  } catch (err) {
    console.error('⚠️ Could not sync profiles to docker:', err.message);
  }

  await redis.disconnect();
  console.log('\n🌟 Auth completed successfully!');
  console.log('📝 Note: Redis port 6450 (host) = Redis port 6379 (container) — same instance!');
}

run().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
