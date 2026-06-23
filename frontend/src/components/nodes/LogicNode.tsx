import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, PORT } from './nodeStyles';
import { useLanguageStore } from '../../stores/useLanguageStore';

const LogicNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  const inputsCount = data.inputsCount || 2;
  const handles = [];
  for (let i = 0; i < inputsCount; i++) {
    const top = inputsCount === 1 ? '50%' : `${15 + (i * 70) / (inputsCount - 1)}%`;
    handles.push(
      <Handle
        key={`in-${i}`}
        type="target"
        position={Position.Left}
        id={`in-${i}`}
        style={{ ...PORT('#5DCAA5'), top }}
      />
    );
  }

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#5DCAA5')} />
        <span style={nodeType('#0F6E56')}>{t('logic')}</span>
      </div>
      <div style={nodeBody}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#5DCAA5' }}>
            {data.operator || 'AND'}
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>({inputsCount} {t('node_inputs_abbr')})</span>
          </div>
        
      </div>
      {handles}
      <Handle type="source" position={Position.Right} style={PORT('#5DCAA5')} />
    </div>
  );
};

export default memo(LogicNode);
