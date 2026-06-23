import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotInstance } from './bot-instance.entity';
import { SignalsEngineService } from '../signals/signals-engine.service';

@Injectable()
export class FleetService {
  private readonly logger = new Logger(FleetService.name);
  private activeIntervals: Map<number, NodeJS.Timeout> = new Map();

  constructor(
    @InjectRepository(BotInstance)
    private instanceRepo: Repository<BotInstance>,
    private signalsEngine: SignalsEngineService,
  ) {}

  async createInstance(data: Partial<BotInstance>) {
    const initial = data.currentBalance || data.initialBalance || 1000;
    const instance = this.instanceRepo.create({
        ...data,
        status: 'STOPPED',
        initialBalance: initial,
        currentBalance: initial,
        totalPnL: 0,
        totalPnLPct: 0,
        tradesCount: 0,
        settings: {
          consecutiveLosses: 0,
          sharpeRatio: 1.5,
          allocationMultiplier: 1.0,
          tradeHistory: []
        }
    });
    return this.instanceRepo.save(instance);
  }

  async getAll() {
    return this.instanceRepo.find({ relations: ['strategy'] });
  }

  async startInstance(id: number) {
    const instance = await this.instanceRepo.findOne({ where: { id }, relations: ['strategy'] });
    if (!instance) throw new Error('Instance not found');

    instance.status = 'RUNNING';
    await this.instanceRepo.save(instance);

    // Start the polling loop for this instance
    this.runBotLoop(instance);
    return instance;
  }

  async stopInstance(id: number) {
    const instance = await this.instanceRepo.findOne({ where: { id } });
    if (!instance) throw new Error('Instance not found');

    instance.status = 'STOPPED';
    await this.instanceRepo.save(instance);

    if (this.activeIntervals.has(id)) {
      clearInterval(this.activeIntervals.get(id));
      this.activeIntervals.delete(id);
    }
    return instance;
  }

  private async runBotLoop(instance: BotInstance) {
    if (this.activeIntervals.has(instance.id)) {
        clearInterval(this.activeIntervals.get(instance.id));
    }

    const interval = setInterval(async () => {
        try {
            const current = await this.instanceRepo.findOne({ where: { id: instance.id }, relations: ['strategy'] });
            if (!current || current.status !== 'RUNNING') {
                clearInterval(interval);
                return;
            }

            // 1. Check for signals
            const signal = await this.signalsEngine.checkStrategy(current.strategy, current.pair, current.timeframe);
            
            if (signal) {
                this.logger.log(`Fleet Bot [${current.name}] signal detected: ${signal.type}`);
                await this.handleExecution(current, signal);
            }
        } catch (e) {
            this.logger.error(`Error in Bot Loop [${instance.id}]: ${e.message}`);
        }
    }, 60000); // Check every minute

    this.activeIntervals.set(instance.id, interval);
  }

  private async handleExecution(instance: BotInstance, signal: any) {
      const initialBal = instance.initialBalance || 1000;
      
      // Simulate position opening
      if (!instance.currentPosition && (signal.type === 'LONG' || signal.type === 'SHORT')) {
          instance.currentPosition = {
              type: signal.type,
              entryPrice: signal.price,
              time: new Date(),
          };
          instance.tradesCount++;
          await this.instanceRepo.save(instance);
      } 
      // Simulate position closing (Exit)
      else if (instance.currentPosition && signal.type === 'EXIT') {
          const pnl = (signal.price - instance.currentPosition.entryPrice) * (instance.currentPosition.type === 'LONG' ? 1 : -1);
          instance.totalPnL += pnl;
          instance.currentBalance = (instance.currentBalance || initialBal) + pnl;
          instance.totalPnLPct = parseFloat((((instance.currentBalance - initialBal) / initialBal) * 100).toFixed(2));
          instance.currentPosition = null;
          instance.tradesCount++;
          await this.instanceRepo.save(instance);

          // Perform Auto-scaling Audit after trade closure
          await this.performAutoScalingAudit(instance, pnl);
      }
      // Simulate position flip (Close & Reverse)
      else if (instance.currentPosition && ((instance.currentPosition.type === 'LONG' && signal.type === 'SHORT') || (instance.currentPosition.type === 'SHORT' && signal.type === 'LONG'))) {
          const pnl = (signal.price - instance.currentPosition.entryPrice) * (instance.currentPosition.type === 'LONG' ? 1 : -1);
          instance.totalPnL += pnl;
          instance.currentBalance = (instance.currentBalance || initialBal) + pnl;
          instance.totalPnLPct = parseFloat((((instance.currentBalance - initialBal) / initialBal) * 100).toFixed(2));
          
          instance.currentPosition = {
            type: signal.type,
            entryPrice: signal.price,
            time: new Date(),
          };
          instance.tradesCount++;
          await this.instanceRepo.save(instance);

          // Perform Auto-scaling Audit after trade closure
          await this.performAutoScalingAudit(instance, pnl);
      }
  }

  private async performAutoScalingAudit(instance: BotInstance, lastTradePnl: number) {
      const settings = instance.settings || {};
      const isLoss = lastTradePnl < 0;

      settings.consecutiveLosses = isLoss ? (settings.consecutiveLosses || 0) + 1 : 0;
      settings.tradeHistory = settings.tradeHistory || [];
      settings.tradeHistory.push({ pnl: lastTradePnl, time: new Date() });

      // Calculate Sharpe Ratio of live trades
      const trades = settings.tradeHistory;
      if (trades.length >= 3) {
          const returns = trades.map((t: any) => t.pnl);
          const mean = returns.reduce((a: number, b: number) => a + b, 0) / returns.length;
          const variance = returns.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / returns.length;
          const stdDev = Math.sqrt(variance);
          settings.sharpeRatio = stdDev > 0 ? parseFloat(((mean / stdDev) * Math.sqrt(252)).toFixed(2)) : 0;
      } else {
          settings.sharpeRatio = 1.5; // Healthy fallback
      }

      const initialBal = instance.initialBalance || 1000;
      const currentDrawdownPct = parseFloat((((initialBal - instance.currentBalance) / initialBal) * 100).toFixed(2));

      let shouldStop = false;
      let shouldScaleDown = false;

      // Rule: Sharpe Ratio < 0.0, consecutive losses >= 6, or Drawdown > 15% => Auto Shutdown
      if (settings.consecutiveLosses >= 6 || settings.sharpeRatio < 0.0 || currentDrawdownPct > 15) {
          shouldStop = true;
      } 
      // Rule: Sharpe Ratio < 0.6, consecutive losses >= 3, or Drawdown > 8% => Scale allocation by 50%
      else if (settings.consecutiveLosses >= 3 || settings.sharpeRatio < 0.6 || currentDrawdownPct > 8) {
          shouldScaleDown = true;
      }

      if (shouldStop) {
          instance.status = 'STOPPED';
          settings.allocationMultiplier = 0.0;
          this.logger.error(`[Auto-Scaling] Fleet Bot "${instance.name}" auto-stopped due to critical drawdown (${currentDrawdownPct}%) or Sharpe (${settings.sharpeRatio}).`);
          
          if (this.activeIntervals.has(instance.id)) {
              clearInterval(this.activeIntervals.get(instance.id));
              this.activeIntervals.delete(instance.id);
          }
      } else if (shouldScaleDown) {
          settings.allocationMultiplier = 0.5;
          this.logger.warn(`[Auto-Scaling] Fleet Bot "${instance.name}" allocation scaled down to 50% (Drawdown: ${currentDrawdownPct}%, Sharpe: ${settings.sharpeRatio}).`);
      } else {
          settings.allocationMultiplier = 1.0;
      }

      instance.settings = settings;
      await this.instanceRepo.save(instance);

      // Reallocate balance allocation power to top-performing active Bot Farm Stars
      if (shouldStop || shouldScaleDown) {
          const activeBots = await this.instanceRepo.find({ where: { status: 'RUNNING' } });
          const starBots = activeBots.filter(b => b.id !== instance.id && ((b.settings?.sharpeRatio || 0) > 1.2 || b.totalPnL > 0));

          if (starBots.length > 0) {
              this.logger.log(`[Auto-Scaling] Dynamic Resource Reallocation: boosting ${starBots.length} Bot Farm Star(s).`);
              for (const star of starBots) {
                  const starSettings = star.settings || {};
                  starSettings.allocationMultiplier = parseFloat(Math.min(2.0, (starSettings.allocationMultiplier || 1.0) + 0.25).toFixed(2));
                  star.settings = starSettings;
                  await this.instanceRepo.save(star);
                  this.logger.log(`[Auto-Scaling] Boosted active Star Bot "${star.name}" allocation factor to ${starSettings.allocationMultiplier}x.`);
              }
          }
      }
  }

  async panicStop() {
      const instances = await this.instanceRepo.find();
      for (const inst of instances) {
          await this.stopInstance(inst.id);
      }
      return { stoppedCount: instances.length };
  }
}
