import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { NodeInlineParams } from './NodeInlineParams';

const WebhookNode = ({ data, selected, id }: NodeProps) => {
  const webhookUrl = `${window.location.origin}/api/signals/webhook/${id}`;

  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#8b5cf6')} />
        <span style={nodeType('#6b21a8')}>External Webhook</span>
      </div>
      <div style={nodeBody}>
        <div style={nodeParam}>URL:</div>
        <div style={{...nodeParamVal, fontSize: '9px', wordBreak: 'break-all', userSelect: 'all'}}>
          {webhookUrl}
        </div>
        <div style={{...nodeParam, marginTop: '8px', fontSize: '9px', color: '#8b5cf6'}}>
          POST {"{ \"symbol\": \"BTCUSDT\", \"action\": \"buy\" }"}
        </div>
        
      </div>
      <Handle type="source" position={Position.Right} style={PORT('#8b5cf6')} />
    </div>
  );
};

export default memo(WebhookNode);
