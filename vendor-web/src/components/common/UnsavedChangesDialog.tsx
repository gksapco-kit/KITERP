import { AlertTriangle, Loader2, Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  saving?: boolean
  title?: string
  message?: string
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}

export function UnsavedChangesDialog({
  open,
  saving = false,
  title = 'Unsaved changes',
  message = 'Save your work before leaving, or discard the changes you made.',
  onCancel,
  onDiscard,
  onSave,
}: Props) {
  if (!open) return null

  return (
    <ModalOverlay onClose={saving ? () => {} : onCancel}>
      <ModalPanel
        className={cn(
          'relative w-[min(100%,22rem)] max-w-[22rem] overflow-hidden',
          'rounded-lg border border-border/80 bg-card shadow-2xl',
        )}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="unsaved-changes-title"
          aria-describedby="unsaved-changes-desc"
          className="relative flex flex-col items-center px-7 pb-7 pt-9 text-center sm:px-8 sm:pb-8 sm:pt-10"
        >
          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            {!saving ? (
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground shadow-sm sm:inline-flex">
                Esc
              </kbd>
            ) : null}
            <button
              type="button"
              data-escape-close
              disabled={saving}
              onClick={onCancel}
              aria-label="Close"
              className={cn(
                'rounded-md p-1.5 text-muted-foreground transition-colors',
                'hover:bg-muted hover:text-foreground',
                'disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            className={cn(
              'mb-5 flex h-14 w-14 items-center justify-center rounded-lg',
              'bg-amber-50 text-amber-600 ring-1 ring-amber-200/70',
            )}
            aria-hidden
          >
            <AlertTriangle className="h-7 w-7" strokeWidth={2} />
          </div>

          <h2
            id="unsaved-changes-title"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            {title}
          </h2>
          <p
            id="unsaved-changes-desc"
            className="mt-2 max-w-[16.5rem] text-sm leading-relaxed text-muted-foreground"
          >
            {message}
          </p>

          <div className="mt-8 flex w-full flex-col gap-2.5">
            <Button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="h-10 w-full gap-2 rounded-lg text-sm font-medium"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save &amp; continue
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onDiscard}
              className={cn(
                'h-10 w-full gap-2 rounded-lg text-sm font-medium',
                'border-red-200 text-red-600',
                'hover:border-red-300 hover:bg-red-50 hover:text-red-700',
              )}
            >
              <Trash2 className="h-4 w-4" />
              Discard changes
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={onCancel}
              className="mt-0.5 h-9 w-full rounded-lg text-sm text-muted-foreground hover:text-foreground"
            >
              Keep editing
            </Button>
          </div>
        </div>
      </ModalPanel>
    </ModalOverlay>
  )
}
