import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { Candle } from './candles/candle.entity';
import { Strategy } from './strategies/strategy.entity';
import { StrategyVersion } from './strategies/strategy-version.entity';
import { Signal } from './signals/signal.entity';
import { Setting } from './settings/setting.entity';
import { BotInstance } from './fleet/bot-instance.entity';
import { MLModel } from './ml/ml-model.entity';
import { CandlesModule } from './candles/candles.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { SignalsModule } from './signals/signals.module';
import { SettingsModule } from './settings/settings.module';
import { HermesModule } from './hermes/hermes.module';
import { LdrModule } from './ldr/ldr.module';
import { SentimentModule } from './sentiment/sentiment.module';
import { KronosModule } from './kronos/kronos.module';
import { MLModule } from './ml/ml.module';
import { OrdersModule } from './orders/orders.module';
import { TelegramModule } from './telegram/telegram.module';
import { PaperTradingModule } from './paper-trading/paper-trading.module';
import { FleetModule } from './fleet/fleet.module';
import { OrderbookModule } from './orderbook/orderbook.module';
import { BacktestService } from './backtest/backtest.service';
import { BacktestProcessor } from './backtest/backtest.processor';
import { BacktestProgressService } from './backtest/backtest-progress.service';
import { OptimizerService } from './backtest/optimizer.service';
import { StrategiesModule } from './strategies/strategies.module';
import { CrossExchangeModule } from './cross-exchange/cross-exchange.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'signals_db',
      entities: [Candle, Strategy, StrategyVersion, Signal, Setting, BotInstance, MLModel],
      autoLoadEntities: true,
      synchronize: true,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      },
    }),
    BullModule.registerQueue({ name: 'backtest' }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT, 10) || 6379,
          },
          ttl: 30000,
        }),
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Strategy]),
    CandlesModule,
    IndicatorsModule,
    SignalsModule,
    StrategiesModule,
    SettingsModule,
    HermesModule,
    LdrModule,
    SentimentModule,
    KronosModule,
    MLModule,
    OrdersModule,
    TelegramModule,
    PaperTradingModule,
    FleetModule,
    OrderbookModule,
    CrossExchangeModule,
  ],
  providers: [BacktestService, BacktestProcessor, BacktestProgressService, OptimizerService],
})
export class WorkerModule {}
