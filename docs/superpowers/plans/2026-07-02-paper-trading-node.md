# Paper Trading Output Node — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Выходная нода «Paper Trading» в Strategy Builder: несколько нод на один сигнал ведут независимые виртуальные счета (капитал, плечо, % на сделку, свой SL/TP) для сравнения конфигов; результаты в БД, live-статы на ноде, страница сравнения.

**Architecture:** Новая сущность `PaperTradingAccount` (1 запись = 1 нода на канвасе, ключ `strategy_id+node_id`) + расширение `VirtualTrade`. Новый сервис `PaperAccountsService` (sync нод→аккаунтов, открытие/закрытие сделок с маржой и плечом, отдельный cron-мониторинг). Сигнальный движок находит ноды обходом сырого графа `strategy.nodes/edges` вперёд от signal-ноды (НЕ через ast — trade-ноды в ast не попадают). Старый путь paper trading (тумблер `is_paper_trading`) не изменяется.

**Tech Stack:** NestJS + TypeORM (postgres, `synchronize: true` — миграции не нужны), Jest; React + reactflow + zustand + axios (фронт).

**Spec:** `docs/superpowers/specs/2026-07-02-paper-trading-node-design.md`

## Global Constraints

- TypeORM `synchronize: true` — новые таблицы/колонки создаются сами; НЕ писать миграции.
- Legacy-путь (тумблер `is_paper_trading`, `PaperTradingService.openTrade/checkOpenTrades`) менять только в одном месте: исключить account-сделки из старого cron (Task 5). Всё остальное — не трогать.
- SL/TP/trailing/partial-TP пороги — проценты **движения цены** (как в legacy). Плечо влияет только на денежный PnL и ликвидацию: ликвидация при `pricePnl <= -100/leverage`.
- `pnl_percent` у account-сделок хранится как PnL **на маржу** (price% × leverage); у legacy-сделок — как раньше (price%).
- Backend-команды запускать из `backend/`, фронтенд — из `frontend/`.
- UI-тексты новой ноды — на русском (как в остальном UI).
- Тип ноды: `paper_trading_output`. Цвет: `#22d3ee`.
- Node id на канвасе генерируется как `node_${Date.now()}` (существующий onDrop) — коллизий внутри стратегии нет; уникальность аккаунта = `(strategy_id, node_id)`.

---

### Task 1: Сущности PaperTradingAccount + расширение VirtualTrade

**Files:**
- Create: `backend/src/paper-trading/paper-trading-account.entity.ts`
- Modify: `backend/src/paper-trading/virtual-trade.entity.ts` (добавить 3 колонки после `risk_multiplier`, ~строка 57)
- Modify: `backend/src/paper-trading/paper-trading.module.ts` (зарегистрировать entity)

**Interfaces:**
- Produces: класс `PaperTradingAccount` (поля см. код ниже); `VirtualTrade.paper_account_id: number | null`, `VirtualTrade.margin_used`, `VirtualTrade.leverage_used`. Их используют Tasks 3–7.

- [ ] **Step 1: Создать entity аккаунта**

```typescript
// backend/src/paper-trading/paper-trading-account.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

@Entity('paper_trading_accounts')
@Index(['strategy_id', 'node_id'], { unique: true })
export class PaperTradingAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Strategy)
  strategy: Strategy;

  @Column()
  strategy_id: number;

  /** React Flow node id — стабильный ключ инстанса ноды на канвасе */
  @Column()
  node_id: string;

  @Column({ default: 'Config' })
  label: string;

  @Column('decimal', { precision: 20, scale: 2, default: 1000 })
  starting_capital: number;

  /** Свободный баланс (маржа открытых позиций уже вычтена) */
  @Column('decimal', { precision: 20, scale: 2, default: 1000 })
  current_balance: number;

  @Column('decimal', { precision: 6, scale: 2, default: 1 })
  leverage: number;

  /** % от текущего баланса на сделку (компаундинг) */
  @Column('decimal', { precision: 5, scale: 2, default: 10 })
  risk_percent: number;

  // Свой SL/TP (проценты движения цены), независимы от strategy.execution_settings
  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  sl_percent: number | null;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  tp_percent: number | null;

  @Column({ default: false })
  use_trailing: boolean;

  @Column('decimal', { precision: 10, scale: 4, default: 1 })
  trailing_distance: number;

  @Column('decimal', { precision: 10, scale: 4, default: 0.5 })
  trailing_activation: number;

  @Column({ default: false })
  move_sl_to_be: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  partial_tps: Array<{ target: number; closePercent: number }>;

  /** Сколько сигналов пропущено из-за нехватки баланса (виден на ноде) */
  @Column({ type: 'int', default: 0 })
  skipped_signals: number;

  /** false = нода удалена с канваса; история сохраняется для сравнения */
  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
```

- [ ] **Step 2: Добавить колонки в VirtualTrade**

В `backend/src/paper-trading/virtual-trade.entity.ts` после блока `risk_multiplier` (строка ~57) вставить:

```typescript
  // ── Paper Trading Account (per-node virtual accounts) ────────────────────
  /** NULL = сделка legacy-пути (тумблер is_paper_trading) */
  @Column({ nullable: true })
  paper_account_id: number;

  @Column('decimal', { precision: 20, scale: 2, nullable: true })
  margin_used: number;

  @Column('decimal', { precision: 6, scale: 2, nullable: true })
  leverage_used: number;
```

- [ ] **Step 3: Зарегистрировать entity в модуле**

В `backend/src/paper-trading/paper-trading.module.ts`:

```typescript
import { PaperTradingAccount } from './paper-trading-account.entity';
// ...
    TypeOrmModule.forFeature([VirtualTrade, PaperTradingAccount]),
```

- [ ] **Step 4: Проверить сборку**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json` (или `npm run build`)
Expected: без ошибок компиляции.

- [ ] **Step 5: Commit**

```bash
git add backend/src/paper-trading/paper-trading-account.entity.ts backend/src/paper-trading/virtual-trade.entity.ts backend/src/paper-trading/paper-trading.module.ts
git commit -m "feat(paper): PaperTradingAccount entity + VirtualTrade account columns"
```

---

### Task 2: Утилита обхода графа paper-node-finder (чистая функция)

**Files:**
- Create: `backend/src/paper-trading/paper-node-finder.ts`
- Test: `backend/src/paper-trading/paper-node-finder.spec.ts`

**Interfaces:**
- Produces: `findPaperNodesForSignal(nodes, edges, signalType): string[]` — id всех `paper_trading_output`-нод, достижимых вперёд от signal-нод с данным `signalType`. Используется в Task 6.

- [ ] **Step 1: Написать падающий тест**

```typescript
// backend/src/paper-trading/paper-node-finder.spec.ts
import { findPaperNodesForSignal } from './paper-node-finder';

describe('findPaperNodesForSignal', () => {
  const nodes = [
    { id: 'rsi1', type: 'indicator', data: {} },
    { id: 'sig1', type: 'signal', data: { signalType: 'LONG' } },
    { id: 'sig2', type: 'signal', data: { signalType: 'SHORT' } },
    { id: 'paper1', type: 'paper_trading_output', data: { label: 'A' } },
    { id: 'paper2', type: 'paper_trading_output', data: { label: 'B' } },
    { id: 'paper3', type: 'paper_trading_output', data: { label: 'C' } },
    { id: 'tg1', type: 'trade_action', data: { action: 'telegram' } },
  ];
  const edges = [
    { source: 'rsi1', target: 'sig1' },
    { source: 'sig1', target: 'paper1' },
    { source: 'sig1', target: 'paper2' },
    { source: 'sig1', target: 'tg1' },
    { source: 'sig2', target: 'paper3' },
  ];

  it('находит все paper-ноды после LONG-сигнала', () => {
    expect(findPaperNodesForSignal(nodes, edges, 'LONG').sort()).toEqual(['paper1', 'paper2']);
  });

  it('находит paper-ноды только нужного signalType', () => {
    expect(findPaperNodesForSignal(nodes, edges, 'SHORT')).toEqual(['paper3']);
  });

  it('пустой результат, если paper-нод нет', () => {
    expect(findPaperNodesForSignal(nodes, [{ source: 'rsi1', target: 'sig1' }], 'LONG')).toEqual([]);
  });

  it('не падает на пустых входах', () => {
    expect(findPaperNodesForSignal([], [], 'LONG')).toEqual([]);
  });

  it('signalType по умолчанию LONG, transit через промежуточные ноды', () => {
    const n = [
      { id: 's', type: 'signal', data: {} }, // нет signalType → LONG
      { id: 'mid', type: 'trade_action', data: {} },
      { id: 'p', type: 'paper_trading_output', data: {} },
    ];
    const e = [
      { source: 's', target: 'mid' },
      { source: 'mid', target: 'p' },
    ];
    expect(findPaperNodesForSignal(n, e, 'LONG')).toEqual(['p']);
  });
});
```

- [ ] **Step 2: Убедиться что тест падает**

Run: `cd backend && npx jest paper-node-finder -v` (флаг `-v` не обязателен)
Expected: FAIL — `Cannot find module './paper-node-finder'`.

- [ ] **Step 3: Реализация**

```typescript
// backend/src/paper-trading/paper-node-finder.ts

/**
 * Находит id всех paper_trading_output-нод, достижимых вперёд (source → target)
 * от signal-нод с заданным signalType. Работает по сырому графу strategy.nodes/edges,
 * т.к. ноды после сигнала в strategy.ast не попадают.
 */
export function findPaperNodesForSignal(
  nodes: Array<{ id: string; type?: string; data?: any }>,
  edges: Array<{ source: string; target: string }>,
  signalType: string,
): string[] {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return [];

  const signalIds = nodes
    .filter((n) => n.type === 'signal' && (n.data?.signalType || 'LONG') === signalType)
    .map((n) => n.id);
  if (!signalIds.length) return [];

  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  }

  const visited = new Set<string>();
  const queue = [...signalIds];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of adjacency.get(id) || []) queue.push(next);
  }

  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  return [...visited].filter((id) => typeById.get(id) === 'paper_trading_output');
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd backend && npx jest paper-node-finder`
Expected: PASS, 5 тестов.

- [ ] **Step 5: Commit**

```bash
git add backend/src/paper-trading/paper-node-finder.ts backend/src/paper-trading/paper-node-finder.spec.ts
git commit -m "feat(paper): graph walker to find paper nodes downstream of a signal"
```

---

### Task 3: PaperAccountsService — синхронизация нод ↔ аккаунтов

**Files:**
- Create: `backend/src/paper-trading/paper-accounts.service.ts`
- Test: `backend/src/paper-trading/paper-accounts.service.spec.ts`
- Modify: `backend/src/paper-trading/paper-trading.module.ts` (provider + export)

**Interfaces:**
- Consumes: `PaperTradingAccount`, `VirtualTrade` (Task 1).
- Produces: класс `PaperAccountsService` c конструктором `(accountRepository, virtualTradeRepository, binanceApiService)` и методами:
  - `syncPaperAccounts(strategy: { id: number; nodes: any[] }): Promise<void>`
  - `getActiveAccounts(strategyId: number, nodeIds: string[]): Promise<PaperTradingAccount[]>`
  Tasks 4–7 добавляют методы в этот же класс.

- [ ] **Step 1: Написать падающие тесты**

```typescript
// backend/src/paper-trading/paper-accounts.service.spec.ts
import { PaperAccountsService } from './paper-accounts.service';

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  findOneBy: jest.fn().mockResolvedValue(null),
  findOneByOrFail: jest.fn(),
  save: jest.fn().mockImplementation(async (x: any) => x),
  create: jest.fn().mockImplementation((x: any) => x),
});

describe('PaperAccountsService.syncPaperAccounts', () => {
  let service: PaperAccountsService;
  let accountRepo: any;
  let tradeRepo: any;

  beforeEach(() => {
    accountRepo = makeRepo();
    tradeRepo = makeRepo();
    service = new PaperAccountsService(accountRepo, tradeRepo, null as any);
  });

  const paperNode = (id: string, data: any = {}) => ({
    id,
    type: 'paper_trading_output',
    data: { label: 'A', startingCapital: 500, leverage: 3, riskPercent: 20, sl: '1%', tp: '3%', ...data },
  });

  it('создаёт аккаунт для новой ноды с балансом = стартовому капиталу', async () => {
    await service.syncPaperAccounts({ id: 7, nodes: [paperNode('n1')] });
    expect(accountRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy_id: 7,
        node_id: 'n1',
        starting_capital: 500,
        current_balance: 500,
        leverage: 3,
        risk_percent: 20,
        sl_percent: 1,
        tp_percent: 3,
        is_active: true,
      }),
    );
  });

  it('обновляет конфиг существующего аккаунта, НЕ трогая current_balance', async () => {
    accountRepo.find.mockResolvedValue([
      { id: 1, strategy_id: 7, node_id: 'n1', current_balance: 777, starting_capital: 500, is_active: true },
    ]);
    await service.syncPaperAccounts({ id: 7, nodes: [paperNode('n1', { leverage: 10, startingCapital: 2000 })] });
    const saved = accountRepo.save.mock.calls[0][0];
    expect(saved.leverage).toBe(10);
    expect(saved.starting_capital).toBe(2000); // поле обновляется (влияет на будущий reset)
    expect(saved.current_balance).toBe(777);   // баланс не сброшен
  });

  it('деактивирует аккаунты удалённых нод', async () => {
    accountRepo.find.mockResolvedValue([
      { id: 1, strategy_id: 7, node_id: 'gone', current_balance: 100, is_active: true },
    ]);
    await service.syncPaperAccounts({ id: 7, nodes: [] });
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ node_id: 'gone', is_active: false }));
  });

  it('реактивирует аккаунт, если нода вернулась (undo)', async () => {
    accountRepo.find.mockResolvedValue([
      { id: 1, strategy_id: 7, node_id: 'n1', current_balance: 100, is_active: false },
    ]);
    await service.syncPaperAccounts({ id: 7, nodes: [paperNode('n1')] });
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ node_id: 'n1', is_active: true }));
  });

  it('игнорирует стратегию без paper-нод и без аккаунтов', async () => {
    await service.syncPaperAccounts({ id: 7, nodes: [{ id: 'x', type: 'signal', data: {} }] });
    expect(accountRepo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Убедиться что тесты падают**

Run: `cd backend && npx jest paper-accounts.service`
Expected: FAIL — `Cannot find module './paper-accounts.service'`.

- [ ] **Step 3: Реализация сервиса (каркас + sync)**

```typescript
// backend/src/paper-trading/paper-accounts.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaperTradingAccount } from './paper-trading-account.entity';
import { VirtualTrade, TradeStatus } from './virtual-trade.entity';
import { BinanceApiService } from '../candles/binance-api.service';

/** data-поле ноды paper_trading_output на канвасе */
interface PaperNodeData {
  label?: string;
  startingCapital?: number | string;
  leverage?: number | string;
  riskPercent?: number | string;
  sl?: string | number;
  tp?: string | number;
  useTrailing?: boolean;
  trailingDistance?: string | number;
  trailingActivation?: string | number;
  moveSLtoBE?: boolean;
  partialTPs?: Array<{ target: any; closePercent: any }>;
}

/** "1.5%" | 1.5 → 1.5; пусто → null */
function parsePercent(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace('%', '').trim());
  return isNaN(n) ? null : n;
}

@Injectable()
export class PaperAccountsService {
  private readonly logger = new Logger(PaperAccountsService.name);

  constructor(
    @InjectRepository(PaperTradingAccount)
    private accountRepository: Repository<PaperTradingAccount>,
    @InjectRepository(VirtualTrade)
    private virtualTradeRepository: Repository<VirtualTrade>,
    private binanceApiService: BinanceApiService,
  ) {}

  /**
   * Синхронизирует paper_trading_output-ноды стратегии с аккаунтами.
   * Существующим аккаунтам обновляется только конфиг — баланс и история не трогаются.
   */
  async syncPaperAccounts(strategy: { id: number; nodes: any[] }): Promise<void> {
    const nodes: any[] = Array.isArray(strategy.nodes) ? strategy.nodes : [];
    const paperNodes = nodes.filter((n) => n.type === 'paper_trading_output');
    const existing = await this.accountRepository.find({ where: { strategy_id: strategy.id } });
    const byNodeId = new Map(existing.map((a) => [a.node_id, a]));

    for (const node of paperNodes) {
      const d: PaperNodeData = node.data || {};
      const cfg = {
        label: d.label || 'Config',
        starting_capital: Number(d.startingCapital) || 1000,
        leverage: Number(d.leverage) || 1,
        risk_percent: Number(d.riskPercent) || 10,
        sl_percent: parsePercent(d.sl),
        tp_percent: parsePercent(d.tp),
        use_trailing: !!d.useTrailing,
        trailing_distance: parsePercent(d.trailingDistance) ?? 1,
        trailing_activation: parsePercent(d.trailingActivation) ?? 0.5,
        move_sl_to_be: !!d.moveSLtoBE,
        partial_tps: Array.isArray(d.partialTPs)
          ? d.partialTPs
              .map((p) => ({ target: parsePercent(p.target) ?? 0, closePercent: Number(p.closePercent) || 0 }))
              .filter((p) => p.target > 0 && p.closePercent > 0)
              .sort((a, b) => a.target - b.target)
          : [],
      };

      const found = byNodeId.get(node.id);
      if (found) {
        Object.assign(found, cfg, { is_active: true });
        await this.accountRepository.save(found);
      } else {
        await this.accountRepository.save(
          this.accountRepository.create({
            strategy_id: strategy.id,
            node_id: node.id,
            current_balance: cfg.starting_capital,
            ...cfg,
          }),
        );
      }
    }

    // Мягкое удаление аккаунтов, чьих нод больше нет на канвасе
    const liveIds = new Set(paperNodes.map((n) => n.id));
    for (const acc of existing) {
      if (!liveIds.has(acc.node_id) && acc.is_active) {
        acc.is_active = false;
        await this.accountRepository.save(acc);
      }
    }
  }

  async getActiveAccounts(strategyId: number, nodeIds: string[]): Promise<PaperTradingAccount[]> {
    if (!nodeIds.length) return [];
    return this.accountRepository.find({
      where: { strategy_id: strategyId, node_id: In(nodeIds), is_active: true },
    });
  }
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd backend && npx jest paper-accounts.service`
Expected: PASS, 5 тестов.

- [ ] **Step 5: Провайдер в модуле**

В `backend/src/paper-trading/paper-trading.module.ts`:

```typescript
import { PaperAccountsService } from './paper-accounts.service';
// ...
  providers: [PaperTradingService, PaperAccountsService],
  exports: [PaperTradingService, PaperAccountsService],
```

- [ ] **Step 6: Сборка + commit**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: без ошибок.

```bash
git add backend/src/paper-trading/paper-accounts.service.ts backend/src/paper-trading/paper-accounts.service.spec.ts backend/src/paper-trading/paper-trading.module.ts
git commit -m "feat(paper): PaperAccountsService with node-to-account sync"
```

---

### Task 4: openAccountTrade / closeAccountTrade — маржа, компаундинг, плечо

**Files:**
- Modify: `backend/src/paper-trading/paper-accounts.service.ts`
- Test: `backend/src/paper-trading/paper-accounts.service.spec.ts` (добавить describe-блоки)

**Interfaces:**
- Consumes: `PaperAccountsService` (Task 3).
- Produces (методы того же класса):
  - `openAccountTrade(account: PaperTradingAccount, pair: string, type: string, entryPrice: number): Promise<VirtualTrade | null>`
  - `closeAccountTrade(id: number, exitPrice: number, reason: string): Promise<void>`

- [ ] **Step 1: Добавить падающие тесты**

Добавить в `paper-accounts.service.spec.ts`:

```typescript
describe('PaperAccountsService.openAccountTrade', () => {
  let service: PaperAccountsService;
  let accountRepo: any;
  let tradeRepo: any;

  const account = { id: 5, strategy_id: 7, current_balance: 1000, risk_percent: 10, leverage: 5 } as any;

  beforeEach(() => {
    accountRepo = makeRepo();
    tradeRepo = makeRepo();
    accountRepo.findOneByOrFail.mockResolvedValue({ ...account });
    service = new PaperAccountsService(accountRepo, tradeRepo, null as any);
  });

  it('открывает сделку: маржа = 10% от баланса, баланс уменьшается', async () => {
    const trade = await service.openAccountTrade(account, 'BTCUSDT', 'LONG', 50000);
    expect(trade).toEqual(expect.objectContaining({
      paper_account_id: 5,
      pair: 'BTCUSDT',
      type: 'LONG',
      entry_price: 50000,
      margin_used: 100,
      remaining_volume: 100,
      volume: 100,
      leverage_used: 5,
    }));
    // баланс списан
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 5, current_balance: 900 }));
  });

  it('пропускает сделку при нулевом/отрицательном балансе и инкрементит skipped_signals', async () => {
    accountRepo.findOneByOrFail.mockResolvedValue({ ...account, current_balance: 0, skipped_signals: 2 });
    const trade = await service.openAccountTrade(account, 'BTCUSDT', 'LONG', 50000);
    expect(trade).toBeNull();
    expect(tradeRepo.save).not.toHaveBeenCalled();
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ skipped_signals: 3 }));
  });

  it('игнорирует повторный сигнал того же направления по той же паре', async () => {
    tradeRepo.findOne.mockResolvedValue({ id: 1, type: 'LONG', status: 'OPEN' });
    const trade = await service.openAccountTrade(account, 'BTCUSDT', 'LONG', 50000);
    expect(trade).toBeNull();
  });

  it('противоположный сигнал закрывает текущую позицию по паре и открывает новую', async () => {
    tradeRepo.findOne.mockResolvedValue({ id: 1, type: 'SHORT', status: 'OPEN' });
    const closeSpy = jest.spyOn(service, 'closeAccountTrade').mockResolvedValue();
    const trade = await service.openAccountTrade(account, 'BTCUSDT', 'LONG', 50000);
    expect(closeSpy).toHaveBeenCalledWith(1, 50000, 'OPPOSITE_SIGNAL');
    expect(trade).not.toBeNull();
  });
});

describe('PaperAccountsService.closeAccountTrade', () => {
  let service: PaperAccountsService;
  let accountRepo: any;
  let tradeRepo: any;

  const openTrade = {
    id: 11, paper_account_id: 5, status: 'OPEN', type: 'LONG',
    entry_price: 100, margin_used: 100, remaining_volume: 100, leverage_used: 5,
  };

  beforeEach(() => {
    accountRepo = makeRepo();
    tradeRepo = makeRepo();
    accountRepo.findOneBy.mockResolvedValue({ id: 5, current_balance: 900 });
    service = new PaperAccountsService(accountRepo, tradeRepo, null as any);
  });

  it('LONG +2% цены при плече 5 → PnL +10% маржи, баланс += маржа + PnL', async () => {
    tradeRepo.findOneBy.mockResolvedValue({ ...openTrade });
    await service.closeAccountTrade(11, 102, 'TP');
    const savedTrade = tradeRepo.save.mock.calls[0][0];
    expect(savedTrade.pnl_percent).toBeCloseTo(10);
    expect(savedTrade.pnl_value).toBeCloseTo(10);
    expect(savedTrade.status).toBe('CLOSED');
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ current_balance: 1010 })); // 900 + 100 + 10
  });

  it('убыток глубже -100% маржи капится ликвидацией: pnl_value = -маржа', async () => {
    tradeRepo.findOneBy.mockResolvedValue({ ...openTrade });
    await service.closeAccountTrade(11, 70, 'SL'); // -30% цены × 5 = -150% маржи
    const savedTrade = tradeRepo.save.mock.calls[0][0];
    expect(savedTrade.pnl_percent).toBe(-100);
    expect(savedTrade.pnl_value).toBeCloseTo(-100);
    expect(savedTrade.exit_reason).toBe('LIQUIDATION');
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ current_balance: 900 })); // 900 + 100 - 100
  });

  it('не трогает закрытые и legacy-сделки', async () => {
    tradeRepo.findOneBy.mockResolvedValue({ ...openTrade, status: 'CLOSED' });
    await service.closeAccountTrade(11, 102, 'TP');
    expect(tradeRepo.save).not.toHaveBeenCalled();

    tradeRepo.findOneBy.mockResolvedValue({ ...openTrade, paper_account_id: null });
    await service.closeAccountTrade(11, 102, 'TP');
    expect(tradeRepo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Убедиться что новые тесты падают**

Run: `cd backend && npx jest paper-accounts.service`
Expected: FAIL — `service.openAccountTrade is not a function`.

- [ ] **Step 3: Реализация**

Добавить методы в `PaperAccountsService` (после `getActiveAccounts`):

```typescript
  /**
   * Открывает виртуальную сделку на аккаунте.
   * Маржа = current_balance × risk_percent / 100 (компаундинг), списывается с баланса.
   * Портфель: по одной открытой позиции на пару; противоположный сигнал закрывает текущую.
   */
  async openAccountTrade(
    account: PaperTradingAccount,
    pair: string,
    type: string,
    entryPrice: number,
  ): Promise<VirtualTrade | null> {
    const existing = await this.virtualTradeRepository.findOne({
      where: { paper_account_id: account.id, pair, status: TradeStatus.OPEN },
    });

    if (existing) {
      if (existing.type !== type) {
        await this.closeAccountTrade(existing.id, entryPrice, 'OPPOSITE_SIGNAL');
      } else {
        return null; // позиция того же направления уже открыта
      }
    }

    // Перечитываем баланс: closeAccountTrade выше мог его изменить
    const fresh = await this.accountRepository.findOneByOrFail({ id: account.id });
    const margin = (Number(fresh.current_balance) * Number(fresh.risk_percent)) / 100;
    if (margin <= 0 || margin > Number(fresh.current_balance)) {
      fresh.skipped_signals = Number(fresh.skipped_signals || 0) + 1;
      await this.accountRepository.save(fresh);
      this.logger.warn(`[PaperAccount #${fresh.id}] Skipped ${type} ${pair}: insufficient balance (${fresh.current_balance})`);
      return null;
    }

    fresh.current_balance = Number(fresh.current_balance) - margin;
    await this.accountRepository.save(fresh);

    const trade = this.virtualTradeRepository.create({
      strategy_id: fresh.strategy_id,
      paper_account_id: fresh.id,
      pair,
      type,
      entry_price: entryPrice,
      highest_price: entryPrice,
      lowest_price: entryPrice,
      peak_price: entryPrice,
      stop_price: null,
      trailing_active: false,
      partial_tp_hits: 0,
      volume: margin,
      remaining_volume: margin,
      margin_used: margin,
      leverage_used: Number(fresh.leverage) || 1,
      status: TradeStatus.OPEN,
    });
    return this.virtualTradeRepository.save(trade);
  }

  /**
   * Закрывает account-сделку. PnL на маржу = price% × плечо, капится на -100% (ликвидация).
   * Возвращает (оставшуюся) маржу + PnL на баланс аккаунта.
   */
  async closeAccountTrade(id: number, exitPrice: number, reason: string): Promise<void> {
    const trade = await this.virtualTradeRepository.findOneBy({ id });
    if (!trade || trade.status !== TradeStatus.OPEN || !trade.paper_account_id) return;

    const entry = Number(trade.entry_price);
    const lev = Number(trade.leverage_used) || 1;
    const margin = Number(trade.remaining_volume ?? trade.margin_used);

    const pricePnl = trade.type === 'LONG'
      ? ((exitPrice - entry) / entry) * 100
      : ((entry - exitPrice) / entry) * 100;

    let marginPnlPct = pricePnl * lev;
    if (marginPnlPct < -100 || reason === 'LIQUIDATION') marginPnlPct = -100;

    const pnlValue = (margin * marginPnlPct) / 100;

    trade.exit_price = exitPrice;
    trade.exit_reason = marginPnlPct === -100 ? 'LIQUIDATION' : reason;
    trade.status = TradeStatus.CLOSED;
    trade.closed_at = new Date();
    trade.pnl_percent = marginPnlPct;
    trade.pnl_value = pnlValue;
    await this.virtualTradeRepository.save(trade);

    const account = await this.accountRepository.findOneBy({ id: trade.paper_account_id });
    if (account) {
      account.current_balance = Number(account.current_balance) + margin + pnlValue;
      await this.accountRepository.save(account);
    }
    this.logger.log(
      `[PaperAccount #${trade.paper_account_id}] Closed #${trade.id} (${trade.exit_reason}) PnL: ${marginPnlPct.toFixed(2)}% of margin`,
    );
  }
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd backend && npx jest paper-accounts.service`
Expected: PASS (5 старых + 7 новых).

- [ ] **Step 5: Commit**

```bash
git add backend/src/paper-trading/paper-accounts.service.ts backend/src/paper-trading/paper-accounts.service.spec.ts
git commit -m "feat(paper): account trade open/close with margin, compounding and leverage"
```

---

### Task 5: Cron-мониторинг account-сделок + исключение их из legacy-cron

**Files:**
- Modify: `backend/src/paper-trading/paper-accounts.service.ts` (добавить `checkAccountTrades` + `processAccountTrade`)
- Modify: `backend/src/paper-trading/paper-trading.service.ts:144-146` (фильтр `paper_account_id: IsNull()`)
- Test: `backend/src/paper-trading/paper-accounts.service.spec.ts`

**Interfaces:**
- Consumes: `closeAccountTrade` (Task 4).
- Produces: `processAccountTrade(trade: VirtualTrade, currentPrice: number): Promise<void>` (извлечён из cron для тестируемости); `@Cron(EVERY_MINUTE) checkAccountTrades()`.

- [ ] **Step 1: Падающие тесты для processAccountTrade**

Добавить в `paper-accounts.service.spec.ts`:

```typescript
describe('PaperAccountsService.processAccountTrade', () => {
  let service: PaperAccountsService;
  let accountRepo: any;
  let tradeRepo: any;

  const baseAccount = {
    id: 5, current_balance: 900, sl_percent: null, tp_percent: null,
    use_trailing: false, trailing_distance: 1, trailing_activation: 0.5,
    move_sl_to_be: false, partial_tps: [],
  };
  const baseTrade = () => ({
    id: 11, paper_account_id: 5, status: 'OPEN', type: 'LONG',
    entry_price: 100, highest_price: 100, lowest_price: 100, peak_price: 100,
    stop_price: null, trailing_active: false, partial_tp_hits: 0,
    margin_used: 100, remaining_volume: 100, leverage_used: 10,
  });

  beforeEach(() => {
    accountRepo = makeRepo();
    tradeRepo = makeRepo();
    service = new PaperAccountsService(accountRepo, tradeRepo, null as any);
  });

  it('ликвидация: -10% цены при плече 10 закрывает сделку как LIQUIDATION', async () => {
    accountRepo.findOneBy.mockResolvedValue({ ...baseAccount });
    const trade: any = baseTrade();
    tradeRepo.findOneBy.mockResolvedValue(trade); // для closeAccountTrade
    await service.processAccountTrade(trade, 90);
    const closed = tradeRepo.save.mock.calls.map((c: any) => c[0]).find((t: any) => t.status === 'CLOSED');
    expect(closed.exit_reason).toBe('LIQUIDATION');
    expect(closed.pnl_percent).toBe(-100);
  });

  it('фиксированный SL аккаунта (1% цены) закрывает при -1.5%', async () => {
    accountRepo.findOneBy.mockResolvedValue({ ...baseAccount, sl_percent: 1 });
    const trade: any = { ...baseTrade(), leverage_used: 2 };
    tradeRepo.findOneBy.mockResolvedValue(trade);
    await service.processAccountTrade(trade, 98.5);
    const closed = tradeRepo.save.mock.calls.map((c: any) => c[0]).find((t: any) => t.status === 'CLOSED');
    expect(closed.exit_reason).toBe('SL');
  });

  it('фиксированный TP аккаунта (3% цены) закрывает при +3%', async () => {
    accountRepo.findOneBy.mockResolvedValue({ ...baseAccount, tp_percent: 3 });
    const trade: any = { ...baseTrade(), leverage_used: 2 };
    tradeRepo.findOneBy.mockResolvedValue(trade);
    await service.processAccountTrade(trade, 103);
    const closed = tradeRepo.save.mock.calls.map((c: any) => c[0]).find((t: any) => t.status === 'CLOSED');
    expect(closed.exit_reason).toBe('TP');
    expect(closed.pnl_percent).toBeCloseTo(6); // 3% × 2
  });

  it('без SL/TP/trailing просто обновляет water marks и pnl', async () => {
    accountRepo.findOneBy.mockResolvedValue({ ...baseAccount });
    const trade: any = baseTrade();
    await service.processAccountTrade(trade, 101);
    expect(trade.highest_price).toBe(101);
    expect(trade.pnl_percent).toBeCloseTo(10); // 1% × 10
    expect(tradeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 11, status: 'OPEN' }));
  });

  it('trailing stop: активация, подъём стопа за пиком, закрытие TRAILING', async () => {
    accountRepo.findOneBy.mockResolvedValue({ ...baseAccount, use_trailing: true, trailing_distance: 1, trailing_activation: 0.5 });
    const trade: any = { ...baseTrade(), leverage_used: 1 };
    await service.processAccountTrade(trade, 102);          // активация + стоп = 102×0.99 = 100.98
    expect(trade.trailing_active).toBe(true);
    expect(Number(trade.stop_price)).toBeCloseTo(100.98);
    tradeRepo.findOneBy.mockResolvedValue(trade);
    await service.processAccountTrade(trade, 100.5);        // цена ≤ стопа → закрытие
    const closed = tradeRepo.save.mock.calls.map((c: any) => c[0]).find((t: any) => t.status === 'CLOSED');
    expect(closed.exit_reason).toBe('TRAILING');
  });

  it('partial TP возвращает часть маржи с прибылью на баланс', async () => {
    const account = { ...baseAccount, partial_tps: [{ target: 2, closePercent: 50 }, { target: 4, closePercent: 100 }] };
    accountRepo.findOneBy.mockResolvedValue(account);
    const trade: any = { ...baseTrade(), leverage_used: 1 };
    await service.processAccountTrade(trade, 102); // +2% → первый partial: закрыто 50% (маржа 50, pnl 1)
    expect(trade.partial_tp_hits).toBe(1);
    expect(Number(trade.remaining_volume)).toBeCloseTo(50);
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ current_balance: 951 })); // 900 + 50 + 1
  });
});
```

- [ ] **Step 2: Убедиться что тесты падают**

Run: `cd backend && npx jest paper-accounts.service`
Expected: FAIL — `service.processAccountTrade is not a function`.

- [ ] **Step 3: Реализация**

Добавить в `PaperAccountsService`:

```typescript
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAccountTrades() {
    const openTrades = await this.virtualTradeRepository.find({
      where: { status: TradeStatus.OPEN, paper_account_id: Not(IsNull()) },
    });
    if (!openTrades.length) return;

    try {
      const tickers = await this.binanceApiService.fetchTickers24h();
      for (const trade of openTrades) {
        const ticker = tickers[trade.pair];
        if (!ticker) continue;
        await this.processAccountTrade(trade, Number(ticker.lastPrice));
      }
    } catch (e) {
      this.logger.error(`checkAccountTrades error: ${(e as Error).message}`);
    }
  }

  /**
   * Один тик мониторинга account-сделки: ликвидация → trailing → partial TP → фикс. SL/TP.
   * Все пороги — проценты движения цены; плечо влияет на денежный PnL и порог ликвидации.
   */
  async processAccountTrade(trade: VirtualTrade, currentPrice: number): Promise<void> {
    const account = await this.accountRepository.findOneBy({ id: trade.paper_account_id });
    if (!account) return;

    const entry = Number(trade.entry_price);
    const lev = Number(trade.leverage_used) || 1;

    if (currentPrice > Number(trade.highest_price)) trade.highest_price = currentPrice;
    if (currentPrice < Number(trade.lowest_price)) trade.lowest_price = currentPrice;

    const pricePnl = trade.type === 'LONG'
      ? ((currentPrice - entry) / entry) * 100
      : ((entry - currentPrice) / entry) * 100;

    trade.pnl_percent = pricePnl * lev; // непрерывно показываем PnL на маржу

    // ── 1. Ликвидация ────────────────────────────────────────────────────
    if (pricePnl <= -100 / lev) {
      await this.virtualTradeRepository.save(trade);
      await this.closeAccountTrade(trade.id, currentPrice, 'LIQUIDATION');
      return;
    }

    // ── 2. Trailing stop ─────────────────────────────────────────────────
    if (account.use_trailing) {
      const dist = Number(account.trailing_distance) / 100;
      const act = Number(account.trailing_activation) / 100;

      if (trade.type === 'LONG') {
        if (currentPrice > Number(trade.peak_price)) trade.peak_price = currentPrice;
        if ((currentPrice - entry) / entry >= act) trade.trailing_active = true;
        if (trade.trailing_active) {
          const newStop = Number(trade.peak_price) * (1 - dist);
          if (!trade.stop_price || newStop > Number(trade.stop_price)) trade.stop_price = newStop;
        }
        if (trade.stop_price && currentPrice <= Number(trade.stop_price)) {
          await this.virtualTradeRepository.save(trade);
          await this.closeAccountTrade(trade.id, currentPrice, trade.trailing_active ? 'TRAILING' : 'SL');
          return;
        }
      } else {
        if (currentPrice < Number(trade.peak_price)) trade.peak_price = currentPrice;
        if ((entry - currentPrice) / entry >= act) trade.trailing_active = true;
        if (trade.trailing_active) {
          const newStop = Number(trade.peak_price) * (1 + dist);
          if (!trade.stop_price || newStop < Number(trade.stop_price)) trade.stop_price = newStop;
        }
        if (trade.stop_price && currentPrice >= Number(trade.stop_price)) {
          await this.virtualTradeRepository.save(trade);
          await this.closeAccountTrade(trade.id, currentPrice, trade.trailing_active ? 'TRAILING' : 'SL');
          return;
        }
      }
    }

    // ── 3. Partial TP ────────────────────────────────────────────────────
    const partials = Array.isArray(account.partial_tps) ? account.partial_tps : [];
    if (partials.length > 0 && Number(trade.partial_tp_hits) < partials.length) {
      const idx = Number(trade.partial_tp_hits);
      const level = partials[idx];

      if (pricePnl >= Number(level.target)) {
        const closedMargin = Number(trade.remaining_volume) * (Number(level.closePercent) / 100);
        const pnlValue = (closedMargin * pricePnl * lev) / 100;
        trade.remaining_volume = Number(trade.remaining_volume) - closedMargin;
        trade.partial_tp_hits = idx + 1;
        account.current_balance = Number(account.current_balance) + closedMargin + pnlValue;
        await this.accountRepository.save(account);
        this.logger.log(
          `[PaperAccount #${account.id}] Partial TP#${idx + 1} for #${trade.id}: released $${closedMargin.toFixed(2)} + $${pnlValue.toFixed(2)} PnL`,
        );

        if (account.move_sl_to_be && idx === 0) {
          const improve = trade.type === 'LONG'
            ? !trade.stop_price || entry > Number(trade.stop_price)
            : !trade.stop_price || entry < Number(trade.stop_price);
          if (improve) trade.stop_price = entry;
        }

        if (Number(trade.partial_tp_hits) >= partials.length) {
          await this.virtualTradeRepository.save(trade);
          await this.closeAccountTrade(trade.id, currentPrice, 'TP');
          return;
        }
      }
    }

    // ── 4. Фиксированный SL / TP ─────────────────────────────────────────
    const effectiveSL: number | null = trade.stop_price
      ? Math.abs(((trade.type === 'LONG'
          ? Number(trade.stop_price) - entry
          : entry - Number(trade.stop_price)) / entry) * 100)
      : (account.sl_percent !== null && account.sl_percent !== undefined ? Number(account.sl_percent) : null);

    if (effectiveSL !== null && pricePnl <= -effectiveSL) {
      await this.virtualTradeRepository.save(trade);
      await this.closeAccountTrade(trade.id, currentPrice, 'SL');
      return;
    }

    if (account.tp_percent !== null && account.tp_percent !== undefined && partials.length === 0 && pricePnl >= Number(account.tp_percent)) {
      await this.virtualTradeRepository.save(trade);
      await this.closeAccountTrade(trade.id, currentPrice, 'TP');
      return;
    }

    await this.virtualTradeRepository.save(trade);
  }
```

- [ ] **Step 4: Исключить account-сделки из legacy-cron**

В `backend/src/paper-trading/paper-trading.service.ts`:

Импорт (строка 3): `import { Repository, IsNull } from 'typeorm';`

В `checkOpenTrades()` (строка ~144) заменить:

```typescript
    const openTrades = await this.virtualTradeRepository.find({
      where: { status: TradeStatus.OPEN },
      relations: ['strategy'],
    });
```

на:

```typescript
    // Account-сделки (paper_account_id != NULL) мониторит PaperAccountsService.checkAccountTrades
    const openTrades = await this.virtualTradeRepository.find({
      where: { status: TradeStatus.OPEN, paper_account_id: IsNull() },
      relations: ['strategy'],
    });
```

- [ ] **Step 5: Все тесты зелёные**

Run: `cd backend && npx jest paper-accounts.service && npx jest paper-trading`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/paper-trading/paper-accounts.service.ts backend/src/paper-trading/paper-accounts.service.spec.ts backend/src/paper-trading/paper-trading.service.ts
git commit -m "feat(paper): per-account trade monitoring cron with liquidation, trailing, partial TP"
```

---

### Task 6: Wiring — StrategiesService (sync) и SignalsEngine (исполнение)

**Files:**
- Modify: `backend/src/strategies/strategies.module.ts` (импорт PaperTradingModule с forwardRef)
- Modify: `backend/src/strategies/strategies.service.ts` (вызовы syncPaperAccounts в create/update)
- Modify: `backend/src/signals/signals-engine.service.ts` (блок 5b после блока 5, строка ~454)
- Modify: `backend/src/signals/signals-engine.service.spec.ts` (добавить null-аргумент в конструктор)

**Interfaces:**
- Consumes: `PaperAccountsService.syncPaperAccounts/getActiveAccounts/openAccountTrade` (Tasks 3–4), `findPaperNodesForSignal` (Task 2).

- [ ] **Step 1: StrategiesModule — импорт PaperTradingModule**

`PaperTradingModule` уже импортирует `StrategiesModule` через `forwardRef`, поэтому обратная сторона тоже обязана быть forwardRef:

```typescript
// backend/src/strategies/strategies.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PaperTradingModule } from '../paper-trading/paper-trading.module';
// ...
  imports: [
    TypeOrmModule.forFeature([Strategy, StrategyVersion]),
    forwardRef(() => PaperTradingModule),
  ],
```

- [ ] **Step 2: StrategiesService — вызов sync после сохранения**

```typescript
// backend/src/strategies/strategies.service.ts
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PaperAccountsService } from '../paper-trading/paper-accounts.service';
// ... в конструктор добавить:
    @Inject(forwardRef(() => PaperAccountsService))
    private paperAccountsService: PaperAccountsService,
```

В `create()` перед `return saved;` (строка ~47):

```typescript
    await this.paperAccountsService.syncPaperAccounts(saved);
```

В `update()` сразу после `const saved = await this.strategyRepository.save(strategy);` (строка ~56):

```typescript
    await this.paperAccountsService.syncPaperAccounts(saved);
```

- [ ] **Step 3: SignalsEngineService — исполнение по paper-нодам**

Импорты в `backend/src/signals/signals-engine.service.ts` (после строки 20):

```typescript
import { PaperAccountsService } from '../paper-trading/paper-accounts.service';
import { findPaperNodesForSignal } from '../paper-trading/paper-node-finder';
```

В конструктор — **последним** параметром (после `algoExecutionService`):

```typescript
    private paperAccountsService: PaperAccountsService,
```

После блока «5. Paper Trading Execution» (после `}` на строке ~454, перед `// 6. Live execution`) вставить:

```typescript
      // 5b. Paper Trading Output nodes — независимые виртуальные счета на нодах
      try {
        const paperNodeIds = findPaperNodesForSignal(
          strategy.nodes || [],
          strategy.edges || [],
          signal.type,
        );
        if (paperNodeIds.length) {
          const accounts = await this.paperAccountsService.getActiveAccounts(strategy.id, paperNodeIds);
          for (const account of accounts) {
            await this.paperAccountsService.openAccountTrade(account, pair, signal.type, signal.price);
          }
        }
      } catch (e) {
        this.logger.error(`Paper account execution error: ${(e as Error).message}`);
      }
```

- [ ] **Step 4: Починить конструктор в существующем spec**

В `backend/src/signals/signals-engine.service.spec.ts` конструктор вызывается позиционно (строки 49–72). Добавить последним аргументом:

```typescript
      null as any, // paperAccountsService
```

- [ ] **Step 5: Сборка + существующие тесты**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json && npx jest signals-engine`
Expected: сборка чистая, все тесты signals-engine PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/strategies/strategies.module.ts backend/src/strategies/strategies.service.ts backend/src/signals/signals-engine.service.ts backend/src/signals/signals-engine.service.spec.ts
git commit -m "feat(paper): wire account sync into strategy save and execution into signal engine"
```

---

### Task 7: API — статистика, детали, reset, compare

**Files:**
- Modify: `backend/src/paper-trading/paper-accounts.service.ts` (4 метода)
- Modify: `backend/src/paper-trading/paper-trading.controller.ts` (4 endpoint'а)
- Test: `backend/src/paper-trading/paper-accounts.service.spec.ts`

**Interfaces:**
- Produces:
  - `getAccountsWithStats(strategyId?: number)` → массив `{ ...account, stats: { equity, totalPnlValue, totalPnlPercent, winRate, closedTrades, openTrades } }`
  - `getAccountDetail(id: number)` → `{ account, trades }`
  - `resetAccount(id: number)` → аккаунт с балансом = starting_capital
  - `compareAccounts(ids: number[])` → массив `{ account, curve: [{date, equity}], stats: { totalPnlPercent, winRate, maxDrawdown, trades } }`
  - HTTP: `GET /paper-trading/accounts?strategyId=`, `GET /paper-trading/accounts/:id`, `POST /paper-trading/accounts/:id/reset`, `GET /paper-trading/compare?ids=1,2`

- [ ] **Step 1: Падающие тесты**

Добавить в `paper-accounts.service.spec.ts`:

```typescript
describe('PaperAccountsService stats & reset & compare', () => {
  let service: PaperAccountsService;
  let accountRepo: any;
  let tradeRepo: any;
  let binance: any;

  beforeEach(() => {
    accountRepo = makeRepo();
    tradeRepo = makeRepo();
    binance = { fetchTickers24h: jest.fn().mockResolvedValue({ BTCUSDT: { lastPrice: '105' } }) };
    service = new PaperAccountsService(accountRepo, tradeRepo, binance);
  });

  it('getAccountsWithStats: считает winRate, PnL и equity', async () => {
    accountRepo.find.mockResolvedValue([
      { id: 5, strategy_id: 7, node_id: 'n1', starting_capital: 1000, current_balance: 950 },
    ]);
    tradeRepo.find.mockResolvedValue([
      { status: 'CLOSED', pnl_value: 20, margin_used: 100, remaining_volume: 0 },
      { status: 'CLOSED', pnl_value: -10, margin_used: 100, remaining_volume: 0 },
      { status: 'OPEN', pnl_value: 0, margin_used: 100, remaining_volume: 100 },
    ]);
    const [acc] = await service.getAccountsWithStats(7);
    expect(acc.stats.winRate).toBe(50);
    expect(acc.stats.totalPnlValue).toBe(10);
    expect(acc.stats.totalPnlPercent).toBeCloseTo(1);
    expect(acc.stats.equity).toBe(1050); // 950 свободных + 100 маржи в открытой позиции
    expect(acc.stats.openTrades).toBe(1);
    expect(acc.stats.closedTrades).toBe(2);
  });

  it('resetAccount: закрывает открытые позиции по рынку и возвращает стартовый капитал', async () => {
    accountRepo.findOneByOrFail.mockResolvedValue({ id: 5, starting_capital: 1000, current_balance: 400 });
    tradeRepo.find.mockResolvedValue([
      { id: 11, pair: 'BTCUSDT', status: 'OPEN', paper_account_id: 5 },
    ]);
    const closeSpy = jest.spyOn(service, 'closeAccountTrade').mockResolvedValue();
    const saved = await service.resetAccount(5);
    expect(closeSpy).toHaveBeenCalledWith(11, 105, 'MANUAL');
    expect(saved.current_balance).toBe(1000);
  });

  it('compareAccounts: строит equity curve и maxDrawdown', async () => {
    accountRepo.findOneBy.mockResolvedValue({ id: 5, starting_capital: 1000, created_at: new Date('2026-07-01') });
    tradeRepo.find.mockResolvedValue([
      { pnl_value: 100, closed_at: new Date('2026-07-01T10:00Z') }, // 1100, peak
      { pnl_value: -220, closed_at: new Date('2026-07-01T11:00Z') }, // 880 → DD 20%
      { pnl_value: 50, closed_at: new Date('2026-07-01T12:00Z') },  // 930
    ]);
    const [res] = await service.compareAccounts([5]);
    expect(res.curve.map((p: any) => p.equity)).toEqual([1000, 1100, 880, 930]);
    expect(res.stats.maxDrawdown).toBeCloseTo(20);
    expect(res.stats.totalPnlPercent).toBeCloseTo(-7);
    expect(res.stats.trades).toBe(3);
  });
});
```

- [ ] **Step 2: Убедиться что падают**

Run: `cd backend && npx jest paper-accounts.service`
Expected: FAIL — `getAccountsWithStats is not a function`.

- [ ] **Step 3: Реализация методов**

Добавить в `PaperAccountsService`:

```typescript
  async getAccountsWithStats(strategyId?: number) {
    const where: any = strategyId ? { strategy_id: strategyId } : {};
    const accounts = await this.accountRepository.find({ where, order: { id: 'ASC' } });
    const result: any[] = [];

    for (const acc of accounts) {
      const trades = await this.virtualTradeRepository.find({ where: { paper_account_id: acc.id } });
      const closed = trades.filter((t) => t.status === TradeStatus.CLOSED);
      const open = trades.filter((t) => t.status === TradeStatus.OPEN);
      const wins = closed.filter((t) => Number(t.pnl_value) > 0).length;
      const totalPnlValue = closed.reduce((s, t) => s + Number(t.pnl_value), 0);
      const openMargin = open.reduce((s, t) => s + Number(t.remaining_volume ?? t.margin_used), 0);

      result.push({
        ...acc,
        stats: {
          equity: Math.round((Number(acc.current_balance) + openMargin) * 100) / 100,
          totalPnlValue: Math.round(totalPnlValue * 100) / 100,
          totalPnlPercent: Math.round((totalPnlValue / Number(acc.starting_capital)) * 10000) / 100,
          winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
          closedTrades: closed.length,
          openTrades: open.length,
          skippedSignals: Number(acc.skipped_signals || 0),
        },
      });
    }
    return result;
  }

  async getAccountDetail(id: number) {
    const account = await this.accountRepository.findOneByOrFail({ id });
    const trades = await this.virtualTradeRepository.find({
      where: { paper_account_id: id },
      order: { opened_at: 'DESC' },
    });
    return { account, trades };
  }

  /** Закрывает открытые позиции по текущему рынку и возвращает баланс к стартовому капиталу */
  async resetAccount(id: number) {
    await this.accountRepository.findOneByOrFail({ id });
    const open = await this.virtualTradeRepository.find({
      where: { paper_account_id: id, status: TradeStatus.OPEN },
    });

    let tickers: any = {};
    try {
      tickers = await this.binanceApiService.fetchTickers24h();
    } catch { /* закроем по entry_price */ }

    for (const trade of open) {
      const price = tickers[trade.pair] ? Number(tickers[trade.pair].lastPrice) : Number(trade.entry_price);
      await this.closeAccountTrade(trade.id, price, 'MANUAL');
    }

    const fresh = await this.accountRepository.findOneByOrFail({ id });
    fresh.current_balance = fresh.starting_capital;
    return this.accountRepository.save(fresh);
  }

  async compareAccounts(ids: number[]) {
    const out: any[] = [];
    for (const id of ids) {
      const account = await this.accountRepository.findOneBy({ id });
      if (!account) continue;

      const closed = await this.virtualTradeRepository.find({
        where: { paper_account_id: id, status: TradeStatus.CLOSED },
        order: { closed_at: 'ASC' },
      });

      let equity = Number(account.starting_capital);
      let peak = equity;
      let maxDrawdown = 0;
      const curve: Array<{ date: Date; equity: number }> = [{ date: account.created_at, equity }];

      for (const t of closed) {
        equity += Number(t.pnl_value);
        peak = Math.max(peak, equity);
        if (peak > 0) maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
        curve.push({ date: t.closed_at, equity: Math.round(equity * 100) / 100 });
      }

      const wins = closed.filter((t) => Number(t.pnl_value) > 0).length;
      out.push({
        account,
        curve,
        stats: {
          totalPnlPercent:
            Math.round(((equity - Number(account.starting_capital)) / Number(account.starting_capital)) * 10000) / 100,
          winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
          maxDrawdown: Math.round(maxDrawdown * 100) / 100,
          trades: closed.length,
        },
      });
    }
    return out;
  }
```

- [ ] **Step 4: Endpoint'ы в контроллере**

`backend/src/paper-trading/paper-trading.controller.ts` — заменить целиком:

```typescript
import { Controller, Get, Post, Param, Query, NotFoundException } from '@nestjs/common';
import { PaperTradingService } from './paper-trading.service';
import { PaperAccountsService } from './paper-accounts.service';

@Controller('paper-trading')
export class PaperTradingController {
  constructor(
    private readonly paperTradingService: PaperTradingService,
    private readonly paperAccountsService: PaperAccountsService,
  ) {}

  @Get('history')
  getHistory() {
    return this.paperTradingService.getHistory();
  }

  /** Per-strategy win rates for all strategies with at least one closed trade */
  @Get('winrates')
  getWinRates() {
    return this.paperTradingService.getWinRatesByStrategy();
  }

  /** Cumulative PnL curve for the last 30 days */
  @Get('equity-curve')
  getEquityCurve() {
    return this.paperTradingService.getEquityCurve();
  }

  // ── Per-node paper accounts ────────────────────────────────────────────

  @Get('accounts')
  getAccounts(@Query('strategyId') strategyId?: string) {
    return this.paperAccountsService.getAccountsWithStats(
      strategyId ? parseInt(strategyId, 10) : undefined,
    );
  }

  /** Наложенные equity curves + сводные метрики для сравнения конфигов */
  @Get('compare')
  compare(@Query('ids') ids: string) {
    const parsed = (ids || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    return this.paperAccountsService.compareAccounts(parsed);
  }

  @Get('accounts/:id')
  getAccount(@Param('id') id: string) {
    return this.paperAccountsService.getAccountDetail(parseInt(id, 10));
  }

  @Post('accounts/:id/reset')
  resetAccount(@Param('id') id: string) {
    return this.paperAccountsService.resetAccount(parseInt(id, 10));
  }

  @Post('close/:id')
  async close(@Param('id') id: string) {
    const tradeId = parseInt(id, 10);
    const trade = await this.paperTradingService.getTrade(tradeId);
    if (!trade) throw new NotFoundException('Virtual trade not found');

    await this.paperTradingService.manualClose(tradeId);
    return { success: true };
  }
}
```

- [ ] **Step 5: Тесты и сборка зелёные**

Run: `cd backend && npx jest paper-accounts.service && npx tsc --noEmit -p tsconfig.json`
Expected: PASS + чистая сборка.

- [ ] **Step 6: Commit**

```bash
git add backend/src/paper-trading/paper-accounts.service.ts backend/src/paper-trading/paper-accounts.service.spec.ts backend/src/paper-trading/paper-trading.controller.ts
git commit -m "feat(paper): accounts API — stats, detail, reset, compare"
```

---

### Task 8: Frontend — нода PaperTradingNode + регистрация

**Files:**
- Create: `frontend/src/components/nodes/PaperTradingNode.tsx`
- Modify: `frontend/src/blocks/registry.ts` (блок в секции «Торговые действия» ~строка 140 + EDGE_COLORS ~строка 184)
- Modify: `frontend/src/pages/StrategyBuilder.tsx` (import ~строка 39; nodeTypes ~строка 98; sink-проверка ~строка 505; sinkTypes ~строка 1516)

**Interfaces:**
- Consumes: `useStrategyStore` — `updateNodeData(nodeId, newData)` (ВНИМАНИЕ: заменяет data целиком — передавать `{ ...data, ...patch }`), `savedStrategyId`; API `GET /paper-trading/accounts?strategyId=`, `POST /paper-trading/accounts/:id/reset` (Task 7).
- Produces: тип ноды `paper_trading_output`, блок registry `paper_trading`.

- [ ] **Step 1: Блок в registry**

В `frontend/src/blocks/registry.ts` после `trade_grid` (строка ~140) добавить:

```typescript
  paper_trading: {
    type: 'paper_trading_output', id: 'paper_trading', name: '🧪 Paper Trading', category: '🚀 Торговля', dotColor: '#22d3ee',
    defaultData: {
      label: 'Config A',
      startingCapital: 1000,
      leverage: 1,
      riskPercent: 10,
      sl: '',
      tp: '',
      useTrailing: false,
      trailingDistance: '1%',
      trailingActivation: '0.5%',
      moveSLtoBE: false,
      partialTPs: [],
    },
  },
```

В `EDGE_COLORS` добавить:

```typescript
  paper_trading_output: '#22d3ee',
```

- [ ] **Step 2: Компонент ноды**

```tsx
// frontend/src/components/nodes/PaperTradingNode.tsx
import { memo, useEffect, useState, CSSProperties } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import axios from 'axios';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { useStrategyStore } from '../../stores/strategyStore';

const API = (import.meta as any).env?.VITE_API_URL || '/api';
const CYAN = '#22d3ee';

const inputStyle: CSSProperties = {
  width: '70px', padding: '2px 6px', fontSize: '10px',
  background: 'var(--bg-accent)', color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', textAlign: 'right',
};

const PaperTradingNode = ({ id, data, selected }: NodeProps) => {
  const updateNodeData = useStrategyStore((s) => s.updateNodeData);
  const strategyId = useStrategyStore((s) => s.savedStrategyId);
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // updateNodeData заменяет data целиком — обязательно спредим текущее
  const patch = (p: Record<string, any>) => updateNodeData(id, { ...data, ...p });

  useEffect(() => {
    if (!strategyId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await axios.get(`${API}/paper-trading/accounts`, { params: { strategyId } });
        const acc = (res.data || []).find((a: any) => a.node_id === id);
        if (!cancelled && acc?.stats) {
          setStats({ ...acc.stats, accountId: acc.id, balance: acc.current_balance });
        }
      } catch { /* тихо: бэкенд может быть недоступен в превью */ }
    };
    load();
    const t = setInterval(load, 45000);
    return () => { cancelled = true; clearInterval(t); };
  }, [strategyId, id]);

  const handleReset = async () => {
    if (!stats?.accountId) return;
    if (!confirm('Сбросить счёт? Открытые позиции будут закрыты по рынку, баланс вернётся к стартовому капиталу. История сделок сохранится.')) return;
    try {
      await axios.post(`${API}/paper-trading/accounts/${stats.accountId}/reset`);
      setStats(null);
    } catch { /* silent */ }
  };

  const pnl = Number(stats?.totalPnlPercent ?? 0);

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot(CYAN)} />
        <span style={nodeType(CYAN)}>🧪 Paper Trading</span>
        <input
          className="nodrag"
          style={{ ...inputStyle, width: '80px', textAlign: 'left', marginLeft: 'auto' }}
          value={data.label || ''}
          placeholder="Config A"
          onChange={(e) => patch({ label: e.target.value })}
        />
      </div>
      <div style={nodeBody}>
        {stats ? (
          <>
            <div style={nodeParam}>Баланс <span style={nodeParamVal}>${Number(stats.balance).toFixed(2)}</span></div>
            <div style={nodeParam}>PnL <span style={{ ...nodeParamVal, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span></div>
            <div style={nodeParam}>Win rate <span style={nodeParamVal}>{stats.winRate}%</span></div>
            <div style={nodeParam}>Позиции <span style={nodeParamVal}>{stats.openTrades} откр / {stats.closedTrades} закр</span></div>
            {Number(stats.skippedSignals) > 0 && (
              <div style={nodeParam}>Пропущено сигналов <span style={{ ...nodeParamVal, color: '#f59e0b' }}>{stats.skippedSignals}</span></div>
            )}
          </>
        ) : (
          <div style={{ ...nodeParam, fontStyle: 'italic' }}>
            {strategyId ? 'Нет данных — сохраните стратегию' : 'Сохраните стратегию для запуска'}
          </div>
        )}

        <div
          className="nodrag"
          style={{ fontSize: '10px', color: CYAN, cursor: 'pointer', marginTop: 6, fontWeight: 700 }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '▾ Скрыть настройки' : '▸ Настройки'}
        </div>

        {expanded && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={nodeParam}>Капитал $
              <input className="nodrag" style={inputStyle} type="number" value={data.startingCapital ?? 1000}
                onChange={(e) => patch({ startingCapital: Number(e.target.value) })} />
            </div>
            <div style={nodeParam}>Плечо ×
              <input className="nodrag" style={inputStyle} type="number" min={1} value={data.leverage ?? 1}
                onChange={(e) => patch({ leverage: Number(e.target.value) })} />
            </div>
            <div style={nodeParam}>% на сделку
              <input className="nodrag" style={inputStyle} type="number" min={1} max={100} value={data.riskPercent ?? 10}
                onChange={(e) => patch({ riskPercent: Number(e.target.value) })} />
            </div>
            <div style={nodeParam}>SL % (цена)
              <input className="nodrag" style={inputStyle} value={data.sl ?? ''} placeholder="напр. 1%"
                onChange={(e) => patch({ sl: e.target.value })} />
            </div>
            <div style={nodeParam}>TP % (цена)
              <input className="nodrag" style={inputStyle} value={data.tp ?? ''} placeholder="напр. 3%"
                onChange={(e) => patch({ tp: e.target.value })} />
            </div>
            <div style={nodeParam}>Trailing stop
              <input className="nodrag" type="checkbox" checked={!!data.useTrailing}
                onChange={(e) => patch({ useTrailing: e.target.checked })} />
            </div>
            {data.useTrailing && (
              <>
                <div style={nodeParam}>Дистанция %
                  <input className="nodrag" style={inputStyle} value={data.trailingDistance ?? '1%'}
                    onChange={(e) => patch({ trailingDistance: e.target.value })} />
                </div>
                <div style={nodeParam}>Активация %
                  <input className="nodrag" style={inputStyle} value={data.trailingActivation ?? '0.5%'}
                    onChange={(e) => patch({ trailingActivation: e.target.value })} />
                </div>
              </>
            )}
            {stats?.accountId && (
              <button
                className="nodrag"
                style={{
                  marginTop: 4, padding: '4px 8px', fontSize: '10px', fontWeight: 700,
                  background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer',
                }}
                onClick={handleReset}
              >
                Сбросить счёт
              </button>
            )}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} style={PORT(CYAN)} />
    </div>
  );
};

export default memo(PaperTradingNode);
```

- [ ] **Step 3: Регистрация в StrategyBuilder**

В `frontend/src/pages/StrategyBuilder.tsx`:

1. Импорт (рядом с FinvizScannerNode, строка ~39):
```typescript
import PaperTradingNode from '../components/nodes/PaperTradingNode';
```

2. В объект `nodeTypes` (строка ~98):
```typescript
  paper_trading_output: PaperTradingNode,
```

3. Sink-проверка (строка ~505) — заменить:
```typescript
        } else if (n.type === 'trade_action' || n.type === 'signal') {
```
на:
```typescript
        } else if (n.type === 'trade_action' || n.type === 'signal' || n.type === 'paper_trading_output') {
```

4. Массив sinkTypes (строка ~1516) — заменить:
```typescript
                  const sinkTypes = ['trade_action', 'signal'];
```
на:
```typescript
                  const sinkTypes = ['trade_action', 'signal', 'paper_trading_output'];
```

- [ ] **Step 4: Проверка сборки фронтенда**

Run: `cd frontend && npx tsc --noEmit` (если tsconfig ругается на предсуществующие ошибки — `npm run build`, ожидаем успешный vite build)
Expected: сборка проходит.

- [ ] **Step 5: Визуальная проверка в превью**

Запустить превью (`signal-bot-frontend` из launch.json), открыть Strategy Builder:
- В сайдбаре, категория «🚀 Торговля», появился блок «🧪 Paper Trading».
- Перетащить на канвас, соединить с LONG-сигналом — edge цвета #22d3ee.
- Развернуть «Настройки», поменять плечо — значение сохраняется в ноде.
- Валидатор не помечает подключённую ноду как disconnected.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/nodes/PaperTradingNode.tsx frontend/src/blocks/registry.ts frontend/src/pages/StrategyBuilder.tsx
git commit -m "feat(paper): Paper Trading output node in Strategy Builder"
```

---

### Task 9: Frontend — секция сравнения конфигов на странице Paper Trading

**Files:**
- Create: `frontend/src/components/PaperCompareSection.tsx`
- Modify: `frontend/src/pages/PaperTrading.tsx` (import + вставка секции после Summary Header)

**Interfaces:**
- Consumes: `GET /paper-trading/accounts`, `GET /paper-trading/compare?ids=` (Task 7).

- [ ] **Step 1: Компонент сравнения**

```tsx
// frontend/src/components/PaperCompareSection.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';

const API = (import.meta as any).env?.VITE_API_URL || '/api';
const COLORS = ['#22d3ee', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#6366f1'];

/** Сравнение конфигов Paper Trading нод: наложенные equity curves + таблица метрик */
const PaperCompareSection = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [compare, setCompare] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API}/paper-trading/accounts`)
      .then((res) => setAccounts(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected.length) { setCompare([]); return; }
    axios.get(`${API}/paper-trading/compare`, { params: { ids: selected.join(',') } })
      .then((res) => setCompare(res.data || []))
      .catch(() => {});
  }, [selected]);

  if (!accounts.length) return null;

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allPoints = compare.flatMap((c) => c.curve.map((p: any) => Number(p.equity)));
  const minY = allPoints.length ? Math.min(...allPoints) : 0;
  const maxY = allPoints.length ? Math.max(...allPoints) : 1;
  const W = 800, H = 220, PAD = 12;

  const toPath = (curve: any[]) => curve.map((p: any, i: number) => {
    const x = PAD + (i / Math.max(curve.length - 1, 1)) * (W - 2 * PAD);
    const y = H - PAD - ((Number(p.equity) - minY) / Math.max(maxY - minY, 1e-9)) * (H - 2 * PAD);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const fmt = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
        🧪 Сравнение конфигов (Paper Trading ноды)
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {accounts.map((a, i) => (
          <label
            key={a.id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
              borderRadius: '8px', cursor: 'pointer', fontSize: '11px',
              border: `1px solid ${selected.includes(a.id) ? COLORS[i % COLORS.length] : 'var(--border-color)'}`,
              color: 'var(--text-primary)', opacity: a.is_active ? 1 : 0.55,
            }}
          >
            <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
            {a.label} (#{a.id}){!a.is_active && ' — удалена'}
            <span style={{ color: 'var(--text-secondary)' }}>
              ×{Number(a.leverage)} / {Number(a.risk_percent)}%
            </span>
          </label>
        ))}
      </div>

      {compare.length > 0 && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            {compare.map((c, i) => (
              <path key={c.account.id} d={toPath(c.curve)} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
            ))}
          </svg>

          <table style={{ width: '100%', marginTop: '12px', fontSize: '11px', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px' }}>Конфиг</th>
                <th style={{ padding: '4px 8px' }}>Капитал</th>
                <th style={{ padding: '4px 8px' }}>Плечо</th>
                <th style={{ padding: '4px 8px' }}>% на сделку</th>
                <th style={{ padding: '4px 8px' }}>PnL %</th>
                <th style={{ padding: '4px 8px' }}>Win rate</th>
                <th style={{ padding: '4px 8px' }}>Max DD</th>
                <th style={{ padding: '4px 8px' }}>Сделок</th>
              </tr>
            </thead>
            <tbody>
              {compare.map((c, i) => (
                <tr key={c.account.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 700 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], marginRight: 6 }} />
                    {c.account.label}
                  </td>
                  <td style={{ padding: '4px 8px' }}>${fmt(c.account.starting_capital)}</td>
                  <td style={{ padding: '4px 8px' }}>×{Number(c.account.leverage)}</td>
                  <td style={{ padding: '4px 8px' }}>{Number(c.account.risk_percent)}%</td>
                  <td style={{ padding: '4px 8px', fontWeight: 700, color: c.stats.totalPnlPercent >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {c.stats.totalPnlPercent >= 0 ? '+' : ''}{c.stats.totalPnlPercent}%
                  </td>
                  <td style={{ padding: '4px 8px' }}>{c.stats.winRate}%</td>
                  <td style={{ padding: '4px 8px' }}>{c.stats.maxDrawdown}%</td>
                  <td style={{ padding: '4px 8px' }}>{c.stats.trades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default PaperCompareSection;
```

- [ ] **Step 2: Вставить секцию на страницу**

В `frontend/src/pages/PaperTrading.tsx`:

1. Импорт вверху:
```typescript
import PaperCompareSection from '../components/PaperCompareSection';
```

2. Сразу после закрывающего `</div>` блока `{/* Summary Header */}` (див с `borderBottom` и статами, строка ~119+) вставить:
```tsx
      <PaperCompareSection />
```

- [ ] **Step 3: Сборка + визуальная проверка**

Run: `cd frontend && npm run build`
Expected: успешный build.

В превью: страница Paper Trading показывает секцию сравнения (если есть хотя бы один аккаунт), выбор двух аккаунтов рисует две кривые и таблицу.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PaperCompareSection.tsx frontend/src/pages/PaperTrading.tsx
git commit -m "feat(paper): config comparison section with overlaid equity curves"
```

---

### Task 10: Финальная верификация

**Files:** нет новых.

- [ ] **Step 1: Полный прогон backend-тестов**

Run: `cd backend && npx jest`
Expected: все сьюты PASS (включая существующие signals-engine, paper-trading, optimizer).

- [ ] **Step 2: Сборки**

Run: `cd backend && npm run build && cd ../frontend && npm run build`
Expected: обе сборки чистые.

- [ ] **Step 3: Смоук end-to-end (локально или на сервере)**

1. Создать стратегию: Exchange → RSI → Comparison → LONG signal → 2× Paper Trading ноды (плечо 1 и плечо 5).
2. Сохранить → `GET /paper-trading/accounts?strategyId=X` возвращает 2 аккаунта с балансами = стартовым капиталам.
3. Дождаться (или спровоцировать) сигнал → в обоих аккаунтах открылись сделки с разной маржой; баланс уменьшился.
4. `GET /paper-trading/compare?ids=a,b` возвращает кривые.
5. Reset одного аккаунта → позиции закрыты, баланс восстановлен, история в `virtual_trades` осталась.

- [ ] **Step 4: Commit (если были фиксы)**

```bash
git add -A && git commit -m "fix(paper): post-verification fixes"
```
