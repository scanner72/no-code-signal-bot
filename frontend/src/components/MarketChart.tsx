import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { AlertTriangle } from 'lucide-react';
import { useChartSyncStore } from '../stores/useChartSyncStore';

const calculateEMA = (candles: any[], period: number) => {
  if (candles.length < period) return [];
  const k = 2 / (period + 1);
  let emaVal = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  const res = [{ time: candles[period - 1].time, value: emaVal }];
  for (let i = period; i < candles.length; i++) {
    emaVal = candles[i].close * k + emaVal * (1 - k);
    res.push({ time: candles[i].time, value: emaVal });
  }
  return res;
};

const calculateSMA = (candles: any[], period: number) => {
  if (candles.length < period) return [];
  const res = [];
  for (let i = period - 1; i < candles.length; i++) {
    const sum = candles.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.close, 0);
    res.push({ time: candles[i].time, value: sum / period });
  }
  return res;
};

const MarketChart = ({ data, signals, smc, onLevelsChange, nodes, openTrade }: {
  data: any[];
  signals: any[];
  smc?: any;
  onLevelsChange?: (levels: number[]) => void;
  nodes?: any[];
  /** Currently open paper-trade or live trade for TP/SL visualization */
  openTrade?: {
    entryPrice: number;
    type: 'LONG' | 'SHORT';
    stopPrice?: number;
    sl?: string;  // e.g. "1%"
    tp?: string;  // e.g. "3%"
    partialTPs?: Array<{ target: string }>;
    useTrailing?: boolean;
    trailingDistance?: string;
  } | null;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<any[]>([]);
  const userLevelsRef = useRef<any[]>([]);
  const [drawMode, setDrawMode] = useState<boolean>(false);
  const [userLevels, setUserLevels] = useState<number[]>([]);

  const activeLevels = useChartSyncStore((state) => state.activeLevels);
  const onLevelDragEnd = useChartSyncStore((state) => state.onLevelDragEnd);
  const updateLevelPrice = useChartSyncStore((state) => state.updateLevelPrice);

  const activeLevelsRef = useRef<Record<string, any>>({});
  const indicatorSeriesRef = useRef<any[]>([]);
  /** Price lines for the open trade (TP/SL/Entry) */
  const tradeLinesRef = useRef<any[]>([]);

  // Use refs to keep event handlers fresh without recreating the chart instance
  const drawModeRef = useRef<boolean>(false);
  const onLevelsChangeRef = useRef(onLevelsChange);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    onLevelsChangeRef.current = onLevelsChange;
  }, [onLevelsChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const colors = {
      bg: 'transparent',
      text: '#94A3B8',
      grid: 'rgba(255, 255, 255, 0.03)',
      border: 'rgba(255, 255, 255, 0.05)',
      up: '#10B981',
      down: '#EF4444',
      crosshair: '#7C3AED'
    };

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: colors.grid, style: 1 },
        horzLines: { color: colors.grid, style: 1 },
      },
      crosshair: {
        mode: 0,
        vertLine: { width: 1, color: colors.crosshair, style: 3, labelBackgroundColor: '#7C3AED' },
        horzLine: { width: 1, color: colors.crosshair, style: 3, labelBackgroundColor: '#7C3AED' },
      },
      width: containerRef.current.clientWidth || 600,
      height: containerRef.current.clientHeight || 400,
      timeScale: { borderColor: colors.border, timeVisible: true, rightOffset: 15 },
      rightPriceScale: { borderColor: colors.border, autoScale: true },
    });

    seriesRef.current = chart.addCandlestickSeries({
      upColor: colors.up,
      downColor: colors.down,
      borderVisible: false,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: '#10B981',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // overlay
    });
    
    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    resizeObserver.observe(containerRef.current);

    chart.subscribeClick((param) => {
        if (!drawModeRef.current || !param.point || !seriesRef.current) return;
        const price = seriesRef.current.coordinateToPrice(param.point.y);
        if (price !== null) {
            const line = seriesRef.current.createPriceLine({
                price: price,
                color: 'rgba(124, 58, 237, 0.7)', // Premium semi-transparent violet
                lineWidth: 1,
                lineStyle: 2, // Dashed style for premium and less intrusive look
                axisLabelVisible: true,
                title: `LEVEL ${userLevelsRef.current.length + 1}`,
            });
            userLevelsRef.current.push({ price, line });
            const newLevels = userLevelsRef.current.map(l => l.price);
            setUserLevels(newLevels);
            onLevelsChangeRef.current?.(newLevels);
            
            // Add level to ReactFlow canvas via state store
            useChartSyncStore.getState().addLevelFromChart(price);
            
            setDrawMode(false);
        }
    });

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    
    if (!data || data.length === 0) {
        seriesRef.current.setData([]);
        if (volumeSeriesRef.current) volumeSeriesRef.current.setData([]);
        seriesRef.current.setMarkers([]);
        return;
    }

    const seenTimes = new Set<number>();
    const formatted = data
      .map(c => ({
        time: Math.floor(new Date(c.time).getTime() / 1000) as any,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
      }))
      .filter(item => {
        if (!item.time || isNaN(item.time) || seenTimes.has(item.time)) return false;
        seenTimes.add(item.time);
        return true;
      })
      .sort((a, b) => a.time - b.time);

    if (formatted.length === 0) return;

    // Dynamic price formatting precision based on first candle's price
    const firstPrice = formatted[0].close;
    let precision = 2;
    let minMove = 0.01;
    if (firstPrice < 0.0001) {
      precision = 8;
      minMove = 0.00000001;
    } else if (firstPrice < 0.01) {
      precision = 6;
      minMove = 0.000001;
    } else if (firstPrice < 0.1) {
      precision = 5;
      minMove = 0.00001;
    } else if (firstPrice < 1.0) {
      precision = 4;
      minMove = 0.0001;
    } else if (firstPrice < 10.0) {
      precision = 3;
      minMove = 0.001;
    }
    
    seriesRef.current.applyOptions({
      priceFormat: {
        type: 'price',
        precision: precision,
        minMove: minMove,
      }
    });

    seriesRef.current.setData(formatted);

    if (volumeSeriesRef.current) {
        const volumeData = data
            .map(c => {
                const time = Math.floor(new Date(c.time).getTime() / 1000);
                const v = parseFloat(c.volume);
                const cl = parseFloat(c.close);
                const op = parseFloat(c.open);
                return {
                    time: time as any,
                    value: v,
                    color: cl >= op ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                };
            })
            .filter(item => seenTimes.has(item.time))
            .sort((a, b) => a.time - b.time);
        
        volumeSeriesRef.current.setData(volumeData);
    }

    if (signals?.length) {
      seriesRef.current.setMarkers(
        signals
          .map(s => ({
            time: Math.floor(new Date(s.created_at).getTime() / 1000) as any,
            position: (s.type === 'LONG' ? 'belowBar' : 'aboveBar') as any,
            color: s.type === 'LONG' ? '#10B981' : '#EF4444',
            shape: (s.type === 'LONG' ? 'arrowUp' : 'arrowDown') as any,
            text: s.text || '',
          }))
          .filter(m => seenTimes.has(m.time))
          .sort((a, b) => a.time - b.time)
      );
    }

    priceLinesRef.current.forEach(pl => seriesRef.current?.removePriceLine(pl));
    priceLinesRef.current = [];

    if (smc?.ob?.length) {
      smc.ob.slice(-2).forEach((ob: any) => {
        const line = seriesRef.current?.createPriceLine({
          price: (ob.top + ob.bottom) / 2,
          color: ob.type === 'BULLISH' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'OB',
        });
        if (line) priceLinesRef.current.push(line);
      });
    }
  }, [data, signals, smc]);

  const clearLevels = () => {
    userLevelsRef.current.forEach(l => seriesRef.current?.removePriceLine(l.line));
    userLevelsRef.current = [];
    setUserLevels([]);
    onLevelsChange?.([]);
  };

  const volumeProfile = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    const binsCount = 30;
    const high = Math.max(...data.map(c => parseFloat(c.high)));
    const low = Math.min(...data.map(c => parseFloat(c.low)));
    const range = high - low;
    if (range === 0) return [];
    const binSize = range / binsCount;

    const profile = Array(binsCount).fill(0).map((_, i) => ({
        price: low + (i * binSize),
        volume: 0
    }));

    data.forEach(c => {
        const binIndex = Math.min(binsCount - 1, Math.floor((parseFloat(c.close) - low) / binSize));
        if (binIndex >= 0) profile[binIndex].volume += parseFloat(c.volume);
    });

    const maxVol = Math.max(...profile.map(p => p.volume));
    return profile.map(p => ({ ...p, width: (p.volume / maxVol) * 100 }));
  }, [data]);

  useEffect(() => {
    if (!seriesRef.current) return;

    // Remove obsolete price lines
    Object.keys(activeLevelsRef.current).forEach((nodeId) => {
      if (!activeLevels[nodeId]) {
        try {
          seriesRef.current?.removePriceLine(activeLevelsRef.current[nodeId]);
        } catch (e) {}
        delete activeLevelsRef.current[nodeId];
      }
    });

    // Draw / update active price lines
    Object.entries(activeLevels).forEach(([nodeId, lvl]) => {
      if (activeLevelsRef.current[nodeId]) {
        try {
          seriesRef.current?.removePriceLine(activeLevelsRef.current[nodeId]);
        } catch (e) {}
      }

      const line = seriesRef.current?.createPriceLine({
        price: lvl.price,
        color: lvl.color || '#6366f1',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: lvl.label,
      });
      if (line) {
        activeLevelsRef.current[nodeId] = line;
      }
    });
  }, [activeLevels]);


  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect) return;
      const yCoordinate = e.clientY - rect.top;
      if (!seriesRef.current) return;
      const price = seriesRef.current.coordinateToPrice(yCoordinate);
      if (price === null) return;

      let closestNodeId: string | null = null;
      let minDelta = Infinity;

      Object.entries(activeLevels).forEach(([nodeId, lvl]) => {
        const delta = Math.abs(lvl.price - price);
        if (delta < minDelta && delta / lvl.price < 0.015) {
          minDelta = delta;
          closestNodeId = nodeId;
        }
      });

      if (closestNodeId) {
        const targetNodeId = closestNodeId;
        const handleMouseMove = (moveEvent: MouseEvent) => {
          const moveRect = container.getBoundingClientRect();
          if (!moveRect) return;
          const newY = moveEvent.clientY - moveRect.top;
          if (!seriesRef.current) return;
          const newPrice = seriesRef.current.coordinateToPrice(newY);
          if (newPrice !== null) {
            const roundedPrice = newPrice > 1 ? Math.round(newPrice * 100) / 100 : Number(newPrice.toFixed(6));
            updateLevelPrice(targetNodeId, roundedPrice);
          }
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          
          const finalRect = container.getBoundingClientRect();
          if (!finalRect) return;
          const finalY = upEvent.clientY - finalRect.top;
          if (!seriesRef.current) return;
          const finalPrice = seriesRef.current.coordinateToPrice(finalY);
          if (finalPrice !== null) {
            const roundedPrice = finalPrice > 1 ? Math.round(finalPrice * 100) / 100 : Number(finalPrice.toFixed(6));
            onLevelDragEnd(targetNodeId, roundedPrice);
          }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
    };
  }, [activeLevels, updateLevelPrice, onLevelDragEnd]);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !data || data.length === 0) return;

    // Remove any previous dynamic indicator series
    indicatorSeriesRef.current.forEach(s => {
      try {
        chartRef.current?.removeSeries(s);
      } catch (e) {}
    });
    indicatorSeriesRef.current = [];

    const formatted = data
      .map(c => ({
        time: Math.floor(new Date(c.time).getTime() / 1000) as any,
        close: parseFloat(c.close),
      }))
      .sort((a, b) => a.time - b.time);

    if (formatted.length === 0 || !nodes) return;

    // Filter indicator nodes
    const indicatorNodes = nodes.filter(n => n.type === 'indicator');

    indicatorNodes.forEach((node, index) => {
      const name = node.data?.name || '';
      const params = node.data?.params || {};
      
      if (name.toUpperCase() === 'EMA') {
        const period = parseInt(params.period) || 20;
        const color = node.data?.color || (index % 2 === 0 ? '#ec4899' : '#3b82f6'); // Pink or blue
        
        const emaData = calculateEMA(formatted, period);
        if (emaData.length > 0) {
          const emaSeries = chartRef.current?.addLineSeries({
            color: color,
            lineWidth: 2,
            title: `EMA (${period})`
          });
          if (emaSeries) {
            emaSeries.setData(emaData);
            indicatorSeriesRef.current.push(emaSeries);
          }
        }
      } else if (name.toUpperCase() === 'SMA') {
        const period = parseInt(params.period) || 20;
        const color = node.data?.color || '#eab308'; // Yellow
        
        const smaData = calculateSMA(formatted, period);
        if (smaData.length > 0) {
          const smaSeries = chartRef.current?.addLineSeries({
            color: color,
            lineWidth: 2,
            title: `SMA (${period})`
          });
          if (smaSeries) {
            smaSeries.setData(smaData);
            indicatorSeriesRef.current.push(smaSeries);
          }
        }
      }
    });
  }, [data, nodes]);

  // ── Open Trade TP/SL/Trailing lines ──────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return;

    // Remove previous trade lines
    tradeLinesRef.current.forEach(l => { try { seriesRef.current?.removePriceLine(l); } catch {} });
    tradeLinesRef.current = [];

    if (!openTrade || !data || data.length === 0) return;

    const { entryPrice, type, stopPrice, sl, tp, partialTPs, useTrailing, trailingDistance } = openTrade;
    const parsePct = (v?: string) => v ? parseFloat(String(v).replace('%', '')) / 100 : null;

    const addLine = (price: number, color: string, title: string, style = 2) => {
      if (!seriesRef.current || price <= 0) return;
      try {
        const line = seriesRef.current.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
        tradeLinesRef.current.push(line);
      } catch {}
    };

    // Entry line (solid white)
    addLine(entryPrice, 'rgba(255,255,255,0.6)', 'Entry', 0);

    // TP lines
    if (partialTPs && partialTPs.length > 0) {
      partialTPs.forEach((lvl, i) => {
        const pct = parsePct(lvl.target);
        if (pct === null) return;
        const tpPrice = type === 'LONG' ? entryPrice * (1 + pct) : entryPrice * (1 - pct);
        addLine(tpPrice, `rgba(16,185,129,${0.5 + i * 0.15})`, `TP${i + 1}`);
      });
    } else if (tp) {
      const tpPct = parsePct(tp);
      if (tpPct !== null) {
        const tpPrice = type === 'LONG' ? entryPrice * (1 + tpPct) : entryPrice * (1 - tpPct);
        addLine(tpPrice, 'rgba(16,185,129,0.85)', 'TP');
      }
    }

    // SL line
    if (stopPrice && stopPrice > 0) {
      addLine(stopPrice, 'rgba(239,68,68,0.85)', useTrailing ? 'Trail SL' : 'SL');
    } else if (sl) {
      const slPct = parsePct(sl);
      if (slPct !== null) {
        const slPrice = type === 'LONG' ? entryPrice * (1 - slPct) : entryPrice * (1 + slPct);
        addLine(slPrice, 'rgba(239,68,68,0.7)', 'SL');
      }
    }
  }, [openTrade, data]);


  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'transparent' }}>
        {/* Volume Profile Overlay */}
        <div style={{ 
            position: 'absolute', right: '50px', top: '5%', bottom: '5%', width: '80px', 
            zIndex: 2, pointerEvents: 'none', display: 'flex', flexDirection: 'column-reverse', 
            opacity: 0.06 // Even softer opacity to avoid overlapping visual noise
        }}>
            {volumeProfile.map((p, i) => (
                <div key={i} style={{ 
                    flex: 1, alignSelf: 'flex-end', width: `${p.width}%`, 
                    background: 'var(--accent-color)', marginBottom: '1px' 
                }} />
            ))}
        </div>

        <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, display: 'flex', gap: '8px' }}>
            <button 
                onClick={() => setDrawMode(!drawMode)}
                style={{ 
                    padding: '8px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 800,
                    background: drawMode ? 'var(--accent-color)' : 'rgba(0,0,0,0.3)', 
                    color: '#fff', cursor: 'pointer', backdropFilter: 'blur(10px)',
                    border: '1px solid var(--border-color)', transition: 'var(--transition)'
                }}
            >
                {drawMode ? 'ВЫБЕРИТЕ ЦЕНУ' : '+ ЛИНИЯ УРОВНЯ'}
            </button>
            {userLevels.length > 0 && (
                <button 
                    onClick={clearLevels}
                    style={{ 
                        padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)', 
                        fontSize: '11px', fontWeight: 800, background: 'rgba(239, 68, 68, 0.1)', 
                        color: 'var(--danger)', cursor: 'pointer', backdropFilter: 'blur(10px)'
                    }}
                >
                    ОЧИСТИТЬ ({userLevels.length})
                </button>
            )}
        </div>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
            {(!data || data.length === 0) && (
                <div style={{ 
                    position: 'absolute', inset: 0, zIndex: 5, 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(12, 13, 16, 0.8)', backdropFilter: 'blur(4px)'
                }}>
                    <AlertTriangle size={32} color="var(--warning)" style={{ marginBottom: '16px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>НЕТ ДАННЫХ ДЛЯ ЭТОЙ ПАРЫ</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        Загрузка истории с Binance может занять несколько секунд...
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default MarketChart;
