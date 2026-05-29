import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const EMBED_BASE = '/website-builder-app/'
const VENDOR_PUBLIC_EMBED = path.resolve(__dirname, '../vendor-web/public/website-builder-app')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const backendUrl = env.BACKEND_URL || 'http://127.0.0.1:8000'
  const embedded = env.VITE_EMBED !== '0' || mode === 'embed'
  const middlewareMode = env.VITE_MIDDLEWARE_MODE === '1'
  const useWatchPolling = env.VITE_WATCH_POLLING === '1'
  const embedBuild = mode === 'embed'

  return {
    plugins: [react(), tailwindcss()],
    base: embedded ? EMBED_BASE : '/',
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: middlewareMode
      ? {
          middlewareMode: true,
          ...(useWatchPolling ? { watch: { usePolling: true, interval: 1000 } } : {}),
        }
      : {
          port: Number(env.VITE_DEV_PORT) || 5174,
          strictPort: true,
          host: true,
          allowedHosts: true,
          ...(useWatchPolling ? { watch: { usePolling: true, interval: 1000 } } : {}),
          proxy: {
            '/api': { target: backendUrl, changeOrigin: true },
            '/uploads': { target: backendUrl, changeOrigin: true },
          },
        },
    preview: {
      port: Number(env.VITE_DEV_PORT) || 5174,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    build: {
      outDir: embedBuild ? VENDOR_PUBLIC_EMBED : env.VITE_EMBED_OUT_DIR || 'dist',
      emptyOutDir: true,
    },
  }
})
