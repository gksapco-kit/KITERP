import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  // Dev server proxy: native `npm run dev` -> backend on host :8000.
  // Frontend in Docker must reach the API container (127.0.0.1 inside the frontend container is NOT the backend).
  const apiProxyTarget = env.BACKEND_PROXY_TARGET?.trim() || 'http://127.0.0.1:8000'
  const publicBasePath = env.VITE_PUBLIC_BASE_PATH?.trim() || '/'
  // Enable with VITE_WATCH_POLLING=1 for Docker bind-mounts; avoid on Windows + OneDrive (very slow).
  const useWatchPolling = env.VITE_WATCH_POLLING === '1'

  return {
    plugins: [react()],
    base: publicBasePath,
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      port: 3000,
      strictPort: true,
      /** Dual-stack on Windows; prefer http://127.0.0.1:3000 if localhost hangs. */
      host: true,
      allowedHosts: true,
      hmr: { clientPort: 3000 },
      warmup: {
        clientFiles: ['./index.html', './src/main.tsx'],
      },
      ...(useWatchPolling ? { watch: { usePolling: true, interval: 1000 } } : {}),
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
