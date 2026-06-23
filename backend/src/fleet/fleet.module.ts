import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotInstance } from './bot-instance.entity';
import { FleetService } from './fleet.service';
import { FleetController } from './fleet.controller';
import { RiskService } from './risk.service';
import { SignalsModule } from '../signals/signals.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { CandlesModule } from '../candles/candles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BotInstance]),
    SignalsModule,
    IndicatorsModule,
    CandlesModule,
  ],
  controllers: [FleetController],
  providers: [FleetService, RiskService],
  exports: [FleetService, RiskService],
})
export class FleetModule {}
