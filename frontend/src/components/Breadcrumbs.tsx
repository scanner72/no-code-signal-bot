import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useStrategyStore } from '../stores/strategyStore';
import { ChevronRight } from 'lucide-react';

const routeLabels: Record<string, { ru: string; en: string }> = {
  dashboard:   { ru: 'Dashboard', en: 'Dashboard' },
  builder:     { ru: 'Конструктор', en: 'Builder' },
  strategies:  { ru: 'Стратегии', en: 'Strategies' },
  backtest:    { ru: 'Бэктест', en: 'Backtest' },
  paper:       { ru: 'Paper Trading', en: 'Paper Trading' },
  signals:     { ru: 'Сигналы', en: 'Signals' },
  fleet:       { ru: 'Ферма ботов', en: 'Bot Fleet' },
  ml:          { ru: 'ML Trainer', en: 'ML Trainer' },
  cross:       { ru: 'Кросс-Биржа', en: 'Cross-Exchange' },
  docs:        { ru: 'Документация', en: 'Documentation' },
  settings:    { ru: 'Настройки', en: 'Settings' },
};

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const strategyName = useStrategyStore(s => s.strategyName);

  const segments = location.pathname.split('/').filter(Boolean);
  if (segments.length === 0) segments.push('dashboard');

  const crumbs: { label: string; path?: string }[] = [];

  segments.forEach((seg, i) => {
    const routeInfo = routeLabels[seg];
    if (routeInfo) {
      const isLast = i === segments.length - 1;
      crumbs.push({
        label: routeInfo[language],
        path: isLast ? undefined : `/${segments.slice(0, i + 1).join('/')}`,
      });
    } else if (seg === 'job' && segments[i + 1]) {
      // skip 'job', handled by next segment
    } else if (segments[i - 1] === 'job') {
      crumbs.push({ label: `Job #${seg}` });
    }
  });

  if (segments[0] === 'builder' && strategyName) {
    crumbs.splice(1, 0, { label: strategyName });
    if (crumbs.length > 2) crumbs[crumbs.length - 1].path = undefined;
  }

  const chevronStyle = { color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 };
  const linkStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
    cursor: 'pointer', textDecoration: 'none',
    transition: 'color 0.15s',
  };
  const activeStyle: React.CSSProperties = {
    ...linkStyle, color: 'var(--text-primary)', cursor: 'default', fontWeight: 700,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={14} style={chevronStyle} />}
          {c.path ? (
            <span
              style={linkStyle}
              onClick={() => navigate(c.path!)}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-color)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              {c.label}
            </span>
          ) : (
            <span style={activeStyle}>{c.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default Breadcrumbs;
