import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class BacktestProgressService {
  private readonly logger = new Logger(BacktestProgressService.name);
  private publisher: Redis;

  constructor() {
    this.publisher = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 500, 5000),
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }

  async broadcastProgress(strategyId: number, progress: number, stage: string) {
    const message = JSON.stringify({ strategyId, progress, stage });
    await this.publisher.publish('backtest:progress', message);
  }

  async onModuleDestroy() {
    await this.publisher.quit();
  }
}
