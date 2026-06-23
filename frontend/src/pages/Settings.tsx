import React, { useState, useEffect } from 'react';
import { settingsApi } from '../api/settings';
import { signalsApi } from '../api/signals';
import { useLanguageStore } from '../stores/useLanguageStore';

const PROMPT_PRESETS = {
  scalping: "You are an ultra-fast high-frequency scalping trading bot. Your goal is to validate short-term trading signals.\nAnalyze the technical data, RSI, order book volume, and LDR news.\nFocus heavily on momentum and short-term volatility.\n\nContext:\nPair: {{pair}}\nPrice: {{price}}\nSignal: {{signal}}\nLDR Summary: {{ldr_summary}}\nLDR Sentiment Score: {{ldr_sentiment_score}}\nLDR Risk Level: {{ldr_risk_level}}\nIndicators (RSI, etc.): {{indicators}}\n\nShould we PASS or BLOCK this signal? Scalpers require strong immediate momentum and low risk.\nReply with JSON: { \"decision\": \"PASS\" or \"BLOCK\", \"confidence\": 0.0-1.0, \"reason\": \"string\" }",

  swing: "You are a professional swing trading desk manager. Your goal is to evaluate intermediate-term trading setups.\nAnalyze the market structure, liquidity sweeps, FVG gaps, and LDR news.\nFocus on the daily/4h market structure and macro sentiment. Ignore minor scalping noise.\n\nContext:\nPair: {{pair}}\nPrice: {{price}}\nSignal: {{signal}}\nLDR Summary: {{ldr_summary}}\nLDR Sentiment Score: {{ldr_sentiment_score}}\nLDR Risk Level: {{ldr_risk_level}}\n\nShould we PASS or BLOCK this signal? Swing traders need clear market structure alignment and strong fundamental support.\nReply with JSON: { \"decision\": \"PASS\" or \"BLOCK\", \"confidence\": 0.0-1.0, \"reason\": \"string\" }",

  hodl: "You are a long-term algorithmic investment fund manager. Evaluate signals based on deep fundamental conviction.\nAnalyze news, regulatory risks, hacks, updates, and key findings. Ignore short-term price charts or indicator flags.\n\nContext:\nPair: {{pair}}\nPrice: {{price}}\nSignal: {{signal}}\nLDR Summary: {{ldr_summary}}\nLDR Sentiment: {{ldr_sentiment}}\nLDR Risk Level: {{ldr_risk_level}}\n\nShould we PASS or BLOCK this signal? Focus strictly on long-term project survival, macro tailwinds, and fundamental safety.\nReply with JSON: { \"decision\": \"PASS\" or \"BLOCK\", \"confidence\": 0.0-1.0, \"reason\": \"string\" }"
};

const Settings = () => {
    const { t, language } = useLanguageStore();
    const [activeSection, setActiveSection] = useState('telegram');
    const [botToken, setBotToken] = useState('');
    const [chatId, setChatId] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [banner, setBanner] = useState<{ type: 'success' | 'fail' | 'sending' | null, title: string, sub: string }>({ type: null, title: '', sub: '' });
    const [deduplication, setDeduplication] = useState(4);
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<string | null>(null);
    const [binanceKey, setBinanceKey] = useState('');
    const [binanceSecret, setBinanceSecret] = useState('');
    const [discordWebhook, setDiscordWebhook] = useState('');
    const [tradingPairs, setTradingPairs] = useState('');
    const [logs, setLogs] = useState<any[]>([]);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);
    const [discordStatus, setDiscordStatus] = useState<string | null>(null);
    const [globalPause, setGlobalPause] = useState(false);
    const [btcThreshold, setBtcThreshold] = useState(-5);
    const [ethThreshold, setEthThreshold] = useState(-7);
    const [dailyLossLimit, setDailyLossLimit] = useState(0);
    const [maxActiveSignals, setMaxActiveSignals] = useState(0);
    const [consecutiveLossLimit, setConsecutiveLossLimit] = useState(0);
    const [cooldownDuration, setCooldownDuration] = useState(0);
    // heym integration
    const [heymUrl, setHeymUrl] = useState('');
    const [heymApiKey, setHeymApiKey] = useState('');
    const [heymWorkflowId, setHeymWorkflowId] = useState('');
    const [heymHasKey, setHeymHasKey] = useState(false);
    const [heymSaveStatus, setHeymSaveStatus] = useState<string | null>(null);
    const [heymTestStatus, setHeymTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
    const [heymTesting, setHeymTesting] = useState(false);
    // Hermes AI Agent
    const [hermesProvider, setHermesProvider] = useState<'hermes' | 'ollama' | 'openai'>('hermes');
    const [hermesUrl, setHermesUrl] = useState('');
    const [hermesModel, setHermesModel] = useState('');
    const [hermesApiKey, setHermesApiKey] = useState('');
    const [hermesHasKey, setHermesHasKey] = useState(false);
    const [hermesSaveStatus, setHermesSaveStatus] = useState<string | null>(null);
    const [hermesTestStatus, setHermesTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
    const [hermesTesting, setHermesTesting] = useState(false);
    // CryptoPanic API
    const [cryptoPanicKey, setCryptoPanicKey] = useState('');
    const [cryptoPanicSaveStatus, setCryptoPanicSaveStatus] = useState<string | null>(null);
    // Hermes Prompts Builder
    const [promptPreset, setPromptPreset] = useState<'scalping' | 'swing' | 'hodl' | 'custom'>('scalping');
    const [promptTemplate, setPromptTemplate] = useState('');
    const [promptSaveStatus, setPromptSaveStatus] = useState<string | null>(null);

    useEffect(() => {
        settingsApi.getAll().then(res => {
            const data = res.data;
            if (data.telegram_bot_token) setBotToken(data.telegram_bot_token);
            if (data.telegram_chat_id) {
                setChatId(data.telegram_chat_id);
                setIsConnected(true);
            }
            if (data.deduplication_interval) setDeduplication(parseInt(data.deduplication_interval));
            if (data.binance_api_key) setBinanceKey(data.binance_api_key);
            if (data.binance_secret) setBinanceSecret(data.binance_secret);
            if (data.discord_webhook_url) setDiscordWebhook(data.discord_webhook_url);
            if (data.trading_pairs) setTradingPairs(data.trading_pairs);
            if (data.global_pause) setGlobalPause(data.global_pause === 'true');
            if (data.btc_drop_threshold) setBtcThreshold(parseFloat(data.btc_drop_threshold));
            if (data.eth_drop_threshold) setEthThreshold(parseFloat(data.eth_drop_threshold));
            if (data.daily_loss_limit) setDailyLossLimit(parseFloat(data.daily_loss_limit));
            if (data.max_active_signals) setMaxActiveSignals(parseInt(data.max_active_signals));
            if (data.consecutive_loss_limit) setConsecutiveLossLimit(parseInt(data.consecutive_loss_limit));
            if (data.cooldown_duration) setCooldownDuration(parseFloat(data.cooldown_duration));
            if (data.cryptopanic_api_key) setCryptoPanicKey(data.cryptopanic_api_key);
            if (data.hermes_prompt_preset_selected) setPromptPreset(data.hermes_prompt_preset_selected as any);
            if (data.hermes_custom_prompt_template) setPromptTemplate(data.hermes_custom_prompt_template);
        }).catch(() => {});

        // Load heym config
        settingsApi.getHeym().then(res => {
            const d = res.data;
            setHeymUrl(d.url || '');
            setHeymApiKey(d.apiKeyMasked || '');
            setHeymHasKey(d.hasApiKey || false);
            setHeymWorkflowId(d.workflowId || '');
        }).catch(() => {});

        // Load Hermes config
        settingsApi.getHermes().then(res => {
            const d = res.data;
            setHermesProvider(d.provider || 'hermes');
            setHermesUrl(d.url || '');
            setHermesModel(d.model || '');
            setHermesApiKey(d.apiKeyMasked || '');
            setHermesHasKey(d.hasApiKey || false);
        }).catch(() => {});

        const fetchLogs = () => {
            signalsApi.getHistory(20).then(res => setLogs(res.data)).catch(() => {});
        };
        fetchLogs();
        const logInt = setInterval(fetchLogs, 10000);
        return () => clearInterval(logInt);
    }, []);

    const verify = async () => {
        if (!chatId) return;
        setIsVerifying(true);
        setBanner({ type: 'sending', title: 'Проверяем...', sub: 'Бот пытается написать в указанный чат' });

        try {
            const res = await settingsApi.verifyTelegram(chatId, botToken);
            if (res.data.success) {
                setBanner({ type: 'success', title: 'Telegram подключён', sub: `Тестовое сообщение доставлено. ID: ${chatId}` });
                setIsConnected(true);
            } else {
                setBanner({ type: 'fail', title: 'Ошибка доставки', sub: res.data.message || 'Проверьте Token и chat_id.' });
                setIsConnected(false);
            }
        } catch (e: any) {
            setBanner({ type: 'fail', title: 'Ошибка API', sub: e.message });
            setIsConnected(false);
        } finally {
            setIsVerifying(false);
        }
    };

    const disconnect = async () => {
        try {
            await settingsApi.disconnectTelegram();
            setIsConnected(false);
            setChatId('');
            setBanner({ type: null, title: '', sub: '' });
        } catch {}
    };

    const sendTest = async () => {
        setIsTesting(true);
        try {
            await settingsApi.testTelegram();
            setTestStatus('✓ Отправлено');
        } catch {
            setTestStatus('✕ Ошибка');
        } finally {
            setIsTesting(false);
            setTimeout(() => setTestStatus(null), 2500);
        }
    };

    const saveHeym = async () => {
        setHeymSaveStatus('Сохранение...');
        try {
            await settingsApi.saveHeym({ url: heymUrl, apiKey: heymApiKey, workflowId: heymWorkflowId });
            setHeymSaveStatus('✓ Сохранено');
            // Refresh masked key display
            settingsApi.getHeym().then(res => {
                setHeymApiKey(res.data.apiKeyMasked || '');
                setHeymHasKey(res.data.hasApiKey || false);
            }).catch(() => {});
        } catch {
            setHeymSaveStatus('✕ Ошибка');
        } finally {
            setTimeout(() => setHeymSaveStatus(null), 3000);
        }
    };

    const testHeym = async () => {
        setHeymTesting(true);
        setHeymTestStatus(null);
        try {
            const res = await settingsApi.testHeym();
            setHeymTestStatus({ ok: res.data.success, msg: res.data.message });
        } catch {
            setHeymTestStatus({ ok: false, msg: 'Ошибка запроса' });
        } finally {
            setHeymTesting(false);
        }
    };

    const handleDedupChange = (val: number) => {
        setDeduplication(val);
        settingsApi.updateDeduplication(val).catch(() => {});
    };

    const saveGeneral = async () => {
        setSaveStatus('Сохранение...');
        try {
            await Promise.all([
                settingsApi.update('binance_api_key', binanceKey),
                settingsApi.update('binance_secret', binanceSecret),
                settingsApi.update('trading_pairs', tradingPairs)
            ]);
            setSaveStatus('✓ Сохранено');
        } catch {
            setSaveStatus('✕ Ошибка');
        } finally {
            setTimeout(() => setSaveStatus(null), 3000);
        }
    };

    const testDiscord = async () => {
        if (!discordWebhook) return;
        setDiscordStatus('Проверка...');
        try {
            const res = await settingsApi.testDiscord(discordWebhook);
            if (res.data.success) setDiscordStatus('✓ Успешно');
            else setDiscordStatus('✕ Ошибка');
        } catch {
            setDiscordStatus('✕ Ошибка API');
        } finally {
            setTimeout(() => setDiscordStatus(null), 3000);
        }
    };

    const saveHermes = async () => {
        setHermesSaveStatus('Сохранение...');
        try {
            await settingsApi.saveHermes({ provider: hermesProvider, url: hermesUrl, model: hermesModel, apiKey: hermesApiKey });
            setHermesSaveStatus('✓ Сохранено');
            settingsApi.getHermes().then(res => {
                setHermesApiKey(res.data.apiKeyMasked || '');
                setHermesHasKey(res.data.hasApiKey || false);
            }).catch(() => {});
        } catch {
            setHermesSaveStatus('✕ Ошибка');
        } finally {
            setTimeout(() => setHermesSaveStatus(null), 3000);
        }
    };

    const testHermes = async () => {
        setHermesTesting(true);
        setHermesTestStatus(null);
        try {
            const res = await settingsApi.testHermes();
            setHermesTestStatus({ ok: res.data.success, msg: res.data.message });
        } catch {
            setHermesTestStatus({ ok: false, msg: 'Ошибка запроса' });
        } finally {
            setHermesTesting(false);
        }
    };

    const savePrompts = async () => {
        setPromptSaveStatus('Сохранение...');
        try {
            await settingsApi.update('hermes_prompt_preset_selected', promptPreset);
            await settingsApi.update('hermes_custom_prompt_template', promptTemplate);
            setPromptSaveStatus('✓ Сохранено');
        } catch {
            setPromptSaveStatus('✕ Ошибка');
        } finally {
            setTimeout(() => setPromptSaveStatus(null), 3000);
        }
    };

    const selectPreset = (preset: 'scalping' | 'swing' | 'hodl' | 'custom') => {
        setPromptPreset(preset);
        if (preset !== 'custom') {
            setPromptTemplate(PROMPT_PRESETS[preset]);
        }
    };

    const saveCryptoPanic = async () => {
        setCryptoPanicSaveStatus('Сохранение...');
        try {
            await settingsApi.update('cryptopanic_api_key', cryptoPanicKey);
            setCryptoPanicSaveStatus('✓ Сохранено');
        } catch {
            setCryptoPanicSaveStatus('✕ Ошибка');
        } finally {
            setTimeout(() => setCryptoPanicSaveStatus(null), 3000);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', flex: 1, minHeight: 0, background: 'var(--bg-primary)' }}>
            
             {/* Sidebar */}
            <div style={{ borderRight: '1px solid var(--border-color)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-secondary)' }}>
                <div onClick={() => setActiveSection('general')} style={{ ...navItemStyle, ...(activeSection === 'general' ? navItemActive : {}) }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8h6M5 5h6M5 11h3"/></svg>
                    {language === 'ru' ? 'Основные' : 'General'}
                </div>
                <div onClick={() => setActiveSection('telegram')} style={{ ...navItemStyle, ...(activeSection === 'telegram' ? navItemActive : {}) }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 5.5C13 9 8 13.5 8 13.5S3 9 3 5.5a5 5 0 0110 0z"/><circle cx="8" cy="5.5" r="1.5"/></svg>
                    Telegram
                </div>
                <div onClick={() => setActiveSection('discord')} style={{ ...navItemStyle, ...(activeSection === 'discord' ? navItemActive : {}) }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V4a2 2 0 012-2h6zM8 8v2M8 5v0"/></svg>
                    Discord
                </div>
                <div onClick={() => setActiveSection('filters')} style={{ ...navItemStyle, ...(activeSection === 'filters' ? navItemActive : {}) }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H2v2l5 5v5l2 2V9l5-5V2z"/></svg>
                    {language === 'ru' ? 'Фильтры' : 'Filters'}
                </div>
                <div onClick={() => setActiveSection('risk')} style={{ ...navItemStyle, ...(activeSection === 'risk' ? navItemActive : {}) }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1v14M1 8h14"/><circle cx="8" cy="8" r="7"/></svg>
                    {language === 'ru' ? 'Риск-менеджмент' : 'Risk Management'}
                </div>
                <div onClick={() => setActiveSection('dedup')} style={{ ...navItemStyle, ...(activeSection === 'dedup' ? navItemActive : {}) }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5"/><path d="M8 5v3l2 2"/></svg>
                    {language === 'ru' ? 'Дедупликация' : 'Deduplication'}
                </div>
                <div onClick={() => setActiveSection('logs')} style={{ ...navItemStyle, ...(activeSection === 'logs' ? navItemActive : {}) }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M4 8h8M6 12h4"/></svg>
                    {language === 'ru' ? 'Логи' : 'Logs'}
                </div>
                <div onClick={() => setActiveSection('integrations')} style={{ ...navItemStyle, ...(activeSection === 'integrations' ? navItemActive : {}) }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="8" r="2.5"/><circle cx="11" cy="5" r="2"/><circle cx="11" cy="11" r="2"/><path d="M7.5 8H9M7.5 6.5L9 5.3M7.5 9.5L9 10.7"/></svg>
                    {language === 'ru' ? 'Интеграции' : 'Integrations'}
                </div>
                <div onClick={() => setActiveSection('ai_prompts')} style={{ ...navItemStyle, ...(activeSection === 'ai_prompts' ? navItemActive : {}) }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1"/></svg>
                    {language === 'ru' ? 'ИИ-Промпты' : 'AI Prompts'}
                </div>
            </div>

            {/* Main Content */}
            <div style={{ padding: '32px 40px', overflowY: 'auto' }}>
                {activeSection === 'general' && (
                    <div style={{ maxWidth: '640px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-primary)' }}>{language === 'ru' ? 'Биржа и пары' : 'Exchange and Pairs'}</div>
                        
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Binance Futures API</div>
                            <input type="text" placeholder="API Key" value={binanceKey} onChange={(e) => setBinanceKey(e.target.value)} style={inputStyle} />
                            <div style={{ height: '12px' }} />
                            <input type="password" placeholder="API Secret" value={binanceSecret} onChange={(e) => setBinanceSecret(e.target.value)} style={inputStyle} />
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>{language === 'ru' ? 'Нужны права только на чтение (Read-Only) для мониторинга цен.' : 'Only Read-Only permission is required for price monitoring.'}</div>
                        </div>

                        <div style={{ marginBottom: '32px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{language === 'ru' ? 'Отслеживаемые пары' : 'Monitored Pairs'}</div>
                            <textarea 
                                placeholder="BTCUSDT, ETHUSDT, SOLUSDT..." 
                                value={tradingPairs} onChange={(e) => setTradingPairs(e.target.value)}
                                style={{ ...inputStyle, height: '100px', resize: 'vertical', lineHeight: 1.5 }} 
                            />
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>{language === 'ru' ? 'Разделяйте через запятую. Только USDT пары (напр. BTCUSDT).' : 'Separate with commas. Only USDT pairs (e.g. BTCUSDT).'}</div>
                        </div>

                        <button onClick={saveGeneral} style={primaryBtnStyle}>
                            {saveStatus ? (saveStatus.includes('Сохранено') ? (language === 'ru' ? '✓ Сохранено' : '✓ Saved') : saveStatus.includes('Сохранение') ? (language === 'ru' ? 'Сохранение...' : 'Saving...') : (language === 'ru' ? '✕ Ошибка' : '✕ Error')) : (language === 'ru' ? 'Сохранить настройки' : 'Save Settings')}
                        </button>
                    </div>
                )}

                {activeSection === 'dedup' && (
                    <div style={{ maxWidth: '640px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>{language === 'ru' ? 'Дедупликация сигналов' : 'Signal Deduplication'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>{language === 'ru' ? 'Интервал тишины между сигналами одной стратегии по одному инструменту.' : 'Silence interval between signals of the same strategy for the same asset.'}</div>
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '16px' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-primary)', flex: 1, fontWeight: 600 }}>{language === 'ru' ? 'Интервал ожидания' : 'Cooldown Interval'}</span>
                                <input 
                                    type="range" min="1" max="24" step="1" 
                                    value={deduplication}
                                    onChange={(e) => handleDedupChange(parseInt(e.target.value))}
                                    style={{ flex: 1, accentColor: 'var(--accent-color)' }} 
                                />
                                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-color)', minWidth: '45px' }}>{deduplication} {language === 'ru' ? 'ч' : 'h'}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                {language === 'ru' ? `Это предотвращает множественные входы в одну и ту же позицию при боковом движении. Следующий сигнал придёт не раньше, чем через ${deduplication} ч.` : `This prevents multiple entries into the same position during sideways movement. The next signal will arrive no earlier than in ${deduplication} h.`}
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'logs' && (
                    <div style={{ maxWidth: '800px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>{language === 'ru' ? 'Журнал событий' : 'Event Log'}</div>
                        <div style={{ 
                            background: '#0f172a', borderRadius: '12px', padding: '24px', 
                            fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8', 
                            minHeight: '400px', border: '1px solid var(--border-color)',
                            lineHeight: 1.6, boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                        }}>
                            {logs.length === 0 && <div style={{ color: '#475569' }}>{language === 'ru' ? '[SYSTEM] Ожидание событий...' : '[SYSTEM] Waiting for events...'}</div>}
                            {logs.map((log, i) => (
                                <div key={i} style={{ marginBottom: '8px', borderLeft: `3px solid ${log.type === 'LONG' ? 'var(--success)' : 'var(--danger)'}`, paddingLeft: '12px' }}>
                                    <span style={{ color: '#6366f1' }}>[{new Date(log.created_at).toLocaleTimeString()}]</span> 
                                    <span style={{ color: log.type === 'LONG' ? '#10b981' : '#ef4444', fontWeight: 700 }}> [{log.type}] </span>
                                    <span style={{ color: '#f8fafc' }}>{log.pair}</span> via <span style={{ color: '#a855f7' }}>{log.strategy?.name || 'Engine'}</span>
                                </div>
                            ))}
                            <div style={{ color: '#22c55e', marginTop: '20px', opacity: 0.8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>&gt; Socket connection established. Monitoring signals...</div>
                        </div>
                    </div>
                )}

                {activeSection === 'discord' && (
                    <div style={{ maxWidth: '640px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Discord Webhooks</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>{language === 'ru' ? 'Настройте внешнюю интеграцию для отправки сигналов в Discord.' : 'Configure external integration to send signals to Discord.'}</div>
                        
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Webhook URL</div>
                            <input 
                                type="text" 
                                placeholder="https://discord.com/api/webhooks/..." 
                                value={discordWebhook}
                                onChange={(e) => setDiscordWebhook(e.target.value)}
                                style={inputStyle} 
                            />
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '16px', marginBottom: '28px', lineHeight: 1.6 }}>
                                {language === 'ru' ? <>Скопируйте URL из настроек канала: <b>Интеграции → Вебхуки</b>.</> : <>Copy URL from channel settings: <b>Integrations → Webhooks</b>.</>}
                            </div>
                            
                            <button onClick={testDiscord} style={primaryBtnStyle}>
                                {discordStatus ? (discordStatus.includes('Успешно') ? (language === 'ru' ? '✓ Успешно' : '✓ Success') : discordStatus.includes('Проверка') ? (language === 'ru' ? 'Проверка...' : 'Checking...') : (language === 'ru' ? '✕ Ошибка' : '✕ Error')) : (language === 'ru' ? 'Проверить и сохранить' : 'Verify & Save')}
                            </button>
                        </div>
                    </div>
                )}
                {activeSection === 'filters' && (
                    <div style={{ maxWidth: '640px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>{language === 'ru' ? 'Глобальные фильтры' : 'Global Filters'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>{language === 'ru' ? 'Эти правила перекрывают любые сигналы стратегий для защиты капитала.' : 'These rules override any strategy signals to protect capital.'}</div>
                        
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{language === 'ru' ? 'Общая пауза (Global Pause)' : 'Global Pause'}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{language === 'ru' ? 'Мгновенно остановить отправку всех сигналов' : 'Instantly stop sending all signals'}</div>
                                </div>
                                <input 
                                    type="checkbox" checked={globalPause} 
                                    onChange={async (e) => {
                                        const val = e.target.checked;
                                        setGlobalPause(val);
                                        await settingsApi.update('global_pause', val ? 'true' : 'false');
                                    }} 
                                    style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--danger)' }} 
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>{language === 'ru' ? 'Защита от обвала рынка (24h)' : 'Market Crash Protection (24h)'}</div>
                                <div style={{ display: 'grid', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '120px' }}>{language === 'ru' ? 'Падение BTC >' : 'BTC Drop >'}</span>
                                        <input 
                                            type="number" value={btcThreshold} 
                                            onChange={(e) => setBtcThreshold(parseFloat(e.target.value))} 
                                            style={{ ...inputStyle, width: '80px' }} 
                                        />
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '120px' }}>{language === 'ru' ? 'Падение ETH >' : 'ETH Drop >'}</span>
                                        <input 
                                            type="number" value={ethThreshold} 
                                            onChange={(e) => setEthThreshold(parseFloat(e.target.value))} 
                                            style={{ ...inputStyle, width: '80px' }} 
                                        />
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={async () => {
                                    setSaveStatus('Сохранение...');
                                    try {
                                        await Promise.all([
                                            settingsApi.update('btc_drop_threshold', btcThreshold.toString()),
                                            settingsApi.update('eth_drop_threshold', ethThreshold.toString())
                                        ]);
                                        setSaveStatus('✓ Сохранено');
                                    } catch {
                                        setSaveStatus('✕ Ошибка');
                                    } finally {
                                        setTimeout(() => setSaveStatus(null), 3000);
                                    }
                                }} 
                                style={primaryBtnStyle}
                            >
                                {saveStatus ? (saveStatus.includes('Сохранено') ? (language === 'ru' ? '✓ Сохранено' : '✓ Saved') : saveStatus.includes('Сохранение') ? (language === 'ru' ? 'Сохранение...' : 'Saving...') : (language === 'ru' ? '✕ Ошибка' : '✕ Error')) : (language === 'ru' ? 'Сохранить фильтры' : 'Save Filters')}
                            </button>
                        </div>
                        <div style={{ padding: '16px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '12px', border: '1px solid rgba(234, 179, 8, 0.3)', display: 'flex', gap: '12px' }}>
                            <div style={{ fontSize: '18px' }}>⚠️</div>
                            <div style={{ fontSize: '12px', color: '#a16207', lineHeight: 1.5 }}>
                                {language === 'ru' ? 'Если BTC или ETH упадут ниже указанного порога за 24 часа, бот автоматически заблокирует все новые сигналы до стабилизации рынка.' : 'If BTC or ETH fall below the specified threshold within 24 hours, the bot will automatically block all new signals until the market stabilizes.'}
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'risk' && (
                    <div style={{ maxWidth: '640px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>{language === 'ru' ? 'Риск-менеджмент' : 'Risk Management'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>{language === 'ru' ? 'Глобальные ограничения для защиты всего портфеля.' : 'Global constraints to protect the entire portfolio.'}</div>
                        
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px' }}>
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Daily Loss Limit ($)</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{language === 'ru' ? 'Блокировать сигналы при достижении дневного убытка' : 'Block signals when daily loss threshold is reached'}</div>
                                <input 
                                    type="number" value={dailyLossLimit} 
                                    onChange={(e) => setDailyLossLimit(parseFloat(e.target.value))} 
                                    style={inputStyle} 
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Max Active Signals</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{language === 'ru' ? 'Максимальное кол-во активных сигналов одновременно' : 'Maximum number of concurrent active signals'}</div>
                                <input 
                                    type="number" value={maxActiveSignals} 
                                    onChange={(e) => setMaxActiveSignals(parseInt(e.target.value))} 
                                    style={inputStyle} 
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Consecutive Loss Limit (Losses)</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{language === 'ru' ? 'Кол-во последовательных убытков для запуска паузы (0 = отключено)' : 'Number of consecutive losses to trigger cooldown (0 = disabled)'}</div>
                                <input 
                                    type="number" value={consecutiveLossLimit} 
                                    onChange={(e) => setConsecutiveLossLimit(parseInt(e.target.value))} 
                                    style={inputStyle} 
                                />
                            </div>

                            <div style={{ marginBottom: '32px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Cooldown Duration (Hours)</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{language === 'ru' ? 'Время паузы после серии убытков (в часах)' : 'Cooldown duration after consecutive losses (in hours)'}</div>
                                <input 
                                    type="number" value={cooldownDuration} 
                                    onChange={(e) => setCooldownDuration(parseFloat(e.target.value))} 
                                    style={inputStyle} 
                                />
                            </div>

                            <button 
                                onClick={async () => {
                                    setSaveStatus('Сохранение...');
                                    try {
                                        await Promise.all([
                                            settingsApi.update('daily_loss_limit', dailyLossLimit.toString()),
                                            settingsApi.update('max_active_signals', maxActiveSignals.toString()),
                                            settingsApi.update('consecutive_loss_limit', consecutiveLossLimit.toString()),
                                            settingsApi.update('cooldown_duration', cooldownDuration.toString())
                                        ]);
                                        setSaveStatus('✓ Сохранено');
                                    } catch {
                                        setSaveStatus('✕ Ошибка');
                                    } finally {
                                        setTimeout(() => setSaveStatus(null), 3000);
                                    }
                                }} 
                                style={primaryBtnStyle}
                            >
                                {saveStatus ? (saveStatus.includes('Сохранено') ? (language === 'ru' ? '✓ Сохранено' : '✓ Saved') : saveStatus.includes('Сохранение') ? (language === 'ru' ? 'Сохранение...' : 'Saving...') : (language === 'ru' ? '✕ Ошибка' : '✕ Error')) : (language === 'ru' ? 'Сохранить лимиты' : 'Save Limits')}
                            </button>
                        </div>
                    </div>
                )}

                {activeSection === 'telegram' && (
                    <div style={{ maxWidth: '640px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>{language === 'ru' ? 'Telegram Бот' : 'Telegram Bot'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '32px' }}>{language === 'ru' ? 'Основной канал доставки торговых сигналов.' : 'Primary channel for trade signals delivery.'}</div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                            <Step num="1" title={language === 'ru' ? 'Создание бота' : 'Bot Creation'} sub={language === 'ru' ? <>Найдите <span style={codeStyle}>@BotFather</span> и получите API Token.</> : <>Find <span style={codeStyle}>@BotFather</span> and obtain the API Token.</>} done={!!botToken} />
                            <Step num="2" title={language === 'ru' ? 'Добавление в канал' : 'Add to Channel'} sub={language === 'ru' ? 'Сделайте бота администратором в вашем канале.' : 'Make the bot an administrator in your channel.'} done />
                            <Step num={isConnected ? "✓" : "3"} title={language === 'ru' ? 'Идентификация' : 'Identification'} sub={language === 'ru' ? <>Узнайте <span style={codeStyle}>chat_id</span> через <span style={codeStyle}>@getmyid_bot</span>.</> : <>Get <span style={codeStyle}>chat_id</span> using <span style={codeStyle}>@getmyid_bot</span>.</>} done={isConnected} />
                        </div>

                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Bot Token</div>
                                <input type="text" value={botToken} onChange={e => setBotToken(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Chat ID</div>
                                <input type="text" value={chatId} onChange={e => setChatId(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                            </div>
                            <button onClick={verify} disabled={isVerifying} style={primaryBtnStyle}>
                                {isVerifying ? (language === 'ru' ? 'Ждите...' : 'Please wait...') : (isConnected ? (language === 'ru' ? 'Обновить данные' : 'Update Data') : (language === 'ru' ? 'Проверить связь' : 'Test Connection'))}
                            </button>
                        </div>

                        {banner.type && (
                            <div style={{ 
                                padding: '16px 20px', borderRadius: '12px', display: 'flex', gap: '16px',
                                background: banner.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : banner.type === 'fail' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                border: `1px solid ${banner.type === 'success' ? 'var(--success)' : banner.type === 'fail' ? 'var(--danger)' : 'var(--accent-color)'}`,
                                marginBottom: '32px'
                            }}>
                                <div style={{ fontSize: '20px' }}>{banner.type === 'success' ? '✓' : banner.type === 'fail' ? '✕' : '⟳'}</div>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px', color: banner.type === 'success' ? 'var(--success)' : banner.type === 'fail' ? 'var(--danger)' : 'var(--accent-color)' }}>
                                        {banner.title.includes('Проверяем') ? (language === 'ru' ? 'Проверяем...' : 'Verifying...') : banner.title.includes('подключён') ? (language === 'ru' ? 'Telegram подключён' : 'Telegram Connected') : banner.title.includes('доставки') ? (language === 'ru' ? 'Ошибка доставки' : 'Delivery Error') : (language === 'ru' ? 'Ошибка API' : 'API Error')}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {banner.sub.includes('пытается написать') ? (language === 'ru' ? 'Бот пытается написать в указанный чат' : 'The bot is attempting to write to the specified chat') : banner.sub.includes('Тестовое сообщение') ? (language === 'ru' ? `Тестовое сообщение доставлено. ID: ${chatId}` : `Test message successfully delivered. ID: ${chatId}`) : banner.sub.includes('Проверьте Token') ? (language === 'ru' ? 'Проверьте Token и chat_id.' : 'Please check Token and chat_id.') : banner.sub}
                                    </div>
                                </div>
                            </div>
                        )}

                        {isConnected && (
                            <div style={{ padding: '24px', background: 'var(--bg-accent)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{language === 'ru' ? 'Бот успешно подключён' : 'Bot successfully connected'}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{language === 'ru' ? 'Активный ID: ' : 'Active ID: '}{chatId}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={sendTest} style={{ fontSize: '12px', padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>{language === 'ru' ? 'Тест' : 'Test'}</button>
                                    <button onClick={disconnect} style={{ fontSize: '12px', padding: '6px 16px', borderRadius: '8px', border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{language === 'ru' ? 'Отключить' : 'Disconnect'}</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeSection === 'integrations' && (
                    <div style={{ maxWidth: '680px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>{language === 'ru' ? 'Интеграции' : 'Integrations'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: 1.6 }}>{language === 'ru' ? 'Подключите внешние AI-платформы. Настройки хранятся в базе данных — работают при любом деплое.' : 'Connect external AI platforms. Settings are stored in the database and persist across all deployments.'}</div>

                        {/* heym MCP card */}
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', overflow: 'hidden', marginBottom: '24px' }}>
                            {/* Header */}
                            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>⚡</div>
                                    <div>
                                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>heym MCP</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AI Workflow Platform — Signal Validator</div>
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                                    background: heymHasKey ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                                    color: heymHasKey ? '#10b981' : 'var(--text-secondary)',
                                    border: `1px solid ${heymHasKey ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`
                                }}>
                                    {heymHasKey ? (language === 'ru' ? '● Настроен' : '● Configured') : (language === 'ru' ? '○ Не настроен' : '○ Not Configured')}
                                </div>
                            </div>

                            {/* Step guide */}
                            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border-color)', background: 'rgba(99,102,241,0.03)' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>{language === 'ru' ? 'Как подключить' : 'How to Connect'}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {[
                                        { n: '1', text: language === 'ru' ? <span>Откройте heym UI (напр. <code style={{ fontFamily: 'monospace', background: 'var(--bg-accent)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>http://localhost:4017</code>)</span> : <span>Open heym UI (e.g. <code style={{ fontFamily: 'monospace', background: 'var(--bg-accent)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>http://localhost:4017</code>)</span> },
                                        { n: '2', text: language === 'ru' ? 'Перейдите в вкладку MCP → нажмите Generate рядом с «API Key»' : 'Navigate to the MCP tab → click Generate next to "API Key"' },
                                        { n: '3', text: language === 'ru' ? 'Вставьте URL, API Key и ID workflow ниже → Сохранить' : 'Paste the URL, API Key, and workflow ID below → Save' },
                                        { n: '4', text: language === 'ru' ? 'Нажмите «Проверить соединение» — должно появиться «Соединение установлено»' : 'Click "Test Connection" — "Connection established" should appear' },
                                    ].map(({ n, text }) => (
                                        <div key={n} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>{n}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: '2px' }}>{text}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Form */}
                            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>heym URL</div>
                                    <input
                                        id="heym-url"
                                        type="text"
                                        placeholder="http://localhost:4017"
                                        value={heymUrl}
                                        onChange={e => setHeymUrl(e.target.value)}
                                        style={inputStyle}
                                    />
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>{language === 'ru' ? 'Базовый URL без /api. Для Docker Desktop используйте host.docker.internal вместо localhost.' : 'Base URL without /api. For Docker Desktop, use host.docker.internal instead of localhost.'}</div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>API Key (X-MCP-Key)</div>
                                    <input
                                        id="heym-api-key"
                                        type="password"
                                        placeholder={heymHasKey ? (language === 'ru' ? 'Ключ уже сохранён (вставьте новый для замены)' : 'Key is already saved (paste a new one to replace)') : (language === 'ru' ? 'Вставьте API ключ из heym MCP tab' : 'Paste API Key from heym MCP tab')}
                                        value={heymApiKey}
                                        onChange={e => setHeymApiKey(e.target.value)}
                                        style={{ ...inputStyle, fontFamily: 'monospace' }}
                                    />
                                </div>

                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Workflow ID (Signal Validator)</div>
                                    <input
                                        id="heym-workflow-id"
                                        type="text"
                                        placeholder={language === 'ru' ? 'Получите после запуска: node scripts/setup-heym-workflow.js' : 'Obtain after running: node scripts/setup-heym-workflow.js'}
                                        value={heymWorkflowId}
                                        onChange={e => setHeymWorkflowId(e.target.value)}
                                        style={{ ...inputStyle, fontFamily: 'monospace' }}
                                    />
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>{language === 'ru' ? 'Необязательно — без workflow ID нода heym_mcp будет пропускать сигналы без проверки.' : 'Optional — without workflow ID, the heym_mcp node will pass signals without validation.'}</div>
                                </div>

                                {/* Test result banner */}
                                {heymTestStatus && (
                                    <div style={{
                                        padding: '12px 16px', borderRadius: '10px',
                                        background: heymTestStatus.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                        border: `1px solid ${heymTestStatus.ok ? 'var(--success)' : 'var(--danger)'}`,
                                        display: 'flex', alignItems: 'center', gap: '10px'
                                    }}>
                                        <span style={{ fontSize: '16px' }}>{heymTestStatus.ok ? '✅' : '❌'}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: heymTestStatus.ok ? 'var(--success)' : 'var(--danger)' }}>{heymTestStatus.msg}</span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                                    <button
                                        id="heym-test-btn"
                                        onClick={testHeym}
                                        disabled={heymTesting}
                                        style={{ ...primaryBtnStyle, background: 'var(--bg-accent)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', boxShadow: 'none' }}
                                    >
                                        {heymTesting ? (language === 'ru' ? '⟳ Проверка...' : '⟳ Verifying...') : (language === 'ru' ? '🔌 Проверить соединение' : '🔌 Test Connection')}
                                    </button>
                                    <button
                                        id="heym-save-btn"
                                        onClick={saveHeym}
                                        style={primaryBtnStyle}
                                    >
                                        {heymSaveStatus ? (heymSaveStatus.includes('Сохранено') ? (language === 'ru' ? '✓ Сохранено' : '✓ Saved') : heymSaveStatus.includes('Сохранение') ? (language === 'ru' ? 'Сохранение...' : 'Saving...') : (language === 'ru' ? '✕ Ошибка' : '✕ Error')) : (language === 'ru' ? 'Сохранить' : 'Save')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── Hermes AI Agent card ── */}
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', overflow: 'hidden', marginBottom: '24px' }}>
                            {/* Header */}
                            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #ec4899, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🧠</div>
                                    <div>
                                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Hermes AI Agent</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{language === 'ru' ? 'LLM провайдер — фильтрация и оценка сигналов' : 'LLM provider — signal filtering and evaluation'}</div>
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                                    background: hermesUrl ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                                    color: hermesUrl ? '#10b981' : 'var(--text-secondary)',
                                    border: `1px solid ${hermesUrl ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`
                                }}>
                                    {hermesUrl ? (language === 'ru' ? '● Настроен' : '● Configured') : (language === 'ru' ? '○ Не настроен' : '○ Not Configured')}
                                </div>
                            </div>

                            {/* Provider selector */}
                            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border-color)', background: 'rgba(236,72,153,0.03)' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>{language === 'ru' ? 'Провайдер' : 'Provider'}</div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {(
                                        [
                                            { value: 'hermes', label: 'Hermes Agent', sub: '/run endpoint', icon: '🤖' },
                                            { value: 'ollama', label: 'Ollama', sub: 'Local LLM', icon: '🦙' },
                                            { value: 'openai', label: 'OpenAI / Compatible', sub: 'Groq, Together, LM Studio…', icon: '✨' },
                                        ] as const
                                    ).map(p => (
                                        <div
                                            key={p.value}
                                            onClick={() => {
                                                setHermesProvider(p.value);
                                                // Set sensible default URLs
                                                if (!hermesUrl) {
                                                    if (p.value === 'ollama') setHermesUrl('http://localhost:11434');
                                                    else if (p.value === 'openai') setHermesUrl('https://api.openai.com');
                                                    else if (p.value === 'hermes') setHermesUrl('http://hermes:7700');
                                                }
                                                if (!hermesModel) {
                                                    if (p.value === 'ollama') setHermesModel('llama3.2');
                                                    else if (p.value === 'openai') setHermesModel('gpt-4o-mini');
                                                    else setHermesModel('nous-hermes-3');
                                                }
                                            }}
                                            style={{
                                                flex: 1, padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                                                border: `1px solid ${hermesProvider === p.value ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                                background: hermesProvider === p.value ? 'rgba(99,102,241,0.08)' : 'var(--bg-accent)',
                                                transition: 'var(--transition)'
                                            }}
                                        >
                                            <div style={{ fontSize: '16px', marginBottom: '4px' }}>{p.icon}</div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: hermesProvider === p.value ? 'var(--accent-color)' : 'var(--text-primary)' }}>{p.label}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{p.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Form */}
                            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>API URL</div>
                                    <input
                                        id="hermes-url"
                                        type="text"
                                        placeholder={
                                            hermesProvider === 'ollama' ? 'http://localhost:11434' :
                                            hermesProvider === 'openai' ? 'https://api.openai.com' :
                                            'http://hermes:7700'
                                        }
                                        value={hermesUrl}
                                        onChange={e => setHermesUrl(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{language === 'ru' ? 'Модель' : 'Model'}</div>
                                    <input
                                        id="hermes-model"
                                        type="text"
                                        placeholder={
                                            hermesProvider === 'ollama' ? 'llama3.2 / qwen2.5-coder / mistral' :
                                            hermesProvider === 'openai' ? 'gpt-4o-mini / gpt-4o / llama-3.3-70b' :
                                            'nous-hermes-3'
                                        }
                                        value={hermesModel}
                                        onChange={e => setHermesModel(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>

                                {hermesProvider === 'openai' && (
                                    <div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>API Key</div>
                                        <input
                                            id="hermes-api-key"
                                            type="password"
                                            placeholder={hermesHasKey ? (language === 'ru' ? 'Ключ сохранён (вставьте новый для замены)' : 'Key is saved (paste a new one to replace)') : 'sk-...'}
                                            value={hermesApiKey}
                                            onChange={e => setHermesApiKey(e.target.value)}
                                            style={{ ...inputStyle, fontFamily: 'monospace' }}
                                        />
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>{language === 'ru' ? 'Для Groq: gsk_... | Для Together: ... | Для LM Studio: любая строка' : 'For Groq: gsk_... | For Together: ... | For LM Studio: any string'}</div>
                                    </div>
                                )}

                                {/* Test result */}
                                {hermesTestStatus && (
                                    <div style={{
                                        padding: '12px 16px', borderRadius: '10px',
                                        background: hermesTestStatus.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                        border: `1px solid ${hermesTestStatus.ok ? 'var(--success)' : 'var(--danger)'}`,
                                        display: 'flex', alignItems: 'center', gap: '10px'
                                    }}>
                                        <span style={{ fontSize: '16px' }}>{hermesTestStatus.ok ? '✅' : '❌'}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: hermesTestStatus.ok ? 'var(--success)' : 'var(--danger)' }}>{hermesTestStatus.msg}</span>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                                    <button
                                        id="hermes-test-btn"
                                        onClick={testHermes}
                                        disabled={hermesTesting}
                                        style={{ ...primaryBtnStyle, background: 'var(--bg-accent)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', boxShadow: 'none' }}
                                    >
                                        {hermesTesting ? (language === 'ru' ? '⟳ Проверка...' : '⟳ Verifying...') : (language === 'ru' ? '🔌 Проверить соединение' : '🔌 Test Connection')}
                                    </button>
                                    <button id="hermes-save-btn" onClick={saveHermes} style={primaryBtnStyle}>
                                        {hermesSaveStatus ? (hermesSaveStatus.includes('Сохранено') ? (language === 'ru' ? '✓ Сохранено' : '✓ Saved') : hermesSaveStatus.includes('Сохранение') ? (language === 'ru' ? 'Сохранение...' : 'Saving...') : (language === 'ru' ? '✕ Ошибка' : '✕ Error')) : (language === 'ru' ? 'Сохранить' : 'Save')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* CryptoPanic API card */}
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', overflow: 'hidden', marginBottom: '24px' }}>
                            {/* Header */}
                            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>📰</div>
                                    <div>
                                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>CryptoPanic API</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{language === 'ru' ? 'Сентимент-анализ новостей и настроений рынка' : 'Sentiment analysis of news and market sentiment'}</div>
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                                    background: cryptoPanicKey ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                                    color: cryptoPanicKey ? '#10b981' : 'var(--text-secondary)',
                                    border: `1px solid ${cryptoPanicKey ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`
                                }}>
                                    {cryptoPanicKey ? (language === 'ru' ? '● Настроен' : '● Configured') : (language === 'ru' ? '○ Не настроен' : '○ Not Configured')}
                                </div>
                            </div>

                            {/* Form */}
                            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>API Key (Auth Token)</div>
                                    <input
                                        id="cryptopanic-api-key"
                                        type="password"
                                        placeholder={language === 'ru' ? 'Введите ваш API токен (CryptoPanic Auth Token)' : 'Enter your CryptoPanic API Auth Token'}
                                        value={cryptoPanicKey}
                                        onChange={e => setCryptoPanicKey(e.target.value)}
                                        style={{ ...inputStyle, fontFamily: 'monospace' }}
                                    />
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                        {language === 'ru' ? <span>Получите бесплатный токен на <a href="https://cryptopanic.com/developer/api/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>cryptopanic.com/developer/api/</a></span> : <span>Get a free API token at <a href="https://cryptopanic.com/developer/api/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>cryptopanic.com/developer/api/</a></span>}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                                    <button
                                        id="cryptopanic-save-btn"
                                        onClick={saveCryptoPanic}
                                        style={primaryBtnStyle}
                                    >
                                        {cryptoPanicSaveStatus ? (cryptoPanicSaveStatus.includes('Сохранено') ? (language === 'ru' ? '✓ Сохранено' : '✓ Saved') : cryptoPanicSaveStatus.includes('Сохранение') ? (language === 'ru' ? 'Сохранение...' : 'Saving...') : (language === 'ru' ? '✕ Ошибка' : '✕ Error')) : (language === 'ru' ? 'Сохранить' : 'Save')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Info box */}
                        <div style={{ padding: '14px 18px', background: 'rgba(99,102,241,0.07)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '16px', marginTop: '1px' }}>ℹ️</span>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                {language === 'ru' ? 'Настройки хранятся в PostgreSQL и работают в любом деплое. Env-переменные HEYM_* и HERMES_* используются как fallback, если БД пустая.' : 'Settings are stored in PostgreSQL and work across all deployments. Env variables HEYM_* and HERMES_* are used as fallback if the database is empty.'}
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'ai_prompts' && (
                    <div style={{ maxWidth: '800px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.2)' }}>🧠</div>
                            <div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {language === 'ru' ? 'Конструктор ИИ-Промптов' : 'AI Prompt Template Builder'}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    {language === 'ru' ? 'Тонкая настройка когнитивного фильтра Hermes ИИ для разных стилей торговли' : 'Fine-tune the Hermes AI cognitive validation filter for different trading styles'}
                                </div>
                            </div>
                        </div>

                        {/* Presets Grid */}
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                            {language === 'ru' ? 'Выберите стиль торговли (Пресет)' : 'Select Trading Style (Preset)'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                            {/* Scalping card */}
                            <div 
                                onClick={() => selectPreset('scalping')}
                                style={{
                                    padding: '20px', borderRadius: '16px', cursor: 'pointer',
                                    background: 'var(--bg-secondary)',
                                    border: `2px solid ${promptPreset === 'scalping' ? '#ef4444' : 'var(--border-color)'}`,
                                    boxShadow: promptPreset === 'scalping' ? '0 8px 24px rgba(239, 68, 68, 0.15)' : 'none',
                                    transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', gap: '8px'
                                }}
                            >
                                <span style={{ fontSize: '24px' }}>⚡</span>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: promptPreset === 'scalping' ? '#ef4444' : 'var(--text-primary)' }}>
                                    {language === 'ru' ? 'Скальпинг' : 'Scalping'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    {language === 'ru' ? 'Импульс, ATR, краткосрочная волатильность' : 'Momentum, ATR, tight volatility loops'}
                                </div>
                            </div>

                            {/* Swing card */}
                            <div 
                                onClick={() => selectPreset('swing')}
                                style={{
                                    padding: '20px', borderRadius: '16px', cursor: 'pointer',
                                    background: 'var(--bg-secondary)',
                                    border: `2px solid ${promptPreset === 'swing' ? '#6366f1' : 'var(--border-color)'}`,
                                    boxShadow: promptPreset === 'swing' ? '0 8px 24px rgba(99, 102, 241, 0.15)' : 'none',
                                    transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', gap: '8px'
                                }}
                            >
                                <span style={{ fontSize: '24px' }}>📈</span>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: promptPreset === 'swing' ? '#6366f1' : 'var(--text-primary)' }}>
                                    {language === 'ru' ? 'Свинг-трейдинг' : 'Swing Trading'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    {language === 'ru' ? 'Дневные тренды, ликвидность, FVG структуры' : 'Daily trends, sweeps, FVG structure focus'}
                                </div>
                            </div>

                            {/* HODL card */}
                            <div 
                                onClick={() => selectPreset('hodl')}
                                style={{
                                    padding: '20px', borderRadius: '16px', cursor: 'pointer',
                                    background: 'var(--bg-secondary)',
                                    border: `2px solid ${promptPreset === 'hodl' ? '#10b981' : 'var(--border-color)'}`,
                                    boxShadow: promptPreset === 'hodl' ? '0 8px 24px rgba(16, 185, 129, 0.15)' : 'none',
                                    transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', gap: '8px'
                                }}
                            >
                                <span style={{ fontSize: '24px' }}>💎</span>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: promptPreset === 'hodl' ? '#10b981' : 'var(--text-primary)' }}>
                                    {language === 'ru' ? 'Инвестирование / HODL' : 'Position / HODL'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    {language === 'ru' ? 'Новости, регуляция, фундаментальный фон' : 'News, regulatory risks, macro convictions'}
                                </div>
                            </div>

                            {/* Custom card */}
                            <div 
                                onClick={() => selectPreset('custom')}
                                style={{
                                    padding: '20px', borderRadius: '16px', cursor: 'pointer',
                                    background: 'var(--bg-secondary)',
                                    border: `2px solid ${promptPreset === 'custom' ? 'var(--text-primary)' : 'var(--border-color)'}`,
                                    boxShadow: promptPreset === 'custom' ? '0 8px 24px rgba(255, 255, 255, 0.05)' : 'none',
                                    transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', gap: '8px'
                                }}
                            >
                                <span style={{ fontSize: '24px' }}>🛠️</span>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: promptPreset === 'custom' ? 'var(--text-primary)' : 'var(--text-primary)' }}>
                                    {language === 'ru' ? 'Кастомный' : 'Custom'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    {language === 'ru' ? 'Полное ручное управление шаблоном системного промпта' : 'Complete manual control over system template'}
                                </div>
                            </div>
                        </div>

                        {/* Editor Block */}
                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '28px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {language === 'ru' ? 'Системный шаблон промпта' : 'System Prompt Template'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-accent)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    {promptPreset === 'custom' ? (language === 'ru' ? 'Режим редактирования' : 'Manual Edit Mode') : (language === 'ru' ? 'Только чтение (выбран пресет)' : 'Read-only Preset Mode')}
                                </div>
                            </div>

                            <textarea
                                value={promptTemplate}
                                onChange={e => {
                                    setPromptTemplate(e.target.value);
                                    setPromptPreset('custom');
                                }}
                                style={{
                                    width: '100%', height: '320px', borderRadius: '12px', padding: '16px',
                                    background: 'var(--bg-accent)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
                                    fontFamily: 'Fira Code, SFMono-Regular, Consolas, monospace', fontSize: '13px', lineHeight: 1.6,
                                    outline: 'none', resize: 'vertical', transition: 'border-color 0.2s ease', boxSizing: 'border-box'
                                }}
                                placeholder={language === 'ru' ? 'Введите ваш кастомный системный промпт...' : 'Enter your custom system prompt...'}
                            />

                            {/* Tags list */}
                            <div style={{ marginTop: '16px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                    {language === 'ru' ? 'Доступные плейсхолдеры' : 'Available Placeholders'}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {['{{pair}}', '{{price}}', '{{signal}}', '{{ldr_summary}}', '{{ldr_sentiment}}', '{{ldr_risk_level}}', '{{indicators}}'].map(tag => (
                                        <code 
                                            key={tag}
                                            onClick={() => {
                                                setPromptTemplate(prev => prev + ' ' + tag);
                                                setPromptPreset('custom');
                                            }}
                                            style={{
                                                ...codeStyle, cursor: 'pointer', display: 'inline-block',
                                                padding: '4px 10px', borderRadius: '8px', fontSize: '12px',
                                                transition: 'all 0.2s ease', userSelect: 'none'
                                            }}
                                            title={language === 'ru' ? 'Нажмите, чтобы вставить' : 'Click to insert'}
                                        >
                                            {tag}
                                        </code>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <button 
                                onClick={savePrompts}
                                style={{
                                    ...primaryBtnStyle,
                                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                }}
                            >
                                {promptSaveStatus ? (promptSaveStatus.includes('Сохранено') ? (language === 'ru' ? '✓ Сохранено' : '✓ Saved') : promptSaveStatus.includes('Сохранение') ? (language === 'ru' ? 'Сохранение...' : 'Saving...') : (language === 'ru' ? '✕ Ошибка' : '✕ Error')) : (language === 'ru' ? 'Сохранить промпт' : 'Save Prompt')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const Step = ({ num, title, sub, done }: any) => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{ 
            width: '32px', height: '32px', borderRadius: '50%', 
            background: done ? 'var(--success)' : 'var(--bg-accent)', 
            border: `1px solid ${done ? 'var(--success)' : 'var(--border-color)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontSize: '14px', fontWeight: 800, color: done ? '#fff' : 'var(--text-secondary)', flexShrink: 0
        }}>
            {num}
        </div>
        <div>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>{title}</div>
            {sub && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{sub}</div>}
        </div>
    </div>
);

const navItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
    borderRadius: '12px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '4px',
    transition: 'var(--transition)', fontWeight: 500
};

const navItemActive: React.CSSProperties = {
    background: 'var(--bg-accent)', color: 'var(--accent-color)', fontWeight: 700,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
};

const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: '14px', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)',
    background: 'var(--bg-accent)', color: 'var(--text-primary)', outline: 'none', transition: 'var(--transition)',
    boxSizing: 'border-box'
};

const primaryBtnStyle: React.CSSProperties = {
    fontSize: '14px', padding: '12px 32px', borderRadius: '12px', border: 'none', 
    background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontWeight: 700,
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)', transition: 'var(--transition)'
};

const codeStyle: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: '11px', background: 'var(--bg-accent)',
    border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px 8px',
    color: 'var(--accent-color)', fontWeight: 700
};

export default Settings;
