import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

@Entity('signals')
export class Signal {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Strategy)
  strategy: Strategy;

  @Column()
  strategy_id: number;

  @Column()
  pair: string;

  @Column()
  timeframe: string;

  @Column()
  type: string; // LONG, SHORT

  @Column('decimal', { precision: 20, scale: 8 })
  price: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;
}
