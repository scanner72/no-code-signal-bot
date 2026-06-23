import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlgoExecutionService } from './algo-execution.service';
import { AlgoExecutionState, AlgoExecutionStatus } from './algo-execution-state.entity';
import { Strategy } from '../strategies/strategy.entity';
import { CandlesService } from '../candles/candles.service';
import { BinanceApiService } from '../candles/binance-api.service';

describe('AlgoExecutionService', () => {
  let service: AlgoExecutionService;
  let algoRepoMock: any;
  let strategyRepoMock: any;
  let orderQueueMock: any;
  let candlesServiceMock: any;
  let binanceApiMock: any;

  beforeEach(async () => {
    algoRepoMock = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 101, ...data })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    strategyRepoMock = {
      findOne: jest.fn(),
    };

    orderQueueMock = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      getJob: jest.fn().mockResolvedValue({
        remove: jest.fn().mockResolvedValue(true),
      }),
    };

    candlesServiceMock = {
      getLatestCandles: jest.fn(),
    };

    binanceApiMock = {
      getExchange: jest.fn(),
      fetchCandles: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlgoExecutionService,
        {
          provide: getRepositoryToken(AlgoExecutionState),
          useValue: algoRepoMock,
        },
        {
          provide: getRepositoryToken(Strategy),
          useValue: strategyRepoMock,
        },
        {
          provide: 'BullQueue_orders-execution',
          useValue: orderQueueMock,
        },
        {
          provide: CandlesService,
          useValue: candlesServiceMock,
        },
        {
          provide: BinanceApiService,
          useValue: binanceApiMock,
        },
      ],
    }).compile();

    service = module.get<AlgoExecutionService>(AlgoExecutionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should schedule TWAP slices and save the state', async () => {
    const strategyId = 12;
    const pair = 'BTC/USDT';
    const side = 'buy';
    const totalAmount = 1000;
    const settings = {
      algoSlicesCount: 5,
      algoDurationMinutes: 10,
    };

    const result = await service.scheduleTwap(strategyId, pair, side, totalAmount, settings);

    expect(result).toBeDefined();
    expect(result.strategyId).toBe(strategyId);
    expect(result.algoType).toBe('TWAP');
    expect(result.status).toBe(AlgoExecutionStatus.RUNNING);
    expect(algoRepoMock.create).toHaveBeenCalled();
    expect(algoRepoMock.save).toHaveBeenCalled();
    expect(orderQueueMock.add).toHaveBeenCalledTimes(5);
  });

  it('should schedule VWAP slices using historical volume profile if available', async () => {
    const strategyId = 12;
    const pair = 'BTC/USDT';
    const side = 'buy';
    const totalAmount = 1000;
    const settings = {
      algoSlicesCount: 4,
      algoDurationMinutes: 20,
      vwapLookbackDays: 3,
    };

    // Mock candle data to calculate volume profiles
    const now = Date.now();
    const mockCandles = Array.from({ length: 288 }, (_, i) => ({
      time: new Date(now - i * 5 * 60000),
      volume: 100,
    }));

    candlesServiceMock.getLatestCandles.mockResolvedValue(mockCandles);

    const result = await service.scheduleVwap(strategyId, pair, side, totalAmount, settings);

    expect(result).toBeDefined();
    expect(result.strategyId).toBe(strategyId);
    expect(result.algoType).toBe('VWAP');
    expect(algoRepoMock.save).toHaveBeenCalled();
    expect(orderQueueMock.add).toHaveBeenCalledTimes(4);
  });

  it('should cancel running algo executions when strategy is deactivated', async () => {
    const activeExecutions = [
      {
        id: 101,
        strategyId: 5,
        status: AlgoExecutionStatus.RUNNING,
        bullJobIds: ['job-1', 'job-2'],
      },
    ];

    algoRepoMock.find.mockResolvedValue(activeExecutions);
    algoRepoMock.findOne.mockResolvedValue(activeExecutions[0]);

    await service.handleStrategyDeactivated({ strategyId: 5 });

    expect(algoRepoMock.find).toHaveBeenCalled();
    expect(orderQueueMock.getJob).toHaveBeenCalledWith('job-1');
    expect(orderQueueMock.getJob).toHaveBeenCalledWith('job-2');
    expect(algoRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 101,
        status: AlgoExecutionStatus.CANCELLED,
      }),
    );
  });
});
