import type { CSSProperties, MouseEvent } from 'react'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isCanvasImageSlotSelected } from '@/lib/canvasImageTarget'
import { isMultiSelectModifier } from '@/lib/builderMultiSelect'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import {
  readArrayItemFromBlockProps,
  readArrayItemImageStyleProps,
  sectionImageObjectStyle,
} from '@/lib/sectionImageStyle'

const CORNER_CLASS =
  'pointer-events-none absolute z-[32] h-2.5 w-2.5 border-2 border-primary bg-white shadow-sm'

/** Clickable hero / section image in the builder canvas. */
export function BuilderSectionImage({
  blockId,
  field,
  blockProps,
  src,
  alt = '',
  className,
  style,
  arrayKey,
  index,
  itemField,
  empty = false,
}: {
  blockId?: string
  field: string
  blockProps?: Record<string, unknown>
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
  /** Array-item slot (categories[i].image_url, images[i].src, …). */
  arrayKey?: string
  index?: number
  itemField?: string
  /** Editor placeholder when the slot has no image yet. */
  empty?: boolean
}) {
  const canvas = useBuilderCanvas()
  const isEditor = canvas?.isEditorCanvas && !!blockId
  const isArraySlot = arrayKey != null && index != null && itemField
  const isActive = isEditor
    && isCanvasImageSlotSelected(
      canvas?.activeCanvasImageTarget,
      blockId!,
      isArraySlot
        ? { arrayKey, index, itemField }
        : { field },
    )
  const multiCount = isEditor && isActive
    ? canvas?.activeCanvasImageTarget?.slots.length ?? 1
    : 0

  const styleField = isArraySlot && (itemField === 'src' || itemField === 'avatar_url')
    ? 'image_url'
    : field
  const styleProps = canvas?.blockPropsForImage ?? blockProps ?? {}
  const objectStyle = isArraySlot
    ? sectionImageObjectStyle(
        'image_url',
        readArrayItemImageStyleProps(
          readArrayItemFromBlockProps(styleProps, arrayKey!, index!),
          styleProps,
          styleField,
        ),
      )
    : sectionImageObjectStyle(styleField, styleProps)

  const onActivate = (e: MouseEvent | PointerEvent) => {
    if (!isEditor || !blockId) return
    e.stopPropagation()
    e.preventDefault()
    const additive = isMultiSelectModifier(e)
    if (isArraySlot) {
      canvas.onSectionImageActivate?.(blockId, field, { arrayKey, index, itemField, additive })
    } else {
      canvas.onSectionImageActivate?.(blockId, field, { additive })
    }
  }

  return (
    <div
      className={cn(
        'group/builder-section-img relative z-0 h-full w-full overflow-hidden',
        isEditor && 'cursor-pointer pointer-events-auto',
        isEditor && isActive && 'z-[20]',
      )}
      data-builder-section-image={field}
      data-builder-section-image-active={isActive ? 'true' : undefined}
      data-builder-field-selected={isActive ? 'true' : undefined}
      aria-selected={isActive}
      onPointerDown={isEditor ? e => {
        if (e.button !== 0) return
        e.stopPropagation()
        onActivate(e)
      } : undefined}
    >
      <img
        src={src}
        alt={alt}
        className={cn(className, empty && 'opacity-0')}
        style={{ ...objectStyle, ...style }}
        loading="lazy"
        draggable={false}
      />
      {empty && isEditor ? (
        <div
          className="pointer-events-none absolute inset-0 z-[10] flex flex-col items-center justify-center gap-1 border-2 border-dashed border-primary/35 bg-primary/5 text-primary/70"
          aria-hidden
        >
          <ImageIcon className="h-5 w-5 opacity-60" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Add photo</span>
        </div>
      ) : null}
      {isEditor && !isActive ? (
        <div
          className="pointer-events-none absolute inset-0 z-[15] border-2 border-dashed border-transparent bg-primary/0 transition-colors group-hover/builder-section-img:border-primary/55 group-hover/builder-section-img:bg-primary/8"
          aria-hidden
        />
      ) : null}
      {isActive ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[30] border-[3px] border-primary bg-primary/12 shadow-[inset_0_0_32px_rgba(100,195,160,0.28)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute left-2 top-2 z-[33] flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-md"
          >
            <ImageIcon className="h-3 w-3 shrink-0" aria-hidden />
            {multiCount > 1 ? `${multiCount} selected` : 'Photo selected'}
          </div>
          <span className={cn(CORNER_CLASS, 'left-0 top-0 -translate-x-px -translate-y-px')} aria-hidden />
          <span className={cn(CORNER_CLASS, 'right-0 top-0 translate-x-px -translate-y-px')} aria-hidden />
          <span className={cn(CORNER_CLASS, 'bottom-0 left-0 -translate-x-px translate-y-px')} aria-hidden />
          <span className={cn(CORNER_CLASS, 'right-0 bottom-0 translate-x-px translate-y-px')} aria-hidden />
        </>
      ) : null}
    </div>
  )
}
