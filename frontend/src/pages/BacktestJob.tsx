import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { strategiesApi } from '../api/strategies';
import { useLanguageStore } from '../stores/useLanguageStore';
import { io } from 'socket.io-client';

const BacktestJob = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const [status, setStatus] = useState<string>('queued');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(language === 'ru' ? '📋 Инициализация...' : '📋 Initializing...');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const socketUrl = API_URL.replace('/api', '') + '/signals';
    const socket = io(socketUrl, { transports: ['websocket'] });

    socket.on('BACKTEST_PROGRESS', (data: { strategyId: number; progress: number; stage: string }) => {
      setProgress(data.progress);
      setStage(data.stage);
    });

    const poll = setInterval(async () => {
      try {
        const res = await strategiesApi.backtestJobStatus(jobId);
        const d = res.data;
        setStatus(d.status);

        if (d.status === 'active' && typeof d.progress === 'number' && d.progress > progress) {
          setProgress(d.progress);
        }

        if (d.status === 'completed' && d.result) {
          setProgress(100);
          setStage(language === 'ru' ? '✅ Завершено!' : '✅ Complete!');
          setResult(d.result);
          clearInterval(poll);
        }

        if (d.status === 'failed') {
          setError(d.error || 'Backtest failed');
          clearInterval(poll);
        }
      } catch {}
    }, 2000);

    return () => {
      clearInterval(poll);
      socket.disconnect();
    };
  }, [jobId]);

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-xl)',
    padding: '32px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
  };

  const metricStyle: React.CSSProperties = {
    background: 'var(--bg-accent)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    textAlign: 'center',
  };

  if (error) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={cardStyle}>
          <h2 style={{ color: 'var(--danger)', fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
            {language === 'ru' ? 'Ошибка бэктеста' : 'Backtest Error'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>{error}</p>
          <button
            onClick={() => navigate('/backtest')}
            style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', background: 'var(--accent-color)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            {language === 'ru' ? 'Назад к бэктесту' : 'Back to Backtest'}
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    const r = result;
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: '32px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {r.strategyName || 'Backtest'}
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {r.pair} • {r.timeframe} • {r.totalTrades} {language === 'ru' ? 'сделок' : 'trades'}
              </span>
            </div>
            <button
              onClick={() => navigate('/backtest')}
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              {language === 'ru' ? '← Назад' : '← Back'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={metricStyle}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: r.totalReturn >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {r.totalReturn > 0 ? '+' : ''}{r.totalReturn}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {language === 'ru' ? 'Доходность' : 'Total Return'}
              </div>
            </div>
            <div style={metricStyle}>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{r.winRate}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Win Rate</div>
            </div>
            <div style={metricStyle}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--danger)' }}>{r.maxDrawdown}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Max DD</div>
            </div>
            <div style={metricStyle}>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{r.profitFactor ?? '∞'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Profit Factor</div>
            </div>
            <div style={metricStyle}>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{r.sharpeRatio}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Sharpe</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <div style={metricStyle}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                ${r.initialBalance?.toLocaleString()} → ${r.finalBalance?.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {language === 'ru' ? 'Баланс' : 'Balance'}
              </div>
            </div>
            <div style={metricStyle}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {r.totalTrades} ({r.longStats?.total || 0}L / {r.shortStats?.total || 0}S)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {language === 'ru' ? 'Сделки' : 'Trades'}
              </div>
            </div>
          </div>

          {r.recommendations && r.recommendations.length > 0 && (
            <div style={{ ...cardStyle, maxWidth: '100%', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
                {language === 'ru' ? 'Рекомендации' : 'Recommendations'}
              </h3>
              {r.recommendations.map((rec: any, i: number) => (
                <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {rec.type === 'success' ? '✅' : rec.type === 'warning' ? '⚠️' : 'ℹ️'} {rec.text}
                </div>
              ))}
            </div>
          )}

          {r.trades && r.trades.length > 0 && (
            <div style={{ ...cardStyle, maxWidth: '100%' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
                {language === 'ru' ? 'Сделки' : 'Trades'} ({r.trades.length})
              </h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {r.trades.map((trade: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: '12px',
                  }}>
                    <span style={{ color: trade.type === 'LONG' ? 'var(--success)' : 'var(--danger)', fontWeight: 700, width: '50px' }}>
                      {trade.type}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {trade.entryPrice?.toFixed(2)} → {trade.exitPrice?.toFixed(2)}
                    </span>
                    <span style={{ color: trade.pnl >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnlPercent?.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading / progress state
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              width: '56px', height: '56px', margin: '0 auto',
              border: '3px solid transparent', borderTopColor: 'var(--accent-color)', borderBottomColor: 'var(--success)',
              borderRadius: '50%', animation: 'spin 1.5s linear infinite',
            }}>
              <div style={{
                position: 'relative', top: '8px', left: '8px', width: '32px', height: '32px',
                border: '3px solid transparent', borderLeftColor: 'var(--warning)', borderRightColor: 'var(--accent-color)',
                borderRadius: '50%', animation: 'spin 1s linear infinite reverse',
              }} />
            </div>
          </div>

          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {language === 'ru' ? 'Бэктест выполняется...' : 'Backtest Running...'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Job #{jobId} • {status}
          </div>

          <div style={{
            background: 'var(--bg-accent)', border: '1px solid var(--border-color)',
            height: '12px', borderRadius: '6px', overflow: 'hidden', margin: '16px 0',
          }}>
            <div style={{
              background: 'linear-gradient(90deg, #a855f7, #6366f1, #10b981)',
              height: '100%', width: `${progress}%`,
              transition: 'width 0.3s ease-out',
              boxShadow: '0 0 10px rgba(99, 102, 241, 0.6)',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{stage}</span>
            <span style={{ color: 'var(--accent-color)', fontWeight: 700, fontFamily: 'monospace' }}>{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BacktestJob;
