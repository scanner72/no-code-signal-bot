import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Computed once when the Vite build process starts, baked into the client
// bundle via `define`, and also emitted as version.json so nginx can serve
// the CURRENT deploy's id at a stable URL for the running app to poll.
const buildId = String(Date.now());

// Injects the build id into the app and writes version.json into the
// build output, so a stale client can detect that a newer deploy exists.
function buildIdPlugin(): Plugin {
  return {
    name: 'build-id-plugin',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), buildIdPlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
  },
});
