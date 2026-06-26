import { Controller, Post, Get, Body, Param, ParseIntPipe, NotFoundException, HttpException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Controller('backtest')
export class BacktestController {
  constructor(
    @InjectQueue('backtest') private readonly backtestQueue: Queue,
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
      { removeOnComplete: 50, removeOnFail: 20 },
    );
    return { jobId: job.id, status: 'queued' };
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
