import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import { Signal } from '../signals/signal.entity';
import { Strategy } from '../strategies/strategy.entity';
import { Candle } from '../candles/candle.entity';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Signal)
    private readonly signalRepository: Repository<Signal>,
    @InjectRepository(Strategy)
    private readonly strategyRepository: Repository<Strategy>,
    @InjectRepository(Candle)
    private readonly candleRepository: Repository<Candle>,
    private readonly settingsService: SettingsService,
  ) {}

  async getStats() {
    const now = new Date();

    // Start of today (UTC)
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    // 7 days ago
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    // 30 days ago
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    // 1 hour ago
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // --- Today stats ---
    const todaySignals = await this.signalRepository.find({
      where: { created_at: MoreThanOrEqual(todayStart) },
      relations: ['strategy'],
    });

    const todayLong = todaySignals.filter(s => s.type === 'LONG').length;
    const todayShort = todaySignals.filter(s => s.type === 'SHORT').length;

    // Signals in last hour
    const lastHourCount = todaySignals.filter(
      s => new Date(s.created_at).getTime() >= oneHourAgo.getTime(),
    ).length;

    // --- 7-day stats ---
    const weekSignals = await this.signalRepository.find({
      where: { created_at: MoreThanOrEqual(sevenDaysAgo) },
      relations: ['strategy'],
    });

    const weekLong = weekSignals.filter(s => s.type === 'LONG').length;
    const weekShort = weekSignals.filter(s => s.type === 'SHORT').length;

    // --- Pair distribution (7 days) ---
    const pairMap: Record<string, number> = {};
    for (const s of weekSignals) {
      pairMap[s.pair] = (pairMap[s.pair] || 0) + 1;
    }
    const pairDistribution = Object.entries(pairMap)
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count);

    // --- Daily bar chart data (7 days) ---
    const dailyChart = await this.getDailyChart(sevenDaysAgo, now);

    // --- Strategy stats ---
    const strategies = await this.strategyRepository.find();
    const activeStrategies = strategies.filter(s => s.is_active).length;

    // --- Strategy distribution (which strategy generated most signals, 7d) ---
    const strategyMap: Record<string, number> = {};
    for (const s of weekSignals) {
      const name = s.strategy?.name || `Strategy #${s.strategy_id}`;
      strategyMap[name] = (strategyMap[name] || 0) + 1;
    }
    const strategyDistribution = Object.entries(strategyMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      today: {
        total: todaySignals.length,
        long: todayLong,
        short: todayShort,
        lastHour: lastHourCount,
        telegramDelivered: todaySignals.length, // all signals are attempted for delivery
      },
      week: {
        total: weekSignals.length,
        long: weekLong,
        short: weekShort,
      },
      strategies: {
        total: strategies.length,
        active: activeStrategies,
      },
      pairDistribution,
      strategyDistribution,
      dailyChart,
    };
  }

  private async getDailyChart(from: Date, to: Date) {
    // Get raw data grouped by day and type
    const result = await this.signalRepository
      .createQueryBuilder('s')
      .select("DATE_TRUNC('day', s.created_at)", 'day')
      .addSelect('s.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('s.created_at >= :from', { from })
      .andWhere('s.created_at <= :to', { to })
      .groupBy("DATE_TRUNC('day', s.created_at)")
      .addGroupBy('s.type')
      .orderBy('day', 'ASC')
      .getRawMany();

    // Build 7 days array
    const days: { date: string; long: number; short: number }[] = [];
    const current = new Date(from);
    current.setUTCHours(0, 0, 0, 0);

    while (current <= to) {
      const dateKey = current.toISOString().split('T')[0];
      days.push({
        date: dateKey,
        long: 0,
        short: 0,
      });
      current.setUTCDate(current.getUTCDate() + 1);
    }

    // Fill from DB results
    for (const row of result) {
      const dayStr = new Date(row.day).toISOString().split('T')[0];
      const entry = days.find(d => d.date === dayStr);
      if (entry) {
        if (row.type === 'LONG') entry.long = parseInt(row.count, 10);
        if (row.type === 'SHORT') entry.short = parseInt(row.count, 10);
      }
    }

    return days;
  }

  async getScreener() {
    const dbPairs = await this.settingsService.get('trading_pairs');
    const pairs = (dbPairs || process.env.TRADING_PAIRS || 'BTCUSDT,ETHUSDT,SOLUSDT').split(',').map(p => p.trim());
    const timeframe = '1h';

    const result = [];

    for (const pair of pairs) {
      try {
        // Get last 25 candles for 24h data (24 candles = 24h for 1h timeframe)
        const candles = await this.candleRepository.find({
          where: { pair, timeframe },
          order: { time: 'DESC' },
          take: 25,
        });

        if (candles.length === 0) {
          result.push({ pair, price: 0, change24h: 0, high24h: 0, low24h: 0, volume24h: 0, markPrice: null });
          continue;
        }

        const latest = candles[0];
        const price = parseFloat(latest.close.toString());
        const markPrice = latest.mark_price ? parseFloat(latest.mark_price.toString()) : null;

        // 24h ago candle (approx 24 candles back for 1h)
        const oldest = candles.length >= 24 ? candles[23] : candles[candles.length - 1];
        const oldPrice = parseFloat(oldest.open.toString());
        const change24h = oldPrice > 0 ? parseFloat(((price - oldPrice) / oldPrice * 100).toFixed(2)) : 0;

        // 24h high, low, volume
        const subset = candles.slice(0, 24);
        const high24h = parseFloat(Math.max(...subset.map(c => parseFloat(c.high.toString()))).toFixed(2));
        const low24h = parseFloat(Math.min(...subset.map(c => parseFloat(c.low.toString()))).toFixed(2));
        const volume24h = parseFloat(subset.reduce((s, c) => s + parseFloat(c.volume.toString()), 0).toFixed(2));

        result.push({ pair, price, change24h, high24h, low24h, volume24h, markPrice });
      } catch (e) {
        this.logger.warn(`Screener: failed for ${pair}: ${e.message}`);
        result.push({ pair, price: 0, change24h: 0, high24h: 0, low24h: 0, volume24h: 0, markPrice: null });
      }
    }

    return result;
  }
}
