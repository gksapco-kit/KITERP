import './quietDevConsole'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { attachAutoRefreshInterceptor, createAppQueryClient } from '@/lib/queryClient'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { router } from './routes'
import { ConfirmProvider } from './components/common/ConfirmProvider'
import { initGlobalEscapeHandler } from './lib/escapeCloseRegistry'
import { startSessionKeepAlive } from './lib/authSession'
import './styles/globals.css'

initGlobalEscapeHandler()
startSessionKeepAlive()

const queryClient = createAppQueryClient()
attachAutoRefreshInterceptor(apiClient)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
        <Toaster position="top-right" richColors closeButton />
      </ConfirmProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
