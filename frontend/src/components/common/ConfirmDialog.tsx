import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ConfirmVariant = 'default' | 'warning' | 'danger' | 'success'

const VARIANT_ICON: Record<ConfirmVariant, { bg: string; icon: ReactNode }> = {
  default: { bg: 'bg-primary/10', icon: <AlertTriangle className="w-5 h-5 text-primary" /> },
  warning: { bg: 'bg-amber-100', icon: <AlertTriangle className="w-5 h-5 text-amber-600" /> },
  danger: { bg: 'bg-red-100', icon: <AlertTriangle className="w-5 h-5 text-red-600" /> },
  success: { bg: 'bg-green-100', icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> },
}

const CONFIRM_BTN: Record<ConfirmVariant, string> = {
  default: 'bg-primary hover:bg-primary/90 text-primary-foreground',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
}

type Props = {
  open: boolean
  title: string
  description?: ReactNode
  subtitle?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  subtitle,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  if (!open || typeof document === 'undefined') return null

  const icon = VARIANT_ICON[variant]

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      data-kiterp-modal
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-w-sm w-full rounded-xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', icon.bg)}>
            {icon.icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-snug text-foreground">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {description ? (
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        <div className="flex gap-3">
          <Button type="button" variant="cancel" className="flex-1" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={cn('flex-1', CONFIRM_BTN[variant])}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
