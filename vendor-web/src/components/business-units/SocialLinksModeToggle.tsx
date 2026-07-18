import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { SocialLinksMode } from '@/lib/socialLinksMode'

const CONFIRM_PHRASE = 'UPDATE'

const OPTIONS = [
  {
    id: 'shared' as const,
    label: 'Common Social & Web Links for All BUs / Stores',
    shortLabel: 'All units',
    mediumLabel: 'Common · all units',
    description:
      'Every business unit uses the same website and social profiles. Per-unit links are kept but hidden.',
  },
  {
    id: 'per_unit' as const,
    label: 'Unique Social & Web Links Per BU / Store',
    shortLabel: 'Per unit',
    mediumLabel: 'Unique · per unit',
    description:
      'Each business unit manages its own website and social profiles, falling back to the shared links when not set.',
  },
] satisfies {
  id: SocialLinksMode
  label: string
  shortLabel: string
  mediumLabel: string
  description: string
}[]

type Props = {
  mode: SocialLinksMode
  onConfirm: (mode: SocialLinksMode) => void
  pending?: boolean
  className?: string
  /** Show helper sentence above the pill group. */
  showHelper?: boolean
}

export function SocialLinksModeToggle({
  mode,
  onConfirm,
  pending,
  className,
  showHelper = false,
}: Props) {
  const [pendingMode, setPendingMode] = useState<SocialLinksMode | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const pendingOption = OPTIONS.find(o => o.id === pendingMode)
  const currentOption = OPTIONS.find(o => o.id === mode)
  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_PHRASE && !pending

  const openConfirm = (next: SocialLinksMode) => {
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
          aria-labelledby="social-links-mode-title"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id="social-links-mode-title" className="text-base font-semibold text-foreground">
                Change link scope?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                This updates which links show on your storefront. Existing per-unit links are preserved.
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

          <form className="space-y-4 px-5 py-4" onSubmit={e => e.preventDefault()}>
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
              <Button type="button" className="flex-1" disabled={!canConfirm} onClick={handleConfirm}>
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
      <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">Link scope</span>
        {showHelper && (
          <p className="hidden min-w-0 text-xs text-muted-foreground xl:block">
            Shared links for every unit, or separate links per business unit.
          </p>
        )}
        <div
          className="inline-flex max-w-full rounded-lg border border-border bg-background p-0.5 shadow-sm"
          role="group"
          aria-label="Social links scope"
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
                  'rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium leading-none transition-colors disabled:opacity-60',
                  isSelected
                    ? 'cursor-default bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <span className="hidden md:inline">{opt.mediumLabel}</span>
                <span className="md:hidden">{opt.shortLabel}</span>
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
