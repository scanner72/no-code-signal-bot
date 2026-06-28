import { Injectable, Logger } from '@nestjs/common';
import { CandlesService } from '../candles/candles.service';
import { AstEvaluatorService } from '../signals/ast-evaluator.service';
import { Strategy } from '../strategies/strategy.entity';
import { IndicatorsService } from '../indicators/indicators.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BacktestProgressService } from './backtest-progress.service';

export interface BacktestOptions {
  start: Date;
  end: Date;
  initialBalance: number;
  fee: number;
  tp: number;
  sl: number;
  positionSize: number;
  accurate?: boolean;
  useTrailingStop?: boolean;
  trailingDistance?: number;      // Distance in %
  trailingActivation?: number;    // Activation threshold in %
  latencyMs?: number;             // Simulated execution delay
  slippagePct?: number;           // Fixed slippage in %
  useOrderbookSlippage?: boolean; // Use depth data for slippage
  executionAlgo?: 'MARKET' | 'TWAP' | 'VWAP';
  /** Partial TP levels — [{target: profit%, closePercent: % of position}] */
  partialTPs?: Array<{ target: number; closePercent: number }>;
  /** Move SL to break-even price after first partial TP hit */
  moveSLtoBE?: boolean;
  /** Call AI nodes (Hermes, Kronos, LDR) during backtest — default false (PASS) */
  useAiNodes?: boolean;
  /** Use ATR-based stop loss instead of fixed % */
  useAtrSl?: boolean;
  /** Multiplier for ATR-based SL (default: 2) */
  atrSLMultiplier?: number;
}

const round = (n: number, decimals: number) => parseFloat(n.toFixed(decimals));

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);
  private onProgress?: (percent: number) => Promise<void>;

  private async emitProgress(strategyId: number, percent: number, stage: string) {
    this.progressService.broadcastProgress(strategyId, percent, stage);
    if (this.onProgress) {
      try { await this.onProgress(percent); } catch {}
    }
  }

  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
    private candlesService: CandlesService,
    private astEvaluator: AstEvaluatorService,
    private indicatorsService: IndicatorsService,
    private progressService: BacktestProgressService,
  ) {}

  async run(strategyId: number, options: BacktestOptions, onProgress?: (percent: number) => Promise<void>) {
    const strategy = await this.strategyRepository.findOneBy({ id: strategyId });
    if (!strategy) throw new Error('Strategy not found');

    this.onProgress = onProgress;

    options.start = new Date(options.start);
    options.end   = new Date(options.end);

    await this.emitProgress(strategyId, 10, '📥 Загрузка котировок с биржи...');

    let targetPair = strategy.pair;
    if (targetPair.includes('_TOP')) {
      targetPair = 'BTCUSDT';
    }

    await this.candlesService.ensureHistoricalData(targetPair, strategy.timeframe, options.start, options.end);
    const candles = await this.candlesService.getCandlesForRange(targetPair, strategy.timeframe, options.start, options.end);

    return this.runWithAst(strategy.ast, strategy, options, candles);
  }

  async runWithAst(ast: any, strategy: Strategy, options: BacktestOptions, candles?: any[]) {
    const { tp, sl, positionSize, fee } = options;

    if (strategy && strategy.id) {
      this.emitProgress(strategy.id, 25, '🧬 Вычисление индикаторов и условий AST...');
    }

    // Auto-detect ATR Stop Loss settings from strategy nodes
    let useAtrSl = options.useAtrSl;
    let atrSLMultiplier = options.atrSLMultiplier || 2;

    if (strategy && Array.isArray(strategy.nodes)) {
      const sltpNode = strategy.nodes.find((n: any) => n.data?.action === 'sltp');
      if (sltpNode) {
        if (sltpNode.data?.slMode === 'atr') {
          useAtrSl = true;
          atrSLMultiplier = parseFloat(sltpNode.data?.slAtrMultiplier) || 2;
        }
      }
    }
    
    // Coerce start/end to Date objects (optimizer may call this directly with strings)
    options.start = new Date(options.start);
    options.end   = new Date(options.end);

    let targetPair = strategy.pair;
    if (targetPair.includes('_TOP')) {
      targetPair = 'BTCUSDT';
    }

    let simCandles = candles;
    if (!simCandles) {
        simCandles = await this.candlesService.getCandlesForRange(targetPair, strategy.timeframe, options.start, options.end);
    }

    this.logger.log(`Backtest: ${strategy.name} (Custom AST), ${simCandles.length} candles`);

    const reversedCandles = [...simCandles].reverse();
    const n = simCandles.length;

    // In accurate mode, we fetch 1m candles for sub-candle resolution
    let subCandles: any[] = [];
    if (options.accurate && strategy.timeframe !== '1m') {
        this.logger.log(`Fetching 1m candles for accurate resolution...`);
        if (strategy.id) {
          this.emitProgress(strategy.id, 35, '📥 Загрузка 1м котировок для точного тестирования...');
        }
        await this.candlesService.ensureHistoricalData(targetPair, '1m', options.start, options.end);
        subCandles = await this.candlesService.getCandlesForRange(targetPair, '1m', options.start, options.end);
    }

    if (strategy && strategy.id) {
      this.emitProgress(strategy.id, 45, '📊 Симуляция ордеров и SL/TP уровней...');
      await new Promise(r => setImmediate(r));
    }

    let balance = options.initialBalance;
    let peakBalance = balance;
    let maxDrawdown = 0;
    let position: { 
      type: string; entryPrice: number; entryTime: any; amount: number; entryIndex: number; 
      stopPrice: number; peakPrice: number; activatedTrailing: boolean 
    } | null = null;
    const trades: any[] = [];
    const step = Math.max(1, Math.ceil((n - 100) / 50));

    const yieldEvery = Math.max(50, Math.floor((n - 100) / 200));

    for (let i = 100; i < n; i++) {
      if (strategy && strategy.id && (i - 100) % step === 0) {
        const percent = 45 + Math.round(((i - 100) / (n - 100)) * 40);
        this.emitProgress(strategy.id, percent, '📊 Симуляция ордеров и SL/TP уровней...');
      }
      if ((i - 100) % yieldEvery === 0) {
        await new Promise(r => setImmediate(r));
      }
      const currentCandles = reversedCandles.slice(n - 1 - i);
      const currentPrice = parseFloat(simCandles[i].close.toString());
      const candleTime = simCandles[i].time.getTime();

      const context = { 
        pair: targetPair, 
        timeframe: strategy.timeframe, 
        cache: new Map(),
        sentiment: { score: 0.2, label: 'BULLISH' }, // Simulated sentiment for backtest
        isBacktest: true
      };
      context.cache.set(strategy.timeframe, currentCandles);

      const isTriggered = await this.astEvaluator.evaluateNode(ast, currentCandles, false, context, { backtestMode: !options.useAiNodes });

      if (isTriggered && !position) {
        const notional = balance * positionSize;
        const entryFee = notional * fee;
        balance -= entryFee;
        
        // Apply Advanced Execution (Latency & Slippage)
        let executionPrice = currentPrice;
        
        // 1. Latency Simulation: Price can drift during the delay
        if (options.latencyMs && options.latencyMs > 0) {
            // Estimate drift based on current candle volatility
            const candleRange = Math.abs(parseFloat(simCandles[i].high.toString()) - parseFloat(simCandles[i].low.toString()));
            const drift = (candleRange * (options.latencyMs / 60000)) * (Math.random() > 0.5 ? 1 : -1); // 1m average
            executionPrice += drift;
        }

        // 2. Slippage Simulation
        if (options.slippagePct) {
            const slipDir = (ast?.signalType === 'SHORT' || position?.type === 'SHORT') ? -1 : 1;
            executionPrice = executionPrice * (1 + (options.slippagePct / 100) * slipDir);
        }

        // 3. Execution Algorithm (TWAP/VWAP)
        if (options.executionAlgo === 'TWAP') {
            const window = 5; // Simulating execution spread over 5 bars
            const slice = simCandles.slice(Math.max(0, i - window + 1), i + 1);
            executionPrice = slice.reduce((s, c) => s + parseFloat(c.close.toString()), 0) / slice.length;
        } else if (options.executionAlgo === 'VWAP') {
            const window = 5;
            const slice = simCandles.slice(Math.max(0, i - window + 1), i + 1);
            const totalVol = slice.reduce((s, c) => s + parseFloat(c.volume.toString()), 0);
            if (totalVol > 0) {
                executionPrice = slice.reduce((s, c) => s + (parseFloat(c.close.toString()) * parseFloat(c.volume.toString())), 0) / totalVol;
            }
        }

        // Calculate SL price: ATR-based or fixed %
        let stopPriceFinal: number;
        if (useAtrSl) {
          const atrPeriod = 14;
          const recentHighs = simCandles.slice(Math.max(0, i - atrPeriod * 2), i + 1).map((c: any) => parseFloat(c.high.toString()));
          const recentLows  = simCandles.slice(Math.max(0, i - atrPeriod * 2), i + 1).map((c: any) => parseFloat(c.low.toString()));
          const recentClose = simCandles.slice(Math.max(0, i - atrPeriod * 2), i + 1).map((c: any) => parseFloat(c.close.toString()));
          const atrArr = this.indicatorsService.calculateATR(recentHighs, recentLows, recentClose, atrPeriod);
          const atrValue = atrArr.length > 0 ? atrArr[atrArr.length - 1] : executionPrice * 0.01;
          const multiplier = atrSLMultiplier;
          stopPriceFinal = (ast?.signalType === 'LONG')
            ? executionPrice - atrValue * multiplier
            : executionPrice + atrValue * multiplier;
          this.logger.debug(`ATR SL: ATR=${atrValue.toFixed(4)}, mult=${multiplier}, stopPrice=${stopPriceFinal.toFixed(4)}`);
        } else {
          stopPriceFinal = (ast?.signalType === 'LONG') ? executionPrice * (1 - sl) : executionPrice * (1 + sl);
        }

        position = {
          type: ast?.signalType || 'LONG',
          entryPrice: executionPrice,
          entryTime: simCandles[i].time,
          amount: notional / currentPrice,
          entryIndex: i,
          stopPrice: stopPriceFinal,
          peakPrice: currentPrice,
          activatedTrailing: false,
        } as any;
        (position as any).entryFee = entryFee;
        (position as any).partialTpHits = 0;
        (position as any).remainingAmount = notional / currentPrice;

      } else if (position) {
        // Trailing Stop Logic
        if (options.useTrailingStop) {
          const distance = options.trailingDistance || 0.01;
          const activation = options.trailingActivation || 0;

          
          if (position.type === 'LONG') {
            if (currentPrice > position.peakPrice) position.peakPrice = currentPrice;
            const pnlPct = (currentPrice - position.entryPrice) / position.entryPrice;
            if (pnlPct >= activation) position.activatedTrailing = true;
            
            if (position.activatedTrailing) {
              const newStop = position.peakPrice * (1 - distance);
              if (newStop > position.stopPrice) position.stopPrice = newStop;
            }
          } else {
            if (currentPrice < position.peakPrice) position.peakPrice = currentPrice;
            const pnlPct = (position.entryPrice - currentPrice) / position.entryPrice;
            if (pnlPct >= activation) position.activatedTrailing = true;
            
            if (position.activatedTrailing) {
              const newStop = position.peakPrice * (1 + distance);
              if (newStop < position.stopPrice) position.stopPrice = newStop;
            }
          }
        }

        // Accurate simulation using sub-candles (1m)
        if (options.accurate && subCandles.length > 0) {
            const nextCandleTime = simCandles[i + 1]?.time.getTime() || Infinity;
            // Find 1m candles within this timeframe candle
            const currentSubCandles = subCandles.filter(sc => {
                const t = sc.time.getTime();
                return t >= candleTime && t < nextCandleTime;
            });

            for (const sc of currentSubCandles) {
                const low = parseFloat(sc.low.toString());
                const high = parseFloat(sc.high.toString());
                
                // Simulate SL/TP hit inside the 1m candle
                // We check SL first (pessimistic)
                const slPrice = position.stopPrice || (position.type === 'LONG' ? position.entryPrice * (1 - sl) : position.entryPrice * (1 + sl));
                const tpPrice = position.type === 'LONG' ? position.entryPrice * (1 + tp) : position.entryPrice * (1 - tp);

                let hitSL = position.type === 'LONG' ? low <= slPrice : high >= slPrice;
                let hitTP = position.type === 'LONG' ? high >= tpPrice : low <= tpPrice;

                if (hitSL || hitTP) {
                    const exitPrice = hitSL ? slPrice : tpPrice;
                    const pnlFraction = hitSL ? -sl : tp;
                    
                    const rawPnl = (exitPrice - position.entryPrice) * position.amount * (position.type === 'LONG' ? 1 : -1);
                    const exitFee = position.amount * exitPrice * fee;
                    const totalFees = ((position as any).entryFee || 0) + exitFee;
                    const netPnl = rawPnl - totalFees;
                    balance += rawPnl;
                    balance -= exitFee;

                    trades.push({
                        type: position.type,
                        entryPrice: position.entryPrice,
                        exitPrice: exitPrice,
                        entryTime: position.entryTime,
                        exitTime: sc.time,
                        pnl: round(netPnl, 4),
                        pnlPercent: round(pnlFraction * 100, 2),
                        fees: round(totalFees, 4),
                        isAccurate: true,
                    });

                    if (balance > peakBalance) peakBalance = balance;
                    const drawdown = (peakBalance - balance) / peakBalance;
                    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

                    position = null;
                    break; // Trade closed
                }
            }
            // ── Partial TP logic ─────────────────────────────────────────────
            const partialTPs: Array<{target: number, closePercent: number}> = options.partialTPs || [];
            const sortedPTPs = [...partialTPs].sort((a, b) => a.target - b.target);
            const ptpHits = (position as any).partialTpHits || 0;

            if (sortedPTPs.length > 0 && ptpHits < sortedPTPs.length) {
              const nextLevel = sortedPTPs[ptpHits];
              const nextTargetPrice = position.type === 'LONG'
                ? position.entryPrice * (1 + nextLevel.target / 100)
                : position.entryPrice * (1 - nextLevel.target / 100);

              const hitPartial = position.type === 'LONG'
                ? currentPrice >= nextTargetPrice
                : currentPrice <= nextTargetPrice;

              if (hitPartial) {
                const closeRatio = nextLevel.closePercent / 100;
                const closedAmount = (position as any).remainingAmount * closeRatio;
                const partialPnl = (nextTargetPrice - position.entryPrice) * closedAmount * (position.type === 'LONG' ? 1 : -1);
                balance += partialPnl;
                (position as any).remainingAmount -= closedAmount;
                (position as any).partialTpHits = ptpHits + 1;

                trades.push({
                  type: position.type,
                  entryPrice: position.entryPrice,
                  exitPrice: nextTargetPrice,
                  entryTime: position.entryTime,
                  exitTime: simCandles[i].time,
                  pnl: round(partialPnl, 4),
                  pnlPercent: round(nextLevel.target * (position.type === 'LONG' ? 1 : -1), 2),
                  fees: 0,
                  exitReason: `Partial_TP_${ptpHits + 1}`,
                  isPartial: true,
                });

                // Break-even stop after first partial TP
                if (options.moveSLtoBE && ptpHits === 0) {
                  const beStop = position.entryPrice;
                  if (position.type === 'LONG' && beStop > (position as any).stopPrice) {
                    (position as any).stopPrice = beStop;
                  } else if (position.type === 'SHORT' && beStop < (position as any).stopPrice) {
                    (position as any).stopPrice = beStop;
                  }
                }

                // All partial TPs hit → close remainder
                if ((position as any).partialTpHits >= sortedPTPs.length) {
                  const finalPnl = (currentPrice - position.entryPrice) * (position as any).remainingAmount * (position.type === 'LONG' ? 1 : -1);
                  balance += finalPnl;
                  position = null;
                  continue;
                }
              }
            }

            const pnlFraction = position.type === 'LONG'
                ? (currentPrice - position.entryPrice) / position.entryPrice
                : (position.entryPrice - currentPrice) / position.entryPrice;

            const slPrice = position.stopPrice || (position.type === 'LONG' ? position.entryPrice * (1 - sl) : position.entryPrice * (1 + sl));
            const hitSL = position.type === 'LONG' ? currentPrice <= slPrice : currentPrice >= slPrice;

            if ((sortedPTPs.length === 0 && pnlFraction >= tp) || hitSL) {
                let exitPrice = hitSL ? slPrice : currentPrice;
                
                // Apply Slippage on Exit
                if (options.slippagePct) {
                    const slipDir = position.type === 'LONG' ? -1 : 1; // Exit long = sell (slip down), Exit short = buy (slip up)
                    exitPrice = exitPrice * (1 + (options.slippagePct / 100) * slipDir);
                }

                const rawPnl = (exitPrice - position.entryPrice) * position.amount * (position.type === 'LONG' ? 1 : -1);
                const exitFee = position.amount * exitPrice * fee;
                const totalFees = ((position as any).entryFee || 0) + exitFee;
                const netPnl = rawPnl - totalFees;
                balance += rawPnl;
                balance -= exitFee;

                trades.push({
                    type: position.type,
                    entryPrice: position.entryPrice,
                    exitPrice: exitPrice,
                    entryTime: position.entryTime,
                    exitTime: simCandles[i].time,
                    pnl: round(netPnl, 4),
                    pnlPercent: round(((exitPrice - position.entryPrice) / position.entryPrice) * (position.type === 'LONG' ? 1 : -1) * 100, 2),
                    fees: round(totalFees, 4),
                    exitReason: hitSL ? 'SL/Trailing' : 'TP',
                });

                if (balance > peakBalance) peakBalance = balance;
                const drawdown = (peakBalance - balance) / peakBalance;
                if (drawdown > maxDrawdown) maxDrawdown = drawdown;

                position = null;
            }
        }
      }
    }

    // Force-close any open position at end of backtest period
    if (position && simCandles.length > 0) {
      const lastCandle = simCandles[simCandles.length - 1];
      const lastPrice = parseFloat(lastCandle.close.toString());
      const pnlFraction = position.type === 'LONG'
        ? (lastPrice - position.entryPrice) / position.entryPrice
        : (position.entryPrice - lastPrice) / position.entryPrice;

      const rawPnl = (lastPrice - position.entryPrice) * position.amount * (position.type === 'LONG' ? 1 : -1);
      const exitFee = position.amount * lastPrice * fee;
      const totalFees = ((position as any).entryFee || 0) + exitFee;
      const netPnl = rawPnl - totalFees;
      balance += rawPnl;
      balance -= exitFee;

      trades.push({
        type: position.type,
        entryPrice: position.entryPrice,
        exitPrice: lastPrice,
        entryTime: position.entryTime,
        exitTime: lastCandle.time,
        pnl: round(netPnl, 4),
        pnlPercent: round(pnlFraction * 100, 2),
        fees: round(totalFees, 4),
        forceClosed: true,  // Mark as force-closed at period end
      });

      if (balance > peakBalance) peakBalance = balance;
      const drawdown = (peakBalance - balance) / peakBalance;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      position = null;
    }

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);

    const totalWinPnl = wins.reduce((s, t) => s + t.pnl, 0);
    const totalLossPnl = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const avgWin = wins.length ? round(totalWinPnl / wins.length, 4) : 0;
    const avgLoss = losses.length ? round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length, 4) : 0;
    const winRate = trades.length ? round(wins.length / trades.length * 100, 1) : 0;
    const profitFactor = totalLossPnl > 0 ? round(totalWinPnl / totalLossPnl, 2) : totalWinPnl > 0 ? Infinity : 0;
    const riskReward = avgLoss !== 0 ? round(Math.abs(avgWin / avgLoss), 2) : 0;

    let maxConsecutiveLosses = 0;
    let currentConsecutiveLosses = 0;
    let maxConsecutiveWins = 0;
    let currentConsecutiveWins = 0;
    for (const t of trades) {
      if (t.pnl <= 0) {
        currentConsecutiveLosses++;
        currentConsecutiveWins = 0;
        if (currentConsecutiveLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentConsecutiveLosses;
      } else {
        currentConsecutiveWins++;
        currentConsecutiveLosses = 0;
        if (currentConsecutiveWins > maxConsecutiveWins) maxConsecutiveWins = currentConsecutiveWins;
      }
    }


    let sharpeRatio = 0;
    if (trades.length > 1) {
      const returns = trades.map(t => t.pnlPercent / 100);
      const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / returns.length;
      const stdev = Math.sqrt(variance);
      sharpeRatio = stdev > 0 ? round(meanReturn / stdev * Math.sqrt(252), 2) : 0;
    }

    let sortinoRatio = 0;
    if (trades.length > 1) {
      const returns = trades.map(t => t.pnlPercent / 100);
      const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
      const downsideReturns = returns.filter(r => r < 0);
      const downsideVariance = downsideReturns.length > 0 
        ? downsideReturns.reduce((s, r) => s + (r - 0) ** 2, 0) / returns.length 
        : 0;
      const downsideStdev = Math.sqrt(downsideVariance);
      sortinoRatio = downsideStdev > 0 ? round(meanReturn / downsideStdev * Math.sqrt(252), 2) : 0;
    }

    const recoveryFactor = maxDrawdown > 0 ? round((balance - options.initialBalance) / (options.initialBalance * maxDrawdown), 2) : 0;

    const durationMs = options.end.getTime() - options.start.getTime();
    const durationYears = durationMs / (365 * 24 * 60 * 60 * 1000) || 1;
    const annualizedReturn = (balance - options.initialBalance) / options.initialBalance / durationYears;
    const calmarRatio = maxDrawdown > 0 ? round(annualizedReturn / maxDrawdown, 2) : 0;

    const wr = winRate / 100;
    const expectancy = trades.length > 0 ? round(wr * avgWin + (1 - wr) * avgLoss, 4) : 0;
    const largestWin = wins.length ? round(Math.max(...wins.map(t => t.pnl)), 4) : 0;
    const largestLoss = losses.length ? round(Math.min(...losses.map(t => t.pnl)), 4) : 0;

    const longTrades = trades.filter(t => t.type === 'LONG');
    const shortTrades = trades.filter(t => t.type === 'SHORT');
    const longWins = longTrades.filter(t => t.pnl > 0);
    const shortWins = shortTrades.filter(t => t.pnl > 0);

    if (strategy && strategy.id) {
      this.emitProgress(strategy.id, 95, '📈 Расчет кривой доходности и метрик...');
      await new Promise(r => setImmediate(r));
    }

    const recommendations = this.generateRecommendations({
      winRate, profitFactor, maxDrawdown, sharpeRatio, riskReward,
      maxConsecutiveLosses, trades, avgWin, avgLoss, expectancy,
    });

    if (strategy && strategy.id) {
      this.emitProgress(strategy.id, 100, '✅ Тестирование успешно завершено!');
      await new Promise(r => setImmediate(r));
    }

    return {
      strategyName: strategy.name,
      pair: strategy.pair,
      timeframe: strategy.timeframe,
      initialBalance: options.initialBalance,
      finalBalance: round(balance, 4),
      totalReturn: round((balance - options.initialBalance) / options.initialBalance * 100, 2),
      totalTrades: trades.length,
      winRate,
      maxDrawdown: round(maxDrawdown * 100, 2),
      avgWin,
      avgLoss,
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      recoveryFactor,
      calmarRatio,
      riskReward,
      expectancy,
      maxConsecutiveLosses,
      maxConsecutiveWins,
      largestWin,
      largestLoss,
      longStats: {
        total: longTrades.length,
        wins: longWins.length,
        winRate: longTrades.length ? round(longWins.length / longTrades.length * 100, 1) : 0,
      },
      shortStats: {
        total: shortTrades.length,
        wins: shortWins.length,
        winRate: shortTrades.length ? round(shortWins.length / shortTrades.length * 100, 1) : 0,
      },
      recommendations,
      trades,
      candles: simCandles, // Return the candles so frontend can plot the backtest chart
    };
  }

  private generateRecommendations(metrics: {
    winRate: number; profitFactor: number; maxDrawdown: number;
    sharpeRatio: number; riskReward: number; maxConsecutiveLosses: number;
    trades: any[]; avgWin: number; avgLoss: number; expectancy: number;
  }) {
    const r: { type: 'success' | 'warning' | 'danger' | 'info'; text: string }[] = [];

    // Profitability assessment
    if (metrics.profitFactor >= 2) {
      r.push({ type: 'success', text: `Отличный Profit Factor (${metrics.profitFactor}). Стратегия генерирует вдвое больше прибыли, чем убытков.` });
    } else if (metrics.profitFactor >= 1.5) {
      r.push({ type: 'success', text: `Хороший Profit Factor (${metrics.profitFactor}). Стратегия прибыльна с запасом.` });
    } else if (metrics.profitFactor >= 1) {
      r.push({ type: 'warning', text: `Profit Factor (${metrics.profitFactor}) близок к 1. Стратегия едва покрывает убытки — рассмотрите ужесточение входов.` });
    } else if (metrics.trades.length > 0) {
      r.push({ type: 'danger', text: `Profit Factor (${metrics.profitFactor}) ниже 1 — стратегия убыточна. Требуются фундаментальные изменения.` });
    }

    // Win rate & risk-reward balance
    if (metrics.winRate < 40 && metrics.riskReward >= 2) {
      r.push({ type: 'info', text: `Низкий Win Rate (${metrics.winRate}%) компенсируется высоким R:R (${metrics.riskReward}). Это нормально для трендовых стратегий.` });
    } else if (metrics.winRate < 40) {
      r.push({ type: 'warning', text: `Win Rate ${metrics.winRate}% — слишком много ложных сигналов. Добавьте фильтры (объём, тренд, MTF).` });
    } else if (metrics.winRate > 70 && metrics.riskReward < 1) {
      r.push({ type: 'warning', text: `Высокий Win Rate (${metrics.winRate}%), но R:R ${metrics.riskReward} — прибыль на сделку меньше убытка. Увеличьте TP или уменьшите SL.` });
    }

    // Drawdown
    if (metrics.maxDrawdown > 30) {
      r.push({ type: 'danger', text: `Просадка ${metrics.maxDrawdown}% — критично высокая. Уменьшите размер позиции или добавьте стоп-лосс.` });
    } else if (metrics.maxDrawdown > 15) {
      r.push({ type: 'warning', text: `Просадка ${metrics.maxDrawdown}% — рассмотрите уменьшение позиции для снижения риска.` });
    } else if (metrics.maxDrawdown < 10 && metrics.trades.length > 5) {
      r.push({ type: 'success', text: `Просадка всего ${metrics.maxDrawdown}% — отличный контроль риска.` });
    }

    // Consecutive losses
    if (metrics.maxConsecutiveLosses >= 5) {
      r.push({ type: 'warning', text: `${metrics.maxConsecutiveLosses} убытков подряд — психологически тяжело. Добавьте cooldown-период после серии потерь.` });
    }

    // Sharpe ratio
    if (metrics.sharpeRatio > 2) {
      r.push({ type: 'success', text: `Sharpe Ratio ${metrics.sharpeRatio} — превосходная доходность с учётом риска.` });
    } else if (metrics.sharpeRatio < 0.5 && metrics.trades.length > 10) {
      r.push({ type: 'warning', text: `Sharpe Ratio ${metrics.sharpeRatio} — низкая доходность относительно волатильности. Оптимизируйте тайминг входов.` });
    }

    // Trade count
    if (metrics.trades.length < 5) {
      r.push({ type: 'info', text: `Всего ${metrics.trades.length} сделок — слишком мало для статистической значимости. Увеличьте период или ослабьте фильтры.` });
    }

    // Expectancy
    if (metrics.expectancy > 0 && metrics.trades.length >= 5) {
      r.push({ type: 'info', text: `Математическое ожидание +$${metrics.expectancy} на сделку. В среднем каждая сделка приносит прибыль.` });
    }

    return r;
  }
}
