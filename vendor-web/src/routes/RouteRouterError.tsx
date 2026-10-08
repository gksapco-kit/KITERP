import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import {
  isChunkLoadError,
  recoverFromChunkLoadError,
  reloadForStaleAssets,
} from '@/lib/lazyRoute'

function errorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return typeof error.data === 'string' ? error.data : error.statusText || 'Route error'
  }
  if (error instanceof Error) return error.message
  return String(error ?? 'Unknown error')
}

export default function RouteRouterError() {
  const error = useRouteError()
  const message = errorMessage(error)
  const chunk = isChunkLoadError(error) || isChunkLoadError(new Error(message))

  useEffect(() => {
    if (!chunk) return
    recoverFromChunkLoadError()
  }, [chunk])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold text-slate-900">
        {chunk ? 'This page could not load' : 'Something went wrong'}
      </h1>
      <p className="max-w-md text-sm text-slate-600">
        {chunk
          ? 'The app was updated while this tab was open. Reload once to fetch the latest version, then open this page again.'
          : message}
      </p>
      <button
        type="button"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        onClick={() => reloadForStaleAssets()}
      >
        Reload page
      </button>
    </div>
  )
}
