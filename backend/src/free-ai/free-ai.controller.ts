import { Controller, Post, Body, Get } from '@nestjs/common';
import { FreeAiService, FreeAiChatRequest, FreeAiProvider } from './free-ai.service';
import { RedisService } from '../redis/redis.service';

/**
 * FreeAiController
 * REST API for triggering Free AI conversations and checking session status.
 * POST /api/free-ai/chat         - Send a prompt to Qwen or DeepSeek
 * POST /api/free-ai/copilot      - Ask AI to build or edit strategy nodes
 * GET  /api/free-ai/status       - Check auth status of providers
 * GET  /api/free-ai/debug-tokens - Диагностика: состояние токенов в Redis
 */
@Controller('free-ai')
export class FreeAiController {
  constructor(
    private readonly freeAiService: FreeAiService,
    private readonly redis: RedisService,
  ) {}

  @Post('chat')
  async chat(@Body() body: FreeAiChatRequest) {
    const result = await this.freeAiService.chat(body);
    return { success: true, data: result };
  }

  @Post('copilot')
  async copilot(@Body() body: {
    provider?: FreeAiProvider;
    prompt: string;
    currentNodes?: any[];
    currentEdges?: any[];
    pair?: string;
    timeframe?: string;
  }) {
    const result = await this.freeAiService.generateCopilotStrategy(body);
    return { success: true, data: result };
  }

  @Get('status')
  status() {
    return {
      providers: ['qwen', 'deepseek'],
      rateLimitMs: 5000,
      cacheEnabled: true,
      cacheTtlSeconds: 90,
    };
  }

  /** Диагностика: показывает наличие и формат токенов в Redis */
  @Get('debug-tokens')
  async debugTokens() {
    const qwenToken = await this.redis.get('free-ai:qwen:token');
    const dsToken = await this.redis.get('free-ai:deepseek:token');
    const dsCookies = await this.redis.get('free-ai:deepseek:cookies');

    return {
      qwen: {
        tokenPresent: !!qwenToken,
        tokenType: typeof qwenToken,
        tokenPreview: qwenToken ? String(qwenToken).substring(0, 30) + '...' : null,
        tokenLength: qwenToken ? String(qwenToken).length : 0,
        startsWithEyJ: qwenToken ? String(qwenToken).startsWith('eyJ') : false,
      },
      deepseek: {
        tokenPresent: !!dsToken,
        tokenPreview: dsToken ? String(dsToken).substring(0, 30) + '...' : null,
        tokenLength: dsToken ? String(dsToken).length : 0,
        cookiesPresent: !!dsCookies,
        cookiesLength: dsCookies ? String(dsCookies).length : 0,
      },
    };
  }
}
