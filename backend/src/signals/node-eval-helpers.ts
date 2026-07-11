// Pure helpers shared by the live engine (signals-engine.service.ts) and the
// standalone backtest evaluator (ast-evaluator.service.ts) for the
// state/branching/array nodes (accumulator, conditional_fork, lookback_window).
// Kept dependency-free so the worker build stays standalone.

/**
 * Evaluates a simple Pine-style string condition against a single candle.
 * Supports: `<var> <op> <number>` where var ∈ close|open|high|low|volume and
 * op ∈ > < >= <= == !=. Anything else (references to named Pine variables we
 * can't resolve, function calls, etc.) returns null so the caller can warn
 * honestly instead of silently guessing.
 */
export function evalSimpleCondition(cond: string | undefined | null, candle: any): boolean | null {
  if (!cond || typeof cond !== 'string') return null;
  const m = cond.trim().match(/^(close|open|high|low|volume)\s*(>=|<=|==|!=|>|<)\s*(-?\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const [, varName, op, numStr] = m;
  const value = parseFloat(String(candle?.[varName.toLowerCase()]));
  if (!Number.isFinite(value)) return null;
  const target = parseFloat(numStr);
  switch (op) {
    case '>': return value > target;
    case '<': return value < target;
    case '>=': return value >= target;
    case '<=': return value <= target;
    case '==': return value === target;
    case '!=': return value !== target;
    default: return null;
  }
}

/** Aggregates per-bar boolean results of a lookback window. */
export function applyLookbackLogic(values: boolean[], logic: 'all' | 'any' | 'majority' | string | undefined): boolean {
  if (!values.length) return false;
  if (logic === 'any') return values.some(Boolean);
  if (logic === 'majority') return values.filter(Boolean).length * 2 > values.length;
  return values.every(Boolean); // 'all' (default)
}

export interface AccumulatorState {
  value: number;
  lastCandleTime: string | null;
}

/**
 * One accumulator step: gated so a given candle is only counted once
 * (the live engine re-evaluates the same open candle every tick; the backtest
 * advances candle by candle — both converge on "one update per candle").
 * Mutates and returns the state.
 */
export function stepAccumulator(
  state: AccumulatorState,
  candleTime: string,
  incrementResult: boolean,
  resetResult: boolean,
  incrementValue: number,
  initialValue: number,
): AccumulatorState {
  if (state.lastCandleTime === candleTime) return state; // same candle — no double count
  state.lastCandleTime = candleTime;
  if (resetResult) {
    state.value = initialValue;
    return state;
  }
  if (incrementResult) state.value += incrementValue;
  return state;
}
