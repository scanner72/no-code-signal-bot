import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as ccxt from 'ccxt';

@Injectable()
export class BinanceApiService implements OnModuleInit {
  private readonly logger = new Logger(BinanceApiService.name);
  private client: ccxt.binance;

  onModuleInit() {
    this.client = new ccxt.binance({
      options: {
        defaultType: 'future',
      },
    });
    this.logger.log('Binance REST API Client (CCXT) initialized');
  }

  async fetchCandles(pair: string, timeframe: string, since?: number, limit?: number) {
    const symbol = pair.replace('/', '').toUpperCase();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        this.logger.debug(`Fetching candles for ${pair} ${timeframe} via REST...`);
        const raw = await this.client.fapiPublicGetKlines({
          symbol,
          interval: timeframe,
          startTime: since,
          limit: limit || 1000
        });

        return raw.map((c: any) => ({
          time: new Date(parseInt(c[0])),
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
          volume: parseFloat(c[5]),
          taker_buy_volume: parseFloat(c[9]),
        }));
      } catch (error) {
        this.logger.warn(`Binance REST attempt ${attempt + 1}/3 failed for ${pair} ${timeframe}: ${error.message}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    this.logger.error(`Binance REST: all 3 attempts failed for ${pair} ${timeframe}`);
    return [];
  }

  async fetchTicker(pair: string) {
    try {
      const symbol = pair.replace('/', '').toUpperCase();
      // Premium Index gives Mark Price and Funding Rate
      const premium = await this.client.fapiPublicGetPremiumIndex({ symbol });
      
      // Open Interest requires a separate call
      let openInterest = 0;
      try {
          const oi = await this.client.fapiPublicGetOpenInterest({ symbol });
          openInterest = parseFloat(oi.openInterest);
      } catch (e) {
          // Some symbols might not have OI data available via this endpoint
      }

      return {
        markPrice: parseFloat(premium.markPrice),
        lastFundingRate: parseFloat(premium.lastFundingRate),
        openInterest: openInterest
      };
    } catch (error) {
      this.logger.error(`Error fetching Ticker for ${pair}: ${error.message}`);
      return { markPrice: 0, lastFundingRate: 0, openInterest: 0 };
    }
  }

  async fetchMarkPrice(pair: string) {
    const data = await this.fetchTicker(pair);
    return {
      markPrice: data.markPrice,
      fundingRate: data.lastFundingRate
    };
  }

  async fetchTickers24h() {
    try {
      this.logger.debug('Fetching 24h tickers for all symbols...');
      const raw = await this.client.fapiPublicGetTicker24hr();
      const tickers: Record<string, any> = {};
      
      // We expect an array or a single object. fapi returns array for all symbols.
      if (Array.isArray(raw)) {
        raw.forEach(t => {
          tickers[t.symbol] = {
            symbol: t.symbol,
            priceChangePercent: parseFloat(t.priceChangePercent),
            volume: parseFloat(t.quoteVolume), // Using USDT volume (quote volume)
            high: parseFloat(t.highPrice),
            low: parseFloat(t.lowPrice),
            lastPrice: parseFloat(t.lastPrice)
          };
        });
      }
      return tickers;
    } catch (error) {
      this.logger.error(`Error fetching 24h tickers: ${error.message}`);
      return {};
    }
  }

  private symbolsCache: string[] = [];
  private symbolsCachedAt = 0;
  private readonly SYMBOLS_TTL_MS = 60 * 60 * 1000; // 1 hour

  async getSymbols(query?: string): Promise<string[]> {
    const virtualSymbols = [
      'BINANCE_TOP20',
      'BINANCE_TOP50',
      'BYBIT_TOP20',
      'BYBIT_TOP50',
      'OKX_TOP20',
      'OKX_TOP50',
    ];

    try {
      const now = Date.now();
      if (this.symbolsCache.length === 0 || now - this.symbolsCachedAt > this.SYMBOLS_TTL_MS) {
        const markets = await this.client.fetchMarkets();
        this.symbolsCache = markets
          .filter(m => m.active && m.swap && m.linear && m.settle === 'USDT')
          .map(m => m.id); // USDT-margined perpetuals only (no COIN-m, no quarterly)
        this.symbolsCachedAt = now;
        this.logger.log(`Symbols cache refreshed: ${this.symbolsCache.length} pairs`);
      }

      const q = query ? query.toUpperCase() : '';
      const matchedVirtuals = virtualSymbols.filter(v => !q || v.includes(q));
      
      if (!query) {
        return [...matchedVirtuals, ...this.symbolsCache];
      }
      
      const matchedReal = this.symbolsCache.filter(s => s.includes(q));
      return [...matchedVirtuals, ...matchedReal].slice(0, 50);
    } catch (error) {
      this.logger.error(`Error fetching market symbols: ${error.message}`);
      const q = query ? query.toUpperCase() : '';
      return virtualSymbols.filter(v => !q || v.includes(q));
    }
  }

  async fetchOrderbook(pair: string, limit: number = 20) {
    try {
      // CCXT fetchOrderBook for Binance Futures
      const symbol = pair.includes('/') ? pair : pair.replace('USDT', '/USDT');
      return await this.client.fetchOrderBook(symbol, limit);
    } catch (error) {
      this.logger.error(`Error fetching Orderbook for ${pair}: ${error.message}`);
      return { bids: [], asks: [] };
    }
  }
}
