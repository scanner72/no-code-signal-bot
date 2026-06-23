import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import {
  STRATEGY_TEMPLATES,
  CATEGORY_COLORS,
  SIGNAL_COLORS,
  type StrategyTemplate,
} from '../data/strategyTemplates';

interface Props {
  onClose: () => void;
  onLoad: (template: StrategyTemplate) => void;
}

const CATEGORIES = ['Все', 'Тренд', 'Откат', 'Smart Money', 'Импульс', 'Сессия', 'Финансирование', 'Внешние'] as const;
const SIGNALS = ['Все', 'LONG', 'SHORT'] as const;

const StrategyTemplatesModal = ({ onClose, onLoad }: Props) => {
  const [category, setCategory] = useState<string>('Все');
  const [signal, setSignal] = useState<string>('Все');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = STRATEGY_TEMPLATES.filter(t => {
    const catOk = category === 'Все' || t.category === category;
    const sigOk = signal === 'Все' || t.signal === signal;
    return catOk && sigOk;
  });

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: '24px',
        boxShadow: '0 25px 70px rgba(0,0,0,0.5)',
        width: '850px', maxWidth: '95vw',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', border: '1px solid var(--border-color)',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 30px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={18} color="var(--accent-color)" />
              </div>
              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Библиотека стратегий</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>
              {STRATEGY_TEMPLATES.length} готовых шаблонов · Выберите базу для вашего алгоритма
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-accent)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', borderRadius: '10px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div style={{
          padding: '16px 30px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
          flexShrink: 0, background: 'var(--bg-accent)',
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginRight: '8px', letterSpacing: '0.05em' }}>Категория:</span>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              fontSize: '12px', padding: '6px 14px', borderRadius: '10px', cursor: 'pointer',
              border: '1px solid',
              borderColor: category === c ? 'var(--accent-color)' : 'var(--border-color)',
              background: category === c ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: category === c ? '#fff' : 'var(--text-secondary)',
              fontWeight: 700, transition: 'var(--transition)',
            }}>{c}</button>
          ))}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 8px' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginRight: '8px', letterSpacing: '0.05em' }}>Сигнал:</span>
          {SIGNALS.map(s => (
            <button key={s} onClick={() => setSignal(s)} style={{
              fontSize: '12px', padding: '6px 14px', borderRadius: '10px', cursor: 'pointer',
              border: '1px solid',
              borderColor: signal === s ? (s === 'LONG' ? 'var(--success)' : s === 'SHORT' ? 'var(--danger)' : 'var(--accent-color)') : 'var(--border-color)',
              background: signal === s ? (s === 'LONG' ? 'var(--success)' : s === 'SHORT' ? 'var(--danger)' : 'var(--accent-color)') : 'var(--bg-secondary)',
              color: signal === s ? '#fff' : 'var(--text-secondary)',
              fontWeight: 700, transition: 'var(--transition)',
            }}>{s}</button>
          ))}
        </div>

        {/* Cards */}
        <div style={{ overflowY: 'auto', padding: '24px 30px', flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Нет шаблонов по выбранным фильтрам
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {filtered.map(t => {
              const catColors = CATEGORY_COLORS[t.category];
              const sigColors = SIGNAL_COLORS[t.signal];
              const isExpanded = expanded === t.id;

              return (
                <div key={t.id} style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  background: 'var(--bg-secondary)',
                  transition: 'var(--transition)',
                  boxShadow: isExpanded ? '0 10px 30px rgba(0,0,0,0.2)' : 'var(--card-shadow)',
                  display: 'flex', flexDirection: 'column'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  {/* Card top */}
                  <div style={{ padding: '20px', flex: 1 }}>
                    {/* Badges */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 800, padding: '3px 10px', borderRadius: '8px',
                        background: 'var(--bg-accent)', color: 'var(--accent-color)', border: '1px solid var(--border-color)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{t.category}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: 800, padding: '3px 10px', borderRadius: '8px',
                        background: t.signal === 'LONG' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                        color: t.signal === 'LONG' ? 'var(--success)' : 'var(--danger)',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        {t.signal === 'LONG' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {t.signal}
                      </span>
                      <span style={{
                        fontSize: '10px', padding: '3px 10px', borderRadius: '8px',
                        background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)', fontWeight: 700
                      }}>{t.difficulty}</span>
                    </div>

                    {/* Name */}
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.3 }}>
                      {t.name}
                    </div>

                    {/* Pair/TF */}
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 600 }}>
                      <span style={{ color: 'var(--accent-color)' }}>{t.pair}</span> · {t.timeframe} · {t.nodes.length} блоков
                    </div>

                    {/* Description */}
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px', opacity: 0.8 }}>
                      {t.description}
                    </div>

                    {/* Logic expand */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : t.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '12px', color: 'var(--accent-color)', background: 'none',
                        border: 'none', cursor: 'pointer', padding: '0', marginBottom: isExpanded ? '12px' : '0',
                        fontWeight: 700
                      }}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? 'Скрыть логику' : 'Показать логику'}
                    </button>

                    {isExpanded && (
                      <div style={{
                        background: 'var(--bg-accent)', borderRadius: '12px',
                        padding: '12px 16px', marginBottom: '4px', border: '1px solid var(--border-color)'
                      }}>
                        {t.logic.map((line, i) => (
                          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: i < t.logic.length - 1 ? '8px' : 0 }}>
                            <span style={{ color: 'var(--accent-color)', fontWeight: 800, fontSize: '12px', marginTop: '2px', flexShrink: 0 }}>→</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.6, fontWeight: 500 }}>{line}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-accent)',
                    display: 'flex', justifyContent: 'flex-end',
                  }}>
                    <button
                      onClick={() => { onLoad(t); onClose(); }}
                      style={{
                        fontSize: '13px', fontWeight: 800,
                        padding: '8px 20px', borderRadius: '10px',
                        background: 'var(--accent-color)', color: '#fff',
                        border: 'none', cursor: 'pointer',
                        transition: 'var(--transition)',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      Загрузить в конструктор
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        <div style={{
          padding: '14px 30px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-accent)',
          fontSize: '11px', color: 'var(--text-secondary)',
          flexShrink: 0, fontWeight: 500, textAlign: 'center'
        }}>
          Шаблоны — это только база. После загрузки вы можете менять параметры, добавлять условия и запускать бэктест.
        </div>
      </div>
    </div>
  );
};

export default StrategyTemplatesModal;
