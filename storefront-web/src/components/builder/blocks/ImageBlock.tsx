import { ImageIcon } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { cn, imgUrl } from '@/lib/utils'
import { imageShapeFromProps, imageShapeRadiusClass } from '@/lib/sectionItemLayout'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'
import { siteRadiusPx } from '@/lib/siteBorderRadius'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { builderSectionContainerClass, builderSectionContainerWithMax } from '@/lib/builderSectionLayout'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

export default function ImageBlock({ style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const imageHidden = isBlockFieldHidden(props, 'image_url')
  const imageRaw = imageHidden ? '' : ((props.image_url as string) || '')
  const imageUrl = imageRaw ? imgUrl(imageRaw) : ''
  const caption = resolveBlockTextField(props, 'caption')
  const title = resolveBlockTextField(props, 'title')
  const layout = String(props.layout ?? 'centered')
  const imageShape = imageShapeFromProps(props)
  const cardRadius = siteRadiusPx(style.border_radius, 'lg')
  const mediaClip = props.media_clip
  const clipped = hasMediaClip(mediaClip)

  const showImage = !imageHidden && (imageUrl || isEditorCanvas)
  const showCaption = !isBlockFieldHidden(props, 'caption') && (caption || isEditorCanvas)
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  if (!showImage && !showCaption && !showTitle && !isEditorCanvas) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title="Image"
        message="Choose an image from the Media panel or right-click this section → Images & media."
        icon={<ImageIcon className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

  const imgEl = showImage ? (
    imageUrl ? (
      <MediaClipFrame clip={mediaClip} className="w-full">
        <BuilderSectionImage
          blockId={blockId}
          field="image_url"
          blockProps={props}
          src={imageUrl}
          alt={caption || title || 'Image'}
          className={cn(
            'w-full',
            layout === 'full' ? 'max-h-[480px]' : 'max-h-96',
            !clipped && imageShape === 'circle' && 'aspect-square max-w-md mx-auto object-cover',
            !clipped && imageShape !== 'rounded' && imageShapeRadiusClass(imageShape),
          )}
          style={{
            borderRadius: clipped || imageShape !== 'rounded'
              ? undefined
              : layout !== 'full'
                ? cardRadius
                : 0,
          }}
        />
      </MediaClipFrame>
    ) : (
      <div
        className={cn(
          'w-full flex items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 text-sm',
          layout === 'full' ? 'max-h-[480px] min-h-[200px]' : 'max-h-96 min-h-[160px]',
          !clipped && imageShape === 'circle' && 'aspect-square max-w-md mx-auto rounded-full',
        )}
        style={{
          borderRadius: clipped || imageShape !== 'rounded'
            ? undefined
            : layout !== 'full'
              ? cardRadius
              : 0,
        }}
      >
        Image
      </div>
    )
  ) : null

  if (layout === 'full') {
    if (!imgEl) return null
    return <section className="py-0 px-0">{imgEl}</section>
  }

  if (layout === 'split') {
    return (
      <section className={builderSectionContainerWithMax('max-w-5xl', 'flex flex-col md:flex-row gap-8 items-center')}>
        {imgEl ? <div className="flex-1 w-full">{imgEl}</div> : null}
        {(showCaption || showTitle) && (
          <div className="flex-1 space-y-3">
            {showCaption && (
              <BuilderTextField fieldKey="caption" blockId={blockId} blockProps={props} value={caption ?? ''} as="p" multiline className="text-sm leading-relaxed" style={{ color: `${style.text_color}99` }} placeholder="Caption" />
            )}
            {showTitle && (
              <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h3" className="text-xl font-bold" style={{ fontFamily: style.font_heading, color: style.text_color }} placeholder="Title" />
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className={layout === 'centered' ? builderSectionContainerWithMax('max-w-3xl') : builderSectionContainerClass()}>
      <figure>
        {imgEl}
        {(Boolean(props.show_caption) && showCaption) && (
          <figcaption className="text-center text-sm mt-3" style={{ color: `${style.text_color}66` }}>
            <BuilderTextField fieldKey="caption" blockId={blockId} blockProps={props} value={caption ?? ''} as="span" multiline placeholder="Caption" />
          </figcaption>
        )}
      </figure>
    </section>
  )
}
