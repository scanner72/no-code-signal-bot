import React, { useState, useEffect } from 'react';
import { systemApi } from '../api/dashboard';
import { Activity } from 'lucide-react';

const MarketPulse = () => {
    const [deltas, setDeltas] = useState<any[]>([]);

    useEffect(() => {
        const fetchDeltas = async () => {
            try {
                const res = await systemApi.getCrossExchangeDeltas();
                setDeltas(res.data || []);
            } catch (e) {
                console.error(e);
            }
        };
        fetchDeltas();
        const interval = setInterval(fetchDeltas, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Activity size={16} color="var(--accent-color)" />
                <h3 style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>Market Pulse (ARB Delta)</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                {deltas.map(d => (
                    <div key={d.pair} style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>{d.pair}</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>${d.binancePrice.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {Object.entries(d.deltas).map(([ex, val]: [string, any]) => (
                                <div key={ex} style={{ 
                                    flex: 1, padding: '6px 4px', textAlign: 'center', borderRadius: '8px', 
                                    background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.03)'
                                }}>
                                    <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '8px', fontWeight: 700, marginBottom: '2px' }}>{ex}</div>
                                    <div style={{ color: val >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 800, fontSize: '10px' }}>
                                        {val >= 0 ? '↑' : '↓'} {Math.abs(val).toFixed(3)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {deltas.length === 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                        Анализ межбиржевых спредов...
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketPulse;
