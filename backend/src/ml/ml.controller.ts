import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { MLService } from './ml.service';

@Controller('ml')
export class MLController {
  constructor(private readonly mlService: MLService) {}

  @Post('create')
  async create(@Body() data: any) {
    return this.mlService.createModel(data);
  }

  @Get('models')
  async getAll() {
    return this.mlService.getAll();
  }

  @Post('train/:id')
  async train(@Param('id') id: string) {
    return this.mlService.trainModel(+id);
  }

  @Get('backtest/:id')
  async backtest(@Param('id') id: string) {
    return this.mlService.backtestModel(+id);
  }

  @Get('importance/:id')
  async featureImportance(@Param('id') id: string) {
    return this.mlService.getFeatureImportance(+id);
  }

  @Post('create-version/:id')
  async createVersion(@Param('id') id: string) {
    return this.mlService.createModelVersion(+id);
  }

  @Get('strategy-config/:strategyId')
  async getStrategyConfig(@Param('strategyId') strategyId: string) {
    return this.mlService.getStrategyModelsConfig(+strategyId);
  }

  @Post('ab-test/:strategyId')
  async setAbTestConfig(@Param('strategyId') strategyId: string, @Body() config: any) {
    return this.mlService.setAbTestConfig(+strategyId, config);
  }

  @Get('ab-test/stats/:strategyId')
  async getAbTestStats(@Param('strategyId') strategyId: string) {
    return this.mlService.getAbTestStats(+strategyId);
  }

  @Delete(':id')
  async deleteModel(@Param('id') id: string) {
    return this.mlService.deleteModel(+id);
  }
}
