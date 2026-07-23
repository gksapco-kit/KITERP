import './quietDevConsole'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { attachAutoRefreshInterceptor, createAppQueryClient } from '@/lib/queryClient'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from './routes'
import { ConfirmProvider } from './components/common/ConfirmProvider'
import { initGlobalEscapeHandler } from './lib/escapeCloseRegistry'
import './styles/globals.css'
import './checkout/theme.css'

initGlobalEscapeHandler()

// After a deploy, cached index.html can reference removed JS chunks. Reload once;
// a session guard avoids an infinite loop when the chunk is truly missing.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    const key = 'kiterp:sf-chunk-reload'
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      /* private mode / blocked storage */
    }
    window.location.reload()
  })
}

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
