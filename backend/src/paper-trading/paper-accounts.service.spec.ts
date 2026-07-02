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

describe('PaperAccountsService.openAccountTrade', () => {
  let service: PaperAccountsService;
  let accountRepo: any;
  let tradeRepo: any;

  const account = { id: 5, strategy_id: 7, current_balance: 1000, risk_percent: 10, leverage: 5 } as any;

  beforeEach(() => {
    accountRepo = makeRepo();
    tradeRepo = makeRepo();
    accountRepo.findOneByOrFail.mockResolvedValue({ ...account });
    service = new PaperAccountsService(accountRepo, tradeRepo, null as any);
  });

  it('открывает сделку: маржа = 10% от баланса, баланс уменьшается', async () => {
    const trade = await service.openAccountTrade(account, 'BTCUSDT', 'LONG', 50000);
    expect(trade).toEqual(expect.objectContaining({
      paper_account_id: 5,
      pair: 'BTCUSDT',
      type: 'LONG',
      entry_price: 50000,
      margin_used: 100,
      remaining_volume: 100,
      volume: 100,
      leverage_used: 5,
    }));
    // баланс списан
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 5, current_balance: 900 }));
  });

  it('пропускает сделку при нулевом/отрицательном балансе и инкрементит skipped_signals', async () => {
    accountRepo.findOneByOrFail.mockResolvedValue({ ...account, current_balance: 0, skipped_signals: 2 });
    const trade = await service.openAccountTrade(account, 'BTCUSDT', 'LONG', 50000);
    expect(trade).toBeNull();
    expect(tradeRepo.save).not.toHaveBeenCalled();
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ skipped_signals: 3 }));
  });

  it('игнорирует повторный сигнал того же направления по той же паре', async () => {
    tradeRepo.findOne.mockResolvedValue({ id: 1, type: 'LONG', status: 'OPEN' });
    const trade = await service.openAccountTrade(account, 'BTCUSDT', 'LONG', 50000);
    expect(trade).toBeNull();
  });

  it('противоположный сигнал закрывает текущую позицию по паре и открывает новую', async () => {
    tradeRepo.findOne.mockResolvedValue({ id: 1, type: 'SHORT', status: 'OPEN' });
    const closeSpy = jest.spyOn(service, 'closeAccountTrade').mockResolvedValue();
    const trade = await service.openAccountTrade(account, 'BTCUSDT', 'LONG', 50000);
    expect(closeSpy).toHaveBeenCalledWith(1, 50000, 'OPPOSITE_SIGNAL');
    expect(trade).not.toBeNull();
  });
});

describe('PaperAccountsService.closeAccountTrade', () => {
  let service: PaperAccountsService;
  let accountRepo: any;
  let tradeRepo: any;

  const openTrade = {
    id: 11, paper_account_id: 5, status: 'OPEN', type: 'LONG',
    entry_price: 100, margin_used: 100, remaining_volume: 100, leverage_used: 5,
  };

  beforeEach(() => {
    accountRepo = makeRepo();
    tradeRepo = makeRepo();
    accountRepo.findOneBy.mockResolvedValue({ id: 5, current_balance: 900 });
    service = new PaperAccountsService(accountRepo, tradeRepo, null as any);
  });

  it('LONG +2% цены при плече 5 → PnL +10% маржи, баланс += маржа + PnL', async () => {
    tradeRepo.findOneBy.mockResolvedValue({ ...openTrade });
    await service.closeAccountTrade(11, 102, 'TP');
    const savedTrade = tradeRepo.save.mock.calls[0][0];
    expect(savedTrade.pnl_percent).toBeCloseTo(10);
    expect(savedTrade.pnl_value).toBeCloseTo(10);
    expect(savedTrade.status).toBe('CLOSED');
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ current_balance: 1010 })); // 900 + 100 + 10
  });

  it('убыток глубже -100% маржи капится ликвидацией: pnl_value = -маржа', async () => {
    tradeRepo.findOneBy.mockResolvedValue({ ...openTrade });
    await service.closeAccountTrade(11, 70, 'SL'); // -30% цены × 5 = -150% маржи
    const savedTrade = tradeRepo.save.mock.calls[0][0];
    expect(savedTrade.pnl_percent).toBe(-100);
    expect(savedTrade.pnl_value).toBeCloseTo(-100);
    expect(savedTrade.exit_reason).toBe('LIQUIDATION');
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ current_balance: 900 })); // 900 + 100 - 100
  });

  it('не трогает закрытые и legacy-сделки', async () => {
    tradeRepo.findOneBy.mockResolvedValue({ ...openTrade, status: 'CLOSED' });
    await service.closeAccountTrade(11, 102, 'TP');
    expect(tradeRepo.save).not.toHaveBeenCalled();

    tradeRepo.findOneBy.mockResolvedValue({ ...openTrade, paper_account_id: null });
    await service.closeAccountTrade(11, 102, 'TP');
    expect(tradeRepo.save).not.toHaveBeenCalled();
  });
});
