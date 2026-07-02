import { PaperAccountsService } from './paper-accounts.service';

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  findOneBy: jest.fn().mockResolvedValue(null),
  findOneByOrFail: jest.fn(),
  save: jest.fn().mockImplementation(async (x: any) => x),
  create: jest.fn().mockImplementation((x: any) => x),
});

describe('PaperAccountsService.syncPaperAccounts', () => {
  let service: PaperAccountsService;
  let accountRepo: any;
  let tradeRepo: any;

  beforeEach(() => {
    accountRepo = makeRepo();
    tradeRepo = makeRepo();
    service = new PaperAccountsService(accountRepo, tradeRepo, null as any);
  });

  const paperNode = (id: string, data: any = {}) => ({
    id,
    type: 'paper_trading_output',
    data: { label: 'A', startingCapital: 500, leverage: 3, riskPercent: 20, sl: '1%', tp: '3%', ...data },
  });

  it('создаёт аккаунт для новой ноды с балансом = стартовому капиталу', async () => {
    await service.syncPaperAccounts({ id: 7, nodes: [paperNode('n1')] });
    expect(accountRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy_id: 7,
        node_id: 'n1',
        starting_capital: 500,
        current_balance: 500,
        leverage: 3,
        risk_percent: 20,
        sl_percent: 1,
        tp_percent: 3,
        is_active: true,
      }),
    );
  });

  it('обновляет конфиг существующего аккаунта, НЕ трогая current_balance', async () => {
    accountRepo.find.mockResolvedValue([
      { id: 1, strategy_id: 7, node_id: 'n1', current_balance: 777, starting_capital: 500, is_active: true },
    ]);
    await service.syncPaperAccounts({ id: 7, nodes: [paperNode('n1', { leverage: 10, startingCapital: 2000 })] });
    const saved = accountRepo.save.mock.calls[0][0];
    expect(saved.leverage).toBe(10);
    expect(saved.starting_capital).toBe(2000); // поле обновляется (влияет на будущий reset)
    expect(saved.current_balance).toBe(777);   // баланс не сброшен
  });

  it('деактивирует аккаунты удалённых нод', async () => {
    accountRepo.find.mockResolvedValue([
      { id: 1, strategy_id: 7, node_id: 'gone', current_balance: 100, is_active: true },
    ]);
    await service.syncPaperAccounts({ id: 7, nodes: [] });
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ node_id: 'gone', is_active: false }));
  });

  it('реактивирует аккаунт, если нода вернулась (undo)', async () => {
    accountRepo.find.mockResolvedValue([
      { id: 1, strategy_id: 7, node_id: 'n1', current_balance: 100, is_active: false },
    ]);
    await service.syncPaperAccounts({ id: 7, nodes: [paperNode('n1')] });
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ node_id: 'n1', is_active: true }));
  });

  it('игнорирует стратегию без paper-нод и без аккаунтов', async () => {
    await service.syncPaperAccounts({ id: 7, nodes: [{ id: 'x', type: 'signal', data: {} }] });
    expect(accountRepo.save).not.toHaveBeenCalled();
  });
});
