import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MLModel } from './ml-model.entity';
import { VirtualTrade } from '../paper-trading/virtual-trade.entity';
import { MLService } from './ml.service';
import { MLController } from './ml.controller';
import { CandlesModule } from '../candles/candles.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { SignalsModule } from '../signals/signals.module';
import { AstEvaluatorModule } from '../signals/ast-evaluator.module';
import { KronosModule } from '../kronos/kronos.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([MLModel, VirtualTrade]),
    CandlesModule,
    IndicatorsModule,
    forwardRef(() => SignalsModule),
    AstEvaluatorModule,
    KronosModule,
  ],
  controllers: [MLController],
  providers: [MLService],
  exports: [MLService],
})
export class MLModule {}
