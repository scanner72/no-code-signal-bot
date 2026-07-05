import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { strategiesApi } from '../api/strategies';
import { candlesApi } from '../api/candles';
import { Brain, Cpu, Database, History, Play, AlertCircle, CheckCircle2, Loader2, BarChart3, FlaskConical, Trash2 } from 'lucide-react';
import { useLanguageStore } from '../stores/useLanguageStore';

const MLTrainer = () => {
    const { t, language } = useLanguageStore();
    const [strategies, setStrategies] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [selectedStrategy, setSelectedStrategy] = useState<string>('');
    const [features, setFeatures] = useState<string[]>([]);
    const [targetPair, setTargetPair] = useState('BTCUSDT');
    const [targetTimeframe, setTargetTimeframe] = useState('1h');
    const [trackedSymbols, setTrackedSymbols] = useState<string[]>([]);
    const [training, setTraining] = useState(false);
    const [backtesting, setBacktesting] = useState(false);
    const [activeModel, setActiveModel] = useState<any>(null);
    const [dataset, setDataset] = useState<any[]>([]);
    const [backtestResult, setBacktestResult] = useState<any>(null);
    const [featureImportance, setFeatureImportance] = useState<Record<string, number>>({});
    const [modelType, setModelType] = useState('random_forest');

    // Пробиваемся к бэкенду по хосту текущей страницы, а не localhost пользователя
    // (иначе на прод-деплое /ml/* уходит в localhost:3000 браузера → Network Error).
    const apiBase = import.meta.env.VITE_API_URL || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000/api`;

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [stratRes, modelRes, symbolsRes] = await Promise.all([
                strategiesApi.getAll(),
                axios.get(`${apiBase}/ml/models`),
                candlesApi.getTrackedSymbols()
            ]);
            setStrategies(stratRes.data);
            setModels(modelRes.data);
            setTrackedSymbols(symbolsRes.data || []);
        } catch (e) {
            console.error('Failed to load data', e);
        }
    };

    const handleStrategyChange = (id: string) => {
        setSelectedStrategy(id);
        const strat = strategies.find(s => s.id === Number(id));
        if (strat) {
            if (strat.pair) setTargetPair(strat.pair);
            if (strat.timeframe) setTargetTimeframe(strat.timeframe);
            // Фичи берём из сырого графа стратегии (strat.nodes), а не из strat.ast:
            // ast — скомпилированное дерево без массива .nodes, обращение к нему падало.
            const featNodes = (strat.nodes || []).filter((n: any) =>
                ['indicator', 'smc', 'order_flow', 'input', 'scanner'].includes(n.type)
            );
            setFeatures(featNodes.map((n: any) => n.data?.name || n.type || n.id));
        }
    };

    const startTraining = async () => {
        setTraining(true);
        setActiveModel(null);
        setBacktestResult(null);
        setFeatureImportance({});
        try {
            // 1. Create Model entry
            const prefix = modelType === 'gradient_boosting' ? 'GB' : modelType === 'logistic_regression' ? 'LR' : 'RF';
            const modelRes = await axios.post(`${apiBase}/ml/create`, {
                name: `${prefix}_${targetPair}_${targetTimeframe}_${Date.now()}`,
                strategy: { id: Number(selectedStrategy) },
                targetPair,
                targetTimeframe,
                features,
                modelType,
            });

            // 2. Start Random Forest Training
            const trainRes = await axios.post(`${apiBase}/ml/train/${modelRes.data.id}`);
            setActiveModel(trainRes.data);

            // 3. Load feature importance
            const impRes = await axios.get(`${apiBase}/ml/importance/${modelRes.data.id}`);
            setFeatureImportance(impRes.data);

            // Refresh models list
            loadInitialData();
        } catch (e: any) {
            console.error('Training error:', e?.response?.data || e.message);
        } finally {
            setTraining(false);
        }
    };

    const runBacktest = async (modelId: number) => {
        setBacktesting(true);
        try {
            const res = await axios.get(`${apiBase}/ml/backtest/${modelId}`);
            setBacktestResult(res.data);
        } catch (e: any) {
            console.error('Backtest error:', e?.response?.data || e.message);
        } finally {
            setBacktesting(false);
        }
    };

    const deleteModel = async (modelId: number) => {
        try {
            await axios.delete(`${apiBase}/ml/${modelId}`);
            setActiveModel(null);
            setBacktestResult(null);
            setFeatureImportance({});
            loadInitialData();
        } catch (e) {
            console.error(e);
        }
    };

    const viewHistoryModel = async (model: any) => {
        setActiveModel(model);
        setBacktestResult(null);
        try {
            const impRes = await axios.get(`${apiBase}/ml/importance/${model.id}`);
            setFeatureImportance(impRes.data);
        } catch (e) {
            setFeatureImportance(model.weights?.featureImportance || {});
        }
    };

    return (
        <div style={{ padding: '32px', color: 'var(--text-primary)', height: '100%', overflowY: 'auto', background: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Brain size={32} color="var(--accent-color)" /> {language === 'ru' ? 'ML-тренер моделей' : 'ML Intelligence Trainer'}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>{language === 'ru' ? 'Обучение прогностических моделей на базе кастомных индикаторов и SMC-концептов' : 'Training predictive models based on custom indicators and SMC concepts'}</p>
                </div>
                <div style={{ padding: '8px 16px', background: 'var(--bg-accent)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Cpu size={20} color="var(--accent-color)" />
                    <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{language === 'ru' ? 'Статус вычислений' : 'Computing Status'}</div>
                        <div style={{ fontSize: '12px', fontWeight: 700 }}>{language === 'ru' ? 'Готов к обучению' : 'Ready for Training'}</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
                {/* Left: Sidebar / Config */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="bento-card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Play size={18} /> New Model Setup
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={labelStyle}>Strategy Base</label>
                                <select value={selectedStrategy} onChange={e => handleStrategyChange(e.target.value)} style={inputStyle}>
                                    <option value="">Select Strategy...</option>
                                    {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Pair</label>
                                    <select value={targetPair} onChange={e => setTargetPair(e.target.value)} style={inputStyle}>
                                        {Array.from(new Set([...trackedSymbols, targetPair])).filter(Boolean).map(symbol => (
                                            <option key={symbol} value={symbol}>{symbol}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>TF</label>
                                    <select value={targetTimeframe} onChange={e => setTargetTimeframe(e.target.value)} style={inputStyle}>
                                        <option value="15m">15m</option>
                                        <option value="1h">1h</option>
                                        <option value="4h">4h</option>
                                        <option value="1d">1d</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>{language === 'ru' ? 'Алгоритм' : 'Algorithm'}</label>
                                <select value={modelType} onChange={e => setModelType(e.target.value)} style={inputStyle}>
                                    <option value="random_forest">🌲 Random Forest — {language === 'ru' ? 'стабильный, базовый' : 'stable, baseline'}</option>
                                    <option value="gradient_boosting">🚀 Gradient Boosting — {language === 'ru' ? 'точнее, ловит паттерны' : 'more accurate'}</option>
                                    <option value="logistic_regression">📊 Logistic Regression — {language === 'ru' ? 'быстрый, интерпретируемый' : 'fast, interpretable'}</option>
                                </select>
                            </div>

                            <div>
                                <label style={labelStyle}>Features ({features.length})</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    {features.map(f => (
                                        <span key={f} style={{ padding: '4px 10px', background: 'var(--bg-accent)', borderRadius: '12px', fontSize: '11px', border: '1px solid var(--border-color)', color: 'var(--accent-color)' }}>
                                            {f}
                                        </span>
                                    ))}
                                    {features.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No indicators found</span>}
                                </div>
                            </div>

                            <button 
                                disabled={!selectedStrategy || training}
                                onClick={startTraining}
                                style={{ 
                                    padding: '16px', background: 'var(--accent-color)', color: '#fff', 
                                    border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer',
                                    boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)', transition: 'transform 0.2s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                {training ? <Loader2 className="animate-spin" /> : <Play fill="white" size={16} />}
                                {training ? 'Processing...' : 'LAUNCH TRAINING'}
                            </button>
                        </div>
                    </div>

                    <div className="bento-card" style={{ padding: '24px', flex: 1 }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <History size={18} /> Model Registry
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                            {models.map(m => (
                                <div key={m.id} onClick={() => viewHistoryModel(m)} style={{ 
                                    padding: '12px', background: activeModel?.id === m.id ? 'var(--bg-accent)' : 'var(--bg-secondary)', 
                                    borderRadius: '10px', cursor: 'pointer', border: '1px solid',
                                    borderColor: activeModel?.id === m.id ? 'var(--accent-color)' : 'transparent',
                                    transition: 'all 0.2s'
                                }}>
                                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{m.name}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                            {m.targetPair} • {m.targetTimeframe}
                                            <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: m.modelType === 'gradient_boosting' ? 'rgba(16,185,129,0.15)' : m.modelType === 'logistic_regression' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)', color: m.modelType === 'gradient_boosting' ? '#10b981' : m.modelType === 'logistic_regression' ? '#6366f1' : '#f59e0b' }}>
                                                {m.modelType === 'gradient_boosting' ? 'GB' : m.modelType === 'logistic_regression' ? 'LR' : 'RF'}
                                            </span>
                                        </span>
                                        <span style={{ fontSize: '11px', fontWeight: 800, color: m.accuracy > 0.6 ? 'var(--success)' : 'var(--text-primary)' }}>
                                            {(m.accuracy * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {models.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>No models trained yet</div>}
                        </div>
                    </div>
                </div>

                {/* Right: Detailed Analysis */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="bento-card" style={{ padding: '32px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Training Analysis</h3>
                            {activeModel && (
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Status</div>
                                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--success)' }}>{activeModel.status}</div>
                                    </div>
                                    <div style={{ width: '1px', background: 'var(--border-color)', height: '32px' }} />
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Model Type</div>
                                        <div style={{ fontSize: '12px', fontWeight: 800 }}>Random Forest (100 trees)</div>
                                    </div>
                                    <div style={{ width: '1px', background: 'var(--border-color)', height: '32px' }} />
                                    <button
                                        onClick={() => runBacktest(activeModel.id)}
                                        disabled={backtesting}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(99,102,241,0.15)', border: '1px solid var(--accent-color)', borderRadius: '8px', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                                    >
                                        {backtesting ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
                                        Backtest
                                    </button>
                                    <button
                                        onClick={() => deleteModel(activeModel.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            )}
                        </div>

                        {activeModel ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                                <div>
                                    <div style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, transparent 100%)', border: '1px solid var(--success)', borderRadius: '16px', marginBottom: '32px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Validation Accuracy</div>
                                                <div style={{ fontSize: '42px', fontWeight: 900, color: 'var(--success)', letterSpacing: '-0.02em' }}>
                                                    {(activeModel.accuracy * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                            <CheckCircle2 size={32} color="var(--success)" />
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>Based on {dataset.length * 100}+ historical samples</div>
                                        {activeModel.weights?.baselineAccuracy != null && (() => {
                                            const base = activeModel.weights.baselineAccuracy;
                                            const edge = activeModel.accuracy - base;
                                            return (
                                                <div style={{ fontSize: '11px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>
                                                        {language === 'ru' ? 'Baseline (мажоритарный класс)' : 'Baseline (majority class)'}: <b style={{ color: 'var(--text-primary)' }}>{(base * 100).toFixed(1)}%</b>
                                                    </span>
                                                    <span style={{ fontWeight: 800, color: edge > 0.02 ? 'var(--success)' : edge > 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                                                        {language === 'ru' ? 'эдж' : 'edge'} {edge >= 0 ? '+' : ''}{(edge * 100).toFixed(1)} {language === 'ru' ? 'пп' : 'pp'}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <h4 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <BarChart3 size={16} /> Feature Importance
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {Object.entries(featureImportance)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([f, val]) => (
                                            <div key={f}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                                                    <span style={{ fontWeight: 600 }}>{f}</span>
                                                    <span style={{ color: 'var(--text-secondary)' }}>{(val * 100).toFixed(1)}%</span>
                                                </div>
                                                <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${val * 100}%`,
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, var(--accent-color), #8b5cf6)',
                                                        boxShadow: '0 0 8px rgba(99,102,241,0.4)'
                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                        {Object.keys(featureImportance).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Train model to see feature importance</div>}
                                    </div>
                                </div>

                                <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '40px' }}>
                                    <h4 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Database size={16} /> Model Stats
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={statRowStyle}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Train Samples</span>
                                            <span style={{ fontWeight: 700 }}>{activeModel.weights?.trainSamples ?? '—'}</span>
                                        </div>
                                        <div style={statRowStyle}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Test Samples</span>
                                            <span style={{ fontWeight: 700 }}>{activeModel.weights?.testSamples ?? '—'}</span>
                                        </div>
                                        <div style={statRowStyle}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Trees (estimators)</span>
                                            <span style={{ fontWeight: 700 }}>100</span>
                                        </div>
                                        <div style={statRowStyle}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Prediction Horizon</span>
                                            <span style={{ fontWeight: 700 }}>12 Candles</span>
                                        </div>
                                        {backtestResult && (
                                            <div style={{ marginTop: '8px', padding: '16px', background: 'rgba(99,102,241,0.08)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.3)' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', color: 'var(--accent-color)' }}>Backtest Results</div>
                                                {[['Accuracy', `${(backtestResult.accuracy * 100).toFixed(1)}%`], ['Precision', `${(backtestResult.precision * 100).toFixed(1)}%`], ['Recall', `${(backtestResult.recall * 100).toFixed(1)}%`], ['F1 Score', `${(backtestResult.f1 * 100).toFixed(1)}%`], ['Samples', backtestResult.samples]].map(([k, v]) => (
                                                    <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                                                        <span style={{ fontWeight: 700 }}>{v}</span>
                                                    </div>
                                                ))}
                                                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>Confusion Matrix: TP={backtestResult.confusionMatrix.tp} TN={backtestResult.confusionMatrix.tn} FP={backtestResult.confusionMatrix.fp} FN={backtestResult.confusionMatrix.fn}</div>
                                            </div>
                                        )}
                                        <div style={{ marginTop: '12px', padding: '16px', background: 'var(--bg-accent)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <AlertCircle size={14} /> Recommendation
                                            </div>
                                            <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                                                {(() => {
                                                    const base = activeModel.weights?.baselineAccuracy ?? 0.5;
                                                    const edge = activeModel.accuracy - base;
                                                    if (edge >= 0.03) return language === 'ru'
                                                        ? `Модель обходит baseline на +${(edge * 100).toFixed(1)} пп — есть реальный сигнал, можно использовать как ML Filter.`
                                                        : `Model beats baseline by +${(edge * 100).toFixed(1)} pp — real signal, usable as ML Filter.`;
                                                    return language === 'ru'
                                                        ? `Точность почти не превышает baseline (${(base * 100).toFixed(1)}%) — реального эджа нет. Смените таймфрейм на 4h/1d, увеличьте период или добавьте фичи.`
                                                        : `Accuracy barely exceeds baseline (${(base * 100).toFixed(1)}%) — no real edge. Try 4h/1d timeframe, longer period, or more features.`;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '20px', border: '2px dashed var(--border-color)' }}>
                                <Brain size={48} opacity={0.3} />
                                <div style={{ fontSize: '14px', maxWidth: '300px', textAlign: 'center' }}>
                                    {language === 'ru' 
                                        ? 'Настройте параметры слева и запустите обучение, чтобы увидеть аналитическую модель' 
                                        : 'Configure parameters on the left and start training to see the analytical model'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {dataset.length > 0 && (
                <div className="bento-card" style={{ marginTop: '24px', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Feature Matrix (Samples)</h3>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Raw input data from historical candles</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ color: 'var(--text-secondary)', fontSize: '11px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <th style={{ padding: '12px' }}>#</th>
                                    {Object.keys(dataset[0].features).map(f => <th key={f} style={{ padding: '12px' }}>{f}</th>)}
                                    <th style={{ padding: '12px' }}>Target (24h)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dataset.map((row, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-primary)' }}>
                                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{i+1}</td>
                                        {Object.values(row.features).map((v: any, j) => (
                                            <td key={j} style={{ padding: '12px', fontWeight: 600 }}>{v.toFixed(4)}</td>
                                        ))}
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ 
                                                padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900,
                                                background: row.target ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: row.target ? 'var(--success)' : 'var(--danger)'
                                            }}>
                                                {row.target ? 'UP_TREND' : 'DOWN_TREND'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    marginBottom: '8px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em'
};

const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 500,
    outline: 'none',
    transition: 'border-color 0.2s'
};

const statRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid var(--border-color)',
    fontSize: '13px'
};

export default MLTrainer;
