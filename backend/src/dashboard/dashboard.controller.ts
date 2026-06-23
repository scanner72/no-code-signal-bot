import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseInterceptors(CacheInterceptor)
  @CacheKey('dashboard_stats')
  @CacheTTL(30)
  @Get('stats')
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('screener')
  getScreener() {
    return this.dashboardService.getScreener();
  }
}
