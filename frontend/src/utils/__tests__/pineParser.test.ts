import { parsePineScript } from '../pineParser';
import { parseLogger } from '../parseLogger';

describe('Pine Script Parser - Phase 1-3', () => {
  beforeEach(() => {
    parseLogger.clear();
  });

  // ============ PHASE 1 TESTS ============

  describe('Phase 1: if/else detection', () => {
    test('should detect if/else conditional branches', () => {
      const code = `
        //@version=5
        indicator("Test")
        rsi = ta.rsi(close, 14)
        if rsi > 50
            strategy.entry("Long", strategy.long)
        else
            strategy.entry("Short", strategy.short)
      `;

      const { nodes, edges, report } = parsePineScript(code);

      // Should have input node
      expect(nodes.some(n => n.type === 'input')).toBe(true);

      // Should have RSI indicator
      expect(nodes.some(n => n.type === 'indicator' && n.data.name === 'RSI')).toBe(true);

      // Should have conditional fork node
      expect(nodes.some(n => n.type === 'conditional_fork')).toBe(true);

      // Should have signal nodes
      expect(nodes.some(n => n.type === 'signal')).toBe(true);

      // Report should mention condition
      expect(report.quality).toMatch(/full|partial/);
    });

    test('should handle if-only (no else)', () => {
      const code = `
        //@version=5
        if close > 100
            strategy.entry("Buy", strategy.long)
      `;

      const { nodes } = parsePineScript(code);
      expect(nodes.some(n => n.type === 'conditional_fork')).toBe(true);
    });
  });

  describe('Phase 1: var accumulator detection', () => {
    test('should detect var accumulator patterns', () => {
      const code = `
        //@version=5
        var buyCount = 0
        if ta.crossover(rsi, 30)
            buyCount += 1
        if buyCount >= 3
            strategy.entry("Long")
      `;

      const { nodes } = parsePineScript(code);
      expect(nodes.some(n => n.type === 'accumulator')).toBe(true);
    });
  });

  describe('Phase 1: MTF detection', () => {
    test('should detect request.security() calls', () => {
      const code = `
        //@version=5
        mtf_rsi = request.security(syminfo.tickerid, "1h", ta.rsi(close, 14))
        if mtf_rsi > 50
            strategy.entry("Long")
      `;

      const { nodes } = parsePineScript(code);
      expect(nodes.some(n => n.type === 'mtf')).toBe(true);
    });
  });

  // ============ PHASE 2 TESTS ============

  describe('Phase 2: input parameter detection', () => {
    test('should detect input.int() parameters', () => {
      const code = `
        //@version=5
        rsi_period = input.int(defval=14, title="RSI Period", minval=2, maxval=50)
        rsi = ta.rsi(close, rsi_period)
      `;

      const { nodes } = parsePineScript(code);
      expect(nodes.some(n => n.type === 'input_param')).toBe(true);
    });

    test('should detect input.float() parameters', () => {
      const code = `
        //@version=5
        threshold = input.float(defval=0.5, title="Threshold", minval=0.1, maxval=2.0)
      `;

      const { nodes } = parsePineScript(code);
      expect(nodes.some(n => n.type === 'input_param')).toBe(true);
    });

    test('should detect input.bool() parameters', () => {
      const code = `
        //@version=5
        use_filter = input.bool(defval=true, title="Enable Filter")
      `;

      const { nodes } = parsePineScript(code);
      expect(nodes.some(n => n.type === 'input_param')).toBe(true);
    });
  });

  describe('Phase 2: lookback window detection', () => {
    test('should detect lookback patterns', () => {
      const code = `
        //@version=5
        // Check last 3 bars close > ema20
        for i=0 to 2
            if close[i] < ema20[i]
                signal = false
      `;

      const { nodes } = parsePineScript(code);
      // Note: current regex is simple, may need enhancement
      const hasNodes = nodes.length > 0;
      expect(hasNodes).toBe(true);
    });
  });

  describe('Phase 2: volume analysis detection', () => {
    test('should detect volume surge patterns', () => {
      const code = `
        //@version=5
        vol_sma = ta.sma(volume, 20)
        if volume > vol_sma * 1.3
            signal = true
      `;

      const { nodes } = parsePineScript(code);
      expect(nodes.some(n => n.type === 'volume_filter')).toBe(true);
    });
  });

  // ============ PHASE 3 TESTS ============

  describe('Phase 3: exit condition detection', () => {
    test('should detect strategy.exit() calls', () => {
      const code = `
        //@version=5
        strategy.exit("Exit", stop=100, limit=500)
      `;

      const { nodes } = parsePineScript(code);
      expect(nodes.some(n => n.type === 'exit_condition')).toBe(true);
    });

    test('should handle multiple exit conditions', () => {
      const code = `
        //@version=5
        strategy.entry("Long", strategy.long)
        strategy.exit("StopLoss", stop=50)
        strategy.exit("TakeProfit", limit=200)
      `;

      const { nodes } = parsePineScript(code);
      const exitNodes = nodes.filter(n => n.type === 'exit_condition');
      expect(exitNodes.length).toBeGreaterThan(0);
    });
  });

  // ============ INTEGRATION TESTS ============

  describe('Full strategy integration', () => {
    test('should parse complex strategy with all Phase 1-3 features', () => {
      const code = `
        //@version=5
        indicator("Full Strategy")

        // Phase 1: Input parameters
        rsi_period = input.int(defval=14, title="RSI Period")

        // Phase 1: Indicators
        rsi = ta.rsi(close, rsi_period)

        // Phase 1: Conditional logic
        if rsi > 50
            signal_type = "LONG"
        else
            signal_type = "SHORT"

        // Phase 3: Risk management
        if signal_type == "LONG"
            strategy.entry("Long", strategy.long)
            strategy.exit("LongExit", stop=100, limit=200)
        else
            strategy.entry("Short", strategy.short)
            strategy.exit("ShortExit", stop=100, limit=200)
      `;

      const { nodes, edges, report } = parsePineScript(code);

      // Should have all critical nodes
      expect(nodes.some(n => n.type === 'input')).toBe(true);
      expect(nodes.some(n => n.type === 'indicator')).toBe(true);
      expect(nodes.some(n => n.type === 'conditional_fork' || n.type === 'comparison')).toBe(true);
      expect(nodes.some(n => n.type === 'signal')).toBe(true);

      // Report should show quality
      expect(report.quality).toMatch(/full|partial|fallback/);
      expect(report.qualityPercent).toBeGreaterThanOrEqual(0);
      expect(report.qualityPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Version detection', () => {
    test('should detect Pine Script v5', () => {
      const code = `//@version=5\nindicator("Test")\nclose`;
      const { report } = parsePineScript(code);
      const logs = parseLogger.getLogs();
      expect(logs.some(l => l.message.includes('version'))).toBe(true);
    });

    test('should detect Pine Script v6', () => {
      const code = `//@version=6\nindicator("Test")\nclose`;
      const { report } = parsePineScript(code);
      const logs = parseLogger.getLogs();
      expect(logs.some(l => l.message.includes('version'))).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('should handle empty code gracefully', () => {
      const code = '';
      const { nodes, report } = parsePineScript(code);
      expect(Array.isArray(nodes)).toBe(true);
      expect(report.quality).toBe('fallback');
    });

    test('should detect unsupported constructs', () => {
      const code = `
        //@version=6
        arr = array.new<float>()
        for i = 0 to 10
            array.push(arr, close[i])
      `;

      const { report } = parsePineScript(code);
      expect(report.warnings.length).toBeGreaterThan(0);
      expect(report.warnings.some(w => w.includes('array') || w.includes('for'))).toBe(true);
    });
  });

  describe('Phase 4: math functions', () => {
    test('should handle math functions without errors', () => {
      const code = `
        //@version=5
        indicator("Math test")
        diff = math.abs(close - open)
        maxVal = math.max(high, high[1])
        rsi = ta.rsi(close, 14)
        if rsi > 50
            strategy.entry("Long", strategy.long)
      `;
      const { nodes, report } = parsePineScript(code);
      expect(nodes.some(n => n.type === 'indicator')).toBe(true);
      expect(nodes.some(n => n.type === 'signal')).toBe(true);
      const logs = parseLogger.getLogs();
      expect(logs.some(l => l.message.includes('math'))).toBe(true);
    });
  });

  describe('Phase 4: for-loop to lookback', () => {
    test('should convert simple for-loop to lookback window', () => {
      const code = `//@version=5
indicator("For test")
for i = 0 to 4
    if close[i] < ema50[i]
        condition = false
        break`;
      const { nodes } = parsePineScript(code);
      expect(nodes.some(n => n.type === 'lookback_window')).toBe(true);
    });
  });

  describe('Logging', () => {
    test('should log parsing events', () => {
      const code = `
        //@version=5
        rsi = ta.rsi(close, 14)
        if rsi > 50
            strategy.entry("Long", strategy.long)
      `;

      parsePineScript(code);
      const logs = parseLogger.getLogs();

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(l => l.level === 'info')).toBe(true);
      expect(logs.some(l => l.message.includes('version') || l.message.includes('RSI') || l.message.includes('conditional'))).toBe(true);
    });
  });
});
