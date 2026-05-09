import { PackagePlus, X } from 'lucide-react'
import { toast } from 'sonner'

interface BarcodeNotFoundToastProps {
  toastId: string | number
  barcode: string
  onCreateProduct: () => void
}

/**
 * Custom toast body rendered by sonner when a scanned barcode has no match.
 * Stays visible for 20 seconds. "Create Product" takes action immediately.
 */
export function BarcodeNotFoundToast({ toastId, barcode, onCreateProduct }: BarcodeNotFoundToastProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <PackagePlus className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Product not found</p>
            <p className="text-xs text-gray-500 font-mono">{barcode}</p>
          </div>
        </div>
        <button
          onClick={() => toast.dismiss(toastId)}
          className="text-gray-400 hover:text-gray-600 shrink-0 p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            onCreateProduct()
            toast.dismiss(toastId)
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
        >
          <PackagePlus className="w-3.5 h-3.5" />
          Create Product
        </button>
        <button
          onClick={() => toast.dismiss(toastId)}
          className="py-1.5 px-3 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

/**
 * Helper — show the not-found toast from anywhere.
 * @param barcode   The scanned code that wasn't found
 * @param onAction  Called when "Create Product" is clicked (navigation / tab open)
 */
export function showBarcodeNotFound(barcode: string, onAction: () => void) {
  const id = `bnf-${barcode}-${Date.now()}`
  toast.custom(
    (t) => (
      <BarcodeNotFoundToast
        toastId={t}
        barcode={barcode}
        onCreateProduct={onAction}
      />
    ),
    {
      id,
      duration: 20000,
      // Sonner renders custom toasts without its built-in styling — we provide our own wrapper
      className: 'bg-white border border-amber-200 shadow-lg rounded-xl p-3 w-80',
    },
  )
}
