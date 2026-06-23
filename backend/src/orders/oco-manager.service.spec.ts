import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OcoManagerService } from './oco-manager.service';
import { OcoBracketOrder, OcoStatus } from './oco-bracket-order.entity';
import { Strategy } from '../strategies/strategy.entity';
import { CrossExchangeService } from '../cross-exchange/cross-exchange.service';

describe('OcoManagerService', () => {
  let service: OcoManagerService;
  let ocoRepositoryMock: any;
  let strategyRepositoryMock: any;
  let crossExchangeServiceMock: any;

  beforeEach(async () => {
    ocoRepositoryMock = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 1, ...dto })),
      findOne: jest.fn(),
    };

    strategyRepositoryMock = {
      findOne: jest.fn(),
    };

    crossExchangeServiceMock = {
      getExchange: jest.fn().mockReturnValue({
        cancelOrder: jest.fn().mockResolvedValue({ id: 'cancelled_order_id' }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcoManagerService,
        {
          provide: getRepositoryToken(OcoBracketOrder),
          useValue: ocoRepositoryMock,
        },
        {
          provide: getRepositoryToken(Strategy),
          useValue: strategyRepositoryMock,
        },
        {
          provide: CrossExchangeService,
          useValue: crossExchangeServiceMock,
        },
      ],
    }).compile();

    service = module.get<OcoManagerService>(OcoManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an OCO bracket order', async () => {
    const bracket = await service.createOcoBracket(1, 'BTC/USDT', 0.1, 'tp_123', 'sl_123', 50000, 45000);
    expect(bracket).toBeDefined();
    expect(bracket.tp_order_id).toBe('tp_123');
    expect(bracket.sl_order_id).toBe('sl_123');
    expect(ocoRepositoryMock.create).toHaveBeenCalled();
    expect(ocoRepositoryMock.save).toHaveBeenCalled();
  });

  it('should cancel the opposite order when TP is filled', async () => {
    const mockBracket = {
      id: 1,
      strategy_id: 1,
      pair: 'BTC/USDT',
      tp_order_id: 'tp_123',
      sl_order_id: 'sl_123',
      tp_price: 50000,
      sl_price: 45000,
      amount: 0.1,
      status: OcoStatus.ACTIVE,
    };

    ocoRepositoryMock.findOne.mockResolvedValue(mockBracket);
    strategyRepositoryMock.findOne.mockResolvedValue({
      id: 1,
      execution_settings: { exchangeId: 'binance' },
    });

    await service.handleOrderUpdate('tp_123', 'closed');

    expect(ocoRepositoryMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OcoStatus.TP_FILLED,
      }),
    );
    expect(crossExchangeServiceMock.getExchange).toHaveBeenCalledWith('binance', undefined);
  });
});
