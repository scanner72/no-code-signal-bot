import React from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useNotificationStore();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      pointerEvents: 'none'
    }}>
      {toasts.map((t) => {
        let icon = <Info size={18} color="var(--accent-color)" />;
        let bg = 'var(--bg-secondary)';
        let border = '1px solid rgba(99, 102, 241, 0.25)';
        let shadowColor = 'rgba(99, 102, 241, 0.2)';

        if (t.type === 'success') {
          icon = <CheckCircle2 size={18} color="var(--success)" />;
          border = '1px solid rgba(16, 185, 129, 0.25)';
          shadowColor = 'rgba(16, 185, 129, 0.2)';
        } else if (t.type === 'error') {
          icon = <XCircle size={18} color="var(--danger)" />;
          border = '1px solid rgba(239, 68, 68, 0.25)';
          shadowColor = 'rgba(239, 68, 68, 0.2)';
        } else if (t.type === 'warning') {
          icon = <AlertTriangle size={18} color="var(--warning)" />;
          border = '1px solid rgba(245, 158, 11, 0.25)';
          shadowColor = 'rgba(245, 158, 11, 0.2)';
        }

        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              borderRadius: '16px',
              background: bg,
              border: border,
              backdropFilter: 'blur(12px)',
              boxShadow: `0 10px 30px -10px ${shadowColor}`,
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 600,
              minWidth: '280px',
              maxWidth: '420px',
              pointerEvents: 'auto',
              animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              transition: 'var(--transition)'
            }}
          >
            <div style={{ flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1, lineHeight: '1.4' }}>{t.message}</div>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                opacity: 0.6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'var(--transition)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.6';
                e.currentTarget.style.background = 'none';
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
