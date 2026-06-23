import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MLModel } from './ml-model.entity';
import { MLService } from './ml.service';
import { MLController } from './ml.controller';
import { CandlesModule } from '../candles/candles.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { SignalsModule } from '../signals/signals.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([MLModel]),
    CandlesModule,
    IndicatorsModule,
    forwardRef(() => SignalsModule),
  ],
  controllers: [MLController],
  providers: [MLService],
  exports: [MLService],
})
export class MLModule {}
