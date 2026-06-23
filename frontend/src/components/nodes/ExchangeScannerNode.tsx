import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { EXCHANGE_META } from './ExchangeDataNode';
import { useLanguageStore } from '../../stores/useLanguageStore';

const SORT_LABELS: Record<string, string> = {
  volume: 'Volume ↓',
  change: 'Change ↓',
  change_up: 'Change ↑',
  change_down: 'Change ↓',
  price:  'Price ↓',
};

const ExchangeScannerNode = ({ data, selected, id }: any) => {
  const { t } = useLanguageStore();
  const exchange  = data.exchange || 'binance';
  const meta      = EXCHANGE_META[exchange] || EXCHANGE_META.binance;
  const hasKeys   = !!(data.apiKey);
  const quote     = data.quoteAsset || 'USDT';
  const limit     = data.limit || 20;
  const sortBy    = data.sortBy || 'volume';

  // Build filter summary tags
  const tags: string[] = [];
  if (data.minVolume24h)      tags.push(`Vol>${formatVol(data.minVolume24h)}`);
  if (data.maxVolume24h)      tags.push(`Vol<${formatVol(data.maxVolume24h)}`);
  if (data.minPrice !== undefined && data.minPrice !== '') tags.push(`P>${data.minPrice}`);
  if (data.maxPrice !== undefined && data.maxPrice !== '') tags.push(`P<${data.maxPrice}`);
  if (data.minChangePercent !== undefined && data.minChangePercent !== '') tags.push(`Chg>${data.minChangePercent}%`);
  if (data.maxChangePercent !== undefined && data.maxChangePercent !== '') tags.push(`Chg<${data.maxChangePercent}%`);

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: selected ? `2px solid ${meta.color}` : `1px solid ${meta.color}40`,
      borderRadius: '12px',
      minWidth: '260px',
      maxWidth: '300px',
      color: 'var(--text-primary)',
      boxShadow: selected
        ? `0 0 24px ${meta.color}30, 0 4px 20px rgba(0,0,0,0.4)`
        : '0 2px 12px rgba(0,0,0,0.25)',
      transition: 'all 0.2s ease',
      overflow: 'visible',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        padding: '9px 12px',
        background: `linear-gradient(135deg, ${meta.color}28, ${meta.color}08)`,
        borderBottom: `1px solid ${meta.color}30`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {/* Scanner icon */}
        <div style={{
          width: 26, height: 26, borderRadius: '7px',
          background: meta.bg, border: `1px solid ${meta.color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: '0.03em' }}>
            {meta.label} Scanner
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Multi-Symbol Filter
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {hasKeys && (
            <div title={t('node_api_keys_configured')} style={{
              fontSize: 8, fontWeight: 700, padding: '2px 5px',
              background: 'rgba(16,185,129,0.2)', color: '#10b981',
              borderRadius: 4, border: '1px solid rgba(16,185,129,0.3)',
            }}>
              AUTH
            </div>
          )}
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: meta.color, boxShadow: `0 0 8px ${meta.color}`,
          }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {/* Quote + Sort */}
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: `${meta.color}18`, color: meta.color,
                border: `1px solid ${meta.color}30`,
              }}>
                {quote}
              </div>
              <div style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 10,
                background: 'var(--bg-accent)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
              }}>
                {SORT_LABELS[sortBy] || sortBy}
              </div>
              <div style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 10,
                background: 'var(--bg-accent)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                marginLeft: 'auto',
              }}>
                Top {limit}
              </div>
            </div>

            {/* Filter tags */}
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {tags.map((tag, i) => (
                  <span key={i} style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-secondary)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontWeight: 600,
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {tags.length === 0 && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {t('node_no_filters_all')}
              </div>
            )}
          </div>
        
      </div>

      {/* Output: list of symbols */}
      <Handle type="source" position={Position.Right} style={{
        background: meta.color,
        border: `2px solid ${meta.color}`,
        width: 10, height: 10,
        boxShadow: `0 0 6px ${meta.color}80`,
      }} />
    </div>
  );
};

function formatVol(v: number): string {
  if (!v) return '0';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(v);
}

export default memo(ExchangeScannerNode);
