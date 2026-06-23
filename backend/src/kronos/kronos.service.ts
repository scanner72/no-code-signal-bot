import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface KronosModelInfo {
  status: string;
  model: string;
  model_id: string;
  params: string;
  context_length: number;
  device: string;
  gpu_name: string | null;
  gpu_vram_mb: number;
  cpu_ram_mb: number;
  hardware: {
    gpu_available: boolean;
    gpu_name: string | null;
    gpu_vram_mb: number;
    gpu_vram_free_mb: number;
    cpu_ram_mb: number;
    mps_available: boolean;
  };
  available_models: Record<string, { params: string; quality: number }>;
}

export interface KronosPrediction {
  predictions: Array<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  direction: 'UP' | 'DOWN';
  predicted_change_pct: number;
  last_close: number;
  predicted_close: number;
  inference_time_ms: number;
  model: string;
  device: string;
}

@Injectable()
export class KronosService implements OnModuleInit {
  private readonly logger = new Logger(KronosService.name);
  private readonly kronosUrl: string;
  private available = false;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    this.kronosUrl = process.env.KRONOS_URL || 'http://kronos:8070';
  }

  async onModuleInit() {
    // Check Kronos availability on startup
    try {
      const res = await fetch(`${this.kronosUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        this.available = data.status === 'ok';
        this.logger.log(
          `Kronos connected: ${data.model} on ${data.device}`,
        );
      }
    } catch {
      this.logger.warn(
        'Kronos AI service not available — AI features disabled',
      );
    }
  }

  /** Check if Kronos microservice is online */
  isAvailable(): boolean {
    return this.available;
  }

  /** Get Kronos health status */
  async getHealth(): Promise<{ status: string; model: string; device: string }> {
    try {
      const res = await fetch(`${this.kronosUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      this.available = data.status === 'ok';
      return data;
    } catch (e) {
      this.available = false;
      return { status: 'offline', model: 'none', device: 'none' };
    }
  }

  /** Get model info & hardware details */
  async getModelInfo(): Promise<KronosModelInfo | null> {
    try {
      const res = await fetch(`${this.kronosUrl}/model-info`, {
        signal: AbortSignal.timeout(5000),
      });
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Get AI price forecast for a trading pair.
   * Uses Redis cache to avoid redundant inference.
   */
  async predict(
    symbol: string,
    timeframe: string,
    candles: Array<{
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      timestamp?: string;
    }>,
    options?: {
      predLen?: number;
      temperature?: number;
      topP?: number;
      sampleCount?: number;
    },
  ): Promise<KronosPrediction> {
    if (!this.available) {
      throw new Error('Kronos AI service is not available');
    }

    // Check cache first
    const cacheKey = `kronos:${symbol}:${timeframe}`;
    const cached = await this.cacheManager.get<KronosPrediction>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    // Call Kronos microservice
    const payload = {
      candles: candles.slice(-512), // Max context
      pred_len: options?.predLen ?? 24,
      temperature: options?.temperature ?? 0.8,
      top_p: options?.topP ?? 0.9,
      sample_count: options?.sampleCount ?? 3,
    };

    this.logger.log(
      `Predicting ${symbol} ${timeframe}: ${payload.candles.length} candles → ${payload.pred_len} ahead`,
    );

    const res = await fetch(`${this.kronosUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30s timeout for inference
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Kronos prediction failed: ${error}`);
    }

    const prediction: KronosPrediction = await res.json();

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, prediction, 300_000);

    this.logger.log(
      `Prediction: ${symbol} → ${prediction.direction} ${prediction.predicted_change_pct.toFixed(2)}% ` +
        `(${prediction.inference_time_ms}ms, model=${prediction.model})`,
    );

    return prediction;
  }

  /** Fetch Stock Screener data from Finviz with local Redis caching */
  async getFinvizScreener(
    signal: string = 'top_gainers',
    filters?: {
      shortFloat?: string;
      sma200?: string;
      instOwn?: string;
    },
  ): Promise<any> {
    const shortFloat = filters?.shortFloat || '';
    const sma200 = filters?.sma200 || '';
    const instOwn = filters?.instOwn || '';
    const cacheKey = `finviz:screener:${signal}:${shortFloat}:${sma200}:${instOwn}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    try {
      let url = `${this.kronosUrl}/finviz/screener?signal=${signal}`;
      if (shortFloat) url += `&short_float=${encodeURIComponent(shortFloat)}`;
      if (sma200) url += `&sma_200=${encodeURIComponent(sma200)}`;
      if (instOwn) url += `&inst_own=${encodeURIComponent(instOwn)}`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      await this.cacheManager.set(cacheKey, data, 600_000); // 10 minutes cache
      return data;
    } catch (e) {
      this.logger.error(`Error querying Finviz screener: ${e}`);
      return { status: 'error', data: [] };
    }
  }

  /** Fetch Insider transactions from Finviz with local Redis caching */
  async getFinvizInsider(option: string = 'latest'): Promise<any> {
    const cacheKey = `finviz:insider:${option}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(`${this.kronosUrl}/finviz/insider?option=${option}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      await this.cacheManager.set(cacheKey, data, 600_000); // 10 minutes cache
      return data;
    } catch (e) {
      this.logger.error(`Error querying Finviz insider: ${e}`);
      return { status: 'error', data: [] };
    }
  }

  /** Fetch News headlines for a specific ticker with local Redis caching */
  async getFinvizNews(ticker: string): Promise<any> {
    const cacheKey = `finviz:news:${ticker.toUpperCase()}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(`${this.kronosUrl}/finviz/news/${ticker.toUpperCase()}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      await this.cacheManager.set(cacheKey, data, 300_000); // 5 minutes cache
      return data;
    } catch (e) {
      this.logger.error(`Error querying Finviz news for ${ticker}: ${e}`);
      return { status: 'error', data: [] };
    }
  }
}
