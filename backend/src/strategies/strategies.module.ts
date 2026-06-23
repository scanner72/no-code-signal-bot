import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Strategy } from './strategy.entity';
import { StrategyVersion } from './strategy-version.entity';
import { StrategiesService } from './strategies.service';
import { StrategiesController } from './strategies.controller';
import { AstCompilerService } from './ast-compiler.service';
import { ValidationService } from './validation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Strategy, StrategyVersion])],
  controllers: [StrategiesController],
  providers: [StrategiesService, AstCompilerService, ValidationService],
  exports: [TypeOrmModule, StrategiesService, AstCompilerService, ValidationService],
})
export class StrategiesModule {}
