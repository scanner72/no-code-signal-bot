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
}
