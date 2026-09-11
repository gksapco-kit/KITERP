import './quietDevConsole'
import React, { useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { attachAutoRefreshInterceptor, createAppQueryClient } from '@/lib/queryClient'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { createCustomDomainRouter, router as platformRouter } from './routes'
import { ConfirmProvider } from './components/common/ConfirmProvider'
import { initGlobalEscapeHandler } from './lib/escapeCloseRegistry'
import { CustomHostProvider, useCustomHost } from './contexts/CustomHostContext'
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

function BootSplash({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
      <div className="text-center px-6">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        <p className="text-sm">{message || 'Loading store…'}</p>
      </div>
    </div>
  )
}

function DomainNotConnected({ message }: { message?: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
      <div className="max-w-md text-center px-6">
        <h1 className="text-xl font-semibold mb-2">Domain not connected</h1>
        <p className="text-sm text-slate-600">
          {message || 'This domain is not linked to a KIT ERP storefront yet.'}
        </p>
      </div>
    </div>
  )
}

function StorefrontRouters() {
  const custom = useCustomHost()

  const customRouter = useMemo(() => {
    if (custom.isCustomHost && custom.vendorSlug) {
      return createCustomDomainRouter(custom.vendorSlug)
    }
    return null
  }, [custom.isCustomHost, custom.vendorSlug])

  if (custom.isCustomHost) {
    if (custom.isLoading) return <BootSplash />
    if (!custom.vendorSlug || !customRouter) {
      return <DomainNotConnected message={custom.error} />
    }
    return <RouterProvider router={customRouter} future={{ v7_startTransition: true }} />
  }

  return <RouterProvider router={platformRouter} future={{ v7_startTransition: true }} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <CustomHostProvider>
          <StorefrontRouters />
        </CustomHostProvider>
        <Toaster position="top-right" richColors closeButton />
      </ConfirmProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
