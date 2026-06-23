import { Controller, Get, Param, Query } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { CandlesService } from '../candles/candles.service';

@Controller('indicators')
export class IndicatorsController {
  constructor(
    private readonly indicatorsService: IndicatorsService,
    private readonly candlesService: CandlesService,
  ) {}

  @Get('smc/:pair/:timeframe')
  async getSmcZones(
    @Param('pair') pair: string,
    @Param('timeframe') timeframe: string,
    @Query('lookback') lookback?: number,
  ) {
    const candles = await this.candlesService.getLatestCandles(pair, timeframe, 200);
    const fvg = this.indicatorsService.detectFVG(candles, lookback || 100);
    const ob = this.indicatorsService.detectOrderBlocks(candles, lookback || 100);
    const structure = this.indicatorsService.detectMarketStructure(candles, lookback || 100);
    
    return { fvg, ob, structure };
  }

  @Get('smc_query')
  async getSmcZonesQuery(
    @Query('pair') pair: string,
    @Query('timeframe') timeframe: string,
    @Query('lookback') lookback?: number,
  ) {
    const candles = await this.candlesService.getLatestCandles(pair, timeframe, 200);
    const fvg = this.indicatorsService.detectFVG(candles, lookback || 100);
    const ob = this.indicatorsService.detectOrderBlocks(candles, lookback || 100);
    const structure = this.indicatorsService.detectMarketStructure(candles, lookback || 100);
    
    return { fvg, ob, structure };
  }

  @Get('preview')
  async getPreview(
    @Query('pair') pair: string,
    @Query('timeframe') timeframe: string,
    @Query('type') type: string,
    @Query('name') name: string,
    @Query('params') paramsJson: string,
  ) {
    const params = paramsJson ? JSON.parse(paramsJson) : {};
    const candles = await this.candlesService.getLatestCandles(pair || 'BTCUSDT', timeframe || '1h', 200);
    
    let indicators: any = [];
    let status = 'Neutral';
    let currentValue = 0;

    if (type === 'indicator') {
        indicators = this.indicatorsService.calculateGeneric(name, candles, params);
        if (indicators.length > 0) {
            currentValue = indicators[indicators.length - 1];
            // Simple logic for status
            if (name === 'RSI') {
                if (currentValue > 70) status = 'Overbought';
                else if (currentValue < 30) status = 'Oversold';
            }
        }
    } else if (type === 'smc') {
        const lookback = params.lookback || 100;
        const fvg = this.indicatorsService.detectFVG(candles, lookback);
        const ob = this.indicatorsService.detectOrderBlocks(candles, lookback);
        const structure = this.indicatorsService.detectMarketStructure(candles, lookback);
        indicators = { fvg, ob, structure };
    }

    return {
      candles,
      indicators,
      status,
      currentValue
    };
  }
}
