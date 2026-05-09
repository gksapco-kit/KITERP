import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function ImageBlock({ props }: Props) {
  const imageUrl = (props.image_url as string) || ''
  const caption = (props.caption as string) || ''
  if (!imageUrl) return null
  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <figure>
        <img src={imageUrl} alt={caption || 'Image'} className="w-full rounded-2xl shadow-sm object-cover" loading="lazy" />
        {caption && <figcaption className="text-center text-sm text-gray-400 mt-3">{caption}</figcaption>}
      </figure>
    </section>
  )
}
