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
