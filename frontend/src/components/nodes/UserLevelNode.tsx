import React, { memo, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeInlineParams } from './NodeInlineParams';
import { PORT } from './nodeStyles';
import { useChartSyncStore } from '../../stores/useChartSyncStore';
import { useLanguageStore } from '../../stores/useLanguageStore';

const UserLevelNode = ({ data, selected, id }: any) => {
  const { t } = useLanguageStore();
  const registerLevel = useChartSyncStore((state) => state.registerLevel);
  const unregisterLevel = useChartSyncStore((state) => state.unregisterLevel);

  useEffect(() => {
    registerLevel(id, {
      id,
      label: data.name || `Level ${id.substring(0, 4)}`,
      price: data.params?.price ?? 50000,
      color: '#6366f1',
    });
    return () => unregisterLevel(id);
  }, [id, data.params?.price, data.name, registerLevel, unregisterLevel]);
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${selected ? 'var(--accent-color)' : 'var(--border-color)'}`,
      borderRadius: '14px',
      padding: '12px',
      minWidth: '190px',
      color: 'var(--text-primary)',
      boxShadow: selected ? '0 0 16px rgba(99,102,241,0.2)' : 'var(--shadow-sm)',
      transition: 'all 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ padding: '4px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
        </div>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('user_chart_level')}</div>
      </div>

      <>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            {t('user_chart_level')}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {t('binding')} <b>{data.params?.levelId === 0 ? t('last_level') : `ID: ${data.params?.levelId}`}</b>
          </div>
        </>
      

      <Handle type="source" position={Position.Right} style={PORT('var(--accent-color)')} />
    </div>
  );
};

export default memo(UserLevelNode);
