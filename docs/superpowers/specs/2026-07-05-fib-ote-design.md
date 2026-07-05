# Fib / OTE — полный инструмент (Design Spec)

**Дата:** 2026-07-05
**Статус:** approved (design), pending implementation plan
**Автор:** Claude + x0tta6b

## 1. Цель и контекст

Добавить в визуальный конструктор стратегий полноценный инструмент Fibonacci с
акцентом на SMC/ICT-концепт **OTE (Optimal Trade Entry)** — зона 0.618–0.786
ретрейсмента последнего свинг-лега. Фича должна:

- давать булево условие входа для логики сигнала (как остальные SMC-ноды);
- рисовать фиб-уровни и OTE-зону на графике превью и на канвасе;
- пробрасывать fib-extension (1.272/1.618) как TP-таргеты в систему выходов (OCO/bracket);
- работать **идентично в live-движке и в бэктесте** (parity — критично).

Позиционирование продуктовое: не «ещё один индикатор», а уточнение уже
существующего SMC-стека (FVG, Order Block, Market Structure, Premium/Discount).

### Существующая архитектура (найдено при исследовании)

- SMC-ноды исполняются **двумя** движками по `switch(node.type)`:
  - live: `backend/src/signals/signals-engine.service.ts`
  - backtest: `backend/src/signals/ast-evaluator.service.ts`
  Новую ноду обязательно добавлять в оба, иначе бэктест молча расходится с live.
- Свинги уже детектируются фракталом (5 свечей, `i±2`) внутри
  `IndicatorsService.detectMarketStructure` (`indicators.service.ts:251`), но
  наружу отдаётся только `trend/BOS/CHoCH` — сами свинг-хай/лоу не экспонируются.
  Фрактал использует 2 будущие свечи (`n1,n2`) → свинг подтверждается через 2
  бара = естественная защита от lookahead.
- Реестр нод фронта: `frontend/src/blocks/registry.ts`; SMC-ноды заданы как
  `{ type:'smc', defaultData:{ type:'fvg'|'order_block'|..., params:{...} } }`.
  Рендер — `components/nodes/SMCNode.tsx`, параметры — `NodeInlineParams.tsx` /
  `PropertiesPanel.tsx`.
- Выходы: нода `sltp` (`trade_action`/`sltp`) хранит `tp`/`sl` как **проценты**;
  `placeSltpOco()` (`signals-engine.service.ts:529`) считает
  `tpPrice = entry*(1±tp)` и регистрирует OCO через `OcoManagerService`.
- **Найденный баг (чиним попутно):** `premium_discount` есть в live
  (`signals-engine.service.ts:968`), но отсутствует в `ast-evaluator` → в
  бэктесте нода не работает. Тот же класс дивергенции.

## 2. Идентичность ноды

Одна нода **`smc_fib`** («Fib / OTE», категория Smart Money, `type:'smc'`,
`defaultData.type='fib_ote'`). Пресет внутри закрывает и generic-фиб, и OTE.

**Параметры (`node.params`):**

| Параметр | Тип | Дефолт | Назначение |
|---|---|---|---|
| `direction` | `'auto'\|'long'\|'short'` | `'auto'` | направление лега; auto = по trend/BOS |
| `lookback` | number | `50` | окно поиска свинга |
| `preset` | `'OTE'\|'custom'` | `'OTE'` | OTE выставляет zoneFrom/To = 0.618/0.786 |
| `zoneFrom` | number | `0.618` | нижняя граница зоны-условия (в фиб-долях) |
| `zoneTo` | number | `0.786` | верхняя граница зоны-условия |
| `levels` | number[] | `[0.236,0.382,0.5,0.618,0.705,0.786,1.272,1.618]` | уровни для отрисовки |

## 3. Ядро — `FibService` / методы `IndicatorsService`

Новые методы в `indicators.service.ts`:

```ts
// Выделяем переиспользуемую фрактальную детекцию (устраняет дублирование
// с detectMarketStructure — она начинает вызывать этот же helper).
getSwingPoints(candlesAsc, { leftRight = 2 }): {
  highs: {price:number,time}[],
  lows:  {price:number,time}[]
}

calculateFibLevels(candles, { direction, lookback }): {
  swingHigh: {price,time}, swingLow: {price,time},
  direction: 'long'|'short',
  levels: Record<string, number>,   // '0.618' -> price, '1.272' -> price, ...
  oteZone: { top:number, bottom:number }
} | null   // null если свингов недостаточно
```

**Правила:**
- Свинги берём тем же фракталом `i±2`, что и `detectMarketStructure`; последняя
  рефакторится на использование `getSwingPoints` (одинаковый расчёт в обоих
  местах).
- **Non-lookahead:** якорим только на свинги, подтверждённые ≥2 бара назад.
- Направление `auto`: бычий лег (swingLow→swingHigh) при trend/BOS bullish;
  медвежий (swingHigh→swingLow) при bearish. При `long`/`short` — форсируем.
- Уровни ретрейсмента считаются от диапазона лега; extension-уровни (>1.0) —
  проекция за конец лега.

## 4. Оценка ноды (в ОБОИХ движках — parity)

`case 'fib_ote'` добавляется в `signals-engine.service.ts` и
`ast-evaluator.service.ts` идентично.

**Семантика условия:** возвращает `true`, если текущая цена (`candles[0].close`)
находится внутри зоны `[oteZone.bottom .. oteZone.top]` выбранного лега. Возврат —
boolean, как у всех SMC-нод; плагается в логику сигнала.

Попутно: добавить недостающий `case 'premium_discount'` в `ast-evaluator`
(вызов `calculatePremiumDiscount`, зеркало live-ветки).

## 5. Превью + отрисовка на графике

- `indicators.controller.ts` `getPreview`: для `name` = `fib`/`fib_ote` возвращает
  `{ levels, oteZone }` (в дополнение к candles ASC — уже исправлено ранее).
- `MarketChart.tsx`: рисует горизонтальные price-lines по `levels` через нативный
  `series.createPriceLine(...)` lightweight-charts; OTE-зона — подсветка/2 линии.
  Работает и в `NodePreviewChart`, и на канвасе StrategyBuilder (где передаётся
  `nodes`).

## 6. Проброс fib-extension в выходы (OCO)

Расширить `sltp`-ноду полем:

| Поле | Тип | Дефолт | Назначение |
|---|---|---|---|
| `tpMode` | `'percent'\|'fib_extension'` | `'percent'` | режим расчёта TP |
| `tpFibLevel` | number | `1.272` | какой extension брать как TP |

- `placeSltpOco()` (live): в режиме `fib_extension` считает `tpPrice` =
  `calculateFibLevels(...).levels[tpFibLevel]` текущего лега вместо `entry*(1+tp)`.
  SL остаётся процентным (вариант «под swing low» — отдельная будущая задача).
- Фиб-уровни на момент входа известны → **без lookahead**.

## 7. Parity в бэктесте (главный риск)

Логика закрытия по TP в `backtest.service.ts` зеркалит fib-режим: при
`tpMode='fib_extension'` TP считается из фиб-лега на баре входа. Свинг-лег в
бэктесте считается **по-барно** (`getSwingPoints` на окне `lookback`, O(lookback)
на бар) — не через precompute-кэш, т.к. лег меняется во времени. Обязательный
тест «live == backtest на одном сценарии».

## 8. Тестирование

- `indicators.service.spec` — `getSwingPoints`, `calculateFibLevels` (уровни,
  OTE-зона, направление), **non-lookahead** (свинг не «видит» будущее).
- `ast-evaluator.spec` — `fib_ote` даёт тот же boolean, что live-ветка
  (эквивалентность на общем наборе свечей); регресс `premium_discount`.
- `backtest.service.spec` — fib-TP закрытие совпадает с расчётным extension.

## 9. Затрагиваемые файлы

**Backend:**
- `indicators.service.ts` — `getSwingPoints`, `calculateFibLevels`, рефактор
  `detectMarketStructure`.
- `signals-engine.service.ts` — `case 'fib_ote'`, fib-режим в `placeSltpOco`.
- `ast-evaluator.service.ts` — `case 'fib_ote'`, `case 'premium_discount'`.
- `backtest.service.ts` — fib-TP закрытие.
- `indicators.controller.ts` — levels в preview.

**Frontend:**
- `blocks/registry.ts` — регистрация `smc_fib`.
- `components/nodes/SMCNode.tsx` / `NodeInlineParams.tsx` / `PropertiesPanel.tsx`
  — параметры ноды (direction/preset/zone/lookback).
- `components/MarketChart.tsx` — price-lines по фиб-уровням + OTE-зона.

## 10. Ключевые риски

1. **Non-lookahead свингов** — единственный источник «вранья» бэктеста; закрываем
   тестом на то, что подтверждение свинга требует +2 баров.
2. **Backtest-parity fib-TP** — по-барный свинг; обязательный тест эквивалентности.
3. **Производительность** по-барного свинга в бэктесте — ограничена `lookback`,
   O(lookback) на бар; приемлемо.

## 11. Вне объёма (YAGNI)

- SL «под swing low» в fib-режиме (потом).
- Мультилеговые/вложенные фиб-сетки.
- Ручная перетяжка якорей мышью на канвасе.
