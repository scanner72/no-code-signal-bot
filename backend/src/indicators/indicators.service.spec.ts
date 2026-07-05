import { IndicatorsService } from './indicators.service';

/**
 * Unit tests for the Fibonacci / OTE math: getSwingPoints + calculateFibLevels.
 * These functions are pure, so we instantiate the service with a stub dependency.
 * Engine specs (signals-engine / backtest) MOCK calculateFibLevels — so this file
 * is the only place the real swing math and the non-lookahead guarantee are verified.
 */
describe('IndicatorsService — Fib/OTE math', () => {
  let service: IndicatorsService;

  beforeEach(() => {
    // getSwingPoints/calculateFibLevels never touch the injected BinanceApiService.
    service = new IndicatorsService(null as any);
  });

  const mk = (rows: Array<[number, number]>): any[] =>
    rows.map(([h, l], i) => ({
      high: String(h),
      low: String(l),
      close: String((h + l) / 2),
      time: i,
    }));

  describe('getSwingPoints', () => {
    it('finds fractal swing high and low (leftRight=2)', () => {
      // ASC. idx2 = swing LOW (95), idx6 = swing HIGH (200).
      const asc = mk([
        [105, 101], [104, 100], [103, 95], [120, 104], [150, 118],
        [180, 150], [200, 181], [170, 150], [160, 140],
      ]);
      const { highs, lows } = service.getSwingPoints(asc, 2);
      expect(highs.some((h) => h.index === 6 && h.price === 200)).toBe(true);
      expect(lows.some((l) => l.index === 2 && l.price === 95)).toBe(true);
    });

    it('never returns a swing in the last `leftRight` bars (non-lookahead)', () => {
      // The final bar has an extreme high, but it sits inside the unconfirmed tail
      // and must NOT be reported as a swing.
      const asc = mk([
        [105, 101], [104, 100], [103, 95], [120, 104], [150, 118],
        [180, 150], [200, 181], [170, 150], [9999, 140], // idx8 = extreme, in tail
      ]);
      const { highs } = service.getSwingPoints(asc, 2);
      // no swing may have index > length-1-leftRight (= 6)
      expect(highs.every((h) => h.index <= asc.length - 1 - 2)).toBe(true);
      expect(highs.some((h) => h.price === 9999)).toBe(false);
    });
  });

  describe('calculateFibLevels — long leg', () => {
    // newest-first input (as the engines pass it): reverse the ASC series.
    const ascLong = mk([
      [105, 101], [104, 100], [103, 95], [120, 104], [150, 118],
      [180, 150], [200, 181], [170, 150], [160, 140],
    ]);
    const newestFirst = [...ascLong].reverse();

    it('auto-detects a long leg and computes retracement/extension/OTE', () => {
      const res = service.calculateFibLevels(newestFirst, { direction: 'auto', lookback: 50 });
      expect(res).not.toBeNull();
      expect(res!.direction).toBe('long');
      expect(res!.swingHigh.price).toBe(200);
      expect(res!.swingLow.price).toBe(95);
      const range = 200 - 95; // 105
      expect(res!.levels['0.618']).toBeCloseTo(200 - 0.618 * range, 6);
      expect(res!.levels['0.786']).toBeCloseTo(200 - 0.786 * range, 6);
      expect(res!.levels['1.618']).toBeCloseTo(200 + 0.618 * range, 6); // ext above high
      // OTE golden pocket between the 0.618 and 0.786 retracements
      expect(res!.oteZone.top).toBeCloseTo(200 - 0.618 * range, 6);
      expect(res!.oteZone.bottom).toBeCloseTo(200 - 0.786 * range, 6);
    });

    it('does not anchor to an extreme newest candle (non-lookahead)', () => {
      // Prepend (newest position) a bar with an extreme high; the anchor must stay 200.
      const withSpike = [{ high: '9999', low: '150', close: '9000', time: 99 }, ...newestFirst];
      const res = service.calculateFibLevels(withSpike, { direction: 'auto', lookback: 50 });
      expect(res).not.toBeNull();
      expect(res!.swingHigh.price).toBe(200); // the 9999 spike is ignored
    });
  });

  describe('calculateFibLevels — short leg', () => {
    const ascShort = mk([
      [205, 181], [204, 180], [210, 175], [180, 150], [160, 120],
      [140, 100], [130, 90], [140, 100], [150, 110],
    ]);
    const newestFirst = [...ascShort].reverse();

    it('auto-detects a short leg (high before low) and mirrors the math', () => {
      const res = service.calculateFibLevels(newestFirst, { direction: 'auto', lookback: 50 });
      expect(res).not.toBeNull();
      expect(res!.direction).toBe('short');
      expect(res!.swingHigh.price).toBe(210);
      expect(res!.swingLow.price).toBe(90);
      const range = 210 - 90; // 120
      expect(res!.levels['0.618']).toBeCloseTo(90 + 0.618 * range, 6);
      expect(res!.levels['0.786']).toBeCloseTo(90 + 0.786 * range, 6);
      expect(res!.oteZone.top).toBeCloseTo(90 + 0.786 * range, 6);
      expect(res!.oteZone.bottom).toBeCloseTo(90 + 0.618 * range, 6);
    });

    it('honours a forced direction override', () => {
      const res = service.calculateFibLevels(newestFirst, { direction: 'long', lookback: 50 });
      expect(res!.direction).toBe('long');
    });
  });

  describe('calculateFibLevels — guards', () => {
    it('returns null when there are not enough swings', () => {
      const flat = mk([[10, 9], [10, 9], [10, 9], [10, 9], [10, 9]]);
      expect(service.calculateFibLevels(flat, {})).toBeNull();
    });
  });
});
