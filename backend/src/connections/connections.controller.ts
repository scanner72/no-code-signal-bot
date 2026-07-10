import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { ConnectionsService } from './connections.service';
import { DeliveryService } from '../delivery/delivery.service';
import { getSessionUser } from '../auth/auth';

@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly delivery: DeliveryService,
  ) {}

  private async userId(req: Request): Promise<string | null> {
    const user = await getSessionUser(req.headers);
    return user?.id || null;
  }

  @Get()
  async list(@Req() req: Request, @Query('type') type?: string) {
    return this.connections.list(await this.userId(req), type);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    return this.connections.create(await this.userId(req), body);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.connections.update(await this.userId(req), id, body);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.connections.remove(await this.userId(req), id);
    return { ok: true };
  }

  @Post(':id/test')
  async test(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    // Ownership check via the same path the UI uses
    const list = await this.connections.list(await this.userId(req));
    if (!list.some((c) => c.id === id)) return { ok: false, error: 'Подключение не найдено' };
    return this.delivery.sendTest(id, body?.chatId);
  }
}
