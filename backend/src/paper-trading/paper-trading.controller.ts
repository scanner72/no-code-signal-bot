import { Controller, Get, Post, Param, Query, NotFoundException } from '@nestjs/common';
import { PaperTradingService } from './paper-trading.service';
import { PaperAccountsService } from './paper-accounts.service';

@Controller('paper-trading')
export class PaperTradingController {
  constructor(
    private readonly paperTradingService: PaperTradingService,
    private readonly paperAccountsService: PaperAccountsService,
  ) {}

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

  // ── Per-node paper accounts ────────────────────────────────────────────

  @Get('accounts')
  getAccounts(@Query('strategyId') strategyId?: string) {
    return this.paperAccountsService.getAccountsWithStats(
      strategyId ? parseInt(strategyId, 10) : undefined,
    );
  }

  /** Наложенные equity curves + сводные метрики для сравнения конфигов */
  @Get('compare')
  compare(@Query('ids') ids: string) {
    const parsed = (ids || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    return this.paperAccountsService.compareAccounts(parsed);
  }

  @Get('accounts/:id')
  getAccount(@Param('id') id: string) {
    return this.paperAccountsService.getAccountDetail(parseInt(id, 10));
  }

  @Post('accounts/:id/reset')
  resetAccount(@Param('id') id: string) {
    return this.paperAccountsService.resetAccount(parseInt(id, 10));
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
