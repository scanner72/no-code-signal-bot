import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepo: Repository<Setting>,
  ) {}

  async get(key: string): Promise<string | null> {
    const setting = await this.settingsRepo.findOneBy({ key });
    return setting ? setting.value : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.settingsRepo.save({ key, value });
  }

  async getAll(): Promise<Record<string, string>> {
    const settings = await this.settingsRepo.find();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }
}
