import { OrderbookSnapshotService } from './orderbook-snapshot.service';

describe('OrderbookSnapshotService.buildSnapshot', () => {
  const makeService = (metrics: any) => {
    const orderbookService = { getCurrentMetrics: jest.fn().mockResolvedValue(metrics) } as any;
    const snapshotRepo = {} as any;
    return new OrderbookSnapshotService(orderbookService, snapshotRepo);
  };

  const ts = new Date('2026-07-11T10:05:00.000Z');

  it('computes imbalance/spread as percentages matching the live evaluation formula', async () => {
    const service = makeService({ mid: 100, spread: 0.05, imbalance: 0.6125, walls: [] });
    const snap = await service.buildSnapshot('BTCUSDT', ts);
    expect(snap).toMatchObject({
      pair: 'BTCUSDT',
      timestamp: ts,
      mid: 100,
      imbalance_pct: 61.25,
      spread_pct: 0.05,
      wall_distance_pct: null,
    });
  });

  it('finds the nearest wall by absolute distance to mid, either side', async () => {
    const metrics = {
      mid: 100, spread: 0.1, imbalance: 0.5,
      walls: [
        { price: 90, amount: 10, side: 'BUY' },
        { price: 102, amount: 12, side: 'SELL' }, // closest: |102-100|=2 vs |90-100|=10
      ],
    };
    const service = makeService(metrics);
    const snap = await service.buildSnapshot('ETHUSDT', ts);
    expect(snap.wall_distance_pct).toBeCloseTo(2, 4); // 2/100 * 100
  });

  it('returns null when metrics are missing or mid is zero (no reliable reading yet)', async () => {
    const service1 = makeService(null);
    expect(await service1.buildSnapshot('BTCUSDT', ts)).toBeNull();

    const service2 = makeService({ mid: 0, spread: 0, imbalance: 0.5, walls: [] });
    expect(await service2.buildSnapshot('BTCUSDT', ts)).toBeNull();
  });
});

describe('OrderbookSnapshotService.captureSnapshots', () => {
  it('persists a snapshot per active symbol, skipping ones with no reliable metrics', async () => {
    const orderbookService = {
      getActiveSymbols: jest.fn().mockReturnValue(['BTCUSDT', 'ETHUSDT']),
      getCurrentMetrics: jest.fn().mockImplementation(async (symbol: string) =>
        symbol === 'BTCUSDT'
          ? { mid: 50000, spread: 5, imbalance: 0.55, walls: [] }
          : { mid: 0, spread: 0, imbalance: 0, walls: [] },
      ),
    } as any;

    const inserted: any[] = [];
    const qb = {
      insert: () => qb,
      values: (v: any) => { inserted.push(v); return qb; },
      orIgnore: () => qb,
      execute: async () => ({}),
    };
    const snapshotRepo = { createQueryBuilder: () => qb } as any;

    const service = new OrderbookSnapshotService(orderbookService, snapshotRepo);
    await service.captureSnapshots();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].pair).toBe('BTCUSDT');
  });

  it('does nothing when no pair has an active subscription', async () => {
    const orderbookService = { getActiveSymbols: jest.fn().mockReturnValue([]), getCurrentMetrics: jest.fn() } as any;
    const snapshotRepo = { createQueryBuilder: jest.fn() } as any;
    const service = new OrderbookSnapshotService(orderbookService, snapshotRepo);
    await service.captureSnapshots();
    expect(snapshotRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
