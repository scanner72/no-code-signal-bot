import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Strategy } from '../strategies/strategy.entity';
import { StrategiesModule } from '../strategies/strategies.module';
import { CodegenController } from './codegen.controller';
import { CodegenService } from './codegen.service';
import { AstToPythonRenderer } from './ast-to-python.renderer';
import { StrategyValidatorService } from './strategy-validator.service';
import { SandboxService } from './sandbox.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Strategy]),
    StrategiesModule,
  ],
  controllers: [CodegenController],
  providers: [CodegenService, AstToPythonRenderer, StrategyValidatorService, SandboxService],
  exports: [CodegenService],
})
export class CodegenModule {}
