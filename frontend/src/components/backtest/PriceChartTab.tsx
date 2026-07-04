import React from 'react';
import MarketChart from '../MarketChart';

interface PriceChartTabProps {
  result: any;
  selectedTradeIndex: number | null;
  setSelectedTradeIndex: (index: number | null) => void;
  language: string;
  t: any;
}

const PriceChartTab: React.FC<PriceChartTabProps> = ({
  result,
  selectedTradeIndex,
  setSelectedTradeIndex,
  language,
  t,
}) => {
  const selectedTrade = selectedTradeIndex !== null && result?.trades ? result.trades[selectedTradeIndex] : null;
  const openTradeProp = selectedTrade ? {
    entryPrice: selectedTrade.entryPrice,
    type: selectedTrade.type,
    stopPrice: selectedTrade.exitReason?.includes('SL') || selectedTrade.exitReason?.includes('Trail') || selectedTrade.pnlPercent < 0 ? selectedTrade.exitPrice : undefined,
    tp: selectedTrade.pnlPercent > 0 ? `${Math.abs(selectedTrade.pnlPercent)}%` : undefined,
    sl: selectedTrade.pnlPercent < 0 ? `${Math.abs(selectedTrade.pnlPercent)}%` : undefined,
  } : null;

  return (
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
  );
};

export default PriceChartTab;
