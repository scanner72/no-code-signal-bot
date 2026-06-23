import React, { useEffect, useState } from 'react';
import { fleetApi } from '../api/fleet';
import { strategiesApi } from '../api/strategies';
import { useLanguageStore } from '../stores/useLanguageStore';


const Fleet = () => {
    const { t, language } = useLanguageStore();
    const [instances, setInstances] = useState<any[]>([]);
    const [strategies, setStrategies] = useState<any[]>([]);
    const [riskData, setRiskData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newBot, setNewBot] = useState({ name: '', strategyId: '', pair: 'BTCUSDT', timeframe: '1h', balance: 1000 });

    const fetchAll = async () => {
        try {
            const [instRes, stratRes, riskRes] = await Promise.all([
                fleetApi.getAll(), 
                strategiesApi.getAll(),
                fleetApi.getRisk()
            ]);
            setInstances(instRes.data);
            setStrategies(stratRes.data);
            setRiskData(riskRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleCreate = async () => {
        await fleetApi.create({
            name: newBot.name,
            strategy: { id: Number(newBot.strategyId) },
            pair: newBot.pair,
            timeframe: newBot.timeframe,
            currentBalance: newBot.balance
        });
        setShowCreate(false);
        fetchAll();
    };

    const handleStart = async (id: number) => {
        await fleetApi.start(id);
        fetchAll();
    };

    const handleStop = async (id: number) => {
        await fleetApi.stop(id);
        fetchAll();
    };

    const handlePanic = async () => {
        if (confirm(language === 'ru' ? 'ВЫ УВЕРЕНЫ? Это остановит ВСЕХ ботов немедленно!' : 'ARE YOU SURE? This will stop ALL bots immediately!')) {
            await fleetApi.panic();
            fetchAll();
        }
    };

    const totalPnL = instances.reduce((s, i) => s + (i.totalPnL || 0), 0);

    return (
        <div style={{ padding: '32px', color: 'var(--text-primary)', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>{t('fleet_management_title')}</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{language === 'ru' ? 'Централизованный мониторинг и контроль' : 'Centralized monitoring and control'}</p>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div className="relative">
                      <button onClick={handlePanic} style={{ padding: '12px 24px', background: 'var(--danger)', color: '#fff', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}>{t('panic_stop')}</button>
                    </div>
                    <button onClick={() => setShowCreate(true)} style={{ padding: '12px 24px', background: 'var(--accent-color)', color: '#fff', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer' }}>{t('launch_bot')}</button>
                </div>
            </div>

            {/* Global Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
                <div className="bento-card" style={{ padding: '24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>{t('total_pnl')}</div>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: totalPnL >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                    </div>
                </div>
                <div className="bento-card" style={{ padding: '24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>{t('active_instances')}</div>
                    <div style={{ fontSize: '32px', fontWeight: 800 }}>{instances.filter(i => i.status === 'RUNNING').length} <span style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>/ {instances.length}</span></div>
                </div>
                <div className="bento-card" style={{ padding: '24px', background: riskData?.warnings?.length > 0 ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-accent)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>{t('risk_level')}</div>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: riskData?.warnings?.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {riskData?.warnings?.length > 0 ? (language === 'ru' ? 'ВЫСОКИЙ' : 'HIGH') : (language === 'ru' ? 'НИЗКИЙ' : 'LOW')}
                    </div>
                </div>
            </div>

            {/* Risk Warnings */}
            {riskData?.warnings?.length > 0 && (
                <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {riskData.warnings.map((w: string, i: number) => (
                        <div key={i} style={{ padding: '16px 24px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '12px', color: 'var(--danger)', fontSize: '14px', fontWeight: 600 }}>
                            ⚠️ {w}
                        </div>
                    ))}
                </div>
            )}

            {/* Correlation Matrix Section */}
            {riskData?.correlationMatrix && Object.keys(riskData.correlationMatrix).length > 1 && (
                <div className="bento-card" style={{ padding: '24px', marginBottom: '40px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '20px' }}>{t('correlation_matrix_1h')}</div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)' }}>{t('pair')}</th>
                                    {Object.keys(riskData.correlationMatrix).map(p => (
                                        <th key={p} style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>{p}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(riskData.correlationMatrix).map(([p1, targets]: [string, any]) => (
                                    <tr key={p1} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px', fontSize: '12px', fontWeight: 700 }}>{p1}</td>
                                        {Object.values(targets).map((val: any, i) => (
                                            <td key={i} style={{ 
                                                padding: '12px', 
                                                textAlign: 'center', 
                                                fontSize: '12px', 
                                                fontWeight: 600,
                                                color: val > 0.8 ? 'var(--danger)' : (val < 0.2 ? 'var(--success)' : 'var(--text-primary)'),
                                                background: `rgba(99, 102, 241, ${Math.abs(val) * 0.1})`
                                            }}>
                                                {val.toFixed(2)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Instances Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                {instances.map(inst => (
                    <div key={inst.id} className="bento-card" style={{ padding: '24px', position: 'relative', border: inst.status === 'RUNNING' ? '1px solid var(--success)' : '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div>
                                <div style={{ fontSize: '18px', fontWeight: 800 }}>{inst.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{inst.strategy?.name} • {inst.pair} • {inst.timeframe}</div>
                            </div>
                            <div style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 800, background: inst.status === 'RUNNING' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', color: inst.status === 'RUNNING' ? 'var(--success)' : 'var(--text-secondary)' }}>
                                {inst.status}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('balance')}</div>
                                <div style={{ fontSize: '18px', fontWeight: 700 }}>${inst.currentBalance?.toFixed(2)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('pnl')}</div>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: (inst.totalPnL || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    {(inst.totalPnL || 0) >= 0 ? '+' : ''}${inst.totalPnL?.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {inst.currentPosition ? (
                            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px', marginBottom: '24px', borderLeft: `4px solid ${inst.currentPosition.type === 'LONG' ? 'var(--success)' : 'var(--danger)'}` }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>{t('active_position_lbl')}{inst.currentPosition.type}</div>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>Entry: ${inst.currentPosition.entryPrice?.toLocaleString()}</div>
                            </div>
                        ) : (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '24px', fontStyle: 'italic' }}>{t('no_active_position')}</div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {inst.status === 'RUNNING' ? (
                                <button onClick={() => handleStop(inst.id)} style={{ padding: '10px', background: 'var(--bg-accent)', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{t('stop')}</button>
                            ) : (
                                <button onClick={() => handleStart(inst.id)} style={{ padding: '10px', background: 'var(--success)', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{t('start')}</button>
                            )}
                            <button style={{ padding: '10px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{t('logs')}</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--bg-primary)', padding: '32px', borderRadius: '24px', width: '450px', border: '1px solid var(--border-color)' }}>
                        <h2 style={{ marginBottom: '24px' }}>{t('launch_new_bot')}</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input placeholder={t('bot_name_placeholder')} value={newBot.name} onChange={e => setNewBot({...newBot, name: e.target.value})} style={inputStyle} />
                            <select value={newBot.strategyId} onChange={e => setNewBot({...newBot, strategyId: e.target.value})} style={inputStyle}>
                                <option value="">{t('select_strategy')}</option>
                                {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input placeholder={t('pair_placeholder')} value={newBot.pair} onChange={e => setNewBot({...newBot, pair: e.target.value})} style={inputStyle} />
                            <input placeholder={t('deposit_placeholder')} type="number" value={newBot.balance} onChange={e => setNewBot({...newBot, balance: Number(e.target.value)})} style={inputStyle} />
                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                <button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>{t('cancel')}</button>
                                <button onClick={handleCreate} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--accent-color)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{language === 'ru' ? 'ЗАПУСТИТЬ' : 'LAUNCH'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const inputStyle = {
    padding: '12px 16px',
    borderRadius: '12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none'
};

export default Fleet;
