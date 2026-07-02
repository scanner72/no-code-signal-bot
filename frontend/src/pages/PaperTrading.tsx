import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Play, Square, TrendingUp, TrendingDown, DollarSign, Percent, Calendar, ShieldAlert } from 'lucide-react';
import { toast, useNotificationStore } from '../stores/notificationStore';
import PaperCompareSection from '../components/PaperCompareSection';

const API = (import.meta as any).env?.VITE_API_URL || '/api';

const PaperTrading = () => {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/paper-trading/history`);
      setTrades(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCloseManual = async (id: number) => {
    if (!confirm('Вы уверены, что хотите принудительно закрыть эту сделку по текущей рыночной цене?')) return;
    try {
      await axios.post(`${API}/paper-trading/close/${id}`);
      fetchHistory();
      toast.success('Сделка успешно закрыта!');
      useNotificationStore.getState().addNotification('Paper Trading', `Сделка #${id} успешно закрыта принудительно по рыночной цене.`, 'success');
    } catch {
      toast.error('Не удалось закрыть сделку.');
    }
  };

  const openTrades = trades.filter(t => t.status === 'OPEN');
  const closedTrades = trades.filter(t => t.status === 'CLOSED');

  // Stats calculation
  const totalProfitPercent = closedTrades.reduce((acc, t) => acc + Number(t.pnl_percent), 0);
  const winrate = closedTrades.length > 0 
    ? (closedTrades.filter(t => Number(t.pnl_percent) > 0).length / closedTrades.length) * 100 
    : 0;

  const fmt = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      }}>
        <span>{icon}</span>
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      
      {/* Summary Header */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '16px 24px', display: 'flex', gap: '24px' }}>
        <div style={statCardStyle}>
          <DollarSign size={20} color="var(--accent-color)" />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>ОТКРЫТЫЕ СДЕЛКИ</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{openTrades.length}</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <Percent size={20} color={totalProfitPercent >= 0 ? 'var(--success)' : 'var(--danger)'} />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>ОБЩАЯ ДОХОДНОСТЬ</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: totalProfitPercent >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {totalProfitPercent >= 0 ? '+' : ''}{totalProfitPercent.toFixed(2)}%
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <TrendingUp size={20} color="var(--success)" />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>WIN RATE (ДЕМО)</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{winrate.toFixed(0)}%</div>
          </div>
        </div>
      </div>

      <PaperCompareSection />

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        
        {/* Active Open Trades */}
        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block', boxShadow: '0 0 10px var(--success)' }} />
            Активные виртуальные позиции ({openTrades.length})
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Загрузка...</div>
            ) : openTrades.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '32px', opacity: 0.1, marginBottom: '12px' }}>⚡</div>
                Нет открытых сделок. Запустите стратегию для торговли!
              </div>
            ) : (
              openTrades.map(trade => {
                const isProfit = Number(trade.pnl_percent) >= 0;
                return (
                  <div key={trade.id} style={tradeCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={typeBadgeStyle(trade.type)}>{trade.type}</span>
                        <span style={{ marginLeft: '12px', fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{trade.pair}</span>
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>{trade.strategy?.name}</span>
                      </div>
                      
                      <button 
                        onClick={() => handleCloseManual(trade.id)}
                        style={closeBtnStyle}
                        title="Принудительно закрыть"
                      >
                        <Square size={12} fill="currentColor" /> Закрыть
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>ВХОД</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>${fmt(trade.entry_price)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>ТЕКУЩИЙ P&L</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: isProfit ? 'var(--success)' : 'var(--danger)' }}>
                          {isProfit ? '+' : ''}{Number(trade.pnl_percent).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>ПИКОВАЯ ЦЕНА</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>${fmt(trade.highest_price || trade.entry_price)}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Closed Trades History */}
        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>
            История закрытых сделок ({closedTrades.length})
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Загрузка...</div>
            ) : closedTrades.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '32px', opacity: 0.1, marginBottom: '12px' }}>📖</div>
                История пуста. Дождитесь закрытия первой сделки!
              </div>
            ) : (
              closedTrades.map(trade => {
                const isProfit = Number(trade.pnl_percent) >= 0;
                return (
                  <div key={trade.id} style={{ ...tradeCardStyle, opacity: 0.85 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={typeBadgeStyle(trade.type)}>{trade.type}</span>
                        <span style={{ marginLeft: '12px', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{trade.pair}</span>
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>{trade.strategy?.name}</span>
                      </div>
                      
                      {renderExitReasonBadge(trade.exit_reason, Number(trade.pnl_percent))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '12px' }}>
                      <div>
                        <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>ВХОД / ВЫХОД</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                          ${fmt(trade.entry_price)} / ${fmt(trade.exit_price)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>РЕЗУЛЬТАТ P&L</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: isProfit ? 'var(--success)' : 'var(--danger)' }}>
                          {isProfit ? '+' : ''}{Number(trade.pnl_percent).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>ДАТА ЗАКРЫТИЯ</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {new Date(trade.closed_at).toLocaleDateString()} {new Date(trade.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

const statCardStyle = {
  background: 'var(--bg-accent)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  padding: '12px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minWidth: '220px'
};

const tradeCardStyle = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  padding: '16px',
  transition: 'var(--transition)'
};

const typeBadgeStyle = (type: string) => ({
  fontSize: '10px',
  padding: '3px 8px',
  borderRadius: '6px',
  fontWeight: 800,
  background: type === 'LONG' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
  color: type === 'LONG' ? 'var(--success)' : 'var(--danger)'
});

const closeBtnStyle = {
  background: 'rgba(239, 68, 68, 0.1)',
  color: 'var(--danger)',
  border: 'none',
  padding: '6px 12px',
  borderRadius: '8px',
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'all 0.2s ease'
};

export default PaperTrading;
