import React from 'react';
import { CATEGORIES, getBlocksByCategory } from '../blocks/registry';
import { useLanguageStore } from '../stores/useLanguageStore';

interface SidebarProps {
  isOpen?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const Sidebar = ({ isOpen = false, isPinned = true, onTogglePin, onMouseEnter, onMouseLeave }: SidebarProps) => {
  const { t } = useLanguageStore();
  const [isLocalDragging, setIsLocalDragging] = React.useState(false);

  const onDragStart = (e: React.DragEvent, type: string, data: object) => {
    setIsLocalDragging(true);
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.setData('nodeData', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragEnd = () => {
    setIsLocalDragging(false);
    if (onMouseLeave) {
      onMouseLeave();
    }
  };

  return (
    <aside 
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => {
        if (!isLocalDragging && onMouseLeave) {
          onMouseLeave();
        }
      }}
      style={{
        width: 220, minWidth: 220,
        background: 'rgba(15, 23, 42, 0.93)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-xl)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
        boxShadow: isPinned ? 'var(--card-shadow)' : '0 12px 32px rgba(0,0,0,0.6)',
        position: isPinned ? 'relative' : 'absolute',
        left: 0, top: 0, bottom: 0,
        height: '100%',
        zIndex: 1000,
        transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, width 0.25s ease',
        transform: (isPinned || isOpen) ? 'translateX(0)' : 'translateX(-100%)',
        opacity: (isPinned || isOpen) ? 1 : 0,
        pointerEvents: (isPinned || isOpen) ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 800,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
        }}>
          {t('node_library')}
        </div>
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            title={isPinned ? t('unpin_panel') : t('pin_panel')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isPinned ? 'var(--accent-color)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: 4,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = isPinned ? 'var(--accent-color)' : 'var(--text-muted)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isPinned ? 'rotate(45deg)' : 'none', transition: 'all 0.2s' }}>
              <line x1="12" y1="17" x2="12" y2="22"></line>
              <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.55A2 2 0 0 1 15 9.24V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.24a2 2 0 0 1-.78 1.21L5.44 14a2 2 0 0 0-.44 1.24z"></path>
            </svg>
          </button>
        )}
      </div>

      {/* Sections */}
      <div style={{ padding: '8px 8px', flex: 1 }}>
        {CATEGORIES.map((category) => {
          const items = getBlocksByCategory(category);
          if (items.length === 0) return null;
          return (
          <div key={category} style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 10, color: 'var(--text-secondary)',
              letterSpacing: '0.06em',
              padding: '4px 10px 6px',
              textTransform: 'uppercase' as const,
              fontWeight: 800,
            }}>
              {t(category)}
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className="node-chip"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'grab', fontSize: 13,
                  color: 'var(--text-primary)',
                  marginBottom: 2,
                  border: '1px solid transparent',
                  userSelect: 'none' as const,
                  transition: 'all 0.15s ease',
                  fontWeight: 500,
                }}
                draggable
                onDragStart={(e) => onDragStart(e, item.type, item.defaultData)}
                onDragEnd={onDragEnd}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-accent)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: item.dotColor, flexShrink: 0,
                  boxShadow: `0 0 6px ${item.dotColor}60`,
                }} />
                {t(item.id) || item.name}
              </div>
            ))}
          </div>
        )})}
      </div>
    </aside>
  );
};

export default Sidebar;
