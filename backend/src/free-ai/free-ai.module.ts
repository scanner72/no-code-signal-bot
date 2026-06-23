import { Module, Global } from '@nestjs/common';
import { FreeAiService } from './free-ai.service';
import { FreeAiController } from './free-ai.controller';
import { QwenAuthManager } from './auth/qwen-auth.manager';
import { DeepSeekAuthManager } from './auth/deepseek-auth.manager';
import { DeepSeekPowSolver } from './pow/deepseek-pow.solver';
import { FreeAiSseParser } from './sse/free-ai-sse.parser';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    FreeAiService,
    QwenAuthManager,
    DeepSeekAuthManager,
    DeepSeekPowSolver,
    FreeAiSseParser,
  ],
  controllers: [FreeAiController],
  exports: [FreeAiService],
})
export class FreeAiModule {}
