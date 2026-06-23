import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Clock } from 'lucide-react';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, PORT } from './nodeStyles';
import { NodeInlineParams } from './NodeInlineParams';
import { useLanguageStore } from '../../stores/useLanguageStore';

const MTFNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#ec4899')} />
        <span style={nodeType('#be185d')}>{t('mtf_analysis')}</span>
      </div>
      
      {/* Input Handle for the signal/condition to check */}
      <Handle type="target" position={Position.Left} style={PORT('#ec4899')} />
      
      <div style={nodeBody}>
        <div style={{ ...nodeParam, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 800 }}>
          <Clock size={14} /> {t('higher_tf')}
        </div>
        <div style={{
            fontSize: '11px', color: 'var(--text-secondary)',
            marginTop: '6px', fontWeight: 600,
            background: 'rgba(236, 72, 153, 0.1)', padding: '6px', borderRadius: '6px',
            border: '1px solid rgba(236, 72, 153, 0.2)',
          }}>
            {t('timeframe_label')} <span style={{ color: '#ec4899', fontWeight: 800 }}>{data.timeframe || '1H'}</span>
            <br />
            {t('mode_label')} <span style={{ color: '#fff', textTransform: 'capitalize' }}>{data.mode || 'trend'}</span>
          </div>
        
      </div>
      
      {/* Output Handle for the approved signal */}
      <Handle type="source" position={Position.Right} style={PORT('#ec4899')} />
    </div>
  );
};

export default memo(MTFNode);
