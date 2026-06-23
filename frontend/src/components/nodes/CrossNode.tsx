import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { useLanguageStore } from '../../stores/useLanguageStore';

const CrossNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  const isAbove = data.direction === 'above';
  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#6B5DD3')} />
        <span style={nodeType('#4A3FAD')}>{t('node_cross_node')}</span>
      </div>
      <div style={nodeBody}>
        <>
            <div style={{ ...nodeParam, textAlign: 'center' }}>
              <span style={nodeParamVal}>A</span>
              {' '}
              <span style={{ fontSize: 14, color: isAbove ? '#3B6D11' : '#A32D2D', fontWeight: 700 }}>
                {isAbove ? '↗' : '↘'}
              </span>
              {' '}
              <span style={nodeParamVal}>B</span>
            </div>
            <div style={{ ...nodeParam, textAlign: 'center', marginTop: 2 }}>
              {isAbove ? t('node_crosses_above') : t('node_crosses_below')}
            </div>
          </>
        
      </div>
      <Handle type="target" position={Position.Left} id="a" style={{ ...PORT('#6B5DD3'), top: '35%' }} />
      <Handle type="target" position={Position.Left} id="b" style={{ ...PORT('#6B5DD3'), top: '65%' }} />
      <Handle type="source" position={Position.Right} style={PORT('#6B5DD3')} />
    </div>
  );
};

export default memo(CrossNode);
