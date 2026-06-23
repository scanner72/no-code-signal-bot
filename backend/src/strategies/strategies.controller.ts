import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe, Delete } from '@nestjs/common';
import { StrategiesService } from './strategies.service';
import { ValidationService } from './validation.service';
import { AstCompilerService } from './ast-compiler.service';

@Controller('strategies')
export class StrategiesController {
  constructor(
    private readonly strategiesService: StrategiesService,
    private readonly validationService: ValidationService,
    private readonly astCompiler: AstCompilerService,
  ) {}

  @Post('validate')
  async validate(@Body() data: { nodes: any[]; edges: any[] }) {
    try {
      const ast = this.astCompiler.compile(data.nodes, data.edges);
      return await this.validationService.validate(ast);
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  @Get()
  findAll() {
    return this.strategiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.strategiesService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.strategiesService.create(data);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.strategiesService.update(id, data);
  }

  @Patch(':id/toggle')
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.strategiesService.toggleActive(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.strategiesService.remove(id);
  }

  // ── Versioning ──────────────────────────────────────────────────────────

  @Get(':id/versions')
  getVersions(@Param('id', ParseIntPipe) id: number) {
    return this.strategiesService.getVersions(id);
  }

  @Get(':id/versions/:version')
  getVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.strategiesService.getVersion(id, version);
  }

  @Post(':id/versions/:version/restore')
  restoreVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.strategiesService.restoreVersion(id, version);
  }
}
