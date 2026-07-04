import { BacktestProcessor } from './backtest.processor';

describe('BacktestProcessor', () => {
  const fullResult = {
    candles: [1, 2],
    totalTrades: 0,
    totalReturn: 0,
    winRate: 0,
    maxDrawdown: 0,
    finalBalance: 1000,
    equityCurve: [{ t: 'x', v: 1000 }],
  };

  const makeJob = (overrides: any = {}) => ({
    id: 1,
    data: { strategyId: 32, options: { tp: 0.02 } },
    progress: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  let backtestService: any;
  let backtestRunsService: any;
  let processor: BacktestProcessor;

  beforeEach(() => {
    backtestService = { run: jest.fn().mockResolvedValue(fullResult) };
    backtestRunsService = { saveRun: jest.fn().mockResolvedValue({ id: 1 }) };
    processor = new BacktestProcessor(backtestService, backtestRunsService);
  });

  it('saveRun вызывается без candles, но возвращаемый результат сохраняет candles для фронта', async () => {
    const job = makeJob();
    const returned = await processor.handleBacktest(job as any);

    expect(backtestRunsService.saveRun).toHaveBeenCalledTimes(1);
    const [strategyId, options, savedResult] = backtestRunsService.saveRun.mock.calls[0];
    expect(strategyId).toBe(32);
    expect(options).toEqual({ tp: 0.02 });
    expect(savedResult.candles).toBeUndefined();
    expect(savedResult.totalTrades).toBe(0);
    expect(savedResult.equityCurve).toEqual(fullResult.equityCurve);

    expect(returned.candles).toEqual([1, 2]);
  });

  it('не падает, если saveRun бросает ошибку (try/catch вокруг персиста)', async () => {
    backtestRunsService.saveRun.mockRejectedValue(new Error('db down'));
    const job = makeJob();
    const returned = await processor.handleBacktest(job as any);
    expect(returned.candles).toEqual([1, 2]);
  });
});
