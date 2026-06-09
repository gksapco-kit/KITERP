import { ImageIcon } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { imgUrl } from '@/lib/utils'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

function borderRadiusPx(style: StyleConfig): number {
  const br = style.border_radius as string | undefined
  if (br === 'none' || br === 'sharp') return 0
  if (br === 'sm') return 4
  if (br === 'lg') return 16
  return 8
}

export default function ImageBlock({ style, props, blockId }: Props) {
  const imageRaw = (props.image_url as string) || ''
  const imageUrl = imageRaw ? imgUrl(imageRaw) : ''
  const caption = (props.caption as string) || ''
  const title = (props.title as string) || ''
  const layout = String(props.layout ?? 'centered')
  const cardRadius = borderRadiusPx(style)
  const mediaClip = props.media_clip
  const clipped = hasMediaClip(mediaClip)

  if (!imageUrl) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title || 'Image'}
        message="Choose an image from the Media panel or right-click this section → Images & media."
        icon={<ImageIcon className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

  const imgEl = (
    <MediaClipFrame clip={mediaClip} className="w-full">
      <BuilderSectionImage
        blockId={blockId}
        field="image_url"
        blockProps={props}
        src={imageUrl}
        alt={caption || title || 'Image'}
        className={`w-full ${layout === 'full' ? 'max-h-[480px]' : 'max-h-96'}`}
        style={{ borderRadius: !clipped && layout !== 'full' ? cardRadius : layout === 'full' ? 0 : 0 }}
      />
    </MediaClipFrame>
  )

  if (layout === 'full') {
    return <section className="py-0 px-0">{imgEl}</section>
  }

  if (layout === 'split') {
    return (
      <section className="py-8 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-8 items-center max-w-5xl mx-auto">
        <div className="flex-1 w-full">{imgEl}</div>
        <div className="flex-1 space-y-3">
          {(caption || blockId) && (
            <BuilderTextField fieldKey="caption" blockId={blockId} blockProps={props} value={caption} as="p" multiline className="text-sm leading-relaxed" style={{ color: `${style.text_color}99` }} />
          )}
          {(title || blockId) && (
            <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h3" className="text-xl font-bold" style={{ fontFamily: style.font_heading, color: style.text_color }} />
          )}
        </div>
      </section>
    )
  }

  return (
    <section className={`py-8 px-4 sm:px-6 lg:px-8 ${layout === 'centered' ? 'max-w-3xl mx-auto' : ''}`}>
      <figure>
        {imgEl}
        {(Boolean(props.show_caption) && (caption || blockId)) && (
          <figcaption className="text-center text-sm mt-3" style={{ color: `${style.text_color}66` }}>
            <BuilderTextField fieldKey="caption" blockId={blockId} blockProps={props} value={caption} as="span" multiline />
          </figcaption>
        )}
      </figure>
    </section>
  )
}
