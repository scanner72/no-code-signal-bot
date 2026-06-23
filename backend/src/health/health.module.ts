import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CandlesModule } from '../candles/candles.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [CandlesModule, TelegramModule],
  controllers: [HealthController],
})
export class HealthModule {}
