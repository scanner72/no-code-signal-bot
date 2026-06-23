import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OptimizerService } from './optimizer.service';
import { OptimizerController } from './optimizer.controller';
import { Strategy } from '../strategies/strategy.entity';
import { BacktestModule } from '../backtest/backtest.module';
import { CandlesModule } from '../candles/candles.module';
import { SignalsModule } from '../signals/signals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Strategy]),
    BacktestModule,
    CandlesModule,
    SignalsModule,
  ],
  providers: [OptimizerService],
  controllers: [OptimizerController],
})
export class OptimizerModule {}
