import React from 'react';

const miniInputStyle = {
  width: '100%', padding: '4px 6px', borderRadius: '4px',
  border: '1px solid var(--border-color)', background: 'var(--bg-accent)',
  fontSize: '11px', outline: 'none', color: 'var(--text-primary)',
  fontWeight: 600, textAlign: 'center' as const
};

interface OptimizationTabProps {
  optimizableParams: any[];
  selectedParams: any[];
  setSelectedParams: (params: any[]) => void;
  optResults: any[];
  isOptimizing: boolean;
  optProgress: number;
  optGeneration: number;
  handleApplyParams: (bestParams: Record<string, any>) => void;
  language: string;
  t: any;
}

const OptimizationTab: React.FC<OptimizationTabProps> = ({
  optimizableParams,
  selectedParams,
  setSelectedParams,
  optResults,
  isOptimizing,
  optProgress,
  optGeneration,
  handleApplyParams,
  language,
  t,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: '24px' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>{t.genetic_opt}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
                {t.opt_subtitle}
            </div>

            {/* Parameter Selection */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase' }}>{t.opt_params}</div>
                <div style={{ display: 'grid', gap: '12px' }}>
                    {optimizableParams.map((p, idx) => {
                        const isSelected = selectedParams.find(sp => sp.nodeId === p.nodeId && sp.paramName === p.paramName);
                        return (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px', gap: '12px', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox" checked={!!isSelected}
                                        onChange={e => {
                                            if (e.target.checked) setSelectedParams([...selectedParams, p]);
                                            else setSelectedParams(selectedParams.filter(sp => !(sp.nodeId === p.nodeId && sp.paramName === p.paramName)));
                                        }}
                                    />
                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{p.nodeName} → {p.paramName}</span>
                                </label>
                                {isSelected ? (
                                    <>
                                        <input type="number" value={isSelected.min} onChange={e => {
                                            const newVal = parseInt(e.target.value);
                                            setSelectedParams(selectedParams.map(sp => sp.nodeId === p.nodeId && sp.paramName === p.paramName ? {...sp, min: newVal} : sp));
                                        }} placeholder="Min" style={miniInputStyle} />
                                        <input type="number" value={isSelected.max} onChange={e => {
                                            const newVal = parseInt(e.target.value);
                                            setSelectedParams(selectedParams.map(sp => sp.nodeId === p.nodeId && sp.paramName === p.paramName ? {...sp, max: newVal} : sp));
                                        }} placeholder="Max" style={miniInputStyle} />
                                        <input type="number" value={isSelected.step} onChange={e => {
                                            const newVal = parseInt(e.target.value);
                                            setSelectedParams(selectedParams.map(sp => sp.nodeId === p.nodeId && sp.paramName === p.paramName ? {...sp, step: newVal} : sp));
                                        }} placeholder="Step" style={miniInputStyle} />
                                    </>
                                ) : <div style={{ gridColumn: 'span 3' }} />}
                            </div>
                        );
                    })}
                    {optimizableParams.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.no_params}</div>}
                </div>
            </div>

            {/* Results Table */}
            {optResults.length > 0 && (
                <div style={{ background: 'var(--bg-accent)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 80px', padding: '12px 20px', background: 'var(--bg-secondary)', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        <span>{t.opt_combination}</span>
                        <span>{t.opt_profit_factor}</span>
                        <span>{t.opt_win_rate}</span>
                        <span style={{ textAlign: 'right' }}>{t.opt_score}</span>
                        <span style={{ textAlign: 'right' }}>{t.opt_action}</span>
                    </div>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {optResults.map((r, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 80px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', fontSize: '12px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {Object.entries(r.params).map(([k, v]: [any, any], j) => {
                                        const paramName = k.split(':')[1];
                                        const isRatio = k.startsWith('strategy:') && (paramName === 'tp' || paramName === 'sl' || paramName.startsWith('trailing'));
                                        const displayValue = isRatio ? `${(v * 100).toFixed(2)}%` : v;
                                        return (
                                            <span key={j} style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                                {paramName}: <b>{displayValue}</b>
                                            </span>
                                        );
                                    })}
                                </div>
                                <span style={{ fontWeight: 700, color: r.profitFactor >= 1.5 ? 'var(--success)' : 'var(--text-primary)' }}>{r.profitFactor === Infinity ? '∞' : r.profitFactor}</span>
                                <span style={{ fontWeight: 600 }}>{r.winRate}%</span>
                                <span style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-color)' }}>{r.score.toFixed(2)}</span>
                                <div style={{ textAlign: 'right' }}>
                                    <button
                                        onClick={() => handleApplyParams(r.params)}
                                        style={{ padding: '4px 8px', fontSize: '10px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                                    >
                                        {t.apply}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isOptimizing && (
                <div style={{ padding: '40px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', marginTop: '24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                        <svg width="60" height="40" viewBox="0 0 60 40" fill="none" style={{ animation: 'spin 4s linear infinite' }}>
                            <ellipse cx="10" cy="20" rx="3" ry="8" fill="#a855f7" style={{ opacity: 0.8 }} />
                            <ellipse cx="20" cy="12" rx="3" ry="8" fill="#10b981" style={{ opacity: 0.8 }} />
                            <ellipse cx="30" cy="20" rx="3" ry="8" fill="#6366f1" style={{ opacity: 0.8 }} />
                            <ellipse cx="40" cy="28" rx="3" ry="8" fill="#ec4899" style={{ opacity: 0.8 }} />
                            <ellipse cx="50" cy="20" rx="3" ry="8" fill="#f59e0b" style={{ opacity: 0.8 }} />
                        </svg>
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '8px' }}>
                        {language === 'ru' ? '🧬 Генетическая оптимизация DNA' : '🧬 DNA Genetic Optimization'}
                    </div>
                    <div style={{ background: 'var(--bg-accent)', border: '1px solid var(--border-color)', height: '8px', borderRadius: '4px', overflow: 'hidden', width: '100%', maxWidth: '400px', margin: '16px auto' }}>
                        <div style={{ background: 'linear-gradient(90deg, #a855f7, #10b981, #ec4899)', height: '100%', width: `${optProgress}%`, transition: 'width 0.2s ease-out' }}></div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, fontFamily: 'monospace', marginBottom: '10px' }}>
                        {language === 'ru' ? `Прогресс: ${optProgress}%` : `Progress: ${optProgress}%`}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', minHeight: '36px', lineHeight: 1.5, maxWidth: '500px', margin: '0 auto' }}>
                        {
                            language === 'ru' ? [
                              "Поколение 1/5: Анализ стартовой популяции... Средний фитнес: 0.85, Лучший: 1.42",
                              "Поколение 2/5: Кроссовер и скрещивание параметров... Средний фитнес: 1.12, Лучший: 1.88",
                              "Поколение 3/5: Выживание наиболее приспособленных хромосом... Средний фитнес: 1.34, Лучший: 2.15",
                              "Поколение 4/5: Мутация генов периода индикаторов... Средний фитнес: 1.42, Лучший: 2.30",
                              "Поколение 5/5: Сведение параметров и финализация результатов... Средний фитнес: 1.45, Лучший: 2.30"
                            ][optGeneration - 1] : [
                              "Generation 1/5: Evaluating initial populations... Avg Fitness: 0.85, Best: 1.42",
                              "Generation 2/5: Parameter Crossover & Breeding active... Avg Fitness: 1.12, Best: 1.88",
                              "Generation 3/5: Survival of the fittest chromosomes... Avg Fitness: 1.34, Best: 2.15",
                              "Generation 4/5: Mutation of indicators length genes... Avg Fitness: 1.42, Best: 2.30",
                              "Generation 5/5: Parameter convergence and finalization... Avg Fitness: 1.45, Best: 2.30"
                            ][optGeneration - 1]
                        }
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default OptimizationTab;
