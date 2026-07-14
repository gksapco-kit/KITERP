import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { UpiCheckoutMode } from '@/lib/upiCheckoutMode'

const CONFIRM_PHRASE = 'UPDATE'

const OPTIONS = [
  {
    id: 'shared' as const,
    label: 'Common UPI for All BUs / Stores',
    shortLabel: 'Common UPI',
    description:
      'Every business unit uses the same UPI ID and QR at checkout. Per-unit UPI settings are kept but unused.',
    selectedClass:
      'cursor-default border-amber-200 bg-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-300/80 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-800/60',
    idleClass: 'text-muted-foreground hover:bg-amber-50/60 hover:text-amber-800 dark:hover:bg-amber-950/30',
  },
  {
    id: 'per_unit' as const,
    label: 'Unique UPI Per BU / Store',
    shortLabel: 'Unique per BU',
    description:
      'Each business unit manages its own UPI ID and QR, falling back to the shared UPI when not set.',
    selectedClass:
      'cursor-default border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-300/80 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-800/60',
    idleClass: 'text-muted-foreground hover:bg-emerald-50/60 hover:text-emerald-800 dark:hover:bg-emerald-950/30',
  },
] satisfies {
  id: UpiCheckoutMode
  label: string
  shortLabel: string
  description: string
  selectedClass: string
  idleClass: string
}[]

type Props = {
  mode: UpiCheckoutMode
  onConfirm: (mode: UpiCheckoutMode) => void
  pending?: boolean
  className?: string
}

export function UpiCheckoutModeToggle({ mode, onConfirm, pending, className }: Props) {
  const [pendingMode, setPendingMode] = useState<UpiCheckoutMode | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const pendingOption = OPTIONS.find((o) => o.id === pendingMode)
  const currentOption = OPTIONS.find((o) => o.id === mode)
  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_PHRASE && !pending

  const openConfirm = (next: UpiCheckoutMode) => {
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
          aria-labelledby="upi-mode-title"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id="upi-mode-title" className="text-base font-semibold text-foreground">
                Change UPI scope?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                This updates which UPI details customers see at checkout. Existing per-unit settings are preserved.
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

          <form className="space-y-4 px-5 py-4" onSubmit={(e) => e.preventDefault()}>
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
                onChange={(e) => setConfirmText(e.target.value)}
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
      <div className={cn('flex shrink-0 flex-col items-start gap-1 lg:items-end', className)}>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          UPI scope
        </span>
        <div
          className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/40 p-0.5"
          role="group"
          aria-label="UPI checkout scope"
        >
          {OPTIONS.map((opt) => {
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
