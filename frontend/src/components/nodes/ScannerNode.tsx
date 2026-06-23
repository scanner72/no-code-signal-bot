import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, PORT } from './nodeStyles';
import { NodeInlineParams } from './NodeInlineParams';
import { useLanguageStore } from '../../stores/useLanguageStore';

const ScannerNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  const source = data.source || 'volume';
  const period = data.params?.period || '24h';
  const op = data.params?.operator || '>';
  const val = data.params?.threshold ?? '0';

  let metricLabel: string;
  let suffix: string;
  if (source === 'relative_volume') { metricLabel = 'RelVol'; suffix = 'x'; }
  else if (source === 'change') { metricLabel = 'Change'; suffix = '%'; }
  else { metricLabel = 'Volume'; suffix = ''; }

  const label = op === 'none' ? `${metricLabel} (${period})` : `${metricLabel} (${period}) ${op} ${val}${suffix}`;
  const subtitle = source === 'relative_volume' ? t('vs_top50_avg_vol') : t('binance_data');

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#FFD700')} />
        <span style={nodeType('#8B7500')}>{t('market_scanner')}</span>
      </div>
      <div style={nodeBody}>
        <>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{label}</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{subtitle}</div>
          </>
        
      </div>
      <Handle type="source" position={Position.Right} style={PORT('#FFD700')} />
    </div>
  );
};

export default memo(ScannerNode);
