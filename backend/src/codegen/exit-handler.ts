/**
 * Exit condition handler - generates Python code for stop loss, take profit, and trailing stops
 */

export class ExitHandler {
  /**
   * Generate Python code for exit conditions
   */
  static generateExitLogic(exitAst: any, indent: string = '    '): string {
    const { exitType, value, description = exitType } = exitAst;

    let code = '';
    code += `${indent}# Exit condition: ${description}\n`;

    switch (exitType) {
      case 'stop':
        code += this.generateStopLoss(value, indent);
        break;
      case 'limit':
        code += this.generateTakeProfit(value, indent);
        break;
      case 'trail':
        code += this.generateTrailingStop(value, indent);
        break;
      case 'time':
        code += this.generateTimeExit(value, indent);
        break;
    }

    return code;
  }

  private static generateStopLoss(pips: number, indent: string): string {
    let code = '';
    code += `${indent}stop_loss_price = entry_price - (${pips} * pip_size)\n`;
    code += `${indent}if current_price <= stop_loss_price:\n`;
    code += `${indent}    exit_signal = "STOP_LOSS"\n`;
    code += `${indent}    exit_price = stop_loss_price\n`;
    return code;
  }

  private static generateTakeProfit(pips: number, indent: string): string {
    let code = '';
    code += `${indent}take_profit_price = entry_price + (${pips} * pip_size)\n`;
    code += `${indent}if current_price >= take_profit_price:\n`;
    code += `${indent}    exit_signal = "TAKE_PROFIT"\n`;
    code += `${indent}    exit_price = take_profit_price\n`;
    return code;
  }

  private static generateTrailingStop(pips: number, indent: string): string {
    let code = '';
    code += `${indent}trailing_stop = entry_price + ((current_price - entry_price) * 0.9) - (${pips} * pip_size)\n`;
    code += `${indent}if current_price <= trailing_stop:\n`;
    code += `${indent}    exit_signal = "TRAILING_STOP"\n`;
    code += `${indent}    exit_price = trailing_stop\n`;
    return code;
  }

  private static generateTimeExit(bars: number, indent: string): string {
    let code = '';
    code += `${indent}bars_in_trade = current_bar - entry_bar\n`;
    code += `${indent}if bars_in_trade >= ${bars}:\n`;
    code += `${indent}    exit_signal = "TIME_EXIT"\n`;
    code += `${indent}    exit_price = current_price\n`;
    return code;
  }

  /**
   * Generate exit management utilities
   */
  static generateExitUtilities(): string {
    return `
class ExitManager:
    """Manages exit conditions for open positions."""

    def __init__(self, entry_price, entry_bar):
        self.entry_price = entry_price
        self.entry_bar = entry_bar
        self.stop_loss = None
        self.take_profit = None
        self.trailing_stop = None
        self.exit_signal = None

    def set_stop_loss(self, pips, pip_size=0.0001):
        """Set stop loss level."""
        self.stop_loss = self.entry_price - (pips * pip_size)

    def set_take_profit(self, pips, pip_size=0.0001):
        """Set take profit level."""
        self.take_profit = self.entry_price + (pips * pip_size)

    def set_trailing_stop(self, pips, pip_size=0.0001):
        """Set trailing stop."""
        self.trailing_stop = pips * pip_size

    def check_exit(self, current_price, current_bar, pip_size=0.0001):
        """Check if any exit condition is triggered."""
        # Stop loss check
        if self.stop_loss and current_price <= self.stop_loss:
            self.exit_signal = "STOP_LOSS"
            return True, self.stop_loss

        # Take profit check
        if self.take_profit and current_price >= self.take_profit:
            self.exit_signal = "TAKE_PROFIT"
            return True, self.take_profit

        # Trailing stop check
        if self.trailing_stop:
            max_price = max(self.entry_price, current_price)
            trailing_level = max_price - self.trailing_stop
            if current_price <= trailing_level:
                self.exit_signal = "TRAILING_STOP"
                return True, trailing_level

        return False, None

    def calculate_pnl(self, exit_price):
        """Calculate profit/loss for the trade."""
        return exit_price - self.entry_price

    def calculate_pnl_percent(self, exit_price):
        """Calculate profit/loss percentage."""
        if self.entry_price == 0:
            return 0
        return ((exit_price - self.entry_price) / self.entry_price) * 100
`;
  }
}

export default ExitHandler;
