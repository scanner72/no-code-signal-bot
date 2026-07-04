import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Candle } from './candles/candle.entity';
import { Strategy } from './strategies/strategy.entity';
import { StrategyVersion } from './strategies/strategy-version.entity';
import { Signal } from './signals/signal.entity';
import { Setting } from './settings/setting.entity';
import { BacktestRun } from './backtest/backtest-run.entity';
import { CandlesModule } from './candles/candles.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { SettingsModule } from './settings/settings.module';
import { BacktestService } from './backtest/backtest.service';
import { BacktestProcessor } from './backtest/backtest.processor';
import { BacktestProgressService } from './backtest/backtest-progress.service';
import { BacktestRunsService } from './backtest/backtest-runs.service';
import { OptimizerService } from './backtest/optimizer.service';
import { StrategiesModule } from './strategies/strategies.module';
import { AstEvaluatorModule } from './signals/ast-evaluator.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'signals_db',
      entities: [Candle, Strategy, StrategyVersion, Signal, Setting],
      autoLoadEntities: true,
      synchronize: true,
      retryAttempts: 5,
      retryDelay: 3000,
      extra: {
        max: 10,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        keepAlive: true,
      },
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      },
      settings: {
        stalledInterval: 300000,
        maxStalledCount: 10,
        lockDuration: 600000,
        lockRenewTime: 15000,
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
    TypeOrmModule.forFeature([Strategy, BacktestRun]),
    CandlesModule,
    IndicatorsModule,
    StrategiesModule,
    SettingsModule,
    AstEvaluatorModule,
  ],
  providers: [BacktestService, BacktestProcessor, BacktestProgressService, BacktestRunsService, OptimizerService],
})
export class WorkerModule {}
