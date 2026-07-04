import React from 'react';

const CHUNK_ERROR_PATTERN = /Loading chunk|dynamically imported module|Importing a module script failed|ChunkLoadError/i;

const AUTO_RELOAD_FLAG = 'chunk-error-auto-reloaded';

interface State {
  hasChunkError: boolean;
  hasGenericError: boolean;
}

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_ERROR_PATTERN.test(message);
}

/**
 * Catches lazy-route chunk load failures (stale index.html referencing JS
 * chunks that no longer exist after a redeploy) and prompts the user to
 * reload. Non-chunk errors fall back to a generic "something went wrong"
 * screen rather than being silently swallowed.
 */
class ChunkErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasChunkError: false, hasGenericError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    if (isChunkLoadError(error)) {
      return { hasChunkError: true, hasGenericError: false };
    }
    return { hasChunkError: false, hasGenericError: true };
  }

  componentDidCatch(error: unknown): void {
    if (isChunkLoadError(error)) {
      // Avoid an infinite reload loop: only auto-reload once per session.
      let alreadyAutoReloaded = false;
      try {
        alreadyAutoReloaded = sessionStorage.getItem(AUTO_RELOAD_FLAG) === '1';
      } catch {
        // sessionStorage unavailable — fall through to manual prompt.
      }

      if (!alreadyAutoReloaded) {
        try {
          sessionStorage.setItem(AUTO_RELOAD_FLAG, '1');
        } catch {
          // ignore — worst case we just show the manual prompt again
        }
        // Prefer the manual prompt (safer) over a silent auto-reload; we
        // still render the button-based UI below rather than reloading
        // automatically here.
      }
    } else {
      // Not a chunk error — log it so real bugs aren't hidden silently.
      // eslint-disable-next-line no-console
      console.error('ChunkErrorBoundary caught a non-chunk error:', error);
    }
  }

  render() {
    if (this.state.hasChunkError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            background: 'var(--bg-primary, #0b0d11)',
            color: 'var(--text-primary, #E4E6EB)',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            Приложение обновилось — перезагрузите страницу
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#2962ff',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Обновить
          </button>
        </div>
      );
    }

    if (this.state.hasGenericError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            background: 'var(--bg-primary, #0b0d11)',
            color: 'var(--text-primary, #E4E6EB)',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 700 }}>Что-то пошло не так</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#2962ff',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Обновить
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChunkErrorBoundary;
