import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { CrossExchangeService, ExchangeId, ScannerFilter, ApiCredentials } from './cross-exchange.service';

@Controller('cross-exchange')
export class CrossExchangeController {
  constructor(private readonly crossExchangeService: CrossExchangeService) {}

  @Get('deltas')
  async getDeltas() {
    return this.crossExchangeService.getAllDeltas();
  }

  @Get('pair')
  async getPairDelta(@Query('pair') pair: string) {
    return this.crossExchangeService.getPriceDelta(pair);
  }

  @Get('snapshot')
  async getSnapshot(@Query('pair') pair: string) {
    return this.crossExchangeService.getExchangeSnapshot(pair || 'BTCUSDT');
  }

  @Get('exchanges')
  getSupportedExchanges() {
    return this.crossExchangeService.getSupportedExchanges();
  }

  @Get('data')
  getData(
    @Query('exchange') exchange: ExchangeId,
    @Query('pair') pair: string,
    @Query('type') dataType: string,
  ) {
    return {
      value: this.crossExchangeService.getData(exchange, pair || 'BTCUSDT', dataType as any),
      exchange, pair, dataType,
    };
  }

  @Get('delta-between')
  getDeltaBetween(
    @Query('a') exchangeA: ExchangeId,
    @Query('b') exchangeB: ExchangeId,
    @Query('pair') pair: string,
  ) {
    return this.crossExchangeService.getPriceDeltaBetween(
      exchangeA || 'binance',
      exchangeB || 'bybit',
      pair || 'BTCUSDT',
    );
  }

  /**
   * POST /cross-exchange/scan
   * Body: { exchange, filters, credentials? }
   * Scans all tickers from exchange and applies filters.
   */
  @Post('scan')
  async scanMarket(
    @Body() body: {
      exchange: ExchangeId;
      filters: ScannerFilter;
      credentials?: ApiCredentials;
    },
  ) {
    return this.crossExchangeService.scanMarket(
      body.exchange || 'binance',
      body.filters || {},
      body.credentials,
    );
  }

  /** GET convenience alias for scanner (no creds, simple filters via query params) */
  @Get('scan')
  async scanMarketGet(
    @Query('exchange') exchange: ExchangeId,
    @Query('quote') quote: string,
    @Query('minVol') minVol: string,
    @Query('minChange') minChange: string,
    @Query('maxChange') maxChange: string,
    @Query('limit') limit: string,
    @Query('sortBy') sortBy: string,
  ) {
    const filters: ScannerFilter = {
      quoteAsset:       quote     || 'USDT',
      minVolume24h:     minVol    ? Number(minVol)    : undefined,
      minChangePercent: minChange ? Number(minChange) : undefined,
      maxChangePercent: maxChange ? Number(maxChange) : undefined,
      limit:            limit     ? Number(limit)     : 50,
      sortBy:           (sortBy as any) || 'volume',
    };
    return this.crossExchangeService.scanMarket(exchange || 'binance', filters);
  }
}
