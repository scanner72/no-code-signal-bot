import React, { useState } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { TrendingUp } from 'lucide-react';

interface LookbackWindowNodeData {
  lookbackBars: number;
  condition: string;
  logic?: 'all' | 'any' | 'majority';
  description?: string;
}

export const LookbackWindowNode: React.FC<NodeProps<LookbackWindowNodeData>> = ({ data }) => {
  const { lookbackBars, condition, logic = 'all', description } = data;
  const [expanded, setExpanded] = useState(false);

  const logicColors = {
    all: '#10b981',
    any: '#f59e0b',
    majority: '#3b82f6',
  };

  const logicLabels = {
    all: 'ALL of last N bars',
    any: 'ANY of last N bars',
    majority: 'MAJORITY (>50%)',
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a3a2a 0%, #0f1f1a 100%)',
        border: `2px solid ${logicColors[logic]}`,
        borderRadius: 8,
        padding: 12,
        minWidth: 240,
        cursor: 'default',
        boxShadow: `0 0 12px ${logicColors[logic]}44`,
      }}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} style={{ background: logicColors[logic] }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <TrendingUp size={16} color={logicColors[logic]} />
        <div style={{ fontSize: 11, fontWeight: 600, color: logicColors[logic], textTransform: 'uppercase' }}>
          Lookback Window
        </div>
      </div>

      {/* Lookback period */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#10b981',
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {lookbackBars} bars
      </div>

      {/* Logic selector */}
      <select
        value={logic}
        style={{
          width: '100%',
          background: '#0f1f1a',
          color: logicColors[logic],
          border: `1px solid ${logicColors[logic]}`,
          borderRadius: 4,
          padding: '6px 8px',
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 8,
          cursor: 'pointer',
        }}
      >
        <option value="all">✓ ALL bars must match</option>
        <option value="any">✓ ANY bar can match</option>
        <option value="majority">✓ MAJORITY must match (50%+)</option>
      </select>

      {/* Condition summary */}
      <div
        style={{
          fontSize: 10,
          color: '#94a3b8',
          background: 'rgba(0, 0, 0, 0.2)',
          padding: '6px 8px',
          borderRadius: 4,
          marginBottom: 8,
          borderLeft: `3px solid ${logicColors[logic]}`,
          minHeight: 30,
          display: 'flex',
          alignItems: 'center',
          wordBreak: 'break-word',
        }}
      >
        <span style={{ color: '#e0e7ff', fontFamily: 'monospace' }}>
          {condition || 'condition'}
        </span>
      </div>

      {/* Logic description */}
      <div
        style={{
          fontSize: 9,
          color: logicColors[logic],
          fontWeight: 600,
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        {logicLabels[logic]}
      </div>

      {/* Expand button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'transparent',
          border: `1px solid ${logicColors[logic]}`,
          borderRadius: 4,
          padding: '4px 8px',
          color: logicColors[logic],
          cursor: 'pointer',
          fontSize: 10,
          width: '100%',
          fontWeight: 600,
          marginBottom: expanded ? 8 : 0,
        }}
      >
        {expanded ? '▼ Hide Details' : '▶ Show Details'}
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
          <div>
            <strong>Example:</strong>
          </div>
          <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 8, color: '#94a3b8' }}>
            {logic === 'all' && `for i in range(${lookbackBars}):\n  assert ${condition}`}
            {logic === 'any' && `for i in range(${lookbackBars}):\n  if ${condition}: break`}
            {logic === 'majority' && `count = sum(1 for i in range(${lookbackBars}) if ${condition})\nassert count > ${Math.ceil(lookbackBars / 2)}`}
          </div>
          {description && (
            <div style={{ marginTop: 6, color: '#10b981', fontStyle: 'italic' }}>
              💡 {description}
            </div>
          )}
        </div>
      )}

      {/* Output handle */}
      <div style={{ position: 'relative', height: 20 }}>
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: logicColors[logic],
            width: 8,
            height: 8,
          }}
        />
      </div>
    </div>
  );
};

LookbackWindowNode.displayName = 'LookbackWindowNode';
