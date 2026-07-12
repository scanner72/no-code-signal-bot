import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';
import { CandlesService } from '../candles/candles.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { GridLevelOrder, GridOrderStatus } from './grid-level-order.entity';
import { CCXTQueueService } from './ccxt-queue.service';
import { CrossExchangeService } from '../cross-exchange/cross-exchange.service';

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
    @InjectRepository(GridLevelOrder)
    private readonly gridOrderRepository: Repository<GridLevelOrder>,
    private readonly candlesService: CandlesService,
    private readonly indicatorsService: IndicatorsService,
    private readonly ccxtQueueService: CCXTQueueService,
    private readonly crossExchangeService: CrossExchangeService,
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
        levelPrice = currentPrice - (i * spacingStepPrice);
      }

      if (levelPrice <= 0) continue;

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

  /**
   * B4: Real grid order placement via ccxt-queue + Inventory control.
   */
  async executeGrid(strategyId: number, currentPrice: number): Promise<string[]> {
    const strategy = await this.strategyRepository.findOne({ where: { id: strategyId } });
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    const execSettings = strategy.execution_settings || {};
    if (!execSettings.enableLiveExecution) {
      this.logger.log(`[Grid Execution] Live execution disabled for strategy ${strategy.name}`);
      return [];
    }

    const exchangeId = execSettings.exchangeId || 'binance';
    const creds = execSettings.creds;

    // 1. Inventory Control: check base asset share in portfolio to balance exposure
    let btcShare = 0;
    try {
      if (creds && creds.apiKey) {
        const client = this.crossExchangeService.getExchange(exchangeId, creds);
        if (typeof client.fetchBalance === 'function') {
          const balance = await client.fetchBalance();
          const parts = strategy.pair.split('/');
          const baseAsset = parts[0];
          const quoteAsset = parts[1] || 'USDT';
          const baseBalance = (balance.total as any)?.[baseAsset] ?? 0;
          const quoteBalance = (balance.total as any)?.[quoteAsset] ?? 0;

          const baseValueUsd = baseBalance * currentPrice;
          const totalValueUsd = baseValueUsd + quoteBalance;
          if (totalValueUsd > 0) {
            btcShare = baseValueUsd / totalValueUsd;
          }
        }
      }
    } catch (err) {
      this.logger.warn(`[Grid Inventory] Failed to fetch balances for inventory control: ${err.message}`);
    }

    const levels = await this.calculateGridLevels(strategyId, currentPrice);
    const jobIds: string[] = [];

    const isHighExposure = btcShare > 0.7;
    if (isHighExposure) {
      this.logger.warn(`[Grid Inventory] Portfolio is skewed towards base asset: ${(btcShare * 100).toFixed(1)}% (> 70%). Halving buy order sizes to manage inventory risk.`);
    }

    for (const level of levels) {
      // If we are overexposed to base asset, halve the buying amount
      const targetAmount = isHighExposure ? level.amount * 0.5 : level.amount;
      const roundedAmount = Math.round(targetAmount * 10000) / 10000;

      if (roundedAmount <= 0) continue;

      const jobId = await this.ccxtQueueService.enqueueOrder({
        strategyId,
        exchangeId: exchangeId as any,
        pair: strategy.pair,
        side: 'buy',
        type: 'limit',
        amount: roundedAmount,
        price: level.price,
        creds,
      });

      // Save to database
      const gridOrder = this.gridOrderRepository.create({
        strategy_id: strategyId,
        pair: strategy.pair,
        level_index: level.levelIndex,
        job_id: jobId,
        price: level.price,
        amount: roundedAmount,
        side: 'buy',
        status: GridOrderStatus.ACTIVE,
      });
      await this.gridOrderRepository.save(gridOrder);

      this.logger.log(`[Grid Execution] Enqueued BUY level ${level.levelIndex} | Price: ${level.price} | Amount: ${roundedAmount} | Job ID: ${jobId}`);
      jobIds.push(jobId);
    }

    return jobIds;
  }

  /**
   * Associates Bull Job ID with the actual Exchange Order ID once placed.
   */
  async linkExchangeOrderId(jobId: string, exchangeOrderId: string): Promise<void> {
    const gridOrder = await this.gridOrderRepository.findOne({ where: { job_id: jobId } });
    if (gridOrder) {
      gridOrder.exchange_order_id = exchangeOrderId;
      await this.gridOrderRepository.save(gridOrder);
      this.logger.log(`[Grid Link] Linked Job ${jobId} to Exchange Order ${exchangeOrderId}`);
    }
  }

  /**
   * Listens to order updates. When a BUY order is filled, place a SELL limit order.
   * When a SELL order is filled, place a BUY limit order.
   */
  async handleOrderUpdate(exchangeOrderId: string, status: string): Promise<void> {
    const cleanStatus = status.toLowerCase();
    if (cleanStatus !== 'closed' && cleanStatus !== 'filled') {
      return;
    }

    const gridOrder = await this.gridOrderRepository.findOne({
      where: { exchange_order_id: exchangeOrderId, status: GridOrderStatus.ACTIVE },
    });

    if (!gridOrder) return;

    this.logger.log(`[Grid Update] Grid level order ${exchangeOrderId} (${gridOrder.side.toUpperCase()}) filled. Processing next grid step.`);

    // 1. Mark filled order in DB
    gridOrder.status = GridOrderStatus.FILLED;
    gridOrder.updated_at = new Date();
    await this.gridOrderRepository.save(gridOrder);

    // 2. Fetch strategy settings to calculate step size
    const strategy = await this.strategyRepository.findOne({ where: { id: gridOrder.strategy_id } });
    if (!strategy) {
      throw new Error(`Strategy ${gridOrder.strategy_id} not found`);
    }

    const settings = strategy.execution_settings || {};
    const spacingPercent = settings.spacingPercent ?? 1.0;
    const spacingPrice = Number(gridOrder.price) * (spacingPercent / 100);

    const exchangeId = settings.exchangeId || 'binance';
    const creds = settings.creds;

    const nextSide = gridOrder.side === 'buy' ? 'sell' : 'buy';
    const nextPrice = gridOrder.side === 'buy' 
      ? Number(gridOrder.price) + spacingPrice 
      : Number(gridOrder.price) - spacingPrice;
    
    const roundedPrice = Math.round(nextPrice * 10000) / 10000;

    if (roundedPrice <= 0) return;

    // Place counterpart order
    const nextJobId = await this.ccxtQueueService.enqueueOrder({
      strategyId: gridOrder.strategy_id,
      exchangeId: exchangeId as any,
      pair: gridOrder.pair,
      side: nextSide,
      type: 'limit',
      amount: Number(gridOrder.amount),
      price: roundedPrice,
      creds,
    });

    // Save next level order
    const nextGridOrder = this.gridOrderRepository.create({
      strategy_id: gridOrder.strategy_id,
      pair: gridOrder.pair,
      level_index: gridOrder.level_index,
      job_id: nextJobId,
      price: roundedPrice,
      amount: Number(gridOrder.amount),
      side: nextSide,
      status: GridOrderStatus.ACTIVE,
    });

    await this.gridOrderRepository.save(nextGridOrder);
    this.logger.log(`[Grid Counterpart] Placed counterpart ${nextSide.toUpperCase()} | Price: ${roundedPrice} | Job ID: ${nextJobId}`);
  }
}
