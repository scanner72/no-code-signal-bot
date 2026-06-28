import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCode, ArrowRight } from 'lucide-react';
import { parsePineScript } from '../utils/pineParser';
import { toast } from '../stores/notificationStore';
import { useLanguageStore } from '../stores/useLanguageStore';

const PineImport: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const convert = () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      const parsed = parsePineScript(code);
      if (!parsed.nodes.length) {
        toast.error('Не удалось распарсить Pine Script — проверьте синтаксис');
        setBusy(false);
        return;
      }

      const r = parsed.report;
      const nodesCount = parsed.nodes.length;
      const indList = r.indicators.length > 0 ? r.indicators.join(', ') : '—';
      const sigList = r.signals.length > 0 ? r.signals.join(', ') : '—';

      if (r.quality === 'full') {
        toast.success(`Импорт: ${nodesCount} нод (${r.qualityPercent}%). Индикаторы: ${indList}. Сигналы: ${sigList}`);
      } else if (r.quality === 'partial') {
        toast.warning(`Импорт: ${nodesCount} нод (${r.qualityPercent}%). Индикаторы: ${indList}. ${r.warnings.length > 0 ? 'Пропущено: ' + r.warnings.slice(0, 3).join('; ') : ''}`);
      } else {
        toast.error(`Парсер не распознал индикаторы — скрипт помещён в Custom Code. ${r.warnings.slice(0, 2).join('; ')}`);
      }

      // Open the freshly parsed graph in the builder
      navigate('/builder', {
        state: {
          strategy: {
            name: 'PineScript Import',
            nodes: parsed.nodes,
            edges: parsed.edges,
          },
        },
      });
    } catch (e: any) {
      toast.error(`Ошибка конвертации: ${e?.message || e}`);
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          <FileCode size={22} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{t('import_pine_script')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{t('import_pine_desc')}</div>
        </div>
      </div>

      <textarea
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="//@version=5&#10;indicator(...)&#10;rsi = ta.rsi(close, 14)&#10;..."
        style={{
          width: '100%', height: 380, marginTop: 24, padding: 16,
          fontFamily: 'monospace', fontSize: 13,
          background: '#0f172a', color: '#cbd5e1',
          border: '1px solid var(--border-color)', borderRadius: 12,
          resize: 'vertical', outline: 'none',
        }}
      />

      <button
        disabled={!code.trim() || busy}
        onClick={convert}
        style={{
          marginTop: 24, width: '100%', padding: '14px 0',
          background: code.trim() && !busy ? 'var(--accent-color)' : 'var(--bg-accent)',
          color: code.trim() && !busy ? '#fff' : 'var(--text-secondary)',
          border: 'none', borderRadius: 12, cursor: code.trim() && !busy ? 'pointer' : 'default',
          fontSize: 14, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'opacity 0.15s',
        }}
      >
        {busy ? t('executing') : t('convert_to_nodes')} <ArrowRight size={16} />
      </button>

      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {t('pine_import_hint')}
      </div>
    </div>
  );
};

export default PineImport;
