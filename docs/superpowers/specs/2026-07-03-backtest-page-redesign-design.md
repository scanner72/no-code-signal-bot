# Backtest Page Redesign — Design

**Date:** 2026-07-03
**Status:** Approved (стиль и компоновка утверждены через visual companion: гибрид «Cyber-Quant карточки + терминальная плотность»)

## Цель

Полный редизайн страницы `/backtest`: дашборд-отчёт во всю ширину вместо «график слева, параметры справа», глубокая аналитика результатов (drawdown, распределения, календарь), история прогонов с наложением и сравнением. Стиль — фирменные тёмные карточки Cyber-Quant (акцент `#2962ff`, existing CSS-переменные) с плотностью терминала: моноширинные цифры (JetBrains Mono), компактные отступы, максимум данных на экран.

Мокапы-референсы: `.superpowers/brainstorm/155-1783110229/content/visual-style-v2.html` (утверждён), `history-layout.html` (выбраны ОБА варианта: drawer + сравнение бок-о-бок).

## Контекст

- Текущий `frontend/src/pages/Backtest.tsx` ~1200 строк: header (стратегия/вид/запуск), табы «Кривая доходности / График цены / Оптимизация», правая колонка параметров + статы, таблица сделок. Распиливается на компоненты.
- Результаты прогонов сейчас живут только в Bull/Redis (`GET /backtest/job/:id`) и теряются; истории нет.
- Движок бэктеста починен 2026-07-03 (3 бага), `result` содержит все нужные поля: trades[] (entryTime, exitTime, type, entryPrice, exitPrice, pnl, pnlPercent, fees, exitReason, isPartial, forceClosed), totalReturn, winRate, maxDrawdown, profitFactor, sharpeRatio, sortinoRatio, recoveryFactor, expectancy, maxConsecutiveWins/Losses, largestWin/Loss, longStats/shortStats, finalBalance.
- Прогресс прогона уже транслируется по WS (`broadcastProgress`).

## 1. Структура страницы (сверху вниз)

### 1.1 Панель запуска (RunPanel)
Одна строка, sticky сверху:
- Дропдаун стратегии (как сейчас).
- Чипы текущих параметров: `BTCUSDT` `15m` `04.01 → 03.07` `$1000 · TP 2% · SL 2%` (+ чип `⚡ accurate`, если включён). Чипы read-only, клик по любому открывает форму.
- Кнопка `⚙ Параметры` — раскрывает полную форму параметров **поповером/оверлеем вниз** (все текущие поля: даты, баланс, брокер-модель, TP/SL, размер позиции, accurate, расширенные: partial TPs, trailing, slippage, latency, комиссия, TWAP/VWAP). Форма закрывается по запуску или клику вне.
- Кнопка `▶ Запустить` (accent). Во время прогона на её месте — прогресс-бар с процентом и статус-текстом из WS (как сейчас, но инлайн в панели).
- Кнопка `🕘 История` — открывает RunHistoryDrawer (см. §2).

### 1.2 KPI-строка (KpiStrip)
6 плиток в ряд (моно-цифры, размер как в мокапе):
1. **Total Return** — акцентная плитка (градиент/синяя рамка): % цветом (зелёный/красный) + `$1000 → $995.60`.
2. **Win Rate** — % + `54W / 50L`.
3. **Max Drawdown** — % (оранжевый) + «N дней до восстановления» (вычислить из equity-серии; если не восстановился — «не восстановлен»).
4. **Profit Factor** — значение + `Sharpe {sharpeRatio}` подписью.
5. **Сделок** — количество + `avg +$X / −$Y` (avgWin/avgLoss).
6. **Серии W/L** — `maxConsecutiveWins / maxConsecutiveLosses` + `recovery {recoveryFactor}` подписью.

В режиме сравнения (§2.3) каждая плитка показывает два значения: активный прогон и выбранный, лучшее подсвечено.

### 1.3 Equity + Drawdown (EquityChart)
- Карточка с внутренними табами: **Equity** (default) · **График цены** · **Оптимизация** — существующие вкладки «График цены» (разбор сделки на свечах) и «Оптимизация» переезжают сюда без переделки логики.
- Equity-вью: самописный SVG (как в PaperCompareSection):
  - кривая с градиентной заливкой, ось $ слева, подписи дат снизу;
  - точки закрытий сделок (зелёные/красные), клик по точке → скролл к строке и подсветка в таблице сделок;
  - пунктирная линия бенчмарка buy&hold по паре стратегии — серию отдаёт backend в `result.benchmark` (на фронте свечей нет, из сделок её не построить), см. §3.2;
  - при наложении прогонов из истории — до 3 дополнительных кривых цветами `#a855f7`, `#f59e0b`, `#10b981`.
- Под equity — синхронный underwater-график просадки (заливка вниз от нуля, красная), общая ось X.

### 1.4 Ряд распределений (DistributionsRow)
4 равные компактные карточки, все считаются на фронте из `result.trades[]`:
1. **Гистограмма PnL** — бины по pnlPercent (шаг авто ~10 бинов), убыточные красные слева, прибыльные зелёные справа.
2. **Причины выходов** — горизонтальные бары: TP / SL / Trailing / Partial / Force (+Manual если встретится) с количеством.
3. **PnL по месяцам** — вертикальные бары (сумма pnl по exitTime-месяцу), зелёный/красный, линия нуля.
4. **Heatmap час×день** — сетка 24×7 по exitTime (UTC), цвет = суммарный pnl клетки (зелёная/красная интенсивность), подписи часов и дней.

### 1.5 Таблица сделок (TradesTable)
- Плотная моно-таблица: #, вход (дата время), тип, цена входа, цена выхода, PnL% (цветом), PnL $, причина (бейдж как на Paper Trading странице).
- Фильтры-чипы: Все · Long · Short · TP · SL · Partial. CSV-экспорт (существующая логика переносится).
- Клик по строке → внутренний таб «График цены» с разбором сделки (существующее поведение сохраняется).
- Виртуализации не нужно до ~1000 строк; при > 500 сделок — пагинация по 100.

## 2. История прогонов

### 2.1 Персист (backend)
Новая entity `BacktestRun` (`backtest_runs`), synchronize:true:
- `id` PK, `strategy_id` FK, `options` jsonb (полный BacktestOptions), `result` jsonb (полный результат), `created_at` timestamptz.
- Пишется в `BacktestProcessor` по завершении job (в try/catch — сбой персиста не валит прогон). Хранится всё; UI показывает последние 50 на стратегию.
- API: `GET /backtest/runs?strategyId=X&limit=50` (без result.trades — только сводка: options + метрики, для списка), `GET /backtest/runs/:id` (полный, с trades), `DELETE /backtest/runs/:id`.

### 2.2 RunHistoryDrawer (frontend)
- Выдвижная панель справа (overlay, ~320px): список прогонов активной стратегии — дата/время, чипы ключевых опций (`TP2/SL2`, `accurate`), mini-итог (`−0.44% · 104 сделок`, цветом).
- Чекбокс на каждом прогоне → наложение equity-кривой на основной график (максимум 3 одновременно, цвета фиксированные).
- Кнопка удаления прогона (с confirm).
- Текущий завершённый прогон автоматически появляется в списке.

### 2.3 Режим сравнения
- Когда в drawer отмечено ровно 2 прогона — появляется кнопка `⇄ Сравнить`.
- Сравнение: KPI-строка показывает пары значений (активный | выбранный), лучшее значение каждой метрики подсвечено зелёной рамкой; под KPI — строка-примечание с различием опций двух прогонов (например `TP 2%→3%`, `accurate off→on`).
- Распределения и таблица в режиме сравнения остаются от активного прогона (не раздваиваются) — YAGNI.

## 3. Backend-изменения (минимальные)

### 3.1 Персист прогонов
См. §2.1: entity + запись в processor + 3 endpoint'а в `backtest.controller.ts`.

### 3.2 Бенчмарк buy&hold
`runWithAst` дополняет result полем `benchmark: Array<{ t: string; v: number }>` — до 200 точек (даунсемпл), equity стратегии «купил на весь баланс в первую свечу и держал»: `v = initialBalance × close(t)/close(t0)`. Считается из уже загруженных simCandles — O(n), без новых запросов.

### 3.3 Equity-серия для underwater
Underwater-график и «дни до восстановления» считаются на фронте из точек: `equityCurve: Array<{ t: string; v: number }>` — тоже добавить в result (сейчас есть только сделки; кривая баланса по закрытиям сделок + force-close, ≤ totalTrades+2 точек, даунсемпл не нужен).

## 4. Файлы

**Создать (frontend):**
- `components/backtest/RunPanel.tsx`
- `components/backtest/KpiStrip.tsx`
- `components/backtest/EquityChart.tsx` (equity + underwater + overlay кривых + точки сделок)
- `components/backtest/DistributionsRow.tsx`
- `components/backtest/TradesTable.tsx`
- `components/backtest/RunHistoryDrawer.tsx`
- `utils/backtestStats.ts` — чистые функции: `buildPnlHistogram(trades)`, `buildExitReasons(trades)`, `buildMonthlyPnl(trades)`, `buildHourDayHeatmap(trades)`, `buildUnderwater(equityCurve)`, `daysToRecover(equityCurve)` — юнит-тестируются.

**Переписать:** `pages/Backtest.tsx` — оркестрация (state: form, activeResult, overlayRuns, compareRun; WS-прогресс; данные в компоненты). Логика вкладок «График цены»/«Оптимизация» переносится как есть в существующем виде (внутрь EquityChart-карточки), их внутренности не редизайнятся в этом заходе.

**Создать (backend):** `backtest/backtest-run.entity.ts`; изменить `backtest.processor.ts` (персист), `backtest.controller.ts` (runs endpoints), `backtest.service.ts` (benchmark + equityCurve в result), `backtest.module.ts` (entity).

## 5. Вне рамок

- Редизайн внутренностей вкладок «График цены» и «Оптимизация» (переезжают как есть).
- Раздвоение распределений/таблицы в режиме сравнения.
- PDF-экспорт отчёта, светлая тема страницы (стиль C отклонён).
- Новые графические библиотеки — только самописный SVG в стиле PaperCompareSection.
- Виртуализация таблицы.

## 6. Тестирование

- **Unit (frontend):** все функции `backtestStats.ts` — гистограмма (бины/границы), причины выходов (все типы reason + отсутствующий → Force/Manual), месяцы (границы годов), heatmap (24×7, UTC), underwater (пики/восстановление), daysToRecover (восстановился/нет). Vitest, если фронт-раннера нет — задача плана добавит vitest конфиг минимально.
- **Unit (backend):** benchmark-даунсемпл (≤200 точек, первая/последняя совпадают), equityCurve (start=initialBalance, конец=finalBalance), персист run в processor (мок-репозиторий), runs endpoints (список без trades, полный с trades).
- **Существующие 12 тестов backtest.service** не должны сломаться (result расширяется, не меняется).
- Smoke: прогон на проде после деплоя, проверка сохранения в `backtest_runs` и наложения двух кривых.
