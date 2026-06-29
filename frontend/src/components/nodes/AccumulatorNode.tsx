import React, { useState } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { ChevronDown } from 'lucide-react';

interface AccumulatorNodeData {
  varName: string;
  initialValue: number;
  incrementValue: number;
  incrementCondition: string;
  description?: string;
}

export const AccumulatorNode: React.FC<NodeProps<AccumulatorNodeData>> = ({ data }) => {
  const { varName, initialValue, incrementValue, incrementCondition, description } = data;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #2a2a3e 0%, #1e1e2e 100%)',
        border: '2px solid #f59e0b',
        borderRadius: 8,
        padding: 12,
        minWidth: 220,
        cursor: 'default',
        boxShadow: '0 0 12px rgba(245, 158, 11, 0.3)',
      }}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} style={{ background: '#f59e0b' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 16,
            height: 16,
            background: '#f59e0b',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: '#000',
            fontWeight: 'bold',
          }}
        >
          ∑
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#fbbf24', textTransform: 'uppercase' }}>
          Accumulator
        </div>
      </div>

      {/* Variable name */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#fef3c7',
          fontFamily: 'monospace',
          marginBottom: 8,
        }}
      >
        {varName}
      </div>

      {/* Summary */}
      <div
        style={{
          fontSize: 11,
          color: '#fcd34d',
          background: 'rgba(245, 158, 11, 0.1)',
          padding: '6px 8px',
          borderRadius: 4,
          marginBottom: 8,
          borderLeft: '3px solid #f59e0b',
        }}
      >
        Init: <strong>{initialValue}</strong> | +<strong>{incrementValue}</strong>
      </div>

      {/* Expand button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'transparent',
          border: '1px solid #64748b',
          borderRadius: 4,
          padding: '4px 8px',
          color: '#cbd5e1',
          cursor: 'pointer',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          justifyContent: 'space-between',
          marginBottom: expanded ? 8 : 0,
        }}
      >
        <span>Details</span>
        <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }} />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.2)',
            padding: 8,
            borderRadius: 4,
            fontSize: 10,
            color: '#cbd5e1',
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          <div>
            <span style={{ color: '#94a3b8' }}>Condition:</span>
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              color: '#fcd34d',
              marginTop: 4,
              wordBreak: 'break-word',
            }}
          >
            if {incrementCondition}
          </div>
          <div style={{ marginTop: 6, color: '#94a3b8' }}>
            Each time condition is true, add {incrementValue} to {varName}
          </div>
          {description && (
            <div style={{ marginTop: 6, color: '#10b981', fontStyle: 'italic' }}>{description}</div>
          )}
        </div>
      )}

      {/* Output handles */}
      <div style={{ position: 'relative', height: 20 }}>
        {/* Counter value output (left) */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="value"
          style={{
            left: '50%',
            background: '#fbbf24',
            width: 8,
            height: 8,
          }}
        />
      </div>
    </div>
  );
};

AccumulatorNode.displayName = 'AccumulatorNode';
