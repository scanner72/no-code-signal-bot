import React, { useEffect, useState } from 'react';
import { signalsApi } from '../api/signals';
import { strategiesApi, paperTradingApi } from '../api/strategies';
import { useSignalsWs } from '../hooks/useSignalsWs';
import { useLanguageStore } from '../stores/useLanguageStore';

const SignalHistory = () => {
  const { t, language } = useLanguageStore();
  const [signals, setSignals] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [fType, setFType] = useState('all');
  const [fPair, setFPair] = useState('all');
  const [fStrat, setFStrat] = useState('all');
  const [winRates, setWinRates] = useState<Record<number, { winRate: number; totalTrades: number; wins: number; totalPnl: number }>>({});

  useSignalsWs((signal: any) => {
    setSignals(prev => [signal, ...prev].slice(0, 100));
  });

  useEffect(() => {
    strategiesApi.getAll().then(res => setStrategies(res.data)).catch(() => {});
    signalsApi.getHistory(100).then(res => setSignals(res.data)).catch(() => {});
    paperTradingApi.getWinRates().then(res => setWinRates(res.data || {})).catch(() => {});
  }, []);

  const filteredSignals = signals.filter(s => 
      (fType === 'all' || s.type === fType.toUpperCase()) &&
      (fPair === 'all' || s.pair.startsWith(fPair)) &&
      (fStrat === 'all' || (s.strategy?.name || 'SMC Engine') === fStrat)
  );

  const totalSignals = signals.length;
  const longCount = signals.filter(s => s.type === 'LONG').length;
  const shortCount = signals.filter(s => s.type === 'SHORT').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      
      {/* Filters */}
      <div className="feed-filters" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', background: 'var(--bg-accent)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-color)' }}>
            <button onClick={() => setFType('all')} style={filterTabStyle(fType === 'all')}>{t('signals_all')}</button>
            <button onClick={() => setFType('long')} style={filterTabStyle(fType === 'long')}>LONG</button>
            <button onClick={() => setFType('short')} style={filterTabStyle(fType === 'short')}>SHORT</button>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }}></div>
        
        <select value={fPair} onChange={(e) => setFPair(e.target.value)} style={selectStyle}>
          <option value="all">{t('signals_all_pairs')}</option>
          <option value="BTC">BTC/USDT</option>
          <option value="ETH">ETH/USDT</option>
          <option value="SOL">SOL/USDT</option>
        </select>
        <select value={fStrat} onChange={(e) => setFStrat(e.target.value)} style={selectStyle}>
          <option value="all">{t('signals_all_strategies')}</option>
          {strategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, minHeight: 0 }}>
        
        {/* Feed */}
        <div className="feed" style={{ borderRight: '1px solid var(--border-color)', paddingBottom: '40px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
          {filteredSignals.length === 0 ? (
            <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
                <div style={{ fontSize: '40px', opacity: 0.1, marginBottom: '16px' }}>⎙</div>
                {t('no_active_signals')}
            </div>
          ) : (
            filteredSignals.map(signal => (
              <div key={signal.id} className="feed-item" style={{
                display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: '20px', padding: '20px 24px', borderBottom: '1px solid var(--border-color)', alignItems: 'center', background: 'var(--bg-secondary)', transition: 'var(--transition)', marginBottom: '1px', position: 'relative'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
              >
                <div style={{
                  background: signal.type === 'LONG' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: signal.type === 'LONG' ? 'var(--success)' : 'var(--danger)',
                  width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800,
                  boxShadow: signal.type === 'LONG' ? '0 0 15px rgba(16, 185, 129, 0.1)' : '0 0 15px rgba(239, 68, 68, 0.1)'
                }}>
                  {signal.type === 'LONG' ? '↑' : '↓'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{signal.strategy?.name || 'SMC Engine'}</span>
                    <span style={{ fontSize: '13px', color: 'var(--accent-color)', fontWeight: 700, letterSpacing: '0.05em' }}>{signal.pair}</span>
                    <span style={{ fontSize: '11px', padding: '2px 10px', background: 'var(--bg-primary)', borderRadius: '8px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontWeight: 700 }}>{signal.timeframe}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      RSI: <b style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{signal.metadata?.indicators?.rsi || '—'}</b>
                    </span>
                    {signal.metadata?.indicators?.hermes && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#ec4899', fontWeight: 800 }}>{t('ai_agent')}</span>: 
                          <b style={{ 
                            color: signal.metadata.indicators.hermes.decision === 'PASS' ? 'var(--success)' : 'var(--danger)', 
                            background: signal.metadata.indicators.hermes.decision === 'PASS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px'
                          }}>
                            {signal.metadata.indicators.hermes.decision} ({Math.round(signal.metadata.indicators.hermes.confidence * 100)}%)
                          </b>
                        </span>
                        {signal.metadata.indicators.hermes.reason && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                            "{signal.metadata.indicators.hermes.reason}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>${signal.price.toLocaleString()}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>{new Date(signal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginTop: '8px', color: 'var(--success)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }}></div>
                    {t('sent_to_telegram')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Stats */}
        <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '32px', background: 'var(--bg-secondary)', overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '20px', fontWeight: 800 }}>{t('activity_today')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <StatRow label={t('total')} value={totalSignals} />
                <StatRow label="LONG" value={longCount} color="var(--success)" />
                <StatRow label="SHORT" value={shortCount} color="var(--danger)" />
            </div>
          </div>

          <div style={{ width: '100%', height: '1px', background: 'var(--border-color)', opacity: 0.5 }}></div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '20px', fontWeight: 800 }}>{t('strategies_efficiency')}</div>
            {(strategies || []).slice(0, 5).map(s => {
                const wr = winRates[s.id];
                const winRateVal = wr?.winRate ?? 0;
                const totalTrades = wr?.totalTrades ?? 0;
                return (
                <div key={s.id} style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700 }}>{s.name}</span>
                        <span style={{ color: winRateVal >= 50 ? 'var(--success)' : (totalTrades > 0 ? 'var(--danger)' : 'var(--text-secondary)'), fontWeight: 800 }}>
                          {totalTrades > 0 ? `${winRateVal}%` : '—'}
                        </span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-accent)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${totalTrades > 0 ? winRateVal : 0}%`, background: winRateVal >= 50 ? 'linear-gradient(90deg, var(--accent-color), #818cf8)' : 'linear-gradient(90deg, var(--danger), #f87171)', boxShadow: `0 0 10px ${winRateVal >= 50 ? 'rgba(99, 102, 241, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`, transition: 'width 0.6s ease' }}></div>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {totalTrades > 0 ? `${wr!.wins}/${totalTrades} ${language === 'ru' ? 'сделок' : 'trades'} · PnL ${wr!.totalPnl > 0 ? '+' : ''}${wr!.totalPnl}%` : t('no_closed_trades')}
                    </div>
                </div>
                );
            })}
          </div>

          <div style={{ width: '100%', height: '1px', background: 'var(--border-color)', opacity: 0.5 }}></div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '20px', fontWeight: 800 }}>{t('on_air')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {strategies.filter(s => s.is_active).map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-accent)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block', marginRight: '12px', boxShadow: '0 0 10px var(--success)' }}></span>
                            {s.name}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{s.pair}</span>
                    </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatRow = ({ label, value, color = 'var(--text-primary)' }: { label: string; value: any, color?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '16px', fontWeight: 800, color }}>{value}</span>
    </div>
);

const filterTabStyle = (active: boolean) => ({
    padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
    background: active ? 'var(--bg-secondary)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    border: 'none', cursor: 'pointer', transition: 'var(--transition)',
    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
});

const selectStyle = {
    padding: '8px 16px', borderRadius: '10px',
    background: 'var(--bg-accent)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', fontSize: '13px',
    cursor: 'pointer', outline: 'none', fontWeight: 600
};

export default SignalHistory;
