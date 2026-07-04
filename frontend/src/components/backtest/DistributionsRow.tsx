import { CSSProperties, useMemo } from 'react';
import { BtTrade, buildPnlHistogram, buildExitReasons, buildMonthlyPnl, buildHourDayHeatmap } from '../../utils/backtestStats';

const card: CSSProperties = {
  flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
  borderRadius: '10px', padding: '10px', minWidth: 0,
};
const title: CSSProperties = { color: 'var(--text-secondary)', fontSize: '9px', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 };

const GREEN = '#3fb950';
const RED = '#f85149';
const REASON_COLORS: Record<string, string> = { TP: GREEN, SL: RED, TRAILING: '#f0883e', PARTIAL: '#79c0ff', FORCE: '#a855f7', MANUAL: '#8b949e' };
const DAY_LABELS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const DistributionsRow = ({ trades }: { trades: BtTrade[] }) => {
  const hist = useMemo(() => buildPnlHistogram(trades), [trades]);
  const reasons = useMemo(() => buildExitReasons(trades), [trades]);
  const monthly = useMemo(() => buildMonthlyPnl(trades), [trades]);
  const heat = useMemo(() => buildHourDayHeatmap(trades), [trades]);

  const histMax = Math.max(...hist.map((b) => b.count), 1);
  const reasonMax = Math.max(...reasons.map((x) => x.count), 1);
  const monthMax = Math.max(...monthly.map((m) => Math.abs(m.pnl)), 1);
  const heatMax = Math.max(...heat.flat().map(Math.abs), 1e-9);

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={card}>
        <div style={title}>Распределение PnL, %</div>
        <svg viewBox="0 0 200 70" style={{ width: '100%', display: 'block' }}>
          {hist.map((b, i) => {
            const w = 200 / Math.max(hist.length, 1);
            const h = (b.count / histMax) * 60;
            const mid = (b.from + b.to) / 2;
            return <rect key={i} x={i * w + 1} y={65 - h} width={w - 2} height={h} rx={1}
              fill={mid >= 0 ? GREEN : RED} opacity={0.85} />;
          })}
          <line x1="0" y1="65" x2="200" y2="65" stroke="var(--border-color)" strokeWidth="0.5" />
        </svg>
      </div>

      <div style={card}>
        <div style={title}>Причины выходов</div>
        {reasons.map((x) => (
          <div key={x.reason} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 10, marginBottom: 4 }}>
            <span style={{ width: 58, color: REASON_COLORS[x.reason] }}>{x.reason}</span>
            <div style={{ flex: 1, background: 'var(--bg-primary)', borderRadius: 3, height: 8 }}>
              <div style={{ width: `${(x.count / reasonMax) * 100}%`, height: '100%', background: REASON_COLORS[x.reason], borderRadius: 3 }} />
            </div>
            <span style={{ width: 26, textAlign: 'right', color: 'var(--text-primary)' }}>{x.count}</span>
          </div>
        ))}
        {reasons.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Нет сделок</div>}
      </div>

      <div style={card}>
        <div style={title}>PnL по месяцам, $</div>
        <svg viewBox="0 0 200 70" style={{ width: '100%', display: 'block' }}>
          <line x1="0" y1="35" x2="200" y2="35" stroke="var(--border-color)" strokeWidth="0.5" />
          {monthly.map((m, i) => {
            const w = 200 / Math.max(monthly.length, 1);
            const h = (Math.abs(m.pnl) / monthMax) * 30;
            return (
              <g key={m.month}>
                <rect x={i * w + 2} y={m.pnl >= 0 ? 35 - h : 35} width={w - 4} height={h} rx={1} fill={m.pnl >= 0 ? GREEN : RED} opacity={0.85} />
                <text x={i * w + w / 2} y={68} fontSize="5" fill="var(--text-secondary)" textAnchor="middle" fontFamily="monospace">{m.month.slice(5)}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={card}>
        <div style={title}>PnL: час × день (UTC)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '18px repeat(24, 1fr)', gap: 1 }}>
          {heat.map((row, day) => (
            [<div key={`l${day}`} style={{ fontSize: 7, color: 'var(--text-secondary)', fontFamily: 'monospace', lineHeight: '7px' }}>{DAY_LABELS[day]}</div>,
            ...row.map((v, hour) => (
              <div key={`${day}-${hour}`} title={`${DAY_LABELS[day]} ${hour}:00 → ${v}$`} style={{
                height: 7, borderRadius: 1,
                background: v === 0 ? 'var(--bg-primary)' : v > 0
                  ? `rgba(63,185,80,${0.25 + 0.75 * (v / heatMax)})`
                  : `rgba(248,81,73,${0.25 + 0.75 * (Math.abs(v) / heatMax)})`,
              }} />
            ))]
          ))}
        </div>
        <div style={{ fontSize: 7, color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: 3 }}>00&nbsp;&nbsp;04&nbsp;&nbsp;08&nbsp;&nbsp;12&nbsp;&nbsp;16&nbsp;&nbsp;20&nbsp;&nbsp;23</div>
      </div>
    </div>
  );
};

export default DistributionsRow;
