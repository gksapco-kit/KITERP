import { useState } from 'react'
import { X } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function GalleryMasonryBlock({ props, liveItems }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const title = (props.title as string) || ''
  const images = liveItems.filter(i => i.image_url).map(i => ({ url: i.image_url as string, alt: i.title }))
  if (images.length === 0) return null
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">{title}</h2>}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
        {images.map((img, i) => (
          <img key={i} src={img.url} alt={img.alt} onClick={() => setLightbox(img.url)} className="w-full rounded-xl cursor-pointer hover:opacity-90 transition-opacity break-inside-avoid mb-4" loading="lazy" />
        ))}
      </div>
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}><X className="w-8 h-8" /></button>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </section>
  )
}
