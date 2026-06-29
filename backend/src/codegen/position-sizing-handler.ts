/**
 * Position sizing handler - generates Python code for money management and position sizing
 */

export class PositionSizingHandler {
  /**
   * Generate Python code for position sizing
   */
  static generatePositionSizing(sizingAst: any, indent: string = '    '): string {
    const { sizingMethod, riskPercent, atrMultiplier } = sizingAst;

    let code = '';
    code += `${indent}# Position sizing: ${sizingMethod}\n`;

    switch (sizingMethod) {
      case 'fixed_percent':
        code += this.generateFixedPercentSizing(riskPercent || 2, indent);
        break;
      case 'atr_based':
        code += this.generateATRBasedSizing(atrMultiplier || 2, indent);
        break;
      case 'kelly':
        code += this.generateKellySizing(indent);
        break;
      case 'equal_weight':
        code += this.generateEqualWeightSizing(indent);
        break;
    }

    return code;
  }

  private static generateFixedPercentSizing(riskPercent: number, indent: string): string {
    let code = '';
    code += `${indent}risk_amount = account_balance * (${riskPercent} / 100)\n`;
    code += `${indent}position_size = risk_amount / stop_loss_pips / pip_value\n`;
    code += `${indent}lot_size = position_size / contract_multiplier\n`;
    return code;
  }

  private static generateATRBasedSizing(multiplier: number, indent: string): string {
    let code = '';
    code += `${indent}atr_value = calculate_atr(high, low, close, 14)\n`;
    code += `${indent}stop_distance = atr_value * ${multiplier}\n`;
    code += `${indent}risk_amount = account_balance * 0.02  # 2% risk\n`;
    code += `${indent}position_size = risk_amount / (stop_distance * pip_value)\n`;
    code += `${indent}lot_size = position_size / contract_multiplier\n`;
    return code;
  }

  private static generateKellySizing(indent: string): string {
    let code = '';
    code += `${indent}# Kelly Criterion: F = (bp - q) / b\n`;
    code += `${indent}# b = payoff ratio, p = win %, q = loss %\n`;
    code += `${indent}win_rate = stats['win_rate']  # e.g., 0.55\n`;
    code += `${indent}payoff_ratio = stats['avg_win'] / stats['avg_loss']  # e.g., 2.0\n`;
    code += `${indent}kelly_fraction = (payoff_ratio * win_rate - (1 - win_rate)) / payoff_ratio\n`;
    code += `${indent}kelly_fraction = max(0.01, min(kelly_fraction, 0.25))  # Cap 1-25%\n`;
    code += `${indent}risk_amount = account_balance * kelly_fraction\n`;
    code += `${indent}position_size = risk_amount / stop_loss_pips / pip_value\n`;
    code += `${indent}lot_size = position_size / contract_multiplier\n`;
    return code;
  }

  private static generateEqualWeightSizing(indent: string): string {
    let code = '';
    code += `${indent}# Equal weight across all concurrent positions\n`;
    code += `${indent}max_positions = 5  # Configurable\n`;
    code += `${indent}per_position_allocation = account_balance / max_positions\n`;
    code += `${indent}position_size = per_position_allocation / (entry_price * pip_value)\n`;
    code += `${indent}lot_size = position_size / contract_multiplier\n`;
    return code;
  }

  /**
   * Generate position sizing utilities
   */
  static generatePositionSizingUtilities(): string {
    return `
class PositionSizer:
    """Calculates position size based on various methods."""

    def __init__(self, account_balance, pip_value, contract_multiplier=1):
        self.account_balance = account_balance
        self.pip_value = pip_value
        self.contract_multiplier = contract_multiplier

    def fixed_percent_size(self, risk_percent, stop_loss_pips):
        """Calculate position size using fixed percentage risk."""
        risk_amount = self.account_balance * (risk_percent / 100)
        position_size = risk_amount / (stop_loss_pips * self.pip_value)
        lot_size = position_size / self.contract_multiplier
        return {
            'risk_amount': risk_amount,
            'position_size': position_size,
            'lot_size': lot_size,
        }

    def atr_based_size(self, atr_value, atr_multiplier=2.0, risk_percent=2.0):
        """Calculate position size using ATR-based volatility."""
        stop_distance = atr_value * atr_multiplier
        risk_amount = self.account_balance * (risk_percent / 100)
        position_size = risk_amount / (stop_distance * self.pip_value)
        lot_size = position_size / self.contract_multiplier
        return {
            'stop_distance': stop_distance,
            'risk_amount': risk_amount,
            'position_size': position_size,
            'lot_size': lot_size,
        }

    def kelly_criterion_size(self, win_rate, avg_win, avg_loss, max_kelly=0.25):
        """Calculate position size using Kelly Criterion."""
        if avg_loss == 0:
            return {'kelly_fraction': 0, 'lot_size': 0}

        payoff_ratio = avg_win / avg_loss
        kelly_fraction = (payoff_ratio * win_rate - (1 - win_rate)) / payoff_ratio
        kelly_fraction = max(0.01, min(kelly_fraction, max_kelly))
        risk_amount = self.account_balance * kelly_fraction
        position_size = risk_amount / (avg_loss * self.pip_value)
        lot_size = position_size / self.contract_multiplier
        return {
            'kelly_fraction': kelly_fraction,
            'risk_amount': risk_amount,
            'position_size': position_size,
            'lot_size': lot_size,
        }

    def equal_weight_size(self, num_positions, entry_price):
        """Calculate position size using equal weight allocation."""
        per_position = self.account_balance / max(num_positions, 1)
        position_size = per_position / entry_price
        lot_size = position_size / self.contract_multiplier
        return {
            'per_position': per_position,
            'position_size': position_size,
            'lot_size': lot_size,
        }

    def calculate_atr(self, high, low, close, period=14):
        """Calculate Average True Range."""
        tr_values = []
        for i in range(len(close)):
            if i == 0:
                tr = high[i] - low[i]
            else:
                tr = max(
                    high[i] - low[i],
                    abs(high[i] - close[i - 1]),
                    abs(low[i] - close[i - 1]),
                )
            tr_values.append(tr)
        return sum(tr_values[-period:]) / period if len(tr_values) >= period else 0
`;
  }
}

export default PositionSizingHandler;
