import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, SeriesMarker } from 'lightweight-charts';

interface BacktestChartProps {
  candles: any[];
  trades: any[];
}

export const BacktestChart: React.FC<BacktestChartProps> = ({ candles, trades }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !candles || candles.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    // Parse and set candle data
    const cData = candles.map(c => ({
      time: new Date(c.time).getTime() / 1000 as any, // Unix timestamp in seconds
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
    })).sort((a, b) => a.time - b.time);

    candlestickSeries.setData(cData);

    if (cData.length > 0) {
      const firstPrice = cData[0].close;
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
      candlestickSeries.applyOptions({
        priceFormat: {
          type: 'price',
          precision: precision,
          minMove: minMove,
        }
      });
    }

    // Create markers for trades
    const markers: SeriesMarker<any>[] = [];
    trades.forEach(t => {
      const entryTime = new Date(t.entryTime).getTime() / 1000;
      const exitTime = new Date(t.exitTime).getTime() / 1000;
      
      // Find exact or closest timestamp in cData to avoid out of bounds markers
      const eTime = cData.find(c => c.time >= entryTime)?.time || entryTime;
      const xTime = cData.find(c => c.time >= exitTime)?.time || exitTime;

      if (t.type === 'LONG') {
        markers.push({ time: eTime as any, position: 'belowBar', color: '#10B981', shape: 'arrowUp', text: 'L' });
      } else {
        markers.push({ time: eTime as any, position: 'aboveBar', color: '#EF4444', shape: 'arrowDown', text: 'S' });
      }
      
      // Exit marker
      const pnlColor = t.pnl >= 0 ? '#10B981' : '#EF4444';
      markers.push({ time: xTime as any, position: 'inBar', color: pnlColor, shape: 'circle', text: t.pnl >= 0 ? 'TP' : 'SL' });
    });

    // Sort markers by time (required by lightweight-charts)
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    candlestickSeries.setMarkers(markers);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, trades]);

  return (
    <div style={{ width: '100%', height: '300px', marginBottom: '24px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
