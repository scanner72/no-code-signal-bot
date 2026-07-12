import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useLanguageStore } from '../stores/useLanguageStore';

const ACCEPT_KEY = 'risk_disclaimer_accepted_v1';

/**
 * Одноразовая модалка юридического дисклеймера («не финсовет» + риск торговли).
 * Показывается до принятия (флаг в localStorage). Критично: платформа исполняет
 * реальные ордера — пользователь должен явно принять риск.
 */
export default function RiskDisclaimerModal() {
  const { t } = useLanguageStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ACCEPT_KEY)) setOpen(true);
    } catch {
      /* localStorage недоступен — не блокируем */
    }
  }, []);

  if (!open) return null;

  const accept = () => {
    try {
      localStorage.setItem(ACCEPT_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: 16,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          border: '1px solid var(--border-color)', borderRadius: 12,
          maxWidth: 560, width: '100%', padding: 24,
          boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
        }}
      >
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 14px', fontSize: 'var(--font-size-lg)' }}>
          <ShieldAlert size={22} style={{ color: 'var(--warning)' }} /> {t('disclaimer_title')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-line', margin: '0 0 22px' }}>
          {t('disclaimer_body')}
        </p>
        <button
          onClick={accept}
          style={{
            background: 'var(--accent-color)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '11px 18px', fontWeight: 600,
            cursor: 'pointer', width: '100%',
          }}
        >
          {t('disclaimer_accept')}
        </button>
      </div>
    </div>
  );
}
