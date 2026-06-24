import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../redis/redis.service';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface LdrResearchResult {
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number; // -1.0 to 1.0
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  keyFindings: string[];
  sources: string[];
  cached: boolean;
  unavailable?: boolean;
}

/**
 * LdrService — интеграция с Local Deep Research (LDR).
 *
 * Взаимодействие в трёхслойной ИИ-иерархии:
 *   Cronos (числовой анализ) → LDR (сбор фактов о мире) → Hermes (финальное решение)
 *
 * LDR используется Hermes-агентом для получения структурированных
 * фундаментальных отчётов о торгуемом активе перед принятием торгового решения.
 */
@Injectable()
export class LdrService {
  private readonly logger = new Logger(LdrService.name);
  private client: AxiosInstance;
  private baseUrl: string;
  private sessionCookies: string | null = null;
  private csrfToken: string | null = null;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.reloadConfig();
  }

  private async reloadConfig() {
    this.baseUrl =
      (await this.settingsService.get('ldr_url'))?.trim() ||
      process.env.LDR_URL ||
      'http://ldr:5000';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120_000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.logger.log(`LDR config: url=${this.baseUrl}`);
  }

  /**
   * Выполняет аутентификацию на LDR и получает CSRF-токен.
   * Вызывается автоматически при первом запросе.
   */
  private async authenticate(): Promise<void> {
    const username = process.env.LDR_USERNAME || 'admin';
    const password = process.env.LDR_PASSWORD || 'admin';

    try {
      // 1. Получаем страницу логина для CSRF
      const loginPage = await this.client.get('/auth/login');
      const csrfMatch = loginPage.data.match(
        /name="csrf_token"\s+value="([^"]+)"/,
      );
      if (!csrfMatch) throw new Error('CSRF token not found on login page');
      const loginCsrf = csrfMatch[1];
      const cookies = loginPage.headers['set-cookie']?.join('; ') || '';

      // 2. Логинимся
      const loginResp = await this.client.post(
        '/auth/login',
        new URLSearchParams({ username, password, csrf_token: loginCsrf }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: cookies,
          },
          maxRedirects: 0,
          validateStatus: (s) => s < 400,
        },
      );

      this.sessionCookies =
        loginResp.headers['set-cookie']?.join('; ') || cookies;

      // 3. Получаем API CSRF-токен
      const csrfResp = await this.client.get('/auth/csrf-token', {
        headers: { Cookie: this.sessionCookies },
      });
      this.csrfToken = csrfResp.data?.csrf_token;

      this.logger.log('LDR authentication successful');
    } catch (err) {
      this.logger.error(`LDR auth failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Основной метод исследования.
   * Принимает запрос и возвращает структурированный LdrResearchResult.
   *
   * @param query    — Текст вопроса/запроса для глубокого исследования
   * @param pair     — Торговая пара (для логирования и кэширования)
   * @param mode     — 'quick' (30с) или 'detailed' (2-3 мин)
   * @param ttlMin   — Время жизни кэша в минутах (0 = без кэша)
   */
  private getSemanticHash(query: string): string {
    const stopWords = [
      'what', 'with', 'from', 'have', 'this', 'that', 'your', 'about', 'recent', 
      'analyze', 'should', 'execute', 'signal', 'news', 'market', 'sentiment', 
      'cryptocurrency', 'there', 'hacks', 'exploits', 'legal', 'issues', 'negative', 
      'catalysts', 'and', 'for', 'any', 'the', 'are', 'not', 'you', 'can', 'our', 
      'out', 'all', 'how', 'has', 'had', 'was', 'were', 'but', 'nor', 'yet'
    ];
    const clean = query.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .map(w => w.endsWith('s') && !w.endsWith('us') && w.length > 3 ? w.slice(0, -1) : w)
      .filter(w => w.length > 2 && !stopWords.includes(w))
      .sort();
    return this.hash(clean.join('_'));
  }

  async research(
    query: string,
    pair = 'BTCUSDT',
    mode: 'quick' | 'detailed' = 'quick',
    ttlMin = 15,
  ): Promise<LdrResearchResult> {
    const semanticHash = this.getSemanticHash(query);
    const cacheKey = `ldr:v2:${pair}:${semanticHash}:${mode}`;

    // 1. Проверка кэша
    if (ttlMin > 0) {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`LDR Semantic Cache hit for "${pair}" (hash: ${semanticHash})`);
        return { ...JSON.parse(cached), cached: true };
      }
    }

    // 2. Выполняем запрос к LDR
    try {
      if (!this.sessionCookies || !this.csrfToken) {
        await this.authenticate();
      }

      const researchMode = mode === 'quick' ? 'quick' : 'detailed';

      const startResp = await this.client.post(
        '/api/start_research',
        { query, mode: researchMode },
        {
          headers: {
            Cookie: this.sessionCookies!,
            'X-CSRF-Token': this.csrfToken!,
          },
        },
      );

      const researchId: number = startResp.data?.research_id;
      if (!researchId) throw new Error('No research_id returned from LDR');

      // 3. Polling результата (до 120 секунд)
      const result = await this.pollResult(researchId, 120);

      const parsed = this.parseResult(result);

      // 4. Кэшируем
      if (ttlMin > 0) {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(parsed),
          ttlMin * 60,
        );
      }

      this.logger.log(
        `LDR research for "${pair}": sentiment=${parsed.sentiment} (${parsed.sentimentScore.toFixed(2)}), risk=${parsed.riskLevel}`,
      );
      return { ...parsed, cached: false };
    } catch (err) {
      this.logger.error(`LDR research failed: ${err.message}`);
      // Fail-open: возвращаем нейтральный ответ чтобы не блокировать торговлю
      return {
        summary: `LDR unavailable: ${err.message}`,
        sentiment: 'neutral',
        sentimentScore: 0,
        riskLevel: 'low',
        keyFindings: [],
        sources: [],
        cached: false,
        unavailable: true,
      };
    }
  }

  /**
   * Проверяет доступность LDR-сервиса.
   */
  async ping(): Promise<boolean> {
    try {
      const resp = await this.client.get('/', { timeout: 5_000 });
      return resp.status < 400;
    } catch {
      return false;
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async pollResult(researchId: number, maxSeconds: number): Promise<any> {
    const deadline = Date.now() + maxSeconds * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const resp = await this.client.get(`/api/research/${researchId}`, {
          headers: { Cookie: this.sessionCookies! },
        });
        const status = resp.data?.status;
        if (status === 'complete' || status === 'completed') {
          return resp.data;
        }
        if (status === 'error' || status === 'failed') {
          throw new Error(`LDR research failed: ${resp.data?.error || 'unknown'}`);
        }
      } catch (err) {
        if (err.message.startsWith('LDR research failed')) throw err;
        // network error — try again
      }
    }
    throw new Error(`LDR research timeout after ${maxSeconds}s`);
  }

  /**
   * Преобразует сырой ответ LDR в структурированный LdrResearchResult.
   * Определяет сентимент и уровень риска на основе ключевых слов в резюме.
   */
  private parseResult(raw: any): LdrResearchResult {
    const summary: string = raw?.summary || raw?.report || raw?.content || '';
    const summaryLower = summary.toLowerCase();

    // Определение сентимента по ключевым словам
    const bullishWords = [
      'bullish', 'positive', 'growth', 'increase', 'rally', 'surge',
      'bullisch', 'рост', 'покупка', 'оптимизм',
    ];
    const bearishWords = [
      'bearish', 'negative', 'decline', 'crash', 'hack', 'exploit',
      'lawsuit', 'ban', 'bearisch', 'падение', 'риск', 'уязвимость',
    ];
    const criticalWords = [
      'hack', 'exploit', 'fraud', 'scam', 'arrested', 'shutdown',
      'взлом', 'мошенничество', 'арест',
    ];

    let bullishScore = 0;
    let bearishScore = 0;
    bullishWords.forEach((w) => { if (summaryLower.includes(w)) bullishScore++; });
    bearishWords.forEach((w) => { if (summaryLower.includes(w)) bearishScore++; });

    const isCritical = criticalWords.some((w) => summaryLower.includes(w));
    const sentimentScore = bullishScore === 0 && bearishScore === 0
      ? 0
      : (bullishScore - bearishScore) / (bullishScore + bearishScore);

    const sentiment: LdrResearchResult['sentiment'] =
      sentimentScore > 0.1 ? 'bullish' : sentimentScore < -0.1 ? 'bearish' : 'neutral';

    const riskLevel: LdrResearchResult['riskLevel'] = isCritical
      ? 'critical'
      : bearishScore > 2
      ? 'high'
      : bearishScore > 0
      ? 'medium'
      : 'low';

    // Извлекаем источники и ключевые находки
    const sources: string[] = (raw?.sources || []).map((s: any) =>
      typeof s === 'string' ? s : s?.url || s?.title || '',
    );

    const keyFindings: string[] = [];
    if (raw?.key_findings) keyFindings.push(...raw.key_findings);
    if (raw?.findings) keyFindings.push(...raw.findings);

    return {
      summary: summary.substring(0, 1000),
      sentiment,
      sentimentScore: Math.round(sentimentScore * 100) / 100,
      riskLevel,
      keyFindings: keyFindings.slice(0, 5),
      sources: sources.slice(0, 10),
      cached: false,
    };
  }

  private hash(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex').substring(0, 8);
  }
}
