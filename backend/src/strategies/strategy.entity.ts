import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('strategies')
export class Strategy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  user_id: string;

  @Column({ type: 'text', nullable: true })
  owner_id: string;

  @Column({ type: 'text', default: 'private' })
  visibility: 'private' | 'public' | 'unlisted';

  @Column({ type: 'int', nullable: true })
  fork_of: number;

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date;


  @Column({ type: 'jsonb', nullable: true })
  nodes: any;

  @Column({ type: 'jsonb', nullable: true })
  edges: any;

  @Column({ type: 'jsonb', nullable: true })
  ast: any;

  @Column()
  pair: string;

  @Column()
  timeframe: string;

  @Column({ default: false })
  is_active: boolean;

  @Column({ default: true })
  is_paper_trading: boolean;

  @Column({ type: 'jsonb', nullable: true })
  execution_settings: any;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
