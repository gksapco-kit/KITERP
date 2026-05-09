import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Dev server proxy: native `npm run dev` → backend on host :8000.
// Frontend in Docker must reach the API container (127.0.0.1 inside the frontend container is NOT the backend).
const apiProxyTarget = process.env.BACKEND_PROXY_TARGET?.trim() || 'http://127.0.0.1:8000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
})
