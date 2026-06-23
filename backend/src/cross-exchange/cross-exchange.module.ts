import { Module } from '@nestjs/common';
import { CrossExchangeService } from './cross-exchange.service';
import { CrossExchangeController } from './cross-exchange.controller';

@Module({
  providers: [CrossExchangeService],
  controllers: [CrossExchangeController],
  exports: [CrossExchangeService],
})
export class CrossExchangeModule {}
