import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { KronosService, KronosPrediction } from './kronos.service';

class PredictDto {
  symbol: string;
  timeframe: string;
  candles: Array<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp?: string;
  }>;
  predLen?: number;
  temperature?: number;
  topP?: number;
  sampleCount?: number;
}

@Controller('kronos')
export class KronosController {
  private readonly logger = new Logger(KronosController.name);

  constructor(private readonly kronosService: KronosService) {}

  /** GET /api/kronos/status — Check Kronos AI availability */
  @Get('status')
  async getStatus() {
    const health = await this.kronosService.getHealth();
    const modelInfo = await this.kronosService.getModelInfo();

    return {
      online: health.status === 'ok',
      ...health,
      ...(modelInfo && {
        model_id: modelInfo.model_id,
        params: modelInfo.params,
        context_length: modelInfo.context_length,
        hardware: modelInfo.hardware,
        available_models: modelInfo.available_models,
      }),
    };
  }

  /** POST /api/kronos/predict — Run AI price forecast */
  @Post('predict')
  async predict(@Body() dto: PredictDto): Promise<KronosPrediction> {
    if (!this.kronosService.isAvailable()) {
      throw new HttpException(
        'Kronos AI service is not available. Make sure the kronos container is running.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!dto.candles || dto.candles.length < 50) {
      throw new HttpException(
        'At least 50 candles are required for prediction',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.kronosService.predict(
        dto.symbol,
        dto.timeframe,
        dto.candles,
        {
          predLen: dto.predLen,
          temperature: dto.temperature,
          topP: dto.topP,
          sampleCount: dto.sampleCount,
        },
      );
    } catch (error) {
      this.logger.error(`Prediction failed: ${error.message}`);
      throw new HttpException(
        `Prediction failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** GET /api/kronos/finviz/screener — Get Stock Screener data from Finviz */
  @Get('finviz/screener')
  async getFinvizScreener(
    @Query('signal') signal?: string,
    @Query('short_float') shortFloat?: string,
    @Query('sma_200') sma200?: string,
    @Query('inst_own') instOwn?: string,
  ) {
    return this.kronosService.getFinvizScreener(signal || 'top_gainers', {
      shortFloat,
      sma200,
      instOwn,
    });
  }

  /** GET /api/kronos/finviz/insider — Get Insider transactions from Finviz */
  @Get('finviz/insider')
  async getFinvizInsider(@Query('option') option?: string) {
    return this.kronosService.getFinvizInsider(option || 'latest');
  }

  /** GET /api/kronos/finviz/news — Get news for a specific stock ticker */
  @Get('finviz/news')
  async getFinvizNews(@Query('ticker') ticker: string) {
    if (!ticker) {
      throw new HttpException('Ticker query param is required', HttpStatus.BAD_REQUEST);
    }
    return this.kronosService.getFinvizNews(ticker);
  }
}
