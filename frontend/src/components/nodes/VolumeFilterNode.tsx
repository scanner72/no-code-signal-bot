import React, { useState } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { BarChart3 } from 'lucide-react';

interface VolumeFilterNodeData {
  filterType: 'crossover' | 'surge' | 'threshold';
  period?: number;
  multiplier?: number;
  description?: string;
}

export const VolumeFilterNode: React.FC<NodeProps<VolumeFilterNodeData>> = ({ data }) => {
  const { filterType, period, multiplier, description } = data;
  const [expanded, setExpanded] = useState(false);

  const filterColors = {
    crossover: '#06b6d4',
    surge: '#f59e0b',
    threshold: '#8b5cf6',
  };

  const filterLabels = {
    crossover: 'Volume Crossover',
    surge: 'Volume Surge',
    threshold: 'Volume Threshold',
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0c3e47 0%, #082835 100%)',
        border: `2px solid ${filterColors[filterType]}`,
        borderRadius: 8,
        padding: 12,
        minWidth: 220,
        cursor: 'default',
        boxShadow: `0 0 12px ${filterColors[filterType]}44`,
      }}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} style={{ background: filterColors[filterType] }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <BarChart3 size={16} color={filterColors[filterType]} />
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: filterColors[filterType],
            textTransform: 'uppercase',
          }}
        >
          {filterLabels[filterType]}
        </div>
      </div>

      {/* Filter type indicator */}
      {filterType === 'surge' && multiplier && period && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#fbbf24',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          ×{multiplier} Surge
        </div>
      )}

      {filterType === 'crossover' && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#06b6d4',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          vol ↗ SMA
        </div>
      )}

      {/* Description */}
      <div
        style={{
          fontSize: 11,
          color: '#cbd5e1',
          background: 'rgba(0, 0, 0, 0.2)',
          padding: '6px 8px',
          borderRadius: 4,
          marginBottom: 8,
          borderLeft: `3px solid ${filterColors[filterType]}`,
          minHeight: 30,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {description || 'Volume analysis filter'}
      </div>

      {/* Expand button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'transparent',
          border: `1px solid ${filterColors[filterType]}`,
          borderRadius: 4,
          padding: '4px 8px',
          color: filterColors[filterType],
          cursor: 'pointer',
          fontSize: 10,
          width: '100%',
          fontWeight: 600,
          marginBottom: expanded ? 8 : 0,
        }}
      >
        {expanded ? '▼ Details' : '▶ Details'}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            padding: 8,
            borderRadius: 4,
            fontSize: 9,
            color: '#cbd5e1',
            lineHeight: 1.6,
            marginBottom: 8,
          }}
        >
          {filterType === 'surge' && (
            <>
              <div>
                <strong>Volume Surge Detection</strong>
              </div>
              <div style={{ marginTop: 4, color: '#94a3b8' }}>
                Current volume exceeds {multiplier}x the {period}-bar moving average
              </div>
              <div style={{ marginTop: 6, color: '#10b981', fontStyle: 'italic' }}>
                💡 Use to confirm breakouts with strong volume
              </div>
            </>
          )}

          {filterType === 'crossover' && (
            <>
              <div>
                <strong>Volume Crossover</strong>
              </div>
              <div style={{ marginTop: 4, color: '#94a3b8' }}>
                Volume crosses above its moving average, indicating increased activity
              </div>
              <div style={{ marginTop: 6, color: '#06b6d4', fontStyle: 'italic' }}>
                💡 Confirms trend changes with volume participation
              </div>
            </>
          )}

          {filterType === 'threshold' && (
            <>
              <div>
                <strong>Volume Threshold</strong>
              </div>
              <div style={{ marginTop: 4, color: '#94a3b8' }}>
                Volume must exceed a specified minimum threshold
              </div>
              <div style={{ marginTop: 6, color: '#8b5cf6', fontStyle: 'italic' }}>
                💡 Filters out low-liquidity signals
              </div>
            </>
          )}
        </div>
      )}

      {/* Output handle */}
      <div style={{ position: 'relative', height: 20 }}>
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: filterColors[filterType],
            width: 8,
            height: 8,
          }}
        />
      </div>
    </div>
  );
};

VolumeFilterNode.displayName = 'VolumeFilterNode';
