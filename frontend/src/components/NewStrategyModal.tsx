import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useUiStore } from '../stores/uiStore';
import { PencilRuler, FileCode, LayoutTemplate, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const NewStrategyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const { setTemplatesOpen } = useUiStore();

  if (!isOpen) return null;

  const cards = [
    {
      id: 'scratch',
      icon: <PencilRuler size={28} />,
      title: t('ns_from_scratch'),
      desc: t('ns_scratch_desc'),
      gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
      action: () => { onClose(); window.open('/builder', '_blank'); },
    },
    {
      id: 'template',
      icon: <LayoutTemplate size={28} />,
      title: t('ns_from_template'),
      desc: t('ns_template_desc'),
      gradient: 'linear-gradient(135deg, #10b981, #14b8a6)',
      action: () => { onClose(); setTemplatesOpen(true); window.open('/builder', '_blank'); },
    },
    {
      id: 'pine',
      icon: <FileCode size={28} />,
      title: t('ns_from_pine'),
      desc: t('ns_pine_desc'),
      gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
      action: () => { onClose(); navigate('/pine-import'); },
    },
  ];

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560, background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 20, padding: 28,
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{t('ns_title')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t('ns_subtitle')}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {cards.map(c => (
            <div
              key={c.id}
              onClick={c.action}
              style={{
                flex: 1, padding: 20, borderRadius: 14, cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-accent)',
                transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-color)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: c.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
              }}>
                {c.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NewStrategyModal;
