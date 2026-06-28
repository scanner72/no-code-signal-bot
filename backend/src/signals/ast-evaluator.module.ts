import { Module } from '@nestjs/common';
import { CandlesModule } from '../candles/candles.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { AstEvaluatorService } from './ast-evaluator.service';

@Module({
  imports: [CandlesModule, IndicatorsModule],
  providers: [AstEvaluatorService],
  exports: [AstEvaluatorService],
})
export class AstEvaluatorModule {}
