import { CSSProperties, useState } from 'react';

const chip: CSSProperties = {
  fontSize: 10, padding: '2px 9px', borderRadius: 6, border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap', cursor: 'pointer',
};
const inputS: CSSProperties = {
  width: '100%', padding: '5px 8px', fontSize: 11, background: 'var(--bg-primary)',
  color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6,
};
const lbl: CSSProperties = { fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 };

// Same brokerage presets as pages/Backtest.tsx (~lines 161-167).
const BROKERAGE_PRESETS: Record<string, { fee: number; slippage: number; latency: number }> = {
  custom: { fee: 0.1, slippage: 0.1, latency: 100 },
  binance: { fee: 0.04, slippage: 0.05, latency: 50 },
  bybit: { fee: 0.05, slippage: 0.06, latency: 60 },
  okx: { fee: 0.05, slippage: 0.07, latency: 80 },
  ib: { fee: 0.12, slippage: 0.10, latency: 150 },
};

// Hoisted to module scope: must not close over `p`/`set` from RunPanel, otherwise
// it gets redefined on every render, React treats it as a new component type,
// and the input remounts on each keystroke — losing focus. See review finding 1.
const F = ({ label, value, onChange, type = 'number', step }: {
  label: string;
  value: any;
  onChange: (v: string | number) => void;
  type?: string;
  step?: string;
}) => (
  <div style={{ flex: 1, minWidth: 110 }}>
    <div style={lbl}>{label}</div>
    <input style={inputS} type={type} step={step} value={value ?? ''} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} />
  </div>
);

interface RunPanelProps {
  strategies: Array<{ id: number; name: string; pair: string; timeframe: string }>;
  selectedStrategyId: string;
  onSelectStrategy: (id: string) => void;
  // Same `form` object/state as pages/Backtest.tsx: start, end, initialBalance,
  // feePercent, tpPercent, slPercent, positionSizePercent, slippagePct, latencyMs,
  // accurate, brokerageModel (+ trailing-stop fields not surfaced here).
  form: any;
  setForm: (updater: (f: any) => any) => void;
  running: boolean;
  progress: number;
  statusText: string;
  onRun: () => void;
  onOpenHistory: () => void;
}

const RunPanel = (p: RunPanelProps) => {
  const [paramsOpen, setParamsOpen] = useState(false);
  const s = p.strategies.find((x) => String(x.id) === p.selectedStrategyId);
  const set = (k: string, v: any) => p.setForm((f: any) => ({ ...f, [k]: v }));

  const applyBrokerPreset = (model: string) => {
    if (model === 'custom') {
      p.setForm((f: any) => ({ ...f, brokerageModel: 'custom' }));
      return;
    }
    const preset = BROKERAGE_PRESETS[model];
    if (!preset) return;
    p.setForm((f: any) => ({
      ...f,
      brokerageModel: model,
      feePercent: preset.fee,
      slippagePct: preset.slippage,
      latencyMs: preset.latency,
    }));
  };

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 10, padding: '8px 12px',
      }}>
        <select value={p.selectedStrategyId} onChange={(e) => p.onSelectStrategy(e.target.value)}
          style={{ ...inputS, width: 260, fontWeight: 700 }}>
          {p.strategies.map((st) => <option key={st.id} value={st.id}>{st.name} ({st.pair})</option>)}
        </select>
        {s && <span style={chip} onClick={() => setParamsOpen(true)}>{s.pair}</span>}
        {s && <span style={chip} onClick={() => setParamsOpen(true)}>{s.timeframe}</span>}
        <span style={chip} onClick={() => setParamsOpen(true)}>{p.form.start} → {p.form.end}</span>
        <span style={chip} onClick={() => setParamsOpen(true)}>${p.form.initialBalance} · TP {p.form.tpPercent}% · SL {p.form.slPercent}%</span>
        {p.form.accurate && <span style={{ ...chip, borderColor: '#2962ff', color: '#79c0ff' }}>⚡ accurate</span>}
        <span style={{ ...chip, borderColor: '#2962ff', color: '#79c0ff' }} onClick={() => setParamsOpen(!paramsOpen)}>⚙ Параметры</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={chip} onClick={p.onOpenHistory}>🕘 История</span>
          {p.running ? (
            <div style={{ width: 200 }}>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden' }}>{p.statusText || 'Выполняется...'}</div>
              <div style={{ background: 'var(--bg-primary)', borderRadius: 4, height: 8 }}>
                <div style={{ width: `${p.progress}%`, height: '100%', background: '#2962ff', borderRadius: 4, transition: 'width .3s' }} />
              </div>
            </div>
          ) : (
            <button onClick={p.onRun} style={{
              background: '#2962ff', color: '#fff', fontWeight: 800, fontSize: 12,
              border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
            }}>▶ Запустить</button>
          )}
        </div>
      </div>

      {paramsOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 55, marginTop: 4,
          background: 'var(--bg-secondary)', border: '1px solid #2962ff', borderRadius: 10,
          padding: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
        }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <F label="Начало" type="date" value={p.form.start} onChange={(v) => set('start', v)} />
            <F label="Конец" type="date" value={p.form.end} onChange={(v) => set('end', v)} />
            <F label="Баланс ($)" value={p.form.initialBalance} onChange={(v) => set('initialBalance', v)} />
            <F label="Take Profit (%)" step="0.1" value={p.form.tpPercent} onChange={(v) => set('tpPercent', v)} />
            <F label="Stop Loss (%)" step="0.1" value={p.form.slPercent} onChange={(v) => set('slPercent', v)} />
            <F label="Размер позиции (%)" value={p.form.positionSizePercent} onChange={(v) => set('positionSizePercent', v)} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 110 }}>
              <div style={lbl}>Брокер</div>
              <select style={inputS} value={p.form.brokerageModel || 'custom'} onChange={(e) => applyBrokerPreset(e.target.value)}>
                <option value="custom">Custom</option>
                <option value="binance">Binance</option>
                <option value="bybit">Bybit</option>
                <option value="okx">OKX</option>
                <option value="ib">Interactive Brokers</option>
              </select>
            </div>
            <F label="Комиссия (%)" step="0.01" value={p.form.feePercent} onChange={(v) => set('feePercent', v)} />
            <F label="Slippage (%)" step="0.01" value={p.form.slippagePct} onChange={(v) => set('slippagePct', v)} />
            <F label="Latency (ms)" value={p.form.latencyMs} onChange={(v) => set('latencyMs', v)} />
            <div style={{ flex: 1, minWidth: 110 }}>
              <div style={lbl}>Алгоритм входа</div>
              <select style={inputS} value={p.form.executionAlgo || 'MARKET'} onChange={(e) => set('executionAlgo', e.target.value)}>
                <option value="MARKET">Market</option>
                <option value="TWAP">TWAP</option>
                <option value="VWAP">VWAP</option>
              </select>
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--text-primary)', paddingBottom: 6 }}>
              <input type="checkbox" checked={!!p.form.accurate} onChange={(e) => set('accurate', e.target.checked)} />
              ⚡ Точный режим (1m суб-свечи) — медленнее, честнее ловит SL
            </label>
            <button onClick={() => setParamsOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 11 }}>Свернуть</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunPanel;
