import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { nodeWrap, nodeBody, PORT } from './nodeStyles';
import { NodeInlineParams } from './NodeInlineParams';

export const HermesNode = memo(({ data, selected, id }: any) => {
  return (
    <div style={{
      ...nodeWrap(selected),
      border: selected ? '2px solid #ec4899' : '1px solid rgba(236, 72, 153, 0.3)',
      boxShadow: selected ? '0 0 20px rgba(236, 72, 153, 0.3)' : 'none',
      width: '240px'
    }}>
      <div style={{
        padding: '10px 14px',
        background: 'linear-gradient(90deg, #db2777, #ec4899)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 8,
        borderTopLeftRadius: '10px', borderTopRightRadius: '10px',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a8 8 0 0 0-8 8c0 5.4 5.6 9.6 7.3 10.8a1 1 0 0 0 1.4 0C14.4 19.6 20 15.4 20 10a8 8 0 0 0-8-8z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span style={{
          fontSize: 12, fontWeight: 800,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: '#fff',
        }}>
          Hermes Agent
        </span>
      </div>

      <div style={nodeBody}>
        <>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mode: <b style={{color: '#fff'}}>{data.mode || 'filter'}</b>
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
              Model: <b style={{color: '#fff'}}>{data.model || 'nous-hermes-3'}</b>
            </div>
            {data.mode === 'score' && data.threshold !== undefined && (
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                Min score: <b style={{color: '#ec4899'}}>{Math.round((data.threshold || 0.6) * 100)}%</b>
              </div>
            )}
          </>
        
      </div>

      <Handle type="target" position={Position.Left} style={PORT('#ec4899')} />
      <Handle type="source" position={Position.Right} style={PORT('#ec4899')} />
    </div>
  );
});

export default HermesNode;
