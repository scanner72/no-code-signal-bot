import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const DeepResearchNode = memo(({ data, selected }: NodeProps) => {
  const mode = data.mode || 'quick';
  const outputMode = data.outputMode || 'risk_filter';
  const riskThreshold = data.riskThreshold || 'high';
  const cached = data._ldrCached;

  const outputLabels: Record<string, { label: string; color: string }> = {
    risk_filter:     { label: 'Risk Filter',     color: '#f59e0b' },
    sentiment_score: { label: 'Sentiment Score', color: '#10b981' },
    block_critical:  { label: 'Block Critical',  color: '#ef4444' },
  };

  const modeColors: Record<string, string> = {
    quick:    '#6366f1',
    detailed: '#8b5cf6',
  };

  const output = outputLabels[outputMode] || outputLabels.risk_filter;
  const modeColor = modeColors[mode] || '#6366f1';

  return (
    <div style={{
      background: selected
        ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.18))'
        : 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.1))',
      border: `1.5px solid ${selected ? '#6366f1' : 'rgba(99,102,241,0.45)'}`,
      borderRadius: '14px',
      padding: '14px 16px',
      minWidth: '200px',
      maxWidth: '240px',
      backdropFilter: 'blur(10px)',
      boxShadow: selected ? '0 0 20px rgba(99,102,241,0.4)' : '0 4px 16px rgba(0,0,0,0.3)',
      transition: 'all 0.2s ease',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          fontSize: '18px',
          lineHeight: 1,
          filter: 'drop-shadow(0 0 6px rgba(99,102,241,0.8))',
        }}>🔬</div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.03em' }}>
            Deep Research
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(148,163,184,0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Knowledge Layer
          </div>
        </div>

        {cached !== undefined && (
          <div style={{
            marginLeft: 'auto',
            fontSize: '9px',
            padding: '2px 6px',
            borderRadius: '4px',
            background: cached ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
            color: cached ? '#10b981' : '#6366f1',
            border: `1px solid ${cached ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
          }}>
            {cached ? 'CACHED' : 'LIVE'}
          </div>
        )}
      </div>

      {/* Mode badge */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <div style={{
          fontSize: '10px',
          padding: '2px 8px',
          borderRadius: '6px',
          background: `${modeColor}22`,
          border: `1px solid ${modeColor}55`,
          color: modeColor,
          fontWeight: 700,
        }}>
          {mode === 'quick' ? '⚡ Quick' : '🔍 Detailed'}
        </div>
        <div style={{
          fontSize: '10px',
          padding: '2px 8px',
          borderRadius: '6px',
          background: `${output.color}22`,
          border: `1px solid ${output.color}55`,
          color: output.color,
          fontWeight: 700,
        }}>
          {output.label}
        </div>
      </div>

      {/* Query preview */}
      <div style={{
        fontSize: '10px',
        color: 'rgba(148,163,184,0.75)',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        padding: '6px 8px',
        lineHeight: 1.4,
        marginBottom: '6px',
        border: '1px solid rgba(255,255,255,0.04)',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      } as React.CSSProperties}>
        {data.query || 'Analyze macro risks for {{pair}}...'}
      </div>

      {/* Risk threshold indicator */}
      {outputMode === 'risk_filter' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ fontSize: '9px', color: 'rgba(148,163,184,0.6)', fontWeight: 600 }}>BLOCK IF RISK ≥</div>
          <div style={{
            fontSize: '9px',
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: '4px',
            background: riskThreshold === 'critical' ? 'rgba(239,68,68,0.15)' :
                        riskThreshold === 'high' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
            color: riskThreshold === 'critical' ? '#ef4444' :
                   riskThreshold === 'high' ? '#f59e0b' : '#6366f1',
          }}>
            {riskThreshold.toUpperCase()}
          </div>
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#6366f1',
          width: 10,
          height: 10,
          border: '2px solid rgba(99,102,241,0.6)',
          boxShadow: '0 0 8px rgba(99,102,241,0.7)',
        }}
      />
    </div>
  );
});

DeepResearchNode.displayName = 'DeepResearchNode';
export default DeepResearchNode;
