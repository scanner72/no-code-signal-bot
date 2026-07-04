import { CSSProperties } from 'react';
import { daysToRecover, EquityPoint } from '../../utils/backtestStats';

const tile: CSSProperties = {
  flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
  borderRadius: '10px', padding: '10px 12px', minWidth: 0,
};
const label: CSSProperties = { color: 'var(--text-secondary)', fontSize: '9px', letterSpacing: '.08em', textTransform: 'uppercase' };
const big: CSSProperties = { fontFamily: 'monospace', fontWeight: 800, fontSize: '20px', lineHeight: 1.3 };
const sub: CSSProperties = { color: 'var(--text-secondary)', fontSize: '10px', fontFamily: 'monospace' };

const fmt = (n: any, d = 2) => {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : (0).toFixed(d);
  return v.toFixed(d);
};

interface Props { result: any; compareResult?: any | null }

/** Пара значений в режиме сравнения; лучшее — зелёной рамкой */
const Pair = ({ a, b, betterWhen }: { a: string; b: string; betterWhen: 'a' | 'b' | 'eq' }) => (
  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
    <span style={{ ...big, fontSize: '15px', padding: '0 3px', borderRadius: 4, border: betterWhen === 'a' ? '1px solid var(--success)' : '1px solid transparent' }}>{a}</span>
    <span style={{ ...big, fontSize: '15px', color: 'var(--text-secondary)', padding: '0 3px', borderRadius: 4, border: betterWhen === 'b' ? '1px solid var(--success)' : '1px solid transparent' }}>{b}</span>
  </div>
);

const KpiStrip = ({ result: r, compareResult: c }: Props) => {
  const rec = daysToRecover((r.equityCurve || []) as EquityPoint[]);
  const retColor = (v: number) => (v >= 0 ? 'var(--success)' : 'var(--danger)');
  const better = (a: number, b: number, higherIsBetter = true): 'a' | 'b' | 'eq' =>
    a === b ? 'eq' : (higherIsBetter ? a > b : a < b) ? 'a' : 'b';

  const tiles: Array<{ key: string; label: string; render: () => JSX.Element; subText: string; accent?: boolean }> = [
    {
      key: 'ret', label: 'Total Return', accent: true,
      render: () => c
        ? <Pair a={`${fmt(r.totalReturn)}%`} b={`${fmt(c.totalReturn)}%`} betterWhen={better(r.totalReturn, c.totalReturn)} />
        : <div style={{ ...big, color: retColor(r.totalReturn) }}>{r.totalReturn >= 0 ? '+' : ''}{fmt(r.totalReturn)}%</div>,
      subText: `$${fmt(r.initialBalance, 0)} → $${fmt(r.finalBalance)}`,
    },
    {
      key: 'wr', label: 'Win Rate',
      render: () => c
        ? <Pair a={`${fmt(r.winRate, 1)}%`} b={`${fmt(c.winRate, 1)}%`} betterWhen={better(r.winRate, c.winRate)} />
        : <div style={big}>{fmt(r.winRate, 1)}%</div>,
      subText: `${Math.round((r.winRate / 100) * r.totalTrades)}W / ${r.totalTrades - Math.round((r.winRate / 100) * r.totalTrades)}L`,
    },
    {
      key: 'dd', label: 'Max Drawdown',
      render: () => c
        ? <Pair a={`${fmt(r.maxDrawdown)}%`} b={`${fmt(c.maxDrawdown)}%`} betterWhen={better(r.maxDrawdown, c.maxDrawdown, false)} />
        : <div style={{ ...big, color: '#f0883e' }}>{fmt(r.maxDrawdown)}%</div>,
      subText: rec === null ? 'не восстановлен' : `${rec} дн. до восстановления`,
    },
    {
      key: 'pf', label: 'Profit Factor',
      render: () => c
        ? <Pair a={fmt(r.profitFactor)} b={fmt(c.profitFactor)} betterWhen={better(r.profitFactor, c.profitFactor)} />
        : <div style={big}>{fmt(r.profitFactor)}</div>,
      subText: `Sharpe ${fmt(r.sharpeRatio)}`,
    },
    {
      key: 'n', label: 'Сделок',
      render: () => c
        ? <Pair a={String(r.totalTrades)} b={String(c.totalTrades)} betterWhen="eq" />
        : <div style={big}>{r.totalTrades}</div>,
      subText: `avg +$${fmt(r.avgWin)} / $${fmt(r.avgLoss)}`,
    },
    {
      key: 'streak', label: 'Серии W/L',
      render: () => c
        ? <Pair a={`${r.maxConsecutiveWins}/${r.maxConsecutiveLosses}`} b={`${c.maxConsecutiveWins}/${c.maxConsecutiveLosses}`} betterWhen="eq" />
        : <div style={big}>{r.maxConsecutiveWins} / {r.maxConsecutiveLosses}</div>,
      subText: `recovery ${fmt(r.recoveryFactor)}`,
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {tiles.map((t) => (
        <div key={t.key} style={{
          ...tile,
          ...(t.accent ? { flex: 1.2, background: 'linear-gradient(135deg, rgba(41,98,255,0.18), var(--bg-secondary))', border: '1px solid #2962ff' } : {}),
        }}>
          <div style={label}>{t.label}</div>
          {t.render()}
          <div style={sub}>{t.subText}</div>
        </div>
      ))}
    </div>
  );
};

export default KpiStrip;
