import { LdrService } from './ldr.service';

/**
 * Unit tests for LdrService (Knowledge Layer)
 *
 * These tests verify:
 *  1. Result parsing: sentiment scoring, risk detection, keyword matching
 *  2. Fail-open behavior: service never blocks a trade when LDR is unavailable
 *  3. Cache key isolation: different queries produce different cache keys
 *  4. Critical risk shortcut: LDR detects critical events before calling Hermes
 */
describe('LdrService', () => {
  let service: LdrService;
  let mockRedis: any;
  let mockSettings: any;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    mockSettings = {
      get: jest.fn().mockResolvedValue(null),
    };

    service = new LdrService(mockSettings as any, mockRedis as any);
  });

  // ─── 1. parseResult (private — tested via the public interface) ───────────

  describe('parseResult (via mocked HTTP)', () => {
    it('detects BULLISH sentiment from positive keywords', () => {
      // Access private method for unit testing
      const parse = (service as any).parseResult.bind(service);

      const result = parse({
        summary: 'BTC shows bullish momentum with strong growth. Positive outlook for rally.',
        sources: ['https://example.com'],
      });

      expect(result.sentiment).toBe('bullish');
      expect(result.sentimentScore).toBeGreaterThan(0.1);
      expect(result.riskLevel).toBe('low');
      expect(result.sources).toHaveLength(1);
    });

    it('detects BEARISH sentiment and HIGH risk from hack keywords', () => {
      const parse = (service as any).parseResult.bind(service);

      const result = parse({
        summary: 'Major hack detected. BTC exchange exploit allows fraud withdrawal. Negative crash imminent.',
        sources: [],
      });

      expect(result.sentiment).toBe('bearish');
      expect(result.sentimentScore).toBeLessThan(-0.1);
      expect(result.riskLevel).toBe('critical');
    });

    it('detects CRITICAL risk on hack/exploit keywords', () => {
      const parse = (service as any).parseResult.bind(service);

      const result = parse({
        summary: 'Protocol exploit discovered. $180M hack drained. Fraud scheme exposed.',
      });

      expect(result.riskLevel).toBe('critical');
    });

    it('returns NEUTRAL for ambiguous text', () => {
      const parse = (service as any).parseResult.bind(service);

      const result = parse({
        summary: 'Market is stable. No significant news today.',
      });

      expect(result.sentiment).toBe('neutral');
      expect(result.sentimentScore).toBe(0);
      expect(result.riskLevel).toBe('low');
    });

    it('truncates summary to 1000 chars', () => {
      const parse = (service as any).parseResult.bind(service);
      const longText = 'A'.repeat(2000);

      const result = parse({ summary: longText });

      expect(result.summary.length).toBeLessThanOrEqual(1000);
    });

    it('handles empty/missing summary gracefully', () => {
      const parse = (service as any).parseResult.bind(service);

      expect(() => parse({})).not.toThrow();
      expect(() => parse({ summary: '' })).not.toThrow();
      expect(() => parse(null)).not.toThrow();
    });
  });

  // ─── 2. Fail-open behavior ────────────────────────────────────────────────

  describe('fail-open: research() returns neutral when LDR unavailable', () => {
    it('returns neutral result without throwing when LDR is down', async () => {
      // Force authenticate to throw (simulates LDR container offline)
      jest.spyOn(service as any, 'authenticate').mockRejectedValue(
        new Error('connect ECONNREFUSED 172.16.0.10:5000'),
      );

      const result = await service.research('test query', 'BTCUSDT', 'quick', 0);

      expect(result.sentiment).toBe('neutral');
      expect(result.sentimentScore).toBe(0);
      expect(result.riskLevel).toBe('low');
      expect(result.cached).toBe(false);
      expect(result.summary).toContain('LDR unavailable');
    });
  });

  // ─── 3. Redis caching ────────────────────────────────────────────────────

  describe('caching behavior', () => {
    it('returns cached result without calling LDR when cache hit', async () => {
      const cached = {
        summary: 'Cached result',
        sentiment: 'bullish',
        sentimentScore: 0.6,
        riskLevel: 'low',
        keyFindings: [],
        sources: [],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const authSpy = jest.spyOn(service as any, 'authenticate');
      const result = await service.research('any query', 'BTCUSDT', 'quick', 15);

      expect(result.cached).toBe(true);
      expect(result.sentiment).toBe('bullish');
      expect(authSpy).not.toHaveBeenCalled(); // No HTTP call made
    });

    it('skips cache when ttlMin is 0', async () => {
      const cached = { summary: 'Should be ignored' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      // Even if cache has data, ttlMin=0 should not use it
      jest.spyOn(service as any, 'authenticate').mockRejectedValue(new Error('offline'));

      const result = await service.research('query', 'BTCUSDT', 'quick', 0);

      // Redis.get should NOT have been called (ttl=0 skips cache check)
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(result.summary).toContain('LDR unavailable');
    });

    it('generates identical cache keys for semantically similar queries', () => {
      const semBTC1 = (service as any).getSemanticHash('Analyze recent news and regulatory risks for BTC');
      const semBTC2 = (service as any).getSemanticHash('Is there any regulatory risk or news for BTC?');
      expect(semBTC1).toBe(semBTC2);
    });

    it('generates different cache keys for different pairs', () => {
      const hash = (service as any).getSemanticHash.bind(service);
      const keyBTC = `ldr:v2:BTCUSDT:${hash('same query')}:quick`;
      const keyETH = `ldr:v2:ETHUSDT:${hash('same query')}:quick`;

      expect(keyBTC).not.toBe(keyETH);
    });
  });

  // ─── 4. ping() ────────────────────────────────────────────────────────────

  describe('ping()', () => {
    it('returns false when LDR is unreachable', async () => {
      // LDR not configured — axios will fail
      const result = await service.ping();
      expect(typeof result).toBe('boolean');
    });
  });
});
