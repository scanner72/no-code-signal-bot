import React, { useState } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { Settings } from 'lucide-react';

interface InputParamNodeData {
  paramName: string;
  type: 'int' | 'float' | 'bool' | 'string';
  defaultValue: any;
  minValue?: number;
  maxValue?: number;
  title?: string;
}

export const InputParamNode: React.FC<NodeProps<InputParamNodeData>> = ({ data, selected }) => {
  const { paramName, type, defaultValue, minValue, maxValue, title } = data;
  const [value, setValue] = useState(defaultValue);

  const typeColors: Record<string, string> = {
    int: '#3b82f6',
    float: '#8b5cf6',
    bool: '#ec4899',
    string: '#14b8a6',
  };

  const typeEmojis: Record<string, string> = {
    int: '🔢',
    float: '📊',
    bool: '✓',
    string: '📝',
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)',
        border: `2px solid ${typeColors[type]}`,
        borderRadius: 8,
        padding: 12,
        minWidth: 200,
        cursor: 'default',
        boxShadow: selected ? `0 0 16px ${typeColors[type]}` : `0 0 8px ${typeColors[type]}44`,
      }}
    >
      {/* Input handle - no incoming edges */}
      <Handle type="source" position={Position.Right} style={{ background: typeColors[type] }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 14 }}>{typeEmojis[type]}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: typeColors[type], textTransform: 'uppercase' }}>
          Parameter
        </div>
      </div>

      {/* Parameter name */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#e0e7ff',
          fontFamily: 'monospace',
          marginBottom: 6,
          wordBreak: 'break-word',
        }}
      >
        {paramName}
      </div>

      {/* Title/Description */}
      {title && (
        <div
          style={{
            fontSize: 10,
            color: '#94a3b8',
            marginBottom: 8,
          }}
        >
          {title}
        </div>
      )}

      {/* Value input */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '6px 8px',
          borderRadius: 4,
          marginBottom: 8,
          borderLeft: `3px solid ${typeColors[type]}`,
        }}
      >
        {type === 'bool' ? (
          <select
            value={value ? 'true' : 'false'}
            onChange={(e) => setValue(e.target.value === 'true')}
            style={{
              width: '100%',
              background: '#0f172a',
              color: '#fbbf24',
              border: '1px solid #64748b',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 11,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            type={type === 'int' ? 'number' : 'text'}
            value={value}
            onChange={(e) => setValue(type === 'int' ? parseInt(e.target.value) : e.target.value)}
            min={minValue}
            max={maxValue}
            step={type === 'float' ? '0.01' : '1'}
            style={{
              width: '100%',
              background: '#0f172a',
              color: '#fbbf24',
              border: '1px solid #64748b',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'monospace',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      {/* Range display */}
      {(minValue !== undefined || maxValue !== undefined) && (
        <div
          style={{
            fontSize: 9,
            color: '#64748b',
            display: 'flex',
            gap: 4,
            justifyContent: 'space-between',
          }}
        >
          <span>
            {minValue !== undefined ? `Min: ${minValue}` : ''}
          </span>
          <span>
            {maxValue !== undefined ? `Max: ${maxValue}` : ''}
          </span>
        </div>
      )}

      {/* Type badge */}
      <div
        style={{
          marginTop: 8,
          display: 'inline-block',
          background: typeColors[type] + '22',
          padding: '2px 6px',
          borderRadius: 3,
          fontSize: 8,
          color: typeColors[type],
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        {type}
      </div>
    </div>
  );
};

InputParamNode.displayName = 'InputParamNode';
