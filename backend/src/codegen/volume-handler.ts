/**
 * Volume analysis handler - generates Python code for volume-based filtering
 */

export class VolumeHandler {
  /**
   * Generate Python code for volume filtering
   */
  static generateVolumeFilter(volumeAst: any, indent: string = '    '): string {
    const { filterType, period, multiplier, description } = volumeAst;

    let code = '';
    code += `${indent}# Volume filter: ${description || filterType}\n`;

    switch (filterType) {
      case 'surge':
        code += this.generateVolumeSurge(period, multiplier, indent);
        break;
      case 'crossover':
        code += this.generateVolumeCrossover(period, indent);
        break;
      case 'threshold':
        code += this.generateVolumeThreshold(period, indent);
        break;
    }

    return code;
  }

  private static generateVolumeSurge(period: number, multiplier: number, indent: string): string {
    let code = '';
    code += `${indent}volume_sma = ta.sma(volume, ${period})\n`;
    code += `${indent}volume_surge = volume[-1] > (volume_sma[-1] * ${multiplier})\n`;
    code += `${indent}if not volume_surge:\n`;
    code += `${indent}    signal_type = None  # Volume surge not detected\n`;
    return code;
  }

  private static generateVolumeCrossover(period: number, indent: string): string {
    let code = '';
    code += `${indent}volume_sma = ta.sma(volume, ${period})\n`;
    code += `${indent}volume_cross = (volume[-1] > volume_sma[-1]) and (volume[-2] <= volume_sma[-2])\n`;
    code += `${indent}if not volume_cross:\n`;
    code += `${indent}    signal_type = None  # Volume not crossing above SMA\n`;
    return code;
  }

  private static generateVolumeThreshold(threshold: number, indent: string): string {
    let code = '';
    code += `${indent}volume_check = volume[-1] > ${threshold}\n`;
    code += `${indent}if not volume_check:\n`;
    code += `${indent}    signal_type = None  # Volume below threshold\n`;
    return code;
  }

  /**
   * Generate utility functions for volume analysis
   */
  static generateVolumeUtilities(): string {
    return `
def calculate_volume_sma(volumes, period):
    """Calculate volume moving average."""
    if len(volumes) < period:
        return None
    return sum(volumes[-period:]) / period


def detect_volume_surge(current_volume, volume_sma, multiplier=1.3):
    """Detect volume surge (volume > multiplier * SMA)."""
    if volume_sma is None:
        return False
    return current_volume > (volume_sma * multiplier)


def detect_volume_crossover(current_volume, prev_volume, current_sma, prev_sma):
    """Detect volume crossover above SMA."""
    if current_sma is None or prev_sma is None:
        return False
    return (current_volume > current_sma) and (prev_volume <= prev_sma)


def filter_by_volume_threshold(volume, min_volume):
    """Filter signals by minimum volume threshold."""
    return volume >= min_volume


def calculate_volume_profile(bars, period=20):
    """Calculate volume profile statistics."""
    recent_volumes = [bar['volume'] for bar in bars[-period:]]
    return {
        'current': recent_volumes[-1] if recent_volumes else 0,
        'average': sum(recent_volumes) / len(recent_volumes) if recent_volumes else 0,
        'max': max(recent_volumes) if recent_volumes else 0,
        'min': min(recent_volumes) if recent_volumes else 0,
        'stddev': calculate_stddev(recent_volumes) if recent_volumes else 0,
    }


def calculate_stddev(values):
    """Calculate standard deviation."""
    if not values or len(values) < 2:
        return 0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5
`;
  }
}

export default VolumeHandler;
