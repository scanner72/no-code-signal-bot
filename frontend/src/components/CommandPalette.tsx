import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useLanguageStore } from '../stores/useLanguageStore';
import {
  LayoutDashboard, PencilRuler, BarChart2, History, Activity,
  LineChart, Zap, Brain, Globe, Book, Settings, Search,
  Plus, Play, Package, Wand2, LayoutGrid, Sun, Moon,
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  section: string;
  icon: React.ReactNode;
  keywords: string[];
  action: () => void;
  shortcut?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNewStrategy: () => void;
  theme: string;
  setTheme: (t: string) => void;
}

const CommandPalette: React.FC<Props> = ({ isOpen, onClose, onNewStrategy, theme, setTheme }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguageStore();

  const commands: Command[] = useMemo(() => [
    { id: 'nav-dashboard', label: t('control_center'), section: t('cmd_navigate'), icon: <LayoutDashboard size={16} />, keywords: ['dashboard', 'home', 'панель'], action: () => navigate('/dashboard') },
    { id: 'nav-builder', label: t('cmd_canvas'), section: t('cmd_navigate'), icon: <PencilRuler size={16} />, keywords: ['builder', 'canvas', 'конструктор', 'канвас'], action: () => navigate('/builder') },
    { id: 'nav-strategies', label: t('cmd_my_strategies'), section: t('cmd_navigate'), icon: <BarChart2 size={16} />, keywords: ['strategies', 'стратегии', 'список'], action: () => navigate('/strategies') },
    { id: 'nav-backtest', label: t('backtest'), section: t('cmd_navigate'), icon: <LineChart size={16} />, keywords: ['backtest', 'бэктест', 'тест'], action: () => navigate('/backtest') },
    { id: 'nav-paper', label: t('paper_trading'), section: t('cmd_navigate'), icon: <Activity size={16} />, keywords: ['paper', 'trading', 'форвард'], action: () => navigate('/paper') },
    { id: 'nav-signals', label: t('signals_log'), section: t('cmd_navigate'), icon: <History size={16} />, keywords: ['signals', 'сигналы', 'журнал'], action: () => navigate('/signals') },
    { id: 'nav-fleet', label: t('bot_farm'), section: t('cmd_navigate'), icon: <Zap size={16} />, keywords: ['fleet', 'farm', 'ферма', 'боты'], action: () => navigate('/fleet') },
    { id: 'nav-ml', label: t('ml_trainer'), section: t('cmd_navigate'), icon: <Brain size={16} />, keywords: ['ml', 'ai', 'trainer', 'обучение'], action: () => navigate('/ml') },
    { id: 'nav-cross', label: t('cross_exchange'), section: t('cmd_navigate'), icon: <Globe size={16} />, keywords: ['cross', 'exchange', 'кросс', 'биржа', 'спреды'], action: () => navigate('/cross') },
    { id: 'nav-docs', label: t('documentation'), section: t('cmd_navigate'), icon: <Book size={16} />, keywords: ['docs', 'документация', 'help'], action: () => navigate('/docs') },
    { id: 'nav-settings', label: t('api_settings'), section: t('cmd_navigate'), icon: <Settings size={16} />, keywords: ['settings', 'настройки', 'api'], action: () => navigate('/settings') },

    { id: 'act-new', label: t('cmd_new_strategy'), section: t('cmd_actions'), icon: <Plus size={16} />, keywords: ['new', 'create', 'новая', 'создать'], action: onNewStrategy, shortcut: '⌘⇧N' },
    { id: 'act-backtest', label: t('run_backtest_btn'), section: t('cmd_actions'), icon: <Play size={16} />, keywords: ['run', 'backtest', 'запустить'], action: () => navigate('/backtest') },
    { id: 'act-codegen', label: t('bot_generator'), section: t('cmd_actions'), icon: <Package size={16} />, keywords: ['bot', 'codegen', 'generate', 'генератор'], action: () => navigate('/builder') },

    { id: 'app-theme', label: theme === 'dark' ? t('light_theme') : t('dark_theme'), section: t('cmd_app'), icon: theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />, keywords: ['theme', 'тема', 'dark', 'light'], action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    { id: 'app-lang', label: language === 'ru' ? 'Switch to English' : 'Переключить на русский', section: t('cmd_app'), icon: <Globe size={16} />, keywords: ['language', 'язык', 'english', 'русский'], action: () => setLanguage(language === 'ru' ? 'en' : 'ru') },
  ], [navigate, onNewStrategy, theme, setTheme, language, setLanguage, t]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.keywords.some(k => k.includes(q))
    );
  }, [query, commands]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const execute = useCallback((cmd: Command) => {
    onClose();
    setTimeout(() => cmd.action(), 50);
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      execute(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIndex, execute, onClose]);

  if (!isOpen) return null;

  let lastSection = '';

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '20vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, maxHeight: '60vh',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('cmd_placeholder')}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 14, fontWeight: 500,
            }}
          />
          <kbd style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: 'var(--bg-accent)', color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)', fontWeight: 700,
          }}>ESC</kbd>
        </div>

        <div style={{ overflow: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              {t('cmd_no_results')}
            </div>
          )}
          {filtered.map((cmd, i) => {
            const showSection = cmd.section !== lastSection;
            lastSection = cmd.section;
            return (
              <React.Fragment key={cmd.id}>
                {showSection && (
                  <div style={{
                    padding: '8px 16px 4px', fontSize: 10, fontWeight: 700,
                    color: 'var(--text-secondary)', textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    {cmd.section}
                  </div>
                )}
                <div
                  onClick={() => execute(cmd)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  style={{
                    padding: '8px 16px', margin: '0 8px', borderRadius: 8,
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer',
                    background: i === selectedIndex ? 'var(--bg-accent)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{cmd.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: 'var(--bg-accent)', color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                    }}>{cmd.shortcut}</kbd>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CommandPalette;
