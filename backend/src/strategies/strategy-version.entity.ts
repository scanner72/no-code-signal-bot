import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { Strategy } from './strategy.entity';

@Entity('strategy_versions')
export class StrategyVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Strategy, { onDelete: 'CASCADE' })
  strategy: Strategy;

  @Column()
  strategy_id: number;

  @Column()
  version: number;

  @Column({ type: 'text', nullable: true })
  label: string;

  @Column({ type: 'jsonb', nullable: true })
  nodes: any;

  @Column({ type: 'jsonb', nullable: true })
  edges: any;

  @Column({ type: 'jsonb', nullable: true })
  ast: any;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
