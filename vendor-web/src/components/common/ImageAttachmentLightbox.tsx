import { useMemo, useState } from 'react'
import {
  ClickableImageButton,
  ImageLightboxSession,
  urlsToLightboxItems,
  type LightboxMediaItem,
} from '@/components/common/CatalogMediaLightbox'

type ImageAttachment = {
  url: string
  id?: string
}

type ImageAttachmentLightboxProps = {
  attachments: ImageAttachment[]
  editable?: boolean
  resolveUrl?: (url: string) => string
  renderThumbnail: (props: {
    attachment: ImageAttachment
    index: number
    open: () => void
    resolvedUrl: string
  }) => React.ReactNode
  onSaveImage?: (index: number, file: File) => Promise<void>
}

/** Reusable image-only attachment grid with catalog lightbox (view / edit). */
export function ImageAttachmentLightbox({
  attachments,
  editable,
  resolveUrl = (url) => url,
  renderThumbnail,
  onSaveImage,
}: ImageAttachmentLightboxProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const items = useMemo<LightboxMediaItem[]>(
    () => urlsToLightboxItems(
      attachments.map((a) => a.url),
      {
        idPrefix: 'attachment',
        altText: (i) => attachments[i]?.id ?? `Attachment ${i + 1}`,
      },
    ),
    [attachments],
  )

  if (attachments.length === 0) return null

  return (
    <>
      {attachments.map((attachment, index) => (
        <div key={attachment.id ?? `${attachment.url}-${index}`}>
          {renderThumbnail({
            attachment,
            index,
            open: () => setOpenIndex(index),
            resolvedUrl: resolveUrl(attachment.url),
          })}
        </div>
      ))}
      <ImageLightboxSession
        items={items}
        openIndex={openIndex}
        onClose={() => setOpenIndex(null)}
        editable={editable}
        onSaveImage={onSaveImage}
      />
    </>
  )
}

export { ClickableImageButton, ImageLightboxSession, urlsToLightboxItems }
