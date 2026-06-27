import React from 'react';
import { createPortal } from 'react-dom';
import { useLanguageStore } from '../stores/useLanguageStore';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsHelp: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useLanguageStore();

  if (!isOpen) return null;

  const sections = [
    {
      title: t('sh_global'),
      shortcuts: [
        { keys: ['Ctrl', 'K'], desc: t('sh_command_palette') },
        { keys: ['Ctrl', 'Shift', 'N'], desc: t('sh_new_strategy') },
        { keys: ['?'], desc: t('sh_this_help') },
      ],
    },
    {
      title: t('sh_builder'),
      shortcuts: [
        { keys: ['Ctrl', 'S'], desc: t('sh_save') },
        { keys: ['Ctrl', 'L'], desc: t('sh_auto_layout') },
        { keys: ['Ctrl', 'C'], desc: t('sh_copy_nodes') },
        { keys: ['Ctrl', 'V'], desc: t('sh_paste_nodes') },
        { keys: ['Ctrl', 'G'], desc: t('sh_group_nodes') },
        { keys: ['Del'], desc: t('sh_delete_node') },
      ],
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
          width: 420, background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 16, padding: 24,
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{t('sh_title')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
            }}>
              {section.title}
            </div>
            {section.shortcuts.map((s, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.desc}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {s.keys.map((k, j) => (
                    <kbd key={j} style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 5,
                      background: 'var(--bg-accent)', color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)', fontWeight: 600,
                      fontFamily: 'system-ui',
                    }}>{k}</kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8, opacity: 0.6 }}>
          {t('sh_press_esc')}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ShortcutsHelp;
