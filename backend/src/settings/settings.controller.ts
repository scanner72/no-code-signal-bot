import { Controller, Get, Post, Body, Put, Param, Inject, forwardRef } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { TelegramService } from '../telegram/telegram.service';
import { DiscordService } from '../telegram/discord.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HeymMcpService } from '../hermes/heym-mcp.service';

type HermesProvider = 'hermes' | 'ollama' | 'openai' | 'freellmapi';


@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
    private readonly discordService: DiscordService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => HeymMcpService))
    private readonly heymMcpService: HeymMcpService,
  ) {}

  @Get()
  getAllSettings() {
    return this.settingsService.getAll();
  }

  @Put('deduplication')
  async updateDeduplication(@Body('interval') interval: number) {
    await this.settingsService.set('deduplication_interval', interval.toString());
    this.eventEmitter.emit('settings.updated', { key: 'deduplication_interval', value: interval });
    return { success: true };
  }

  @Put('key/:key')
  async updateSetting(@Param('key') key: string, @Body('value') value: string) {
    await this.settingsService.set(key, value);
    this.eventEmitter.emit('settings.updated', { key, value });
    return { success: true };
  }

  @Post('telegram/verify')
  async verifyTelegram(@Body('chatId') chatId: string, @Body('botToken') botToken?: string) {
    // Attempt to send a test message
    const testMessage = `🟢 <b>ТЕСТ</b>\nSignal Bot успешно подключен к этому каналу!`;
    const isSuccess = await this.telegramService.testConnection(chatId, testMessage, botToken);
    
    if (isSuccess) {
      await this.settingsService.set('telegram_chat_id', chatId);
      if (botToken) {
        await this.settingsService.set('telegram_bot_token', botToken);
        this.telegramService.updateBotToken(botToken);
      }
      return { success: true };
    } else {
      return { success: false, message: 'Не удалось отправить сообщение' };
    }
  }

  @Post('telegram/disconnect')
  async disconnectTelegram() {
    await this.settingsService.set('telegram_chat_id', '');
    return { success: true };
  }

  @Post('telegram/test')
  async sendTestSignal() {
    const chatId = await this.settingsService.get('telegram_chat_id');
    if (!chatId) return { success: false, message: 'Кэнал не подключен' };
    
    const testSignal = {
      type: 'LONG',
      pair: 'BTCUSDT',
      timeframe: '1h',
      price: '63420.00',
      created_at: new Date(),
      metadata: { strategy_name: 'Тестовая Стратегия' }
    };
    await this.telegramService.sendSignalOverride(testSignal, chatId);
    return { success: true };
  }

  @Post('discord/test')
  async testDiscord(@Body('webhookUrl') webhookUrl: string) {
    const success = await this.discordService.sendTestMessage(webhookUrl);
    if (success) {
      await this.settingsService.set('discord_webhook_url', webhookUrl);
      return { success: true };
    }
    return { success: false };
  }

  // ─── heym MCP Integration ────────────────────────────────────────────────

  @Get('integrations/heym')
  async getHeymConfig() {
    const url = await this.settingsService.get('heym_api_url');
    const apiKey = await this.settingsService.get('heym_api_key');
    const workflowId = await this.settingsService.get('heym_signal_validator_id');
    return {
      url: url || '',
      // Mask key — show only last 6 chars for display
      apiKeyMasked: apiKey ? '••••••' + apiKey.slice(-6) : '',
      hasApiKey: !!apiKey,
      workflowId: workflowId || '',
    };
  }

  @Post('integrations/heym')
  async saveHeymConfig(
    @Body('url') url: string,
    @Body('apiKey') apiKey: string,
    @Body('workflowId') workflowId: string,
  ) {
    if (url) await this.settingsService.set('heym_api_url', url.trim());
    if (apiKey && !apiKey.startsWith('••••••')) {
      await this.settingsService.set('heym_api_key', apiKey.trim());
    }
    if (workflowId !== undefined) {
      await this.settingsService.set('heym_signal_validator_id', workflowId.trim());
    }
    // Signal HeymMcpService to reload config from DB
    this.eventEmitter.emit('heym.config.updated');
    return { success: true };
  }

  @Post('integrations/heym/test')
  async testHeymConnection() {
    const url = await this.settingsService.get('heym_api_url');
    const apiKey = await this.settingsService.get('heym_api_key');
    if (!url || !apiKey) {
      return { success: false, message: 'URL и API Key не настроены' };
    }

    try {
      const axios = (await import('axios')).default;
      const baseApi = url.endsWith('/api') ? url : `${url}/api`;
      // Try /workflows as health probe (heym doesn't have a /health by default)
      await axios.get(`${baseApi}/workflows`, {
        headers: { 'X-MCP-Key': apiKey },
        timeout: 8000,
      });
      return { success: true, message: 'Соединение установлено' };
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        return { success: false, message: 'Неверный API Key (401/403)' };
      }
      return { success: false, message: err.message || 'Недоступен' };
    }
  }

  @Get('integrations/heym/tools')
  async getHeymTools() {
    try {
      return await this.heymMcpService.listMcpTools();
    } catch {
      return [];
    }
  }

  // ─── Hermes AI Agent ─────────────────────────────────────────────────────

  @Get('integrations/hermes')
  async getHermesConfig() {
    const provider = await this.settingsService.get('hermes_provider');
    const url = await this.settingsService.get('hermes_api_url');
    const model = await this.settingsService.get('hermes_model');
    const apiKey = await this.settingsService.get('hermes_api_key');
    return {
      provider: (provider as HermesProvider) || 'hermes',
      url: url || '',
      model: model || '',
      apiKeyMasked: apiKey ? '••••••' + apiKey.slice(-6) : '',
      hasApiKey: !!apiKey,
    };
  }

  @Post('integrations/hermes')
  async saveHermesConfig(
    @Body('provider') provider: HermesProvider,
    @Body('url') url: string,
    @Body('model') model: string,
    @Body('apiKey') apiKey: string,
  ) {
    if (provider) await this.settingsService.set('hermes_provider', provider);
    if (url !== undefined) await this.settingsService.set('hermes_api_url', url.trim());
    if (model !== undefined) await this.settingsService.set('hermes_model', model.trim());
    if (apiKey && !apiKey.startsWith('••••••')) {
      await this.settingsService.set('hermes_api_key', apiKey.trim());
    }
    this.eventEmitter.emit('hermes.config.updated');
    return { success: true };
  }

  @Post('integrations/hermes/test')
  async testHermesConnection() {
    const provider = ((await this.settingsService.get('hermes_provider')) || 'hermes') as HermesProvider;
    const url = await this.settingsService.get('hermes_api_url');
    const model = (await this.settingsService.get('hermes_model')) || 'nous-hermes-3';
    const apiKey = await this.settingsService.get('hermes_api_key');

    if (!url) {
      return { success: false, message: 'URL не настроен' };
    }

    try {
      const axiosLib = (await import('axios')).default;
      const testPrompt = 'Reply with exactly: OK';

      if (provider === 'hermes') {
        await axiosLib.post(
          `${url}/run`,
          { task: testPrompt, tools: [] },
          { timeout: 15_000 },
        );
      } else if (provider === 'ollama') {
        await axiosLib.post(
          `${url}/api/generate`,
          { model, prompt: testPrompt, stream: false },
          { timeout: 30_000 },
        );
      } else if (provider === 'openai' || provider === 'freellmapi') {
        if (provider === 'openai' && !apiKey) return { success: false, message: 'API Key обязателен для OpenAI-совместимых провайдеров' };
        const base = url.replace(/\/v1\/?$/, '');
        await axiosLib.post(
          `${base}/v1/chat/completions`,
          { model, messages: [{ role: 'user', content: testPrompt }], max_tokens: 10 },
          { timeout: 20_000, headers: { Authorization: `Bearer ${apiKey || 'freellmapi'}` } },
        );
      }

      return { success: true, message: 'Соединение установлено' };
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.error?.message || err?.response?.data?.detail;
      if (status === 401 || status === 403) {
        return { success: false, message: `Ошибка авторизации (${status})` };
      }
      return { success: false, message: detail || err.message || 'Недоступен' };
    }
  }
}
