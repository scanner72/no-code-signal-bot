import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const PortfolioRiskSizerNode = memo(({ data, selected }: NodeProps) => {
  const baseSize = data.baseSize ?? 100;
  const riskModel = data.riskModel || 'equal_risk';
  const correlationThreshold = data.correlationThreshold ?? 0.7;
  const volatilityLookback = data.volatilityLookback ?? 14;

  const modelLabels: Record<string, { label: string; color: string }> = {
    equal_risk:   { label: 'Equal Risk',     color: '#f59e0b' },
    atr_adaptive: { label: 'ATR Adaptive',   color: '#10b981' },
  };

  const model = modelLabels[riskModel] || modelLabels.equal_risk;

  return (
    <div style={{
      background: selected
        ? 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(239,68,68,0.18))'
        : 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(239,68,68,0.1))',
      border: `1.5px solid ${selected ? '#f59e0b' : 'rgba(245,158,11,0.45)'}`,
      borderRadius: '14px',
      padding: '14px 16px',
      minWidth: '200px',
      maxWidth: '240px',
      backdropFilter: 'blur(10px)',
      boxShadow: selected ? '0 0 20px rgba(245,158,11,0.4)' : '0 4px 16px rgba(0,0,0,0.3)',
      transition: 'all 0.2s ease',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
    }}>
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#f59e0b',
          width: 8,
          height: 8,
          border: '1.5px solid rgba(245,158,11,0.6)',
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          fontSize: '18px',
          lineHeight: 1,
          filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.8))',
        }}>⚖️</div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.03em' }}>
            Portfolio Risk Sizer
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(148,163,184,0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Risk Management
          </div>
        </div>
      </div>

      {/* Stats Block */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
          <span>Base Size:</span>
          <span style={{ fontWeight: 800, color: '#f59e0b' }}>${baseSize} USD</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
          <span>Risk Model:</span>
          <span style={{ fontWeight: 800, color: model.color }}>{model.label}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
          <span>Corr Threshold:</span>
          <span style={{ fontWeight: 800, color: '#f59e0b' }}>{correlationThreshold}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
          <span>ATR Period:</span>
          <span style={{ fontWeight: 800, color: '#e2e8f0' }}>{volatilityLookback}</span>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#f59e0b',
          width: 10,
          height: 10,
          border: '2px solid rgba(245,158,11,0.6)',
          boxShadow: '0 0 8px rgba(245,158,11,0.7)',
        }}
      />
    </div>
  );
});

PortfolioRiskSizerNode.displayName = 'PortfolioRiskSizerNode';
export default PortfolioRiskSizerNode;
