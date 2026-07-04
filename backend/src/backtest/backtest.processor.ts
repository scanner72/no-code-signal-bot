import { Process, Processor, OnQueueStalled, OnQueueFailed, OnQueueError } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { BacktestService } from './backtest.service';
import { BacktestRunsService } from './backtest-runs.service';

@Processor('backtest')
export class BacktestProcessor {
  private readonly logger = new Logger(BacktestProcessor.name);

  constructor(
    private readonly backtestService: BacktestService,
    private readonly backtestRunsService: BacktestRunsService,
  ) {}

  @Process({ concurrency: 1 })
  async handleBacktest(job: Job<{ strategyId: number; options: any }>) {
    const { strategyId, options } = job.data;
    this.logger.log(`Processing backtest job ${job.id} for strategy ${strategyId}`);

    try {
      const result = await this.backtestService.run(strategyId, options, async (progress: number) => {
        await job.progress(progress);
      });
      try {
        // Persist a stripped copy: the candles array is ~17k objects (MBs of jsonb) per run
        // and history features only need equityCurve/metrics. The full `result` (with candles)
        // is still returned below for the frontend to plot the price tab.
        await this.backtestRunsService.saveRun(strategyId, options, { ...result, candles: undefined });
      } catch (e) {
        this.logger.error(`Failed to persist backtest run: ${(e as Error).message}`);
      }
      return result;
    } catch (err) {
      this.logger.error(`Backtest job ${job.id} failed: ${err.message}`);
      throw err;
    }
  }

  @OnQueueStalled()
  onStalled(job: Job) {
    this.logger.warn(`Backtest job ${job.id} stalled (attempt ${job.attemptsMade}/${job.opts.attempts})`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Backtest job ${job.id} failed permanently: ${err.message}`, err.stack);
  }

  @OnQueueError()
  onError(err: Error) {
    this.logger.error(`Backtest queue error: ${err.message}`);
  }
}
