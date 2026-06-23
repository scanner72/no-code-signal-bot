import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { RiskService } from './risk.service';
import { BotInstance } from './bot-instance.entity';

@Controller('fleet')
export class FleetController {
  constructor(
    private readonly fleetService: FleetService,
    private readonly riskService: RiskService,
  ) {}

  @Get()
  async getAll() {
    return this.fleetService.getAll();
  }

  @Get('risk')
  async getRisk() {
    return this.riskService.getPortfolioRisk();
  }

  @Post()
  async create(@Body() data: Partial<BotInstance>) {
    return this.fleetService.createInstance(data);
  }

  @Post(':id/start')
  async start(@Param('id') id: string) {
    return this.fleetService.startInstance(+id);
  }

  @Post(':id/stop')
  async stop(@Param('id') id: string) {
    return this.fleetService.stopInstance(+id);
  }

  @Post('panic')
  async panic() {
    return this.fleetService.panicStop();
  }
}
