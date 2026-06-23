const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testLaunch() {
  const dir = path.resolve(__dirname, '../.free-ai/deepseek-profile-test');
  fs.mkdirSync(dir, { recursive: true });

  console.log('1. Attempting to launch with channel: "chrome" (Google Chrome)...');
  try {
    const context = await chromium.launchPersistentContext(dir, {
      headless: false,
      channel: 'chrome',
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    console.log('✓ Successfully launched Google Chrome! Opening page...');
    const page = await context.newPage();
    await page.goto('https://chat.deepseek.com');
    console.log('✓ Page loaded! Closing context...');
    await context.close();
    return;
  } catch (err) {
    console.error('❌ Failed to launch with channel: "chrome":', err.message);
  }

  console.log('\n2. Attempting to launch standard Playwright Chromium (default)...');
  try {
    const context = await chromium.launchPersistentContext(dir, {
      headless: false,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    console.log('✓ Successfully launched standard Chromium! Opening page...');
    const page = await context.newPage();
    await page.goto('https://chat.deepseek.com');
    console.log('✓ Page loaded! Closing context...');
    await context.close();
  } catch (err) {
    console.error('❌ Failed to launch standard Chromium:', err.message);
  }
}

testLaunch().catch(console.error);
