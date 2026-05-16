import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  // Enable with VITE_WATCH_POLLING=1 for Docker bind-mounts; avoid on Windows + OneDrive (very slow).
  const useWatchPolling = env.VITE_WATCH_POLLING === '1'
  const publicBasePath = env.VITE_PUBLIC_BASE_PATH?.trim() || '/'
  const backendUrl = env.BACKEND_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    base: publicBasePath,
    resolve: { alias: { '@': '/src' } },
    server: {
      port: 3002,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      warmup: {
        clientFiles: ['./index.html', './src/main.tsx'],
      },
      ...(useWatchPolling ? { watch: { usePolling: true, interval: 1000 } } : {}),
      // Local dev: localhost. Docker Compose can set BACKEND_URL=http://backend:8000
      proxy: { '/api': { target: backendUrl, changeOrigin: true } },
    },
    preview: {
      port: 3002,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: { '/api': { target: backendUrl, changeOrigin: true } },
    },
  }
})
