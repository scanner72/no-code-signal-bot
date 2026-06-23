import { Injectable, Logger } from '@nestjs/common';
import * as ccxt from 'ccxt';
import { Cron, CronExpression } from '@nestjs/schedule';

export type ExchangeId = 'binance' | 'bybit' | 'okx' | 'kraken' | 'coinbase' | 'htx' | 'mexc';
export type DataType = 'price' | 'volume' | 'funding_rate' | 'open_interest' | 'bid_ask_spread' | 'price_delta' | 'ohlcv';

export interface ApiCredentials {
  apiKey?: string;
  secret?: string;
}

export interface ScannerFilter {
  minVolume24h?: number;       // min quote volume in USDT
  maxVolume24h?: number;
  minPrice?: number;
  maxPrice?: number;
  minChangePercent?: number;   // 24h price change %
  maxChangePercent?: number;
  quoteAsset?: string;         // e.g. 'USDT', 'BTC', 'USD'
  limit?: number;              // max symbols to return
  sortBy?: 'volume' | 'change' | 'price';
  sortDir?: 'asc' | 'desc';
  symbols?: string;            // comma-separated list of pairs like 'BTCUSDT, ETHUSDT'
}

export interface ScannerResult {
  symbol: string;
  price: number;
  volume24h: number;
  changePercent: number;
  exchange: ExchangeId;
}

export interface ExchangeSnapshot {
  price?: number;
  volume?: number;
  fundingRate?: number;
  openInterest?: number;
  bidAskSpread?: number;
  changePercent?: number;
  updatedAt: Date;
}

@Injectable()
export class CrossExchangeService {
  private readonly logger = new Logger(CrossExchangeService.name);
  private exchanges: Partial<Record<ExchangeId, ccxt.Exchange>> = {};
  private snapshots: Record<string, Partial<Record<ExchangeId, ExchangeSnapshot>>> = {};

  // Per-exchange credentialled instances (created on demand)
  private authedExchanges: Map<string, ccxt.Exchange> = new Map();

  // Legacy price store for backwards-compatibility
  private priceData: Record<string, Record<string, number>> = {};

  constructor() {
    this.exchanges = {
      binance:  new ccxt.binance({ enableRateLimit: true }),
      bybit:    new ccxt.bybit({ enableRateLimit: true }),
      okx:      new ccxt.okx({ enableRateLimit: true }),
      kraken:   new ccxt.kraken({ enableRateLimit: true }),
      coinbase: new ccxt.coinbase({ enableRateLimit: true }),
      htx:      new ccxt.huobi({ enableRateLimit: true }),
      mexc:     new ccxt.mexc({ enableRateLimit: true }),
    };
  }

  // ─────────────────────────── Ticker Polling ───────────────────────────── //

  @Cron(CronExpression.EVERY_10_SECONDS)
  async updateAllData() {
    const PAIRS: Partial<Record<ExchangeId, string[]>> = {
      binance:  ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      bybit:    ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      okx:      ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      kraken:   ['BTC/USD',  'ETH/USD'],
      coinbase: ['BTC/USD',  'ETH/USD'],
      htx:      ['BTC/USDT', 'ETH/USDT'],
      mexc:     ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    };

    for (const [exchangeId, pairs] of Object.entries(PAIRS) as [ExchangeId, string[]][]) {
      const ex = this.exchanges[exchangeId];
      if (!ex) continue;

      for (const pair of pairs) {
        const key = pair.replace('/', '');
        if (!this.snapshots[key]) this.snapshots[key] = {};

        try {
          const ticker = await ex.fetchTicker(pair);
          this.snapshots[key][exchangeId] = {
            price:         ticker.last   ?? ticker.close ?? undefined,
            volume:        ticker.quoteVolume ?? ticker.baseVolume ?? undefined,
            bidAskSpread:  (ticker.ask && ticker.bid) ? ticker.ask - ticker.bid : undefined,
            changePercent: ticker.percentage ?? undefined,
            updatedAt:     new Date(),
          };
          if (!this.priceData[key]) this.priceData[key] = {};
          if (ticker.last) this.priceData[key][exchangeId] = ticker.last;
        } catch {
          // silent — rate limits / network errors
        }
      }
    }
  }

  @Cron('*/30 * * * * *')
  async updateFundingRates() {
    const FUTURES: Partial<Record<ExchangeId, string[]>> = {
      binance: ['BTC/USDT:USDT', 'ETH/USDT:USDT'],
      bybit:   ['BTC/USDT:USDT', 'ETH/USDT:USDT'],
      okx:     ['BTC-USDT-SWAP', 'ETH-USDT-SWAP'],
      mexc:    ['BTC/USDT:USDT', 'ETH/USDT:USDT'],
    };

    for (const [exchangeId, symbols] of Object.entries(FUTURES) as [ExchangeId, string[]][]) {
      const ex = this.exchanges[exchangeId];
      if (!ex || typeof (ex as any).fetchFundingRate !== 'function') continue;

      for (const symbol of symbols) {
        const key = symbol.split('/')[0].replace(/[^A-Z]/g, '') + 'USDT';
        if (!this.snapshots[key]) this.snapshots[key] = {};
        if (!this.snapshots[key][exchangeId]) {
          this.snapshots[key][exchangeId] = { updatedAt: new Date() };
        }
        try {
          const fr = await (ex as any).fetchFundingRate(symbol);
          this.snapshots[key][exchangeId]!.fundingRate = fr?.fundingRate ?? undefined;
        } catch { /* silent */ }
      }
    }
  }

  // ─────────────────────────── API Key Support ──────────────────────────── //

  /**
   * Returns a credentialled exchange instance (or falls back to public).
   * Instances are cached by exchange+apiKey to avoid re-creating on every call.
   */
  public getExchange(exchangeId: ExchangeId, creds?: ApiCredentials): ccxt.Exchange {
    if (!creds?.apiKey) {
      return this.exchanges[exchangeId]!;
    }

    const cacheKey = `${exchangeId}:${creds.apiKey}`;
    if (!this.authedExchanges.has(cacheKey)) {
      const ExchangeClass = (ccxt as any)[exchangeId === 'htx' ? 'huobi' : exchangeId];
      if (!ExchangeClass) return this.exchanges[exchangeId]!;
      const inst: ccxt.Exchange = new ExchangeClass({
        apiKey: creds.apiKey,
        secret: creds.secret,
        enableRateLimit: true,
      });
      this.authedExchanges.set(cacheKey, inst);
    }
    return this.authedExchanges.get(cacheKey)!;
  }

  // ─────────────────────────── Public API ───────────────────────────────── //

  getData(exchange: ExchangeId, pair: string, dataType: DataType): number | null {
    const key = pair.replace('/', '');
    const snap = this.snapshots[key]?.[exchange];
    if (!snap) return null;

    switch (dataType) {
      case 'price':          return snap.price         ?? null;
      case 'volume':         return snap.volume        ?? null;
      case 'funding_rate':   return snap.fundingRate   ?? null;
      case 'open_interest':  return snap.openInterest  ?? null;
      case 'bid_ask_spread': return snap.bidAskSpread  ?? null;
      case 'price_delta':    return null;
      default:               return null;
    }
  }

  getPriceDeltaBetween(
    exchangeA: ExchangeId,
    exchangeB: ExchangeId,
    pair: string,
  ): { deltaPercent: number; priceA: number; priceB: number; pair: string; updatedAt: Date } | null {
    const key = pair.replace('/', '');
    const priceA = this.snapshots[key]?.[exchangeA]?.price;
    const priceB = this.snapshots[key]?.[exchangeB]?.price;
    if (!priceA || !priceB) return null;
    return {
      deltaPercent: ((priceB - priceA) / priceA) * 100,
      priceA, priceB, pair: key,
      updatedAt: new Date(),
    };
  }

  getExchangeSnapshot(pair: string): Record<ExchangeId, ExchangeSnapshot | undefined> {
    const key = pair.replace('/', '');
    return (this.snapshots[key] || {}) as any;
  }

  getSupportedExchanges(): { id: ExchangeId; name: string; pairs: string[]; hasApiSupport: boolean }[] {
    return [
      { id: 'binance',  name: 'Binance',  pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], hasApiSupport: true },
      { id: 'bybit',    name: 'Bybit',    pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], hasApiSupport: true },
      { id: 'okx',      name: 'OKX',      pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], hasApiSupport: true },
      { id: 'kraken',   name: 'Kraken',   pairs: ['BTCUSD',  'ETHUSD'],              hasApiSupport: true },
      { id: 'coinbase', name: 'Coinbase', pairs: ['BTCUSD',  'ETHUSD'],              hasApiSupport: true },
      { id: 'htx',      name: 'HTX',      pairs: ['BTCUSDT', 'ETHUSDT'],             hasApiSupport: true },
      { id: 'mexc',     name: 'MEXC',     pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], hasApiSupport: true },
    ];
  }

  // ─────────────────────────── Scanner API ──────────────────────────────── //

  /**
   * Scan all tickers from an exchange and apply filters.
   * Works with or without API credentials.
   */
  async scanMarket(
    exchangeId: ExchangeId,
    filters: ScannerFilter,
    creds?: ApiCredentials,
  ): Promise<ScannerResult[]> {
    const ex = this.getExchange(exchangeId, creds);
    const quote = filters.quoteAsset?.toUpperCase() || 'USDT';
    const limit  = Math.min(filters.limit ?? 50, 200);
    const allowedSymbols = filters.symbols 
      ? filters.symbols.split(',').map(s => s.trim().toUpperCase().replace('/', ''))
      : null;

    let tickers: Record<string, ccxt.Ticker>;
    try {
      tickers = await ex.fetchTickers();
    } catch (e) {
      this.logger.warn(`fetchTickers failed for ${exchangeId}: ${(e as Error).message}`);
      return [];
    }

    let results: ScannerResult[] = Object.entries(tickers)
      .filter(([symbol, t]) => {
        if (!symbol.endsWith('/' + quote)) return false;
        if (!t.last || t.last <= 0) return false;
        
        if (allowedSymbols && !allowedSymbols.includes(symbol.replace('/', ''))) return false;

        const vol = t.quoteVolume ?? (t.baseVolume && t.last ? t.baseVolume * t.last : 0);
        const chg = t.percentage ?? 0;

        if (filters.minVolume24h && vol < filters.minVolume24h) return false;
        if (filters.maxVolume24h && vol > filters.maxVolume24h) return false;
        if (filters.minPrice     && t.last < filters.minPrice)  return false;
        if (filters.maxPrice     && t.last > filters.maxPrice)  return false;
        if (filters.minChangePercent !== undefined && chg < filters.minChangePercent) return false;
        if (filters.maxChangePercent !== undefined && chg > filters.maxChangePercent) return false;

        return true;
      })
      .map(([symbol, t]) => ({
        symbol,
        price:         t.last!,
        volume24h:     t.quoteVolume ?? 0,
        changePercent: t.percentage ?? 0,
        exchange:      exchangeId,
      }));

    // Sort
    const sortBy = filters.sortBy || 'volume';
    const sortDir = filters.sortDir || 'desc';
    results.sort((a, b) => {
      const va = sortBy === 'volume' ? a.volume24h : sortBy === 'change' ? a.changePercent : a.price;
      const vb = sortBy === 'volume' ? b.volume24h : sortBy === 'change' ? b.changePercent : b.price;
      return sortDir === 'desc' ? vb - va : va - vb;
    });

    return results.slice(0, limit);
  }

  // ─────────────────── Legacy (backwards-compat) ───────────────────────── //

  getPriceDelta(pair: string) {
    const data = this.priceData[pair];
    if (!data || Object.keys(data).length < 2) return null;
    const binancePrice = data['binance'];
    if (!binancePrice) return null;
    const deltas: Record<string, number> = {};
    for (const [ex, price] of Object.entries(data)) {
      if (ex === 'binance') continue;
      deltas[ex] = ((price - binancePrice) / binancePrice) * 100;
    }
    return { pair, binancePrice, deltas, updatedAt: new Date() };
  }

  getAllDeltas() {
    return Object.keys(this.priceData).map(p => this.getPriceDelta(p)).filter(d => d !== null);
  }
}
