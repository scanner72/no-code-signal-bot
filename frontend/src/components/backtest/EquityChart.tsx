import { useMemo } from 'react';
import { EquityPoint, buildUnderwater } from '../../utils/backtestStats';

const GREEN = '#3fb950';
const RED = '#f85149';

interface EquityChartProps {
  equityCurve: EquityPoint[];
  benchmark?: EquityPoint[];
  overlays?: Array<{ label: string; color: string; points: EquityPoint[] }>;
  trades?: Array<{ exitTime: string; pnl: number }>;
  onTradeDotClick?: (tradeIdx: number) => void;
  activeTradeIdx?: number | null;
}

const W = 900;
const H = 220;
const UW_H = 60;
const PAD = { l: 46, r: 8, t: 8, b: 16 };

const EquityChart = ({ equityCurve, benchmark, overlays = [], trades = [], onTradeDotClick, activeTradeIdx }: EquityChartProps) => {
  const model = useMemo(() => {
    if (!equityCurve || equityCurve.length < 2) return null;
    const allSeries = [equityCurve, ...(benchmark?.length ? [benchmark] : []), ...overlays.map((o) => o.points)]
      .filter((s) => s && s.length > 0);
    const t0 = Math.min(...allSeries.map((s) => new Date(s[0].t).getTime()));
    const t1 = Math.max(...allSeries.map((s) => new Date(s[s.length - 1].t).getTime()));
    const vAll = allSeries.flatMap((s) => s.map((p) => p.v));
    const vMin = Math.min(...vAll);
    const vMax = Math.max(...vAll);
    const x = (t: string) => PAD.l + ((new Date(t).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - vMin) / Math.max(vMax - vMin, 1e-9)) * (H - PAD.t - PAD.b);
    const path = (pts: EquityPoint[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const uw = buildUnderwater(equityCurve);
    const uwMax = Math.max(...uw.map((p) => p.ddPct), 1e-9);
    const uwY = (dd: number) => 2 + (dd / uwMax) * (UW_H - 8);
    return { t0, t1, vMin, vMax, x, y, path, uw, uwMax, uwY };
  }, [equityCurve, benchmark, overlays]);

  if (!model) return <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 24, textAlign: 'center' }}>Запустите бэктест — здесь появится кривая доходности</div>;

  const { x, y, path, uw, uwMax, uwY, vMin, vMax } = model;
  const gridVals = [vMin, (vMin + vMax) / 2, vMax];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4, fontFamily: 'monospace' }}>
        <span style={{ color: '#2962ff' }}>━ equity</span>
        {benchmark && <span style={{ color: '#79c0ff' }}>┄ buy&hold</span>}
        {overlays.map((o) => <span key={o.label} style={{ color: o.color }}>━ {o.label}</span>)}
        <span style={{ marginLeft: 'auto' }}>● закрытия сделок</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2962ff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#2962ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={PAD.l} y1={y(v)} x2={W - PAD.r} y2={y(v)} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="2,4" />
            <text x={4} y={y(v) + 3} fontSize="9" fill="var(--text-secondary)" fontFamily="monospace">${Math.round(v)}</text>
          </g>
        ))}
        <polygon
          points={`${equityCurve.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')} ${x(equityCurve[equityCurve.length - 1].t).toFixed(1)},${H - PAD.b} ${x(equityCurve[0].t).toFixed(1)},${H - PAD.b}`}
          fill="url(#eqFill)"
        />
        {benchmark && benchmark.length > 0 && <path d={path(benchmark)} fill="none" stroke="#79c0ff" strokeWidth="1" strokeDasharray="4,4" />}
        {overlays.filter((o) => o.points && o.points.length > 0).map((o) => <path key={o.label} d={path(o.points)} fill="none" stroke={o.color} strokeWidth="1.3" />)}
        <path d={path(equityCurve)} fill="none" stroke="#2962ff" strokeWidth="1.8" />
        {trades.map((t, i) => (
          <circle key={i} cx={x(t.exitTime)} cy={y(equityCurve[Math.min(i + 1, equityCurve.length - 1)].v)}
            r={activeTradeIdx === i ? 4 : 2.4}
            fill={Number(t.pnl) >= 0 ? GREEN : RED}
            stroke={activeTradeIdx === i ? '#fff' : 'none'} strokeWidth="1"
            style={{ cursor: onTradeDotClick ? 'pointer' : 'default' }}
            onClick={() => onTradeDotClick?.(i)} />
        ))}
        <text x={PAD.l} y={H - 4} fontSize="9" fill="var(--text-secondary)" fontFamily="monospace">{equityCurve[0].t.slice(0, 10)}</text>
        <text x={W - PAD.r} y={H - 4} fontSize="9" fill="var(--text-secondary)" fontFamily="monospace" textAnchor="end">{equityCurve[equityCurve.length - 1].t.slice(0, 10)}</text>
      </svg>

      <svg viewBox={`0 0 ${W} ${UW_H}`} style={{ width: '100%', display: 'block', marginTop: 2 }}>
        <polygon
          points={`${PAD.l},2 ${uw.map((p) => `${x(p.t).toFixed(1)},${uwY(p.ddPct).toFixed(1)}`).join(' ')} ${W - PAD.r},2`}
          fill="rgba(248,81,73,0.18)" stroke={RED} strokeWidth="0.7"
        />
        <text x={4} y={UW_H - 6} fontSize="8" fill={RED} fontFamily="monospace">DD −{uwMax.toFixed(1)}%</text>
      </svg>
    </div>
  );
};

export default EquityChart;
