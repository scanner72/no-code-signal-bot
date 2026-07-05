# Risk Sizing + Signals Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add risk-based position sizing (a `risk_sizing` node backed by a shared `RiskSizingService`) wired identically into live and backtest engines, plus polish signal delivery (real TP/SL in alerts, per-strategy routing, explicit alert-only mode).

**Architecture:** Sizing math is ported from the existing Python `PositionSizingHandler` into a pure TS `RiskSizingService.computeNotional(method, ctx)`, consumed by both `SignalsEngineService` (live) and `BacktestService` so the two never diverge. Signal polish reads the real `sltp` node for TP/SL and reuses the existing `sendSignalOverride` for routing. Defaults preserve current behavior when no `risk_sizing` node is present.

**Tech Stack:** NestJS + TypeORM + Jest (backend); React 18 + Vite + ReactFlow (frontend); Telegram/Discord services.

## Global Constraints

- Strict TypeScript; avoid `any` in new code (follow existing file patterns).
- **Engine parity mandatory:** sizing in `signals-engine.service.ts` and `backtest.service.ts` MUST call the SAME `RiskSizingService.computeNotional` with equivalent context.
- **Backward compatibility:** with no `risk_sizing` node, sizing and results must match today's behavior (live: `fixed_notional`=`positionSize||100`; backtest: `equity_percent` with existing `positionSize` fraction).
- Candles in engine `case`/exit blocks are **newest-first** (`candles[0]` = current).
- `computeNotional` never throws; incomplete context falls back to `equity_percent` (0.1).
- Frontend user-facing strings bilingual (RU/EN) via `useLanguageStore`.
- `npm run build` (frontend) + `npx tsc --noEmit` + `npm test` (backend) must be clean before finishing.

---

### Task 1: `RiskSizingService.computeNotional`

**Files:**
- Create: `backend/src/risk/risk-sizing.service.ts`
- Create: `backend/src/risk/risk.module.ts`
- Test: `backend/src/risk/risk-sizing.service.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export type SizingMethod = 'fixed_notional'|'equity_percent'|'risk_percent'|'atr_based'|'kelly';
export interface SizingCtx {
  equity: number; entryPrice: number;
  stopPct?: number; atr?: number;
  riskPercent?: number; atrMultiplier?: number; equityPct?: number;
  fixedNotional?: number; maxKelly?: number;
  stats?: { winRate: number; avgWin: number; avgLoss: number };
}
computeNotional(method: SizingMethod, ctx: SizingCtx): number  // USD notional, >= 0
```

- [ ] **Step 1: Write the failing test**

```ts
import { RiskSizingService } from './risk-sizing.service';

describe('RiskSizingService.computeNotional', () => {
  const svc = new RiskSizingService();

  it('fixed_notional returns the configured notional', () => {
    expect(svc.computeNotional('fixed_notional', { equity: 5000, entryPrice: 100, fixedNotional: 250 })).toBe(250);
  });
  it('equity_percent returns equity * pct', () => {
    expect(svc.computeNotional('equity_percent', { equity: 5000, entryPrice: 100, equityPct: 0.2 })).toBe(1000);
  });
  it('risk_percent = equity*R% / stopPct', () => {
    // risk 1% of 10000 = 100; stop 2% => notional 5000
    expect(svc.computeNotional('risk_percent', { equity: 10000, entryPrice: 100, riskPercent: 1, stopPct: 0.02 })).toBeCloseTo(5000, 6);
  });
  it('atr_based derives stopPct from atr then risk-sizes', () => {
    // atr 2, mult 2 => stopDist 4 on price 100 => stopPct 0.04; risk 2% of 10000=200 => 5000
    expect(svc.computeNotional('atr_based', { equity: 10000, entryPrice: 100, atr: 2, atrMultiplier: 2, riskPercent: 2 })).toBeCloseTo(5000, 6);
  });
  it('kelly clamps fraction and multiplies equity', () => {
    // winRate .55, avgWin 2, avgLoss 1 => payoff 2, f=(2*.55-.45)/2=0.325 -> clamp .25 => 2500
    expect(svc.computeNotional('kelly', { equity: 10000, entryPrice: 100, stats: { winRate: 0.55, avgWin: 2, avgLoss: 1 }, maxKelly: 0.25 })).toBeCloseTo(2500, 6);
  });
  it('falls back to equity_percent(0.1) when risk_percent lacks stopPct', () => {
    expect(svc.computeNotional('risk_percent', { equity: 4000, entryPrice: 100 })).toBeCloseTo(400, 6);
  });
  it('never returns negative', () => {
    expect(svc.computeNotional('kelly', { equity: 10000, entryPrice: 100, stats: { winRate: 0.1, avgWin: 1, avgLoss: 5 } })).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest risk-sizing.service.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service + module**

```ts
// risk-sizing.service.ts
import { Injectable } from '@nestjs/common';

export type SizingMethod = 'fixed_notional'|'equity_percent'|'risk_percent'|'atr_based'|'kelly';
export interface SizingCtx {
  equity: number; entryPrice: number;
  stopPct?: number; atr?: number;
  riskPercent?: number; atrMultiplier?: number; equityPct?: number;
  fixedNotional?: number; maxKelly?: number;
  stats?: { winRate: number; avgWin: number; avgLoss: number };
}

@Injectable()
export class RiskSizingService {
  computeNotional(method: SizingMethod, ctx: SizingCtx): number {
    const equity = ctx.equity > 0 ? ctx.equity : 0;
    const fallback = () => equity * (ctx.equityPct ?? 0.1);
    let notional: number;
    switch (method) {
      case 'fixed_notional':
        notional = ctx.fixedNotional ?? 100; break;
      case 'equity_percent':
        notional = equity * (ctx.equityPct ?? 0.1); break;
      case 'risk_percent': {
        if (!ctx.stopPct || ctx.stopPct <= 0) { notional = fallback(); break; }
        notional = (equity * ((ctx.riskPercent ?? 1) / 100)) / ctx.stopPct; break;
      }
      case 'atr_based': {
        const stopPct = ctx.atr && ctx.entryPrice ? (ctx.atr * (ctx.atrMultiplier ?? 2)) / ctx.entryPrice : 0;
        if (stopPct <= 0) { notional = fallback(); break; }
        notional = (equity * ((ctx.riskPercent ?? 2) / 100)) / stopPct; break;
      }
      case 'kelly': {
        const s = ctx.stats;
        if (!s || s.avgLoss <= 0) { notional = fallback(); break; }
        const payoff = s.avgWin / s.avgLoss;
        let f = (payoff * s.winRate - (1 - s.winRate)) / payoff;
        f = Math.max(0.01, Math.min(f, ctx.maxKelly ?? 0.25));
        notional = equity * f; break;
      }
      default:
        notional = fallback();
    }
    return Math.max(0, notional);
  }
}
```

```ts
// risk.module.ts
import { Module } from '@nestjs/common';
import { RiskSizingService } from './risk-sizing.service';
@Module({ providers: [RiskSizingService], exports: [RiskSizingService] })
export class RiskModule {}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest risk-sizing.service.spec`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add backend/src/risk/
git commit -m "feat(risk): RiskSizingService.computeNotional ported from Python handler"
```

---

### Task 2: Backtest uses `RiskSizingService` (parity anchor)

**Files:**
- Modify: `backend/src/backtest/backtest.service.ts` (constructor DI + entry sizing at `:240`)
- Modify: `backend/src/backtest/worker.module.ts` (register `RiskSizingService` — hand-listed providers, does NOT import modules)
- Test: `backend/src/backtest/backtest.service.spec.ts`

**Interfaces:**
- Consumes: `RiskSizingService.computeNotional` (Task 1).
- Produces: when the strategy has a `sizing` node, entry `notional` comes from `computeNotional`; otherwise unchanged `balance * positionSize`.

- [ ] **Step 1: Write the failing test**

```ts
it('sizes entry via RiskSizingService when a sizing node is present', async () => {
  // strategy AST with a trade_action/sizing node: equity_percent 0.25
  const strat = makeStrategyWith({ type: 'sizing', method: 'equity_percent', equityPct: 0.25 });
  const candles = makeCandlesThatTriggerOneEntry();
  const res = await service.runBacktest(strat, candles, { ...baseOpts, initialBalance: 1000 });
  const firstTrade = res.trades[0];
  // notional at entry = 1000 * 0.25 = 250; amount = 250/entryPrice
  expect(firstTrade.amount).toBeCloseTo(250 / firstTrade.entryPrice, 6);
});
```

> Match the real `runBacktest` signature, the trade object's amount/entryPrice field names, and the strategy-builder helper used by existing tests in this spec.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest backtest.service.spec -t "sizes entry via RiskSizingService"`
Expected: FAIL — sizing still `balance * positionSize`.

- [ ] **Step 3: Inject service + apply at entry**

Add to constructor: `private readonly riskSizing: RiskSizingService`. Locate the sizing node once before the loop: `const sizingNode = findAstNode(strategy.ast, 'trade_action', 'sizing');` and the sltp for stopPct. At the entry point (`:240`):

```ts
let notional = balance * positionSize; // legacy default
if (sizingNode) {
  const stopPct = sltpNode?.sl ? parsePct(sltpNode.sl) : undefined;
  notional = this.riskSizing.computeNotional(sizingNode.method, {
    equity: balance, entryPrice: currentPrice, stopPct,
    atr: sizingNode.method === 'atr_based' ? this.indicatorsService.calculateATR(/* highs,lows,closes up to entry */)?.slice(-1)[0] : undefined,
    riskPercent: sizingNode.riskPercent, atrMultiplier: sizingNode.atrMultiplier,
    equityPct: sizingNode.equityPct, fixedNotional: sizingNode.fixedNotional, maxKelly: sizingNode.maxKelly,
  });
}
```

Register in `worker.module.ts` providers array: `RiskSizingService` (import it). (This mirrors the BT-2 trap: worker.module hand-lists providers.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest backtest.service.spec && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backtest/backtest.service.ts backend/src/backtest/worker.module.ts backend/src/backtest/backtest.service.spec.ts
git commit -m "feat(backtest): risk_sizing node drives entry notional"
```

---

### Task 3: Live engine uses `RiskSizingService` (parity)

**Files:**
- Modify: `backend/src/signals/signals-engine.service.ts` (`placeSltpOco:529` + market-order amount `:494`)
- Modify: `backend/src/signals/signals.module.ts` (import `RiskModule`)
- Test: `backend/src/signals/signals-engine.service.spec.ts`

**Interfaces:**
- Consumes: `RiskSizingService.computeNotional` (Task 1).
- Produces: live `amount` = `computeNotional(...) / entryPrice` when a `sizing` node exists; equity from `execSettings.accountEquity ?? execSettings.positionSize ?? 1000`.

- [ ] **Step 1: Write the failing test**

```ts
it('live order amount uses RiskSizingService when a sizing node exists', async () => {
  (riskSizing.computeNotional as jest.Mock) = jest.fn().mockReturnValue(750);
  jest.spyOn(ccxtQueueService, 'enqueueOrder').mockResolvedValue('j1' as any);
  jest.spyOn(ocoManagerService, 'createOcoBracket').mockResolvedValue(undefined as any);
  const strat = strategyWith({ sizing: { type:'sizing', method:'equity_percent', equityPct:0.15 }, sltp:{ tp:'0.02', sl:'0.01' }, exec:{ enableLiveExecution:true, accountEquity:5000 } });
  await (service as any).placeSltpOco(strat, 'BTCUSDT', 150, 'LONG');
  const tpCall = (ccxtQueueService.enqueueOrder as jest.Mock).mock.calls[0][0];
  expect(tpCall.amount).toBeCloseTo(750 / 150, 6);
});
```

> Mirror the existing `placeSltpOco` test harness (execSettings/creds/candles). Add `riskSizing` to the module's providers/mocks in the spec's `TestingModule`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest signals-engine.service.spec -t "uses RiskSizingService"`
Expected: FAIL — amount still `positionSize/entry`.

- [ ] **Step 3: Inject + apply**

Constructor: `private readonly riskSizing: RiskSizingService`. In `signals.module.ts` add `RiskModule` to `imports`. In `placeSltpOco` (and the sibling market-order path `:494`), replace the amount computation:

```ts
const sizingNode = findAstNode(strategy.ast, 'trade_action', 'sizing');
const equity = execSettings.accountEquity ?? execSettings.positionSize ?? 1000;
let notional = execSettings.positionSize || 100; // legacy default
if (sizingNode) {
  const stopPct = sltpNode?.sl ? parsePct(sltpNode.sl) : undefined;
  notional = this.riskSizing.computeNotional(sizingNode.method, {
    equity, entryPrice,
    stopPct,
    atr: sizingNode.method === 'atr_based' ? this.lastAtr(candles, sizingNode.atrPeriod) : undefined,
    riskPercent: sizingNode.riskPercent, atrMultiplier: sizingNode.atrMultiplier,
    equityPct: sizingNode.equityPct, fixedNotional: sizingNode.fixedNotional, maxKelly: sizingNode.maxKelly,
  });
}
const amount = notional / entryPrice;
```

Add a small private `lastAtr(candles, period=14)` helper that reverses to ASC and returns the last `calculateATR` value. Thread `candles` into `placeSltpOco` from the call site if not present (same as the Fib-TP plan).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest signals-engine.service.spec && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/signals/signals-engine.service.ts backend/src/signals/signals.module.ts backend/src/signals/signals-engine.service.spec.ts
git commit -m "feat(live): risk_sizing node drives live order amount (parity with backtest)"
```

---

### Task 4: Frontend — register `risk_sizing` node + params

**Files:**
- Modify: `frontend/src/blocks/registry.ts`
- Modify: `frontend/src/components/nodes/NodeInlineParams.tsx`
- Modify: `frontend/src/components/PropertiesPanel.tsx`

**Interfaces:**
- Produces: draggable "Risk Sizing" node, `defaultData = { type:'sizing', method:'fixed_notional', riskPercent:1, atrMultiplier:2, atrPeriod:14, equityPct:0.1, fixedNotional:100, maxKelly:0.25 }`.

- [ ] **Step 1: Register the block**

In `registry.ts`, in the Trade Action group:

```ts
risk_sizing: { type: 'trade_action', id: 'risk_sizing', name: 'Risk Sizing', category: 'Trade Action', dotColor: '#ef4444', defaultData: { type: 'sizing', method: 'fixed_notional', riskPercent: 1, atrMultiplier: 2, atrPeriod: 14, equityPct: 0.1, fixedNotional: 100, maxKelly: 0.25 } },
```

- [ ] **Step 2: Add param controls**

In `NodeInlineParams.tsx` and `PropertiesPanel.tsx`, add a `data.type === 'sizing'` branch: a `method` select (`fixed_notional`/`equity_percent`/`risk_percent`/`atr_based`/`kelly`) and conditionally-shown fields per method (`fixedNotional`; `equityPct`; `riskPercent`; `riskPercent`+`atrMultiplier`+`atrPeriod`; `maxKelly`). Follow the existing `sltp` branch's control styling and the shared param-update handler.

- [ ] **Step 3: Build to verify it compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke** — drag "Risk Sizing" node, switch method, confirm fields toggle and persist (verify via preview tools).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/blocks/registry.ts frontend/src/components/nodes/NodeInlineParams.tsx frontend/src/components/PropertiesPanel.tsx
git commit -m "feat(ui): register Risk Sizing node with per-method params"
```

---

### Task 5: Real TP/SL in signal alerts

**Files:**
- Modify: `backend/src/signals/signals-engine.service.ts` (compute tp/sl into `signal.metadata` before `:436`)
- Modify: `backend/src/telegram/telegram.service.ts` (`sendSignal` reads metadata)
- Modify: `backend/src/telegram/discord.service.ts` (same)
- Test: `backend/src/telegram/telegram.service.spec.ts`

**Interfaces:**
- Consumes: `sltp` node tp/sl (percent or fib).
- Produces: `signal.metadata.tp`/`.sl` (numbers) used by both notifiers; fallback to `2%/1%` when absent.

- [ ] **Step 1: Write the failing test**

```ts
it('sendSignal uses metadata.tp/sl when provided', async () => {
  const svc = makeTelegramService(); // with a mock bot capturing messages
  const captured: string[] = [];
  (svc as any).bot = { sendMessage: (_c: any, m: string) => { captured.push(m); return Promise.resolve(); } };
  (svc as any).chatId = '123';
  const signal = { type: 'LONG', pair: 'BTCUSDT', timeframe: '1h', price: '100', created_at: new Date().toISOString(), metadata: { tp: 108, sl: 96, strategy_name: 'X' } };
  await svc.sendSignal(signal);
  expect(captured[0]).toContain('108');
  expect(captured[0]).toContain('96');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest telegram.service.spec -t "metadata.tp/sl"`
Expected: FAIL — uses hardcoded `price*1.02`.

- [ ] **Step 3: Implement**

In `telegram.service.ts` `sendSignal`, replace lines ~60-61:

```ts
const md = signal.metadata || {};
const tp = typeof md.tp === 'number' ? md.tp : (isLong ? price * 1.02 : price * 0.98);
const sl = typeof md.sl === 'number' ? md.sl : (isLong ? price * 0.99 : price * 1.01);
```

Mirror the same read in `discord.service.ts`. In `signals-engine.service.ts`, before `sendSignal` (`:436`), compute and attach:

```ts
const sltpN = findAstNode(strategy.ast, 'trade_action', 'sltp');
if (sltpN) {
  const tpPct = parsePct(sltpN.tp), slPct = parsePct(sltpN.sl);
  const p = parseFloat(signal.price);
  const isLong = signal.type === 'LONG';
  if (tpPct) signal.metadata.tp = isLong ? p * (1 + tpPct) : p * (1 - tpPct);
  if (slPct) signal.metadata.sl = isLong ? p * (1 - slPct) : p * (1 + slPct);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest telegram.service.spec && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/telegram/telegram.service.ts backend/src/telegram/discord.service.ts backend/src/signals/signals-engine.service.ts backend/src/telegram/telegram.service.spec.ts
git commit -m "fix(signals): alerts use real strategy TP/SL instead of hardcoded 2%/1%"
```

---

### Task 6: Per-strategy routing + alert-only

**Files:**
- Modify: `backend/src/signals/signals-engine.service.ts` (routing + alertOnly gate)
- Modify: `frontend/src/components/nodes/NodeInlineParams.tsx` / `PropertiesPanel.tsx` (telegram node fields)
- Test: `backend/src/signals/signals-engine.service.spec.ts`

**Interfaces:**
- Consumes: `telegram` node new fields `chatId?`, `webhookUrl?`, `alertOnly?`.
- Produces: routed alert via `sendSignalOverride(signal, chatId)` when `chatId` set; `placeSltpOco` skipped when `alertOnly === true`.

- [ ] **Step 1: Write the failing test**

```ts
it('routes to sendSignalOverride when telegram node has chatId, and skips execution when alertOnly', async () => {
  const overrideSpy = jest.spyOn(telegramService, 'sendSignalOverride').mockResolvedValue(true as any);
  const placeSpy = jest.spyOn(service as any, 'placeSltpOco').mockResolvedValue(undefined);
  const strat = strategyWithTelegramNode({ chatId: '999', alertOnly: true });
  await (service as any).handleSignalDispatch(strat, /* signal, candles ctx per this file */);
  expect(overrideSpy).toHaveBeenCalledWith(expect.anything(), '999');
  expect(placeSpy).not.toHaveBeenCalled();
});
```

> Match the actual dispatch method name and its arguments in this file (the block around `:427-459`). If routing/execution live in one method, target that method; otherwise split the assertions to the real call sites.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest signals-engine.service.spec -t "routes to sendSignalOverride"`
Expected: FAIL — always global chat; execution not gated by alertOnly.

- [ ] **Step 3: Implement**

Around `:436`, read the telegram node once and branch:

```ts
const tgNode = findAstNode(strategy.ast, 'trade_action', 'telegram');
if (tgNode?.chatId) {
  await this.telegramService.sendSignalOverride(signal, String(tgNode.chatId));
} else {
  await this.telegramService.sendSignal(signal, candles, rsiAll.filter(v => v > 0), customMessage);
}
await this.discordService.sendSignal(signal, tgNode?.webhookUrl);
```

Before the live-execution call (`placeSltpOco`), add: `if (tgNode?.alertOnly) return;` (or wrap the execution block). Add optional `webhookUrl` param to `discord.service.ts` `sendSignal` (falls back to global when absent). Add `chatId`/`webhookUrl`/`alertOnly` inputs to the telegram node's params UI.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest signals-engine.service.spec && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/signals/signals-engine.service.ts backend/src/telegram/discord.service.ts frontend/src/components/nodes/NodeInlineParams.tsx frontend/src/components/PropertiesPanel.tsx backend/src/signals/signals-engine.service.spec.ts
git commit -m "feat(signals): per-strategy Telegram/Discord routing + alert-only mode"
```

---

### Task 7: Final verification + review

**Files:** none (verification) + any review fixes.

- [ ] **Step 1: Backend tests + typecheck**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: all green, clean.

- [ ] **Step 2: Frontend build**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 3: Parity assertion**

Confirm live (`signals-engine`) and backtest (`backtest.service`) both call `riskSizing.computeNotional` with equivalent context (equity/entryPrice/stopPct/atr). Confirm backward-compat: a strategy WITHOUT a sizing node produces identical trades to pre-change (run one existing backtest fixture, compare).

- [ ] **Step 4: End-to-end smoke**

Strategy: `input → RSI signal → sltp(tp/sl) → risk_sizing(risk_percent 1%) → telegram(chatId, alertOnly)`. Run backtest — confirm position size scales with equity and stop; confirm (config-only) that alertOnly path would skip execution.

- [ ] **Step 5: Dispatch code-reviewer** over the branch diff; fix blocking findings; commit.

- [ ] **Step 6: Deploy**

```bash
git push origin main
# prod: git pull && docker compose up -d --build backend
```

## Self-Review

**Spec coverage:** A1 service → Task 1. A2 node → Task 4. A3 live+backtest parity → Tasks 2,3. B1 real TP/SL → Task 5. B2 routing → Task 6. B3 alert-only → Task 6. Tests → embedded. Backward-compat → Tasks 2,3 defaults + Task 7 step 3. Deferred kill-switch/exposure → explicitly out of scope (not a task, correct). ✓ No gaps.

**Placeholder scan:** dispatch/method names in Tasks 2,3,5,6 intentionally say "match the sibling/real method" because exact private names/harness must be read at implementation time; all behavioral code is concrete. No TBD/TODO.

**Type consistency:** `SizingMethod`/`SizingCtx`/`computeNotional` identical across Tasks 1–3; node `defaultData` fields (`method/riskPercent/atrMultiplier/atrPeriod/equityPct/fixedNotional/maxKelly`) identical in Tasks 2,3,4; telegram fields (`chatId/webhookUrl/alertOnly`) identical in Tasks 5,6.
