import { Controller, Post, Get, Body, Param, ParseIntPipe, NotFoundException, HttpException, Query, Delete } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BacktestRunsService } from './backtest-runs.service';

@Controller('backtest')
export class BacktestController {
  constructor(
    @InjectQueue('backtest') private readonly backtestQueue: Queue,
    private readonly backtestRunsService: BacktestRunsService,
  ) {}

  @Post(':strategyId')
  async run(
    @Param('strategyId', ParseIntPipe) strategyId: number,
    @Body() body: any,
  ) {
    const activeCount = await this.backtestQueue.getActiveCount();
    const waitingCount = await this.backtestQueue.getWaitingCount();
    if (activeCount + waitingCount >= 3) {
      throw new HttpException('Too many backtests in queue. Please wait.', 429);
    }

    const job = await this.backtestQueue.add(
      { strategyId, options: body },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        timeout: 3600000,
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );
    return { jobId: job.id, status: 'queued' };
  }

  @Get('runs')
  listRuns(@Query('strategyId') strategyId: string, @Query('limit') limit?: string) {
    return this.backtestRunsService.listRuns(parseInt(strategyId, 10), limit ? parseInt(limit, 10) : 50);
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.backtestRunsService.getRun(parseInt(id, 10));
  }

  @Delete('runs/:id')
  deleteRun(@Param('id') id: string) {
    return this.backtestRunsService.deleteRun(parseInt(id, 10));
  }

  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.backtestQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Job not found');

    const state = await job.getState();

    if (state === 'completed') {
      return { status: 'completed', result: job.returnvalue };
    }
    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason };
    }
    return { status: state, progress: job.progress() };
  }
}
