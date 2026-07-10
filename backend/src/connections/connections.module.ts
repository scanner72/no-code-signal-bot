import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Connection } from './connection.entity';
import { Setting } from '../settings/setting.entity';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';
import { EncryptionService } from './encryption.service';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Connection, Setting]),
    forwardRef(() => DeliveryModule),
  ],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, EncryptionService],
  exports: [ConnectionsService, EncryptionService],
})
export class ConnectionsModule {}
