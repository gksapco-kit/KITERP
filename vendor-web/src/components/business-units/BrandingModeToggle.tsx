import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { BrandingMode } from '@/lib/brandingMode'

const CONFIRM_PHRASE = 'UPDATE'

const OPTIONS = [
  {
    id: 'shared' as const,
    label: 'Common Branding for All BUs / Stores',
    shortLabel: 'Common branding',
    description:
      'Every business unit uses the logo and banners from your Business Profile. Per-unit branding is kept but hidden.',
    selectedClass:
      'cursor-default border-amber-200 bg-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-300/80 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-800/60',
    idleClass: 'text-muted-foreground hover:bg-amber-50/60 hover:text-amber-800 dark:hover:bg-amber-950/30',
  },
  {
    id: 'per_unit' as const,
    label: 'Unique Branding Per BU / Store',
    shortLabel: 'Unique per BU',
    description:
      'Each business unit manages its own logo and banners, falling back to the Business Profile when not set.',
    selectedClass:
      'cursor-default border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-300/80 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-800/60',
    idleClass: 'text-muted-foreground hover:bg-emerald-50/60 hover:text-emerald-800 dark:hover:bg-emerald-950/30',
  },
] satisfies {
  id: BrandingMode
  label: string
  shortLabel: string
  description: string
  selectedClass: string
  idleClass: string
}[]

type Props = {
  mode: BrandingMode
  onConfirm: (mode: BrandingMode) => void
  pending?: boolean
}

export function BrandingModeToggle({ mode, onConfirm, pending }: Props) {
  const [pendingMode, setPendingMode] = useState<BrandingMode | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const pendingOption = OPTIONS.find(o => o.id === pendingMode)
  const currentOption = OPTIONS.find(o => o.id === mode)
  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_PHRASE && !pending

  const openConfirm = (next: BrandingMode) => {
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

  const blockEnterKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    e.stopPropagation()
  }

  const confirmDialog =
    pendingMode && pendingOption ? (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={closeConfirm}
        role="presentation"
        onKeyDownCapture={blockEnterKey}
      >
        <div
          className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          role="dialog"
          aria-labelledby="branding-mode-title"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id="branding-mode-title" className="text-base font-semibold text-foreground">
                Change branding source?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                This updates which logo and banners show on the dashboard and business unit views. Existing per-unit branding is preserved.
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

          <form
            className="space-y-4 px-5 py-4"
            onSubmit={e => e.preventDefault()}
          >
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs">
              <p className="font-medium text-foreground">
                {currentOption?.label} → {pendingOption.label}
              </p>
              <p className="mt-1 text-muted-foreground">{pendingOption.description}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Type <span className="font-semibold text-foreground">{CONFIRM_PHRASE}</span> to confirm, then click Confirm change.
              </p>
              <Input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                onKeyDown={blockEnterKey}
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
                    Saving...
                  </>
                ) : (
                  'Confirm change'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    ) : null

  return (
    <>
      <div className="flex shrink-0 flex-col items-start gap-1 lg:items-end">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Logo &amp; banner branding
        </span>
        <div
          className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
          role="group"
          aria-label="Business unit branding mode"
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

      {typeof document !== 'undefined' && confirmDialog
        ? createPortal(confirmDialog, document.body)
        : null}
    </>
  )
}
