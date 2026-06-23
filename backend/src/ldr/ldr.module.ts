import { Module, forwardRef } from '@nestjs/common';
import { LdrService } from './ldr.service';
import { RedisModule } from '../redis/redis.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [RedisModule, forwardRef(() => SettingsModule)],
  providers: [LdrService],
  exports: [LdrService],
})
export class LdrModule {}
