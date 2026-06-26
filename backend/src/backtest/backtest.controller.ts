import { Controller, Post, Get, Body, Param, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BacktestService } from './backtest.service';

@Controller('backtest')
export class BacktestController {
  constructor(
    private readonly backtestService: BacktestService,
    @InjectQueue('backtest') private readonly backtestQueue: Queue,
  ) {}

  @Post(':strategyId')
  async run(
    @Param('strategyId', ParseIntPipe) strategyId: number,
    @Body() body: any,
  ) {
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
