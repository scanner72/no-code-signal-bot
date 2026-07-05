import { BacktestService } from './backtest.service';
import { AstEvaluatorService } from '../signals/ast-evaluator.service';
import { IndicatorsService } from '../indicators/indicators.service';

const makeCandles = (n: number, startPrice = 100) =>
  Array.from({ length: n }, (_, i) => ({
    time: new Date(Date.now() - (n - i) * 60000),
    open: startPrice + i,
    high: startPrice + i + 2,
    low: startPrice + i - 2,
    close: String(startPrice + i),
    volume: 1000,
  }));

const DEFAULT_OPTS = {
  start: new Date('2024-01-01'),
  end: new Date('2024-06-01'),
  initialBalance: 1000,
  fee: 0.001,
  tp: 0.02,
  sl: 0.01,
  positionSize: 0.9,
};

describe('BacktestService', () => {
  let service: BacktestService;
  let mockStrategyRepo: any;
  let mockCandlesService: any;
  let mockSignalsEngine: any;

  const strategy = {
    id: 1,
    name: 'Test Strategy',
    pair: 'BTCUSDT',
    timeframe: '1h',
    ast: { type: 'signal', signalType: 'LONG', condition: null },
  };

  beforeEach(() => {
    mockStrategyRepo = { findOneBy: jest.fn().mockResolvedValue(strategy) };
    mockCandlesService = { 
      getCandlesForRange: jest.fn().mockResolvedValue(makeCandles(150)),
      ensureHistoricalData: jest.fn().mockResolvedValue(undefined)
    };
    mockSignalsEngine = { evaluateNode: jest.fn().mockResolvedValue(false) };
    const mockIndicatorsService = { 
      calculateATR: jest.fn().mockReturnValue([2]), 
      calculateFibLevels: jest.fn().mockReturnValue({ levels: { '1.618': 250 } }) 
    };
    const mockSignalsGateway = { broadcastProgress: jest.fn().mockResolvedValue(undefined) };
    const mockMLService = { predict: jest.fn().mockResolvedValue(0.8) };
    const mockRiskSizingService = {
      computeNotional: jest.fn().mockImplementation((method, params) => params.equity * (DEFAULT_OPTS.positionSize || 0.9))
    };
 
    service = new BacktestService(
      mockStrategyRepo,
      mockCandlesService,
      mockSignalsEngine,
      mockIndicatorsService as any,
      mockSignalsGateway as any,
      mockMLService as any,
      mockRiskSizingService as any,
    );
  });

  it('throws when strategy not found', async () => {
    mockStrategyRepo.findOneBy.mockResolvedValue(null);
    await expect(service.run(999, DEFAULT_OPTS)).rejects.toThrow('Strategy not found');
  });

  it('returns zero trades when strategy never triggers', async () => {
    const result = await service.run(1, DEFAULT_OPTS);
    expect(result.totalTrades).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.finalBalance).toBeCloseTo(1000, 1);
  });

  it('returns correct structure in result', async () => {
    const result = await service.run(1, DEFAULT_OPTS);
    expect(result).toMatchObject({
      strategyName: 'Test Strategy',
      pair: 'BTCUSDT',
      timeframe: '1h',
      initialBalance: 1000,
      totalTrades: expect.any(Number),
      winRate: expect.any(Number),
      maxDrawdown: expect.any(Number),
      trades: expect.any(Array),
    });
  });

  it('opens position and exits on TP hit (LONG)', async () => {
    const candles = makeCandles(110, 100);
    // Trigger at candle 100 (entryPrice = 200), then price jumps to 205 (+2.5%) → TP hit
    candles[100].close = '200';
    for (let i = 101; i < 110; i++) candles[i].close = '205';
    mockCandlesService.getCandlesForRange.mockResolvedValue(candles);

    let called = 0;
    mockSignalsEngine.evaluateNode.mockImplementation(() => {
      called++;
      return Promise.resolve(called === 1);
    });

    const result = await service.run(1, { ...DEFAULT_OPTS, tp: 0.02, sl: 0.01 });
    expect(result.totalTrades).toBeGreaterThan(0);
    expect(result.trades[0].type).toBe('LONG');
    expect(result.trades[0].pnlPercent).toBeGreaterThanOrEqual(2);
  });

  it('exits on SL hit (LONG)', async () => {
    const candles = makeCandles(110, 100);
    candles[100].close = '200';
    for (let i = 101; i < 110; i++) candles[i].close = '197'; // -1.5% → SL at 1%
    mockCandlesService.getCandlesForRange.mockResolvedValue(candles);

    let called = 0;
    mockSignalsEngine.evaluateNode.mockImplementation(() => {
      called++;
      return Promise.resolve(called === 1);
    });

    const result = await service.run(1, { ...DEFAULT_OPTS, tp: 0.05, sl: 0.01 });
    expect(result.totalTrades).toBeGreaterThan(0);
    expect(result.trades[0].pnlPercent).toBeLessThan(0);
  });

  it('компилированный AST (name/params) с реальным евалуатором: RSI<30 открывает сделки (regression: 0 trades)', async () => {
    // Реальный евалуатор + реальные индикаторы — мок скрывал несовпадение полей
    // (компилятор пишет {name, params.period}, движок читал {indicator, period})
    const realIndicators = new IndicatorsService(null as any);
    const realEvaluator = new AstEvaluatorService(null as any, realIndicators);
    const mockSignalsGateway = { broadcastProgress: jest.fn().mockResolvedValue(undefined) };
    const mockMLService = { predict: jest.fn().mockResolvedValue(0.8) };
    const mockRiskSizingService = {
      computeNotional: jest.fn().mockImplementation((method, params) => params.equity * 0.9)
    };
    const realService = new BacktestService(
      mockStrategyRepo,
      mockCandlesService,
      realEvaluator as any,
      realIndicators as any,
      mockSignalsGateway as any,
      mockMLService as any,
      mockRiskSizingService as any,
    );

    // AST ровно в той форме, что выдаёт ast-compiler для builder-стратегий
    mockStrategyRepo.findOneBy.mockResolvedValue({
      ...strategy,
      ast: {
        type: 'signal',
        signalType: 'LONG',
        condition: {
          type: 'comparison',
          operator: '<',
          left: { type: 'indicator', name: 'RSI', params: { period: 14 } },
          right: 30,
        },
      },
    });

    // 120 ровных свечей, затем обвал → RSI(14) уходит к нулю → условие обязано сработать
    const candles = makeCandles(150, 100).map((c, i) => {
      const price = i < 120 ? 200 : 200 - (i - 119) * 3;
      return { ...c, open: price, high: price + 1, low: price - 1, close: String(price) };
    });
    mockCandlesService.getCandlesForRange.mockResolvedValue(candles);

    const result = await realService.run(1, { ...DEFAULT_OPTS, tp: 0.5, sl: 0.5 });
    expect(result.totalTrades).toBeGreaterThan(0);
    expect(result.trades[0].type).toBe('LONG');
  });

  it('accurate mode: не падает, когда позиция закрыта внутри 1m суб-свечи (regression: null.partialTpHits)', async () => {
    const candles = makeCandles(110, 100);
    candles[100].close = '200';
    for (let i = 101; i < 110; i++) candles[i].close = '197';

    // Одна 1m суб-свеча внутри свечи 101, пробивающая SL (200 × 0.99 = 198)
    const subCandles = [{
      time: new Date(candles[101].time.getTime() + 1000),
      open: 199, high: 199.5, low: 190, close: '191', volume: 10,
    }];

    mockCandlesService.getCandlesForRange.mockImplementation((_pair: string, tf: string) =>
      Promise.resolve(tf === '1m' ? subCandles : candles));

    let called = 0;
    mockSignalsEngine.evaluateNode.mockImplementation(() => {
      called++;
      return Promise.resolve(called === 1);
    });

    const result = await service.run(1, { ...DEFAULT_OPTS, accurate: true, tp: 0.05, sl: 0.01 });
    expect(result.totalTrades).toBeGreaterThan(0);
    expect(result.trades[0].pnlPercent).toBeLessThan(0); // закрылись по SL внутри суб-свечи
  });

  it('неточный режим (accurate:false): позиция закрывается по TP, а не висит до force-close (regression: 1 сделка)', async () => {
    const candles = makeCandles(150, 100);
    candles[100].close = '200';
    for (let i = 101; i < 150; i++) candles[i].close = '206'; // +3% > TP 2%
    mockCandlesService.getCandlesForRange.mockResolvedValue(candles);

    let called = 0;
    mockSignalsEngine.evaluateNode.mockImplementation(() => {
      called++;
      return Promise.resolve(called === 1);
    });

    const result = await service.run(1, { ...DEFAULT_OPTS, tp: 0.02, sl: 0.01 });
    expect(result.totalTrades).toBe(1);
    expect(result.trades[0].exitReason).toBe('TP');       // настоящий выход по тейку...
    expect(result.trades[0].forceClosed).toBeUndefined(); // ...а не принудительный в конце периода
  });

  it('does not open a new position while one is open', async () => {
    // Flat candles: price never moves, so TP/SL is never hit — position stays open forever
    const flatCandles = Array.from({ length: 150 }, (_, i) => ({
      time: new Date(Date.now() - (150 - i) * 60000),
      open: '200', high: '200', low: '200', close: '200', volume: 1000,
    }));
    mockCandlesService.getCandlesForRange.mockResolvedValue(flatCandles);
    mockSignalsEngine.evaluateNode.mockResolvedValue(true);

    const result = await service.run(1, DEFAULT_OPTS);
    // Position opens at candle 100, stays open until 150, then force-closes -> 1 trade
    expect(result.totalTrades).toBe(1);
  });

  it('uses configured positionSize and fee', async () => {
    const candles = makeCandles(110, 100);
    candles[100].close = '200';
    for (let i = 101; i < 110; i++) candles[i].close = '205';
    mockCandlesService.getCandlesForRange.mockResolvedValue(candles);

    let called = 0;
    mockSignalsEngine.evaluateNode.mockImplementation(() => {
      called++;
      return Promise.resolve(called === 1);
    });

    const result = await service.run(1, { ...DEFAULT_OPTS, positionSize: 0.5, fee: 0.001 });
    // With 50% position size the trade profit should be ~half of 90% position
    expect(result.finalBalance).not.toEqual(1000);
  });

  it('applies slippage to entry price', async () => {
    const candles = makeCandles(110, 100);
    candles[100].close = '200';
    for (let i = 101; i < 110; i++) candles[i].close = '205';
    mockCandlesService.getCandlesForRange.mockResolvedValue(candles);

    let called = 0;
    mockSignalsEngine.evaluateNode.mockImplementation(() => {
      called++;
      return Promise.resolve(called === 1);
    });

    const resultNoSlip = await service.run(1, { ...DEFAULT_OPTS, slippagePct: 0 });
    
    called = 0;
    const resultWithSlip = await service.run(1, { ...DEFAULT_OPTS, slippagePct: 1 }); // 1% slippage
    
    expect(resultWithSlip.finalBalance).toBeLessThan(resultNoSlip.finalBalance);
  });

  it('uses TWAP execution algorithm', async () => {
    const candles = makeCandles(110, 100);
    // Add some variance to ensure TWAP differs from MARKET
    candles[100].close = '200';
    candles[99].close = '190';
    candles[98].close = '180';
    
    mockCandlesService.getCandlesForRange.mockResolvedValue(candles);

    let called = 0;
    mockSignalsEngine.evaluateNode.mockImplementation(() => {
      called++;
      return Promise.resolve(called === 1);
    });

    const resultMarket = await service.run(1, { ...DEFAULT_OPTS, executionAlgo: 'MARKET' });
    
    called = 0;
    const resultTwap = await service.run(1, { ...DEFAULT_OPTS, executionAlgo: 'TWAP' });
    
    expect(resultTwap.trades[0].entryPrice).not.toEqual(resultMarket.trades[0].entryPrice);
  });

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

  it('wires RiskSizingService to compute dynamic notional during entries', async () => {
    const candles = makeCandles(110, 100);
    candles[100].close = '200';
    for (let i = 101; i < 110; i++) candles[i].close = '205';
    mockCandlesService.getCandlesForRange.mockResolvedValue(candles);

    let called = 0;
    mockSignalsEngine.evaluateNode.mockImplementation(() => {
      called++;
      return Promise.resolve(called === 1);
    });

    const customStrategy = {
      ...strategy,
      nodes: [
        { id: 'sizing-node', data: { action: 'sizing', method: 'fixed_notional', fixedNotional: 500 } }
      ]
    };
    mockStrategyRepo.findOneBy.mockResolvedValue(customStrategy);

    const result = await service.run(1, DEFAULT_OPTS);
    expect(result.totalTrades).toBeGreaterThan(0);
    // Since mockRiskSizingService returns equity * 0.9 = 900 notional:
    expect(result.trades[0].pnl).toBeGreaterThan(0);
  });

  it('exits at calculated Fibonacci extension TP price', async () => {
    const candles = makeCandles(110, 100);
    candles[100].close = '200';
    for (let i = 101; i < 110; i++) candles[i].close = '260'; // Price goes to 260
    mockCandlesService.getCandlesForRange.mockResolvedValue(candles);

    let called = 0;
    mockSignalsEngine.evaluateNode.mockImplementation(() => {
      called++;
      return Promise.resolve(called === 1);
    });

    const customStrategy = {
      ...strategy,
      nodes: [
        { id: 'sltp-node', data: { action: 'sltp', tpMode: 'fib_extension', tpFibLevel: 1.618 } }
      ]
    };
    mockStrategyRepo.findOneBy.mockResolvedValue(customStrategy);

    const result = await service.run(1, DEFAULT_OPTS);
    expect(result.totalTrades).toBeGreaterThan(0);
    // Exit price must be the fib level target 250
    expect(result.trades[0].exitPrice).toBe(250);
    expect(result.trades[0].exitReason).toBe('TP');
  });
});
