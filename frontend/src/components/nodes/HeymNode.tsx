import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { nodeWrap, nodeBody, PORT } from './nodeStyles';

export const HeymNode = memo(({ data = {}, selected }: any) => {
  return (
    <div style={{
      ...nodeWrap(selected),
      border: selected ? '2px solid #6366f1' : '1px solid rgba(99, 102, 241, 0.3)',
      boxShadow: selected ? '0 0 20px rgba(99, 102, 241, 0.3)' : 'none',
      width: '240px'
    }}>
      <div style={{
        padding: '10px 14px',
        background: 'linear-gradient(90deg, #4f46e5, #6366f1)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 8,
        borderTopLeftRadius: '10px', borderTopRightRadius: '10px',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <span style={{
          fontSize: 11, fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#fff',
        }}>
          heym Validator
        </span>
      </div>

      <div style={nodeBody}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Mode: <b style={{color: '#fff'}}>{data?.mode || 'filter'}</b>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
          Backtest: <b style={{color: data?.mockBacktest ?? true ? '#10b981' : '#ef4444'}}>{data?.mockBacktest ?? true ? 'MOCK' : 'LIVE'}</b>
        </div>
        {data?.additionalContext && (
          <div style={{ 
            fontSize: '9px', 
            color: 'rgba(255,255,255,0.4)', 
            marginTop: '6px', 
            background: 'rgba(0,0,0,0.2)', 
            padding: '4px 6px', 
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            Ctx: {data.additionalContext}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} style={PORT('#6366f1')} />
      <Handle type="source" position={Position.Right} style={PORT('#6366f1')} />
    </div>
  );
});

HeymNode.displayName = 'HeymNode';
export default HeymNode;
