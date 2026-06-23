import React, { useEffect, useState, useCallback } from 'react';
import { dashboardApi, signalsApi as dashSignalsApi, systemApi, paperTradingApi } from '../api/dashboard';
import { strategiesApi } from '../api/strategies';
import { useSignalsWs } from '../hooks/useSignalsWs';
import {
  Zap, TrendingUp, Target, Brain, ArrowUpRight, ArrowDownRight,
  PlusCircle, Play, LayoutTemplate, Settings, ChevronRight, Activity, Trophy
} from 'lucide-react';

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string;
}) => (
  <div style={{
    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px',
    padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '10px',
    position: 'relative', overflow: 'hidden', minHeight: '120px',
    transition: 'var(--transition)', cursor: 'default',
  }}>
    {/* Decorative gradient blob */}
    <div style={{
      position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px',
      borderRadius: '50%', background: accent, opacity: 0.07, filter: 'blur(20px)',
    }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '10px',
        background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
      }}>{icon}</div>
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
    <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
    {sub && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-4px' }}>{sub}</div>}
  </div>
);

// ─── Sparkline mini chart ──────────────────────────────────────────────────────
const Sparkline = ({ data, color, height = 100 }: { data: number[]; color: string; height?: number }) => {
  if (data.length < 2) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>Нет данных</div>;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const step = w / (data.length - 1);

  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h * 0.85) - h * 0.05}`).join(' ');
  const fillPoints = `0,${h} ${points} ${(data.length - 1) * step},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: `${h}px` }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

// ─── Quick Action button ───────────────────────────────────────────────────────
const QuickAction = ({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick?: () => void }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
      borderRadius: '14px', cursor: 'pointer', transition: 'var(--transition)',
      border: '1px solid var(--border-color)', background: 'var(--bg-accent)',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-accent)'; }}
  >
    <div style={{ color: 'var(--accent-color)' }}>{icon}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sub}</div>
    </div>
    <ChevronRight size={14} color="var(--text-secondary)" />
  </div>
);

// ─── Signal AI Intelligence Panel ──────────────────────────────────────────────
const SignalAiDetails = ({ s }: { s: any }) => {
  const ind = s.metadata?.indicators || {};
  const ldr = ind.ldrResearch;
  const hermes = ind.hermes;
  const sizer = ind.portfolioRisk;
  const finviz = ind.finviz;
  const heym = ind.heym_mcp;
  const polymarket = ind.polymarket;

  const hasAiData = ldr || hermes || sizer || finviz || heym || polymarket;

  if (!hasAiData) {
    return (
      <div style={{
        marginTop: '10px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)',
        borderRadius: '12px', border: '1px dashed var(--border-color)', fontSize: '11px',
        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        <Brain size={14} />
        <span>Этот сигнал был сгенерирован по стандартному техническому алгоритму без подключения ИИ-агентов Hermes/LDR.</span>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px',
      padding: '16px', borderRadius: '16px', background: 'rgba(12,13,16,0.6)',
      border: '1px solid var(--border-color)', backdropFilter: 'blur(10px)',
      boxShadow: 'inset 0 1px 1px 0 rgba(255,255,255,0.02)',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* Grid of details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        
        {/* LDR Research */}
        {ldr && (
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🔬 Deep Research (LDR)
              </span>
              <span style={{
                fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '6px',
                background: ldr.riskLevel === 'critical' ? 'rgba(239,68,68,0.15)' : ldr.riskLevel === 'high' ? 'rgba(249,115,22,0.15)' : 'rgba(16,185,129,0.15)',
                color: ldr.riskLevel === 'critical' ? '#ef4444' : ldr.riskLevel === 'high' ? '#f97316' : '#10b981',
                boxShadow: ldr.riskLevel === 'critical' ? '0 0 8px rgba(239,68,68,0.4)' : 'none'
              }}>
                Risk: {ldr.riskLevel}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: '1.4' }}>
              {ldr.summary}
            </div>
            {ldr.keyFindings && ldr.keyFindings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {ldr.keyFindings.slice(0, 3).map((f: string, idx: number) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#a855f7' }}>•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hermes Agent */}
        {hermes && (
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🧠 Hermes Decision
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 900,
                color: hermes.decision === 'PASS' ? '#10b981' : '#ef4444'
              }}>
                {hermes.decision}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <strong>Reasoning:</strong> {hermes.reason}
            </div>
            {hermes.confidence !== undefined && (
              <div style={{ marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  <span>Confidence</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{Math.round(hermes.confidence * 100)}%</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${hermes.confidence * 100}%`, height: '100%', background: 'linear-gradient(90deg, #ec4899, #8b5cf6)', borderRadius: '2px' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Finviz Equity Intel */}
        {finviz && (
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#00ffbb', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📈 Stock Scanner Profile
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)' }}>{finviz.ticker}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{finviz.company || 'Equity Scanner Trigger'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace' }}>${parseFloat(finviz.price).toFixed(2)}</div>
                <div style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', color: String(finviz.change).includes('+') || parseFloat(finviz.change) > 0 ? '#10b981' : '#ef4444' }}>
                  {finviz.change}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px', marginTop: '4px' }}>
              <span>Volume</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{Number(finviz.volume).toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Portfolio Sizer */}
        {sizer && (
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚖️ Portfolio Risk Sizer
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Allocated Size</div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace' }}>${sizer.volume?.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Risk Multiplier</div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: '#f59e0b', fontFamily: 'monospace' }}>{sizer.riskMultiplier?.toFixed(2)}x</div>
              </div>
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px', marginTop: '4px' }}>
              <span>Max Correlation</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{sizer.maxCorrelation?.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Heym MCP */}
        {heym && (
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔌 heym MCP Validator
            </span>
            <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600 }}>
              Status: <span style={{ color: heym.passed ? '#10b981' : '#ef4444' }}>{heym.passed ? 'PASSED' : 'BLOCKED'}</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {heym.reason}
            </div>
          </div>
        )}

        {/* Polymarket Scanner */}
        {polymarket && (
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0046ff', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔮 Polymarket Whales
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Market Slug</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{polymarket.slug || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Whale Volume</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0046ff', fontFamily: 'monospace' }}>${Number(polymarket.amountUsd || 0).toLocaleString()}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
const Dashboard: React.FC<{ onTabChange?: (tab: string) => void }> = ({ onTabChange }) => {
  const [stats, setStats] = useState<any>(null);
  const [screener, setScreener] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [activeChart, setActiveChart] = useState<'signals' | 'equity'>('signals');
  const [equityData, setEquityData] = useState<any[]>([]);

  // ─── Collapsible Signals & Multi-Asset States ───────────────────────────────
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);

  // ─── Finviz State & Fetches ────────────────────────────────────────────────
  const [activeBottomTab, setActiveBottomTab] = useState<'signals' | 'ai_intel' | 'equity_intel'>('signals');
  const [equityIntelTab, setEquityIntelTab] = useState<'screener' | 'insiders'>('screener');
  const [equitySignal, setEquitySignal] = useState<string>('top_gainers');
  const [finvizScreener, setFinvizScreener] = useState<any[]>([]);
  const [finvizInsiders, setFinvizInsiders] = useState<any[]>([]);
  const [loadingFinviz, setLoadingFinviz] = useState<boolean>(false);
  const [selectedStockChart, setSelectedStockChart] = useState<string | null>(null);

  const fetchFinvizScreener = useCallback((sig: string) => {
    setLoadingFinviz(true);
    fetch(`/api/kronos/finviz/screener?signal=${sig}`)
      .then(res => res.json())
      .then(res => {
        setFinvizScreener(res.data || []);
        setLoadingFinviz(false);
      })
      .catch(() => setLoadingFinviz(false));
  }, []);

  const fetchFinvizInsiders = useCallback(() => {
    setLoadingFinviz(true);
    fetch('/api/kronos/finviz/insider')
      .then(res => res.json())
      .then(res => {
        setFinvizInsiders(res.data || []);
        setLoadingFinviz(false);
      })
      .catch(() => setLoadingFinviz(false));
  }, []);

  useEffect(() => {
    if (activeBottomTab === 'equity_intel') {
      if (equityIntelTab === 'screener') {
        fetchFinvizScreener(equitySignal);
      } else {
        fetchFinvizInsiders();
      }
    }
  }, [activeBottomTab, equityIntelTab, equitySignal, fetchFinvizScreener, fetchFinvizInsiders]);


  // WebSocket — add new signals to the live feed
  const onNewSignal = useCallback((signal: any) => {
    setSignals(prev => [signal, ...prev].slice(0, 30));
    dashboardApi.getStats().then(res => setStats(res.data)).catch(() => {});
  }, []);
  useSignalsWs(onNewSignal);

  // Fetch on mount
  useEffect(() => {
    dashboardApi.getStats().then(res => setStats(res.data)).catch(() => {});
    dashSignalsApi.getHistory(30).then(res => setSignals(res.data || [])).catch(() => {});
    strategiesApi.getAll().then(res => setStrategies(res.data || [])).catch(() => {});
    systemApi.getHealth().then(res => setHealth(res.data?.services || res.data)).catch(() => {});
    paperTradingApi.getEquityCurve().then(res => setEquityData(res.data || [])).catch(() => {});

    const fetchScreener = () => dashboardApi.getScreener().then(res => setScreener(res.data || [])).catch(() => {});
    fetchScreener();
    const interval = setInterval(fetchScreener, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ─── Derived data ─────────────────────────────────────────────────────────
  const todayTotal = stats?.today?.total || 0;
  const todayLong = stats?.today?.long || 0;
  const todayShort = stats?.today?.short || 0;
  const activeStrats = stats?.strategies?.active || 0;
  const totalStrats = stats?.strategies?.total || 0;

  // Win rate placeholder (from signals with result metadata)
  const weekTotal = stats?.week?.total || 0;

  // Daily chart data as sparkline values (total signals per day or cumulative PnL)
  const isEquity = activeChart === 'equity';
  const sparkData = isEquity
    ? equityData.map(d => Number(d.pnl))
    : (stats?.dailyChart || []).map((d: any) => (d.long || 0) + (d.short || 0));

  const chartColor = isEquity ? '#10b981' : '#6366f1';

  const currentTotalValue = isEquity
    ? (equityData.length > 0 ? `${equityData[equityData.length - 1].pnl}%` : '0%')
    : `${weekTotal}`;

  // Top strategies by signal count
  const topStrategies = (stats?.strategyDistribution || []).slice(0, 5);

  // System health summary
  const allHealthOk = health && Object.values(health).every((v: any) => v === 'ok');

  const nav = (tab: string) => onTabChange?.(tab);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div className="dashboard-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 32px 48px' }}>

        {/* Header (Low-profile context status) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Панель мониторинга активности торговых стратегий и ИИ-сигналов
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px',
              background: allHealthOk ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: allHealthOk ? '#10b981' : '#ef4444',
              border: `1px solid ${allHealthOk ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {allHealthOk === null ? '◌ Загрузка...' : allHealthOk ? '● Все системы ОК' : '○ Есть проблемы'}
            </div>
            <span style={{ fontSize: '9px', background: 'rgba(124,58,237,0.2)', color: '#a78bfa', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>v3.2.0</span>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <KpiCard icon={<Zap size={16} />} label="Активные стратегии" value={activeStrats} sub={`из ${totalStrats} созданных`} accent="#6366f1" />
          <KpiCard icon={<Target size={16} />} label="Сигналы сегодня" value={todayTotal} sub={`${todayLong}L / ${todayShort}S`} accent="#10b981" />
          <KpiCard icon={<TrendingUp size={16} />} label="За неделю" value={weekTotal} sub="сигналов за 7 дней" accent="#f59e0b" />
          <KpiCard icon={<Activity size={16} />} label="Последний час" value={stats?.today?.lastHour || 0} sub="новых сигналов" accent="#ec4899" />
          <KpiCard icon={<Brain size={16} />} label="Hermes AI" value={allHealthOk ? 'Online' : '—'} sub="AI фильтрация" accent="#8b5cf6" />
        </div>

        {/* ── Main Grid: 2 columns ── */}
        <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', marginBottom: '24px' }}>

          {/* LEFT: Signal Activity / Equity Curve Chart */}
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px',
            padding: '24px', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    onClick={() => setActiveChart('signals')}
                    style={{
                      background: !isEquity ? 'var(--accent-soft)' : 'none',
                      border: 'none',
                      color: !isEquity ? 'var(--accent-color)' : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 700,
                      padding: '6px 12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    Активность сигналов
                  </button>
                  <button 
                    onClick={() => setActiveChart('equity')}
                    style={{
                      background: isEquity ? 'rgba(16, 185, 129, 0.1)' : 'none',
                      border: 'none',
                      color: isEquity ? 'var(--success)' : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 700,
                      padding: '6px 12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    Equity Curve
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', paddingLeft: '8px' }}>
                  {isEquity ? 'Кумулятивный PnL форвард-тестов (30 дней)' : 'Кол-во сигналов за последние 7 дней'}
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: chartColor }}>{currentTotalValue}</div>
            </div>
            <div style={{ flex: 1, minHeight: '140px' }}>
              <Sparkline data={sparkData} color={chartColor} height={140} />
            </div>
            {/* Dynamic labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              {isEquity ? (
                (() => {
                  if (equityData.length === 0) return <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Нет сделок</span>;
                  const step = Math.max(1, Math.floor(equityData.length / 5));
                  return equityData.map((d: any, i: number) => {
                    if (i % step === 0 || i === equityData.length - 1) {
                      return (
                        <span key={i} style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                          {new Date(d.date).toLocaleDateString('ru', { month: 'short', day: 'numeric' })}
                        </span>
                      );
                    }
                    return null;
                  });
                })()
              ) : (
                (stats?.dailyChart || []).map((d: any, i: number) => (
                  <span key={i} style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                    {new Date(d.date).toLocaleDateString('ru', { weekday: 'short' })}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: Quick Actions */}
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Быстрые действия</div>
            <QuickAction icon={<PlusCircle size={18} />} label="Создать стратегию" sub="Открыть конструктор" onClick={() => nav('builder')} />
            <QuickAction icon={<Play size={18} />} label="Запустить бэктест" sub="Протестировать на истории" onClick={() => nav('backtest')} />
            <QuickAction icon={<LayoutTemplate size={18} />} label="Шаблоны стратегий" sub="Готовые конфигурации" onClick={() => nav('strategies')} />
            <QuickAction icon={<Settings size={18} />} label="Настройки интеграций" sub="heym, Hermes, Telegram" onClick={() => nav('settings')} />
          </div>
        </div>

        {/* ── Bottom Grid: Signal Feed + Top Strategies ── */}
        <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', marginBottom: '24px' }}>

          {/* LEFT: Live Signal Feed or Stock Intel */}
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px',
            padding: '24px', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <button
                  onClick={() => setActiveBottomTab('signals')}
                  style={{
                    background: activeBottomTab === 'signals' ? 'var(--accent-soft)' : 'none',
                    border: 'none',
                    color: activeBottomTab === 'signals' ? 'var(--accent-color)' : 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Последние сигналы
                </button>
                <button
                  onClick={() => setActiveBottomTab('ai_intel')}
                  style={{
                    background: activeBottomTab === 'ai_intel' ? 'rgba(168, 85, 247, 0.1)' : 'none',
                    border: 'none',
                    color: activeBottomTab === 'ai_intel' ? '#a855f7' : 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  🧠 AI Cognitive Audit
                </button>
                <button
                  onClick={() => setActiveBottomTab('equity_intel')}
                  style={{
                    background: activeBottomTab === 'equity_intel' ? 'rgba(0, 255, 187, 0.1)' : 'none',
                    border: 'none',
                    color: activeBottomTab === 'equity_intel' ? '#00ffbb' : 'var(--text-secondary)',
                    fontSize: '14px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Equity Intel (Finviz)
                </button>
              </div>
              {activeBottomTab === 'signals' && (
                <span onClick={() => nav('signals')} style={{ fontSize: '11px', color: 'var(--accent-color)', cursor: 'pointer', fontWeight: 600 }}>Все →</span>
              )}
            </div>

            {activeBottomTab === 'signals' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '350px' }}>
                {signals.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Ожидание сигналов...
                  </div>
                )}
                {signals.map((s: any, i: number) => {
                  const isExpanded = expandedSignalId === s.id;
                  const ind = s.metadata?.indicators || {};
                  return (
                    <div key={s.id || i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div
                        onClick={() => setExpandedSignalId(isExpanded ? null : s.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                          borderRadius: '12px', background: 'var(--bg-accent)', border: `1px solid ${isExpanded ? 'var(--accent-color)' : 'var(--border-color)'}`,
                          transition: 'var(--transition)', cursor: 'pointer',
                        }}
                      >
                        {/* Direction icon */}
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '8px',
                          background: s.type === 'LONG' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {s.type === 'LONG'
                            ? <ArrowUpRight size={14} color="#10b981" />
                            : <ArrowDownRight size={14} color="#ef4444" />}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: s.type === 'LONG' ? '#10b981' : '#ef4444' }}>{s.type}</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.pair}</span>
                            {/* Visual pill badges for AI indicators */}
                            {ind.ldrResearch && (
                              <span style={{ fontSize: '8px', fontWeight: 800, color: '#a855f7', background: 'rgba(168,85,247,0.12)', padding: '2px 5px', borderRadius: '4px' }}>🔬 LDR</span>
                            )}
                            {ind.hermes && (
                              <span style={{ fontSize: '8px', fontWeight: 800, color: '#ec4899', background: 'rgba(236,72,153,0.12)', padding: '2px 5px', borderRadius: '4px' }}>🧠 HERMES</span>
                            )}
                            {ind.finviz && (
                              <span style={{ fontSize: '8px', fontWeight: 800, color: '#00ffbb', background: 'rgba(0,255,187,0.12)', padding: '2px 5px', borderRadius: '4px' }}>📈 STOCK</span>
                            )}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            via {s.strategy?.name || s.metadata?.strategy_name || `Strategy #${s.strategy_id || '?'}`}
                          </div>
                        </div>
                        {/* Time */}
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {s.created_at ? new Date(s.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </div>
                      {isExpanded && <SignalAiDetails s={s} />}
                    </div>
                  );
                })}
              </div>
            ) : activeBottomTab === 'ai_intel' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '350px' }}>
                {signals.filter(s => s.metadata?.indicators?.ldrResearch || s.metadata?.indicators?.hermes).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Нет сигналов с обогащенными данными ИИ (подключите ноды LDR или Hermes в конструкторе)
                  </div>
                ) : (
                  signals.filter(s => s.metadata?.indicators?.ldrResearch || s.metadata?.indicators?.hermes).map((s: any, i: number) => (
                    <div key={s.id || i} style={{
                      display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px',
                      borderRadius: '16px', background: 'var(--bg-accent)', border: '1px solid var(--border-color)',
                      animation: 'fadeIn 0.3s ease-out'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: s.type === 'LONG' ? '#10b981' : '#ef4444' }}>{s.type}</span>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{s.pair}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>via {s.strategy?.name || s.metadata?.strategy_name}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {s.created_at ? new Date(s.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </div>
                      <SignalAiDetails s={s} />
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Sub-tabs header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setEquityIntelTab('screener')}
                      style={{
                        background: equityIntelTab === 'screener' ? 'rgba(0,255,187,0.1)' : 'none',
                        border: 'none',
                        color: equityIntelTab === 'screener' ? '#00ffbb' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Скринер акций
                    </button>
                    <button
                      onClick={() => setEquityIntelTab('insiders')}
                      style={{
                        background: equityIntelTab === 'insiders' ? 'rgba(0,255,187,0.1)' : 'none',
                        border: 'none',
                        color: equityIntelTab === 'insiders' ? '#00ffbb' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Инсайдерские сделки
                    </button>
                  </div>

                  {equityIntelTab === 'screener' && (
                    <select
                      value={equitySignal}
                      onChange={(e) => setEquitySignal(e.target.value)}
                      style={{
                        background: 'var(--bg-accent)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        padding: '4px 8px',
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    >
                      <option value="top_gainers">📈 Лидеры роста</option>
                      <option value="top_losers">📉 Лидеры падения</option>
                      <option value="new_high">🚀 Новые хаи</option>
                      <option value="new_low">🩸 Новые лои</option>
                      <option value="most_active">🔥 Самые активные</option>
                    </select>
                  )}
                </div>

                {/* Table area */}
                {loadingFinviz ? (
                  <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    ◌ Загрузка данных Finviz...
                  </div>
                ) : equityIntelTab === 'screener' ? (
                  <div style={{ overflowX: 'auto', maxHeight: '250px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          <th style={{ padding: '8px' }}>Тикер</th>
                          <th style={{ padding: '8px' }}>Компания</th>
                          <th style={{ padding: '8px' }}>Сектор</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Цена</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Изм. %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finvizScreener.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Нет доступных акций</td>
                          </tr>
                        )}
                        {finvizScreener.map((item, idx) => {
                          const changeStr = String(item.change || item.change_val || item['change_val_%'] || '');
                          const isPositive = changeStr.includes('+') || parseFloat(changeStr) > 0;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', hover: { background: 'rgba(255,255,255,0.02)' } }}>
                              <td style={{ padding: '8px' }}>
                                <span
                                  onClick={() => setSelectedStockChart(item.ticker || item.ticker_val)}
                                  style={{
                                    fontWeight: 800,
                                    color: '#00ffbb',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  {item.ticker || item.ticker_val}
                                </span>
                              </td>
                              <td style={{ padding: '8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                                {item.company || item.company_name || '—'}
                              </td>
                              <td style={{ padding: '8px', color: 'var(--text-secondary)', fontSize: '11px' }}>{item.sector || '—'}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                                ${item.price ? parseFloat(String(item.price)).toFixed(2) : '—'}
                              </td>
                              <td style={{
                                padding: '8px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: isPositive ? '#10b981' : '#ef4444',
                                fontFamily: 'monospace'
                              }}>
                                {changeStr || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', maxHeight: '250px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          <th style={{ padding: '8px' }}>Тикер</th>
                          <th style={{ padding: '8px' }}>Владелец</th>
                          <th style={{ padding: '8px' }}>Должность</th>
                          <th style={{ padding: '8px' }}>Тип</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finvizInsiders.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Нет инсайдерских сделок</td>
                          </tr>
                        )}
                        {finvizInsiders.map((item, idx) => {
                          const isBuy = String(item.transaction || '').toLowerCase().includes('buy') || String(item.transaction || '').toLowerCase().includes('option');
                          const rawVal = String(item['value_($)'] || item.value || '');
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '8px' }}>
                                <span
                                  onClick={() => setSelectedStockChart(item.ticker)}
                                  style={{
                                    fontWeight: 800,
                                    color: '#00ffbb',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  {item.ticker}
                                </span>
                              </td>
                              <td style={{ padding: '8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>
                                {item.owner || item.insider_trader || '—'}
                              </td>
                              <td style={{ padding: '8px', color: 'var(--text-secondary)', fontSize: '10px' }}>{item.relationship || '—'}</td>
                              <td style={{
                                padding: '8px',
                                fontWeight: 700,
                                color: isBuy ? '#10b981' : '#f59e0b',
                                fontSize: '11px'
                              }}>
                                {item.transaction || '—'}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: isBuy ? '#10b981' : 'var(--text-primary)' }}>
                                ${rawVal || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Top Strategies + Market Pulse */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Top Strategies */}
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px',
              padding: '24px', flex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Trophy size={16} color="#f59e0b" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Топ стратегий</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topStrategies.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
                    Запустите стратегии для статистики
                  </div>
                )}
                {topStrategies.map((s: any, i: number) => (
                  <div key={s.name} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                    borderRadius: '10px', background: 'var(--bg-accent)', border: '1px solid var(--border-color)',
                  }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '8px',
                      background: i === 0 ? 'linear-gradient(135deg, #f59e0b, #f97316)' : i === 1 ? 'linear-gradient(135deg, #94a3b8, #64748b)' : 'linear-gradient(135deg, #a16207, #92400e)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 900, color: '#fff',
                    }}>{i + 1}</div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-color)', fontFamily: 'monospace' }}>{s.count} sig</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Market Pulse (compact strip) ── */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px',
          padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '24px', overflowX: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <Activity size={14} color="var(--accent-color)" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Market</span>
          </div>
          {screener.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Загрузка...</span>}
          {screener.map(s => (
            <div key={s.pair} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.pair.replace('USDT', '')}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>${s.price?.toLocaleString()}</span>
              <span style={{
                fontSize: '11px', fontWeight: 700, fontFamily: 'monospace',
                color: s.change24h >= 0 ? '#10b981' : '#ef4444',
                padding: '2px 6px', borderRadius: '6px',
                background: s.change24h >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              }}>
                {s.change24h >= 0 ? '+' : ''}{s.change24h}%
              </span>
            </div>
          ))}
        </div>

        {/* Stock Chart Modal */}
        {selectedStockChart && (
          <div
            onClick={() => setSelectedStockChart(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(10px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '720px',
                padding: '24px',
                boxShadow: 'var(--card-shadow)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    📈 Технический график: {selectedStockChart}
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Дневной таймфрейм (Finviz Daily Stock Chart)
                  </span>
                </div>
                <button
                  onClick={() => setSelectedStockChart(null)}
                  style={{
                    background: 'var(--bg-accent)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#111' }}>
                <img
                  src={`https://finviz.com/chart.ashx?t=${selectedStockChart}&ty=c&ta=1&p=d&s=l`}
                  alt={`${selectedStockChart} Daily Chart`}
                  style={{ width: '100%', display: 'block' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  onClick={() => setSelectedStockChart(null)}
                  style={{
                    background: 'var(--accent-color)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Pulse animation for live dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 1024px) {
          .dashboard-container { padding: 20px 16px 32px !important; }
          .dashboard-main-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .dashboard-container { padding: 16px 12px 24px !important; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
