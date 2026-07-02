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
}

/** "1.5%" | 1.5 → 1.5; пусто → null */
function parsePercent(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace('%', '').trim());
  return isNaN(n) ? null : n;
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
        starting_capital: Number(d.startingCapital) || 1000,
        leverage: Number(d.leverage) || 1,
        risk_percent: Number(d.riskPercent) || 10,
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
    trade.pnl_percent = marginPnlPct;
    trade.pnl_value = pnlValue;
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
}
