import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { nodeWrap, nodeBody, PORT } from './nodeStyles';

export const McpToolNode = memo(({ data = {}, selected }: any) => {
  return (
    <div style={{
      ...nodeWrap(selected),
      border: selected ? '2px solid #a855f7' : '1px solid rgba(168, 85, 247, 0.3)',
      boxShadow: selected ? '0 0 20px rgba(168, 85, 247, 0.3)' : 'none',
      width: '240px'
    }}>
      <div style={{
        padding: '10px 14px',
        background: 'linear-gradient(90deg, #8b5cf6, #a855f7)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 8,
        borderTopLeftRadius: '14px', borderTopRightRadius: '14px',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        <span style={{
          fontSize: 11, fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#fff',
        }}>
          MCP Tool Call
        </span>
      </div>

      <div style={nodeBody}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Workflow: <b style={{color: '#fff', fontSize: '11px'}}>{data?.workflowId ? data.workflowId.substring(0, 16) + (data.workflowId.length > 16 ? '...' : '') : 'Not Selected'}</b>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
          Mode: <b style={{color: '#fff'}}>{data?.mode || 'value'}</b>
        </div>
        {data?.mode === 'value' && (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
            Output Key: <b style={{color: '#fff'}}>{data?.outputKey || 'result'}</b>
          </div>
        )}
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
          Backtest: <b style={{color: data?.mockBacktest ?? true ? '#10b981' : '#ef4444'}}>{data?.mockBacktest ?? true ? 'MOCK' : 'LIVE'}</b>
        </div>
      </div>

      <Handle type="target" position={Position.Left} style={PORT('#a855f7')} />
      <Handle type="source" position={Position.Right} style={PORT('#a855f7')} />
    </div>
  );
});

McpToolNode.displayName = 'McpToolNode';
export default McpToolNode;
