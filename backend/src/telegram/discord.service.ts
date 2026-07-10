import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Signal } from '../signals/signal.entity';
import { Setting } from '../settings/setting.entity';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepo: Repository<Setting>
  ) {}

  async sendSignal(signal: Signal, webhookUrl?: string) {
    let url = webhookUrl;
    if (!url) {
      // Global broadcast path — honor the same kill-switch as Telegram.
      const flag = await this.settingsRepo.findOneBy({ key: 'global_broadcast_enabled' });
      if (flag?.value === 'false') return;
      const dbUrl = await this.settingsRepo.findOneBy({ key: 'discord_webhook_url' });
      url = dbUrl?.value || process.env.DISCORD_WEBHOOK_URL;
    }
    if (!url) return;

    try {
      const isLong = signal.type === 'LONG';
      const color = isLong ? 0x3B6D11 : 0xA32D2D;

      const embed = {
        title: `🚀 ${signal.type} SIGNAL: ${signal.pair}`,
        description: `Strategy: **${signal.metadata?.strategy_name || 'Visual Strategy'}**`,
        color: color,
        fields: [
          { name: 'Price', value: `$${signal.price.toLocaleString()}`, inline: true },
          { name: 'Timeframe', value: signal.timeframe, inline: true },
          { name: 'Mark Price', value: `$${signal.metadata?.mark_price?.toLocaleString() || 'N/A'}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Signal Bot Pro' },
      };

      await axios.post(url, {
        embeds: [embed],
      });
      
      this.logger.log(`Signal sent to Discord: ${signal.pair}`);
    } catch (e) {
      this.logger.error(`Failed to send Discord signal: ${e.message}`);
    }
  }

  async sendTestMessage(webhookUrl: string) {
    try {
      await axios.post(webhookUrl, {
        content: '🔔 **Signal Bot: Discord Connection Verified!**',
      });
      return true;
    } catch (e) {
      this.logger.error(`Discord test failed: ${e.message}`);
      return false;
    }
  }

  async isConfigured(): Promise<boolean> {
    const dbUrl = await this.settingsRepo.findOneBy({ key: 'discord_webhook_url' });
    const url = dbUrl?.value || process.env.DISCORD_WEBHOOK_URL;
    return !!url;
  }
}
