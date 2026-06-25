import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Power, Play, PencilRuler, ExternalLink, Trash2, X, BookOpen, Download, Bot, Code2 } from 'lucide-react';
import axios from 'axios';
import { toast, useNotificationStore } from '../stores/notificationStore';

const API = (import.meta as any).env?.VITE_API_URL || '/api';
import { strategiesApi, signalStatsApi, paperTradingApi, BacktestParams } from '../api/strategies';
import StrategyTemplatesModal from '../components/StrategyTemplatesModal';
import type { StrategyTemplate } from '../data/strategyTemplates';
import { PythonPreview } from '../components/PythonPreview';

const today = new Date().toISOString().slice(0, 10);
const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const DEFAULT_FORM: BacktestParams & { feePercent: number; tpPercent: number; slPercent: number; positionSizePercent: number; accurate: boolean } = {
  start: sixMonthsAgo,
  end: today,
  initialBalance: 1000,
  fee: 0.001,
  feePercent: 0.1,
  tp: 0.02,
  tpPercent: 2,
  sl: 0.01,
  slPercent: 1,
  positionSize: 0.9,
  positionSizePercent: 90,
  accurate: false,
};

const Strategies = ({ onOpenBuilder, onEditStrategy }: { onOpenBuilder?: () => void; onEditStrategy?: (strategy: any) => void } = {}) => {
  const navigate = useNavigate();
  if (!onOpenBuilder) onOpenBuilder = () => navigate('/builder');
  if (!onEditStrategy) onEditStrategy = (s: any) => navigate('/builder', { state: { strategy: s } });
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fMode, setFMode] = useState('all');
  
  const [activeBacktest, setActiveBacktest] = useState<number | null>(null);
  const [backtestForm, setBacktestForm] = useState(DEFAULT_FORM);
  const [backtestReq, setBacktestReq] = useState<{ status: 'idle' | 'loading' | 'error' | 'success'; result?: any; error?: string }>({ status: 'idle' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Real signal stats & win rates (replaces hardcoded values)
  const [signalStats, setSignalStats] = useState<Record<number, { week: number; weekLong: number; weekShort: number; today: number }>>({});
  const [winRates, setWinRates] = useState<Record<number, { winRate: number; totalTrades: number; wins: number; totalPnl: number }>>({});

  // ── Codegen state ─────────────────────────────────────────────────────────
  const [codegenTarget, setCodegenTarget] = useState<any | null>(null);
  const [codegenConfig, setCodegenConfig] = useState({ botName: '', tradingPairs: 'BTCUSDT,ETHUSDT', timeframe: '15m', checkIntervalSeconds: 30 });
  const [codegenStatus, setCodegenStatus] = useState<'idle' | 'preview' | 'loading' | 'done' | 'error'>('idle');
  const [codegenResult, setCodegenResult] = useState<{ downloadUrl: string; botId: string; previewCode: string; files: string[] } | null>(null);
  const [previewCode, setPreviewCode] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');
  const [validation, setValidation] = useState<{ valid: boolean; errors: any[]; warnings: any[]; stats: any } | null>(null);
  const [codegenError, setCodegenError] = useState('');

  const openCodegen = async (strategy: any) => {
    setCodegenTarget(strategy);
    setCodegenConfig({ botName: `${strategy.name.toLowerCase().replace(/\s+/g, '-')}-bot`, tradingPairs: strategy.pair || 'BTCUSDT', timeframe: strategy.timeframe || '15m', checkIntervalSeconds: 30 });
    setCodegenStatus('idle');
    setCodegenResult(null);
    setCodegenError('');
    setActiveTab('config');
    // Validate strategy
    try {
      const vRes = await axios.get(`${API}/codegen/validate/${strategy.id}`);
      setValidation(vRes.data);
    } catch { setValidation(null); }
    // Load preview
    try {
      const res = await axios.get(`${API}/codegen/preview/${strategy.id}`);
      setPreviewCode(res.data.code || '');
    } catch { setPreviewCode('# Preview not available'); }
  };

  const handleExport = (strategy: any) => {
    try {
      const exportData = {
        name: strategy.name,
        pair: strategy.pair,
        timeframe: strategy.timeframe,
        nodes: strategy.nodes,
        edges: strategy.edges,
        is_paper_trading: strategy.is_paper_trading,
        execution_settings: strategy.execution_settings,
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(exportData, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `${strategy.name.replace(/\s+/g, '_')}_strategy.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Стратегия экспортирована!');
    } catch (err: any) {
      toast.error('Ошибка при экспорте: ' + err.message);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (!json.nodes || !json.edges) {
          toast.warning('Некорректный файл стратегии. Отсутствуют ноды или связи.');
          return;
        }

        const payload = {
          name: json.name || 'Импортированная стратегия',
          pair: json.pair || 'BTCUSDT',
          timeframe: json.timeframe || '15m',
          nodes: json.nodes,
          edges: json.edges,
          execution_settings: json.execution_settings || {},
          is_active: false,
          is_paper_trading: json.is_paper_trading !== undefined ? json.is_paper_trading : true,
        };

        const res = await strategiesApi.create(payload);
        setStrategies(prev => [res.data, ...prev]);
        toast.success(`Стратегия "${payload.name}" успешно импортирована!`);
        useNotificationStore.getState().addNotification('Каталог стратегий', `Стратегия "${payload.name}" импортирована успешно.`, 'success');
      } catch (err: any) {
        toast.error('Ошибка импорта: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const closeCodegen = () => { setCodegenTarget(null); setCodegenStatus('idle'); setCodegenResult(null); setValidation(null); setCodegenError(''); };

  const runCodegen = async () => {
    if (!codegenTarget) return;
    setCodegenStatus('loading');
    setCodegenError('');
    try {
      const res = await axios.post(`${API}/codegen/generate`, {
        strategyId: codegenTarget.id,
        config: { ...codegenConfig, tradingPairs: codegenConfig.tradingPairs.split(',').map((p: string) => p.trim()) },
      });
      setCodegenResult(res.data);
      setPreviewCode(res.data.previewCode || previewCode);
      setCodegenStatus('done');
      setActiveTab('preview');
    } catch (e: any) {
      const errData = e?.response?.data;
      if (errData?.errors) {
        setCodegenError(errData.errors.map((er: any) => er.message).join('\n'));
      } else {
        setCodegenError(errData?.message || 'Ошибка генерации');
      }
      setCodegenStatus('error');
    }
  };

  useEffect(() => {
    Promise.all([
      strategiesApi.getAll(),
      signalStatsApi.getAllStrategiesStats().catch(() => ({ data: {} })),
      paperTradingApi.getWinRates().catch(() => ({ data: {} })),
    ])
      .then(([stratRes, statsRes, wrRes]) => {
        setStrategies(stratRes.data);
        setSignalStats(statsRes.data || {});
        setWinRates(wrRes.data || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleStrategy = async (id: number) => {
    try {
      const res = await strategiesApi.toggle(id);
      setStrategies(prev => prev.map(s => s.id === id ? { ...s, is_active: res.data.is_active } : s));
    } catch {}
  };

  const deleteStrategy = async (id: number) => {
    try { await strategiesApi.delete(id); } catch {}
    setStrategies(prev => prev.filter(s => s.id !== id));
    setDeleteConfirmId(null);
  };

  const openBacktest = (id: number) => {
    setActiveBacktest(id);
    setBacktestReq({ status: 'idle' });
  };

  const runBacktest = async () => {
    if (!activeBacktest) return;
    setBacktestReq({ status: 'loading' });
    try {
      const res = await strategiesApi.backtest(activeBacktest, {
        start: backtestForm.start,
        end: backtestForm.end,
        initialBalance: backtestForm.initialBalance,
        fee: backtestForm.feePercent / 100,
        tp: backtestForm.tpPercent / 100,
        sl: backtestForm.slPercent / 100,
        positionSize: backtestForm.positionSizePercent / 100,
        accurate: backtestForm.accurate,
      });
      setBacktestReq({ status: 'success', result: res.data });
    } catch (e: any) {
      setBacktestReq({ status: 'error', error: e?.response?.data?.message || 'Ошибка запуска бэктеста' });
    }
  };

  const filteredStrategies = strategies.filter(s => {
    const q = search.toLowerCase();
    const matchQ = s.name.toLowerCase().includes(q) || s.pair.toLowerCase().includes(q);
    const matchF = fMode === 'all' || (fMode === 'active' && s.is_active) || (fMode === 'inactive' && !s.is_active);
    return matchQ && matchF;
  });

  const activeCount = strategies.filter(s => s.is_active).length;
  const activeStrat = strategies.find(s => s.id === activeBacktest);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-primary)' }}>
      
      {/* Summary Bar */}
      <div className="summary-bar" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div className="sum-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="sum-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{activeCount}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>активных</span>
        </div>
        <div className="sum-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="sum-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-secondary)', opacity: 0.5 }}></div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{strategies.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>всего</span>
        </div>
        <div className="sum-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="sum-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-color)', boxShadow: '0 0 8px var(--accent-color)' }}></div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{Object.values(signalStats).reduce((a, s) => a + s.today, 0)}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>сигналов сегодня</span>
        </div>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          <button 
            onClick={(e) => { 
              e.stopPropagation();
              console.log('Templates button clicked'); 
              setTemplatesOpen(true); 
            }} 
            style={{ fontSize: '12px', padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-accent)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'var(--transition)' }}
          >
            <BookOpen size={14} /> Шаблоны
          </button>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById('import-file-input')?.click();
            }}
            style={{ fontSize: '12px', padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-accent)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'var(--transition)' }}
          >
            <Download size={14} /> Импортировать JSON
          </button>
          <input
            type="file"
            id="import-file-input"
            accept=".json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />

          {onOpenBuilder && (
            <button onClick={onOpenBuilder} style={{ fontSize: '12px', padding: '8px 16px', borderRadius: '10px', border: 'none', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'var(--transition)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
              <PencilRuler size={14} /> Новая стратегия
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '16px 20px', gap: '12px', display: 'flex', alignItems: 'center' }}>
        <input 
            className="search" 
            placeholder="Поиск по названию или паре..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            style={{ ...selectStyle, width: '240px', padding: '8px 16px' }}
        />
        <div style={{ display: 'flex', background: 'var(--bg-accent)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-color)' }}>
            <button onClick={() => setFMode('all')} style={filterTabStyle(fMode === 'all')}>Все</button>
            <button onClick={() => setFMode('active')} style={filterTabStyle(fMode === 'active')}>Активные</button>
            <button onClick={() => setFMode('inactive')} style={filterTabStyle(fMode === 'inactive')}>Выключены</button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid" style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', overflowY: 'auto' }}>
        {loading && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', gridColumn: '1/-1' }}>Загрузка стратегий...</div>}
        {!loading && filteredStrategies.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '40px', opacity: 0.2, marginBottom: '16px' }}>◇</div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Стратегий не найдено</div>
            <p style={{ fontSize: '13px', opacity: 0.7 }}>Попробуйте изменить фильтры или создать новую стратегию</p>
          </div>
        )}
        {filteredStrategies.map(s => {
          const tags = (s.nodes ?? []).slice(0, 4).map((n: any) => n.data?.name || n.type);

          return (
            <div
              key={s.id}
              onClick={() => onEditStrategy?.(s)}
              style={{
                  background: 'var(--bg-secondary)',
                  border: `1px solid ${s.is_active ? 'var(--accent-color)' : 'var(--border-color)'}`,
                  borderRadius: '20px',
                  padding: '24px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'var(--transition)',
                  boxShadow: s.is_active ? '0 8px 24px rgba(99, 102, 241, 0.15)' : 'var(--card-shadow)',
                  display: 'flex', flexDirection: 'column'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = s.is_active ? 'var(--accent-color)' : 'var(--border-color)'; }}
            >
              {s.is_active && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase' }}>Active</span>
                  </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>{s.name}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ fontSize: '11px', padding: '3px 10px', background: 'var(--bg-accent)', borderRadius: '8px', color: 'var(--accent-color)', border: '1px solid var(--border-color)', fontWeight: 700 }}>{s.pair}</span>
                  <span style={{ fontSize: '11px', padding: '3px 10px', background: 'var(--bg-accent)', borderRadius: '8px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontWeight: 700 }}>{s.timeframe}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px', minHeight: '28px' }}>
                {tags.map((t: string, i: number) => <span key={i} style={{ fontSize: '10px', padding: '2px 8px', background: 'var(--bg-primary)', borderRadius: '6px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontWeight: 600 }}>{t}</span>)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '16px 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{signalStats[s.id]?.week ?? 0}</div><div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>7 дней</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--success)' }}>{signalStats[s.id]?.weekLong ?? 0}</div><div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>LONG</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--danger)' }}>{signalStats[s.id]?.weekShort ?? 0}</div><div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>SHORT</div></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>{new Date(s.created_at).toLocaleDateString('ru-RU')}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => openBacktest(s.id)} style={iconBtnStyle} title="Бэктест">
                    <Play size={14} fill="currentColor" />
                  </button>
                  <button onClick={() => openCodegen(s)} style={{ ...iconBtnStyle, color: 'var(--accent-color)', background: 'rgba(99, 102, 241, 0.1)' }} title="Сгенерировать бота">
                    <Bot size={14} />
                  </button>
                  <button onClick={() => handleExport(s)} style={{ ...iconBtnStyle, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)' }} title="Экспорт JSON">
                    <Download size={14} />
                  </button>
                  <button onClick={() => setDeleteConfirmId(s.id)} style={{ ...iconBtnStyle, color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)' }} title="Удалить">
                    <Trash2 size={14} />
                  </button>
                  <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 4px' }}></div>
                  <label className="toggle" style={{ scale: '0.9' }}>
                    <input type="checkbox" checked={s.is_active} onChange={() => toggleStrategy(s.id)} />
                    <div className="ttrack"></div><div className="tthumb"></div>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirmId !== null && (() => {
        const target = strategies.find(s => s.id === deleteConfirmId);
        return (
          <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '24px',
              padding: '32px', width: '320px', textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--danger)' }}>
                  <Trash2 size={30} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>Удалить стратегию?</div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
                Вы собираетесь удалить <b>{target?.name}</b>. Это действие необратимо.
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  style={{ flex: 1, fontSize: '14px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-accent)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700 }}
                >
                  Отмена
                </button>
                <button
                  onClick={() => deleteStrategy(deleteConfirmId)}
                  style={{ flex: 1, fontSize: '14px', padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Codegen Modal */}
      {codegenTarget && (
        <div className="modal-overlay" onClick={closeCodegen} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '24px',
            padding: '0', width: '850px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 70px rgba(0,0,0,0.5)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '24px 30px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' }}>
                <Bot size={24} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Генератор торгового бота</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{codegenTarget.name}</div>
              </div>
              <button onClick={closeCodegen} style={{ background: 'var(--bg-accent)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 8, borderRadius: '10px' }}><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-accent)', margin: '20px 30px 0', borderRadius: '12px', padding: '4px', border: '1px solid var(--border-color)' }}>
                <button onClick={() => setActiveTab('config')} style={tabButtonStyle(activeTab === 'config')}>Конфигурация</button>
                <button onClick={() => setActiveTab('preview')} style={tabButtonStyle(activeTab === 'preview')}>Предпросмотр кода</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
              {activeTab === 'config' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* ── Validation Status ─────────────────────────────── */}
                  {validation && (
                    <div style={{
                      padding: '16px 20px', borderRadius: 14,
                      background: validation.valid ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                      border: `1px solid ${validation.valid ? 'var(--success)' : 'var(--danger)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: validation.errors.length + validation.warnings.length > 0 ? 12 : 0 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: validation.valid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: validation.valid ? 'var(--success)' : 'var(--danger)', fontSize: 14, fontWeight: 900,
                        }}>
                          {validation.valid ? '✓' : '✕'}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: validation.valid ? 'var(--success)' : 'var(--danger)' }}>
                            {validation.valid ? 'Стратегия валидна' : 'Есть ошибки в стратегии'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            Нод: {validation.stats.totalNodes} · Подключено: {validation.stats.connectedNodes}
                            {validation.stats.orphanNodes > 0 && ` · Сироты: ${validation.stats.orphanNodes}`}
                          </div>
                        </div>
                      </div>

                      {validation.errors.map((err: any, i: number) => (
                        <div key={`e-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, marginBottom: 6 }}>
                          <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>⊘</span>
                          <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, lineHeight: 1.5 }}>{err.message}</span>
                        </div>
                      ))}
                      {validation.warnings.map((w: any, i: number) => (
                        <div key={`w-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 8, marginBottom: 6 }}>
                          <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>⚠</span>
                          <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, lineHeight: 1.5 }}>{w.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Error Banner ──────────────────────────────────── */}
                  {codegenStatus === 'error' && codegenError && (
                    <div style={{ padding: '14px 20px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 12, border: '1px solid var(--danger)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>Ошибка генерации</div>
                      <div style={{ fontSize: 12, color: 'var(--danger)', whiteSpace: 'pre-line', lineHeight: 1.5, opacity: 0.85 }}>{codegenError}</div>
                    </div>
                  )}

                  {codegenStatus === 'done' && codegenResult && (
                    <div style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 16, border: '1px solid var(--success)', marginBottom: '20px' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--success)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Play size={16} fill="currentColor" /> Бот готов к развертыванию
                      </div>
                      <div style={{ background: '#000', borderRadius: 12, padding: '16px', fontFamily: 'monospace', fontSize: 12, color: '#a6e3a1', marginBottom: 16, lineHeight: 1.6 }}>
                        <span style={{ color: '#6c7086' }}># Запуск в один клик:</span><br/>
                        cd {codegenConfig.botName}<br/>
                        docker-compose up -d --build
                      </div>
                      <a href={`${API.replace(/\/api$/, '')}${codegenResult.downloadUrl}`} download
                        style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '12px', background: 'var(--accent-color)', color: '#fff', borderRadius: 12, textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)' }}>
                        <Download size={18} /> Скачать исходный код (.zip)
                      </a>
                    </div>
                  )}

                  <CgField label="Имя процесса">
                    <input value={codegenConfig.botName} onChange={e => setCodegenConfig(c => ({ ...c, botName: e.target.value }))}
                      style={cgInput} placeholder="my-strategy-bot" />
                  </CgField>
                  <CgField label="Торговые пары">
                    <input value={codegenConfig.tradingPairs} onChange={e => setCodegenConfig(c => ({ ...c, tradingPairs: e.target.value }))}
                      style={cgInput} placeholder="BTCUSDT, ETHUSDT" />
                  </CgField>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <CgField label="Таймфрейм">
                      <select value={codegenConfig.timeframe} onChange={e => setCodegenConfig(c => ({ ...c, timeframe: e.target.value }))} style={cgInput}>
                        {['1m','3m','5m','15m','30m','1h','4h','1d'].map(tf => <option key={tf}>{tf}</option>)}
                      </select>
                    </CgField>
                    <CgField label="Проверка (сек)">
                      <input type="number" value={codegenConfig.checkIntervalSeconds} min={5}
                        onChange={e => setCodegenConfig(c => ({ ...c, checkIntervalSeconds: Number(e.target.value) }))}
                        style={cgInput} />
                    </CgField>
                  </div>
                </div>
              )}

              {activeTab === 'preview' && (
                <PythonPreview code={previewCode || '# Генерация логики...'} maxHeight={400} />
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 30px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 12, background: 'var(--bg-accent)' }}>
              <button onClick={closeCodegen} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Закрыть</button>
              {codegenStatus !== 'done' && (
                <button
                  onClick={runCodegen}
                  disabled={codegenStatus === 'loading' || (validation !== null && !validation.valid)}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 12, border: 'none',
                    background: (codegenStatus === 'loading' || (validation !== null && !validation.valid)) ? 'var(--border-color)' : 'var(--accent-color)',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: (codegenStatus === 'loading' || (validation !== null && !validation.valid)) ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: (validation !== null && !validation.valid) ? 'none' : '0 4px 15px rgba(99, 102, 241, 0.3)',
                    opacity: (validation !== null && !validation.valid) ? 0.6 : 1,
                  }}>
                  {codegenStatus === 'loading' ? 'Генерация...' :
                   (validation !== null && !validation.valid) ? <><Bot size={18} /> Исправьте ошибки</> :
                   <><Bot size={18} /> Создать файлы бота</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Backtest Modal */}
      {activeBacktest && activeStrat && (
        <div className="modal-overlay" onClick={() => setActiveBacktest(null)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
              maxHeight: '90vh', overflowY: 'auto', position: 'relative', width: '700px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '32px'
          }}>
            <button onClick={() => setActiveBacktest(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--bg-accent)', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            
            <div style={{ marginBottom: '32px' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>Бэктест: {activeStrat.name}</div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 600 }}>{activeStrat.pair} · {activeStrat.timeframe}</div>
            </div>

            <div style={{ background: 'var(--bg-accent)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.1em' }}>Параметры симуляции</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <Field label="Дата начала"><input type="date" value={backtestForm.start} onChange={e => setBacktestForm(f => ({ ...f, start: e.target.value }))} style={inputStyle} /></Field>
                <Field label="Дата конца"><input type="date" value={backtestForm.end} onChange={e => setBacktestForm(f => ({ ...f, end: e.target.value }))} style={inputStyle} /></Field>
                <Field label="Капитал ($)"><input type="number" value={backtestForm.initialBalance} onChange={e => setBacktestForm(f => ({ ...f, initialBalance: Number(e.target.value) }))} style={inputStyle} /></Field>
                <Field label="Комиссия (%)"><input type="number" value={backtestForm.feePercent} step={0.01} onChange={e => setBacktestForm(f => ({ ...f, feePercent: Number(e.target.value) }))} style={inputStyle} /></Field>
                <Field label="Take Profit (%)"><input type="number" value={backtestForm.tpPercent} step={0.1} onChange={e => setBacktestForm(f => ({ ...f, tpPercent: Number(e.target.value) }))} style={inputStyle} /></Field>
                <Field label="Stop Loss (%)"><input type="number" value={backtestForm.slPercent} step={0.1} onChange={e => setBacktestForm(f => ({ ...f, slPercent: Number(e.target.value) }))} style={inputStyle} /></Field>
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <label className="toggle" style={{ scale: '0.8' }}>
                    <input type="checkbox" checked={backtestForm.accurate} onChange={e => setBacktestForm(f => ({ ...f, accurate: e.target.checked }))} />
                    <div className="ttrack"></div><div className="tthumb"></div>
                  </label>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Точное моделирование (1m resolution)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Использует минутные свечи для проверки SL/TP внутри старшего таймфрейма. Снижает риск «перерисовки» прибыли.</div>
                  </div>
                </div>
              </div>

              <button
                onClick={runBacktest}
                disabled={backtestReq.status === 'loading'}
                style={{
                  marginTop: '24px', width: '100%', padding: '14px',
                  background: backtestReq.status === 'loading' ? 'var(--border-color)' : 'var(--accent-color)',
                  color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 800,
                  cursor: backtestReq.status === 'loading' ? 'default' : 'pointer', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                }}
              >
                {backtestReq.status === 'loading' ? 'Выполняется расчет...' : 'Запустить симуляцию'}
              </button>
            </div>

            {backtestReq.status === 'success' && <BacktestResults result={backtestReq.result} />}
          </div>
        </div>
      )}

      {templatesOpen && (
        <StrategyTemplatesModal
          onClose={() => setTemplatesOpen(false)}
          onLoad={(template) => {
            onEditStrategy?.({
              ...template,
              id: undefined, // Create new instead of editing existing template ID
              name: `Копия: ${template.name}`,
            });
          }}
        />
      )}
    </div>
  );
};

const filterTabStyle = (active: boolean) => ({
    padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
    background: active ? 'var(--bg-secondary)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    border: 'none', cursor: 'pointer', transition: 'var(--transition)',
    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
});

const tabButtonStyle = (active: boolean) => ({
    flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
    background: active ? 'var(--bg-secondary)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    border: 'none', cursor: 'pointer', transition: 'var(--transition)'
});

const BacktestResults = ({ result }: { result: any }) => {
  const isPos = result.totalReturn >= 0;
  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', marginTop: '24px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.08em' }}>Результаты тестирования</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Доходность" value={(isPos ? '+' : '') + result.totalReturn + '%'} color={isPos ? 'var(--success)' : 'var(--danger)'} bg="var(--bg-accent)" />
        <StatCard label="Win Rate" value={result.winRate + '%'} />
        <StatCard label="Сделок" value={result.totalTrades} />
        <StatCard label="Макс. просадка" value={result.maxDrawdown + '%'} color="var(--danger)" />
        <StatCard label="Ср. прибыль" value={'$' + fmt(result.avgWin)} color="var(--success)" />
        <StatCard label="Ср. убыток" value={'$' + fmt(result.avgLoss)} color="var(--danger)" />
      </div>

      <div style={{ padding: '16px 20px', background: 'var(--bg-accent)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Итоговый баланс</span>
        <span style={{ fontSize: '18px', fontWeight: 800, color: isPos ? 'var(--success)' : 'var(--danger)' }}>${fmt(result.finalBalance)}</span>
      </div>

      {result.trades.length > 0 && (
        <>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Сделки ({result.trades.length})</div>
          <div style={{ border: '0.5px solid #e0ddd6', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 70px 70px', background: '#f8f8f7', padding: '6px 12px', fontSize: '10px', color: '#aaa', fontWeight: 600, textTransform: 'uppercase', gap: '8px' }}>
              <span>Тип</span><span>Вход</span><span>Выход</span><span style={{ textAlign: 'right' }}>P&L%</span><span style={{ textAlign: 'right' }}>P&L $</span>
            </div>
            <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
              {result.trades.map((t: any, i: number) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 70px 70px', padding: '6px 12px', fontSize: '11px', gap: '8px', alignItems: 'center', borderTop: i > 0 ? '0.5px solid #f0ede8' : 'none' }}>
                  <span style={{ fontWeight: 600, color: t.type === 'LONG' ? '#27500A' : '#A32D2D' }}>{t.type}</span>
                  <span style={{ color: '#555' }}>${fmt(t.entryPrice)}</span>
                  <span style={{ color: '#555' }}>${fmt(t.exitPrice)}</span>
                  <span style={{ textAlign: 'right', fontWeight: 600, color: t.pnl >= 0 ? '#27500A' : '#A32D2D' }}>{t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent}%</span>
                  <span style={{ textAlign: 'right', color: t.pnl >= 0 ? '#27500A' : '#A32D2D' }}>{t.pnl >= 0 ? '+' : ''}${fmt(t.pnl)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{label}</div>
    {children}
  </div>
);

const StatCard = ({ label, value, color = 'var(--text-primary)', bg = 'var(--bg-accent)' }: { label: string; value: any; color?: string; bg?: string }) => (
  <div style={{ padding: '14px', background: bg, borderRadius: '10px', border: '1px solid var(--border-color)', transition: 'var(--transition)' }}>
    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: '15px', fontWeight: 700, color }}>{value}</div>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-accent)',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: 'var(--text-primary)',
  transition: 'var(--transition)'
};

const cgInput: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: 'var(--text-primary)',
};

const CgField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>{label}</div>
    {children}
  </div>
);

const filterBtnStyle = (active: boolean) => ({
    fontSize: '11px', padding: '4px 12px', borderRadius: '6px',
    background: active ? 'var(--accent-color)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: active ? 'none' : '1px solid var(--border-color)',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'var(--transition)'
});

const selectStyle = {
    padding: '4px 12px', borderRadius: '8px',
    background: 'var(--bg-accent)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', fontSize: '12px',
    cursor: 'pointer', outline: 'none'
};

const iconBtnStyle = {
    width: '28px', height: '28px', border: '1px solid var(--border-color)',
    borderRadius: '8px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', transition: 'var(--transition)',
    background: 'transparent', color: 'var(--text-secondary)'
};

export default Strategies;
