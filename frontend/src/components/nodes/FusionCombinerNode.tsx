import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, PORT } from './nodeStyles';
import { useLanguageStore } from '../../stores/useLanguageStore';

const FusionCombinerNode = ({ data, selected }: NodeProps) => {
  const { t } = useLanguageStore();
  const inputsCount = data.inputsCount || 3;
  const weights = data.weights || {};
  const params = data.params || { threshold: 0.5, enableLearning: false };

  const handles = [];
  const weightLabels = [];

  for (let i = 0; i < inputsCount; i++) {
    const top = inputsCount === 1 ? '50%' : `${25 + (i * 50) / (inputsCount - 1)}%`;
    const inputId = `in-${i}`;
    
    // Calculate or read weight percentage
    const weightVal = weights[inputId] !== undefined 
      ? Math.round(weights[inputId] * 100) 
      : Math.round((1 / inputsCount) * 100);

    handles.push(
      <Handle
        key={`in-${i}`}
        type="target"
        position={Position.Left}
        id={inputId}
        style={{ ...PORT('#ec4899'), top }}
      />
    );

    weightLabels.push(
      <div key={`wl-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
        <span>{t('node_inputs_label')} {i + 1}:</span>
        <span style={{ fontWeight: 700, color: '#ec4899' }}>{weightVal}%</span>
      </div>
    );
  }

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#ec4899')} />
        <span style={nodeType('#be185d')}>Fusion Combiner</span>
      </div>
      <div style={nodeBody}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
          {t('node_weighted_fusion')}
        </div>
        
        {weightLabels}

        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', marginTop: '6px', paddingTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
          <div>{t('node_threshold')}: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{params.threshold || 0.5}</span></div>
          <div>{t('node_learning_ema')}: <span style={{ color: params.enableLearning ? '#10b981' : '#6b7280', fontWeight: 600 }}>{params.enableLearning ? t('node_status_active') : t('node_status_off')}</span></div>
        </div>
      </div>
      {handles}
      <Handle type="source" position={Position.Right} style={PORT('#ec4899')} />
    </div>
  );
};

export default memo(FusionCombinerNode);
