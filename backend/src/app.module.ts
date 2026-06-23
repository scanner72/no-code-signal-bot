import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './health/health.module';
import { CandlesModule } from './candles/candles.module';
import { Candle } from './candles/candle.entity';
import { StrategiesModule } from './strategies/strategies.module';
import { Strategy } from './strategies/strategy.entity';
import { StrategyVersion } from './strategies/strategy-version.entity';
import { Signal } from './signals/signal.entity';
import { Setting } from './settings/setting.entity';
import { BotInstance } from './fleet/bot-instance.entity';
import { MLModel } from './ml/ml-model.entity';
import { IndicatorsModule } from './indicators/indicators.module';
import { SignalsModule } from './signals/signals.module';
import { TelegramModule } from './telegram/telegram.module';
import { BacktestModule } from './backtest/backtest.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OptimizerModule } from './optimizer/optimizer.module';
import { CodegenModule } from './codegen/codegen.module';
import { KronosModule } from './kronos/kronos.module';
import { AuthModule } from './auth/auth.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { OrderbookModule } from './orderbook/orderbook.module';
import { FleetModule } from './fleet/fleet.module';
import { MLModule } from './ml/ml.module';
import { CrossExchangeModule } from './cross-exchange/cross-exchange.module';
import { SentimentModule } from './sentiment/sentiment.module';
import { HermesModule } from './hermes/hermes.module';
import { LdrModule } from './ldr/ldr.module';
import { PaperTradingModule } from './paper-trading/paper-trading.module';
import { OrdersModule } from './orders/orders.module';
import { FreeAiModule } from './free-ai/free-ai.module';

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
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT, 10) || 6379,
          },
          ttl: 30000, // 30 seconds default
        }),
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    HealthModule,
    CandlesModule,
    IndicatorsModule,
    StrategiesModule,
    SignalsModule,
    TelegramModule,
    BacktestModule,
    SettingsModule,
    DashboardModule,
    OptimizerModule,
    CodegenModule,
    KronosModule,
    AuthModule,
    CollaborationModule,
    OrderbookModule,
    FleetModule,
    MLModule,
    CrossExchangeModule,
    SentimentModule,
    HermesModule,
    LdrModule,
    PaperTradingModule,
    OrdersModule,
    FreeAiModule,
  ],
})
export class AppModule {}
