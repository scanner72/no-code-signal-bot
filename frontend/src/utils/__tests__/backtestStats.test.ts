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
