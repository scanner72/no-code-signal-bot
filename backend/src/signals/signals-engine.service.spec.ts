import { SignalsEngineService } from './signals-engine.service';

const makeCandles = (n = 50, basePrice = 100) =>
  Array.from({ length: n }, (_, i) => ({
    time: new Date(Date.now() - i * 60000), // i=0 is current
    open: basePrice + (n - i),
    high: basePrice + (n - i) + 2,
    low: basePrice + (n - i) - 2,
    close: basePrice + (n - i),
    volume: 1000,
    mark_price: basePrice + (n - i),
    funding_rate: 0.001,
  }));

describe('SignalsEngineService.evaluateNode', () => {
  let service: SignalsEngineService;
  let mockIndicators: any;
  let mockKronos: any;

  beforeEach(() => {
    mockIndicators = {
      calculateRSI: jest.fn().mockReturnValue([30, 35, 40, 45, 50]),
      calculateSMA: jest.fn().mockReturnValue([100, 110, 120]),
      calculateEMA: jest.fn().mockReturnValue([100, 110, 120]),
      calculateMACD: jest.fn().mockReturnValue([{ MACD: 1, signal: 0.5, histogram: 0.5 }]),
      calculateBollingerBands: jest.fn().mockReturnValue([{ upper: 110, middle: 100, lower: 90 }]),
      calculateStochastic: jest.fn().mockReturnValue([{ k: 80, d: 75 }]),
      calculateVolume: jest.fn().mockReturnValue(1000),
      calculateATR: jest.fn().mockReturnValue([2]),
      checkCrossover: jest.fn().mockReturnValue(false),
      detectPumpDump: jest.fn().mockReturnValue({ isPump: false, isDump: false }),
      detectFVG: jest.fn().mockReturnValue([]),
      detectOrderBlocks: jest.fn().mockReturnValue([]),
      detectMarketStructure: jest.fn().mockReturnValue({ trend: 'bullish' }),
      detectLiquiditySweeps: jest.fn().mockReturnValue([]),
      detectDailyBias: jest.fn().mockReturnValue('bullish'),
      detectPO3: jest.fn().mockReturnValue({ phase: 'accumulation' }),
    };

    mockKronos = {
      getFinvizScreener: jest.fn().mockResolvedValue({
        status: 'success',
        data: [
          { ticker: 'AAPL', company: 'Apple Inc', price: '182.10', volume: '35,240,100', change: '+2.15%' },
          { ticker: 'NVDA', company: 'NVIDIA Corp', price: '925.30', volume: '42,105,300', change: '+6.42%' },
        ]
      })
    };

    const mockCrossExchange = {
      getExchange: jest.fn().mockReturnValue({
        fetchBalance: jest.fn().mockResolvedValue({ total: { USDT: 5000 }, free: { USDT: 5000 } })
      })
    };
    const mockRiskSizing = {
      computeNotional: jest.fn().mockReturnValue(1000)
    };

    service = new SignalsEngineService(
      null as any, // strategyRepo
      null as any, // sentimentService
      null as any, // candlesService
      mockIndicators,
      null as any, // signalsService
      null as any, // telegramService
      null as any, // signalsWsService
      null as any, // discordService
      null as any, // binanceApiService
      null as any, // settingsService
      null as any, // futuresWsService
      null as any, // riskManager
      null as any, // mlService
      null as any, // hermesService
      null as any, // paperTradingService
      null as any, // heymMcpService
      null as any, // ldrService
      mockKronos,
      null as any, // orderbookService
      null as any, // ocoManagerService
      null as any, // ccxtQueueService
      null as any, // algoExecutionService
      null as any, // paperAccountsService
      mockCrossExchange as any,
      mockRiskSizing as any,
      null as any, // gridManagerService
    );
  });


  describe('input node', () => {
    const candles = makeCandles(5, 200);

    it('returns mark_price', async () => {
      const result = await service.evaluateNode({ type: 'input', source: 'markPrice' }, candles);
      expect(result).toBe(205); // basePrice(200) + n(5)
    });

    it('returns funding_rate', async () => {
      const result = await service.evaluateNode({ type: 'input', source: 'fundingRate' }, candles);
      expect(result).toBe(0.001);
    });
  });

  describe('indicator node', () => {
    const candles = makeCandles(50);

    it('RSI — returns last value', async () => {
      const result = await service.evaluateNode({ type: 'indicator', name: 'RSI', params: { period: 14 } }, candles);
      expect(result).toBe(50);
    });
  });

  describe('custom_code node', () => {
    const candles = makeCandles(10, 100);

    it('executes custom JS logic with close prices', async () => {
      const node = {
        type: 'custom_code',
        code: 'return close[0] > close[1];'
      };
      const result = await service.evaluateNode(node, candles);
      expect(result).toBe(true);
    });
  });

  describe('deribit_pcr node', () => {
    const candles = makeCandles(5);

    it('returns simulated PCR in backtest mode', async () => {
      const result = await service.evaluateNode(
        { type: 'deribit_pcr' }, 
        candles, 
        false, 
        { isBacktest: true }
      );
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0.5);
      expect(result).toBeLessThanOrEqual(1.8);
    });
  });

  describe('fusion_combiner node', () => {
    const candles = makeCandles(5);

    it('aggregates signals with weights and triggers true if threshold is met', async () => {
      const fusionNode = {
        type: 'fusion_combiner',
        weights: {
          'op1': 0.6,
          'op2': 0.4
        },
        params: {
          threshold: 0.5
        },
        operands: [
          {
            sourceId: 'op1',
            ast: { type: 'input', source: 'markPrice', params: { operator: '>', threshold: 50 } }
          },
          {
            sourceId: 'op2',
            ast: { type: 'input', source: 'fundingRate', params: { operator: '>', threshold: 0.05 } }
          }
        ]
      };

      const context = { pair: 'BTCUSDT', signalType: 'LONG', metadata: {}, isBacktest: true };
      const result = await service.evaluateNode(fusionNode, candles, false, context);
      expect(result).toBe(false);

      fusionNode.operands[1].ast.params.threshold = 0.0001;
      const resultPass = await service.evaluateNode(fusionNode, candles, false, context);
      expect(resultPass).toBe(true);
    });
  });

  describe('portfolio_risk_sizer node', () => {
    const candles = makeCandles(50, 100);

    it('calculates optimal volume with ATR dynamic adaptation', async () => {
      const mockManager = {
        find: jest.fn().mockResolvedValue([]),
      };
      const mockStrategyRepo = {
        manager: mockManager,
      };

      (service as any).strategyRepository = mockStrategyRepo;

      const node = {
        type: 'portfolio_risk_sizer',
        params: {
          baseSize: 200,
          riskModel: 'atr_adaptive',
          correlationThreshold: 0.7,
          volatilityLookback: 14,
        },
      };

      const context = { pair: 'BTCUSDT', timeframe: '1h', metadata: {} as any };
      const result = await service.evaluateNode(node, candles, false, context);

      expect(result).toBe(true);
      expect(context.metadata.portfolioRisk).toBeDefined();
      expect(context.metadata.portfolioRisk.volume).toBeGreaterThan(0);
      expect(context.metadata.portfolioRisk.maxCorrelation).toBe(0);
      expect(context.metadata.portfolioRisk.riskMultiplier).toBeDefined();
    });
  });

  describe('mtf node', () => {
    const candles = makeCandles(50, 100);

    it('evaluates condition using the specified timeframe candles', async () => {
      const mtfNode = {
        type: 'mtf',
        timeframe: '4H',
        condition: {
          type: 'input',
          source: 'markPrice',
          params: { operator: '>', threshold: 50 },
        },
      };

      const mockCandlesService = {
        getLatestCandles: jest.fn().mockResolvedValue(makeCandles(10, 120)),
      };
      (service as any).candlesService = mockCandlesService;

      const cache = new Map();
      const context = { pair: 'BTCUSDT', timeframe: '15m', cache, signalType: 'LONG' };
      const result = await service.evaluateNode(mtfNode, candles, false, context);

      expect(mockCandlesService.getLatestCandles).toHaveBeenCalledWith('BTCUSDT', '4H', 150);
      expect(result).toBe(true);
      expect(cache.has('4H')).toBe(true);
    });
  });

  describe('finviz_scanner node', () => {
    const candles = makeCandles(5);

    it('returns true if the stock is found and matches criteria', async () => {
      const node = {
        type: 'finviz_scanner',
        params: {
          signal: 'top_gainers',
          minVolume: '10,000,000',
          minPrice: 150,
        },
      };

      const context = { pair: 'AAPL/USD', metadata: {} as any };
      const result = await service.evaluateNode(node, candles, false, context);

      expect(result).toBe(true);
      expect(context.metadata.finviz).toBeDefined();
      expect(context.metadata.finviz.ticker).toBe('AAPL');
      expect(context.metadata.finviz.price).toBe(182.10);
    });

    it('returns false if criteria are not met', async () => {
      const node = {
        type: 'finviz_scanner',
        params: {
          signal: 'top_gainers',
          minVolume: '50,000,000', // AAPL has 35,240,100 volume -> false
          minPrice: 150,
        },
      };

      const context = { pair: 'AAPL/USD', metadata: {} as any };
      const result = await service.evaluateNode(node, candles, false, context);

      expect(result).toBe(false);
    });

    it('returns false if stock is not in list', async () => {
      const node = {
        type: 'finviz_scanner',
        params: {
          signal: 'top_gainers',
          minVolume: '1,000,000',
          minPrice: 10,
        },
      };

      const context = { pair: 'TSLA/USD', metadata: {} as any };
      const result = await service.evaluateNode(node, candles, false, context);

      expect(result).toBe(false);
    });
  });

  describe('llm_filter node', () => {
    const candles = makeCandles(5);

    // The Free AI provider (Qwen/DeepSeek scraping) was removed for ToS/legal
    // reasons; the node is now a pass-through that never blocks a signal.
    it('passes the signal through (no-op) regardless of params', async () => {
      const node = {
        type: 'llm_filter',
        params: { provider: 'deepseek', model: 'deepseek-reasoner', mockBacktest: false },
      };

      const context = { pair: 'BTCUSDT', timeframe: '1h', isBacktest: false, signalType: 'LONG' };
      const result = await service.evaluateNode(node, candles, false, context);
      expect(result).toBe(true);
    });
  });

  describe('getLiveNotionalAndExits', () => {
    const candles = makeCandles(60, 100);

    it('calculates position size using RiskSizingService if a sizing node is present', async () => {
      const mockStrategy = {
        id: 1,
        pair: 'BTCUSDT',
        timeframe: '1h',
        execution_settings: { enableLiveExecution: true, positionSize: 100 },
        nodes: [
          { data: { action: 'sizing', method: 'fixed_notional', fixedNotional: 500 } }
        ]
      } as any;

      const result = await (service as any).getLiveNotionalAndExits(mockStrategy, 'BTCUSDT', 100, 'LONG', candles);
      expect(result.amount).toBe(10); // 1000 / 100 (from mockRiskSizing mock returning 1000)
    });

    it('uses Fibonacci extension level for TP price if tpMode is fib_extension', async () => {
      mockIndicators.calculateFibLevels = jest.fn().mockReturnValue({ levels: { '1.618': 161.8 } });

      const mockStrategy = {
        id: 1,
        pair: 'BTCUSDT',
        timeframe: '1h',
        execution_settings: { enableLiveExecution: true, positionSize: 100 },
        nodes: [
          { data: { action: 'sltp', tpMode: 'fib_extension', tpFibLevel: 1.618, sl: '1%', tp: '2%' } }
        ]
      } as any;

      const result = await (service as any).getLiveNotionalAndExits(mockStrategy, 'BTCUSDT', 100, 'LONG', candles);
      expect(result.tpPrice).toBe(161.8);
      expect(result.slPrice).toBe(99); // 100 * (1 - 0.01)
    });
  });
});
