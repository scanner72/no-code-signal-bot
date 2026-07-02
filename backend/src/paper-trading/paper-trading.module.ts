import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VirtualTrade } from './virtual-trade.entity';
import { PaperTradingAccount } from './paper-trading-account.entity';
import { PaperTradingService } from './paper-trading.service';
import { PaperAccountsService } from './paper-accounts.service';
import { StrategiesModule } from '../strategies/strategies.module';
import { CandlesModule } from '../candles/candles.module';
import { PaperTradingController } from './paper-trading.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualTrade, PaperTradingAccount]),
    forwardRef(() => StrategiesModule),
    forwardRef(() => CandlesModule),
  ],
  controllers: [PaperTradingController],
  providers: [PaperTradingService, PaperAccountsService],
  exports: [PaperTradingService, PaperAccountsService],
})
export class PaperTradingModule {}
