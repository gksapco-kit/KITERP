import { Quote, Star } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { cn } from '@/lib/utils'
import { isLiveTestimonialsBound, isTemplateTestimonial } from '@/lib/testimonialPlaceholders'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { columnsFromProps, sectionGridColumnClass, sectionItemGap } from '@/lib/sectionItemLayout'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

function TestimonialCard({
  item,
  style,
  dark,
  compact,
}: {
  item: LiveItem
  style: StyleConfig
  dark?: boolean
  compact?: boolean
}) {
  return (
    <div className={cn(
      'builder-tile-card rounded-2xl border p-6 relative',
      dark ? 'border-white/10 bg-white/5' : 'bg-white border-gray-100',
      compact && 'p-4',
    )}>
      <Quote className="w-8 h-8 opacity-10 absolute top-4 right-4" style={{ color: style.primary_color }} />
      {item.rating != null && (
        <div className="flex gap-0.5 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`w-4 h-4 ${i < (item.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
          ))}
        </div>
      )}
      <p className={cn('leading-relaxed mb-4', compact ? 'text-xs' : 'text-sm', dark ? 'text-white/80' : 'text-gray-600')}>
        "{item.description}"
      </p>
      <div className="flex items-center gap-3">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: style.primary_color }}>
            {item.title.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className={cn('font-semibold text-sm', dark ? 'text-white' : 'text-gray-900')}>{item.title}</p>
          {item.subtitle && <p className={cn('text-xs', dark ? 'text-white/60' : 'text-gray-400')}>{item.subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default function TestimonialsBlock({ style, props, liveItems, blockId }: Props) {
  const title = (props.title as string) || 'What Our Customers Say'
  const sectionTitle = (className: string) => (
    (title || blockId) ? (
      <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className={className} />
    ) : null
  )
  const layout = String(props.layout ?? 'grid')
  const columns = columnsFromProps(props, layout === 'grid' ? 'grid-3' : layout)
  const itemGap = sectionItemGap(props, 24)
  const surface = resolveSectionSurface(props, style)
  const liveBound = isLiveTestimonialsBound(props)
  const staticTestis = (props.testimonials as Array<{
    name: string; role?: string; company?: string; quote: string; rating?: number
  }> | undefined) || []
  const manualTestis = staticTestis.filter(t => !isTemplateTestimonial(t))

  const items = liveItems.length > 0
    ? liveItems
    : liveBound || staticTestis.some(isTemplateTestimonial)
      ? []
      : manualTestis.map(t => ({
          id: t.name,
          title: t.name,
          subtitle: [t.role, t.company].filter(Boolean).join(', ') || null,
          description: t.quote,
          image_url: null,
          price: null,
          price_formatted: null,
          rating: t.rating ?? 5,
          url: null,
          meta: {},
        } as LiveItem))

  if (items.length === 0) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto text-center" style={{ background: surface.background, color: surface.color }}>
        <BlockEmptyPlaceholder
          style={style}
          title={title}
          message="Customer quotes will appear here. Edit the sample reviews in the builder or connect live testimonials from your catalog."
        />
      </section>
    )
  }

  const colClass = sectionGridColumnClass(columns)
  const dark = surface.isDark

  if (layout === 'centered') {
    const item = items[0]
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto text-center" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-3xl font-bold mb-10')}
        <TestimonialCard item={item} style={style} dark={dark} />
      </section>
    )
  }

  if (layout === 'list') {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-3xl font-bold mb-10 text-center')}
        <div className="space-y-4" style={{ gap: itemGap }}>
          {items.map(item => <TestimonialCard key={item.id} item={item} style={style} dark={dark} compact />)}
        </div>
      </section>
    )
  }

  if (layout === 'carousel') {
    return (
      <section className="py-16 px-4" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-3xl font-bold mb-8 text-center px-4')}
        <div className="flex overflow-x-auto pb-4 px-4 snap-x snap-mandatory" style={{ gap: itemGap }}>
          {items.map(item => (
            <div key={item.id} className="snap-start shrink-0 w-80">
              <TestimonialCard item={item} style={style} dark={dark} />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (layout === 'masonry') {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" style={{ background: surface.background, color: surface.color }}>
        {sectionTitle('text-3xl font-bold mb-10 text-center')}
        <div className="columns-1 sm:columns-2 gap-6 space-y-6">
          {items.map(item => (
            <div key={item.id} className="break-inside-avoid mb-6">
              <TestimonialCard item={item} style={style} dark={dark} />
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" style={{ background: surface.background, color: surface.color }}>
      {sectionTitle('text-3xl font-bold mb-10 text-center')}
      <div className={cn('grid grid-cols-1 sm:grid-cols-2', colClass)} style={{ gap: itemGap }}>
        {items.map(item => <TestimonialCard key={item.id} item={item} style={style} dark={dark} />)}
      </div>
    </section>
  )
}
