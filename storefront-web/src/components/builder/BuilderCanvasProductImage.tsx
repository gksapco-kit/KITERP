import type { MouseEvent } from 'react'
import { toast } from 'sonner'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'

/** Product tile image in the builder — explains catalog photos vs editable section images. */
export function BuilderCanvasProductImage({
  blockId,
  src,
  alt,
  className,
  isCatalogPhoto = true,
}: {
  blockId?: string
  src: string
  alt: string
  className?: string
  /** True when the URL comes from live product/catalog data (not section props). */
  isCatalogPhoto?: boolean
}) {
  const canvas = useBuilderCanvas()
  const isEditor = canvas?.isEditorCanvas && blockId

  if (!isEditor) {
    return <img src={src} alt={alt} className={className} loading="lazy" />
  }

  const onActivate = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (isCatalogPhoto) {
      toast.info('This photo comes from your product catalog. Update it in Inventory → Products.', {
        duration: 5000,
      })
    }
  }

  return (
    <button
      type="button"
      className="absolute inset-0 w-full h-full cursor-pointer group/photo"
      onPointerDown={onActivate}
      onClick={onActivate}
      title={isCatalogPhoto ? 'Catalog photo — edit in Products' : 'Click to change photo'}
    >
      <img src={src} alt={alt} className={className} loading="lazy" />
      {isCatalogPhoto && (
        <span className="pointer-events-none absolute bottom-1 left-1 right-1 rounded bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white opacity-0 group-hover/photo:opacity-100 transition-opacity text-center">
          Catalog photo
        </span>
      )}
    </button>
  )
}
