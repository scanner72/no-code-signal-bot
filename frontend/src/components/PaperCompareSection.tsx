import { useEffect, useState } from 'react';
import axios from 'axios';

const API = (import.meta as any).env?.VITE_API_URL || '/api';
const COLORS = ['#22d3ee', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#6366f1'];

/** Сравнение конфигов Paper Trading нод: наложенные equity curves + таблица метрик */
const PaperCompareSection = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [compare, setCompare] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API}/paper-trading/accounts`)
      .then((res) => setAccounts(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected.length) { setCompare([]); return; }
    axios.get(`${API}/paper-trading/compare`, { params: { ids: selected.join(',') } })
      .then((res) => setCompare(res.data || []))
      .catch(() => {});
  }, [selected]);

  if (!accounts.length) return null;

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allPoints = compare.flatMap((c) => c.curve.map((p: any) => Number(p.equity)));
  const minY = allPoints.length ? Math.min(...allPoints) : 0;
  const maxY = allPoints.length ? Math.max(...allPoints) : 1;
  const W = 800, H = 220, PAD = 12;

  const toPath = (curve: any[]) => curve.map((p: any, i: number) => {
    const x = PAD + (i / Math.max(curve.length - 1, 1)) * (W - 2 * PAD);
    const y = H - PAD - ((Number(p.equity) - minY) / Math.max(maxY - minY, 1e-9)) * (H - 2 * PAD);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const fmt = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
        🧪 Сравнение конфигов (Paper Trading ноды)
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {accounts.map((a, i) => (
          <label
            key={a.id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
              borderRadius: '8px', cursor: 'pointer', fontSize: '11px',
              border: `1px solid ${selected.includes(a.id) ? COLORS[i % COLORS.length] : 'var(--border-color)'}`,
              color: 'var(--text-primary)', opacity: a.is_active ? 1 : 0.55,
            }}
          >
            <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
            {a.label} (#{a.id}){!a.is_active && ' — удалена'}
            <span style={{ color: 'var(--text-secondary)' }}>
              ×{Number(a.leverage)} / {Number(a.risk_percent)}%
            </span>
          </label>
        ))}
      </div>

      {compare.length > 0 && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            {compare.map((c, i) => (
              <path key={c.account.id} d={toPath(c.curve)} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
            ))}
          </svg>

          <table style={{ width: '100%', marginTop: '12px', fontSize: '11px', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px' }}>Конфиг</th>
                <th style={{ padding: '4px 8px' }}>Капитал</th>
                <th style={{ padding: '4px 8px' }}>Плечо</th>
                <th style={{ padding: '4px 8px' }}>% на сделку</th>
                <th style={{ padding: '4px 8px' }}>PnL %</th>
                <th style={{ padding: '4px 8px' }}>Win rate</th>
                <th style={{ padding: '4px 8px' }}>Max DD</th>
                <th style={{ padding: '4px 8px' }}>Сделок</th>
              </tr>
            </thead>
            <tbody>
              {compare.map((c, i) => (
                <tr key={c.account.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 700 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], marginRight: 6 }} />
                    {c.account.label}
                  </td>
                  <td style={{ padding: '4px 8px' }}>${fmt(c.account.starting_capital)}</td>
                  <td style={{ padding: '4px 8px' }}>×{Number(c.account.leverage)}</td>
                  <td style={{ padding: '4px 8px' }}>{Number(c.account.risk_percent)}%</td>
                  <td style={{ padding: '4px 8px', fontWeight: 700, color: c.stats.totalPnlPercent >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {c.stats.totalPnlPercent >= 0 ? '+' : ''}{c.stats.totalPnlPercent}%
                  </td>
                  <td style={{ padding: '4px 8px' }}>{c.stats.winRate}%</td>
                  <td style={{ padding: '4px 8px' }}>{c.stats.maxDrawdown}%</td>
                  <td style={{ padding: '4px 8px' }}>{c.stats.trades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default PaperCompareSection;
