import { Controller, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { OptimizerService } from './optimizer.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

@Controller('optimizer')
export class OptimizerController {
  constructor(
    private readonly optimizerService: OptimizerService,
    @InjectRepository(Strategy)
    private readonly strategyRepo: Repository<Strategy>,
  ) {}

  @Post(':strategyId/run')
  async optimize(
    @Param('strategyId', ParseIntPipe) strategyId: number,
    @Body() body: {
        options: {
            pair: string;
            timeframe: string;
            days: number;
        };
        params: any[];
    },
  ) {
    const strategy = await this.strategyRepo.findOneBy({ id: strategyId });
    if (!strategy) throw new Error('Strategy not found');

    return this.optimizerService.optimize(strategy, {
        pair: body.options.pair || strategy.pair,
        timeframe: body.options.timeframe || strategy.timeframe,
        days: body.options.days || 30,
        iterations: 10,
        populationSize: 20
    });
  }
}
