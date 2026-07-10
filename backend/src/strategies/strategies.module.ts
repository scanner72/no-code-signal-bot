import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Strategy } from './strategy.entity';
import { StrategyVersion } from './strategy-version.entity';
import { StrategiesService } from './strategies.service';
import { StrategiesController } from './strategies.controller';
import { AstCompilerService } from './ast-compiler.service';
import { ValidationService } from './validation.service';
import { PaperTradingModule } from '../paper-trading/paper-trading.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Strategy, StrategyVersion]),
    forwardRef(() => PaperTradingModule),
  ],
  controllers: [StrategiesController],
  providers: [
    StrategiesService,
    AstCompilerService,
    ValidationService,
  ],
  exports: [
    TypeOrmModule,
    StrategiesService,
    AstCompilerService,
    ValidationService,
  ],
})
export class StrategiesModule {}
