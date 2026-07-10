import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy } from './strategy.entity';
import { StrategyVersion } from './strategy-version.entity';
import { AstCompilerService } from './ast-compiler.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaperAccountsService } from '../paper-trading/paper-accounts.service';

@Injectable()
export class StrategiesService {
  constructor(
    @InjectRepository(Strategy)
    private strategyRepository: Repository<Strategy>,
    @InjectRepository(StrategyVersion)
    private versionRepository: Repository<StrategyVersion>,
    private astCompiler: AstCompilerService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => PaperAccountsService))
    private paperAccountsService: PaperAccountsService,
  ) {}

  findAll() {
    return this.strategyRepository.find();
  }

  findAllByUser(userId: string) {
    return this.strategyRepository.find({
      where: [
        { user_id: userId },
        { user_id: null }
      ]
    });
  }


  findOne(id: number) {
    return this.strategyRepository.findOneByOrFail({ id });
  }

  async create(data: any) {
    const nodes = data.nodes ?? [];
    const edges = data.edges ?? [];
    const ast = nodes.length ? this.astCompiler.compile(nodes, edges) : null;
    const strategy: any = this.strategyRepository.create({
      ...data,
      nodes,
      edges,
      ast,
      owner_id: data.owner_id || data.user_id || null,
    } as any);
    const saved: any = await this.strategyRepository.save(strategy);

    // Create initial version (v1)
    await this.versionRepository.save(
      this.versionRepository.create({
        strategy_id: saved.id,
        version: 1,
        label: 'Первая версия',
        nodes,
        edges,
        ast,
      } as any),
    );

    await this.paperAccountsService.syncPaperAccounts(saved);

    return saved;
  }

  async publish(id: number) {
    const strategy = await this.strategyRepository.findOneByOrFail({ id });
    strategy.visibility = 'public';
    strategy.published_at = new Date();
    strategy.is_active = true;
    strategy.is_paper_trading = true;
    const saved = await this.strategyRepository.save(strategy);
    await this.paperAccountsService.syncPaperAccounts(saved);
    return saved;
  }

  async update(id: number, data: any) {
    const strategy = await this.strategyRepository.findOneByOrFail({ id });
    const nodes = data.nodes ?? strategy.nodes ?? [];
    const edges = data.edges ?? strategy.edges ?? [];
    const ast = nodes.length ? this.astCompiler.compile(nodes, edges) : strategy.ast;
    Object.assign(strategy, { ...data, nodes, edges, ast });
    const saved = await this.strategyRepository.save(strategy);
    await this.paperAccountsService.syncPaperAccounts(saved);

    // Determine next version number and save snapshot
    const lastVersion = await this.versionRepository.findOne({
      where: { strategy_id: id },
      order: { version: 'DESC' },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    await this.versionRepository.save(
      this.versionRepository.create({
        strategy_id: id,
        version: nextVersion,
        label: data.versionLabel || null,
        nodes,
        edges,
        ast,
      } as any),
    );

    return saved;
  }

  async toggleActive(id: number) {
    const strategy = await this.strategyRepository.findOneByOrFail({ id });
    strategy.is_active = !strategy.is_active;
    const saved = await this.strategyRepository.save(strategy);

    if (!saved.is_active) {
      this.eventEmitter.emit('strategy.deactivated', { strategyId: id });
    }

    return saved;
  }

  async remove(id: number) {
    const strategy = await this.strategyRepository.findOneByOrFail({ id });
    this.eventEmitter.emit('strategy.deactivated', { strategyId: id });
    return this.strategyRepository.remove(strategy);
  }


  // ── Versioning API ────────────────────────────────────────────────────────

  async getVersions(strategyId: number) {
    return this.versionRepository.find({
      where: { strategy_id: strategyId },
      order: { version: 'DESC' },
      select: ['id', 'version', 'label', 'created_at'],
    });
  }

  async getVersion(strategyId: number, version: number) {
    return this.versionRepository.findOneOrFail({
      where: { strategy_id: strategyId, version },
    });
  }

  async restoreVersion(strategyId: number, version: number) {
    const snapshot = await this.versionRepository.findOneOrFail({
      where: { strategy_id: strategyId, version },
    });
    const strategy = await this.strategyRepository.findOneByOrFail({ id: strategyId });

    // Save the rollback as a new version
    const lastVersion = await this.versionRepository.findOne({
      where: { strategy_id: strategyId },
      order: { version: 'DESC' },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    strategy.nodes = snapshot.nodes;
    strategy.edges = snapshot.edges;
    strategy.ast = snapshot.ast;
    const saved = await this.strategyRepository.save(strategy);

    await this.versionRepository.save(
      this.versionRepository.create({
        strategy_id: strategyId,
        version: nextVersion,
        label: `Откат к v${version}`,
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        ast: snapshot.ast,
      } as any),
    );

    return saved;
  }
}
