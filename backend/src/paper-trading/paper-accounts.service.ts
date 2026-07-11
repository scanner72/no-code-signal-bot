import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaperTradingAccount } from './paper-trading-account.entity';
import { VirtualTrade, TradeStatus } from './virtual-trade.entity';
import { BinanceApiService } from '../candles/binance-api.service';

/** data-поле ноды paper_trading_output на канвасе */
interface PaperNodeData {
  label?: string;
  startingCapital?: number | string;
  leverage?: number | string;
  riskPercent?: number | string;
  sl?: string | number;
  tp?: string | number;
  useTrailing?: boolean;
  trailingDistance?: string | number;
  trailingActivation?: string | number;
  moveSLtoBE?: boolean;
  partialTPs?: Array<{ target: any; closePercent: any }>;
  dcaRebuy?: { levels?: Array<{ triggerPercent: any; sizeMultiplier: any }> };
}

/** "1.5%" | 1.5 → 1.5; пусто → null */
function parsePercent(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace('%', '').trim());
  return isNaN(n) ? null : n;
}

/** Положительное конечное число, иначе дефолт (0/NaN/отрицательные — не валидный капитал/плечо/риск) */
function positiveOr(val: any, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

@Injectable()
export class PaperAccountsService {
  private readonly logger = new Logger(PaperAccountsService.name);

  constructor(
    @InjectRepository(PaperTradingAccount)
    private accountRepository: Repository<PaperTradingAccount>,
    @InjectRepository(VirtualTrade)
    private virtualTradeRepository: Repository<VirtualTrade>,
    private binanceApiService: BinanceApiService,
  ) {}

  /**
   * Синхронизирует paper_trading_output-ноды стратегии с аккаунтами.
   * Существующим аккаунтам обновляется только конфиг — баланс и история не трогаются.
   */
  async syncPaperAccounts(strategy: { id: number; nodes: any[] }): Promise<void> {
    const nodes: any[] = Array.isArray(strategy.nodes) ? strategy.nodes : [];
    const paperNodes = nodes.filter((n) => n.type === 'paper_trading_output');
    const existing = await this.accountRepository.find({ where: { strategy_id: strategy.id } });
    const byNodeId = new Map(existing.map((a) => [a.node_id, a]));

    for (const node of paperNodes) {
      const d: PaperNodeData = node.data || {};
      const cfg = {
        label: d.label || 'Config',
        starting_capital: positiveOr(d.startingCapital, 1000),
        leverage: positiveOr(d.leverage, 1),
        risk_percent: positiveOr(d.riskPercent, 10),
        sl_percent: parsePercent(d.sl),
        tp_percent: parsePercent(d.tp),
        use_trailing: !!d.useTrailing,
        trailing_distance: parsePercent(d.trailingDistance) ?? 1,
        trailing_activation: parsePercent(d.trailingActivation) ?? 0.5,
        move_sl_to_be: !!d.moveSLtoBE,
        partial_tps: Array.isArray(d.partialTPs)
          ? d.partialTPs
              .map((p) => ({ target: parsePercent(p.target) ?? 0, closePercent: Number(p.closePercent) || 0 }))
              .filter((p) => p.target > 0 && p.closePercent > 0)
              .sort((a, b) => a.target - b.target)
          : [],
        dca_rebuy_levels: Array.isArray(d.dcaRebuy?.levels)
          ? d.dcaRebuy.levels
              .map((l) => ({ triggerPercent: parsePercent(l.triggerPercent) ?? 0, sizeMultiplier: Number(l.sizeMultiplier) || 0 }))
              .filter((l) => l.triggerPercent > 0 && l.sizeMultiplier > 0)
              .sort((a, b) => a.triggerPercent - b.triggerPercent)
          : [],
      };

      const found = byNodeId.get(node.id);
      if (found) {
        Object.assign(found, cfg, { is_active: true });
        await this.accountRepository.save(found);
      } else {
        await this.accountRepository.save(
          this.accountRepository.create({
            strategy_id: strategy.id,
            node_id: node.id,
            current_balance: cfg.starting_capital,
            is_active: true,
            ...cfg,
          }),
        );
      }
    }

    // Мягкое удаление аккаунтов, чьих нод больше нет на канвасе
    const liveIds = new Set(paperNodes.map((n) => n.id));
    for (const acc of existing) {
      if (!liveIds.has(acc.node_id) && acc.is_active) {
        acc.is_active = false;
        await this.accountRepository.save(acc);
      }
    }
  }

  async getActiveAccounts(strategyId: number, nodeIds: string[]): Promise<PaperTradingAccount[]> {
    if (!nodeIds.length) return [];
    return this.accountRepository.find({
      where: { strategy_id: strategyId, node_id: In(nodeIds), is_active: true },
    });
  }

  /**
   * Открывает виртуальную сделку на аккаунте.
   * Маржа = current_balance × risk_percent / 100 (компаундинг), списывается с баланса.
   * Портфель: по одной открытой позиции на пару; противоположный сигнал закрывает текущую.
   */
  async openAccountTrade(
    account: PaperTradingAccount,
    pair: string,
    type: string,
    entryPrice: number,
  ): Promise<VirtualTrade | null> {
    const existing = await this.virtualTradeRepository.findOne({
      where: { paper_account_id: account.id, pair, status: TradeStatus.OPEN },
    });

    if (existing) {
      if (existing.type !== type) {
        await this.closeAccountTrade(existing.id, entryPrice, 'OPPOSITE_SIGNAL');
      } else {
        return null; // позиция того же направления уже открыта
      }
    }

    // Перечитываем баланс: closeAccountTrade выше мог его изменить
    const fresh = await this.accountRepository.findOneByOrFail({ id: account.id });
    const margin = (Number(fresh.current_balance) * Number(fresh.risk_percent)) / 100;
    if (margin <= 0 || margin > Number(fresh.current_balance)) {
      fresh.skipped_signals = Number(fresh.skipped_signals || 0) + 1;
      await this.accountRepository.save(fresh);
      this.logger.warn(`[PaperAccount #${fresh.id}] Skipped ${type} ${pair}: insufficient balance (${fresh.current_balance})`);
      return null;
    }

    fresh.current_balance = Number(fresh.current_balance) - margin;
    await this.accountRepository.save(fresh);

    const trade = this.virtualTradeRepository.create({
      strategy_id: fresh.strategy_id,
      paper_account_id: fresh.id,
      pair,
      type,
      entry_price: entryPrice,
      highest_price: entryPrice,
      lowest_price: entryPrice,
      peak_price: entryPrice,
      stop_price: null,
      trailing_active: false,
      partial_tp_hits: 0,
      dca_hits: 0,
      volume: margin,
      remaining_volume: margin,
      margin_used: margin,
      leverage_used: Number(fresh.leverage) || 1,
      status: TradeStatus.OPEN,
    });
    return this.virtualTradeRepository.save(trade);
  }

  /**
   * Закрывает account-сделку. PnL на маржу = price% × плечо, капится на -100% (ликвидация).
   * Возвращает (оставшуюся) маржу + PnL на баланс аккаунта.
   */
  async closeAccountTrade(id: number, exitPrice: number, reason: string): Promise<void> {
    const trade = await this.virtualTradeRepository.findOneBy({ id });
    if (!trade || trade.status !== TradeStatus.OPEN || !trade.paper_account_id) return;

    // Атомарный claim — только один из конкурентных вызовов может закрыть эту сделку
    const claim = await this.virtualTradeRepository.update(
      { id, status: TradeStatus.OPEN },
      { status: TradeStatus.CLOSED },
    );
    if (!claim.affected) return;

    const entry = Number(trade.entry_price);
    const lev = Number(trade.leverage_used) || 1;
    const margin = Number(trade.remaining_volume ?? trade.margin_used);

    const pricePnl = trade.type === 'LONG'
      ? ((exitPrice - entry) / entry) * 100
      : ((entry - exitPrice) / entry) * 100;

    let marginPnlPct = pricePnl * lev;
    if (marginPnlPct < -100 || reason === 'LIQUIDATION') marginPnlPct = -100;

    const pnlValue = (margin * marginPnlPct) / 100;

    trade.exit_price = exitPrice;
    trade.exit_reason = marginPnlPct === -100 ? 'LIQUIDATION' : reason;
    trade.status = TradeStatus.CLOSED;
    trade.closed_at = new Date();
    trade.pnl_value = Number(trade.pnl_value || 0) + pnlValue;
    trade.pnl_percent = Number(trade.margin_used) > 0
      ? (Number(trade.pnl_value) / Number(trade.margin_used)) * 100
      : marginPnlPct;
    await this.virtualTradeRepository.save(trade);

    const account = await this.accountRepository.findOneBy({ id: trade.paper_account_id });
    if (account) {
      account.current_balance = Number(account.current_balance) + margin + pnlValue;
      await this.accountRepository.save(account);
    }
    this.logger.log(
      `[PaperAccount #${trade.paper_account_id}] Closed #${trade.id} (${trade.exit_reason}) PnL: ${marginPnlPct.toFixed(2)}% of margin`,
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAccountTrades() {
    const openTrades = await this.virtualTradeRepository.find({
      where: { status: TradeStatus.OPEN, paper_account_id: Not(IsNull()) },
    });
    if (!openTrades.length) return;

    try {
      const tickers = await this.binanceApiService.fetchTickers24h();
      for (const trade of openTrades) {
        const ticker = tickers[trade.pair];
        if (!ticker) continue;
        await this.processAccountTrade(trade, Number(ticker.lastPrice));
      }
    } catch (e) {
      this.logger.error(`checkAccountTrades error: ${(e as Error).message}`);
    }
  }

  /**
   * Один тик мониторинга account-сделки: ликвидация → trailing → partial TP → фикс. SL/TP.
   * Все пороги — проценты движения цены; плечо влияет на денежный PnL и порог ликвидации.
   */
  async processAccountTrade(trade: VirtualTrade, currentPrice: number): Promise<void> {
    const account = await this.accountRepository.findOneBy({ id: trade.paper_account_id });
    if (!account) return;

    let entry = Number(trade.entry_price);
    const lev = Number(trade.leverage_used) || 1;

    if (currentPrice > Number(trade.highest_price)) trade.highest_price = currentPrice;
    if (currentPrice < Number(trade.lowest_price)) trade.lowest_price = currentPrice;

    let pricePnl = trade.type === 'LONG'
      ? ((currentPrice - entry) / entry) * 100
      : ((entry - currentPrice) / entry) * 100;

    trade.pnl_percent = pricePnl * lev; // непрерывно показываем PnL на маржу

    // ── 1. Ликвидация ────────────────────────────────────────────────────
    if (pricePnl <= -100 / lev) {
      await this.virtualTradeRepository.save(trade);
      await this.closeAccountTrade(trade.id, currentPrice, 'LIQUIDATION');
      return;
    }

    // ── 1.5 DCA / Rebuy ──────────────────────────────────────────────────
    // Adds margin (deducted from the account balance, like a fresh entry)
    // when the price has moved against the position by the next configured
    // level's threshold, then recomputes the weighted average entry price.
    // entry/pricePnl are refreshed immediately so steps below this tick see
    // the post-DCA state, not the stale pre-DCA one.
    const dcaLevels = Array.isArray(account.dca_rebuy_levels) ? account.dca_rebuy_levels : [];
    if (dcaLevels.length > 0 && Number(trade.dca_hits) < dcaLevels.length) {
      const level = dcaLevels[Number(trade.dca_hits)];
      if (-pricePnl >= Number(level.triggerPercent)) {
        const addMargin = Number(trade.margin_used) * Number(level.sizeMultiplier);
        const fresh = await this.accountRepository.findOneByOrFail({ id: account.id });
        if (addMargin > 0 && addMargin <= Number(fresh.current_balance)) {
          fresh.current_balance = Number(fresh.current_balance) - addMargin;
          await this.accountRepository.save(fresh);
          account.current_balance = fresh.current_balance;

          const oldQty = Number(trade.remaining_volume) / entry;
          const addQty = addMargin / currentPrice;
          const newEntry = (Number(trade.remaining_volume) + addMargin) / (oldQty + addQty);

          trade.remaining_volume = Number(trade.remaining_volume) + addMargin;
          trade.margin_used = Number(trade.margin_used); // original stake for future levels stays unchanged
          trade.entry_price = newEntry;
          trade.dca_hits = Number(trade.dca_hits) + 1;

          if (!trade.trailing_active) {
            trade.stop_price = null; // let the fixed-SL fallback recompute from the new entry below
          }

          this.logger.log(
            `[PaperAccount #${account.id}] DCA#${trade.dca_hits} for #${trade.id}: added $${addMargin.toFixed(2)} at ${currentPrice}, new avg entry ${newEntry.toFixed(4)}`,
          );

          entry = newEntry;
          pricePnl = trade.type === 'LONG'
            ? ((currentPrice - entry) / entry) * 100
            : ((entry - currentPrice) / entry) * 100;
          trade.pnl_percent = pricePnl * lev;
        } else {
          this.logger.warn(`[PaperAccount #${account.id}] DCA#${Number(trade.dca_hits) + 1} skipped for #${trade.id}: insufficient balance`);
        }
      }
    }

    // ── 2. Trailing stop ─────────────────────────────────────────────────
    if (account.use_trailing) {
      const dist = Number(account.trailing_distance) / 100;
      const act = Number(account.trailing_activation) / 100;

      if (trade.type === 'LONG') {
        if (currentPrice > Number(trade.peak_price)) trade.peak_price = currentPrice;
        if ((currentPrice - entry) / entry >= act) trade.trailing_active = true;
        if (trade.trailing_active) {
          const newStop = Number(trade.peak_price) * (1 - dist);
          if (!trade.stop_price || newStop > Number(trade.stop_price)) trade.stop_price = newStop;
        }
        if (trade.stop_price && currentPrice <= Number(trade.stop_price)) {
          await this.virtualTradeRepository.save(trade);
          await this.closeAccountTrade(trade.id, currentPrice, trade.trailing_active ? 'TRAILING' : 'SL');
          return;
        }
      } else {
        if (currentPrice < Number(trade.peak_price)) trade.peak_price = currentPrice;
        if ((entry - currentPrice) / entry >= act) trade.trailing_active = true;
        if (trade.trailing_active) {
          const newStop = Number(trade.peak_price) * (1 + dist);
          if (!trade.stop_price || newStop < Number(trade.stop_price)) trade.stop_price = newStop;
        }
        if (trade.stop_price && currentPrice >= Number(trade.stop_price)) {
          await this.virtualTradeRepository.save(trade);
          await this.closeAccountTrade(trade.id, currentPrice, trade.trailing_active ? 'TRAILING' : 'SL');
          return;
        }
      }
    }

    // ── 3. Partial TP ────────────────────────────────────────────────────
    const partials = Array.isArray(account.partial_tps) ? account.partial_tps : [];
    if (partials.length > 0 && Number(trade.partial_tp_hits) < partials.length) {
      const idx = Number(trade.partial_tp_hits);
      const level = partials[idx];

      if (pricePnl >= Number(level.target)) {
        const closedMargin = Number(trade.remaining_volume) * (Number(level.closePercent) / 100);
        const pnlValue = (closedMargin * pricePnl * lev) / 100;
        trade.remaining_volume = Number(trade.remaining_volume) - closedMargin;
        trade.partial_tp_hits = idx + 1;
        trade.pnl_value = Number(trade.pnl_value || 0) + pnlValue;
        account.current_balance = Number(account.current_balance) + closedMargin + pnlValue;
        await this.accountRepository.save(account);
        this.logger.log(
          `[PaperAccount #${account.id}] Partial TP#${idx + 1} for #${trade.id}: released $${closedMargin.toFixed(2)} + $${pnlValue.toFixed(2)} PnL`,
        );

        if (account.move_sl_to_be && idx === 0) {
          const improve = trade.type === 'LONG'
            ? !trade.stop_price || entry > Number(trade.stop_price)
            : !trade.stop_price || entry < Number(trade.stop_price);
          if (improve) trade.stop_price = entry;
        }

        if (Number(trade.partial_tp_hits) >= partials.length) {
          await this.virtualTradeRepository.save(trade);
          await this.closeAccountTrade(trade.id, currentPrice, 'TP');
          return;
        }
      }
    }

    // ── 4. Фиксированный SL / TP ─────────────────────────────────────────
    const effectiveSL: number | null = trade.stop_price
      ? Math.abs(((trade.type === 'LONG'
          ? Number(trade.stop_price) - entry
          : entry - Number(trade.stop_price)) / entry) * 100)
      : (account.sl_percent !== null && account.sl_percent !== undefined ? Number(account.sl_percent) : null);

    if (effectiveSL !== null && pricePnl <= -effectiveSL) {
      await this.virtualTradeRepository.save(trade);
      await this.closeAccountTrade(trade.id, currentPrice, 'SL');
      return;
    }

    if (account.tp_percent !== null && account.tp_percent !== undefined && partials.length === 0 && pricePnl >= Number(account.tp_percent)) {
      await this.virtualTradeRepository.save(trade);
      await this.closeAccountTrade(trade.id, currentPrice, 'TP');
      return;
    }

    await this.virtualTradeRepository.save(trade);
  }

  async getAccountsWithStats(strategyId?: number) {
    const where: any = strategyId ? { strategy_id: strategyId } : {};
    const accounts = await this.accountRepository.find({ where, order: { id: 'ASC' } });
    if (!accounts.length) return [];

    const accountIds = accounts.map((a) => a.id);
    const allTrades = await this.virtualTradeRepository.find({ where: { paper_account_id: In(accountIds) } });
    const tradesByAccount = new Map<number, VirtualTrade[]>();
    for (const t of allTrades) {
      const list = tradesByAccount.get(t.paper_account_id as number);
      if (list) list.push(t);
      else tradesByAccount.set(t.paper_account_id as number, [t]);
    }

    const result: any[] = [];
    for (const acc of accounts) {
      const trades = tradesByAccount.get(acc.id) || [];
      const closed = trades.filter((t) => t.status === TradeStatus.CLOSED);
      const open = trades.filter((t) => t.status === TradeStatus.OPEN);
      const wins = closed.filter((t) => Number(t.pnl_value) > 0).length;
      const totalPnlValue = closed.reduce((s, t) => s + Number(t.pnl_value), 0);
      const openMargin = open.reduce((s, t) => s + Number(t.remaining_volume ?? t.margin_used), 0);

      result.push({
        ...acc,
        stats: {
          equity: Math.round((Number(acc.current_balance) + openMargin) * 100) / 100,
          totalPnlValue: Math.round(totalPnlValue * 100) / 100,
          totalPnlPercent: Math.round((totalPnlValue / Number(acc.starting_capital)) * 10000) / 100,
          winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
          closedTrades: closed.length,
          openTrades: open.length,
          skippedSignals: Number(acc.skipped_signals || 0),
        },
      });
    }
    return result;
  }

  /**
   * Строит equity curve по стартовому капиталу + кумулятивному pnl_value закрытых сделок.
   * closedTradesAscByClosedAt должны быть отсортированы по closed_at ASC.
   */
  private buildEquityCurve(
    startingCapital: number,
    createdAt: Date,
    closedTradesAscByClosedAt: VirtualTrade[],
  ): Array<{ t: string; v: number }> {
    let equity = Number(startingCapital);
    const curve: Array<{ t: string; v: number }> = [
      { t: new Date(createdAt).toISOString(), v: equity },
    ];

    for (const t of closedTradesAscByClosedAt) {
      equity += Number(t.pnl_value);
      curve.push({ t: new Date(t.closed_at).toISOString(), v: Math.round(equity * 100) / 100 });
    }
    return curve;
  }

  async getAccountDetail(id: number) {
    const account = await this.accountRepository.findOneByOrFail({ id });
    const trades = await this.virtualTradeRepository.find({
      where: { paper_account_id: id },
      order: { opened_at: 'DESC' },
    });
    const closed = await this.virtualTradeRepository.find({
      where: { paper_account_id: id, status: TradeStatus.CLOSED },
      order: { closed_at: 'ASC' },
    });
    const equityCurve = this.buildEquityCurve(Number(account.starting_capital), account.created_at, closed);
    return { account, trades, equityCurve };
  }

  /** Закрывает открытые позиции по текущему рынку и возвращает баланс к стартовому капиталу */
  async resetAccount(id: number) {
    await this.accountRepository.findOneByOrFail({ id });
    const open = await this.virtualTradeRepository.find({
      where: { paper_account_id: id, status: TradeStatus.OPEN },
    });

    let tickers: any = {};
    try {
      tickers = await this.binanceApiService.fetchTickers24h();
    } catch { /* закроем по entry_price */ }

    for (const trade of open) {
      const price = tickers[trade.pair] ? Number(tickers[trade.pair].lastPrice) : Number(trade.entry_price);
      await this.closeAccountTrade(trade.id, price, 'MANUAL');
    }

    const fresh = await this.accountRepository.findOneByOrFail({ id });
    fresh.current_balance = fresh.starting_capital;
    return this.accountRepository.save(fresh);
  }

  async compareAccounts(ids: number[]) {
    const out: any[] = [];
    for (const id of ids) {
      const account = await this.accountRepository.findOneBy({ id });
      if (!account) continue;

      const closed = await this.virtualTradeRepository.find({
        where: { paper_account_id: id, status: TradeStatus.CLOSED },
        order: { closed_at: 'ASC' },
      });

      const equityPoints = this.buildEquityCurve(Number(account.starting_capital), account.created_at, closed);
      const dates = [account.created_at, ...closed.map((t) => t.closed_at)];
      const curve: Array<{ date: Date; equity: number }> = equityPoints.map((p, i) => ({
        date: dates[i],
        equity: p.v,
      }));

      let equity = Number(account.starting_capital);
      let peak = equity;
      let maxDrawdown = 0;
      for (const t of closed) {
        equity += Number(t.pnl_value);
        peak = Math.max(peak, equity);
        if (peak > 0) maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
      }

      const wins = closed.filter((t) => Number(t.pnl_value) > 0).length;
      out.push({
        account,
        curve,
        stats: {
          totalPnlPercent:
            Math.round(((equity - Number(account.starting_capital)) / Number(account.starting_capital)) * 10000) / 100,
          winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
          maxDrawdown: Math.round(maxDrawdown * 100) / 100,
          trades: closed.length,
        },
      });
    }
    return out;
  }
}
