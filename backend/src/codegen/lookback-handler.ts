/**
 * Lookback window handler - generates Python code for checking historical bars
 */

export class LookbackHandler {
  /**
   * Generate Python code for lookback window filtering
   *
   * Examples:
   * - ALL: All of last 3 bars must have RSI > 50
   * - ANY: At least one of last 3 bars has RSI > 50
   * - MAJORITY: More than half of last 3 bars have RSI > 50
   */
  static generateLookbackCheck(lookbackAst: any, indent: string = '    '): string {
    const { lookbackBars, condition, logic = 'all' } = lookbackAst;

    let code = '';
    code += `${indent}# Check if ${logic} of last ${lookbackBars} bars satisfy: ${condition}\n`;

    switch (logic) {
      case 'all':
        code += this.generateAllBarsCheck(lookbackBars, condition, indent);
        break;
      case 'any':
        code += this.generateAnyBarCheck(lookbackBars, condition, indent);
        break;
      case 'majority':
        code += this.generateMajorityBarCheck(lookbackBars, condition, indent);
        break;
      default:
        code += this.generateAllBarsCheck(lookbackBars, condition, indent);
    }

    return code;
  }

  private static generateAllBarsCheck(bars: number, condition: string, indent: string): string {
    let code = `${indent}lookback_result = True\n`;
    code += `${indent}for i in range(1, ${bars + 1}):\n`;
    code += `${indent}    bar_condition = ${this.transpileCondition(condition, 'i')}\n`;
    code += `${indent}    if not bar_condition:\n`;
    code += `${indent}        lookback_result = False\n`;
    code += `${indent}        break\n`;
    return code;
  }

  private static generateAnyBarCheck(bars: number, condition: string, indent: string): string {
    let code = `${indent}lookback_result = False\n`;
    code += `${indent}for i in range(1, ${bars + 1}):\n`;
    code += `${indent}    bar_condition = ${this.transpileCondition(condition, 'i')}\n`;
    code += `${indent}    if bar_condition:\n`;
    code += `${indent}        lookback_result = True\n`;
    code += `${indent}        break\n`;
    return code;
  }

  private static generateMajorityBarCheck(bars: number, condition: string, indent: string): string {
    const majorityThreshold = Math.ceil(bars / 2);
    let code = `${indent}lookback_count = 0\n`;
    code += `${indent}for i in range(1, ${bars + 1}):\n`;
    code += `${indent}    bar_condition = ${this.transpileCondition(condition, 'i')}\n`;
    code += `${indent}    if bar_condition:\n`;
    code += `${indent}        lookback_count += 1\n`;
    code += `${indent}lookback_result = lookback_count > ${majorityThreshold}\n`;
    return code;
  }

  /**
   * Transpile condition to Python, handling bar offsets
   * Examples:
   *   rsi > 50  →  rsi[-i] > 50
   *   close > ema20  →  close[-i] > ema20[-i]
   */
  private static transpileCondition(condition: string, barOffset: string = '1'): string {
    let pythonCond = condition
      // Handle OHLCV
      .replace(/\bclose\b/g, `close[-${barOffset}]`)
      .replace(/\bopen\b/g, `open[-${barOffset}]`)
      .replace(/\bhigh\b/g, `high[-${barOffset}]`)
      .replace(/\blow\b/g, `low[-${barOffset}]`)
      .replace(/\bvolume\b/g, `volume[-${barOffset}]`)
      // Handle indicators (if already calculated)
      .replace(/\b(\w+)(?!\[)(?![-+*/%])/g, '$1')  // Keep variable names

    return pythonCond;
  }

  /**
   * Generate a utility function for lookback filtering
   */
  static generateLookbackUtility(): string {
    return `
def check_lookback_window(bars_data, condition_func, lookback_bars, logic='all'):
    """
    Check if a condition is satisfied for lookback bars.

    Args:
        bars_data: List of bar dictionaries with OHLCV data
        condition_func: Function that takes bar data and returns True/False
        lookback_bars: Number of bars to look back
        logic: 'all' (all must match), 'any' (at least one), 'majority' (>50%)

    Returns:
        Boolean indicating whether condition is satisfied
    """
    recent_bars = bars_data[-lookback_bars:]

    if logic == 'all':
        return all(condition_func(bar) for bar in recent_bars)
    elif logic == 'any':
        return any(condition_func(bar) for bar in recent_bars)
    elif logic == 'majority':
        count = sum(1 for bar in recent_bars if condition_func(bar))
        return count > len(recent_bars) // 2
    else:
        raise ValueError(f"Unknown logic: {logic}")
`;
  }
}

export default LookbackHandler;
