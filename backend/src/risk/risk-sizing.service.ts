import { Injectable } from '@nestjs/common';

export type SizingMethod = 'fixed_notional' | 'equity_percent' | 'risk_percent' | 'atr_based' | 'kelly';

export interface SizingCtx {
  equity: number;
  entryPrice: number;
  stopPct?: number;
  atr?: number;
  riskPercent?: number;
  atrMultiplier?: number;
  equityPct?: number;
  fixedNotional?: number;
  maxKelly?: number;
  stats?: { winRate: number; avgWin: number; avgLoss: number };
}

@Injectable()
export class RiskSizingService {
  computeNotional(method: SizingMethod, ctx: SizingCtx): number {
    const equity = ctx.equity > 0 ? ctx.equity : 0;
    const fallback = () => equity * (ctx.equityPct ?? 0.1);
    let notional: number;
    switch (method) {
      case 'fixed_notional':
        notional = ctx.fixedNotional ?? 100;
        break;
      case 'equity_percent':
        notional = equity * (ctx.equityPct ?? 0.1);
        break;
      case 'risk_percent': {
        if (!ctx.stopPct || ctx.stopPct <= 0) { notional = fallback(); break; }
        notional = (equity * ((ctx.riskPercent ?? 1) / 100)) / ctx.stopPct;
        break;
      }
      case 'atr_based': {
        const stopPct = ctx.atr && ctx.entryPrice ? (ctx.atr * (ctx.atrMultiplier ?? 2)) / ctx.entryPrice : 0;
        if (stopPct <= 0) { notional = fallback(); break; }
        notional = (equity * ((ctx.riskPercent ?? 2) / 100)) / stopPct;
        break;
      }
      case 'kelly': {
        const s = ctx.stats;
        if (!s || s.avgLoss <= 0) { notional = fallback(); break; }
        const payoff = s.avgWin / s.avgLoss;
        let f = (payoff * s.winRate - (1 - s.winRate)) / payoff;
        f = Math.max(0.01, Math.min(f, ctx.maxKelly ?? 0.25));
        notional = equity * f;
        break;
      }
      default:
        notional = fallback();
    }
    return Math.max(0, notional);
  }
}
