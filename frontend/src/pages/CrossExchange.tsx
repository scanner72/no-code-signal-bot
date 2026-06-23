import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Globe, ArrowRightLeft, TrendingUp, TrendingDown, RefreshCw, Layers, ShieldAlert, Zap } from 'lucide-react';
import { useLanguageStore } from '../stores/useLanguageStore';

const CrossExchange = () => {
    const { t } = useLanguageStore();
    const [deltas, setDeltas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    const fetchDeltas = async () => {
        try {
            const res = await axios.get(`${apiBase}/cross-exchange/deltas`);
            setDeltas(res.data);
            setLastUpdate(new Date());
            setLoading(false);
        } catch (e) {
            console.error('Failed to fetch cross-exchange deltas', e);
        }
    };

    useEffect(() => {
        fetchDeltas();
        const interval = setInterval(fetchDeltas, 10000); // 10 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ padding: '32px', color: 'var(--text-primary)', height: '100%', overflowY: 'auto', background: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Globe size={32} color="var(--accent-color)" /> {t('cross_exchange_intel')}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>{t('cross_exchange_desc')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ padding: '8px 16px', background: 'var(--bg-accent)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} color="var(--accent-color)" />
                        <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('last_sync')}</div>
                            <div style={{ fontSize: '12px', fontWeight: 700 }}>{lastUpdate.toLocaleTimeString()}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                {deltas.map(data => (
                    <div key={data.pair} className="bento-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'linear-gradient(135deg, transparent 50%, rgba(99, 102, 241, 0.05) 100%)' }} />
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 800 }}>{data.pair}</h2>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('ref_binance_futures')}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '20px', fontWeight: 900 }}>${data.binancePrice?.toLocaleString()}</div>
                                <div style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 700 }}>{t('live_ticker')}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {Object.entries(data.deltas).map(([ex, delta]: [string, any]) => (
                                <div key={ex} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.03)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                                            {ex.slice(0, 2)}
                                        </div>
                                        <span style={{ fontSize: '14px', fontWeight: 600, textTransform: 'capitalize' }}>{ex}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Delta %</div>
                                            <div style={{ fontSize: '14px', fontWeight: 800, color: delta > 0 ? 'var(--success)' : (delta < 0 ? 'var(--danger)' : 'var(--text-primary)') }}>
                                                {delta > 0 ? '+' : ''}{delta.toFixed(4)}%
                                            </div>
                                        </div>
                                        {Math.abs(delta) > 0.05 ? <ShieldAlert size={16} color="var(--warning)" /> : <Zap size={16} color="var(--success)" opacity={0.5} />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <ArrowRightLeft size={16} color="var(--accent-color)" />
                                <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                                    {Math.abs(Object.values(data.deltas)[0] as number) > 0.1 
                                        ? t('spread_high_warn') 
                                        : t('spread_synced')}
                                </div>
                            </div>
                            {Math.abs(Object.values(data.deltas)[0] as number) > 0.1 && (
                                <button style={{ 
                                    padding: '6px 12px', 
                                    background: 'var(--accent-color)', 
                                    color: '#fff', 
                                    borderRadius: '6px', 
                                    fontSize: '10px', 
                                    fontWeight: 700, 
                                    border: 'none', 
                                    cursor: 'pointer',
                                    boxShadow: '0 0 10px rgba(124, 58, 237, 0.4)'
                                }}>
                                    {t('exploit_spread')}
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {/* Empty State / Loading */}
                {deltas.length === 0 && (
                    <div className="bento-card" style={{ gridColumn: '1 / -1', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', color: 'var(--text-muted)' }}>
                        <Layers size={48} opacity={0.2} />
                        <div>{t('collecting_exchange_data')}</div>
                    </div>
                )}
            </div>

            {/* Stats Section */}
            <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                <div className="bento-card" style={{ padding: '24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{t('average_spread')}</div>
                    <div style={{ fontSize: '24px', fontWeight: 900 }}>0.014%</div>
                    <div style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px' }}>{t('low_volatility')}</div>
                </div>
                <div className="bento-card" style={{ padding: '24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{t('arb_opportunities_24h')}</div>
                    <div style={{ fontSize: '24px', fontWeight: 900 }}>12</div>
                    <div style={{ fontSize: '11px', color: 'var(--accent-color)', marginTop: '4px' }}>{t('total_profit_potential')}</div>
                </div>
                <div className="bento-card" style={{ padding: '24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{t('active_exchanges')}</div>
                    <div style={{ fontSize: '24px', fontWeight: 900 }}>3</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Binance, Bybit, OKX</div>
                </div>
            </div>
        </div>
    );
};

export default CrossExchange;
