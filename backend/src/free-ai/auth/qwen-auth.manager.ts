import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const REDIS_KEY = 'free-ai:qwen:token';
const TOKEN_TTL_SECONDS = 3600 * 6; // 6 hours

/**
 * QwenAuthManager
 *
 * Manages session tokens for chat.qwen.ai using Playwright's persistent context.
 * Tokens are cached via RedisService with a 6-hour TTL.
 *
 * IMPORTANT: First run is interactive (headless: false) for Google/GitHub OAuth.
 * Subsequent runs use the saved browser profile and are fully headless.
 */
@Injectable()
export class QwenAuthManager implements OnModuleDestroy {
  private readonly logger = new Logger(QwenAuthManager.name);
  private browserContext: any = null;

  constructor(private readonly redis: RedisService) {}

  async getToken(): Promise<string> {
    const cached = await this.redis.get(REDIS_KEY);
    if (cached) {
      this.logger.debug('Qwen token found in Redis cache.');
      return cached as string;
    }
    this.logger.log('Qwen token cache miss — launching Playwright to capture token...');
    const token = await this.captureTokenViaBrowser();
    await this.redis.set(REDIS_KEY, token, TOKEN_TTL_SECONDS * 1000);
    this.logger.log('Qwen token captured and cached in Redis.');
    return token;
  }

  async refreshToken(): Promise<string> {
    await this.redis.del(REDIS_KEY);
    return this.getToken();
  }

  private async captureTokenViaBrowser(): Promise<string> {
    const { chromium } = await import('playwright');
    const userDataDir = process.env.FREE_AI_QWEN_PROFILE_DIR || './.free-ai/qwen-profile';
    const timeout = parseInt(process.env.FREE_AI_PLAYWRIGHT_TIMEOUT || '120000');

    const chromePath = process.env.FREE_AI_CHROME_PATH || 'auto';
    const headless = process.env.FREE_AI_PLAYWRIGHT_HEADLESS !== 'false';

    const launchOptions: any = {
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
    };

    if (chromePath && chromePath !== 'auto') {
      launchOptions.executablePath = chromePath;
    } else if (process.platform === 'linux') {
      const fs = require('fs');
      if (fs.existsSync('/usr/bin/chromium-browser')) {
        launchOptions.executablePath = '/usr/bin/chromium-browser';
      }
    } else {
      launchOptions.channel = 'chrome';
    }

    this.logger.log(`Launching Qwen Playwright browser (headless=${headless}, path=${launchOptions.executablePath || 'default'})`);
    this.browserContext = await chromium.launchPersistentContext(userDataDir, launchOptions);

    const page = await this.browserContext.newPage();

    return new Promise<string>((resolve, reject) => {
      let resolved = false;

      const settle = (token: string) => {
        if (!resolved) {
          resolved = true;
          page.close().catch(() => {});
          resolve(token);
        }
      };

      // Strategy 1: Intercept Authorization header on outbound requests
      page.on('request', (req: any) => {
        const auth = req.headers()['authorization'];
        if (auth && auth.startsWith('Bearer ')) settle(auth.substring(7));
      });

      // Strategy 2: Poll localStorage every second
      const interval = setInterval(async () => {
        try {
          const token = await page.evaluate(() =>
            localStorage.getItem('token') ||
            localStorage.getItem('__token') ||
            localStorage.getItem('qwen_token')
          );
          if (token && (token as string).startsWith('eyJ')) {
            clearInterval(interval);
            settle(token as string);
          }
        } catch (_) {}
      }, 1000);

      setTimeout(() => {
        clearInterval(interval);
        if (!resolved) { resolved = true; reject(new Error(`Qwen auth timeout after ${timeout}ms.`)); }
      }, timeout);

      page.goto('https://chat.qwen.ai/auth?action=signin').catch((err: Error) => {
        clearInterval(interval);
        reject(err);
      });
    });
  }

  async onModuleDestroy() {
    if (this.browserContext) await this.browserContext.close().catch(() => {});
  }
}
