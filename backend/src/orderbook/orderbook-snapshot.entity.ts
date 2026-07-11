import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * A point-in-time L2 orderbook reading, persisted going forward since no
 * exchange provides a historical depth archive (candles can be backfilled
 * for any past date; the orderbook cannot). One row per pair per minute —
 * derived metrics only (not the raw bid/ask levels), matching exactly what
 * the 'orderbook' AST node consumes. See ast-evaluator.service.ts.
 */
@Entity('orderbook_snapshots')
@Index(['pair', 'timestamp'], { unique: true })
export class OrderbookSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  pair: string;

  /** Floored to the minute so backtest candle joins are a simple lookup. */
  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column('decimal', { precision: 20, scale: 8 })
  mid: number;

  /** Bid volume share of top-10 book depth, 0-100. */
  @Column('decimal', { precision: 10, scale: 4 })
  imbalance_pct: number;

  /** Best bid/ask spread as % of mid price. */
  @Column('decimal', { precision: 10, scale: 4 })
  spread_pct: number;

  /** Distance to the nearest liquidity wall as % of mid price; null if no
   *  wall was detected in this snapshot. */
  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  wall_distance_pct: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
