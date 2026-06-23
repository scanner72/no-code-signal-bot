import { FleetService } from './fleet.service';
import { BotInstance } from './bot-instance.entity';

describe('FleetService (Auto-scaling & Risk Protection)', () => {
  let service: FleetService;
  let mockInstanceRepo: any;
  let mockSignalsEngine: any;

  const mockInstance: BotInstance = {
    id: 1,
    name: 'Auto-Scaling Bot 1',
    pair: 'BTCUSDT',
    timeframe: '15m',
    status: 'RUNNING',
    initialBalance: 1000,
    currentBalance: 1000,
    totalPnL: 0,
    totalPnLPct: 0,
    tradesCount: 0,
    currentPosition: {
      type: 'LONG',
      entryPrice: 50000,
      time: new Date(),
    },
    settings: {
      consecutiveLosses: 0,
      sharpeRatio: 1.5,
      allocationMultiplier: 1.0,
      tradeHistory: [],
    },
  } as any;

  beforeEach(() => {
    mockInstanceRepo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      findOne: jest.fn().mockResolvedValue(mockInstance),
      find: jest.fn().mockResolvedValue([mockInstance]),
    };
    mockSignalsEngine = {
      checkStrategy: jest.fn().mockResolvedValue(null),
    };

    service = new FleetService(mockInstanceRepo, mockSignalsEngine);
  });

  it('correctly sets up initial settings structure on create', async () => {
    const res = await service.createInstance({ name: 'Fresh Bot' });
    expect(res.settings).toMatchObject({
      consecutiveLosses: 0,
      sharpeRatio: 1.5,
      allocationMultiplier: 1.0,
      tradeHistory: [],
    });
  });

  it('scales down allocation multiplier to 50% when consecutive losses hit 3', async () => {
    // Inject position exit signal that closes with a loss
    mockInstance.currentPosition = { type: 'LONG', entryPrice: 1000, time: new Date() };
    mockInstance.settings = {
      consecutiveLosses: 2, // will become 3
      sharpeRatio: 1.5,
      allocationMultiplier: 1.0,
      tradeHistory: [],
    };

    const signal = { type: 'EXIT', price: 900 }; // Loss of 100

    // Force execution
    await (service as any).handleExecution(mockInstance, signal);

    expect(mockInstance.settings.consecutiveLosses).toBe(3);
    expect(mockInstance.settings.allocationMultiplier).toBe(0.5); // Scaled down allocation!
    expect(mockInstance.status).toBe('RUNNING'); // Position size reduced but still running
  });

  it('triggers emergency stop and reallocates multiplier to farm stars on critical drawdown', async () => {
    mockInstance.currentPosition = { type: 'LONG', entryPrice: 1000, time: new Date() };
    mockInstance.currentBalance = 860; // already at drawdown, exit will increase it past 15%
    mockInstance.settings = {
      consecutiveLosses: 1,
      sharpeRatio: 0.8,
      allocationMultiplier: 1.0,
      tradeHistory: [],
    };

    const signal = { type: 'EXIT', price: 980 }; // Drawdown grows from 14% to 16% of 1000

    const mockStarBot = {
      id: 2,
      name: 'Star Bot 2',
      status: 'RUNNING',
      initialBalance: 1000,
      currentBalance: 1200,
      totalPnL: 200,
      settings: {
        sharpeRatio: 2.1,
        allocationMultiplier: 1.0,
      },
    };

    mockInstanceRepo.find.mockResolvedValue([mockInstance, mockStarBot]);

    await (service as any).handleExecution(mockInstance, signal);

    // Verify instance stopped
    expect(mockInstance.status).toBe('STOPPED');
    expect(mockInstance.settings.allocationMultiplier).toBe(0.0);

    // Verify Top Farm Star bot received boosted allocation!
    expect(mockStarBot.settings.allocationMultiplier).toBe(1.25);
  });
});
