import { MapPin, Phone, Star } from 'lucide-react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { imgUrl } from '@/lib/utils'
import { asObjectList, swatchImage, useSilkAtelierTheme } from './shared'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  blockId?: string
  isEditorCanvas?: boolean
}

interface Store extends Record<string, unknown> {
  city?: string
  name?: string
  address?: string
  image_url?: string
  phone?: string
  map_url?: string
  rating?: number | string
  reviews?: number | string
}

/** "Visit our stores" — branch cards with city tag, rating, directions and call actions. */
export default function SilkAtelierStores({ style, props }: Props) {
  const theme = useSilkAtelierTheme(style, props)
  const stores = asObjectList<Store>(props.stores)
  const columns = Math.min(3, Math.max(1, Number(props.columns) || 2))

  return (
    <section className="w-full" style={{ background: 'linear-gradient(180deg, #FBF8F5 0%, #F7ECF1 100%)', fontFamily: theme.bodyFont }}>
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-8 sm:py-16">
        <header className="text-center">
          {props.chip ? (
            <span
              className="inline-block rounded-full bg-white px-4 py-1.5 text-[11px] font-semibold uppercase italic tracking-[0.2em]"
              style={{ border: `1px solid ${theme.accent}55`, color: theme.primary }}
            >
              {String(props.chip)}
            </span>
          ) : null}
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl" style={{ color: theme.highlight, fontFamily: theme.headingFont }}>
            {String(props.title || 'Visit Our Stores')}
          </h2>
          {props.subtitle ? <p className="mx-auto mt-3 max-w-xl text-[15px] italic" style={{ color: `${theme.ink}aa` }}>{String(props.subtitle)}</p> : null}
        </header>

        <div className="mt-10 grid gap-6" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${columns === 1 ? 420 : columns === 2 ? 320 : 260}px, 1fr))` }}>
          {stores.map((s, i) => {
            const rating = Number(s.rating) || 0
            const reviews = Number(s.reviews) || 0
            return (
              <article key={`${s.name}-${i}`} className="overflow-hidden rounded-2xl bg-white shadow-lg" style={{ border: `1px solid ${theme.accent}33` }}>
                <div className="relative aspect-[16/9] w-full" style={{ background: '#2a1620' }}>
                  <img src={imgUrl(s.image_url as string) || swatchImage(String(s.name || i), 640, 360)} alt={String(s.name || '')} loading="lazy" className="h-full w-full object-cover" />
                  {s.city ? (
                    <span className="absolute left-4 top-4 rounded-full px-4 py-1 text-[11px] font-semibold uppercase italic tracking-wide text-white" style={{ background: theme.primary }}>
                      {String(s.city)}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2 p-5">
                  <h3 className="text-xl font-semibold" style={{ color: theme.primary, fontFamily: theme.headingFont }}>{s.name}</h3>
                  {rating > 0 ? (
                    <p className="flex items-center gap-1.5 text-sm" style={{ color: theme.ink }}>
                      <span className="flex" style={{ color: theme.accent }} aria-label={`${rating} out of 5`}>
                        {Array.from({ length: 5 }, (_, k) => <Star key={k} className="h-3.5 w-3.5 fill-current" aria-hidden />)}
                      </span>
                      <strong>{rating.toFixed(1)}</strong>
                      {reviews > 0 ? <span className="opacity-60">{reviews.toLocaleString('en-IN')} Google reviews</span> : null}
                    </p>
                  ) : null}
                  {s.address ? <p className="text-[13px] leading-snug" style={{ color: `${theme.ink}cc` }}>{String(s.address)}</p> : null}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {s.map_url ? (
                      <a
                        href={String(s.map_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white"
                        style={{ background: theme.primary }}
                      >
                        <MapPin className="h-3.5 w-3.5" aria-hidden /> Get Directions
                      </a>
                    ) : null}
                    {s.phone ? (
                      <a
                        href={`tel:${String(s.phone).replace(/[^\d+]/g, '')}`}
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
                        style={{ border: `1px solid ${theme.primary}`, color: theme.primary }}
                      >
                        <Phone className="h-3.5 w-3.5" aria-hidden /> Call
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
