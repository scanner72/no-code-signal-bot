import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Newspaper, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { NodeInlineParams } from './NodeInlineParams';
import { PORT } from './nodeStyles';

const SentimentNode = ({ data, selected, id }: any) => {
  const score = data.score || 0;
  const label = score > 0.3 ? 'BULLISH' : score < -0.3 ? 'BEARISH' : 'NEUTRAL';

  const getColor = () => {
    if (label === 'BULLISH') return 'var(--success)';
    if (label === 'BEARISH') return 'var(--danger)';
    return 'var(--text-secondary)';
  };

  const getIcon = () => {
    if (label === 'BULLISH') return <TrendingUp size={14} />;
    if (label === 'BEARISH') return <TrendingDown size={14} />;
    return <Minus size={14} />;
  };

  return (
    <div className={`cyber-node ${selected ? 'selected' : ''}`} style={{
      minWidth: '190px',
      borderRadius: '14px',
      background: 'rgba(15, 23, 42, 0.9)',
      border: `1px solid ${selected ? 'var(--accent-color)' : 'var(--border-color)'}`,
      boxShadow: selected ? '0 0 20px rgba(99, 102, 241, 0.3)' : 'var(--card-shadow)',
      transition: 'all 0.2s ease',
      position: 'relative',
    }}>
      <div className="node-header" style={{ background: 'linear-gradient(90deg, rgba(20, 184, 166, 0.1) 0%, transparent 100%)', borderBottom: '1px solid rgba(20, 184, 166, 0.2)' }}>
        <Newspaper size={16} color="#14b8a6" />
        <span className="node-title">Sentiment Analysis</span>
        <div className="node-status-dot active" />
      </div>

      <div className="node-content" style={{ padding: '12px' }}>
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800 }}>Global Pulse</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: getColor() }}>
                {getIcon()}
                {label}
              </div>
            </div>

            <div style={{ position: 'relative', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', marginBottom: '12px', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)', zIndex: 1 }} />
              <div style={{
                position: 'absolute',
                left: score >= 0 ? '50%' : `${50 + score * 50}%`,
                width: `${Math.abs(score) * 50}%`,
                height: '100%',
                background: getColor(),
                boxShadow: `0 0 10px ${getColor()}40`,
                transition: 'all 0.3s'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
              <span>Source: {data.source || 'Aggregated'}</span>
              <span>Score: {score.toFixed(2)}</span>
            </div>
          </>
        
      </div>

      <Handle type="source" position={Position.Right} style={PORT('#14b8a6')} />
    </div>
  );
};

export default memo(SentimentNode);
