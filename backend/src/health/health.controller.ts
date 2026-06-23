import { Controller, Get, Inject } from '@nestjs/common';
import { FuturesWebsocketService } from '../candles/futures-websocket.service';
import { TelegramService } from '../telegram/telegram.service';
import { DiscordService } from '../telegram/discord.service';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Controller('health')
export class HealthController {
  constructor(
    private readonly wsService: FuturesWebsocketService,
    private readonly telegramService: TelegramService,
    private readonly discordService: DiscordService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  @Get()
  async check() {
    let dbStatus = 'ok';
    try {
      await this.dataSource.query('SELECT 1');
    } catch (e) {
      dbStatus = 'error';
    }

    let redisStatus = 'ok';
    try {
      await this.cacheManager.set('health_test', '1', 1000);
    } catch (e) {
      redisStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        db: dbStatus,
        redis: redisStatus,
        binanceWs: this.wsService.isConnected() ? 'ok' : 'error',
        telegram: this.telegramService.isConfigured() ? 'ok' : 'error',
        discord: await this.discordService.isConfigured() ? 'ok' : 'error'
      },
    };
  }
}
