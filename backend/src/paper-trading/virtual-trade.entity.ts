import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

export enum TradeStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

@Entity('virtual_trades')
export class VirtualTrade {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Strategy)
  strategy: Strategy;

  @Column()
  strategy_id: number;

  @Column()
  pair: string;

  @Column()
  type: string; // LONG, SHORT

  @Column('decimal', { precision: 20, scale: 8 })
  entry_price: number;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  exit_price: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  pnl_percent: number;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  pnl_value: number;

  @Column({ type: 'enum', enum: TradeStatus, default: TradeStatus.OPEN })
  status: TradeStatus;

  @Column({ nullable: true })
  exit_reason: string; // TP, SL, OPPOSITE_SIGNAL, TRAILING, PARTIAL_TP, MANUAL

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  highest_price: number;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  lowest_price: number;

  @Column('decimal', { precision: 20, scale: 8, default: 100 })
  volume: number; // dynamically calculated position size in USD

  @Column('decimal', { precision: 5, scale: 2, default: 0, nullable: true })
  correlation: number; // max correlation with other active assets at entry

  @Column('decimal', { precision: 5, scale: 2, default: 1.0, nullable: true })
  risk_multiplier: number; // dynamic ATR / confidence risk scaling factor

  // ── Paper Trading Account (per-node virtual accounts) ────────────────────
  /** NULL = сделка legacy-пути (тумблер is_paper_trading) */
  @Column({ nullable: true })
  paper_account_id: number;

  @Column('decimal', { precision: 20, scale: 2, nullable: true })
  margin_used: number;

  @Column('decimal', { precision: 6, scale: 2, nullable: true })
  leverage_used: number;

  // ── Trailing Stop fields ──────────────────────────────────────────────────
  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  stop_price: number; // dynamic trailing stop level

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  peak_price: number; // best price reached since entry (peak for LONG, trough for SHORT)

  @Column({ default: false })
  trailing_active: boolean; // trailing has been activated (activation threshold crossed)

  // ── Partial TP tracking ───────────────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  partial_tp_hits: number; // how many partial TP levels have been hit

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  remaining_volume: number; // remaining position size in USD after partial closes

  @Column({ default: 'NONE' })
  ab_variant: string; // NONE, A, B

  @CreateDateColumn({ type: 'timestamptz' })
  opened_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  closed_at: Date;
}
