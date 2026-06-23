const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
  const dsDir = path.resolve(__dirname, '../.free-ai/deepseek-profile');
  console.log(`Loading DeepSeek profile from: ${dsDir}`);

  // Clean Singleton locks to avoid startup conflicts
  try { fs.rmSync(path.join(dsDir, 'SingletonLock'), { force: true }); } catch (e) {}
  try { fs.rmSync(path.join(dsDir, 'SingletonSocket'), { force: true }); } catch (e) {}
  try { fs.rmSync(path.join(dsDir, 'SingletonCookie'), { force: true }); } catch (e) {}

  const dsContext = await chromium.launchPersistentContext(dsDir, {
    headless: false, // run headfully to bypass cloudflare
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const page = await dsContext.newPage();

  let capturedToken = null;

  dsContext.on('request', (req) => {
    if (req.url().includes('/api/')) {
      console.log(`[REQ Intercept] URL: ${req.url()}`);
      console.log(`  Headers: ${JSON.stringify(req.headers(), null, 2)}`);
      const auth = req.headers()['authorization'];
      if (auth) {
        console.log(`  Authorization header present: ${auth}`);
        if (auth.startsWith('Bearer ')) {
          capturedToken = auth.substring(7);
        }
      }
    }
  });

  console.log('Navigating to chat.deepseek.com...');
  await page.goto('https://chat.deepseek.com', { waitUntil: 'networkidle', timeout: 30000 }).catch(e => console.log('Navigation warning:', e.message));

  console.log('Fetching cookies...');
  const rawCookies = await dsContext.cookies();
  const cookies = {};
  for (const c of rawCookies) cookies[c.name] = c.value;

  console.log('\n--- DIAGNOSTICS RESULTS ---');
  console.log(`Captured JWT Token: ${capturedToken ? '✅' : '❌'} (${capturedToken ? capturedToken.substring(0, 20) + '...' : 'None'})`);
  console.log(`ds_session_id Cookie: ${cookies['ds_session_id'] ? '✅' : '❌'} (${cookies['ds_session_id'] || 'None'})`);
  console.log(`All cookies keys: ${Object.keys(cookies).join(', ')}`);

  await dsContext.close();
}

run().catch(console.error);
