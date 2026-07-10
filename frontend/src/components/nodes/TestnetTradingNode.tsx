import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, PORT } from './nodeStyles';
import { useStrategyStore } from '../../stores/strategyStore';
import { useLanguageStore } from '../../stores/useLanguageStore';

const BLUE = '#3b82f6';

const inputStyle = {
  width: '100px',
  padding: '4px 8px',
  fontSize: '10px',
  background: 'var(--bg-accent)',
  color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  textAlign: 'right' as const,
};

const selectStyle = {
  width: '100px',
  padding: '4px 8px',
  fontSize: '10px',
  background: 'var(--bg-accent)',
  color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
};

const TestnetTradingNode = ({ id, data, selected }: NodeProps) => {
  const updateNodeData = useStrategyStore((s) => s.updateNodeData);
  const { language } = useLanguageStore();
  const [expanded, setExpanded] = useState(false);

  const patch = (p: Record<string, any>) => updateNodeData(id, { ...data, ...p });

  const isRu = language === 'ru';

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot(BLUE)} />
        <span style={nodeType(BLUE)}>
          {isRu ? '🔑 Тестнет-Торговля' : '🔑 Testnet Trading'}
        </span>
      </div>
      <div style={nodeBody}>
        <div style={nodeParam}>
          <span>{isRu ? 'Биржа' : 'Exchange'}</span>
          <span style={{ fontWeight: 600 }}>{data.exchangeId?.toUpperCase() || 'BINANCE'}</span>
        </div>
        <div style={nodeParam}>
          <span>{isRu ? 'Капитал' : 'Capital'}</span>
          <span style={{ fontWeight: 600 }}>${data.startingCapital || 1000}</span>
        </div>
        <div style={nodeParam}>
          <span>{isRu ? 'Риск на сделку' : 'Risk per trade'}</span>
          <span style={{ fontWeight: 600 }}>{data.riskPercent || 1}%</span>
        </div>

        <div
          className="nodrag"
          style={{ fontSize: '10px', color: BLUE, cursor: 'pointer', marginTop: 6, fontWeight: 700 }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (isRu ? '▾ Скрыть настройки' : '▾ Hide Settings') : (isRu ? '▸ Настройки' : '▸ Settings')}
        </div>

        {expanded && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={nodeParam}>
              <span>{isRu ? 'Биржа' : 'Exchange'}</span>
              <select
                className="nodrag"
                style={selectStyle}
                value={data.exchangeId || 'binance'}
                onChange={(e) => patch({ exchangeId: e.target.value })}
              >
                <option value="binance">Binance</option>
                <option value="bybit">Bybit</option>
                <option value="okx">OKX</option>
              </select>
            </div>
            <div style={nodeParam}>
              <span>API Key</span>
              <input
                className="nodrag"
                style={inputStyle}
                value={data.apiKey || ''}
                onChange={(e) => patch({ apiKey: e.target.value })}
                placeholder="Testnet API Key"
              />
            </div>
            <div style={nodeParam}>
              <span>Secret</span>
              <input
                className="nodrag"
                style={inputStyle}
                type="password"
                value={data.secret || ''}
                onChange={(e) => patch({ secret: e.target.value })}
                placeholder="Testnet Secret"
              />
            </div>
            <div style={nodeParam}>
              <span>{isRu ? 'Старт. капитал $' : 'Start Capital $'}</span>
              <input
                className="nodrag"
                style={inputStyle}
                type="number"
                value={data.startingCapital ?? 1000}
                onChange={(e) => patch({ startingCapital: Number(e.target.value) })}
              />
            </div>
            <div style={nodeParam}>
              <span>{isRu ? 'Риск %' : 'Risk %'}</span>
              <input
                className="nodrag"
                style={inputStyle}
                type="number"
                min={0.1}
                max={100}
                value={data.riskPercent ?? 1}
                onChange={(e) => patch({ riskPercent: Number(e.target.value) })}
              />
            </div>
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} style={PORT(BLUE)} />
    </div>
  );
};

export default memo(TestnetTradingNode);
