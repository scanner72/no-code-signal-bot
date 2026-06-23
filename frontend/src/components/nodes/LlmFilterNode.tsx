import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { nodeWrap, nodeBody, PORT } from './nodeStyles';

export const LlmFilterNode = memo(({ data, selected }: any) => {
  return (
    <div style={{
      ...nodeWrap(selected),
      border: selected ? '2px solid #22d3ee' : '1px solid rgba(34, 211, 238, 0.3)',
      boxShadow: selected ? '0 0 20px rgba(34, 211, 238, 0.3)' : 'none',
      width: '240px'
    }}>
      <div style={{
        padding: '10px 14px',
        background: 'linear-gradient(90deg, #0891b2, #22d3ee)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 8,
        borderTopLeftRadius: '10px', borderTopRightRadius: '10px',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="9"/>
          <line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="15" y2="17"/>
        </svg>
        <span style={{
          fontSize: 11, fontWeight: 800,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: '#fff',
        }}>
          LLM Filter (Free AI)
        </span>
      </div>

      <div style={nodeBody}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Provider: <b style={{color: '#fff'}}>{data.provider || 'qwen'}</b>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
          Model: <b style={{color: '#fff'}}>{data.model || 'qwen-max'}</b>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
          Temp: <b style={{color: '#fff'}}>{data.temperature ?? 0.2}</b>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
          Mock BT: <b style={{color: (data.mockBacktest ?? true) ? '#10b981' : '#f43f5e'}}>{(data.mockBacktest ?? true) ? 'ENABLED' : 'DISABLED'}</b>
        </div>
      </div>

      <Handle type="target" position={Position.Left} style={PORT('#22d3ee')} />
      <Handle type="source" position={Position.Right} style={PORT('#22d3ee')} />
    </div>
  );
});

export default LlmFilterNode;
