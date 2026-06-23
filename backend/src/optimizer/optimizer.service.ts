import { Injectable, Logger } from '@nestjs/common';
import { BacktestService, BacktestOptions } from '../backtest/backtest.service';
import { Strategy } from '../strategies/strategy.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandlesService } from '../candles/candles.service';
import { SignalsGateway } from '../signals/signals.gateway';

export interface OptimizerParam {
  nodeId: string;
  paramName: string; // e.g. "period"
  min: number;
  max: number;
  step?: number;
}

export interface OptimizationResult {
  params: any;
  profit: number;
  trades: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  score: number;
}

@Injectable()
export class OptimizerService {
  private readonly logger = new Logger(OptimizerService.name);

  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
    private backtestService: BacktestService,
    private candlesService: CandlesService,
    private signalsGateway: SignalsGateway,
  ) {}

  async runOptimization(strategyId: number, options: BacktestOptions, params: OptimizerParam[]) {
    const strategy = await this.strategyRepository.findOneBy({ id: strategyId });
    if (!strategy) throw new Error('Strategy not found');

    // 1. Identify optimizable parameters (use passed list or dynamically detect from AST)
    const optParams = params && params.length > 0 ? params : this.getOptimizableParams(strategy);
    if (optParams.length === 0) {
      throw new Error('No numeric parameters found to optimize');
    }

    this.logger.log(`Starting evolutionary optimization for ${strategy.name} with ${optParams.length} params`);
    
    // Coerce start/end to Date objects
    options.start = new Date(options.start);
    options.end = new Date(options.end);

    // 2. Broadcast initial progress & fetch candles once
    this.signalsGateway.broadcastBacktestProgress(strategyId, 5, '📥 Подготовка исторических данных...');
    await this.candlesService.ensureHistoricalData(strategy.pair, strategy.timeframe, options.start, options.end);
    const candles = await this.candlesService.getCandlesForRange(strategy.pair, strategy.timeframe, options.start, options.end);

    // 3. Evolutionary parameters
    const iterations = 10;
    const populationSize = 20;
    const concurrencyLimit = 10;

    // 4. Initialize Population
    let population = this.generateInitialPopulation(optParams, populationSize);
    let bestResult: OptimizationResult | null = null;

    // 5. Evolutionary loop
    for (let gen = 0; gen < iterations; gen++) {
      this.logger.debug(`Generation ${gen + 1}/${iterations}...`);
      
      const results: OptimizationResult[] = [];

      // Batch evaluate population in parallel
      for (let i = 0; i < population.length; i += concurrencyLimit) {
        const batch = population.slice(i, i + concurrencyLimit);
        const batchResults = await Promise.all(batch.map(async (candidate) => {
          const optimizedAst = JSON.parse(JSON.stringify(strategy.ast));
          
          for (const [key, value] of Object.entries(candidate)) {
            const [nodeId, paramName] = key.split(':');
            this.updateAstNodeParam(optimizedAst, nodeId, paramName, value as number);
          }

          try {
            const res = await this.backtestService.runWithAst(optimizedAst, strategy, options, candles);
            return {
              params: candidate,
              profit: res.totalReturn,
              trades: res.totalTrades,
              sharpe: res.sharpeRatio || 0,
              maxDrawdown: res.maxDrawdown || 0,
              winRate: res.winRate || 0,
              profitFactor: res.profitFactor || 1,
              score: this.calculateFitness(res),
            };
          } catch (e) {
            this.logger.error(`Optimization failed for candidate ${JSON.stringify(candidate)}: ${e.message}`);
            return null;
          }
        }));

        results.push(...batchResults.filter(r => r !== null));
      }

      if (results.length === 0) continue;

      // Sort by fitness score (descending)
      results.sort((a, b) => b.score - a.score);

      // Keep overall best performer
      if (!bestResult || results[0].score > bestResult.score) {
        bestResult = results[0];
      }

      // Broadcast progress per generation
      const genMsg = `🧬 Эволюция: поколение ${gen + 1}/${iterations} | Доход: +${bestResult.profit.toFixed(2)}% | Сделок: ${bestResult.trades}`;
      this.signalsGateway.broadcastBacktestProgress(
        strategyId,
        Math.round(5 + ((gen + 1) / iterations) * 90),
        genMsg
      );

      // Create next generation
      const eliteCount = Math.max(1, Math.floor(results.length * 0.2));
      const nextGen: any[] = results.slice(0, eliteCount).map(r => r.params);

      while (nextGen.length < populationSize) {
        const parentA = results[Math.floor(Math.random() * eliteCount)].params;
        const parentB = results[Math.floor(Math.random() * eliteCount)].params;

        const child: any = {};
        optParams.forEach(p => {
          const key = `${p.nodeId}:${p.paramName}`;
          // Crossover
          child[key] = Math.random() > 0.5 ? parentA[key] : parentB[key];

          // Mutation (15% chance)
          if (Math.random() < 0.15) {
            const range = p.max - p.min;
            const mutationAmount = (Math.random() - 0.5) * range * 0.2;
            child[key] += mutationAmount;
            child[key] = Math.max(p.min, Math.min(p.max, child[key]));
            if (p.paramName.toLowerCase().includes('period') || p.paramName.toLowerCase().includes('minutes')) {
              child[key] = Math.round(child[key]);
            } else {
              child[key] = parseFloat(child[key].toFixed(4));
            }
          }
        });
        nextGen.push(child);
      }

      population = nextGen;
    }

    // 6. Complete optimization progress broadcast
    this.signalsGateway.broadcastBacktestProgress(strategyId, 100, '✅ Эволюционный подбор завершен!');

    // Return the top candidates (we return the best candidate inside an array to conform to frontend expectations)
    return bestResult ? [bestResult] : [];
  }

  private getOptimizableParams(strategy: Strategy): OptimizerParam[] {
    const params: OptimizerParam[] = [];
    if (!strategy.ast || !Array.isArray(strategy.ast.nodes)) return params;

    strategy.ast.nodes.forEach(node => {
      if (node.data?.params) {
        Object.entries(node.data.params).forEach(([key, val]) => {
          if (typeof val === 'number') {
            // Heuristic bounds based on parameter type
            let min = val * 0.5;
            let max = val * 2.0;
            if (key.toLowerCase().includes('period') || key.toLowerCase().includes('minutes')) {
              min = 2;
              max = 200;
            }
            if (key.toLowerCase().includes('score') || key.toLowerCase().includes('threshold')) {
              min = 0;
              max = 1;
            }
            params.push({
              nodeId: node.id,
              paramName: key,
              min,
              max,
            });
          }
        });
      }
    });
    return params;
  }

  private generateInitialPopulation(params: OptimizerParam[], size: number) {
    return Array.from({ length: size }, () => {
      const individual: any = {};
      params.forEach(p => {
        const val = p.min + Math.random() * (p.max - p.min);
        const combinedKey = `${p.nodeId}:${p.paramName}`;
        if (p.paramName.toLowerCase().includes('period') || p.paramName.toLowerCase().includes('minutes')) {
          individual[combinedKey] = Math.round(val);
        } else {
          individual[combinedKey] = parseFloat(val.toFixed(4));
        }
      });
      return individual;
    });
  }

  private updateAstNodeParam(node: any, nodeId: string, paramName: string, value: number) {
    if (!node || typeof node !== 'object') return;

    // Check if this is the target node
    if (node.id === nodeId && node.params) {
      node.params[paramName] = value;
      return;
    }

    // Recursive AST traversal
    if (node.condition) this.updateAstNodeParam(node.condition, nodeId, paramName, value);
    if (node.left) this.updateAstNodeParam(node.left, nodeId, paramName, value);
    if (node.right) this.updateAstNodeParam(node.right, nodeId, paramName, value);
    if (node.operands) {
      for (const op of node.operands) {
        this.updateAstNodeParam(op, nodeId, paramName, value);
      }
    }
    if (node.a) this.updateAstNodeParam(node.a, nodeId, paramName, value);
    if (node.b) this.updateAstNodeParam(node.b, nodeId, paramName, value);
  }

  private calculateFitness(res: any): number {
    if (!res || res.totalTrades < 3) return 0;
    
    // Advanced Fitness metric = ProfitFactor * (WinRate/100) * log10(Trades) * DrawdownFactor
    const pf = res.profitFactor === Infinity ? 5 : (res.profitFactor || 1);
    const wr = (res.winRate || 50) / 100;
    const tradeFactor = Math.log10(res.totalTrades);
    const ddFactor = Math.max(0.01, 1 - ((res.maxDrawdown || 0) / 50)); // Heavy penalty if DD > 50%
    const profitScore = res.totalReturn > 0 ? Math.sqrt(res.totalReturn) : 0;

    return profitScore * pf * wr * tradeFactor * ddFactor;
  }
}
