import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  // Dev server proxy: native `npm run dev` -> backend on host :8000.
  // Frontend in Docker must reach the API container (127.0.0.1 inside the frontend container is NOT the backend).
  const apiProxyTarget = env.BACKEND_PROXY_TARGET?.trim() || 'http://127.0.0.1:8000'
  const publicBasePath = env.VITE_PUBLIC_BASE_PATH?.trim() || '/'

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
      host: '0.0.0.0', // Bind to all interfaces (IPv4 and IPv6)
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
