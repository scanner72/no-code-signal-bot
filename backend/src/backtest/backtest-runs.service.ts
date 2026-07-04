import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BacktestRun } from './backtest-run.entity';

@Injectable()
export class BacktestRunsService {
  private readonly logger = new Logger(BacktestRunsService.name);

  constructor(
    @InjectRepository(BacktestRun)
    private runRepository: Repository<BacktestRun>,
  ) {}

  async saveRun(strategyId: number, options: any, result: any): Promise<BacktestRun> {
    return this.runRepository.save(
      this.runRepository.create({ strategy_id: strategyId, options, result }),
    );
  }

  /** Список для drawer'а: метрики без trades/equityCurve/benchmark */
  async listRuns(strategyId: number, limit = 50) {
    const runs = await this.runRepository.find({
      where: { strategy_id: strategyId },
      order: { created_at: 'DESC' },
      take: limit,
    });
    return runs.map((r) => ({
      id: r.id,
      strategy_id: r.strategy_id,
      created_at: r.created_at,
      options: r.options,
      summary: {
        totalReturn: r.result?.totalReturn ?? 0,
        totalTrades: r.result?.totalTrades ?? 0,
        winRate: r.result?.winRate ?? 0,
        maxDrawdown: r.result?.maxDrawdown ?? 0,
        finalBalance: r.result?.finalBalance ?? 0,
      },
    }));
  }

  async getRun(id: number): Promise<BacktestRun | null> {
    return this.runRepository.findOneBy({ id });
  }

  async deleteRun(id: number): Promise<void> {
    await this.runRepository.delete({ id });
  }
}
