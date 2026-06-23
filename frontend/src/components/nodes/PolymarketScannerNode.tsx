import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { useLanguageStore } from '../../stores/useLanguageStore';

const PolymarketScannerNode = ({ data, selected }: NodeProps) => {
  const { t } = useLanguageStore();
  const minAmount = data.minAmountUsd || 10000;
  const market = data.marketSlug || t('all_markets');

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#0046ff')} />
        <span style={nodeType('#0035c0')}>Polymarket Whales</span>
      </div>
      <div style={nodeBody}>
        <div style={nodeParam}>{t('min_volume')}</div>
        <div style={nodeParamVal}>${minAmount.toLocaleString()}</div>
        <div style={{ ...nodeParam, marginTop: '4px' }}>{t('market')}</div>
        <div style={{ ...nodeParamVal, fontSize: '9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {market}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={PORT('#0046ff')} />
    </div>
  );
};

export default memo(PolymarketScannerNode);
