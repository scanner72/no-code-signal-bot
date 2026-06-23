import { Controller, Get, Query } from '@nestjs/common';
import { OrderbookService } from './orderbook.service';

@Controller('orderbook')
export class OrderbookController {
  constructor(private readonly orderbookService: OrderbookService) {}

  @Get('depth')
  async getDepth(@Query('pair') pair: string) {
    return this.orderbookService.getDepthSnapshot(pair);
  }

  @Get('clusters')
  async getClusters(@Query('pair') pair: string) {
    return this.orderbookService.getLiquidityClusters(pair);
  }
}
