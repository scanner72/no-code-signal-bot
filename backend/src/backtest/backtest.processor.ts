import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { BacktestService } from './backtest.service';

@Processor('backtest')
export class BacktestProcessor {
  private readonly logger = new Logger(BacktestProcessor.name);

  constructor(private readonly backtestService: BacktestService) {}

  @Process({ concurrency: 1 })
  async handleBacktest(job: Job<{ strategyId: number; options: any }>) {
    const { strategyId, options } = job.data;
    this.logger.log(`Processing backtest job ${job.id} for strategy ${strategyId}`);

    try {
      const result = await this.backtestService.run(strategyId, options, async (progress: number) => {
        await job.progress(progress);
      });
      return result;
    } catch (err) {
      this.logger.error(`Backtest job ${job.id} failed: ${err.message}`);
      throw err;
    }
  }
}
