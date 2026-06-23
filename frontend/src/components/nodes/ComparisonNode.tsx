import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, PORT } from './nodeStyles';
import { useLanguageStore } from '../../stores/useLanguageStore';

const LABELS: Record<string, string> = {
  '>':           '— > —',
  '<':           '— < —',
  '==':          '— == —',
  cross_above:   'Cross Above',
  cross_below:   'Cross Below',
};

const ComparisonNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#888')} />
        <span style={nodeType('#5F5E5A')}>{t('node_comparison_node')}</span>
      </div>
      <div style={nodeBody}>
        <div style={{ ...nodeParam, fontSize: 13, fontWeight: 500, color: '#555', textAlign: 'center' }}>
            A {LABELS[data.operator] ?? data.operator ?? '>'} {data.value ?? 'B'}
          </div>
        
      </div>
      <Handle type="target" position={Position.Left}  id="a" style={{ ...PORT('#B4B2A9'), top: '35%' }} />
      <Handle type="target" position={Position.Left}  id="b" style={{ ...PORT('#B4B2A9'), top: '65%' }} />
      <Handle type="source" position={Position.Right} style={PORT('#B4B2A9')} />
    </div>
  );
};

export default memo(ComparisonNode);
