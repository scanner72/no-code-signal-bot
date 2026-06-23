import React, { useState } from 'react';

interface HelpTooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({ text, position = 'top' }) => {
  const [visible, setVisible] = useState(false);

  const posStyles: Record<string, React.CSSProperties> = {
    top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px' },
    bottom: { top: '100%',   left: '50%', transform: 'translateX(-50%)', marginTop: '6px' },
    left:   { right: '100%', top: '50%',  transform: 'translateY(-50%)', marginRight: '6px' },
    right:  { left: '100%',  top: '50%',  transform: 'translateY(-50%)', marginLeft: '6px' },
  };

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span style={{
        width: 14, height: 14, borderRadius: '50%',
        background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)',
        color: '#a78bfa', fontSize: 9, fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'help', flexShrink: 0,
      }}>?</span>

      {visible && (
        <span style={{
          position: 'absolute',
          ...posStyles[position],
          zIndex: 1000,
          background: 'rgba(15,15,20,0.97)',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: '8px',
          padding: '7px 10px',
          fontSize: '11px',
          fontWeight: 500,
          color: '#e2e8f0',
          lineHeight: 1.5,
          maxWidth: '220px',
          whiteSpace: 'normal' as any,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  );
};

export default HelpTooltip;
