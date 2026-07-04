# Backtest Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Страница `/backtest` как полноширинный дашборд-отчёт (Cyber-Quant карточки + терминальная плотность) с drawdown/распределениями/календарём, персистом истории прогонов, наложением кривых и сравнением двух прогонов.

**Architecture:** Backend расширяет result двумя сериями (`equityCurve`, `benchmark`) и персистит прогоны в новую таблицу `backtest_runs` (запись в processor, 3 REST-эндпоинта). Frontend: `Backtest.tsx` (1209 строк) распиливается на компоненты `components/backtest/*` + чистые функции агрегации `utils/backtestStats.ts`; существующие вкладки «График цены» и «Оптимизация» извлекаются как есть. Графики — самописный SVG (как PaperCompareSection), без новых библиотек.

**Tech Stack:** NestJS + TypeORM (postgres, `synchronize: true`), Bull, Jest (backend); React + axios + Jest/jsdom (frontend, тест-раннер уже настроен — см. `frontend/src/utils/__tests__/pineParser.test.ts`).

**Spec:** `docs/superpowers/specs/2026-07-03-backtest-page-redesign-design.md`. Утверждённый мокап стиля: `.superpowers/brainstorm/155-1783110229/content/visual-style-v2.html`.

## Global Constraints

- TypeORM `synchronize: true` — НЕ писать миграции.
- Акцент `#2962ff`; цвета через существующие CSS-переменные (`var(--bg-secondary)`, `var(--border-color)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--success)`, `var(--danger)`); прибыль `#3fb950`/`var(--success)`, убыток `#f85149`/`var(--danger)`, просадка `#f0883e`. Цифры — `fontFamily: 'monospace'`.
- Цвета наложенных кривых истории (фикс.): `['#a855f7', '#f59e0b', '#10b981']`, максимум 3 наложения.
- API-база на фронте: `const API = (import.meta as any).env?.VITE_API_URL || '/api';` (как в PaperTrading.tsx).
- `benchmark` ≤ 200 точек; `equityCurve` — стартовая точка + точка на каждое закрытие (включая partial и force-close).
- Heatmap и месяцы — по `exitTime` в **UTC**.
- Логика внутри вкладок «График цены» и «Оптимизация» НЕ редизайнится — переносится как есть.
- Существующие 12 тестов `backtest.service.spec.ts` должны остаться зелёными; result только расширяется.
- Backend-команды из `backend/`, frontend — из `frontend/`.
- UI-тексты на русском.

---

### Task 1: Backend — equityCurve и benchmark в result

**Files:**
- Modify: `backend/src/backtest/backtest.service.ts` (после цикла симуляции, перед `const wins = trades.filter...` ~строка 501; и объект return)
- Test: `backend/src/backtest/backtest.service.spec.ts`

**Interfaces:**
- Produces: `result.equityCurve: Array<{ t: string; v: number }>` (ISO-строки; [0].v === initialBalance, последняя ≈ finalBalance), `result.benchmark: Array<{ t: string; v: number }>` (≤200 точек, [0].v === initialBalance, buy&hold по close). Их потребляют Tasks 5, 9.

- [ ] **Step 1: Падающий тест**

Добавить в конец `describe('BacktestService', ...)` в `backtest.service.spec.ts`:

```typescript
  it('result содержит equityCurve и benchmark', async () => {
    const candles = makeCandles(110, 100);
    candles[100].close = '200';
    for (let i = 101; i < 110; i++) candles[i].close = '206'; // TP 2% сработает
    mockCandlesService.getCandlesForRange.mockResolvedValue(candles);

    let called = 0;
    mockSignalsEngine.evaluateNode.mockImplementation(() => {
      called++;
      return Promise.resolve(called === 1);
    });

    const result = await service.run(1, { ...DEFAULT_OPTS, tp: 0.02, sl: 0.01 });

    // equityCurve: старт = initialBalance, финал = finalBalance, точек = сделки + 1
    expect(result.equityCurve[0].v).toBe(1000);
    expect(result.equityCurve.length).toBe(result.totalTrades + 1);
    expect(result.equityCurve[result.equityCurve.length - 1].v).toBeCloseTo(result.finalBalance, 1);
    expect(typeof result.equityCurve[0].t).toBe('string');

    // benchmark: ≤200 точек, старт = initialBalance, buy&hold
    expect(result.benchmark.length).toBeLessThanOrEqual(200);
    expect(result.benchmark[0].v).toBe(1000);
    const first = parseFloat(candles[0].close);
    const last = parseFloat(candles[candles.length - 1].close);
    expect(result.benchmark[result.benchmark.length - 1].v).toBeCloseTo((1000 * last) / first, 1);
  });
```

- [ ] **Step 2: Убедиться что падает**

Run: `cd backend && npx jest backtest.service -t "equityCurve"`
Expected: FAIL — `result.equityCurve is undefined`.

- [ ] **Step 3: Реализация**

В `backtest.service.ts`, сразу ПЕРЕД строкой `const wins = trades.filter(t => t.pnl > 0);` вставить:

```typescript
    // ── Серии для фронта: кривая баланса и buy&hold бенчмарк ────────────────
    // Сумма net-pnl сделок точно повторяет движение баланса (fees уже внутри pnl)
    const equityCurve: Array<{ t: string; v: number }> = [];
    if (simCandles.length > 0) {
      equityCurve.push({ t: new Date(simCandles[0].time).toISOString(), v: round(options.initialBalance, 2) });
      let eq = options.initialBalance;
      for (const t of trades) {
        eq += t.pnl;
        equityCurve.push({ t: new Date(t.exitTime).toISOString(), v: round(eq, 2) });
      }
    }

    const benchmark: Array<{ t: string; v: number }> = [];
    if (simCandles.length > 0) {
      const c0 = parseFloat(simCandles[0].close.toString());
      const bstep = Math.max(1, Math.ceil(simCandles.length / 200));
      for (let bi = 0; bi < simCandles.length; bi += bstep) {
        const c = simCandles[bi];
        benchmark.push({ t: new Date(c.time).toISOString(), v: round((options.initialBalance * parseFloat(c.close.toString())) / c0, 2) });
      }
      const lastC = simCandles[simCandles.length - 1];
      if (benchmark[benchmark.length - 1].t !== new Date(lastC.time).toISOString()) {
        benchmark.push({ t: new Date(lastC.time).toISOString(), v: round((options.initialBalance * parseFloat(lastC.close.toString())) / c0, 2) });
      }
    }
```

В возвращаемом объекте результата (там, где `strategyName:, pair:, ... trades,`) добавить два поля:

```typescript
      equityCurve,
      benchmark,
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd backend && npx jest backtest.service`
Expected: PASS, 13 тестов (12 старых + новый).

- [ ] **Step 5: Commit**

```bash
git add backend/src/backtest/backtest.service.ts backend/src/backtest/backtest.service.spec.ts
git commit -m "feat(backtest): equity curve and buy&hold benchmark series in result"
```

---

### Task 2: Backend — персист прогонов (entity + service + processor + API)

**Files:**
- Create: `backend/src/backtest/backtest-run.entity.ts`
- Create: `backend/src/backtest/backtest-runs.service.ts`
- Test: `backend/src/backtest/backtest-runs.service.spec.ts`
- Modify: `backend/src/backtest/backtest.module.ts` (entity + provider + export)
- Modify: `backend/src/backtest/backtest.processor.ts` (persist после run)
- Modify: `backend/src/backtest/backtest.controller.ts` (3 endpoint'а)

**Interfaces:**
- Produces: entity `BacktestRun { id, strategy_id, options: any, result: any, created_at }`; `BacktestRunsService.saveRun(strategyId, options, result)`, `.listRuns(strategyId, limit=50)` → массив `{ id, strategy_id, created_at, options, summary: { totalReturn, totalTrades, winRate, maxDrawdown, finalBalance } }` (БЕЗ trades/equityCurve/benchmark), `.getRun(id)` → полная запись, `.deleteRun(id)`.
- HTTP: `GET /backtest/runs?strategyId=X&limit=50`, `GET /backtest/runs/:id`, `DELETE /backtest/runs/:id`. Их потребляет Task 6 (drawer).

- [ ] **Step 1: Entity**

```typescript
// backend/src/backtest/backtest-run.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { Strategy } from '../strategies/strategy.entity';

@Entity('backtest_runs')
export class BacktestRun {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Strategy, { onDelete: 'CASCADE' })
  strategy: Strategy;

  @Index()
  @Column()
  strategy_id: number;

  /** Полный BacktestOptions, с которым запускался прогон */
  @Column({ type: 'jsonb' })
  options: any;

  /** Полный result движка (trades, метрики, equityCurve, benchmark) */
  @Column({ type: 'jsonb' })
  result: any;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
```

- [ ] **Step 2: Падающие тесты сервиса**

```typescript
// backend/src/backtest/backtest-runs.service.spec.ts
import { BacktestRunsService } from './backtest-runs.service';

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOneBy: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockImplementation(async (x: any) => ({ id: 1, ...x })),
  create: jest.fn().mockImplementation((x: any) => x),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('BacktestRunsService', () => {
  let service: BacktestRunsService;
  let repo: any;

  const fullResult = {
    totalReturn: -0.44, totalTrades: 104, winRate: 51.9, maxDrawdown: 19.47, finalBalance: 995.6,
    trades: [{ pnl: 1 }, { pnl: -1 }],
    equityCurve: [{ t: 'x', v: 1000 }],
    benchmark: [{ t: 'x', v: 1000 }],
  };

  beforeEach(() => {
    repo = makeRepo();
    service = new BacktestRunsService(repo);
  });

  it('saveRun сохраняет полный результат', async () => {
    await service.saveRun(32, { tp: 0.02 }, fullResult);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ strategy_id: 32, options: { tp: 0.02 }, result: fullResult }),
    );
  });

  it('listRuns возвращает сводку без тяжёлых полей', async () => {
    repo.find.mockResolvedValue([
      { id: 1, strategy_id: 32, created_at: new Date('2026-07-03'), options: { tp: 0.02 }, result: fullResult },
    ]);
    const [run] = await service.listRuns(32);
    expect(run.summary).toEqual({ totalReturn: -0.44, totalTrades: 104, winRate: 51.9, maxDrawdown: 19.47, finalBalance: 995.6 });
    expect((run as any).result).toBeUndefined();
    expect(run.options).toEqual({ tp: 0.02 });
  });

  it('listRuns ограничивает выдачу и сортирует по дате DESC', async () => {
    await service.listRuns(32, 10);
    expect(repo.find).toHaveBeenCalledWith({ where: { strategy_id: 32 }, order: { created_at: 'DESC' }, take: 10 });
  });

  it('getRun возвращает полную запись', async () => {
    repo.findOneBy.mockResolvedValue({ id: 5, result: fullResult });
    const run = await service.getRun(5);
    expect(run.result.trades.length).toBe(2);
  });

  it('deleteRun удаляет по id', async () => {
    await service.deleteRun(5);
    expect(repo.delete).toHaveBeenCalledWith({ id: 5 });
  });
});
```

- [ ] **Step 3: Убедиться что падают**

Run: `cd backend && npx jest backtest-runs`
Expected: FAIL — `Cannot find module './backtest-runs.service'`.

- [ ] **Step 4: Сервис**

```typescript
// backend/src/backtest/backtest-runs.service.ts
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
```

- [ ] **Step 5: Тесты зелёные**

Run: `cd backend && npx jest backtest-runs`
Expected: PASS, 5 тестов.

- [ ] **Step 6: Модуль, processor, controller**

`backtest.module.ts`: добавить `BacktestRun` в существующий `TypeOrmModule.forFeature([...])` (если forFeature отсутствует — добавить `TypeOrmModule.forFeature([BacktestRun])` в imports), `BacktestRunsService` в providers и exports.

`backtest.processor.ts` — конструктор и persist:

```typescript
import { BacktestRunsService } from './backtest-runs.service';
// ...
  constructor(
    private readonly backtestService: BacktestService,
    private readonly backtestRunsService: BacktestRunsService,
  ) {}
```

В `handleBacktest`, после `const result = await this.backtestService.run(...)` и перед `return result;`:

```typescript
      try {
        await this.backtestRunsService.saveRun(strategyId, options, result);
      } catch (e) {
        this.logger.error(`Failed to persist backtest run: ${(e as Error).message}`);
      }
```

`backtest.controller.ts` — инжект сервиса и 3 роута (СТАТИЧЕСКИЙ `runs` объявить ПЕРЕД существующим `@Get('job/:jobId')` не обязательно — сегменты разные, но держим новые роуты рядом сверху):

```typescript
import { BacktestRunsService } from './backtest-runs.service';
import { Query, Delete } from '@nestjs/common'; // дополнить существующий импорт
// ... в конструктор добавить:
    private readonly backtestRunsService: BacktestRunsService,

  @Get('runs')
  listRuns(@Query('strategyId') strategyId: string, @Query('limit') limit?: string) {
    return this.backtestRunsService.listRuns(parseInt(strategyId, 10), limit ? parseInt(limit, 10) : 50);
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.backtestRunsService.getRun(parseInt(id, 10));
  }

  @Delete('runs/:id')
  deleteRun(@Param('id') id: string) {
    return this.backtestRunsService.deleteRun(parseInt(id, 10));
  }
```

Внимание: у воркера свой урезанный модуль (worker.js собирается из 6 модулей) — если worker поднимает BacktestModule, entity подтянется автоматически; ничего дополнительно не делать.

- [ ] **Step 7: Сборка + все тесты**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json && npx jest`
Expected: сборка чистая, все сьюты PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/backtest/
git commit -m "feat(backtest): persist runs to backtest_runs with list/get/delete API"
```

---

### Task 3: Frontend — типы и функции агрегации backtestStats

**Files:**
- Create: `frontend/src/utils/backtestStats.ts`
- Test: `frontend/src/utils/__tests__/backtestStats.test.ts`

**Interfaces:**
- Produces (потребляют Tasks 4, 5, 9):

```typescript
export interface BtTrade { entryTime: string; exitTime: string; type: string; entryPrice: number; exitPrice: number; pnl: number; pnlPercent: number; fees?: number; exitReason?: string; isPartial?: boolean; forceClosed?: boolean; }
export interface EquityPoint { t: string; v: number }
buildPnlHistogram(trades: BtTrade[], binCount = 11): Array<{ from: number; to: number; count: number }>
buildExitReasons(trades: BtTrade[]): Array<{ reason: 'TP'|'SL'|'TRAILING'|'PARTIAL'|'FORCE'|'MANUAL'; count: number }>
buildMonthlyPnl(trades: BtTrade[]): Array<{ month: string /* YYYY-MM */; pnl: number }>
buildHourDayHeatmap(trades: BtTrade[]): number[][] /* [7 дней][24 часа], UTC, сумма pnl */
buildUnderwater(equity: EquityPoint[]): Array<{ t: string; ddPct: number }>
daysToRecover(equity: EquityPoint[]): number | null /* null = не восстановился */
```

- [ ] **Step 1: Падающие тесты**

```typescript
// frontend/src/utils/__tests__/backtestStats.test.ts
import {
  buildPnlHistogram, buildExitReasons, buildMonthlyPnl,
  buildHourDayHeatmap, buildUnderwater, daysToRecover, BtTrade,
} from '../backtestStats';

const trade = (over: Partial<BtTrade>): BtTrade => ({
  entryTime: '2026-01-10T10:00:00Z', exitTime: '2026-01-10T12:00:00Z', type: 'LONG',
  entryPrice: 100, exitPrice: 102, pnl: 2, pnlPercent: 2, ...over,
});

describe('buildPnlHistogram', () => {
  it('раскладывает по бинам, крайние значения входят', () => {
    const trades = [-4, -2, 0, 2, 4].map((p) => trade({ pnlPercent: p }));
    const bins = buildPnlHistogram(trades, 4);
    expect(bins.length).toBe(4);
    expect(bins[0].from).toBe(-4);
    expect(bins[3].to).toBe(4);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(5); // никто не потерян
  });
  it('одинаковые значения → один бин', () => {
    expect(buildPnlHistogram([trade({}), trade({})])).toEqual([{ from: 2, to: 2, count: 2 }]);
  });
  it('пусто → пусто', () => {
    expect(buildPnlHistogram([])).toEqual([]);
  });
});

describe('buildExitReasons', () => {
  it('классифицирует все типы причин', () => {
    const trades = [
      trade({ exitReason: 'TP' }),
      trade({ exitReason: 'SL/Trailing' }),        // движок пишет так при стопе
      trade({ exitReason: 'Partial_TP_1', isPartial: true }),
      trade({ exitReason: undefined, forceClosed: true }),
      trade({ exitReason: 'MANUAL' }),
      trade({ exitReason: undefined, pnl: -1 }),    // легаси без причины → по знаку
    ];
    const m = Object.fromEntries(buildExitReasons(trades).map((r) => [r.reason, r.count]));
    expect(m.TP).toBe(1);
    expect(m.SL).toBe(2);        // 'SL/Trailing' + легаси с pnl<0
    expect(m.PARTIAL).toBe(1);
    expect(m.FORCE).toBe(1);
    expect(m.MANUAL).toBe(1);
  });
});

describe('buildMonthlyPnl', () => {
  it('суммирует по месяцу exitTime и сортирует', () => {
    const trades = [
      trade({ exitTime: '2026-02-05T00:00:00Z', pnl: 3 }),
      trade({ exitTime: '2026-01-20T00:00:00Z', pnl: -1 }),
      trade({ exitTime: '2026-02-25T00:00:00Z', pnl: 2 }),
    ];
    expect(buildMonthlyPnl(trades)).toEqual([
      { month: '2026-01', pnl: -1 },
      { month: '2026-02', pnl: 5 },
    ]);
  });
});

describe('buildHourDayHeatmap', () => {
  it('7×24 матрица, UTC день/час по exitTime', () => {
    // 2026-01-05 — понедельник (getUTCDay()=1); 14:30 UTC → час 14
    const m = buildHourDayHeatmap([trade({ exitTime: '2026-01-05T14:30:00Z', pnl: 5 })]);
    expect(m.length).toBe(7);
    expect(m[0].length).toBe(24);
    expect(m[1][14]).toBe(5);
    expect(m[0][0]).toBe(0);
  });
});

describe('buildUnderwater / daysToRecover', () => {
  const eq = [
    { t: '2026-01-01T00:00:00Z', v: 1000 },
    { t: '2026-01-02T00:00:00Z', v: 1100 }, // пик
    { t: '2026-01-05T00:00:00Z', v: 880 },  // дно: DD 20%
    { t: '2026-01-10T00:00:00Z', v: 1150 }, // восстановился
  ];
  it('underwater: 0 на пиках, глубина между ними', () => {
    const uw = buildUnderwater(eq);
    expect(uw[1].ddPct).toBe(0);
    expect(uw[2].ddPct).toBeCloseTo(20);
    expect(uw[3].ddPct).toBe(0);
  });
  it('daysToRecover: от пика перед дном до восстановления', () => {
    expect(daysToRecover(eq)).toBe(8); // 02.01 → 10.01
  });
  it('daysToRecover: null если не восстановился', () => {
    expect(daysToRecover(eq.slice(0, 3))).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться что падают**

Run: `cd frontend && npx jest backtestStats`
Expected: FAIL — `Cannot find module '../backtestStats'`.

- [ ] **Step 3: Реализация**

```typescript
// frontend/src/utils/backtestStats.ts
export interface BtTrade {
  entryTime: string; exitTime: string; type: string;
  entryPrice: number; exitPrice: number; pnl: number; pnlPercent: number;
  fees?: number; exitReason?: string; isPartial?: boolean; forceClosed?: boolean;
}
export interface EquityPoint { t: string; v: number }

export function buildPnlHistogram(trades: BtTrade[], binCount = 11): Array<{ from: number; to: number; count: number }> {
  if (!trades.length) return [];
  const vals = trades.map((t) => Number(t.pnlPercent) || 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return [{ from: min, to: max, count: vals.length }];
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({ from: min + i * width, to: min + (i + 1) * width, count: 0 }));
  for (const v of vals) {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / width));
    bins[idx].count++;
  }
  return bins;
}

export function buildExitReasons(trades: BtTrade[]): Array<{ reason: 'TP' | 'SL' | 'TRAILING' | 'PARTIAL' | 'FORCE' | 'MANUAL'; count: number }> {
  const classify = (t: BtTrade): 'TP' | 'SL' | 'TRAILING' | 'PARTIAL' | 'FORCE' | 'MANUAL' => {
    if (t.forceClosed) return 'FORCE';
    const r = (t.exitReason || '').toUpperCase();
    if (t.isPartial || r.includes('PARTIAL')) return 'PARTIAL';
    if (r.startsWith('SL')) return 'SL';           // включая 'SL/Trailing' движка
    if (r.includes('TRAIL')) return 'TRAILING';
    if (r.includes('TP')) return 'TP';
    if (r.includes('MANUAL')) return 'MANUAL';
    if (r.includes('FORCE')) return 'FORCE';
    return (Number(t.pnl) >= 0 ? 'TP' : 'SL');     // легаси-строки без причины
  };
  const counts = new Map<string, number>();
  for (const t of trades) {
    const k = classify(t);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const order: Array<'TP' | 'SL' | 'TRAILING' | 'PARTIAL' | 'FORCE' | 'MANUAL'> = ['TP', 'SL', 'TRAILING', 'PARTIAL', 'FORCE', 'MANUAL'];
  return order.filter((k) => counts.has(k)).map((k) => ({ reason: k, count: counts.get(k)! }));
}

export function buildMonthlyPnl(trades: BtTrade[]): Array<{ month: string; pnl: number }> {
  const byMonth = new Map<string, number>();
  for (const t of trades) {
    const d = new Date(t.exitTime);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, (byMonth.get(key) || 0) + Number(t.pnl));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 }));
}

/** [7 дней (вс=0..сб=6)][24 часа] — сумма pnl по exitTime в UTC */
export function buildHourDayHeatmap(trades: BtTrade[]): number[][] {
  const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const t of trades) {
    const d = new Date(t.exitTime);
    m[d.getUTCDay()][d.getUTCHours()] += Number(t.pnl);
  }
  return m.map((row) => row.map((v) => Math.round(v * 100) / 100));
}

export function buildUnderwater(equity: EquityPoint[]): Array<{ t: string; ddPct: number }> {
  let peak = -Infinity;
  return equity.map((p) => {
    peak = Math.max(peak, p.v);
    const dd = peak > 0 ? ((peak - p.v) / peak) * 100 : 0;
    return { t: p.t, ddPct: Math.round(dd * 100) / 100 };
  });
}

/** Дни от пика перед МАКСИМАЛЬНОЙ просадкой до первого восстановления выше того пика; null — не восстановился */
export function daysToRecover(equity: EquityPoint[]): number | null {
  if (equity.length < 2) return 0;
  let peakIdx = 0;
  let worstDd = 0;
  let worstPeakIdx = 0;
  for (let i = 1; i < equity.length; i++) {
    if (equity[i].v > equity[peakIdx].v) peakIdx = i;
    const dd = (equity[peakIdx].v - equity[i].v) / equity[peakIdx].v;
    if (dd > worstDd) {
      worstDd = dd;
      worstPeakIdx = peakIdx;
    }
  }
  if (worstDd === 0) return 0;
  const peakV = equity[worstPeakIdx].v;
  for (let i = worstPeakIdx + 1; i < equity.length; i++) {
    if (equity[i].v >= peakV) {
      const ms = new Date(equity[i].t).getTime() - new Date(equity[worstPeakIdx].t).getTime();
      return Math.round(ms / 86400000);
    }
  }
  return null;
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd frontend && npx jest backtestStats`
Expected: PASS, 9 тестов.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/backtestStats.ts frontend/src/utils/__tests__/backtestStats.test.ts
git commit -m "feat(backtest-ui): pure aggregation utils for report analytics"
```

---

### Task 4: Frontend — KpiStrip и DistributionsRow

**Files:**
- Create: `frontend/src/components/backtest/KpiStrip.tsx`
- Create: `frontend/src/components/backtest/DistributionsRow.tsx`

**Interfaces:**
- Consumes: `buildPnlHistogram/buildExitReasons/buildMonthlyPnl/buildHourDayHeatmap`, `BtTrade`, `EquityPoint`, `daysToRecover` (Task 3).
- Produces:
  - `<KpiStrip result={BacktestResultLike} compareResult={BacktestResultLike | null} />` — result должен содержать totalReturn, initialBalance, finalBalance, winRate, totalTrades, maxDrawdown, profitFactor, sharpeRatio, avgWin, avgLoss, maxConsecutiveWins, maxConsecutiveLosses, recoveryFactor, equityCurve.
  - `<DistributionsRow trades={BtTrade[]} />`.

- [ ] **Step 1: KpiStrip**

```tsx
// frontend/src/components/backtest/KpiStrip.tsx
import { CSSProperties } from 'react';
import { daysToRecover, EquityPoint } from '../../utils/backtestStats';

const tile: CSSProperties = {
  flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
  borderRadius: '10px', padding: '10px 12px', minWidth: 0,
};
const label: CSSProperties = { color: 'var(--text-secondary)', fontSize: '9px', letterSpacing: '.08em', textTransform: 'uppercase' };
const big: CSSProperties = { fontFamily: 'monospace', fontWeight: 800, fontSize: '20px', lineHeight: 1.3 };
const sub: CSSProperties = { color: 'var(--text-secondary)', fontSize: '10px', fontFamily: 'monospace' };

const fmt = (n: any, d = 2) => Number(n ?? 0).toFixed(d);

interface Props { result: any; compareResult?: any | null }

/** Пара значений в режиме сравнения; лучшее — зелёной рамкой */
const Pair = ({ a, b, betterWhen }: { a: string; b: string; betterWhen: 'a' | 'b' | 'eq' }) => (
  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
    <span style={{ ...big, fontSize: '15px', padding: '0 3px', borderRadius: 4, border: betterWhen === 'a' ? '1px solid var(--success)' : '1px solid transparent' }}>{a}</span>
    <span style={{ ...big, fontSize: '15px', color: 'var(--text-secondary)', padding: '0 3px', borderRadius: 4, border: betterWhen === 'b' ? '1px solid var(--success)' : '1px solid transparent' }}>{b}</span>
  </div>
);

const KpiStrip = ({ result: r, compareResult: c }: Props) => {
  const rec = daysToRecover((r.equityCurve || []) as EquityPoint[]);
  const retColor = (v: number) => (v >= 0 ? 'var(--success)' : 'var(--danger)');
  const better = (a: number, b: number, higherIsBetter = true): 'a' | 'b' | 'eq' =>
    a === b ? 'eq' : (higherIsBetter ? a > b : a < b) ? 'a' : 'b';

  const tiles: Array<{ key: string; label: string; render: () => JSX.Element; subText: string; accent?: boolean }> = [
    {
      key: 'ret', label: 'Total Return', accent: true,
      render: () => c
        ? <Pair a={`${fmt(r.totalReturn)}%`} b={`${fmt(c.totalReturn)}%`} betterWhen={better(r.totalReturn, c.totalReturn)} />
        : <div style={{ ...big, color: retColor(r.totalReturn) }}>{r.totalReturn >= 0 ? '+' : ''}{fmt(r.totalReturn)}%</div>,
      subText: `$${fmt(r.initialBalance, 0)} → $${fmt(r.finalBalance)}`,
    },
    {
      key: 'wr', label: 'Win Rate',
      render: () => c
        ? <Pair a={`${fmt(r.winRate, 1)}%`} b={`${fmt(c.winRate, 1)}%`} betterWhen={better(r.winRate, c.winRate)} />
        : <div style={big}>{fmt(r.winRate, 1)}%</div>,
      subText: `${Math.round((r.winRate / 100) * r.totalTrades)}W / ${r.totalTrades - Math.round((r.winRate / 100) * r.totalTrades)}L`,
    },
    {
      key: 'dd', label: 'Max Drawdown',
      render: () => c
        ? <Pair a={`${fmt(r.maxDrawdown)}%`} b={`${fmt(c.maxDrawdown)}%`} betterWhen={better(r.maxDrawdown, c.maxDrawdown, false)} />
        : <div style={{ ...big, color: '#f0883e' }}>{fmt(r.maxDrawdown)}%</div>,
      subText: rec === null ? 'не восстановлен' : `${rec} дн. до восстановления`,
    },
    {
      key: 'pf', label: 'Profit Factor',
      render: () => c
        ? <Pair a={fmt(r.profitFactor)} b={fmt(c.profitFactor)} betterWhen={better(r.profitFactor, c.profitFactor)} />
        : <div style={big}>{fmt(r.profitFactor)}</div>,
      subText: `Sharpe ${fmt(r.sharpeRatio)}`,
    },
    {
      key: 'n', label: 'Сделок',
      render: () => c
        ? <Pair a={String(r.totalTrades)} b={String(c.totalTrades)} betterWhen="eq" />
        : <div style={big}>{r.totalTrades}</div>,
      subText: `avg +$${fmt(r.avgWin)} / $${fmt(r.avgLoss)}`,
    },
    {
      key: 'streak', label: 'Серии W/L',
      render: () => c
        ? <Pair a={`${r.maxConsecutiveWins}/${r.maxConsecutiveLosses}`} b={`${c.maxConsecutiveWins}/${c.maxConsecutiveLosses}`} betterWhen="eq" />
        : <div style={big}>{r.maxConsecutiveWins} / {r.maxConsecutiveLosses}</div>,
      subText: `recovery ${fmt(r.recoveryFactor)}`,
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {tiles.map((t) => (
        <div key={t.key} style={{
          ...tile,
          ...(t.accent ? { flex: 1.2, background: 'linear-gradient(135deg, rgba(41,98,255,0.18), var(--bg-secondary))', border: '1px solid #2962ff' } : {}),
        }}>
          <div style={label}>{t.label}</div>
          {t.render()}
          <div style={sub}>{t.subText}</div>
        </div>
      ))}
    </div>
  );
};

export default KpiStrip;
```

- [ ] **Step 2: DistributionsRow**

```tsx
// frontend/src/components/backtest/DistributionsRow.tsx
import { CSSProperties, useMemo } from 'react';
import { BtTrade, buildPnlHistogram, buildExitReasons, buildMonthlyPnl, buildHourDayHeatmap } from '../../utils/backtestStats';

const card: CSSProperties = {
  flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
  borderRadius: '10px', padding: '10px', minWidth: 0,
};
const title: CSSProperties = { color: 'var(--text-secondary)', fontSize: '9px', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 };

const GREEN = '#3fb950';
const RED = '#f85149';
const REASON_COLORS: Record<string, string> = { TP: GREEN, SL: RED, TRAILING: '#f0883e', PARTIAL: '#79c0ff', FORCE: '#a855f7', MANUAL: '#8b949e' };
const DAY_LABELS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const DistributionsRow = ({ trades }: { trades: BtTrade[] }) => {
  const hist = useMemo(() => buildPnlHistogram(trades), [trades]);
  const reasons = useMemo(() => buildExitReasons(trades), [trades]);
  const monthly = useMemo(() => buildMonthlyPnl(trades), [trades]);
  const heat = useMemo(() => buildHourDayHeatmap(trades), [trades]);

  const histMax = Math.max(...hist.map((b) => b.count), 1);
  const reasonMax = Math.max(...reasons.map((x) => x.count), 1);
  const monthMax = Math.max(...monthly.map((m) => Math.abs(m.pnl)), 1);
  const heatMax = Math.max(...heat.flat().map(Math.abs), 1e-9);

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={card}>
        <div style={title}>Распределение PnL, %</div>
        <svg viewBox="0 0 200 70" style={{ width: '100%', display: 'block' }}>
          {hist.map((b, i) => {
            const w = 200 / Math.max(hist.length, 1);
            const h = (b.count / histMax) * 60;
            const mid = (b.from + b.to) / 2;
            return <rect key={i} x={i * w + 1} y={65 - h} width={w - 2} height={h} rx={1}
              fill={mid >= 0 ? GREEN : RED} opacity={0.85} />;
          })}
          <line x1="0" y1="65" x2="200" y2="65" stroke="var(--border-color)" strokeWidth="0.5" />
        </svg>
      </div>

      <div style={card}>
        <div style={title}>Причины выходов</div>
        {reasons.map((x) => (
          <div key={x.reason} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 10, marginBottom: 4 }}>
            <span style={{ width: 58, color: REASON_COLORS[x.reason] }}>{x.reason}</span>
            <div style={{ flex: 1, background: 'var(--bg-primary)', borderRadius: 3, height: 8 }}>
              <div style={{ width: `${(x.count / reasonMax) * 100}%`, height: '100%', background: REASON_COLORS[x.reason], borderRadius: 3 }} />
            </div>
            <span style={{ width: 26, textAlign: 'right', color: 'var(--text-primary)' }}>{x.count}</span>
          </div>
        ))}
        {reasons.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Нет сделок</div>}
      </div>

      <div style={card}>
        <div style={title}>PnL по месяцам, $</div>
        <svg viewBox="0 0 200 70" style={{ width: '100%', display: 'block' }}>
          <line x1="0" y1="35" x2="200" y2="35" stroke="var(--border-color)" strokeWidth="0.5" />
          {monthly.map((m, i) => {
            const w = 200 / Math.max(monthly.length, 1);
            const h = (Math.abs(m.pnl) / monthMax) * 30;
            return (
              <g key={m.month}>
                <rect x={i * w + 2} y={m.pnl >= 0 ? 35 - h : 35} width={w - 4} height={h} rx={1} fill={m.pnl >= 0 ? GREEN : RED} opacity={0.85} />
                <text x={i * w + w / 2} y={68} fontSize="5" fill="var(--text-secondary)" textAnchor="middle" fontFamily="monospace">{m.month.slice(5)}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={card}>
        <div style={title}>PnL: час × день (UTC)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '18px repeat(24, 1fr)', gap: 1 }}>
          {heat.map((row, day) => (
            [<div key={`l${day}`} style={{ fontSize: 7, color: 'var(--text-secondary)', fontFamily: 'monospace', lineHeight: '7px' }}>{DAY_LABELS[day]}</div>,
            ...row.map((v, hour) => (
              <div key={`${day}-${hour}`} title={`${DAY_LABELS[day]} ${hour}:00 → ${v}$`} style={{
                height: 7, borderRadius: 1,
                background: v === 0 ? 'var(--bg-primary)' : v > 0
                  ? `rgba(63,185,80,${0.25 + 0.75 * (v / heatMax)})`
                  : `rgba(248,81,73,${0.25 + 0.75 * (Math.abs(v) / heatMax)})`,
              }} />
            ))]
          ))}
        </div>
        <div style={{ fontSize: 7, color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: 3 }}>00&nbsp;&nbsp;04&nbsp;&nbsp;08&nbsp;&nbsp;12&nbsp;&nbsp;16&nbsp;&nbsp;20&nbsp;&nbsp;23</div>
      </div>
    </div>
  );
};

export default DistributionsRow;
```

- [ ] **Step 3: Сборка**

Run: `cd frontend && npm run build`
Expected: успешный vite build (компоненты ещё не подключены к странице — это нормально; tree-shaking их не валидирует, поэтому дополнительно: `npx tsc --noEmit 2>&1 | grep backtest` — по новым файлам ошибок нет).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/backtest/KpiStrip.tsx frontend/src/components/backtest/DistributionsRow.tsx
git commit -m "feat(backtest-ui): KPI strip and distributions row components"
```

---

### Task 5: Frontend — EquityChart (equity + underwater + overlay + benchmark)

**Files:**
- Create: `frontend/src/components/backtest/EquityChart.tsx`

**Interfaces:**
- Consumes: `EquityPoint`, `buildUnderwater` (Task 3).
- Produces: `<EquityChart equityCurve benchmark overlays trades onTradeDotClick activeTradeIdx />`:

```typescript
interface EquityChartProps {
  equityCurve: EquityPoint[];
  benchmark?: EquityPoint[];
  overlays?: Array<{ label: string; color: string; points: EquityPoint[] }>; // ≤3
  trades?: Array<{ exitTime: string; pnl: number }>;
  onTradeDotClick?: (tradeIdx: number) => void;
  activeTradeIdx?: number | null;
}
```

- [ ] **Step 1: Реализация**

```tsx
// frontend/src/components/backtest/EquityChart.tsx
import { useMemo } from 'react';
import { EquityPoint, buildUnderwater } from '../../utils/backtestStats';

const GREEN = '#3fb950';
const RED = '#f85149';

interface EquityChartProps {
  equityCurve: EquityPoint[];
  benchmark?: EquityPoint[];
  overlays?: Array<{ label: string; color: string; points: EquityPoint[] }>;
  trades?: Array<{ exitTime: string; pnl: number }>;
  onTradeDotClick?: (tradeIdx: number) => void;
  activeTradeIdx?: number | null;
}

const W = 900;
const H = 220;
const UW_H = 60;
const PAD = { l: 46, r: 8, t: 8, b: 16 };

const EquityChart = ({ equityCurve, benchmark, overlays = [], trades = [], onTradeDotClick, activeTradeIdx }: EquityChartProps) => {
  const model = useMemo(() => {
    if (!equityCurve || equityCurve.length < 2) return null;
    const allSeries = [equityCurve, ...(benchmark ? [benchmark] : []), ...overlays.map((o) => o.points)];
    const t0 = Math.min(...allSeries.map((s) => new Date(s[0].t).getTime()));
    const t1 = Math.max(...allSeries.map((s) => new Date(s[s.length - 1].t).getTime()));
    const vAll = allSeries.flatMap((s) => s.map((p) => p.v));
    const vMin = Math.min(...vAll);
    const vMax = Math.max(...vAll);
    const x = (t: string) => PAD.l + ((new Date(t).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - vMin) / Math.max(vMax - vMin, 1e-9)) * (H - PAD.t - PAD.b);
    const path = (pts: EquityPoint[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const uw = buildUnderwater(equityCurve);
    const uwMax = Math.max(...uw.map((p) => p.ddPct), 1e-9);
    const uwY = (dd: number) => 2 + (dd / uwMax) * (UW_H - 8);
    return { t0, t1, vMin, vMax, x, y, path, uw, uwMax, uwY };
  }, [equityCurve, benchmark, overlays]);

  if (!model) return <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 24, textAlign: 'center' }}>Запустите бэктест — здесь появится кривая доходности</div>;

  const { x, y, path, uw, uwMax, uwY, vMin, vMax } = model;
  const gridVals = [vMin, (vMin + vMax) / 2, vMax];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4, fontFamily: 'monospace' }}>
        <span style={{ color: '#2962ff' }}>━ equity</span>
        {benchmark && <span style={{ color: '#79c0ff' }}>┄ buy&hold</span>}
        {overlays.map((o) => <span key={o.label} style={{ color: o.color }}>━ {o.label}</span>)}
        <span style={{ marginLeft: 'auto' }}>● закрытия сделок</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2962ff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#2962ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={PAD.l} y1={y(v)} x2={W - PAD.r} y2={y(v)} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="2,4" />
            <text x={4} y={y(v) + 3} fontSize="9" fill="var(--text-secondary)" fontFamily="monospace">${Math.round(v)}</text>
          </g>
        ))}
        <polygon
          points={`${equityCurve.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')} ${x(equityCurve[equityCurve.length - 1].t).toFixed(1)},${H - PAD.b} ${x(equityCurve[0].t).toFixed(1)},${H - PAD.b}`}
          fill="url(#eqFill)"
        />
        {benchmark && <path d={path(benchmark)} fill="none" stroke="#79c0ff" strokeWidth="1" strokeDasharray="4,4" />}
        {overlays.map((o) => <path key={o.label} d={path(o.points)} fill="none" stroke={o.color} strokeWidth="1.3" />)}
        <path d={path(equityCurve)} fill="none" stroke="#2962ff" strokeWidth="1.8" />
        {trades.map((t, i) => (
          <circle key={i} cx={x(t.exitTime)} cy={y(equityCurve[Math.min(i + 1, equityCurve.length - 1)].v)}
            r={activeTradeIdx === i ? 4 : 2.4}
            fill={Number(t.pnl) >= 0 ? GREEN : RED}
            stroke={activeTradeIdx === i ? '#fff' : 'none'} strokeWidth="1"
            style={{ cursor: onTradeDotClick ? 'pointer' : 'default' }}
            onClick={() => onTradeDotClick?.(i)} />
        ))}
        <text x={PAD.l} y={H - 4} fontSize="9" fill="var(--text-secondary)" fontFamily="monospace">{equityCurve[0].t.slice(0, 10)}</text>
        <text x={W - PAD.r} y={H - 4} fontSize="9" fill="var(--text-secondary)" fontFamily="monospace" textAnchor="end">{equityCurve[equityCurve.length - 1].t.slice(0, 10)}</text>
      </svg>

      <svg viewBox={`0 0 ${W} ${UW_H}`} style={{ width: '100%', display: 'block', marginTop: 2 }}>
        <polygon
          points={`${PAD.l},2 ${uw.map((p) => `${x(p.t).toFixed(1)},${uwY(p.ddPct).toFixed(1)}`).join(' ')} ${W - PAD.r},2`}
          fill="rgba(248,81,73,0.18)" stroke={RED} strokeWidth="0.7"
        />
        <text x={4} y={UW_H - 6} fontSize="8" fill={RED} fontFamily="monospace">DD −{uwMax.toFixed(1)}%</text>
      </svg>
    </div>
  );
};

export default EquityChart;
```

- [ ] **Step 2: Сборка**

Run: `cd frontend && npm run build && npx tsc --noEmit 2>&1 | grep -i "components/backtest" || echo NO_NEW_ERRORS`
Expected: build успешен, по новым файлам ошибок нет.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/backtest/EquityChart.tsx
git commit -m "feat(backtest-ui): equity chart with underwater, benchmark and overlays"
```

---

### Task 6: Frontend — TradesTable и RunHistoryDrawer

**Files:**
- Create: `frontend/src/components/backtest/TradesTable.tsx`
- Create: `frontend/src/components/backtest/RunHistoryDrawer.tsx`

**Interfaces:**
- Consumes: `BtTrade` (Task 3); HTTP `GET /backtest/runs?strategyId=`, `GET /backtest/runs/:id`, `DELETE /backtest/runs/:id` (Task 2).
- Produces:

```typescript
<TradesTable trades={BtTrade[]} activeIdx={number|null} onRowClick={(idx)=>void} />
<RunHistoryDrawer open strategyId reloadKey onClose
  overlayRunIds={number[]}
  onToggleOverlay={(runId: number, full: {id:number; label:string; result:any} | null) => void} // null = снять
  onCompare={(full: {id:number; options:any; result:any} | null) => void} />
```

- [ ] **Step 1: TradesTable**

```tsx
// frontend/src/components/backtest/TradesTable.tsx
import { CSSProperties, useMemo, useState } from 'react';
import { BtTrade, buildExitReasons } from '../../utils/backtestStats';

const GREEN = '#3fb950';
const RED = '#f85149';
const chip = (active: boolean): CSSProperties => ({
  fontSize: 10, padding: '2px 10px', borderRadius: 6, cursor: 'pointer',
  border: `1px solid ${active ? '#2962ff' : 'var(--border-color)'}`,
  color: active ? '#79c0ff' : 'var(--text-secondary)',
});
const cell: CSSProperties = { padding: '3px 8px', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' };

type Filter = 'all' | 'long' | 'short' | 'tp' | 'sl' | 'partial';
const PAGE = 100;

const fmtDt = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const reasonOf = (t: BtTrade) => buildExitReasons([t])[0]?.reason || 'TP';

const TradesTable = ({ trades, activeIdx, onRowClick }: { trades: BtTrade[]; activeIdx: number | null; onRowClick: (idx: number) => void }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);

  const rows = useMemo(() => trades
    .map((t, idx) => ({ t, idx, reason: reasonOf(t) }))
    .filter(({ t, reason }) => {
      if (filter === 'long') return t.type === 'LONG';
      if (filter === 'short') return t.type === 'SHORT';
      if (filter === 'tp') return reason === 'TP';
      if (filter === 'sl') return reason === 'SL';
      if (filter === 'partial') return reason === 'PARTIAL';
      return true;
    }), [trades, filter]);

  const paged = rows.slice(page * PAGE, (page + 1) * PAGE);
  const pages = Math.ceil(rows.length / PAGE);

  const exportCsv = () => {
    let csv = 'N,entryTime,exitTime,type,entryPrice,exitPrice,pnl,pnlPercent,reason\n';
    rows.forEach(({ t, idx, reason }) => {
      csv += `${idx + 1},${t.entryTime},${t.exitTime},${t.type},${t.entryPrice},${t.exitPrice},${t.pnl},${t.pnlPercent},${reason}\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'backtest-trades.csv';
    a.click();
  };

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>СДЕЛКИ ({rows.length})</span>
        {(['all', 'long', 'short', 'tp', 'sl', 'partial'] as Filter[]).map((f) => (
          <span key={f} style={chip(filter === f)} onClick={() => { setFilter(f); setPage(0); }}>
            {{ all: 'Все', long: 'Long', short: 'Short', tp: 'TP', sl: 'SL', partial: 'Partial' }[f]}
          </span>
        ))}
        <span style={{ ...chip(false), marginLeft: 'auto' }} onClick={exportCsv}>⬇ CSV</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
              {['#', 'Вход', 'Выход', 'Тип', 'Цена входа', 'Цена выхода', 'PnL %', 'PnL $', 'Причина'].map((h) => (
                <th key={h} style={{ ...cell, fontSize: 9, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map(({ t, idx, reason }) => (
              <tr key={idx} onClick={() => onRowClick(idx)} style={{
                cursor: 'pointer', borderTop: '1px solid var(--border-color)',
                background: activeIdx === idx ? 'rgba(41,98,255,0.12)' : 'transparent',
              }}>
                <td style={{ ...cell, color: 'var(--text-secondary)' }}>{idx + 1}</td>
                <td style={{ ...cell, color: 'var(--text-primary)' }}>{fmtDt(t.entryTime)}</td>
                <td style={{ ...cell, color: 'var(--text-primary)' }}>{fmtDt(t.exitTime)}</td>
                <td style={{ ...cell, color: t.type === 'LONG' ? GREEN : RED }}>{t.type}</td>
                <td style={{ ...cell, color: 'var(--text-primary)' }}>{Number(t.entryPrice).toFixed(2)}</td>
                <td style={{ ...cell, color: 'var(--text-primary)' }}>{Number(t.exitPrice).toFixed(2)}</td>
                <td style={{ ...cell, color: Number(t.pnlPercent) >= 0 ? GREEN : RED }}>{Number(t.pnlPercent) >= 0 ? '+' : ''}{Number(t.pnlPercent).toFixed(2)}</td>
                <td style={{ ...cell, color: Number(t.pnl) >= 0 ? GREEN : RED }}>{Number(t.pnl) >= 0 ? '+' : ''}{Number(t.pnl).toFixed(2)}</td>
                <td style={cell}><span style={{
                  fontSize: 9, fontWeight: 800, padding: '1px 7px', borderRadius: 5,
                  background: reason === 'TP' ? 'rgba(63,185,80,0.15)' : reason === 'SL' ? 'rgba(248,81,73,0.15)' : 'rgba(139,148,158,0.15)',
                  color: reason === 'TP' ? GREEN : reason === 'SL' ? RED : 'var(--text-secondary)',
                }}>{reason}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, fontSize: 10, fontFamily: 'monospace' }}>
          {Array.from({ length: pages }, (_, p) => (
            <span key={p} style={chip(page === p)} onClick={() => setPage(p)}>{p + 1}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradesTable;
```

- [ ] **Step 2: RunHistoryDrawer**

```tsx
// frontend/src/components/backtest/RunHistoryDrawer.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';

const API = (import.meta as any).env?.VITE_API_URL || '/api';
export const OVERLAY_COLORS = ['#a855f7', '#f59e0b', '#10b981'];

interface RunSummary {
  id: number; created_at: string; options: any;
  summary: { totalReturn: number; totalTrades: number; winRate: number; maxDrawdown: number; finalBalance: number };
}

interface Props {
  open: boolean;
  strategyId: number | null;
  reloadKey: number;            // инкремент → перезагрузка списка
  onClose: () => void;
  overlayRunIds: number[];
  onToggleOverlay: (runId: number, full: { id: number; label: string; result: any } | null) => void;
  onCompare: (full: { id: number; options: any; result: any } | null) => void;
}

const optChips = (o: any) => [
  o?.tp != null ? `TP${(o.tp * 100).toFixed(0)}` : null,
  o?.sl != null ? `SL${(o.sl * 100).toFixed(0)}` : null,
  o?.accurate ? '⚡acc' : null,
].filter(Boolean).join(' · ');

const RunHistoryDrawer = ({ open, strategyId, reloadKey, onClose, overlayRunIds, onToggleOverlay, onCompare }: Props) => {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [compareId, setCompareId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !strategyId) return;
    axios.get(`${API}/backtest/runs`, { params: { strategyId } })
      .then((res) => setRuns(res.data || []))
      .catch(() => setRuns([]));
  }, [open, strategyId, reloadKey]);

  if (!open) return null;

  const toggleOverlay = async (run: RunSummary) => {
    if (overlayRunIds.includes(run.id)) {
      onToggleOverlay(run.id, null);
      return;
    }
    if (overlayRunIds.length >= 3) return;
    const res = await axios.get(`${API}/backtest/runs/${run.id}`);
    const label = `#${run.id} ${optChips(run.options) || new Date(run.created_at).toLocaleDateString()}`;
    onToggleOverlay(run.id, { id: run.id, label, result: res.data.result });
  };

  const toggleCompare = async (run: RunSummary) => {
    if (compareId === run.id) {
      setCompareId(null);
      onCompare(null);
      return;
    }
    const res = await axios.get(`${API}/backtest/runs/${run.id}`);
    setCompareId(run.id);
    onCompare({ id: run.id, options: res.data.options, result: res.data.result });
  };

  const del = async (id: number) => {
    if (!confirm(`Удалить прогон #${id}? Это действие необратимо.`)) return;
    await axios.delete(`${API}/backtest/runs/${id}`);
    setRuns((rs) => rs.filter((r) => r.id !== id));
    if (overlayRunIds.includes(id)) onToggleOverlay(id, null);
    if (compareId === id) { setCompareId(null); onCompare(null); }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 330, zIndex: 60,
      background: 'var(--bg-secondary)', borderLeft: '2px solid #2962ff',
      padding: '14px', overflowY: 'auto', boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>🕘 История прогонов</span>
        <span onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }}>✕</span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 8 }}>
        ☑ — наложить кривую на график (до 3) · ⇄ — сравнить метрики
      </div>
      {runs.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Прогонов пока нет</div>}
      {runs.map((run) => {
        const overlayIdx = overlayRunIds.indexOf(run.id);
        return (
          <div key={run.id} style={{
            border: `1px solid ${overlayIdx >= 0 ? OVERLAY_COLORS[overlayIdx] : compareId === run.id ? '#2962ff' : 'var(--border-color)'}`,
            borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 10,
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={overlayIdx >= 0} onChange={() => toggleOverlay(run)} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'monospace' }}>#{run.id}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{new Date(run.created_at).toLocaleString('ru')}</span>
              <span onClick={() => del(run.id)} style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--danger)' }}>🗑</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, fontFamily: 'monospace' }}>
              <span style={{ color: run.summary.totalReturn >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                {run.summary.totalReturn >= 0 ? '+' : ''}{Number(run.summary.totalReturn).toFixed(2)}%
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{run.summary.totalTrades} сделок · WR {Number(run.summary.winRate).toFixed(1)} · DD {Number(run.summary.maxDrawdown).toFixed(1)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{optChips(run.options)}</span>
              <span onClick={() => toggleCompare(run)} style={{
                marginLeft: 'auto', cursor: 'pointer', fontSize: 9, padding: '1px 8px', borderRadius: 5,
                border: `1px solid ${compareId === run.id ? '#2962ff' : 'var(--border-color)'}`,
                color: compareId === run.id ? '#79c0ff' : 'var(--text-secondary)',
              }}>⇄ {compareId === run.id ? 'сравнивается' : 'сравнить'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RunHistoryDrawer;
```

- [ ] **Step 3: Сборка + commit**

Run: `cd frontend && npm run build`
Expected: успешный build.

```bash
git add frontend/src/components/backtest/TradesTable.tsx frontend/src/components/backtest/RunHistoryDrawer.tsx
git commit -m "feat(backtest-ui): dense trades table and run history drawer"
```

---

### Task 7: Frontend — RunPanel (панель запуска с чипами и поповером параметров)

**Files:**
- Create: `frontend/src/components/backtest/RunPanel.tsx`

**Interfaces:**
- Consumes: ничего нового.
- Produces: `<RunPanel />` с контрактом:

```typescript
interface RunPanelProps {
  strategies: Array<{ id: number; name: string; pair: string; timeframe: string }>;
  selectedStrategyId: string;
  onSelectStrategy: (id: string) => void;
  form: any;                      // тот же объект form, что в текущем Backtest.tsx (tpPercent, slPercent, positionSizePercent, startDate, endDate, initialBalance, broker, slippagePct, latencyMs, feePct, accurate, executionAlgo)
  setForm: (updater: (f: any) => any) => void;
  running: boolean;
  progress: number;               // 0-100
  statusText: string;             // текст текущей фазы
  onRun: () => void;
  onOpenHistory: () => void;
}
```

Точные имена полей `form` взять из текущего `frontend/src/pages/Backtest.tsx` (строки ~195-210: `tpPercent, slPercent, positionSizePercent, slippagePct, accurate, ...`) — НЕ переименовывать, чтобы Task 9 переиспользовал существующий state без маппинга.

- [ ] **Step 1: Реализация**

```tsx
// frontend/src/components/backtest/RunPanel.tsx
import { CSSProperties, useState } from 'react';

const chip: CSSProperties = {
  fontSize: 10, padding: '2px 9px', borderRadius: 6, border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap', cursor: 'pointer',
};
const inputS: CSSProperties = {
  width: '100%', padding: '5px 8px', fontSize: 11, background: 'var(--bg-primary)',
  color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6,
};
const lbl: CSSProperties = { fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 };

interface RunPanelProps {
  strategies: Array<{ id: number; name: string; pair: string; timeframe: string }>;
  selectedStrategyId: string;
  onSelectStrategy: (id: string) => void;
  form: any;
  setForm: (updater: (f: any) => any) => void;
  running: boolean;
  progress: number;
  statusText: string;
  onRun: () => void;
  onOpenHistory: () => void;
}

const RunPanel = (p: RunPanelProps) => {
  const [paramsOpen, setParamsOpen] = useState(false);
  const s = p.strategies.find((x) => String(x.id) === p.selectedStrategyId);
  const set = (k: string, v: any) => p.setForm((f: any) => ({ ...f, [k]: v }));
  const F = ({ k, label, type = 'number', step }: { k: string; label: string; type?: string; step?: string }) => (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={lbl}>{label}</div>
      <input style={inputS} type={type} step={step} value={p.form[k] ?? ''} onChange={(e) => set(k, type === 'number' ? Number(e.target.value) : e.target.value)} />
    </div>
  );

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 10, padding: '8px 12px',
      }}>
        <select value={p.selectedStrategyId} onChange={(e) => p.onSelectStrategy(e.target.value)}
          style={{ ...inputS, width: 260, fontWeight: 700 }}>
          {p.strategies.map((st) => <option key={st.id} value={st.id}>{st.name} ({st.pair})</option>)}
        </select>
        {s && <span style={chip} onClick={() => setParamsOpen(true)}>{s.pair}</span>}
        {s && <span style={chip} onClick={() => setParamsOpen(true)}>{s.timeframe}</span>}
        <span style={chip} onClick={() => setParamsOpen(true)}>{p.form.startDate} → {p.form.endDate}</span>
        <span style={chip} onClick={() => setParamsOpen(true)}>${p.form.initialBalance} · TP {p.form.tpPercent}% · SL {p.form.slPercent}%</span>
        {p.form.accurate && <span style={{ ...chip, borderColor: '#2962ff', color: '#79c0ff' }}>⚡ accurate</span>}
        <span style={{ ...chip, borderColor: '#2962ff', color: '#79c0ff' }} onClick={() => setParamsOpen(!paramsOpen)}>⚙ Параметры</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={chip} onClick={p.onOpenHistory}>🕘 История</span>
          {p.running ? (
            <div style={{ width: 200 }}>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden' }}>{p.statusText || 'Выполняется...'}</div>
              <div style={{ background: 'var(--bg-primary)', borderRadius: 4, height: 8 }}>
                <div style={{ width: `${p.progress}%`, height: '100%', background: '#2962ff', borderRadius: 4, transition: 'width .3s' }} />
              </div>
            </div>
          ) : (
            <button onClick={p.onRun} style={{
              background: '#2962ff', color: '#fff', fontWeight: 800, fontSize: 12,
              border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
            }}>▶ Запустить</button>
          )}
        </div>
      </div>

      {paramsOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 55, marginTop: 4,
          background: 'var(--bg-secondary)', border: '1px solid #2962ff', borderRadius: 10,
          padding: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
        }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <F k="startDate" label="Начало" type="date" />
            <F k="endDate" label="Конец" type="date" />
            <F k="initialBalance" label="Баланс ($)" />
            <F k="tpPercent" label="Take Profit (%)" step="0.1" />
            <F k="slPercent" label="Stop Loss (%)" step="0.1" />
            <F k="positionSizePercent" label="Размер позиции (%)" />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <F k="slippagePct" label="Slippage (%)" step="0.01" />
            <F k="latencyMs" label="Latency (ms)" />
            <F k="feePct" label="Комиссия (%)" step="0.01" />
            <div style={{ flex: 1, minWidth: 110 }}>
              <div style={lbl}>Алгоритм входа</div>
              <select style={inputS} value={p.form.executionAlgo || 'MARKET'} onChange={(e) => set('executionAlgo', e.target.value)}>
                <option value="MARKET">Market</option><option value="TWAP">TWAP</option><option value="VWAP">VWAP</option>
              </select>
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--text-primary)', paddingBottom: 6 }}>
              <input type="checkbox" checked={!!p.form.accurate} onChange={(e) => set('accurate', e.target.checked)} />
              ⚡ Точный режим (1m суб-свечи) — медленнее, честнее ловит SL
            </label>
            <button onClick={() => setParamsOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 11 }}>Свернуть</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunPanel;
```

Примечание для имплементера: если в текущем `form` поля называются иначе (например `startDate` хранится как `start`), привести ИМЕНА В ЭТОМ КОМПОНЕНТЕ к фактическим из `pages/Backtest.tsx` — контракт «RunPanel использует те же ключи, что существующий form-state» важнее буквального совпадения с кодом выше. Брокер-пресеты (`binance/bybit/okx/ib/custom` из строк ~162-166) добавить select-ом, который проставляет `feePct`/`slippagePct`/`latencyMs` из пресета.

- [ ] **Step 2: Сборка + commit**

Run: `cd frontend && npm run build`

```bash
git add frontend/src/components/backtest/RunPanel.tsx
git commit -m "feat(backtest-ui): sticky run panel with param chips and popover form"
```

---

### Task 8: Frontend — извлечь PriceChartTab и OptimizationTab из текущей страницы

**Files:**
- Create: `frontend/src/components/backtest/PriceChartTab.tsx`
- Create: `frontend/src/components/backtest/OptimizationTab.tsx`
- Modify: `frontend/src/pages/Backtest.tsx` (только замена инлайн-блоков на компоненты — страница ещё старая, редизайн в Task 9)

**Interfaces:**
- Produces: `<PriceChartTab ... />`, `<OptimizationTab ... />` — пропсы определяются извлечением (см. шаги). Task 9 подключит их в новую страницу с теми же пропсами.

Это чисто механический рефакторинг БЕЗ изменения поведения. Порядок:

- [ ] **Step 1: Найти границы блоков**

В текущем `pages/Backtest.tsx`:
- Вкладка «График цены»: JSX-блок, рендерящийся при `activeTab === 'price'` (искать по строке `'ГРАФИК ЦЕНЫ'` / `activeTab`), включая использование `MarketChart` и `selectedTrade` (строки ~640-830).
- Вкладка «Оптимизация»: JSX при `activeTab === 'optimization'` + функции `extractParams` (строки ~300-330), state `optimizableParams`, `selectedParams`, запрос оптимизации (строки ~420-460).

- [ ] **Step 2: Извлечь PriceChartTab**

Создать `PriceChartTab.tsx`, перенести JSX блока «График цены» и ТОЛЬКО те локальные функции/константы, которые он использует. Все внешние значения (result, trades, selectedTrade, setSelectedTrade, pair, timeframe и т.д.) — пропсами с теми же именами. Импорты (`MarketChart` и пр.) перенести.

- [ ] **Step 3: Извлечь OptimizationTab**

Аналогично: JSX «Оптимизации» + `extractParams` + связанные обработчики внутрь компонента; входные данные (ast стратегии, strategyId, колбэк applyBest/onOptimized — по факту использования) — пропсами.

- [ ] **Step 4: Подключить в старую страницу**

В `pages/Backtest.tsx` заменить извлечённые блоки на `<PriceChartTab {...props} />` / `<OptimizationTab {...props} />`. Поведение страницы не должно измениться.

- [ ] **Step 5: Проверка и commit**

Run: `cd frontend && npm run build`
Expected: успешный build; страница визуально не изменилась (проверить в превью, если доступен стек: вкладки переключаются).

```bash
git add frontend/src/components/backtest/PriceChartTab.tsx frontend/src/components/backtest/OptimizationTab.tsx frontend/src/pages/Backtest.tsx
git commit -m "refactor(backtest-ui): extract price chart and optimization tabs unchanged"
```

---

### Task 9: Frontend — новая страница Backtest.tsx (оркестрация)

**Files:**
- Rewrite: `frontend/src/pages/Backtest.tsx`

**Interfaces:**
- Consumes: ВСЕ компоненты Tasks 4-8 с их контрактами; `GET /backtest/runs*` (Task 2); result c `equityCurve`/`benchmark` (Task 1).

Структура новой страницы (полный шаблон — имплементер сохраняет существующие механизмы там, где помечено «из старой страницы»):

- [ ] **Step 1: Переписать страницу**

```tsx
// frontend/src/pages/Backtest.tsx — НОВАЯ структура
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import RunPanel from '../components/backtest/RunPanel';
import KpiStrip from '../components/backtest/KpiStrip';
import EquityChart from '../components/backtest/EquityChart';
import DistributionsRow from '../components/backtest/DistributionsRow';
import TradesTable from '../components/backtest/TradesTable';
import RunHistoryDrawer, { OVERLAY_COLORS } from '../components/backtest/RunHistoryDrawer';
import PriceChartTab from '../components/backtest/PriceChartTab';
import OptimizationTab from '../components/backtest/OptimizationTab';

const API = (import.meta as any).env?.VITE_API_URL || '/api';

const Backtest = () => {
  // ── state: стратегии + form — ПЕРЕНЕСТИ из старой страницы (имена полей не менять) ──
  // ── state: run-flow ──
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  // ── state: отчёт ──
  const [chartTab, setChartTab] = useState<'equity' | 'price' | 'optimization'>('equity');
  const [activeTradeIdx, setActiveTradeIdx] = useState<number | null>(null);
  // ── state: история/сравнение ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyReload, setHistoryReload] = useState(0);
  const [overlays, setOverlays] = useState<Array<{ id: number; label: string; result: any }>>([]);
  const [compareRun, setCompareRun] = useState<{ id: number; options: any; result: any } | null>(null);

  // fetch стратегий — перенести из старой страницы как есть

  const runBacktest = async () => {
    // перенести из старой страницы: POST `${API}/backtest/${selectedStrategyId}` c телом из form
    // (конвертации tpPercent/100 и т.д. сохранить), затем существующий механизм прогресса
    // (poll GET /backtest/job/:jobId каждые 2с и/или WS-подписка — как было),
    // по completed: setResult(job.result); setRunning(false); setHistoryReload(k => k+1);
  };

  const onTradeSelect = (idx: number) => {
    setActiveTradeIdx(idx);
    setChartTab('price'); // существующее поведение: клик по сделке → разбор на графике цены
  };

  const overlaySeries = useMemo(() => overlays.map((o, i) => ({
    label: o.label, color: OVERLAY_COLORS[i], points: o.result.equityCurve || [],
  })), [overlays]);

  // Отличия опций активного прогона (из form) от сравниваемого (из run.options)
  const compareOptionsDiff = useMemo(() => {
    if (!compareRun) return '';
    const o = (compareRun as any).options || {};
    const diffs: string[] = [];
    const activeTp = Number(form.tpPercent);          // form — тот же state, что уходит в POST
    const activeSl = Number(form.slPercent);
    if (o.tp != null && Math.abs(o.tp * 100 - activeTp) > 1e-9) diffs.push(`TP ${activeTp}%→${(o.tp * 100).toFixed(1)}%`);
    if (o.sl != null && Math.abs(o.sl * 100 - activeSl) > 1e-9) diffs.push(`SL ${activeSl}%→${(o.sl * 100).toFixed(1)}%`);
    if (!!o.accurate !== !!form.accurate) diffs.push(`accurate ${form.accurate ? 'on' : 'off'}→${o.accurate ? 'on' : 'off'}`);
    return diffs.join(' · ');
  }, [compareRun, form]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1400, margin: '0 auto' }}>
      <RunPanel /* strategies, selectedStrategyId, onSelectStrategy, form, setForm, running, progress, statusText, onRun: runBacktest, onOpenHistory: () => setHistoryOpen(true) */ />

      {result && (
        <>
          <KpiStrip result={result} compareResult={compareRun?.result || null} />
          {compareRun && (
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              ⇄ сравнение с прогоном #{compareRun.id} {compareOptionsDiff && `· отличия: ${compareOptionsDiff}`}
              <span style={{ color: '#79c0ff', cursor: 'pointer', marginLeft: 8 }} onClick={() => setCompareRun(null)}>снять</span>
            </div>
          )}

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11, fontWeight: 700 }}>
              {([['equity', 'Equity / Drawdown'], ['price', 'График цены'], ['optimization', 'Оптимизация']] as const).map(([k, l]) => (
                <span key={k} onClick={() => setChartTab(k)} style={{
                  cursor: 'pointer', paddingBottom: 3,
                  color: chartTab === k ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: chartTab === k ? '2px solid #2962ff' : '2px solid transparent',
                }}>{l}</span>
              ))}
            </div>
            {chartTab === 'equity' && (
              <EquityChart equityCurve={result.equityCurve || []} benchmark={result.benchmark}
                overlays={overlaySeries} trades={result.trades} onTradeDotClick={onTradeSelect} activeTradeIdx={activeTradeIdx} />
            )}
            {chartTab === 'price' && <PriceChartTab /* пропсы из Task 8 */ />}
            {chartTab === 'optimization' && <OptimizationTab /* пропсы из Task 8 */ />}
          </div>

          <DistributionsRow trades={result.trades || []} />
          <TradesTable trades={result.trades || []} activeIdx={activeTradeIdx} onRowClick={onTradeSelect} />
        </>
      )}

      {!result && !running && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 60, fontSize: 13 }}>
          Выбери стратегию и нажми «▶ Запустить» — здесь появится полный отчёт
        </div>
      )}

      <RunHistoryDrawer open={historyOpen} strategyId={/* selectedStrategyId as number */ null} reloadKey={historyReload}
        onClose={() => setHistoryOpen(false)}
        overlayRunIds={overlays.map((o) => o.id)}
        onToggleOverlay={(id, full) => setOverlays((os) => full ? [...os, full] : os.filter((o) => o.id !== id))}
        onCompare={setCompareRun} />
    </div>
  );
};

export default Backtest;
```

Комментарии `/* ... */` в шаблоне — места, где имплементер подставляет РЕАЛЬНЫЕ куски из старой страницы (git история: `git show HEAD~1:frontend/src/pages/Backtest.tsx`): fetch стратегий, form-state с дефолтами, тело runBacktest (POST + конвертации + прогресс-механизм), пропсы PriceChartTab/OptimizationTab из Task 8, `compareOptionsDiff`. Ничего из перечисленного не изобретать заново — переносить.

- [ ] **Step 2: Сборка**

Run: `cd frontend && npm run build`
Expected: успешный build.

- [ ] **Step 3: Живая проверка**

Поднять локальный стек (docker start signal-bot-postgres-1 signal-bot-redis-1; backend: `DB_HOST=localhost DB_PORT=5432 DB_USER=user DB_PASS=password DB_NAME=signals_db REDIS_HOST=localhost REDIS_PORT=6450 node dist/main.js`) ИЛИ проверить после деплоя. Чек-лист:
1. Страница открывается, RunPanel с чипами, пустое состояние с подсказкой.
2. Запуск бэктеста → прогресс в панели → отчёт появляется целиком (KPI, equity+DD, распределения, таблица).
3. Клик точки на equity → вкладка «График цены» с разбором сделки; клик строки таблицы — то же.
4. «🕘 История» → список прогонов; чекбокс → кривая накладывается цветом; ⇄ → KPI в режиме пар.
5. Вкладка «Оптимизация» работает как раньше.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Backtest.tsx
git commit -m "feat(backtest-ui): dashboard-report page with history overlay and compare"
```

---

### Task 10: Финальная верификация

- [ ] **Step 1:** `cd backend && npx jest && npx tsc --noEmit -p tsconfig.json` — все сьюты PASS.
- [ ] **Step 2:** `cd frontend && npx jest && npm run build` — тесты PASS, build чистый.
- [ ] **Step 3:** Смоук по чек-листу Task 9 Step 3 (локально или на проде после деплоя: `git pull && docker compose build backend frontend backtest-worker && docker compose up -d backend frontend backtest-worker`). Дополнительно: `SELECT count(*) FROM backtest_runs` растёт после прогона; `GET /backtest/runs?strategyId=32` отдаёт сводки без trades.
- [ ] **Step 4:** Фиксы по результатам — отдельным коммитом `fix(backtest-ui): post-verification fixes`.
