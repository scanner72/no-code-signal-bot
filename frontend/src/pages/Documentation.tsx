import React, { useState } from 'react';
import docsDataRu from '../assets/docs.json';
import docsDataEn from '../assets/docs_en.json';
import { useLanguageStore } from '../stores/useLanguageStore';

const Documentation: React.FC = () => {
  const { language, t } = useLanguageStore();
  const docsData = language === 'ru' ? docsDataRu : docsDataEn;
  const sections = docsData.sections || [];
  
  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id || '');

  const activeSection = sections.find(s => s.id === activeSectionId) || sections[0];

  return (
    <div style={{ display: 'flex', height: '100%', gap: '24px', overflow: 'hidden', padding: '24px' }}>
      {/* Sidebar Navigation */}
      <div className="bento-card" style={{ width: '280px', flexShrink: 0, padding: '24px', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px', color: 'var(--text-primary)' }}>
          {t('knowledge_base')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSectionId(s.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                transition: 'var(--transition)',
                background: activeSectionId === s.id ? 'var(--accent-color)' : 'transparent',
                color: activeSectionId === s.id ? '#fff' : 'var(--text-secondary)',
                fontWeight: activeSectionId === s.id ? 700 : 500
              }}
              onMouseEnter={(e) => {
                if (activeSectionId !== s.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
              onMouseLeave={(e) => {
                if (activeSectionId !== s.id) e.currentTarget.style.background = 'transparent';
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="bento-card" style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {activeSection ? (
            <>
              <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '32px', color: 'var(--text-primary)' }}>
                {activeSection.title}
              </h1>
              
              <div style={{ 
                fontSize: '15px', color: 'var(--text-secondary)', 
                lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '40px' 
              }}>
                {activeSection.content}
              </div>

              {activeSection.subsections?.map((sub, i) => (
                <div key={i} style={{ marginBottom: '32px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
                    {sub.title}
                  </h3>
                  <div style={{ 
                    fontSize: '14px', color: 'var(--text-secondary)', 
                    lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    padding: '16px', background: 'var(--bg-accent)', borderRadius: '12px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {sub.content}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>{t('select_section')}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Documentation;
