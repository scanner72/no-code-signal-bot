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
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null);
  const categoryScrollRef = React.useRef<HTMLDivElement>(null);
  const sectionListRef = React.useRef<HTMLDivElement>(null);

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

  // Filter blocks by search query
  const filteredBlocks = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    const allBlocks: any[] = [];
    CATEGORIES.forEach(cat => {
      allBlocks.push(...getBlocksByCategory(cat));
    });

    return allBlocks.filter(block => {
      const matchSearch = !query ||
        block.name.toLowerCase().includes(query) ||
        (block.description || '').toLowerCase().includes(query) ||
        (t(block.id) || block.name).toLowerCase().includes(query);

      const matchCategory = !selectedCategory || block.category === selectedCategory;

      return matchSearch && matchCategory;
    });
  }, [searchQuery, selectedCategory, t]);

  // Group filtered blocks by category for display
  const groupedBlocks = React.useMemo(() => {
    return CATEGORIES.map(category => ({
      category,
      blocks: filteredBlocks.filter(b => b.category === category)
    })).filter(group => group.blocks.length > 0);
  }, [filteredBlocks]);

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
        overflow: 'hidden',
        boxShadow: isPinned ? 'var(--card-shadow)' : '0 12px 32px rgba(0,0,0,0.6)',
        position: isPinned ? 'relative' : 'absolute',
        left: 0, top: 0, bottom: 0,
        height: '100%',
        maxHeight: '100vh',
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
        <div
          onClick={() => { setExpandedCategory(null); setSelectedCategory(null); sectionListRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
          style={{
            fontSize: 10, fontWeight: 800,
            color: expandedCategory ? 'var(--accent-color)' : 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-color)'}
          onMouseLeave={e => e.currentTarget.style.color = expandedCategory ? 'var(--accent-color)' : 'var(--text-muted)'}
        >
          {expandedCategory ? `← ${t('node_library')}` : t('node_library')}
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

      {/* Search Box */}
      <div style={{ padding: '8px 8px', marginBottom: '8px' }}>
        <input
          type="text"
          placeholder="Search blocks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search blocks"
          style={{
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--bg-accent)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
            boxSizing: 'border-box' as const,
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-color)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
      </div>

      {/* Category Tabs */}
      {groupedBlocks.length > 1 && (
        <div
          ref={categoryScrollRef}
          style={{
            padding: '4px 8px 8px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                padding: 'var(--space-1) var(--space-2)',
                border: '1px solid var(--accent-color)',
                background: 'rgba(124, 58, 237, 0.15)',
                color: 'var(--accent-color)',
                fontSize: 'var(--font-size-xs)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
                transition: 'all 0.2s',
                fontWeight: 700,
              }}
            >
              ← All ({filteredBlocks.length})
            </button>
          )}
          {groupedBlocks.map(group => (
            <button
              key={group.category}
              onClick={() => setSelectedCategory(
                selectedCategory === group.category ? null : group.category
              )}
              style={{
                padding: 'var(--space-1) var(--space-2)',
                border: selectedCategory === group.category ? '1px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.08)',
                background: selectedCategory === group.category ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                color: selectedCategory === group.category ? 'var(--accent-color)' : 'var(--text-primary)',
                fontSize: 'var(--font-size-xs)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
                transition: 'all 0.2s',
                fontWeight: selectedCategory === group.category ? 700 : 500,
              }}
            >
              {t(group.category)} ({group.blocks.length})
            </button>
          ))}
        </div>
      )}

      {/* Sections */}
      <div ref={sectionListRef} style={{ padding: '8px 8px', flex: 1, overflowY: 'auto' }}>
        {filteredBlocks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-6)',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}>
            No blocks found
          </div>
        ) : (
          groupedBlocks.map((group) => {
            const isExpanded = expandedCategory === null || expandedCategory === group.category;
            return (
            <div key={group.category} style={{ marginBottom: isExpanded ? 12 : 4 }}>
              <div
                onClick={() => {
                  setExpandedCategory(expandedCategory === group.category ? null : group.category);
                  sectionListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: expandedCategory === group.category ? 'var(--accent-color)' : 'var(--text-secondary)',
                  letterSpacing: '0.06em',
                  padding: '6px 10px',
                  textTransform: 'uppercase' as const,
                  fontWeight: 800,
                  cursor: 'pointer',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-accent)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>{t(group.category)} ({group.blocks.length})</span>
                <span style={{ fontSize: 10, opacity: 0.5 }}>{isExpanded ? '▼' : '▶'}</span>
              </div>
              {isExpanded && group.blocks.map((item) => (
                <div
                  key={item.id}
                  className="node-chip"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'grab', fontSize: 'var(--font-size-sm)',
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
                  role="button"
                  tabIndex={0}
                  aria-label={`Add ${item.name} node`}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-accent)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onDragStart(e as any, item.type, item.defaultData);
                    }
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: item.dotColor, flexShrink: 0,
                    boxShadow: `0 0 6px ${item.dotColor}60`,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div>{t(item.id) || item.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );})
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
