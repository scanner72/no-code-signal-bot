import React, { useEffect, useState } from 'react';
import { sentimentApi } from '../api/sentiment';
import { Newspaper, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SentimentWidget = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await sentimentApi.get();
                setData(res.data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
        const interval = setInterval(fetch, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !data) return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>Анализ новостей...</div>;

    const getIcon = () => {
        if (data.label === 'BULLISH') return <TrendingUp size={14} color="var(--success)" />;
        if (data.label === 'BEARISH') return <TrendingDown size={14} color="var(--danger)" />;
        return <Minus size={14} color="var(--text-muted)" />;
    };

    const getLabelColor = () => {
        if (data.label === 'BULLISH') return 'var(--success)';
        if (data.label === 'BEARISH') return 'var(--danger)';
        return 'var(--text-secondary)';
    };

    return (
        <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em' }}>Market Sentiment</div>
                <div style={{ 
                    padding: '4px 10px', borderRadius: '20px', background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', 
                    gap: '6px', fontSize: '10px', fontWeight: 800, color: getLabelColor() 
                }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: getLabelColor(), boxShadow: `0 0 8px ${getLabelColor()}` }} />
                    {data.label}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)' }}>
                    {data.score > 0 ? '+' : ''}{data.score.toFixed(2)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>score (-1..1)</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
                {data.topNews?.slice(0, 2).map((news: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                        <Newspaper size={12} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--accent-color)' }} />
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {news.title}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SentimentWidget;
