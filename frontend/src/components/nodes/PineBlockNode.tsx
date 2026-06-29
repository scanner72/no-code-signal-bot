import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, PORT } from './nodeStyles';
import { ChevronDown, ChevronUp, FileCode, Settings } from 'lucide-react';

interface PineInput {
  paramName: string;
  type: 'int' | 'float' | 'bool' | 'string';
  defaultValue: any;
  title?: string;
  minValue?: number;
  maxValue?: number;
  options?: string[];
  group?: string;
  tooltip?: string;
  step?: number;
}

interface PineAlert {
  title: string;
  type: 'LONG' | 'SHORT';
}

const PineBlockNode = ({ data, selected, id }: NodeProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const scriptName: string = data.scriptName || data.varName || 'Pine Script';
  const pineInputs: PineInput[] = data.pineInputs || [];
  const pineAlerts: PineAlert[] = data.pineAlerts || [];
  const pineCode: string = data.pineCode || '';
  const scriptType: string = data.scriptType || 'indicator';
  const isImported = !!data.scriptName;

  const groups = [...new Set(pineInputs.map(p => p.group || 'General'))];
  const [expandedGroup, setExpandedGroup] = useState<string | null>(groups[0] || null);

  const typeColor = scriptType === 'strategy' ? '#10b981' : '#F59E0B';

  return (
    <div style={{
      ...nodeWrap(selected),
      minWidth: showSettings ? 320 : 220,
      maxWidth: showSettings ? 380 : 260,
    }}>
      <Handle type="target" position={Position.Left} style={PORT(typeColor)} />

      <div style={{
        ...nodeHead,
        background: `linear-gradient(135deg, ${typeColor}18, transparent)`,
        borderBottom: `1px solid ${typeColor}30`,
      }}>
        <span style={nodeDot(typeColor)} />
        <span style={{
          ...nodeType(typeColor),
          fontSize: '11px',
          fontWeight: 700,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {scriptName}
        </span>
        <span style={{
          fontSize: '8px',
          padding: '1px 5px',
          borderRadius: 4,
          background: `${typeColor}20`,
          color: typeColor,
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          {scriptType}
        </span>
      </div>

      <div style={nodeBody}>
        {/* Quick info */}
        {isImported && (
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginBottom: 6 }}>
            {pineInputs.length > 0 && `${pineInputs.length} params`}
            {pineAlerts.length > 0 && ` · ${pineAlerts.length} alerts`}
            {pineCode && ` · ${pineCode.split('\n').length} lines`}
          </div>
        )}

        {/* Settings toggle */}
        {pineInputs.length > 0 && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: `${typeColor}10`, border: `1px solid ${typeColor}30`,
              borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
              color: typeColor, fontSize: '10px', fontWeight: 600, marginBottom: 6,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Settings size={11} /> Settings ({pineInputs.length})
            </span>
            {showSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        {/* Settings panel */}
        {showSettings && (
          <div style={{
            maxHeight: 300, overflowY: 'auto', marginBottom: 6,
            fontSize: '10px',
          }}>
            {groups.map(group => (
              <div key={group} style={{ marginBottom: 4 }}>
                <button
                  onClick={() => setExpandedGroup(expandedGroup === group ? null : group)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: 4,
                    padding: '4px 6px', cursor: 'pointer',
                    color: '#94a3b8', fontSize: '9px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}
                >
                  {group}
                  {expandedGroup === group ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>

                {expandedGroup === group && pineInputs.filter(p => (p.group || 'General') === group).map((input, i) => (
                  <div key={i} style={{
                    padding: '4px 6px', borderLeft: `2px solid ${typeColor}40`,
                    marginLeft: 4, marginTop: 2,
                  }}>
                    <div style={{ color: '#cbd5e1', fontWeight: 600, marginBottom: 2 }}>
                      {input.title || input.paramName}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {input.type === 'bool' ? (
                        <span style={{
                          color: input.defaultValue ? '#10b981' : '#ef4444',
                          fontWeight: 600,
                        }}>
                          {input.defaultValue ? 'ON' : 'OFF'}
                        </span>
                      ) : input.options ? (
                        <span style={{ color: typeColor, fontFamily: 'monospace' }}>
                          {String(input.defaultValue)}
                        </span>
                      ) : (
                        <span style={{ color: typeColor, fontFamily: 'monospace' }}>
                          {String(input.defaultValue)}
                          {input.minValue != null && input.maxValue != null && (
                            <span style={{ color: '#64748b', fontSize: '8px' }}>
                              {' '}[{input.minValue}–{input.maxValue}]
                            </span>
                          )}
                        </span>
                      )}
                      <span style={{
                        fontSize: '8px', color: '#64748b',
                        padding: '0 3px', borderRadius: 2,
                        background: 'rgba(255,255,255,0.05)',
                      }}>
                        {input.type}
                      </span>
                    </div>
                    {input.tooltip && (
                      <div style={{ color: '#475569', fontSize: '8px', marginTop: 1, lineHeight: 1.3 }}>
                        {input.tooltip.substring(0, 80)}{input.tooltip.length > 80 ? '...' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Code toggle */}
        {pineCode && (
          <button
            onClick={() => setShowCode(!showCode)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)',
              borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
              color: '#F59E0B', fontSize: '10px', fontWeight: 600, marginBottom: 4,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileCode size={11} /> Code
            </span>
            {showCode ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        {showCode && pineCode && (
          <div style={{
            fontSize: '9px', fontFamily: 'monospace',
            background: '#0f172a', color: '#cbd5e1',
            padding: 6, borderRadius: 4,
            maxHeight: 200, overflowY: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            border: '1px solid rgba(245, 158, 11, 0.15)',
            lineHeight: 1.4,
          }}>
            {pineCode}
          </div>
        )}

        {/* Alerts */}
        {pineAlerts.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {pineAlerts.map((alert, i) => (
              <div key={i} style={{
                fontSize: '9px', padding: '2px 6px', marginBottom: 2,
                borderRadius: 3,
                background: alert.type === 'LONG' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: alert.type === 'LONG' ? '#10b981' : '#ef4444',
                fontWeight: 600,
              }}>
                {alert.type === 'LONG' ? '▲' : '▼'} {alert.title}
              </div>
            ))}
          </div>
        )}

        {/* Fallback for manual/empty blocks */}
        {!isImported && !pineCode && (
          <div style={{
            fontSize: '10px', color: '#64748b',
            padding: '8px', textAlign: 'center',
            border: '1px dashed rgba(245, 158, 11, 0.3)',
            borderRadius: 6,
          }}>
            Paste Pine Script code in properties panel
          </div>
        )}

        {data.needsManualReplace && (
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: 4 }}>
            ⚠ Partial parse — review settings
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={PORT(typeColor)} />
    </div>
  );
};

export default memo(PineBlockNode);
