import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { useLanguageStore } from '../stores/useLanguageStore';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { BookOpen, Maximize2, X, Bot, Download, Play } from 'lucide-react';

import Sidebar from '../components/Sidebar';
import PropertiesPanel from '../components/PropertiesPanel';
import StrategyTemplatesModal from '../components/StrategyTemplatesModal';
import InputNode from '../components/nodes/InputNode';
import IndicatorNode from '../components/nodes/IndicatorNode';
import ComparisonNode from '../components/nodes/ComparisonNode';
import SMCNode from '../components/nodes/SMCNode';
import SignalNode from '../components/nodes/SignalNode';
import LogicNode from '../components/nodes/LogicNode';
import TimeFilterNode from '../components/nodes/TimeFilterNode';
import CrossNode from '../components/nodes/CrossNode';
import PumpDumpNode from '../components/nodes/PumpDumpNode';
import ScannerNode from '../components/nodes/ScannerNode';
import AIForecastNode from '../components/nodes/AIForecastNode';
import UserLevelNode from '../components/nodes/UserLevelNode';
import SentimentNode from '../components/nodes/SentimentNode';
import CustomCodeNode from '../components/nodes/CustomCodeNode';
import { MLFilterNode } from '../components/nodes/MLFilterNode';
import HermesNode from '../components/nodes/HermesNode';
import MTFNode from '../components/nodes/MTFNode';
import ExchangeNode from '../components/nodes/ExchangeNode';
import TradeActionNode from '../components/nodes/TradeActionNode';
import WebhookNode from '../components/nodes/WebhookNode';
import PolymarketScannerNode from '../components/nodes/PolymarketScannerNode';
import FinvizScannerNode from '../components/nodes/FinvizScannerNode';
import DeribitPcrNode from '../components/nodes/DeribitPcrNode';
import FusionCombinerNode from '../components/nodes/FusionCombinerNode';
import DeepResearchNode from '../components/nodes/DeepResearchNode';
import PortfolioRiskSizerNode from '../components/nodes/PortfolioRiskSizerNode';
import HeymNode from '../components/nodes/HeymNode';
import McpToolNode from '../components/nodes/McpToolNode';
import { strategiesApi } from '../api/strategies';
import axios from 'axios';
import { PythonPreview } from '../components/PythonPreview';
import { optimizerApi } from '../api/optimizer';
import { candlesApi } from '../api/candles';
import { signalsApi } from '../api/dashboard';
import { toast, useNotificationStore } from '../stores/notificationStore';
import { useDebounce } from '../hooks/useDebounce';
import { TIMEFRAMES } from '../constants/trading';
import { parsePineScript } from '../utils/pineParser';
import MarketChart from '../components/MarketChart';
import { EDGE_COLORS } from '../blocks/registry';
import { useStrategyStore } from '../stores/strategyStore';
import { useUiStore } from '../stores/uiStore';
import { useExecutionStore } from '../stores/executionStore';
import { useCollaboration } from '../hooks/useCollaboration';
import { getLayoutedElements } from '../utils/layout';

const nodeTypes = {
  input:      InputNode,
  indicator:  IndicatorNode,
  comparison: ComparisonNode,
  smc:        SMCNode,
  signal:     SignalNode,
  logic:      LogicNode,
  timeFilter: TimeFilterNode,
  cross:      CrossNode,
  pump_dump:    PumpDumpNode,
  scanner:      ScannerNode,
  ai_forecast:  AIForecastNode,
  orderbook:    ExchangeNode,
  user_level:   UserLevelNode,
  sentiment:    SentimentNode,
  order_flow:   ExchangeNode,
  custom_code:  CustomCodeNode,
  ml_filter:    MLFilterNode,
  hermes:       HermesNode,
  mtf:          MTFNode,
  exchange:         ExchangeNode,
  exchange_data:    ExchangeNode,
  exchange_scanner: ExchangeNode,
  trade_action:     TradeActionNode,
  webhook:          WebhookNode,
  polymarket_scanner: PolymarketScannerNode,
  finviz_scanner: FinvizScannerNode,
  deribit_pcr: DeribitPcrNode,
  fusion_combiner: FusionCombinerNode,
  deep_research: DeepResearchNode,
  portfolio_risk_sizer: PortfolioRiskSizerNode,
  heym_mcp: HeymNode,
  mcp_tool: McpToolNode,
};



const initialNodes = [
  {
    id: 'node_1',
    type: 'signal',
    position: { x: 600, y: 200 },
    data: { signalType: 'LONG' },
  },
];

const today = new Date().toISOString().slice(0, 10);
const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const StrategyBuilder = ({ onBack, initialStrategy }: { onBack?: () => void; initialStrategy?: any }) => {
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { userLevels, setUserLevels } = useStrategyStore();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  const {
    nodes, edges, strategyName, pair, timeframe, savedStrategyId,
    isActive, isPaperTrading, executionSettings,
    setNodes, setEdges, onNodesChange, onEdgesChange, onConnect, updateNodeData,
    setStrategyName, setPair, setTimeframe, setSavedStrategyId, reset,
    setIsActive, setIsPaperTrading, setExecutionSettings
  } = useStrategyStore();

  const {
    pineModalOpen, templatesOpen, backtestOpen, pineCode,
    setPineModalOpen, setTemplatesOpen, setBacktestOpen, setPineCode
  } = useUiStore();

  const {
    backtestForm, backtestReq,
    setBacktestForm, setBacktestReq
  } = useExecutionStore();

  const { t, language } = useLanguageStore();

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById('top-header-portal');
    setPortalTarget(el || document.body);
  }, []);

  useEffect(() => {
    reset(initialStrategy);
  }, [initialStrategy, reset]);

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const reactFlowInstanceRef = useRef<any>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;
  const [backtestProgress, setBacktestProgress] = useState(0);
  const [backtestProgressStage, setBacktestProgressStage] = useState('');

  const [activeSubTab, setActiveSubTab] = useState<'canvas' | 'visual_ta'>('canvas');
  const [candlesData, setCandlesData] = useState<any[]>([]);
  const [candlesLoading, setCandlesLoading] = useState(false);

  useEffect(() => {
    if (activeSubTab !== 'visual_ta') return;
    
    let isMounted = true;

    const fetchCandles = async (showLoading = false) => {
      if (showLoading) setCandlesLoading(true);
      try {
        const res = await candlesApi.getLatest(pair || 'BTCUSDT', timeframe || '15m', 1000);
        if (!isMounted) return;
        if (res && res.data) {
          const rawCandles = res.data.candles || (Array.isArray(res.data) ? res.data : []);
          setCandlesData(rawCandles);
        }
      } catch (err) {
        console.error('Failed to load candles for visual TA', err);
      } finally {
        if (showLoading && isMounted) setCandlesLoading(false);
      }
    };

    // Initial load with full glassmorphic spinner
    fetchCandles(true);

    // Live polling every 5 seconds to sync and update latest ticking candle directly from Binance REST
    const intervalId = setInterval(() => {
      fetchCandles(false);
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [activeSubTab, pair, timeframe]);
  
  const [pairQuery, setPairQuery] = useState(pair || '');
  const [pairDropdown, setPairDropdown] = useState<string[]>([]);
  const [pairOpen, setPairOpen] = useState(false);
  const debouncedPairQuery = useDebounce(pairQuery, 300);
  const [watchlistPairs, setWatchlistPairs] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsList, setVersionsList] = useState<any[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const assetMenuRef = useRef<HTMLDivElement>(null);

  // Genetic optimizer states
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizeDays, setOptimizeDays] = useState(30);
  const [optimizeIterations, setOptimizeIterations] = useState(10);
  const [optimizePopulationSize, setOptimizePopulationSize] = useState(20);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<any | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  // Bot Codegen states
  const [codegenOpen, setCodegenOpen] = useState(false);
  const [codegenConfig, setCodegenConfig] = useState({ botName: '', tradingPairs: 'BTCUSDT,ETHUSDT', timeframe: '15m', checkIntervalSeconds: 30 });
  const [codegenStatus, setCodegenStatus] = useState<'idle' | 'preview' | 'loading' | 'done' | 'error'>('idle');
  const [codegenResult, setCodegenResult] = useState<{ downloadUrl: string; botId: string; previewCode: string; files: string[] } | null>(null);
  const [previewCode, setPreviewCode] = useState('');
  const [codegenActiveTab, setCodegenActiveTab] = useState<'config' | 'preview'>('config');
  const [codegenValidation, setCodegenValidation] = useState<{ valid: boolean; errors: any[]; warnings: any[]; stats: any } | null>(null);
  const [codegenErrorText, setCodegenErrorText] = useState('');

  const openCodegen = async () => {
    if (!savedStrategyId) {
      toast.warning(t('save_strategy_first_codegen') || 'Пожалуйста, сначала сохраните стратегию!');
      return;
    }
    const cleanName = strategyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'my-strategy';
    setCodegenConfig({
      botName: `${cleanName}-bot`,
      tradingPairs: pair || 'BTCUSDT',
      timeframe: timeframe || '15m',
      checkIntervalSeconds: 30
    });
    setCodegenStatus('idle');
    setCodegenResult(null);
    setCodegenErrorText('');
    setCodegenActiveTab('config');
    setCodegenOpen(true);
    // Validate strategy
    try {
      const vRes = await axios.get('/api/codegen/validate/' + savedStrategyId);
      setCodegenValidation(vRes.data);
    } catch { setCodegenValidation(null); }
    // Load preview
    try {
      const res = await axios.get('/api/codegen/preview/' + savedStrategyId);
      setPreviewCode(res.data.code || '');
    } catch { setPreviewCode('# Preview not available'); }
  };

  const closeCodegen = () => {
    setCodegenOpen(false);
    setCodegenStatus('idle');
    setCodegenResult(null);
    setCodegenValidation(null);
    setCodegenErrorText('');
  };

  const runCodegen = async () => {
    if (!savedStrategyId) return;
    setCodegenStatus('loading');
    setCodegenErrorText('');
    try {
      const res = await axios.post('/api/codegen/generate', {
        strategyId: savedStrategyId,
        config: { ...codegenConfig, tradingPairs: codegenConfig.tradingPairs.split(',').map((p: string) => p.trim()) },
      });
      setCodegenResult(res.data);
      setPreviewCode(res.data.previewCode || previewCode);
      setCodegenStatus('done');
      setCodegenActiveTab('preview');
    } catch (e: any) {
      const errData = e?.response?.data;
      if (errData?.errors) {
        setCodegenErrorText(errData.errors.map((er: any) => er.message).join('\n'));
      } else {
        setCodegenErrorText(errData?.message || 'Ошибка генерации');
      }
      setCodegenStatus('error');
    }
  };

  const [isDebugging, setIsDebugging] = useState(false);
  const [executionTrace, setExecutionTrace] = useState<any>(null);

  // Ref to close tools menu on outside click
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setToolsMenuOpen(false);
      }
    };
    if (toolsMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [toolsMenuOpen]);

  useEffect(() => {
    const handleOutsideAssetClick = (e: MouseEvent) => {
      if (assetMenuRef.current && !assetMenuRef.current.contains(e.target as Node)) {
        setAssetMenuOpen(false);
      }
    };
    if (assetMenuOpen) {
      document.addEventListener('mousedown', handleOutsideAssetClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideAssetClick);
  }, [assetMenuOpen]);

  // Real-time debounced strategy background validation (premium IDE feel)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await strategiesApi.validate({ nodes, edges });
        setValidationResult(res.data);
      } catch {}
    }, 1500);
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  // Synchronize pairQuery with the store's global pair to allow natural typing
  useEffect(() => {
    setPairQuery(pair || '');
  }, [pair]);

  useEffect(() => {
    if (!isDebugging || !savedStrategyId) {
      setExecutionTrace(null);
      return;
    }

    const fetchTrace = () => {
      signalsApi.getExecutionTrace(savedStrategyId)
        .then(res => {
          setExecutionTrace(res.data);
        })
        .catch(() => {});
    };

    fetchTrace();
    const interval = setInterval(fetchTrace, 2000);
    return () => clearInterval(interval);
  }, [isDebugging, savedStrategyId]);

  const { broadcastNodeChanges, broadcastEdgeChanges } = useCollaboration(savedStrategyId ? savedStrategyId.toString() : null);

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    broadcastNodeChanges(changes);
  }, [onNodesChange, broadcastNodeChanges]);

  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChange(changes);
    broadcastEdgeChanges(changes);
  }, [onEdgesChange, broadcastEdgeChanges]);

  useEffect(() => {
    candlesApi.getTrackedSymbols()
      .then(res => setWatchlistPairs(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!debouncedPairQuery.trim()) { setPairDropdown([]); setPairOpen(false); return; }
    candlesApi.searchSymbols(debouncedPairQuery.trim())
      .then(res => { setPairDropdown(res.data); setPairOpen(true); })
      .catch(() => setPairDropdown([]));
  }, [debouncedPairQuery]);

  const selectPair = useCallback((p: string) => {
    setPair(p);
    setPairQuery(p);
    setPairDropdown([]);
    setPairOpen(false);
    const updater = (nds: any[]) =>
      nds.map(n => n.type === 'input' ? { ...n, data: { ...n.data, pair: p } } : n);
    setNodes(updater);
    reactFlowInstanceRef.current?.setNodes(updater);
  }, [setNodes]);

  const onNodeClick = useCallback((_: any, node: any) => setSelectedNodeId(node.id), []);
  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  useEffect(() => {
    let changed = false;
    
    // 1. Identify true start sources (roots for BFS)
    const trueSources = [
      'input', 'exchange', 'exchange_data', 'exchange_scanner', 'webhook', 'polymarket_scanner', 'finviz_scanner',
      'indicator', 'smc', 'timeFilter', 'sentiment', 'pump_dump', 'order_flow', 'orderbook', 'ai_forecast', 'deribit_pcr',
      'user_level', 'scanner', 'heym_mcp', 'mcp_tool', 'hermes', 'ml_filter', 'deep_research', 'portfolio_risk_sizer'
    ];
    
    const activeSources = nodes.filter(n => 
      trueSources.includes(n.type!) && edges.some(e => e.source === n.id)
    );

    // 2. Perform BFS from active sources to find all reachable nodes
    const reachableNodeIds = new Set<string>();
    const queue: string[] = [];

    activeSources.forEach(s => {
      reachableNodeIds.add(s.id);
      queue.push(s.id);
    });

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      edges.forEach(e => {
        if (e.source === currentId && !reachableNodeIds.has(e.target)) {
          reachableNodeIds.add(e.target);
          queue.push(e.target);
        }
      });
    }

    const newNodes = nodes.map(n => {
      let newClassName = '';
      
      if (isDebugging && executionTrace?.trace) {
        const nodeTrace = executionTrace.trace[n.id];
        if (nodeTrace) {
          newClassName = nodeTrace.result ? 'node-trace-success' : 'node-trace-fail';
        } else {
          newClassName = 'node-trace-dimmed';
        }
      } else {
        const isSource = edges.some(e => e.source === n.id);
        const isTarget = edges.some(e => e.target === n.id);
        const isReachable = reachableNodeIds.has(n.id);
        
        let disconnected = false;
        
        if (trueSources.includes(n.type!)) {
          // Sources only need an outgoing connection
          disconnected = !isSource;
        } else if (n.type === 'trade_action' || n.type === 'signal') {
          // Sinks only need an incoming connection and must be reachable from a true source
          disconnected = !isTarget || !isReachable;
        } else {
          // All intermediate processing nodes must have input, output, and be reachable from a source
          disconnected = !isSource || !isTarget || !isReachable;
        }
        
        newClassName = disconnected ? 'node-disconnected' : '';
      }

      if (n.className !== newClassName) {
        changed = true;
        return { ...n, className: newClassName };
      }
      return n;
    });

    let newEdgesChanged = false;
    const newEdges = edges.map(e => {
      let animated = false;
      let stroke = 'var(--border-color)';
      let strokeWidth = 2;

      if (isDebugging && executionTrace?.trace) {
        const sourceTrace = executionTrace.trace[e.source];
        if (sourceTrace) {
          if (sourceTrace.result) {
            animated = true;
            stroke = '#10b981'; // neon green flow
            strokeWidth = 3;
          } else {
            stroke = '#ef4444'; // neon red block
            strokeWidth = 1.5;
          }
        } else {
          stroke = 'rgba(255, 255, 255, 0.08)'; // dimmed out path
          strokeWidth = 1;
        }
      }

      if (e.animated !== animated || e.style?.stroke !== stroke || e.style?.strokeWidth !== strokeWidth) {
        newEdgesChanged = true;
        return {
          ...e,
          animated,
          style: {
            ...e.style,
            stroke,
            strokeWidth,
            transition: 'stroke 0.3s, stroke-width 0.3s'
          }
        };
      }
      return e;
    });

    if (changed) {
      setNodes(newNodes);
    }
    if (newEdgesChanged) {
      setEdges(newEdges);
    }
  }, [edges, nodes, setNodes, setEdges, isDebugging, executionTrace]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          localStorage.setItem('reactflow-clipboard', JSON.stringify(selectedNodes));
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const clipboard = localStorage.getItem('reactflow-clipboard');
        if (clipboard) {
          try {
            const pastedNodes = JSON.parse(clipboard);
            if (Array.isArray(pastedNodes)) {
              const newNodes = pastedNodes.map(n => ({
                ...n,
                id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                position: { x: n.position.x + 50, y: n.position.y + 50 },
                selected: true,
              }));
              setNodes((nds) => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
            }
          } catch (err) {}
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        const selectedNodes = nodes.filter(n => n.selected && !n.parentNode && n.type !== 'group');
        if (selectedNodes.length > 0) {
          const minX = Math.min(...selectedNodes.map(n => n.position.x));
          const minY = Math.min(...selectedNodes.map(n => n.position.y));
          const maxX = Math.max(...selectedNodes.map(n => n.position.x + 180));
          const maxY = Math.max(...selectedNodes.map(n => n.position.y + 120));
          
          const groupId = `group_${Date.now()}`;
          const groupNode = {
            id: groupId,
            type: 'group',
            position: { x: minX - 30, y: minY - 40 },
            style: { width: maxX - minX + 60, height: maxY - minY + 80, backgroundColor: 'rgba(99, 102, 241, 0.05)', border: '2px dashed var(--accent-color)', borderRadius: '16px', zIndex: -1 },
            data: {},
          };

          const newNodes = nodes.map(n => {
            if (n.selected && !n.parentNode && n.type !== 'group') {
              return {
                ...n,
                parentNode: groupId,
                extent: 'parent' as const,
                position: { x: n.position.x - (minX - 30), y: n.position.y - (minY - 40) },
                selected: false
              };
            }
            return n;
          });

          setNodes([...newNodes, groupNode]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, setNodes]);

  const onLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [nodes, edges, setNodes, setEdges]);

  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: any) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      const dataStr = event.dataTransfer.getData('nodeData');
      const data = dataStr ? JSON.parse(dataStr) : {};
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const extraData = type === 'input' ? { pair } : {};
      setNodes((nds) =>
        nds.concat({ id: `node_${Date.now()}`, type, position, data: { ...data, ...extraData } })
      );
    },
    [reactFlowInstance, setNodes, pair]
  );

  const onValidate = async () => {
    setValidationResult(null);
    try {
      const res = await strategiesApi.validate({ nodes, edges });
      setValidationResult(res.data);
      if (res.data.valid) {
        // alert('Проверка пройдена: логических противоречий не обнаружено');
      }
    } catch {
      setValidationResult({ valid: false, error: 'Ошибка при выполнении проверки' });
    }
  };

  const onSave = async () => {
    try {
      // First validate
      const vRes = await strategiesApi.validate({ nodes, edges });
      if (!vRes.data.valid) {
        if (!confirm(`Внимание: ${vRes.data.error}\n\nВы уверены, что хотите сохранить стратегию с ошибками?`)) {
          return;
        }
      }
      setSaveModalOpen(true);
    } catch {
      setValidationResult({ valid: false, error: 'Ошибка при выполнении проверки' });
    }
  };

  const executeSave = async (comment?: string) => {
    try {
      const payload = { 
        name: strategyName, 
        pair, 
        timeframe, 
        nodes, 
        edges,
        is_active: isActive,
        is_paper_trading: isPaperTrading,
        execution_settings: executionSettings,
        versionLabel: comment || undefined
      };
      const res = savedStrategyId
        ? await strategiesApi.update(savedStrategyId, payload)
        : await strategiesApi.create({ ...payload, is_active: false });
      setSavedStrategyId(res.data.id);
      setSaveModalOpen(false);
      toast.success('Стратегия сохранена');
      useNotificationStore.getState().addNotification('Конструктор', `Стратегия "${strategyName}" успешно сохранена.`, 'success');
    } catch {
      toast.error('Ошибка при сохранении');
    }
  };

  const loadVersions = async () => {
    if (!savedStrategyId) return;
    try {
      const res = await strategiesApi.getVersions(savedStrategyId);
      setVersionsList(res.data || []);
    } catch {}
  };

  useEffect(() => {
    if (versionsOpen && savedStrategyId) {
      loadVersions();
    }
  }, [versionsOpen, savedStrategyId]);

  const onRestoreVersion = async (ver: number) => {
    if (!savedStrategyId) return;
    if (!confirm(`Вы действительно хотите восстановить версию v${ver}? Текущие несохраненные изменения на холсте будут потеряны.`)) return;
    try {
      const res = await strategiesApi.restoreVersion(savedStrategyId, ver);
      setNodes(res.data.nodes || []);
      setEdges(res.data.edges || []);
      setStrategyName(res.data.name || '');
      setPair(res.data.pair || '');
      setTimeframe(res.data.timeframe || '');
      setIsActive(res.data.is_active || false);
      setIsPaperTrading(res.data.is_paper_trading || false);
      setExecutionSettings(res.data.execution_settings || {});
      setVersionsOpen(false);
      toast.success(`Версия v${ver} успешно восстановлена!`);
      useNotificationStore.getState().addNotification('Версионирование', `Стратегия "${strategyName}" откачена к версии v${ver}.`, 'system');
    } catch (err: any) {
      toast.error('Ошибка восстановления: ' + (err.response?.data?.message || err.message));
    }
  };

  const onToggleActive = async () => {
    const newActive = !isActive;
    setIsActive(newActive);
    try {
      // Auto-save if not saved yet
      let currentId = savedStrategyId;
      const payload = { 
        name: strategyName, 
        pair, 
        timeframe, 
        nodes, 
        edges,
        is_active: newActive,
        is_paper_trading: isPaperTrading,
        execution_settings: executionSettings
      };
      if (!currentId) {
        const res = await strategiesApi.create(payload);
        setSavedStrategyId(res.data.id);
      } else {
        await strategiesApi.update(currentId, payload);
      }
      if (newActive) {
        toast.success('Стратегия АКТИВИРОВАНА и запущена!');
        useNotificationStore.getState().addNotification('Управление ботами', `Стратегия "${strategyName}" активирована и запущена в реальном времени.`, 'success');
      } else {
        toast.info('Стратегия ДЕАКТИВИРОВАНА.');
        useNotificationStore.getState().addNotification('Управление ботами', `Стратегия "${strategyName}" успешно остановлена.`, 'system');
      }
    } catch (e) {
      toast.error('Не удалось изменить статус запуска');
      setIsActive(!newActive);
    }
  };

  const getOptimizableParamsFromState = () => {
    const list: { nodeName: string; nodeId: string; key: string; val: number }[] = [];
    nodes.forEach((node: any) => {
      if (node.data?.params) {
        Object.entries(node.data.params).forEach(([key, val]) => {
          if (typeof val === 'number') {
            list.push({ nodeName: node.data?.name || node.type || 'Node', nodeId: node.id, key, val });
          }
        });
      }
    });
    return list;
  };

  const onStartOptimize = () => {
    const paramsList = getOptimizableParamsFromState();
    if (paramsList.length === 0) {
      toast.warning('В данной стратегии нет числовых параметров для оптимизации.');
      return;
    }
    setOptimizeOpen(true);
    setOptimizeResult(null);
    setOptimizeError(null);
    setOptimizeLoading(false);
  };

  const runOptimization = async () => {
    setOptimizeLoading(true);
    setOptimizeError(null);
    try {
      let currentId = savedStrategyId;
      if (!currentId) {
        const payload = { name: strategyName, pair, timeframe, nodes, edges };
        const res = await strategiesApi.create({ ...payload, is_active: false });
        currentId = res.data.id;
        setSavedStrategyId(currentId);
      } else {
        const payload = { name: strategyName, pair, timeframe, nodes, edges };
        await strategiesApi.update(currentId, payload);
      }

      const res = await optimizerApi.run(currentId!, {
        pair: pair,
        timeframe: timeframe,
        days: optimizeDays
      }, []);
      
      setOptimizeResult(Array.isArray(res.data) ? res.data[0] : res.data);
    } catch (err: any) {
      setOptimizeError(err.response?.data?.message || err.message || 'Ошибка во время работы алгоритма оптимизации');
    } finally {
      setOptimizeLoading(false);
    }
  };

  const applyOptimizedParams = () => {
    if (!optimizeResult || !optimizeResult.params) return;
    
    setNodes((prevNodes: any[]) => {
      return prevNodes.map(node => {
        const updatedParams = { ...(node.data?.params || {}) };
        let modified = false;
        
        Object.keys(updatedParams).forEach(key => {
          const lookupKey = `${node.id}:${key}`;
          if (optimizeResult.params[lookupKey] !== undefined) {
            let finalVal = optimizeResult.params[lookupKey];
            if (key.toLowerCase().includes('period') || key.toLowerCase().includes('minutes')) {
              finalVal = Math.round(finalVal);
            } else {
              finalVal = Number(finalVal.toFixed(4));
            }
            updatedParams[key] = finalVal;
            modified = true;
          }
        });
        
        if (modified) {
          return {
            ...node,
            data: {
              ...node.data,
              params: updatedParams
            }
          };
        }
        return node;
      });
    });
    
    setOptimizeOpen(false);
    toast.success('Оптимизированные параметры применены к холсту!');
    useNotificationStore.getState().addNotification('Оптимизатор', `Применены новые параметры на холсте для стратегии "${strategyName}".`, 'success');
  };

  const runBacktest = async () => {
    setBacktestReq({ status: 'loading' });
    setBacktestProgress(0);
    setBacktestProgressStage(language === 'ru' ? '📥 Инициализация бэктеста...' : '📥 Initializing backtest...');

    let socket: any = null;

    try {
      // Auto-save if not saved yet
      let currentId = savedStrategyId;
      if (!currentId) {
        const payload = { name: strategyName, pair, timeframe, nodes, edges };
        const res = await strategiesApi.create({ ...payload, is_active: false });
        currentId = res.data.id;
        setSavedStrategyId(currentId);
      } else {
        // Update existing strategy with current nodes/edges
        const payload = { name: strategyName, pair, timeframe, nodes, edges };
        await strategiesApi.update(currentId, payload);
      }

      // Connect to WebSocket signals namespace for real-time progress updates
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const socketUrl = API_URL.replace('/api', '') + '/signals';
      socket = io(socketUrl, { transports: ['websocket'] });

      socket.on('connect', () => {
        console.log('Connected to signals namespace for backtest progress');
      });

      socket.on('BACKTEST_PROGRESS', (data: { strategyId: number; progress: number; stage: string }) => {
        if (data.strategyId === currentId) {
          setBacktestProgress(data.progress);
          setBacktestProgressStage(data.stage);
        }
      });

      const res = await strategiesApi.backtest(currentId as number, {
        start: backtestForm.start,
        end: backtestForm.end,
        initialBalance: backtestForm.initialBalance,
        fee: backtestForm.feePercent / 100,
        tp: backtestForm.tpPercent / 100,
        sl: backtestForm.slPercent / 100,
        positionSize: backtestForm.positionSizePercent / 100,
        useTrailingStop: backtestForm.useTrailingStop,
        trailingDistance: backtestForm.trailingDistance / 100,
        trailingActivation: backtestForm.trailingActivation / 100,
      });

      setBacktestProgress(100);
      setBacktestProgressStage(language === 'ru' ? '✅ Тестирование успешно завершено!' : '✅ Backtest completed successfully!');
      
      setTimeout(() => {
        setBacktestReq({ status: 'success', result: res.data });
      }, 500);
    } catch (e: any) {
      setBacktestProgress(0);
      setBacktestReq({ status: 'error', error: e?.response?.data?.message || (language === 'ru' ? 'Ошибка запуска бэктеста' : 'Failed to start backtest') });
    } finally {
      if (socket) {
        socket.disconnect();
      }
    }
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-primary)', overflow: 'hidden', gap: 'var(--bento-gap)' }}>

      {/* Mobile info banner */}
      <div className="mobile-desktop-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <div>
          <strong>{t('recommended_desktop')}</strong>
          <div style={{ fontSize: '11px', marginTop: '2px', color: 'var(--text-muted)' }}>{t('mobile_warning')}</div>
        </div>
      </div>
      {/* BUILDER NAVIGATION PORTAL */}
      {createPortal(
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 99999,
          width: '100%',
          justifyContent: 'space-between',
          overflow: 'visible',
          flexWrap: 'nowrap'
        }}>
          {/* LEFT GROUP: Back button & Unified Asset Popover */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 1 }}>
            {onBack && (
              <button 
                onClick={onBack} 
                title={t('back') || 'Назад'}
                style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.06)', 
                  cursor: 'pointer', 
                  color: 'var(--text-secondary)', 
                  padding: '7px', 
                  borderRadius: '10px',
                  display: 'flex', 
                  alignItems: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-accent)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
            )}

            {/* UNIFIED ASSET SHIELD (POPOVER) */}
            <div ref={assetMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setAssetMenuOpen(!assetMenuOpen)}
                style={{
                  background: assetMenuOpen ? 'var(--bg-input)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  maxWidth: '280px',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => { if (!assetMenuOpen) e.currentTarget.style.background = 'var(--bg-accent)'; }}
                onMouseLeave={e => { if (!assetMenuOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              >
                {/* Neon Validation Status Indicator dot */}
                <span 
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: validationResult ? (validationResult.valid ? 'var(--success)' : 'var(--danger)') : '#94a3b8',
                    boxShadow: validationResult ? (validationResult.valid ? '0 0 8px var(--success)' : '0 0 8px var(--danger)') : 'none',
                    display: 'inline-block',
                    flexShrink: 0,
                    animation: validationResult && !validationResult.valid ? 'pulse 1.5s infinite' : 'none'
                  }}
                  title={validationResult ? (validationResult.valid ? t('validation_passed') : t('validation_error')) : t('validation_tooltip')}
                />
                
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {strategyName || t('unnamed_strategy')}
                </span>
                <span style={{ opacity: 0.3 }}>•</span>
                <span style={{ color: 'var(--accent-color)', fontWeight: 700 }}>{pair || '—'}</span>
                <span style={{ opacity: 0.3 }}>•</span>
                <span style={{ opacity: 0.8 }}>{timeframe || '—'}</span>
                <span style={{ fontSize: '8px', opacity: 0.5, marginLeft: '2px' }}>▼</span>
              </button>

              {/* ASSET CONFIG POPOVER CARD */}
              {assetMenuOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 99999,
                  background: 'rgba(10, 15, 30, 0.98)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                  padding: '16px', width: '280px', marginTop: '8px',
                  backdropFilter: 'blur(25px)',
                  display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  {/* Strategy Name Row */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      {t('strategy_name') || 'Название стратегии'}
                    </label>
                    <input
                      value={strategyName}
                      onChange={(e) => setStrategyName(e.target.value)}
                      placeholder={t('unnamed_strategy')}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                    />
                  </div>

                  {/* Pair Search Row */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      {t('search_pair') || 'Торговая пара'}
                    </label>
                    <input
                      value={pairQuery}
                      onChange={e => setPairQuery(e.target.value)}
                      onFocus={e => { e.target.select(); if (!pairQuery.trim() && watchlistPairs.length > 0) setPairOpen(true); }}
                      onBlur={() => setTimeout(() => setPairOpen(false), 200)}
                      placeholder="BTCUSDT"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                    {pairOpen && (pairDropdown.length > 0 || (!pairQuery.trim() && watchlistPairs.length > 0)) && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100000,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                        borderRadius: '12px', boxShadow: 'var(--card-shadow)',
                        maxHeight: '180px', overflowY: 'auto', marginTop: '6px', padding: '6px'
                      }}>
                        {!pairQuery.trim() ? (
                          <>
                            <div style={{ padding: '6px 8px 4px', fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                              {t('watchlist')}
                            </div>
                            {watchlistPairs.map(p => (
                              <div key={p} onMouseDown={() => selectPair(p)} className="pair-option" style={{
                                padding: '6px 10px', fontSize: '11px', cursor: 'pointer', borderRadius: '6px',
                                color: 'var(--text-primary)', background: p === pair ? 'var(--bg-accent)' : 'transparent',
                                transition: 'var(--transition)'
                              }}>
                                {p}
                              </div>
                            ))}
                          </>
                        ) : (
                          pairDropdown.map(p => (
                            <div key={p} onMouseDown={() => selectPair(p)} className="pair-option" style={{
                              padding: '6px 10px', fontSize: '11px', cursor: 'pointer', borderRadius: '6px',
                              color: 'var(--text-primary)', background: p === pair ? 'var(--bg-accent)' : 'transparent',
                            }}>
                              {p}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Timeframe Select Row */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      {t('timeframe') || 'Таймфрейм'}
                    </label>
                    <select
                      value={timeframe}
                      onChange={e => setTimeframe(e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        cursor: 'pointer',
                        width: '100%'
                      }}
                    >
                      {TIMEFRAMES.map(tf => (
                        <option key={tf} value={tf}>{tf}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* TAB SEGMENTS */}
            <div style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px',
              padding: '2px',
              gap: '2px',
              marginLeft: '4px'
            }}>
              <button
                onClick={() => setActiveSubTab('canvas')}
                style={{
                  background: activeSubTab === 'canvas' ? 'var(--accent-color)' : 'transparent',
                  color: activeSubTab === 'canvas' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="3 3 10 3 10 10 3 10 3 3"/><polygon points="14 3 21 3 21 10 14 10 14 3"/><polygon points="14 14 21 14 21 21 14 21 14 14"/><polygon points="3 14 10 14 10 21 3 21 3 14"/></svg>
                {t('canvas') || 'Холст'}
              </button>
              <button
                onClick={() => setActiveSubTab('visual_ta')}
                style={{
                  background: activeSubTab === 'visual_ta' ? 'var(--accent-color)' : 'transparent',
                  color: activeSubTab === 'visual_ta' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                {t('visual_ta') || 'График TA & Уровни'}
              </button>
            </div>
          </div>

          {/* RIGHT GROUP: Segregated Analytics Actions & Tools dropdown */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {/* Quick Action: Backtest (Play) */}
            <button
              onClick={() => { setBacktestOpen(true); setBacktestReq({ status: 'idle' }); }}
              title={t('backtest')}
              style={{
                ...iconBtnStyle,
                padding: '8px',
                borderColor: 'rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
                color: 'var(--text-primary)',
                borderRadius: '10px'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-accent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>

            {/* Quick Action: Debugger */}
            <button
              onClick={() => setIsDebugging(!isDebugging)}
              title={isDebugging ? t('debug_on') : t('debug_tooltip')}
              style={{
                ...iconBtnStyle,
                padding: '8px',
                borderColor: isDebugging ? 'var(--success)' : 'rgba(255,255,255,0.06)',
                background: isDebugging ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                color: isDebugging ? 'var(--success)' : 'var(--text-secondary)',
                borderRadius: '10px'
              }}
              onMouseEnter={e => { if (!isDebugging) e.currentTarget.style.background = 'var(--bg-accent)'; }}
              onMouseLeave={e => { if (!isDebugging) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-4.418 0-8-3.582-8-8V9h16v3c0 4.418-3.582 8-8 8Z"/><path d="M5 12H2"/><path d="M22 12h-3"/></svg>
            </button>

            {/* Tools Menu Dropdown */}
            <div 
              ref={toolsMenuRef}
              style={{ position: 'relative' }}
            >
              <button 
                onClick={() => setToolsMenuOpen(!toolsMenuOpen)} 
                style={{ 
                  ...iconBtnStyle, 
                  borderColor: 'rgba(255,255,255,0.06)',
                  background: toolsMenuOpen ? 'var(--bg-input)' : 'rgba(255,255,255,0.02)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '7px 12px',
                  borderRadius: '10px'
                }}
                onMouseEnter={e => { if (!toolsMenuOpen) e.currentTarget.style.background = 'var(--bg-accent)'; }}
                onMouseLeave={e => { if (!toolsMenuOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <span style={{ marginLeft: '6px' }}>{t('tools')}</span>
                <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '4px' }}>{toolsMenuOpen ? '▲' : '▼'}</span>
              </button>
              {toolsMenuOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 99999,
                  background: 'rgba(10, 15, 30, 0.98)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px', boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
                  padding: '8px', minWidth: '195px', marginTop: '6px',
                  backdropFilter: 'blur(20px)',
                  display: 'flex', flexDirection: 'column', gap: '2px'
                }}>
                  {/* Optimizer moved inside Tools menu! */}
                  <button 
                    onClick={() => { setToolsMenuOpen(false); onStartOptimize(); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--accent-color)',
                      padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'all 0.15s ease', width: '100%'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5"/><path d="M12 2v10"/><path d="m9 9 3 3 3-3"/></svg>
                    {t('optimize_strategy') || 'Оптимизация параметров'}
                  </button>

                  <button 
                    onClick={() => { setToolsMenuOpen(false); setPineModalOpen(true); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-secondary)',
                      padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'all 0.15s ease', width: '100%'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    {t('import_pine')}
                  </button>
                  <button 
                    onClick={() => { setToolsMenuOpen(false); setTemplatesOpen(true); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-secondary)',
                      padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'all 0.15s ease', width: '100%'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <BookOpen size={14} /> {t('templates')}
                  </button>
                  <button 
                    onClick={() => { setToolsMenuOpen(false); openCodegen(); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-secondary)',
                      padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'all 0.15s ease', width: '100%'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <Bot size={14} /> {t('bot_generator')}
                  </button>
                  <button 
                    onClick={() => { setToolsMenuOpen(false); onLayout(); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-secondary)',
                      padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'all 0.15s ease', width: '100%'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 3 10 3 10 10 3 10 3 3"/><polygon points="14 3 21 3 21 10 14 10 14 3"/><polygon points="14 14 21 14 21 21 14 21 14 14"/><polygon points="3 14 10 14 10 21 3 21 3 14"/></svg>
                    {t('auto_layout')}
                  </button>
                  {savedStrategyId && (
                    <button 
                      onClick={() => { setToolsMenuOpen(false); setVersionsOpen(true); }}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text-secondary)',
                        padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                        fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                        transition: 'all 0.15s ease', width: '100%'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {t('version_history')}
                    </button>
                  )}
                  <button 
                    onClick={() => { setToolsMenuOpen(false); setSettingsOpen(true); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-secondary)',
                      padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'all 0.15s ease', width: '100%'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    {t('settings')}
                  </button>
                </div>
              )}
            </div>

            {/* Save strategy */}
            <button onClick={onSave} style={{ ...primaryBtnStyle, padding: '7px 14px', fontSize: '12px', borderRadius: '10px' }}>{t('save')}</button>

            {/* Quick Action: Activation Switch */}
            <button 
              onClick={onToggleActive} 
              style={{ 
                ...primaryBtnStyle, 
                padding: '7px 14px',
                fontSize: '12px',
                borderRadius: '10px',
                background: isActive ? 'var(--danger)' : 'var(--success)', 
                boxShadow: isActive ? '0 4px 12px rgba(239, 68, 68, 0.2)' : '0 4px 12px rgba(16, 185, 129, 0.2)' 
              }}
            >
              {isActive ? t('deactivate') : t('activate')}
            </button>
          </div>
        </div>,
        portalTarget || document.body
      )}

      {validationResult && !validationResult.valid && (
        <div style={{
          position: 'absolute', top: '64px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(239, 68, 68, 0.95)', color: '#fff',
          padding: '12px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', gap: '12px', backdropFilter: 'blur(8px)',
          maxWidth: '600px', animation: 'slideIn 0.3s ease-out'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {validationResult.error}
          <button onClick={() => setValidationResult(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 'var(--bento-gap)', position: 'relative' }}>
        <ReactFlowProvider>
          {!isSidebarPinned && (
            <div 
              onMouseEnter={() => setIsSidebarOpen(true)}
              style={{
                position: 'absolute',
                left: 0, top: 0, bottom: 0,
                width: '18px',
                zIndex: 999,
                cursor: 'pointer',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div style={{
                width: '12px',
                height: '80px',
                background: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderLeft: 'none',
                borderRadius: '0 8px 8px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                color: 'var(--accent-color)',
                opacity: isSidebarOpen ? 0 : 0.8,
                transition: 'all 0.2s ease',
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          )}
          <Sidebar 
            isOpen={isSidebarOpen} 
            isPinned={isSidebarPinned} 
            onTogglePin={() => setIsSidebarPinned(!isSidebarPinned)}
            onMouseEnter={() => setIsSidebarOpen(true)}
            onMouseLeave={() => setIsSidebarOpen(false)}
          />

          {activeSubTab === 'canvas' ? (
            <div className="bento-card" style={{ flex: 1, position: 'relative', borderRadius: 'var(--radius-xl)', marginLeft: (isSidebarPinned ? 0 : 16) }} ref={reactFlowWrapper}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                onInit={(instance) => { 
                  setReactFlowInstance(instance); 
                  reactFlowInstanceRef.current = instance; 
                  (window as any).reactFlowInstance = instance;
                }}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
                snapToGrid
                snapGrid={[12, 12]}
                style={{ borderRadius: 'var(--radius-xl)' }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={24}
                  size={1}
                  color="rgba(255,255,255,0.04)"
                />
                <Controls style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 'var(--radius-sm)',
                  fill: 'var(--text-primary)',
                  boxShadow: 'var(--card-shadow)',
                }} showInteractive={false} />
                </ReactFlow>

                {/* ═══ DEBUG PANEL OVERLAY ═══ */}
                {isDebugging && (() => {
                  const trueSources = [
                    'input', 'exchange', 'exchange_data', 'exchange_scanner', 'webhook', 'polymarket_scanner',
                    'finviz_scanner', 'indicator', 'smc', 'timeFilter', 'sentiment', 'pump_dump', 'order_flow',
                    'orderbook', 'ai_forecast', 'deribit_pcr', 'user_level', 'scanner', 'heym_mcp', 'mcp_tool',
                    'hermes', 'ml_filter', 'deep_research', 'portfolio_risk_sizer',
                  ];
                  const sinkTypes = ['trade_action', 'signal'];

                  const disconnectedNodes = nodes.filter(n => {
                    const isSource = edges.some(e => e.source === n.id);
                    const isTarget = edges.some(e => e.target === n.id);
                    if (trueSources.includes(n.type!)) return !isSource;
                    if (sinkTypes.includes(n.type!)) return !isTarget;
                    return !isSource || !isTarget;
                  });

                  const hasSignal = nodes.some(n => n.type === 'signal');
                  const hasExchange = nodes.some(n => ['exchange', 'exchange_data', 'input'].includes(n.type!));
                  const orphaned = nodes.filter(n =>
                    !edges.some(e => e.source === n.id || e.target === n.id) && n.type !== 'group'
                  );

                  const warnings: string[] = [];
                  if (!hasSignal) warnings.push(t('debug_no_signal') || '⚠ Нет ноды Signal (LONG/SHORT) — стратегия не выдаст сигнал');
                  if (!hasExchange) warnings.push(t('debug_no_exchange') || '⚠ Нет ноды Exchange — нет источника ценовых данных');
                  if (orphaned.length > 0) warnings.push(`⚠ ${orphaned.length} нод изолированы (нет связей): ${orphaned.map(n => n.data?.name || n.type).join(', ')}`);

                  const hasErrors = disconnectedNodes.length > 0 || warnings.length > 0;
                  const hasTrace = !!executionTrace?.trace;

                  return (
                    <div style={{
                      position: 'absolute', bottom: 16, left: 16, zIndex: 999,
                      width: '300px', maxHeight: '400px', overflowY: 'auto',
                      background: 'rgba(8, 10, 18, 0.96)',
                      border: `1.5px solid ${hasErrors ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.4)'}`,
                      borderRadius: '14px',
                      boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 20px ${hasErrors ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}`,
                      backdropFilter: 'blur(20px)',
                      fontFamily: 'var(--font-sans)',
                    }}>
                      {/* Header */}
                      <div style={{
                        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: hasErrors ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: hasErrors ? '#ef4444' : '#10b981',
                          boxShadow: `0 0 6px ${hasErrors ? '#ef444490' : '#10b98190'}`,
                          animation: 'pulse 2s infinite',
                        }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: hasErrors ? '#ef4444' : '#10b981' }}>
                          DEBUG MODE {hasTrace ? '· LIVE TRACE' : '· STATIC ANALYSIS'}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {nodes.length} нод · {edges.length} связей
                        </span>
                      </div>

                      <div style={{ padding: '10px 14px' }}>
                        {/* Live trace legend */}
                        {hasTrace && (
                          <div style={{ marginBottom: '10px', padding: '8px', background: 'rgba(99,102,241,0.1)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', marginBottom: '6px', textTransform: 'uppercase' }}>Трассировка выполнения</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {['✅ Зелёный = условие ВЫПОЛНЕНО', '❌ Красный = условие НЕ выполнено', '⬜ Серый = нода не участвует'].map(l => (
                                <div key={l} style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{l}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* All OK */}
                        {!hasErrors && (
                          <div style={{ padding: '10px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                            ✅ {t('debug_all_ok') || 'Все ноды подключены. Стратегия логически корректна.'}
                          </div>
                        )}

                        {/* Warnings */}
                        {warnings.map((w, i) => (
                          <div key={`w${i}`} style={{ marginBottom: '6px', padding: '8px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', fontSize: '11px', color: '#f59e0b', lineHeight: 1.5 }}>
                            {w}
                          </div>
                        ))}

                        {/* Disconnected nodes */}
                        {disconnectedNodes.length > 0 && (
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', marginTop: '4px' }}>
                              🔴 Оборванные связи ({disconnectedNodes.length})
                            </div>
                            {disconnectedNodes.map(n => {
                              const isSource = edges.some(e => e.source === n.id);
                              const isTarget = edges.some(e => e.target === n.id);
                              let hint = '';
                              if (trueSources.includes(n.type!) && !isSource) hint = 'нет исходящей связи';
                              else if (sinkTypes.includes(n.type!) && !isTarget) hint = 'нет входящей связи';
                              else if (!isTarget) hint = 'нет входящей связи';
                              else if (!isSource) hint = 'нет исходящей связи';
                              return (
                                <div key={n.id} style={{
                                  marginBottom: '4px', padding: '7px 10px',
                                  background: 'rgba(239,68,68,0.08)', borderRadius: '8px',
                                  border: '1px solid rgba(239,68,68,0.2)',
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                  <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#fca5a5' }}>{n.data?.name || n.type}</div>
                                    <div style={{ fontSize: '10px', color: 'rgba(252,165,165,0.7)' }}>{hint}</div>
                                  </div>
                                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{n.id.slice(0, 10)}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Unsaved warning */}
                        {!savedStrategyId && (
                          <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)', fontSize: '10px', color: '#818cf8', lineHeight: 1.5 }}>
                            💾 {t('debug_save_for_trace') || 'Сохраните стратегию для активации live трассировки'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

          ) : (
            <div className="bento-card" style={{ flex: 1, position: 'relative', borderRadius: 'var(--radius-xl)', marginLeft: (isSidebarPinned ? 0 : 16), display: 'flex', flexDirection: 'column', padding: '24px', gap: '16px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>📊 {t('visual_ta') || 'График TA & Уровни'}</h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {pair || 'BTCUSDT'} • {timeframe || '15m'} • Автоматический рендеринг заложенных индикаторов и уровней
                  </div>
                </div>
              </div>
              
              <div style={{ flex: 1, minHeight: 0, position: 'relative', background: 'rgba(10, 11, 14, 0.5)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '16px' }}>
                {candlesLoading ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2.5" className="animate-spin"><circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10"/></svg>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>Загрузка ценовой истории и расчет индикаторов...</div>
                  </div>
                ) : (
                  <MarketChart 
                    data={candlesData} 
                    signals={[]} 
                    nodes={nodes} 
                  />
                )}
              </div>
            </div>
          )}

          <PropertiesPanel
            selectedNode={selectedNode}
            onUpdate={updateNodeData}
            onDelete={(id) => {
              setNodes((nds) => nds.filter((n) => n.id !== id));
              if (selectedNodeId === id) setSelectedNodeId(null);
            }}
            onClose={() => setSelectedNodeId(null)}
            nodeCount={nodes.length}
            pair={pair}
            timeframe={timeframe}
          />
        </ReactFlowProvider>
      </div>

      {/* BACKTEST MODAL */}
      {backtestOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setBacktestOpen(false); }}>
          <div className="modal-content" style={{ width: '640px', padding: 0, overflow: 'hidden' }}>
            <button className="modal-close" onClick={() => setBacktestOpen(false)}>✕</button>
            
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('backtest_strategy')}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{strategyName} · {pair} · {timeframe}</div>
            </div>

            <div style={{ padding: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <Field label={t('start_date')}><input type="date" value={backtestForm.start} onChange={e => setBacktestForm(f => ({ ...f, start: e.target.value }))} style={inputStyle} /></Field>
              <Field label={t('end_date')}><input type="date" value={backtestForm.end} onChange={e => setBacktestForm(f => ({ ...f, end: e.target.value }))} style={inputStyle} /></Field>
              <Field label={t('initial_balance')}><input type="number" value={backtestForm.initialBalance} onChange={e => setBacktestForm(f => ({ ...f, initialBalance: Number(e.target.value) }))} style={inputStyle} /></Field>
              <Field label={t('commission_pct')}><input type="number" value={backtestForm.feePercent} step={0.01} onChange={e => setBacktestForm(f => ({ ...f, feePercent: Number(e.target.value) }))} style={inputStyle} /></Field>
              <Field label={t('take_profit_pct')}><input type="number" value={backtestForm.tpPercent} step={0.1} onChange={e => setBacktestForm(f => ({ ...f, tpPercent: Number(e.target.value) }))} style={inputStyle} /></Field>
              <Field label={t('stop_loss_pct')}><input type="number" value={backtestForm.slPercent} step={0.1} onChange={e => setBacktestForm(f => ({ ...f, slPercent: Number(e.target.value) }))} style={inputStyle} /></Field>
              <Field label={t('slippage_pct')}><input type="number" value={backtestForm.slippagePct} step={0.05} onChange={e => setBacktestForm(f => ({ ...f, slippagePct: Number(e.target.value) }))} style={inputStyle} /></Field>
              <Field label={t('latency_ms')}><input type="number" value={backtestForm.latencyMs} onChange={e => setBacktestForm(f => ({ ...f, latencyMs: Number(e.target.value) }))} style={inputStyle} /></Field>
              <Field label={t('algorithm')}>
                  <select value={backtestForm.executionAlgo} onChange={e => setBacktestForm(f => ({ ...f, executionAlgo: e.target.value as any }))} style={inputStyle}>
                      <option value="MARKET">Market</option>
                      <option value="TWAP">TWAP</option>
                      <option value="VWAP">VWAP</option>
                  </select>
              </Field>
              </div>

              {backtestReq.status === 'error' && (
                <div style={{ marginTop: '20px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', fontSize: '13px', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                  {backtestReq.error}
                </div>
              )}

              <div style={{ gridColumn: '1 / -1', padding: '12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                   <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{t('trailing_stop')}</span>
                  <input type="checkbox" checked={backtestForm.useTrailingStop} onChange={e => setBacktestForm({...backtestForm, useTrailingStop: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                </div>
                {backtestForm.useTrailingStop && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('distance_pct')}</div>
                      <input type="number" step="0.1" value={backtestForm.trailingDistance} onChange={e => setBacktestForm({...backtestForm, trailingDistance: Number(e.target.value)})} style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('activation_pct')}</div>
                      <input type="number" step="0.1" value={backtestForm.trailingActivation} onChange={e => setBacktestForm({...backtestForm, trailingActivation: Number(e.target.value)})} style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>

              {backtestReq.status === 'loading' ? (
                <div style={{ marginTop: '24px', padding: '20px 24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', textAlign: 'center', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <div className="loader-radar" style={{ width: '40px', height: '40px', border: '3px solid transparent', borderTopColor: 'var(--accent-color)', borderBottomColor: 'var(--success)', borderRadius: '50%', animation: 'spin 1.5s linear infinite', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '6px', left: '6px', right: '6px', bottom: '6px', border: '3px solid transparent', borderLeftColor: 'var(--warning)', borderRightColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite reverse' }}></div>
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '6px' }}>
                    {language === 'ru' ? '🧬 Запуск бэктеста...' : '🧬 Running Backtest...'}
                  </div>
                  <div style={{ background: 'var(--bg-accent)', border: '1px solid var(--border-color)', height: '10px', borderRadius: '5px', overflow: 'hidden', width: '100%', margin: '12px 0', position: 'relative' }}>
                    <div style={{ background: 'linear-gradient(90deg, #a855f7, #6366f1, #10b981)', height: '100%', width: `${backtestProgress}%`, transition: 'width 0.15s ease-out', boxShadow: '0 0 8px rgba(99, 102, 241, 0.5)' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, minHeight: '16px', textAlign: 'left' }}>
                      {backtestProgressStage}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--accent-color)', fontWeight: 800, fontFamily: 'monospace' }}>
                      {backtestProgress}%
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={runBacktest}
                  style={{ ...primaryBtnStyle, width: '100%', marginTop: '24px', height: '44px' }}
                >
                  {t('run_backtest_btn')}
                </button>
              )}
            </div>

            {backtestReq.status === 'success' && <BacktestResults result={backtestReq.result} />}
          </div>
        </div>
      )}

      {/* PINESCRIPT MODAL */}
      {pineModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPineModalOpen(false); }}>
          <div className="modal-content" style={{ width: '720px', padding: 0 }}>
            <button className="modal-close" onClick={() => setPineModalOpen(false)}>✕</button>
            
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                {t('import_pine_script')}
              </div>
            </div>
            
            <div style={{ padding: '32px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
                {t('import_pine_desc')}
              </div>
              <textarea 
                value={pineCode}
                onChange={e => setPineCode(e.target.value)}
                placeholder="//@version=5..."
                style={{ 
                  width: '100%', height: '300px', padding: '16px', fontFamily: 'monospace', fontSize: '13px',
                  background: '#0f172a', color: '#cbd5e1', border: '1px solid var(--border-color)', borderRadius: '12px', resize: 'none', outline: 'none'
                }}
              />
              <button 
                disabled={!pineCode.trim()}
                onClick={() => { 
                  const parsed = parsePineScript(pineCode);
                  if (parsed.nodes.length > 0) {
                    setNodes((nds) => [...nds, ...parsed.nodes]);
                    setEdges((eds) => [...eds, ...parsed.edges]);
                    setPineModalOpen(false);
                    setPineCode('');
                  }
                }}
                style={{ ...primaryBtnStyle, width: '100%', marginTop: '24px' }}
              >
                {t('convert_to_nodes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {templatesOpen && (
        <StrategyTemplatesModal
          onClose={() => setTemplatesOpen(false)}
          onLoad={(template) => {
            setNodes(template.nodes as any);
            setEdges(template.edges as any);
            setStrategyName(`Копия: ${template.name}`);
            setPair(template.pair);
            setTimeframe(template.timeframe);
          }}
        />
      )}

      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
              width: '450px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '32px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('execution_settings')}</div>
              <button onClick={() => setSettingsOpen(false)} style={{ background: 'var(--bg-accent)', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-accent)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{t('forward_testing_paper')}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{t('paper_trading_desc')}</div>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={isPaperTrading} onChange={e => setIsPaperTrading(e.target.checked)} />
                  <div className="ttrack"></div><div className="tthumb"></div>
                </label>
              </div>

              {isPaperTrading && (
                <div style={{ background: 'var(--bg-accent)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('trade_risk_management')}</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Field label={t('take_profit_pct')}>
                      <input 
                        type="number" 
                        step={0.1}
                        value={executionSettings?.tpPercent ?? 2.0} 
                        onChange={e => setExecutionSettings({ ...executionSettings, tpPercent: Number(e.target.value) })} 
                        style={inputStyle} 
                      />
                    </Field>
                    <Field label={t('stop_loss_pct')}>
                      <input 
                        type="number" 
                        step={0.1}
                        value={executionSettings?.slPercent ?? 1.0} 
                        onChange={e => setExecutionSettings({ ...executionSettings, slPercent: Number(e.target.value) })} 
                        style={inputStyle} 
                      />
                    </Field>
                  </div>

                  {/* Trailing Stop section for paper trading */}
                  <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{t('trailing_stop')}</span>
                      <input 
                        type="checkbox" 
                        checked={executionSettings?.useTrailingStop ?? false} 
                        onChange={e => setExecutionSettings({ ...executionSettings, useTrailingStop: e.target.checked })} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
                      />
                    </div>
                    {executionSettings?.useTrailingStop && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('distance_pct')}</div>
                          <input 
                            type="number" 
                            step={0.1} 
                            value={executionSettings?.trailingDistance ?? 1.0} 
                            onChange={e => setExecutionSettings({ ...executionSettings, trailingDistance: Number(e.target.value) })} 
                            style={inputStyle} 
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('activation_pct')}</div>
                          <input 
                            type="number" 
                            step={0.1} 
                            value={executionSettings?.trailingActivation ?? 0.5} 
                            onChange={e => setExecutionSettings({ ...executionSettings, trailingActivation: Number(e.target.value) })} 
                            style={inputStyle} 
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Break-even section for paper trading */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {language === 'ru' ? 'Безубыток (Break-Even)' : 'Break-Even (BE)'}
                      </span>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {language === 'ru' ? 'Переносить SL в безубыток при частичном закрытии' : 'Move SL to entry on first partial TP'}
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={executionSettings?.moveSLtoBE ?? false} 
                      onChange={e => setExecutionSettings({ ...executionSettings, moveSLtoBE: e.target.checked })} 
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
                    />
                  </div>
                </div>
              )}

              {/* Live Execution Section */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-accent)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{t('enable_live_execution')}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {language === 'ru' ? 'Запуск торговли на реальном аккаунте биржи' : 'Execute orders on a live exchange account'}
                  </div>
                </div>
                <label className="toggle">
                  <input 
                    type="checkbox" 
                    checked={executionSettings?.enableLiveExecution ?? false} 
                    onChange={e => setExecutionSettings({ ...executionSettings, enableLiveExecution: e.target.checked })} 
                  />
                  <div className="ttrack"></div><div className="tthumb"></div>
                </label>
              </div>

              {executionSettings?.enableLiveExecution && (
                <div style={{ background: 'var(--bg-accent)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {language === 'ru' ? 'Настройки Live исполнения' : 'Live Execution Settings'}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Field label={t('exchange_label')}>
                      <select 
                        value={executionSettings?.exchangeId || 'binance'} 
                        onChange={e => setExecutionSettings({ ...executionSettings, exchangeId: e.target.value })} 
                        style={inputStyle}
                      >
                        <option value="binance">Binance</option>
                        <option value="bybit">Bybit</option>
                        <option value="okx">OKX</option>
                      </select>
                    </Field>
                    
                    <Field label={t('position_size_usd')}>
                      <input 
                        type="number" 
                        value={executionSettings?.positionSize ?? 100} 
                        onChange={e => setExecutionSettings({ ...executionSettings, positionSize: Number(e.target.value) })} 
                        style={inputStyle} 
                      />
                    </Field>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      {t('execution_algo')}
                    </label>
                    <select 
                      value={executionSettings?.executionAlgo || 'MARKET'} 
                      onChange={e => setExecutionSettings({ ...executionSettings, executionAlgo: e.target.value })} 
                      style={inputStyle}
                    >
                      <option value="MARKET">Market</option>
                      <option value="LIMIT">Limit</option>
                      <option value="TWAP">TWAP</option>
                      <option value="VWAP">VWAP</option>
                    </select>
                  </div>

                  {(executionSettings?.executionAlgo === 'TWAP' || executionSettings?.executionAlgo === 'VWAP') && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <Field label={t('algo_slices_count')}>
                        <input 
                          type="number" 
                          value={executionSettings?.algoSlicesCount ?? 10} 
                          onChange={e => setExecutionSettings({ ...executionSettings, algoSlicesCount: Number(e.target.value) })} 
                          style={inputStyle} 
                        />
                      </Field>
                      <Field label={t('algo_duration_mins')}>
                        <input 
                          type="number" 
                          value={executionSettings?.algoDurationMinutes ?? 30} 
                          onChange={e => setExecutionSettings({ ...executionSettings, algoDurationMinutes: Number(e.target.value) })} 
                          style={inputStyle} 
                        />
                      </Field>
                    </div>
                  )}

                  {executionSettings?.executionAlgo === 'VWAP' && (
                    <Field label={t('vwap_lookback_days')}>
                      <input 
                        type="number" 
                        value={executionSettings?.vwapLookbackDays ?? 5} 
                        onChange={e => setExecutionSettings({ ...executionSettings, vwapLookbackDays: Number(e.target.value) })} 
                        style={inputStyle} 
                      />
                    </Field>
                  )}
                </div>
              )}

              <button 
                onClick={() => { onSave(); setSettingsOpen(false); }}
                style={{ ...primaryBtnStyle, width: '100%', padding: '12px' }}
              >
                {t('save_settings')}
              </button>
            </div>
          </div>
        </div>
      )}

      {saveModalOpen && (
        <div className="modal-overlay" onClick={() => setSaveModalOpen(false)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
              width: '450px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '32px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Сохранить стратегию</div>
              <button onClick={() => setSaveModalOpen(false)} style={{ background: 'var(--bg-accent)', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Field label="Описание изменений (версии)">
                <input 
                  type="text" 
                  value={versionLabel}
                  onChange={e => setVersionLabel(e.target.value)}
                  placeholder="Например: Добавил EMA фильтр"
                  style={inputStyle}
                  autoFocus
                />
              </Field>
              <button 
                onClick={() => executeSave(versionLabel)}
                style={{ ...primaryBtnStyle, width: '100%', padding: '12px' }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {versionsOpen && (
        <div className="modal-overlay" onClick={() => setVersionsOpen(false)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
              width: '600px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '32px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>История версий</div>
              <button onClick={() => setVersionsOpen(false)} style={{ background: 'var(--bg-accent)', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
              {versionsList.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px' }}>
                  Нет сохраненных версий для этой стратегии.
                </div>
              ) : (
                versionsList.map(v => (
                  <div key={v.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px', background: 'var(--bg-accent)', border: '1px solid var(--border-color)',
                    borderRadius: '16px', transition: 'var(--transition)'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-color)' }}>Версия {v.version}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {new Date(v.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '6px' }}>
                        {v.label || 'Без описания'}
                      </div>
                    </div>
                    <button
                      onClick={() => onRestoreVersion(v.version)}
                      style={{ ...secondaryBtnStyle, padding: '8px 16px', fontSize: '11px' }}
                    >
                      Восстановить
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {optimizeOpen && (
        <div className="modal-overlay" onClick={() => !optimizeLoading && setOptimizeOpen(false)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
              width: '650px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '32px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-color)', boxShadow: '0 0 12px var(--accent-color)', animation: 'pulse 1.5s infinite' }}></div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Генетический Оптимизатор</div>
              </div>
              {!optimizeLoading && (
                <button onClick={() => setOptimizeOpen(false)} style={{ background: 'var(--bg-accent)', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
              )}
            </div>

            {optimizeLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '20px' }}>
                <div className="spinner" style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.1)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Эволюционный подбор параметров...</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '380px' }}>
                  Hermes симулирует сотни комбинаций в бэктест-системе. Пожалуйста, подождите, это может занять несколько секунд.
                </div>
              </div>
            ) : optimizeResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>Доходность</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>+{optimizeResult.profit?.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>Коэф. Шарпа</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{optimizeResult.sharpe?.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>Сделок</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{optimizeResult.trades}</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>Сравнение параметров</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                    {getOptimizableParamsFromState().map((p, idx) => {
                      const lookupKey = `${p.nodeId}:${p.key}`;
                      const optimizedVal = optimizeResult.params[lookupKey];
                      const displayOptVal = p.key.toLowerCase().includes('period') || p.key.toLowerCase().includes('minutes')
                        ? Math.round(optimizedVal)
                        : Number(optimizedVal?.toFixed(4));
                      
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-accent)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginRight: '8px' }}>{p.nodeName}</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.key}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>{p.val}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--success)' }}>{displayOptVal}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button 
                    onClick={() => setOptimizeResult(null)} 
                    style={{ ...secondaryBtnStyle, padding: '12px' }}
                  >
                    Повторить
                  </button>
                  <button 
                    onClick={applyOptimizedParams} 
                    style={{ ...primaryBtnStyle, padding: '12px', background: 'var(--success)' }}
                  >
                    Применить параметры
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: 'var(--bg-accent)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>Найденные числовые переменные</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {getOptimizableParamsFromState().map((p, idx) => (
                      <span key={idx} style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        <span style={{ opacity: 0.6 }}>{p.nodeName}:</span> {p.key} ({p.val})
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  <Field label="Глубина истории тестирования (дней)">
                    <input 
                      type="number" 
                      value={optimizeDays} 
                      onChange={e => setOptimizeDays(Number(e.target.value))} 
                      style={inputStyle} 
                    />
                  </Field>
                </div>

                {optimizeError && (
                  <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(239,68,68,0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.1)' }}>
                    ⚠️ {optimizeError}
                  </div>
                )}

                <button 
                  onClick={runOptimization} 
                  style={{ ...primaryBtnStyle, padding: '14px', background: 'var(--accent-color)', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5"/><path d="M12 2v10"/><path d="m9 9 3 3 3-3"/></svg>
                  Запустить оптимизацию
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bot Codegen Modal ────────────────────────────────────────── */}
      {codegenOpen && (
        <div className="modal-overlay" onClick={closeCodegen} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
            width: '720px', maxHeight: '90vh', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' 
          }}>
            {/* Header */}
            <div style={{ padding: '24px 30px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--accent-color)', borderRadius: '12px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={24} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('bot_generator')}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{strategyName}</div>
                </div>
              </div>
              <button onClick={() => setCodegenOpen(false)} style={{ background: 'var(--bg-accent)', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-accent)', borderBottom: '1px solid var(--border-color)', padding: '0 20px' }}>
              <button onClick={() => setCodegenActiveTab('config')} style={{
                background: 'none', border: 'none', borderBottom: codegenActiveTab === 'config' ? '2px solid var(--accent-color)' : '2px solid transparent',
                color: codegenActiveTab === 'config' ? 'var(--text-primary)' : 'var(--text-secondary)',
                padding: '16px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, transition: 'all 0.2s'
              }}>{t('configuration')}</button>
              <button onClick={() => setCodegenActiveTab('preview')} style={{
                background: 'none', border: 'none', borderBottom: codegenActiveTab === 'preview' ? '2px solid var(--accent-color)' : '2px solid transparent',
                color: codegenActiveTab === 'preview' ? 'var(--text-primary)' : 'var(--text-secondary)',
                padding: '16px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, transition: 'all 0.2s'
              }}>{t('preview_code')}</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
              {codegenActiveTab === 'config' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* Validation Status */}
                  {codegenValidation && (
                    <div style={{
                      padding: '16px 20px', borderRadius: 14,
                      background: codegenValidation.valid ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                      border: `1px solid ${codegenValidation.valid ? 'var(--success)' : 'var(--danger)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: codegenValidation.errors.length + codegenValidation.warnings.length > 0 ? 12 : 0 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: codegenValidation.valid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: codegenValidation.valid ? 'var(--success)' : 'var(--danger)', fontSize: 14, fontWeight: 900,
                        }}>
                          {codegenValidation.valid ? '✓' : '✕'}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: codegenValidation.valid ? 'var(--success)' : 'var(--danger)' }}>
                            {codegenValidation.valid ? t('strategy_is_valid') : t('strategy_has_errors')}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {t('nodes_connected').replace('{total}', codegenValidation.stats.totalNodes.toString()).replace('{connected}', codegenValidation.stats.connectedNodes.toString())}
                            {codegenValidation.stats.orphanNodes > 0 && ` · Orphan: ${codegenValidation.stats.orphanNodes}`}
                          </div>
                        </div>
                      </div>

                      {codegenValidation.errors.map((err: any, i: number) => (
                        <div key={`e-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, marginBottom: 6 }}>
                          <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>⊘</span>
                          <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, lineHeight: 1.5 }}>{err.message}</span>
                        </div>
                      ))}
                      {codegenValidation.warnings.map((w: any, i: number) => (
                        <div key={`w-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 8, marginBottom: 6 }}>
                          <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>⚠</span>
                          <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, lineHeight: 1.5 }}>{w.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error Banner */}
                  {codegenStatus === 'error' && codegenErrorText && (
                    <div style={{ padding: '14px 20px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 12, border: '1px solid var(--danger)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>{t('codegen_error')}</div>
                      <div style={{ fontSize: 12, color: 'var(--danger)', whiteSpace: 'pre-line', lineHeight: 1.5, opacity: 0.85 }}>{codegenErrorText}</div>
                    </div>
                  )}

                  {codegenStatus === 'done' && codegenResult && (
                    <div style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 16, border: '1px solid var(--success)', marginBottom: '20px' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--success)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Play size={16} fill="currentColor" /> {t('bot_ready_deploy')}
                      </div>
                      <div style={{ background: '#000', borderRadius: 12, padding: '16px', fontFamily: 'monospace', fontSize: 12, color: '#a6e3a1', marginBottom: 16, lineHeight: 1.6 }}>
                        <span style={{ color: '#6c7086' }}>{t('run_one_click')}</span><br/>
                        cd {codegenConfig.botName}<br/>
                        docker-compose up -d --build
                      </div>
                      <a href={`/api/codegen/download/${codegenResult.botId}`} download
                        style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '12px', background: 'var(--accent-color)', color: '#fff', borderRadius: 12, textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)' }}>
                        <Download size={18} /> {t('download_zip')}
                      </a>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('process_name')}</label>
                    <input value={codegenConfig.botName} onChange={e => setCodegenConfig(c => ({ ...c, botName: e.target.value }))}
                      style={inputStyle} placeholder="my-strategy-bot" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('trading_pairs_label')}</label>
                    <input value={codegenConfig.tradingPairs} onChange={e => setCodegenConfig(c => ({ ...c, tradingPairs: e.target.value }))}
                      style={inputStyle} placeholder="BTCUSDT, ETHUSDT" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('timeframe_label_cg')}</label>
                      <select value={codegenConfig.timeframe} onChange={e => setCodegenConfig(c => ({ ...c, timeframe: e.target.value }))} style={selectStyle}>
                        {['1m','3m','5m','15m','30m','1h','4h','1d'].map(tf => <option key={tf}>{tf}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('check_interval')}</label>
                      <input type="number" value={codegenConfig.checkIntervalSeconds} min={5}
                        onChange={e => setCodegenConfig(c => ({ ...c, checkIntervalSeconds: Number(e.target.value) }))}
                        style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}

              {codegenActiveTab === 'preview' && (
                <PythonPreview code={previewCode || '# ' + t('generating')} maxHeight={400} />
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 30px', background: 'var(--bg-accent)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setCodegenOpen(false)} style={secondaryBtnStyle}>{t('close')}</button>
              {codegenActiveTab === 'config' && (
                <button 
                  disabled={codegenStatus === 'loading' || (codegenValidation !== null && !codegenValidation.valid)}
                  onClick={runCodegen} 
                  style={{
                    ...primaryBtnStyle, 
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: (codegenValidation !== null && !codegenValidation.valid) ? 'var(--bg-accent)' : 'var(--accent-color)',
                    color: (codegenValidation !== null && !codegenValidation.valid) ? 'var(--text-secondary)' : '#fff',
                    cursor: (codegenValidation !== null && !codegenValidation.valid) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {codegenStatus === 'loading' ? t('generating') :
                   (codegenValidation !== null && !codegenValidation.valid) ? <><Bot size={16} /> {t('fix_errors')}</> :
                   <><Bot size={16} /> {t('create_bot_files')}</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const BacktestResults = ({ result }: { result: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null);
  const isPos = result.totalReturn >= 0;
  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const selectedTrade = selectedTradeIndex !== null ? result.trades[selectedTradeIndex] : null;
  const openTradeProp = selectedTrade ? {
    entryPrice: selectedTrade.entryPrice,
    type: selectedTrade.type,
    stopPrice: selectedTrade.exitReason?.includes('SL') || selectedTrade.exitReason?.includes('Trail') || selectedTrade.pnlPercent < 0 ? selectedTrade.exitPrice : undefined,
    tp: selectedTrade.pnlPercent > 0 ? `${Math.abs(selectedTrade.pnlPercent)}%` : undefined,
    sl: selectedTrade.pnlPercent < 0 ? `${Math.abs(selectedTrade.pnlPercent)}%` : undefined,
  } : null;

  return (
    <div style={{ padding: '0 32px 32px', background: 'var(--bg-primary)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Доходность" value={`${isPos ? '+' : ''}${result.totalReturn}%`} color={isPos ? 'var(--success)' : 'var(--danger)'} bg="var(--bg-secondary)" />
        <StatCard label="Win Rate" value={`${result.winRate}%`} bg="var(--bg-secondary)" />
        <StatCard label="Max Drawdown" value={`${result.maxDrawdown}%`} color={result.maxDrawdown > 15 ? 'var(--danger)' : 'var(--text-primary)'} bg="var(--bg-secondary)" />
        <StatCard label="Recovery" value={result.recoveryFactor} bg="var(--bg-secondary)" />
        <StatCard label="Сделок" value={result.totalTrades} bg="var(--bg-secondary)" />
      </div>

      {result.candles && result.candles.length > 0 && (
        <div style={{ height: '350px', marginBottom: '24px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
            <button
              onClick={() => setIsExpanded(true)}
              style={{
                background: 'rgba(22, 24, 30, 0.85)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'var(--transition)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent-color)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(22, 24, 30, 0.85)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
            >
              <Maximize2 size={12} /> Развернуть график
            </button>
          </div>
          <MarketChart 
            data={result.candles} 
            signals={result.trades || []} 
            openTrade={openTradeProp}
          />
        </div>
      )}

      {isExpanded && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(5, 6, 8, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            width: '95vw',
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📊 Полноэкранный график анализа бэктеста
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Детальный просмотр свечей, паттернов, уровней и точек входа/выхода стратегии {selectedTradeIndex !== null && `(Выбрана сделка #${selectedTradeIndex + 1})`}
                </p>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                style={{
                  background: 'var(--bg-accent)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'var(--bg-accent)';
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <MarketChart 
                data={result.candles} 
                signals={result.trades || []} 
                openTrade={openTradeProp}
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 120px', background: 'var(--bg-accent)', padding: '10px 16px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase' }}>
          <span>Тип</span><span>Вход</span><span>Выход</span><span style={{ textAlign: 'right' }}>P&L %</span>
        </div>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {result.trades.map((t: any, i: number) => (
            <div 
              key={i} 
              onClick={() => setSelectedTradeIndex(selectedTradeIndex === i ? null : i)}
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '80px 1fr 1fr 120px', 
                padding: '12px 16px', 
                fontSize: '12px', 
                borderTop: '1px solid var(--border-color)', 
                color: 'var(--text-primary)',
                cursor: 'pointer',
                background: selectedTradeIndex === i ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                borderLeft: selectedTradeIndex === i ? '3px solid var(--accent-color)' : '3px solid transparent',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                if (selectedTradeIndex !== i) e.currentTarget.style.background = 'var(--bg-accent)';
              }}
              onMouseLeave={e => {
                if (selectedTradeIndex !== i) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontWeight: 700, color: t.type === 'LONG' ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center' }}>{t.type}</span>
              <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span>${fmt(t.entryPrice)}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{new Date(t.entryTime).toLocaleDateString([], {day: 'numeric', month: 'short'})}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span>${fmt(t.exitPrice)}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t.exitTime ? new Date(t.exitTime).toLocaleDateString([], {day: 'numeric', month: 'short'}) : '--'}</span>
              </span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: t.pnl >= 0 ? 'var(--success)' : 'var(--danger)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                <span>{t.pnlPercent}%</span>
                {renderExitReasonBadge(t.exitReason, t.pnl)}
              </span>
            </div>
          ))}
        </div>
      </div>
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
  <div style={{ padding: '16px', background: bg, borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: '18px', fontWeight: 800, color }}>{value}</div>
  </div>
);

const iconBtnStyle: React.CSSProperties = {
  fontSize: '12px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)',
  background: 'var(--bg-accent)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: '8px', transition: 'var(--transition)'
};

const primaryBtnStyle: React.CSSProperties = {
  fontSize: '12px', padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontWeight: 700,
  transition: 'var(--transition)'
};

const secondaryBtnStyle: React.CSSProperties = {
  fontSize: '12px', padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)',
  background: 'var(--bg-accent)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700,
  transition: 'var(--transition)'
};

const selectStyle: React.CSSProperties = {
  fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)',
  background: 'var(--bg-input)', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
  fontWeight: 600
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)',
  background: 'var(--bg-input)', fontSize: '13px', outline: 'none', color: 'var(--text-primary)',
  boxSizing: 'border-box'
};

export default StrategyBuilder;
