import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { useLanguageStore } from '../../stores/useLanguageStore';

const DeribitPcrNode = ({ data, selected }: NodeProps) => {
  const { t, language } = useLanguageStore();
  const timeframe = data.timeframe || (language === 'ru' ? '1d (Краткоср.)' : '1d (Short-term)');

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#3b82f6')} />
        <span style={nodeType('#1e40af')}>Deribit Put-Call Ratio</span>
      </div>
      <div style={nodeBody}>
        <div style={nodeParam}>{t('node_options_tf')}</div>
        <div style={nodeParamVal}>{timeframe}</div>
        <div style={{ ...nodeParam, marginTop: '4px' }}>{t('node_data_type_lbl')}</div>
        <div style={{ ...nodeParamVal, fontSize: '10px' }}>{t('node_oi_volumes')}</div>
      </div>
      <Handle type="source" position={Position.Right} style={PORT('#3b82f6')} />
    </div>
  );
};

export default memo(DeribitPcrNode);
