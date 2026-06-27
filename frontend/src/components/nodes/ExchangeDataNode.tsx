import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { useLanguageStore } from '../../stores/useLanguageStore';

export const EXCHANGE_META: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  binance:  { color: '#F0B90B', bg: 'rgba(240,185,11,0.12)', label: 'Binance',  icon: 'B'  },
  bybit:    { color: '#F7A600', bg: 'rgba(247,166,0,0.12)',  label: 'Bybit',    icon: 'BB' },
  okx:      { color: '#00D4FF', bg: 'rgba(0,212,255,0.12)', label: 'OKX',      icon: 'O'  },
  kraken:   { color: '#5741D9', bg: 'rgba(87,65,217,0.12)', label: 'Kraken',   icon: 'K'  },
  coinbase: { color: '#0052FF', bg: 'rgba(0,82,255,0.12)',  label: 'Coinbase', icon: 'CB' },
  htx:      { color: '#2DA6F0', bg: 'rgba(45,166,240,0.12)', label: 'HTX',     icon: 'H'  },
  mexc:     { color: '#00C8A0', bg: 'rgba(0,200,160,0.12)', label: 'MEXC',     icon: 'MX' },
};

export const DATA_TYPE_LABELS: Record<string, string> = {
  price:         'Price',
  volume:        'Volume 24h',
  funding_rate:  'Funding Rate',
  open_interest: 'Open Interest',
  bid_ask_spread:'Bid/Ask Spread',
  price_delta:   'Price Delta %',
  ohlcv:         'OHLCV Candles',
};

const ExchangeDataNode = ({ data, selected, id }: any) => {
  const { t } = useLanguageStore();
  const exchange = data.exchange || 'binance';
  const dataType = data.dataType || 'price';
  const meta     = EXCHANGE_META[exchange] || EXCHANGE_META.binance;
  const hasKeys  = !!(data.apiKey);

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: selected ? `2px solid ${meta.color}` : `1px solid ${meta.color}40`,
      borderRadius: '14px',
      minWidth: '250px',
      color: 'var(--text-primary)',
      boxShadow: selected
        ? `0 0 20px ${meta.color}30, 0 4px 20px rgba(0,0,0,0.4)`
        : '0 2px 12px rgba(0,0,0,0.25)',
      transition: 'all 0.2s ease',
      overflow: 'visible',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        padding: '9px 12px',
        background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}08)`,
        borderBottom: `1px solid ${meta.color}30`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '6px',
          background: meta.bg,
          border: `1px solid ${meta.color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, fontWeight: 900, color: meta.color,
          letterSpacing: '-0.03em', flexShrink: 0,
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: '0.03em' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Exchange Connector
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* API Key indicator */}
          {hasKeys && (
            <div title={t('node_api_keys_configured')} style={{
              fontSize: 8, fontWeight: 700, padding: '2px 5px',
              background: 'rgba(16,185,129,0.2)', color: '#10b981',
              borderRadius: 4, border: '1px solid rgba(16,185,129,0.3)',
              letterSpacing: '0.04em'
            }}>
              AUTH
            </div>
          )}
          {/* Live dot */}
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: meta.color,
            boxShadow: `0 0 8px ${meta.color}`,
          }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Data</span>
              <b style={{ color: meta.color }}>{DATA_TYPE_LABELS[dataType] || dataType}</b>
            </div>
            {data.pair && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Pair</span>
                <b style={{ color: 'var(--text-primary)' }}>{data.pair}</b>
              </div>
            )}
            {data.compareExchange && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>vs</span>
                <b style={{ color: 'rgba(255,255,255,0.6)' }}>{EXCHANGE_META[data.compareExchange]?.label || data.compareExchange}</b>
              </div>
            )}
          </div>
        
      </div>

      <Handle type="source" position={Position.Right} style={{
        background: meta.color,
        border: `2px solid ${meta.color}`,
        width: 10, height: 10,
        boxShadow: `0 0 6px ${meta.color}80`,
      }} />
    </div>
  );
};

export default memo(ExchangeDataNode);
