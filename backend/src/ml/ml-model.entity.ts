import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

@Entity('ml_models')
export class MLModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Strategy)
  strategy: Strategy;

  @Column()
  targetPair: string;

  @Column()
  targetTimeframe: string;

  @Column({ type: 'jsonb' })
  features: string[]; // ['RSI', 'MACD', 'VolumeDelta']

  @Column({ type: 'jsonb', nullable: true })
  weights: any; // Serialized model weights

  @Column('float', { default: 0 })
  accuracy: number;

  @Column({ default: 'random_forest' })
  modelType: string; // random_forest | gradient_boosting | logistic_regression

  @Column({ default: 'DRAFT' }) // DRAFT, TRAINING, READY, FAILED
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
