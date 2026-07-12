import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { SignalsService } from '../signals/signals.service';
import { PaperTradingService } from '../paper-trading/paper-trading.service';

@Injectable()
export class RiskManagerService {
  private readonly logger = new Logger(RiskManagerService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly signalsService: SignalsService,
    private readonly paperTradingService: PaperTradingService,
  ) {}

  async checkGlobalLimits(): Promise<{ blocked: boolean; reason?: string }> {
    try {
      const settings = await this.settingsService.getAll();
      
      // 1. Daily Loss Limit
      const dailyLossLimit = parseFloat(settings['daily_loss_limit'] || '0');
      if (dailyLossLimit > 0) {
        const dailyPnL = await this.calculateDailyPnL();
        if (dailyPnL <= -dailyLossLimit) {
          return { blocked: true, reason: `Daily loss limit reached ($${dailyPnL.toFixed(2)})` };
        }
      }

      // 2. Max Open Positions (Signals in last X hours)
      const maxSignals = parseInt(settings['max_active_signals'] || '0');
      if (maxSignals > 0) {
          const recentSignals = await this.signalsService.getLatestSignals(maxSignals * 2);
          const activeCount = recentSignals.filter(s => {
              const age = Date.now() - new Date(s.created_at).getTime();
              return age < 4 * 60 * 60 * 1000; // 4 hours window for "active" signal
          }).length;
          
          if (activeCount >= maxSignals) {
              return { blocked: true, reason: `Max active signals reached (${activeCount})` };
          }
      }

      // 3. Losing Streak Cooldown Period
      const consecutiveLossLimit = parseInt(settings['consecutive_loss_limit'] || '0');
      const cooldownDuration = parseFloat(settings['cooldown_duration'] || '0');
      
      if (consecutiveLossLimit > 0 && cooldownDuration > 0) {
        const closedTrades = await this.paperTradingService.getRecentClosedTrades(consecutiveLossLimit);
        
        if (closedTrades.length >= consecutiveLossLimit) {
          const allLosses = closedTrades.every(t => parseFloat(t.pnl_percent.toString()) < 0);
          
          if (allLosses) {
            const lastLossTime = new Date(closedTrades[0].closed_at).getTime();
            const cooldownEndTime = lastLossTime + cooldownDuration * 60 * 60 * 1000;
            
            if (Date.now() < cooldownEndTime) {
              const hoursLeft = ((cooldownEndTime - Date.now()) / (60 * 60 * 1000)).toFixed(1);
              return { 
                blocked: true, 
                reason: `Losing streak cooldown active (${consecutiveLossLimit} losses in a row). Cooldown ends in ${hoursLeft}h.` 
              };
            }
          }
        }
      }

      return { blocked: false };
    } catch (e) {
      this.logger.error(`Error checking risk limits: ${e.message}`);
      return { blocked: false };
    }
  }

  private async calculateDailyPnL(): Promise<number> {
    const closedTrades = await this.paperTradingService.getRecentClosedTrades(50);
    const todayStr = new Date().toISOString().slice(0, 10);

    const todaysTrades = closedTrades.filter(t =>
      t.closed_at && new Date(t.closed_at).toISOString().slice(0, 10) === todayStr
    );

    return todaysTrades.reduce((sum, t) => sum + parseFloat(t.pnl_value.toString()), 0);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Портфельные примитивы риска (B1). Чистые функции — вызываются движком при
  // оценке новой позиции. Интеграция в signals-engine — отдельный follow-up.
  // ────────────────────────────────────────────────────────────────────────

  /** Пирсоновская корреляция двух рядов равной длины. 0 при вырожденных/коротких. */
  pearsonCorrelation(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;
    const ax = a.slice(-n);
    const bx = b.slice(-n);
    const meanA = ax.reduce((s, v) => s + v, 0) / n;
    const meanB = bx.reduce((s, v) => s + v, 0) / n;
    let cov = 0, varA = 0, varB = 0;
    for (let i = 0; i < n; i++) {
      const da = ax[i] - meanA;
      const db = bx[i] - meanB;
      cov += da * db;
      varA += da * da;
      varB += db * db;
    }
    if (varA === 0 || varB === 0) return 0;
    return cov / Math.sqrt(varA * varB);
  }

  /**
   * ATR (Wilder RMA) по свечам → адаптивная дистанция стопа = ATR * mult.
   * Нужно минимум period+1 свечей. null при нехватке данных.
   */
  atrStopDistance(
    candles: { high: number; low: number; close: number }[],
    period = 14,
    mult = 1.5,
  ): number | null {
    if (!candles || candles.length < period + 1 || period < 1) return null;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const h = candles[i].high;
      const l = candles[i].low;
      const prevClose = candles[i - 1].close;
      trs.push(Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose)));
    }
    if (trs.length < period) return null;
    // Wilder: первый ATR = SMA(period), далее RMA
    let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < trs.length; i++) {
      atr = (atr * (period - 1) + trs[i]) / period;
    }
    return atr * mult;
  }

  /**
   * Лимит загрузки депозита (WalletExposure): блок, если суммарная задействованная
   * маржа (открытая + новая) превышает maxExposurePct% от баланса.
   */
  checkWalletExposure(
    openMarginTotal: number,
    newMargin: number,
    balance: number,
    maxExposurePct: number,
  ): { blocked: boolean; reason?: string } {
    if (maxExposurePct <= 0 || balance <= 0) return { blocked: false };
    const exposurePct = ((openMarginTotal + newMargin) / balance) * 100;
    if (exposurePct > maxExposurePct) {
      return {
        blocked: true,
        reason: `Лимит загрузки депозита превышен: ${exposurePct.toFixed(1)}% > ${maxExposurePct}%`,
      };
    }
    return { blocked: false };
  }

  /**
   * Корреляционная концентрация: блок, если число открытых позиций, сильно
   * скоррелированных с новой парой (|Pearson| >= threshold), достигает maxCorrelated.
   */
  checkCorrelationExposure(
    newReturns: number[],
    openReturns: number[][],
    threshold = 0.8,
    maxCorrelated = 2,
  ): { blocked: boolean; reason?: string } {
    if (!openReturns?.length || maxCorrelated <= 0) return { blocked: false };
    let correlated = 0;
    for (const series of openReturns) {
      if (Math.abs(this.pearsonCorrelation(newReturns, series)) >= threshold) {
        correlated++;
      }
    }
    if (correlated >= maxCorrelated) {
      return {
        blocked: true,
        reason: `Слишком высокая корреляционная концентрация: ${correlated} позиций с |corr|>=${threshold}`,
      };
    }
    return { blocked: false };
  }
}
