import { Controller, Get, Post, Query, Param, Body, ParseIntPipe } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SignalsGateway } from './signals.gateway';
import { SignalsEngineService } from './signals-engine.service';

@Controller('signals')
export class SignalsController {
  constructor(
    private readonly signalsService: SignalsService,
    private readonly signalsGateway: SignalsGateway,
    private readonly signalsEngineService: SignalsEngineService,
  ) {}

  @Get()
  findAll(@Query('limit') limit?: number, @Query('offset') offset?: number) {
    return this.signalsService.getLatestSignals(limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get('pair/:pair')
  findByPair(@Param('pair') pair: string) {
    return this.signalsService.findByPair(pair);
  }

  @Get('stats/strategies')
  getAllStrategiesStats() {
    return this.signalsService.getAllStrategiesStats();
  }

  @Get('stats/strategy/:id')
  getStatsByStrategy(@Param('id', ParseIntPipe) id: number) {
    return this.signalsService.getStatsByStrategy(id);
  }

  @Post('test')
  async generateTestSignal() {
    const signal = await this.signalsService.createSignal({
      strategy_id: 1,
      pair: 'BTCUSDT',
      timeframe: '15m',
      type: 'LONG',
      price: 64120.50,
      metadata: { strategy_name: 'TEST SIGNAL' }
    });
    this.signalsGateway.broadcastSignal(signal);
    return signal;
  }

  @Post('webhook/:nodeId')
  async receiveWebhook(@Param('nodeId') nodeId: string, @Body() payload: any) {
    return this.signalsEngineService.handleWebhook(nodeId, payload);
  }

  @Get('execution-trace/:id')
  getExecutionTrace(@Param('id', ParseIntPipe) id: number) {
    return this.signalsEngineService.getExecutionTrace(id);
  }
}

