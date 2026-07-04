export interface BtTrade {
  entryTime: string; exitTime: string; type: string;
  entryPrice: number; exitPrice: number; pnl: number; pnlPercent: number;
  fees?: number; exitReason?: string; isPartial?: boolean; forceClosed?: boolean;
}
export interface EquityPoint { t: string; v: number }

export function buildPnlHistogram(trades: BtTrade[], binCount = 11): Array<{ from: number; to: number; count: number }> {
  if (!trades.length) return [];
  const vals = trades.map((t) => Number(t.pnlPercent) || 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return [{ from: min, to: max, count: vals.length }];
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({ from: min + i * width, to: min + (i + 1) * width, count: 0 }));
  for (const v of vals) {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / width));
    bins[idx].count++;
  }
  return bins;
}

export function buildExitReasons(trades: BtTrade[]): Array<{ reason: 'TP' | 'SL' | 'TRAILING' | 'PARTIAL' | 'FORCE' | 'MANUAL'; count: number }> {
  const classify = (t: BtTrade): 'TP' | 'SL' | 'TRAILING' | 'PARTIAL' | 'FORCE' | 'MANUAL' => {
    if (t.forceClosed) return 'FORCE';
    const r = (t.exitReason || '').toUpperCase();
    if (t.isPartial || r.includes('PARTIAL')) return 'PARTIAL';
    if (r.startsWith('SL')) return 'SL';           // включая 'SL/Trailing' движка
    if (r.includes('TRAIL')) return 'TRAILING';
    if (r.includes('TP')) return 'TP';
    if (r.includes('MANUAL')) return 'MANUAL';
    if (r.includes('FORCE')) return 'FORCE';
    return (Number(t.pnl) >= 0 ? 'TP' : 'SL');     // легаси-строки без причины
  };
  const counts = new Map<string, number>();
  for (const t of trades) {
    const k = classify(t);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const order: Array<'TP' | 'SL' | 'TRAILING' | 'PARTIAL' | 'FORCE' | 'MANUAL'> = ['TP', 'SL', 'TRAILING', 'PARTIAL', 'FORCE', 'MANUAL'];
  return order.filter((k) => counts.has(k)).map((k) => ({ reason: k, count: counts.get(k)! }));
}

export function buildMonthlyPnl(trades: BtTrade[]): Array<{ month: string; pnl: number }> {
  const byMonth = new Map<string, number>();
  for (const t of trades) {
    const d = new Date(t.exitTime);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, (byMonth.get(key) || 0) + Number(t.pnl));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 }));
}

/** [7 дней (вс=0..сб=6)][24 часа] — сумма pnl по exitTime в UTC */
export function buildHourDayHeatmap(trades: BtTrade[]): number[][] {
  const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const t of trades) {
    const d = new Date(t.exitTime);
    m[d.getUTCDay()][d.getUTCHours()] += Number(t.pnl);
  }
  return m.map((row) => row.map((v) => Math.round(v * 100) / 100));
}

export function buildUnderwater(equity: EquityPoint[]): Array<{ t: string; ddPct: number }> {
  let peak = -Infinity;
  return equity.map((p) => {
    peak = Math.max(peak, p.v);
    const dd = peak > 0 ? ((peak - p.v) / peak) * 100 : 0;
    return { t: p.t, ddPct: Math.round(dd * 100) / 100 };
  });
}

/** Дни от пика перед МАКСИМАЛЬНОЙ просадкой до первого восстановления выше того пика; null — не восстановился */
export function daysToRecover(equity: EquityPoint[]): number | null {
  if (equity.length < 2) return 0;
  let peakIdx = 0;
  let worstDd = 0;
  let worstPeakIdx = 0;
  for (let i = 1; i < equity.length; i++) {
    if (equity[i].v > equity[peakIdx].v) peakIdx = i;
    const dd = (equity[peakIdx].v - equity[i].v) / equity[peakIdx].v;
    if (dd > worstDd) {
      worstDd = dd;
      worstPeakIdx = peakIdx;
    }
  }
  if (worstDd === 0) return 0;
  const peakV = equity[worstPeakIdx].v;
  for (let i = worstPeakIdx + 1; i < equity.length; i++) {
    if (equity[i].v >= peakV) {
      const ms = new Date(equity[i].t).getTime() - new Date(equity[worstPeakIdx].t).getTime();
      return Math.round(ms / 86400000);
    }
  }
  return null;
}
