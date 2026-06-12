import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StoreRecord } from '@/api/vendor'
import type { StorefrontLinkMode } from '@/lib/liveStorefrontUrl'

const LINK_LABELS: Record<StorefrontLinkMode, { label: string; className: string }> = {
  single: {
    label: 'Single Website for All BUs / Stores',
    className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-300',
  },
  per_unit: {
    label: 'Unique Website Per BU / Store',
    className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/50 dark:text-violet-300',
  },
}

type Props = {
  stores: StoreRecord[]
  activeStore: StoreRecord
  onBack: () => void
  onSelectStore: (store: StoreRecord) => void
  backLabel?: string
  stepLabel?: string
  storefrontLinkMode?: StorefrontLinkMode
  className?: string
}

export function BusinessUnitDetailNav({
  stores,
  activeStore,
  onBack,
  onSelectStore,
  backLabel = '← Back to all units',
  stepLabel = 'Step 1 · Units',
  storefrontLinkMode,
  className,
}: Props) {
  const hasMultiple = stores.length > 1
  const currentIndex = stores.findIndex(s => s.id === activeStore.id)
  const prevStore = currentIndex > 0 ? stores[currentIndex - 1] : null
  const nextStore = currentIndex >= 0 && currentIndex < stores.length - 1 ? stores[currentIndex + 1] : null

  return (
    <div id="settings-units-heading" className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      {stepLabel ? (
        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
          {stepLabel}
        </span>
      ) : null}

      {hasMultiple ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'h-8 border-rose-200 bg-rose-50 text-xs font-medium text-rose-700 shadow-sm',
              'hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800',
              'dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60',
            )}
            onClick={onBack}
          >
            {backLabel}
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-primary/15 bg-primary/5 p-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'h-8 w-8 border-transparent bg-background/80 p-0 text-primary shadow-sm',
                'hover:border-primary/20 hover:bg-primary/10',
                'disabled:bg-muted/50 disabled:text-muted-foreground disabled:opacity-50',
              )}
              disabled={!prevStore}
              onClick={() => prevStore && onSelectStore(prevStore)}
              title={prevStore ? `Previous: ${prevStore.name}` : 'No previous business unit'}
              aria-label={prevStore ? `Previous business unit: ${prevStore.name}` : 'No previous business unit'}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'h-8 w-8 border-transparent bg-background/80 p-0 text-primary shadow-sm',
                'hover:border-primary/20 hover:bg-primary/10',
                'disabled:bg-muted/50 disabled:text-muted-foreground disabled:opacity-50',
              )}
              disabled={!nextStore}
              onClick={() => nextStore && onSelectStore(nextStore)}
              title={nextStore ? `Next: ${nextStore.name}` : 'No next business unit'}
              aria-label={nextStore ? `Next business unit: ${nextStore.name}` : 'No next business unit'}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : null}

      <span className="min-w-0 truncate text-sm font-semibold text-foreground">{activeStore.name}</span>

      {storefrontLinkMode ? (() => {
        const badge = LINK_LABELS[storefrontLinkMode]
        return (
          <div className="ml-auto flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Customer Store Websites
            </span>
            <span
              title="Customer store website mode"
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none',
                badge.className,
              )}
            >
              {badge.label}
            </span>
          </div>
        )
      })() : null}
    </div>
  )
}
