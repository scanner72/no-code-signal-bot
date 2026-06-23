import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as WebSocket from 'ws';
import { CandlesService } from './candles.service';
import { BinanceApiService } from './binance-api.service';
import { SettingsService } from '../settings/settings.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FuturesWebsocketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FuturesWebsocketService.name);
  private ws: WebSocket.WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 999999;
  private fallbackTimer: NodeJS.Timeout;
  private lastMessageTime = Date.now();
  private latestMetadata: Map<string, { markPrice: number; fundingRate: number }> = new Map();
  private recentLiquidations: Map<string, any[]> = new Map();
  private pairs: string[] = [];
  private readonly timeframes = ['1m', '5m', '15m', '1h'];

  constructor(
    private readonly candlesService: CandlesService,
    private readonly binanceApiService: BinanceApiService,
    private readonly settingsService: SettingsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.loadPairs();
    this.connect();
  }

  private async loadPairs() {
    const dbPairs = await this.settingsService.get('trading_pairs');
    this.pairs = (dbPairs || process.env.TRADING_PAIRS || 'BTCUSDT,ETHUSDT,SOLUSDT')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
  }

  @OnEvent('settings.updated')
  async handleSettingsUpdate(payload: { key: string; value: string }) {
    if (payload.key === 'trading_pairs') {
      await this.reload();
    }
  }

  async reload() {
    this.logger.log('Reloading trading pairs and resubscribing...');
    await this.loadPairs();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Unsubscribe from all is complex with Binance, simpler to just reconnect for now
      this.ws.close();
    }
  }

  onModuleDestroy() {
    if (this.ws) {
      this.ws.close();
    }
  }

  private connect() {
    this.logger.log('Connecting to Binance Futures WebSocket...');
    this.ws = new WebSocket.WebSocket('wss://fstream.binance.com/ws');

    this.ws.on('open', async () => {
      this.logger.log('WebSocket Connected');
      this.reconnectAttempts = 0;
      clearTimeout(this.fallbackTimer);
      
      // 1. Sync Gaps for all pairs/timeframes
      for (const pair of this.pairs) {
        for (const tf of this.timeframes) {
          await this.candlesService.syncGaps(pair, tf);
        }
        // Initial Mark Price sync
        const mp = await this.binanceApiService.fetchMarkPrice(pair);
        if (mp) {
          this.latestMetadata.set(pair.toLowerCase(), mp);
        }
      }

      this.subscribe();
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (e) {
        this.logger.error(`Error parsing message: ${e.message}`);
      }
    });

    this.ws.on('close', () => {
      this.logger.warn('WebSocket Closed. Reconnecting...');
      this.handleReconnect();
    });

    this.ws.on('ping', () => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.pong();
      }
    });

    this.ws.on('error', (err) => {
      this.logger.error(`WebSocket Error: ${err.message}`);
    });
  }

  private subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('WebSocket is not open. Skipping subscribe.');
      return;
    }
    const params = [];
    for (const pair of this.pairs) {
      const p = pair.toLowerCase();
      for (const tf of this.timeframes) {
        params.push(`${p}@kline_${tf}`);
      }
      params.push(`${p}@markPrice`);
      params.push(`${p}@forceOrder`);
    }

    const payload = {
      method: 'SUBSCRIBE',
      params,
      id: 1,
    };
    this.ws.send(JSON.stringify(payload));
  }

  private handleMessage(msg: any) {
    // Kline messages
    this.lastMessageTime = Date.now();
    if (msg.e === 'kline') {
      const { s: pair, k } = msg;
      const { t: time, o, h, l, c, v, V, x: isClosed, i: timeframe } = k;
      
      const metadata = this.latestMetadata.get(pair.toLowerCase());

      if (isClosed) {
        this.logger.debug(`Candle closed for ${pair} ${timeframe}`);
        this.candlesService.saveCandle({
          time: new Date(time),
          pair: pair.toUpperCase(),
          timeframe,
          open: parseFloat(o),
          high: parseFloat(h),
          low: parseFloat(l),
          close: parseFloat(c),
          volume: parseFloat(v),
          taker_buy_volume: parseFloat(V),
          mark_price: metadata?.markPrice,
          funding_rate: metadata?.fundingRate,
        });
      }
    }

    // Mark Price & Funding Rate messages
    if (msg.e === 'markPriceUpdate') {
      const { s: pair, p: markPrice, r: fundingRate } = msg;
      this.latestMetadata.set(pair.toLowerCase(), {
        markPrice: parseFloat(markPrice),
        fundingRate: parseFloat(fundingRate),
      });
    }
    
    // Liquidation messages
    if (msg.e === 'forceOrder') {
      const { s: pair, o: order } = msg;
      const { S: side, q: quantity, p: price, ap: avgPrice } = order;
      const amountUsd = parseFloat(avgPrice) * parseFloat(quantity);
      
      const pKey = pair.toLowerCase();
      if (!this.recentLiquidations.has(pKey)) this.recentLiquidations.set(pKey, []);
      const list = this.recentLiquidations.get(pKey);
      
      list.push({ side, amountUsd, time: Date.now() });
      
      // Keep only last 10 minutes of liquidations
      const tenMinsAgo = Date.now() - 10 * 60 * 1000;
      const filtered = list.filter(l => l.time > tenMinsAgo);
      this.recentLiquidations.set(pKey, filtered);
      
      if (amountUsd > 100000) {
        this.logger.debug(`Large liquidation on ${pair}: ${side} $${(amountUsd / 1e6).toFixed(2)}M`);
      }
      
      // Emit event for real-time UI/Engine
      this.eventEmitter.emit('liquidation.detected', {
        pair: pair.toUpperCase(),
        side,
        amountUsd,
        price: parseFloat(avgPrice),
        time: Date.now()
      });
    }
  }

  getRecentLiquidations(pair: string, windowMs: number = 60000) {
    const pKey = pair.toLowerCase();
    const list = this.recentLiquidations.get(pKey) || [];
    const cutoff = Date.now() - windowMs;
    return list.filter(l => l.time > cutoff);
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts++), 60000);
      setTimeout(() => this.connect(), delay);
      
      // Fallback timer if WS is down for 5 minutes
      if (!this.fallbackTimer && this.reconnectAttempts === 1) {
        this.fallbackTimer = setTimeout(() => {
          this.logger.error('WebSocket down for 5 minutes. Switching to REST fallback (TODO)');
          // Implement REST fallback here
        }, 5 * 60 * 1000);
      }
    } else {
      this.logger.error('Max reconnect attempts reached.');
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === (WebSocket as any).OPEN || (this.ws as any)?.readyState === 1;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async watchdog() {
    const now = Date.now();
    const diff = (now - this.lastMessageTime) / 1000;
    
    if (diff > 180) { // 3 minutes no data
      this.logger.warn(`WebSocket watchdog: No data for ${Math.round(diff)}s. Reconnecting...`);
      if (this.ws) {
        try { this.ws.terminate(); } catch (e) {}
      }
      this.connect();
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async backupSync() {
    this.logger.log('Running scheduled gap sync backup...');
    for (const pair of this.pairs) {
      for (const tf of this.timeframes) {
        await this.candlesService.syncGaps(pair, tf);
      }
    }
  }
}
