/// <reference types="vite/client" />

// Baked into the client bundle at build time via `define` in vite.config.ts.
// Used by VersionChecker to detect a stale bundle after a redeploy.
declare const __BUILD_ID__: string;
