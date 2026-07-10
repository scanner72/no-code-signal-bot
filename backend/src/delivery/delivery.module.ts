import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Strategy } from '../strategies/strategy.entity';
import { DeliveryService } from './delivery.service';
import { DeliveryProcessor } from './delivery.processor';
import { DeliveryPolicy } from './delivery.policy';
import { ConnectionsModule } from '../connections/connections.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Strategy]),
    BullModule.registerQueue({
      name: 'delivery',
      // Telegram hard-limits: ~30 msg/s global. Keep a conservative ceiling.
      limiter: { max: 20, duration: 1000 },
    }),
    forwardRef(() => ConnectionsModule),
  ],
  providers: [DeliveryService, DeliveryProcessor, DeliveryPolicy],
  exports: [DeliveryService, DeliveryPolicy],
})
export class DeliveryModule {}
