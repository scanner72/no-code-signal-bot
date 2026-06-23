import { Controller, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { BacktestService } from './backtest.service';

@Controller('backtest')
export class BacktestController {
  constructor(
    private readonly backtestService: BacktestService,
  ) {}

  @Post(':strategyId')
  run(
    @Param('strategyId', ParseIntPipe) strategyId: number,
    @Body() body: any,
  ) {
    return this.backtestService.run(strategyId, body);
  }
}
