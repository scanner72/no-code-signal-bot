import React, { useCallback } from 'react';
import { useStrategyStore } from '../../stores/strategyStore';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useMLModels } from './MLFilterNode';

// ─── Styles ──────────────────────────────────────────────────────────────────
const WRAP: React.CSSProperties = {
  marginTop: '8px',
  padding: '8px',
  background: 'rgba(0,0,0,0.25)',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '6px',
};

const LABEL: React.CSSProperties = {
  fontSize: '10px',
  color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  fontWeight: 700,
  flexShrink: 0,
};

const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 6px',
  outline: 'none',
  width: '80px',
  textAlign: 'right',
};

const SELECT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 6px',
  outline: 'none',
  cursor: 'pointer',
  width: '100%',
  maxWidth: '140px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 900,
  color: 'rgba(255,255,255,0.25)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: '2px',
};

// ─── Helper field components ──────────────────────────────────────────────────
const NumField = ({ label, value, onChange, min, max, step = 1, style }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; style?: React.CSSProperties;
}) => (
  <div style={ROW}>
    <span style={LABEL}>{label}</span>
    <input
      type="number"
      value={value}
      min={min} max={max} step={step}
      style={{ ...INPUT, ...style }}
      onClick={e => e.stopPropagation()}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
    />
  </div>
);

const SelField = ({ label, value, onChange, options }: {
  label: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div style={ROW}>
    <span style={LABEL}>{label}</span>
    <select
      value={value}
      style={SELECT}
      onClick={e => e.stopPropagation()}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const TextField = ({ label, value, onChange, placeholder, style }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; style?: React.CSSProperties;
}) => (
  <div style={ROW}>
    <span style={LABEL}>{label}</span>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      style={{ ...INPUT, textAlign: 'left', ...style }}
      onClick={e => e.stopPropagation()}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  nodeId: string;
  nodeType: string;
  data: any;
}

export const NodeInlineParams: React.FC<Props> = ({ nodeId, nodeType: originalNodeType, data }) => {
  const { t, language } = useLanguageStore();

  const nodeType = ['exchange_data', 'exchange_scanner', 'orderbook', 'order_flow'].includes(originalNodeType)
    ? 'exchange'
    : originalNodeType;

  const updateNodeData = useStrategyStore(s => s.updateNodeData);

  const set = useCallback((key: string, value: any) => {
    updateNodeData(nodeId, { ...data, [key]: value });
  }, [nodeId, data, updateNodeData]);

  const setParam = useCallback((key: string, value: any) => {
    updateNodeData(nodeId, { ...data, params: { ...(data.params || {}), [key]: value } });
  }, [nodeId, data, updateNodeData]);

  // ── Indicator ──────────────────────────────────────────────────────────────
  if (nodeType === 'indicator') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField
          label={t('node_timeframe_label')}
          value={data.timeframe || 'default'}
          onChange={v => set('timeframe', v)}
          options={[
            { value: 'default', label: t('node_timeframe_default') },
            { value: '1m', label: '1m' }, { value: '5m', label: '5m' },
            { value: '15m', label: '15m' }, { value: '1h', label: '1h' },
            { value: '4h', label: '4h' }, { value: '1d', label: '1d' },
          ]}
        />
        <SelField
          label={t('node_indicator_label')}
          value={data.name || 'RSI'}
          onChange={v => set('name', v)}
          options={[
            { value: 'RSI', label: 'RSI' }, { value: 'SMA', label: 'SMA' },
            { value: 'EMA', label: 'EMA' }, { value: 'MACD', label: 'MACD' },
            { value: 'BB', label: 'Bollinger' }, { value: 'ATR', label: 'ATR' },
            { value: 'Stoch', label: 'Stochastic' }, { value: 'Volume', label: 'Volume' },
            { value: 'Divergence', label: 'Divergence' },
          ]}
        />
        {['RSI', 'SMA', 'EMA', 'ATR', 'BB', 'Volume', 'Stoch'].includes(data.name || 'RSI') && (
          <NumField label="Period" value={data.params?.period ?? 14} min={2} max={500}
            onChange={v => setParam('period', Math.round(v))} />
        )}
        {data.name === 'RSI' && (
          <>
            <NumField label="Overbought" value={data.params?.overbought ?? 70} min={50} max={99}
              onChange={v => setParam('overbought', Math.round(v))} />
            <NumField label="Oversold" value={data.params?.oversold ?? 30} min={1} max={50}
              onChange={v => setParam('oversold', Math.round(v))} />
          </>
        )}
        {['SMA', 'EMA'].includes(data.name) && (
          <SelField label="Source" value={data.params?.source || 'close'}
            onChange={v => setParam('source', v)}
            options={[
              { value: 'close', label: 'Close' }, { value: 'open', label: 'Open' },
              { value: 'high', label: 'High' }, { value: 'low', label: 'Low' },
            ]}
          />
        )}
      </div>
    );
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  if (nodeType === 'input') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField
          label={t('node_source_label')}
          value={data.source || 'markPrice'}
          onChange={v => set('source', v)}
          options={[
            { value: 'markPrice', label: 'Mark Price' },
            { value: 'close', label: 'Candle Close' },
            { value: 'open', label: 'Candle Open' },
            { value: 'volume', label: 'Volume' },
            { value: 'openInterest', label: 'Open Interest' },
            { value: 'fundingRate', label: 'Funding Rate' },
          ]}
        />
        <SelField
          label={t('node_condition_label')}
          value={data.params?.operator || 'none'}
          onChange={v => setParam('operator', v)}
          options={[
            { value: 'none', label: t('node_stream_option') }, { value: '>', label: '>' },
            { value: '<', label: '<' }, { value: '>=', label: '>=' },
            { value: '<=', label: '<=' }, { value: '==', label: '==' },
          ]}
        />
        {data.params?.operator && data.params.operator !== 'none' && (
          <NumField label={t('node_value_label')} value={data.params?.threshold ?? 0} step={0.0001}
            onChange={v => setParam('threshold', v)} />
        )}
      </div>
    );
  }

  // ── Comparison ─────────────────────────────────────────────────────────────
  if (nodeType === 'comparison') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField
          label={t('node_operator_label')}
          value={data.operator || '>'}
          onChange={v => set('operator', v)}
          options={[
            { value: '>', label: '>' }, { value: '<', label: '<' },
            { value: '>=', label: '>=' }, { value: '<=', label: '<=' },
            { value: '==', label: '==' }, { value: '!=', label: '!=' },
          ]}
        />
        <NumField label={t('node_value_label') + ' B'} value={data.value ?? 0} step={0.01}
          onChange={v => set('value', v)} />
      </div>
    );
  }

  // ── Cross ──────────────────────────────────────────────────────────────────
  if (nodeType === 'cross') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField
          label={t('node_direction_label')}
          value={data.direction || 'above'}
          onChange={v => set('direction', v)}
          options={[
            { value: 'above', label: t('node_direction_above') },
            { value: 'below', label: t('node_direction_below') },
          ]}
        />
      </div>
    );
  }

  // ── Logic ──────────────────────────────────────────────────────────────────
  if (nodeType === 'logic') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField
          label={t('node_operator_label')}
          value={data.operator || 'AND'}
          onChange={v => set('operator', v)}
          options={[
            { value: 'AND', label: language === 'ru' ? 'AND (Все)' : 'AND (All)' }, 
            { value: 'OR', label: language === 'ru' ? 'OR (Любой)' : 'OR (Any)' },
          ]}
        />
        <NumField label={t('node_inputs_label')} value={data.inputsCount || 2} min={2} max={10}
          onChange={v => set('inputsCount', Math.round(v))} />
      </div>
    );
  }

  // ── Signal ─────────────────────────────────────────────────────────────────
  if (nodeType === 'signal') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField
          label={t('node_signal_type')}
          value={data.signalType || 'LONG'}
          onChange={v => set('signalType', v)}
          options={[
            { value: 'LONG', label: '📈 LONG' }, { value: 'SHORT', label: '📉 SHORT' },
          ]}
        />
      </div>
    );
  }

  // ── SMC ────────────────────────────────────────────────────────────────────
  if (nodeType === 'smc') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField
          label={t('node_timeframe_label')}
          value={data.timeframe || 'default'}
          onChange={v => set('timeframe', v)}
          options={[
            { value: 'default', label: t('node_timeframe_default') },
            { value: '1m', label: '1m' }, { value: '5m', label: '5m' },
            { value: '15m', label: '15m' }, { value: '1h', label: '1h' },
            { value: '4h', label: '4h' }, { value: '1d', label: '1d' },
          ]}
        />
        <SelField
          label={language === 'ru' ? 'Тип SMC' : 'SMC Type'}
          value={data.type || 'fvg'}
          onChange={v => set('type', v)}
          options={[
            { value: 'fvg', label: 'FVG' }, { value: 'order_block', label: 'Order Block' },
            { value: 'liquidity_sweep', label: 'Liq. Sweep' },
            { value: 'market_structure', label: 'Market Str.' },
            { value: 'daily_bias', label: 'Daily Bias' },
            { value: 'power_of_3', label: 'Power of 3' },
            { value: 'premium_discount', label: 'Premium/Disc.' },
            { value: 'ict_killzone', label: 'ICT Killzone' },
          ]}
        />
        {['fvg', 'order_block', 'liquidity_sweep', 'market_structure', 'premium_discount'].includes(data.type || 'fvg') && (
          <NumField label="Lookback" value={data.params?.lookback ?? 100} min={5} max={500} step={5}
            onChange={v => setParam('lookback', Math.round(v))} />
        )}
        {data.type === 'order_block' && (
          <SelField label="OB Type" value={data.params?.obType || 'BULLISH'}
            onChange={v => setParam('obType', v)}
            options={[{ value: 'BULLISH', label: 'Bullish' }, { value: 'BEARISH', label: 'Bearish' }]}
          />
        )}
        {data.type === 'ict_killzone' && (
          <SelField label={t('node_session_label')} value={data.params?.zone || 'LONDON'}
            onChange={v => setParam('zone', v)}
            options={[
              { value: 'LONDON', label: 'London' }, { value: 'NEW_YORK', label: 'New York' },
              { value: 'TOKYO', label: 'Tokyo' }, { value: 'SYDNEY', label: 'Sydney' },
            ]}
          />
        )}
      </div>
    );
  }

  // ── TimeFilter ─────────────────────────────────────────────────────────────
  if (nodeType === 'timeFilter') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <div style={ROW}>
          <span style={LABEL}>{t('node_from_label')}</span>
          <input type="time" value={data.from || '08:00'} style={{ ...INPUT, width: '90px', textAlign: 'left' }}
            onClick={e => e.stopPropagation()} onChange={e => set('from', e.target.value)} />
        </div>
        <div style={ROW}>
          <span style={LABEL}>{t('node_to_label')}</span>
          <input type="time" value={data.to || '11:00'} style={{ ...INPUT, width: '90px', textAlign: 'left' }}
            onClick={e => e.stopPropagation()} onChange={e => set('to', e.target.value)} />
        </div>
        <SelField label={t('timezone_label')} value={data.timezone || 'UTC'}
          onChange={v => set('timezone', v)}
          options={[
            { value: 'UTC', label: 'UTC' }, { value: 'Europe/Moscow', label: 'Moscow +3' },
            { value: 'America/New_York', label: 'New York' }, { value: 'Europe/London', label: 'London' },
          ]}
        />
      </div>
    );
  }

  // ── Scanner ────────────────────────────────────────────────────────────────
  if (nodeType === 'scanner') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField label={t('node_metric_label')} value={data.source || 'volume'}
          onChange={v => set('source', v)}
          options={[
            { value: 'volume', label: 'Volume' }, { value: 'relative_volume', label: 'Rel. Volume' },
            { value: 'change', label: 'Change %' },
          ]}
        />
        <SelField label={t('node_period_label')} value={data.params?.period || '24h'}
          onChange={v => setParam('period', v)}
          options={[
            { value: '15m', label: '15m' }, { value: '1h', label: '1h' },
            { value: '4h', label: '4h' }, { value: '24h', label: '24h' },
          ]}
        />
        <SelField label={t('node_condition_label')} value={data.params?.operator || '>'}
          onChange={v => setParam('operator', v)}
          options={[
            { value: 'none', label: t('node_output_label') }, { value: '>', label: '>' }, { value: '<', label: '<' },
          ]}
        />
        {data.params?.operator !== 'none' && (
          <NumField label={t('node_value_label')} value={data.params?.threshold ?? 0} step={data.source === 'relative_volume' ? 0.1 : 1}
            onChange={v => setParam('threshold', v)} />
        )}
      </div>
    );
  }

  // ── AI Forecast ────────────────────────────────────────────────────────────
  if (nodeType === 'ai_forecast') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField label={t('node_model_label')} value={data.model || 'auto'}
          onChange={v => set('model', v)}
          options={[
            { value: 'auto', label: 'Auto' }, { value: 'kronos-base', label: 'Base 102M' },
            { value: 'kronos-small', label: 'Small 24M' }, { value: 'kronos-mini', label: 'Mini 4M' },
          ]}
        />
        <SelField label={t('node_horizon_label')} value={String(data.predLen || 24)}
          onChange={v => set('predLen', parseInt(v))}
          options={[
            { value: '12', label: language === 'ru' ? '12 свечей' : '12 candles' }, 
            { value: '24', label: language === 'ru' ? '24 свечей' : '24 candles' },
            { value: '48', label: language === 'ru' ? '48 свечей' : '48 candles' }, 
            { value: '120', label: language === 'ru' ? '120 свечей' : '120 candles' },
          ]}
        />
        <SelField label={t('node_output_label')} value={data.property || 'direction'}
          onChange={v => set('property', v)}
          options={[
            { value: 'direction', label: 'UP/DOWN' }, { value: 'predicted_close', label: 'Price' },
            { value: 'predicted_change', label: 'Change %' }, { value: 'confidence', label: 'Confidence' },
          ]}
        />
        <NumField label="Min conf" value={data.minConfidence ?? 0.6} min={0.3} max={0.95} step={0.05}
          onChange={v => set('minConfidence', v)} />
      </div>
    );
  }

  // ── Orderbook ──────────────────────────────────────────────────────────────
  if (nodeType === 'orderbook') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField label={t('node_metric_label')} value={data.metric || 'imbalance'}
          onChange={v => set('metric', v)}
          options={[
            { value: 'imbalance', label: 'Imbalance %' }, { value: 'spread', label: 'Spread' },
            { value: 'wall_distance', label: 'Wall Distance' },
          ]}
        />
        <NumField label={t('node_levels_label')} value={data.levels ?? 20} min={5} max={100} step={5}
          onChange={v => set('levels', Math.round(v))} />
      </div>
    );
  }

  // ── Order Flow ─────────────────────────────────────────────────────────────
  if (nodeType === 'order_flow') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        {data.metric !== undefined && (
          <SelField label={t('node_metric_label')} value={data.metric || 'delta'}
            onChange={v => set('metric', v)}
            options={[{ value: 'delta', label: 'Delta' }, { value: 'cvd', label: 'CVD' }]}
          />
        )}
        {data.period !== undefined && (
          <SelField label={t('node_period_label')} value={data.period || '1h'}
            onChange={v => set('period', v)}
            options={[
              { value: '1m', label: '1m' }, { value: '5m', label: '5m' },
              { value: '15m', label: '15m' }, { value: '1h', label: '1h' }, { value: '4h', label: '4h' },
            ]}
          />
        )}
        {data.side !== undefined && (
          <SelField label={t('node_side_label')} value={data.side || 'BOTH'}
            onChange={v => set('side', v)}
            options={[
              { value: 'LONG', label: 'LONG' }, { value: 'SHORT', label: 'SHORT' }, { value: 'BOTH', label: 'BOTH' },
            ]}
          />
        )}
        {data.threshold !== undefined && (
          <NumField label={t('node_threshold_usd')} value={data.threshold ?? 1000000} step={100000}
            onChange={v => set('threshold', Math.round(v))} />
        )}
      </div>
    );
  }

  // ── Pump/Dump ──────────────────────────────────────────────────────────────
  if (nodeType === 'pump_dump') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <NumField label={t('node_price_movement_pct')} value={data.priceThreshold ?? 5} step={0.5}
          onChange={v => set('priceThreshold', v)} />
        <NumField label="Vol multiplier" value={data.volMultiplier ?? 2} step={0.5}
          onChange={v => set('volMultiplier', v)} />
        <NumField label="Lookback" value={data.lookback ?? 3} min={1} max={50}
          onChange={v => set('lookback', Math.round(v))} />
      </div>
    );
  }

  // ── Sentiment ──────────────────────────────────────────────────────────────
  if (nodeType === 'sentiment') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField label={t('node_source_label')} value={data.source || 'aggregated'}
          onChange={v => set('source', v)}
          options={[
            { value: 'aggregated', label: t('node_aggregator') }, { value: 'cryptopanic', label: 'CryptoPanic' },
            { value: 'twitter', label: 'X (Twitter)' }, { value: 'reddit', label: 'Reddit' },
          ]}
        />
        <SelField label={t('node_property')} value={data.property || 'score'}
          onChange={v => set('property', v)}
          options={[
            { value: 'score', label: 'Score (-1..1)' }, { value: 'label', label: 'Label (BULL/BEAR)' },
          ]}
        />
      </div>
    );
  }

  if (nodeType === 'ml_filter') {
    const mlModels: Array<{ id: number; name: string; accuracy?: number }> = useMLModels();

    const modelOptions = [
      { value: '', label: mlModels.length === 0 ? t('node_loading') : t('node_select_model') },
      ...mlModels.map(m => ({
        value: String(m.id),
        label: m.accuracy !== undefined
          ? `${m.name} (${(m.accuracy * 100).toFixed(0)}%)`
          : m.name,
      })),
    ];

    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_model_label')}</div>
        <SelField
          label={t('node_model_label')}
          value={String(data.modelId || '')}
          onChange={v => {
            const found = mlModels.find(m => String(m.id) === v);
            updateNodeData(nodeId, {
              ...data,
              modelId: v ? Number(v) : null,
              modelName: found?.name || '',
            });
          }}
          options={modelOptions}
        />
        <NumField
          label="Min score"
          value={data.minScore ?? 0.7}
          min={0.5} max={0.95} step={0.05}
          onChange={v => set('minScore', v)}
        />
        {mlModels.length === 0 && (
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
            {t('node_no_trained_models')}
          </div>
        )}
      </div>
    );
  }

  // ── Hermes ────────────────────────────────────────────────────────────────
  if (nodeType === 'hermes') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_mode_label')} Hermes</div>
        <SelField label={t('node_mode_label')} value={data.mode || 'filter'}
          onChange={v => set('mode', v)}
          options={[
            { value: 'filter', label: 'Filter (PASS/BLOCK)' },
            { value: 'score', label: 'Score (0.0-1.0)' },
          ]}
        />
        <SelField label={t('node_model_label')} value={data.model || 'nous-hermes-3'}
          onChange={v => set('model', v)}
          options={[
            { value: 'nous-hermes-3', label: 'Nous Hermes 3 (Ollama)' },
            { value: 'gpt-4o', label: 'GPT-4o (API)' },
            { value: 'mistral', label: 'Mistral (API)' },
          ]}
        />
        {data.mode === 'score' && (
          <NumField label="Min score" value={data.threshold ?? 0.6} min={0.1} max={1.0} step={0.1}
            onChange={v => set('threshold', v)} />
        )}
        <NumField label={t('node_cache_mins')} value={data.cacheMinutes ?? 15} min={0} max={1440} step={5}
          onChange={v => set('cacheMinutes', v)} />
        
        <div style={{ ...ROW, flexDirection: 'column', alignItems: 'stretch' }}>
          <span style={LABEL}>{t('node_prompt_label')}</span>
          <textarea
            value={data.promptTemplate || 'You are a crypto filter. Should we execute this signal?\nContext:\nPair: {{pair}}\nPrice: {{price}}\nRSI: {{rsi}}\n\nReply with JSON: { "decision": "PASS", "confidence": 0.8 }'}
            onChange={e => set('promptTemplate', e.target.value)}
            style={{
              ...INPUT, width: '100%', height: '80px', textAlign: 'left',
              resize: 'vertical', fontFamily: 'monospace', fontSize: '9px'
            }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          />
        </div>
      </div>
    );
  }

  // ── UserLevel ─────────────────────────────────────────────────────────────
  if (nodeType === 'user_level') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <NumField label={t('node_price_label')} value={data.params?.price ?? 0} min={0} step={0.01}
          onChange={v => setParam('price', v)} />
        <NumField label={t('node_tolerance_pct')} value={data.params?.tolerance ?? 0.1} min={0} step={0.1}
          onChange={v => setParam('tolerance', v)} />
        <NumField label="Level ID" value={data.params?.levelId ?? 0} min={0}
          onChange={v => setParam('levelId', Math.round(v))} />
      </div>
    );
  }

  // ── Custom Code ───────────────────────────────────────────────────────────
  if (nodeType === 'custom_code') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <div style={ROW}>
          <span style={LABEL}>{t('node_name_label')}</span>
          <input
            type="text"
            value={data.name || ''}
            style={{ ...INPUT, width: '120px', textAlign: 'left' }}
            onClick={e => e.stopPropagation()}
            onChange={e => set('name', e.target.value)}
            placeholder="Script name"
          />
        </div>
      </div>
    );
  }

  // ── Universal Exchange Node ────────────────────────────────────────────────
  if (nodeType === 'exchange') {
    const mode = data.mode || 'ticker';
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_exchange_params')}</div>
        <SelField label={t('node_mode_label')} value={mode}
          onChange={v => set('mode', v)}
          options={[
            { value: 'ticker', label: language === 'ru' ? 'Тикер (Ticker)' : 'Ticker' },
            { value: 'scanner', label: language === 'ru' ? 'Сканер (Scanner)' : 'Scanner' },
            { value: 'orderbook', label: language === 'ru' ? 'Стакан (Order Book)' : 'Order Book' },
            { value: 'orderflow', label: language === 'ru' ? 'Поток (Order Flow)' : 'Order Flow' },
          ]}
        />
        <SelField label={t('node_exchange_label')} value={data.exchange || 'binance'}
          onChange={v => set('exchange', v)}
          options={[
            { value: 'binance', label: 'Binance' }, { value: 'bybit', label: 'Bybit' },
            { value: 'okx', label: 'OKX' }, { value: 'kraken', label: 'Kraken' },
            { value: 'coinbase', label: 'Coinbase' }, { value: 'htx', label: 'HTX' },
            { value: 'mexc', label: 'MEXC' },
          ]}
        />

        {/* MODE: TICKER */}
        {mode === 'ticker' && (
          <>
            <SelField label={t('node_data_type')} value={data.dataType || 'price'}
              onChange={v => set('dataType', v)}
              options={[
                { value: 'price', label: 'Price' }, { value: 'funding_rate', label: 'Funding' },
                { value: 'open_interest', label: 'OI' }, { value: 'price_delta', label: 'Arb. Delta' },
              ]}
            />
            <TextField label={t('node_pair_label')} value={data.pair || 'BTCUSDT'} onChange={v => set('pair', v)} placeholder="BTCUSDT" />
            {data.dataType === 'price_delta' && (
              <SelField label={t('node_compare_exchange')} value={data.compareExchange || 'bybit'}
                onChange={v => set('compareExchange', v)}
                options={[
                  { value: 'binance', label: 'Binance' }, { value: 'bybit', label: 'Bybit' },
                  { value: 'okx', label: 'OKX' }, { value: 'mexc', label: 'MEXC' },
                ]}
              />
            )}
          </>
        )}

        {/* MODE: SCANNER */}
        {mode === 'scanner' && (
          <>
            <TextField label={t('node_quote_asset')} value={data.quoteAsset || 'USDT'} onChange={v => set('quoteAsset', v)} placeholder="USDT" style={{ width: '60px' }} />
            <TextField label={t('node_symbols_label')} value={data.symbols || ''} onChange={v => set('symbols', v.toUpperCase())} placeholder="ALL" style={{ width: '80px' }} />
            <NumField label={t('node_top_n')} value={data.limit ?? 20} min={1} max={100}
              onChange={v => set('limit', Math.round(v))} />
            <SelField label={t('node_sorting_label')} value={data.sortBy || 'volume'}
              onChange={v => set('sortBy', v)}
              options={[
                { value: 'volume', label: 'Volume ↓' }, { value: 'change_up', label: '▲ Gainers' },
                { value: 'change_down', label: '▼ Losers' },
              ]}
            />
            <div style={SECTION_LABEL}>{t('node_filters_optional')}</div>
            <NumField label={t('node_min_vol')} value={data.minVolume24h ?? 0} step={1000000}
              onChange={v => set('minVolume24h', v || undefined)} />
            <NumField label={t('node_max_vol')} value={data.maxVolume24h ?? 0} step={1000000}
              onChange={v => set('maxVolume24h', v || undefined)} />
            <TextField label={t('node_min_chg')} value={String(data.minChangePercent ?? '')} onChange={v => set('minChangePercent', v)} placeholder="-50" style={{ width: '60px' }} />
            <TextField label={t('node_max_chg')} value={String(data.maxChangePercent ?? '')} onChange={v => set('maxChangePercent', v)} placeholder="50" style={{ width: '60px' }} />
            <TextField label={t('node_min_price')} value={String(data.minPrice ?? '')} onChange={v => set('minPrice', v)} placeholder="0.001" style={{ width: '60px' }} />
            <TextField label={t('node_max_price')} value={String(data.maxPrice ?? '')} onChange={v => set('maxPrice', v)} placeholder="100000" style={{ width: '60px' }} />
          </>
        )}

        {/* MODE: ORDER BOOK */}
        {mode === 'orderbook' && (
          <>
            <SelField label={t('node_metric_label')} value={data.metric || 'imbalance'}
              onChange={v => set('metric', v)}
              options={[
                { value: 'imbalance', label: 'Imbalance %' }, { value: 'spread', label: 'Spread' },
                { value: 'wall_distance', label: 'Wall Distance' },
              ]}
            />
            <NumField label={t('node_levels_label')} value={data.levels ?? 20} min={5} max={100} step={5}
              onChange={v => set('levels', Math.round(v))} />
          </>
        )}

        {/* MODE: ORDER FLOW */}
        {mode === 'orderflow' && (
          <>
            <SelField label={t('node_metric_label')} value={data.metric || 'delta'}
              onChange={v => set('metric', v)}
              options={[{ value: 'delta', label: 'Delta' }, { value: 'cvd', label: 'CVD' }]}
            />
            <SelField label={t('node_period_label')} value={data.period || '1h'}
              onChange={v => set('period', v)}
              options={[
                { value: '1m', label: '1m' }, { value: '5m', label: '5m' },
                { value: '15m', label: '15m' }, { value: '1h', label: '1h' }, { value: '4h', label: '4h' },
              ]}
            />
            <SelField label={t('node_side_label')} value={data.side || 'BOTH'}
              onChange={v => set('side', v)}
              options={[
                { value: 'LONG', label: 'LONG' }, { value: 'SHORT', label: 'SHORT' }, { value: 'BOTH', label: 'BOTH' },
              ]}
            />
            <NumField label={t('node_threshold_usd')} value={data.threshold ?? 1000000} step={100000}
              onChange={v => set('threshold', Math.round(v))} />
          </>
        )}
      </div>
    );
  }

  // ── Exchange Data ──────────────────────────────────────────────────────────
  if (nodeType === 'exchange_data') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField label={t('node_exchange_label')} value={data.exchange || 'binance'}
          onChange={v => set('exchange', v)}
          options={[
            { value: 'binance', label: 'Binance' }, { value: 'bybit', label: 'Bybit' },
            { value: 'okx', label: 'OKX' }, { value: 'kraken', label: 'Kraken' },
            { value: 'coinbase', label: 'Coinbase' }, { value: 'htx', label: 'HTX' },
            { value: 'mexc', label: 'MEXC' },
          ]}
        />
        <SelField label={t('node_data_type')} value={data.dataType || 'price'}
          onChange={v => set('dataType', v)}
          options={[
            { value: 'price', label: 'Price' }, { value: 'funding_rate', label: 'Funding' },
            { value: 'open_interest', label: 'OI' }, { value: 'price_delta', label: 'Arb. Delta' },
          ]}
        />
        <TextField label={t('node_pair_label')} value={data.pair || 'BTCUSDT'} onChange={v => set('pair', v)} placeholder="BTCUSDT" />
        {data.dataType === 'price_delta' && (
          <SelField label={t('node_compare_exchange')} value={data.compareExchange || 'bybit'}
            onChange={v => set('compareExchange', v)}
            options={[
              { value: 'binance', label: 'Binance' }, { value: 'bybit', label: 'Bybit' },
              { value: 'okx', label: 'OKX' }, { value: 'mexc', label: 'MEXC' },
            ]}
          />
        )}
      </div>
    );
  }

  // ── Exchange Scanner ───────────────────────────────────────────────────────
  if (nodeType === 'exchange_scanner') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <SelField label={t('node_exchange_label')} value={data.exchange || 'binance'}
          onChange={v => set('exchange', v)}
          options={[
            { value: 'binance', label: 'Binance' }, { value: 'bybit', label: 'Bybit' },
            { value: 'okx', label: 'OKX' }, { value: 'mexc', label: 'MEXC' },
          ]}
        />
        <TextField label={t('node_quote_asset')} value={data.quoteAsset || 'USDT'} onChange={v => set('quoteAsset', v)} placeholder="USDT" style={{ width: '60px' }} />
        <TextField label={t('node_symbols_label')} value={data.symbols || ''} onChange={v => set('symbols', v.toUpperCase())} placeholder="ALL" style={{ width: '80px' }} />
        <NumField label={t('node_top_n')} value={data.limit ?? 20} min={1} max={100}
          onChange={v => set('limit', Math.round(v))} />
        <SelField label={t('node_sorting_label')} value={data.sortBy || 'volume'}
          onChange={v => set('sortBy', v)}
          options={[
            { value: 'volume', label: 'Volume ↓' }, { value: 'change_up', label: '▲ Gainers' },
            { value: 'change_down', label: '▼ Losers' },
          ]}
        />
        <div style={SECTION_LABEL}>{t('node_filters_optional')}</div>
        <NumField label={t('node_min_vol')} value={data.minVolume24h ?? 0} step={1000000}
          onChange={v => set('minVolume24h', v || undefined)} />
        <NumField label={t('node_max_vol')} value={data.maxVolume24h ?? 0} step={1000000}
          onChange={v => set('maxVolume24h', v || undefined)} />
        <TextField label={t('node_min_chg')} value={String(data.minChangePercent ?? '')} onChange={v => set('minChangePercent', v)} placeholder="-50" style={{ width: '60px' }} />
        <TextField label={t('node_max_chg')} value={String(data.maxChangePercent ?? '')} onChange={v => set('maxChangePercent', v)} placeholder="50" style={{ width: '60px' }} />
        <TextField label={t('node_min_price')} value={String(data.minPrice ?? '')} onChange={v => set('minPrice', v)} placeholder="0.001" style={{ width: '60px' }} />
        <TextField label={t('node_max_price')} value={String(data.maxPrice ?? '')} onChange={v => set('maxPrice', v)} placeholder="100000" style={{ width: '60px' }} />
      </div>
    );
  }

  // ── Trade Action ──────────────────────────────────────────────────────────
  if (nodeType === 'trade_action') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        {(data.action === 'market_order' || data.action === 'limit_order') && (
          <>
            <SelField label={t('node_direction_label')} value={data.side || 'BUY'}
              onChange={v => set('side', v)}
              options={[
                { value: 'BUY', label: 'Long (BUY)' },
                { value: 'SELL', label: 'Short (SELL)' },
                { value: 'AUTO', label: 'Auto' },
              ]}
            />
            <TextField label={t('node_volume_label')} value={data.volume || '100%'} onChange={v => set('volume', v)} placeholder="100%" />
            {data.action === 'limit_order' && (
              <TextField label={t('node_offset_label')} value={data.offset || '-0.5%'} onChange={v => set('offset', v)} placeholder="-0.5%" />
            )}
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
              {/* ── Fixed SL / TP ────────────────────────── */}
              <div style={SECTION_LABEL}>SL / TP</div>
              <TextField label={t('node_stop_loss')} value={data.sl || '1%'} onChange={v => set('sl', v)} placeholder="1%" />
              {partialTPs.length === 0 && (
                <TextField label={t('node_take_profit')} value={data.tp || '3%'} onChange={v => set('tp', v)} placeholder="3%" />
              )}

              {/* ── Partial TP levels ─────────────────────── */}
              <div style={{ ...SECTION_LABEL, marginTop: 6 }}>PARTIAL TAKE PROFIT</div>
              {partialTPs.map((lvl, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ ...LABEL, width: 18, color: '#10b981' }}>#{idx + 1}</span>
                  <input
                    type="text"
                    value={lvl.target}
                    placeholder="2%"
                    title="Profit target %"
                    style={{ ...INPUT, width: 44 }}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setPartialTP(idx, 'target', e.target.value)}
                  />
                  <input
                    type="number"
                    value={lvl.closePercent}
                    min={1} max={100}
                    title="Close % of position"
                    style={{ ...INPUT, width: 38 }}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setPartialTP(idx, 'closePercent', e.target.value)}
                  />
                  <span style={{ ...LABEL, color: 'rgba(255,255,255,0.3)' }}>%</span>
                  <button
                    onClick={e => { e.stopPropagation(); removePartialTP(idx); }}
                    style={{
                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 4, color: '#ef4444', fontSize: 9, fontWeight: 900,
                      padding: '2px 5px', cursor: 'pointer', flexShrink: 0,
                    }}
                  >✕</button>
                </div>
              ))}
              <button
                onClick={e => { e.stopPropagation(); addPartialTP(); }}
                style={{
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: 5, color: '#10b981', fontSize: 10, fontWeight: 800,
                  padding: '3px 8px', cursor: 'pointer', width: '100%', marginTop: 2,
                }}
              >+ ADD LEVEL</button>

              {/* ── Break-Even toggle ─────────────────────── */}
              {partialTPs.length > 0 && (
                <div style={{ ...ROW, marginTop: 4 }}>
                  <span style={LABEL}>MOVE SL TO BE</span>
                  <input
                    type="checkbox"
                    checked={data.moveSLtoBE ?? false}
                    onChange={e => { e.stopPropagation(); set('moveSLtoBE', e.target.checked); }}
                    style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#10b981' }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}

              {/* ── Trailing Stop ─────────────────────────── */}
              <div style={{ ...SECTION_LABEL, marginTop: 6 }}>TRAILING STOP</div>
              <div style={{ ...ROW }}>
                <span style={LABEL}>ENABLED</span>
                <input
                  type="checkbox"
                  checked={data.useTrailing ?? false}
                  onChange={e => { e.stopPropagation(); set('useTrailing', e.target.checked); }}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#f59e0b' }}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {data.useTrailing && (
                <>
                  <TextField
                    label="DISTANCE"
                    value={data.trailingDistance || '1%'}
                    onChange={v => set('trailingDistance', v)}
                    placeholder="1%"
                  />
                  <TextField
                    label="ACTIVATION"
                    value={data.trailingActivation || '0.5%'}
                    onChange={v => set('trailingActivation', v)}
                    placeholder="0.5%"
                  />
                </>
              )}
            </>
          );
        })()}

        {data.action === 'risk' && (
          <>
            <TextField label="Max DD" value={data.maxDrawdown || '5%'} onChange={v => set('maxDrawdown', v)} placeholder="5%" />
            <TextField label="Max Exp" value={data.maxExposure || '20%'} onChange={v => set('maxExposure', v)} placeholder="20%" />
          </>
        )}
        {data.action === 'webhook' && (
          <>
            <SelField label={t('http_method_label') || "Метод"} value={data.method || 'POST'}
              onChange={v => set('method', v)}
              options={[{ value: 'POST', label: 'POST' }, { value: 'GET', label: 'GET' }]}
            />
            <TextField label="URL" value={data.url || ''} onChange={v => set('url', v)} placeholder="https://..." style={{ width: '120px' }} />
          </>
        )}
        {data.action === 'telegram' && (
          <>
            <TextField
              label={language === 'ru' ? 'Сообщение' : 'Message'}
              value={data.telegramMessage || ''}
              onChange={v => set('telegramMessage', v)}
              placeholder="Сигнал: {{signal}}"
              style={{ width: '120px' }}
            />
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', lineHeight: '1.3' }}>
              {language === 'ru'
                ? 'Используйте плейсхолдеры: {{pair}}, {{signal}}, {{price}}.'
                : 'Use placeholders: {{pair}}, {{signal}}, {{price}}.'}
            </div>
          </>
        )}
        {data.action === 'grid' && (
          <>
            <div style={{ display: 'flex', gap: '4px' }}>
              <TextField label={t('node_lower_price')} value={data.lowerPrice || '60000'} onChange={v => set('lowerPrice', v)} placeholder="Min" style={{ width: '45px' }} />
              <TextField label={t('node_upper_price')} value={data.upperPrice || '70000'} onChange={v => set('upperPrice', v)} placeholder="Max" style={{ width: '45px' }} />
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <TextField label={t('node_grids_count')} value={String(data.grids || 20)} onChange={v => set('grids', parseInt(v) || 0)} style={{ width: '30px' }} />
              <SelField label={t('node_grid_type')} value={data.gridType || 'ARITHMETIC'}
                onChange={v => set('gridType', v)}
                options={[{ value: 'ARITHMETIC', label: 'Arith.' }, { value: 'GEOMETRIC', label: 'Geom.' }]}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Webhook Input ──────────────────────────────────────────────────────────
  if (nodeType === 'webhook_input') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_params_header')}</div>
        <NumField label={t('node_ttl_sec')} value={data.params?.ttl ?? 120} min={5} max={3600} step={5}
          onChange={v => setParam('ttl', Math.round(v))} />
        <TextField label={t('node_field_label')} value={data.params?.field || ''} onChange={v => setParam('field', v)}
          placeholder="action" style={{ width: '80px' }} />
        <TextField label={t('node_expected_value')} value={data.params?.expectedValue || ''} onChange={v => setParam('expectedValue', v)}
          placeholder={t('node_filters_optional')} style={{ width: '80px' }} />
        <SelField label={t('node_mode_label')} value={data.params?.mode || 'any'}
          onChange={v => setParam('mode', v)}
          options={[
            { value: 'any', label: t('node_any_payload') },
            { value: 'match', label: t('node_match_field') },
          ]}
        />
      </div>
    );
  }

  // ── MTF ────────────────────────────────────────────────────────────────────
  if (nodeType === 'mtf') {
    return (
      <div style={WRAP}>
        <div style={SECTION_LABEL}>{t('node_multi_timeframe')}</div>
        <SelField
          label={t('node_timeframe_label')}
          value={data.timeframe || '1H'}
          onChange={v => set('timeframe', v)}
          options={[
            { value: '1m', label: '1m' }, { value: '3m', label: '3m' },
            { value: '5m', label: '5m' }, { value: '15m', label: '15m' },
            { value: '30m', label: '30m' }, { value: '1H', label: '1H' },
            { value: '2H', label: '2H' }, { value: '4H', label: '4H' },
            { value: '6H', label: '6H' }, { value: '12H', label: '12H' },
            { value: '1D', label: '1D' }, { value: '1W', label: '1W' },
          ]}
        />
        <SelField
          label={t('node_mode_label')}
          value={data.mode || 'trend'}
          onChange={v => set('mode', v)}
          options={[
            { value: 'trend', label: 'Trend (Long>Short)' },
            { value: 'signal', label: 'Signal Forward' },
            { value: 'confirm', label: 'Confirm Only' },
          ]}
        />
      </div>
    );
  }

  return null;
};
