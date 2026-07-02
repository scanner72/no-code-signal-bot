import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

@Entity('paper_trading_accounts')
@Index(['strategy_id', 'node_id'], { unique: true })
export class PaperTradingAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Strategy)
  strategy: Strategy;

  @Column()
  strategy_id: number;

  /** React Flow node id — стабильный ключ инстанса ноды на канвасе */
  @Column()
  node_id: string;

  @Column({ default: 'Config' })
  label: string;

  @Column('decimal', { precision: 20, scale: 2, default: 1000 })
  starting_capital: number;

  /** Свободный баланс (маржа открытых позиций уже вычтена) */
  @Column('decimal', { precision: 20, scale: 2, default: 1000 })
  current_balance: number;

  @Column('decimal', { precision: 6, scale: 2, default: 1 })
  leverage: number;

  /** % от текущего баланса на сделку (компаундинг) */
  @Column('decimal', { precision: 5, scale: 2, default: 10 })
  risk_percent: number;

  // Свой SL/TP (проценты движения цены), независимы от strategy.execution_settings
  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  sl_percent: number | null;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  tp_percent: number | null;

  @Column({ default: false })
  use_trailing: boolean;

  @Column('decimal', { precision: 10, scale: 4, default: 1 })
  trailing_distance: number;

  @Column('decimal', { precision: 10, scale: 4, default: 0.5 })
  trailing_activation: number;

  @Column({ default: false })
  move_sl_to_be: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  partial_tps: Array<{ target: number; closePercent: number }>;

  /** Сколько сигналов пропущено из-за нехватки баланса (виден на ноде) */
  @Column({ type: 'int', default: 0 })
  skipped_signals: number;

  /** false = нода удалена с канваса; история сохраняется для сравнения */
  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
