import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { VirtualTrade, TradeStatus } from './virtual-trade.entity';
import { BinanceApiService } from '../candles/binance-api.service';
import { Cron, CronExpression } from '@nestjs/schedule';

/** Parsed SL/TP settings extracted from strategy execution_settings */
interface SlTpSettings {
  tp: number | null;             // Fixed TP % (e.g. 2 = 2%)
  sl: number | null;             // Fixed SL % (e.g. 1 = 1%)
  useTrailing: boolean;          // Trailing stop enabled
  trailingDistance: number;      // % distance of stop from peak
  trailingActivation: number;    // % profit needed to activate trailing
  moveSLtoBE: boolean;           // Move SL to break-even after first partial TP
  partialTPs: Array<{            // Partial TP levels
    target: number;              // profit % threshold
    closePercent: number;        // % of remaining position to close
  }>;
}

/** Parse a percent string like "2%" or "1.5" into a number (e.g. 2.0) */
function parsePercent(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).replace('%', '').trim();
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

/** Extract sltp settings from strategy execution_settings or sltp AST node payload */
function extractSlTpSettings(settings: any): SlTpSettings {
  const cfg: SlTpSettings = {
    tp: parsePercent(settings?.tpPercent) ?? parsePercent(settings?.tp) ?? null,
    sl: parsePercent(settings?.slPercent) ?? parsePercent(settings?.sl) ?? null,
    useTrailing: settings?.useTrailing ?? settings?.useTrailingStop ?? false,
    trailingDistance: parsePercent(settings?.trailingDistance) ?? 1,
    trailingActivation: parsePercent(settings?.trailingActivation) ?? 0.5,
    moveSLtoBE: settings?.moveSLtoBE ?? false,
    partialTPs: [],
  };

  if (Array.isArray(settings?.partialTPs)) {
    cfg.partialTPs = settings.partialTPs
      .map((p: any) => ({
        target: parsePercent(p.target) ?? 0,
        closePercent: Number(p.closePercent) || 0,
      }))
      .filter((p: any) => p.target > 0 && p.closePercent > 0)
      .sort((a: any, b: any) => a.target - b.target);
  }

  return cfg;
}

@Injectable()
export class PaperTradingService {
  private readonly logger = new Logger(PaperTradingService.name);

  constructor(
    @InjectRepository(VirtualTrade)
    private virtualTradeRepository: Repository<VirtualTrade>,
    private binanceApiService: BinanceApiService,
  ) {}

  async openTrade(
    strategyId: number,
    pair: string,
    type: string,
    entryPrice: number,
    volume = 100,
    correlation = 0,
    riskMultiplier = 1.0,
    abVariant = 'NONE',
  ) {
    const existing = await this.virtualTradeRepository.findOne({
      where: { strategy_id: strategyId, status: TradeStatus.OPEN },
    });

    if (existing) {
      if (existing.type !== type) {
        await this.closeTrade(existing.id, entryPrice, 'OPPOSITE_SIGNAL');
      } else {
        return null; // same direction already open
      }
    }

    const trade = this.virtualTradeRepository.create({
      strategy_id: strategyId,
      pair,
      type,
      entry_price: entryPrice,
      highest_price: entryPrice,
      lowest_price: entryPrice,
      peak_price: entryPrice,
      stop_price: null,
      trailing_active: false,
      partial_tp_hits: 0,
      remaining_volume: volume,
      volume,
      correlation,
      risk_multiplier: riskMultiplier,
      ab_variant: abVariant,
      status: TradeStatus.OPEN,
    });

    return this.virtualTradeRepository.save(trade);
  }

  async closeTrade(id: number, exitPrice: number, reason: string) {
    const trade = await this.virtualTradeRepository.findOneBy({ id });
    if (!trade || trade.status !== TradeStatus.OPEN) return;

    const entry = Number(trade.entry_price);
    const exit = Number(exitPrice);

    trade.exit_price = exitPrice;
    trade.exit_reason = reason;
    trade.status = TradeStatus.CLOSED;
    trade.closed_at = new Date();
    trade.pnl_percent = trade.type === 'LONG'
      ? ((exit - entry) / entry) * 100
      : ((entry - exit) / entry) * 100;
    trade.pnl_value = (trade.pnl_percent / 100) * Number(trade.volume);

    await this.virtualTradeRepository.save(trade);
    this.logger.log(`[PaperTrade] Closed #${trade.id} (${reason}) PnL: ${trade.pnl_percent.toFixed(2)}%`);
  }

  /** Record a partial close — reduces remaining_volume */
  private async recordPartialClose(
    trade: VirtualTrade,
    closePct: number,
    _currentPrice: number,
    levelIdx: number,
  ) {
    const closeVolume = Number(trade.remaining_volume) * (closePct / 100);
    trade.remaining_volume = Number(trade.remaining_volume) - closeVolume;
    trade.partial_tp_hits = levelIdx + 1;
    this.logger.log(
      `[PaperTrade] Partial TP#${levelIdx + 1} for #${trade.id} — closed ${closePct}% ($${closeVolume.toFixed(2)}), remaining: $${Number(trade.remaining_volume).toFixed(2)}`,
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkOpenTrades() {
    // Account-сделки (paper_account_id != NULL) мониторит PaperAccountsService.checkAccountTrades
    const openTrades = await this.virtualTradeRepository.find({
      where: { status: TradeStatus.OPEN, paper_account_id: IsNull() },
      relations: ['strategy'],
    });

    if (openTrades.length === 0) return;

    try {
      const tickers = await this.binanceApiService.fetchTickers24h();

      for (const trade of openTrades) {
        const ticker = tickers[trade.pair];
        if (!ticker) continue;

        const currentPrice = Number(ticker.lastPrice);
        const entry = Number(trade.entry_price);

        // Update high/low water marks
        if (currentPrice > Number(trade.highest_price)) trade.highest_price = currentPrice;
        if (currentPrice < Number(trade.lowest_price))  trade.lowest_price  = currentPrice;

        const currentPnl = trade.type === 'LONG'
          ? ((currentPrice - entry) / entry) * 100
          : ((entry - currentPrice) / entry) * 100;

        trade.pnl_percent = currentPnl;

        const cfg = extractSlTpSettings(trade.strategy?.execution_settings || {});
        let closed = false;

        // ── 1. Trailing Stop ────────────────────────────────────────────────
        if (cfg.useTrailing) {
          const dist = cfg.trailingDistance / 100;
          const act  = cfg.trailingActivation / 100;

          if (trade.type === 'LONG') {
            if (currentPrice > Number(trade.peak_price)) trade.peak_price = currentPrice;
            if ((currentPrice - entry) / entry >= act)    trade.trailing_active = true;

            if (trade.trailing_active) {
              const newStop = Number(trade.peak_price) * (1 - dist);
              if (!trade.stop_price || newStop > Number(trade.stop_price)) trade.stop_price = newStop;
            }
            if (trade.stop_price && currentPrice <= Number(trade.stop_price)) {
              await this.virtualTradeRepository.save(trade);
              await this.closeTrade(trade.id, currentPrice, trade.trailing_active ? 'TRAILING' : 'SL');
              closed = true;
            }
          } else { // SHORT
            if (currentPrice < Number(trade.peak_price)) trade.peak_price = currentPrice;
            if ((entry - currentPrice) / entry >= act)    trade.trailing_active = true;

            if (trade.trailing_active) {
              const newStop = Number(trade.peak_price) * (1 + dist);
              if (!trade.stop_price || newStop < Number(trade.stop_price)) trade.stop_price = newStop;
            }
            if (trade.stop_price && currentPrice >= Number(trade.stop_price)) {
              await this.virtualTradeRepository.save(trade);
              await this.closeTrade(trade.id, currentPrice, trade.trailing_active ? 'TRAILING' : 'SL');
              closed = true;
            }
          }
        }
        if (closed) continue;

        // ── 2. Partial TP ──────────────────────────────────────────────────
        if (cfg.partialTPs.length > 0 && Number(trade.partial_tp_hits) < cfg.partialTPs.length) {
          const idx   = Number(trade.partial_tp_hits);
          const level = cfg.partialTPs[idx];

          if (currentPnl >= level.target) {
            await this.recordPartialClose(trade, level.closePercent, currentPrice, idx);

            // Break-even after first partial TP
            if (cfg.moveSLtoBE && idx === 0) {
              const beStop = entry;
              const improve = trade.type === 'LONG'
                ? !trade.stop_price || beStop > Number(trade.stop_price)
                : !trade.stop_price || beStop < Number(trade.stop_price);
              if (improve) {
                trade.stop_price = beStop;
                this.logger.log(`[PaperTrade] BE stop set at ${beStop} for #${trade.id}`);
              }
            }

            // All partial TPs hit → close remainder
            if (Number(trade.partial_tp_hits) >= cfg.partialTPs.length) {
              await this.virtualTradeRepository.save(trade);
              await this.closeTrade(trade.id, currentPrice, 'TP');
              closed = true;
            }
          }
        }
        if (closed) continue;

        // ── 3. Fixed SL / TP ───────────────────────────────────────────────
        // Effective SL: prefer dynamic stop_price when trailing is active, else fixed %
        const effectiveSL: number | null = trade.stop_price
          ? Math.abs(
              ((trade.type === 'LONG'
                ? Number(trade.stop_price) - entry
                : entry - Number(trade.stop_price)) / entry) * 100,
            )
          : cfg.sl;

        if (effectiveSL !== null && currentPnl <= -effectiveSL) {
          await this.virtualTradeRepository.save(trade);
          await this.closeTrade(trade.id, currentPrice, 'SL');
          continue;
        }

        if (cfg.tp !== null && cfg.partialTPs.length === 0 && currentPnl >= cfg.tp) {
          await this.virtualTradeRepository.save(trade);
          await this.closeTrade(trade.id, currentPrice, 'TP');
          continue;
        }

        await this.virtualTradeRepository.save(trade);
      }
    } catch (e) {
      this.logger.error(`checkOpenTrades error: ${(e as Error).message}`);
    }
  }

  async getHistory() {
    return this.virtualTradeRepository.find({ order: { opened_at: 'DESC' }, relations: ['strategy'] });
  }

  async getRecentClosedTrades(limit: number) {
    return this.virtualTradeRepository.find({
      where: { status: TradeStatus.CLOSED },
      order: { closed_at: 'DESC' },
      take: limit,
      relations: ['strategy'],
    });
  }

  async getTrade(id: number) {
    return this.virtualTradeRepository.findOneBy({ id });
  }

  async manualClose(id: number) {
    const trade = await this.getTrade(id);
    if (!trade || trade.status !== TradeStatus.OPEN) return;
    try {
      const tickers = await this.binanceApiService.fetchTickers24h();
      const ticker = tickers[trade.pair];
      const price = ticker ? Number(ticker.lastPrice) : Number(trade.entry_price);
      await this.closeTrade(id, price, 'MANUAL');
    } catch {
      await this.closeTrade(id, Number(trade.entry_price), 'MANUAL');
    }
  }

  async getWinRatesByStrategy(): Promise<Record<number, { winRate: number; totalTrades: number; wins: number; totalPnl: number }>> {
    const trades = await this.virtualTradeRepository.find({
      where: { status: TradeStatus.CLOSED },
      select: ['strategy_id', 'pnl_percent'],
    });

    const map: Record<number, { wins: number; total: number; pnl: number }> = {};
    for (const t of trades) {
      if (!map[t.strategy_id]) map[t.strategy_id] = { wins: 0, total: 0, pnl: 0 };
      map[t.strategy_id].total++;
      map[t.strategy_id].pnl += Number(t.pnl_percent);
      if (Number(t.pnl_percent) > 0) map[t.strategy_id].wins++;
    }

    const result: Record<number, { winRate: number; totalTrades: number; wins: number; totalPnl: number }> = {};
    for (const [sid, v] of Object.entries(map)) {
      result[Number(sid)] = {
        winRate: v.total > 0 ? Math.round((v.wins / v.total) * 100) : 0,
        totalTrades: v.total,
        wins: v.wins,
        totalPnl: Math.round(v.pnl * 100) / 100,
      };
    }
    return result;
  }

  async getEquityCurve(daysCount = 30) {
    const trades = await this.virtualTradeRepository.find({
      where: { status: TradeStatus.CLOSED },
      order: { closed_at: 'ASC' },
    });

    const now = new Date();
    return Array.from({ length: daysCount }, (_, i) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - (daysCount - 1 - i));
      d.setUTCHours(23, 59, 59, 999);
      const slice = trades.filter(t => t.closed_at && new Date(t.closed_at).getTime() <= d.getTime());
      return {
        date: d.toISOString().split('T')[0],
        pnl: Math.round(slice.reduce((s, t) => s + Number(t.pnl_percent), 0) * 100) / 100,
        tradesCount: slice.length,
      };
    });
  }
}
