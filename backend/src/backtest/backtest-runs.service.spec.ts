import { BacktestRunsService } from './backtest-runs.service';

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOneBy: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockImplementation(async (x: any) => ({ id: 1, ...x })),
  create: jest.fn().mockImplementation((x: any) => x),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('BacktestRunsService', () => {
  let service: BacktestRunsService;
  let repo: any;

  const fullResult = {
    totalReturn: -0.44, totalTrades: 104, winRate: 51.9, maxDrawdown: 19.47, finalBalance: 995.6,
    trades: [{ pnl: 1 }, { pnl: -1 }],
    equityCurve: [{ t: 'x', v: 1000 }],
    benchmark: [{ t: 'x', v: 1000 }],
  };

  beforeEach(() => {
    repo = makeRepo();
    service = new BacktestRunsService(repo);
  });

  it('saveRun сохраняет полный результат', async () => {
    await service.saveRun(32, { tp: 0.02 }, fullResult);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ strategy_id: 32, options: { tp: 0.02 }, result: fullResult }),
    );
  });

  it('listRuns возвращает сводку без тяжёлых полей', async () => {
    repo.find.mockResolvedValue([
      { id: 1, strategy_id: 32, created_at: new Date('2026-07-03'), options: { tp: 0.02 }, result: fullResult },
    ]);
    const [run] = await service.listRuns(32);
    expect(run.summary).toEqual({ totalReturn: -0.44, totalTrades: 104, winRate: 51.9, maxDrawdown: 19.47, finalBalance: 995.6 });
    expect((run as any).result).toBeUndefined();
    expect(run.options).toEqual({ tp: 0.02 });
  });

  it('listRuns ограничивает выдачу и сортирует по дате DESC', async () => {
    await service.listRuns(32, 10);
    expect(repo.find).toHaveBeenCalledWith({ where: { strategy_id: 32 }, order: { created_at: 'DESC' }, take: 10 });
  });

  it('getRun возвращает полную запись', async () => {
    repo.findOneBy.mockResolvedValue({ id: 5, result: fullResult });
    const run = await service.getRun(5);
    expect(run.result.trades.length).toBe(2);
  });

  it('deleteRun удаляет по id', async () => {
    await service.deleteRun(5);
    expect(repo.delete).toHaveBeenCalledWith({ id: 5 });
  });
});
