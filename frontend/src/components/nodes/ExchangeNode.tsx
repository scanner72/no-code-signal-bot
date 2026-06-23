import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { EXCHANGE_META, DATA_TYPE_LABELS } from './ExchangeDataNode';
import { useLanguageStore } from '../../stores/useLanguageStore';

const SORT_LABELS: Record<string, string> = {
  volume: 'Volume ↓',
  change: 'Change ↓',
  change_up: 'Change ↑',
  change_down: 'Change ↓',
  price:  'Price ↓',
};

const ExchangeNode = ({ data, selected, type }: any) => {
  const { t, language } = useLanguageStore();

  const getModeLabel = (m: string) => {
    const labels: Record<string, string> = {
      ticker: language === 'ru' ? 'Тикер (Ticker)' : 'Ticker',
      scanner: language === 'ru' ? 'Сканер (Scanner)' : 'Scanner',
      orderbook: language === 'ru' ? 'Стакан (Order Book)' : 'Order Book',
      orderflow: language === 'ru' ? 'Поток (Order Flow)' : 'Order Flow',
    };
    return labels[m] || m;
  };

  let mode = data.mode;
  if (!mode) {
    if (type === 'exchange_data') mode = 'ticker';
    else if (type === 'exchange_scanner') mode = 'scanner';
    else if (type === 'orderbook') mode = 'orderbook';
    else if (type === 'order_flow') mode = 'orderflow';
    else mode = 'ticker';
  }
  const exchange = data.exchange || 'binance';
  const meta = EXCHANGE_META[exchange] || EXCHANGE_META.binance;
  const hasKeys = !!(data.apiKey);

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: selected ? `2px solid ${meta.color}` : `1px solid ${meta.color}40`,
      borderRadius: '12px',
      minWidth: '260px',
      maxWidth: '320px',
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
        {/* Exchange Icon */}
        <div style={{
          width: 24, height: 24, borderRadius: '7px',
          background: meta.bg, border: `1px solid ${meta.color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: meta.icon.length > 2 ? 8 : 10, fontWeight: 900, color: meta.color,
          flexShrink: 0,
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta.label} Connector
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            {getModeLabel(mode)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {hasKeys && (
            <div title={t('node_api_keys_configured')} style={{
              fontSize: 8, fontWeight: 800, padding: '2px 5px',
              background: 'rgba(16,185,129,0.15)', color: '#10b981',
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
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          
          {/* Mode 1: Ticker */}
          {mode === 'ticker' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('node_parameter')}</span>
                <b style={{ color: meta.color }}>{DATA_TYPE_LABELS[data.dataType] || data.dataType || 'Price'}</b>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('node_instrument')}</span>
                <b style={{ color: 'var(--text-primary)' }}>{data.pair || 'BTCUSDT'}</b>
              </div>
              {data.dataType === 'price_delta' && data.compareExchange && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('node_compare_with')}</span>
                  <b style={{ color: 'var(--text-primary)' }}>{data.compareExchange.toUpperCase()}</b>
                </div>
              )}
            </>
          )}

          {/* Mode 2: Scanner */}
          {mode === 'scanner' && (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <div style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  background: `${meta.color}18`, color: meta.color,
                  border: `1px solid ${meta.color}30`,
                }}>
                  {data.quoteAsset || 'USDT'}
                </div>
                <div style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  background: 'var(--bg-accent)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}>
                  {SORT_LABELS[data.sortBy] || data.sortBy || 'Volume ↓'}
                </div>
                <div style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  background: 'var(--bg-accent)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  marginLeft: 'auto',
                }}>
                  Top {data.limit || 20}
                </div>
              </div>
              {data.symbols && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {t('node_instruments')} <b style={{ color: 'var(--text-primary)' }}>{data.symbols}</b>
                </div>
              )}
            </>
          )}

          {/* Mode 3: Order Book */}
          {mode === 'orderbook' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('node_order_book_metric')}</span>
                <b style={{ color: meta.color, textTransform: 'capitalize' }}>{data.metric || 'imbalance'}</b>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('node_levels_depth')}</span>
                <b style={{ color: 'var(--text-primary)' }}>{data.levels || 20} levels</b>
              </div>
            </>
          )}

          {/* Mode 4: Order Flow */}
          {mode === 'orderflow' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('node_order_flow')}</span>
                <b style={{ color: meta.color, textTransform: 'uppercase' }}>{data.metric || 'delta'}</b>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('node_period_side')}</span>
                <b style={{ color: 'var(--text-primary)' }}>{data.period || '1h'} • {data.side || 'BOTH'}</b>
              </div>
              {data.threshold && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('node_volume_threshold')}</span>
                  <b style={{ color: 'var(--text-primary)' }}>${Number(data.threshold).toLocaleString()}</b>
                </div>
              )}
            </>
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

export default memo(ExchangeNode);
