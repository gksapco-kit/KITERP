import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared error state for analytics tabs. Without it a failed request renders as
 * empty "no data" screens, which hides real failures from the user.
 */
export function TabError({
  title = 'This report could not be loaded',
  onRetry,
  isFetching = false,
}: {
  title?: string
  onRetry: () => void
  isFetching?: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-gray-500">The request failed. Check your connection and retry.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /> Retry
      </button>
    </div>
  )
}
