import { Injectable, Logger } from '@nestjs/common';

/**
 * AstToPythonRenderer
 *
 * Transforms a compiled AST (from AstCompilerService) into executable Python code
 * for the strategy.py file of the generated bot.
 *
 * The renderer walks the AST recursively, emitting:
 *  - variable assignments  (_v0 = rsi(candles, period=14)[-1])
 *  - condition expressions (_cond0 = _v0 < 30)
 *  - the final evaluate_strategy() function body
 */
@Injectable()
export class AstToPythonRenderer {
  private readonly logger = new Logger(AstToPythonRenderer.name);

  /** Counter for unique temp variable names */
  private varIdx = 0;
  /** Accumulated list of assignment lines */
  private lines: string[] = [];
  /** Set of additional timeframes needed for MTF alignment */
  private requiredTimeframes = new Set<string>();

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Renders a compiled AST into a complete Python strategy function string.
   *
   * @param ast         Root AST node (type === 'signal')
   * @param signalType  'LONG' | 'SHORT'  (from strategy metadata, fallback)
   * @returns           Python source code for evaluate_strategy()
   */
  render(ast: any): string {
    // Reset state for each render call
    this.varIdx = 0;
    this.lines = [];
    this.requiredTimeframes.clear();

    if (!ast || ast.type !== 'signal') {
      this.logger.warn('AST root is not a signal node — generating empty strategy');
      return this.emptyStrategy();
    }

    const signalType = ast.signalType || 'LONG';
    const condExpr = this.renderNode(ast.condition);

    const indent = '    ';
    
    // Generate MTF fetches
    const mtfFetches = Array.from(this.requiredTimeframes).map(tf => 
        `${indent}_candles_${tf} = await get_candles(client, symbol, '${tf}', 200)`
    );

    const body = [
      `async def evaluate_strategy(candles: list, tickers: dict = {}, symbol: str = "", client=None) -> tuple | None:`,
      `${indent}"""`,
      `${indent}Auto-generated strategy function.`,
      `${indent}Returns (signal_type, current_price) or None.`,
      `${indent}"""`,
      `${indent}if len(candles) < 50:`,
      `${indent}    return None`,
      ``,
      ...mtfFetches,
      ``,
      // All pre-computed variables
      ...this.lines.map((l) => `${indent}${l}`),
      ``,
      `${indent}# ─── Signal Condition ───────────────────────────────`,
      `${indent}if ${condExpr}:`,
      `${indent}    current_price = candles[-1]["close"]`,
      `${indent}    return ("${signalType}", current_price)`,
      ``,
      `${indent}return None`,
    ].join('\n');

    return body;
  }

  // ─── Node Renderers ────────────────────────────────────────────────────────

  private renderNode(node: any): string {
    if (node === null || node === undefined) return 'True';

    // Scalar value (number or string)
    if (typeof node === 'number') return String(node);
    if (typeof node === 'string') return JSON.stringify(node);

    // Track MTF if needed
    if (node.timeframe) {
        this.requiredTimeframes.add(node.timeframe);
    }

    switch (node.type) {
      case 'logic':       return this.renderLogic(node);
      case 'comparison':  return this.renderComparison(node);
      case 'cross':       return this.renderCross(node);
      case 'indicator':   return this.renderIndicator(node);
      case 'input':       return this.renderInput(node);
      case 'pump_dump':   return this.renderPumpDump(node);
      case 'fvg':         return this.renderFVG(node);
      case 'order_block': return this.renderOrderBlock(node);
      case 'market_structure': return this.renderMarketStructure(node);
      case 'liquidity_sweep':  return this.renderLiquiditySweep(node);
      case 'time_filter':      return this.renderTimeFilter(node);
      case 'daily_bias':       return this.renderDailyBias(node);
      case 'power_of_3':       return this.renderPowerOf3(node);
      case 'premium_discount': return this.renderPremiumDiscount(node);
      case 'ict_killzone':     return this.renderICTKillzone(node);
      case 'scanner':          return this.renderScanner(node);
      case 'ai_forecast':      return this.renderAIForecast(node);
      case 'orderbook':        return this.renderOrderbook(node);
      default:
        this.logger.warn(`Unknown AST node type: ${node.type}`);
        return 'True';
    }
  }

  /** Returns the Python variable name for candles (supports MTF) */
  private getCandlesVar(node: any): string {
    if (!node.timeframe) return 'candles';
    return `_candles_${node.timeframe}`;
  }

  // ─── Logic (AND / OR) ──────────────────────────────────────────────────────

  private renderLogic(node: any): string {
    const op = (node.operator || 'AND').toLowerCase(); // 'and' | 'or'
    const parts = (node.operands || []).map((o: any) => this.renderNode(o));
    if (parts.length === 0) return 'True';
    if (parts.length === 1) return parts[0];
    return parts.map((p: string) => `(${p})`).join(` ${op} `);
  }

  // ─── Comparison (>, <, >=, <=, ==, !=) ────────────────────────────────────

  private renderComparison(node: any): string {
    const left  = this.resolveOperand(node.left);
    const right = this.resolveOperand(node.right);
    const op    = node.operator || '>';
    return `${left} ${op} ${right}`;
  }

  /** Resolves an operand — either a scalar, or a node that emits a variable */
  private resolveOperand(operand: any): string {
    if (operand === null || operand === undefined) return '0';
    if (typeof operand === 'number') return String(operand);
    if (typeof operand === 'string') {
      // Check if it looks like a number string
      if (!isNaN(Number(operand))) return operand;
      return JSON.stringify(operand);
    }
    // It's a sub-node — render it and get a variable name
    return this.renderIndicatorToScalar(operand);
  }

  /**
   * Renders an indicator/input node and returns a Python expression
   * that evaluates to a scalar (the last value of the series).
   */
  private renderIndicatorToScalar(node: any): string {
    const seriesExpr = this.renderNode(node);
    // seriesExpr might already be a scalar (e.g. for pump_dump)
    // or a series expression. We wrap in [-1] for series nodes.
    const seriesTypes = ['indicator', 'input'];
    if (seriesTypes.includes(node?.type)) {
      const varName = this.assign(seriesExpr);
      return `${varName}[-1]`;
    }
    return seriesExpr;
  }

  // ─── Crossover ─────────────────────────────────────────────────────────────

  private renderCross(node: any): string {
    const aExpr = this.renderSeriesExpr(node.a);
    const bExpr = this.renderSeriesExpr(node.b);
    const aVar  = this.assign(aExpr);
    const bVar  = this.assign(bExpr);
    const fn = node.direction === 'below' ? 'cross_below' : 'cross_above';
    return `${fn}(${aVar}, ${bVar})`;
  }

  private renderSeriesExpr(operand: any): string {
    if (typeof operand === 'number') return String(operand);
    return this.renderNode(operand);
  }

  // ─── Indicators ────────────────────────────────────────────────────────────

  private renderIndicator(node: any): string {
    const name   = (node.name || '').toUpperCase();
    const params = node.params || {};
    const cVar = this.getCandlesVar(node);

    if (node.name === 'Divergence') {
      const source = node.params?.source || 'RSI';
      const lookback = node.params?.lookback || 30;
      const type = node.property || 'bullish';
      const varName = `_v${this.varIdx++}`;
      const candleVar = `[c["close"] for c in ${cVar}]`;
      
      let baseIndCode = '';
      if (source === 'RSI') {
        baseIndCode = `calculate_rsi(${candleVar}, 14)`;
      } else if (source === 'MACD') {
        baseIndCode = `[m['MACD'] for m in calculate_macd(${candleVar}, 12, 26, 9)]`;
      } else if (source === 'OBV') {
        baseIndCode = `calculate_obv(${cVar})`;
      }
      
      this.lines.push(`${varName} = detect_divergence(${candleVar}, ${baseIndCode}, ${lookback})['${type}']`);
      return varName;
    }

    switch (name) {
      case 'RSI':
        return `rsi(${cVar}, period=${params.period ?? 14})`;

      case 'SMA':
        return `sma(${cVar}, period=${params.period ?? 14})`;

      case 'EMA':
        return `ema(${cVar}, period=${params.period ?? 14})`;

      case 'MACD': {
        const fast   = params.fastPeriod ?? 12;
        const slow   = params.slowPeriod ?? 26;
        const sig    = params.signalPeriod ?? 9;
        const prop   = node.property ?? 'macd';
        const varName = this.assign(`macd(${cVar}, fast=${fast}, slow=${slow}, signal_period=${sig})`);
        return `${varName}["${prop}"]`;
      }

      case 'BOLLINGERBANDS':
      case 'BB': {
        const period = params.period ?? 20;
        const std    = params.stdDev ?? 2;
        const prop   = node.property ?? 'middle';
        const varName = this.assign(`bollinger_bands(${cVar}, period=${period}, std_dev=${std})`);
        return `${varName}["${prop}"]`;
      }

      case 'STOCHASTIC': {
        const period = params.period ?? 14;
        const sig    = params.signalPeriod ?? 3;
        const prop   = node.property ?? 'k';
        const varName = this.assign(`stochastic(${cVar}, period=${period}, signal_period=${sig})`);
        return `${varName}["${prop}"]`;
      }

      case 'VOLUME':
        return `avg_volume(${cVar}, period=${params.period ?? 20})`;

      case 'ATR':
        return `atr(${cVar}, period=${params.period ?? 14})`;

      default:
        this.logger.warn(`Unknown indicator: ${name}`);
        return `[]`;
    }
  }

  // ─── Input (price source) ──────────────────────────────────────────────────

  private renderInput(node: any): string {
    const source = node.source || 'markPrice';
    const pair = node.params?.pair || '';
    const op = node.params?.operator || 'none';
    const threshold = node.params?.threshold ?? 0;

    const cVar = this.getCandlesVar(node);

    // Mapping for indicator sources (lists)
    const sourceMap: Record<string, string> = {
      close:     `[c["close"] for c in ${cVar}]`,
      open:      `[c["open"]  for c in ${cVar}]`,
      high:      `[c["high"]  for c in ${cVar}]`,
      low:       `[c["low"]   for c in ${cVar}]`,
      volume:    `[c["volume"] for c in ${cVar}]`,
      markPrice: `[c["close"] for c in ${cVar}]`,
      fundingRate: `[c.get("funding_rate", 0) for c in ${cVar}]`,
      openInterest: `[c.get("open_interest", 0) for c in ${cVar}]`,
    };

    // If used as indicator input (no operator), return the list
    if (op === 'none' && !pair) {
        return sourceMap[source] ?? `[c["close"] for c in ${cVar}]`;
    }

    // If used as smart condition (has operator or specific pair), return single value check
    const metricMap: Record<string, string> = {
        markPrice: 'price',
        fundingRate: 'funding',
        openInterest: 'oi'
    };
    const metric = metricMap[source] || 'price';
    
    let valExpr: string;
    if (!pair) {
        valExpr = (source === 'markPrice' || source === 'close') 
            ? `${cVar}[-1]["close"]` 
            : `await get_input_data(client, symbol, "${metric}", timeframe="${node.timeframe || ''}")`;
    } else {
        valExpr = `await get_input_data(client, "${pair}", "${metric}", timeframe="${node.timeframe || ''}")`;
    }

    if (op === 'none') return valExpr;
    return `(${valExpr} ${op} ${threshold})`;
  }

  // ─── Smart Money Concepts ──────────────────────────────────────────────────

  private renderPumpDump(node: any): string {
    const p = node.params || {};
    const cVar = this.getCandlesVar(node);
    const varName = this.assign(
      `pump_dump(${cVar}, price_threshold=${p.priceThreshold ?? 5}, ` +
      `vol_multiplier=${p.volMultiplier ?? 2}, lookback=${p.lookback ?? 3})`
    );
    // Returns {isPump, isDump} — for signal node we decide based on context
    // Default: any pump or dump
    return `(${varName}["isPump"] or ${varName}["isDump"])`;
  }

  private renderFVG(node: any): string {
    const p = node.params || {};
    const unmitigated = p.onlyUnmitigated ? 'True' : 'False';
    const cVar = this.getCandlesVar(node);
    const varName = this.assign(`detect_fvg(${cVar}, lookback=${p.lookback ?? 50}, only_unmitigated=${unmitigated})`);
    return `len(${varName}) > 0`;
  }

  private renderEQHEQL(node: any): string {
    const p = node.params || {};
    const cVar = this.getCandlesVar(node);
    const varName = this.assign(`detect_eqh_eql(${cVar}, lookback=${p.lookback ?? 100}, threshold_pct=${p.thresholdPct ?? 0.05})`);
    return `len(${varName}) > 0`;
  }

  private renderOrderBlock(node: any): string {
    const p = node.params || {};
    const obType = p.obType ?? 'BULLISH';
    const cVar = this.getCandlesVar(node);
    const varName = this.assign(
      `detect_order_blocks(${cVar}, lookback=${p.lookback ?? 100}, ob_type="${obType}", min_displacement=${p.minDisplacement ?? 2.0})`
    );
    return `len(${varName}) > 0`;
  }

  private renderMarketStructure(node: any): string {
    const p       = node.params || {};
    const prop    = node.property ?? 'trend';
    const cVar    = this.getCandlesVar(node);
    const varName = this.assign(`detect_market_structure(${cVar}, lookback=${p.lookback ?? 150})`);
    // Examples: trend == "bullish", lastBOS == "bullish"
    const propMap: Record<string, string> = {
      trend:     `${varName}["trend"] == "bullish"`,
      lastBOS:   `${varName}["lastBOS"] is not None`,
      lastCHoCH: `${varName}["lastCHoCH"] is not None`,
    };
    return propMap[prop] ?? `${varName}["trend"] == "bullish"`;
  }

  private renderLiquiditySweep(node: any): string {
    const p = node.params || {};
    const sweepType = p.sweepType ?? 'ANY';
    const cVar = this.getCandlesVar(node);
    const varName = this.assign(
      `detect_liquidity_sweeps(${cVar}, lookback=${p.lookback ?? 100})`
    );
    if (sweepType === 'HIGH') return `any(s["type"] == "HIGH" for s in ${varName})`;
    if (sweepType === 'LOW')  return `any(s["type"] == "LOW" for s in ${varName})`;
    return `len(${varName}) > 0`;
  }

  private renderTimeFilter(node: any): string {
    const p = node.params || {};
    const from_ = p.from ?? '08:00';
    const to_   = p.to   ?? '22:00';
    const fromH = parseInt(from_.split(':')[0]);
    const toH   = parseInt(to_.split(':')[0]);
    // Emit inline time check
    this.emit('from datetime import datetime, timezone as _tz');
    return `(${fromH} <= datetime.now(_tz.utc).hour < ${toH})`;
  }

  private renderDailyBias(node: any): string {
    const cVar = this.getCandlesVar(node);
    const varName = this.assign(`detect_daily_bias(${cVar})`);
    return `${varName} == "BULLISH"`; // Default to checking for Bullish Bias
  }

  private renderPowerOf3(node: any): string {
    const prop = node.property ?? 'phase';
    const cVar = this.getCandlesVar(node);
    const varName = this.assign(`detect_po3(${cVar})`);
    if (prop === 'phase') return `${varName}["phase"] == "DISTRIBUTION"`;
    return `${varName}["${prop}"]`;
  }

  private renderPremiumDiscount(node: any): string {
    const p = node.params || {};
    const lookback = p.lookback ?? 100;
    const cVar = this.getCandlesVar(node);
    const varName = this.assign(`calculate_premium_discount(${cVar}, lookback=${lookback})`);
    return `${varName} == "DISCOUNT"`; // Default: check if in discount
  }

  private renderICTKillzone(node: any): string {
    const zone = node.params?.zone ?? 'LONDON';
    return `is_ict_killzone("${zone}")`;
  }

  private renderScanner(node: any): string {
    const metric = node.source || 'volume';
    const period = node.params?.period || '24h';
    const op = node.params?.operator || '>';
    const threshold = node.params?.threshold ?? 0;

    let valExpr: string;
    if (metric === 'relative_volume') {
      // Emit helper once (deduplicated via emit)
      this.emit('def _calc_avg_volume_top50(tickers_dict):');
      this.emit('    vols = sorted([float(t.get("quoteVolume", 0)) for t in tickers_dict.values() if float(t.get("quoteVolume", 0)) > 0], reverse=True)[:50]');
      this.emit('    return sum(vols) / len(vols) if vols else 1');
      this.emit('');
      valExpr = `(float(tickers.get(symbol, {}).get('quoteVolume', 0)) / max(_calc_avg_volume_top50(tickers), 1))`;
    } else if (period === '24h') {
      const key = metric === 'change' ? 'priceChangePercent' : 'quoteVolume';
      valExpr = `float(tickers.get(symbol, {}).get('${key}', 0))`;
    } else {
      valExpr = `await get_scanner_data(client, symbol, "${metric}", "${period}")`;
    }

    return `(${valExpr} ${op} ${threshold})`;
  }

  // ─── AI Forecast (Kronos) ─────────────────────────────────────────────────

  private renderAIForecast(node: any): string {
    const p = node.params || {};
    const predLen = p.predLen ?? 24;
    const temperature = p.temperature ?? 0.8;
    const sampleCount = p.sampleCount ?? 3;
    const property = node.property || 'direction';
    const minConfidence = p.minConfidence ?? 0.6;

    // Emit the async Kronos client helper (deduplicated)
    this.emit('import os as _os');
    this.emit('import aiohttp as _aiohttp');
    this.emit('');
    this.emit('async def _kronos_predict(candles_data, pred_len=24, temperature=0.8, sample_count=3):');
    this.emit('    _kronos_url = _os.getenv("KRONOS_API_URL", "http://kronos:8070")');
    this.emit('    _payload = {');
    this.emit('        "candles": [{"open": c["open"], "high": c["high"], "low": c["low"], "close": c["close"], "volume": c["volume"]} for c in candles_data[-512:]],');
    this.emit('        "pred_len": pred_len, "temperature": temperature, "sample_count": sample_count');
    this.emit('    }');
    this.emit('    async with _aiohttp.ClientSession() as _sess:');
    this.emit('        async with _sess.post(f"{_kronos_url}/predict", json=_payload, timeout=_aiohttp.ClientTimeout(total=30)) as _resp:');
    this.emit('            return await _resp.json()');
    this.emit('');

    const cVar = this.getCandlesVar(node);
    const varName = this.assign(
      `await _kronos_predict(${cVar}, pred_len=${predLen}, temperature=${temperature}, sample_count=${sampleCount})`
    );

    // Generate condition based on the output property
    switch (property) {
      case 'direction':
        return `(${varName}["direction"] == "UP" and abs(${varName}["predicted_change_pct"]) >= ${minConfidence * 100})`;
      case 'predicted_close':
        return `${varName}["predicted_close"]`;
      case 'predicted_change':
        return `${varName}["predicted_change_pct"]`;
      case 'confidence':
        return `(abs(${varName}["predicted_change_pct"]) / 100.0)`;
      default:
        return `${varName}["direction"] == "UP"`;
    }
  }

  // ─── Orderbook (Level 2) ──────────────────────────────────────────────────

  private renderOrderbook(node: any): string {
    const p = node.params || {};
    const metric = p.metric || 'imbalance';
    const levels = p.levels || 20;

    // Emit the async orderbook helper
    this.emit('async def _analyze_orderbook(client, symbol, metric, levels):');
    this.emit('    if not client:');
    this.emit('        return 50.0  # Mock fallback for backtesting');
    this.emit('    try:');
    this.emit('        ob = await client.fetch_order_book(symbol, limit=levels)');
    this.emit('        if metric == "imbalance":');
    this.emit('            bids = sum([x[1] for x in ob.get("bids", [])])');
    this.emit('            asks = sum([x[1] for x in ob.get("asks", [])])');
    this.emit('            return (bids / (bids + asks)) * 100 if (bids+asks)>0 else 50.0');
    this.emit('        elif metric == "spread":');
    this.emit('            if not ob["bids"] or not ob["asks"]: return 0.0');
    this.emit('            return (ob["asks"][0][0] - ob["bids"][0][0]) / ob["bids"][0][0] * 100');
    this.emit('        elif metric == "wall_distance":');
    this.emit('            if not ob["asks"]: return 0.0');
    this.emit('            largest_ask = max(ob["asks"], key=lambda x: x[1])[0]');
    this.emit('            return abs(largest_ask - ob["asks"][0][0]) / ob["asks"][0][0] * 100');
    this.emit('        return 0.0');
    this.emit('    except Exception:');
    this.emit('        return 0.0');
    this.emit('');

    const varName = this.assign(
      `await _analyze_orderbook(client, symbol, "${metric}", ${levels})`
    );

    return varName;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Emits a raw line to the output (used for import-like statements).
   * Deduplicates repeated identical lines.
   */
  private emit(line: string): void {
    if (!this.lines.includes(line)) {
      this.lines.push(line);
    }
  }

  /**
   * Assigns an expression to a numbered temp variable and returns the var name.
   * Avoids duplicating assignments for the exact same expression.
   */
  private assign(expr: string): string {
    // Check if already assigned
    for (const line of this.lines) {
      const match = line.match(/^(_v\d+|_range|_hi|_lo|_eq)\s*=\s*(.+)$/);
      if (match && match[2] === expr) return match[1];
    }
    const varName = `_v${this.varIdx++}`;
    this.lines.push(`${varName} = ${expr}`);
    return varName;
  }

  private emptyStrategy(): string {
    return [
      `def evaluate_strategy(candles: list) -> tuple | None:`,
      `    """Empty strategy — no signal nodes found."""`,
      `    return None`,
    ].join('\n');
  }
}
