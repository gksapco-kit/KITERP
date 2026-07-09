import type { ReactNode } from 'react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { cn, imgUrl } from '@/lib/utils'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { hasInlineHtml } from '@/lib/fieldTextStyles'
import { BuilderSectionSurface } from '@/components/builder/BuilderSectionSurface'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

export default function AboutSplitBlock({ site, style, props, liveItems, blockId }: Props) {
  const canvas = useBuilderCanvas()
  const isEditorCanvas = canvas?.isEditorCanvas && !!blockId
  const profile = liveItems[0]

  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : (profile?.title || 'About Us')),
  })
  const subtitle = resolveBlockTextField(props, 'subtitle', {
    fallback: () => (isEditorCanvas ? null : 'Our Story'),
  })
  const description = resolveBlockTextField(props, 'description', {
    fallback: () => (isEditorCanvas ? null : (profile?.description || site.description || '')),
  })

  const imageHidden = isBlockFieldHidden(props, 'image_url')
  const imageRaw = imageHidden
    ? null
    : ((props.image_url as string | null) || profile?.image_url || null)
  const imageUrl = imageRaw ? imgUrl(imageRaw) : null
  const mediaClip = props.media_clip
  const clipped = hasMediaClip(mediaClip)

  const showSubtitle = !isBlockFieldHidden(props, 'subtitle') && (subtitle || isEditorCanvas)
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const showDescription = !isBlockFieldHidden(props, 'description') && (description || isEditorCanvas)
  const showImage = !imageHidden && (imageUrl || isEditorCanvas)

  const layout = String(props.layout ?? 'split')
  const imagePosition = String(props.image_position ?? 'right')
  const imageOnLeft = imagePosition === 'left'
  const isDark = props.bg_style === 'dark'
  const isCard = props.card_style === 'card'
  const isStatement = layout === 'statement' || imagePosition === 'none'
  const isOverlay = layout === 'overlay' && showImage
  const isFull = layout === 'full'

  const sectionText = isDark ? '#f8fafc' : (style.text_color || '#111827')
  const sectionBg = isDark ? '#0f172a' : undefined
  const mutedText = isDark ? 'text-slate-300' : 'text-gray-600'
  const titleClass = isDark ? 'text-white' : 'text-gray-900'

  const descriptionClass = cn(
    'rich-text-content leading-relaxed text-sm sm:text-base',
    mutedText,
    description && !hasInlineHtml(description) && 'whitespace-pre-wrap',
    isStatement ? 'text-left sm:text-center' : 'max-lg:text-left',
  )

  const renderTextColumn = (opts?: { onImage?: boolean }) => {
    const onImage = opts?.onImage ?? false
    return (
    <div
      className={cn(
        'about-split-text-col min-w-0 space-y-3 sm:space-y-4',
        isStatement && 'mx-auto w-full max-w-3xl text-center',
      )}
    >
      {showSubtitle && (
        <BuilderTextField
          fieldKey="subtitle"
          blockId={blockId}
          blockProps={props}
          value={subtitle ?? ''}
          as="p"
          className="text-xs sm:text-sm font-semibold uppercase tracking-widest"
          style={{ color: onImage ? '#ffffff' : style.primary_color }}
        />
      )}
      {showTitle && (
        <BuilderTextField
          fieldKey="title"
          blockId={blockId}
          blockProps={props}
          value={title ?? ''}
          as="h2"
          className={cn(
            'text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-balance',
            onImage ? 'text-white' : titleClass,
          )}
        />
      )}
      {showDescription && (
        <BuilderTextField
          fieldKey="description"
          blockId={blockId}
          blockProps={props}
          value={description ?? ''}
          as="div"
          multiline
          className={cn(
            descriptionClass,
            onImage && 'text-gray-100 [&_a]:text-white',
          )}
          placeholder="Tell your story"
        />
      )}
    </div>
    )
  }

  const renderImageColumn = (opts?: { overlay?: boolean; fullBleed?: boolean }) => {
    const overlay = opts?.overlay ?? false
    const fullBleed = opts?.fullBleed ?? false
    const imageClass = cn(
      'w-full h-full object-cover',
      !clipped && !fullBleed && 'rounded-2xl',
      fullBleed && 'rounded-none',
    )
    const frameClass = cn(
      'w-full shadow-lg',
      overlay
        ? 'h-full min-h-[240px] sm:min-h-[320px] lg:min-h-[360px]'
        : cn(
            'aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5]',
            'max-h-[300px] sm:max-h-[380px] lg:max-h-none',
            'max-lg:mx-auto max-lg:max-w-[280px] sm:max-lg:max-w-sm',
          ),
      fullBleed && 'max-h-none max-w-none mx-0 aspect-[16/10] sm:aspect-[21/9]',
    )

    return (
      <div
        className={cn(
          'about-split-image-col min-w-0 w-full',
          !overlay && 'order-2',
          !overlay && imageOnLeft && 'lg:order-1',
          !overlay && !imageOnLeft && 'lg:order-2',
        )}
      >
        {imageUrl ? (
          <MediaClipFrame clip={mediaClip} className={frameClass}>
            <BuilderSectionImage
              blockId={blockId}
              field="image_url"
              blockProps={props}
              src={imageUrl}
              alt={title ?? 'About'}
              className={imageClass}
            />
          </MediaClipFrame>
        ) : (
          <div
            className={cn(frameClass, 'flex items-center justify-center rounded-2xl')}
            style={{ backgroundColor: `${style.primary_color}10` }}
          >
            <span className="text-gray-400">About Image</span>
          </div>
        )}
      </div>
    )
  }

  const splitGrid = (
    <div
      className={cn(
        'about-split-grid grid grid-cols-1 items-start gap-6 sm:gap-8 lg:gap-12',
        showImage && !isStatement && 'lg:grid-cols-2',
      )}
    >
      <div
        className={cn(
          'about-split-text-wrap min-w-0',
          !isStatement && 'order-1',
          !isStatement && imageOnLeft && 'lg:order-2',
          !isStatement && !imageOnLeft && 'lg:order-1',
        )}
      >
        {renderTextColumn()}
      </div>
      {showImage && !isStatement && renderImageColumn()}
    </div>
  )

  const cardShell = (children: ReactNode) => (
    <div
      className={cn(
        'rounded-2xl border p-4 sm:p-6 md:p-8 lg:p-10',
        isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white shadow-sm',
      )}
    >
      {children}
    </div>
  )

  const inner = (() => {
    if (isOverlay) {
      return (
        <>
          <div className="about-split-grid space-y-6 sm:space-y-8 lg:hidden">
            {renderTextColumn()}
            {renderImageColumn()}
          </div>
          <div className="about-split-overlay relative hidden min-h-[280px] overflow-hidden rounded-2xl sm:min-h-[360px] lg:block">
            <div className="absolute inset-0">
              {renderImageColumn({ overlay: true })}
            </div>
            <div className="absolute inset-0 bg-black/45" aria-hidden />
            <div className="relative z-10 flex min-h-[280px] items-center sm:min-h-[360px]">
              <div className="w-full px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
                <div className="max-w-xl">
                  {renderTextColumn({ onImage: true })}
                </div>
              </div>
            </div>
          </div>
        </>
      )
    }

    if (isFull && showImage) {
      return (
        <div className="space-y-6 sm:space-y-8 lg:space-y-10">
          {renderImageColumn({ fullBleed: true })}
          {renderTextColumn()}
        </div>
      )
    }

    if (isCard) return cardShell(splitGrid)
    return splitGrid
  })()

  const maxWidth = isFull ? 'max-w-none' : 'max-w-6xl'
  const sectionClass = cn(
    'about-split-block',
    builderSectionContainerWithMax(maxWidth),
    isFull && showImage && 'px-0 sm:px-0 lg:px-0',
  )

  if (sectionBg) {
    return (
      <BuilderSectionSurface
        surface={{ backgroundColor: sectionBg, color: sectionText }}
        maxWidth={maxWidth}
        className="about-split-block"
      >
        {inner}
      </BuilderSectionSurface>
    )
  }

  return <section className={sectionClass}>{inner}</section>
}
