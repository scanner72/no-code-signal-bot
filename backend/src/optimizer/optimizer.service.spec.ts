import { OptimizerService } from './optimizer.service';
import { Strategy } from '../strategies/strategy.entity';

describe('OptimizerService', () => {
  let service: OptimizerService;
  let mockStrategyRepo: any;
  let mockBacktestService: any;
  let mockCandlesService: any;
  let mockSignalsGateway: any;

  const mockStrategy: Strategy = {
    id: 1,
    name: 'Evolution Test Strategy',
    pair: 'BTCUSDT',
    timeframe: '1h',
    is_active: false,
    is_paper_trading: true,
    execution_settings: {},
    ast: {
      type: 'signal',
      nodes: [
        {
          id: 'rsi_node',
          type: 'indicator',
          data: {
            name: 'RSI',
            params: {
              period: 14,
              threshold: 30,
            },
          },
        },
      ],
      edges: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const mockBacktestResult = {
    totalReturn: 25.5,
    totalTrades: 12,
    sharpeRatio: 1.8,
    maxDrawdown: 5.2,
    winRate: 65,
    profitFactor: 2.1,
  };

  beforeEach(() => {
    mockStrategyRepo = {
      findOneBy: jest.fn().mockResolvedValue(mockStrategy),
    };
    mockBacktestService = {
      runWithAst: jest.fn().mockResolvedValue(mockBacktestResult),
    };
    mockCandlesService = {
      ensureHistoricalData: jest.fn().mockResolvedValue(undefined),
      getCandlesForRange: jest.fn().mockResolvedValue(Array(50).fill({})),
    };
    mockSignalsGateway = {
      broadcastBacktestProgress: jest.fn(),
    };

    service = new OptimizerService(
      mockStrategyRepo,
      mockBacktestService,
      mockCandlesService,
      mockSignalsGateway,
    );
  });

  it('runs evolutionary genetic optimization and returns best candidate', async () => {
    const opts = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-10'),
      initialBalance: 1000,
      fee: 0.001,
      tp: 0.02,
      sl: 0.01,
      positionSize: 0.9,
    };

    const results = await service.runOptimization(1, opts, []);
    
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      profit: 25.5,
      trades: 12,
      sharpe: 1.8,
      maxDrawdown: 5.2,
      winRate: 65,
      profitFactor: 2.1,
    });
    
    // Verifies WebSocket progress broadcasts are triggered
    expect(mockSignalsGateway.broadcastBacktestProgress).toHaveBeenCalled();
  });

  it('throws when strategy has no numeric parameters to optimize', async () => {
    const strategyWithoutParams = {
      ...mockStrategy,
      ast: {
        nodes: [
          {
            id: 'empty_node',
            data: {},
          },
        ],
      },
    };
    mockStrategyRepo.findOneBy.mockResolvedValue(strategyWithoutParams);

    const opts = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-10'),
      initialBalance: 1000,
      fee: 0.001,
      tp: 0.02,
      sl: 0.01,
      positionSize: 0.9,
    };

    await expect(service.runOptimization(1, opts, [])).rejects.toThrow(
      'No numeric parameters found to optimize'
    );
  });
});
