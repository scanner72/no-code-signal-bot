import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { useLanguageStore } from '../../stores/useLanguageStore';

const sourceLabels: Record<string, string> = {
  markPrice: 'Mark Price',
  openInterest: 'Open Interest',
  fundingRate: 'Funding Rate',
  close: 'Candle Close',
  open: 'Candle Open',
  volume: 'Volume',
};

const InputNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  const label = sourceLabels[data.source as string] || t('node_input_node');
  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#378ADD')} />
        <span style={nodeType('#185FA5')}>{label}</span>
      </div>
      <div style={nodeBody}>
        <>
            <div style={nodeParam}>{t('node_pair_label')}: <span style={nodeParamVal}>{data.params?.pair || 'Current'}</span></div>
            {data.params?.operator && data.params.operator !== 'none' && (
              <div style={nodeParam}>
                <span style={{ fontWeight: 600, color: '#185FA5' }}>
                  {data.params.operator} {data.params.threshold}
                </span>
              </div>
            )}
          </>
        
      </div>
      <Handle type="source" position={Position.Right} style={PORT('#378ADD')} />
    </div>
  );
};

export default memo(InputNode);
