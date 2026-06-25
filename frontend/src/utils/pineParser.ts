import { Node, Edge } from 'reactflow';

let _counter = 0;
function uid(label: string) {
  return `pine_${label}_${++_counter}_${Math.random().toString(36).slice(2, 5)}`;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function stripComments(code: string): string {
  return code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\r/g, '');
}

function normalizeToV5(code: string): string {
  // v3/v4 functions without ta. prefix → add ta. prefix
  const taFuncs = [
    'rsi', 'sma', 'ema', 'wma', 'dema', 'tema', 'vwma', 'hma', 'alma',
    'macd', 'bb', 'bbw', 'stoch', 'atr', 'cci', 'mfi', 'obv', 'adx',
    'roc', 'mom', 'vwap', 'wpr', 'dmi', 'supertrend',
    'crossover', 'crossunder', 'cross',
    'highest', 'lowest', 'highestbars', 'lowestbars',
    'rising', 'falling', 'change', 'tr', 'pivothigh', 'pivotlow',
    'valuewhen', 'barssince', 'cum',
  ];
  const pattern = new RegExp(`(?<!\\w|ta\\.)\\b(${taFuncs.join('|')})\\s*\\(`, 'g');
  let result = code.replace(pattern, 'ta.$1(');

  // v3 security() → request.security()
  result = result.replace(/(?<!request\.)security\s*\(/g, 'request.security(');

  // v3 input() → input.int() / input.float() / input.string() — normalize to input()
  // (keep as-is, we handle input.* below)

  // v3 study() → indicator()
  result = result.replace(/\bstudy\s*\(/g, 'indicator(');

  return result;
}

// ─── types ────────────────────────────────────────────────────────────────────

interface VarMeta {
  nodeId: string;
  indType: string;   // 'rsi' | 'ema' | 'sma' | 'macd' | 'bb' | 'stoch' | 'volume'
  prop?: string;     // 'histogram' | 'macd' | 'signal' | 'upper' | 'lower' | 'middle' | 'k' | 'd'
}

interface CmpNode {
  nodeId: string;
  varName: string;
  op: string;
  val: number | null;  // null when comparing two variables
  rightVar?: string;
}

export interface ParseReport {
  totalLines: number;
  recognizedLines: number;
  skippedLines: string[];
  indicators: string[];
  signals: string[];
  warnings: string[];
  quality: 'full' | 'partial' | 'fallback';
  qualityPercent: number;
}

interface SignalSource {
  id: string;
  type: 'LONG' | 'SHORT';
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function parsePineScript(code: string): { nodes: Node[]; edges: Edge[]; report: ParseReport } {
  _counter = 0;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const push = (e: Edge) => edges.push(e);

  const src = normalizeToV5(stripComments(code));

  const report: ParseReport = {
    totalLines: 0,
    recognizedLines: 0,
    skippedLines: [],
    indicators: [],
    signals: [],
    warnings: [],
    quality: 'full',
    qualityPercent: 100,
  };

  const meaningfulLines = src.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('//'));
  report.totalLines = meaningfulLines.length;

  const recognizedPatterns = new Set<string>();
  function markRecognized(line: string) {
    recognizedPatterns.add(line.trim().substring(0, 60));
  }

  // Input node
  const inputId = uid('input');
  nodes.push({ id: inputId, type: 'input', position: { x: 50, y: 220 }, data: { source: 'Mark Price' } });

  // variable map: varName → VarMeta
  const vars: Record<string, VarMeta> = {};
  vars['close'] = { nodeId: inputId, indType: 'input' };
  vars['open']  = { nodeId: inputId, indType: 'input' };
  vars['high']  = { nodeId: inputId, indType: 'input' };
  vars['low']   = { nodeId: inputId, indType: 'input' };

  let indY = 50;

  function addEdge(source: string, target: string, handle?: string, color = '#534AB7') {
    push({ id: uid('e'), source, target, ...(handle ? { targetHandle: handle } : {}), style: { stroke: color, strokeWidth: 1.5 } });
  }

  function resolveSource(varName: string): string | null {
    return vars[varName]?.nodeId ?? null;
  }

  // ── 1. Indicators ────────────────────────────────────────────────────────────

  // ta.rsi(src, period)
  const rsiRx = /(\w+)\s*=\s*ta\.rsi\s*\(\s*(\w+)\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(rsiRx)) {
    const [, varName, , periodStr] = m;
    const nodeId = uid(`rsi_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'RSI', params: { period: +periodStr } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'rsi' };
    indY += 110;
  }

  // ta.sma / ta.ema / ta.wma / ta.dema / ta.tema(src, period)
  const maRx = /(\w+)\s*=\s*ta\.(sma|ema|wma|dema|tema)\s*\(\s*(\w+)\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(maRx)) {
    const [, varName, indType, , periodStr] = m;
    const nodeId = uid(`${indType}_${varName}`);
    const nameMap: Record<string, string> = { sma: 'SMA', ema: 'EMA', wma: 'SMA', dema: 'EMA', tema: 'EMA' };
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: nameMap[indType] || indType.toUpperCase(), params: { period: +periodStr } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType };
    indY += 110;
  }

  // ta.macd(src, fast, slow, signal)
  // Supports: [macdLine, signalLine, hist] = ta.macd(close, 12, 26, 9)
  const macdDestructRx = /\[(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*ta\.macd\s*\(\s*\w+\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(macdDestructRx)) {
    const [, macdVar, signalVar, histVar, fast, slow, sig] = m;
    const nodeId = uid('macd');
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'MACD', params: { fast: +fast, slow: +slow, signal: +sig } } });
    addEdge(inputId, nodeId);
    vars[macdVar]  = { nodeId, indType: 'macd', prop: 'macd' };
    vars[signalVar] = { nodeId, indType: 'macd', prop: 'signal' };
    vars[histVar]   = { nodeId, indType: 'macd', prop: 'histogram' };
    indY += 110;
  }
  // single: macdHist = ta.macd(...).histogram  OR varName = ta.macd(...)
  const macdSingleRx = /(\w+)\s*=\s*ta\.macd\s*\(\s*\w+\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)(?:\.(\w+))?/g;
  for (const m of src.matchAll(macdSingleRx)) {
    const [, varName, fast, slow, sig, prop] = m;
    if (vars[varName]) continue; // already registered via destructuring
    const nodeId = uid(`macd_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'MACD', params: { fast: +fast, slow: +slow, signal: +sig }, property: prop || 'histogram' } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'macd', prop: prop || 'histogram' };
    indY += 110;
  }

  // ta.bb(src, period, mult)  →  [upper, basis, lower] = ta.bb(close, 20, 2)
  const bbDestructRx = /\[(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*ta\.bb\s*(?:ands)?\s*\(\s*\w+\s*,\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)\s*\)/g;
  for (const m of src.matchAll(bbDestructRx)) {
    const [, upperVar, midVar, lowerVar, period, stdDev] = m;
    const nodeId = uid('bb');
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'BB', params: { period: +period, stdDev: +stdDev } } });
    addEdge(inputId, nodeId);
    vars[upperVar] = { nodeId, indType: 'bb', prop: 'upper' };
    vars[midVar]   = { nodeId, indType: 'bb', prop: 'middle' };
    vars[lowerVar] = { nodeId, indType: 'bb', prop: 'lower' };
    indY += 110;
  }
  // ta.bb single property
  const bbSingleRx = /(\w+)\s*=\s*ta\.bb\s*\(\s*\w+\s*,\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)\s*\)(?:\.(\w+))?/g;
  for (const m of src.matchAll(bbSingleRx)) {
    const [, varName, period, stdDev, prop] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`bb_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'BB', params: { period: +period, stdDev: +stdDev }, property: prop || 'upper' } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'bb', prop: prop || 'upper' };
    indY += 110;
  }

  // ta.stoch(high, low, close, period) → k=...; or [k, d] = ta.stoch(...)
  const stochRx = /(\w+)\s*=\s*ta\.stoch\s*\(\s*\w+\s*,\s*\w+\s*,\s*\w+\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(stochRx)) {
    const [, varName, period] = m;
    const nodeId = uid(`stoch_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'STOCHASTIC', params: { period: +period, signalPeriod: 3 }, property: 'k' } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'stoch', prop: 'k' };
    indY += 110;
  }

  // ta.atr(period)
  const atrRx = /(\w+)\s*=\s*ta\.atr\s*\(\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(atrRx)) {
    const [, varName, period] = m;
    const nodeId = uid(`atr_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'ATR', params: { period: +period } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'atr' };
    indY += 110;
  }

  // ta.cci(src, period)
  const cciRx = /(\w+)\s*=\s*ta\.cci\s*\(\s*\w+\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(cciRx)) {
    const [, varName, period] = m;
    const nodeId = uid(`cci_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'RSI', params: { period: +period } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'cci' };
    indY += 110;
  }

  // ta.vwap / vwap built-in
  const vwapRx = /(\w+)\s*=\s*(?:ta\.)?vwap/g;
  for (const m of src.matchAll(vwapRx)) {
    const [, varName] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`vwap_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'VWAP', params: { anchor: 'D' } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'vwap' };
    indY += 110;
  }

  // ta.mom / ta.roc
  const momRx = /(\w+)\s*=\s*ta\.(mom|roc)\s*\(\s*\w+\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(momRx)) {
    const [, varName, , period] = m;
    const nodeId = uid(`mom_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'RSI', params: { period: +period } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'mom' };
    indY += 110;
  }

  // volume SMA
  const volRx = /(\w+)\s*=\s*ta\.sma\s*\(\s*volume\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(volRx)) {
    const [, varName, period] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`vol_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'VOLUME', params: { period: +period } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'volume' };
    indY += 110;
  }

  // ta.adx(period) / ta.dmi(period) → ADX indicator
  const adxRx = /(\w+)\s*=\s*ta\.(?:adx|dmi)\s*\(\s*(?:\w+\s*,\s*)?(\d+)\s*\)/g;
  for (const m of src.matchAll(adxRx)) {
    const [, varName, period] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`adx_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'ADX', params: { period: +period }, property: 'adx' } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'adx' };
    indY += 110;
  }

  // ta.mfi(src, period) → mapped to RSI node (similar oscillator 0-100)
  const mfiRx = /(\w+)\s*=\s*ta\.mfi\s*\(\s*\w+\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(mfiRx)) {
    const [, varName, period] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`mfi_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'RSI', params: { period: +period } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'mfi' };
    indY += 110;
  }

  // ta.obv → Volume indicator
  const obvRx = /(\w+)\s*=\s*ta\.obv/g;
  for (const m of src.matchAll(obvRx)) {
    const [, varName] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`obv_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'VOLUME', params: {} } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'obv' };
    indY += 110;
  }

  // ta.supertrend(factor, period) → [value, direction]
  const stDestructRx = /\[(\w+)\s*,\s*(\w+)\s*\]\s*=\s*ta\.supertrend\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(stDestructRx)) {
    const [, valVar, dirVar, factor, period] = m;
    const nodeId = uid('supertrend');
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'EMA', params: { period: +period } } });
    addEdge(inputId, nodeId);
    vars[valVar] = { nodeId, indType: 'supertrend' };
    vars[dirVar] = { nodeId, indType: 'supertrend' };
    indY += 110;
  }

  // ta.hma / ta.alma / ta.vwma(src, period) → mapped to EMA
  const altMaRx = /(\w+)\s*=\s*ta\.(hma|alma|vwma)\s*\(\s*\w+\s*,\s*(\d+)(?:\s*,\s*[\d.]+)*\s*\)/g;
  for (const m of src.matchAll(altMaRx)) {
    const [, varName, maType, period] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`${maType}_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'EMA', params: { period: +period } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: maType };
    indY += 110;
  }

  // ta.wpr(period) → Williams %R, map to Stochastic (similar -100..0 oscillator)
  const wprRx = /(\w+)\s*=\s*ta\.wpr\s*\(\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(wprRx)) {
    const [, varName, period] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`wpr_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'STOCHASTIC', params: { period: +period, signalPeriod: 3 }, property: 'k' } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'wpr' };
    indY += 110;
  }

  // ta.highest(src, period) / ta.lowest(src, period) → comparison proxy
  const hlRx = /(\w+)\s*=\s*ta\.(highest|lowest)\s*\(\s*(\w+)\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(hlRx)) {
    const [, varName, fn, srcVar, period] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`${fn}_${varName}`);
    nodes.push({ id: nodeId, type: 'indicator', position: { x: 320, y: indY }, data: { name: 'EMA', params: { period: +period } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: fn };
    indY += 110;
  }

  // ta.pivothigh / ta.pivotlow(leftbars, rightbars) → user_level proxy
  const pivotRx = /(\w+)\s*=\s*ta\.(pivothigh|pivotlow)\s*\(\s*(?:\w+\s*,\s*)?(\d+)\s*,\s*(\d+)\s*\)/g;
  for (const m of src.matchAll(pivotRx)) {
    const [, varName, pivotType, left, right] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`pivot_${varName}`);
    nodes.push({ id: nodeId, type: 'user_level', position: { x: 320, y: indY }, data: { type: 'horizontal_line', params: { levelId: 0 } } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: pivotType };
    indY += 110;
  }

  // input.int / input.float / input.bool / input.source / input() → extract default value
  const inputRx = /(\w+)\s*=\s*input(?:\.\w+)?\s*\(\s*(?:defval\s*=\s*)?(\d+(?:\.\d+)?)/g;
  for (const m of src.matchAll(inputRx)) {
    const [, varName, defVal] = m;
    if (vars[varName]) continue;
    // Store as a pseudo-variable with the input node (default value as a constant)
    vars[varName] = { nodeId: inputId, indType: 'input' };
  }

  // request.security(syminfo, timeframe, expr) → MTF node
  const secRx = /(\w+)\s*=\s*request\.security\s*\(\s*(?:\w+)\s*,\s*["'](\w+)["']/g;
  for (const m of src.matchAll(secRx)) {
    const [, varName, tf] = m;
    if (vars[varName]) continue;
    const nodeId = uid(`mtf_${varName}`);
    nodes.push({ id: nodeId, type: 'mtf', position: { x: 320, y: indY }, data: { timeframe: tf.toUpperCase() } });
    addEdge(inputId, nodeId);
    vars[varName] = { nodeId, indType: 'mtf' };
    indY += 110;
  }

  // Variable aliases: alias = existingVar
  const aliasRx = /^(\w+)\s*=\s*(\w+)\s*$/mg;
  for (const m of src.matchAll(aliasRx)) {
    const [, alias, source] = m;
    if (!vars[alias] && vars[source]) vars[alias] = vars[source];
  }

  // ── 2. Cross ─────────────────────────────────────────────────────────────────

  const crossRx = /(\w+)\s*=\s*ta\.(crossover|crossunder|cross)\s*\(\s*(\w+)\s*,\s*(\w+(?:\.\d+)?)\s*\)/g;
  const crossDirectRx = /(?<!\w=\s*)ta\.(crossover|crossunder|cross)\s*\(\s*(\w+)\s*,\s*(\w+(?:\.\d+)?)\s*\)/g;

  const crossMap: Record<string, SignalSource> = {};

  function buildCross(varName: string | null, crossType: string, leftVar: string, rightVar: string): string | null {
    const isLong = crossType === 'crossover';
    const leftId  = resolveSource(leftVar);
    const rightIsNum = !isNaN(parseFloat(rightVar));
    const rightId = rightIsNum ? null : resolveSource(rightVar);

    if (!leftId) return null;

    if (rightId) {
      // Cross between two variables → cross node
      const nodeId = uid(`cross_${leftVar}_${rightVar}`);
      nodes.push({ id: nodeId, type: 'cross', position: { x: 580, y: indY }, data: { direction: isLong ? 'above' : 'below' } });
      addEdge(leftId, nodeId, 'a', '#6B5DD3');
      addEdge(rightId, nodeId, 'b', '#6B5DD3');
      indY += 130;

      if (varName) crossMap[varName] = { id: nodeId, type: isLong ? 'LONG' : 'SHORT' };
      return nodeId;
    } else {
      // Cross with a number (e.g. crossover(rsi, 30)) → comparison node
      const op = isLong ? 'cross_above' : 'cross_below';
      const nodeId = uid(`cmp_cross_${leftVar}`);
      const data: Record<string, unknown> = { operator: op };
      if (rightIsNum) data.value = parseFloat(rightVar);
      nodes.push({ id: nodeId, type: 'comparison', position: { x: 580, y: indY }, data });
      addEdge(leftId, nodeId);
      indY += 130;

      if (varName) {
        crossMap[varName] = { id: nodeId, type: isLong ? 'LONG' : 'SHORT' };
        vars[varName] = { nodeId, indType: 'comparison' };
      }
      return nodeId;
    }
  }

  for (const m of src.matchAll(crossRx)) {
    const [, varName, crossType, leftVar, rightVar] = m;
    buildCross(varName, crossType, leftVar, rightVar);
  }
  for (const m of src.matchAll(crossDirectRx)) {
    const [, crossType, leftVar, rightVar] = m;
    buildCross(null, crossType, leftVar, rightVar);
  }

  // ── 3. Comparisons ───────────────────────────────────────────────────────────

  // var > N  or  var > var2
  const cmpRx = /\b(\w+)\s*(>|<|>=|<=|==)\s*(\w+(?:\.\w+)?)\b/g;
  const cmpNodes: CmpNode[] = [];
  const cmpSeen = new Set<string>();
  let cmpY = 50;

  for (const m of src.matchAll(cmpRx)) {
    const [, left, op, right] = m;
    if (!vars[left]) continue;
    // skip Pine keywords
    if (['true', 'false', 'na', 'bar_index'].includes(right)) continue;

    const numVal = parseFloat(right);
    const isNumeric = !isNaN(numVal);
    const rightIsVar = !isNumeric && !!vars[right];

    const key = `${left}${op}${right}`;
    if (cmpSeen.has(key)) continue;
    cmpSeen.add(key);

    const nodeId = uid(`cmp_${left}`);
    const nodeData: Record<string, unknown> = { operator: op };
    if (isNumeric) nodeData.value = numVal;

    nodes.push({ id: nodeId, type: 'comparison', position: { x: 700, y: cmpY }, data: nodeData });

    // Edge from left indicator
    const leftId = resolveSource(left);
    if (leftId) addEdge(leftId, nodeId);

    // If right side is also a var (e.g. ema20 > ema50)
    if (rightIsVar) {
      const rightId = resolveSource(right);
      if (rightId) addEdge(rightId, nodeId, 'b');
    }

    cmpNodes.push({ nodeId, varName: left, op, val: isNumeric ? numVal : null, rightVar: rightIsVar ? right : undefined });
    cmpY += 110;
  }

  // ── 4. Logic: detect AND combinations ────────────────────────────────────────
  // e.g.: longCondition = rsiOk and emaOk and crossOk
  // This pattern: varName = cond1 and cond2 [and ...]
  const logicRx = /(\w+)\s*=\s*((?:[\w.]+(?:\s*[><=!]+\s*[\w.]+)?\s+(?:and|or)\s+)+[\w.]+(?:\s*[><=!]+\s*[\w.]+)?)/gi;
  const logicSources: Record<string, string> = {}; // logicVarName → andNodeId

  for (const m of src.matchAll(logicRx)) {
    const [, varName, expr] = m;
    const parts = expr.split(/\s+(?:and|or)\s+/i).map(s => s.trim());
    const operator = /\bor\b/i.test(expr) ? 'OR' : 'AND';

    // Resolve each part to a nodeId
    const resolved: string[] = [];
    for (const part of parts) {
      const crossSrc = crossMap[part];
      if (crossSrc) { resolved.push(crossSrc.id); continue; }
      const cmpNode = cmpNodes.find(c => c.varName === part);
      if (cmpNode) { resolved.push(cmpNode.nodeId); continue; }
      const varMeta = vars[part];
      if (varMeta) { resolved.push(varMeta.nodeId); continue; }

      // Inline comparison: "ema9 > atrBand" or "rsi14 > 50"
      const inlineCmp = part.match(/^(\w+)\s*(>|<|>=|<=|==)\s*(\w+(?:\.\w+)?)$/);
      if (inlineCmp) {
        const [, left, op, right] = inlineCmp;
        const leftId = resolveSource(left);
        if (leftId) {
          const cmpId = uid(`cmp_inline_${left}`);
          const numVal = parseFloat(right);
          const isNum = !isNaN(numVal);
          const cmpData: Record<string, unknown> = { operator: op };
          if (isNum) cmpData.value = numVal;
          nodes.push({ id: cmpId, type: 'comparison', position: { x: 700, y: cmpY }, data: cmpData });
          addEdge(leftId, cmpId);
          if (!isNum && vars[right]) addEdge(vars[right].nodeId, cmpId, 'b');
          cmpNodes.push({ nodeId: cmpId, varName: left, op, val: isNum ? numVal : null, rightVar: !isNum ? right : undefined });
          resolved.push(cmpId);
          cmpY += 110;
          continue;
        }
      }
    }

    if (resolved.length < 2) continue;

    const andId = uid(`logic_${varName}`);
    nodes.push({ id: andId, type: 'logic', position: { x: 880, y: cmpY }, data: { operator } });
    for (const src2 of resolved) addEdge(src2, andId, undefined, '#2E7D32');
    logicSources[varName] = andId;
    cmpY += 120;
  }

  // ── 4b. Pine Block: catch remaining unrecognized variable assignments ───────
  const assignRx = /^(\w+)\s*=\s*(.+)$/mg;
  const skipVarNames = new Set(['true', 'false', 'na', 'bar_index', 'last_bar_index', 'timenow', 'time']);
  const skipPrefixes = ['indicator(', 'strategy(', 'plot(', 'plotshape(', 'plotchar(', 'bgcolor(', 'barcolor(', 'fill(', 'hline(', 'alertcondition(', 'alert(', 'strategy.entry(', 'strategy.close(', 'strategy.exit(', 'strategy.order('];

  for (const m of src.matchAll(assignRx)) {
    const [fullMatch, varName, expr] = m;
    if (vars[varName]) continue;
    if (skipVarNames.has(varName)) continue;
    if (skipPrefixes.some(p => expr.trim().startsWith(p))) continue;
    if (/^\s*input/.test(expr)) continue;
    if (/^\d+(\.\d+)?$/.test(expr.trim())) continue;
    if (/^["']/.test(expr.trim())) continue;
    if (/^\w+$/.test(expr.trim()) && !vars[expr.trim()]) continue;
    if (logicSources[varName]) continue;

    const funcMatch = expr.match(/(?:ta\.)?(\w+)\s*\(/);
    const funcName = funcMatch ? funcMatch[1] : '';

    const nodeId = uid(`pine_${varName}`);
    nodes.push({
      id: nodeId,
      type: 'pine_block',
      position: { x: 320, y: indY },
      data: {
        varName,
        pineCode: fullMatch.trim(),
        funcName,
        needsManualReplace: true,
      }
    });
    addEdge(inputId, nodeId, undefined, '#F59E0B');

    for (const [knownVar, meta] of Object.entries(vars)) {
      if (knownVar !== 'close' && knownVar !== 'open' && knownVar !== 'high' && knownVar !== 'low') {
        if (expr.includes(knownVar)) {
          addEdge(meta.nodeId, nodeId, undefined, '#F59E0B');
        }
      }
    }

    vars[varName] = { nodeId, indType: 'pine_block' };
    indY += 110;
  }

  // ── 5. Detect signal conditions ──────────────────────────────────────────────
  // strategy.entry("Long", strategy.long, when = condition)
  // alertcondition(condition, ...)
  // longCondition → direct name patterns

  const signalSources: SignalSource[] = [];

  function resolveCondition(condVar: string): string | null {
    return logicSources[condVar] || crossMap[condVar]?.id || cmpNodes.find(c => c.varName === condVar)?.nodeId || vars[condVar]?.nodeId || null;
  }

  // strategy.entry("Long", strategy.long, when = condition)
  const stratEntryRx = /strategy\.entry\s*\(\s*["']([^"']+)["']\s*,\s*strategy\.(long|short)\s*(?:,\s*(?:when|comment)\s*=\s*(\w+))?\s*\)/gi;
  for (const m of src.matchAll(stratEntryRx)) {
    const [, , dir, condVar] = m;
    const type = dir.toLowerCase() === 'long' ? 'LONG' : 'SHORT';
    const srcId = condVar ? resolveCondition(condVar) : null;
    if (srcId) signalSources.push({ id: srcId, type });
  }

  // if (condition) strategy.entry(...)  — v5 pattern
  const ifEntryRx = /if\s+(\w+)\s*\n\s*strategy\.entry\s*\(\s*["'][^"']+["']\s*,\s*strategy\.(long|short)/gi;
  for (const m of src.matchAll(ifEntryRx)) {
    const [, condVar, dir] = m;
    const type = dir.toLowerCase() === 'long' ? 'LONG' : 'SHORT';
    const srcId = resolveCondition(condVar);
    if (srcId) signalSources.push({ id: srcId, type });
  }

  // plotshape(condition, ..., style=shape.triangleup) → LONG, triangledown → SHORT
  const plotshapeRx = /plotshape\s*\(\s*(\w+)\s*(?:,[\s\S]*?style\s*=\s*shape\.(triangleup|triangledown|arrowup|arrowdown|cross|labelup|labeldown))?/gi;
  for (const m of src.matchAll(plotshapeRx)) {
    const [, condVar, shape] = m;
    const isShort = shape && /down/i.test(shape);
    const srcId = resolveCondition(condVar);
    if (srcId) signalSources.push({ id: srcId, type: isShort ? 'SHORT' : 'LONG' });
  }

  // alertcondition(condition, ...) — first arg as LONG signal
  if (signalSources.length === 0) {
    const alertRx = /alertcondition\s*\(\s*(\w+)\s*,/g;
    for (const m of src.matchAll(alertRx)) {
      const [, condVar] = m;
      const srcId = resolveCondition(condVar);
      if (srcId) signalSources.push({ id: srcId, type: 'LONG' });
    }
  }

  // alert() with message containing "buy"/"sell"/"long"/"short"
  if (signalSources.length === 0) {
    const alertMsgRx = /alert\s*\(\s*["']([^"']+)["']/gi;
    for (const m of src.matchAll(alertMsgRx)) {
      const msg = m[1].toLowerCase();
      if (/buy|long/i.test(msg) || /sell|short/i.test(msg)) {
        const type = /sell|short/i.test(msg) ? 'SHORT' : 'LONG';
        const lastLogic = Object.values(logicSources).pop();
        const lastCross = Object.values(crossMap).pop();
        const srcId = lastLogic || lastCross?.id;
        if (srcId) signalSources.push({ id: srcId, type });
      }
    }
  }

  // Fallback: variables named longCondition / shortCondition / longEntry / shortEntry
  if (signalSources.length === 0) {
    const longNames = ['longCondition', 'longEntry', 'longCond', 'goLong', 'buySignal'];
    const shortNames = ['shortCondition', 'shortEntry', 'shortCond', 'goShort', 'sellSignal'];
    for (const name of longNames) {
      const srcId = logicSources[name] || crossMap[name]?.id;
      if (srcId) { signalSources.push({ id: srcId, type: 'LONG' }); break; }
    }
    for (const name of shortNames) {
      const srcId = logicSources[name] || crossMap[name]?.id;
      if (srcId) { signalSources.push({ id: srcId, type: 'SHORT' }); break; }
    }
  }

  // Fallback: all cross nodes as signals
  if (signalSources.length === 0) {
    for (const [, cs] of Object.entries(crossMap)) signalSources.push(cs);
  }

  // Fallback: last comparison node → LONG signal
  if (signalSources.length === 0 && cmpNodes.length > 0) {
    signalSources.push({ id: cmpNodes[cmpNodes.length - 1].nodeId, type: 'LONG' });
  }

  // ── 6. Wire signals ──────────────────────────────────────────────────────────

  let sigY = 300;
  const sigX = 1080;

  for (const ss of signalSources) {
    const sigId = uid('signal');
    nodes.push({ id: sigId, type: 'signal', position: { x: sigX, y: sigY }, data: { signalType: ss.type } });
    addEdge(ss.id, sigId, undefined, '#E53935');
    sigY += 220;
  }

  // ── Build report ──────────────────────────────────────────────────────────────

  // Collect recognized indicators
  for (const [varName, meta] of Object.entries(vars)) {
    if (meta.indType !== 'input') {
      report.indicators.push(meta.indType.toUpperCase());
    }
  }
  report.indicators = [...new Set(report.indicators)];

  // Collect signal types
  for (const ss of signalSources) {
    report.signals.push(ss.type);
  }

  // Detect unrecognized ta.* calls
  const allTaCalls = [...src.matchAll(/ta\.(\w+)\s*\(/g)].map(m => m[1]);
  const handledTa = new Set([
    'rsi', 'sma', 'ema', 'wma', 'dema', 'tema', 'vwma', 'hma', 'alma',
    'macd', 'bb', 'stoch', 'atr', 'cci', 'mfi', 'obv', 'adx', 'dmi',
    'roc', 'mom', 'vwap', 'wpr', 'supertrend',
    'crossover', 'crossunder', 'cross',
    'highest', 'lowest', 'pivothigh', 'pivotlow',
  ]);
  const unhandledTa = [...new Set(allTaCalls.filter(f => !handledTa.has(f)))];
  for (const fn of unhandledTa) {
    report.warnings.push(`ta.${fn}() not supported — skipped`);
  }

  // Detect unrecognized Pine constructs
  const unsupported: string[] = [];
  if (/\bfor\b/.test(src)) unsupported.push('for loops');
  if (/\bwhile\b/.test(src)) unsupported.push('while loops');
  if (/\bswitch\b/.test(src)) unsupported.push('switch statements');
  if (/\btype\b\s+\w+/.test(src)) unsupported.push('custom types (v5)');
  if (/\bmethod\b\s+\w+/.test(src)) unsupported.push('methods (v5)');
  if (/\bimport\b\s+\w+/.test(src)) unsupported.push('library imports (v5)');
  if (/\bmap\.new/.test(src)) unsupported.push('maps (v6)');
  if (/\bmatrix\.new/.test(src)) unsupported.push('matrices (v6)');
  if (/\barray\.new/.test(src)) unsupported.push('arrays');
  if (/\bline\.new|label\.new|box\.new/.test(src)) unsupported.push('drawing objects');
  if (/\btable\.new/.test(src)) unsupported.push('tables');
  for (const u of unsupported) {
    report.warnings.push(`${u} — not supported, skipped`);
  }

  // Count recognized nodes (excluding input node and signal nodes)
  const parsedNodeCount = nodes.filter(n => n.type !== 'input' && n.type !== 'signal').length;

  // Fallback: If no nodes were generated (other than the input node),
  // create a Custom Code node with the entire script.
  if (nodes.length === 1) {
    const customId = uid('custom_pine');
    nodes.push({
      id: customId,
      type: 'custom_code',
      position: { x: 320, y: 220 },
      data: { name: 'PineScript Block', code: code }
    });
    addEdge(inputId, customId);

    const sigId = uid('signal');
    nodes.push({ id: sigId, type: 'signal', position: { x: 620, y: 220 }, data: { signalType: 'LONG' } });
    addEdge(customId, sigId, undefined, '#E53935');

    report.quality = 'fallback';
    report.qualityPercent = 0;
    report.warnings.push('No indicators recognized — entire script placed in Custom Code node');
  } else {
    // Estimate quality: ratio of recognized ta.* calls vs total
    const totalTaCalls = allTaCalls.length || 1;
    const recognizedTaCalls = allTaCalls.filter(f => handledTa.has(f)).length;
    report.qualityPercent = Math.round((recognizedTaCalls / totalTaCalls) * 100);
    report.quality = report.qualityPercent >= 90 ? 'full' : 'partial';
    report.recognizedLines = parsedNodeCount;
  }

  return { nodes, edges, report };
}
