import type { CSSProperties, MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { sectionImageObjectStyle } from '@/lib/sectionImageStyle'

/** Clickable hero / section image in the builder canvas. */
export function BuilderSectionImage({
  blockId,
  field,
  blockProps,
  src,
  alt = '',
  className,
  style,
}: {
  blockId?: string
  field: string
  blockProps?: Record<string, unknown>
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
}) {
  const canvas = useBuilderCanvas()
  const isEditor = canvas?.isEditorCanvas && !!blockId
  const isActive = isEditor
    && canvas.activeBlockId === blockId
    && canvas.activeSectionImageField === field

  const styleProps = canvas?.blockPropsForImage ?? blockProps ?? {}
  const objectStyle = sectionImageObjectStyle(field, styleProps)

  const onActivate = (e: MouseEvent) => {
    if (!isEditor || !blockId) return
    e.stopPropagation()
    e.preventDefault()
    canvas.onSectionImageActivate?.(blockId, field)
  }

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden', isEditor && 'cursor-pointer')}
      data-builder-section-image={field}
      onClick={isEditor ? onActivate : undefined}
      onMouseDown={isEditor ? e => e.stopPropagation() : undefined}
    >
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ ...objectStyle, ...style }}
        loading="lazy"
        draggable={false}
      />
      {isActive ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 ring-2 ring-[#64C3A0] ring-offset-1"
          aria-hidden
        />
      ) : null}
    </div>
  )
}
