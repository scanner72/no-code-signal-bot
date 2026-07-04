import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

@Entity('backtest_runs')
export class BacktestRun {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Strategy, { onDelete: 'CASCADE' })
  strategy: Strategy;

  @Index()
  @Column()
  strategy_id: number;

  /** Полный BacktestOptions, с которым запускался прогон */
  @Column({ type: 'jsonb' })
  options: any;

  /** Полный result движка (trades, метрики, equityCurve, benchmark) */
  @Column({ type: 'jsonb' })
  result: any;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
