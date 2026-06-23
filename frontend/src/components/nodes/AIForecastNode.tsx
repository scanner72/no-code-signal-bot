import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { useLanguageStore } from '../../stores/useLanguageStore';

const AI_COLOR = '#a855f7';
const AI_BADGE = '#7c3aed';

const AIForecastNode = ({ data, selected, id }: NodeProps) => {
  const { t, language } = useLanguageStore();

  const PROPERTY_LABELS: Record<string, string> = {
    direction: 'UP/DOWN',
    predicted_close: language === 'ru' ? 'Прогноз цены' : 'Price Forecast',
    predicted_change: language === 'ru' ? 'Изменение %' : 'Change %',
    confidence: language === 'ru' ? 'Уверенность' : 'Confidence',
  };

  return (
    <div style={{
      ...nodeWrap(selected),
      borderColor: selected ? AI_COLOR : 'var(--border-color)',
      boxShadow: selected
        ? `0 0 20px ${AI_COLOR}40`
        : `0 4px 16px ${AI_COLOR}15, var(--card-shadow)`,
    }}>
      <div style={nodeHead}>
        <span style={{
          ...nodeDot(AI_COLOR),
          boxShadow: `0 0 10px ${AI_COLOR}90`,
          animation: 'pulse 2s infinite',
        }} />
        <span style={nodeType(AI_BADGE)}>🧠 AI Forecast</span>
      </div>
      <div style={nodeBody}>
        <>
            <div style={nodeParam}>
              {t('node_model_label')}: <span style={nodeParamVal}>{data.model || 'auto'}</span>
            </div>
            <div style={nodeParam}>
              {t('node_horizon_label')}: <span style={nodeParamVal}>{data.predLen || 24} {language === 'ru' ? 'свечей' : 'candles'}</span>
            </div>
            <div style={nodeParam}>
              {t('node_output_label')}: <span style={{ ...nodeParamVal, color: AI_COLOR }}>
                {PROPERTY_LABELS[data.property || 'direction'] || data.property}
              </span>
            </div>
            {data.minConfidence && (
              <div style={nodeParam}>
                {language === 'ru' ? 'Мин. ув.' : 'Min conf'}: <span style={nodeParamVal}>{Math.round((data.minConfidence || 0.6) * 100)}%</span>
              </div>
            )}
          </>
        
      </div>
      <Handle type="target" position={Position.Left}  style={PORT(AI_COLOR)} />
      <Handle type="source" position={Position.Right} style={PORT(AI_COLOR)} />
    </div>
  );
};

export default memo(AIForecastNode);
