import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { OnEvent } from '@nestjs/event-emitter';
import { AlgoExecutionState, AlgoExecutionStatus } from './algo-execution-state.entity';
import { Strategy } from '../strategies/strategy.entity';
import { CandlesService } from '../candles/candles.service';
import { BinanceApiService } from '../candles/binance-api.service';

@Injectable()
export class AlgoExecutionService {
  private readonly logger = new Logger(AlgoExecutionService.name);

  constructor(
    @InjectRepository(AlgoExecutionState)
    private readonly algoRepo: Repository<AlgoExecutionState>,
    @InjectRepository(Strategy)
    private readonly strategyRepo: Repository<Strategy>,
    @InjectQueue('orders-execution')
    private readonly orderQueue: Queue,
    private readonly candlesService: CandlesService,
    private readonly binanceApi: BinanceApiService,
  ) {}

  /**
   * Schedules a TWAP execution by dividing totalAmount into equal parts
   * and queuing them in Bull Queue with delay offsets.
   */
  async scheduleTwap(
    strategyId: number,
    pair: string,
    side: 'buy' | 'sell',
    totalAmount: number,
    settings: any,
    creds?: any,
  ): Promise<AlgoExecutionState> {
    const slices = parseInt(settings.algoSlicesCount, 10) || 10;
    const durationMinutes = parseInt(settings.algoDurationMinutes, 10) || 30;
    const durationMs = durationMinutes * 60 * 1000;
    const intervalMs = Math.floor(durationMs / slices);
    const sliceAmount = totalAmount / slices;

    this.logger.log(
      `Scheduling TWAP for Strategy ${strategyId} (${pair}): Total ${totalAmount}, Slices: ${slices}, Interval: ${intervalMs / 1000}s`,
    );

    // 1. Create execution state
    const execution = this.algoRepo.create({
      strategyId,
      pair,
      side,
      algoType: 'TWAP',
      totalAmount,
      executedAmount: 0,
      status: AlgoExecutionStatus.RUNNING,
      bullJobIds: [],
    });
    const saved = await this.algoRepo.save(execution);

    const jobIds: string[] = [];

    // 2. Queue slices with delay
    for (let i = 0; i < slices; i++) {
      const delay = i * intervalMs;
      const job = await this.orderQueue.add(
        'execute-algo-slice',
        {
          executionId: saved.id,
          strategyId,
          pair,
          side,
          amount: sliceAmount,
          sliceIndex: i,
          totalSlices: slices,
          creds,
          exchangeId: settings.exchangeId || 'binance',
        },
        {
          delay,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
        },
      );
      jobIds.push(String(job.id));
    }

    saved.bullJobIds = jobIds;
    return this.algoRepo.save(saved);
  }

  /**
   * Schedules a VWAP execution by calculating historical volume-based weights
   * and queuing them in Bull Queue with delayed offsets.
   */
  async scheduleVwap(
    strategyId: number,
    pair: string,
    side: 'buy' | 'sell',
    totalAmount: number,
    settings: any,
    creds?: any,
  ): Promise<AlgoExecutionState> {
    const slices = parseInt(settings.algoSlicesCount, 10) || 10;
    const durationMinutes = parseInt(settings.algoDurationMinutes, 10) || 30;
    const durationMs = durationMinutes * 60 * 1000;
    const intervalMs = Math.floor(durationMs / slices);
    const lookbackDays = parseInt(settings.vwapLookbackDays, 10) || 5;

    this.logger.log(
      `Scheduling VWAP for Strategy ${strategyId} (${pair}): Total ${totalAmount}, Slices: ${slices}, Duration: ${durationMinutes}m`,
    );

    // 1. Calculate weights based on volume profile
    let weights = await this.calculateVwapWeights(pair, lookbackDays, slices, durationMs);

    // Safety fallback to equal weights (TWAP-style) if weight calculation returned zeros
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      weights = Array(slices).fill(1 / slices);
    }

    // 2. Create execution state
    const execution = this.algoRepo.create({
      strategyId,
      pair,
      side,
      algoType: 'VWAP',
      totalAmount,
      executedAmount: 0,
      status: AlgoExecutionStatus.RUNNING,
      bullJobIds: [],
    });
    const saved = await this.algoRepo.save(execution);

    const jobIds: string[] = [];

    // 3. Queue slices with delay and weighted amounts
    for (let i = 0; i < slices; i++) {
      const delay = i * intervalMs;
      const sliceAmount = totalAmount * weights[i];

      const job = await this.orderQueue.add(
        'execute-algo-slice',
        {
          executionId: saved.id,
          strategyId,
          pair,
          side,
          amount: sliceAmount,
          sliceIndex: i,
          totalSlices: slices,
          creds,
          exchangeId: settings.exchangeId || 'binance',
        },
        {
          delay,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
        },
      );
      jobIds.push(String(job.id));
    }

    saved.bullJobIds = jobIds;
    return this.algoRepo.save(saved);
  }

  /**
   * Calculates execution slice weights by looking at average trading volume
   * during the same time window over the last N days.
   */
  private async calculateVwapWeights(
    pair: string,
    lookbackDays: number,
    slices: number,
    durationMs: number,
  ): Promise<number[]> {
    const weights = Array(slices).fill(0);
    try {
      const now = new Date();
      const intervalMs = Math.floor(durationMs / slices);

      // Define start/end minutes from midnight for the execution window
      const startMsOfDay = now.getTime() - new Date(now).setUTCHours(0, 0, 0, 0);
      const endMsOfDay = startMsOfDay + durationMs;

      // We will look back lookbackDays days
      const daysVolume = Array(slices).fill(0);

      // Fetch 1m/5m candles to calculate volume profile. Let's try 5m candles first as a good balance
      const timeframe = '5m';
      const tfMs = 300_000;
      const totalRequiredCandles = Math.ceil((24 * 3600 * 1000 * lookbackDays) / tfMs);

      // Get candles from DB or fetch
      let candles = await this.candlesService.getLatestCandles(pair, timeframe, totalRequiredCandles);
      if (candles.length < totalRequiredCandles * 0.5) {
        // If DB doesn't have enough candles, fetch from Binance
        const since = Date.now() - lookbackDays * 24 * 3600 * 1000;
        const fetched = await this.binanceApi.fetchCandles(pair, timeframe, since, 1000);
        for (const c of fetched) {
          await this.candlesService.saveCandle({ ...c, pair, timeframe });
        }
        candles = await this.candlesService.getLatestCandles(pair, timeframe, totalRequiredCandles);
      }

      if (candles.length === 0) return weights;

      // For each day, sum up volume in the corresponding slice intervals
      for (let dayOffset = 1; dayOffset <= lookbackDays; dayOffset++) {
        const targetDayStart = new Date(now.getTime() - dayOffset * 24 * 3600 * 1000);
        targetDayStart.setUTCHours(0, 0, 0, 0);

        const targetStartMs = targetDayStart.getTime() + startMsOfDay;
        const targetEndMs = targetDayStart.getTime() + endMsOfDay;

        // Filter candles within this window on that day
        const dayCandles = candles.filter((c) => {
          const t = c.time.getTime();
          return t >= targetStartMs && t < targetEndMs;
        });

        // Map candles to slices
        for (const c of dayCandles) {
          const relativeMs = c.time.getTime() - targetStartMs;
          const sliceIndex = Math.min(slices - 1, Math.floor(relativeMs / intervalMs));
          if (sliceIndex >= 0) {
            daysVolume[sliceIndex] += parseFloat(c.volume.toString());
          }
        }
      }

      const totalVol = daysVolume.reduce((a, b) => a + b, 0);
      if (totalVol > 0) {
        for (let i = 0; i < slices; i++) {
          weights[i] = daysVolume[i] / totalVol;
        }
      }
    } catch (err) {
      this.logger.error(`Error calculating VWAP weights: ${err.message}`, err.stack);
    }
    return weights;
  }

  /**
   * Cancels active TWAP/VWAP execution by removing remaining jobs from Bull Queue
   * and setting status to CANCELLED.
   */
  async cancelExecution(executionId: number, reason: string): Promise<void> {
    const execution = await this.algoRepo.findOne({ where: { id: executionId } });
    if (!execution || execution.status !== AlgoExecutionStatus.RUNNING) return;

    execution.status = AlgoExecutionStatus.CANCELLED;
    await this.algoRepo.save(execution);

    this.logger.log(`Cancelling Algo Execution ${executionId} | Type: ${execution.algoType}. Reason: ${reason}`);

    if (execution.bullJobIds && execution.bullJobIds.length > 0) {
      for (const jobId of execution.bullJobIds) {
        try {
          const job = await this.orderQueue.getJob(jobId);
          if (job) {
            await job.remove();
            this.logger.debug(`Removed Bull job ${jobId} from queue.`);
          }
        } catch (e) {
          // Job might already be processed or removed
        }
      }
    }
  }

  /**
   * Cancels all active TWAP/VWAP executions for a strategy (e.g. when strategy deactivated)
   */
  async cancelAllForStrategy(strategyId: number, reason: string): Promise<void> {
    const active = await this.algoRepo.find({
      where: { strategyId, status: AlgoExecutionStatus.RUNNING },
    });

    for (const exec of active) {
      await this.cancelExecution(exec.id, reason);
    }
  }

  async getExecution(id: number): Promise<AlgoExecutionState> {
    return this.algoRepo.findOne({ where: { id } });
  }

  async updateProgress(id: number, amount: number): Promise<void> {
    const execution = await this.algoRepo.findOne({ where: { id } });
    if (!execution) return;

    execution.executedAmount = parseFloat(execution.executedAmount.toString()) + amount;

    // Check if fully completed
    const remaining = parseFloat(execution.totalAmount.toString()) - execution.executedAmount;
    // Allow small epsilon due to float/decimal precision
    if (remaining <= 0.00001) {
      execution.status = AlgoExecutionStatus.COMPLETED;
    }

    await this.algoRepo.save(execution);
  }

  async markAsFailed(id: number): Promise<void> {
    await this.algoRepo.update(id, { status: AlgoExecutionStatus.FAILED });
  }

  @OnEvent('strategy.deactivated')
  async handleStrategyDeactivated(payload: { strategyId: number }) {
    await this.cancelAllForStrategy(payload.strategyId, 'Strategy deactivated or deleted');
  }
}
