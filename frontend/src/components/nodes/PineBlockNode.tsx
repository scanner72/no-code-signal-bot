import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, PORT } from './nodeStyles';

const PineBlockNode = ({ data, selected }: NodeProps) => (
  <div style={nodeWrap(selected)}>
    <Handle type="target" position={Position.Left} style={PORT('#F59E0B')} />
    <div style={nodeHead}>
      <span style={nodeDot('#F59E0B')} />
      <span style={nodeType('#D97706')}>Pine Block</span>
      {data.funcName && (
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          {data.funcName}
        </span>
      )}
    </div>
    <div style={nodeBody}>
      <div style={{ ...nodeParam, color: '#fff', fontWeight: 600 }}>
        {data.varName || 'expression'}
      </div>
      <div style={{
        fontSize: '10px',
        color: '#F59E0B',
        marginTop: '4px',
        fontFamily: 'monospace',
        background: 'rgba(245, 158, 11, 0.08)',
        padding: '6px',
        borderRadius: '6px',
        border: '1px solid rgba(245, 158, 11, 0.15)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '200px',
      }}>
        {data.pineCode ? data.pineCode.substring(0, 40) + (data.pineCode.length > 40 ? '...' : '') : '// Pine Script'}
      </div>
      {data.needsManualReplace && (
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
          ⚠ Replace with a supported node
        </div>
      )}
    </div>
    <Handle type="source" position={Position.Right} style={PORT('#F59E0B')} />
  </div>
);

export default memo(PineBlockNode);
