import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';
import { CandlesService } from '../candles/candles.service';
import { IndicatorsService } from '../indicators/indicators.service';

export interface GridLevel {
  levelIndex: number;
  price: number;
  amount: number;
}

@Injectable()
export class GridManagerService {
  private readonly logger = new Logger(GridManagerService.name);

  constructor(
    @InjectRepository(Strategy)
    private readonly strategyRepository: Repository<Strategy>,
    private readonly candlesService: CandlesService,
    private readonly indicatorsService: IndicatorsService,
  ) {}

  async calculateGridLevels(strategyId: number, currentPrice: number): Promise<GridLevel[]> {
    const strategy = await this.strategyRepository.findOne({ where: { id: strategyId } });
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    const settings = strategy.execution_settings || {};
    const useAtrSpacing = settings.useAtrSpacing ?? false;
    const gridLevelsCount = settings.gridLevelsCount ?? 5;
    const totalExposure = settings.totalExposure ?? 500; // Total size in USD
    const distribution = settings.distribution ?? 'arithmetic'; // 'arithmetic' | 'geometric'

    let spacingStepPrice = 0;

    if (useAtrSpacing) {
      const atrPeriod = settings.atrPeriod ?? 14;
      const atrTimeframe = settings.atrTimeframe ?? strategy.timeframe ?? '1h';
      const atrMultiplier = settings.atrMultiplier ?? 1.5;

      try {
        // Fetch historical candles to compute ATR
        const candles = await this.candlesService.getLatestCandles(strategy.pair, atrTimeframe, atrPeriod + 20);
        if (candles && candles.length >= atrPeriod) {
          const highs = candles.map(c => Number(c.high)).reverse();
          const lows = candles.map(c => Number(c.low)).reverse();
          const closes = candles.map(c => Number(c.close)).reverse();

          const atrValues = this.indicatorsService.calculateATR(highs, lows, closes, atrPeriod);
          const latestAtr = atrValues[atrValues.length - 1];

          if (latestAtr && latestAtr > 0) {
            spacingStepPrice = latestAtr * atrMultiplier;
            this.logger.log(
              `[ATR Grid] Calculated ATR spacing for ${strategy.pair}: ATR(${atrPeriod}) = ${latestAtr.toFixed(4)}, ` +
              `Step = ${spacingStepPrice.toFixed(4)} (${atrMultiplier}x)`
            );
          }
        }
      } catch (err) {
        this.logger.warn(`[ATR Grid] Failed to compute ATR spacing for strategy ${strategyId}: ${err.message}. Falling back to percent.`);
      }
    }

    // Fallback if useAtrSpacing is false or ATR calculation failed
    if (spacingStepPrice === 0) {
      const spacingPercent = settings.spacingPercent ?? 1.0; // Default 1% spacing
      spacingStepPrice = currentPrice * (spacingPercent / 100);
      this.logger.log(`[Percent Grid] Calculated grid spacing: Step = ${spacingStepPrice.toFixed(4)} (${spacingPercent}%)`);
    }

    const levels: GridLevel[] = [];
    const exposurePerLevel = totalExposure / gridLevelsCount;

    for (let i = 1; i <= gridLevelsCount; i++) {
      let levelPrice = 0;

      if (distribution === 'geometric') {
        const spacingPercent = (spacingStepPrice / currentPrice);
        levelPrice = currentPrice * Math.pow(1 - spacingPercent, i);
      } else {
        // Arithmetic spacing (linear step spacing)
        levelPrice = currentPrice - (i * spacingStepPrice);
      }

      // Ensure price is greater than 0
      if (levelPrice <= 0) continue;

      // Round price to standard step size or decimals if needed (let's keep 4 decimals for precision)
      const roundedPrice = Math.round(levelPrice * 10000) / 10000;
      const orderAmount = exposurePerLevel / roundedPrice;
      const roundedAmount = Math.round(orderAmount * 10000) / 10000;

      levels.push({
        levelIndex: i,
        price: roundedPrice,
        amount: roundedAmount,
      });
    }

    return levels;
  }
}
