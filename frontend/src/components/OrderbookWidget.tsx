import React, { useEffect, useState } from 'react';
import { orderbookApi } from '../api/orderbook';

interface OrderbookWidgetProps {
  pair: string;
}

const OrderbookWidget: React.FC<OrderbookWidgetProps> = ({ pair }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await orderbookApi.getDepth(pair);
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, [pair]);

  if (loading) return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>Загрузка стакана...</div>;

  const maxAmount = Math.max(
    ...(data?.bids.map((b: any) => b.amount) || []),
    ...(data?.asks.map((a: any) => a.amount) || [])
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', overflow: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Order Book</span>
          <span style={{ fontSize: '10px', color: 'var(--accent-color)', fontWeight: 700 }}>{pair}</span>
      </div>
      
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden', padding: '12px' }}>
          {/* Asks (Sell) */}
          <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '1px', borderRight: '1px solid var(--border-color)', paddingRight: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                  <span>PRICE</span>
                  <span>SIZE</span>
              </div>
              {data?.asks.slice(0, 15).reverse().map((a: any, i: number) => (
                  <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '2px 4px', height: '18px', alignItems: 'center' }}>
                      <div style={{ 
                        position: 'absolute', right: 0, top: '1px', bottom: '1px', 
                        background: 'rgba(239, 68, 68, 0.15)', width: `${(a.amount / maxAmount) * 100}%`, 
                        transition: 'width 0.3s', borderRadius: '2px 0 0 2px'
                      }}></div>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, zIndex: 1 }}>{a.price.toLocaleString()}</span>
                      <span style={{ color: 'var(--text-primary)', zIndex: 1, fontSize: '10px' }}>{a.amount.toFixed(2)}</span>
                  </div>
              ))}
          </div>

          {/* Bids (Buy) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', paddingLeft: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                  <span>PRICE</span>
                  <span>SIZE</span>
              </div>
              {data?.bids.slice(0, 15).map((b: any, i: number) => (
                  <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '2px 4px', height: '18px', alignItems: 'center' }}>
                      <div style={{ 
                        position: 'absolute', left: 0, top: '1px', bottom: '1px', 
                        background: 'rgba(16, 185, 129, 0.15)', width: `${(b.amount / maxAmount) * 100}%`, 
                        transition: 'width 0.3s', borderRadius: '0 2px 2px 0'
                      }}></div>
                      <span style={{ color: 'var(--success)', fontWeight: 700, zIndex: 1 }}>{b.price.toLocaleString()}</span>
                      <span style={{ color: 'var(--text-primary)', zIndex: 1, fontSize: '10px' }}>{b.amount.toFixed(2)}</span>
                  </div>
              ))}
          </div>
      </div>

      {/* Walls Summary */}
      {data?.walls && data.walls.length > 0 && (
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 800, textTransform: 'uppercase' }}>Liquidity Walls</div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                  {data.walls.slice(0, 3).map((w: any, i: number) => (
                      <div key={i} style={{ 
                        padding: '4px 8px', borderRadius: '8px', 
                        background: w.side === 'BUY' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                        fontSize: '10px', border: `1px solid ${w.side === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, 
                        whiteSpace: 'nowrap' 
                      }}>
                          <span style={{ color: w.side === 'BUY' ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>{w.side}</span>
                          <span style={{ color: 'var(--text-primary)', marginLeft: '6px', fontWeight: 600 }}>{w.price.toLocaleString()}</span>
                      </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default OrderbookWidget;
