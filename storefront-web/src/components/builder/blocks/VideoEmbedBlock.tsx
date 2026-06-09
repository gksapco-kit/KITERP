import { Video } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { MediaClipFrame } from '@/components/builder/MediaClipFrame'
import { hasMediaClip } from '@/lib/mediaClip'

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').pop()
      return `https://www.youtube.com/embed/${id}`
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').pop()
      return `https://player.vimeo.com/video/${id}`
    }
    return url
  } catch { return null }
}

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

export default function VideoEmbedBlock({ style, props, blockId }: Props) {
  const title = (props.title as string) || 'Video'
  const videoUrl = (props.video_url as string) || ''
  const mediaClip = props.media_clip
  const clipped = hasMediaClip(mediaClip)
  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null
  if (!embedUrl) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title}
        message="Paste a YouTube or Vimeo link in the section settings to show your video here."
        icon={<Video className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {(title || blockId) && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className="text-2xl font-bold text-gray-900 mb-6 text-center" />
      )}
      <MediaClipFrame
        clip={mediaClip}
        className={`relative w-full pb-[56.25%] shadow-lg ${!clipped ? 'rounded-2xl overflow-hidden' : ''}`}
      >
        <iframe src={embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" title={title || 'Video'} />
      </MediaClipFrame>
    </section>
  )
}
