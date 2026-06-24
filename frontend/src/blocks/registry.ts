export type BlockCategory = 'Входные' | '🔌 Биржи' | 'Индикаторы' | 'Smart Money' | '📊 Order Flow' | '🧠 AI Прогноз' | '📈 Статистика' | 'Логика' | 'Фильтры' | 'Выходные' | '🚀 Торговля';

export interface BlockConfig {
  type: string;
  id: string;
  name: string;
  category: BlockCategory;
  dotColor: string;
  defaultData: Record<string, any>;
}

export const registry: Record<string, BlockConfig> = {
  // Входные
  input_mark_price: { type: 'input', id: 'input_mark_price', name: 'Mark Price', category: 'Входные', dotColor: '#6366F1', defaultData: { source: 'markPrice', params: { pair: '', operator: 'none' } } },
  input_open_interest: { type: 'input', id: 'input_open_interest', name: 'Open Interest', category: 'Входные', dotColor: '#6366F1', defaultData: { source: 'openInterest', params: { pair: '', operator: 'none' } } },
  input_funding_rate: { type: 'input', id: 'input_funding_rate', name: 'Funding Rate', category: 'Входные', dotColor: '#F59E0B', defaultData: { source: 'fundingRate', params: { pair: '', operator: 'none' } } },
  scanner_volume24h: { type: 'scanner', id: 'scanner_volume24h', name: '24h Volume', category: 'Входные', dotColor: '#F59E0B', defaultData: { source: 'volume24h' } },
  scanner_change24h: { type: 'scanner', id: 'scanner_change24h', name: '24h Change %', category: 'Входные', dotColor: '#F59E0B', defaultData: { source: 'change24h' } },
  user_level: { type: 'user_level', id: 'user_level', name: 'User Chart Level', category: 'Входные', dotColor: '#6366f1', defaultData: { type: 'horizontal_line', params: { levelId: 0 } } },
  input_webhook: { type: 'webhook', id: 'input_webhook', name: 'External Webhook', category: 'Входные', dotColor: '#8b5cf6', defaultData: { urlSuffix: '' } },
  polymarket_scanner: { type: 'polymarket_scanner', id: 'polymarket_scanner', name: '🔮 Polymarket Whales', category: 'Входные', dotColor: '#0046ff', defaultData: { minAmountUsd: 10000, marketSlug: '' } },
  finviz_scanner: { type: 'finviz_scanner', id: 'finviz_scanner', name: '📈 Finviz Stock Scanner', category: 'Входные', dotColor: '#00ffbb', defaultData: { signal: 'top_gainers', minVolume: '1,000,000', minPrice: 10 } },
  deribit_pcr: { type: 'deribit_pcr', id: 'deribit_pcr', name: '📊 Deribit Put-Call Ratio', category: 'Входные', dotColor: '#3b82f6', defaultData: {} },

  // Exchange Connectors
  exch_universal: { type: 'exchange', id: 'exch_universal', name: '🔌 Exchange Connector', category: '🔌 Биржи', dotColor: '#F0B90B', defaultData: { exchange: 'binance', mode: 'ticker', dataType: 'price', pair: 'BTCUSDT' } },
  
  // Индикаторы
  indicator_rsi: { type: 'indicator', id: 'indicator_rsi', name: 'RSI', category: 'Индикаторы', dotColor: '#A855F7', defaultData: { name: 'RSI', params: { period: 14 } } },
  indicator_divergence: { type: 'indicator', id: 'indicator_divergence', name: 'Divergence', category: 'Индикаторы', dotColor: '#A855F7', defaultData: { name: 'Divergence', params: { source: 'RSI' } } },
  indicator_sma: { type: 'indicator', id: 'indicator_sma', name: 'SMA', category: 'Индикаторы', dotColor: '#A855F7', defaultData: { name: 'SMA', params: { period: 20 } } },
  indicator_ema: { type: 'indicator', id: 'indicator_ema', name: 'EMA', category: 'Индикаторы', dotColor: '#A855F7', defaultData: { name: 'EMA', params: { period: 20 } } },
  indicator_macd: { type: 'indicator', id: 'indicator_macd', name: 'MACD', category: 'Индикаторы', dotColor: '#A855F7', defaultData: { name: 'MACD', params: { fast: 12, slow: 26, signal: 9 } } },
  indicator_bb: { type: 'indicator', id: 'indicator_bb', name: 'Bollinger Bands', category: 'Индикаторы', dotColor: '#A855F7', defaultData: { name: 'BB', params: { period: 20, stdDev: 2 } } },
  indicator_atr: { type: 'indicator', id: 'indicator_atr', name: 'ATR', category: 'Индикаторы', dotColor: '#A855F7', defaultData: { name: 'ATR', params: { period: 14 } } },
  indicator_stoch: { type: 'indicator', id: 'indicator_stoch', name: 'Stochastic', category: 'Индикаторы', dotColor: '#A855F7', defaultData: { name: 'Stoch', params: { k: 14, d: 3, smooth: 3 } } },
  indicator_volume: { type: 'indicator', id: 'indicator_volume', name: 'Volume', category: 'Индикаторы', dotColor: '#A855F7', defaultData: { name: 'Volume', params: {} } },
  indicator_adx: { type: 'indicator', id: 'indicator_adx', name: 'ADX', category: 'Индикаторы', dotColor: '#F59E0B', defaultData: { name: 'ADX', property: 'adx', params: { period: 14 } } },
  indicator_candle_pattern: { type: 'indicator', id: 'indicator_candle_pattern', name: 'Candle Pattern', category: 'Индикаторы', dotColor: '#EC4899', defaultData: { name: 'CandlePattern', params: { pattern: 'any' } } },
  
  // Smart Money
  smc_fvg: { type: 'smc', id: 'smc_fvg', name: 'Fair Value Gap', category: 'Smart Money', dotColor: '#F59E0B', defaultData: { type: 'fvg', params: { lookback: 50 } } },
  smc_ob: { type: 'smc', id: 'smc_ob', name: 'Order Block', category: 'Smart Money', dotColor: '#F59E0B', defaultData: { type: 'order_block', params: { lookback: 50 } } },
  smc_sweep: { type: 'smc', id: 'smc_sweep', name: 'Liquidity Sweep', category: 'Smart Money', dotColor: '#F59E0B', defaultData: { type: 'liquidity_sweep', params: { lookback: 50 } } },
  smc_ms: { type: 'smc', id: 'smc_ms', name: 'Market Structure', category: 'Smart Money', dotColor: '#F59E0B', defaultData: { type: 'market_structure', params: { lookback: 50 } } },
  smc_bias: { type: 'smc', id: 'smc_bias', name: 'Daily Bias', category: 'Smart Money', dotColor: '#F59E0B', defaultData: { type: 'daily_bias', params: { lookback: 50 } } },
  smc_po3: { type: 'smc', id: 'smc_po3', name: 'Power of 3', category: 'Smart Money', dotColor: '#F59E0B', defaultData: { type: 'power_of_3', params: { lookback: 50 } } },
  smc_pd: { type: 'smc', id: 'smc_pd', name: 'Premium/Discount', category: 'Smart Money', dotColor: '#F59E0B', defaultData: { type: 'premium_discount', params: { lookback: 50 } } },
  smc_killzone: { type: 'smc', id: 'smc_killzone', name: 'ICT Killzone', category: 'Smart Money', dotColor: '#F59E0B', defaultData: { type: 'ict_killzone', params: { lookback: 50 } } },

  // Order Flow
  of_delta: { type: 'order_flow', id: 'of_delta', name: 'Volume Delta', category: '📊 Order Flow', dotColor: '#0ea5e9', defaultData: { metric: 'delta', period: '1h' } },
  of_cvd: { type: 'order_flow', id: 'of_cvd', name: 'CVD (Cumulative)', category: '📊 Order Flow', dotColor: '#0ea5e9', defaultData: { metric: 'cvd' } },
  of_liq: { type: 'order_flow', id: 'of_liq', name: 'Liquidations', category: '📊 Order Flow', dotColor: '#ef4444', defaultData: { side: 'BOTH', threshold: 1000000 } },
  of_wall: { type: 'orderbook', id: 'of_wall', name: 'Orderbook Wall', category: '📊 Order Flow', dotColor: '#0ea5e9', defaultData: { params: { side: 'BUY', volume: 10, rangePct: 1 } } },

  // AI Прогноз
  ai_direction: { type: 'ai_forecast', id: 'ai_direction', name: 'AI Forecast', category: '🧠 AI Прогноз', dotColor: '#a855f7', defaultData: { property: 'direction', predLen: 24, model: 'auto', minConfidence: 0.6 } },
  ai_price: { type: 'ai_forecast', id: 'ai_price', name: 'AI Цена', category: '🧠 AI Прогноз', dotColor: '#a855f7', defaultData: { property: 'predicted_close', predLen: 24, model: 'auto', minConfidence: 0.6 } },
  sentiment_score: { type: 'sentiment', id: 'sentiment_score', name: 'Market Sentiment', category: '🧠 AI Прогноз', dotColor: '#10b981', defaultData: {} },
  ml_predictor: { type: 'ml_filter', id: 'ml_predictor', name: 'ML Predictor', category: '🧠 AI Прогноз', dotColor: '#8b5cf6', defaultData: { modelId: null, minScore: 0.7 } },
  hermes_agent: { type: 'hermes', id: 'hermes_agent', name: 'Hermes Agent', category: '🧠 AI Прогноз', dotColor: '#ec4899', defaultData: { mode: 'filter', model: 'nous-hermes-3', cacheMinutes: 15 } },
  heym_mcp:     { type: 'heym_mcp', id: 'heym_mcp', name: '⚡ heym Validator', category: '🧠 AI Прогноз', dotColor: '#6366f1', defaultData: { mode: 'filter', mockBacktest: true, additionalContext: '' } },
  mcp_tool:     { type: 'mcp_tool', id: 'mcp_tool', name: '🛠️ MCP Tool Call', category: '🧠 AI Прогноз', dotColor: '#a855f7', defaultData: { workflowId: '', inputData: '{}', mode: 'value', outputKey: 'result', mockBacktest: true } },


  // Статистика
  stats_vwap: { type: 'indicator', id: 'stats_vwap', name: 'VWAP', category: '📈 Статистика', dotColor: '#10b981', defaultData: { name: 'VWAP', params: { anchor: 'D' } } },
  stats_zscore: { type: 'indicator', id: 'stats_zscore', name: 'Z-Score', category: '📈 Статистика', dotColor: '#6366f1', defaultData: { name: 'ZScore', params: { period: 20 } } },
  stats_adr: { type: 'indicator', id: 'stats_adr', name: 'ADR Exhaustion', category: '📈 Статистика', dotColor: '#f59e0b', defaultData: { name: 'ADR', params: { period: 7, threshold: 90 } } },

  // Логика
  logic_and: { type: 'logic', id: 'logic_and', name: 'AND', category: 'Логика', dotColor: '#10B981', defaultData: { operator: 'AND', inputsCount: 2 } },
  logic_or: { type: 'logic', id: 'logic_or', name: 'OR', category: 'Логика', dotColor: '#10B981', defaultData: { operator: 'OR', inputsCount: 2 } },
  logic_corr: { type: 'logic', id: 'logic_corr', name: 'Correlation Filter', category: 'Логика', dotColor: '#6366f1', defaultData: { pair: 'BTCUSDT', minCorr: 0.8 } },
  
  comp_cross_above: { type: 'comparison', id: 'comp_cross_above', name: 'Cross Above', category: 'Логика', dotColor: '#10B981', defaultData: { operator: 'cross_above' } },
  comp_cross_below: { type: 'comparison', id: 'comp_cross_below', name: 'Cross Below', category: 'Логика', dotColor: '#10B981', defaultData: { operator: 'cross_below' } },
  comp_gt_lt: { type: 'comparison', id: 'comp_gt_lt', name: '> / <', category: 'Логика', dotColor: '#6B7280', defaultData: { operator: '>' } },
  custom_script: { type: 'custom_code', id: 'custom_script', name: 'Custom Script', category: 'Логика', dotColor: '#6366f1', defaultData: { name: 'My Logic', code: 'return close[0] > high[1];' } },
  fusion_combiner: { type: 'fusion_combiner', id: 'fusion_combiner', name: '🎛️ Fusion Combiner', category: 'Логика', dotColor: '#ec4899', defaultData: { weights: {}, params: { threshold: 0.5, enableLearning: false, alpha: 0.1 } } },

  // Фильтры
  filter_killzone: { type: 'timeFilter', id: 'filter_killzone', name: 'Killzone', category: 'Фильтры', dotColor: '#A855F7', defaultData: { from: '08:00', to: '11:00', timezone: 'UTC' } },
  filter_mtf: { type: 'mtf', id: 'filter_mtf', name: 'MTF АНАЛИЗ', category: 'Фильтры', dotColor: '#ec4899', defaultData: { timeframe: '1H' } },
  deep_research: {
    type: 'deep_research',
    id: 'deep_research',
    name: '🔬 Deep Research (LDR)',
    category: 'Фильтры',
    dotColor: '#6366f1',
    defaultData: {
      query: 'Analyze recent news, regulatory risks, hacks or market-moving events for {{pair}} cryptocurrency.',
      mode: 'quick',
      cacheMinutes: 15,
      riskThreshold: 'high',
      outputMode: 'risk_filter',
      enableHermesEnrich: false,
    },
  },
  portfolio_risk_sizer: {
    type: 'portfolio_risk_sizer',
    id: 'portfolio_risk_sizer',
    name: '⚖️ Portfolio Risk Sizer',
    category: 'Фильтры',
    dotColor: '#f59e0b',
    defaultData: {
      baseSize: 100,
      riskModel: 'equal_risk',
      correlationThreshold: 0.7,
      volatilityLookback: 14,
    },
  },

  // Выходные
  signal_long: { type: 'signal', id: 'signal_long', name: 'LONG сигнал', category: 'Выходные', dotColor: '#10B981', defaultData: { signalType: 'LONG' } },
  signal_short: { type: 'signal', id: 'signal_short', name: 'SHORT сигнал', category: 'Выходные', dotColor: '#EF4444', defaultData: { signalType: 'SHORT' } },

  // Торговые действия
  trade_market_order: { type: 'trade_action', id: 'trade_market_order', name: 'Market Order', category: '🚀 Торговля', dotColor: '#3b82f6', defaultData: { action: 'market_order', side: 'BUY', volume: '100%' } },
  trade_limit_order:  { type: 'trade_action', id: 'trade_limit_order',  name: 'Limit Order',  category: '🚀 Торговля', dotColor: '#f59e0b', defaultData: { action: 'limit_order', side: 'BUY', volume: '100%', offset: '-0.5%' } },
  trade_sltp: {
    type: 'trade_action', id: 'trade_sltp', name: 'SL / TP', category: '🚀 Торговля', dotColor: '#10b981',
    defaultData: {
      action: 'sltp',
      sl: '1%',
      tp: '3%',
      useTrailing: false,
      trailingDistance: '1%',
      trailingActivation: '0.5%',
      moveSLtoBE: false,
      partialTPs: [],
    },
  },

  trade_risk:         { type: 'trade_action', id: 'trade_risk',         name: 'Risk Guard',   category: '🚀 Торговля', dotColor: '#ef4444', defaultData: { action: 'risk', maxDrawdown: '5%', maxExposure: '20%' } },
  trade_webhook:      { type: 'trade_action', id: 'trade_webhook',      name: 'Webhook',      category: '🚀 Торговля', dotColor: '#8b5cf6', defaultData: { action: 'webhook', url: '', method: 'POST' } },
  trade_telegram:     { type: 'trade_action', id: 'trade_telegram',     name: 'Telegram Alert', category: '🚀 Торговля', dotColor: '#0088cc', defaultData: { action: 'telegram', telegramMessage: 'Сигнал: {{signal}} на {{pair}} по цене {{price}}' } },
  trade_grid:         { type: 'trade_action', id: 'trade_grid',         name: 'Grid Bot',     category: '🚀 Торговля', dotColor: '#ec4899', defaultData: { action: 'grid', lowerPrice: '60000', upperPrice: '70000', grids: 20, gridType: 'ARITHMETIC', volume: '50%' } },
};

export const CATEGORIES: BlockCategory[] = [
  'Входные', '🔌 Биржи', 'Индикаторы', 'Smart Money', '📊 Order Flow', '🧠 AI Прогноз', '📈 Статистика', 'Логика', 'Фильтры', 'Выходные', '🚀 Торговля'
];

export const getBlockById = (id: string): BlockConfig | undefined => registry[id];

export const getBlocksByCategory = (category: BlockCategory): BlockConfig[] => {
  return Object.values(registry).filter(b => b.category === category);
};

export const EDGE_COLORS: Record<string, string> = {
  input:         '#6366F1',
  indicator:     '#A855F7',
  smc:           '#F59E0B',
  order_flow:    '#0ea5e9',
  stats:         '#6366f1',
  logic:         '#10B981',
  comparison:    '#6B7280',
  timeFilter:    '#A855F7',
  signal:        '#EF4444',
  scanner:       '#F59E0B',
  ai_forecast:   '#A855F7',
  sentiment:     '#10b981',
  orderbook:     '#0ea5e9',
  cross:         '#10B981',
  pump_dump:     '#EF4444',
  user_level:    '#6366f1',
  hermes:        '#ec4899',
  heym_mcp:      '#6366f1',
  mcp_tool:      '#a855f7',
  mtf:           '#ec4899',
  exchange:      '#F0B90B',
  exchange_data: '#F0B90B',
  trade_action:  '#3b82f6',
  webhook:       '#8b5cf6',
  polymarket_scanner: '#0046ff',
  finviz_scanner: '#00ffbb',
  deribit_pcr: '#3b82f6',
  fusion_combiner: '#ec4899',
  deep_research: '#6366f1',
  portfolio_risk_sizer: '#f59e0b',
};
