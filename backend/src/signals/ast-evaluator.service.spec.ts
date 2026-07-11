import { AstEvaluatorService } from './ast-evaluator.service';
import { IndicatorsService } from '../indicators/indicators.service';

describe('AstEvaluatorService — indicator property (backtest standalone)', () => {
  const indicators = new IndicatorsService(null as any);
  const service = new AstEvaluatorService(null as any, indicators);

  // 80 хронологических свечей с колебанием, потом newest-first (candles[0] = последняя)
  const chrono = Array.from({ length: 80 }, (_, i) => {
    const base = 100 + 10 * Math.sin(i / 5) + i * 0.2;
    return { close: String(base), high: String(base + 2), low: String(base - 2), volume: 1000 };
  });
  const candles = [...chrono].reverse();
  const closesC = chrono.map((c) => parseFloat(c.close));
  const highsC = chrono.map((c) => parseFloat(c.high));
  const lowsC = chrono.map((c) => parseFloat(c.low));
  const last = (a: any[]) => a[a.length - 1];

  const ev = (node: any) => service.evaluateNode(node, candles, false, {}, { backtestMode: true });

  it('Stochastic property k совпадает с IndicatorsService (не SMA)', async () => {
    const expected = last(indicators.calculateStochastic(highsC, lowsC, closesC, 14, 3)).k;
    const v = await ev({ type: 'indicator', name: 'Stochastic', params: { k: 14, d: 3, period: 14 }, property: 'k' });
    expect(v).toBeCloseTo(expected, 4);
    // и это НЕ SMA закрытий (регрессия старого дефолта)
    expect(v).not.toBeCloseTo(last(indicators.calculateSMA(closesC, 14)), 1);
  });

  it('BollingerBands property lower совпадает с IndicatorsService', async () => {
    const expected = last(indicators.calculateBollingerBands(closesC, 20, 2)).lower;
    const v = await ev({ type: 'indicator', name: 'BollingerBands', params: { period: 20, stdDev: 2 }, property: 'lower' });
    expect(v).toBeCloseTo(expected, 4);
  });

  it('MACD property histogram совпадает с IndicatorsService', async () => {
    const expected = last(indicators.calculateMACD(closesC, 12, 26, 9)).histogram;
    const v = await ev({ type: 'indicator', name: 'MACD', params: { fast: 12, slow: 26, signal: 9 }, property: 'histogram' });
    expect(v).toBeCloseTo(expected, 4);
  });

  // VWAP: берёт массив свечей (newest-first) с time/volume, не серию значений
  const t0 = Date.UTC(2026, 0, 1);
  const vwapChrono = Array.from({ length: 48 }, (_, i) => {
    const base = 100 + Math.sin(i / 4) * 4 + i * 0.15;
    return { time: new Date(t0 + i * 3600_000).toISOString(), close: String(base), high: String(base + 1), low: String(base - 1), volume: String(1000 + i * 25) };
  });
  const vwapCandles = [...vwapChrono].reverse(); // newest-first

  it('VWAP anchor D совпадает с IndicatorsService, а не SMA', async () => {
    const expected = last(indicators.calculateVWAP(vwapCandles, 'D'));
    const v = await service.evaluateNode({ type: 'indicator', name: 'VWAP', params: { anchor: 'D' } }, vwapCandles, false, {}, { backtestMode: true });
    expect(v).toBeCloseTo(expected, 4);
    expect(v).not.toBeCloseTo(last(indicators.calculateSMA(vwapChrono.map((c) => parseFloat(c.close)), 14)), 1);
  });
});

describe('AstEvaluatorService — branching/state/array nodes', () => {
  const indicators = new IndicatorsService(null as any);
  const service = new AstEvaluatorService(null as any, indicators);

  const candle = (time: string, close: number) => ({
    time, close: String(close), open: String(close - 1), high: String(close + 2), low: String(close - 2), volume: 1000,
  });

  describe('conditional_fork', () => {
    it('routes trueSignal and returns true when the condition AST is truthy', async () => {
      const context: any = { metadata: {} };
      const node = {
        type: 'conditional_fork',
        condition: { type: 'comparison', operator: '>', left: { type: 'constant', value: 5 }, right: 3 },
        trueSignal: 'LONG', falseSignal: 'SHORT',
      };
      const r = await service.evaluateNode(node, [candle('2026-01-01T00:00:00Z', 100)], false, context, { backtestMode: true });
      expect(r).toBe(true);
      expect(context.metadata.forkSignal).toBe('LONG');
    });

    it('routes falseSignal (else branch) and still returns true when condition is falsy', async () => {
      const context: any = { metadata: {} };
      const node = {
        type: 'conditional_fork',
        condition: { type: 'comparison', operator: '<', left: { type: 'constant', value: 5 }, right: 3 },
        trueSignal: 'LONG', falseSignal: 'SHORT',
      };
      const r = await service.evaluateNode(node, [candle('2026-01-01T00:00:00Z', 100)], false, context, { backtestMode: true });
      expect(r).toBe(true);
      expect(context.metadata.forkSignal).toBe('SHORT');
    });

    it('returns false with no else branch (falseSignal null) when condition is falsy', async () => {
      const context: any = { metadata: {} };
      const node = {
        type: 'conditional_fork',
        condition: { type: 'comparison', operator: '<', left: { type: 'constant', value: 5 }, right: 3 },
        trueSignal: 'LONG', falseSignal: null,
      };
      const r = await service.evaluateNode(node, [candle('2026-01-01T00:00:00Z', 100)], false, context, { backtestMode: true });
      expect(r).toBe(false);
      expect(context.metadata.forkSignal).toBeUndefined();
    });

    it('supports simple string conditions from the Pine importer', async () => {
      const context: any = { metadata: {} };
      const node = { type: 'conditional_fork', condition: 'close > 50', trueSignal: 'LONG', falseSignal: null };
      const r = await service.evaluateNode(node, [candle('2026-01-01T00:00:00Z', 100)], false, context, { backtestMode: true });
      expect(r).toBe(true);
      expect(context.metadata.forkSignal).toBe('LONG');
    });
  });

  describe('accumulator', () => {
    const node = {
      type: 'accumulator', varName: 'counter', initialValue: 0, incrementValue: 1,
      incrementCondition: 'close > 50',
    };

    it('increments across candles and returns the running value', async () => {
      const context: any = { state: {} }; // run-scoped, like backtest.service provides
      expect(await service.evaluateNode(node, [candle('t1', 100)], false, context, { backtestMode: true })).toBe(1);
      expect(await service.evaluateNode(node, [candle('t2', 100)], false, context, { backtestMode: true })).toBe(2);
      expect(await service.evaluateNode(node, [candle('t3', 10)], false, context, { backtestMode: true })).toBe(2); // condition false — no increment
    });

    it('counts the same candle only once (live-tick re-evaluation gate)', async () => {
      const context: any = { state: {} };
      expect(await service.evaluateNode(node, [candle('t1', 100)], false, context, { backtestMode: true })).toBe(1);
      expect(await service.evaluateNode(node, [candle('t1', 100)], false, context, { backtestMode: true })).toBe(1);
    });

    it('resetCondition returns the value to initialValue', async () => {
      const context: any = { state: {} };
      const withReset = { ...node, resetCondition: 'close < 20' };
      await service.evaluateNode(withReset, [candle('t1', 100)], false, context, { backtestMode: true }); // 1
      await service.evaluateNode(withReset, [candle('t2', 100)], false, context, { backtestMode: true }); // 2
      expect(await service.evaluateNode(withReset, [candle('t3', 10)], false, context, { backtestMode: true })).toBe(0); // reset
    });
  });

  describe('lookback_window', () => {
    // 5 candles newest-first: closes 100, 100, 100, 10, 100
    const candles = [
      candle('t5', 100), candle('t4', 100), candle('t3', 100), candle('t2', 10), candle('t1', 100),
    ];

    it("logic 'all' fails when one bar in the window misses the condition", async () => {
      const node = { type: 'lookback_window', lookbackBars: 4, logic: 'all', condition: 'close > 50' };
      expect(await service.evaluateNode(node, candles, false, { state: {} }, { backtestMode: true })).toBe(false);
    });

    it("logic 'all' passes over a window where every bar matches", async () => {
      const node = { type: 'lookback_window', lookbackBars: 3, logic: 'all', condition: 'close > 50' };
      expect(await service.evaluateNode(node, candles, false, { state: {} }, { backtestMode: true })).toBe(true);
    });

    it("logic 'any' passes when at least one bar matches", async () => {
      const node = { type: 'lookback_window', lookbackBars: 4, logic: 'any', condition: 'close < 20' };
      expect(await service.evaluateNode(node, candles, false, { state: {} }, { backtestMode: true })).toBe(true);
    });
  });

  describe('logic_corr', () => {
    const mkCandles = (n: number) =>
      Array.from({ length: n }, (_, i) => candle(new Date(Date.UTC(2026, 0, 1, n - i)).toISOString(), 100 + (n - i)));

    it('computes correlation from prefetched point-in-time candles', async () => {
      const candles = mkCandles(30);
      // perfectly correlated target pair (same closes scaled)
      const timeMap = new Map<string, number>();
      for (const c of candles) timeMap.set(new Date(c.time).toISOString(), parseFloat(c.close) * 2);
      const context: any = { corrPairs: new Map([['ETHUSDT', timeMap]]) };
      const node = { type: 'logic_corr', pair: 'ETHUSDT', minCorr: 0.8 };
      expect(await service.evaluateNode(node, candles, false, context, { backtestMode: true })).toBe(true);
    });

    it('returns false (never guesses) without a prefetched corrPairs map', async () => {
      const node = { type: 'logic_corr', pair: 'ETHUSDT', minCorr: 0.8 };
      expect(await service.evaluateNode(node, mkCandles(30), false, {}, { backtestMode: true })).toBe(false);
    });
  });
});

describe('AstEvaluatorService — orderbook: real snapshot vs. labeled mock', () => {
  const indicators = new IndicatorsService(null as any);
  const service = new AstEvaluatorService(null as any, indicators);
  const candles = [{ close: '100', high: '101', low: '99', volume: 1000 }];

  it('uses the labeled mock when no snapshot is present on the context', async () => {
    const imbalance = await service.evaluateNode({ type: 'orderbook', params: { metric: 'imbalance' } }, candles, false, {}, { backtestMode: true });
    const spread = await service.evaluateNode({ type: 'orderbook', params: { metric: 'spread' } }, candles, false, {}, { backtestMode: true });
    const wall = await service.evaluateNode({ type: 'orderbook', params: { metric: 'wall_distance' } }, candles, false, {}, { backtestMode: true });
    expect(imbalance).toBe(52.5);
    expect(spread).toBe(0.05);
    expect(wall).toBe(0.8);
  });

  it('uses the real collected snapshot when present on the context, not the mock', async () => {
    const context = { orderbookSnapshot: { imbalance_pct: 61.2, spread_pct: 0.012, wall_distance_pct: 1.4 } };
    const imbalance = await service.evaluateNode({ type: 'orderbook', params: { metric: 'imbalance' } }, candles, false, context, { backtestMode: true });
    const spread = await service.evaluateNode({ type: 'orderbook', params: { metric: 'spread' } }, candles, false, context, { backtestMode: true });
    const wall = await service.evaluateNode({ type: 'orderbook', params: { metric: 'wall_distance' } }, candles, false, context, { backtestMode: true });
    expect(imbalance).toBe(61.2);
    expect(spread).toBe(0.012);
    expect(wall).toBe(1.4);
  });

  it('defaults wall_distance to 0 when the snapshot has no wall data', async () => {
    const context = { orderbookSnapshot: { imbalance_pct: 50, spread_pct: 0.02, wall_distance_pct: null } };
    const wall = await service.evaluateNode({ type: 'orderbook', params: { metric: 'wall_distance' } }, candles, false, context, { backtestMode: true });
    expect(wall).toBe(0);
  });
});

describe('AstEvaluatorService — input node source (backtest)', () => {
  let service: AstEvaluatorService;

  // candles newest-first (candles[0] = current), как в бэктесте
  const candles = [
    { close: '105', mark_price: '104.5', funding_rate: '-0.0025', open_interest: '2000000' },
    { close: '100', mark_price: '99.8', funding_rate: '0.0010', open_interest: '1800000' },
  ];

  beforeEach(() => {
    service = new AstEvaluatorService(null as any, null as any);
  });

  const evalInput = (source: string | undefined, getHistory = false) =>
    service.evaluateNode({ type: 'input', source }, candles, getHistory, {}, { backtestMode: true });

  it('fundingRate → текущий funding_rate свечи, а не close', async () => {
    expect(await evalInput('fundingRate')).toBeCloseTo(-0.0025);
  });

  it('markPrice → mark_price свечи', async () => {
    expect(await evalInput('markPrice')).toBeCloseTo(104.5);
  });

  it('openInterest → open_interest свечи', async () => {
    expect(await evalInput('openInterest')).toBe(2000000);
  });

  it('без source (или close) → close как раньше', async () => {
    expect(await evalInput(undefined)).toBe(105);
    expect(await evalInput('close')).toBe(105);
  });

  it('fundingRate getHistory → хронологическая серия funding_rate', async () => {
    expect(await evalInput('fundingRate', true)).toEqual([0.001, -0.0025]);
  });

  it('markPrice fallback на close, funding/OI fallback на 0 при отсутствии поля', async () => {
    const bare = [{ close: '50' }];
    expect(await service.evaluateNode({ type: 'input', source: 'markPrice' }, bare, false, {}, { backtestMode: true })).toBe(50);
    expect(await service.evaluateNode({ type: 'input', source: 'fundingRate' }, bare, false, {}, { backtestMode: true })).toBe(0);
    expect(await service.evaluateNode({ type: 'input', source: 'openInterest' }, bare, false, {}, { backtestMode: true })).toBe(0);
  });
});
