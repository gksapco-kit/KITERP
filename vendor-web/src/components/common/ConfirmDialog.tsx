import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { confirmOverlayClass } from '@/lib/modalUi'
import { cn } from '@/lib/utils'

type ConfirmVariant = 'default' | 'warning' | 'danger' | 'success'

const VARIANT_ICON: Record<ConfirmVariant, { bg: string; icon: ReactNode }> = {
  default: { bg: 'bg-primary/10', icon: <AlertTriangle className="w-5 h-5 text-primary" /> },
  warning: { bg: 'bg-amber-100', icon: <AlertTriangle className="w-5 h-5 text-amber-600" /> },
  danger:  { bg: 'bg-red-100', icon: <AlertTriangle className="w-5 h-5 text-red-600" /> },
  success: { bg: 'bg-green-100', icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> },
}

const CONFIRM_BTN: Record<ConfirmVariant, string> = {
  default: 'bg-primary hover:bg-primary/90 text-primary-foreground',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white',
  danger:  'bg-red-600 hover:bg-red-700 text-white',
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
  /** When set, user must type this phrase (case-insensitive) before Confirm is enabled. */
  confirmPhrase?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  subtitle,
  confirmLabel = 'Confirm',
  cancelLabel = 'Close',
  variant = 'default',
  busy = false,
  confirmPhrase,
  onCancel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) setTyped('')
  }, [open, confirmPhrase])

  if (!open) return null

  const icon = VARIANT_ICON[variant]
  const phrase = confirmPhrase?.trim() || ''
  const phraseOk = !phrase || typed.trim().toLowerCase() === phrase.toLowerCase()
  const canConfirm = phraseOk && !busy

  return (
    <ModalOverlay onClose={busy ? () => {} : onCancel} className={confirmOverlayClass}>
      <ModalPanel className="max-w-sm w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', icon.bg)}>
            {icon.icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground leading-snug">{title}</h2>
            {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
        {description ? (
          <div className="text-sm text-muted-foreground mb-4 leading-relaxed">{description}</div>
        ) : null}

        {phrase ? (
          <div className="mb-5 space-y-2">
            <p className="text-xs text-muted-foreground">
              Type <span className="font-semibold text-foreground font-mono">{phrase}</span> to confirm this action.
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={phrase}
              autoComplete="off"
              autoFocus
              disabled={busy}
              className="font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (canConfirm) onConfirm()
                }
              }}
            />
          </div>
        ) : null}

        <div className="flex gap-3 border-t border-border pt-4 mt-1">
          <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={cn('flex-1', CONFIRM_BTN[variant])}
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </ModalPanel>
    </ModalOverlay>
  )
}
