import React, { useState, useEffect } from 'react';
import { X, Maximize2, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import MarketChart from './MarketChart';

interface NodePreviewChartProps {
    node: any;
    onClose: () => void;
    defaultPair?: string;
    defaultTimeframe?: string;
    onLevelsChange?: (levels: number[]) => void;
}

const NodePreviewChart: React.FC<NodePreviewChartProps> = ({ node, onClose, defaultPair, defaultTimeframe, onLevelsChange }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const apiBase = import.meta.env.VITE_API_URL || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000/api`;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch candles first
                const pair = node.data?.pair || defaultPair || 'BTCUSDT';
                const timeframe = node.data?.timeframe || defaultTimeframe || '1h';
                
                // Get candles and indicator data
                // For now, we use a generic endpoint that we will create in the backend
                const response = await axios.get(`${apiBase}/indicators/preview`, {
                    params: {
                        pair,
                        timeframe,
                        type: node.type,
                        name: node.data?.name || node.type,
                        params: JSON.stringify(node.data?.params || {})
                    }
                });
                
                setData(response.data);
            } catch (e: any) {
                console.error('Failed to fetch preview data', e);
                setError(e.response?.data?.message || 'Failed to load preview');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [node, apiBase]);

    return (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                {/* Header */}
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'var(--bg-accent)', borderRadius: '8px' }}>
                            <Maximize2 size={18} color="var(--accent-color)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 800 }}>{node.data?.name || node.type} Preview</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Live visualization for {node.data?.pair || 'BTCUSDT'} • {node.data?.timeframe || '1h'}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={closeBtnStyle}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={bodyStyle}>
                    {loading ? (
                        <div style={statusContainerStyle}>
                            <Loader2 size={32} className="animate-spin" color="var(--accent-color)" />
                            <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: 600 }}>Calculating indicator data...</div>
                        </div>
                    ) : error ? (
                        <div style={statusContainerStyle}>
                            <AlertCircle size={32} color="var(--danger)" />
                            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--danger)', fontWeight: 600 }}>{error}</div>
                        </div>
                    ) : (
                        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                            <MarketChart 
                                data={data.candles} 
                                signals={data.signals || []}
                                onLevelsChange={onLevelsChange}
                                smc={data.indicators}
                            />

                            
                            {/* Stats overlay */}
                            <div style={statsOverlayStyle}>
                                <div style={statItemStyle}>
                                    <div style={statLabelStyle}>Current Value</div>
                                    <div style={statValueStyle}>{data.currentValue?.toFixed(4) || 'N/A'}</div>
                                </div>
                                <div style={statItemStyle}>
                                    <div style={statLabelStyle}>Status</div>
                                    <div style={{ ...statValueStyle, color: data.status === 'Bullish' ? 'var(--success)' : (data.status === 'Bearish' ? 'var(--danger)' : 'var(--text-primary)') }}>
                                        {data.status || 'Neutral'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Controls */}
                <div style={footerStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        * Визуализация основана на последних 200 свечах выбранного таймфрейма.
                    </div>
                    <button onClick={onClose} style={actionBtnStyle}>CLOSE PREVIEW</button>
                </div>
            </div>
        </div>
    );
};

const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '40px'
};

const modalContentStyle: React.CSSProperties = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '24px',
    width: '100%', maxWidth: '900px',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
};

const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--bg-secondary)'
};

const bodyStyle: React.CSSProperties = {
    height: '450px',
    position: 'relative',
    background: '#000'
};

const footerStyle: React.CSSProperties = {
    padding: '16px 24px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--bg-secondary)'
};

const closeBtnStyle: React.CSSProperties = {
    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
    cursor: 'pointer', padding: '8px', borderRadius: '50%',
    transition: 'all 0.2s'
};

const actionBtnStyle: React.CSSProperties = {
    padding: '10px 24px',
    background: 'var(--accent-color)',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '12px', fontWeight: 800, cursor: 'pointer'
};

const statusContainerStyle: React.CSSProperties = {
    height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center'
};

const statsOverlayStyle: React.CSSProperties = {
    position: 'absolute', top: '20px', left: '20px',
    display: 'flex', gap: '12px', zIndex: 10
};

const statItemStyle: React.CSSProperties = {
    padding: '10px 16px',
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(4px)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
};

const statLabelStyle: React.CSSProperties = {
    fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase',
    fontWeight: 700, marginBottom: '2px'
};

const statValueStyle: React.CSSProperties = {
    fontSize: '14px', fontWeight: 800, color: '#fff'
};

export default NodePreviewChart;
