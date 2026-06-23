import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeInlineParams } from './NodeInlineParams';
import { PORT } from './nodeStyles';

const OrderbookNode = ({ data, selected, id }: any) => {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${selected ? 'var(--accent-color)' : 'var(--border-color)'}`,
      borderRadius: '12px',
      padding: '12px',
      minWidth: '190px',
      color: 'var(--text-primary)',
      boxShadow: selected ? '0 0 16px rgba(99,102,241,0.25)' : 'var(--shadow-sm)',
      transition: 'all 0.2s ease',
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Left} style={PORT('var(--accent-color)')} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ padding: '4px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12H3M3 16h18M3 20h18M3 8h18M3 4h18"/></svg>
        </div>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Orderbook Wall</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Metric: <b>{data.metric || 'imbalance'}</b></div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Levels: <b>{data.levels ?? 20}</b></div>
        </div>
      

      <Handle type="source" position={Position.Right} style={PORT('var(--accent-color)')} />
    </div>
  );
};

export default memo(OrderbookNode);
