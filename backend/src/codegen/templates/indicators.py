"""
indicators.py — Static library of technical indicator calculations.
Copied as-is into every generated bot. Do not edit manually.
"""

import math
from typing import Optional


# ─── Data Helpers ─────────────────────────────────────────────────────────────

async def get_candles(client, symbol: str, interval: str, limit: int = 200) -> list[dict]:
    """Fetch OHLCV candles from Binance Futures."""
    raw = await client.futures_klines(symbol=symbol, interval=interval, limit=limit)
    return [
        {
            "time":   int(c[0]),
            "open":   float(c[1]),
            "high":   float(c[2]),
            "low":    float(c[3]),
            "close":  float(c[4]),
            "volume": float(c[5]),
        }
        for c in raw
    ]


def closes(candles: list[dict]) -> list[float]:
    return [c["close"] for c in candles]

def highs(candles: list[dict]) -> list[float]:
    return [c["high"] for c in candles]

def lows(candles: list[dict]) -> list[float]:
    return [c["low"] for c in candles]

def volumes(candles: list[dict]) -> list[float]:
    return [c["volume"] for c in candles]


# ─── SMA ──────────────────────────────────────────────────────────────────────

def sma(candles: list[dict], period: int = 14) -> list[float]:
    values = closes(candles)
    result = []
    for i in range(period - 1, len(values)):
        result.append(sum(values[i - period + 1 : i + 1]) / period)
    return result


# ─── EMA ──────────────────────────────────────────────────────────────────────

def ema(candles: list[dict], period: int = 14) -> list[float]:
    values = closes(candles)
    if len(values) < period:
        return []
    k = 2 / (period + 1)
    result = [sum(values[:period]) / period]
    for v in values[period:]:
        result.append(v * k + result[-1] * (1 - k))
    return result


# ─── RSI ──────────────────────────────────────────────────────────────────────

def rsi(candles: list[dict], period: int = 14) -> list[float]:
    values = closes(candles)
    if len(values) <= period:
        return []
    deltas = [values[i] - values[i - 1] for i in range(1, len(values))]
    gains = [max(d, 0) for d in deltas]
    losses = [abs(min(d, 0)) for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    result = []
    for i in range(period, len(deltas)):
        if avg_loss == 0:
            result.append(100.0)
        else:
            rs = avg_gain / avg_loss
            result.append(100 - 100 / (1 + rs))
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    return result


# ─── MACD ─────────────────────────────────────────────────────────────────────

def macd(candles: list[dict], fast: int = 12, slow: int = 26, signal_period: int = 9) -> dict:
    """Returns {'macd': [...], 'signal': [...], 'histogram': [...]}"""
    ema_fast = ema(candles, fast)
    ema_slow = ema(candles, slow)
    offset = len(ema_fast) - len(ema_slow)
    macd_line = [ema_fast[i + offset] - ema_slow[i] for i in range(len(ema_slow))]

    # Signal line = EMA of MACD line
    if len(macd_line) < signal_period:
        return {"macd": macd_line, "signal": [], "histogram": []}

    k = 2 / (signal_period + 1)
    signal_line = [sum(macd_line[:signal_period]) / signal_period]
    for v in macd_line[signal_period:]:
        signal_line.append(v * k + signal_line[-1] * (1 - k))

    offset2 = len(macd_line) - len(signal_line)
    histogram = [macd_line[i + offset2] - signal_line[i] for i in range(len(signal_line))]

    return {"macd": macd_line, "signal": signal_line, "histogram": histogram}


# ─── Bollinger Bands ──────────────────────────────────────────────────────────

def bollinger_bands(candles: list[dict], period: int = 20, std_dev: float = 2.0) -> dict:
    """Returns {'upper': [...], 'middle': [...], 'lower': [...]}"""
    values = closes(candles)
    middle, upper, lower = [], [], []
    for i in range(period - 1, len(values)):
        window = values[i - period + 1 : i + 1]
        m = sum(window) / period
        variance = sum((x - m) ** 2 for x in window) / period
        std = math.sqrt(variance)
        middle.append(m)
        upper.append(m + std_dev * std)
        lower.append(m - std_dev * std)
    return {"upper": upper, "middle": middle, "lower": lower}


# ─── Stochastic ───────────────────────────────────────────────────────────────

def stochastic(candles: list[dict], period: int = 14, signal_period: int = 3) -> dict:
    """Returns {'k': [...], 'd': [...]}"""
    hs = highs(candles)
    ls = lows(candles)
    cs = closes(candles)
    k_values = []
    for i in range(period - 1, len(cs)):
        h = max(hs[i - period + 1 : i + 1])
        l = min(ls[i - period + 1 : i + 1])
        k_values.append(100 * (cs[i] - l) / (h - l) if h != l else 50.0)

    d_values = []
    for i in range(signal_period - 1, len(k_values)):
        d_values.append(sum(k_values[i - signal_period + 1 : i + 1]) / signal_period)

    return {"k": k_values, "d": d_values}


# ─── ATR ──────────────────────────────────────────────────────────────────────

def atr(candles: list[dict], period: int = 14) -> list[float]:
    """Average True Range"""
    hs = highs(candles)
    ls = lows(candles)
    cs = closes(candles)
    if len(cs) < period + 1:
        return [0.0] * len(cs)
    
    tr = [0.0]
    for i in range(1, len(cs)):
        tr.append(max(hs[i] - ls[i], abs(hs[i] - cs[i-1]), abs(ls[i] - cs[i-1])))
    
    res = [sum(tr[1:period+1]) / period]
    for i in range(period + 1, len(tr)):
        res.append((res[-1] * (period - 1) + tr[i]) / period)
    
    return [0.0] * (len(cs) - len(res)) + res


# ─── OBV ──────────────────────────────────────────────────────────────────────

def calculate_obv(candles: list[dict]) -> list[float]:
    cs = closes(candles)
    vs = volumes(candles)
    obv = [0.0]
    for i in range(1, len(cs)):
        if cs[i] > cs[i-1]:
            obv.append(obv[-1] + vs[i])
        elif cs[i] < cs[i-1]:
            obv.append(obv[-1] - vs[i])
        else:
            obv.append(obv[-1])
    return obv


# ─── Divergence ───────────────────────────────────────────────────────────────

def detect_divergence(prices: list[float], indicator: list[float], lookback: int = 30) -> dict:
    """Detects Bullish or Bearish Divergence"""
    if len(prices) < lookback or len(indicator) < lookback:
        return {"bullish": False, "bearish": False}
    curr_p, curr_i = prices[-1], indicator[-1]
    bullish, bearish = False, False
    
    # Bullish (Price LL, Ind HL)
    f_min, p_min, i_min = False, float('inf'), 0
    for i in range(len(prices)-3, len(prices)-lookback, -1):
        if prices[i] < prices[i-1] and prices[i] < prices[i+1]:
            p_min, i_min, f_min = prices[i], indicator[i], True
            break
    if f_min and curr_p < p_min and curr_i > i_min: bullish = True
    
    # Bearish (Price HH, Ind LH)
    f_max, p_max, i_max = False, float('-inf'), 0
    for i in range(len(prices)-3, len(prices)-lookback, -1):
        if prices[i] > prices[i-1] and prices[i] > prices[i+1]:
            p_max, i_max, f_max = prices[i], indicator[i], True
            break
    if f_max and curr_p > p_max and curr_i < i_max: bearish = True
    return {"bullish": bullish, "bearish": bearish}


# ─── Volume ───────────────────────────────────────────────────────────────────

def avg_volume(candles: list[dict], period: int = 20) -> float:
    vols = volumes(candles)
    if not vols:
        return 0.0
    recent = vols[-period:]
    return sum(recent) / len(recent)





# ─── Crossover Helpers ────────────────────────────────────────────────────────

def cross_above(series_a: list[float], series_b: list[float]) -> bool:
    """Returns True if series_a crossed above series_b on the last candle."""
    if len(series_a) < 2 or len(series_b) < 2:
        return False
    return series_a[-1] > series_b[-1] and series_a[-2] <= series_b[-2]


def cross_below(series_a: list[float], series_b: list[float]) -> bool:
    """Returns True if series_a crossed below series_b on the last candle."""
    if len(series_a) < 2 or len(series_b) < 2:
        return False
    return series_a[-1] < series_b[-1] and series_a[-2] >= series_b[-2]


# ─── Smart Money Concepts ─────────────────────────────────────────────────────

def detect_fvg(candles: list[dict], lookback: int = 50, only_unmitigated: bool = False) -> list[dict]:
    """Detect Fair Value Gaps and optionally filter those already filled."""
    gaps = []
    for i in range(len(candles) - 3, len(candles) - lookback, -1):
        if i < 1: break
        
        # Bullish FVG (Gap between Candle 1 High and Candle 3 Low)
        if candles[i+2]["low"] > candles[i]["high"]:
            gap = {
                "type": "BULLISH",
                "top": candles[i+2]["low"],
                "bottom": candles[i]["high"],
                "index": i + 1,
                "mitigated": False
            }
            # Check mitigation (has price returned to this zone since then?)
            if only_unmitigated:
                for j in range(i + 3, len(candles)):
                    if candles[j]["low"] <= gap["top"]:
                        gap["mitigated"] = True
                        break
            if not only_unmitigated or not gap["mitigated"]:
                gaps.append(gap)
                
        # Bearish FVG
        elif candles[i+2]["high"] < candles[i]["low"]:
            gap = {
                "type": "BEARISH",
                "top": candles[i]["low"],
                "bottom": candles[i+2]["high"],
                "index": i + 1,
                "mitigated": False
            }
            if only_unmitigated:
                for j in range(i + 3, len(candles)):
                    if candles[j]["high"] >= gap["bottom"]:
                        gap["mitigated"] = True
                        break
            if not only_unmitigated or not gap["mitigated"]:
                gaps.append(gap)
    return gaps


def detect_eqh_eql(candles: list[dict], lookback: int = 100, threshold_pct: float = 0.05) -> list[dict]:
    """Detect Equal Highs (EQH) and Equal Lows (EQL) within a threshold."""
    pools = []
    # Simplified version: look for peaks/troughs that are close to each other
    highs = [(i, c["high"]) for i, c in enumerate(candles[-lookback:])]
    lows = [(i, c["low"]) for i, c in enumerate(candles[-lookback:])]
    
    # Sort and find clusters
    # This is a basic implementation, can be improved with swing detection
    sorted_highs = sorted(highs, key=lambda x: x[1])
    for i in range(len(sorted_highs) - 1):
        diff = abs(sorted_highs[i][1] - sorted_highs[i+1][1]) / sorted_highs[i][1] * 100
        if diff <= threshold_pct:
            pools.append({"type": "EQH", "price": (sorted_highs[i][1] + sorted_highs[i+1][1])/2})
            
    sorted_lows = sorted(lows, key=lambda x: x[1])
    for i in range(len(sorted_lows) - 1):
        diff = abs(sorted_lows[i][1] - sorted_lows[i+1][1]) / sorted_lows[i][1] * 100
        if diff <= threshold_pct:
            pools.append({"type": "EQL", "price": (sorted_lows[i][1] + sorted_lows[i+1][1])/2})
            
    return pools


def detect_order_blocks(candles: list[dict], lookback: int = 100, ob_type: str = "BULLISH", min_displacement: float = 2.0) -> list[dict]:
    """Detect Order Blocks with displacement (impulsive move) check."""
    obs = []
    # Calculate average body size for displacement reference
    bodies = [abs(c["close"] - c["open"]) for c in candles[-lookback:]]
    avg_body = sum(bodies) / len(bodies) if bodies else 0
    
    for i in range(len(candles) - 3, len(candles) - lookback, -1):
        if i < 1: break
        
        prev = candles[i]
        curr = candles[i+1] # The candle that potentially breaks away
        
        body_size = abs(curr["close"] - curr["open"])
        
        # Check for displacement: current candle must be larger than avg_body * multiplier
        if body_size > avg_body * min_displacement:
            is_bullish_move = curr["close"] > curr["open"]
            
            if ob_type == "BULLISH" and is_bullish_move:
                # For Bullish OB, we look at the last bearish candle before the move
                if prev["close"] < prev["open"]:
                    obs.append({
                        "type": "BULLISH",
                        "top": prev["high"],
                        "bottom": prev["low"],
                        "index": i
                    })
            elif ob_type == "BEARISH" and not is_bullish_move:
                # For Bearish OB, we look at the last bullish candle before the move
                if prev["close"] > prev["open"]:
                    obs.append({
                        "type": "BEARISH",
                        "top": prev["high"],
                        "bottom": prev["low"],
                        "index": i
                    })
    return obs


def detect_market_structure(candles: list[dict], lookback: int = 150) -> dict:
    """Detect Market Structure: trend, BOS, CHoCH."""
    asc = list(reversed(candles[:lookback]))
    if len(asc) < 20:
        return {"trend": "ranging", "lastBOS": None, "lastCHoCH": None}

    swing_highs, swing_lows = [], []
    for i in range(2, len(asc) - 2):
        h = asc[i]["high"]
        l = asc[i]["low"]
        if all(h > asc[j]["high"] for j in [i-2, i-1, i+1, i+2]):
            swing_highs.append(h)
        if all(l < asc[j]["low"] for j in [i-2, i-1, i+1, i+2]):
            swing_lows.append(l)

    if len(swing_highs) < 2 or len(swing_lows) < 2:
        return {"trend": "ranging", "lastBOS": None, "lastCHoCH": None}

    last_price = asc[-1]["close"]
    trend = "ranging"
    if swing_highs[-1] > swing_highs[-2] and swing_lows[-1] > swing_lows[-2]:
        trend = "bullish"
    elif swing_highs[-1] < swing_highs[-2] and swing_lows[-1] < swing_lows[-2]:
        trend = "bearish"

    last_bos = "bullish" if last_price > swing_highs[-1] else ("bearish" if last_price < swing_lows[-1] else None)
    last_choch = None
    if trend == "bearish" and last_price > swing_highs[-1]:
        last_choch = "bullish"
    elif trend == "bullish" and last_price < swing_lows[-1]:
        last_choch = "bearish"

    return {"trend": trend, "lastBOS": last_bos, "lastCHoCH": last_choch}


def detect_liquidity_sweeps(candles: list[dict], lookback: int = 100) -> list[dict]:
    """Detect Liquidity Sweeps."""
    asc = list(reversed(candles[:lookback]))
    if len(asc) < 20:
        return []
    current = asc[-1]
    history = asc[:-5]
    max_high = max(c["high"] for c in history)
    min_low = min(c["low"] for c in history)
    sweeps = []
    if current["high"] > max_high and current["close"] < max_high:
        sweeps.append({"type": "HIGH", "level": max_high})
    if current["low"] < min_low and current["close"] > min_low:
        sweeps.append({"type": "LOW", "level": min_low})
    return sweeps


def is_ict_killzone(zone: str = "LONDON") -> bool:
    """Check if current UTC time is within an ICT killzone."""
    from datetime import datetime, timezone
    h = datetime.now(timezone.utc).hour
    return {"LONDON": 7 <= h <= 10, "NEWYORK": 12 <= h <= 15, "ASIA": 0 <= h <= 4}.get(zone, False)


def detect_daily_bias(candles: list[dict]) -> str:
    """
    Detects Daily Bias based on previous session
    """
    if len(candles) < 24: return "NEUTRAL"
    # Find start of previous day (approx 24h ago)
    # For a real bot, we'd look for UTC 00:00
    prev_day = candles[-48:-24] if len(candles) > 48 else candles[:-24]
    if not prev_day: return "NEUTRAL"
    
    o, c = prev_day[0]["open"], prev_day[-1]["close"]
    h = max(x["high"] for x in prev_day)
    l = min(x["low"] for x in prev_day)
    
    body = abs(c - o)
    full = h - l
    if full == 0: return "NEUTRAL"
    
    if c > o and body > full * 0.5: return "BULLISH"
    if c < o and body > full * 0.5: return "BEARISH"
    return "NEUTRAL"


def detect_po3(candles: list[dict]) -> dict:
    """
    Detects Power of 3 phases: Accumulation, Manipulation, Distribution
    """
    if len(candles) < 20: return {"phase": "ACCUMULATION"}
    
    daily_open = candles[0]["open"]
    curr_p = candles[-1]["close"]
    curr_h = max(x["high"] for x in candles)
    curr_l = min(x["low"] for x in candles)
    
    phase = "ACCUMULATION"
    manip_threshold = 0.002 # 0.2%
    
    if curr_l < daily_open * (1 - manip_threshold) and curr_p > daily_open:
        phase = "MANIPULATION_LOW_COMPLETED"
    elif curr_h > daily_open * (1 + manip_threshold) and curr_p < daily_open:
        phase = "MANIPULATION_HIGH_COMPLETED"
        
    expansion_threshold = 0.005 # 0.5%
    if abs(curr_p - daily_open) / daily_open > expansion_threshold:
        phase = "DISTRIBUTION"
        
    return {"phase": phase, "daily_open": daily_open}


def calculate_premium_discount(candles: list[dict], lookback: int = 100) -> str:
    """
    Determines if price is in Premium, Discount or Equilibrium
    """
    range_ = candles[-lookback:]
    hi = max(x["high"] for x in range_)
    lo = min(x["low"] for x in range_)
    eq = (hi + lo) / 2
    curr = candles[-1]["close"]
    
    buffer = (hi - lo) * 0.05
    if curr > eq + buffer: return "PREMIUM"
    if curr < eq - buffer: return "DISCOUNT"
    return "EQUILIBRIUM"


def pump_dump(candles: list[dict], price_threshold: float = 5.0,
              vol_multiplier: float = 2.0, lookback: int = 3) -> dict:
    """Detect abnormal pump/dump."""
    closes_ = closes(candles)
    vols = volumes(candles)
    if len(closes_) < lookback + 1 or len(vols) < 20:
        return {"isPump": False, "isDump": False}
    price_change = (closes_[-1] - closes_[-1 - lookback]) / closes_[-1 - lookback] * 100
    avg_vol = sum(vols[-20:]) / 20
    vol_ok = vols[-1] > avg_vol * vol_multiplier
    return {"isPump": vol_ok and price_change >= price_threshold,
            "isDump": vol_ok and price_change <= -price_threshold}


async def get_scanner_data(client, symbol: str, metric: str, period: str) -> float:
    """Fetch candles and calculate volume or change for a specific period."""
    try:
        if metric == 'relative_volume':
            return await get_relative_volume(client, symbol)

        # Map constructor periods to Binance intervals
        interval = period # '1h', '4h', '1d' are compatible with Binance fapi
        
        # We only need 1 candle for current volume/change
        # But to be safe for 1d change, we might need 2 if we want closed candles.
        # Actually Binance '1d' candle is current UTC day.
        klines = await client.futures_klines(symbol=symbol, interval=interval, limit=1)
        if not klines: return 0.0
        
        last = klines[0]
        # Binance kline format: [ot, o, h, l, c, v, ct, qv, n, tbv, tqv, i]
        open_p = float(last[1])
        close_p = float(last[4])
        volume_qv = float(last[7]) # Quote asset volume (USDT)
        
        if metric == 'volume':
            return volume_qv
        if metric == 'change':
            return ((close_p - open_p) / open_p) * 100
        return 0.0
    except Exception:
        return 0.0


async def get_input_data(client, symbol: str, metric: str, timeframe: str = "") -> float:
    """Fetch mark price, funding, or OI for any pair with MTF support."""
    try:
        symbol = symbol.replace('/', '').upper()
        if metric == 'price' and timeframe:
            # Fetch latest price from specific timeframe kline
            klines = await client.futures_klines(symbol=symbol, interval=timeframe, limit=1)
            if klines: return float(klines[0][4]) # Close price
            
        if metric == 'price' or metric == 'funding':
            res = await client.futures_premium_index(symbol=symbol)
            if metric == 'price': return float(res['markPrice'])
            return float(res['lastFundingRate'])
        if metric == 'oi':
            res = await client.futures_open_interest(symbol=symbol)
            return float(res['openInterest'])
        return 0.0
    except Exception:
        return 0.0


async def get_relative_volume(client, symbol: str) -> float:
    """Calculates volume relative to Top-50 market average."""
    try:
        tickers = await client.futures_ticker()
        if not tickers: return 0.0
        volumes = []
        target_volume = 0.0
        for t in tickers:
            vol = float(t.get('quoteVolume', 0))
            volumes.append(vol)
            if t['symbol'] == symbol:
                target_volume = vol
        if not volumes: return 0.0
        volumes.sort(reverse=True)
        top_n = min(len(volumes), 50)
        avg_v = sum(volumes[:top_n]) / top_n
        return target_volume / avg_v if avg_v > 0 else 0.0
    except Exception:
        return 0.0
