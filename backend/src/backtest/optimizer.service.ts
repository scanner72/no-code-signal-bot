import { Injectable, Logger } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { Strategy } from '../strategies/strategy.entity';

export interface OptimizationResult {
    params: any;
    profit: number;
    trades: number;
    sharpe: number;
}

@Injectable()
export class OptimizerService {
  private readonly logger = new Logger(OptimizerService.name);

  constructor(private readonly backtestService: BacktestService) {}

  async optimize(strategy: Strategy, config: { 
      pair: string; 
      timeframe: string; 
      days: number;
      iterations: number;
      populationSize: number;
  }) {
    this.logger.log(`Starting optimization for strategy ${strategy.name} on ${config.pair}...`);
    
    // 1. Identify optimizable parameters (numeric params in nodes)
    const optimizableParams = this.getOptimizableParams(strategy);
    if (optimizableParams.length === 0) {
        throw new Error('No numeric parameters found to optimize');
    }

    // 2. Initialize Population
    let population = this.generateInitialPopulation(optimizableParams, config.populationSize);
    let bestResult: OptimizationResult | null = null;

    // 3. Evolve
    for (let gen = 0; gen < config.iterations; gen++) {
        this.logger.debug(`Generation ${gen + 1}/${config.iterations}...`);
        
        const results: OptimizationResult[] = [];
        for (const params of population) {
            const tempStrategy = this.applyParamsToStrategy(strategy, params);
            const start = new Date();
            start.setDate(start.getDate() - config.days);
            
            const backtest = await this.backtestService.runWithAst(tempStrategy.ast, tempStrategy, {
                start,
                end: new Date(),
                initialBalance: 10000,
                fee: 0.001,
                tp: 0.02,
                sl: 0.02,
                positionSize: 1,
            });

            results.push({
                params,
                profit: backtest.totalReturn,
                trades: backtest.totalTrades,
                sharpe: backtest.sharpeRatio || 0
            });
        }

        // Sort by fitness (Profit * Trades factor to avoid over-fitting on 1 trade)
        results.sort((a, b) => (b.profit * Math.min(b.trades, 10)) - (a.profit * Math.min(a.trades, 10)));
        
        if (!bestResult || results[0].profit > bestResult.profit) {
            bestResult = results[0];
        }

        // Create next generation
        population = this.evolve(results, optimizableParams);
    }

    return bestResult;
  }

  private getOptimizableParams(strategy: Strategy) {
      const params: { nodeId: string; key: string; min: number; max: number }[] = [];
      strategy.ast.nodes.forEach(node => {
          if (node.data?.params) {
              Object.entries(node.data.params).forEach(([key, val]) => {
                  if (typeof val === 'number') {
                      // Define bounds based on param type (heuristic)
                      let min = val * 0.5;
                      let max = val * 2.0;
                      if (key.toLowerCase().includes('period') || key.toLowerCase().includes('minutes')) { min = 2; max = 200; }
                      if (key.toLowerCase().includes('score') || key.toLowerCase().includes('threshold')) { min = 0; max = 1; }
                      
                      params.push({ nodeId: node.id, key, min, max });
                  }
              });
          }
      });
      return params;
  }

  private generateInitialPopulation(params: any[], size: number) {
      return Array.from({ length: size }, () => {
          const individual: any = {};
          params.forEach(p => {
              individual[`${p.nodeId}:${p.key}`] = p.min + Math.random() * (p.max - p.min);
              // Round if it looks like a period
              if (p.key.toLowerCase().includes('period') || p.key.toLowerCase().includes('minutes')) {
                  individual[`${p.nodeId}:${p.key}`] = Math.round(individual[`${p.nodeId}:${p.key}`]);
              }
          });
          return individual;
      });
  }

  private applyParamsToStrategy(strategy: Strategy, params: any): Strategy {
      const cloned = JSON.parse(JSON.stringify(strategy));
      Object.entries(params).forEach(([combinedKey, val]) => {
          const [nodeId, key] = combinedKey.split(':');
          const node = cloned.ast.nodes.find((n: any) => n.id === nodeId);
          if (node && node.data?.params) {
              node.data.params[key] = val;
          }
      });
      return cloned;
  }

  private evolve(results: OptimizationResult[], paramDefs: any[]) {
      const nextGen = [];
      const eliteCount = Math.floor(results.length * 0.2);
      
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
                  if (p.key.toLowerCase().includes('period') || p.key.toLowerCase().includes('minutes')) {
                      child[combinedKey] = Math.round(child[combinedKey]);
                  }
              }
          });
          nextGen.push(child);
      }

      return nextGen;
  }
}
