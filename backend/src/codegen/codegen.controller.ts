import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import { CodegenService, CodegenConfig } from './codegen.service';
import { StrategyValidatorService } from './strategy-validator.service';

class GenerateBotDto {
  strategyId: number;
  config: CodegenConfig;
}

@Controller('codegen')
export class CodegenController {
  constructor(
    private readonly codegenService: CodegenService,
    private readonly validator: StrategyValidatorService,
  ) {}

  /**
   * POST /api/codegen/generate
   * Generates a complete bot ZIP from a strategy.
   */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(@Body() dto: GenerateBotDto) {
    const result = await this.codegenService.generateBot(dto.strategyId, dto.config);
    return {
      success:      true,
      botId:        result.botId,
      botName:      result.botName,
      strategyName: result.strategyName,
      files:        result.files,
      previewCode:  result.previewCode,
      downloadUrl:  `/codegen/download/${result.botId}`,
    };
  }

  /**
   * GET /api/codegen/preview/:strategyId
   * Returns the generated strategy.py code for preview without creating a bot.
   */
  @Get('preview/:strategyId')
  async preview(@Param('strategyId', ParseIntPipe) strategyId: number) {
    const code = await this.codegenService.previewStrategy(strategyId);
    return { code };
  }

  /**
   * GET /api/codegen/download/:botId
   * Streams the ZIP file for download.
   */
  @Get('download/:botId')
  async download(@Param('botId') botId: string, @Res() res: Response) {
    const zipPath = this.codegenService.getZipPath(botId);
    const filename = `${botId}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.download(zipPath, filename);
  }

  /**
   * GET /api/codegen/validate/:strategyId
   * Validates a strategy before generation.
   */
  @Get('validate/:strategyId')
  async validate(@Param('strategyId', ParseIntPipe) strategyId: number) {
    return this.codegenService.validateStrategy(strategyId);
  }
}
