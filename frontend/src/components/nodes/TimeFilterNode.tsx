import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { NodeInlineParams } from './NodeInlineParams';
import { useLanguageStore } from '../../stores/useLanguageStore';

const TimeFilterNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#7F77DD')} />
        <span style={nodeType('#534AB7')}>{t('time_filter')}</span>
      </div>
      <div style={nodeBody}>
        <div style={nodeParam}>
            <span style={{ ...nodeParamVal, fontFamily: 'monospace' }}>{data.from || '08:00'}</span>
            {' — '}
            <span style={{ ...nodeParamVal, fontFamily: 'monospace' }}>{data.to || '11:00'}</span>
          </div>
        
      </div>
      <Handle type="source" position={Position.Right} style={PORT('#7F77DD')} />
    </div>
  );
};

export default memo(TimeFilterNode);
