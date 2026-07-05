# Risk Sizing + Signals Polish (Design Spec)

**Дата:** 2026-07-05
**Статус:** approved (design), pending implementation plan
**Автор:** Claude + x0tta6b

## 0. Резюме и мотивация

Две слабосвязанные части в одном спеке (как их сформулировал пользователь):

- **A. Risk/Sizing нода** — риск-базированный размер позиции в live-движке и
  бэктесте (сейчас live использует плоский USD-ноционал, backtest — фиксированную
  долю equity). Математика уже написана в codegen для Python-экспорта
  (`PositionSizingHandler`) — портируем в TS и подключаем к движку.
- **B. Полировка сигналов** — доставка сигналов уже ~80% готова (Telegram+Discord
  подключены к каждому live-сигналу, чарт-скриншоты, команды /status /balance
  /panic). Закрываем пробелы: реальные TP/SL в алерте (сейчас захардкожены
  `2%/1%`), per-strategy роутинг, явный alert-only режим.

### Найденное при исследовании

- Live-сайзинг: `execSettings.positionSize || 100` USD (`signals-engine.service.ts:494,552`).
- Backtest-сайзинг: `notional = balance * positionSize` (доля equity,
  `backtest.service.ts:240`); backtest уже считает `maxDrawdown` (`:608`).
- Python-математика сайзинга: `codegen/position-sizing-handler.ts` (fixed_percent,
  atr_based, kelly, equal_weight) — только для экспортируемых ботов.
- Сигналы: `TelegramService.sendSignal` (`telegram.service.ts:55`) шлёт формат с
  чарт-скриншотом, но **TP/SL захардкожены** `price*1.02`/`price*0.99` (`:60-61`).
  Есть `sendSignalOverride(signal, chatId)` (`:225`) — готовый механизм роутинга.
- Уже есть нода `telegram` (`trade_action`/`telegram`) с `telegramMessage` и
  плейсхолдерами; движок держит `strategy` в точке отправки (`:427-436`), значит
  доступен и `sltp`-нод.
- Алерты шлются **независимо** от `enableLiveExecution` → alert-only фактически
  уже работает; нужен явный флаг для ясности.

## ЧАСТЬ A — Risk/Sizing нода

### A1. Ядро — `RiskSizingService`

Новый `backend/src/risk/risk-sizing.service.ts`. Чистый метод (порт из Python):

```ts
type SizingMethod = 'fixed_notional' | 'equity_percent' | 'risk_percent' | 'atr_based' | 'kelly';
type SizingCtx = {
  equity: number;          // текущий капитал (live: accountEquity, backtest: running balance)
  entryPrice: number;
  stopPct?: number;        // дистанция SL в долях (из sltp), для risk_percent
  atr?: number;            // для atr_based
  riskPercent?: number;    // R% риска на сделку
  atrMultiplier?: number;
  equityPct?: number;      // для equity_percent
  fixedNotional?: number;  // для fixed_notional
  stats?: { winRate: number; avgWin: number; avgLoss: number }; // для kelly
  maxKelly?: number;
};
computeNotional(method: SizingMethod, ctx: SizingCtx): number  // USD-ноционал, >=0
```

**Формулы (locked):**
- `fixed_notional`: `ctx.fixedNotional ?? 100`.
- `equity_percent`: `equity * (equityPct ?? 0.1)`.
- `risk_percent`: `riskAmt = equity * (riskPercent/100)`; `notional = riskAmt / stopPct`
  (stopPct обязателен; если нет — фолбэк на `equity_percent`).
- `atr_based`: `stopPct = (atr*atrMultiplier)/entryPrice`; далее как `risk_percent`.
- `kelly`: `payoff = avgWin/avgLoss`; `f = (payoff*winRate - (1-winRate))/payoff`;
  `f = clamp(f, 0.01, maxKelly ?? 0.25)`; `notional = equity * f`.
- Все методы: `notional = max(0, notional)`; при неполном контексте — безопасный
  фолбэк на `equity_percent` c дефолтом 0.1, никогда не throw.

### A2. Нода `risk_sizing`

- Frontend: `blocks/registry.ts` — `risk_sizing: { type:'trade_action', id:'risk_sizing', name:'Risk Sizing', category:'Trade Action', defaultData:{ type:'sizing', method:'fixed_notional', riskPercent:1, atrMultiplier:2, atrPeriod:14, equityPct:0.1, fixedNotional:100, maxKelly:0.25 } }`.
- Params UI в `NodeInlineParams.tsx`/`PropertiesPanel.tsx` (метод + условно показываемые поля).
- Дискриминатор: `findAstNode(strategy.ast, 'trade_action', 'sizing')`.

### A3. Подключение (parity — обязательно)

- **Live** (`signals-engine.service.ts`): в `placeSltpOco` и путях market-order
  (строки ~494, ~552) заменить `execSettings.positionSize || 100` на
  `notional = riskSizingService.computeNotional(method, ctx)`, `amount = notional/entryPrice`.
  Equity = `execSettings.accountEquity ?? execSettings.positionSize ?? 1000` (без live-fetch баланса).
  stopPct — из `sltp` (percent или fib-дистанция), atr — из `calculateATR(candles)`.
- **Backtest** (`backtest.service.ts:240`): при входе
  `notional = riskSizingService.computeNotional(method, { equity: balance, entryPrice: currentPrice, stopPct, atr })`
  вместо `balance * positionSize`. Тот же сервис → parity.
- **Обратная совместимость:** нет `sizing`-ноды → метод `fixed_notional` (live) /
  `equity_percent` c текущим `positionSize` (backtest) → результаты не меняются.

## ЧАСТЬ B — Полировка сигналов + роутинг

### B1. Реальные TP/SL в алерте

Движок (`signals-engine.service.ts`, перед `sendSignal` на `:436`) вычисляет
`tp`/`sl` из `sltp`-ноды (percent или fib) и кладёт в `signal.metadata.tp`/`.sl`.
`TelegramService.sendSignal` и `DiscordService.sendSignal` читают
`signal.metadata.tp/sl` если заданы; иначе — старый фолбэк `2%/1%` (обратная
совместимость).

### B2. Per-strategy роутинг

Нода `telegram` получает поля `chatId?` (Telegram) и `webhookUrl?` (Discord).
Движок: при заданном `chatId` шлёт через `sendSignalOverride(signal, chatId)`;
Discord — при `webhookUrl` шлёт на него, иначе в глобальный. Пустые → глобальный
чат (как сейчас).

### B3. Alert-only режим

Флаг `alertOnly?: boolean` на ноде `telegram`. Когда `true` — алерты шлются, но
`placeSltpOco` (live-исполнение) пропускается, даже если `enableLiveExecution`.
Реализация: ранний `return` в исполнении при `alertOnly`.

## Файлы

**Backend:**
- Create: `risk/risk-sizing.service.ts` (+`risk.module.ts`), `risk/risk-sizing.service.spec.ts`.
- Modify: `signals-engine.service.ts` (сайзинг, TP/SL в metadata, routing, alertOnly),
  `backtest.service.ts` (сайзинг parity), `telegram.service.ts` + `discord.service.ts`
  (реальные TP/SL), `signals.module.ts` (импорт RiskModule).

**Frontend:**
- Modify: `blocks/registry.ts` (`risk_sizing`), `components/nodes/NodeInlineParams.tsx`,
  `components/PropertiesPanel.tsx` (params sizing + telegram chatId/webhookUrl/alertOnly).

## Тестирование

- `risk-sizing.service.spec` — каждый метод (значения), фолбэки при неполном ctx,
  `notional >= 0`, kelly clamp.
- `backtest.service.spec` — sizing-нода меняет размер позиции; parity: тот же
  notional, что даёт `computeNotional` при равном equity.
- `signals-engine.service.spec` — TP/SL кладутся в metadata из sltp; routing зовёт
  `sendSignalOverride` при chatId; alertOnly пропускает `placeSltpOco`.
- `telegram.service.spec` — `sendSignal` использует `metadata.tp/sl` когда заданы.

## Риски

1. **Equity в live** — нет live-fetch баланса; берём `accountEquity` из настроек с
   фолбэком. Документировать, что для точного риск-сайзинга юзер задаёт капитал.
2. **Parity сайзинга** — единый `RiskSizingService`; parity-тест обязателен.
3. **Обратная совместимость** — дефолты сохраняют текущее поведение без ноды.

## Вне объёма (отложено осознанно)

- **max-DD kill-switch** и **лимит экспозиции** — отложены. Зафиксированное решение
  на будущее: kill-switch работает на уровне **account/fleet-wide** (выбор
  пользователя 2026-07-05), пересекается с существующим `FleetService.panicStop`.
- Generic webhook (не Discord) — YAGNI.
- Kelly со статистикой из live/paper истории — пока `stats` передаётся вызывающим;
  автоподстановка из backtest-статистики отдельной задачей.
