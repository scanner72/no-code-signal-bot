import React, { useState } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { Gauge } from 'lucide-react';

interface PositionSizingNodeData {
  sizingMethod: 'fixed_percent' | 'atr_based' | 'kelly' | 'equal_weight';
  riskPercent?: number;
  atrMultiplier?: number;
  description?: string;
}

export const PositionSizingNode: React.FC<NodeProps<PositionSizingNodeData>> = ({ data }) => {
  const { sizingMethod, riskPercent, atrMultiplier, description } = data;
  const [expanded, setExpanded] = useState(false);

  const methodColors = {
    fixed_percent: '#3b82f6',
    atr_based: '#8b5cf6',
    kelly: '#ec4899',
    equal_weight: '#06b6d4',
  };

  const methodLabels = {
    fixed_percent: '% of Equity',
    atr_based: 'ATR-Based',
    kelly: 'Kelly Criterion',
    equal_weight: 'Equal Weight',
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
        border: `2px solid ${methodColors[sizingMethod]}`,
        borderRadius: 8,
        padding: 12,
        minWidth: 220,
        cursor: 'default',
        boxShadow: `0 0 12px ${methodColors[sizingMethod]}44`,
      }}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} style={{ background: methodColors[sizingMethod] }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Gauge size={16} color={methodColors[sizingMethod]} />
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: methodColors[sizingMethod],
            textTransform: 'uppercase',
          }}
        >
          Position Size
        </div>
      </div>

      {/* Method label */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#e0e7ff',
          marginBottom: 8,
        }}
      >
        {methodLabels[sizingMethod]}
      </div>

      {/* Parameters display */}
      <div
        style={{
          fontSize: 11,
          color: '#cbd5e1',
          background: 'rgba(0, 0, 0, 0.2)',
          padding: '6px 8px',
          borderRadius: 4,
          marginBottom: 8,
          borderLeft: `3px solid ${methodColors[sizingMethod]}`,
        }}
      >
        {sizingMethod === 'fixed_percent' && `Risk: ${riskPercent || 2}% of equity`}
        {sizingMethod === 'atr_based' && `Multiplier: ${atrMultiplier || 2}x ATR`}
        {sizingMethod === 'kelly' && 'Kelly Criterion (dynamic)'}
        {sizingMethod === 'equal_weight' && 'Equal weight per trade'}
      </div>

      {/* Expand button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'transparent',
          border: `1px solid ${methodColors[sizingMethod]}`,
          borderRadius: 4,
          padding: '4px 8px',
          color: methodColors[sizingMethod],
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
          {sizingMethod === 'fixed_percent' && (
            <>
              <div>
                <strong>Fixed Percentage Risk</strong>
              </div>
              <div style={{ marginTop: 4, color: '#94a3b8' }}>
                Risk a fixed percentage of account equity per trade. Most common and simple method.
              </div>
              <div style={{ marginTop: 6, fontSize: 8, color: '#60a5fa' }}>
                Example: $10,000 account × 2% = $200 risk per trade
              </div>
            </>
          )}

          {sizingMethod === 'atr_based' && (
            <>
              <div>
                <strong>ATR-Based Sizing</strong>
              </div>
              <div style={{ marginTop: 4, color: '#94a3b8' }}>
                Position size adjusts based on market volatility (ATR). Smaller positions in volatile markets.
              </div>
              <div style={{ marginTop: 6, fontSize: 8, color: '#a78bfa' }}>
                Size = Risk / (ATR × Multiplier × Pip Value)
              </div>
            </>
          )}

          {sizingMethod === 'kelly' && (
            <>
              <div>
                <strong>Kelly Criterion</strong>
              </div>
              <div style={{ marginTop: 4, color: '#94a3b8' }}>
                Optimal position sizing based on win rate and risk/reward. Requires edge statistics.
              </div>
              <div style={{ marginTop: 6, fontSize: 8, color: '#f472b6' }}>
                F = (bp - q) / b | b=payoff, p=win%, q=loss%
              </div>
            </>
          )}

          {sizingMethod === 'equal_weight' && (
            <>
              <div>
                <strong>Equal Weight</strong>
              </div>
              <div style={{ marginTop: 4, color: '#94a3b8' }}>
                All positions get equal dollar allocation. Simple but ignores volatility.
              </div>
              <div style={{ marginTop: 6, fontSize: 8, color: '#06b6d4' }}>
                Example: Total capital / number of simultaneous positions
              </div>
            </>
          )}

          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid rgba(148, 163, 184, 0.2)',
              color: '#fbbf24',
              fontWeight: 600,
            }}
          >
            💡 Output: Lot size / $ amount to risk
          </div>
        </div>
      )}

      {/* Output handle */}
      <div style={{ position: 'relative', height: 20 }}>
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: methodColors[sizingMethod],
            width: 8,
            height: 8,
          }}
        />
      </div>
    </div>
  );
};

PositionSizingNode.displayName = 'PositionSizingNode';
