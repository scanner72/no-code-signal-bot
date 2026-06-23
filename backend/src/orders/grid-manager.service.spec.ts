import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GridManagerService } from './grid-manager.service';
import { Strategy } from '../strategies/strategy.entity';
import { CandlesService } from '../candles/candles.service';
import { IndicatorsService } from '../indicators/indicators.service';

describe('GridManagerService', () => {
  let service: GridManagerService;
  let strategyRepositoryMock: any;
  let candlesServiceMock: any;
  let indicatorsServiceMock: any;

  beforeEach(async () => {
    strategyRepositoryMock = {
      findOne: jest.fn(),
    };

    candlesServiceMock = {
      getLatestCandles: jest.fn(),
    };

    indicatorsServiceMock = {
      calculateATR: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GridManagerService,
        {
          provide: getRepositoryToken(Strategy),
          useValue: strategyRepositoryMock,
        },
        {
          provide: CandlesService,
          useValue: candlesServiceMock,
        },
        {
          provide: IndicatorsService,
          useValue: indicatorsServiceMock,
        },
      ],
    }).compile();

    service = module.get<GridManagerService>(GridManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate standard percentage-based grid levels when useAtrSpacing is false', async () => {
    const mockStrategy = {
      id: 1,
      pair: 'BTC/USDT',
      timeframe: '1h',
      execution_settings: {
        useAtrSpacing: false,
        gridLevelsCount: 3,
        totalExposure: 300,
        spacingPercent: 1.0,
        distribution: 'arithmetic',
      },
    };

    strategyRepositoryMock.findOne.mockResolvedValue(mockStrategy);

    const levels = await service.calculateGridLevels(1, 50000);

    expect(levels).toBeDefined();
    expect(levels.length).toBe(3);
    // Spacing step = 50000 * 0.01 = 500
    // Level 1: price = 50000 - 500 = 49500, amount = 100 / 49500
    expect(levels[0].price).toBe(49500);
    expect(levels[1].price).toBe(49000);
    expect(levels[2].price).toBe(48500);
    expect(levels[0].amount).toBeCloseTo(100 / 49500, 4);
  });

  it('should calculate dynamic ATR-adjusted grid levels when useAtrSpacing is true', async () => {
    const mockStrategy = {
      id: 1,
      pair: 'BTC/USDT',
      timeframe: '1h',
      execution_settings: {
        useAtrSpacing: true,
        atrPeriod: 14,
        atrTimeframe: '1h',
        atrMultiplier: 2.0,
        gridLevelsCount: 2,
        totalExposure: 200,
        distribution: 'arithmetic',
      },
    };

    strategyRepositoryMock.findOne.mockResolvedValue(mockStrategy);
    candlesServiceMock.getLatestCandles.mockResolvedValue(
      Array(20).fill({ high: 50200, low: 49800, close: 50000 })
    );
    indicatorsServiceMock.calculateATR.mockReturnValue([100]); // ATR value is 100

    const levels = await service.calculateGridLevels(1, 50000);

    expect(levels).toBeDefined();
    expect(levels.length).toBe(2);
    // Spacing step = ATR(100) * 2.0 = 200
    // Level 1: price = 50000 - 200 = 49800
    // Level 2: price = 50000 - 400 = 49600
    expect(levels[0].price).toBe(49800);
    expect(levels[1].price).toBe(49600);
  });
});
