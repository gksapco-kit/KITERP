import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 3002,
    strictPort: true,
    /** Dual-stack so `http://localhost:3002` (::1) works on Windows. */
    host: true,
    allowedHosts: true,
    watch: { usePolling: true, interval: 1000 },
    // Local dev: localhost. Docker Compose can set BACKEND_URL=http://backend:8000
    proxy: { '/api': { target: process.env.BACKEND_URL || 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  preview: {
    port: 3002,
    strictPort: true,
    host: true,
    allowedHosts: true,
    proxy: { '/api': { target: process.env.BACKEND_URL || 'http://127.0.0.1:8000', changeOrigin: true } },
  },
})
