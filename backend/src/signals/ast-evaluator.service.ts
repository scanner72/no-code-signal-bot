import { Injectable, Logger } from '@nestjs/common';
import { CandlesService } from '../candles/candles.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { evalSimpleCondition, applyLookbackLogic, stepAccumulator, AccumulatorState } from './node-eval-helpers';

/**
 * Lightweight AST evaluator for backtest.
 * In the main app (AppModule) it delegates to the full SignalsEngineService.
 * In the worker (WorkerModule) it works standalone — optional services
 * that are not provided simply cause their AST nodes to return defaults.
 */
@Injectable()
export class AstEvaluatorService {
  private readonly logger = new Logger(AstEvaluatorService.name);

  constructor(
    private readonly candlesService: CandlesService,
    private readonly indicatorsService: IndicatorsService,
  ) {}

  async evaluateNode(
    node: any,
    candles: any[],
    getHistory = false,
    context?: any,
    options?: { backtestMode?: boolean },
  ): Promise<any> {
    const ctx = options?.backtestMode !== false
      ? { ...context, isBacktest: true }
      : context;
    return this.evaluateNodeStandalone(node, candles, getHistory, ctx);
  }

  /**
   * A node condition is either a compiled sub-AST (object — full evaluation)
   * or a raw Pine expression string from the importer (only the simple
   * close/high/low/open/volume comparisons are supported; anything else is
   * logged once and treated as false, never silently guessed).
   */
  private warnedConditions = new Set<string>();
  private async evalConditionOrString(condition: any, candles: any[], context: any, label: string): Promise<boolean> {
    if (condition && typeof condition === 'object') {
      return !!(await this.evaluateNodeStandalone(condition, candles, false, context));
    }
    if (typeof condition === 'string' && condition.trim()) {
      const r = evalSimpleCondition(condition, candles[0]);
      if (r === null) {
        if (!this.warnedConditions.has(condition)) {
          this.warnedConditions.add(condition);
          this.logger.warn(`${label}: unsupported string condition "${condition}" — evaluated as false. Wire the condition through an incoming edge instead.`);
        }
        return false;
      }
      return r;
    }
    return false;
  }

  /** Accumulator state lives on context.state — one object per backtest run. */
  private getAccumulatorState(context: any, varName: string, initialValue: number): AccumulatorState {
    if (!context) return { value: initialValue, lastCandleTime: null }; // degenerate: stateless call
    context.state = context.state || {};
    context.state.accumulators = context.state.accumulators || new Map<string, AccumulatorState>();
    if (!context.state.accumulators.has(varName)) {
      context.state.accumulators.set(varName, { value: initialValue, lastCandleTime: null });
    }
    return context.state.accumulators.get(varName);
  }

  private async evaluateNodeStandalone(node: any, candles: any[], getHistory = false, context?: any): Promise<any> {
    if (typeof node !== 'object' || node === null) return getHistory ? [node] : node;

    if (!candles || candles.length === 0) return getHistory ? [null] : null;

    // Lazy: only materialize the full chronological close series when a node
    // actually needs history. Avoids O(n²) map/reverse on every recursive call.
    let _closes: number[] | null = null;
    const closesHistory = () => (_closes ??= candles.map(c => parseFloat(c.close)).reverse());
    const lastClose = () => (candles.length ? parseFloat(candles[0].close) : 0);

    switch (node.type) {
      case 'signal':
        return this.evaluateNodeStandalone(node.condition, candles, getHistory, context);

      case 'mtf':
        if (!node.condition) return true;
        return this.evaluateNodeStandalone(node.condition, candles, getHistory, context);

      case 'logic': {
        const results = await Promise.all(
          node.operands.map((op: any) => this.evaluateNodeStandalone(op, candles, getHistory, context))
        );
        if (node.operator === 'AND') return results.every(r => !!r);
        if (node.operator === 'OR') return results.some(r => !!r);
        return false;
      }

      case 'comparison': {
        const left = await this.evaluateNodeStandalone(node.left, candles, false, context);
        const right = await this.evaluateNodeStandalone(node.right, candles, false, context);
        switch (node.operator) {
          case '>': return left > right;
          case '<': return left < right;
          case '>=': return left >= right;
          case '<=': return left <= right;
          case '==': return left == right;
          case 'cross_above': {
            const hL = await this.evaluateNodeStandalone(node.left, candles, true, context);
            const hR = await this.evaluateNodeStandalone(node.right, candles, true, context);
            if (!Array.isArray(hL) || !Array.isArray(hR) || hL.length < 2 || hR.length < 2) return false;
            return hL[hL.length - 2] <= hR[hR.length - 2] && hL[hL.length - 1] > hR[hR.length - 1];
          }
          case 'cross_below': {
            const hL = await this.evaluateNodeStandalone(node.left, candles, true, context);
            const hR = await this.evaluateNodeStandalone(node.right, candles, true, context);
            if (!Array.isArray(hL) || !Array.isArray(hR) || hL.length < 2 || hR.length < 2) return false;
            return hL[hL.length - 2] >= hR[hR.length - 2] && hL[hL.length - 1] < hR[hR.length - 1];
          }
        }
        return false;
      }

      case 'cross': {
        const valA = await this.evaluateNodeStandalone(node.a, candles, true, context);
        const valB = await this.evaluateNodeStandalone(node.b, candles, true, context);
        if (!Array.isArray(valA) || !Array.isArray(valB) || valA.length < 2 || valB.length < 2) return false;
        if (node.direction === 'above') return valA[valA.length - 2] <= valB[valB.length - 2] && valA[valA.length - 1] > valB[valB.length - 1];
        return valA[valA.length - 2] >= valB[valB.length - 2] && valA[valA.length - 1] < valB[valB.length - 1];
      }

      // ── Branching / state / array nodes ──

      case 'conditional_fork': {
        // Evaluates the condition; on true routes trueSignal, on false routes
        // falseSignal (if defined — a Pine "else" branch). The chosen direction
        // is written to context.metadata.forkSignal for the engine to consume
        // when creating the signal / opening the position.
        const condResult = await this.evalConditionOrString(node.condition, candles, context, `conditional_fork`);
        if (context) context.metadata = context.metadata || {};
        if (condResult) {
          if (context?.metadata) context.metadata.forkSignal = node.trueSignal || 'LONG';
          return getHistory ? [true] : true;
        }
        if (node.falseSignal) {
          if (context?.metadata) context.metadata.forkSignal = node.falseSignal;
          return getHistory ? [true] : true;
        }
        return getHistory ? [false] : false;
      }

      case 'accumulator': {
        // Pine `var x = N; x += k if cond` — a counter persisted across
        // candles. State lives in context.state (created once per backtest
        // run), gated so each candle is counted exactly once. Returns the
        // current value so a downstream comparison (`counter >= 3`) works.
        const varName = node.varName || 'counter';
        const initialValue = Number(node.initialValue) || 0;
        const state = this.getAccumulatorState(context, varName, initialValue);
        const candleTime = String(candles[0]?.time ?? '');

        const inc = await this.evalConditionOrString(node.incrementCondition, candles, context, `accumulator ${varName}`);
        const rst = node.resetCondition
          ? await this.evalConditionOrString(node.resetCondition, candles, context, `accumulator ${varName} reset`)
          : false;
        stepAccumulator(state, candleTime, !!inc, !!rst, Number(node.incrementValue) || 1, initialValue);
        return getHistory ? [state.value] : state.value;
      }

      case 'lookback_window': {
        // Pine `for i = 0 to N: if cond[i]` — condition over each of the last
        // N bars, aggregated by all/any/majority. AST conditions are
        // re-evaluated with the candle window shifted back bar by bar
        // (candles are newest-first, so slice(k) makes bar k "current").
        const bars = Math.max(1, Math.min(Number(node.lookbackBars) || 5, candles.length - 1));
        const results: boolean[] = [];
        for (let k = 0; k < bars; k++) {
          const shifted = candles.slice(k);
          if (!shifted.length) break;
          // The precomputed-indicator fast path is anchored on candleIndex —
          // shift it together with the candle window or every bar would read
          // the same cached value.
          const shiftedCtx = context && typeof context.candleIndex === 'number'
            ? { ...context, candleIndex: context.candleIndex - k }
            : context;
          if (shiftedCtx && typeof shiftedCtx.candleIndex === 'number' && shiftedCtx.candleIndex < 0) break;
          results.push(!!(await this.evalConditionOrString(node.condition, shifted, shiftedCtx, 'lookback_window')));
        }
        const agg = applyLookbackLogic(results, node.logic);
        return getHistory ? [agg] : agg;
      }

      case 'logic_corr': {
        // Correlation with another pair. In backtest the target pair's candles
        // are prefetched point-in-time by backtest.service into
        // context.corrPairs (Map<pair, Map<timeISO, close>>) — falling back to
        // "latest candles" here would leak future data into the past.
        const targetPair = node.pair || 'BTCUSDT';
        const minCorr = node.minCorr || 0.8;
        const timeMap: Map<string, number> | undefined = context?.corrPairs?.get?.(targetPair);
        if (!timeMap) {
          this.logger.warn(`logic_corr: no prefetched candles for ${targetPair} — returning false (backtest without corrPairs prefetch)`);
          return false;
        }
        const pricesA: number[] = [];
        const pricesB: number[] = [];
        // candles are newest-first; walk up to 50 aligned bars
        for (const c of candles.slice(0, 50)) {
          const key = new Date(c.time).toISOString();
          const b = timeMap.get(key);
          if (b === undefined) continue;
          pricesA.push(parseFloat(c.close));
          pricesB.push(b);
        }
        if (pricesA.length < 20) return false;
        pricesA.reverse(); pricesB.reverse();
        const corr = this.indicatorsService.calculateCorrelation(pricesA, pricesB);
        return Math.abs(corr) >= minCorr;
      }

      // ── Indicators (pure computation) ──
      case 'indicator': {
        // Компилированный AST хранит {name, params:{period,source}}, optimizer-путь — {indicator, period, source}
        const indicatorName = node.indicator || node.name;
        const period = node.period || node.params?.period || 14;
        const source = node.source || node.params?.source || 'close';
        // VWAP не имеет period — в ключ кэша идёт anchor, чтобы разные anchor не коллизили
        const keyPeriod = indicatorName === 'VWAP' ? (node.params?.anchor || 'D') : period;

        // Fast path: precomputed series from backtest (O(1) lookup instead of O(n) recompute).
        // Ключ включает property — object-индикаторы (MACD/BB/Stoch/ADX) кэшируются как
        // готовая числовая серия выбранного поля.
        if (context?.indicatorCache && typeof context.candleIndex === 'number') {
          const cached = context.indicatorCache.get(`${indicatorName}:${keyPeriod}:${source}:${node.property || ''}`);
          if (cached) {
            const pos = context.candleIndex - cached.offset;
            if (getHistory) {
              if (pos < 1) return pos < 0 ? [0] : [cached.series[0]];
              return [cached.series[pos - 1], cached.series[pos]];
            }
            return pos >= 0 && pos < cached.series.length ? cached.series[pos] : 0;
          }
        }

        // Хронологические серии (candles — newest-first, .reverse() → по времени вперёд)
        const chrono = (f: string) => candles.map(c => parseFloat(c[f])).reverse();
        const values = candles.map(c => parseFloat(c[source] || c.close)).reverse();
        const params = node.params || {};
        let result: number[];
        let objResult: any[] | null = null;

        switch (indicatorName) {
          case 'RSI': result = this.indicatorsService.calculateRSI(values, period); break;
          case 'SMA': result = this.indicatorsService.calculateSMA(values, period); break;
          case 'EMA': result = this.indicatorsService.calculateEMA(values, period); break;
          case 'ATR': result = this.indicatorsService.calculateATR(chrono('high'), chrono('low'), values, period); break;
          case 'ZScore': result = this.indicatorsService.calculateZScore(values, params.period || period); break;
          // VWAP берёт свечи newest-first (внутри разворачивает в ASC), не серию close
          case 'VWAP': result = this.indicatorsService.calculateVWAP(candles, params.anchor || 'D'); break;
          case 'MACD': objResult = this.indicatorsService.calculateMACD(values, params.fast || 12, params.slow || 26, params.signal || 9); break;
          case 'BollingerBands': objResult = this.indicatorsService.calculateBollingerBands(values, params.period || period, params.stdDev || 2); break;
          case 'Stochastic': objResult = this.indicatorsService.calculateStochastic(chrono('high'), chrono('low'), values, params.period || period, params.signalPeriod || 3); break;
          case 'ADX': objResult = this.indicatorsService.calculateADX(chrono('high'), chrono('low'), values, params.period || period) as any; break;
          default: result = this.indicatorsService.calculateSMA(values, period);
        }

        // object-индикаторы: извлекаем поле (property) в числовую серию
        if (objResult) {
          const defProp = indicatorName === 'MACD' ? 'histogram' : indicatorName === 'Stochastic' ? 'k' : indicatorName === 'ADX' ? 'adx' : 'middle';
          result = objResult.map(r => r?.[node.property || defProp]);
        }

        if (!result || result.length === 0) return getHistory ? [0] : 0;
        return getHistory ? result : result[result.length - 1];
      }

      case 'input': {
        // Фьючерсные метрики читаются из полей свечи (паритет с live signals-engine),
        // а не подменяются close-ценой — иначе fundingRate/OI/markPrice-стратегии
        // в бэктесте молча сравнивают цену вместо метрики и дают 0 сигналов.
        const src = node.source;
        if (src === 'markPrice' || src === 'fundingRate' || src === 'openInterest') {
          const field = src === 'markPrice' ? 'mark_price' : src === 'fundingRate' ? 'funding_rate' : 'open_interest';
          const read = (c: any) => {
            const raw = c[field];
            if (raw === null || raw === undefined || raw === '') {
              return src === 'markPrice' ? parseFloat(c.close) : 0; // markPrice→close, funding/OI→0
            }
            return parseFloat(raw);
          };
          return getHistory ? candles.map(read).reverse() : read(candles[0]);
        }
        return getHistory ? closesHistory() : lastClose();
      }

      case 'constant':
        return getHistory ? [node.value] : node.value;

      case 'scanner':
      case 'exchange_data':
      case 'exchange_scanner':
        return getHistory ? [lastClose()] : lastClose();

      // ── AI/External nodes → defaults in standalone mode ──
      case 'hermes':
      case 'heym_mcp':
      case 'mcp_tool':
      case 'llm_filter':
        return getHistory ? [true] : true;

      case 'sentiment':
        return getHistory ? [0] : 0;

      case 'deep_research':
        return getHistory ? [true] : true;

      case 'ai_forecast':
        return getHistory ? [0] : 0;

      case 'ml_filter': {
        const modelId = node.params?.modelId || node.modelId;
        const minScore = node.params?.minScore || node.minScore || 0.7;
        if (!modelId || !context?.mlService) return getHistory ? [true] : true;

        const score = await context.mlService.predict(modelId, candles, context);
        const passed = score >= minScore;
        return getHistory ? [passed] : passed;
      }

      // ── Order flow (computable from candle data) ──
      case 'order_flow': {
        const metric = node.metric || 'delta';
        if (metric === 'cvd') {
          const cvd = this.indicatorsService.calculateCVD(candles);
          return getHistory ? cvd : cvd[cvd.length - 1];
        }
        if (metric === 'delta') {
          const c0 = candles[0];
          const v = parseFloat(c0.volume);
          let delta = 0;
          if (c0.taker_buy_volume !== undefined && c0.taker_buy_volume !== null) {
            const buyVol = parseFloat(c0.taker_buy_volume);
            delta = buyVol - (v - buyVol);
          } else {
            const h = parseFloat(c0.high), l = parseFloat(c0.low), cl = parseFloat(c0.close);
            if (h !== l) delta = v * (2 * (cl - l) / (h - l) - 1);
          }
          return getHistory ? [delta] : delta;
        }
        // Liquidations need live WS data — unavailable in backtest
        return node.threshold !== undefined ? false : 0;
      }

      // ── Orderbook: mock values in backtest (matches SignalsEngine backtest behavior) ──
      case 'orderbook': {
        const metric = node.params?.metric || 'imbalance';

        // Real point-in-time snapshot, populated by backtest.service.ts from
        // OrderbookSnapshot rows collected going forward by
        // OrderbookSnapshotService (see backend/src/orderbook/). Binance (like
        // most exchanges) has no historical L2 depth archive, so backtests
        // over periods before collection started fall through to the labeled
        // mock below — never silently faked as real.
        const snap = context?.orderbookSnapshot;
        if (snap) {
          if (metric === 'imbalance') { const r = Number(snap.imbalance_pct); return getHistory ? [r] : r; }
          if (metric === 'spread') { const r = Number(snap.spread_pct); return getHistory ? [r] : r; }
          if (metric === 'wall_distance') { const r = Number(snap.wall_distance_pct ?? 0); return getHistory ? [r] : r; }
        }

        // MOCK fallback — no snapshot available for this candle's period.
        if (metric === 'imbalance') return getHistory ? [52.5] : 52.5;
        if (metric === 'spread') return getHistory ? [0.05] : 0.05;
        if (metric === 'wall_distance') return getHistory ? [0.8] : 0.8;
        return 0;
      }

      // ── Smart Money Concepts (pure candle computation) ──
      case 'pump_dump': {
        const prices = candles.map(c => parseFloat(c.close)).reverse();
        const vols = candles.map(c => parseFloat(c.volume)).reverse();
        const r = this.indicatorsService.detectPumpDump(prices, vols, node.params);
        return r.isPump || r.isDump;
      }

      case 'fvg': {
        const gaps = this.indicatorsService.detectFVG(candles, node.params?.lookback, node.params?.onlyUnmitigated);
        const p = parseFloat(candles[0].close);
        return gaps.some((g: any) => p <= g.top && p >= g.bottom);
      }

      case 'eqh_eql': {
        const pools = this.indicatorsService.detectEQHEQL(candles, node.params?.lookback, node.params?.thresholdPct);
        return pools.length > 0;
      }

      case 'order_block': {
        const obs = this.indicatorsService.detectOrderBlocks(candles, node.params?.lookback);
        const p = parseFloat(candles[0].close);
        return obs.some((ob: any) => ob.type === node.params?.obType && p <= ob.top && p >= ob.bottom);
      }

      case 'market_structure': {
        const s = this.indicatorsService.detectMarketStructure(candles, node.params?.lookback);
        return node.property ? (s as any)[node.property] : s.trend;
      }

      case 'fib_ote': {
        const fib = this.indicatorsService.calculateFibLevels(candles, {
          direction: node.params?.direction ?? 'auto',
          lookback: node.params?.lookback ?? 50,
          zoneFrom: node.params?.zoneFrom ?? 0.618,
          zoneTo: node.params?.zoneTo ?? 0.786,
        });
        if (!fib) return false;
        const p = parseFloat(candles[0].close);
        return p <= fib.oteZone.top && p >= fib.oteZone.bottom;
      }

      case 'premium_discount': {
        const pd = this.indicatorsService.calculatePremiumDiscount(candles, node.params?.lookback || 100);
        return node.property ? pd === node.property : pd;
      }

      case 'liquidity_sweep': {
        const sweeps = this.indicatorsService.detectLiquiditySweeps(candles, node.params?.lookback);
        if (node.params?.sweepType === 'ANY') return sweeps.length > 0;
        return sweeps.some((sw: any) => sw.type === node.params?.sweepType);
      }

      case 'time_filter': {
        const t = new Date(candles[0].time);
        const cur = t.getUTCHours() * 60 + t.getUTCMinutes();
        const [sh, sm] = (node.params?.from || '00:00').split(':').map(Number);
        const [eh, em] = (node.params?.to || '23:59').split(':').map(Number);
        const startM = sh * 60 + sm, endM = eh * 60 + em;
        return startM <= endM ? (cur >= startM && cur <= endM) : (cur >= startM || cur <= endM);
      }

      // ── Custom JS code (TradingView-style: index 0 = current candle) ──
      case 'custom_code': {
        try {
          const closesC = candles.map(c => parseFloat(c.close)).reverse();
          const highsC = candles.map(c => parseFloat(c.high)).reverse();
          const lowsC = candles.map(c => parseFloat(c.low)).reverse();
          const volsC = candles.map(c => parseFloat(c.volume)).reverse();
          const fn = new Function('close', 'high', 'low', 'volume',
            node.code || '');
          const r = fn([...closesC].reverse(), [...highsC].reverse(), [...lowsC].reverse(), [...volsC].reverse());
          return getHistory ? [r] : r;
        } catch (e: any) {
          this.logger.warn(`custom_code error in node ${node.id}: ${e.message}`);
          return getHistory ? [false] : false;
        }
      }

      // ── Truly external (no data in worker) → defaults ──
      case 'finviz_scanner':
      case 'webhook':
      case 'polymarket':
      case 'deribit_pcr':
        return getHistory ? [0] : 0;

      default:
        return getHistory ? [0] : 0;
    }
  }
}
