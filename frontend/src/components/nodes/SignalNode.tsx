import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeBody, PORT } from './nodeStyles';
import { NodeInlineParams } from './NodeInlineParams';
import { useLanguageStore } from '../../stores/useLanguageStore';

const SignalNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  const isLong = (data.signalType || 'LONG') === 'LONG';
  const accent = isLong ? '#10B981' : '#EF4444';
  const accentSoft = isLong ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';

  return (
    <div style={nodeWrap(selected)}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: accent, flexShrink: 0,
          boxShadow: `0 0 6px ${accent}60`,
        }} />
        <span style={{
          fontSize: 11, fontWeight: 700,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: accent,
        }}>
          {t('signal')}
        </span>
      </div>
      <div style={nodeBody}>
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            fontSize: 11, fontWeight: 700,
            padding: '4px 10px', borderRadius: 20,
            background: accentSoft,
            color: accent,
            letterSpacing: '0.04em',
          }}>
            {data.signalType || 'LONG'}
          </span>
        
      </div>
      <Handle type="target" position={Position.Left} style={PORT(accent)} />
    </div>
  );
};

export default memo(SignalNode);
