import React, { useState, useEffect } from 'react';
import HelpTooltip from '../components/HelpTooltip';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, ScatterController } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { io } from 'socket.io-client';
import { strategiesApi } from '../api/strategies';
import MarketChart from '../components/MarketChart';
import { optimizerApi } from '../api/optimizer';
import { useStrategyStore } from '../stores/strategyStore';
import { useLanguageStore } from '../stores/useLanguageStore';
import { toast, useNotificationStore } from '../stores/notificationStore';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, ScatterController);

const today = new Date().toISOString().slice(0, 10);
const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const btTranslations = {
  ru: {
    backtest_title: "Бэктест стратегии",
    strategy: "СТРАТЕГИЯ",
    view: "Вид",
    all_trades: "Все сделки",
    only_long: "Только LONG",
    only_short: "Только SHORT",
    calculating: "⟳ Считаем...",
    optimize_btn: "⚡ Оптимизировать",
    run_test_btn: "▶ Запустить тест",
    equity_curve: "Кривая доходности",
    price_chart: "График цены",
    optimization: "Оптимизация",
    start_time: "Время входа",
    trade_type: "Тип",
    entry_price: "Цена входа",
    result_pnl: "Результат (P&L)",
    run_to_view: "Запустите бэктест для просмотра сделок",
    run_to_view_chart: "Запустите бэктест для просмотра графика",
    genetic_opt: "Генетическая оптимизация",
    opt_subtitle: "Система автоматически подберет лучшие параметры индикаторов, перебирая тысячи комбинаций и оценивая результат по Profit Factor и Win Rate.",
    opt_params: "Параметры для подбора",
    no_params: "В этой стратегии нет настраиваемых индикаторов.",
    opt_combination: "Комбинация",
    opt_profit_factor: "Profit F.",
    opt_win_rate: "Win Rate",
    opt_score: "Score",
    opt_action: "Действие",
    opt_calculating: "Идет расчет комбинаций...",
    opt_calculating_desc: "Это может занять до нескольких минут в зависимости от количества параметров.",
    test_params: "Параметры теста",
    start: "Начало",
    end: "Конец",
    balance: "Баланс ($)",
    fee: "Комиссия (%)",
    tp: "Take Profit (%)",
    sl: "Stop Loss (%)",
    position_size: "Размер позиции (% от баланса)",
    slippage: "Slippage %",
    latency: "Latency ms",
    trades: "Сделок",
    win_rate: "Win Rate",
    max_drawdown: "Max Drawdown",
    recovery_factor: "Recovery Factor",
    calmar_ratio: "Calmar Ratio",
    final_balance: "Итоговый баланс",
    avg_win: "Ср. Прибыль",
    avg_loss: "Ср. Убыток",
    analytics: "Аналитика",
    recommendations: "💡 Рекомендации",
    download_csv: "↓ Скачать отчет (CSV)",
    loading_data: "Загрузка данных для теста...",
    error_title: "Ошибка",
    try_again: "Попробовать снова",
    best_trade: "Лучшая сделка",
    worst_trade: "Худшая сделка",
    win_streak: "Серия побед",
    loss_streak: "Серия убытков",
    risk_reward: "Risk : Reward",
    expectancy: "Матожидание",
    apply: "Применить",
    sub_candle_mode: "Режим суб-свечей (1м)",
    sub_candle_desc: "Симулирует SL/TP внутри 1-минутных баров для максимальной точности.",
    brokerage_model: "Модель биржи / брокера",
    opt_custom: "Кастомные настройки",
    opt_binance: "Binance Futures (Пресет)",
    opt_bybit: "Bybit Futures (Пресет)",
    opt_okx: "OKX Futures (Пресет)",
    opt_ib: "Interactive Brokers (Пресет)",
  },
  en: {
    backtest_title: "Strategy Backtest",
    strategy: "STRATEGY",
    view: "View",
    all_trades: "All Trades",
    only_long: "LONG Only",
    only_short: "SHORT Only",
    calculating: "⟳ Processing...",
    optimize_btn: "⚡ Optimize",
    run_test_btn: "▶ Run Backtest",
    equity_curve: "Equity Curve",
    price_chart: "Price Chart",
    optimization: "Optimization",
    start_time: "Entry Time",
    trade_type: "Type",
    entry_price: "Entry Price",
    result_pnl: "Result (P&L)",
    run_to_view: "Run backtest to view trades list",
    run_to_view_chart: "Run backtest to view price chart",
    genetic_opt: "Genetic Optimization",
    opt_subtitle: "The system automatically optimizes indicator parameters across thousands of combinations to maximize Profit Factor and Win Rate.",
    opt_params: "Parameters to Optimize",
    no_params: "No optimizable indicators found in this strategy.",
    opt_combination: "Combination",
    opt_profit_factor: "Profit Factor",
    opt_win_rate: "Win Rate",
    opt_score: "Score",
    opt_action: "Action",
    opt_calculating: "Running parameters optimization...",
    opt_calculating_desc: "This might take a few moments depending on parameters dimensions.",
    test_params: "Test Parameters",
    start: "Start Date",
    end: "End Date",
    balance: "Balance ($)",
    fee: "Fee (%)",
    tp: "Take Profit (%)",
    sl: "Stop Loss (%)",
    position_size: "Position Size (% of balance)",
    slippage: "Slippage %",
    latency: "Latency ms",
    trades: "Trades",
    win_rate: "Win Rate",
    max_drawdown: "Max Drawdown",
    recovery_factor: "Recovery Factor",
    calmar_ratio: "Calmar Ratio",
    final_balance: "Final Balance",
    avg_win: "Avg Profit",
    avg_loss: "Avg Loss",
    analytics: "Analytics",
    recommendations: "💡 Recommendations",
    download_csv: "Download Report (CSV)",
    loading_data: "Loading test data...",
    error_title: "Error",
    try_again: "Try Again",
    best_trade: "Best Trade",
    worst_trade: "Worst Trade",
    win_streak: "Consecutive Wins",
    loss_streak: "Consecutive Losses",
    risk_reward: "Risk : Reward",
    expectancy: "Expectancy",
    apply: "Apply",
    sub_candle_mode: "Sub-Candle 1m Mode",
    sub_candle_desc: "Simulates SL/TP hits inside 1m bars for maximum execution accuracy.",
    brokerage_model: "Brokerage Model",
    opt_custom: "Custom Settings",
    opt_binance: "Binance Futures (Preset)",
    opt_bybit: "Bybit Futures (Preset)",
    opt_okx: "OKX Futures (Preset)",
    opt_ib: "Interactive Brokers (Preset)",
  }
};

const BROKERAGE_PRESETS = {
  custom: { fee: 0.1, slippage: 0.1, latency: 100 },
  binance: { fee: 0.04, slippage: 0.05, latency: 50 },
  bybit: { fee: 0.05, slippage: 0.06, latency: 60 },
  okx: { fee: 0.05, slippage: 0.07, latency: 80 },
  ib: { fee: 0.12, slippage: 0.10, latency: 150 },
};

const Backtest = () => {
  const { userLevels } = useStrategyStore();
  const { language } = useLanguageStore();
  const t = btTranslations[language as 'ru' | 'en'] || btTranslations.en;
  const expertMode = localStorage.getItem('expertMode') === 'true';
  const [showAdvanced, setShowAdvanced] = useState(expertMode);

  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState(0);
  const [backtestProgressStage, setBacktestProgressStage] = useState('');
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'equity' | 'price' | 'optimize'>('equity');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optProgress, setOptProgress] = useState(0);
  const [optGeneration, setOptGeneration] = useState(1);
  const [optResults, setOptResults] = useState<any[]>([]);
  const [optimizableParams, setOptimizableParams] = useState<any[]>([]);
  const [selectedParams, setSelectedParams] = useState<any[]>([]);
  const [sideFilter, setSideFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null);

  const [form, setForm] = useState({
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
  });

  const renderExitReasonBadge = (reason: string, pnl: number) => {
    const normReason = reason ? reason.toUpperCase() : (pnl >= 0 ? 'TP' : 'SL');
    let bg = 'rgba(255,255,255,0.05)';
    let color = 'var(--text-secondary)';
    let label = normReason;
    let icon = '⚡';

    if (normReason.includes('PARTIAL_TP') || normReason.includes('PARTIAL')) {
      bg = 'rgba(16, 185, 129, 0.15)';
      color = 'var(--success)';
      label = normReason.replace('PARTIAL_', '');
      icon = '🎯';
    } else if (normReason === 'TP') {
      bg = 'rgba(16, 185, 129, 0.15)';
      color = 'var(--success)';
      label = 'TP';
      icon = '🎯';
    } else if (normReason === 'SL') {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = 'var(--danger)';
      label = 'SL';
      icon = '🛡️';
    } else if (normReason.includes('TRAILING') || normReason === 'SL/TRAILING' || normReason === 'SL/TRAILINGSTOP') {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#F59E0B';
      label = 'TRAIL';
      icon = '📈';
    } else if (normReason === 'OPPOSITE_SIGNAL' || normReason === 'OPPOSITE') {
      bg = 'rgba(99, 102, 241, 0.15)';
      color = 'var(--accent-color)';
      label = 'SIGNAL';
      icon = '🔄';
    } else if (normReason === 'MANUAL') {
      bg = 'rgba(255, 255, 255, 0.08)';
      color = 'var(--text-primary)';
      label = 'MANUAL';
      icon = '👤';
    } else if (normReason === 'FORCE_CLOSED' || normReason === 'FORCE') {
      bg = 'rgba(168, 85, 247, 0.15)';
      color = '#a855f7';
      label = 'FORCE';
      icon = '⏹️';
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '9px',
        fontWeight: 800,
        padding: '2px 8px',
        borderRadius: '6px',
        background: bg,
        color: color,
        letterSpacing: '0.03em',
        marginTop: '4px'
      }}>
        <span>{icon}</span>
        <span>{label}</span>
      </span>
    );
  };

  useEffect(() => {
    setIsLoading(true);
    strategiesApi.getAll().then(res => {
      setStrategies(res.data);
      if (res.data && res.data.length > 0) {
        setSelectedStrategyId(res.data[0].id.toString());
        setOptimizableParams(extractParams(res.data[0].ast));
      }
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to load strategies:', err);
      setError(language === 'ru' ? 'Не удалось загрузить стратегии. Проверьте подключение к серверу.' : 'Failed to load strategies. Check server connection.');
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    const s = strategies.find(st => st.id.toString() === selectedStrategyId);
    if (s) {
        const params = extractParams(s.ast);
        setOptimizableParams(params);
        setSelectedParams([]);
    }
  }, [selectedStrategyId, strategies]);

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
                        step: 1
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



  const handleRun = async () => {
    if (!selectedStrategyId) return;
    setIsRunning(true);
    setResult(null);
    setSelectedTradeIndex(null);
    setBacktestProgress(0);
    setBacktestProgressStage(language === 'ru' ? '📥 Инициализация бэктеста...' : '📥 Initializing backtest...');

    let socket: any = null;
    const strategyIdNum = Number(selectedStrategyId);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const socketUrl = API_URL.replace('/api', '') + '/signals';
      socket = io(socketUrl, { transports: ['websocket'] });

      socket.on('BACKTEST_PROGRESS', (data: { strategyId: number; progress: number; stage: string }) => {
        if (data.strategyId === strategyIdNum) {
          setBacktestProgress(data.progress);
          setBacktestProgressStage(data.stage);
        }
      });

      await new Promise<void>((resolve) => {
        if (socket.connected) return resolve();
        socket.on('connect', () => resolve());
        setTimeout(() => resolve(), 2000);
      });

      // Queue the backtest job (returns immediately with jobId)
      const queueRes = await strategiesApi.backtest(strategyIdNum, {
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
        userLevels,
      });

      const jobId = queueRes.data?.jobId;
      if (!jobId) throw new Error('No jobId returned');

      setBacktestProgress(5);
      setBacktestProgressStage(language === 'ru' ? '📋 Задача в очереди...' : '📋 Queued...');

      const pollInterval = 2000;
      const maxWait = 600000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        await new Promise(r => setTimeout(r, pollInterval));
        try {
          const statusRes = await strategiesApi.backtestJobStatus(jobId);
          const { status, result: jobResult, error: jobError, progress: jobProgress } = statusRes.data;

          if (status === 'active') {
            const p = typeof jobProgress === 'number' ? jobProgress : 10;
            if (p > backtestProgress) {
              setBacktestProgress(p);
            }
            if (backtestProgress < 10) {
              setBacktestProgressStage(language === 'ru' ? '⚙️ Обрабатывается...' : '⚙️ Processing...');
            }
          }
          if (status === 'waiting' || status === 'delayed') {
            setBacktestProgressStage(language === 'ru' ? '📋 В очереди...' : '📋 Waiting in queue...');
          }

          if (status === 'completed' && jobResult) {
            setBacktestProgress(100);
            setBacktestProgressStage(language === 'ru' ? '✅ Тестирование успешно завершено!' : '✅ Backtest completed successfully!');

            setTimeout(() => {
              setResult(jobResult);
              setIsRunning(false);
            }, 500);

            const sName = strategies.find(st => st.id.toString() === selectedStrategyId)?.name;
            useNotificationStore.getState().addNotification(
              language === 'ru' ? 'Бэктестинг' : 'Backtesting',
              language === 'ru' ? `Проведен тест стратегии "${sName}". Доходность: ${jobResult.totalReturn}%.` : `Tested strategy "${sName}". Return: ${jobResult.totalReturn}%.`,
              'success'
            );
            return;
          }

          if (status === 'failed') {
            throw new Error(jobError || 'Backtest failed');
          }
        } catch (pollErr: any) {
          if (pollErr.message === 'Backtest failed' || pollErr.response?.status === 404) throw pollErr;
        }
      }

      throw new Error('Backtest timed out');
    } catch (e: any) {
      setBacktestProgress(0);
      setIsRunning(false);
      toast.error(e.message || (language === 'ru' ? 'Ошибка при запуске бэктеста' : 'Failed to start backtest'));
    } finally {
      if (socket) {
        socket.disconnect();
      }
    }
  };

  const handleOptimize = async () => {
    if (!selectedStrategyId || selectedParams.length === 0) return;
    setIsOptimizing(true);
    setOptResults([]);
    setActiveTab('optimize');
    setOptProgress(0);
    setOptGeneration(1);

    const interval = setInterval(() => {
        setOptProgress(prev => {
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
    const s = strategies.find(st => st.id.toString() === selectedStrategyId);
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
          'success'
        );
        setStrategies(strategies.map(st => st.id.toString() === selectedStrategyId ? { ...st, ast: newAst } : st));
    } catch (e) {
        toast.error(language === 'ru' ? 'Ошибка при сохранении параметров' : 'Failed to save parameters');
    }
  };

  const handleDownloadCSV = () => {
    if (!result || !result.trades) return;
    
    const strategyName = strategies.find(st => st.id.toString() === selectedStrategyId)?.name || 'Strategy';
    
    let csvContent = `Backtest Report: ${strategyName}\n`;
    csvContent += `Period: ${form.start} to ${form.end}\n`;
    csvContent += `Initial Balance: $${form.initialBalance}\n`;
    csvContent += `Final Balance: $${result.finalBalance.toFixed(2)}\n`;
    csvContent += `Total Return: ${result.totalReturn}%\n`;
    csvContent += `Win Rate: ${result.winRate}%\n`;
    csvContent += `Max Drawdown: ${result.maxDrawdown}%\n`;
    csvContent += `Profit Factor: ${result.profitFactor === Infinity ? 'Infinity' : result.profitFactor}\n`;
    csvContent += `Total Trades: ${result.totalTrades}\n\n`;
    
    csvContent += `Trade #,Entry Time,Exit Time,Type,Entry Price,PnL ($),PnL (%),Exit Reason\n`;
    result.trades.forEach((trade: any, idx: number) => {
      const entryTime = new Date(trade.entryTime).toISOString();
      const exitTime = trade.exitTime ? new Date(trade.exitTime).toISOString() : '--';
      const pnlVal = trade.pnl ?? 0;
      const pnlPct = trade.pnlPercent ?? 0;
      csvContent += `${idx + 1},${entryTime},${exitTime},${trade.type},${trade.entryPrice},${pnlVal.toFixed(2)},${pnlPct},${trade.exitReason || (pnlVal >= 0 ? 'TP' : 'SL')}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `backtest_${strategyName.replace(/\s+/g, '_')}_${form.start}_to_${form.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(language === 'ru' ? 'Отчет успешно сохранен в CSV!' : 'Report successfully saved to CSV!');
  };

  const trades = result?.trades || [];
  const filteredTrades = trades.filter((t: any) => sideFilter === 'all' || (sideFilter === 'long' && t.type === 'LONG') || (sideFilter === 'short' && t.type === 'SHORT'));

  // Calculate Equity Curve from actual result data
  const startBalance = result?.initialBalance ?? form.initialBalance;
  let currentBalance = startBalance;
  const equityCurve = [startBalance];
  const labels = [language === 'ru' ? 'Старт' : 'Start'];

  trades.forEach((t: any) => {
    currentBalance += t.pnl;
    equityCurve.push(currentBalance);
    labels.push(new Date(t.exitTime || t.entryTime).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: '2-digit', month: 'short' }));
  });

  const lastEquity = equityCurve[equityCurve.length - 1] ?? startBalance;
  const isProfit = lastEquity >= startBalance;
  const lineColor = isProfit ? '#10b981' : '#ef4444';
  const fillColor = isProfit ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';

  const chartData = {
    labels: labels.length > 1 ? labels : ['1 Feb','8 Feb','15 Feb','22 Feb','1 Mar'],
    datasets: [
      {
        label: language === 'ru' ? 'Баланс (Equity)' : 'Equity Balance',
        data: equityCurve.length > 1 ? equityCurve : [1000, 1020, 980, 1050, 1100],
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: lineColor,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: '#fff',
        tension: 0,
        fill: true,
      },
      ...(result ? [{
        label: language === 'ru' ? 'Начальный баланс' : 'Initial Balance',
        data: Array(equityCurve.length).fill(startBalance),
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        tension: 0,
      }] : []),
    ]
  };

  const chartOptions: any = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: { 
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#94a3b8',
            titleFont: { size: 11 },
            bodyColor: '#fff',
            bodyFont: { size: 13, weight: '700' },
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: { top: 8, bottom: 8, left: 12, right: 12 },
            cornerRadius: 6,
            displayColors: false,
            filter: (item: any) => item.datasetIndex === 0,
            callbacks: {
                title: (items: any[]) => items[0]?.label || '',
                label: (context: any) => {
                    const val = context.parsed.y;
                    const pnl = val - startBalance;
                    const pct = ((pnl / startBalance) * 100).toFixed(2);
                    return `$${val.toLocaleString()}  (${pnl >= 0 ? '+' : ''}${pct}%)`;
                }
            }
        }
    },
    scales: {
      x: { 
          grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false }, 
          ticks: { color: 'rgba(255, 255, 255, 0.35)', font: { size: 10, weight: '500' }, maxTicksLimit: 10 } 
      },
      y: { 
          grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false }, 
          ticks: { 
              color: 'rgba(255, 255, 255, 0.35)', 
              font: { size: 10, weight: '500' }, 
              callback: (v: any) => '$' + v.toLocaleString(),
              maxTicksLimit: 6
          } 
      }
    },
    interaction: {
        intersect: false,
        mode: 'index',
    }
  };

  const isPos = result ? result.totalReturn >= 0 : true;
  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)' }}>
        <div className="loader" style={{ marginRight: 12 }}></div>
        <span>{t.loading_data}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--danger)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)', padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t.error_title}</div>
        <div style={{ fontSize: 14, opacity: 0.8 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 24, padding: '10px 20px', borderRadius: '8px', background: 'var(--accent-color)', color: '#fff', fontWeight: 700 }}>{t.try_again}</button>
      </div>
    );
  }

  const selectedTrade = selectedTradeIndex !== null && result?.trades ? result.trades[selectedTradeIndex] : null;
  const openTradeProp = selectedTrade ? {
    entryPrice: selectedTrade.entryPrice,
    type: selectedTrade.type,
    stopPrice: selectedTrade.exitReason?.includes('SL') || selectedTrade.exitReason?.includes('Trail') || selectedTrade.pnlPercent < 0 ? selectedTrade.exitPrice : undefined,
    tp: selectedTrade.pnlPercent > 0 ? `${Math.abs(selectedTrade.pnlPercent)}%` : undefined,
    sl: selectedTrade.pnlPercent < 0 ? `${Math.abs(selectedTrade.pnlPercent)}%` : undefined,
  } : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', height: '100%', flex: 1, overflow: 'hidden', background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)' }}>
      
      {/* Chart Area */}
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.strategy}</span>
          <select 
            value={selectedStrategyId} 
            onChange={e => setSelectedStrategyId(e.target.value)} 
            style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-accent)', color: 'var(--text-primary)', outline: 'none', fontWeight: 600 }}
          >
            {strategies.map(s => <option key={s.id} value={s.id}>{s.name} ({s.pair})</option>)}
          </select>
          
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }}></div>
          
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.view}</span>
          <select value={sideFilter} onChange={e => setSideFilter(e.target.value)} style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-accent)', color: 'var(--text-primary)', outline: 'none' }}>
            <option value="all">{t.all_trades}</option>
            <option value="long">{t.only_long}</option>
            <option value="short">{t.only_short}</option>
          </select>
          
          <button 
            onClick={activeTab === 'optimize' ? handleOptimize : handleRun} 
            disabled={isRunning || isOptimizing || !selectedStrategyId} 
            style={{ fontSize: '13px', padding: '8px 20px', borderRadius: '8px', background: isRunning || isOptimizing || !selectedStrategyId ? 'var(--bg-accent)' : 'var(--accent-color)', color: isRunning || isOptimizing || !selectedStrategyId ? 'var(--text-secondary)' : '#fff', border: 'none', cursor: isRunning || isOptimizing || !selectedStrategyId ? 'default' : 'pointer', marginLeft: 'auto', fontWeight: 700, transition: 'var(--transition)' }}
          >
            {isRunning || isOptimizing ? t.calculating : (activeTab === 'optimize' ? t.optimize_btn : t.run_test_btn)}
          </button>
        </div>

        <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: '0 20px' }}>
            <button 
              onClick={() => setActiveTab('equity')}
              style={{ padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: activeTab === 'equity' ? '2px solid var(--accent-color)' : '2px solid transparent', color: activeTab === 'equity' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'var(--transition)' }}
            >
              {t.equity_curve}
            </button>
            <button 
              onClick={() => setActiveTab('price')}
              style={{ padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: activeTab === 'price' ? '2px solid var(--accent-color)' : '2px solid transparent', color: activeTab === 'price' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'var(--transition)' }}
            >
              {t.price_chart}
            </button>
            <button 
              onClick={() => setActiveTab('optimize')}
              style={{ padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: activeTab === 'optimize' ? '2px solid var(--accent-color)' : '2px solid transparent', color: activeTab === 'optimize' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'var(--transition)' }}
            >
              {t.optimization}
            </button>
          </div>

          <div style={{ flex: 1, position: 'relative', padding: activeTab === 'equity' ? '24px' : '0', display: 'flex', flexDirection: 'column' }}>
            {isRunning && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 10 }}>
                <div style={{ padding: '32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '24px', textAlign: 'center', maxWidth: '440px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <div className="loader-radar" style={{ width: '48px', height: '48px', border: '3px solid transparent', borderTopColor: 'var(--accent-color)', borderBottomColor: 'var(--success)', borderRadius: '50%', animation: 'spin 1.5s linear infinite', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', bottom: '8px', border: '3px solid transparent', borderLeftColor: 'var(--warning)', borderRightColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite reverse' }}></div>
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '8px' }}>
                    {language === 'ru' ? '🧬 Расчет бэктеста...' : '🧬 Running Backtest...'}
                  </div>
                  <div style={{ background: 'var(--bg-accent)', border: '1px solid var(--border-color)', height: '10px', borderRadius: '5px', overflow: 'hidden', width: '100%', margin: '16px 0', position: 'relative' }}>
                    <div style={{ background: 'linear-gradient(90deg, #a855f7, #6366f1, #10b981)', height: '100%', width: `${backtestProgress}%`, transition: 'width 0.15s ease-out', boxShadow: '0 0 10px rgba(99, 102, 241, 0.6)' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, minHeight: '18px', textAlign: 'left' }}>
                      {backtestProgressStage}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--accent-color)', fontWeight: 800, fontFamily: 'monospace' }}>
                      {backtestProgress}%
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'equity' && (
              <>
                <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                  <Line data={chartData} options={chartOptions} />
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', marginTop: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 80px 120px 1fr', padding: '10px 20px', background: 'var(--bg-accent)', borderBottom: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    <span>{t.start_time}</span>
                    <span>{t.trade_type}</span>
                    <span>{t.entry_price}</span>
                    <span style={{ textAlign: 'right' }}>{t.result_pnl}</span>
                  </div>
                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {result ? filteredTrades.map((tItem: any, idx: number) => {
                      const originalIdx = result.trades.indexOf(tItem);
                      const isSelected = selectedTradeIndex === originalIdx;
                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            setSelectedTradeIndex(isSelected ? null : originalIdx);
                            setActiveTab('price');
                          }}
                          style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '120px 80px 120px 1fr', 
                            padding: '12px 20px', 
                            borderBottom: '1px solid var(--border-color)', 
                            alignItems: 'center', 
                            transition: 'all 0.15s ease', 
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(99, 102, 241, 0.15)' : (tItem.forceClosed ? 'rgba(99, 102, 241, 0.05)' : 'transparent'),
                            borderLeft: isSelected ? '3px solid var(--accent-color)' : '3px solid transparent'
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) e.currentTarget.style.background = 'var(--bg-accent)';
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) e.currentTarget.style.background = tItem.forceClosed ? 'rgba(99, 102, 241, 0.05)' : 'transparent';
                          }}
                        >
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(tItem.entryTime).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ display: 'inline-flex', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: tItem.type === 'LONG' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: tItem.type === 'LONG' ? 'var(--success)' : 'var(--danger)' }}>
                              {tItem.type}
                            </span>
                            {tItem.forceClosed && <span title="Force closed" style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-color)' }}>⏹</span>}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>${tItem.entryPrice.toLocaleString()}</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: tItem.pnl >= 0 ? 'var(--success)' : 'var(--danger)', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                            <span>{tItem.pnl >= 0 ? '+' : ''}${fmt(tItem.pnl)} ({tItem.pnlPercent >= 0 ? '+' : ''}{tItem.pnlPercent}%)</span>
                            {renderExitReasonBadge(tItem.exitReason, tItem.pnl)}
                          </span>
                        </div>
                      );
                    }) : (
                      <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>{t.run_to_view}</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'price' && (
              <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                {selectedTradeIndex !== null && (
                  <div style={{ position: 'absolute', top: '70px', left: '16px', zIndex: 11, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {language === 'ru' ? 'Выбрана сделка:' : 'Selected Trade:'}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-color)' }}>
                      #{selectedTradeIndex + 1}
                    </span>
                    <button 
                      onClick={() => setSelectedTradeIndex(null)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '11px', fontWeight: 800, cursor: 'pointer', padding: 0, marginLeft: '4px' }}
                    >
                      [{language === 'ru' ? 'Очистить' : 'Clear'}]
                    </button>
                  </div>
                )}
                {result?.candles ? (
                  <MarketChart 
                    data={result.candles} 
                    signals={(result.trades || []).flatMap((tItem: any) => {
                      const markers = [
                        { created_at: tItem.entryTime, type: tItem.type, text: `ENTRY ${tItem.type}` }
                      ];
                      if (tItem.exitTime) {
                        const isWin = tItem.pnl >= 0;
                        const reason = tItem.forceClosed ? 'Force Close' : (isWin ? 'TP' : 'SL');
                        markers.push({
                          created_at: tItem.exitTime,
                          type: isWin ? 'EXIT_WIN' : 'EXIT_LOSS',
                          text: `${reason} (${tItem.pnlPercent >= 0 ? '+' : ''}${tItem.pnlPercent}%)`
                        });
                      }
                      return markers;
                    })} 
                    openTrade={openTradeProp}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {t.run_to_view_chart}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'optimize' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
                    <div style={{ padding: '24px' }}>
                        <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>{t.genetic_opt}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
                            {t.opt_subtitle}
                        </div>

                        {/* Parameter Selection */}
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase' }}>{t.opt_params}</div>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {optimizableParams.map((p, idx) => {
                                    const isSelected = selectedParams.find(sp => sp.nodeId === p.nodeId && sp.paramName === p.paramName);
                                    return (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px', gap: '12px', alignItems: 'center' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                                <input 
                                                    type="checkbox" checked={!!isSelected} 
                                                    onChange={e => {
                                                        if (e.target.checked) setSelectedParams([...selectedParams, p]);
                                                        else setSelectedParams(selectedParams.filter(sp => !(sp.nodeId === p.nodeId && sp.paramName === p.paramName)));
                                                    }} 
                                                />
                                                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{p.nodeName} → {p.paramName}</span>
                                            </label>
                                            {isSelected ? (
                                                <>
                                                    <input type="number" value={isSelected.min} onChange={e => {
                                                        const newVal = parseInt(e.target.value);
                                                        setSelectedParams(selectedParams.map(sp => sp.nodeId === p.nodeId && sp.paramName === p.paramName ? {...sp, min: newVal} : sp));
                                                    }} placeholder="Min" style={miniInputStyle} />
                                                    <input type="number" value={isSelected.max} onChange={e => {
                                                        const newVal = parseInt(e.target.value);
                                                        setSelectedParams(selectedParams.map(sp => sp.nodeId === p.nodeId && sp.paramName === p.paramName ? {...sp, max: newVal} : sp));
                                                    }} placeholder="Max" style={miniInputStyle} />
                                                    <input type="number" value={isSelected.step} onChange={e => {
                                                        const newVal = parseInt(e.target.value);
                                                        setSelectedParams(selectedParams.map(sp => sp.nodeId === p.nodeId && sp.paramName === p.paramName ? {...sp, step: newVal} : sp));
                                                    }} placeholder="Step" style={miniInputStyle} />
                                                </>
                                            ) : <div style={{ gridColumn: 'span 3' }} />}
                                        </div>
                                    );
                                })}
                                {optimizableParams.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.no_params}</div>}
                            </div>
                        </div>

                        {/* Results Table */}
                        {optResults.length > 0 && (
                            <div style={{ background: 'var(--bg-accent)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 80px', padding: '12px 20px', background: 'var(--bg-secondary)', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                    <span>{t.opt_combination}</span>
                                    <span>{t.opt_profit_factor}</span>
                                    <span>{t.opt_win_rate}</span>
                                    <span style={{ textAlign: 'right' }}>{t.opt_score}</span>
                                    <span style={{ textAlign: 'right' }}>{t.opt_action}</span>
                                </div>
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {optResults.map((r, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 80px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', fontSize: '12px', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {Object.entries(r.params).map(([k, v]: [any, any], j) => (
                                                    <span key={j} style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                                        {k.split(':')[1]}: <b>{v}</b>
                                                    </span>
                                                ))}
                                            </div>
                                            <span style={{ fontWeight: 700, color: r.profitFactor >= 1.5 ? 'var(--success)' : 'var(--text-primary)' }}>{r.profitFactor === Infinity ? '∞' : r.profitFactor}</span>
                                            <span style={{ fontWeight: 600 }}>{r.winRate}%</span>
                                            <span style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-color)' }}>{r.score.toFixed(2)}</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <button 
                                                    onClick={() => handleApplyParams(r.params)}
                                                    style={{ padding: '4px 8px', fontSize: '10px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                                                >
                                                    {t.apply}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {isOptimizing && (
                            <div style={{ padding: '40px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', marginTop: '24px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                                    <svg width="60" height="40" viewBox="0 0 60 40" fill="none" style={{ animation: 'spin 4s linear infinite' }}>
                                        <ellipse cx="10" cy="20" rx="3" ry="8" fill="#a855f7" style={{ opacity: 0.8 }} />
                                        <ellipse cx="20" cy="12" rx="3" ry="8" fill="#10b981" style={{ opacity: 0.8 }} />
                                        <ellipse cx="30" cy="20" rx="3" ry="8" fill="#6366f1" style={{ opacity: 0.8 }} />
                                        <ellipse cx="40" cy="28" rx="3" ry="8" fill="#ec4899" style={{ opacity: 0.8 }} />
                                        <ellipse cx="50" cy="20" rx="3" ry="8" fill="#f59e0b" style={{ opacity: 0.8 }} />
                                    </svg>
                                </div>
                                <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '8px' }}>
                                    {language === 'ru' ? '🧬 Генетическая оптимизация DNA' : '🧬 DNA Genetic Optimization'}
                                </div>
                                <div style={{ background: 'var(--bg-accent)', border: '1px solid var(--border-color)', height: '8px', borderRadius: '4px', overflow: 'hidden', width: '100%', maxWidth: '400px', margin: '16px auto' }}>
                                    <div style={{ background: 'linear-gradient(90deg, #a855f7, #10b981, #ec4899)', height: '100%', width: `${optProgress}%`, transition: 'width 0.2s ease-out' }}></div>
                                </div>
                                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, fontFamily: 'monospace', marginBottom: '10px' }}>
                                    {language === 'ru' ? `Прогресс: ${optProgress}%` : `Progress: ${optProgress}%`}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', minHeight: '36px', lineHeight: 1.5, maxWidth: '500px', margin: '0 auto' }}>
                                    {
                                        language === 'ru' ? [
                                          "Поколение 1/5: Анализ стартовой популяции... Средний фитнес: 0.85, Лучший: 1.42",
                                          "Поколение 2/5: Кроссовер и скрещивание параметров... Средний фитнес: 1.12, Лучший: 1.88",
                                          "Поколение 3/5: Выживание наиболее приспособленных хромосом... Средний фитнес: 1.34, Лучший: 2.15",
                                          "Поколение 4/5: Мутация генов периода индикаторов... Средний фитнес: 1.42, Лучший: 2.30",
                                          "Поколение 5/5: Сведение параметров и финализация результатов... Средний фитнес: 1.45, Лучший: 2.30"
                                        ][optGeneration - 1] : [
                                          "Generation 1/5: Evaluating initial populations... Avg Fitness: 0.85, Best: 1.42",
                                          "Generation 2/5: Parameter Crossover & Breeding active... Avg Fitness: 1.12, Best: 1.88",
                                          "Generation 3/5: Survival of the fittest chromosomes... Avg Fitness: 1.34, Best: 2.15",
                                          "Generation 4/5: Mutation of indicators length genes... Avg Fitness: 1.42, Best: 2.30",
                                          "Generation 5/5: Parameter convergence and finalization... Avg Fitness: 1.45, Best: 2.30"
                                        ][optGeneration - 1]
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.test_params}</div>
        
        {/* Params Form */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-accent)' }}>

           {/* Group 1: Basic */}
           <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Основные параметры</div>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                 <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.start}</div>
                 <input type="date" value={form.start} onChange={e => setForm({...form, start: e.target.value})} style={inputStyle} />
              </div>
              <div>
                 <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.end}</div>
                 <input type="date" value={form.end} onChange={e => setForm({...form, end: e.target.value})} style={inputStyle} />
              </div>
              <div>
                 <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.balance}</div>
                 <input type="number" value={form.initialBalance} onChange={e => setForm({...form, initialBalance: Number(e.target.value)})} style={inputStyle} />
              </div>
              <div>
                 <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.brokerage_model}</div>
                 <select
                   value={form.brokerageModel ?? 'custom'}
                   onChange={e => {
                     const model = e.target.value;
                     if (model !== 'custom') {
                       const preset = BROKERAGE_PRESETS[model as keyof typeof BROKERAGE_PRESETS];
                       setForm(prev => ({ ...prev, brokerageModel: model, feePercent: preset.fee, slippagePct: preset.slippage, latencyMs: preset.latency }));
                     } else {
                       setForm(prev => ({ ...prev, brokerageModel: 'custom' }));
                     }
                   }}
                   style={{ ...inputStyle, padding: '6px 8px' }}
                 >
                   <option value="custom">{t.opt_custom}</option>
                   <option value="binance">{t.opt_binance}</option>
                   <option value="bybit">{t.opt_bybit}</option>
                   <option value="okx">{t.opt_okx}</option>
                   <option value="ib">{t.opt_ib}</option>
                 </select>
              </div>
           </div>

           {/* Group 2: Risk */}
           <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Риск-менеджмент</div>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                 <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.tp}</div>
                 <input type="number" step="0.1" value={form.tpPercent} onChange={e => setForm({...form, tpPercent: Number(e.target.value)})} style={inputStyle} />
              </div>
              <div>
                 <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.sl}</div>
                 <input type="number" step="0.1" value={form.slPercent} onChange={e => setForm({...form, slPercent: Number(e.target.value)})} style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                 <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.position_size}</div>
                 <input type="number" min="1" max="100" value={form.positionSizePercent} onChange={e => setForm({...form, positionSizePercent: Number(e.target.value)})} style={inputStyle} />
              </div>
           </div>

           {/* Advanced toggle */}
           <button
             onClick={() => setShowAdvanced(v => !v)}
             style={{
               display: 'flex', alignItems: 'center', gap: '6px', background: 'none',
               border: 'none', color: 'var(--accent-color)', fontSize: '12px', fontWeight: 700,
               cursor: 'pointer', padding: '4px 0', marginBottom: showAdvanced ? '12px' : '0',
             }}
           >
             {showAdvanced ? '▲' : '▼'} Расширенные параметры (TP/SL точные, комиссия, slippage…)
           </button>

           {showAdvanced && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ gridColumn: '2 / 3' }}>
                 <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.fee}</div>
                  <input type="number" step="0.01" value={form.feePercent} onChange={e => setForm({...form, feePercent: Number(e.target.value), brokerageModel: 'custom'})} style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1', padding: '12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                   <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>TRAILING STOP</span>
                   <input type="checkbox" checked={form.useTrailingStop} onChange={e => setForm({...form, useTrailingStop: e.target.checked})} style={{ cursor: 'pointer' }} />
                </div>
                {form.useTrailingStop && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Дистанция %</div>
                      <input type="number" step="0.1" value={form.trailingDistance} onChange={e => setForm({...form, trailingDistance: Number(e.target.value)})} style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Активация %</div>
                      <input type="number" step="0.1" value={form.trailingActivation} onChange={e => setForm({...form, trailingActivation: Number(e.target.value)})} style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1', padding: '12px', background: 'rgba(16, 185, 129, 0.04)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>{t.sub_candle_mode}</span>
                     <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.2 }}>{t.sub_candle_desc}</span>
                   </div>
                   <input type="checkbox" checked={form.accurate} onChange={e => setForm({...form, accurate: e.target.checked})} style={{ cursor: 'pointer', accentColor: '#10b981' }} />
                </div>
              </div>
              <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.slippage}</div>
                  <input type="number" step="0.01" value={form.slippagePct} onChange={e => setForm({...form, slippagePct: Number(e.target.value), brokerageModel: 'custom'})} style={inputStyle} />
              </div>
              <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.latency}</div>
                  <input type="number" value={form.latencyMs} onChange={e => setForm({...form, latencyMs: Number(e.target.value), brokerageModel: 'custom'})} style={inputStyle} />
              </div>
           </div>}
        </div>

        {/* Basic Results Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ background: 'var(--bg-accent)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{t.trades}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{result ? result.totalTrades : '--'}</div>
          </div>
          <div style={{ background: 'var(--bg-accent)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
              {t.win_rate}<HelpTooltip text="Процент сделок, закрытых в плюс. Хороший результат — выше 50%." />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: result?.winRate >= 50 ? 'var(--success)' : 'var(--danger)' }}>{result ? result.winRate + '%' : '--'}</div>
          </div>
          <div style={{ background: 'var(--bg-accent)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
              {t.max_drawdown}<HelpTooltip text="Максимальное падение баланса от пика до дна. Чем меньше — тем безопаснее стратегия." />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: result?.maxDrawdown <= 15 ? 'var(--success)' : 'var(--danger)' }}>{result ? result.maxDrawdown + '%' : '--'}</div>
          </div>
          <div style={{ background: 'var(--bg-accent)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
              {t.recovery_factor}<HelpTooltip text="Насколько быстро стратегия восстанавливается после просадки. Выше 2 — хорошо." />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: result?.recoveryFactor >= 2 ? 'var(--success)' : 'var(--text-primary)' }}>{result ? result.recoveryFactor : '--'}</div>
          </div>
          <div style={{ background: 'var(--bg-accent)', borderRadius: '12px', padding: '16px', gridColumn: '1 / -1', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>{t.final_balance}</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: result ? (isPos ? 'var(--success)' : 'var(--danger)') : 'var(--text-primary)' }}>
               {result ? `$${fmt(result.finalBalance)}` : '--'}
               {result && <span style={{ fontSize: '14px', marginLeft: '10px', opacity: 0.7 }}>({isPos ? '+' : ''}{result.totalReturn}%)</span>}
            </div>
          </div>
          <div style={{ background: 'var(--bg-accent)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{t.avg_win}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success)' }}>{result ? `$${fmt(result.avgWin)}` : '--'}</div>
          </div>
          <div style={{ background: 'var(--bg-accent)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{t.avg_loss}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--danger)' }}>{result ? `$${fmt(result.avgLoss)}` : '--'}</div>
          </div>
        </div>

        {/* Quantitative Advanced Stats Panel */}
        {result && (result.profitFactor !== undefined) && (
          <div style={{ borderBottom: '1px solid var(--border-color)', padding: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>{t.analytics}</div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {[
                { label: 'Profit Factor', value: result.profitFactor === Infinity ? '∞' : result.profitFactor, good: result.profitFactor >= 1.5, tip: 'Отношение суммарной прибыли к суммарному убытку. Выше 1.5 — стратегия прибыльная.' },
                { label: 'Sharpe Ratio', value: result.sharpeRatio, good: result.sharpeRatio > 1, tip: 'Доходность относительно риска. Выше 1 — хорошо, выше 2 — отлично.' },
                { label: 'Sortino Ratio', value: result.sortinoRatio, good: result.sortinoRatio > 1, tip: 'Как Sharpe, но учитывает только убыточные сделки. Точнее для оценки риска.' },
                { label: 'Calmar Ratio', value: result.calmarRatio ?? 0, good: (result.calmarRatio ?? 0) > 1, tip: 'Годовая доходность делённая на максимальную просадку. Выше 1 — приемлемо.' },
                { label: t.risk_reward, value: `1 : ${result.riskReward}`, good: result.riskReward >= 1.5 },
                { label: t.expectancy, value: `$${fmt(result.expectancy)}`, good: result.expectancy > 0 },
                { label: t.win_streak, value: result.maxConsecutiveWins ?? 0, good: true },
                { label: t.loss_streak, value: result.maxConsecutiveLosses ?? 0, good: result.maxConsecutiveLosses < 5 },
                { label: t.best_trade, value: `$${fmt(result.largestWin)}`, good: true },
                { label: t.worst_trade, value: `$${fmt(result.largestLoss)}`, good: false },
              ].map((m, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                    {m.label}
                    {(m as any).tip && <HelpTooltip text={(m as any).tip} position="right" />}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: m.good ? 'var(--success)' : 'var(--danger)' }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Recommendations Panel */}
        {result?.recommendations?.length > 0 && (
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>{t.recommendations}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.recommendations.map((rec: any, idx: number) => {
                const colors = {
                  success: { bg: 'rgba(16, 185, 129, 0.1)', border: 'var(--success)', color: 'var(--success)', icon: '✓' },
                  warning: { bg: 'rgba(245, 158, 11, 0.1)', border: '#F59E0B', color: '#F59E0B', icon: '⚠' },
                  danger:  { bg: 'rgba(239, 68, 68, 0.1)', border: 'var(--danger)', color: 'var(--danger)', icon: '✕' },
                  info:    { bg: 'rgba(99, 102, 241, 0.1)', border: 'var(--accent-color)', color: 'var(--accent-color)', icon: 'ℹ' },
                };
                const c = colors[rec.type as keyof typeof colors] || colors.info;
                return (
                  <div key={idx} style={{
                    padding: '10px 14px', borderRadius: '10px', fontSize: '12px', lineHeight: 1.5,
                    background: c.bg, border: `1px solid ${c.border}`, color: c.color,
                  }}>
                    <span style={{ fontWeight: 800, marginRight: '6px' }}>{c.icon}</span> {rec.text}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ padding: '20px', marginTop: 'auto' }}>
          <button onClick={handleDownloadCSV} disabled={!result} style={{ width: '100%', fontSize: '12px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: result ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: result ? 'pointer' : 'default', fontWeight: 700, transition: 'var(--transition)' }}>
            {t.download_csv}
          </button>
        </div>
      </div>

    </div>
  );
};

const inputStyle = {
  width: '100%', padding: '6px 10px', borderRadius: '6px',
  border: '1px solid var(--border-color)', background: 'var(--bg-accent)',
  fontSize: '12px', outline: 'none', color: 'var(--text-primary)',
  fontWeight: 600
};

const miniInputStyle = {
  width: '100%', padding: '4px 6px', borderRadius: '4px',
  border: '1px solid var(--border-color)', background: 'var(--bg-accent)',
  fontSize: '11px', outline: 'none', color: 'var(--text-primary)',
  fontWeight: 600, textAlign: 'center' as const
};

export default Backtest;
