import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

@Entity('bot_instances')
export class BotInstance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Strategy)
  strategy: Strategy;

  @Column()
  pair: string;

  @Column()
  timeframe: string;

  @Column({ default: 'STOPPED' }) // RUNNING, PAUSED, STOPPED, ERROR
  status: string;

  @Column('float', { default: 0 })
  currentBalance: number;

  @Column('float', { default: 0 })
  initialBalance: number;

  @Column('float', { default: 0 })
  totalPnL: number;

  @Column('float', { default: 0 })
  totalPnLPct: number;

  @Column({ default: 0 })
  tradesCount: number;

  @Column({ type: 'jsonb', nullable: true })
  currentPosition: any; // { type: 'LONG', entryPrice: 123, size: 1, ... }

  @Column({ type: 'jsonb', nullable: true })
  settings: any; // { risk: 0.1, stopLoss: 0.02, ... }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
