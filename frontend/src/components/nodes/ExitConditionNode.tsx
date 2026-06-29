import React, { useState } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { XCircle, TrendingDown } from 'lucide-react';

interface ExitConditionNodeData {
  exitType: 'stop' | 'limit' | 'trail' | 'time';
  exitName?: string;
  value?: number;
  description?: string;
}

export const ExitConditionNode: React.FC<NodeProps<ExitConditionNodeData>> = ({ data }) => {
  const { exitType, exitName, value, description } = data;
  const [expanded, setExpanded] = useState(false);

  const exitColors = {
    stop: '#ef4444',
    limit: '#10b981',
    trail: '#f59e0b',
    time: '#8b5cf6',
  };

  const exitLabels = {
    stop: '🛑 Stop Loss',
    limit: '💰 Take Profit',
    trail: '📈 Trailing Stop',
    time: '⏱️ Time Exit',
  };

  const exitExplanations = {
    stop: 'Exit trade if price drops below stop level. Protects against large losses.',
    limit: 'Exit trade if price reaches profit target. Locks in gains at predetermined level.',
    trail: 'Exit trade if price drops below trailing stop. Protects gains while following uptrend.',
    time: 'Exit trade after specified time period. Risk management for time-decay strategies.',
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #3e2c2c 0%, #2a1a1a 100%)',
        border: `2px solid ${exitColors[exitType]}`,
        borderRadius: 8,
        padding: 12,
        minWidth: 220,
        cursor: 'default',
        boxShadow: `0 0 12px ${exitColors[exitType]}66`,
      }}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} style={{ background: exitColors[exitType] }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {exitType === 'stop' && <XCircle size={16} color={exitColors[exitType]} />}
        {exitType === 'limit' && <div style={{ fontSize: 14 }}>💰</div>}
        {exitType === 'trail' && <TrendingDown size={16} color={exitColors[exitType]} />}
        {exitType === 'time' && <div style={{ fontSize: 14 }}>⏱️</div>}
        <div style={{ fontSize: 11, fontWeight: 600, color: exitColors[exitType], textTransform: 'uppercase' }}>
          {exitLabels[exitType]}
        </div>
      </div>

      {/* Value display */}
      {value !== undefined && (
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: exitColors[exitType],
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          {value} pips
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
          borderLeft: `3px solid ${exitColors[exitType]}`,
          minHeight: 35,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {description || exitLabels[exitType]}
      </div>

      {/* Risk indicator */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          marginBottom: 8,
          fontSize: 9,
        }}
      >
        <div
          style={{
            background: exitColors[exitType] + '22',
            padding: '4px 6px',
            borderRadius: 3,
            color: exitColors[exitType],
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {exitType === 'stop' ? 'Max Loss' : 'Risk/Reward'}
        </div>
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            padding: '4px 6px',
            borderRadius: 3,
            color: '#10b981',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {exitName || 'Default'}
        </div>
      </div>

      {/* Expand button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'transparent',
          border: `1px solid ${exitColors[exitType]}`,
          borderRadius: 4,
          padding: '4px 8px',
          color: exitColors[exitType],
          cursor: 'pointer',
          fontSize: 10,
          width: '100%',
          fontWeight: 600,
          marginBottom: expanded ? 8 : 0,
        }}
      >
        {expanded ? '▼ How it works' : '▶ How it works'}
      </button>

      {/* Explanation */}
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
          <div style={{ marginBottom: 6 }}>{exitExplanations[exitType]}</div>
          {exitType === 'stop' && value && (
            <div style={{ color: '#ef4444', fontSize: 8, marginTop: 4 }}>
              ⚠️ If entry at 100.00, stop triggers at 99.{String(value).padStart(2, '0')}
            </div>
          )}
          {exitType === 'limit' && value && (
            <div style={{ color: '#10b981', fontSize: 8, marginTop: 4 }}>
              ✓ If entry at 100.00, profit target at 100.{String(value).padStart(2, '0')}
            </div>
          )}
          {exitType === 'trail' && value && (
            <div style={{ color: '#f59e0b', fontSize: 8, marginTop: 4 }}>
              📈 If price rises to 110.00, stop moves to 109.{String(value).padStart(2, '0')}
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
            background: exitColors[exitType],
            width: 8,
            height: 8,
          }}
        />
      </div>
    </div>
  );
};

ExitConditionNode.displayName = 'ExitConditionNode';
