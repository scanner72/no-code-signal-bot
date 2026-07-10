import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { DeliveryService, DeliveryJob } from './delivery.service';

@Processor('delivery')
export class DeliveryProcessor {
  private readonly logger = new Logger(DeliveryProcessor.name);

  constructor(private readonly delivery: DeliveryService) {}

  @Process({ name: 'send', concurrency: 4 })
  async handle(job: Job<DeliveryJob>) {
    try {
      await this.delivery.deliver(job.data);
      this.logger.log(`Delivered ${job.data.nodeType} for strategy "${job.data.strategyName}" (${job.data.signal?.pair})`);
    } catch (e) {
      // Message may contain a webhook URL — keep logs secret-free.
      const msg = (e as Error).message.replace(/https?:\/\/\S+/g, '<url>').replace(/\d{6,}:[A-Za-z0-9_-]+/g, '<token>');
      this.logger.error(`Delivery failed (attempt ${job.attemptsMade + 1}/3): ${msg}`);
      throw e;
    }
  }
}
