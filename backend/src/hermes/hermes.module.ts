import { Module, forwardRef } from '@nestjs/common';
import { HermesService } from './hermes.service';
import { HeymMcpService } from './heym-mcp.service';
import { RedisModule } from '../redis/redis.module';
import { SettingsModule } from '../settings/settings.module';
import { LdrModule } from '../ldr/ldr.module';

@Module({
  imports: [RedisModule, forwardRef(() => SettingsModule), LdrModule],
  providers: [HermesService, HeymMcpService],
  exports: [HermesService, HeymMcpService],
})
export class HermesModule {}


