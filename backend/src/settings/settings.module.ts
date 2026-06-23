import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { Setting } from './setting.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { HermesModule } from '../hermes/hermes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Setting]),
    TelegramModule,
    forwardRef(() => HermesModule),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
