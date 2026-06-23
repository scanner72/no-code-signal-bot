import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotInstance } from './bot-instance.entity';
import { IndicatorsService } from '../indicators/indicators.service';
import { CandlesService } from '../candles/candles.service';

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    @InjectRepository(BotInstance)
    private instanceRepo: Repository<BotInstance>,
    private indicators: IndicatorsService,
    private candlesService: CandlesService,
  ) {}

  async getPortfolioRisk() {
    const activeInstances = await this.instanceRepo.find({
      where: { status: 'RUNNING' },
    });

    const pairs = [...new Set(activeInstances.map(i => i.pair))];
    if (pairs.length < 2) return { correlationMatrix: {}, totalExposure: 0 };

    // 1. Calculate Correlation Matrix
    const matrix: Record<string, Record<string, number>> = {};
    const priceCache: Record<string, number[]> = {};

    // Fetch last 50 candles for all pairs
    for (const pair of pairs) {
        const candles = await this.candlesService.getLatestCandles(pair, '1h', 50);
        priceCache[pair] = candles.map(c => parseFloat(c.close.toString())).reverse();
    }

    for (const p1 of pairs) {
        matrix[p1] = {};
        for (const p2 of pairs) {
            if (p1 === p2) {
                matrix[p1][p2] = 1;
                continue;
            }
            const len = Math.min(priceCache[p1].length, priceCache[p2].length, 50);
            matrix[p1][p2] = this.indicators.calculateCorrelation(
                priceCache[p1].slice(-len),
                priceCache[p2].slice(-len)
            );
        }
    }

    // 2. Calculate Exposure
    const totalExposure = activeInstances.reduce((sum, i) => sum + (i.currentPosition ? i.currentBalance : 0), 0);

    return {
        correlationMatrix: matrix,
        totalExposure,
        activePairsCount: pairs.length,
        warnings: this.generateRiskWarnings(matrix, activeInstances)
    };
  }

  private generateRiskWarnings(matrix: any, instances: BotInstance[]) {
      const warnings = [];
      const pairs = Object.keys(matrix);
      
      for (let i = 0; i < pairs.length; i++) {
          for (let j = i + 1; j < pairs.length; j++) {
              const p1 = pairs[i];
              const p2 = pairs[j];
              const corr = matrix[p1][p2];
              
              if (corr > 0.85) {
                  const inst1 = instances.filter(inst => inst.pair === p1 && inst.currentPosition);
                  const inst2 = instances.filter(inst => inst.pair === p2 && inst.currentPosition);
                  
                  if (inst1.length > 0 && inst2.length > 0) {
                      warnings.push(`Высокая корреляция (${corr.toFixed(2)}) между ${p1} и ${p2}. Риск одновременного убытка!`);
                  }
              }
          }
      }
      return warnings;
  }
}
