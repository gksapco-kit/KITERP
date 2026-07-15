import { useLayoutEffect, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn, onModalBackdropClick } from '@/lib/utils'
import {
  modalBodyClass,
  modalCloseBtnClass,
  modalFooterClass,
  modalHeaderClass,
  modalOverlayCenterClass,
  modalPanelClass,
  modalTitleClass,
} from '@/lib/modalUi'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

/** Nested-modal-safe body scroll lock — only restores when the last overlay unmounts. */
let modalScrollLockCount = 0
let prevHtmlOverflow = ''
let prevBodyOverflow = ''
let prevBodyPaddingRight = ''

function lockModalScroll() {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const body = document.body
  if (modalScrollLockCount === 0) {
    prevHtmlOverflow = html.style.overflow
    prevBodyOverflow = body.style.overflow
    prevBodyPaddingRight = body.style.paddingRight
    const scrollbarGap = window.innerWidth - html.clientWidth
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`
    }
  }
  modalScrollLockCount += 1
}

function unlockModalScroll() {
  if (typeof document === 'undefined') return
  modalScrollLockCount = Math.max(0, modalScrollLockCount - 1)
  if (modalScrollLockCount > 0) return
  const html = document.documentElement
  const body = document.body
  html.style.overflow = prevHtmlOverflow
  body.style.overflow = prevBodyOverflow
  body.style.paddingRight = prevBodyPaddingRight
}

export function ModalEscHint({ className }: { className?: string }) {
  return (
    <kbd
      className={cn(
        'hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground shadow-sm',
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
          modalCloseBtnClass,
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

  useLayoutEffect(() => {
    lockModalScroll()
    return () => unlockModalScroll()
  }, [])

  const overlay = (
    <div
      data-kiterp-modal
      className={cn(modalOverlayCenterClass, className)}
      onClick={onModalBackdropClick(onClose)}
    >
      {children}
    </div>
  )

  if (typeof document === 'undefined') return overlay
  return createPortal(overlay, document.body)
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
      className={cn(modalPanelClass, className)}
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
    <div className={cn('flex-1 min-h-0 overflow-y-auto overscroll-contain', className)}>
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
    <div className={cn(modalFooterClass, className)}>
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
    <div className={cn(modalHeaderClass, className)}>
      <div className="min-w-0">
        {typeof title === 'string' ? (
          <h2 className={modalTitleClass}>{title}</h2>
        ) : (
          title
        )}
        {subtitle}
      </div>
      <ModalCloseButton onClose={onClose} />
    </div>
  )
}
