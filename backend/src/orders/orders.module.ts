import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CCXTQueueService } from './ccxt-queue.service';
import { OrderQueueProcessor } from './order-queue.processor';
import { OcoManagerService } from './oco-manager.service';
import { OcoBracketOrder } from './oco-bracket-order.entity';
import { GridManagerService } from './grid-manager.service';
import { Strategy } from '../strategies/strategy.entity';
import { CrossExchangeModule } from '../cross-exchange/cross-exchange.module';
import { CandlesModule } from '../candles/candles.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { AlgoExecutionState } from './algo-execution-state.entity';
import { AlgoExecutionService } from './algo-execution.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OcoBracketOrder, Strategy, AlgoExecutionState]),
    BullModule.registerQueue({
      name: 'orders-execution',
      limiter: {
        max: 5,           // Maximum 5 orders executed
        duration: 1000,   // Per 1000 milliseconds (1 second)
      },
    }),
    CrossExchangeModule,
    CandlesModule,
    IndicatorsModule,
  ],
  providers: [CCXTQueueService, OrderQueueProcessor, OcoManagerService, GridManagerService, AlgoExecutionService],
  exports: [CCXTQueueService, OcoManagerService, GridManagerService, AlgoExecutionService],
})
export class OrdersModule {}

