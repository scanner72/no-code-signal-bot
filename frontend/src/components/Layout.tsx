import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, PencilRuler, History, Settings, BarChart2, X, Globe, Zap, Brain, LineChart, Book, HelpCircle, Activity, Bell, Sun, Moon, Menu, Plus, FileCode } from 'lucide-react';
import { getCloudNavSections } from '../cloud';

import { systemApi } from '../api/dashboard';
import HelpDrawer from './HelpDrawer';
import { OnboardingWizard } from './OnboardingWizard';
import CommandPalette from './CommandPalette';
import NewStrategyModal from './NewStrategyModal';
import Breadcrumbs from './Breadcrumbs';
import { CyberQuantLogo } from './CyberQuantLogo';
import ShortcutsHelp from './ShortcutsHelp';
import RiskDisclaimerModal from './RiskDisclaimerModal';
import { useNotificationStore } from '../stores/notificationStore';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname.replace('/', '') || 'dashboard';

  const [health, setHealth] = useState<any>({ binanceWs: 'wait', db: 'wait', redis: 'wait', telegram: 'wait' });
  const [showHealth, setShowHealth] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [newStrategyOpen, setNewStrategyOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    return localStorage.getItem('has_completed_onboarding') !== 'true';
  });

  const handleTabChange = useCallback((tab: string) => {
    if (tab === 'builder' || tab === 'backtest') {
      window.open(`/${tab}`, '_blank');
    } else if (tab === 'pine_import') {
      navigate('/pine-import');
    } else {
      navigate(`/${tab}`);
    }
    setSidebarOpen(false);
  }, [navigate]);

  const { notifications, markAllAsRead, clearAllNotifications } = useNotificationStore();
  const unreadCount = notifications.filter(n => !n.read).length;

  const { language, setLanguage, t } = useLanguageStore();

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await systemApi.getHealth();
        if (res.data && res.data.services) {
          setHealth(res.data.services);
        } else {
          setHealth(res.data);
        }
      } catch (err) {
        console.error('Health Check Failed:', err);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const shortcuts = useMemo(() => [
    { key: 'k', ctrl: true, action: () => setCmdPaletteOpen(true) },
    { key: 'n', ctrl: true, shift: true, action: () => setNewStrategyOpen(true) },
  ], []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useKeyboardShortcuts(shortcuts);

  const navGroups = [
    ...getCloudNavSections(t),
    {
      title: t('nav_build'),
      items: [
        { id: 'builder',    icon: <PencilRuler size={18} />, label: t('cmd_canvas') },
        { id: 'strategies', icon: <BarChart2 size={18} />,   label: t('cmd_my_strategies') },
        { id: 'pine_import', icon: <FileCode size={18} />,   label: t('import_pine') },
      ],
    },
    {
      title: t('nav_test'),
      items: [
        { id: 'backtest', icon: <LineChart size={18} />, label: t('backtest') },
        { id: 'paper',    icon: <Activity size={18} />,  label: t('paper_trading') },
      ],
    },
    {
      title: t('nav_deploy'),
      items: [
        { id: 'fleet',   icon: <Zap size={18} />,     label: t('bot_farm') },
        { id: 'signals', icon: <History size={18} />,  label: t('signals_log') },
      ],
    },
    {
      title: t('nav_analyze'),
      items: [
        { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: t('control_center') },
        { id: 'cross',     icon: <Globe size={18} />,           label: t('cross_exchange') },
        { id: 'ml',        icon: <Brain size={18} />,           label: t('ml_trainer') },
      ],
    },
  ];


  const allOk = Object.values(health).every(v => v === 'ok');

  return (
    <div className="app-container">

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── BENTO NAV (Wide Sidebar / Drawer on mobile) ── */}
      <nav className={`bento-nav ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div
            className="nav-logo-wrapper"
            onClick={() => handleTabChange('dashboard')}
            role="button"
            tabIndex={0}
            aria-label="Signal Bot home"
            onKeyDown={(e) => e.key === 'Enter' && handleTabChange('dashboard')}
            style={{ flex: 1 }}
          >
            <CyberQuantLogo size={26} accent="var(--accent-color)" />
          </div>
          <div
            title={allOk ? t('system_healthy') : t('system_degraded')}
            onClick={() => setShowHealth(!showHealth)}
            style={{
              width: 8, height: 8, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
              background: allOk ? 'var(--success)' : 'var(--danger)',
              boxShadow: `0 0 8px ${allOk ? 'var(--success)' : 'var(--danger)'}`,
            }}
          />
        </div>

        {/* CTA: New Strategy */}
        <button
          onClick={() => setNewStrategyOpen(true)}
          style={{
            width: '100%', padding: '10px 0', marginBottom: 16,
            background: 'var(--accent-color)', color: '#fff',
            border: 'none', borderRadius: 10, cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Plus size={16} /> {t('cmd_new_strategy')}
        </button>

        {navGroups.map(group => (
          <React.Fragment key={group.title}>
            <div className="nav-group-title">{group.title}</div>
            {group.items.map(item => (
              <button
                key={item.id}
                className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleTabChange(item.id)}
                aria-label={`Navigate to ${item.label}`}
                aria-current={activeTab === item.id ? 'page' : undefined}
              >
                {item.icon} <span>{item.label}</span>
              </button>
            ))}
          </React.Fragment>
        ))}

        <div className="nav-spacer" />

        <button
          className={`nav-btn ${activeTab === 'docs' ? 'active' : ''}`}
          onClick={() => handleTabChange('docs')}
          aria-label="Navigate to Documentation"
          aria-current={activeTab === 'docs' ? 'page' : undefined}
        >
          <Book size={18} /> <span>{t('documentation')}</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleTabChange('settings')}
          aria-label="Navigate to API Settings"
          aria-current={activeTab === 'settings' ? 'page' : undefined}
        >
          <Settings size={18} /> <span>{t('api_settings')}</span>
        </button>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" style={{ position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header Bar */}
        <div className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Hamburger for mobile */}
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Открыть меню"
            >
              <Menu size={22} />
            </button>
            <Breadcrumbs />
          </div>

          <div id="top-header-portal" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', marginRight: '20px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Cmd+K hint */}
            <button
              onClick={() => setCmdPaletteOpen(true)}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-color)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              title="Command Palette (Ctrl+K)"
            >
              ⌘K
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
              aria-label={`Switch to ${language === 'ru' ? 'English' : 'Russian'}`}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '4px 8px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                transition: 'var(--transition)',
                letterSpacing: '0.05em',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              {language === 'ru' ? 'EN' : 'RU'}
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-pressed={theme === 'light'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
            >
              {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            </button>

            {/* Bell Icon & Notification Center Trigger */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                aria-haspopup="menu"
                aria-expanded={notifOpen}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: unreadCount > 0 ? 'var(--accent-color)' : 'var(--text-secondary)',
                  padding: '8px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'var(--transition)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-accent)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <Bell size={20} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'var(--accent-color)',
                      boxShadow: '0 0 8px var(--accent-color)'
                    }}
                    aria-label={`${unreadCount} unread notifications`}
                  />
                )}
              </button>

              {/* Notification Center Dropdown */}
              {notifOpen && (
                <div
                  role="menu"
                  aria-labelledby="notification-btn"
                  style={{
                    position: 'absolute',
                    top: '45px',
                    right: '0',
                    width: '360px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '20px',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
                    padding: '20px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <span id="notification-title" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('notifications')}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>{t('mark_all_read')}</button>
                      <span style={{ color: 'var(--border-color)' }}>|</span>
                      <button onClick={clearAllNotifications} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>{t('clear_all')}</button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
                        {t('no_notifications')}
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} style={{
                          padding: '12px',
                          borderRadius: '12px',
                          background: n.read ? 'var(--bg-accent)' : 'rgba(99, 102, 241, 0.05)',
                          border: `1px solid ${n.read ? 'transparent' : 'rgba(99, 102, 241, 0.15)'}`,
                          transition: 'var(--transition)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>{n.title}</span>
                            <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{new Date(n.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {/* Context Help Trigger */}
          <button
            onClick={() => setHelpOpen(true)}
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '30px',
              zIndex: 100,
              background: 'var(--bg-accent)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'var(--transition)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.borderColor = 'var(--accent-color)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <HelpCircle size={16} color="var(--accent-color)" /> Help
          </button>

          {children}

          <HelpDrawer
            isOpen={helpOpen}
            onClose={() => setHelpOpen(false)}
            sectionKey={activeTab}
          />
        </div>
      </main>

      {/* ── Health Popup (rendered via Portal to avoid z-index/overflow issues) ── */}
      {showHealth && createPortal(
        <div
          onClick={() => setShowHealth(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="health-modal-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-xl)',
              padding: 24,
              width: 300,
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span id="health-modal-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('system_status')}</span>
              <X size={16} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowHealth(false)} />
            </div>

            {[
              { label: 'Binance WS', key: 'binanceWs' },
              { label: 'Database',   key: 'db' },
              { label: 'Redis Cache', key: 'redis' },
              { label: 'Telegram Bot', key: 'telegram' },
              { label: 'Discord',     key: 'discord' },
            ].map(item => (
              <div key={item.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 11, color: health[item.key] === 'ok' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {health[item.key] === 'ok' ? 'OK' : health[item.key] === 'wait' ? '...' : 'Error'}
                  </span>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: health[item.key] === 'ok' ? 'var(--success)' : (health[item.key] === 'wait' ? 'var(--warning)' : 'var(--danger)'),
                    boxShadow: `0 0 6px ${health[item.key] === 'ok' ? 'var(--success)' : 'var(--danger)'}`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      <OnboardingWizard isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNewStrategy={() => setNewStrategyOpen(true)}
        theme={theme}
        setTheme={setTheme}
      />
      <NewStrategyModal isOpen={newStrategyOpen} onClose={() => setNewStrategyOpen(false)} />
      <ShortcutsHelp isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <RiskDisclaimerModal />
    </div>
  );
};

export default Layout;
