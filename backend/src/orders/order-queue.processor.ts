import { Process, Processor } from '@nestjs/bull';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bull';
import { OrderQueuePayload } from './ccxt-queue.service';
import { CrossExchangeService } from '../cross-exchange/cross-exchange.service';
import { AlgoExecutionService } from './algo-execution.service';
import { GridManagerService } from './grid-manager.service';
import { classifyCcxtError, normalizeAmountPrice } from './ccxt-error.util';

@Processor('orders-execution')
export class OrderQueueProcessor {
  private readonly logger = new Logger(OrderQueueProcessor.name);

  constructor(
    private readonly crossExchangeService: CrossExchangeService,
    @Inject(forwardRef(() => AlgoExecutionService))
    private readonly algoExecutionService: AlgoExecutionService,
    private readonly gridManagerService: GridManagerService,
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

      // B2: нормализуем объём/цену под шаг биржи (Invalid lot size / price step)
      const norm = normalizeAmountPrice(ccxtExchange, pair, amount, price);

      let order;
      if (type === 'market') {
        order = await ccxtExchange.createMarketOrder(pair, side, norm.amount, undefined, params);
      } else {
        if (!norm.price) {
          throw new Error('Limit price must be specified for limit orders');
        }
        order = await ccxtExchange.createLimitOrder(pair, side, norm.amount, norm.price, params);
      }

      this.logger.log(`[Worker] Order successfully executed on ${exchangeId}. Exchange Order ID: ${order.id}`);

      if (order && order.id) {
        await this.gridManagerService.linkExchangeOrderId(String(job.id), String(order.id));
      }

      return order;
    } catch (error) {
      this.handleCcxtFailure(job, error, `order on ${exchangeId}`);
    }
  }

  /**
   * B3: единая обработка ошибок CCXT. Постоянные ошибки (нет средств / невалидный
   * ордер / авторизация) снимаем с ретраев (job.discard), временные (сеть / rate-limit /
   * биржа недоступна) — перебрасываем, чтобы сработал back-off Bull.
   */
  private handleCcxtFailure(job: Job, error: any, ctx: string): never {
    const { permanent, category } = classifyCcxtError(error);
    if (permanent) {
      this.logger.error(`[Worker] PERMANENT ${category} on ${ctx} (job ${job.id}) — снят с ретраев: ${error.message}`);
      if (typeof (job as any).discard === 'function') {
        (job as any).discard(); // не ретраить постоянную ошибку
      }
    } else {
      this.logger.warn(`[Worker] TRANSIENT ${category} on ${ctx} (job ${job.id}) — будет ретрай: ${error.message}`);
    }
    throw error;
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

      const norm = normalizeAmountPrice(ccxtExchange, pair, amount);
      const order = await ccxtExchange.createMarketOrder(pair, side, norm.amount);
      this.logger.log(`[Worker] Slice ${sliceIndex + 1}/${totalSlices} successfully executed. Order ID: ${order.id}`);

      // 3. Update progress
      await this.algoExecutionService.updateProgress(executionId, norm.amount);
      return order;
    } catch (error) {
      const { permanent, category } = classifyCcxtError(error);
      this.logger.error(`[Worker] ${permanent ? 'PERMANENT' : 'TRANSIENT'} ${category} on algo slice ${sliceIndex + 1} (execution ${executionId}): ${error.message}`);
      if (permanent && typeof (job as any).discard === 'function') {
        (job as any).discard();
      }
      await this.algoExecutionService.markAsFailed(executionId);
      throw error;
    }
  }
}

