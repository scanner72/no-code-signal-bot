import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderbookService } from './orderbook.service';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';

/**
 * Persists one orderbook reading per minute per actively-subscribed pair, so
 * backtests run in the future can use real historical L2 data instead of the
 * mock in ast-evaluator.service.ts. Only snapshots pairs OrderbookService has
 * already opened a WS connection for (i.e. actually used by a live/paper
 * strategy's orderbook node) — no new exchange connections, bounded storage
 * growth (a handful of pairs, one row/minute — not the 100ms tick rate).
 */
@Injectable()
export class OrderbookSnapshotService {
  private readonly logger = new Logger(OrderbookSnapshotService.name);

  constructor(
    private readonly orderbookService: OrderbookService,
    @InjectRepository(OrderbookSnapshot)
    private readonly snapshotRepo: Repository<OrderbookSnapshot>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async captureSnapshots(): Promise<void> {
    const symbols = this.orderbookService.getActiveSymbols();
    if (!symbols.length) return;

    const timestamp = new Date();
    timestamp.setSeconds(0, 0);

    for (const symbol of symbols) {
      try {
        const snapshot = await this.buildSnapshot(symbol, timestamp);
        if (!snapshot) continue;

        await this.snapshotRepo
          .createQueryBuilder()
          .insert()
          .values(snapshot)
          .orIgnore() // unique (pair, timestamp) — a slightly-late tick this minute is a no-op, not an error
          .execute();
      } catch (e) {
        this.logger.warn(`Snapshot capture failed for ${symbol}: ${(e as Error).message}`);
      }
    }
  }

  /** Extracted for testability — builds the row without touching the DB. */
  async buildSnapshot(symbol: string, timestamp: Date): Promise<Partial<OrderbookSnapshot> | null> {
    const metrics = await this.orderbookService.getCurrentMetrics(symbol);
    if (!metrics || !(metrics.mid > 0)) return null;

    const imbalance_pct = Number((metrics.imbalance * 100).toFixed(4));
    const spread_pct = Number(((metrics.spread / metrics.mid) * 100).toFixed(4));

    let wall_distance_pct: number | null = null;
    if (metrics.walls.length > 0) {
      let minDistance = Math.abs(metrics.walls[0].price - metrics.mid);
      for (const w of metrics.walls) {
        const dist = Math.abs(w.price - metrics.mid);
        if (dist < minDistance) minDistance = dist;
      }
      wall_distance_pct = Number(((minDistance / metrics.mid) * 100).toFixed(4));
    }

    return { pair: symbol, timestamp, mid: metrics.mid, imbalance_pct, spread_pct, wall_distance_pct };
  }

  async getSnapshotsForRange(pair: string, start: Date, end: Date): Promise<OrderbookSnapshot[]> {
    return this.snapshotRepo.find({
      where: { pair, timestamp: Between(start, end) },
      order: { timestamp: 'ASC' },
    });
  }
}
