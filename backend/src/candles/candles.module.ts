import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Candle } from './candle.entity';
import { CandlesService } from './candles.service';
import { FuturesWebsocketService } from './futures-websocket.service';
import { BinanceApiService } from './binance-api.service';
import { CandlesController } from './candles.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Candle]),
    SettingsModule,
  ],
  controllers: [CandlesController],
  providers: [CandlesService, FuturesWebsocketService, BinanceApiService],
  exports: [CandlesService, BinanceApiService, FuturesWebsocketService],
})
export class CandlesModule {}
