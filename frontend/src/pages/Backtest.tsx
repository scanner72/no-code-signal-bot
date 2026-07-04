import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { strategiesApi } from '../api/strategies';
import { optimizerApi } from '../api/optimizer';
import { useStrategyStore } from '../stores/strategyStore';
import { useLanguageStore } from '../stores/useLanguageStore';
import { toast, useNotificationStore } from '../stores/notificationStore';
import RunPanel from '../components/backtest/RunPanel';
import KpiStrip from '../components/backtest/KpiStrip';
import EquityChart from '../components/backtest/EquityChart';
import DistributionsRow from '../components/backtest/DistributionsRow';
import TradesTable from '../components/backtest/TradesTable';
import RunHistoryDrawer, { OVERLAY_COLORS } from '../components/backtest/RunHistoryDrawer';
import PriceChartTab from '../components/backtest/PriceChartTab';
import OptimizationTab from '../components/backtest/OptimizationTab';

const today = new Date().toISOString().slice(0, 10);
const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// t/language slice consumed by PriceChartTab / OptimizationTab (Task 8 contract).
const btTranslations = {
  ru: {
    genetic_opt: "Генетическая оптимизация",
    opt_subtitle: "Система автоматически подберет лучшие параметры индикаторов, перебирая тысячи комбинаций и оценивая результат по Profit Factor и Win Rate.",
    opt_params: "Параметры для подбора",
    no_params: "В этой стратегии нет настраиваемых индикаторов.",
    opt_combination: "Комбинация",
    opt_profit_factor: "Profit F.",
    opt_win_rate: "Win Rate",
    opt_score: "Score",
    opt_action: "Действие",
    apply: "Применить",
    run_to_view_chart: "Запустите бэктест для просмотра графика",
  },
  en: {
    genetic_opt: "Genetic Optimization",
    opt_subtitle: "The system automatically optimizes indicator parameters across thousands of combinations to maximize Profit Factor and Win Rate.",
    opt_params: "Parameters to Optimize",
    no_params: "No optimizable indicators found in this strategy.",
    opt_combination: "Combination",
    opt_profit_factor: "Profit Factor",
    opt_win_rate: "Win Rate",
    opt_score: "Score",
    opt_action: "Action",
    apply: "Apply",
    run_to_view_chart: "Run backtest to view price chart",
  },
};

const Backtest = () => {
  const { userLevels } = useStrategyStore();
  const { language } = useLanguageStore();
  const t = btTranslations[language as 'ru' | 'en'] || btTranslations.en;

  // ── state: стратегии (перенесено из старой страницы) ──
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [optimizableParams, setOptimizableParams] = useState<any[]>([]);
  const [selectedParams, setSelectedParams] = useState<any[]>([]);

  // ── state: form (те же имена полей, что были в старой странице) ──
  const [form, setForm] = useState<any>({
    start: sixMonthsAgo,
    end: today,
    initialBalance: 1000,
    feePercent: 0.1,
    tpPercent: 2,
    slPercent: 2,
    positionSizePercent: 100,
    useTrailingStop: false,
    trailingDistance: 1,
    trailingActivation: 1,
    slippagePct: 0.1,
    latencyMs: 100,
    accurate: false,
    brokerageModel: 'custom',
    executionAlgo: 'MARKET',
  });

  // ── state: run-flow ──
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<any>(null);

  // ── state: оптимизация (перенесено как есть) ──
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optProgress, setOptProgress] = useState(0);
  const [optGeneration, setOptGeneration] = useState(1);
  const [optResults, setOptResults] = useState<any[]>([]);

  // ── state: отчёт ──
  const [chartTab, setChartTab] = useState<'equity' | 'price' | 'optimization'>('equity');
  const [activeTradeIdx, setActiveTradeIdx] = useState<number | null>(null);

  // ── state: история/сравнение ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyReload, setHistoryReload] = useState(0);
  const [overlays, setOverlays] = useState<Array<{ id: number; label: string; result: any }>>([]);
  const [compareRun, setCompareRun] = useState<{ id: number; options: any; result: any } | null>(null);
  // Опции, с которыми был запущен ОТОБРАЖАЕМЫЙ результат (для честного diff в сравнении)
  const [activeRunOptions, setActiveRunOptions] = useState<any>(null);

  const extractParams = (node: any): any[] => {
    const params: any[] = [];
    const traverse = (n: any) => {
      if (!n || typeof n !== 'object') return;
      if (n.type === 'indicator' && n.params) {
        Object.entries(n.params).forEach(([k, v]) => {
          if (typeof v === 'number') {
            params.push({
              nodeId: n.id,
              nodeName: n.name,
              paramName: k,
              value: v,
              min: Math.max(1, Math.floor(v * 0.5)),
              max: Math.ceil(v * 2),
              step: 1,
            });
          }
        });
      }
      if (n.condition) traverse(n.condition);
      if (n.left) traverse(n.left);
      if (n.right) traverse(n.right);
      if (n.operands) n.operands.forEach(traverse);
      if (n.a) traverse(n.a);
      if (n.b) traverse(n.b);
    };
    traverse(node);
    return params;
  };

  // fetch стратегий — перенесено из старой страницы как есть
  useEffect(() => {
    strategiesApi.getAll().then((res) => {
      setStrategies(res.data);
      if (res.data && res.data.length > 0) {
        setSelectedStrategyId(res.data[0].id.toString());
        setOptimizableParams(extractParams(res.data[0].ast));
      }
    }).catch((err) => {
      console.error('Failed to load strategies:', err);
      toast.error(language === 'ru' ? 'Не удалось загрузить стратегии. Проверьте подключение к серверу.' : 'Failed to load strategies. Check server connection.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = strategies.find((st) => st.id.toString() === selectedStrategyId);
    if (s) {
      setOptimizableParams(extractParams(s.ast));
      setSelectedParams([]);
    }
    // Кривые и сравнение принадлежат прошлой стратегии — сбрасываем при переключении
    setOverlays([]);
    setCompareRun(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStrategyId, strategies]);

  // cleanup poll interval + socket on unmount (navigating away mid-run must not leak them)
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      socketRef.current?.disconnect();
    };
  }, []);

  const runBacktest = async () => {
    if (!selectedStrategyId) return;
    setRunning(true);
    setResult(null);
    setActiveTradeIdx(null);
    setProgress(0);
    setStatusText(language === 'ru' ? '📥 Инициализация бэктеста...' : '📥 Initializing backtest...');

    const strategyIdNum = Number(selectedStrategyId);

    try {
      const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';
      const socketUrl = API_URL.replace('/api', '') + '/signals';
      const socket = io(socketUrl, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('BACKTEST_PROGRESS', (data: { strategyId: number; progress: number; stage: string }) => {
        if (data.strategyId === strategyIdNum) {
          setProgress((p) => Math.max(p, Number(data.progress) || 0));
          setStatusText(data.stage);
        }
      });

      await new Promise<void>((resolve) => {
        if (socket.connected) return resolve();
        socket.on('connect', () => resolve());
        setTimeout(() => resolve(), 2000);
      });

      // Queue the backtest job (returns immediately with jobId)
      const runOptions = {
        start: form.start,
        end: form.end,
        initialBalance: form.initialBalance,
        fee: form.feePercent / 100,
        tp: form.tpPercent / 100,
        sl: form.slPercent / 100,
        positionSize: form.positionSizePercent / 100,
        useTrailingStop: form.useTrailingStop,
        trailingDistance: form.trailingDistance / 100,
        trailingActivation: form.trailingActivation / 100,
        slippagePct: form.slippagePct,
        latencyMs: form.latencyMs,
        accurate: form.accurate,
        executionAlgo: form.executionAlgo || 'MARKET',
        userLevels,
      };
      setActiveRunOptions(runOptions);
      const queueRes = await strategiesApi.backtest(strategyIdNum, runOptions);

      const jobId = queueRes.data?.jobId;
      if (!jobId) throw new Error('No jobId returned');

      // Poll job status until completed/failed (progress also updates live via WS above)
      const MAX_CONSECUTIVE_POLL_FAILURES = 5;
      let consecutivePollFailures = 0;
      await new Promise<void>((resolve, reject) => {
        const poll = setInterval(async () => {
          try {
            const res = await strategiesApi.backtestJobStatus(jobId);
            const job = res.data;
            consecutivePollFailures = 0;

            if (job.status === 'active' && typeof job.progress === 'number') {
              setProgress((p) => Math.max(p, Number(job.progress) || 0));
            }

            if (job.status === 'completed') {
              clearInterval(poll);
              pollRef.current = null;
              setProgress(100);
              setStatusText(language === 'ru' ? '✅ Завершено!' : '✅ Complete!');
              setResult(job.result);
              setRunning(false);
              setHistoryReload((k) => k + 1);
              resolve();
            }

            if (job.status === 'failed') {
              clearInterval(poll);
              pollRef.current = null;
              reject(new Error(job.error || 'Backtest failed'));
            }
          } catch (e) {
            consecutivePollFailures += 1;
            if (consecutivePollFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
              clearInterval(poll);
              pollRef.current = null;
              reject(new Error(language === 'ru' ? 'Потеряна связь с сервером во время бэктеста' : 'Lost connection to server during backtest'));
            }
            // else: transient poll error — keep trying
          }
        }, 2000);
        pollRef.current = poll;
      });
    } catch (e: any) {
      setRunning(false);
      toast.error(e.message || (language === 'ru' ? 'Ошибка при запуске бэктеста' : 'Failed to start backtest'));
    } finally {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      socketRef.current?.disconnect();
      socketRef.current = null;
    }
  };

  const handleOptimize = async () => {
    if (!selectedStrategyId || selectedParams.length === 0) return;
    setIsOptimizing(true);
    setOptResults([]);
    setChartTab('optimization');
    setOptProgress(0);
    setOptGeneration(1);

    const interval = setInterval(() => {
      setOptProgress((prev) => {
        if (prev >= 98) {
          clearInterval(interval);
          return 98;
        }
        const next = prev + Math.floor(Math.random() * 4) + 1;
        setOptGeneration(Math.min(5, Math.floor(next / 20) + 1));
        return next;
      });
    }, 200);

    try {
      const res = await optimizerApi.run(Number(selectedStrategyId), {
        start: form.start,
        end: form.end,
        initialBalance: form.initialBalance,
        fee: form.feePercent / 100,
        tp: form.tpPercent / 100,
        sl: form.slPercent / 100,
        positionSize: form.positionSizePercent / 100,
        useTrailingStop: form.useTrailingStop,
        trailingDistance: form.trailingDistance / 100,
        trailingActivation: form.trailingActivation / 100,
        userLevels,
      }, selectedParams);
      setOptResults(res.data);
      setOptProgress(100);
      toast.success(language === 'ru' ? 'Оптимизация завершена!' : 'Optimization completed!');
    } catch (e) {
      toast.error(language === 'ru' ? 'Ошибка при запуске оптимизации' : 'Failed to optimize parameters');
    } finally {
      clearInterval(interval);
      setIsOptimizing(false);
    }
  };

  const handleApplyParams = async (bestParams: Record<string, any>) => {
    const s = strategies.find((st) => st.id.toString() === selectedStrategyId);
    if (!s) return;

    const newAst = JSON.parse(JSON.stringify(s.ast));
    const traverseNode = (n: any) => {
      if (!n || typeof n !== 'object') return;
      if (n.type === 'indicator' && n.params) {
        Object.entries(n.params).forEach(([k, v]) => {
          const key = `${n.id}:${k}`;
          if (bestParams[key] !== undefined) {
            n.params[k] = bestParams[key];
          }
        });
      }
      if (n.condition) traverseNode(n.condition);
      if (n.left) traverseNode(n.left);
      if (n.right) traverseNode(n.right);
      if (n.operands) n.operands.forEach(traverseNode);
      if (n.a) traverseNode(n.a);
      if (n.b) traverseNode(n.b);
    };
    traverseNode(newAst);

    try {
      await strategiesApi.update(Number(selectedStrategyId), { ast: newAst });
      toast.success(language === 'ru' ? 'Параметры успешно применены!' : 'Parameters applied successfully!');
      useNotificationStore.getState().addNotification(
        language === 'ru' ? 'Оптимизатор' : 'Optimizer',
        language === 'ru' ? `Применены новые параметры для "${s.name}".` : `Applied new parameters for "${s.name}".`,
        'success',
      );
      setStrategies(strategies.map((st) => (st.id.toString() === selectedStrategyId ? { ...st, ast: newAst } : st)));
    } catch (e) {
      toast.error(language === 'ru' ? 'Ошибка при сохранении параметров' : 'Failed to save parameters');
    }
  };

  const onTradeSelect = (idx: number) => {
    setActiveTradeIdx(idx);
    setChartTab('price'); // существующее поведение: клик по сделке → разбор на графике цены
  };

  const overlaySeries = useMemo(() => overlays.map((o, i) => ({
    label: o.label, color: OVERLAY_COLORS[i], points: o.result.equityCurve || [],
  })), [overlays]);

  // Отличия опций отображаемого прогона от сравниваемого (обе стороны — реальные опции запуска,
  // а не текущая форма: её можно поменять без перезапуска, и diff начал бы врать)
  const compareOptionsDiff = useMemo(() => {
    if (!compareRun || !activeRunOptions) return '';
    const o = (compareRun as any).options || {};
    const a = activeRunOptions;
    const diffs: string[] = [];
    if (o.tp != null && a.tp != null && Math.abs(o.tp - a.tp) > 1e-9) diffs.push(`TP ${(a.tp * 100).toFixed(1)}%→${(o.tp * 100).toFixed(1)}%`);
    if (o.sl != null && a.sl != null && Math.abs(o.sl - a.sl) > 1e-9) diffs.push(`SL ${(a.sl * 100).toFixed(1)}%→${(o.sl * 100).toFixed(1)}%`);
    if (!!o.accurate !== !!a.accurate) diffs.push(`accurate ${a.accurate ? 'on' : 'off'}→${o.accurate ? 'on' : 'off'}`);
    if ((o.executionAlgo || 'MARKET') !== (a.executionAlgo || 'MARKET')) diffs.push(`algo ${a.executionAlgo || 'MARKET'}→${o.executionAlgo || 'MARKET'}`);
    return diffs.join(' · ');
  }, [compareRun, activeRunOptions]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1400, margin: '0 auto' }}>
      <RunPanel
        strategies={strategies}
        selectedStrategyId={selectedStrategyId}
        onSelectStrategy={setSelectedStrategyId}
        form={form}
        setForm={setForm}
        running={running}
        progress={progress}
        statusText={statusText}
        onRun={runBacktest}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {result && (
        <>
          <KpiStrip result={result} compareResult={compareRun?.result || null} />
          {compareRun && (
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              ⇄ сравнение с прогоном #{compareRun.id} {compareOptionsDiff && `· отличия: ${compareOptionsDiff}`}
              <span style={{ color: '#79c0ff', cursor: 'pointer', marginLeft: 8 }} onClick={() => setCompareRun(null)}>снять</span>
            </div>
          )}

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11, fontWeight: 700 }}>
              {([['equity', 'Equity / Drawdown'], ['price', 'График цены'], ['optimization', 'Оптимизация']] as const).map(([k, l]) => (
                <span key={k} onClick={() => setChartTab(k)} style={{
                  cursor: 'pointer', paddingBottom: 3,
                  color: chartTab === k ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: chartTab === k ? '2px solid #2962ff' : '2px solid transparent',
                }}>{l}</span>
              ))}
            </div>
            {chartTab === 'equity' && (
              <EquityChart equityCurve={result.equityCurve || []} benchmark={result.benchmark}
                overlays={overlaySeries} trades={result.trades} onTradeDotClick={onTradeSelect} activeTradeIdx={activeTradeIdx} />
            )}
            {chartTab === 'price' && (
              <PriceChartTab
                result={result}
                selectedTradeIndex={activeTradeIdx}
                setSelectedTradeIndex={setActiveTradeIdx}
                language={language}
                t={t}
              />
            )}
            {chartTab === 'optimization' && (
              <OptimizationTab
                optimizableParams={optimizableParams}
                selectedParams={selectedParams}
                setSelectedParams={setSelectedParams}
                optResults={optResults}
                isOptimizing={isOptimizing}
                optProgress={optProgress}
                optGeneration={optGeneration}
                handleApplyParams={handleApplyParams}
                language={language}
                t={t}
              />
            )}
          </div>

          <DistributionsRow trades={result.trades || []} />
          <TradesTable trades={result.trades || []} activeIdx={activeTradeIdx} onRowClick={onTradeSelect} />
        </>
      )}

      {!result && !running && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 60, fontSize: 13 }}>
          Выбери стратегию и нажми «▶ Запустить» — здесь появится полный отчёт
        </div>
      )}

      <RunHistoryDrawer open={historyOpen} strategyId={selectedStrategyId ? Number(selectedStrategyId) : null} reloadKey={historyReload}
        onClose={() => setHistoryOpen(false)}
        overlayRunIds={overlays.map((o) => o.id)}
        onToggleOverlay={(id, full) => setOverlays((os) => (full ? [...os, full] : os.filter((o) => o.id !== id)))}
        onCompare={setCompareRun} />
    </div>
  );
};

export default Backtest;
