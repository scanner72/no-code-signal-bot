import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Code2 } from 'lucide-react';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, PORT } from './nodeStyles';
import { NodeInlineParams } from './NodeInlineParams';

const CustomCodeNode = ({ data, selected, id }: NodeProps) => (
  <div style={nodeWrap(selected)}>
    <div style={nodeHead}>
      <span style={nodeDot('#6366f1')} />
      <span style={nodeType('#4338ca')}>Custom Code</span>
    </div>
    <div style={nodeBody}>
      <div style={{ ...nodeParam, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 800 }}>
        <Code2 size={14} /> {data.name || 'Script Node'}
      </div>
      <div style={{
          fontSize: '10px', color: 'var(--text-secondary)',
          marginTop: '6px', fontFamily: 'monospace',
          background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {data.code ? data.code.substring(0, 30) + '...' : '// Write logic here'}
        </div>
      
    </div>
    <Handle type="source" position={Position.Right} style={PORT('#6366f1')} />
  </div>
);

export default memo(CustomCodeNode);
