import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { createHmac } from 'crypto';
import { Strategy } from '../strategies/strategy.entity';
import { ConnectionsService } from '../connections/connections.service';
import { DeliveryPolicy } from './delivery.policy';
import { buildContext, renderTemplate, DEFAULT_TEMPLATE } from './template';
const TelegramBot = require('node-telegram-bot-api');

export const DELIVERY_NODE_TYPES = ['telegram_output', 'discord_output', 'webhook_output'] as const;

export interface DeliveryJob {
  nodeType: string;
  nodeData: Record<string, any>;
  connectionId: string;
  signal: any;
  strategyName: string;
  userId: string | null;
}

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @InjectQueue('delivery') private readonly queue: Queue,
    @InjectRepository(Strategy) private readonly strategyRepo: Repository<Strategy>,
    private readonly connections: ConnectionsService,
    private readonly policy: DeliveryPolicy,
  ) {}

  // Extension point consumer: the signals engine stays untouched, delivery
  // reacts to the same event the social publisher uses.
  @OnEvent('signal.created')
  async onSignalCreated(signal: any) {
    try {
      if (!signal?.strategy_id) return;
      const strategy = await this.strategyRepo.findOneBy({ id: signal.strategy_id });
      if (!strategy) return;

      const nodes: any[] = strategy.nodes || [];
      const edges: any[] = strategy.edges || [];
      const deliveryNodes = nodes.filter(
        (n) => DELIVERY_NODE_TYPES.includes(n.type) && edges.some((e) => e.target === n.id),
      );
      if (!deliveryNodes.length) return;

      for (const node of deliveryNodes) {
        const data = node.data || {};
        if (!data.connectionId) {
          this.logger.warn(`Delivery node ${node.id} in strategy #${strategy.id} has no connection configured — skipped`);
          continue;
        }
        const verdict = await this.policy.canDeliver((strategy as any).owner_id || null, data.connectionId);
        if (!verdict.allowed) {
          this.logger.warn(`Delivery blocked by policy for strategy #${strategy.id}: ${verdict.reason}`);
          continue;
        }
        await this.queue.add(
          'send',
          {
            nodeType: node.type,
            nodeData: data,
            connectionId: data.connectionId,
            signal,
            strategyName: strategy.name,
            userId: (strategy as any).owner_id || null,
          } as DeliveryJob,
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 200, removeOnFail: 500 },
        );
      }
    } catch (e) {
      this.logger.error(`Delivery dispatch failed: ${(e as Error).message}`);
    }
  }

  // Called by the queue processor and by POST /connections/:id/test
  async deliver(job: DeliveryJob): Promise<void> {
    const conn = await this.connections.getDecrypted(job.connectionId);
    if (!conn) throw new Error(`Connection ${job.connectionId} not found`);

    const ctx = buildContext(job.signal, job.strategyName);
    const template = job.nodeData.template || job.nodeData.payloadTemplate || '';

    switch (conn.entity.type) {
      case 'telegram_bot': {
        const text = renderTemplate(template || DEFAULT_TEMPLATE, ctx);
        const chatId = String(job.nodeData.chatId || '').trim();
        if (!chatId) throw new Error('Delivery node has no chatId');
        const bot = new TelegramBot(conn.config.botToken, { polling: false });
        await bot.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          disable_notification: !!job.nodeData.silent,
        });
        break;
      }
      case 'discord_webhook': {
        const useEmbed = job.nodeData.useEmbed !== false;
        const body = useEmbed
          ? {
              embeds: [{
                title: `🚨 ${ctx.signal} ${ctx.pair}`,
                description: template ? renderTemplate(template, ctx) : `Стратегия: **${ctx.strategy}**`,
                color: ctx.signal === 'LONG' ? 0x10b981 : 0xef4444,
                fields: [
                  { name: 'Price', value: ctx.price || '-', inline: true },
                  { name: 'TP', value: ctx.tp, inline: true },
                  { name: 'SL', value: ctx.sl, inline: true },
                ],
                timestamp: new Date().toISOString(),
              }],
            }
          : { content: renderTemplate(template || DEFAULT_TEMPLATE, ctx) };
        await axios.post(conn.config.webhookUrl, body, { timeout: 5000 });
        break;
      }
      case 'generic_webhook': {
        const payload = template
          ? JSON.parse(renderTemplate(template, ctx))
          : { event: 'signal', signal: job.signal, strategy: job.strategyName };
        const body = JSON.stringify(payload);
        const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(conn.config.headers ? JSON.parse(conn.config.headers as any) : {}) };
        if (job.nodeData.signPayload && conn.config.hmacSecret) {
          headers['X-Signature'] = 'sha256=' + createHmac('sha256', conn.config.hmacSecret).update(body).digest('hex');
        }
        await axios.post(conn.config.url, body, { timeout: 5000, headers, maxRedirects: 0 });
        break;
      }
      default:
        throw new Error(`Unsupported connection type ${conn.entity.type}`);
    }
  }

  async sendTest(connectionId: string, chatId?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const conn = await this.connections.getDecrypted(connectionId);
      if (!conn) return { ok: false, error: 'Подключение не найдено' };
      const testSignal = { pair: 'BTCUSDT', type: 'LONG', price: 100000, timeframe: '1h', metadata: { tp: 105000, sl: 98000 }, created_at: new Date() };
      await this.deliver({
        nodeType: 'test',
        nodeData: { chatId, template: '✅ Тест подключения «' + conn.entity.name + '» — {{signal}} {{pair}} @ {{price}}' },
        connectionId,
        signal: testSignal,
        strategyName: 'Connection Test',
        userId: null,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
