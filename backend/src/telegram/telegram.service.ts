import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
const TelegramBot = require('node-telegram-bot-api');
import { ChartScreenshotService } from './chart-screenshot.service';
import { Setting } from '../settings/setting.entity';
 
@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: any;
  private readonly chatId = process.env.TELEGRAM_CHAT_ID;
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
 
  constructor(
    private readonly chartScreenshot: ChartScreenshotService,
    @InjectRepository(Setting)
    private readonly settingsRepo: Repository<Setting>,
    private readonly moduleRef: ModuleRef
  ) {}

  async onModuleInit() {
    const dbToken = await this.settingsRepo.findOneBy({ key: 'telegram_bot_token' });
    const dbChatId = await this.settingsRepo.findOneBy({ key: 'telegram_chat_id' });
    
    const activeToken = dbToken?.value || this.token;
    if (dbChatId?.value) {
      Object.defineProperty(this, 'chatId', { value: dbChatId.value, writable: true });
    }

    const isValidToken = activeToken && /^\d+:[A-Za-z0-9_-]+$/.test(activeToken.trim());

    if (isValidToken) {
      this.bot = new TelegramBot(activeToken.trim(), { polling: true });
      this.setupCommandListeners();
      this.bot.on('polling_error', (error: any) => {
        this.logger.error(`Telegram Polling error: ${error.message}`);
      });
      this.logger.log('Telegram Bot initialized with Polling enabled');
    } else {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured or uses a placeholder. Telegram notifications/polling disabled.');
    }
  }

  async sendMessage(message: string) {
    if (!this.bot || !this.chatId) return;
    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Error sending Telegram message: ${error.message}`);
    }
  }

  // Global broadcast (every signal to the default chat) can be disabled once
  // per-strategy delivery nodes are used instead.
  private async globalBroadcastEnabled(): Promise<boolean> {
    const flag = await this.settingsRepo.findOneBy({ key: 'global_broadcast_enabled' });
    return flag?.value !== 'false';
  }

  async sendSignal(signal: any, candles?: any[], rsiValues?: number[], customMessage?: string) {
    if (!this.bot || !this.chatId) return;
    if (!(await this.globalBroadcastEnabled())) return;

    const isLong = signal.type === 'LONG';
    const price: number = parseFloat(signal.price);
    const md = signal.metadata || {};
    const tp = typeof md.tp === 'number' ? md.tp : (isLong ? price * 1.02 : price * 0.98);
    const sl = typeof md.sl === 'number' ? md.sl : (isLong ? price * 0.99 : price * 1.01);

    const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pct = (a: number, b: number) => (((a - b) / b) * 100).toFixed(2);
    const sign = (s: string) => s.startsWith('-') ? '' : '+';
    const tpPct = pct(tp, price);
    const slPct = pct(sl, price);
    const icon = isLong ? '🟢' : '🔴';
    const stratName = signal.metadata?.strategy_name || 'Signal Bot';
    const lastRsi = rsiValues?.length ? rsiValues[rsiValues.length - 1].toFixed(1) : null;

    const caption = customMessage || [
      `${icon} <b>${signal.type} — ${signal.pair} · ${signal.timeframe}</b>`,
      `<b>Entry:</b> <code>$${fmt(price)}</code>`,
      `<b>TP:</b> <code>$${fmt(tp)}</code> <i>(${sign(tpPct)}${tpPct}%)</i>`,
      `<b>SL:</b> <code>$${fmt(sl)}</code> <i>(${sign(slPct)}${slPct}%)</i>`,
      ...(lastRsi ? [`<b>RSI(14):</b> <code>${lastRsi}</code>`] : []),
      ``,
      `<i>${stratName} · ${new Date(signal.created_at).toLocaleString('ru-RU')}</i>`,
    ].join('\n');

    if (candles?.length) {
      const screenshot = await this.chartScreenshot.generate({
        candles,
        signalType: signal.type,
        signalPrice: price,
        pair: signal.pair,
        timeframe: signal.timeframe,
        rsiValues,
        tp,
        sl,
        strategyName: stratName,
        time: new Date(signal.created_at),
      });

      if (screenshot) {
        try {
          await this.bot.sendPhoto(this.chatId, screenshot, { caption, parse_mode: 'HTML' });
          return;
        } catch (err) {
          this.logger.error(`sendPhoto failed: ${err.message}`);
        }
      }
    }

    await this.sendMessage(caption);
  }

  async testConnection(chatId: string, message: string, customToken?: string): Promise<boolean> {
    const testBot = customToken ? new TelegramBot(customToken, { polling: false }) : this.bot;
    if (!testBot) return false;
    try {
      await testBot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      return true;
    } catch (e) {
      this.logger.error(`Failed to test telegram connection: ${e.message}`);
      return false;
    }
  }

  updateBotToken(newToken: string) {
    if (newToken) {
      if (this.bot) {
        try {
          this.bot.stopPolling();
        } catch (e) {}
      }
      const isValidToken = /^\d+:[A-Za-z0-9_-]+$/.test(newToken.trim());
      if (isValidToken) {
        this.bot = new TelegramBot(newToken.trim(), { polling: true });
        this.setupCommandListeners();
        this.bot.on('polling_error', (error: any) => {
          this.logger.error(`Telegram Polling error: ${error.message}`);
        });
        this.logger.log('Telegram Bot reinitialized with new token and Polling enabled');
      } else {
        this.bot = null;
        this.logger.warn('Provided Telegram Token is invalid. Polling disabled.');
      }
    }
  }

  private setupCommandListeners() {
    if (!this.bot) return;

    this.bot.on('message', async (msg: any) => {
      const text = msg.text;
      const chatId = msg.chat?.id;

      if (!text || !chatId) return;

      // Only respond to messages from the configured chatId for security!
      if (String(chatId) !== String(this.chatId)) {
        this.logger.warn(`Unauthorized message from chatId ${chatId}: ${text}`);
        return;
      }

      const command = text.trim().toLowerCase();

      try {
        if (command === '/start' || command === '/help') {
          await this.bot.sendMessage(chatId, [
            `🛸 <b>Cyber-Quant Bot Assistant</b>`,
            `Доступные команды управления флотом:`,
            `• /status — Текущее состояние систем и ботов`,
            `• /balance — Проверить балансы запущенных инстансов`,
            `• /panic — 🚨 <b>АВАРИЙНЫЙ СТОП ВСЕХ БОТОВ</b>`,
            `• /help — Показать эту справку`,
          ].join('\n'), { parse_mode: 'HTML' });
        } 
        else if (command === '/panic') {
          await this.bot.sendMessage(chatId, `🚨 Активирована команда PANIC STOP! Останавливаю флот...`);
          try {
            const { FleetService } = require('../fleet/fleet.service');
            const fleetService = this.moduleRef.get(FleetService, { strict: false });
            const result = await fleetService.panicStop();
            await this.bot.sendMessage(chatId, `✅ Успешно остановлено ботов: <b>${result.stoppedCount}</b>`);
          } catch (e) {
            await this.bot.sendMessage(chatId, `❌ Ошибка при остановке флота: ${e.message}`);
          }
        }
        else if (command === '/balance') {
          try {
            const { FleetService } = require('../fleet/fleet.service');
            const fleetService = this.moduleRef.get(FleetService, { strict: false });
            const instances = await fleetService.getAll();
            if (instances.length === 0) {
              await this.bot.sendMessage(chatId, `Бот-инстансы отсутствуют в системе.`);
              return;
            }
            const lines = [
              `💰 <b>Текущие балансы флота:</b>`,
              ...instances.map((inst: any) => 
                `• <b>${inst.name}</b> (${inst.pair}): <code>$${inst.currentBalance?.toFixed(2)}</code> [${inst.status}]`
              )
            ];
            await this.bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
          } catch (e) {
            await this.bot.sendMessage(chatId, `❌ Ошибка запроса баланса: ${e.message}`);
          }
        }
        else if (command === '/status') {
          try {
            const { FleetService } = require('../fleet/fleet.service');
            const fleetService = this.moduleRef.get(FleetService, { strict: false });
            const instances = await fleetService.getAll();
            const active = instances.filter((i: any) => i.status === 'RUNNING').length;
            
            await this.bot.sendMessage(chatId, [
              `📊 <b>Статус системы:</b>`,
              `• Активных роботов: <b>${active} / ${instances.length}</b>`,
              `• Telegram Оповещения: <b>ВКЛЮЧЕНЫ ✅</b>`,
              `• TimescaleDB Core: <b>ОНЛАЙН 🟢</b>`,
            ].join('\n'), { parse_mode: 'HTML' });
          } catch (e) {
            await this.bot.sendMessage(chatId, `❌ Ошибка запроса статуса: ${e.message}`);
          }
        }
      } catch (err) {
        this.logger.error(`Error processing command ${command}: ${err.message}`);
      }
    });
  }

  async sendSignalOverride(signal: any, overrideChatId: string) {
    if (!this.bot) return false;
    const backup = this.chatId;
    try {
      // Temporarily override the readonly chatId property
      Object.defineProperty(this, 'chatId', { value: overrideChatId, writable: true });
      await this.sendSignal(signal);
    } finally {
      Object.defineProperty(this, 'chatId', { value: backup, writable: true });
    }
  }

  isConfigured() {
    return !!this.bot && !!this.chatId;
  }
}
