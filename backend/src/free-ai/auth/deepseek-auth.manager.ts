import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const REDIS_TOKEN_KEY = 'free-ai:deepseek:token';
const REDIS_COOKIES_KEY = 'free-ai:deepseek:cookies';
const TOKEN_TTL_SECONDS = 3600 * 4; // 4 hours

export interface DeepSeekSession {
  token: string;
  cookies: Record<string, string>;
}

/**
 * DeepSeekAuthManager
 *
 * Manages authentication for chat.deepseek.com.
 * Requires both Bearer JWT AND ds_session_id cookie.
 */
@Injectable()
export class DeepSeekAuthManager implements OnModuleDestroy {
  private readonly logger = new Logger(DeepSeekAuthManager.name);
  private browserContext: any = null;

  constructor(private readonly redis: RedisService) {}

  async getSession(): Promise<DeepSeekSession> {
    const cachedToken = await this.redis.get(REDIS_TOKEN_KEY);
    const cachedCookies = await this.redis.get(REDIS_COOKIES_KEY);

    if (cachedToken && cachedCookies) {
      this.logger.debug('DeepSeek session found in Redis cache.');
      const cookies = typeof cachedCookies === 'string'
        ? JSON.parse(cachedCookies)
        : cachedCookies;
      return { token: cachedToken as string, cookies };
    }

    this.logger.log('DeepSeek session cache miss — launching Playwright...');
    const session = await this.captureSessionViaBrowser();
    await this.redis.set(REDIS_TOKEN_KEY, session.token, TOKEN_TTL_SECONDS * 1000);
    await this.redis.set(REDIS_COOKIES_KEY, JSON.stringify(session.cookies), TOKEN_TTL_SECONDS * 1000);
    this.logger.log('DeepSeek session captured and cached in Redis.');
    return session;
  }

  async refreshSession(): Promise<DeepSeekSession> {
    await Promise.all([this.redis.del(REDIS_TOKEN_KEY), this.redis.del(REDIS_COOKIES_KEY)]);
    return this.getSession();
  }

  private async captureSessionViaBrowser(): Promise<DeepSeekSession> {
    const { chromium } = await import('playwright');
    const userDataDir = process.env.FREE_AI_DEEPSEEK_PROFILE_DIR || './.free-ai/deepseek-profile';
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

    this.logger.log(`Launching DeepSeek Playwright browser (headless=${headless}, path=${launchOptions.executablePath || 'default'})`);
    this.browserContext = await chromium.launchPersistentContext(userDataDir, launchOptions);

    const page = await this.browserContext.newPage();

    return new Promise<DeepSeekSession>((resolve, reject) => {
      let resolved = false;
      let capturedToken: string | null = null;

      const tryResolve = async () => {
        if (resolved || !capturedToken) return;
        const rawCookies = await this.browserContext.cookies();
        const cookieMap: Record<string, string> = {};
        for (const c of rawCookies) cookieMap[c.name] = c.value;
        if (cookieMap['ds_session_id']) {
          resolved = true;
          page.close().catch(() => {});
          resolve({ token: capturedToken, cookies: cookieMap });
        }
      };

      this.browserContext.on('response', async (res: any) => {
        try {
          if (!res.url().includes('deepseek.com/api')) return;
          const auth = res.request().headers()['authorization'];
          if (auth && auth.startsWith('Bearer ') && auth.length > 30) {
            capturedToken = auth.substring(7);
            await tryResolve();
          }
        } catch (_) {}
      });

      setTimeout(() => {
        if (!resolved) { resolved = true; reject(new Error(`DeepSeek auth timeout after ${timeout}ms.`)); }
      }, timeout);

      page.goto('https://chat.deepseek.com').catch((err: Error) => reject(err));
    });
  }

  async onModuleDestroy() {
    if (this.browserContext) await this.browserContext.close().catch(() => {});
  }
}
