import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { NodeInlineParams } from './NodeInlineParams';
import { useLanguageStore } from '../../stores/useLanguageStore';

const PumpDumpNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#D97706')} />
        <span style={nodeType('#92400E')}>Pump / Dump</span>
      </div>
      <div style={nodeBody}>
        <>
            <div style={nodeParam}>
              {t('movement')} <span style={nodeParamVal}>{data.priceThreshold ?? 5}%</span>
            </div>
            <div style={nodeParam}>
              {t('volume')} <span style={nodeParamVal}>×{data.volMultiplier ?? 2}</span>
            </div>
            <div style={nodeParam}>
              Lookback: <span style={nodeParamVal}>{data.lookback ?? 3} {t('candles')}</span>
            </div>
          </>
        
      </div>
      <Handle type="source" position={Position.Right} style={PORT('#D97706')} />
    </div>
  );
};

export default memo(PumpDumpNode);
