import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connection, ConnectionType } from './connection.entity';
import { EncryptionService } from './encryption.service';
import { Setting } from '../settings/setting.entity';

export interface ConnectionDto {
  id: string;
  user_id: string | null;
  name: string;
  type: ConnectionType;
  configPreview: Record<string, string>;
  created_at: Date;
}

const SECRET_FIELDS: Record<ConnectionType, string[]> = {
  telegram_bot: ['botToken'],
  discord_webhook: ['webhookUrl'],
  generic_webhook: ['url', 'hmacSecret'],
};

const KNOWN_TYPES: ConnectionType[] = ['telegram_bot', 'discord_webhook', 'generic_webhook'];

function mask(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '•••';
  return `${value.slice(0, 6)}•••${value.slice(-2)}`;
}

@Injectable()
export class ConnectionsService implements OnModuleInit {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    @InjectRepository(Connection)
    private readonly repo: Repository<Connection>,
    @InjectRepository(Setting)
    private readonly settingsRepo: Repository<Setting>,
    private readonly encryption: EncryptionService,
  ) {}

  // One-time migration: global telegram/discord creds from settings become
  // server-wide connections (user_id = null) so old setups keep working.
  async onModuleInit() {
    if (!this.encryption.isConfigured()) return;
    try {
      await this.migrateLegacy('telegram_bot', 'Default Telegram', async () => {
        const token = await this.settingsRepo.findOneBy({ key: 'telegram_bot_token' });
        return token?.value ? { botToken: token.value } : null;
      });
      await this.migrateLegacy('discord_webhook', 'Default Discord', async () => {
        const url = await this.settingsRepo.findOneBy({ key: 'discord_webhook_url' });
        return url?.value ? { webhookUrl: url.value } : null;
      });
    } catch (e) {
      this.logger.warn(`Legacy connection migration skipped: ${(e as Error).message}`);
    }
  }

  private async migrateLegacy(type: ConnectionType, name: string, load: () => Promise<Record<string, string> | null>) {
    const existing = await this.repo.findOneBy({ type, name });
    if (existing) return;
    const config = await load();
    if (!config) return;
    await this.repo.save(this.repo.create({ user_id: null, name, type, config: this.encryption.encrypt(JSON.stringify(config)) }));
    this.logger.log(`Migrated legacy ${type} settings into connection "${name}"`);
  }

  async list(userId: string | null, type?: string): Promise<ConnectionDto[]> {
    const qb = this.repo.createQueryBuilder('c').orderBy('c.created_at', 'ASC');
    if (userId) qb.where('(c.user_id = :userId OR c.user_id IS NULL)', { userId });
    else qb.where('c.user_id IS NULL');
    if (type) qb.andWhere('c.type = :type', { type });
    const rows = await qb.getMany();
    return rows.map((c) => this.toDto(c));
  }

  async create(userId: string | null, body: { name?: string; type?: string; config?: Record<string, string> }): Promise<ConnectionDto> {
    if (!this.encryption.isConfigured()) {
      throw new BadRequestException('CONNECTIONS_ENC_KEY не задан на сервере — сохранение подключений отключено');
    }
    const type = body.type as ConnectionType;
    if (!KNOWN_TYPES.includes(type)) throw new BadRequestException(`Неизвестный тип подключения: ${body.type}`);
    if (!body.name?.trim()) throw new BadRequestException('Укажите название подключения');
    this.validateConfig(type, body.config || {});
    const entity = this.repo.create({
      user_id: userId,
      name: body.name.trim(),
      type,
      config: this.encryption.encrypt(JSON.stringify(body.config)),
    });
    return this.toDto(await this.repo.save(entity));
  }

  async update(userId: string | null, id: string, body: { name?: string; config?: Record<string, string> }): Promise<ConnectionDto> {
    const conn = await this.getOwned(userId, id);
    if (body.name?.trim()) conn.name = body.name.trim();
    if (body.config) {
      // Empty secret fields mean "keep the stored value"
      const current = JSON.parse(this.encryption.decrypt(conn.config));
      const merged: Record<string, string> = { ...current };
      for (const [k, v] of Object.entries(body.config)) {
        if (v !== '' && v !== undefined && v !== null) merged[k] = v as string;
      }
      this.validateConfig(conn.type, merged);
      conn.config = this.encryption.encrypt(JSON.stringify(merged));
    }
    return this.toDto(await this.repo.save(conn));
  }

  async remove(userId: string | null, id: string): Promise<void> {
    const conn = await this.getOwned(userId, id);
    await this.repo.remove(conn);
  }

  // Internal use only (DeliveryService) — returns decrypted config.
  async getDecrypted(id: string): Promise<{ entity: Connection; config: Record<string, string> } | null> {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) return null;
    return { entity, config: JSON.parse(this.encryption.decrypt(entity.config)) };
  }

  private async getOwned(userId: string | null, id: string): Promise<Connection> {
    const conn = await this.repo.findOneBy({ id });
    if (!conn) throw new NotFoundException('Подключение не найдено');
    // Server-wide (null) connections are editable by any authenticated user in
    // self-host; per-user ones only by their owner.
    if (conn.user_id && conn.user_id !== userId) throw new NotFoundException('Подключение не найдено');
    return conn;
  }

  private validateConfig(type: ConnectionType, config: Record<string, string>) {
    if (type === 'telegram_bot' && !/^\d+:[A-Za-z0-9_-]+$/.test((config.botToken || '').trim())) {
      throw new BadRequestException('Некорректный токен Telegram-бота (формат 123456:ABC-...)');
    }
    if (type === 'discord_webhook' && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(config.webhookUrl || '')) {
      throw new BadRequestException('Некорректный Discord webhook URL');
    }
    if (type === 'generic_webhook') {
      let parsed: URL;
      try { parsed = new URL(config.url || ''); } catch { throw new BadRequestException('Некорректный URL вебхука'); }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new BadRequestException('Разрешены только http/https URL');
    }
  }

  private toDto(c: Connection): ConnectionDto {
    let preview: Record<string, string> = {};
    try {
      const config = JSON.parse(this.encryption.decrypt(c.config));
      for (const field of SECRET_FIELDS[c.type] || []) {
        if (config[field]) preview[field] = mask(config[field]);
      }
    } catch {
      preview = { error: 'не удаётся расшифровать (сменился CONNECTIONS_ENC_KEY?)' };
    }
    return { id: c.id, user_id: c.user_id, name: c.name, type: c.type, configPreview: preview, created_at: c.created_at };
  }
}
