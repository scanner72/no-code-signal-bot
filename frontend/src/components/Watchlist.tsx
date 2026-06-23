import React, { useState, useEffect } from 'react';
import { Search, Star } from 'lucide-react';
import { candlesApi } from '../api/candles';
import { useDebounce } from '../hooks/useDebounce';

const Watchlist = ({ trackedPairs, selectedPair, onSelect, onAddToWatchlist, onRemoveFromWatchlist, data, stats }: {
  trackedPairs: string[];
  selectedPair: string;
  onSelect: (s: string) => void;
  onAddToWatchlist: (s: string) => void;
  onRemoveFromWatchlist: (s: string) => void;
  data?: any[];
  stats?: any;
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const isSearching = debouncedQuery.trim().length > 0;

  useEffect(() => {
    if (!debouncedQuery.trim()) { setSearchResults([]); return; }
    setLoading(true);
    candlesApi.searchSymbols(debouncedQuery.trim())
      .then(res => setSearchResults(res.data))
      .catch(() => setSearchResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const displayed = isSearching ? searchResults : trackedPairs;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      {/* Search Header */}
      <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ position: 'relative' }}>
          <Search 
            style={{ 
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', 
                color: 'var(--text-muted)' 
            }} 
            size={14} 
          />
          <input
            type="text"
            placeholder="Поиск пары..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', 
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)', 
              borderRadius: '12px',
              padding: '12px 12px 12px 36px', 
              fontSize: '13px',
              outline: 'none',
              fontWeight: 500
            }}
          />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '16px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>
          {isSearching ? 'Binance Search' : 'Избранное'}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayed.map(symbol => {
          const isTracked = trackedPairs.includes(symbol);
          const isActive = selectedPair === symbol;
          const pairData = data?.find(d => d.pair === symbol);
          const isUp = (pairData?.change24h || 0) >= 0;

          return (
            <div
              key={symbol}
              onClick={() => { onSelect(symbol); if(isSearching) setQuery(''); }}
              style={{
                width: '100%', padding: '16px',
                display: 'flex', alignItems: 'center', gap: '12px',
                background: isActive ? 'var(--bg-accent)' : 'transparent',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer', transition: 'var(--transition)',
                position: 'relative'
              }}
            >
              {isActive && (
                <div style={{ 
                  position: 'absolute', left: 0, top: '20%', bottom: '20%', 
                  width: '3px', background: 'var(--accent-color)', borderRadius: '0 4px 4px 0',
                  boxShadow: '0 0 10px var(--accent-color)'
                }} />
              )}
              
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {symbol.replace('USDT', '')}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>USDT</div>
              </div>

              {pairData && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>${pairData.price.toLocaleString()}</div>
                  <div style={{ fontSize: '11px', color: isUp ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {isUp ? '▲' : '▼'} {Math.abs(pairData.change24h).toFixed(2)}%
                  </div>
                </div>
              )}

              <button
                onClick={e => { e.stopPropagation(); isTracked ? onRemoveFromWatchlist(symbol) : onAddToWatchlist(symbol); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <Star size={14} style={{ 
                  color: isTracked ? 'var(--accent-color)' : 'var(--text-muted)', 
                  fill: isTracked ? 'var(--accent-color)' : 'none',
                  transition: 'var(--transition)'
                }} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Distribution Section (As in reference image) */}
      {stats?.pairDistribution && (
        <div style={{ padding: '24px 16px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: '16px' }}>
            Распределение по парам
          </div>
          {stats.pairDistribution.slice(0, 3).map((p: any) => (
            <div key={p.pair} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.pair}</span>
                <span style={{ color: 'var(--text-muted)' }}>{p.count}</span>
              </div>
              <div style={{ height: '4px', background: 'var(--bg-accent)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', background: 'var(--accent-color)', 
                  width: `${(p.count / (stats.week?.total || 1)) * 100}%`,
                  boxShadow: '0 0 8px var(--accent-glow)'
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Watchlist;
