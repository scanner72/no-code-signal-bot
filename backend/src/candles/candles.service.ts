import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candle } from './candle.entity';
import { BinanceApiService } from './binance-api.service';

@Injectable()
export class CandlesService {
  private readonly logger = new Logger(CandlesService.name);

  constructor(
    @InjectRepository(Candle)
    private candleRepository: Repository<Candle>,
    private binanceApi: BinanceApiService,
  ) {}

  // Virtual symbols resolved dynamically by exchange_scanner node — no candles to sync
  private readonly VIRTUAL_SYMBOLS = ['BINANCE_TOP20', 'BINANCE_TOP50', 'BYBIT_TOP20', 'BYBIT_TOP50'];

  async syncGaps(pair: string, timeframe: string) {
    if (this.VIRTUAL_SYMBOLS.includes(pair) || pair.includes('_TOP')) {
      this.logger.debug(`Skipping syncGaps for virtual symbol: ${pair}`);
      return;
    }
    this.logger.log(`Checking for gaps: ${pair} ${timeframe}`);
    
    // 1. Find latest candle timestamp
    const latest = await this.candleRepository.findOne({
      where: { pair, timeframe },
      order: { time: 'DESC' },
    });

    const tfMs: Record<string, number> = {
      '1m': 60_000, '5m': 300_000, '15m': 900_000,
      '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
    };
    const stepMs = tfMs[timeframe] ?? 3_600_000;
    const now = Date.now();
    let since = latest ? latest.time.getTime() + 1000 : now - 1000 * stepMs; // 1000 candles depth if new

    // 2. Fetch missing from REST
    const missing = await this.binanceApi.fetchCandles(pair, timeframe, since);
    
    if (missing.length > 0) {
      this.logger.log(`Found ${missing.length} missing candles for ${pair} ${timeframe}. Saving...`);
      for (const cData of missing) {
        await this.saveCandle({
          ...cData,
          pair,
          timeframe,
        });
      }
    } else {
      this.logger.debug(`No gaps found for ${pair} ${timeframe}`);
    }
  }

  async saveCandle(candleData: Partial<Candle>) {
    try {
      const candle = this.candleRepository.create(candleData);
      await this.candleRepository.save(candle);
    } catch (error) {
      this.logger.error(`Error saving candle: ${error.message}`);
    }
  }

  async getLatestCandles(pair: string, timeframe: string, limit: number): Promise<Candle[]>;
  async getLatestCandles(pair: string, timeframe: string, limit: number, compact: true): Promise<number[][]>;
  async getLatestCandles(pair: string, timeframe: string, limit: number, compact: false): Promise<Candle[]>;
  async getLatestCandles(pair: string, timeframe: string, limit: number, compact: boolean): Promise<Candle[] | number[][]>;
  async getLatestCandles(pair: string, timeframe: string, limit = 100, compact = false): Promise<Candle[] | number[][]> {
    const candles = await this.candleRepository.find({
      where: { pair, timeframe },
      order: { time: 'DESC' },
      take: limit,
    });

    if (compact) {
      return candles.map(c => [
        c.time.getTime(),
        parseFloat(c.open.toString()),
        parseFloat(c.high.toString()),
        parseFloat(c.low.toString()),
        parseFloat(c.close.toString()),
        parseFloat(c.volume.toString()),
      ]);
    }

    return candles;
  }

  async getCandlesForRange(pair: string, timeframe: string, start: Date, end: Date) {
    return this.candleRepository.createQueryBuilder('candle')
      .where('candle.pair = :pair', { pair })
      .andWhere('candle.timeframe = :timeframe', { timeframe })
      .andWhere('candle.time >= :start', { start })
      .andWhere('candle.time <= :end', { end })
      .orderBy('candle.time', 'ASC')
      .getMany();
  }

  async ensureHistoricalData(pair: string, timeframe: string, start: Date, end: Date): Promise<void> {
    if (this.VIRTUAL_SYMBOLS.includes(pair) || pair.includes('_TOP')) {
      this.logger.debug(`Skipping ensureHistoricalData for virtual symbol: ${pair}`);
      return;
    }
    const existing = await this.candleRepository.count({
      where: { pair, timeframe },
    });

    const tfMs: Record<string, number> = {
      '1m': 60_000, '5m': 300_000, '15m': 900_000,
      '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
    };
    const stepMs = tfMs[timeframe] ?? 3_600_000;
    const needed = Math.ceil((end.getTime() - start.getTime()) / stepMs);

    if (existing >= needed * 0.9) return; // already have ≥90% of range

    this.logger.log(`Fetching historical data for ${pair} ${timeframe} from Binance...`);

    let since = start.getTime();
    const endMs = end.getTime();
    let fetched = 0;

    while (since < endMs) {
      const candles = await this.binanceApi.fetchCandles(pair, timeframe, since, 1000);
      if (candles.length === 0) break;

      for (const c of candles) {
        if (c.time.getTime() > endMs) break;
        await this.saveCandle({ ...c, pair, timeframe });
        fetched++;
      }

      since = candles[candles.length - 1].time.getTime() + stepMs;
    }

    this.logger.log(`Saved ${fetched} historical candles for ${pair} ${timeframe}`);
  }
}
