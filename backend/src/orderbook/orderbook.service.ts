import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { BinanceApiService } from '../candles/binance-api.service';
import * as WebSocket from 'ws';

export interface OrderbookMetrics {
  mid: number;
  spread: number;
  imbalance: number;
  bids: { price: number; amount: number }[];
  asks: { price: number; amount: number }[];
  walls: { price: number; amount: number; side: 'BUY' | 'SELL' }[];
  timestamp: number;
}

@Injectable()
export class OrderbookService implements OnModuleDestroy {
  private readonly logger = new Logger(OrderbookService.name);
  
  private activeWs = new Map<string, WebSocket>();
  private realTimeMetrics = new Map<string, OrderbookMetrics>();

  constructor(private binanceApi: BinanceApiService) {}

  onModuleDestroy() {
    this.logger.log('Closing all active Orderbook WebSocket feeds...');
    for (const ws of this.activeWs.values()) {
      try {
        ws.close();
      } catch {}
    }
    this.activeWs.clear();
  }

  /**
   * Subscribes to the live Binance L2 depth stream (updates every 100ms)
   */
  subscribeToPair(pair: string) {
    const symbol = pair.replace('/', '').toUpperCase();
    if (this.activeWs.has(symbol)) {
      return;
    }

    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth20@100ms`;
    this.logger.log(`🔌 Connecting order book WebSocket for ${symbol}: ${wsUrl}`);
    
    try {
      const ws = new WebSocket(wsUrl);

      ws.on('message', (data: string) => {
        try {
          const frame = JSON.parse(data);
          if (!frame.bids || !frame.asks) return;

          const bids = frame.bids.map(([price, amount]) => ({
            price: parseFloat(price),
            amount: parseFloat(amount),
          }));
          
          const asks = frame.asks.map(([price, amount]) => ({
            price: parseFloat(price),
            amount: parseFloat(amount),
          }));

          const mid = (bids[0].price + asks[0].price) / 2;
          const spread = asks[0].price - bids[0].price;

          // Imbalance calculation (ratio of bids volume vs total volume in top 10 rows)
          const bidVol = bids.slice(0, 10).reduce((sum, b) => sum + b.amount, 0);
          const askVol = asks.slice(0, 10).reduce((sum, a) => sum + a.amount, 0);
          const imbalance = bidVol / (bidVol + askVol || 1);

          // Find walls (prices where volume is 3x the average volume of top 20 rows)
          const avgBidVol = bids.reduce((sum, b) => sum + b.amount, 0) / bids.length;
          const avgAskVol = asks.reduce((sum, a) => sum + a.amount, 0) / asks.length;

          const walls = [
            ...bids.filter(b => b.amount > avgBidVol * 3.5).map(b => ({ ...b, side: 'BUY' as const })),
            ...asks.filter(a => a.amount > avgAskVol * 3.5).map(a => ({ ...a, side: 'SELL' as const })),
          ];

          this.realTimeMetrics.set(symbol, {
            mid,
            spread,
            imbalance,
            bids,
            asks,
            walls,
            timestamp: Date.now(),
          });
        } catch (e) {
          this.logger.warn(`Failed to parse WebSocket message for ${symbol}: ${e.message}`);
        }
      });

      ws.on('error', (err) => {
        this.logger.error(`WebSocket error for ${symbol}: ${err.message}`);
      });

      ws.on('close', () => {
        this.logger.warn(`WebSocket closed for ${symbol}. Reconnecting in 5 seconds...`);
        this.activeWs.delete(symbol);
        setTimeout(() => this.subscribeToPair(pair), 5000);
      });

      this.activeWs.set(symbol, ws);
    } catch (err) {
      this.logger.error(`Failed to initialize WebSocket for ${symbol}: ${err.message}`);
    }
  }

  /**
   * Retrieves the real-time order book metrics.
   * If WebSocket cache is empty, falls back to fetching via Binance API REST snapshot.
   */
  async getCurrentMetrics(pair: string): Promise<OrderbookMetrics> {
    const symbol = pair.replace('/', '').toUpperCase();
    
    // Automatically trigger WS subscription if not present
    this.subscribeToPair(pair);

    const cached = this.realTimeMetrics.get(symbol);
    if (cached && Date.now() - cached.timestamp < 10000) {
      return cached;
    }

    // Fallback to REST
    this.logger.warn(`WS cache empty or stale for ${symbol}. Fetching REST fallback...`);
    const snapshot = await this.getDepthSnapshot(pair, 50);
    const bids = snapshot.bids;
    const asks = snapshot.asks;

    const mid = bids.length > 0 && asks.length > 0 ? (bids[0].price + asks[0].price) / 2 : 0;
    const spread = bids.length > 0 && asks.length > 0 ? asks[0].price - bids[0].price : 0;

    const bidVol = bids.slice(0, 10).reduce((sum, b) => sum + b.amount, 0);
    const askVol = asks.slice(0, 10).reduce((sum, a) => sum + a.amount, 0);
    const imbalance = bidVol / (bidVol + askVol || 1);

    const metrics = {
      mid,
      spread,
      imbalance,
      bids,
      asks,
      walls: snapshot.walls as any[],
      timestamp: Date.now(),
    };

    this.realTimeMetrics.set(symbol, metrics);
    return metrics;
  }

  async getDepthSnapshot(pair: string, limit: number = 500) {
    const ob = await this.binanceApi.fetchOrderbook(pair, limit);
    
    const bids = ob.bids.map(([price, amount]) => ({ price, amount }));
    const asks = ob.asks.map(([price, amount]) => ({ price, amount }));

    const avgBidVolume = bids.reduce((s, b) => s + b.amount, 0) / bids.length;
    const avgAskVolume = asks.reduce((s, a) => s + a.amount, 0) / asks.length;

    const walls = [
      ...bids.filter(b => b.amount > avgBidVolume * 3).map(b => ({ ...b, side: 'BUY' })),
      ...asks.filter(a => a.amount > avgAskVolume * 3).map(a => ({ ...a, side: 'SELL' })),
    ];

    return { bids, asks, walls };
  }

  async getLiquidityClusters(pair: string, rangePct: number = 2) {
    const ob = await this.binanceApi.fetchOrderbook(pair, 500);
    const markPrice = (ob.bids[0][0] + ob.asks[0][0]) / 2;

    const clusters: { price: number; volume: number; side: string }[] = [];
    const bucketSize = markPrice * 0.001;
    
    const process = (items: any[], side: string) => {
        const buckets: Record<number, number> = {};
        items.forEach(([price, amount]) => {
            const bucket = Math.floor(price / bucketSize) * bucketSize;
            buckets[bucket] = (buckets[bucket] || 0) + amount;
        });
        Object.entries(buckets).forEach(([p, v]) => {
            clusters.push({ price: parseFloat(p), volume: v, side });
        });
    };

    process(ob.bids, 'BUY');
    process(ob.asks, 'SELL');

    return clusters.sort((a, b) => b.volume - a.volume).slice(0, 20);
  }
}
