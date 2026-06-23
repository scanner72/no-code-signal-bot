import { Module } from '@nestjs/common';
import { KronosController } from './kronos.controller';
import { KronosService } from './kronos.service';

@Module({
  controllers: [KronosController],
  providers: [KronosService],
  exports: [KronosService], // Export so codegen/strategies can use it
})
export class KronosModule {}
