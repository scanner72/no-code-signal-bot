import React from 'react';
import { X, Book, ExternalLink } from 'lucide-react';
import docsDataRu from '../assets/docs.json';
import docsDataEn from '../assets/docs_en.json';
import { useLanguageStore } from '../stores/useLanguageStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sectionKey?: string;
}

const HelpDrawer: React.FC<Props> = ({ isOpen, onClose, sectionKey = 'general' }) => {
  const { language, t } = useLanguageStore();
  
  if (!isOpen) return null;

  const docsData = language === 'ru' ? docsDataRu : docsDataEn;
  const section = docsData.sections.find(s => s.id === sectionKey) || docsData.sections[0];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '400px',
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border-color)',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
      zIndex: 3000,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      
      {/* Header */}
      <div style={{
        padding: '24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-accent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Book size={20} color="var(--accent-color)" />
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
            {t('help_title')}{section.title}
          </h2>
        </div>
        <button 
          onClick={onClose}
          style={{ 
            background: 'none', border: 'none', color: 'var(--text-secondary)', 
            cursor: 'pointer', padding: '4px', borderRadius: '50%',
            transition: 'var(--transition)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <p style={{ 
          fontSize: '14px', color: 'var(--text-secondary)', 
          lineHeight: 1.6, marginBottom: '24px' 
        }}>
          {section.content}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {section.subsections?.map((sub, i) => (
            <div key={i} style={{
              padding: '16px',
              background: 'var(--bg-accent)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
            }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                {sub.title}
              </h3>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }} dangerouslySetInnerHTML={{ __html: sub.content.replace(/\n/g, '<br/>') }} />
            </div>
          ))}
        </div>

        {sectionKey === 'builder' && docsData.nodes && (
          <div style={{ marginTop: '32px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '16px', color: 'var(--accent-color)' }}>
              {t('node_reference')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(docsData.nodes).slice(0, 15).map(([id, node]: [string, any]) => (
                <div key={id} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{node.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{node.category} • {node.params}</div>
                </div>
              ))}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                {t('and_more')} {Object.keys(docsData.nodes).length - 15} {t('more_nodes_suffix')}
              </div>
            </div>
          </div>
        )}

        <a 
          href="/documentation" 
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginTop: '32px', color: 'var(--accent-color)',
            fontSize: '13px', fontWeight: 700, textDecoration: 'none'
          }}
        >
          {t('open_full_manual')} <ExternalLink size={14} />
        </a>
      </div>

      {/* Footer */}
      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Signal Bot Documentation System v2.0
        </div>
      </div>
    </div>
  );
};

export default HelpDrawer;
