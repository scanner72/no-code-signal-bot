import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, PORT } from './nodeStyles';
import { NodeInlineParams } from './NodeInlineParams';

const LABELS: Record<string, string> = {
  fvg:               'Fair Value Gap',
  order_block:       'Order Block',
  market_structure:  'Market Structure',
  liquidity_sweep:   'Liquidity Sweep',
  po3:               'Power of 3',
  daily_bias:        'Daily Bias',
  eqh_eql:           'Equal Highs/Lows',
  premium_discount:  'Premium/Discount',
  ict_killzone:      'ICT Killzone',
};

const SMCNode = ({ data, selected, id }: NodeProps) => (
  <div style={nodeWrap(selected)}>
    <div style={nodeHead}>
      <span style={nodeDot('#EF9F27')} />
      <span style={nodeType('#854F0B')}>Smart Money</span>
    </div>
    <div style={nodeBody}>
      <div style={{ ...nodeParam, fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
        {LABELS[data.type] || data.type || 'FVG'}
        {data.timeframe && data.timeframe !== 'default' && (
          <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(239, 159, 39, 0.2)', color: '#EF9F27', padding: '2px 6px', borderRadius: '4px' }}>
            {data.timeframe}
          </span>
        )}
      </div>
      {data.params?.lookback !== undefined && (
        <div style={nodeParam}>Lookback: <span style={{ fontWeight: 600 }}>{data.params.lookback}</span></div>
      )}
      
    </div>
    <Handle type="source" position={Position.Right} style={PORT('#EF9F27')} />
  </div>
);

export default memo(SMCNode);
