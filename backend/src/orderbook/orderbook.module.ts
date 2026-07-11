import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderbookService } from './orderbook.service';
import { OrderbookSnapshotService } from './orderbook-snapshot.service';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';
import { OrderbookController } from './orderbook.controller';
import { CandlesModule } from '../candles/candles.module';

@Module({
  imports: [CandlesModule, TypeOrmModule.forFeature([OrderbookSnapshot])],
  controllers: [OrderbookController],
  providers: [OrderbookService, OrderbookSnapshotService],
  exports: [OrderbookService, OrderbookSnapshotService],
})
export class OrderbookModule {}
