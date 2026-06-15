import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { attachAutoRefreshInterceptor, createAppQueryClient } from '@/lib/queryClient'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from './routes'
import { initGlobalEscapeHandler } from './lib/escapeCloseRegistry'
import './styles/globals.css'
import './checkout/theme.css'

initGlobalEscapeHandler()

const queryClient = createAppQueryClient()
attachAutoRefreshInterceptor(apiClient)

// Debug: Identify which app is running
console.log('%c🚀 STOREFRONT-WEB (Port 3002)', 'color: #3b82f6; font-size: 16px; font-weight: bold;')
console.log('Open http://localhost:3002 — if it fails on Windows Docker, run scripts\\fix-localhost-docker.ps1 as Admin.')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  </React.StrictMode>,
)
