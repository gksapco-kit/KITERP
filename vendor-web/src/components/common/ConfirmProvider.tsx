import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

export type ConfirmVariant = 'default' | 'warning' | 'danger' | 'success'

export type ConfirmOptions = {
  title: string
  description?: ReactNode
  subtitle?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  /** Require typing this phrase before Confirm is enabled (e.g. CONVERT, CANCEL, APPROVE). */
  confirmPhrase?: string
}

export type AskConfirmInput = string | ConfirmOptions

type ConfirmFn = (input: AskConfirmInput) => Promise<boolean>

type Pending = {
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

const ConfirmContext = createContext<ConfirmFn | null>(null)

let confirmImpl: ConfirmFn | null = null

function inferVariant(title: string): ConfirmVariant {
  const t = title.toLowerCase()
  if (/\b(delete|remove|void|cancel|revoke|deactivate|clear|reverse)\b/.test(t)) return 'danger'
  if (/\b(approve|activate|launch|close this|lock|reopen)\b/.test(t)) return 'warning'
  return 'default'
}

function inferConfirmLabel(title: string, variant: ConfirmVariant): string {
  const t = title.toLowerCase()
  if (/\bdelete\b/.test(t)) return 'Delete'
  if (/\bremove\b/.test(t)) return 'Remove'
  if (/\bvoid\b/.test(t)) return 'Void'
  if (/\bcancel\b/.test(t)) return 'Cancel'
  if (/\breverse\b/.test(t)) return 'Reverse'
  if (/\bapprove\b/.test(t)) return 'Approve'
  if (/\breject\b/.test(t)) return 'Reject'
  if (/\bconvert\b/.test(t)) return 'Convert'
  if (/\bcreate\b/.test(t)) return 'Create'
  if (variant === 'danger') return 'Confirm'
  return 'Confirm'
}

function normalizeInput(input: AskConfirmInput): ConfirmOptions {
  if (typeof input === 'string') {
    const variant = inferVariant(input)
    return {
      title: input,
      variant,
      confirmLabel: inferConfirmLabel(input, variant),
      cancelLabel: 'Close',
    }
  }
  const variant = input.variant ?? inferVariant(input.title)
  return {
    ...input,
    variant,
    confirmLabel: input.confirmLabel ?? inferConfirmLabel(input.title, variant),
    cancelLabel: input.cancelLabel ?? 'Close',
    confirmPhrase: input.confirmPhrase?.trim() || undefined,
  }
}

/** Drop-in async replacement for `window.confirm()`. Requires ConfirmProvider. */
export function askConfirm(input: AskConfirmInput): Promise<boolean> {
  if (confirmImpl) return confirmImpl(input)
  const message = typeof input === 'string' ? input : input.title
  return Promise.resolve(window.confirm(message))
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext)
  if (!fn) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return fn
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)

  const settle = useCallback((value: boolean) => {
    const current = pendingRef.current
    if (!current) return
    pendingRef.current = null
    setPending(null)
    current.resolve(value)
  }, [])

  const confirm = useCallback<ConfirmFn>((input) => {
    return new Promise<boolean>((resolve) => {
      // Resolve any prior pending confirm as cancelled (should be rare).
      if (pendingRef.current) {
        pendingRef.current.resolve(false)
      }
      const next: Pending = { options: normalizeInput(input), resolve }
      pendingRef.current = next
      setPending(next)
    })
  }, [])

  useEffect(() => {
    confirmImpl = confirm
    return () => {
      if (confirmImpl === confirm) confirmImpl = null
    }
  }, [confirm])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!pending}
        title={pending?.options.title ?? ''}
        description={pending?.options.description}
        subtitle={pending?.options.subtitle}
        confirmLabel={pending?.options.confirmLabel}
        cancelLabel={pending?.options.cancelLabel}
        variant={pending?.options.variant}
        confirmPhrase={pending?.options.confirmPhrase}
        onCancel={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  )
}
