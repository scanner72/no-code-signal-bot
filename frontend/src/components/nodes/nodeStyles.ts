import type { CSSProperties } from 'react';

export const nodeWrap = (selected?: boolean): CSSProperties => ({
  position: 'relative',
  background: 'var(--bg-primary)',
  borderRadius: '14px',
  minWidth: '240px',
  overflow: 'visible',
  border: selected ? '2px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.15)',
  boxShadow: selected
    ? '0 10px 40px rgba(0,0,0,0.6), 0 0 0 3px rgba(99,102,241,0.2)'
    : '0 8px 32px rgba(0,0,0,0.5)',
  cursor: 'move',
  userSelect: 'none',
  transition: 'all 0.2s ease',
});

export const nodeHead: CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export const nodeIcon = (bg: string): CSSProperties => ({
  width: 22, height: 22,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: bg,
  flexShrink: 0,
});

export const nodeDot = (color: string): CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: color,
  flexShrink: 0,
  boxShadow: `0 0 6px ${color}60`,
});

export const nodeType = (color: string): CSSProperties => ({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: color,
});

export const nodeBody: CSSProperties = {
  padding: '12px 14px',
};

export const nodeParam: CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
  marginBottom: 2,
};

export const nodeParamVal: CSSProperties = {
  color: 'var(--text-primary)',
  fontWeight: 600,
};

export const PORT = (color: string): CSSProperties => ({
  width: 12,
  height: 12,
  background: color,
  border: '2px solid var(--bg-primary)',
  borderRadius: '50%',
  zIndex: 100,
});
