/**
 * Conditional fork handler - generates Python code for if/else branching
 */

export class ConditionalHandler {
  /**
   * Generate Python code for conditional fork (if/else)
   *
   * Example:
   *   if rsi > 50:
   *       signal = "LONG"
   *   else:
   *       signal = "SHORT"
   */
  static generateConditionalLogic(conditionalAst: any, indent: string = '    '): string {
    const { condition, trueSignal, falseSignal, trueLabel, falseLabel } = conditionalAst;

    let code = '';

    // Generate condition check
    code += `${indent}# Conditional: ${trueLabel || 'LONG'} if ${condition}, ${falseLabel || 'SHORT'} otherwise\n`;
    code += `${indent}if (${this.transpileCondition(condition)}):\n`;
    code += `${indent}    signal_type = "${trueSignal}"\n`;

    if (falseSignal) {
      code += `${indent}else:\n`;
      code += `${indent}    signal_type = "${falseSignal}"\n`;
    } else {
      code += `${indent}else:\n`;
      code += `${indent}    signal_type = None\n`;
    }

    return code;
  }

  /**
   * Transpile Pine Script condition to Python
   * Examples:
   *   rsi14 > 50          → rsi14 > 50
   *   ema9 > ema20        → ema9 > ema20
   *   close > 100         → close > 100
   */
  private static transpileCondition(condition: string): string {
    // Pine condition syntax is similar to Python, just normalize variable references
    let pythonCond = condition
      .replace(/\bclose\b/g, 'close[-1]')      // close → close[-1]
      .replace(/\bopen\b/g, 'open[-1]')        // open → open[-1]
      .replace(/\bhigh\b/g, 'high[-1]')        // high → high[-1]
      .replace(/\blow\b/g, 'low[-1]')          // low → low[-1]
      .replace(/\bvolume\b/g, 'volume[-1]')    // volume → volume[-1]
      .replace(/\btime\b/g, 'bar_time[-1]')    // time → bar_time[-1]
      .replace(/\bbar_index\b/g, 'bar_index'); // bar_index stays

    return pythonCond;
  }

  /**
   * Integrate conditional fork into strategy signal generation
   */
  static integrateWithSignals(conditionalNodes: any[]): string {
    let code = '';

    for (const conditional of conditionalNodes) {
      code += this.generateConditionalLogic(conditional);
      code += '\n';
    }

    return code;
  }
}

export default ConditionalHandler;
