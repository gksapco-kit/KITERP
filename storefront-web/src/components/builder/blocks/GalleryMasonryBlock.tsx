import { useState } from 'react'
import { X } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function GalleryMasonryBlock({ props, liveItems }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const title = (props.title as string) || ''
  const layout = String(props.layout ?? 'grid')
  const columns = Number(props.columns) || (layout === 'featured' ? 3 : 4)
  const propImages = Array.isArray(props.images)
    ? (props.images as { src?: string; alt?: string }[]).filter(img => img?.src)
    : []
  const liveImages = liveItems.filter(i => i.image_url).map(i => ({ url: i.image_url as string, alt: i.title }))
  const images = propImages.length > 0
    ? propImages.map(img => ({ url: img.src as string, alt: img.alt || '' }))
    : liveImages
  if (images.length === 0) return null

  const Img = ({ url, alt, className }: { url: string; alt: string; className?: string }) => (
    <img
      src={imgUrl(url)}
      alt={alt}
      onClick={() => setLightbox(url)}
      className={cn('w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity', className)}
      loading="lazy"
    />
  )

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">{title}</h2>}
      {layout === 'featured' ? (
        <div className="grid grid-cols-3 grid-rows-2 gap-3 max-w-5xl mx-auto min-h-[320px]">
          <Img url={images[0].url} alt={images[0].alt} className="col-span-2 row-span-2 h-full min-h-[280px] rounded-xl" />
          {images.slice(1, 3).map((img, i) => (
            <Img key={i} url={img.url} alt={img.alt} className="h-full min-h-[130px]" />
          ))}
        </div>
      ) : layout === 'masonry' ? (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4 max-w-5xl mx-auto">
          {images.map((img, i) => (
            <Img key={i} url={img.url} alt={img.alt} className="break-inside-avoid mb-4" />
          ))}
        </div>
      ) : (
        <div
          className="grid gap-3 max-w-5xl mx-auto"
          style={{ gridTemplateColumns: `repeat(${Math.min(columns, 4)}, 1fr)` }}
        >
          {images.map((img, i) => (
            <Img
              key={i}
              url={img.url}
              alt={img.alt}
              className={columns <= 2 ? 'aspect-[4/3]' : 'aspect-square'}
            />
          ))}
        </div>
      )}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setLightbox(null)}>
          <button type="button" className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}><X className="w-8 h-8" /></button>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </section>
  )
}
