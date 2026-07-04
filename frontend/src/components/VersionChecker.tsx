import React, { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 60_000;

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.buildId === 'string') {
      return data.buildId;
    }
    return null;
  } catch {
    // Missing version.json (older deploy) or network error — silent no-op.
    return null;
  }
}

/**
 * Polls /version.json (emitted by the Vite build) and compares it against
 * the build id baked into this running bundle (__BUILD_ID__). If they
 * differ, a newer version has been deployed — show a banner prompting the
 * user to reload so they don't hit a stale-chunk load failure later.
 */
const VersionChecker: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    // If the build id isn't defined for some reason, never show the banner.
    if (typeof __BUILD_ID__ === 'undefined') {
      return;
    }

    const check = async () => {
      if (stoppedRef.current) return;
      const remoteBuildId = await fetchRemoteBuildId();
      if (remoteBuildId && remoteBuildId !== __BUILD_ID__) {
        setShowBanner(true);
        stoppedRef.current = true; // stop polling once we know we're stale
      }
    };

    check();

    const intervalId = window.setInterval(check, POLL_INTERVAL_MS);
    const onFocus = () => {
      check();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!showBanner || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '14px 20px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        boxShadow: '0 -10px 30px -10px rgba(0, 0, 0, 0.4)',
        color: 'var(--text-primary)',
        fontSize: '13px',
        fontWeight: 600,
      }}
    >
      <span>Доступна новая версия приложения</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#2962ff',
          border: 'none',
          borderRadius: '8px',
          color: '#fff',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Обновить
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Закрыть"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '16px',
          lineHeight: 1,
          padding: '4px',
        }}
      >
        ✕
      </button>
    </div>
  );
};

export default VersionChecker;
