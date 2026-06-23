import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OcoBracketOrder, OcoStatus } from './oco-bracket-order.entity';
import { CrossExchangeService } from '../cross-exchange/cross-exchange.service';
import { Strategy } from '../strategies/strategy.entity';

@Injectable()
export class OcoManagerService {
  private readonly logger = new Logger(OcoManagerService.name);

  constructor(
    @InjectRepository(OcoBracketOrder)
    private readonly ocoRepository: Repository<OcoBracketOrder>,
    @InjectRepository(Strategy)
    private readonly strategyRepository: Repository<Strategy>,
    private readonly crossExchangeService: CrossExchangeService,
  ) {}

  async createOcoBracket(
    strategyId: number,
    pair: string,
    amount: number,
    tpOrderId: string,
    slOrderId: string,
    tpPrice: number,
    slPrice: number,
    entryOrderId?: string,
  ): Promise<OcoBracketOrder> {
    const bracket = this.ocoRepository.create({
      strategy_id: strategyId,
      pair,
      amount,
      tp_order_id: tpOrderId,
      sl_order_id: slOrderId,
      tp_price: tpPrice,
      sl_price: slPrice,
      entry_order_id: entryOrderId,
      status: OcoStatus.ACTIVE,
    });
    const saved = await this.ocoRepository.save(bracket);
    this.logger.log(`[OCO] Created OCO Bracket Order for Strategy ${strategyId} on ${pair}. TP: ${tpOrderId}, SL: ${slOrderId}`);
    return saved;
  }

  async handleOrderUpdate(exchangeOrderId: string, status: string): Promise<void> {
    const cleanStatus = status.toLowerCase();
    if (cleanStatus !== 'closed' && cleanStatus !== 'filled') {
      return;
    }

    // Lock and check if the order is part of an active OCO bracket
    const bracket = await this.ocoRepository.findOne({
      where: [
        { tp_order_id: exchangeOrderId, status: OcoStatus.ACTIVE },
        { sl_order_id: exchangeOrderId, status: OcoStatus.ACTIVE },
      ],
    });

    if (!bracket) return;

    const isTp = bracket.tp_order_id === exchangeOrderId;
    const targetStatus = isTp ? OcoStatus.TP_FILLED : OcoStatus.SL_FILLED;
    const cancelOrderId = isTp ? bracket.sl_order_id : bracket.tp_order_id;

    this.logger.warn(`[OCO Triggered] Order ${exchangeOrderId} (${isTp ? 'TP' : 'SL'}) FILLED. Cancelling opposite order ${cancelOrderId}`);

    // Update status immediately to prevent duplicate triggers
    bracket.status = targetStatus;
    bracket.updated_at = new Date();
    await this.ocoRepository.save(bracket);

    // Cancel the opposite order
    try {
      const strategy = await this.strategyRepository.findOne({ where: { id: bracket.strategy_id } });
      if (!strategy) {
        throw new Error(`Strategy ${bracket.strategy_id} not found`);
      }

      const exchangeId = strategy.execution_settings?.exchangeId || 'binance';
      const creds = strategy.execution_settings?.creds;
      const ccxtExchange = this.crossExchangeService.getExchange(exchangeId, creds);

      await ccxtExchange.cancelOrder(cancelOrderId, bracket.pair);
      this.logger.log(`[OCO Success] Opposite order ${cancelOrderId} cancelled successfully.`);
    } catch (error) {
      this.logger.error(`[OCO Error] Failed to cancel opposite order ${cancelOrderId}: ${error.message}`);
    }
  }
}
