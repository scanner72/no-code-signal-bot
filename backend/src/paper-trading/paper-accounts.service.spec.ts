import { PaperAccountsService } from './paper-accounts.service';

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  findOneBy: jest.fn().mockResolvedValue(null),
  findOneByOrFail: jest.fn(),
  save: jest.fn().mockImplementation(async (x: any) => x),
  create: jest.fn().mockImplementation((x: any) => x),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
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

  it('невалидные числа (0, отрицательные, мусор) падают на дефолты', async () => {
    await service.syncPaperAccounts({
      id: 7,
      nodes: [paperNode('n1', { startingCapital: 0, leverage: 'abc', riskPercent: -5 })],
    });
    expect(accountRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        starting_capital: 1000,
        current_balance: 1000,
        leverage: 1,
        risk_percent: 10,
      }),
    );
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

  it('накапливает pnl_value поверх уже зафиксированного partial TP (не перезаписывает)', async () => {
    // trade уже получил partial TP на 1 (accumulated ранее), закрываем финальный leg на remaining_volume 50
    tradeRepo.findOneBy.mockResolvedValue({
      ...openTrade, remaining_volume: 50, pnl_value: 1, margin_used: 100,
    });
    await service.closeAccountTrade(11, 102, 'TP'); // +2% цены × лев 5 = +10% маржи; leg margin = 50 → pnl leg = 5
    const savedTrade = tradeRepo.save.mock.calls[0][0];
    expect(savedTrade.pnl_value).toBeCloseTo(1 + 5); // 1 (partial) + 5 (close leg) = 6
    expect(savedTrade.pnl_percent).toBeCloseTo(6); // 6 / margin_used(100) × 100
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ current_balance: 955 })); // 900 + 50 + 5
  });

  it('атомарный claim: если update.affected === 0 (проиграна гонка), не сохраняет сделку и не кредитует баланс', async () => {
    tradeRepo.findOneBy.mockResolvedValue({ ...openTrade });
    tradeRepo.update.mockResolvedValue({ affected: 0 });
    await service.closeAccountTrade(11, 102, 'TP');
    expect(tradeRepo.save).not.toHaveBeenCalled();
    expect(accountRepo.save).not.toHaveBeenCalled();
  });

  it('атомарный claim: вызывает update с { id, status: OPEN } → { status: CLOSED } перед мутацией', async () => {
    tradeRepo.findOneBy.mockResolvedValue({ ...openTrade });
    await service.closeAccountTrade(11, 102, 'TP');
    expect(tradeRepo.update).toHaveBeenCalledWith(
      { id: 11, status: 'OPEN' },
      { status: 'CLOSED' },
    );
  });
});

describe('PaperAccountsService.processAccountTrade', () => {
  let service: PaperAccountsService;
  let accountRepo: any;
  let tradeRepo: any;

  const baseAccount = {
    id: 5, current_balance: 900, sl_percent: null, tp_percent: null,
    use_trailing: false, trailing_distance: 1, trailing_activation: 0.5,
    move_sl_to_be: false, partial_tps: [],
  };
  const baseTrade = () => ({
    id: 11, paper_account_id: 5, status: 'OPEN', type: 'LONG',
    entry_price: 100, highest_price: 100, lowest_price: 100, peak_price: 100,
    stop_price: null, trailing_active: false, partial_tp_hits: 0,
    margin_used: 100, remaining_volume: 100, leverage_used: 10,
  });

  beforeEach(() => {
    accountRepo = makeRepo();
    tradeRepo = makeRepo();
    service = new PaperAccountsService(accountRepo, tradeRepo, null as any);
  });

  it('ликвидация: -10% цены при плече 10 закрывает сделку как LIQUIDATION', async () => {
    accountRepo.findOneBy.mockResolvedValue({ ...baseAccount });
    const trade: any = baseTrade();
    tradeRepo.findOneBy.mockResolvedValue(trade); // для closeAccountTrade
    await service.processAccountTrade(trade, 90);
    const closed = tradeRepo.save.mock.calls.map((c: any) => c[0]).find((t: any) => t.status === 'CLOSED');
    expect(closed.exit_reason).toBe('LIQUIDATION');
    expect(closed.pnl_percent).toBe(-100);
  });

  it('фиксированный SL аккаунта (1% цены) закрывает при -1.5%', async () => {
    accountRepo.findOneBy.mockResolvedValue({ ...baseAccount, sl_percent: 1 });
    const trade: any = { ...baseTrade(), leverage_used: 2 };
    tradeRepo.findOneBy.mockResolvedValue(trade);
    await service.processAccountTrade(trade, 98.5);
    const closed = tradeRepo.save.mock.calls.map((c: any) => c[0]).find((t: any) => t.status === 'CLOSED');
    expect(closed.exit_reason).toBe('SL');
  });

  it('фиксированный TP аккаунта (3% цены) закрывает при +3%', async () => {
    accountRepo.findOneBy.mockResolvedValue({ ...baseAccount, tp_percent: 3 });
    const trade: any = { ...baseTrade(), leverage_used: 2 };
    tradeRepo.findOneBy.mockResolvedValue(trade);
    await service.processAccountTrade(trade, 103);
    const closed = tradeRepo.save.mock.calls.map((c: any) => c[0]).find((t: any) => t.status === 'CLOSED');
    expect(closed.exit_reason).toBe('TP');
    expect(closed.pnl_percent).toBeCloseTo(6); // 3% × 2
  });

  it('без SL/TP/trailing просто обновляет water marks и pnl', async () => {
    accountRepo.findOneBy.mockResolvedValue({ ...baseAccount });
    const trade: any = baseTrade();
    await service.processAccountTrade(trade, 101);
    expect(trade.highest_price).toBe(101);
    expect(trade.pnl_percent).toBeCloseTo(10); // 1% × 10
    expect(tradeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 11, status: 'OPEN' }));
  });

  it('trailing stop: активация, подъём стопа за пиком, закрытие TRAILING', async () => {
    accountRepo.findOneBy.mockResolvedValue({ ...baseAccount, use_trailing: true, trailing_distance: 1, trailing_activation: 0.5 });
    const trade: any = { ...baseTrade(), leverage_used: 1 };
    await service.processAccountTrade(trade, 102);          // активация + стоп = 102×0.99 = 100.98
    expect(trade.trailing_active).toBe(true);
    expect(Number(trade.stop_price)).toBeCloseTo(100.98);
    tradeRepo.findOneBy.mockResolvedValue(trade);
    await service.processAccountTrade(trade, 100.5);        // цена ≤ стопа → закрытие
    const closed = tradeRepo.save.mock.calls.map((c: any) => c[0]).find((t: any) => t.status === 'CLOSED');
    expect(closed.exit_reason).toBe('TRAILING');
  });

  it('partial TP возвращает часть маржи с прибылью на баланс', async () => {
    const account = { ...baseAccount, partial_tps: [{ target: 2, closePercent: 50 }, { target: 4, closePercent: 100 }] };
    accountRepo.findOneBy.mockResolvedValue(account);
    const trade: any = { ...baseTrade(), leverage_used: 1 };
    await service.processAccountTrade(trade, 102); // +2% → первый partial: закрыто 50% (маржа 50, pnl 1)
    expect(trade.partial_tp_hits).toBe(1);
    expect(Number(trade.remaining_volume)).toBeCloseTo(50);
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ current_balance: 951 })); // 900 + 50 + 1
  });

  it('partial TP аккумулирует pnl_value на сделке (не теряется до финального закрытия)', async () => {
    const account = { ...baseAccount, partial_tps: [{ target: 2, closePercent: 50 }, { target: 4, closePercent: 100 }] };
    accountRepo.findOneBy.mockResolvedValue(account);
    const trade: any = { ...baseTrade(), leverage_used: 1 };
    await service.processAccountTrade(trade, 102); // +2% → первый partial: закрыто 50% (маржа 50, pnl 1)
    expect(Number(trade.pnl_value)).toBeCloseTo(1);
  });

  it('после partial TP финальное closeAccountTrade суммирует pnl_value и пересчитывает pnl_percent от исходной маржи', async () => {
    const account = { ...baseAccount, partial_tps: [{ target: 2, closePercent: 50 }] };
    accountRepo.findOneBy.mockResolvedValue(account);
    const trade: any = { ...baseTrade(), leverage_used: 1 };
    await service.processAccountTrade(trade, 102); // partial TP: pnl_value=1, remaining_volume=50, margin_used=100
    expect(Number(trade.pnl_value)).toBeCloseTo(1);
    expect(Number(trade.remaining_volume)).toBeCloseTo(50);

    // финальное закрытие того же остатка по той же цене (+2% цены, лев 1 → +2% маржи на leg)
    tradeRepo.findOneBy.mockResolvedValue(trade);
    accountRepo.findOneBy.mockResolvedValue({ id: 5, current_balance: Number(account.current_balance) });
    await service.closeAccountTrade(trade.id, 102, 'TP');
    const savedTrade = tradeRepo.save.mock.calls.map((c: any) => c[0]).find((t: any) => t.status === 'CLOSED');
    expect(Number(savedTrade.pnl_value)).toBeCloseTo(2); // 1 (partial) + 1 (close leg: 50 × 2% = 1)
    expect(Number(savedTrade.pnl_percent)).toBeCloseTo(2); // 2 / margin_used(100) × 100
    expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ current_balance: Number(account.current_balance) + 50 + 1 }));
  });
});

describe('PaperAccountsService stats & reset & compare', () => {
  let service: PaperAccountsService;
  let accountRepo: any;
  let tradeRepo: any;
  let binance: any;

  beforeEach(() => {
    accountRepo = makeRepo();
    tradeRepo = makeRepo();
    binance = { fetchTickers24h: jest.fn().mockResolvedValue({ BTCUSDT: { lastPrice: '105' } }) };
    service = new PaperAccountsService(accountRepo, tradeRepo, binance);
  });

  it('getAccountsWithStats: считает winRate, PnL и equity', async () => {
    accountRepo.find.mockResolvedValue([
      { id: 5, strategy_id: 7, node_id: 'n1', starting_capital: 1000, current_balance: 950 },
    ]);
    tradeRepo.find.mockResolvedValue([
      { status: 'CLOSED', pnl_value: 20, margin_used: 100, remaining_volume: 0 },
      { status: 'CLOSED', pnl_value: -10, margin_used: 100, remaining_volume: 0 },
      { status: 'OPEN', pnl_value: 0, margin_used: 100, remaining_volume: 100 },
    ]);
    const [acc] = await service.getAccountsWithStats(7);
    expect(acc.stats.winRate).toBe(50);
    expect(acc.stats.totalPnlValue).toBe(10);
    expect(acc.stats.totalPnlPercent).toBeCloseTo(1);
    expect(acc.stats.equity).toBe(1050); // 950 свободных + 100 маржи в открытой позиции
    expect(acc.stats.openTrades).toBe(1);
    expect(acc.stats.closedTrades).toBe(2);
  });

  it('resetAccount: закрывает открытые позиции по рынку и возвращает стартовый капитал', async () => {
    accountRepo.findOneByOrFail.mockResolvedValue({ id: 5, starting_capital: 1000, current_balance: 400 });
    tradeRepo.find.mockResolvedValue([
      { id: 11, pair: 'BTCUSDT', status: 'OPEN', paper_account_id: 5 },
    ]);
    const closeSpy = jest.spyOn(service, 'closeAccountTrade').mockResolvedValue();
    const saved = await service.resetAccount(5);
    expect(closeSpy).toHaveBeenCalledWith(11, 105, 'MANUAL');
    expect(saved.current_balance).toBe(1000);
  });

  it('compareAccounts: строит equity curve и maxDrawdown', async () => {
    accountRepo.findOneBy.mockResolvedValue({ id: 5, starting_capital: 1000, created_at: new Date('2026-07-01') });
    tradeRepo.find.mockResolvedValue([
      { pnl_value: 100, closed_at: new Date('2026-07-01T10:00Z') }, // 1100, peak
      { pnl_value: -220, closed_at: new Date('2026-07-01T11:00Z') }, // 880 → DD 20%
      { pnl_value: 50, closed_at: new Date('2026-07-01T12:00Z') },  // 930
    ]);
    const [res] = await service.compareAccounts([5]);
    expect(res.curve.map((p: any) => p.equity)).toEqual([1000, 1100, 880, 930]);
    expect(res.stats.maxDrawdown).toBeCloseTo(20);
    expect(res.stats.totalPnlPercent).toBeCloseTo(-7);
    expect(res.stats.trades).toBe(3);
  });
});
