import { memo, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, PORT } from './nodeStyles';
import { useStrategyStore } from '../../stores/strategyStore';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { connectionsApi, ConnectionDto, NODE_CONNECTION_TYPE } from '../../api/connections';

const COLORS: Record<string, string> = {
  telegram_output: '#229ED9',
  discord_output: '#5865F2',
  webhook_output: '#8b5cf6',
};

const TITLES: Record<string, { ru: string; en: string }> = {
  telegram_output: { ru: '✈️ Telegram', en: '✈️ Telegram' },
  discord_output: { ru: '🎮 Discord', en: '🎮 Discord' },
  webhook_output: { ru: '🔗 Webhook', en: '🔗 Webhook' },
};

const inputStyle = {
  width: '130px',
  padding: '4px 8px',
  fontSize: '10px',
  background: 'var(--bg-accent)',
  color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
};

const DeliveryNode = ({ id, type, data, selected }: NodeProps) => {
  const updateNodeData = useStrategyStore((s) => s.updateNodeData);
  const { language } = useLanguageStore();
  const isRu = language === 'ru';
  const color = COLORS[type!] || '#8b5cf6';

  const [connections, setConnections] = useState<ConnectionDto[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    connectionsApi
      .list(NODE_CONNECTION_TYPE[type!])
      .then((res) => setConnections(res.data))
      .catch(() => setConnections([]))
      .finally(() => setLoaded(true));
  }, [type]);

  const patch = (p: Record<string, any>) => updateNodeData(id, { ...data, ...p });
  const connectionMissing = loaded && data.connectionId && !connections.some((c) => c.id === data.connectionId);

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot(color)} />
        <span style={nodeType(color)}>{isRu ? TITLES[type!].ru : TITLES[type!].en}</span>
      </div>
      <div style={nodeBody}>
        <div style={nodeParam}>
          <span>{isRu ? 'Подключение' : 'Connection'}</span>
          <select
            className="nodrag"
            value={data.connectionId || ''}
            onChange={(e) => patch({ connectionId: e.target.value })}
            style={inputStyle}
          >
            <option value="">{isRu ? '— выбрать —' : '— select —'}</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {connectionMissing && (
          <div style={{ fontSize: 9, color: 'var(--warning)', padding: '2px 0' }}>
            {isRu ? '⚠ требуется подключение (Настройки → Подключения)' : '⚠ connection required (Settings → Connections)'}
          </div>
        )}
        {type === 'telegram_output' && (
          <div style={nodeParam}>
            <span>Chat ID</span>
            <input
              className="nodrag"
              value={data.chatId || ''}
              onChange={(e) => patch({ chatId: e.target.value })}
              placeholder="@channel / -100..."
              style={inputStyle}
            />
          </div>
        )}
        {type === 'webhook_output' && (
          <div style={nodeParam}>
            <span>{isRu ? 'Подпись HMAC' : 'HMAC signing'}</span>
            <input
              className="nodrag"
              type="checkbox"
              checked={!!data.signPayload}
              onChange={(e) => patch({ signPayload: e.target.checked })}
            />
          </div>
        )}
        <div style={{ ...nodeParam, alignItems: 'flex-start' }}>
          <span>{isRu ? 'Шаблон' : 'Template'}</span>
          <textarea
            className="nodrag"
            value={data.template || ''}
            onChange={(e) => patch({ template: e.target.value })}
            placeholder={type === 'webhook_output' ? '{"pair":"{{pair}}"} (пусто = весь сигнал)' : '{{signal}} {{pair}} @ {{price}}'}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 9 }}
          />
        </div>
      </div>
      <Handle type="target" position={Position.Left} style={{ ...PORT, background: color }} />
    </div>
  );
};

export default memo(DeliveryNode);
