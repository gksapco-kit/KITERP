import { useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { vendorApi } from '@/api/vendor'
import { mediaUrl } from '@/lib/utils'
import type { OrderAttachmentRef } from '@/types'
import {
  ClickableImageButton,
  ImageLightboxSession,
  urlsToLightboxItems,
} from '@/components/common/ImageAttachmentLightbox'

interface OrderMediaUploaderProps {
  orderId: string
  attachments: OrderAttachmentRef[]
  onChange: (attachments: OrderAttachmentRef[]) => void
  max?: number
  label?: string
  altPrefix?: string
}

/**
 * Shared upload + preview + lightbox widget for order evidence media
 * (cancel reason attachments, return/exchange evidence, etc).
 */
export function OrderMediaUploader({
  orderId,
  attachments,
  onChange,
  max = 10,
  label,
  altPrefix = 'Evidence',
}: OrderMediaUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const imageItems = useMemo(
    () => urlsToLightboxItems(
      attachments.filter((a) => a.kind === 'image').map((a) => a.url),
      { idPrefix: 'order-media', altText: (i) => `${altPrefix} ${i + 1}` },
    ),
    [attachments, altPrefix],
  )

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      let next = attachments
      for (const file of Array.from(files)) {
        if (next.length >= max) break
        const { url, kind } = await vendorApi.uploadOrderMedia(orderId, file)
        next = [...next, { url, kind }]
        onChange(next)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <Label>{label ?? `Photos or videos (optional, max ${max})`}</Label>
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        disabled={uploading || attachments.length >= max}
        className="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {attachments.map((a, i) => (
            <div key={`${a.url}-${i}`} className="relative">
              {a.kind === 'image' ? (
                <ClickableImageButton
                  src={mediaUrl(a.url)}
                  alt={`${altPrefix} ${i + 1}`}
                  title="View image"
                  className="h-16 w-16 rounded-lg border"
                  imgClassName="h-16 w-16 object-cover rounded-lg"
                  onClick={() => setLightboxIndex(
                    attachments.slice(0, i).filter((x) => x.kind === 'image').length,
                  )}
                />
              ) : (
                <video src={mediaUrl(a.url)} className="h-16 w-24 object-cover rounded-lg border" muted />
              )}
              <button
                type="button"
                className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-5"
                onClick={(e) => { e.stopPropagation(); onChange(attachments.filter((_, j) => j !== i)) }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <ImageLightboxSession
        items={imageItems}
        openIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
      {uploading && <p className="text-xs text-gray-500 mt-1">Uploading…</p>}
    </div>
  )
}
