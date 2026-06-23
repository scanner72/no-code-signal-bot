import { Controller, Get, Param, Query } from '@nestjs/common';
import { CandlesService } from './candles.service';
import { BinanceApiService } from './binance-api.service';
import { SettingsService } from '../settings/settings.service';

@Controller('candles')
export class CandlesController {
  constructor(
    private readonly candlesService: CandlesService,
    private readonly binanceApi: BinanceApiService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('tracked')
  async getTrackedSymbols() {
    const dbPairs = await this.settingsService.get('trading_pairs');
    return (dbPairs || process.env.TRADING_PAIRS || 'BTCUSDT,ETHUSDT,SOLUSDT')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
  }

  @Get('symbols')
  getSymbols(@Query('q') q?: string) {
    return this.binanceApi.getSymbols(q);
  }

  @Get('latest/:pair/:timeframe')
  async getLatest(
    @Param('pair') pair: string,
    @Param('timeframe') timeframe: string,
    @Query('limit') limit?: number,
    @Query('compact') compact?: string,
  ) {
    // Force sync gaps from Binance so the dashboard has continuous TradingView-like data
    await this.candlesService.syncGaps(pair, timeframe);

    return this.candlesService.getLatestCandles(
      pair, 
      timeframe, 
      limit ? Number(limit) : 100,
      compact === 'true' || compact === '1'
    );
  }

  @Get()
  async getCandles(
    @Query('pair') pair: string,
    @Query('timeframe') timeframe: string,
    @Query('limit') limit?: number,
    @Query('compact') compact?: string,
  ) {
    if (!pair || !timeframe) {
      return { error: 'Pair and timeframe are required' };
    }
    return this.candlesService.getLatestCandles(
      pair, 
      timeframe, 
      limit ? Number(limit) : 100,
      compact === 'true' || compact === '1'
    );
  }
}
