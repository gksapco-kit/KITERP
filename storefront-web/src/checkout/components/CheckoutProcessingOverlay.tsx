import { Loader2 } from 'lucide-react'

type Props = {
  message: string
}

/** Full-screen loader while order placement / payment verification is in progress. */
export function CheckoutProcessingOverlay({ message }: Props) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-white/90 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--brand-primary))]" aria-hidden />
        <div>
          <p className="text-base font-medium text-[hsl(var(--text))]">{message}</p>
          <p className="ck-text-muted mt-1 text-sm">Please don&apos;t close this page.</p>
        </div>
      </div>
    </div>
  )
}
