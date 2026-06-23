import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BacktestService } from './backtest.service';
import { OptimizerService } from './optimizer.service';
import { BacktestController } from './backtest.controller';
import { OptimizerController } from './optimizer.controller';
import { Strategy } from '../strategies/strategy.entity';
import { CandlesModule } from '../candles/candles.module';
import { SignalsModule } from '../signals/signals.module';

import { IndicatorsModule } from '../indicators/indicators.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Strategy]),
    CandlesModule,
    SignalsModule,
    IndicatorsModule,
  ],
  providers: [BacktestService, OptimizerService],
  controllers: [BacktestController, OptimizerController],
  exports: [BacktestService, OptimizerService],
})
export class BacktestModule {}
