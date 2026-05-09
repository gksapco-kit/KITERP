import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

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

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function VideoEmbedBlock({ props }: Props) {
  const title = (props.title as string) || ''
  const videoUrl = (props.video_url as string) || ''
  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null
  if (!embedUrl) return null
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {title && <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{title}</h2>}
      <div className="relative w-full pb-[56.25%] rounded-2xl overflow-hidden shadow-lg">
        <iframe src={embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" title={title || 'Video'} />
      </div>
    </section>
  )
}
