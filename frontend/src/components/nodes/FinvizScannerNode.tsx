import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { useLanguageStore } from '../../stores/useLanguageStore';

const FinvizScannerNode = ({ data, selected }: NodeProps) => {
  const { t } = useLanguageStore();
  const signal = data.signal || 'top_gainers';
  const minVolume = data.minVolume || '1,000,000';
  const minPrice = data.minPrice || 10;

  const getSignalLabel = (sig: string) => {
    const labels: Record<string, string> = {
      top_gainers: t('node_finviz_gainers'),
      top_losers: t('node_finviz_losers'),
      new_high: t('node_finviz_highs'),
      new_low: t('node_finviz_lows'),
      most_volatile: t('node_finviz_volatile'),
      most_active: t('node_finviz_active'),
      overbought: t('node_finviz_overbought'),
      oversold: t('node_finviz_oversold'),
      insider_buying: t('node_finviz_insider_buy'),
      insider_selling: t('node_finviz_insider_sell'),
    };
    return labels[sig] || sig;
  };

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#00ffbb')} />
        <span style={nodeType('#00cc99')}>Finviz Stock Intel</span>
      </div>
      <div style={nodeBody}>
        <div style={nodeParam}>{t('node_finviz_signal')}</div>
        <div style={{ ...nodeParamVal, fontSize: '10px', color: 'var(--text-primary)' }}>
          {getSignalLabel(signal)}
        </div>
        <div style={{ ...nodeParam, marginTop: '4px' }}>{t('node_finviz_min_vol')}</div>
        <div style={nodeParamVal}>{minVolume}</div>
        <div style={{ ...nodeParam, marginTop: '4px' }}>{t('node_finviz_min_price')}</div>
        <div style={nodeParamVal}>${minPrice}</div>
      </div>
      <Handle type="source" position={Position.Right} style={PORT('#00ffbb')} />
    </div>
  );
};

export default memo(FinvizScannerNode);
