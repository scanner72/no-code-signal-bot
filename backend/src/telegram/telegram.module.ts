import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramService } from './telegram.service';
import { DiscordService } from './discord.service';
import { ChartScreenshotService } from './chart-screenshot.service';
import { Setting } from '../settings/setting.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [TelegramService, DiscordService, ChartScreenshotService],
  exports: [TelegramService, DiscordService],
})
export class TelegramModule {}
