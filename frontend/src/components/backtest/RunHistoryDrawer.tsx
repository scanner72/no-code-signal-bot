import { useEffect, useState } from 'react';
import axios from 'axios';

const API = (import.meta as any).env?.VITE_API_URL || '/api';
export const OVERLAY_COLORS = ['#a855f7', '#f59e0b', '#10b981'];

interface RunSummary {
  id: number; created_at: string; options: any;
  summary: { totalReturn: number; totalTrades: number; winRate: number; maxDrawdown: number; finalBalance: number };
}

interface Props {
  open: boolean;
  strategyId: number | null;
  reloadKey: number;            // инкремент → перезагрузка списка
  onClose: () => void;
  overlayRunIds: number[];
  onToggleOverlay: (runId: number, full: { id: number; label: string; result: any } | null) => void;
  onCompare: (full: { id: number; options: any; result: any } | null) => void;
}

const optChips = (o: any) => [
  o?.tp != null ? `TP${(o.tp * 100).toFixed(0)}` : null,
  o?.sl != null ? `SL${(o.sl * 100).toFixed(0)}` : null,
  o?.accurate ? '⚡acc' : null,
].filter(Boolean).join(' · ');

const RunHistoryDrawer = ({ open, strategyId, reloadKey, onClose, overlayRunIds, onToggleOverlay, onCompare }: Props) => {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [compareId, setCompareId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !strategyId) return;
    axios.get(`${API}/backtest/runs`, { params: { strategyId } })
      .then((res) => setRuns(res.data || []))
      .catch(() => setRuns([]));
  }, [open, strategyId, reloadKey]);

  if (!open) return null;

  const toggleOverlay = async (run: RunSummary) => {
    if (overlayRunIds.includes(run.id)) {
      onToggleOverlay(run.id, null);
      return;
    }
    if (overlayRunIds.length >= 3) return;
    const res = await axios.get(`${API}/backtest/runs/${run.id}`);
    const label = `#${run.id} ${optChips(run.options) || new Date(run.created_at).toLocaleDateString()}`;
    onToggleOverlay(run.id, { id: run.id, label, result: res.data.result });
  };

  const toggleCompare = async (run: RunSummary) => {
    if (compareId === run.id) {
      setCompareId(null);
      onCompare(null);
      return;
    }
    const res = await axios.get(`${API}/backtest/runs/${run.id}`);
    setCompareId(run.id);
    onCompare({ id: run.id, options: res.data.options, result: res.data.result });
  };

  const del = async (id: number) => {
    if (!confirm(`Удалить прогон #${id}? Это действие необратимо.`)) return;
    await axios.delete(`${API}/backtest/runs/${id}`);
    setRuns((rs) => rs.filter((r) => r.id !== id));
    if (overlayRunIds.includes(id)) onToggleOverlay(id, null);
    if (compareId === id) { setCompareId(null); onCompare(null); }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 330, zIndex: 60,
      background: 'var(--bg-secondary)', borderLeft: '2px solid #2962ff',
      padding: '14px', overflowY: 'auto', boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>🕘 История прогонов</span>
        <span onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }}>✕</span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 8 }}>
        ☑ — наложить кривую на график (до 3) · ⇄ — сравнить метрики
      </div>
      {runs.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Прогонов пока нет</div>}
      {runs.map((run) => {
        const overlayIdx = overlayRunIds.indexOf(run.id);
        return (
          <div key={run.id} style={{
            border: `1px solid ${overlayIdx >= 0 ? OVERLAY_COLORS[overlayIdx] : compareId === run.id ? '#2962ff' : 'var(--border-color)'}`,
            borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 10,
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={overlayIdx >= 0} onChange={() => toggleOverlay(run)} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'monospace' }}>#{run.id}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{new Date(run.created_at).toLocaleString('ru')}</span>
              <span onClick={() => del(run.id)} style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--danger)' }}>🗑</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, fontFamily: 'monospace' }}>
              <span style={{ color: run.summary.totalReturn >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                {run.summary.totalReturn >= 0 ? '+' : ''}{Number(run.summary.totalReturn).toFixed(2)}%
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{run.summary.totalTrades} сделок · WR {Number(run.summary.winRate).toFixed(1)} · DD {Number(run.summary.maxDrawdown).toFixed(1)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{optChips(run.options)}</span>
              <span onClick={() => toggleCompare(run)} style={{
                marginLeft: 'auto', cursor: 'pointer', fontSize: 9, padding: '1px 8px', borderRadius: 5,
                border: `1px solid ${compareId === run.id ? '#2962ff' : 'var(--border-color)'}`,
                color: compareId === run.id ? '#79c0ff' : 'var(--text-secondary)',
              }}>⇄ {compareId === run.id ? 'сравнивается' : 'сравнить'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RunHistoryDrawer;
