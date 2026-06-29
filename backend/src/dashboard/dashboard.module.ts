import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Signal } from '../signals/signal.entity';
import { Strategy } from '../strategies/strategy.entity';
import { Candle } from '../candles/candle.entity';
import { SettingsModule } from '../settings/settings.module';
import { CandlesModule } from '../candles/candles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Signal, Strategy, Candle]),
    SettingsModule,
    CandlesModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
