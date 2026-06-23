import React, { useState } from 'react';
import { Trash2, HelpCircle, BookOpen, X, Search, Play } from 'lucide-react';
import NodePreviewChart from './NodePreviewChart';
import { useStrategyStore } from '../stores/strategyStore';
import { useLanguageStore } from '../stores/useLanguageStore';



// Advanced Documentation Object (Russian)
const NODE_DOCS_RU: Record<string, any> = {
    input: { title: 'Входные данные', desc: 'Начальная точка стратегии. Выбираете поток данных (цена, открытый интерес, ставка финансирования).', logic: 'Mark Price — текущая цена актива. Open Interest — сумма всех открытых позиций (рост OI часто подтверждает тренд).' },
    markPrice: { title: 'Mark Price (Цена маркировки)', desc: 'Основной ценовой поток данных для расчетов.', logic: 'Обычно используется как база для индикаторов или для сравнения с фиксированным уровнем.' },
    openInterest: { title: 'Open Interest (Открытый интерес)', desc: 'Общее количество открытых фьючерсных контрактов.', logic: 'Рост OI вместе с ценой — сильный бычий сигнал. Падение OI на росте цены — предупреждение о развороте.' },
    fundingRate: { title: 'Funding Rate (Ставка финансирования)', desc: 'Периодические выплаты между лонгистами и шортистами.', logic: 'Высокий положительный фандинг (>0.01%) — перегрев лонгов. Отрицательный — перекос в сторону шортов.' },
    logic: { title: 'Логический оператор', desc: 'Позволяет объединять условия. AND (И) требует выполнения ВСЕХ условий сразу. OR (ИЛИ) — хотя бы одного.', logic: 'Пример: (RSI < 30) AND (Цена в Киллизоне) → Сигнал.', img: '/assets/docs/logic_tut.png' },
    signal: { title: 'Торговый сигнал', desc: 'Итог стратегии. Отправляет уведомление LONG или SHORT в Telegram.', logic: 'LONG — покупка, SHORT — продажа.' },
    RSI: { title: 'RSI (Relative Strength Index)', desc: 'Индекс относительной силы. Показывает, перекуплен актив (>70) или перепродан (<30).', logic: 'Классика: покупай, когда RSI падает ниже 30.', img: '/assets/docs/rsi_tut.png' },
    Divergence: { title: 'Дивергенция', desc: 'Расхождение между ценой и индикатором. Один из сильнейших сигналов разворота.', logic: 'Бычья: цена падает, RSI растет. Медвежья: цена растет, RSI падает.', img: '/assets/docs/div_tut.png' },
    SMA: { title: 'SMA (Simple Moving Average)', desc: 'Средняя цена за период. Сглаживает колебания, показывая тренд.', logic: 'Если цена выше SMA — тренд растущий, если ниже — падающий.', img: '/assets/docs/sma_tut.png' },
    EMA: { title: 'EMA (Exponential Moving Average)', desc: 'Экспоненциальная средняя. Быстрее реагирует на свежие изменения цены.', logic: 'Отлично подходит для динамических уровней поддержки.', img: '/assets/docs/sma_tut.png' },
    MACD: { title: 'MACD', desc: 'Показывает взаимосвязь между двумя средними ценами. Ищет развороты тренда.', logic: 'Сигнал возникает при пересечении линий или выходе гистограммы из нуля.', img: '/assets/docs/macd_tut.png' },
    BB: { title: 'Bollinger Bands', desc: 'Полосы Боллинджера измеряют волатильность рынка. Состоят из простой скользящей средней и двух стандартных отклонений.', logic: 'Пробитие нижней полосы — сигнал к перепроданности (возможен отскок вверх).' },
    ATR: { title: 'ATR (Average True Range)', desc: 'Средний истинный диапазон. Показывает волатильность цены, не указывая направление тренда.', logic: 'Высокий ATR означает высокую волатильность.' },
    Stoch: { title: 'Stochastic Oscillator', desc: 'Стохастический осциллятор. Показывает импульс цены и зоны перекупленности/перепроданности.', logic: 'Линии ниже 20 — перепроданность, выше 80 — перекупленность.' },
    Volume: { title: 'Объем торгов', desc: 'Количество проторгованного актива. Подтверждает истинность движения.', logic: 'Рост цены на высоком объеме — сильный бычий сигнал.', img: '/assets/docs/volume_tut.png' },
    fvg: { title: 'Fair Value Gap (FVG)', desc: 'Дисбаланс между покупателями и продавцами. Оставляет "дыру" на графике. Автономно анализирует структуру свечей.', logic: 'Цена стремится вернуться в зону FVG, чтобы заполнить ликвидность.', img: '/assets/docs/fvg_tut.png' },
    order_block: { title: 'Order Block (OB)', desc: 'Зона набора позиции крупным игроком. Не требует входных данных (анализирует весь график).', logic: 'При возврате к OB часто происходит разворот.', img: '/assets/docs/fvg_tut.png' },
    liquidity_sweep: { title: 'Liquidity Sweep', desc: 'Сбор ликвидности за пределами уровней. Автономный детектор манипуляций.', logic: 'Цена пробивает уровень, собирает стопы и резко разворачивается.' },
    market_structure: { title: 'Market Structure', desc: 'Анализ тренда через BOS и CHoCH. Работает на основе структуры свечей выбранного таймфрейма.', logic: 'Помогает понять, продолжается ли тренд или начался разворот.' },
    daily_bias: { title: 'Daily Bias', desc: 'Определение настроения дня. Автоматически берет данные предыдущей торговой сессии.', logic: 'Помогает торговать в сторону основного дневного движения.' },
    power_of_3: { title: 'Power of 3 (PO3)', desc: 'Концепция накопления, манипуляции и распределения. Анализирует весь торговый день.', logic: 'Ищет Judas Swing для входа в позицию.' },
    premium_discount: { title: 'Premium/Discount', desc: 'Разделение диапазона на зоны дорогой и дешевой цены. Рассчитывается автоматически.', logic: 'Покупаем в дисконте (ниже 0.5), продаем в премиуме (выше 0.5).' },
    ict_killzone: { title: 'ICT Killzone', desc: 'Временные интервалы высокой волатильности. Работает на основе системного времени (UTC).', logic: 'Торгуем только в те часы, когда на рынке есть крупные игроки.' },
    volume24h: { title: '24h Volume', desc: 'Объем торгов за последние 24 часа в USDT.', logic: 'Используйте для фильтрации неликвидных монет.' },
    change24h: { title: '24h Change %', desc: 'Изменение цены за последние 24 часа в процентах.', logic: 'Помогает находить лидеров роста или монеты в дампе.' },
    timeFilter: { title: 'Килл-зоны (Время)', desc: 'Фильтрация сигналов по времени торговых сессий.', logic: 'Самые сильные движения обычно в Лондонскую и Нью-Йоркскую сессии.', img: '/assets/docs/killzone_tut.png' },
    ai_forecast: { title: '🧠 AI Forecast (Kronos)', desc: 'Нейросеть анализирует исторические свечи и генерирует прогноз будущей цены. Модель Kronos (102M параметров) работает на GPU.', logic: 'Используйте direction="UP" + Comparison для усиления rule-based сигналов. Или predicted_change > 1% как самостоятельный триггер.' },
    relative_volume: { title: 'Relative Volume', desc: 'Относительный объем. Показывает во сколько раз объем монеты выше/ниже среднего объема Топ-50 рынка.', logic: 'Значение > 2.0 означает, что монета аномально активна прямо сейчас по сравнению с лидерами рынка.' },
    imbalance: { title: 'Orderbook Imbalance %', desc: 'Анализ дисбаланса объемов между покупателями (Bid) и продавцами (Ask) в стакане.', logic: 'Высокий % Bid означает сильное давление покупателей (стенки снизу).' },
    spread: { title: 'Orderbook Spread', desc: 'Разница между лучшей ценой покупки и продажи.', logic: 'Широкий спред может сигнализировать о низкой ликвидности или сильной волатильности.' },
    wall_distance: { title: 'Wall Distance', desc: 'Дистанция до ближайшей крупной плотности (стенки) в стакане.', logic: 'Помогает ставить стопы за стенками или торговать на отскок от них.' },
    order_flow: { title: 'Order Flow', desc: 'Анализ потока ордеров (дельты) и ликвидности.', logic: 'Delta показывает разницу между рыночными покупками и продажами. CVD помогает видеть общий тренд давления.' },
    liquidations: { title: 'Liquidations', desc: 'Отслеживание принудительных закрытий позиций (ликвидаций) трейдеров.', logic: 'Крупные ликвидации часто происходят на разворотах или ускорениях тренда.' },
    hermes: { title: 'Hermes AI Agent', desc: 'Автономный LLM-агент для фильтрации стратегий. Анализирует контекст рынка через естественный язык.', logic: 'Используйте для сложной фильтрации, которую трудно описать формулами (напр. "Не входи, если рынок выглядит слишком волатильным").' },
    exchange_data: { title: '🔌 Exchange Connector', desc: 'Получает данные напрямую с конкретной биржи через CCXT. Поддерживает Binance, Bybit, OKX, Kraken, Coinbase, HTX.', logic: 'Используйте Price Delta для арбитражных стратегий (разница цен между биржами). Funding Rate — классический инструмент для определения перегрева позиций.' },
    user_level: { title: 'User Chart Level', desc: 'Позволяет задать вручную ценовой уровень (поддержка/сопротивление) и проверить нахождение цены вблизи него.', logic: 'Сигнал срабатывает, когда цена попадает в зону уровня с учетом заданного отклонения.' },
    trade_action: { title: '🚀 Торговое Действие', desc: 'Автоматическое выполнение торговых операций на подключенной бирже.', logic: 'Соедините сигнал (LONG/SHORT) с нодой Market/Limit Order для входа в позицию. Установите SL/TP для защиты.' },
    webhook: { title: '🌐 Webhook', desc: 'Отправляет HTTP-запрос (например, в Discord, Telegram или вашу CRM) при получении сигнала.', logic: 'Настройте URL и метод (POST/GET). При активации стратегии бот отправит данные о сигнале по указанному адресу.' },
    polymarket_scanner: { title: '🔮 Polymarket Scanner', desc: 'Отслеживает аномально крупные ставки ("whale bets") на платформе предсказаний Polymarket (блокчейн Polygon).', logic: 'Срабатывает, если обнаружена одиночная ставка на любой исход, превышающая заданный лимит объема в USD.' },
    finviz_scanner: { title: '📈 Finviz Stock Scanner', desc: 'Сканирует фондовый рынок (NYSE, NASDAQ) на предмет сигналов роста/падения, а также отслеживает транзакции инсайдеров (CEO/CFO).', logic: 'Срабатывает, если акция удовлетворяет фильтру (например, Лидеры роста или Крупные покупки инсайдеров).' },
    mcp_tool: { title: '🛠️ Вызов MCP Tool', desc: 'Запуск произвольного инструмента Model Context Protocol (MCP) через воркфлоу Heym.', logic: 'Помогает гибко передавать рыночный контекст (пару, цену, индикаторы) в формате JSON и получать отфильтрованное решение.' },
    llm_filter: { title: '🤖 LLM Фильтр (Free AI)', desc: 'Фильтрует сигналы стратегии с помощью бесплатных веб-сессий Qwen и DeepSeek.', logic: 'Система отправляет контекст рынка в LLM. Если ответ содержит LONG — сигнал пропускается как LONG, если SHORT — как SHORT, иначе — блокируется (FILTER).' },
};

// Advanced Documentation Object (English)
const NODE_DOCS_EN: Record<string, any> = {
    input: { title: 'Input Data', desc: 'The starting point of your strategy. Choose a data stream (price, open interest, funding rate).', logic: 'Mark Price — the asset\'s current price. Open Interest — sum of all open contracts (rising OI supports a trend).' },
    markPrice: { title: 'Mark Price', desc: 'Main price data stream for calculations.', logic: 'Commonly used as a base for technical indicators or comparing to fixed price levels.' },
    openInterest: { title: 'Open Interest', desc: 'Total number of outstanding derivative contracts.', logic: 'Rising OI together with price suggests strong bullish momentum. Declining OI on price rise warns of potential reversal.' },
    fundingRate: { title: 'Funding Rate', desc: 'Periodic payments between long and short traders.', logic: 'High positive funding (>0.01%) means longs are over-leveraged. Negative means shorts dominate.' },
    logic: { title: 'Logical Operator', desc: 'Combines multiple conditions. AND requires ALL conditions to be met. OR requires at least ONE condition.', logic: 'Example: (RSI < 30) AND (Price in Killzone) → Trigger Signal.', img: '/assets/docs/logic_tut.png' },
    signal: { title: 'Trading Signal', desc: 'The final output of the strategy. Sends a LONG or SHORT alert to Telegram.', logic: 'LONG — Buy order, SHORT — Sell order.' },
    RSI: { title: 'RSI (Relative Strength Index)', desc: 'Relative Strength Index. Shows whether an asset is overbought (>70) or oversold (<30).', logic: 'Classic approach: Buy when RSI dips below 30.', img: '/assets/docs/rsi_tut.png' },
    Divergence: { title: 'Divergence', desc: 'Disagreement between price action and indicator. One of the strongest reversal signals.', logic: 'Bullish: Price makes lower lows, RSI makes higher lows. Bearish: Price makes higher highs, RSI makes lower highs.', img: '/assets/docs/div_tut.png' },
    SMA: { title: 'SMA (Simple Moving Average)', desc: 'Simple Moving Average. Smooths price noise to show the trend.', logic: 'If price is above SMA, trend is up; if below, trend is down.', img: '/assets/docs/sma_tut.png' },
    EMA: { title: 'EMA (Exponential Moving Average)', desc: 'Exponential Moving Average. Reacts faster to recent price changes.', logic: 'Great for dynamic support and resistance levels.', img: '/assets/docs/sma_tut.png' },
    MACD: { title: 'MACD', desc: 'Shows the relationship between two moving averages to spot trend reversals.', logic: 'Signals trigger on line crossovers or histogram moving above/below zero.', img: '/assets/docs/macd_tut.png' },
    BB: { title: 'Bollinger Bands', desc: 'Bollinger Bands measure market volatility. Formed by a simple moving average and standard deviations.', logic: 'Piercing the lower band is a sign of oversold conditions (potential bounce up).' },
    ATR: { title: 'ATR (Average True Range)', desc: 'Average True Range measures price volatility without indicating trend direction.', logic: 'High ATR value indicates high price volatility.' },
    Stoch: { title: 'Stochastic Oscillator', desc: 'Stochastic Oscillator. Measures price momentum and overbought/oversold levels.', logic: 'Lines below 20 represent oversold, above 80 represent overbought.' },
    Volume: { title: 'Trading Volume', desc: 'Amount of assets traded. Confirms the strength of a price movement.', logic: 'Price rise on high volume is a strong bullish confirmation.', img: '/assets/docs/volume_tut.png' },
    fvg: { title: 'Fair Value Gap (FVG)', desc: 'Imbalance between buyers and sellers leaving a "gap" on the chart. Automatically analyzes candle structures.', logic: 'Price tends to revisit FVG zones to fill the liquidity gap.', img: '/assets/docs/fvg_tut.png' },
    order_block: { title: 'Order Block (OB)', desc: 'Position buildup zone of large institutional players. Analyzes the entire chart.', logic: 'Returning to an Order Block often triggers a price reversal.', img: '/assets/docs/fvg_tut.png' },
    liquidity_sweep: { title: 'Liquidity Sweep', desc: 'Sweeping liquidity outside of support/resistance. Autonomous manipulation detector.', logic: 'Price spikes past a level to collect stops and sharply reverses.' },
    market_structure: { title: 'Market Structure', desc: 'Trend analysis via BOS and CHoCH based on selected timeframe structure.', logic: 'Helps determine whether a trend continues or a reversal has begun.' },
    daily_bias: { title: 'Daily Bias', desc: 'Defines the daily trend sentiment based on the previous trading session.', logic: 'Helps trade in alignment with the dominant daily price movement.' },
    power_of_3: { title: 'Power of 3 (PO3)', desc: 'Accumulation, Manipulation, and Distribution concept throughout the trading day.', logic: 'Identifies Judas Swings for trade entries.', img: '/assets/docs/fvg_tut.png' },
    premium_discount: { title: 'Premium/Discount', desc: 'Splits ranges into expensive and cheap pricing zones. Calculated automatically.', logic: 'Buy in the discount zone (< 0.5), Sell in the premium zone (> 0.5).' },
    ict_killzone: { title: 'ICT Killzone', desc: 'High-volatility session time intervals based on system UTC time.', logic: 'Only trade during hours with large institutional activity.' },
    volume24h: { title: '24h Volume', desc: 'Total trading volume over the last 24 hours in USDT.', logic: 'Use to filter out low-liquidity coins.' },
    change24h: { title: '24h Change %', desc: 'Price change percentage over the last 24 hours.', logic: 'Helps find top gainers or coins undergoing a dump.' },
    timeFilter: { title: 'Kill-zones (Time)', desc: 'Filters signals based on trading session times.', logic: 'Strongest moves typically occur during London and New York sessions.', img: '/assets/docs/killzone_tut.png' },
    ai_forecast: { title: '🧠 AI Forecast (Kronos)', desc: 'Neural network analyzes historical candles and predicts future prices. 102M parameters Kronos model.', logic: 'Use direction="UP" + Comparison to strengthen rule-based signals, or predicted_change > 1% as a standalone trigger.' },
    relative_volume: { title: 'Relative Volume', desc: 'Compares active volume against average top 50 market volume.', logic: 'Value > 2.0 means the coin is abnormally active compared to market leaders.' },
    imbalance: { title: 'Orderbook Imbalance %', desc: 'Volume imbalance analysis between buyers (Bids) and sellers (Asks) in the order book.', logic: 'High Bid % indicates strong buy pressure supporting price.' },
    spread: { title: 'Orderbook Spread', desc: 'Difference between the best bid and ask prices.', logic: 'A wide spread can signal low liquidity or extreme volatility.' },
    wall_distance: { title: 'Wall Distance', desc: 'Distance to the nearest large liquidity wall in the order book.', logic: 'Helps place stop losses behind major walls or trade bounces.' },
    order_flow: { title: 'Order Flow', desc: 'Analyzes order flow (deltas) and cumulative volume delta.', logic: 'Delta shows the net difference between market buy/sell orders. CVD indicates cumulative pressure trend.' },
    liquidations: { title: 'Liquidations', desc: 'Tracks forced positions liquidations of traders.', logic: 'Large liquidations often occur at trend tops, bottoms, or accelerations.' },
    hermes: { title: 'Hermes AI Agent', desc: 'Autonomous LLM agent for intelligent strategy filtering based on natural language market context.', logic: 'Use for complex filtering hard to express via math formulas (e.g. "Do not enter if market looks too volatile").' },
    exchange_data: { title: '🔌 Exchange Connector', desc: 'Retrieves data directly from a specific exchange via CCXT. Supports Binance, Bybit, OKX, Kraken, Coinbase, HTX.', logic: 'Use Price Delta for arbitrage strategies (price difference between exchanges). Funding Rate is classic for identifying overextended positions.' },
    user_level: { title: 'User Chart Level', desc: 'Manually specify a price support/resistance level and trigger signal when price approaches it.', logic: 'Triggers when price falls within level boundaries including set tolerance.' },
    trade_action: { title: '🚀 Trade Action', desc: 'Automated execution of trading operations on the connected exchange.', logic: 'Connect signal (LONG/SHORT) with Market/Limit Order node to enter position. Set SL/TP for protection.' },
    webhook: { title: '🌐 Webhook', desc: 'Sends an HTTP request (e.g. to Discord, Telegram, or CRM) upon receiving a signal.', logic: 'Configure URL and HTTP method (POST/GET). Bот will send signal details to specified endpoint.' },
    polymarket_scanner: { title: '🔮 Polymarket Scanner', desc: 'Tracks large bets ("whale bets") on prediction platform Polymarket (Polygon blockchain).', logic: 'Triggers when a single bet on any outcome exceeds the set volume limit in USD.' },
    finviz_scanner: { title: '📈 Finviz Stock Scanner', desc: 'Scans NYSE/NASDAQ stock markets for gains/losses and insider transactions (CEO/CFO).', logic: 'Triggers when a stock matches scanner criteria (e.g. Top Gainers or Large Insider Buying).' },
    mcp_tool: { title: '🛠️ MCP Tool Call', desc: 'Executes an arbitrary Model Context Protocol (MCP) tool via Heym workflows.', logic: 'Allows sending custom market context (pair, price, indicator parameters) in JSON format and processes decisions or values.' },
    llm_filter: { title: '🤖 LLM Filter (Free AI)', desc: 'Filters strategy signals using free web sessions of Qwen and DeepSeek.', logic: 'The system sends market context to the LLM. If the response contains LONG — it passes as LONG, if SHORT — it passes as SHORT, otherwise — it is blocked (FILTER).' },
};

interface HeymMcpTool {
  id: string;
  name: string;
  description: string;
  workflowId: string;
}

let _mcpToolsCache: HeymMcpTool[] | null = null;
let _mcpToolsFetching = false;
const _mcpToolsSubs: Set<() => void> = new Set();

async function fetchMcpToolsOnce(): Promise<HeymMcpTool[]> {
  if (_mcpToolsCache) return _mcpToolsCache;
  if (_mcpToolsFetching) {
    return new Promise(resolve => {
      const unsub = () => { _mcpToolsSubs.delete(unsub); resolve(_mcpToolsCache || []); };
      _mcpToolsSubs.add(unsub);
    });
  }
  _mcpToolsFetching = true;
  try {
    const res = await fetch('/api/settings/integrations/heym/tools');
    if (res.ok) {
      _mcpToolsCache = await res.json();
    }
  } catch {
    _mcpToolsCache = [];
  }
  _mcpToolsFetching = false;
  _mcpToolsSubs.forEach(fn => fn());
  _mcpToolsSubs.clear();
  return _mcpToolsCache || [];
}

const TIMEFRAMES = ['inherit', '1m', '3m', '5m', '15m', '1h', '4h', '1d'];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {children}
    </div>
  );
}

/** Shared config for ExchangeDataNode + ExchangeScannerNode */
function ExchangeBaseConfig({ type, data, set, onUpdate, selectedNode, inputStyle }: any) {
  const [showApiKeys, setShowApiKeys] = React.useState(!!(data.apiKey));
  const { t } = useLanguageStore();

  const EXCHANGES = [
    { value: 'binance',  label: '🟡 Binance'  },
    { value: 'bybit',    label: '🟠 Bybit'    },
    { value: 'okx',      label: '🔵 OKX'      },
    { value: 'kraken',   label: '🟣 Kraken'   },
    { value: 'coinbase', label: '🔵 Coinbase' },
    { value: 'htx',      label: '🔵 HTX'      },
    { value: 'mexc',     label: '🟢 MEXC'     },
  ];

  return (
    <>
      {/* Exchange selector */}
      <Row label={t('exchange_label')}>
        <select value={data.exchange || 'binance'} onChange={(e) => set('exchange', e.target.value)} style={inputStyle}>
          {EXCHANGES.map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
        </select>
      </Row>

      {/* ── ExchangeDataNode specific ── */}
      {type === 'exchange_data' && (
        <>
          <Row label={t('data_type_label')}>
            <select value={data.dataType || 'price'} onChange={(e) => {
              const val = e.target.value;
              onUpdate(selectedNode.id, { ...data, dataType: val, compareExchange: val !== 'price_delta' ? undefined : (data.compareExchange || 'bybit') });
            }} style={inputStyle}>
              <option value="price">Price ({t('current_price_label')})</option>
              <option value="volume">{t('opt_vol_24h')}</option>
              <option value="funding_rate">{t('opt_funding_rate_f')}</option>
              <option value="open_interest">{t('opt_open_interest_oi')}</option>
              <option value="bid_ask_spread">Bid/Ask Spread</option>
              <option value="price_delta">{t('opt_price_delta_arb')}</option>
            </select>
          </Row>
          <Row label={t('pair_ticker_label')}>
            <input
              type="text"
              value={data.pair || 'BTCUSDT'}
              onChange={(e) => set('pair', e.target.value.toUpperCase())}
              style={inputStyle}
              placeholder={t('eg_ticker')}
            />
          </Row>
          {data.dataType === 'price_delta' && (
            <Row label={t('compare_with_second')}>
              <select value={data.compareExchange || 'bybit'} onChange={(e) => set('compareExchange', e.target.value)} style={inputStyle}>
                {EXCHANGES.map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
              </select>
            </Row>
          )}
          <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(240,185,11,0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            {data.dataType === 'price_delta'
              ? t('price_delta_desc')
              : data.dataType === 'funding_rate'
              ? t('funding_rate_warn_desc')
              : t('connect_comparison_desc')}
          </div>
        </>
      )}

      {/* ── ExchangeScannerNode specific ── */}
      {type === 'exchange_scanner' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{t('quote_asset_label')}</div>
              <select value={data.quoteAsset || 'USDT'} onChange={(e) => set('quoteAsset', e.target.value)} style={inputStyle}>
                <option value="USDT">USDT</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="USD">USD</option>
                <option value="BUSD">BUSD</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{t('top_coins_label')}</div>
              <input type="number" min={1} max={200} value={data.limit || 20} onChange={(e) => set('limit', Number(e.target.value))} style={inputStyle} />
            </div>
          </div>

          <Row label={t('symbols_filter_label')}>
            <input
              type="text"
              value={data.symbols || ''}
              onChange={(e) => set('symbols', e.target.value.toUpperCase())}
              style={inputStyle}
              placeholder={t('eg_symbols')}
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              {t('symbols_filter_desc')}
            </div>
          </Row>

          <Row label={t('sorting_label')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['volume', t('opt_by_vol')], ['change', t('opt_by_change')], ['price', t('opt_by_price')]].map(([val, label]) => (
                <button key={val} onClick={() => set('sortBy', val)} style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  border: (data.sortBy || 'volume') === val ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                  background: (data.sortBy || 'volume') === val ? 'var(--accent-soft)' : 'var(--bg-accent)',
                  color: (data.sortBy || 'volume') === val ? 'var(--accent-color)' : 'var(--text-secondary)',
                }}>{label}</button>
              ))}
            </div>
          </Row>

          {/* Filters section */}
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            {t('filters_header')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>{t('node_min_vol')}</div>
              <input type="number" min={0} step={100000} value={data.minVolume24h || ''} onChange={(e) => set('minVolume24h', e.target.value ? Number(e.target.value) : undefined)} style={inputStyle} placeholder={t('eg_symbols')} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>{t('node_max_vol')}</div>
              <input type="number" min={0} step={100000} value={data.maxVolume24h || ''} onChange={(e) => set('maxVolume24h', e.target.value ? Number(e.target.value) : undefined)} style={inputStyle} placeholder={t('no_limits_label')} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>{t('node_min_price')}</div>
              <input type="number" min={0} step={0.001} value={data.minPrice ?? ''} onChange={(e) => set('minPrice', e.target.value !== '' ? Number(e.target.value) : undefined)} style={inputStyle} placeholder="0" />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>{t('node_max_price')}</div>
              <input type="number" min={0} step={0.001} value={data.maxPrice ?? ''} onChange={(e) => set('maxPrice', e.target.value !== '' ? Number(e.target.value) : undefined)} style={inputStyle} placeholder="∞" />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>{t('node_min_chg')}</div>
              <input type="number" step={0.5} value={data.minChangePercent ?? ''} onChange={(e) => set('minChangePercent', e.target.value !== '' ? Number(e.target.value) : undefined)} style={inputStyle} placeholder={t('eg_5pct')} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>{t('node_max_chg')}</div>
              <input type="number" step={0.5} value={data.maxChangePercent ?? ''} onChange={(e) => set('maxChangePercent', e.target.value !== '' ? Number(e.target.value) : undefined)} style={inputStyle} placeholder={t('eg_20pct')} />
            </div>
          </div>

          <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(240,185,11,0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            💡 {t('scanner_return_desc')}
          </div>
        </>
      )}

      {/* ── API Keys (shared, collapsible) ── */}
      <div style={{
        border: '1px solid var(--border-color)',
        borderRadius: 10, overflow: 'hidden', marginBottom: 4
      }}>
        <button
          onClick={() => setShowApiKeys(v => !v)}
          style={{
            width: '100%', padding: '10px 14px',
            background: showApiKeys ? 'rgba(99,102,241,0.08)' : 'var(--bg-accent)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: 'var(--text-primary)', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12 }}>🔑</span> {t('api_keys_optional_header')}
          </span>
          <span style={{ opacity: 0.5, fontSize: 14 }}>{showApiKeys ? '▲' : '▼'}</span>
        </button>
        {showApiKeys && (
          <div style={{ padding: '14px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
              {t('api_keys_desc_label')}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>API Key</div>
              <input
                type="password"
                value={data.apiKey || ''}
                onChange={(e) => set('apiKey', e.target.value || undefined)}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                placeholder={t('api_key_placeholder')}
                autoComplete="off"
              />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Secret Key</div>
              <input
                type="password"
                value={data.apiSecret || ''}
                onChange={(e) => set('apiSecret', e.target.value || undefined)}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                placeholder={t('secret_key_placeholder')}
                autoComplete="off"
              />
            </div>
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 10, color: '#ef4444', lineHeight: 1.4 }}>
              {t('api_keys_warning_desc')}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Universal Exchange Node Config */
function ExchangeUniversalConfig({ data, set, onUpdate, selectedNode, inputStyle }: any) {
  const [showApiKeys, setShowApiKeys] = React.useState(!!(data.apiKey));
  const mode = data.mode || 'ticker';
  const { t } = useLanguageStore();

  const EXCHANGES = [
    { value: 'binance',  label: '🟡 Binance'  },
    { value: 'bybit',    label: '🟠 Bybit'    },
    { value: 'okx',      label: '🔵 OKX'      },
    { value: 'kraken',   label: '🟣 Kraken'   },
    { value: 'coinbase', label: '🔵 Coinbase' },
    { value: 'htx',      label: '🔵 HTX'      },
    { value: 'mexc',     label: '🟢 MEXC'     },
  ];

  return (
    <>
      {/* Mode Selector */}
      <Row label={t('operation_mode_label')}>
        <select value={mode} onChange={(e) => onUpdate(selectedNode.id, { ...data, mode: e.target.value })} style={inputStyle}>
          <option value="ticker">{t('opt_mode_ticker')}</option>
          <option value="scanner">{t('opt_mode_scanner')}</option>
          <option value="orderbook">{t('opt_mode_orderbook')}</option>
          <option value="orderflow">{t('opt_mode_orderflow')}</option>
        </select>
      </Row>

      {/* Exchange selector */}
      <Row label={t('exchange_label')}>
        <select value={data.exchange || 'binance'} onChange={(e) => set('exchange', e.target.value)} style={inputStyle}>
          {EXCHANGES.map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
        </select>
      </Row>

      {/* MODE 1: TICKER */}
      {mode === 'ticker' && (
        <>
          <Row label={t('data_type_label')}>
            <select value={data.dataType || 'price'} onChange={(e) => {
              const val = e.target.value;
              onUpdate(selectedNode.id, { ...data, dataType: val, compareExchange: val !== 'price_delta' ? undefined : (data.compareExchange || 'bybit') });
            }} style={inputStyle}>
              <option value="price">Price ({t('current_price_label')})</option>
              <option value="volume">{t('opt_vol_24h')}</option>
              <option value="funding_rate">{t('opt_funding_rate_f')}</option>
              <option value="open_interest">{t('opt_open_interest_oi')}</option>
              <option value="bid_ask_spread">Bid/Ask Spread</option>
              <option value="price_delta">{t('opt_price_delta_arb')}</option>
            </select>
          </Row>
          <Row label={t('pair_ticker_label')}>
            <input
              type="text"
              value={data.pair || 'BTCUSDT'}
              onChange={(e) => set('pair', e.target.value.toUpperCase())}
              style={inputStyle}
              placeholder={t('eg_ticker')}
            />
          </Row>
          {data.dataType === 'price_delta' && (
            <Row label={t('compare_with_second')}>
              <select value={data.compareExchange || 'bybit'} onChange={(e) => set('compareExchange', e.target.value)} style={inputStyle}>
                {EXCHANGES.map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
              </select>
            </Row>
          )}
          <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            {data.dataType === 'price_delta'
              ? t('price_delta_desc')
              : data.dataType === 'funding_rate'
              ? t('funding_rate_warn_desc')
              : t('connect_comparison_desc')}
          </div>
        </>
      )}

      {/* MODE 2: SCANNER */}
      {mode === 'scanner' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{t('quote_asset_label')}</div>
              <select value={data.quoteAsset || 'USDT'} onChange={(e) => set('quoteAsset', e.target.value)} style={inputStyle}>
                <option value="USDT">USDT</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{t('top_coins_label')}</div>
              <input type="number" min={1} max={200} value={data.limit || 20} onChange={(e) => set('limit', Number(e.target.value))} style={inputStyle} />
            </div>
          </div>

          <Row label={t('symbols_filter_label')}>
            <input
              type="text"
              value={data.symbols || ''}
              onChange={(e) => set('symbols', e.target.value.toUpperCase())}
              style={inputStyle}
              placeholder={t('eg_symbols')}
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              {t('symbols_filter_desc')}
            </div>
          </Row>

          <Row label={t('sorting_label')}>
            <select value={data.sortBy || 'volume'} onChange={(e) => set('sortBy', e.target.value)} style={inputStyle}>
              <option value="volume">{t('opt_by_vol_24h')}</option>
              <option value="change_up">{t('opt_by_change_up')}</option>
              <option value="change_down">{t('opt_by_change_down')}</option>
            </select>
          </Row>

          {/* Filters section */}
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            {t('filters_header')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>Min Volume 24h ($)</div>
              <input type="number" min={0} step={100000} value={data.minVolume24h || ''} onChange={(e) => set('minVolume24h', e.target.value ? Number(e.target.value) : undefined)} style={inputStyle} placeholder={t('eg_symbols')} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>Max Volume 24h ($)</div>
              <input type="number" min={0} step={100000} value={data.maxVolume24h || ''} onChange={(e) => set('maxVolume24h', e.target.value ? Number(e.target.value) : undefined)} style={inputStyle} placeholder={t('no_limits_label')} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>Min Price ($)</div>
              <input type="number" min={0} step={0.001} value={data.minPrice ?? ''} onChange={(e) => set('minPrice', e.target.value !== '' ? Number(e.target.value) : undefined)} style={inputStyle} placeholder="0" />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>Max Price ($)</div>
              <input type="number" min={0} step={0.001} value={data.maxPrice ?? ''} onChange={(e) => set('maxPrice', e.target.value !== '' ? Number(e.target.value) : undefined)} style={inputStyle} placeholder="∞" />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>Min Change 24h (%)</div>
              <input type="number" step={0.5} value={data.minChangePercent ?? ''} onChange={(e) => set('minChangePercent', e.target.value !== '' ? Number(e.target.value) : undefined)} style={inputStyle} placeholder={t('eg_5pct')} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4 }}>Max Change 24h (%)</div>
              <input type="number" step={0.5} value={data.maxChangePercent ?? ''} onChange={(e) => set('maxChangePercent', e.target.value !== '' ? Number(e.target.value) : undefined)} style={inputStyle} placeholder={t('eg_20pct')} />
            </div>
          </div>
        </>
      )}

      {/* MODE 3: ORDER BOOK */}
      {mode === 'orderbook' && (
        <>
          <Row label={t('metric_label')}>
            <select value={data.metric || 'imbalance'} onChange={(e) => set('metric', e.target.value)} style={inputStyle}>
              <option value="imbalance">{t('opt_imbalance_bid_ask')}</option>
              <option value="spread">{t('opt_spread_size')}</option>
              <option value="wall_distance">{t('opt_wall_distance_large')}</option>
            </select>
          </Row>
          <Row label={t('levels_count_label')}>
            <input type="number" min={5} max={100} value={data.levels || 20} onChange={(e) => set('levels', parseInt(e.target.value) || 20)} style={inputStyle} />
          </Row>
        </>
      )}

      {/* MODE 4: ORDER FLOW */}
      {mode === 'orderflow' && (
        <>
          <Row label={t('metric_label')}>
            <select value={data.metric || 'delta'} onChange={(e) => set('metric', e.target.value)} style={inputStyle}>
              <option value="delta">{t('opt_delta_net_diff')}</option>
              <option value="cvd">{t('opt_cvd_cumulative_vol')}</option>
            </select>
          </Row>
          <Row label={t('calculation_period_label')}>
            <select value={data.period || '1h'} onChange={(e) => set('period', e.target.value)} style={inputStyle}>
              <option value="1m">{t('opt_1m')}</option>
              <option value="5m">{t('opt_5m')}</option>
              <option value="15m">{t('opt_15m')}</option>
              <option value="1h">{t('opt_1h')}</option>
              <option value="4h">{t('opt_4h')}</option>
            </select>
          </Row>
          <Row label={t('side_label')}>
            <select value={data.side || 'BOTH'} onChange={(e) => set('side', e.target.value)} style={inputStyle}>
              <option value="BOTH">{t('opt_side_both')}</option>
              <option value="LONG">{t('opt_side_long')}</option>
              <option value="SHORT">{t('opt_side_short')}</option>
            </select>
          </Row>
          <Row label={t('min_vol_threshold_usd')}>
            <input type="number" value={data.threshold ?? 1000000} onChange={(e) => set('threshold', parseInt(e.target.value) || 0)} style={inputStyle} />
          </Row>
        </>
      )}

      {/* API Keys collapsible */}
      <div style={{
        border: '1px solid var(--border-color)',
        borderRadius: 10, overflow: 'hidden', marginBottom: 20
      }}>
        <button
          onClick={() => setShowApiKeys(v => !v)}
          style={{
            width: '100%', padding: '10px 14px',
            background: showApiKeys ? 'rgba(99,102,241,0.08)' : 'var(--bg-accent)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: 'var(--text-primary)', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('api_keys_optional')}
          </span>
          <span style={{ opacity: 0.5, fontSize: 14 }}>{showApiKeys ? '▲' : '▼'}</span>
        </button>
        {showApiKeys && (
          <div style={{ padding: '14px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
              {t('api_keys_desc')}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>API Key</div>
              <input
                type="password"
                value={data.apiKey || ''}
                onChange={(e) => set('apiKey', e.target.value || undefined)}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                placeholder={t('api_key_placeholder')}
                autoComplete="off"
              />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Secret Key</div>
              <input
                type="password"
                value={data.apiSecret || ''}
                onChange={(e) => set('apiSecret', e.target.value || undefined)}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                placeholder={t('secret_key_placeholder')}
                autoComplete="off"
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

interface Props {
  selectedNode: any;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  nodeCount?: number;
  pair?: string;
  timeframe?: string;
}

const PropertiesPanel = ({ selectedNode, onUpdate, onDelete, nodeCount = 0, pair, timeframe }: Props) => {
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { t, language } = useLanguageStore();
  const [mcpTools, setMcpTools] = useState<HeymMcpTool[]>(_mcpToolsCache || []);
  const { data, type: originalType } = selectedNode || { data: {}, type: null };
  React.useEffect(() => {
    if (_mcpToolsCache) { setMcpTools(_mcpToolsCache); return; }
    fetchMcpToolsOnce().then(t => setMcpTools(t));
  }, [originalType]);
  const type = ['exchange_data', 'exchange_scanner', 'orderbook', 'order_flow'].includes(originalType)
    ? 'exchange'
    : originalType;

  const set = (key: string, value: any) =>
    onUpdate(selectedNode.id, { ...data, [key]: value });

  const setParam = (key: string, value: any) =>
    onUpdate(selectedNode.id, { ...data, params: { ...(data.params || {}), [key]: value } });

  const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-accent)', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' };
  const smallNumStyle: React.CSSProperties = { width: '56px', background: 'var(--bg-accent)', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 800, padding: '4px', color: 'var(--text-primary)', border: '1px solid var(--border-color)' };

  const getDocs = () => {
    if (!originalType) return null;
    const docsSource = language === 'ru' ? NODE_DOCS_RU : NODE_DOCS_EN;
    if (originalType === 'indicator' && data.name) return docsSource[data.name as string];
    if (originalType === 'smc' && data.type) return docsSource[data.type as string];
    if (originalType === 'scanner' && data.source) return docsSource[data.source as string];
    if (originalType === 'orderbook' && data.metric) return docsSource[data.metric as string];
    if (originalType === 'order_flow' && data.threshold !== undefined) return docsSource['liquidations'];
    if (originalType === 'input' && data.source) return docsSource[data.source as string] || docsSource[originalType as string];
    if (originalType === 'hermes') return docsSource['hermes'];
    if (originalType === 'exchange_data') return docsSource['exchange_data'];
    if (originalType === 'trade_action') {
        if (data.action === 'webhook') return docsSource['webhook'];
        return docsSource['trade_action'];
    }
    return docsSource[originalType as string];
  };

  const docs = getDocs();

  return (
    <aside style={{
      width: selectedNode ? '320px' : '0px',
      minWidth: selectedNode ? '320px' : '0px',
      opacity: selectedNode ? 1 : 0,
      background: 'rgba(22, 24, 30, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderLeft: selectedNode ? '1px solid rgba(124, 58, 237, 0.25)' : 'none',
      boxShadow: selectedNode ? '-10px 0 30px rgba(0,0,0,0.5)' : 'none',
      display: 'flex', flexDirection: 'column',
      zIndex: 100,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {selectedNode ? t('node_parameters') : t('information')}
        </div>
        {selectedNode && (
            <button 
                onClick={() => onDelete(selectedNode.id)}
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '8px', transition: 'var(--transition)' }}
                title={t('delete_node')}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            >
                <Trash2 size={16} />
            </button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selectedNode ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
             <HelpCircle size={40} color="var(--border-color)" style={{ marginBottom: '16px', opacity: 0.5 }} />
             <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {t('node_help_placeholder')}
             </p>
          </div>
        ) : (
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.1em' }}>
                    {t('configuration')}
                </div>

                {(type === 'indicator' || type === 'smc') && (
            <button 
                onClick={() => setShowPreview(true)}
                style={{ 
                    width: '100%', marginBottom: '24px', padding: '12px', 
                    background: 'var(--bg-accent)', border: '1px solid var(--accent-color)', 
                    borderRadius: '12px', color: 'var(--accent-color)', fontSize: '12px', 
                    fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', gap: '10px' 
                }}
            >
                <Play size={14} fill="var(--accent-color)" /> PREVIEW ON CHART
            </button>
        )}

        {type === 'logic' && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={labelStyle}>{t('inputs_count')} <span style={{ color: 'var(--success)' }}>{data.inputsCount || 2}</span></div>
                    <input 
                        type="range" min="2" max="10" 
                        value={data.inputsCount || 2} 
                        onChange={(e) => set('inputsCount', parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--success)', height: '4px' }}
                    />
                  </div>
                )}

                {['indicator', 'smc', 'input', 'timeFilter'].includes(type) && (
                    <Row label={t('timeframe')}>
                        <select 
                            value={data.timeframe || 'inherit'} 
                            onChange={(e) => set('timeframe', e.target.value)} 
                            style={{ ...inputStyle, border: data.timeframe && data.timeframe !== 'inherit' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)' }}
                        >
                            {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf === 'inherit' ? t('default_option') : tf}</option>)}
                        </select>
                    </Row>
                )}

                {type === 'input' && (
                    <>
                        <Row label={t('data_source')}>
                            <select value={data.source || 'markPrice'} onChange={(e) => set('source', e.target.value)} style={inputStyle}>
                                <option value="markPrice">{t('opt_mark_price')}</option>
                                <option value="openInterest">Open Interest</option>
                                <option value="fundingRate">Funding Rate</option>
                                <option value="marketAvgVolume">{t('opt_market_avg_volume')}</option>
                                <option value="close">{t('opt_candle_close')}</option>
                                <option value="open">{t('opt_candle_open')}</option>
                                <option value="volume">{t('opt_candle_volume')}</option>
                            </select>
                        </Row>
                        <Row label={t('comparison_condition')}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select 
                                    value={data.params?.operator || 'none'} 
                                    onChange={(e) => setParam('operator', e.target.value)} 
                                    style={{ ...inputStyle, width: '40%' }}
                                >
                                    <option value="none">{t('opt_none_series')}</option>
                                    <option value=">">&gt;</option>
                                    <option value="<">&lt;</option>
                                    <option value=">=">&gt;=</option>
                                    <option value="<=">&lt;=</option>
                                    <option value="==">==</option>
                                </select>
                                {data.params?.operator !== 'none' && (
                                    <input 
                                        type="number" 
                                        value={data.params?.threshold ?? 0} 
                                        onChange={(e) => setParam('threshold', parseFloat(e.target.value) || 0)}
                                        style={{ ...inputStyle, width: '60%' }}
                                        placeholder={
                                            data.source === 'fundingRate' ? t('eg_funding') :
                                            data.source === 'openInterest' ? t('eg_oi') : t('value_label')
                                        }
                                        step={data.source === 'fundingRate' ? 0.0001 : data.source === 'openInterest' ? 1000 : 1}
                                    />
                                )}
                            </div>
                        </Row>
                        {/* Pair field only for API sources, not for candle-only data */}
                        {['markPrice', 'openInterest', 'fundingRate'].includes(data.source) && (
                            <Row label={t('custom_pair_opt')}>
                                <input 
                                    type="text"
                                    value={data.params?.pair || ''}
                                    onChange={(e) => setParam('pair', e.target.value.toUpperCase())}
                                    placeholder={t('eg_pair_default')}
                                    style={inputStyle}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                                    {t('custom_pair_desc')}
                                </div>
                            </Row>
                        )}
                    </>
                )}

                
                {type === 'indicator' && (
                    <>
                        <Row label={t('indicator_label')}>
                            <select value={data.name || 'RSI'} onChange={(e) => set('name', e.target.value)} style={inputStyle}>
                                <option>RSI</option><option>Divergence</option><option>SMA</option><option>EMA</option><option>MACD</option><option value="BB">Bollinger Bands</option><option>ATR</option><option value="Stoch">Stochastic</option><option>Volume</option>
                                <option>ADX</option>
                                <option>CandlePattern</option>
                            </select>
                        </Row>
                        {['SMA', 'EMA', 'RSI', 'ATR', 'BB', 'Volume'].includes(data.name) && (
                             <div style={{ marginBottom: '20px' }}>
                                <div style={labelStyle}>
                                    <span>{t('period_label')}</span>
                                    <input 
                                        type="number" 
                                        min={2} max={500} 
                                        value={data.params?.period ?? 14} 
                                        onChange={(e) => setParam('period', parseInt(e.target.value) || 2)}
                                        style={smallNumStyle}
                                    />
                                </div>
                                <input 
                                    type="range" min={2} max={500} step={1} 
                                    value={data.params?.period ?? 14} 
                                    onChange={(e) => setParam('period', parseInt(e.target.value))} 
                                    style={{ width: '100%', accentColor: 'var(--accent-color)', height: '4px' }} 
                                />
                             </div>
                        )}
                        {/* ADX specific config */}
                        {data.name === 'ADX' && (
                            <>
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={labelStyle}>
                                        <span>{t('period_label')}</span>
                                        <input type="number" min={2} max={100} value={data.params?.period ?? 14} onChange={(e) => setParam('period', parseInt(e.target.value) || 14)} style={smallNumStyle} />
                                    </div>
                                    <input type="range" min={2} max={100} step={1} value={data.params?.period ?? 14} onChange={(e) => setParam('period', parseInt(e.target.value))} style={{ width: '100%', accentColor: '#F59E0B', height: '4px' }} />
                                </div>
                                <Row label={language === 'ru' ? 'Выходное значение' : 'Output value'}>
                                    <select value={data.property || 'adx'} onChange={(e) => set('property', e.target.value)} style={inputStyle}>
                                        <option value="adx">ADX (trend strength)</option>
                                        <option value="plusDI">+DI (bullish force)</option>
                                        <option value="minusDI">-DI (bearish force)</option>
                                    </select>
                                </Row>
                                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    💡 {language === 'ru' ? 'ADX > 25 = сильный тренд. Подключите к ноде > / < с порогом 25.' : 'ADX > 25 = strong trend. Connect to > / < node with threshold 25.'}
                                </div>
                            </>
                        )}
                        {/* CandlePattern specific config */}
                        {data.name === 'CandlePattern' && (
                            <>
                                <Row label={language === 'ru' ? 'Паттерн свечи' : 'Candle Pattern'}>
                                    <select value={data.params?.pattern || 'any'} onChange={(e) => setParam('pattern', e.target.value)} style={inputStyle}>
                                        <option value="any">{language === 'ru' ? 'Любой паттерн' : 'Any Pattern'}</option>
                                        <option value="PinBar">Pin Bar</option>
                                        <option value="BullEngulfing">Bull Engulfing</option>
                                        <option value="BearEngulfing">Bear Engulfing</option>
                                        <option value="InsideBar">Inside Bar</option>
                                        <option value="Doji">Doji</option>
                                    </select>
                                </Row>
                                <div style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    💡 {language === 'ru' ? 'Нода выдаёт булевый сигнал: найден ли паттерн на последней свече.' : 'Outputs a boolean: whether the pattern was found on the last candle.'}
                                </div>
                            </>
                        )}
                        {/* More indicator params... */}
                    </>
                )}

                {/* Other types... */}
                {type === 'signal' && (
                    <Row label={t('node_signal_type')}>
                        <select value={data.signalType || 'LONG'} onChange={(e) => set('signalType', e.target.value)} style={inputStyle}>
                            <option value="LONG">BUY (Long)</option><option value="SHORT">SELL (Short)</option>
                        </select>
                    </Row>
                )}

                {type === 'ai_forecast' && (
                    <>
                        <Row label={t('model_label_prop')}>
                            <select value={data.model || 'auto'} onChange={(e) => set('model', e.target.value)} style={inputStyle}>
                                <option value="auto">{t('opt_auto_gpu')}</option>
                                <option value="kronos-base">Kronos Base (102M)</option>
                                <option value="kronos-small">Kronos Small (24.7M)</option>
                                <option value="kronos-mini">Kronos Mini (4.1M)</option>
                            </select>
                        </Row>
                        <Row label={t('forecast_horizon')}>
                            <select value={data.predLen || 24} onChange={(e) => set('predLen', parseInt(e.target.value))} style={inputStyle}>
                                <option value={12}>{t('opt_12_candles')}</option>
                                <option value={24}>{t('opt_24_candles')}</option>
                                <option value={48}>{t('opt_48_candles')}</option>
                                <option value={120}>{t('opt_120_candles')}</option>
                            </select>
                        </Row>
                        <Row label={t('output_value')}>
                            <select value={data.property || 'direction'} onChange={(e) => set('property', e.target.value)} style={inputStyle}>
                                <option value="direction">{t('opt_direction_up_down')}</option>
                                <option value="predicted_close">{t('opt_predicted_price')}</option>
                                <option value="predicted_change">{t('opt_predicted_change')}</option>
                                <option value="confidence">{t('opt_confidence_range')}</option>
                            </select>
                        </Row>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={labelStyle}>
                                <span>{t('min_confidence')}</span>
                                <span style={{ color: 'var(--accent-color)', fontWeight: 800 }}>{Math.round((data.minConfidence || 0.6) * 100)}%</span>
                            </div>
                            <input
                                type="range" min={0.3} max={0.95} step={0.05}
                                value={data.minConfidence || 0.6}
                                onChange={(e) => set('minConfidence', parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: '#a855f7', height: '4px' }}
                            />
                        </div>
                    </>
                )}

                {type === 'orderbook' && (
                    <>
                        <Row label={t('l2_metric')}>
                            <select value={data.metric || 'imbalance'} onChange={(e) => set('metric', e.target.value)} style={inputStyle}>
                                <option value="imbalance">Imbalance % (Bid vs Ask)</option>
                                <option value="spread">{t('opt_spread_diff')}</option>
                                <option value="wall_distance">Wall Distance (%)</option>
                            </select>
                        </Row>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={labelStyle}>
                                <span>{t('analysis_depth_levels')}</span>
                                <input 
                                    type="number" 
                                    min={5} max={100} 
                                    value={data.levels ?? 20} 
                                    onChange={(e) => set('levels', parseInt(e.target.value) || 20)}
                                    style={smallNumStyle}
                                />
                            </div>
                            <input 
                                type="range" min={5} max={100} step={5} 
                                value={data.levels ?? 20} 
                                onChange={(e) => set('levels', parseInt(e.target.value))} 
                                style={{ width: '100%', accentColor: '#0ea5e9', height: '4px' }} 
                            />
                        </div>
                    </>
                )}

                {type === 'scanner' && (
                    <>
                        <Row label={t('metric_label')}>
                            <select
                                value={data.source || 'volume'}
                                onChange={(e) => {
                                    const src = e.target.value;
                                    const update: any = { ...data, source: src };
                                    if (src === 'relative_volume') {
                                        update.params = { ...(data.params || {}), period: '24h' };
                                    }
                                    onUpdate(selectedNode.id, update);
                                }}
                                style={inputStyle}
                            >
                                <option value="volume">{t('opt_vol_usdt')}</option>
                                <option value="relative_volume">{t('opt_rel_vol')}</option>
                                <option value="change">{t('opt_price_change_pct')}</option>
                            </select>
                        </Row>
                        {data.source === 'relative_volume' && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 0 8px', lineHeight: 1.4 }}>
                                {t('rel_vol_desc')}
                            </div>
                        )}
                        <Row label={t('period_label')}>
                            <select
                                value={data.params?.period || '24h'}
                                onChange={(e) => setParam('period', e.target.value)}
                                style={inputStyle}
                                disabled={data.source === 'relative_volume'}
                            >
                                <option value="15m">{t('opt_15m')}</option>
                                <option value="1h">{t('opt_1h')}</option>
                                <option value="4h">{t('opt_4h')}</option>
                                <option value="24h">{t('opt_24h')}</option>
                            </select>
                        </Row>
                        {data.source === 'relative_volume' && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -6, marginBottom: 8 }}>
                                {t('rel_vol_24h_only')}
                            </div>
                        )}
                        <Row label={t('condition_label')}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select value={data.params?.operator || '>'} onChange={(e) => setParam('operator', e.target.value)} style={{ ...inputStyle, width: '30%' }}>
                                    <option value="none">{t('opt_value_output')}</option>
                                    <option value=">">&gt;</option>
                                    <option value="<">&lt;</option>
                                </select>
                                <input
                                    type="number"
                                    value={data.params?.threshold ?? (data.source === 'relative_volume' ? 1.5 : 0)}
                                    onChange={(e) => setParam('threshold', parseFloat(e.target.value) || 0)}
                                    style={{ ...inputStyle, width: '70%' }}
                                    placeholder={data.source === 'relative_volume' ? t('placeholder_multiplier') : t('placeholder_value')}
                                    step={data.source === 'relative_volume' ? 0.1 : 1}
                                    min={data.source === 'relative_volume' ? 0.1 : undefined}
                                />
                            </div>
                        </Row>
                    </>
                )}

                {type === 'timeFilter' && (
                    <>
                        <Row label={t('start_time_label')}>
                            <input
                                type="time"
                                value={data.from || '08:00'}
                                onChange={(e) => set('from', e.target.value)}
                                style={inputStyle}
                            />
                        </Row>
                        <Row label={t('end_time_label')}>
                            <input
                                type="time"
                                value={data.to || '11:00'}
                                onChange={(e) => set('to', e.target.value)}
                                style={inputStyle}
                            />
                        </Row>
                        <Row label={t('timezone_label')}>
                            <select value={data.timezone || 'UTC'} onChange={(e) => set('timezone', e.target.value)} style={inputStyle}>
                                <option value="UTC">{t('opt_utc_binance')}</option>
                                <option value="Europe/Moscow">{t('opt_moscow_utc')}</option>
                                <option value="America/New_York">{t('opt_ny_utc')}</option>
                                <option value="Europe/London">{t('opt_london_utc')}</option>
                                <option value="Asia/Tokyo">{t('opt_tokyo_utc')}</option>
                            </select>
                        </Row>
                        <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {t('killzone_recom_desc')}
                        </div>
                    </>
                )}

                {type === 'cross' && (
                    <Row label={t('cross_direction')}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {(['above', 'below'] as const).map(dir => (
                                <button
                                    key={dir}
                                    onClick={() => set('direction', dir)}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                                        fontWeight: 700, fontSize: '12px', transition: 'var(--transition)',
                                        border: (data.direction || 'above') === dir ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                                        background: (data.direction || 'above') === dir ? 'var(--accent-soft)' : 'var(--bg-accent)',
                                        color: (data.direction || 'above') === dir ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    }}
                                >
                                    {dir === 'above' ? t('btn_up') : t('btn_down')}
                                </button>
                            ))}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                            {(data.direction || 'above') === 'above' ? t('cross_above_desc') : t('cross_below_desc')}
                        </div>
                    </Row>
                )}

                {type === 'comparison' && (
                    <>
                        <Row label={t('operator_label')}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {(['>', '<', '>=', '<=', '==', '!='] as const).map(op => (
                                    <button
                                        key={op}
                                        onClick={() => set('operator', op)}
                                        style={{
                                            padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
                                            fontWeight: 700, fontSize: '13px', fontFamily: 'monospace',
                                            border: (data.operator || '>') === op ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                                            background: (data.operator || '>') === op ? 'var(--accent-soft)' : 'var(--bg-accent)',
                                            color: (data.operator || '>') === op ? 'var(--accent-color)' : 'var(--text-secondary)',
                                            transition: 'var(--transition)',
                                        }}
                                    >{op}</button>
                                ))}
                            </div>
                        </Row>
                        <Row label={t('value_b_label')}>
                            <input
                                type="number"
                                value={data.value ?? data.bValue ?? 0}
                                onChange={(e) => set('value', parseFloat(e.target.value) || 0)}
                                style={inputStyle}
                                placeholder={t('placeholder_eg_30')}
                                step="any"
                            />
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                {t('value_b_desc')}
                            </div>
                        </Row>
                    </>
                )}

                {type === 'logic_corr' && (
                    <>
                        <Row label={t('comp_pair_label')}>
                            <input
                                type="text"
                                value={data.pair || 'BTCUSDT'}
                                onChange={(e) => set('pair', e.target.value.toUpperCase())}
                                style={inputStyle}
                                placeholder={t('eg_ticker')}
                            />
                        </Row>
                        <Row label={t('min_corr_label')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="1"
                                    step="0.05"
                                    value={data.minCorr || 0.8}
                                    onChange={(e) => set('minCorr', parseFloat(e.target.value))}
                                    style={{ flex: 1 }}
                                />
                                <span style={{ fontSize: '14px', fontWeight: 700, width: '40px', textAlign: 'right' }}>{data.minCorr || 0.8}</span>
                            </div>
                        </Row>
                        <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {t('corr_filter_desc')}
                        </div>
                    </>
                )}

                {type === 'order_flow' && (
                    <>
                        {data.metric !== undefined && (
                            <Row label={t('metric_label')}>
                                <select value={data.metric || 'delta'} onChange={(e) => set('metric', e.target.value)} style={inputStyle}>
                                    <option value="delta">Volume Delta ({t('opt_volume_delta_curr')})</option>
                                    <option value="cvd">CVD ({t('opt_cvd_cumulative')})</option>
                                </select>
                            </Row>
                        )}
                        
                        {data.period !== undefined && (
                            <Row label={t('period_label')}>
                                <select value={data.period || '1h'} onChange={(e) => set('period', e.target.value)} style={inputStyle}>
                                    <option value="1m">1 {t('opt_1m')}</option>
                                    <option value="5m">5 {t('opt_5m')}</option>
                                    <option value="15m">15 {t('opt_15m')}</option>
                                    <option value="1h">1 {t('opt_1h')}</option>
                                    <option value="4h">4 {t('opt_4h')}</option>
                                </select>
                            </Row>
                        )}

                        {data.side !== undefined && (
                            <Row label={t('liq_side_label')}>
                                <select value={data.side || 'BOTH'} onChange={(e) => set('side', e.target.value)} style={inputStyle}>
                                    <option value="LONG">LONG ({t('opt_long_liq')})</option>
                                    <option value="SHORT">SHORT ({t('opt_short_liq')})</option>
                                    <option value="BOTH">BOTH ({t('opt_both_liq')})</option>
                                </select>
                            </Row>
                        )}

                        {data.threshold !== undefined && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={labelStyle}>
                                    <span>{t('threshold_usd')}</span>
                                    <input 
                                        type="number" 
                                        min={1000} step={100000}
                                        value={data.threshold ?? 1000000} 
                                        onChange={(e) => set('threshold', parseInt(e.target.value) || 0)}
                                        style={smallNumStyle}
                                    />
                                </div>
                                <input 
                                    type="range" min={100000} max={10000000} step={100000} 
                                    value={data.threshold ?? 1000000} 
                                    onChange={(e) => set('threshold', parseInt(e.target.value))} 
                                    style={{ width: '100%', accentColor: '#ef4444', height: '4px' }} 
                                />
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                    {t('liq_large_threshold_desc').replace('{amount}', (data.threshold / 1e6).toFixed(1))}
                                </div>
                            </div>
                        )}

                        <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            💡 {data.threshold !== undefined ? t('liq_desc') : t('delta_desc')}
                        </div>
                    </>
                )}
                
                {type === 'custom_code' && (
                    <>
                        <Row label={t('script_name_label')}>
                            <input 
                                type="text" value={data.name || ''} 
                                onChange={(e) => set('name', e.target.value)} 
                                style={inputStyle} placeholder={t('eg_script_name')} 
                            />
                        </Row>
                        <Row label={t('js_code_label')}>
                            <div style={{ position: 'relative' }}>
                                <textarea 
                                    value={data.code || ''} 
                                    onChange={(e) => set('code', e.target.value)} 
                                    style={{ 
                                        ...inputStyle, height: '240px', fontFamily: 'monospace', 
                                        fontSize: '12px', lineHeight: 1.5, resize: 'vertical',
                                        background: '#0f172a', color: '#38bdf8', padding: '12px'
                                    }} 
                                    placeholder={t('js_placeholder')}
                                />
                                <div style={{ 
                                    position: 'absolute', bottom: '8px', right: '12px', 
                                    fontSize: '9px', color: 'rgba(56, 189, 248, 0.5)', pointerEvents: 'none' 
                                }}>
                                    JS Environment
                                </div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.4 }}>
                                💡 {t('js_desc')}
                            </div>
                        </Row>
                    </>
                )}

                {type === 'ml_filter' && (
                    <>
                        <Row label={t('ml_model_label')}>
                            <select 
                                value={data.modelId || ''} 
                                onChange={(e) => {
                                    const id = e.target.value;
                                    set('modelId', id ? Number(id) : null);
                                    set('modelName', e.target.options[e.target.selectedIndex].text);
                                }}
                                style={inputStyle}
                            >
                                <option value="">{t('select_model_placeholder')}</option>
                                <option value="1">Alpha_BTC_V1 (Acc: 68%)</option>
                                <option value="2">Sentiment_Filter_Pro (Acc: 62%)</option>
                                <option value="3">SMC_Sweep_Detector (Acc: 71%)</option>
                            </select>
                        </Row>
                        <Row label={t('min_accuracy_label').replace('{score}', String(data.minScore || 0.7))}>
                            <input 
                                type="range" min="0.5" max="0.95" step="0.05" 
                                value={data.minScore || 0.7} 
                                onChange={(e) => set('minScore', parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                            />
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.4 }}>
                                💡 {t('ml_confidence_desc').replace('{pct}', String(Math.round((data.minScore || 0.7) * 100)))}
                            </div>
                        </Row>
                    </>
                )}

                {type === 'smc' && (
                    <>
                        <Row label={t('smc_type_label')}>
                            <select value={data.type || 'fvg'} onChange={(e) => set('type', e.target.value)} style={inputStyle}>
                                <option value="fvg">Fair Value Gap (FVG)</option>
                                <option value="order_block">Order Block (OB)</option>
                                <option value="liquidity_sweep">Liquidity Sweep</option>
                                <option value="market_structure">Market Structure</option>
                                <option value="daily_bias">Daily Bias</option>
                                <option value="power_of_3">Power of 3</option>
                                <option value="premium_discount">Premium/Discount</option>
                                <option value="ict_killzone">ICT Killzone</option>
                            </select>
                        </Row>
                        
                        {['fvg', 'order_block', 'liquidity_sweep', 'market_structure', 'premium_discount'].includes(data.type) && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={labelStyle}>
                                    <span>{t('history_depth_label')}</span>
                                    <input 
                                        type="number" min={5} max={500} 
                                        value={data.params?.lookback ?? 100} 
                                        onChange={(e) => setParam('lookback', parseInt(e.target.value) || 100)}
                                        style={smallNumStyle}
                                    />
                                </div>
                                <input 
                                    type="range" min={5} max={500} step={5} 
                                    value={data.params?.lookback ?? 100} 
                                    onChange={(e) => setParam('lookback', parseInt(e.target.value))} 
                                    style={{ width: '100%', accentColor: 'var(--accent-color)', height: '4px' }} 
                                />
                            </div>
                        )}

                        {data.type === 'order_block' && (
                            <Row label={t('block_type_label')}>
                                <select value={data.params?.obType || 'BULLISH'} onChange={(e) => setParam('obType', e.target.value)} style={inputStyle}>
                                    <option value="BULLISH">{t('opt_bullish_buys')}</option>
                                    <option value="BEARISH">{t('opt_bearish_sells')}</option>
                                </select>
                            </Row>
                        )}

                        {data.type === 'liquidity_sweep' && (
                            <Row label={t('sweep_type_label')}>
                                <select value={data.params?.sweepType || 'LOW'} onChange={(e) => setParam('sweepType', e.target.value)} style={inputStyle}>
                                    <option value="LOW">{t('opt_low_sweep')}</option>
                                    <option value="HIGH">{t('opt_high_sweep')}</option>
                                </select>
                            </Row>
                        )}

                        {data.type === 'ict_killzone' && (
                            <Row label={t('trading_session_label')}>
                                <select value={data.params?.zone || 'LONDON'} onChange={(e) => setParam('zone', e.target.value)} style={inputStyle}>
                                    <option value="LONDON">{t('opt_london_session')}</option>
                                    <option value="NEW_YORK">{t('opt_new_york_session')}</option>
                                    <option value="TOKYO">{t('opt_tokyo_session')}</option>
                                    <option value="SYDNEY">{t('opt_sydney_session')}</option>
                                </select>
                            </Row>
                        )}
                    </>
                )}

                {type === 'user_level' && (
                    <>
                        <Row label={t('price_level_label')}>
                            <input
                                type="number"
                                value={data.params?.price ?? 0}
                                onChange={(e) => setParam('price', parseFloat(e.target.value) || 0)}
                                style={inputStyle}
                                placeholder={t('placeholder_eg_60000')}
                                step="any"
                            />
                        </Row>
                        <Row label={t('tolerance_label')}>
                            <input
                                type="number"
                                value={data.params?.tolerance ?? 0.1}
                                onChange={(e) => setParam('tolerance', parseFloat(e.target.value) || 0)}
                                style={inputStyle}
                                placeholder={t('placeholder_tolerance_eg')}
                                step="0.1"
                            />
                        </Row>
                        <Row label={t('level_id_chart_link')}>
                            <input
                                type="number"
                                value={data.params?.levelId ?? 0}
                                onChange={(e) => setParam('levelId', parseInt(e.target.value) || 0)}
                                style={inputStyle}
                                placeholder="0"
                            />
                        </Row>
                        <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            💡 {t('user_level_desc')}
                        </div>
                    </>
                )}

                {type === 'sentiment' && (
                    <>
                        <Row label={t('data_source_label')}>
                            <select value={data.source || 'aggregated'} onChange={(e) => set('source', e.target.value)} style={inputStyle}>
                                <option value="aggregated">{t('opt_sentiment_agg')}</option>
                                <option value="cryptopanic">CryptoPanic API</option>
                                <option value="twitter">X (Twitter) Pulse</option>
                                <option value="reddit">Reddit Sentiment</option>
                            </select>
                        </Row>
                        <Row label={t('property_label')}>
                            <select value={data.property || 'score'} onChange={(e) => set('property', e.target.value)} style={inputStyle}>
                                <option value="score">Sentiment Score (-1 to 1)</option>
                                <option value="label">Sentiment Label (Bullish/Bearish)</option>
                            </select>
                        </Row>
                        <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            💡 {t('sentiment_filter_desc')}
                        </div>
                    </>
                )}

                {type === 'polymarket_scanner' && (
                    <>
                        <Row label={t('min_bet_usd')}>
                            <input
                                type="number"
                                value={data.minAmountUsd ?? 10000}
                                onChange={(e) => set('minAmountUsd', parseFloat(e.target.value) || 0)}
                                style={inputStyle}
                                placeholder={t('placeholder_eg_10000')}
                                step="1000"
                            />
                        </Row>
                        <Row label={t('market_slug_label')}>
                            <input
                                type="text"
                                value={data.marketSlug || ''}
                                onChange={(e) => set('marketSlug', e.target.value)}
                                style={inputStyle}
                                placeholder={t('placeholder_eg_slug')}
                            />
                        </Row>
                        <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            💡 {t('polymarket_scanner_desc')}
                        </div>
                    </>
                )}

                {type === 'finviz_scanner' && (
                    <>
                        <Row label={t('signal_filter_label')}>
                            <select
                                value={data.signal || 'top_gainers'}
                                onChange={(e) => set('signal', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="top_gainers">📈 {t('opt_top_gainers')}</option>
                                <option value="top_losers">📉 {t('opt_top_losers')}</option>
                                <option value="new_high">🚀 {t('opt_new_high')}</option>
                                <option value="new_low">🩸 {t('opt_new_low')}</option>
                                <option value="most_volatile">⚡ {t('opt_most_volatile')}</option>
                                <option value="most_active">🔥 {t('opt_most_active')}</option>
                                <option value="overbought">⚠️ {t('opt_overbought')}</option>
                                <option value="oversold">🟢 {t('opt_oversold')}</option>
                                <option value="insider_buying">💎 {t('opt_insider_buying')}</option>
                                <option value="insider_selling">🚪 {t('opt_insider_selling')}</option>
                            </select>
                        </Row>
                        <Row label={t('min_daily_volume')}>
                            <select
                                value={data.minVolume || '1,000,000'}
                                onChange={(e) => set('minVolume', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="100,000">100,000 {t('shares')}</option>
                                <option value="500,000">500,000 {t('shares')}</option>
                                <option value="1,000,000">1,000,000 {t('shares')}</option>
                                <option value="2,000,000">2,000,000 {t('shares')}</option>
                            </select>
                        </Row>
                        <Row label={t('min_share_price')}>
                            <input
                                type="number"
                                value={data.minPrice ?? 10}
                                onChange={(e) => set('minPrice', parseFloat(e.target.value) || 0)}
                                style={inputStyle}
                                placeholder={t('placeholder_eg_10')}
                                step="1"
                            />
                        </Row>
                        {(data.signal === 'insider_buying' || data.signal === 'insider_selling') ? (
                            <Row label={t('insider_deals_option_label')}>
                                <select
                                    value={data.insiderOption || 'latest'}
                                    onChange={(e) => set('insiderOption', e.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="latest">{t('insider_option_latest')}</option>
                                    <option value="top">{t('insider_option_top')}</option>
                                </select>
                            </Row>
                        ) : (
                            <>
                                <Row label={t('short_float_filter_label')}>
                                    <select
                                        value={data.shortFloat || ''}
                                        onChange={(e) => set('shortFloat', e.target.value)}
                                        style={inputStyle}
                                    >
                                        <option value="">{t('opt_any')}</option>
                                        <option value="High (>15%)">{t('opt_high_15')}</option>
                                        <option value="Very High (>25%)">{t('opt_very_high_25')}</option>
                                    </select>
                                </Row>
                                <Row label={t('sma_200_filter_label')}>
                                    <select
                                        value={data.sma200 || ''}
                                        onChange={(e) => set('sma200', e.target.value)}
                                        style={inputStyle}
                                    >
                                        <option value="">{t('opt_any')}</option>
                                        <option value="Price above SMA200">{t('opt_above_sma200')}</option>
                                        <option value="Price below SMA200">{t('opt_below_sma200')}</option>
                                    </select>
                                </Row>
                                <Row label={t('inst_own_filter_label')}>
                                    <select
                                        value={data.instOwn || ''}
                                        onChange={(e) => set('instOwn', e.target.value)}
                                        style={inputStyle}
                                    >
                                        <option value="">{t('opt_any')}</option>
                                        <option value="High (>50%)">{t('opt_inst_high_50')}</option>
                                        <option value="Very High (>70%)">{t('opt_inst_very_high_70')}</option>
                                    </select>
                                </Row>
                            </>
                        )}
                        <div style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            💡 {t('finviz_scanner_desc')}
                        </div>
                    </>
                )}

                {type === 'mtf' && (
                    <>
                        <Row label={t('analysis_timeframe_label')}>
                            <select
                                value={data.timeframe || '1H'}
                                onChange={(e) => set('timeframe', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="1m">1 {t('opt_1m')}</option>
                                <option value="5m">5 {t('opt_5m')}</option>
                                <option value="15m">15 {t('opt_15m')}</option>
                                <option value="1H">1 {t('opt_1h')}</option>
                                <option value="4H">4 {t('opt_4h')}</option>
                                <option value="1D">1 {t('opt_1d')}</option>
                            </select>
                        </Row>

                        <Row label={t('analysis_mode_label')}>
                            <select
                                value={data.mode || 'trend'}
                                onChange={(e) => set('mode', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="trend">Trend (Long &gt; Short)</option>
                                <option value="signal">Signal Forward</option>
                                <option value="confirm">Confirm Only</option>
                            </select>
                        </Row>

                        <div 
                            style={{ background: 'rgba(236,72,153,0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(236,72,153,0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: t('mtf_desc') }}
                        />
                    </>
                )}

                {type === 'deep_research' && (
                    <>
                        <Row label={t('search_query_label')}>
                            <textarea
                                value={data.query || ''}
                                onChange={(e) => set('query', e.target.value)}
                                style={{
                                    ...inputStyle, height: '80px', resize: 'vertical',
                                    fontFamily: 'inherit', fontSize: '12px', lineHeight: 1.5
                                }}
                                placeholder="Analyze recent news, regulatory risks, hacks for {{pair}} cryptocurrency."
                            />
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                {t('pair_placeholder_desc')}
                            </div>
                        </Row>

                        <Row label={t('research_mode_label')}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {(['quick', 'detailed'] as const).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => set('mode', m)}
                                        style={{
                                            flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer',
                                            fontWeight: 700, fontSize: '12px',
                                            border: (data.mode || 'quick') === m ? '1.5px solid #6366f1' : '1px solid var(--border-color)',
                                            background: (data.mode || 'quick') === m ? 'rgba(99,102,241,0.15)' : 'var(--bg-accent)',
                                            color: (data.mode || 'quick') === m ? '#818cf8' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {m === 'quick' ? t('btn_quick_30s') : t('btn_detailed_3m')}
                                    </button>
                                ))}
                            </div>
                        </Row>

                        <Row label={t('output_signal_type_label')}>
                            <select
                                value={data.outputMode || 'risk_filter'}
                                onChange={(e) => set('outputMode', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="risk_filter">{t('opt_risk_filter')}</option>
                                <option value="sentiment_score">{t('opt_sentiment_score')}</option>
                                <option value="block_critical">{t('opt_block_critical')}</option>
                            </select>
                        </Row>

                        {(data.outputMode === 'risk_filter' || !data.outputMode) && (
                            <Row label={t('block_risk_level_label')}>
                                <select
                                    value={data.riskThreshold || 'high'}
                                    onChange={(e) => set('riskThreshold', e.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="medium">{t('opt_risk_medium')}</option>
                                    <option value="high">{t('opt_risk_high')}</option>
                                    <option value="critical">{t('opt_risk_critical')}</option>
                                </select>
                            </Row>
                        )}

                        <div style={{ marginBottom: '20px' }}>
                            <div style={labelStyle}>
                                <span>{t('results_cache_mins')}</span>
                                <span style={{ color: '#6366f1', fontWeight: 800 }}>{data.cacheMinutes ?? 15} {t('min_short')}</span>
                            </div>
                            <input
                                type="range" min="0" max="60" step="5"
                                value={data.cacheMinutes ?? 15}
                                onChange={(e) => set('cacheMinutes', parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: '#6366f1', height: '4px' }}
                            />
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                {t('cache_zero_desc')}
                            </div>
                        </div>

                        <div 
                            style={{ background: 'rgba(99,102,241,0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: t('deep_research_desc') }}
                        />
                    </>
                )}

                {type === 'portfolio_risk_sizer' && (
                    <>
                        <Row label={t('base_trade_size')}>
                            <input
                                type="number"
                                value={data.baseSize ?? 100}
                                onChange={(e) => set('baseSize', parseFloat(e.target.value) || 0)}
                                style={inputStyle}
                                min="1"
                            />
                        </Row>

                        <Row label={t('risk_mgmt_model')}>
                            <select
                                value={data.riskModel || 'equal_risk'}
                                onChange={(e) => set('riskModel', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="equal_risk">{t('opt_equal_risk')}</option>
                                <option value="atr_adaptive">{t('opt_atr_adaptive')}</option>
                            </select>
                        </Row>

                        <div style={{ marginBottom: '20px' }}>
                            <div style={labelStyle}>
                                <span>{t('correlation_threshold_label')}</span>
                                <span style={{ color: '#f59e0b', fontWeight: 800 }}>{data.correlationThreshold ?? 0.7}</span>
                            </div>
                            <input
                                type="range" min="0.1" max="1.0" step="0.05"
                                value={data.correlationThreshold ?? 0.7}
                                onChange={(e) => set('correlationThreshold', parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: '#f59e0b', height: '4px' }}
                            />
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                {t('correlation_threshold_desc')}
                            </div>
                        </div>

                        <Row label={t('atr_period_candles')}>
                            <input
                                type="number"
                                value={data.volatilityLookback ?? 14}
                                onChange={(e) => set('volatilityLookback', parseInt(e.target.value) || 14)}
                                style={inputStyle}
                                min="2"
                                max="100"
                            />
                        </Row>

                        <div 
                            style={{ background: 'rgba(245,158,11,0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: t('portfolio_risk_sizer_desc') }}
                        />
                    </>
                )}

                {type === 'llm_filter' && (
                    <>
                        <Row label={t('llm_filter_provider_label')}>
                            <select
                                value={data.provider || 'qwen'}
                                onChange={(e) => {
                                    const prov = e.target.value;
                                    const defaultModel = prov === 'qwen' ? 'qwen-max' : 'deepseek-reasoner';
                                    onUpdate(selectedNode.id, { ...data, provider: prov, model: defaultModel });
                                }}
                                style={inputStyle}
                            >
                                <option value="qwen">Qwen (Alibaba)</option>
                                <option value="deepseek">DeepSeek (Web API)</option>
                            </select>
                        </Row>

                        <Row label={t('llm_filter_model_label')}>
                            {data.provider === 'deepseek' ? (
                                <select value={data.model || 'deepseek-reasoner'} onChange={(e) => set('model', e.target.value)} style={inputStyle}>
                                    <option value="deepseek-reasoner">deepseek-reasoner (R1)</option>
                                    <option value="deepseek-chat">deepseek-chat (V3)</option>
                                </select>
                            ) : (
                                <select value={data.model || 'qwen-max'} onChange={(e) => set('model', e.target.value)} style={inputStyle}>
                                    <option value="qwen-max">qwen-max (Premium)</option>
                                    <option value="qwen-plus">qwen-plus (Fast & Capable)</option>
                                    <option value="qwen-turbo">qwen-turbo (Ultra Fast)</option>
                                </select>
                            )}
                        </Row>

                        <div style={{ marginBottom: '20px' }}>
                            <div style={labelStyle}>
                                <span>{t('llm_filter_temperature_label')}</span>
                                <span style={{ color: '#06b6d4', fontWeight: 800 }}>{data.temperature ?? 0.2}</span>
                            </div>
                            <input
                                type="range" min="0.0" max="1.0" step="0.1"
                                value={data.temperature ?? 0.2}
                                onChange={(e) => set('temperature', parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: '#06b6d4', height: '4px' }}
                            />
                        </div>

                        <Row label={t('llm_filter_mock_backtest')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <input
                                    type="checkbox"
                                    checked={data.mockBacktest ?? true}
                                    onChange={(e) => set('mockBacktest', e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: '#06b6d4', cursor: 'pointer' }}
                                    id="llmMockBacktest"
                                />
                                <label htmlFor="llmMockBacktest" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                    {t('use_mock_backtest')}
                                </label>
                            </div>
                        </Row>

                        <Row label={t('llm_filter_prompt_label')}>
                            <textarea
                                value={data.promptTemplate || ''}
                                onChange={(e) => set('promptTemplate', e.target.value)}
                                style={{
                                    ...inputStyle, height: '110px', resize: 'vertical',
                                    fontFamily: 'inherit', fontSize: '12px', lineHeight: 1.5
                                }}
                                placeholder="Analyze market: {{pair}} at {{price}} with RSI {{rsi}}. Reply with LONG, SHORT or FILTER."
                            />
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                                {t('llm_filter_prompt_vars')}
                            </div>
                        </Row>

                        <div 
                            style={{ background: 'rgba(34,211,238,0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(34,211,238,0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: t('llm_filter_desc') }}
                        />
                    </>
                )}

                {type === 'hermes' && (
                    <>
                        <Row label={t('ai_mode_label')}>
                            <select
                                value={data.mode || 'filter'}
                                onChange={(e) => set('mode', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="filter">{t('opt_filter_pass_block')}</option>
                                <option value="score">{t('opt_score_confidence')}</option>
                            </select>
                        </Row>

                        <div style={{ marginBottom: '20px' }}>
                            <div style={labelStyle}>
                                <span>{data.mode === 'filter' ? (language === 'ru' ? 'Порог уверенности ИИ' : 'AI Confidence Gate') : t('min_confidence_level')}</span>
                                <span style={{ color: '#ec4899', fontWeight: 800 }}>{Math.round((data.threshold ?? 0.6) * 100)}%</span>
                            </div>
                            <input
                                type="range" min="0.1" max="1.0" step="0.05"
                                value={data.threshold ?? 0.6}
                                onChange={(e) => set('threshold', parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: '#ec4899', height: '4px' }}
                            />
                        </div>

                        <Row label={t('llm_model_name')}>
                            <input
                                type="text"
                                value={data.model || ''}
                                onChange={(e) => set('model', e.target.value)}
                                style={inputStyle}
                                placeholder="nous-hermes-3"
                            />
                        </Row>

                        <div style={{ marginBottom: '20px' }}>
                            <div style={labelStyle}>
                                <span>{t('results_cache_mins')}</span>
                                <span style={{ color: '#ec4899', fontWeight: 800 }}>{data.cacheMinutes ?? 15} {t('min_short')}</span>
                            </div>
                            <input
                                type="range" min="0" max="60" step="5"
                                value={data.cacheMinutes ?? 15}
                                onChange={(e) => set('cacheMinutes', parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: '#ec4899', height: '4px' }}
                            />
                        </div>

                        <Row label={t('historical_testing')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <input
                                    type="checkbox"
                                    checked={data.mockBacktest ?? true}
                                    onChange={(e) => set('mockBacktest', e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: '#ec4899', cursor: 'pointer' }}
                                    id="hermesMockBacktest"
                                />
                                <label htmlFor="hermesMockBacktest" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                    {t('use_mock_backtest')}
                                </label>
                            </div>
                        </Row>

                        <Row label={t('ai_prompt_template')}>
                            <textarea
                                value={data.promptTemplate || ''}
                                onChange={(e) => set('promptTemplate', e.target.value)}
                                style={{
                                    ...inputStyle, height: '110px', resize: 'vertical',
                                    fontFamily: 'inherit', fontSize: '12px', lineHeight: 1.5
                                }}
                                placeholder="You are a crypto filter..."
                            />
                            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                                {t('ai_prompt_placeholders_desc').replace('{{placeholders}}', '{{pair}}, {{timeframe}}, {{price}}, {{rsi}}, {{trend}}, {{rlhf_trade_history}}')}
                            </div>
                        </Row>

                        <div 
                            style={{ background: 'rgba(236,72,153,0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(236,72,153,0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: t('hermes_desc') }}
                        />
                    </>
                )}

                {type === 'heym_mcp' && (
                    <>
                        <Row label={t('validation_mode_label')}>
                            <select
                                value={data.mode || 'filter'}
                                onChange={(e) => set('mode', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="filter">{t('opt_filter_pass_block')}</option>
                                <option value="score">{t('opt_score_confidence')}</option>
                            </select>
                        </Row>

                        {data.mode === 'score' && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={labelStyle}>
                                    <span>{t('min_confidence_level')}</span>
                                    <span style={{ color: '#6366f1', fontWeight: 800 }}>{Math.round((data.threshold ?? 0.6) * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="0.1" max="1.0" step="0.05"
                                    value={data.threshold ?? 0.6}
                                    onChange={(e) => set('threshold', parseFloat(e.target.value))}
                                    style={{ width: '100%', accentColor: '#6366f1', height: '4px' }}
                                />
                            </div>
                        )}

                        <div style={{ marginBottom: '20px' }}>
                            <div style={labelStyle}>
                                <span>{t('results_cache_mins')}</span>
                                <span style={{ color: '#6366f1', fontWeight: 800 }}>{data.cacheMinutes ?? 15} {t('min_short')}</span>
                            </div>
                            <input
                                type="range" min="0" max="60" step="5"
                                value={data.cacheMinutes ?? 15}
                                onChange={(e) => set('cacheMinutes', parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: '#6366f1', height: '4px' }}
                            />
                        </div>

                        <Row label={t('historical_testing')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <input
                                    type="checkbox"
                                    checked={data.mockBacktest ?? true}
                                    onChange={(e) => set('mockBacktest', e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
                                    id="mockBacktest"
                                />
                                <label htmlFor="mockBacktest" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                    {t('use_mock_backtest_limits')}
                                </label>
                            </div>
                        </Row>

                        <Row label={t('additional_ai_context')}>
                            <textarea
                                value={data.additionalContext || ''}
                                onChange={(e) => set('additionalContext', e.target.value)}
                                style={{
                                    ...inputStyle, height: '70px', resize: 'vertical',
                                    fontFamily: 'inherit', fontSize: '12px', lineHeight: 1.5
                                }}
                                placeholder={t('eg_additional_context')}
                            />
                        </Row>

                        <div 
                            style={{ background: 'rgba(99,102,241,0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: t('heym_validator_desc') }}
                        />
                    </>
                )}

                {type === 'mcp_tool' && (
                    <>
                        <Row label={t('mcp_workflow_id')}>
                            {mcpTools.length > 0 ? (
                                <select 
                                    value={data.workflowId || ''} 
                                    onChange={(e) => set('workflowId', e.target.value)} 
                                    style={inputStyle}
                                >
                                    <option value="">-- {t('default_option')} --</option>
                                    {mcpTools.map(tool => (
                                        <option key={tool.workflowId} value={tool.workflowId}>
                                            {tool.name} ({tool.id})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={data.workflowId || ''}
                                    onChange={(e) => set('workflowId', e.target.value)}
                                    style={inputStyle}
                                    placeholder="Enter Heym Workflow ID..."
                                />
                            )}
                        </Row>

                        <Row label={t('validation_mode_label')}>
                            <select
                                value={data.mode || 'value'}
                                onChange={(e) => set('mode', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="filter">{t('opt_filter_pass_block')}</option>
                                <option value="score">{t('opt_score_confidence')}</option>
                                <option value="value">JSON Value Output</option>
                            </select>
                        </Row>

                        {data.mode === 'score' && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={labelStyle}>
                                    <span>{t('min_confidence_level')}</span>
                                    <span style={{ color: '#a855f7', fontWeight: 800 }}>{Math.round((data.threshold ?? 0.6) * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="0.1" max="1.0" step="0.05"
                                    value={data.threshold ?? 0.6}
                                    onChange={(e) => set('threshold', parseFloat(e.target.value))}
                                    style={{ width: '100%', accentColor: '#a855f7', height: '4px' }}
                                />
                            </div>
                        )}

                        {data.mode === 'value' && (
                            <Row label={t('mcp_output_key')}>
                                <input
                                    type="text"
                                    value={data.outputKey || 'result'}
                                    onChange={(e) => set('outputKey', e.target.value)}
                                    style={inputStyle}
                                    placeholder="result"
                                />
                            </Row>
                        )}

                        <Row label={t('mcp_input_data')}>
                            <textarea
                                value={data.inputData || '{}'}
                                onChange={(e) => set('inputData', e.target.value)}
                                style={{
                                    ...inputStyle, height: '90px', resize: 'vertical',
                                    fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.4
                                }}
                                placeholder={'{\n  "pair": "{{pair}}",\n  "price": "{{price}}"\n}'}
                            />
                            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                                {t('ai_prompt_placeholders_desc').replace('{{placeholders}}', '{{pair}}, {{timeframe}}, {{price}}, {{rsi}}, {{volume}}')}
                            </div>
                        </Row>

                        <Row label={t('historical_testing')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <input
                                    type="checkbox"
                                    checked={data.mockBacktest ?? true}
                                    onChange={(e) => set('mockBacktest', e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: '#a855f7', cursor: 'pointer' }}
                                    id="mcpMockBacktest"
                                />
                                <label htmlFor="mcpMockBacktest" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                    {t('use_mock_backtest_limits')}
                                </label>
                            </div>
                        </Row>

                        <div 
                            style={{ background: 'rgba(168,85,247,0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(168,85,247,0.2)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: t('mcp_tool_desc') }}
                        />
                    </>
                )}

                {type === 'deribit_pcr' && (
                    <>
                        <div 
                            style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}
                            dangerouslySetInnerHTML={{ __html: t('deribit_pcr_desc') }}
                        />
                    </>
                )}

                {type === 'fusion_combiner' && (
                    <>
                        <Row label={t('inputs_count_label')}>
                            <div style={labelStyle}>{t('inputs_count_label')} <span style={{ color: '#ec4899' }}>{data.inputsCount || 3}</span></div>
                            <input 
                                type="range" min="2" max="10" 
                                value={data.inputsCount || 3} 
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    const newWeights = { ...(data.weights || {}) };
                                    for (let i = 0; i < val; i++) {
                                        if (newWeights[`in-${i}`] === undefined) {
                                            newWeights[`in-${i}`] = 1 / val;
                                        }
                                    }
                                    onUpdate(selectedNode.id, { ...data, inputsCount: val, weights: newWeights });
                                }}
                                style={{ width: '100%', accentColor: '#ec4899', height: '4px' }}
                            />
                        </Row>

                        <Row label={t('trigger_threshold')}>
                            <div style={labelStyle}>
                                <span>{t('trigger_threshold')}</span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{data.params?.threshold ?? 0.5}</span>
                            </div>
                            <input 
                                type="range" min="0.1" max="1.0" step="0.05"
                                value={data.params?.threshold ?? 0.5} 
                                onChange={(e) => setParam('threshold', parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: '#ec4899', height: '4px' }}
                            />
                        </Row>

                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ ...labelStyle, marginBottom: '12px' }}>{t('indicator_weights')}</div>
                            {Array.from({ length: data.inputsCount || 3 }).map((_, i) => {
                                const inputId = `in-${i}`;
                                const weightVal = data.weights?.[inputId] ?? (1 / (data.inputsCount || 3));
                                return (
                                    <div key={inputId} style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                            <span>{t('input_prefix')} {i + 1}</span>
                                            <span style={{ fontWeight: 700, color: '#ec4899' }}>{Math.round(weightVal * 100)}%</span>
                                        </div>
                                        <input 
                                            type="range" min="0.0" max="1.0" step="0.01"
                                            value={weightVal}
                                            onChange={(e) => {
                                                const newW = parseFloat(e.target.value);
                                                const updatedWeights = { ...(data.weights || {}) };
                                                updatedWeights[inputId] = newW;
                                                onUpdate(selectedNode.id, { ...data, weights: updatedWeights });
                                            }}
                                            style={{ width: '100%', accentColor: 'var(--text-muted)', height: '4px' }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <Row label={t('self_learning_weights')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <input 
                                    type="checkbox" 
                                    id="enableLearning"
                                    checked={data.params?.enableLearning ?? false} 
                                    onChange={(e) => setParam('enableLearning', e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ec4899' }}
                                />
                                <label htmlFor="enableLearning" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                                    {t('enable_online_adaptation')}
                                </label>
                            </div>
                            
                            {(data.params?.enableLearning ?? false) && (
                                <>
                                    <div style={labelStyle}>
                                        <span>{t('learning_rate_alpha')}</span>
                                        <span style={{ color: '#ec4899', fontWeight: 800 }}>{data.params?.alpha ?? 0.1}</span>
                                    </div>
                                    <input 
                                        type="range" min="0.01" max="0.5" step="0.01"
                                        value={data.params?.alpha ?? 0.1} 
                                        onChange={(e) => setParam('alpha', parseFloat(e.target.value))}
                                        style={{ width: '100%', accentColor: '#ec4899', height: '4px' }}
                                    />
                                    <div 
                                        style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}
                                        dangerouslySetInnerHTML={{ __html: t('alpha_ema_desc') }}
                                    />
                                </>
                            )}
                        </Row>
                    </>
                )}

                {(type === 'exchange_data' || type === 'exchange_scanner') && (
                    <ExchangeBaseConfig
                        type={type}
                        data={data}
                        set={set}
                        onUpdate={onUpdate}
                        selectedNode={selectedNode}
                        inputStyle={inputStyle}
                    />
                )}

                {type === 'exchange' && (
                    <ExchangeUniversalConfig
                        data={data}
                        set={set}
                        onUpdate={onUpdate}
                        selectedNode={selectedNode}
                        inputStyle={inputStyle}
                    />
                )}

                {type === 'trade_action' && (
                    <>
                        {data.action === 'market_order' && (
                            <>
                                <Row label={t('direction')}>
                                    <select value={data.side || 'BUY'} onChange={(e) => set('side', e.target.value)} style={inputStyle}>
                                        <option value="BUY">Long (BUY)</option>
                                        <option value="SELL">Short (SELL)</option>
                                        <option value="AUTO">{t('auto_from_signal')}</option>
                                    </select>
                                </Row>
                                <Row label={t('order_volume')}>
                                    <input type="text" value={data.volume || '100%'} onChange={(e) => set('volume', e.target.value)} style={inputStyle} placeholder={t('eg_volume_or_usd')} />
                                </Row>
                            </>
                        )}
                        {data.action === 'limit_order' && (
                            <>
                                <Row label={t('direction')}>
                                    <select value={data.side || 'BUY'} onChange={(e) => set('side', e.target.value)} style={inputStyle}>
                                        <option value="BUY">Long (BUY)</option>
                                        <option value="SELL">Short (SELL)</option>
                                        <option value="AUTO">{t('auto_from_signal')}</option>
                                    </select>
                                </Row>
                                <Row label={t('order_volume')}>
                                    <input type="text" value={data.volume || '100%'} onChange={(e) => set('volume', e.target.value)} style={inputStyle} placeholder={t('eg_volume_or_usd')} />
                                </Row>
                                <Row label={t('offset')}>
                                    <input type="text" value={data.offset || '-0.5%'} onChange={(e) => set('offset', e.target.value)} style={inputStyle} placeholder={t('eg_offset_or_usd')} />
                                </Row>
                            </>
                        )}
                        {data.action === 'sltp' && (() => {
                            const partialTPs: Array<{ target: string; closePercent: string }> = data.partialTPs || [];

                            const setPartialTP = (idx: number, field: 'target' | 'closePercent', val: string) => {
                                const updated = [...partialTPs];
                                updated[idx] = { ...updated[idx], [field]: val };
                                set('partialTPs', updated);
                            };
                            const addPartialTP = () => {
                                const next = [...partialTPs, { target: `${(partialTPs.length + 1) * 2}%`, closePercent: '33' }];
                                set('partialTPs', next);
                            };
                            const removePartialTP = (idx: number) => {
                                set('partialTPs', partialTPs.filter((_, i) => i !== idx));
                            };

                            return (
                                <>
                                    {/* SL MODE SWITCHER */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                            Stop Loss
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                            {(['percent', 'atr'] as const).map(mode => (
                                                <button
                                                    key={mode}
                                                    onClick={() => set('slMode', mode)}
                                                    style={{
                                                        flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer',
                                                        fontWeight: 700, fontSize: '11px', textTransform: 'uppercase',
                                                        border: (data.slMode || 'percent') === mode ? '1.5px solid #ef4444' : '1px solid var(--border-color)',
                                                        background: (data.slMode || 'percent') === mode ? 'rgba(239,68,68,0.15)' : 'var(--bg-accent)',
                                                        color: (data.slMode || 'percent') === mode ? '#ef4444' : 'var(--text-secondary)',
                                                    }}
                                                >
                                                    {mode === 'percent' ? '% ' + (language === 'ru' ? 'Процент' : 'Percent') : 'ATR ×'}
                                                </button>
                                            ))}
                                        </div>
                                        {(data.slMode || 'percent') === 'percent' ? (
                                            <input type="text" value={data.sl || '1%'} onChange={(e) => set('sl', e.target.value)} style={inputStyle} placeholder="1%" />
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input
                                                        type="number" min={0.5} max={10} step={0.5}
                                                        value={data.slAtrMultiplier ?? 2}
                                                        onChange={(e) => set('slAtrMultiplier', parseFloat(e.target.value) || 2)}
                                                        style={{ ...inputStyle, width: '80px' }}
                                                    />
                                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>× ATR(14)</span>
                                                </div>
                                                <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(239,68,68,0.8)', lineHeight: 1.5 }}>
                                                    💡 {language === 'ru'
                                                        ? `SL = Цена входа ± ATR(14) × ${data.slAtrMultiplier ?? 2}. Требует ноду ATR подключённую к Exchange.`
                                                        : `SL = Entry price ± ATR(14) × ${data.slAtrMultiplier ?? 2}. Requires ATR node connected to Exchange.`}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {partialTPs.length === 0 && (
                                        <Row label="Take Profit">
                                            <input type="text" value={data.tp || '3%'} onChange={(e) => set('tp', e.target.value)} style={inputStyle} placeholder={t('eg_3pct')} />
                                        </Row>
                                    )}

                                    {/* Partial TP Section */}
                                    <div style={{ marginBottom: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{language === 'ru' ? 'Частичный Тейк-Профит' : 'Partial Take Profit'}</span>
                                            <span style={{ fontSize: '10px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                {partialTPs.length} lvl
                                            </span>
                                        </div>

                                        {partialTPs.map((lvl, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', width: '20px' }}>#{idx + 1}</span>
                                                <div style={{ flex: 1, display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        value={lvl.target}
                                                        placeholder="2%"
                                                        title="Profit target %"
                                                        style={{ ...inputStyle, width: '100%', flex: 1, minWidth: '50px' }}
                                                        onChange={e => setPartialTP(idx, 'target', e.target.value)}
                                                    />
                                                    <input
                                                        type="number"
                                                        value={lvl.closePercent}
                                                        min={1} max={100}
                                                        title="Close % of position"
                                                        style={{ ...inputStyle, width: '70px' }}
                                                        onChange={e => setPartialTP(idx, 'closePercent', e.target.value)}
                                                    />
                                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
                                                </div>
                                                <button
                                                    onClick={() => removePartialTP(idx)}
                                                    style={{
                                                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                                                        borderRadius: 6, color: '#ef4444', fontSize: 11, fontWeight: 900,
                                                        width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}
                                                >✕</button>
                                            </div>
                                        ))}

                                        <button
                                            onClick={addPartialTP}
                                            style={{
                                                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                                                borderRadius: 8, color: '#10b981', fontSize: 12, fontWeight: 800,
                                                padding: '8px 12px', cursor: 'pointer', width: '100%', marginTop: '6px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                            }}
                                        >
                                            + {language === 'ru' ? 'Добавить уровень' : 'Add Level'}
                                        </button>
                                    </div>

                                    {/* Move SL to Break-Even */}
                                    {partialTPs.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', background: 'rgba(16,185,129,0.05)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.15)' }}>
                                            <input
                                                type="checkbox"
                                                id="panelMoveSLtoBE"
                                                checked={data.moveSLtoBE ?? false}
                                                onChange={e => set('moveSLtoBE', e.target.checked)}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                                            />
                                            <label htmlFor="panelMoveSLtoBE" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                                                {language === 'ru' ? 'Переносить SL в безубыток' : 'Move SL to Break-Even'}
                                            </label>
                                        </div>
                                    )}

                                    {/* Trailing Stop Section */}
                                    <div style={{ marginBottom: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                            <input
                                                type="checkbox"
                                                id="panelUseTrailing"
                                                checked={data.useTrailing ?? false}
                                                onChange={e => set('useTrailing', e.target.checked)}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#f59e0b' }}
                                            />
                                            <label htmlFor="panelUseTrailing" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                {language === 'ru' ? 'Скользящий Стоп (Trailing)' : 'Trailing Stop'}
                                            </label>
                                        </div>

                                        {data.useTrailing && (
                                            <>
                                                <Row label={language === 'ru' ? 'Дистанция трейлинга' : 'Trailing Distance'}>
                                                    <input
                                                        type="text"
                                                        value={data.trailingDistance || '1%'}
                                                        onChange={e => set('trailingDistance', e.target.value)}
                                                        style={inputStyle}
                                                        placeholder="1%"
                                                    />
                                                </Row>
                                                <Row label={language === 'ru' ? 'Активация трейлинга' : 'Trailing Activation'}>
                                                    <input
                                                        type="text"
                                                        value={data.trailingActivation || '0.5%'}
                                                        onChange={e => set('trailingActivation', e.target.value)}
                                                        style={inputStyle}
                                                        placeholder="0.5%"
                                                    />
                                                </Row>
                                            </>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                        {data.action === 'risk' && (
                            <>
                                <Row label={t('max_drawdown_label')}>
                                    <input type="text" value={data.maxDrawdown || '5%'} onChange={(e) => set('maxDrawdown', e.target.value)} style={inputStyle} placeholder={t('eg_5pct')} />
                                </Row>
                                <Row label={t('max_risk_trade')}>
                                    <input type="text" value={data.maxExposure || '20%'} onChange={(e) => set('maxExposure', e.target.value)} style={inputStyle} placeholder={t('eg_20pct')} />
                                </Row>
                            </>
                        )}
                        {data.action === 'webhook' && (
                            <>
                                <Row label={t('http_method_label')}>
                                    <select value={data.method || 'POST'} onChange={(e) => set('method', e.target.value)} style={inputStyle}>
                                        <option value="POST">POST</option>
                                        <option value="GET">GET</option>
                                    </select>
                                </Row>
                                <Row label={t('webhook_url_label')}>
                                    <input type="text" value={data.url || ''} onChange={(e) => set('url', e.target.value)} style={inputStyle} placeholder="https://..." />
                                </Row>
                            </>
                        )}
                        {data.action === 'grid' && (
                            <>
                                <Row label={t('lower_price')}>
                                    <input type="text" value={data.lowerPrice || '60000'} onChange={(e) => set('lowerPrice', e.target.value)} style={inputStyle} placeholder={t('grid_lower_boundary')} />
                                </Row>
                                <Row label={t('upper_price')}>
                                    <input type="text" value={data.upperPrice || '70000'} onChange={(e) => set('upperPrice', e.target.value)} style={inputStyle} placeholder={t('grid_upper_boundary')} />
                                </Row>
                                <Row label={t('grid_levels')}>
                                    <input type="number" value={data.grids || 20} onChange={(e) => set('grids', parseInt(e.target.value) || 0)} style={inputStyle} min={2} max={200} />
                                </Row>
                                <Row label={t('grid_type')}>
                                    <select value={data.gridType || 'ARITHMETIC'} onChange={(e) => set('gridType', e.target.value)} style={inputStyle}>
                                        <option value="ARITHMETIC">{t('arithmetic')}</option>
                                        <option value="GEOMETRIC">{t('geometric')}</option>
                                    </select>
                                </Row>
                                <Row label={t('investment_volume')}>
                                    <input type="text" value={data.volume || '50%'} onChange={(e) => set('volume', e.target.value)} style={inputStyle} placeholder={t('eg_investment_volume')} />
                                </Row>
                            </>
                        )}
                    </>
                )}
            </div>


            {docs && (
                <div key={docs.title} style={{ 
                    marginTop: '32px', paddingTop: '32px', borderTop: '1px solid var(--border-color)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <BookOpen size={16} color="var(--accent-color)" />
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{docs.title}</div>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                        {docs.desc}
                    </p>
                    <div style={{ background: 'var(--bg-accent)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>{t('how_it_works')}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.5 }}>{docs.logic}</div>
                    </div>
                    {docs.img && (
                        <div 
                            onClick={() => setPreviewImg(docs.img)}
                            style={{ 
                                marginTop: '16px', 
                                borderRadius: '12px', 
                                overflow: 'hidden', 
                                border: '1px solid var(--border-color)',
                                cursor: 'zoom-in',
                                position: 'relative'
                            }}
                        >
                            <img src={docs.img} alt={docs.title} style={{ width: '100%', display: 'block' }} />
                            <div style={{
                                position: 'absolute', bottom: 8, right: 8,
                                background: 'rgba(0,0,0,0.6)', padding: '4px 8px',
                                borderRadius: '6px', fontSize: '10px', color: '#fff',
                                display: 'flex', alignItems: 'center', gap: '4px'
                            }}>
                                <Search size={12} />
                                <span>{t('zoom_in')}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        padding: '16px 20px', borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-accent)', display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{nodeCount} {t('modules_active')}</span>
      </div>

      {/* Image Preview Modal */}
      {previewImg && (
        <div 
            onClick={() => setPreviewImg(null)}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.8)', zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)', padding: '40px'
            }}
        >
            <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
                <button 
                    onClick={() => setPreviewImg(null)}
                    style={{
                        position: 'absolute', top: '-40px', right: 0,
                        background: 'none', border: 'none', color: '#fff', cursor: 'pointer'
                    }}
                >
                    <X size={24} />
                </button>
                <img src={previewImg} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} />
            </div>
        </div>
      )}
      {/* Node Preview Chart Modal */}
      {showPreview && (
          <NodePreviewChart 
              node={selectedNode} 
              onClose={() => setShowPreview(false)} 
              defaultPair={pair}
              defaultTimeframe={timeframe}
              onLevelsChange={(levels) => {
                  if (type === 'user_level' && levels.length > 0) {
                      setParam('price', levels[levels.length - 1]);
                  }
              }}
          />
      )}

    </aside>
  );
};

export default PropertiesPanel;

