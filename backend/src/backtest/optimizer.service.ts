import { Injectable, Logger } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { Strategy } from '../strategies/strategy.entity';
import { CandlesService } from '../candles/candles.service';
import { AstCompilerService } from '../strategies/ast-compiler.service';

export interface OptimizationResult {
    params: any;
    profit: number;
    trades: number;
    sharpe: number;
    profitFactor?: number;
    winRate?: number;
    maxDrawdown?: number;
    score?: number;
}

@Injectable()
export class OptimizerService {
  private readonly logger = new Logger(OptimizerService.name);

  constructor(
      private readonly backtestService: BacktestService,
      private readonly candlesService: CandlesService,
      private readonly astCompiler: AstCompilerService,
  ) {}

  async optimize(
    strategy: Strategy,
    options: {
        pair?: string;
        timeframe?: string;
        days?: number;
        start?: string | Date;
        end?: string | Date;
        initialBalance?: number;
        fee?: number;
        tp?: number;
        sl?: number;
        positionSize?: number;
        useTrailingStop?: boolean;
        trailingDistance?: number;
        trailingActivation?: number;
        accurate?: boolean;
        latencyMs?: number;
        slippagePct?: number;
        executionAlgo?: 'MARKET' | 'TWAP' | 'VWAP';
        userLevels?: any[];
        iterations?: number;
        populationSize?: number;
    },
    paramsToOptimize?: any[]
  ): Promise<OptimizationResult[]> {
    const pair = options.pair || strategy.pair;
    const timeframe = options.timeframe || strategy.timeframe;
    const days = options.days || 30;
    const iterations = options.iterations || 10;
    const populationSize = options.populationSize || 20;

    let start = options.start ? new Date(options.start) : null;
    let end = options.end ? new Date(options.end) : new Date();
    if (!start) {
        start = new Date();
        start.setDate(start.getDate() - days);
    }

    this.logger.log(`Starting optimization for strategy ${strategy.name} (${pair} / ${timeframe}) from ${start.toISOString()} to ${end.toISOString()}...`);

    // 1. Identify optimizable parameters
    let optimizableParams: { nodeId: string; key: string; min: number; max: number; step?: number }[] = [];
    if (paramsToOptimize && paramsToOptimize.length > 0) {
        optimizableParams = this.getSelectedParamsToOptimize(paramsToOptimize);
    } else {
        optimizableParams = this.getOptimizableParams(strategy);
    }

    if (optimizableParams.length === 0) {
        throw new Error('No numeric parameters found to optimize');
    }

    // 2. Fetch candles once for all generations to avoid DB overhead
    let targetPair = pair;
    if (targetPair.includes('_TOP')) {
      targetPair = 'BTCUSDT';
    }
    const candles = await this.candlesService.getCandlesForRange(targetPair, timeframe, start, end);
    if (!candles || candles.length === 0) {
        throw new Error(`No historical candles found for ${targetPair} ${timeframe}`);
    }

    // 3. Initialize Population
    let population = this.generateInitialPopulation(optimizableParams, populationSize);
    
    // Track unique results across all evaluations
    const allEvaluatedResults: OptimizationResult[] = [];

    // 4. Evolve
    for (let gen = 0; gen < iterations; gen++) {
        this.logger.debug(`Generation ${gen + 1}/${iterations}...`);
        
        const genResults: OptimizationResult[] = [];
        for (const params of population) {
            const tempStrategy = this.applyParamsToStrategy(strategy, params);
            
            const currentTp = params['strategy:tp'] !== undefined ? params['strategy:tp'] : options.tp;
            const currentSl = params['strategy:sl'] !== undefined ? params['strategy:sl'] : options.sl;

            const backtest = await this.backtestService.runWithAst(tempStrategy.ast, tempStrategy, {
                start,
                end,
                initialBalance: options.initialBalance || 10000,
                fee: options.fee !== undefined ? options.fee : 0.001,
                tp: currentTp !== undefined ? currentTp : 0.02,
                sl: currentSl !== undefined ? currentSl : 0.02,
                positionSize: options.positionSize || 1,
                useTrailingStop: options.useTrailingStop || false,
                trailingDistance: params['strategy:trailingDistance'] !== undefined ? params['strategy:trailingDistance'] : (options.trailingDistance || 0.01),
                trailingActivation: params['strategy:trailingActivation'] !== undefined ? params['strategy:trailingActivation'] : (options.trailingActivation || 0.01),
                accurate: options.accurate || false,
                latencyMs: options.latencyMs || 0,
                slippagePct: options.slippagePct || 0,
                executionAlgo: options.executionAlgo || 'MARKET',
                userLevels: options.userLevels || [],
            }, candles);

            // Compute score/fitness
            const profit = backtest.totalReturn;
            const trades = backtest.totalTrades;
            const winRate = backtest.winRate || 0;
            const profitFactor = backtest.profitFactor || 0;
            const maxDrawdown = backtest.maxDrawdown || 0;
            const sharpe = backtest.sharpeRatio || 0;

            // Score favors high returns, low drawdown, high profit factor, high win rate, and penalizes having < 5 trades
            const tradeMultiplier = trades >= 5 ? 1 : (trades / 5.0);
            const score = profit * (winRate / 100) * (profitFactor || 1) * tradeMultiplier / Math.max(maxDrawdown || 1, 1);

            const evalResult: OptimizationResult = {
                params,
                profit,
                trades,
                sharpe,
                profitFactor,
                winRate,
                maxDrawdown,
                score
            };
            genResults.push(evalResult);
            allEvaluatedResults.push(evalResult);
        }

        // Sort generation results by score descending
        genResults.sort((a, b) => (b.score || 0) - (a.score || 0));

        // Create next generation
        population = this.evolve(genResults, optimizableParams);
    }

    // 5. Select top unique results from all runs
    const uniqueResults: OptimizationResult[] = [];
    const seenParams = new Set<string>();
    const seenScoreKey = new Set<string>();
    
    // Sort all evaluated results by score descending
    allEvaluatedResults.sort((a, b) => (b.score || 0) - (a.score || 0));

    for (const res of allEvaluatedResults) {
        // Round values in params representation for unique check and display
        const normalizedParams: any = {};
        Object.entries(res.params).forEach(([k, v]: [string, number]) => {
            if (k.includes('tp') || k.includes('sl') || k.includes('trailing')) {
                normalizedParams[k] = Number(v.toFixed(5));
            } else if (k.includes('period') || k.includes('minutes') || k.includes('value')) {
                normalizedParams[k] = Math.round(v);
            } else {
                normalizedParams[k] = Number(v.toFixed(4));
            }
        });

        const paramStr = JSON.stringify(normalizedParams);
        // Secondary key: score+profit+trades — для отсева дублей при малом числе параметров
        const scoreKey = `${(res.score||0).toFixed(6)}:${(res.profit||0).toFixed(4)}:${res.trades}`;
        
        if (!seenParams.has(paramStr) && !seenScoreKey.has(scoreKey)) {
            seenParams.add(paramStr);
            seenScoreKey.add(scoreKey);
            uniqueResults.push({
                ...res,
                params: normalizedParams
            });
        }
        if (uniqueResults.length >= 10) break;
    }

    return uniqueResults;
  }

  private getSelectedParamsToOptimize(paramsToOptimize: any[]) {
      return paramsToOptimize.map(p => {
          // If it's a percentage (like tp/sl), we convert it back to ratio/decimal for optimization
          let min = p.min;
          let max = p.max;
          if (p.nodeId === 'strategy') {
              min = min / 100;
              max = max / 100;
          }
          return {
              nodeId: p.nodeId,
              key: p.paramName,
              min,
              max,
              step: p.step || 0.001
          };
      });
  }

  private getOptimizableParams(strategy: Strategy) {
      const params: { nodeId: string; key: string; min: number; max: number; step?: number }[] = [];
      if (!strategy.nodes) return params;

      strategy.nodes.forEach((node: any) => {
          if (node.data?.params) {
              Object.entries(node.data.params).forEach(([key, val]) => {
                  if (typeof val === 'number') {
                      let min = val * 0.5;
                      let max = val * 2.0;
                      let step = undefined;
                      if (key.toLowerCase().includes('period') || key.toLowerCase().includes('minutes')) { min = 2; max = 200; step = 1; }
                      if (key.toLowerCase().includes('score') || key.toLowerCase().includes('threshold')) { min = 0; max = 1; step = 0.01; }
                      
                      params.push({ nodeId: node.id, key, min, max, step });
                  }
              });
          }
          // Support comparison nodes threshold value optimization
          if (node.type === 'comparison' && typeof node.data?.value === 'number') {
              const val = node.data.value;
              let min = Math.max(0, val - 20);
              let max = val + 20;
              let step = 1;
              if (val >= 0 && val <= 1) {
                  min = Math.max(0, val - 0.2);
                  max = Math.min(1, val + 0.2);
                  step = 0.01;
              }
              params.push({ nodeId: node.id, key: 'value', min, max, step });
          }
      });

      // Add strategy-level TP/SL as optimizable parameters
      const isScalping = ['1m', '3m', '5m', '15m'].includes(strategy.timeframe);
      params.push({
          nodeId: 'strategy',
          key: 'tp',
          min: isScalping ? 0.001 : 0.005, // 0.1% to 2% for scalping, 0.5% to 5% otherwise
          max: isScalping ? 0.02 : 0.05,
          step: 0.0005
      });
      params.push({
          nodeId: 'strategy',
          key: 'sl',
          min: isScalping ? 0.001 : 0.005,
          max: isScalping ? 0.02 : 0.05,
          step: 0.0005
      });

      return params;
  }

  private generateInitialPopulation(params: any[], size: number) {
      return Array.from({ length: size }, () => {
          const individual: any = {};
          params.forEach(p => {
              let val = p.min + Math.random() * (p.max - p.min);
              if (p.step !== undefined && p.step > 0) {
                  val = Math.round(val / p.step) * p.step;
              } else if (p.key.toLowerCase().includes('period') || p.key.toLowerCase().includes('minutes')) {
                  val = Math.round(val);
              }
              individual[`${p.nodeId}:${p.key}`] = val;
          });
          return individual;
      });
  }

  private applyParamsToStrategy(strategy: Strategy, params: any): Strategy {
      const cloned = JSON.parse(JSON.stringify(strategy));
      Object.entries(params).forEach(([combinedKey, val]) => {
          const [nodeId, key] = combinedKey.split(':');
          
          if (nodeId === 'strategy') {
              if (!cloned.execution_settings) {
                  cloned.execution_settings = {};
              }
              if (key === 'tp') {
                  cloned.execution_settings.tpPercent = (val as number) * 100;
              } else if (key === 'sl') {
                  cloned.execution_settings.slPercent = (val as number) * 100;
              }
              return;
          }

          const node = cloned.nodes?.find((n: any) => n.id === nodeId);
          if (node) {
              if (node.type === 'comparison') {
                  if (!node.data) node.data = {};
                  node.data.value = val;
              } else if (node.data?.params) {
                  node.data.params[key] = val;
              }
          }
      });
      
      // Recompile compiled AST so that the backtester uses the new parameters
      if (cloned.nodes && cloned.edges) {
          try {
              cloned.ast = this.astCompiler.compile(cloned.nodes, cloned.edges);
          } catch (e) {
              this.logger.error(`Failed to compile AST during parameter application: ${e.message}`);
          }
      }
      
      return cloned;
  }

  private evolve(results: OptimizationResult[], paramDefs: any[]) {
      const nextGen = [];
      const eliteCount = Math.max(1, Math.floor(results.length * 0.2));
      
      // 1. Elitism: keep the best
      for (let i = 0; i < eliteCount; i++) {
          nextGen.push(results[i].params);
      }

      // 2. Crossover & Mutation
      while (nextGen.length < results.length) {
          const parentA = results[Math.floor(Math.random() * eliteCount)].params;
          const parentB = results[Math.floor(Math.random() * eliteCount)].params;
          
          const child: any = {};
          paramDefs.forEach(p => {
              const combinedKey = `${p.nodeId}:${p.key}`;
              // Crossover
              child[combinedKey] = Math.random() > 0.5 ? parentA[combinedKey] : parentB[combinedKey];
              
              // Mutation (10% chance)
              if (Math.random() < 0.1) {
                  const range = p.max - p.min;
                  child[combinedKey] += (Math.random() - 0.5) * range * 0.2;
                  child[combinedKey] = Math.max(p.min, Math.min(p.max, child[combinedKey]));
                  
                  if (p.step !== undefined && p.step > 0) {
                      child[combinedKey] = Math.round(child[combinedKey] / p.step) * p.step;
                  } else if (p.key.toLowerCase().includes('period') || p.key.toLowerCase().includes('minutes')) {
                      child[combinedKey] = Math.round(child[combinedKey]);
                  }
              }
          });
          nextGen.push(child);
      }

      return nextGen;
  }
}
