import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { NodeInlineParams } from './NodeInlineParams';
import { useLanguageStore } from '../../stores/useLanguageStore';

const OF_COLOR = '#0ea5e9';
const OF_BADGE = '#0284c7';

const OrderFlowNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  return (
    <div style={{
      ...nodeWrap(selected),
      borderColor: selected ? OF_COLOR : 'rgba(14, 165, 233, 0.2)',
      boxShadow: selected
        ? `0 0 25px ${OF_COLOR}50, inset 0 0 10px ${OF_COLOR}20`
        : `0 8px 32px rgba(0,0,0,0.4)`,
      background: 'linear-gradient(135deg, var(--bg-primary) 0%, rgba(14, 165, 233, 0.05) 100%)',
    }}>
      <div style={nodeHead}>
        <div style={{ ...nodeDot(OF_COLOR), boxShadow: `0 0 12px ${OF_COLOR}` }} />
        <span style={nodeType(OF_COLOR)}>📊 Order Flow</span>
        <div style={{ marginLeft: 'auto', fontSize: '9px', background: 'rgba(14, 165, 233, 0.2)', color: OF_COLOR, padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>LIVE</div>
      </div>
      <div style={nodeBody}>
        <>
            {data.metric && (
              <div style={nodeParam}>
                {t('metric')} <span style={nodeParamVal}>{data.metric.toUpperCase()}</span>
              </div>
            )}
            {data.period && (
              <div style={nodeParam}>
                {t('period')} <span style={nodeParamVal}>{data.period}</span>
              </div>
            )}
            {data.side && (
              <div style={nodeParam}>
                {t('side')} <span style={{ ...nodeParamVal, color: data.side === 'LONG' || data.side === 'BUY' ? 'var(--success)' : 'var(--danger)' }}>{data.side}</span>
              </div>
            )}
            {data.threshold !== undefined && (
              <div style={nodeParam}>
                {t('threshold')} <span style={{ ...nodeParamVal, color: 'var(--accent-color)' }}>${(data.threshold / 1000000).toFixed(1)}M</span>
              </div>
            )}
          </>
        
      </div>
      <Handle type="target" position={Position.Left}  style={PORT(OF_COLOR)} />
      <Handle type="source" position={Position.Right} style={PORT(OF_COLOR)} />
    </div>
  );
};

export default memo(OrderFlowNode);
