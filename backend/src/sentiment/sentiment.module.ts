import { Module } from '@nestjs/common';
import { SentimentService } from './sentiment.service';
import { SentimentController } from './sentiment.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
    imports: [SettingsModule],
    providers: [SentimentService],
    controllers: [SentimentController],
    exports: [SentimentService],
})
export class SentimentModule {}
