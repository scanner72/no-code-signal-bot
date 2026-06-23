import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Signal } from './signal.entity';
import { SettingsService } from '../settings/settings.service';
import { MoreThanOrEqual } from 'typeorm';

@Injectable()
export class SignalsService {
  private readonly logger = new Logger(SignalsService.name);

  constructor(
    @InjectRepository(Signal)
    private readonly signalRepository: Repository<Signal>,
    private readonly settingsService: SettingsService,
  ) {}

  async createSignal(signalData: Partial<Signal>) {
    try {
      // 1. Check deduplication
      const intervalStr = await this.settingsService.get('deduplication_interval');
      const intervalHours = parseInt(intervalStr || '4');
      
      const threshold = new Date();
      threshold.setUTCHours(threshold.getUTCHours() - intervalHours);

      const existing = await this.signalRepository.findOne({
        where: {
          strategy_id: signalData.strategy_id,
          pair: signalData.pair,
          created_at: MoreThanOrEqual(threshold)
        }
      });

      if (existing) {
        this.logger.debug(`Signal deduplicated: ${signalData.pair} via strategy ${signalData.strategy_id}`);
        return existing;
      }

      const signal = this.signalRepository.create(signalData);
      return await this.signalRepository.save(signal);
    } catch (error) {
      this.logger.error(`Error saving signal: ${error.message}`);
      throw error;
    }
  }

  async getLatestSignals(limit = 10, skip = 0) {
    return this.signalRepository.find({
      order: { created_at: 'DESC' },
      take: limit,
      skip: skip,
      relations: ['strategy'],
    });
  }

  async findByPair(pair: string, limit = 100) {
    return this.signalRepository.find({
      where: { pair },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  // ── Stats per strategy ────────────────────────────────────────────────────

  async getStatsByStrategy(strategyId: number) {
    const now = new Date();

    // Today start (UTC)
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    // 7 days ago
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // 1 hour ago
    const hourAgo = new Date(now);
    hourAgo.setHours(hourAgo.getHours() - 1);

    const [weekSignals, todaySignals, hourSignals] = await Promise.all([
      this.signalRepository.find({
        where: { strategy_id: strategyId, created_at: MoreThanOrEqual(weekAgo) },
      }),
      this.signalRepository.find({
        where: { strategy_id: strategyId, created_at: MoreThanOrEqual(todayStart) },
      }),
      this.signalRepository.find({
        where: { strategy_id: strategyId, created_at: MoreThanOrEqual(hourAgo) },
      }),
    ]);

    return {
      week: {
        total: weekSignals.length,
        long: weekSignals.filter(s => s.type === 'LONG').length,
        short: weekSignals.filter(s => s.type === 'SHORT').length,
      },
      today: {
        total: todaySignals.length,
        long: todaySignals.filter(s => s.type === 'LONG').length,
        short: todaySignals.filter(s => s.type === 'SHORT').length,
      },
      hourly: hourSignals.length,
    };
  }

  /** Aggregate signal stats for all strategies at once */
  async getAllStrategiesStats(): Promise<Record<number, { week: number; weekLong: number; weekShort: number; today: number }>> {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const signals = await this.signalRepository.find({
      where: { created_at: MoreThanOrEqual(weekAgo) },
      select: ['strategy_id', 'type', 'created_at'],
    });

    const stats: Record<number, { week: number; weekLong: number; weekShort: number; today: number }> = {};

    for (const s of signals) {
      if (!stats[s.strategy_id]) {
        stats[s.strategy_id] = { week: 0, weekLong: 0, weekShort: 0, today: 0 };
      }
      stats[s.strategy_id].week++;
      if (s.type === 'LONG') stats[s.strategy_id].weekLong++;
      if (s.type === 'SHORT') stats[s.strategy_id].weekShort++;
      if (new Date(s.created_at) >= todayStart) stats[s.strategy_id].today++;
    }

    return stats;
  }
}
