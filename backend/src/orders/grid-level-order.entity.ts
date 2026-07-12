import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

export enum GridOrderStatus {
  ACTIVE = 'ACTIVE',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
}

@Entity('grid_level_orders')
export class GridLevelOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Strategy)
  strategy: Strategy;

  @Column()
  strategy_id: number;

  @Column()
  pair: string;

  @Column()
  level_index: number;

  @Column()
  job_id: string; // Bull job ID

  @Column({ nullable: true })
  exchange_order_id: string; // CCXT order ID when executed

  @Column('decimal', { precision: 20, scale: 8 })
  price: number;

  @Column('decimal', { precision: 20, scale: 8 })
  amount: number;

  @Column({ type: 'varchar', default: 'buy' })
  side: 'buy' | 'sell';

  @Column({ type: 'enum', enum: GridOrderStatus, default: GridOrderStatus.ACTIVE })
  status: GridOrderStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
