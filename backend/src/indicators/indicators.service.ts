import { Injectable, Logger } from '@nestjs/common';
import { SMA, EMA, RSI, MACD, BollingerBands, Stochastic, ATR as ATRLib } from 'technicalindicators';
import { BinanceApiService } from '../candles/binance-api.service';

@Injectable()
export class IndicatorsService {
  private readonly logger = new Logger(IndicatorsService.name);

  constructor(private binanceApi: BinanceApiService) {}

  calculateSMA(values: number[], period: number): number[] {
    return SMA.calculate({ values, period });
  }

  calculateEMA(values: number[], period: number): number[] {
    return EMA.calculate({ values, period });
  }

  calculateRSI(values: number[], period: number): number[] {
    return RSI.calculate({ values, period });
  }

  calculateMACD(values: number[], fast: number, slow: number, signal: number): any[] {
    return MACD.calculate({
      values,
      fastPeriod: fast,
      slowPeriod: slow,
      signalPeriod: signal,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
  }

  calculateBollingerBands(values: number[], period: number, stdDev: number): any[] {
    return BollingerBands.calculate({ values, period, stdDev });
  }

  calculateStochastic(high: number[], low: number[], close: number[], period: number, signalPeriod: number): any[] {
    return Stochastic.calculate({
      high,
      low,
      close,
      period,
      signalPeriod,
    });
  }

  calculateATR(high: number[], low: number[], close: number[], period: number): number[] {
    const { ATR } = require('technicalindicators');
    return ATR.calculate({ high, low, close, period });
  }

  calculateVolume(volumes: number[], period: number): number {
    // Simple average volume
    const recent = volumes.slice(-period);
    if (recent.length === 0) return 0;
    const sum = recent.reduce((a, b) => a + b, 0);
    return sum / recent.length;
  }

  calculateGeneric(name: string, candles: any[], params: any): any {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    switch (name) {
        case 'RSI':
            return this.calculateRSI(closes, params.period || 14);
        case 'SMA':
            return this.calculateSMA(closes, params.period || 20);
        case 'EMA':
            return this.calculateEMA(closes, params.period || 20);
        case 'MACD':
            return this.calculateMACD(closes, params.fast || 12, params.slow || 26, params.signal || 9);
        case 'BB':
            return this.calculateBollingerBands(closes, params.period || 20, params.stdDev || 2);
        case 'Stoch':
            return this.calculateStochastic(highs, lows, closes, params.period || 14, params.signal || 3);
        case 'ATR':
            return this.calculateATR(highs, lows, closes, params.period || 14);
        default:
            return [];
    }
  }

  calculateOBV(prices: number[], volumes: number[]): number[] {
    const obv = [0];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i-1]) {
        obv.push(obv[obv.length - 1] + volumes[i]);
      } else if (prices[i] < prices[i-1]) {
        obv.push(obv[obv.length - 1] - volumes[i]);
      } else {
        obv.push(obv[obv.length - 1]);
      }
    }
    return obv;
  }

  /**
   * Checks if valuesA crossed valuesB
   * direction: 1 for crossover (above), -1 for crossunder (below)
   */
  checkCrossover(valuesA: number[], valuesB: number[], direction: 1 | -1): boolean {
    if (valuesA.length < 2 || valuesB.length < 2) return false;
    
    const currentA = valuesA[valuesA.length - 1];
    const prevA = valuesA[valuesA.length - 2];
    const currentB = valuesB[valuesB.length - 1];
    const prevB = valuesB[valuesB.length - 2];

    if (direction === 1) {
      return currentA > currentB && prevA <= prevB;
    } else {
      return currentA < currentB && prevA >= prevB;
    }
  }

  /**
   * Detects abnormal price and volume movement
   */
  detectPumpDump(
    prices: number[],
    volumes: number[],
    params: { priceThreshold: number; volMultiplier: number; lookback: number }
  ): { isPump: boolean; isDump: boolean } {
    if (prices.length < params.lookback + 1 || volumes.length < 20) {
      return { isPump: false, isDump: false };
    }

    const currentPrice = prices[prices.length - 1];
    const oldPrice = prices[prices.length - 1 - params.lookback];
    const priceChange = ((currentPrice - oldPrice) / oldPrice) * 100;

    const currentVol = volumes[volumes.length - 1];
    const avgVol = this.calculateVolume(volumes, 20); // Baseline average volume

    const volCondition = currentVol > avgVol * params.volMultiplier;
    
    return {
      isPump: volCondition && priceChange >= params.priceThreshold,
      isDump: volCondition && priceChange <= -params.priceThreshold,
    };
  }

  detectFVG(candles: any[], lookback = 50, onlyUnmitigated = false): { top: number; bottom: number; type: 'BULLISH' | 'BEARISH'; mitigated: boolean }[] {
    const gaps = [];
    const asc = [...candles.slice(0, lookback)].reverse();

    for (let i = 2; i < asc.length; i++) {
        const c1 = asc[i-2];
        const c3 = asc[i];

        let gap: any = null;
        if (parseFloat(c1.high) < parseFloat(c3.low)) {
            gap = { top: parseFloat(c3.low), bottom: parseFloat(c1.high), type: 'BULLISH', mitigated: false };
        } else if (parseFloat(c1.low) > parseFloat(c3.high)) {
            gap = { top: parseFloat(c1.low), bottom: parseFloat(c3.high), type: 'BEARISH', mitigated: false };
        }

        if (gap) {
            // Check mitigation by subsequent candles
            for (let j = i + 1; j < asc.length; j++) {
                const candle = asc[j];
                if (gap.type === 'BULLISH' && parseFloat(candle.low) <= gap.top) {
                    gap.mitigated = true;
                    break;
                }
                if (gap.type === 'BEARISH' && parseFloat(candle.high) >= gap.bottom) {
                    gap.mitigated = true;
                    break;
                }
            }
            if (!onlyUnmitigated || !gap.mitigated) {
                gaps.push(gap);
            }
        }
    }
    return gaps;
  }

  detectEQHEQL(candles: any[], lookback = 100, thresholdPct = 0.05): { type: 'EQH' | 'EQL'; level: number }[] {
    const asc = [...candles.slice(0, lookback)].reverse();
    const highs = asc.map((c, i) => ({ price: parseFloat(c.high), index: i }));
    const lows = asc.map((c, i) => ({ price: parseFloat(c.low), index: i }));

    const pools: { type: 'EQH' | 'EQL'; level: number }[] = [];

    // Find nearly equal highs
    const sortedHighs = [...highs].sort((a, b) => a.price - b.price);
    for (let i = 0; i < sortedHighs.length - 1; i++) {
        const diff = Math.abs(sortedHighs[i].price - sortedHighs[i+1].price) / sortedHighs[i].price * 100;
        if (diff <= thresholdPct) {
            pools.push({ type: 'EQH', level: (sortedHighs[i].price + sortedHighs[i+1].price) / 2 });
        }
    }

    // Find nearly equal lows
    const sortedLows = [...lows].sort((a, b) => a.price - b.price);
    for (let i = 0; i < sortedLows.length - 1; i++) {
        const diff = Math.abs(sortedLows[i].price - sortedLows[i+1].price) / sortedLows[i].price * 100;
        if (diff <= thresholdPct) {
            pools.push({ type: 'EQL', level: (sortedLows[i].price + sortedLows[i+1].price) / 2 });
        }
    }

    return pools;
  }

  /**
   * Detects Order Blocks (OB) in a candle sequence
   */
  detectOrderBlocks(candles: any[], lookback = 100, obType = 'BULLISH', minDisplacement = 2.0): { top: number; bottom: number; type: 'BULLISH' | 'BEARISH' }[] {
    const obList = [];
    const asc = [...candles.slice(0, lookback)].reverse();

    // Calculate average body size
    const bodies = asc.map(c => Math.abs(parseFloat(c.close) - parseFloat(c.open)));
    const avgBody = bodies.reduce((a, b) => a + b, 0) / bodies.length;

    for (let i = 0; i < asc.length - 1; i++) {
        const prev = asc[i];
        const curr = asc[i+1];

        const bodySize = Math.abs(parseFloat(curr.close) - parseFloat(curr.open));
        
        // Displacement check
        if (bodySize > avgBody * minDisplacement) {
            const isBullishMove = parseFloat(curr.close) > parseFloat(curr.open);
            
            if (obType === 'BULLISH' && isBullishMove) {
                if (parseFloat(prev.close) < parseFloat(prev.open)) {
                    obList.push({ top: parseFloat(prev.high), bottom: parseFloat(prev.low), type: 'BULLISH' });
                }
            } else if (obType === 'BEARISH' && !isBullishMove) {
                if (parseFloat(prev.close) > parseFloat(prev.open)) {
                    obList.push({ top: parseFloat(prev.high), bottom: parseFloat(prev.low), type: 'BEARISH' });
                }
            }
        }
    }

    return obList;
  }

  /**
   * Detects Market Structure (BOS, CHoCH)
   */
  detectMarketStructure(candles: any[], lookback = 150): {
    trend: 'bullish' | 'bearish' | 'ranging';
    lastBOS: 'bullish' | 'bearish' | null;
    lastCHoCH: 'bullish' | 'bearish' | null;
  } {
    const asc = [...candles.slice(0, lookback)].reverse();
    if (asc.length < 20) return { trend: 'ranging', lastBOS: null, lastCHoCH: null };

    const highs = [];
    const lows = [];
    
    // 1. Identify Swing Points (using simple 3-candle fractal)
    for (let i = 2; i < asc.length - 2; i++) {
        const p2 = asc[i-2], p1 = asc[i-1], curr = asc[i], n1 = asc[i+1], n2 = asc[i+2];
        const h = parseFloat(curr.high), l = parseFloat(curr.low);

        if (h > parseFloat(p1.high) && h > parseFloat(p2.high) && h > parseFloat(n1.high) && h > parseFloat(n2.high)) {
            highs.push({ price: h, time: curr.time });
        }
        if (l < parseFloat(p1.low) && l < parseFloat(p2.low) && l < parseFloat(n1.low) && l < parseFloat(n2.low)) {
            lows.push({ price: l, time: curr.time });
        }
    }

    if (highs.length < 2 || lows.length < 2) return { trend: 'ranging', lastBOS: null, lastCHoCH: null };

    const lastPrice = parseFloat(asc[asc.length - 1].close);
    const lastHigh = highs[highs.length - 1].price;
    const prevHigh = highs[highs.length - 2].price;
    const lastLow = lows[lows.length - 1].price;
    const prevLow = lows[lows.length - 2].price;

    let trend: any = 'ranging';
    if (lastHigh > prevHigh && lastLow > prevLow) trend = 'bullish';
    if (lastHigh < prevHigh && lastLow < prevLow) trend = 'bearish';

    // 2. Detect BOS (Break of Structure)
    let lastBOS = null;
    if (lastPrice > lastHigh) lastBOS = 'bullish';
    if (lastPrice < lastLow) lastBOS = 'bearish';

    // 3. Detect CHoCH (Change of Character)
    // Simple logic: if trend was Bearish but price broke last Swing High -> Bullish CHoCH
    let lastCHoCH = null;
    if (trend === 'bearish' && lastPrice > lastHigh) lastCHoCH = 'bullish';
    if (trend === 'bullish' && lastPrice < lastLow) lastCHoCH = 'bearish';

    return { trend, lastBOS, lastCHoCH };
  }

  /**
   * Detects Liquidity Sweeps (manipulation of old highs/lows)
   */
  detectLiquiditySweeps(candles: any[], lookback = 100): { type: 'HIGH' | 'LOW'; level: number; time: Date }[] {
    const asc = [...candles.slice(0, lookback)].reverse();
    if (asc.length < 20) return [];

    const sweeps = [];
    const currentCandle = asc[asc.length - 1];
    const currHigh = parseFloat(currentCandle.high);
    const currLow = parseFloat(currentCandle.low);
    const currClose = parseFloat(currentCandle.close);

    // 1. Identify older swing points (excluding latest few candles)
    const history = asc.slice(0, -5);
    let maxHigh = 0;
    let minLow = Infinity;
    
    for (const c of history) {
        const h = parseFloat(c.high);
        const l = parseFloat(c.low);
        if (h > maxHigh) maxHigh = h;
        if (l < minLow) minLow = l;
    }

    // 2. Check for High Sweep (Bearish reversal hint)
    // Price high went above old high, but closed below it
    if (currHigh > maxHigh && currClose < maxHigh) {
        sweeps.push({ type: 'HIGH', level: maxHigh, time: currentCandle.time });
    }

    // 3. Check for Low Sweep (Bullish reversal hint)
    // Price low went below old low, but closed above it
    if (currLow < minLow && currClose > minLow) {
        sweeps.push({ type: 'LOW', level: minLow, time: currentCandle.time });
    }

    return sweeps;
  }

  /**
   * Detects Power of 3 (PO3) - Accumulation, Manipulation, Distribution
   */
  detectPO3(candles: any[]) {
    // We assume candles[0] is the current 1m/5m/15m candle.
    // To detect PO3, we need the start of the current daily session (UTC 00:00).
    const now = new Date(candles[0].time);
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const sessionCandles = candles.filter(c => new Date(c.time) >= startOfDay);
    if (sessionCandles.length < 10) return { phase: 'ACCUMULATION' };

    const dailyOpen = parseFloat(sessionCandles[sessionCandles.length - 1].open);
    const currentHigh = Math.max(...sessionCandles.map(c => parseFloat(c.high)));
    const currentLow = Math.min(...sessionCandles.map(c => parseFloat(c.low)));
    const currentPrice = parseFloat(candles[0].close);

    // Manipulation: Price went significantly below/above open before reversing
    const manipulationThreshold = 0.002; // 0.2%
    let phase = 'ACCUMULATION';

    if (currentLow < dailyOpen * (1 - manipulationThreshold) && currentPrice > dailyOpen) {
      phase = 'MANIPULATION_LOW_COMPLETED'; // Judas Swing complete
    } else if (currentHigh > dailyOpen * (1 + manipulationThreshold) && currentPrice < dailyOpen) {
      phase = 'MANIPULATION_HIGH_COMPLETED';
    }

    // Distribution: Price is expanding away from open
    const expansionThreshold = 0.005; // 0.5%
    if (Math.abs(currentPrice - dailyOpen) / dailyOpen > expansionThreshold) {
      phase = 'DISTRIBUTION';
    }

    return { phase, dailyOpen };
  }

  /**
   * Detects Daily Bias based on Previous Day's structure
   */
  detectDailyBias(candles: any[]) {
    const now = new Date(candles[0].time);
    const yesterdayStart = new Date(now);
    yesterdayStart.setUTCDate(now.getUTCDate() - 1);
    yesterdayStart.setUTCHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setUTCHours(23, 59, 59, 999);

    const yesterdayCandles = candles.filter(c => {
      const t = new Date(c.time);
      return t >= yesterdayStart && t <= yesterdayEnd;
    });

    if (yesterdayCandles.length < 10) return 'NEUTRAL';

    const open = parseFloat(yesterdayCandles[yesterdayCandles.length - 1].open);
    const close = parseFloat(yesterdayCandles[0].close);
    const high = Math.max(...yesterdayCandles.map(c => parseFloat(c.high)));
    const low = Math.min(...yesterdayCandles.map(c => parseFloat(c.low)));

    const bodySize = Math.abs(close - open);
    const candleSize = high - low;

    if (close > open && bodySize > candleSize * 0.5) return 'BULLISH';
    if (close < open && bodySize > candleSize * 0.5) return 'BEARISH';
    
    return 'NEUTRAL';
  }

  /**
   * Calculates Premium/Discount zone based on a range
   */
  calculatePremiumDiscount(candles: any[], lookback = 100): 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' {
    const range = candles.slice(0, lookback);
    const high = Math.max(...range.map(c => parseFloat(c.high)));
    const low = Math.min(...range.map(c => parseFloat(c.low)));
    const equilibrium = (high + low) / 2;
    const currentPrice = parseFloat(candles[0].close);

    if (currentPrice > equilibrium + (high - low) * 0.05) return 'PREMIUM';
    if (currentPrice < equilibrium - (high - low) * 0.05) return 'DISCOUNT';
    return 'EQUILIBRIUM';
  }

  /**
   * Checks if current time is within an ICT Killzone
   */
  isICTKillzone(time: Date, zone: 'LONDON' | 'NEWYORK' | 'ASIA'): boolean {
    const hours = time.getUTCHours();
    switch (zone) {
      case 'LONDON': return hours >= 7 && hours <= 10; // 2:00 - 5:00 EST -> 7:00 - 10:00 UTC
      case 'NEWYORK': return hours >= 12 && hours <= 15; // 7:00 - 10:00 EST -> 12:00 - 15:00 UTC
      case 'ASIA': return hours >= 0 && hours <= 4; // 19:00 - 23:00 EST -> 00:00 - 04:00 UTC
      default: return false;
    }
  }

  /**
   * Detects Bullish or Bearish Divergence
   * @param prices Array of price values (ASC)
   * @param indicator Array of indicator values (ASC)
   * @param lookback Number of candles to look back for peaks/troughs
   */
  detectDivergence(prices: number[], indicator: number[], lookback = 30): { bullish: boolean; bearish: boolean } {
    if (prices.length < lookback || indicator.length < lookback) {
      return { bullish: false, bearish: false };
    }

    // Find local minima for Bullish Divergence
    // Price: Lower Low, Indicator: Higher Low
    let bullish = false;
    const currentPrice = prices[prices.length - 1];
    const currentInd = indicator[indicator.length - 1];

    // Find previous local minimum in prices
    let prevPriceMin = Infinity;
    let prevIndAtMin = 0;
    let foundMin = false;

    for (let i = prices.length - 3; i > prices.length - lookback; i--) {
      // Simple local minimum check (3 points)
      if (prices[i] < prices[i-1] && prices[i] < prices[i+1]) {
        prevPriceMin = prices[i];
        prevIndAtMin = indicator[i];
        foundMin = true;
        break;
      }
    }

    if (foundMin && currentPrice < prevPriceMin && currentInd > prevIndAtMin) {
      bullish = true;
    }

    // Find local maxima for Bearish Divergence
    // Price: Higher High, Indicator: Lower High
    let bearish = false;
    let prevPriceMax = -Infinity;
    let prevIndAtMax = 0;
    let foundMax = false;

    for (let i = prices.length - 3; i > prices.length - lookback; i--) {
      if (prices[i] > prices[i-1] && prices[i] > prices[i+1]) {
        prevPriceMax = prices[i];
        prevIndAtMax = indicator[i];
        foundMax = true;
        break;
      }
    }

    if (foundMax && currentPrice > prevPriceMax && currentInd < prevIndAtMax) {
      bearish = true;
    }

    return { bullish, bearish };
  }

  calculateVWAP(candles: any[], anchor: 'D' | 'W' | 'M' = 'D'): number[] {
    // anchor: 'D' resets at start of day, 'W' at start of week, etc.
    const vwap = [];
    let sumPV = 0;
    let sumV = 0;
    let lastAnchorTime = -1;

    // We process candles in ASC order (reversed from candles[0] being latest)
    const asc = [...candles].reverse();

    for (const c of asc) {
      const time = new Date(c.time);
      let currentAnchorTime: number;

      if (anchor === 'D') currentAnchorTime = time.getUTCDate();
      else if (anchor === 'W') currentAnchorTime = Math.floor(time.getTime() / (7 * 24 * 3600000));
      else currentAnchorTime = time.getUTCMonth();

      if (currentAnchorTime !== lastAnchorTime) {
        sumPV = 0;
        sumV = 0;
        lastAnchorTime = currentAnchorTime;
      }

      const p = (parseFloat(c.high) + parseFloat(c.low) + parseFloat(c.close)) / 3;
      const v = parseFloat(c.volume);
      sumPV += p * v;
      sumV += v;
      vwap.push(sumV > 0 ? sumPV / sumV : p);
    }
    return vwap;
  }

  calculateZScore(values: number[], period: number): number[] {
    const zscores = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        zscores.push(0);
        continue;
      }
      const slice = values.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const stdDev = Math.sqrt(slice.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / period);
      zscores.push(stdDev > 0 ? (values[i] - mean) / stdDev : 0);
    }
    return zscores;
  }

  calculateADR(candles: any[], period: number): number {
    // ADR (Average Daily Range) - usually calculated on Daily candles
    // If we have intra-day candles, we need to aggregate them or assume they are daily
    const dailyRanges = [];
    // Simplistic: just take the range of last N candles (if they are daily)
    // Professional: calculate daily range from whatever timeframe we have
    const lastN = candles.slice(0, period);
    for (const c of lastN) {
      dailyRanges.push(parseFloat(c.high) - parseFloat(c.low));
    }
    return dailyRanges.reduce((a, b) => a + b, 0) / dailyRanges.length;
  }

  calculateCorrelation(valuesA: number[], valuesB: number[]): number {
    if (valuesA.length < 5 || valuesA.length !== valuesB.length) return 0;
    const n = valuesA.length;
    const meanA = valuesA.reduce((a, b) => a + b, 0) / n;
    const meanB = valuesB.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denA = 0;
    let denB = 0;

    for (let i = 0; i < n; i++) {
      const dA = valuesA[i] - meanA;
      const dB = valuesB[i] - meanB;
      num += dA * dB;
      denA += dA * dA;
      denB += dB * dB;
    }

    const den = Math.sqrt(denA * denB);
    return den > 0 ? num / den : 0;
  }

  calculateCVD(candles: any[]): number[] {
    const cvd = [0];
    const asc = [...candles].reverse();
    for (const c of asc) {
      const v = parseFloat(c.volume);
      let delta = 0;

      if (c.taker_buy_volume !== undefined && c.taker_buy_volume !== null) {
        const buyVol = parseFloat(c.taker_buy_volume);
        const sellVol = v - buyVol;
        delta = buyVol - sellVol;
      } else {
        // Fallback to "Relative Close" approximation
        const h = parseFloat(c.high);
        const l = parseFloat(c.low);
        const cl = parseFloat(c.close);
        if (h !== l) {
          delta = v * (2 * (cl - l) / (h - l) - 1);
        }
      }
      cvd.push(cvd[cvd.length - 1] + delta);
    }
    return cvd.slice(1);
  }

  async getOrderbookDepth(pair: string, limit: number = 500) {
    return this.binanceApi.fetchOrderbook(pair, limit);
  }

  /**
   * Calculates Volume Profile (VP)
   */
  calculateVolumeProfile(candles: any[], binsCount = 50): { price: number; volume: number }[] {
      if (candles.length === 0) return [];
      
      const high = Math.max(...candles.map(c => parseFloat(c.high)));
      const low = Math.min(...candles.map(c => parseFloat(c.low)));
      const range = high - low;
      if (range === 0) return [];
      const binSize = range / binsCount;

      const profile = Array(binsCount).fill(0).map((_, i) => ({
          price: low + (i * binSize) + (binSize / 2),
          volume: 0
      }));

      for (const candle of candles) {
          const cClose = parseFloat(candle.close);
          const cVol = parseFloat(candle.volume);
          const binIndex = Math.min(binsCount - 1, Math.floor((cClose - low) / binSize));
          if (binIndex >= 0) {
              profile[binIndex].volume += cVol;
          }
      }

      return profile;
  }

  /**
   * Calculates ADX (Average Directional Index)
   * Returns array of { adx, plusDI, minusDI } objects
   */
  calculateADX(high: number[], low: number[], close: number[], period = 14): { adx: number; plusDI: number; minusDI: number }[] {
    if (high.length < period * 2 + 1) return [];
    const n = high.length;

    // True Range
    const tr: number[] = [0];
    const plusDM: number[] = [0];
    const minusDM: number[] = [0];

    for (let i = 1; i < n; i++) {
      const hl = high[i] - low[i];
      const hpc = Math.abs(high[i] - close[i - 1]);
      const lpc = Math.abs(low[i] - close[i - 1]);
      tr.push(Math.max(hl, hpc, lpc));

      const upMove = high[i] - high[i - 1];
      const downMove = low[i - 1] - low[i];
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    // Wilder smoothing helper
    const wilderSmooth = (arr: number[], p: number): number[] => {
      const out: number[] = [];
      let sum = arr.slice(1, p + 1).reduce((a, b) => a + b, 0);
      out.push(sum);
      for (let i = p + 1; i < arr.length; i++) {
        sum = sum - sum / p + arr[i];
        out.push(sum);
      }
      return out;
    };

    const smoothTR = wilderSmooth(tr, period);
    const smoothPlusDM = wilderSmooth(plusDM, period);
    const smoothMinusDM = wilderSmooth(minusDM, period);

    const len = smoothTR.length;
    const plusDIArr: number[] = [];
    const minusDIArr: number[] = [];
    const dx: number[] = [];

    for (let i = 0; i < len; i++) {
      const pDI = smoothTR[i] > 0 ? (smoothPlusDM[i] / smoothTR[i]) * 100 : 0;
      const mDI = smoothTR[i] > 0 ? (smoothMinusDM[i] / smoothTR[i]) * 100 : 0;
      plusDIArr.push(pDI);
      minusDIArr.push(mDI);
      const diSum = pDI + mDI;
      dx.push(diSum > 0 ? (Math.abs(pDI - mDI) / diSum) * 100 : 0);
    }

    // Smooth DX into ADX
    const smoothDX = wilderSmooth(dx, period);
    const adxStart = period - 1;

    return smoothDX.map((adxVal, i) => ({
      adx: parseFloat(adxVal.toFixed(2)),
      plusDI: parseFloat((plusDIArr[adxStart + i] ?? 0).toFixed(2)),
      minusDI: parseFloat((minusDIArr[adxStart + i] ?? 0).toFixed(2)),
    }));
  }

  /**
   * Detects candlestick patterns on the last candle.
   * Returns detected pattern name or null.
   */
  detectCandlePattern(
    candles: any[],
    pattern: 'PinBar' | 'BullEngulfing' | 'BearEngulfing' | 'InsideBar' | 'Doji' | 'any',
  ): string | null {
    if (candles.length < 2) return null;
    // Most recent candle is candles[0] (DESC order from engine)
    const c = candles[0];
    const prev = candles[1];

    const open = parseFloat(c.open);
    const close = parseFloat(c.close);
    const high = parseFloat(c.high);
    const low = parseFloat(c.low);
    const range = high - low;
    if (range === 0) return null;

    const body = Math.abs(close - open);
    const bodyTop = Math.max(open, close);
    const bodyBot = Math.min(open, close);
    const upperWick = high - bodyTop;
    const lowerWick = bodyBot - low;
    const isBull = close > open;

    // Pin Bar: small body (<30% range), one wick >60% range
    const isPinBar = body < range * 0.3 &&
      (lowerWick > range * 0.6 || upperWick > range * 0.6);

    // Bull Engulfing
    const prevOpen = parseFloat(prev.open);
    const prevClose = parseFloat(prev.close);
    const isBullEngulfing = isBull && prevClose < prevOpen &&
      open <= prevClose && close >= prevOpen;

    // Bear Engulfing
    const isBearEngulfing = !isBull && prevClose > prevOpen &&
      open >= prevClose && close <= prevOpen;

    // Inside Bar: current high/low within previous high/low
    const prevHigh = parseFloat(prev.high);
    const prevLow = parseFloat(prev.low);
    const isInsideBar = high <= prevHigh && low >= prevLow;

    // Doji: body < 5% of range
    const isDoji = body < range * 0.05;

    const detectedPatterns: string[] = [];
    if (isPinBar) detectedPatterns.push('PinBar');
    if (isBullEngulfing) detectedPatterns.push('BullEngulfing');
    if (isBearEngulfing) detectedPatterns.push('BearEngulfing');
    if (isInsideBar) detectedPatterns.push('InsideBar');
    if (isDoji) detectedPatterns.push('Doji');

    if (pattern === 'any') return detectedPatterns[0] || null;
    return detectedPatterns.includes(pattern) ? pattern : null;
  }
}
