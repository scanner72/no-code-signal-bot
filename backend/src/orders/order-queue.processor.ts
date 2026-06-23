import { Process, Processor } from '@nestjs/bull';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bull';
import { OrderQueuePayload } from './ccxt-queue.service';
import { CrossExchangeService } from '../cross-exchange/cross-exchange.service';
import { AlgoExecutionService } from './algo-execution.service';

@Processor('orders-execution')
export class OrderQueueProcessor {
  private readonly logger = new Logger(OrderQueueProcessor.name);

  constructor(
    private readonly crossExchangeService: CrossExchangeService,
    @Inject(forwardRef(() => AlgoExecutionService))
    private readonly algoExecutionService: AlgoExecutionService,
  ) {}

  @Process('execute-order')
  async handleOrderExecution(job: Job<OrderQueuePayload>) {
    const { strategyId, exchangeId, pair, side, type, amount, price, creds, params } = job.data;
    this.logger.log(`[Worker] Processing job ${job.id}: ${side.toUpperCase()} ${amount} ${pair} on ${exchangeId} at ${price || 'MARKET'}`);

    try {
      const ccxtExchange = this.crossExchangeService.getExchange(exchangeId, creds);
      
      // Ensure markets are loaded for this exchange instance (required for ccxt order placing)
      if (typeof ccxtExchange.loadMarkets === 'function') {
        await ccxtExchange.loadMarkets();
      }

      let order;
      if (type === 'market') {
        order = await ccxtExchange.createMarketOrder(pair, side, amount, undefined, params);
      } else {
        if (!price) {
          throw new Error('Limit price must be specified for limit orders');
        }
        order = await ccxtExchange.createLimitOrder(pair, side, amount, price, params);
      }

      this.logger.log(`[Worker] Order successfully executed on ${exchangeId}. Exchange Order ID: ${order.id}`);
      return order;
    } catch (error) {
      this.logger.error(`[Worker] Failed to execute order on ${exchangeId} (job ${job.id}): ${error.message}`, error.stack);
      throw error; // Re-throw so Bull Queue retry logic applies
    }
  }

  @Process('execute-algo-slice')
  async handleAlgoSlice(job: Job<any>) {
    const { executionId, strategyId, pair, side, amount, sliceIndex, totalSlices, creds, exchangeId } = job.data;
    this.logger.log(`[Worker] Processing algo slice ${sliceIndex + 1}/${totalSlices} for execution ${executionId}: ${side.toUpperCase()} ${amount} ${pair}`);

    try {
      // 1. Check if cancelled
      const execution = await this.algoExecutionService.getExecution(executionId);
      if (!execution || execution.status === 'CANCELLED') {
        this.logger.log(`[Worker] Slice ${sliceIndex + 1}/${totalSlices} skipped. Execution is ${execution ? execution.status : 'NOT_FOUND'}`);
        return;
      }

      // 2. Place order on exchange
      const ccxtExchange = this.crossExchangeService.getExchange(exchangeId, creds);
      if (typeof ccxtExchange.loadMarkets === 'function') {
        await ccxtExchange.loadMarkets();
      }

      const order = await ccxtExchange.createMarketOrder(pair, side, amount);
      this.logger.log(`[Worker] Slice ${sliceIndex + 1}/${totalSlices} successfully executed. Order ID: ${order.id}`);

      // 3. Update progress
      await this.algoExecutionService.updateProgress(executionId, amount);
      return order;
    } catch (error) {
      this.logger.error(`[Worker] Failed to execute algo slice ${sliceIndex + 1} (execution ${executionId}): ${error.message}`, error.stack);
      await this.algoExecutionService.markAsFailed(executionId);
      throw error;
    }
  }
}

