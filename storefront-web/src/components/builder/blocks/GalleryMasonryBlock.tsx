import { useState } from 'react'
import { ImageIcon, X } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { columnsFromProps, sectionGridColumnClass, sectionItemGap } from '@/lib/sectionItemLayout'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

export default function GalleryMasonryBlock({ style, props, liveItems, blockId }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const title = (props.title as string) || 'Gallery'
  const layout = String(props.layout ?? 'grid')
  const columns = columnsFromProps(props, layout === 'featured' ? 'grid-3' : layout)
  const itemGap = sectionItemGap(props, 12)
  const propImages = Array.isArray(props.images)
    ? (props.images as { src?: string; alt?: string }[]).filter(img => img?.src)
    : []
  const liveImages = liveItems.filter(i => i.image_url).map(i => ({ url: i.image_url as string, alt: i.title }))
  const images = propImages.length > 0
    ? propImages.map(img => ({ url: img.src as string, alt: img.alt || '' }))
    : liveImages

  if (images.length === 0) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title}
        message="Add photos to bring this gallery to life. Use Images & media in the builder or upload from the Media panel."
        hint="You can also drag images directly onto this section from your media library."
        icon={<ImageIcon className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

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
      {(title || blockId) && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className="text-3xl font-bold text-gray-900 mb-8 text-center" />
      )}
      {layout === 'featured' ? (
        <div className="grid grid-cols-3 grid-rows-2 max-w-5xl mx-auto min-h-[320px]" style={{ gap: itemGap }}>
          <Img url={images[0].url} alt={images[0].alt} className="col-span-2 row-span-2 h-full min-h-[280px] rounded-xl" />
          {images.slice(1, 3).map((img, i) => (
            <Img key={i} url={img.url} alt={img.alt} className="h-full min-h-[130px]" />
          ))}
        </div>
      ) : layout === 'masonry' ? (
        <div className={cn('columns-2 sm:columns-3 gap-4 space-y-4 max-w-5xl mx-auto', columns >= 4 && 'lg:columns-4', columns >= 5 && 'lg:columns-5')} style={{ columnGap: itemGap }}>
          {images.map((img, i) => (
            <Img key={i} url={img.url} alt={img.alt} className="break-inside-avoid mb-4" />
          ))}
        </div>
      ) : (
        <div className={cn('grid max-w-5xl mx-auto', sectionGridColumnClass(columns))} style={{ gap: itemGap }}>
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
