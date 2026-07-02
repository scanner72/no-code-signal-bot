# Paper Trading Output Node — Design

**Date:** 2026-07-02
**Status:** Approved

## Цель

Выходная нода Strategy Builder «Paper Trading», которая исполняет сигналы стратегии на виртуальном счёте в реальном времени. Ключевой сценарий — **сравнение конфигов**: к одному выходу LONG/SHORT-сигнала подключается несколько Paper Trading нод с разными настройками (капитал, плечо, % на сделку, SL/TP), каждая ведёт независимый виртуальный счёт, результаты сохраняются в БД и сравниваются side-by-side.

Существующий тумблер `is_paper_trading` в настройках стратегии **остаётся** — нода это отдельный, параллельный путь.

## Контекст текущей системы

- Paper trading сейчас: тумблер на стратегии → `signals-engine.service.ts` (блок «5. Paper Trading Execution») вызывает `paperTradingService.openTrade()` с фиксированным volume $100 (или из portfolio-risk). Одна открытая сделка на стратегию, без понятия баланса/капитала/плеча.
- `VirtualTrade` (`virtual_trades`) — таблица сделок с SL/TP/trailing-полями; мониторинг открытых позиций — cron `checkOpenTrades()` раз в минуту по тикерам Binance.
- SL/TP/trailing-настройки берутся из `strategy.execution_settings`.
- **Важно:** `strategy.ast` компилируется только «назад» от signal-ноды (`ast-compiler.service.compile()`); `trade_action`-ноды после сигнала в AST не попадают. Существующий `findAstNode(strategy.ast, 'trade_action', ...)` для telegram/sltp, по-видимому, никогда не срабатывает — это отдельный баг, НЕ исправляется в рамках этой фичи. Новая нода читает `strategy.nodes`/`strategy.edges` напрямую.
- TypeORM `synchronize: true` — миграции не нужны, новые колонки/таблицы создаются автоматически.

## Модель данных

### Новая сущность `PaperTradingAccount` (`paper_trading_accounts`)

| Поле | Тип | Описание |
|---|---|---|
| `id` | PK | |
| `strategy_id` | FK → strategies | |
| `node_id` | string | id ноды React Flow — стабильный ключ инстанса на канвасе |
| `label` | string | имя конфига (для сравнения), редактируется в ноде |
| `starting_capital` | decimal | стартовый капитал USD |
| `current_balance` | decimal | свободный баланс (без учёта margin открытых позиций) |
| `leverage` | decimal | плечо (множитель PnL) |
| `risk_percent` | decimal | % от **текущего** баланса на сделку (компаундинг) |
| `sl_percent`, `tp_percent` | decimal nullable | свой фиксированный SL/TP |
| `use_trailing`, `trailing_distance`, `trailing_activation`, `move_sl_to_be` | | свой trailing/BE |
| `partial_tps` | jsonb | свои partial TP уровни |
| `is_active` | boolean | false = нода удалена с канваса, история сохраняется |
| `created_at`, `updated_at` | | |

Уникальность: `(strategy_id, node_id)`.

### Расширение `VirtualTrade`

- `paper_account_id` — nullable FK → paper_trading_accounts. `NULL` = сделка старого тумблер-пути (обратная совместимость).
- `margin_used` — decimal, маржа выделенная под сделку.
- `leverage_used` — decimal, плечо на момент открытия.

## Синхронизация нод ↔ аккаунтов

При сохранении стратегии (`StrategiesService.create/update`) вызывается `syncPaperAccounts(strategy)`:

1. `strategy.nodes.filter(n => n.type === 'paper_trading_output')`
2. Upsert по `(strategy_id, node_id)`:
   - новая нода → создать аккаунт, `current_balance = starting_capital`
   - существующая → обновить **только конфиг** (label, leverage, risk_percent, SL/TP...). Баланс и историю не трогать — новые настройки применяются к будущим сделкам. Изменение `starting_capital` тоже не сбрасывает счёт.
3. Аккаунты, чьих нод больше нет на канвасе → `is_active = false` (soft-delete, история остаётся для сравнения).

Сброс счёта — только явный: кнопка «Сбросить счёт» на ноде с подтверждением.

## Исполнение сигналов

В `signals-engine.service.ts`, рядом с существующим блоком «5. Paper Trading Execution» (который не трогаем), добавляется:

1. Найти в `strategy.nodes` signal-узлы с сработавшим `signalType`.
2. Обойти `strategy.edges` вперёд (source → target) до всех `paper_trading_output`-нод, достижимых от сигнала.
3. Для каждой найденной ноды → `paperTradingService.openAccountTrade(account, pair, type, price)`.

### Логика `openAccountTrade`

- **Портфель**: несколько одновременных позиций (по разным парам) на аккаунт. Одна открытая позиция на пару на аккаунт; противоположный сигнал по той же паре закрывает текущую (`OPPOSITE_SIGNAL`), одинаковый — игнорируется.
- **Размер**: `margin_used = current_balance × risk_percent / 100`. Баланс уменьшается на `margin_used` при открытии, возвращается `margin_used + pnl_value` при закрытии.
- Если `current_balance < margin_used` (или ≤ 0) — сделка пропускается, счётчик пропусков виден на ноде.

### Плечо и ликвидация (упрощённая модель)

- `pnl_percent_on_margin = pnl_percent_price × leverage`
- `pnl_value = margin_used × pnl_percent_on_margin / 100`
- Если незакрытый убыток достигает −100% маржи → позиция принудительно закрывается с `exit_reason = 'LIQUIDATION'`, `pnl_value = −margin_used`. Остальной баланс аккаунта не затрагивается. Funding, комиссии, точная биржевая маржинальная математика — вне рамок.

### Мониторинг

Расширяется существующий cron `checkOpenTrades()`: для сделок с `paper_account_id` SL/TP/trailing-настройки берутся из `PaperTradingAccount` (не из `strategy.execution_settings`), PnL считается с учётом плеча, добавляется проверка ликвидации. Существующая логика trailing/partial TP/BE переиспользуется.

## API

Расширение `paper-trading.controller.ts`:

- `GET /paper-trading/accounts?strategyId=X` — аккаунты стратегии + live-статы (balance, PnL%, win rate, открытые позиции, пропущенные сигналы)
- `GET /paper-trading/accounts/:id` — детали: конфиг, сделки, equity curve
- `POST /paper-trading/accounts/:id/reset` — закрыть открытые позиции по рынку, восстановить `current_balance = starting_capital`. История сделок до сброса остаётся в БД (сделки не удаляются)
- `GET /paper-trading/compare?ids=1,2,3` — equity curves + сводка (win rate, total PnL%, max drawdown, число сделок) для наложения

## Frontend

### Нода `paper_trading_output`

- Реестр: категория «🚀 Торговля», рядом с Market Order. defaultData: `{ label: 'Config A', startingCapital: 1000, leverage: 1, riskPercent: 10, sl: '', tp: '', useTrailing: false, ... }`
- Компонент `PaperTradingNode.tsx` (по образцу FinvizScannerNode):
  - вход: один target-handle (от signal-ноды)
  - раскрываемая панель настроек: label, капитал, плечо, % на сделку, SL/TP/trailing
  - **мини-статы на корпусе**: текущий баланс, total PnL% (цветом), win rate, открытые позиции, пропуски. Обновление поллингом `GET /accounts?strategyId` раз в 30–60 с (без нового WS-канала)
  - кнопка «Сбросить счёт» с confirm-диалогом
- Валидация StrategyBuilder: добавить `paper_trading_output` в sink-типы (нужен только входящий edge).
- AST-компилятор бэкенда ноду игнорирует (как остальные trade_action-подобные) — она не участвует в условиях сигнала.

### Страница сравнения

Расширение существующей `PaperTrading.tsx`: секция/вкладка «Сравнение конфигов» — мультиселект аккаунтов (включая неактивные), наложенные equity curves, таблица метрик (label, капитал, плечо, %, win rate, PnL%, max DD, сделок).

## Вне рамок

- Бэктест-движок (нода работает только в live forward-testing).
- Исправление бага `findAstNode(strategy.ast, 'trade_action', ...)` для telegram/sltp — отдельная задача.
- Точная модель биржевой маржи, funding rate, комиссии.
- Реальное исполнение — нода никогда не шлёт ордера на биржу.

## Тестирование

- Unit: `openAccountTrade` (размер позиции, компаундинг, нехватка маржи, противоположный сигнал), ликвидация при −100% маржи, `syncPaperAccounts` (create/update-конфиг-без-сброса/deactivate).
- Unit: `checkOpenTrades` с account-настройками SL/TP + плечо.
- Существующие тесты paper-trading и signals-engine не должны сломаться (старый путь не изменяется).
