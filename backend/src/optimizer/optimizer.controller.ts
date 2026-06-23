import { Controller, Post, Body, Param } from '@nestjs/common';
import { OptimizerService } from './optimizer.service';
import { BacktestOptions } from '../backtest/backtest.service';

@Controller('optimizer')
export class OptimizerController {
  constructor(private readonly optimizerService: OptimizerService) {}

  @Post(':id/run')
  async runOptimization(
    @Param('id') id: string,
    @Body('options') options: BacktestOptions,
    @Body('params') params: any[],
  ) {
    return this.optimizerService.runOptimization(+id, options, params);
  }
}
