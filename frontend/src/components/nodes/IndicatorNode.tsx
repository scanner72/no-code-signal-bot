import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { nodeWrap, nodeHead, nodeDot, nodeType, nodeBody, nodeParam, nodeParamVal, PORT } from './nodeStyles';
import { useLanguageStore } from '../../stores/useLanguageStore';

const Sparkline = ({ name, params, type }: { name: string; params: any; type: string }) => {
  const [points, setPoints] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchSparkline = async () => {
      try {
        const apiBase = (window as any).env?.VITE_API_URL || import.meta.env.VITE_API_URL || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000/api`;
        const response = await fetch(
          `${apiBase}/indicators/preview?pair=BTCUSDT&timeframe=1h&type=${type}&name=${name}&params=${encodeURIComponent(
            JSON.stringify(params || {})
          )}`
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (active && data.indicators && Array.isArray(data.indicators)) {
          const raw = data.indicators.map((ind: any) =>
            typeof ind === 'object' && ind !== null
              ? ind.value ?? ind.rsi ?? ind.macd ?? ind.sma ?? 0
              : ind
          );
          const numericPoints = raw.filter((v: any) => typeof v === 'number' && !isNaN(v)).slice(-20);
          if (numericPoints.length > 2) {
            setPoints(numericPoints);
          }
        }
      } catch (e) {
        // Fallback silently
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchSparkline();
    return () => {
      active = false;
    };
  }, [name, params, type]);

  if (loading || points.length < 3) {
    return (
      <svg width="40" height="15" viewBox="0 0 40 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 10 Q 5 15, 10 10 T 20 8 T 30 12 T 40 2" stroke="#7F77DD" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min === 0 ? 1 : max - min;

  const width = 40;
  const height = 15;
  const padding = 2;
  const usableHeight = height - padding * 2;

  const svgPoints = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - padding - ((val - min) / range) * usableHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${svgPoints.join(' L ')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d={pathD}
        stroke="#10B981"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 2px rgba(16,185,129,0.4))' }}
      />
    </svg>
  );
};

const IndicatorNode = ({ data, selected, id }: NodeProps) => {
  const { t } = useLanguageStore();
  return (
    <div style={nodeWrap(selected)}>
      <div style={nodeHead}>
        <span style={nodeDot('#7F77DD')} />
        <span style={nodeType('#534AB7')}>{t('indicator')}</span>
      </div>
    <div style={nodeBody}>
      <div style={{ ...nodeParam, fontWeight: 800, color: '#fff', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {data.name || 'RSI'}
          {data.timeframe && data.timeframe !== 'default' && (
            <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 6px', borderRadius: '4px' }}>
              {data.timeframe}
            </span>
          )}
        </div>
        <Sparkline name={data.name || 'RSI'} params={data.params} type="indicator" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {data.params?.period !== undefined && (
          <div style={nodeParam}>Period: <span style={nodeParamVal}>{data.params.period}</span></div>
        )}
        {data.params?.source && (
          <div style={nodeParam}>Source: <span style={nodeParamVal}>{data.params.source}</span></div>
        )}
        {data.params?.overbought !== undefined && (
          <div style={nodeParam}>Levels: <span style={nodeParamVal}>{data.params.overbought}/{data.params.oversold}</span></div>
        )}
      </div>
    </div>
    <Handle type="target" position={Position.Left} style={PORT('#7F77DD')} />
    <Handle type="source" position={Position.Right} style={PORT('#7F77DD')} />
    </div>
  );
};

export default memo(IndicatorNode);
