import { Controller, Get, Post, Param, NotFoundException } from '@nestjs/common';
import { PaperTradingService } from './paper-trading.service';

@Controller('paper-trading')
export class PaperTradingController {
  constructor(private readonly paperTradingService: PaperTradingService) {}

  @Get('history')
  getHistory() {
    return this.paperTradingService.getHistory();
  }

  /** Per-strategy win rates for all strategies with at least one closed trade */
  @Get('winrates')
  getWinRates() {
    return this.paperTradingService.getWinRatesByStrategy();
  }

  /** Cumulative PnL curve for the last 30 days */
  @Get('equity-curve')
  getEquityCurve() {
    return this.paperTradingService.getEquityCurve();
  }

  @Post('close/:id')
  async close(@Param('id') id: string) {
    const tradeId = parseInt(id, 10);
    const trade = await this.paperTradingService.getTrade(tradeId);
    if (!trade) throw new NotFoundException('Virtual trade not found');

    await this.paperTradingService.manualClose(tradeId);
    return { success: true };
  }
}

