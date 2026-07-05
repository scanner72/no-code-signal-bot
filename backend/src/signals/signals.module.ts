import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignalsEngineService } from './signals-engine.service';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';
import { Signal } from './signal.entity';
import { SignalsGateway } from './signals.gateway';
import { StrategiesModule } from '../strategies/strategies.module';
import { CandlesModule } from '../candles/candles.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { Strategy } from '../strategies/strategy.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { SettingsModule } from '../settings/settings.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { RiskManagerService } from '../risk/risk-manager.service';
import { MLModule } from '../ml/ml.module';
import { HermesModule } from '../hermes/hermes.module';
import { LdrModule } from '../ldr/ldr.module';
import { PaperTradingModule } from '../paper-trading/paper-trading.module';
import { KronosModule } from '../kronos/kronos.module';
import { OrderbookModule } from '../orderbook/orderbook.module';
import { OrdersModule } from '../orders/orders.module';
import { CrossExchangeModule } from '../cross-exchange/cross-exchange.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Signal, Strategy]),
    StrategiesModule,
    CandlesModule,
    IndicatorsModule,
    TelegramModule,
    SettingsModule,
    SentimentModule,
    HermesModule,
    forwardRef(() => MLModule),
    PaperTradingModule,
    LdrModule,
    KronosModule,
    OrderbookModule,
    OrdersModule,
    CrossExchangeModule,
    RiskModule,
  ],
  controllers: [SignalsController],
  providers: [SignalsService, SignalsEngineService, SignalsGateway, RiskManagerService],
  exports: [SignalsService, SignalsGateway, SignalsEngineService, RiskManagerService],
})
export class SignalsModule {}
