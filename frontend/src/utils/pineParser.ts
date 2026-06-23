import { Node, Edge } from 'reactflow';

let _counter = 0;
function uid(label: string) {
  return `pine_${label}_${++_counter}_${Math.random().toString(36).slice(2, 5)}`;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function stripComments(code: string): string {
  // Remove line comments (//)
  return code.replace(/\/\/[^\n]*/g, '').replace(/\r/g, '');
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

interface SignalSource {
  id: string;
  type: 'LONG' | 'SHORT';
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function parsePineScript(code: string): { nodes: Node[]; edges: Edge[] } {
  _counter = 0;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const push = (e: Edge) => edges.push(e);

  const src = stripComments(code);

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

  // Variable aliases: alias = existingVar
  const aliasRx = /^(\w+)\s*=\s*(\w+)\s*$/mg;
  for (const m of src.matchAll(aliasRx)) {
    const [, alias, source] = m;
    if (!vars[alias] && vars[source]) vars[alias] = vars[source];
  }

  // ── 2. Cross ─────────────────────────────────────────────────────────────────

  const crossRx = /(\w+)\s*=\s*ta\.(crossover|crossunder)\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g;
  // Also direct (unassigned): ta.crossover(...)
  const crossDirectRx = /(?<!\w=\s*)ta\.(crossover|crossunder)\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g;

  const crossMap: Record<string, SignalSource> = {};

  function buildCross(varName: string | null, crossType: string, leftVar: string, rightVar: string): string | null {
    const isLong = crossType === 'crossover';
    const leftId  = resolveSource(leftVar);
    const rightId = resolveSource(rightVar);
    if (!leftId || !rightId) return null;

    const nodeId = uid(`cross_${leftVar}_${rightVar}`);
    nodes.push({ id: nodeId, type: 'cross', position: { x: 580, y: indY }, data: { direction: isLong ? 'above' : 'below' } });
    addEdge(leftId, nodeId, 'a', '#6B5DD3');
    addEdge(rightId, nodeId, 'b', '#6B5DD3');
    indY += 130;

    if (varName) crossMap[varName] = { id: nodeId, type: isLong ? 'LONG' : 'SHORT' };
    return nodeId;
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
  const logicRx = /(\w+)\s*=\s*((?:\w+\s+(?:and|or)\s+)+\w+)/gi;
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
    }

    if (resolved.length < 2) continue;

    const andId = uid(`logic_${varName}`);
    nodes.push({ id: andId, type: 'logic', position: { x: 880, y: cmpY }, data: { operator } });
    for (const src2 of resolved) addEdge(src2, andId, undefined, '#2E7D32');
    logicSources[varName] = andId;
    cmpY += 120;
  }

  // ── 5. Detect signal conditions ──────────────────────────────────────────────
  // strategy.entry("Long", strategy.long, when = condition)
  // alertcondition(condition, ...)
  // longCondition → direct name patterns

  const signalSources: SignalSource[] = [];

  const stratEntryRx = /strategy\.entry\s*\(\s*["'](\w+)["']\s*,\s*strategy\.(long|short)\s*(?:,\s*when\s*=\s*(\w+))?\s*\)/gi;
  for (const m of src.matchAll(stratEntryRx)) {
    const [, , dir, condVar] = m;
    const type = dir.toLowerCase() === 'long' ? 'LONG' : 'SHORT';
    const srcId = condVar
      ? (logicSources[condVar] || crossMap[condVar]?.id || cmpNodes.find(c => c.varName === condVar)?.nodeId)
      : null;
    if (srcId) signalSources.push({ id: srcId, type });
  }

  // alertcondition(longCond, ...) — first arg as LONG signal
  if (signalSources.length === 0) {
    const alertRx = /alertcondition\s*\(\s*(\w+)\s*,/g;
    for (const m of src.matchAll(alertRx)) {
      const [, condVar] = m;
      const srcId = logicSources[condVar] || crossMap[condVar]?.id || cmpNodes.find(c => c.varName === condVar)?.nodeId;
      if (srcId) signalSources.push({ id: srcId, type: 'LONG' });
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

  // Fallback: If no nodes were generated (other than the input node), 
  // we couldn't parse the specific indicators. In this case, we just create 
  // a Custom Code node with the entire script so the user doesn't lose it.
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
  }

  return { nodes, edges };
}
