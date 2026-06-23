import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ExchangeId, ApiCredentials } from '../cross-exchange/cross-exchange.service';

export interface OrderQueuePayload {
  strategyId: number;
  exchangeId: ExchangeId;
  pair: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: number;
  price?: number;
  creds?: ApiCredentials;
  params?: Record<string, any>;
}

@Injectable()
export class CCXTQueueService {
  private readonly logger = new Logger(CCXTQueueService.name);

  constructor(
    @InjectQueue('orders-execution') private readonly orderQueue: Queue,
  ) {}

  async enqueueOrder(payload: OrderQueuePayload): Promise<string> {
    const job = await this.orderQueue.add('execute-order', payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s...
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
    this.logger.log(`[Queue] Order for ${payload.side.toUpperCase()} ${payload.amount} ${payload.pair} on ${payload.exchangeId} queued. Job ID: ${job.id}`);
    return String(job.id);
  }
}
