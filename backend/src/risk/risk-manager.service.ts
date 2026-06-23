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
}
