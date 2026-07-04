import { CSSProperties, useMemo, useState } from 'react';
import { BtTrade, buildExitReasons } from '../../utils/backtestStats';

const GREEN = '#3fb950';
const RED = '#f85149';
const chip = (active: boolean): CSSProperties => ({
  fontSize: 10, padding: '2px 10px', borderRadius: 6, cursor: 'pointer',
  border: `1px solid ${active ? '#2962ff' : 'var(--border-color)'}`,
  color: active ? '#79c0ff' : 'var(--text-secondary)',
});
const cell: CSSProperties = { padding: '3px 8px', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' };

type Filter = 'all' | 'long' | 'short' | 'tp' | 'sl' | 'partial';
const PAGE = 100;

const fmtDt = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const reasonOf = (t: BtTrade) => buildExitReasons([t])[0]?.reason || 'TP';

const TradesTable = ({ trades, activeIdx, onRowClick }: { trades: BtTrade[]; activeIdx: number | null; onRowClick: (idx: number) => void }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);

  const rows = useMemo(() => trades
    .map((t, idx) => ({ t, idx, reason: reasonOf(t) }))
    .filter(({ t, reason }) => {
      if (filter === 'long') return t.type === 'LONG';
      if (filter === 'short') return t.type === 'SHORT';
      if (filter === 'tp') return reason === 'TP';
      if (filter === 'sl') return reason === 'SL';
      if (filter === 'partial') return reason === 'PARTIAL';
      return true;
    }), [trades, filter]);

  const paged = rows.slice(page * PAGE, (page + 1) * PAGE);
  const pages = Math.ceil(rows.length / PAGE);

  const exportCsv = () => {
    let csv = 'N,entryTime,exitTime,type,entryPrice,exitPrice,pnl,pnlPercent,reason\n';
    rows.forEach(({ t, idx, reason }) => {
      csv += `${idx + 1},${t.entryTime},${t.exitTime},${t.type},${t.entryPrice},${t.exitPrice},${t.pnl},${t.pnlPercent},${reason}\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'backtest-trades.csv';
    a.click();
  };

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>СДЕЛКИ ({rows.length})</span>
        {(['all', 'long', 'short', 'tp', 'sl', 'partial'] as Filter[]).map((f) => (
          <span key={f} style={chip(filter === f)} onClick={() => { setFilter(f); setPage(0); }}>
            {{ all: 'Все', long: 'Long', short: 'Short', tp: 'TP', sl: 'SL', partial: 'Partial' }[f]}
          </span>
        ))}
        <span style={{ ...chip(false), marginLeft: 'auto' }} onClick={exportCsv}>⬇ CSV</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
              {['#', 'Вход', 'Выход', 'Тип', 'Цена входа', 'Цена выхода', 'PnL %', 'PnL $', 'Причина'].map((h) => (
                <th key={h} style={{ ...cell, fontSize: 9, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map(({ t, idx, reason }) => (
              <tr key={idx} onClick={() => onRowClick(idx)} style={{
                cursor: 'pointer', borderTop: '1px solid var(--border-color)',
                background: activeIdx === idx ? 'rgba(41,98,255,0.12)' : 'transparent',
              }}>
                <td style={{ ...cell, color: 'var(--text-secondary)' }}>{idx + 1}</td>
                <td style={{ ...cell, color: 'var(--text-primary)' }}>{fmtDt(t.entryTime)}</td>
                <td style={{ ...cell, color: 'var(--text-primary)' }}>{fmtDt(t.exitTime)}</td>
                <td style={{ ...cell, color: t.type === 'LONG' ? GREEN : RED }}>{t.type}</td>
                <td style={{ ...cell, color: 'var(--text-primary)' }}>{Number(t.entryPrice).toFixed(2)}</td>
                <td style={{ ...cell, color: 'var(--text-primary)' }}>{Number(t.exitPrice).toFixed(2)}</td>
                <td style={{ ...cell, color: Number(t.pnlPercent) >= 0 ? GREEN : RED }}>{Number(t.pnlPercent) >= 0 ? '+' : ''}{Number(t.pnlPercent).toFixed(2)}</td>
                <td style={{ ...cell, color: Number(t.pnl) >= 0 ? GREEN : RED }}>{Number(t.pnl) >= 0 ? '+' : ''}{Number(t.pnl).toFixed(2)}</td>
                <td style={cell}><span style={{
                  fontSize: 9, fontWeight: 800, padding: '1px 7px', borderRadius: 5,
                  background: reason === 'TP' ? 'rgba(63,185,80,0.15)' : reason === 'SL' ? 'rgba(248,81,73,0.15)' : 'rgba(139,148,158,0.15)',
                  color: reason === 'TP' ? GREEN : reason === 'SL' ? RED : 'var(--text-secondary)',
                }}>{reason}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, fontSize: 10, fontFamily: 'monospace' }}>
          {Array.from({ length: pages }, (_, p) => (
            <span key={p} style={chip(page === p)} onClick={() => setPage(p)}>{p + 1}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradesTable;
