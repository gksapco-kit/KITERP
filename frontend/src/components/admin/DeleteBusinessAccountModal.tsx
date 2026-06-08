import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

export type DeleteBusinessAccountTarget = {
  id: string
  business_name?: string | null
  display_name?: string | null
  primary_email?: string | null
}

type Props = {
  vendor: DeleteBusinessAccountTarget | null
  isPending?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DeleteBusinessAccountModal({
  vendor,
  isPending = false,
  onClose,
  onConfirm,
}: Props) {
  useEscapeToClose(onClose, !!vendor && !isPending)

  useEffect(() => {
    if (!vendor) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [vendor])

  if (!vendor) return null

  const label = vendor.business_name || vendor.display_name || 'this business account'

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-vendor-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose()
      }}
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          onClick={onClose}
          disabled={isPending}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <h3 id="delete-vendor-title" className="text-lg font-semibold text-gray-900">
              Delete business account?
            </h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Permanently delete{' '}
              <span className="font-semibold text-gray-900">{label}</span>
              {vendor.primary_email ? (
                <>
                  {' '}
                  (<span className="break-all">{vendor.primary_email}</span>)
                </>
              ) : null}
              . This removes the business, its team links, and the owner login if they have no
              other stores.
            </p>
            <p className="mt-2 text-sm font-medium text-red-600">This action cannot be undone.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="cancel" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
