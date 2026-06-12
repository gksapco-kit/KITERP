import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { StorefrontLinkMode } from '@/lib/liveStorefrontUrl'

const CONFIRM_PHRASE = 'UPDATE'

const OPTIONS = [
  {
    id: 'single' as const,
    label: 'Single Website for All BUs / Stores',
    shortLabel: 'Single website',
    description:
      'Every business unit shares one customer storefront URL. Branch filters are not added to public links.',
    selectedClass:
      'cursor-default border-sky-200 bg-sky-50 text-sky-900 shadow-sm ring-1 ring-sky-300/80 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-100 dark:ring-sky-800/60',
    idleClass: 'text-muted-foreground hover:bg-sky-50/60 hover:text-sky-800 dark:hover:bg-sky-950/30',
  },
  {
    id: 'per_unit' as const,
    label: 'Unique Website Per BU / Store',
    shortLabel: 'Unique per BU',
    description:
      'Each business unit gets its own customer storefront URL with a branch filter (?branch=) for that outlet.',
    selectedClass:
      'cursor-default border-violet-200 bg-violet-50 text-violet-900 shadow-sm ring-1 ring-violet-300/80 dark:border-violet-900/50 dark:bg-violet-950/50 dark:text-violet-100 dark:ring-violet-800/60',
    idleClass: 'text-muted-foreground hover:bg-violet-50/60 hover:text-violet-800 dark:hover:bg-violet-950/30',
  },
] satisfies {
  id: StorefrontLinkMode
  label: string
  shortLabel: string
  description: string
  selectedClass: string
  idleClass: string
}[]

type Props = {
  mode: StorefrontLinkMode
  onConfirm: (mode: StorefrontLinkMode) => void
  pending?: boolean
}

export function StorefrontLinkModeToggle({ mode, onConfirm, pending }: Props) {
  const [pendingMode, setPendingMode] = useState<StorefrontLinkMode | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const pendingOption = OPTIONS.find(o => o.id === pendingMode)
  const currentOption = OPTIONS.find(o => o.id === mode)
  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_PHRASE && !pending

  const openConfirm = (next: StorefrontLinkMode) => {
    if (next === mode || pending) return
    setPendingMode(next)
    setConfirmText('')
  }

  const closeConfirm = () => {
    setPendingMode(null)
    setConfirmText('')
  }

  const handleConfirm = () => {
    if (!pendingMode || !canConfirm) return
    onConfirm(pendingMode)
    closeConfirm()
  }

  return (
    <>
      <div className="flex shrink-0 flex-col items-start gap-1 lg:items-end">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Customer store websites
        </span>
        <div
          className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
          role="group"
          aria-label="Customer storefront website link mode"
        >
          {OPTIONS.map(opt => {
            const isSelected = mode === opt.id
            return (
            <button
              key={opt.id}
              type="button"
              disabled={pending}
              onClick={() => {
                if (!isSelected) openConfirm(opt.id)
              }}
              aria-pressed={isSelected}
              title={opt.label}
              className={cn(
                'max-w-[11rem] rounded-md border border-transparent px-2 py-1.5 text-left text-[10px] font-semibold leading-snug transition-colors disabled:opacity-60 sm:max-w-none sm:px-2.5 sm:text-xs',
                isSelected ? opt.selectedClass : opt.idleClass,
              )}
            >
              <span className="hidden sm:inline">{opt.label}</span>
              <span className="sm:hidden">{opt.shortLabel}</span>
            </button>
            )
          })}
        </div>
      </div>

      {pendingMode && pendingOption ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeConfirm}
          role="presentation"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            role="dialog"
            aria-labelledby="storefront-link-mode-title"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 id="storefront-link-mode-title" className="text-base font-semibold text-foreground">
                  Change storefront website links?
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This updates customer store URLs on the dashboard, business units, and copy-links tools.
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfirm}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs">
                <p className="font-medium text-foreground">
                  {currentOption?.label} → {pendingOption.label}
                </p>
                <p className="mt-1 text-muted-foreground">{pendingOption.description}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Type <span className="font-semibold text-foreground">{CONFIRM_PHRASE}</span> to confirm.
                </p>
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  autoComplete="off"
                  autoFocus
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={closeConfirm}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!canConfirm}
                  onClick={handleConfirm}
                >
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Confirm change'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
