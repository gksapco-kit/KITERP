import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Loader2, X } from 'lucide-react'
import { adminApi } from '@/api/admin.api'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

export type AttachmentPreview = {
  url: string
  filename?: string | null
  kind?: 'auto' | 'image' | 'pdf' | 'docx' | 'doc' | 'other'
  applicationId?: string
  attachment?: 'cv' | 'photo'
}

type Props = {
  open: boolean
  attachment: AttachmentPreview | null
  onClose: () => void
}

export function AttachmentPreviewModal({ open, attachment, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [objectKind, setObjectKind] = useState<'image' | 'pdf' | null>(null)

  const title =
    attachment?.filename ||
    (attachment?.attachment === 'photo' || attachment?.kind === 'image' ? 'Photo' : 'Document')

  useEscapeToClose(onClose, open)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open || !attachment) {
      setLoading(false)
      setError(null)
      setObjectKind(null)
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setObjectKind(null)
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })

    ;(async () => {
      try {
        if (!attachment.applicationId) {
          throw new Error('Preview is only available inside the Careers inbox.')
        }

        if (attachment.attachment === 'photo' || attachment.kind === 'image') {
          const blob = await adminApi.previewCareerApplicationPhoto(attachment.applicationId)
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(url)
            return
          }
          setObjectUrl(url)
          setObjectKind('image')
          return
        }

        // PDF (and any converted preview) via authenticated inline API
        const preview = await adminApi.previewCareerApplicationCv(attachment.applicationId)
        if (cancelled) return

        if (preview.mode === 'pdf') {
          const url = URL.createObjectURL(preview.blob)
          if (cancelled) {
            URL.revokeObjectURL(url)
            return
          }
          setObjectUrl(url)
          setObjectKind('pdf')
          return
        }
        if (preview.mode === 'image') {
          const url = URL.createObjectURL(preview.blob)
          if (cancelled) {
            URL.revokeObjectURL(url)
            return
          }
          setObjectUrl(url)
          setObjectKind('image')
          return
        }

        throw new Error('Only PDF files can be previewed here. Word files download instead.')
      } catch (err: unknown) {
        if (cancelled) return
        const axiosData = (err as { response?: { data?: unknown } })?.response?.data
        let message = 'Could not open preview'
        if (axiosData instanceof ArrayBuffer) {
          try {
            const parsed = JSON.parse(new TextDecoder().decode(axiosData)) as { detail?: string }
            message = parsed.detail || message
          } catch {
            /* keep default */
          }
        } else if (err instanceof Error && err.message) {
          message = err.message
        }
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, attachment])

  if (!open || !attachment || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6"
      data-kiterp-modal
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-[min(90vh,52rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative min-h-0 flex-1 bg-gray-50">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
              <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
            </div>
          ) : null}

          {objectKind === 'image' && objectUrl ? (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              <img
                src={objectUrl}
                alt={title}
                className="max-h-full max-w-full rounded object-contain shadow-sm"
              />
            </div>
          ) : null}

          {objectKind === 'pdf' && objectUrl ? (
            <iframe title={title} src={objectUrl} className="h-full w-full border-0 bg-white" />
          ) : null}

          {error && !loading ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
