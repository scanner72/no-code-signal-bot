// frontend/src/components/nodes/PaperTradingNode.tsx
import { memo, useEffect, useState, CSSProperties } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import axios from 'axios';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { useStrategyStore } from '../../stores/strategyStore';

const API = (import.meta as any).env?.VITE_API_URL || '/api';
const CYAN = '#22d3ee';

const inputStyle: CSSProperties = {
  width: '70px', padding: '2px 6px', fontSize: '10px',
  background: 'var(--bg-accent)', color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', textAlign: 'right',
};

const PaperTradingNode = ({ id, data, selected }: NodeProps) => {
  const updateNodeData = useStrategyStore((s) => s.updateNodeData);
  const strategyId = useStrategyStore((s) => s.savedStrategyId);
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // updateNodeData заменяет data целиком — обязательно спредим текущее
  const patch = (p: Record<string, any>) => updateNodeData(id, { ...data, ...p });

  useEffect(() => {
    if (!strategyId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await axios.get(`${API}/paper-trading/accounts`, { params: { strategyId } });
        const acc = (res.data || []).find((a: any) => a.node_id === id);
        if (!cancelled && acc?.stats) {
          setStats({ ...acc.stats, accountId: acc.id, balance: acc.current_balance });
        }
      } catch { /* тихо: бэкенд может быть недоступен в превью */ }
    };
    load();
    const t = setInterval(load, 45000);
    return () => { cancelled = true; clearInterval(t); };
  }, [strategyId, id]);

  const handleReset = async () => {
    if (!stats?.accountId) return;
    if (!confirm('Сбросить счёт? Открытые позиции будут закрыты по рынку, баланс вернётся к стартовому капиталу. История сделок сохранится.')) return;
    try {
      await axios.post(`${API}/paper-trading/accounts/${stats.accountId}/reset`);
      setStats(null);
    } catch { /* silent */ }
  };

  const pnl = Number(stats?.totalPnlPercent ?? 0);

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot(CYAN)} />
        <span style={nodeType(CYAN)}>🧪 Paper Trading</span>
        <input
          className="nodrag"
          style={{ ...inputStyle, width: '80px', textAlign: 'left', marginLeft: 'auto' }}
          value={data.label || ''}
          placeholder="Config A"
          onChange={(e) => patch({ label: e.target.value })}
        />
      </div>
      <div style={nodeBody}>
        {stats ? (
          <>
            <div style={nodeParam}>Баланс <span style={nodeParamVal}>${Number(stats.balance).toFixed(2)}</span></div>
            <div style={nodeParam}>PnL <span style={{ ...nodeParamVal, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span></div>
            <div style={nodeParam}>Win rate <span style={nodeParamVal}>{stats.winRate}%</span></div>
            <div style={nodeParam}>Позиции <span style={nodeParamVal}>{stats.openTrades} откр / {stats.closedTrades} закр</span></div>
            {Number(stats.skippedSignals) > 0 && (
              <div style={nodeParam}>Пропущено сигналов <span style={{ ...nodeParamVal, color: '#f59e0b' }}>{stats.skippedSignals}</span></div>
            )}
          </>
        ) : (
          <div style={{ ...nodeParam, fontStyle: 'italic' }}>
            {strategyId ? 'Нет данных — сохраните стратегию' : 'Сохраните стратегию для запуска'}
          </div>
        )}

        <div
          className="nodrag"
          style={{ fontSize: '10px', color: CYAN, cursor: 'pointer', marginTop: 6, fontWeight: 700 }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '▾ Скрыть настройки' : '▸ Настройки'}
        </div>

        {expanded && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={nodeParam}>Капитал $
              <input className="nodrag" style={inputStyle} type="number" value={data.startingCapital ?? 1000}
                onChange={(e) => patch({ startingCapital: Number(e.target.value) })} />
            </div>
            <div style={nodeParam}>Плечо ×
              <input className="nodrag" style={inputStyle} type="number" min={1} value={data.leverage ?? 1}
                onChange={(e) => patch({ leverage: Number(e.target.value) })} />
            </div>
            <div style={nodeParam}>% на сделку
              <input className="nodrag" style={inputStyle} type="number" min={1} max={100} value={data.riskPercent ?? 10}
                onChange={(e) => patch({ riskPercent: Number(e.target.value) })} />
            </div>
            <div style={nodeParam}>SL % (цена)
              <input className="nodrag" style={inputStyle} value={data.sl ?? ''} placeholder="напр. 1%"
                onChange={(e) => patch({ sl: e.target.value })} />
            </div>
            <div style={nodeParam}>TP % (цена)
              <input className="nodrag" style={inputStyle} value={data.tp ?? ''} placeholder="напр. 3%"
                onChange={(e) => patch({ tp: e.target.value })} />
            </div>
            <div style={nodeParam}>Trailing stop
              <input className="nodrag" type="checkbox" checked={!!data.useTrailing}
                onChange={(e) => patch({ useTrailing: e.target.checked })} />
            </div>
            {data.useTrailing && (
              <>
                <div style={nodeParam}>Дистанция %
                  <input className="nodrag" style={inputStyle} value={data.trailingDistance ?? '1%'}
                    onChange={(e) => patch({ trailingDistance: e.target.value })} />
                </div>
                <div style={nodeParam}>Активация %
                  <input className="nodrag" style={inputStyle} value={data.trailingActivation ?? '0.5%'}
                    onChange={(e) => patch({ trailingActivation: e.target.value })} />
                </div>
              </>
            )}
            {stats?.accountId && (
              <button
                className="nodrag"
                style={{
                  marginTop: 4, padding: '4px 8px', fontSize: '10px', fontWeight: 700,
                  background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer',
                }}
                onClick={handleReset}
              >
                Сбросить счёт
              </button>
            )}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} style={PORT(CYAN)} />
    </div>
  );
};

export default memo(PaperTradingNode);
