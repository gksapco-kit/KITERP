import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { imgUrl } from '@/lib/utils'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

function borderRadiusPx(style: StyleConfig): number {
  const br = style.border_radius as string | undefined
  if (br === 'none' || br === 'sharp') return 0
  if (br === 'sm') return 4
  if (br === 'lg') return 16
  return 8
}

export default function ImageBlock({ style, props }: Props) {
  const imageRaw = (props.image_url as string) || ''
  const imageUrl = imageRaw ? imgUrl(imageRaw) : ''
  const caption = (props.caption as string) || ''
  const title = (props.title as string) || ''
  const layout = String(props.layout ?? 'centered')
  const cardRadius = borderRadiusPx(style)

  if (!imageUrl) return null

  const imgEl = (
    <img
      src={imageUrl}
      alt={caption || title || 'Image'}
      className={`w-full object-cover ${layout === 'full' ? 'max-h-[480px]' : 'max-h-96'}`}
      style={{ borderRadius: layout === 'full' ? 0 : cardRadius }}
      loading="lazy"
    />
  )

  if (layout === 'full') {
    return <section className="py-0 px-0">{imgEl}</section>
  }

  if (layout === 'split') {
    return (
      <section className="py-8 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-8 items-center max-w-5xl mx-auto">
        <div className="flex-1 w-full">{imgEl}</div>
        <div className="flex-1 space-y-3">
          {caption && <p className="text-sm leading-relaxed" style={{ color: `${style.text_color}99` }}>{caption}</p>}
          {title && <h3 className="text-xl font-bold" style={{ fontFamily: style.font_heading, color: style.text_color }}>{title}</h3>}
        </div>
      </section>
    )
  }

  return (
    <section className={`py-8 px-4 sm:px-6 lg:px-8 ${layout === 'centered' ? 'max-w-3xl mx-auto' : ''}`}>
      <figure>
        {imgEl}
        {Boolean(props.show_caption) && caption && (
          <figcaption className="text-center text-sm mt-3" style={{ color: `${style.text_color}66` }}>{caption}</figcaption>
        )}
      </figure>
    </section>
  )
}
