import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { cn, imgUrl } from '@/lib/utils'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'

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

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className={cn('grid gap-12 items-center', showImage ? 'lg:grid-cols-2' : 'grid-cols-1')}>
        {(showSubtitle || showTitle || showDescription) && (
        <div>
          {showSubtitle && (
            <BuilderTextField
              fieldKey="subtitle"
              blockId={blockId}
              blockProps={props}
              value={subtitle ?? ''}
              as="p"
              className="text-sm font-semibold uppercase tracking-widest mb-2"
              style={{ color: style.primary_color }}
            />
          )}
          {showTitle && (
            <BuilderTextField
              fieldKey="title"
              blockId={blockId}
              blockProps={props}
              value={title ?? ''}
              as="h2"
              className="text-3xl font-bold text-gray-900 mb-4"
            />
          )}
          {showDescription && (
            <BuilderTextField
              fieldKey="description"
              blockId={blockId}
              blockProps={props}
              value={description ?? ''}
              as="p"
              multiline
              className="text-gray-600 leading-relaxed"
              placeholder="Tell your story"
            />
          )}
        </div>
        )}
        {showImage && (
        <div>
          {imageUrl ? (
            <MediaClipFrame clip={mediaClip} className="w-full aspect-video shadow-lg">
              <BuilderSectionImage
                blockId={blockId}
                field="image_url"
                blockProps={props}
                src={imageUrl}
                alt={title ?? 'About'}
                className={`w-full h-full object-cover ${!clipped ? 'rounded-2xl' : ''}`}
              />
            </MediaClipFrame>
          ) : (
            <div className="w-full aspect-video rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${style.primary_color}10` }}>
              <span className="text-gray-400">About Image</span>
            </div>
          )}
        </div>
        )}
      </div>
    </section>
  )
}
