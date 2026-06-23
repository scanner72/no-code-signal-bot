import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AlgoExecutionStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

@Entity('algo_executions')
export class AlgoExecutionState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  strategyId: number;

  @Column()
  pair: string;

  @Column()
  side: 'buy' | 'sell';

  @Column()
  algoType: 'TWAP' | 'VWAP';

  @Column('decimal', { precision: 20, scale: 8 })
  totalAmount: number;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  executedAmount: number;

  @Column({ type: 'enum', enum: AlgoExecutionStatus, default: AlgoExecutionStatus.RUNNING })
  status: AlgoExecutionStatus;

  @Column('simple-array', { nullable: true })
  bullJobIds: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
