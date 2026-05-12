import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// In Docker the BACKEND_URL env var points to the internal service name.
// When running locally (npm run dev) it falls back to localhost:8000.
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000'
const publicBasePath = process.env.VITE_PUBLIC_BASE_PATH?.trim() || '/'

// Polling is for Docker bind-mounts / network FS. On Windows + OneDrive it makes dev painfully slow.
const useWatchPolling = process.env.VITE_WATCH_POLLING === '1'

export default defineConfig({
  plugins: [react()],
  base: publicBasePath,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@kiterp/home-sections': path.resolve(__dirname, '../storefront-web/src/home-sections'),
      '@kiterp/storefront-theme-colors': path.resolve(__dirname, '../storefront-web/src/lib/themeColors.ts'),
    },
  },
  server: {
    port: 3001,
    strictPort: true,
    /** `true` listens on IPv4 + IPv6 so `http://localhost:3001` (::1) works on Windows; `0.0.0.0` alone often does not. */
    host: true,
    /** Allow Docker / reverse-proxy hostnames (Vite 5+ host check). */
    allowedHosts: true,
    /** Align HMR client port with host port map (e.g. Docker 3001:3001). */
    hmr: { clientPort: 3001 },
    ...(useWatchPolling ? { watch: { usePolling: true, interval: 1000 } } : {}),
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/uploads': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      // FastAPI /health (not under /api/v1) — used by login connectivity check
      '/health': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
})
