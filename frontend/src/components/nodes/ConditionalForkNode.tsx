import React from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { ChevronRight } from 'lucide-react';

interface ConditionalForkNodeData {
  condition: string;
  trueLabel?: string;
  falseLabel?: string;
  trueSignal?: 'LONG' | 'SHORT' | null;
  falseSignal?: 'LONG' | 'SHORT' | null;
}

export const ConditionalForkNode: React.FC<NodeProps<ConditionalForkNodeData>> = ({ data }) => {
  const { condition, trueLabel, falseLabel, trueSignal, falseSignal } = data;

  const signalColor = (signal?: 'LONG' | 'SHORT' | null) => {
    if (!signal) return '#64748b';
    return signal === 'LONG' ? '#10b981' : '#ef4444';
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #2a2a3e 0%, #1e1e2e 100%)',
        border: '2px solid #6B5DD3',
        borderRadius: 8,
        padding: 12,
        minWidth: 200,
        cursor: 'default',
        boxShadow: '0 0 12px rgba(107, 93, 211, 0.3)',
      }}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} style={{ background: '#6B5DD3' }} />

      {/* Diamond indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 16,
            height: 16,
            background: '#6B5DD3',
            transform: 'rotate(45deg)',
            borderRadius: 2,
          }}
        />
        <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase' }}>
          If/Else
        </div>
      </div>

      {/* Condition display */}
      <div
        style={{
          fontSize: 12,
          color: '#e0e7ff',
          fontFamily: 'monospace',
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '6px 8px',
          borderRadius: 4,
          marginBottom: 12,
          borderLeft: '3px solid #6B5DD3',
          wordBreak: 'break-word',
        }}
      >
        {condition || 'condition'}
      </div>

      {/* True/False branches */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
        {/* TRUE branch */}
        <div
          style={{
            flex: 1,
            padding: '8px 6px',
            background: signalColor(trueSignal) + '22',
            border: `1px solid ${signalColor(trueSignal)}`,
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 2 }}>TRUE</div>
          <div style={{ fontSize: 11, color: signalColor(trueSignal), fontWeight: 600 }}>
            {trueSignal === 'LONG' ? '📈 LONG' : trueSignal === 'SHORT' ? '📉 SHORT' : '—'}
          </div>
          {trueLabel && <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{trueLabel}</div>}
        </div>

        {/* FALSE branch */}
        {falseSignal !== undefined && falseSignal !== null && (
          <div
            style={{
              flex: 1,
              padding: '8px 6px',
              background: signalColor(falseSignal) + '22',
              border: `1px solid ${signalColor(falseSignal)}`,
              borderRadius: 4,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 2 }}>FALSE</div>
            <div style={{ fontSize: 11, color: signalColor(falseSignal), fontWeight: 600 }}>
              {falseSignal === 'LONG' ? '📈 LONG' : falseSignal === 'SHORT' ? '📉 SHORT' : '—'}
            </div>
            {falseLabel && <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{falseLabel}</div>}
          </div>
        )}
      </div>

      {/* Output handles for branches */}
      <div style={{ position: 'relative', height: 20 }}>
        {/* True branch output */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
          style={{
            left: '25%',
            background: signalColor(trueSignal),
            width: 8,
            height: 8,
          }}
        />

        {/* False branch output */}
        {falseSignal !== undefined && falseSignal !== null && (
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{
              left: '75%',
              background: signalColor(falseSignal),
              width: 8,
              height: 8,
            }}
          />
        )}
      </div>
    </div>
  );
};

ConditionalForkNode.displayName = 'ConditionalForkNode';
