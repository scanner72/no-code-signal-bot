import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

export enum OcoStatus {
  ACTIVE = 'ACTIVE',
  TP_FILLED = 'TP_FILLED',
  SL_FILLED = 'SL_FILLED',
  CANCELLED = 'CANCELLED',
}

@Entity('oco_bracket_orders')
export class OcoBracketOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Strategy)
  strategy: Strategy;

  @Column()
  strategy_id: number;

  @Column()
  pair: string;

  @Column({ nullable: true })
  entry_order_id: string;

  @Column()
  tp_order_id: string;

  @Column()
  sl_order_id: string;

  @Column('decimal', { precision: 20, scale: 8 })
  tp_price: number;

  @Column('decimal', { precision: 20, scale: 8 })
  sl_price: number;

  @Column('decimal', { precision: 20, scale: 8 })
  amount: number;

  @Column({ type: 'enum', enum: OcoStatus, default: OcoStatus.ACTIVE })
  status: OcoStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
