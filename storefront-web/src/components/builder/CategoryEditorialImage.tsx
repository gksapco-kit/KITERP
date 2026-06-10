import { useEffect, useState } from 'react'
import { imgUrl } from '@/lib/utils'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'

/** Category card hero image with fallback when URL is missing or fails to load. */
export function CategoryEditorialImage({
  src,
  fallback,
  alt,
  className,
  blockId,
  arrayKey,
  index,
  itemField,
  blockProps,
}: {
  src: string
  fallback: string
  alt: string
  className?: string
  blockId?: string
  arrayKey?: string
  index?: number
  itemField?: string
  blockProps?: Record<string, unknown>
}) {
  const primary = imgUrl(src) || imgUrl(fallback) || fallback
  const safeFallback = imgUrl(fallback) || fallback
  const [current, setCurrent] = useState(primary)
  const canvas = useBuilderCanvas()
  const isEditor = canvas?.isEditorCanvas
    && blockId
    && arrayKey != null
    && index != null
    && itemField

  useEffect(() => {
    setCurrent(imgUrl(src) || safeFallback)
  }, [src, safeFallback])

  if (isEditor) {
    return (
      <BuilderSectionImage
        blockId={blockId}
        field={itemField!}
        arrayKey={arrayKey}
        index={index}
        itemField={itemField}
        blockProps={blockProps}
        src={current}
        alt={alt}
        className={className}
      />
    )
  }

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (current !== safeFallback) setCurrent(safeFallback)
      }}
    />
  )
}
