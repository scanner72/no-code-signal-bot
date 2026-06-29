import { ConditionalHandler } from '../conditional-handler';
import { ExitHandler } from '../exit-handler';
import { VolumeHandler } from '../volume-handler';
import { LookbackHandler } from '../lookback-handler';
import { InputHandler } from '../input-handler';
import { PositionSizingHandler } from '../position-sizing-handler';

describe('Code Generators - Phase 1-3', () => {
  // ============ PHASE 1 TESTS ============

  describe('ConditionalHandler', () => {
    test('should generate if/else Python code', () => {
      const conditionalAst = {
        condition: 'rsi > 50',
        trueSignal: 'LONG',
        falseSignal: 'SHORT',
        trueLabel: 'Buy',
        falseLabel: 'Sell',
      };

      const code = ConditionalHandler.generateConditionalLogic(conditionalAst);

      expect(code).toContain('if');
      expect(code).toContain('rsi');
      expect(code).toContain('LONG');
      expect(code).toContain('SHORT');
      expect(code).toContain('signal_type');
    });

    test('should handle single-branch conditions', () => {
      const conditionalAst = {
        condition: 'rsi > 50',
        trueSignal: 'LONG',
        falseSignal: null,
        trueLabel: 'Buy',
      };

      const code = ConditionalHandler.generateConditionalLogic(conditionalAst);
      expect(code).toContain('if');
      expect(code).toContain('LONG');
    });

    test('should transpile Pine conditions to Python', () => {
      const code = ConditionalHandler.generateConditionalLogic({
        condition: 'close > 100 and ema20 > ema50',
        trueSignal: 'LONG',
        falseSignal: 'SHORT',
      });

      expect(code).toContain('close[-1]');
      expect(code).toContain('>');
    });
  });

  // ============ PHASE 2 TESTS ============

  describe('LookbackHandler', () => {
    test('should generate lookback check for ALL bars', () => {
      const lookbackAst = {
        lookbackBars: 3,
        condition: 'rsi > 50',
        logic: 'all',
      };

      const code = LookbackHandler.generateLookbackCheck(lookbackAst);

      expect(code).toContain('for i in range');
      expect(code).toContain('lookback_result');
      expect(code).toContain('rsi');
    });

    test('should generate lookback check for ANY bar', () => {
      const lookbackAst = {
        lookbackBars: 5,
        condition: 'volume > avg_volume',
        logic: 'any',
      };

      const code = LookbackHandler.generateLookbackCheck(lookbackAst);

      expect(code).toContain('for i in range');
      expect(code).toContain('lookback_result');
      expect(code).toContain('break');
    });

    test('should generate lookback check for MAJORITY', () => {
      const lookbackAst = {
        lookbackBars: 4,
        condition: 'close > open',
        logic: 'majority',
      };

      const code = LookbackHandler.generateLookbackCheck(lookbackAst);

      expect(code).toContain('lookback_count');
      expect(code).toContain('>');
    });
  });

  describe('VolumeHandler', () => {
    test('should generate volume surge detection', () => {
      const volumeAst = {
        filterType: 'surge',
        period: 20,
        multiplier: 1.3,
      };

      const code = VolumeHandler.generateVolumeFilter(volumeAst);

      expect(code).toContain('volume_sma');
      expect(code).toContain('ta.sma');
      expect(code).toContain('1.3');
    });

    test('should generate volume crossover detection', () => {
      const volumeAst = {
        filterType: 'crossover',
        period: 20,
      };

      const code = VolumeHandler.generateVolumeFilter(volumeAst);

      expect(code).toContain('volume_cross');
      expect(code).toContain('volume_sma');
    });
  });

  describe('InputHandler', () => {
    test('should generate input parameter definitions', () => {
      const inputParams = [
        {
          paramName: 'rsi_period',
          type: 'int',
          defaultValue: 14,
          minValue: 2,
          maxValue: 50,
        },
        {
          paramName: 'threshold',
          type: 'float',
          defaultValue: 0.5,
        },
      ];

      const code = InputHandler.generateInputDefinitions(inputParams);

      expect(code).toContain('RSI_PERIOD = 14');
      expect(code).toContain('THRESHOLD = 0.5');
      expect(code).toContain('type: int');
      expect(code).toContain('type: float');
    });

    test('should generate parameter validator', () => {
      const inputParams = [
        {
          paramName: 'period',
          type: 'int',
          minValue: 2,
          maxValue: 100,
        },
      ];

      const code = InputHandler.generateParameterValidator(inputParams);

      expect(code).toContain('validate_parameters');
      expect(code).toContain('PERIOD');
      expect(code).toContain('>=');
      expect(code).toContain('<=');
    });
  });

  // ============ PHASE 3 TESTS ============

  describe('ExitHandler', () => {
    test('should generate stop loss code', () => {
      const exitAst = {
        exitType: 'stop',
        value: 100,
        description: 'Stop Loss: 100 pips',
      };

      const code = ExitHandler.generateExitLogic(exitAst);

      expect(code).toContain('stop_loss_price');
      expect(code).toContain('100');
      expect(code).toContain('entry_price');
    });

    test('should generate take profit code', () => {
      const exitAst = {
        exitType: 'limit',
        value: 200,
        description: 'Take Profit: 200 pips',
      };

      const code = ExitHandler.generateExitLogic(exitAst);

      expect(code).toContain('take_profit_price');
      expect(code).toContain('200');
      expect(code).toContain('TAKE_PROFIT');
    });

    test('should generate trailing stop code', () => {
      const exitAst = {
        exitType: 'trail',
        value: 50,
        description: 'Trailing Stop: 50 pips',
      };

      const code = ExitHandler.generateExitLogic(exitAst);

      expect(code).toContain('trailing_stop');
      expect(code).toContain('TRAILING_STOP');
    });

    test('should include exit utilities', () => {
      const utilities = ExitHandler.generateExitUtilities();

      expect(utilities).toContain('class ExitManager');
      expect(utilities).toContain('set_stop_loss');
      expect(utilities).toContain('set_take_profit');
      expect(utilities).toContain('check_exit');
    });
  });

  describe('PositionSizingHandler', () => {
    test('should generate fixed percent sizing', () => {
      const sizingAst = {
        sizingMethod: 'fixed_percent',
        riskPercent: 2,
      };

      const code = PositionSizingHandler.generatePositionSizing(sizingAst);

      expect(code).toContain('risk_amount');
      expect(code).toContain('2 / 100');
      expect(code).toContain('position_size');
      expect(code).toContain('lot_size');
    });

    test('should generate ATR-based sizing', () => {
      const sizingAst = {
        sizingMethod: 'atr_based',
        atrMultiplier: 2,
      };

      const code = PositionSizingHandler.generatePositionSizing(sizingAst);

      expect(code).toContain('atr_value');
      expect(code).toContain('calculate_atr');
      expect(code).toContain('stop_distance');
    });

    test('should generate Kelly criterion sizing', () => {
      const sizingAst = {
        sizingMethod: 'kelly',
      };

      const code = PositionSizingHandler.generatePositionSizing(sizingAst);

      expect(code).toContain('Kelly Criterion');
      expect(code).toContain('kelly_fraction');
      expect(code).toContain('payoff_ratio');
    });

    test('should include sizing utilities', () => {
      const utilities = PositionSizingHandler.generatePositionSizingUtilities();

      expect(utilities).toContain('class PositionSizer');
      expect(utilities).toContain('fixed_percent_size');
      expect(utilities).toContain('atr_based_size');
      expect(utilities).toContain('kelly_criterion_size');
      expect(utilities).toContain('calculate_atr');
    });
  });

  // ============ INTEGRATION TESTS ============

  describe('Full strategy code generation', () => {
    test('should generate complete strategy code pipeline', () => {
      // Phase 1: Conditional
      const conditionalCode = ConditionalHandler.generateConditionalLogic({
        condition: 'rsi > 50',
        trueSignal: 'LONG',
        falseSignal: 'SHORT',
      });

      // Phase 2: Lookback
      const lookbackCode = LookbackHandler.generateLookbackCheck({
        lookbackBars: 3,
        condition: 'close > ema20',
        logic: 'all',
      });

      // Phase 3: Exit
      const exitCode = ExitHandler.generateExitLogic({
        exitType: 'stop',
        value: 100,
      });

      // Phase 3: Position Sizing
      const sizingCode = PositionSizingHandler.generatePositionSizing({
        sizingMethod: 'fixed_percent',
        riskPercent: 2,
      });

      expect(conditionalCode).toBeTruthy();
      expect(lookbackCode).toBeTruthy();
      expect(exitCode).toBeTruthy();
      expect(sizingCode).toBeTruthy();
    });
  });

  describe('Python code validity', () => {
    test('generated code should have valid Python syntax', () => {
      const codes = [
        ConditionalHandler.generateConditionalLogic({
          condition: 'rsi > 50',
          trueSignal: 'LONG',
          falseSignal: 'SHORT',
        }),
        LookbackHandler.generateLookbackCheck({
          lookbackBars: 3,
          condition: 'close > 100',
          logic: 'all',
        }),
        ExitHandler.generateExitLogic({
          exitType: 'stop',
          value: 100,
        }),
        PositionSizingHandler.generatePositionSizing({
          sizingMethod: 'fixed_percent',
          riskPercent: 2,
        }),
      ];

      codes.forEach(code => {
        // Check basic Python syntax patterns
        expect(code.length).toBeGreaterThan(0);
        expect(code).toContain('=');
        expect(code).not.toMatch(/undefined|null(?!_coalesce)/);
      });
    });
  });

  describe('MathHandler', () => {
    test('should transpile Pine math to Python', () => {
      const { MathHandler } = require('../math-handler');
      const result = MathHandler.generateMathTranspilation('x = math.abs(close - open)');
      expect(result).toContain('abs(');
      expect(result).not.toContain('math.abs');
    });

    test('should handle multiple math functions', () => {
      const { MathHandler } = require('../math-handler');
      const result = MathHandler.generateMathTranspilation('y = math.max(math.min(a, b), math.sqrt(c))');
      expect(result).toContain('max(');
      expect(result).toContain('min(');
      expect(result).toContain('math.sqrt(');
    });
  });
});
