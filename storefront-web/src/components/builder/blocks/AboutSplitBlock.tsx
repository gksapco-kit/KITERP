import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { imgUrl } from '@/lib/utils'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function AboutSplitBlock({ site, style, props, liveItems }: Props) {
  const profile = liveItems[0]
  const title = (props.title as string) || profile?.title || 'About Us'
  const subtitle = (props.subtitle as string) || 'Our Story'
  const description = (props.description as string) || profile?.description || site.description || ''
  const imageRaw = (props.image_url as string | null) || profile?.image_url || null
  const imageUrl = imageRaw ? imgUrl(imageRaw) : null
  const mediaClip = props.media_clip
  const clipped = hasMediaClip(mediaClip)

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          {subtitle && <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: style.primary_color }}>{subtitle}</p>}
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>
          <p className="text-gray-600 leading-relaxed">{description}</p>
        </div>
        <div>
          {imageUrl ? (
            <MediaClipFrame clip={mediaClip} className="w-full aspect-video shadow-lg">
              <img src={imageUrl} alt={title} className={`w-full h-full object-cover ${!clipped ? 'rounded-2xl' : ''}`} loading="lazy" />
            </MediaClipFrame>
          ) : (
            <div className="w-full aspect-video rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${style.primary_color}10` }}>
              <span className="text-gray-400">About Image</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
