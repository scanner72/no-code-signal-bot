import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeInlineParams } from './NodeInlineParams';

const TRADE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  market_order: { label: 'Market Order', icon: 'M', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  limit_order:  { label: 'Limit Order',  icon: 'L', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  sltp:         { label: 'SL / TP',      icon: '🛡️', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  risk:         { label: 'Risk Guard',   icon: '⚠️', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  webhook:      { label: 'Webhook',      icon: '🌐', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  telegram:     { label: 'Telegram Alert', icon: '✈️', color: '#0088cc', bg: 'rgba(0,136,204,0.12)' },
};

const TradeActionNode = ({ data, selected, id }: any) => {
  const action = data.action || 'market_order';
  const meta = TRADE_META[action] || TRADE_META.market_order;

  // Derive secondary text for unselected state
  let subText = '';
  if (action === 'market_order' || action === 'limit_order') {
    subText = `${data.side || 'BUY'} ${data.volume || '100%'}`;
    if (action === 'limit_order') subText += ` @ ${data.offset || '-0.5%'}`;
  } else if (action === 'sltp') {
    const parts = [`SL: ${data.sl || '1%'}`];
    const pTPs: any[] = data.partialTPs || [];
    if (pTPs.length > 0) {
      parts.push(`${pTPs.length}x Partial TP`);
      if (data.moveSLtoBE) parts.push('BE');
    } else {
      parts.push(`TP: ${data.tp || '3%'}`);
    }
    if (data.useTrailing) {
      parts.push(`Trail ${data.trailingDistance || '1%'}`);
    }
    subText = parts.join(' · ');
  } else if (action === 'risk') {

    subText = `Max DD: ${data.maxDrawdown || '5%'}`;
  } else if (action === 'webhook') {
    subText = `${data.method || 'POST'}`;
  } else if (action === 'telegram') {
    subText = data.telegramMessage || 'Send alert';
  }

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: selected ? `2px solid ${meta.color}` : `1px solid ${meta.color}40`,
      borderRadius: '14px',
      minWidth: '200px',
      color: 'var(--text-primary)',
      boxShadow: selected
        ? `0 0 24px ${meta.color}30, 0 4px 20px rgba(0,0,0,0.4)`
        : '0 2px 12px rgba(0,0,0,0.25)',
      transition: 'all 0.2s ease',
      overflow: 'visible',
    }}>
      {/* Target handle - input for signal/trigger */}
      <Handle type="target" position={Position.Left} style={{
        background: meta.color,
        border: `2px solid ${meta.color}`,
        width: 10, height: 10,
        boxShadow: `0 0 6px ${meta.color}80`,
      }} />

      {/* Header */}
      <div style={{
        padding: '9px 12px',
        background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}08)`,
        borderBottom: `1px solid ${meta.color}30`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {/* Icon */}
        <div style={{
          width: 24, height: 24, borderRadius: '6px',
          background: meta.bg,
          border: `1px solid ${meta.color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: action === 'webhook' || action === 'sltp' || action === 'risk' ? 12 : 10,
          fontWeight: 900, color: meta.color,
          flexShrink: 0,
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Trading Action
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
            {subText}
          </div>
        
      </div>

      {/* Optional source handle for chaining */}
      <Handle type="source" position={Position.Right} style={{
        background: meta.color,
        border: `2px solid ${meta.color}`,
        width: 10, height: 10,
        boxShadow: `0 0 6px ${meta.color}80`,
      }} />
    </div>
  );
};

export default memo(TradeActionNode);
