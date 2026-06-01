import type { MouseEvent, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn, onModalBackdropClick } from '@/lib/utils'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

export function ModalEscHint({ className }: { className?: string }) {
  return (
    <kbd
      className={cn(
        'hidden sm:inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[0.65rem] font-medium text-gray-500 shadow-sm',
        className,
      )}
    >
      Esc
    </kbd>
  )
}

export function ModalCloseButton({
  onClose,
  className,
  showEscHint = true,
}: {
  onClose: () => void
  className?: string
  showEscHint?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {showEscHint ? <ModalEscHint /> : null}
      <button
        type="button"
        data-escape-close
        onClick={onClose}
        className={cn(
          'p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors',
          className,
        )}
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}

export function ModalOverlay({
  onClose,
  children,
  className,
}: {
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  useEscapeToClose(onClose)

  return (
    <div
      data-kiterp-modal
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto',
        className,
      )}
      onClick={onModalBackdropClick(onClose)}
    >
      {children}
    </div>
  )
}

export function ModalPanel({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-xl w-full my-auto max-h-[min(90dvh,calc(100vh-2rem))] flex flex-col overflow-hidden',
        className,
      )}
      onClick={onClick ?? (e => e.stopPropagation())}
    >
      {children}
    </div>
  )
}

export function ModalBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-y-auto flex-1 min-h-0', className)}>
      {children}
    </div>
  )
}

export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('shrink-0', className)}>
      {children}
    </div>
  )
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {typeof title === 'string' ? (
          <h2 className="font-semibold text-lg text-gray-900">{title}</h2>
        ) : (
          title
        )}
        {subtitle}
      </div>
      <ModalCloseButton onClose={onClose} />
    </div>
  )
}
