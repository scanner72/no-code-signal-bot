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

  @Delete(':id')
  async deleteModel(@Param('id') id: string) {
    return this.mlService.deleteModel(+id);
  }
}
