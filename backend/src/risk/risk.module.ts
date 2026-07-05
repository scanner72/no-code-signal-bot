import { Module } from '@nestjs/common';
import { RiskSizingService } from './risk-sizing.service';

@Module({
  providers: [RiskSizingService],
  exports: [RiskSizingService],
})
export class RiskModule {}
