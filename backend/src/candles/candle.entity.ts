import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('candles')
export class Candle {
  @PrimaryColumn('timestamptz')
  time: Date;

  @PrimaryColumn()
  pair: string;

  @PrimaryColumn()
  timeframe: string;

  @Column('decimal', { precision: 20, scale: 8 })
  open: number;

  @Column('decimal', { precision: 20, scale: 8 })
  high: number;

  @Column('decimal', { precision: 20, scale: 8 })
  low: number;

  @Column('decimal', { precision: 20, scale: 8 })
  close: number;

  @Column('decimal', { precision: 20, scale: 8 })
  volume: number;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  mark_price: number;

  @Column('decimal', { precision: 10, scale: 6, nullable: true })
  funding_rate: number;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  open_interest: number;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  taker_buy_volume: number;
}
