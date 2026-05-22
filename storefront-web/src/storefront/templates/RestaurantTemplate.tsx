import { useEffect, useState } from 'react'
import { Clock, MapPin, Phone, Star } from 'lucide-react'
import { useStorefront, formatMoney } from '../StorefrontContext'
import { StorefrontShell } from '../components/StorefrontShell'
import { buildSurfaceStyle, type StorefrontConfig } from '../theming'
import { getTemplate } from '../templates'
import { useContentField } from '../editContext'
import type { Product } from '../types'
import { Button } from '@/components/ui/button'

const TEMPLATE_ID = 'restaurant'

export const RestaurantTemplate = ({ config, basePath = '/templates/restaurant/preview', liveCatalog = false }: { config?: StorefrontConfig; basePath?: string; liveCatalog?: boolean }) => {
  const tpl = getTemplate(TEMPLATE_ID)!
  const preset = config?.preset ?? 'classic'
  const style = buildSurfaceStyle(tpl, config?.brand)

  return (
    <div className="sf-surface" data-preset={preset} style={style}>
      <StorefrontShell
        storeName={config?.storeName ?? tpl.name}
        tagline={config?.tagline ?? tpl.tagline}
        basePath={basePath}
        nav={[
          { label: 'Menu',          to: `${basePath}#menu` },
          { label: 'Reservations',  to: `${basePath}#reserve` },
          { label: 'Private dining',to: `${basePath}#private` },
          { label: 'Visit',         to: `${basePath}#visit` },
        ]}
      >
        <RestaurantHome liveCatalog={liveCatalog} />
      </StorefrontShell>
    </div>
  )
}

const MOCK_SECTIONS = [
  { id: 'starters', title: 'Starters', filter: 'c-re-1' },
  { id: 'mains', title: 'Mains', filter: 'c-re-2' },
  { id: 'desserts', title: 'Desserts', filter: 'c-re-3' },
] as const

const RestaurantHome = ({ liveCatalog = false }: { liveCatalog?: boolean }) => {
  const { adapter, addToCart, cart } = useStorefront()
  const [items, setItems] = useState<Product[]>([])
  const c = useContentField()

  useEffect(() => {
    adapter.listProducts().then((r) =>
      setItems(liveCatalog ? r.items : r.items.filter((p) => p.id.startsWith('p-re-')))
    )
  }, [adapter, liveCatalog])

  const sections = liveCatalog
    ? [{ id: 'menu', title: 'Menu', filter: '__all__' }]
    : [...MOCK_SECTIONS]

  return (
    <>
      {/* Info strip */}
      <div data-edit-id="info" className="border-b py-2 text-xs px-4 text-center opacity-90" style={{ borderColor: 'hsl(var(--sf-border))' }}>
        <span className="inline-flex items-center gap-1.5 mr-4"><MapPin className="h-3 w-3" /> {c('info.address', '14 Larch Lane, Brooklyn NY')}</span>
        <span className="inline-flex items-center gap-1.5 mr-4"><Clock className="h-3 w-3" /> {c('info.hours', 'Tue–Sun · 5pm – 11pm')}</span>
        <span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c('info.phone', '+1 (212) 555-0184')}</span>
      </div>

      {/* Hero */}
      <section
        data-edit-id="hero"
        className="relative flex min-h-[min(40dvh,280px)] h-[min(58dvh,480px)] max-h-[min(88dvh,720px)] items-end overflow-hidden sm:min-h-[360px] sm:h-[64vh] md:min-h-[400px] md:h-[68vh] lg:min-h-[420px]"
      >
        <img
          src={c('hero.image', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=2000&q=80')}
          alt="Restaurant signature dish"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-8 md:px-12 pb-12 sm:pb-16 text-white w-full min-w-0">
          <span className="text-xs sm:text-xs uppercase tracking-[0.22em] sm:tracking-[0.3em] opacity-80">
            {c('hero.badge', 'Seasonal · Tasting menu')}
          </span>
          <h1 className="text-[clamp(1.5rem,4vw_+_0.45rem,2.85rem)] sm:text-[clamp(1.85rem,4.2vw_+_0.45rem,3.35rem)] md:text-[clamp(2.1rem,4.5vw_+_0.45rem,3.6rem)] lg:text-[clamp(2.35rem,5vw_+_0.5rem,4.25rem)] mt-3 mb-4 max-w-full sm:max-w-3xl leading-[1.08] sm:leading-[1.02] hyphens-none break-words" style={{ fontFamily: 'var(--sf-display)' }}>
            {c('hero.headline', 'A modern table, set in the old way.')}
          </h1>
          <p className="opacity-90 max-w-xl mb-6">
            {c('hero.subtitle', 'Wood-fired plates, low-intervention wines and a menu that changes with what arrives at the door.')}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="rounded-none h-12 px-7" style={{ background: 'hsl(var(--sf-accent))', color: 'hsl(var(--sf-primary-foreground))' }}>
              {c('hero.cta1', 'Reserve a table')}
            </Button>
            <Button size="lg" variant="outline" className="rounded-none h-12 px-7 bg-transparent text-white" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
              {c('hero.cta2', 'Order takeout')}
            </Button>
          </div>
        </div>
      </section>

      {/* Menu */}
      <section data-edit-id="menu" className="max-w-5xl mx-auto px-6 sm:px-12 py-20" id="menu">
        <div className="text-center mb-12">
          <span className="text-xs uppercase tracking-[0.3em] opacity-70">
            {c('menu.season', 'Spring menu')}
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl mt-2" style={{ fontFamily: 'var(--sf-display)' }}>
            {c('menu.heading', "What we're cooking")}
          </h2>
        </div>

        <div className="space-y-16">
          {sections.map((s) => (
            <div key={s.id} id={s.id}>
              <div className="flex items-baseline gap-4 mb-6">
                <h3 className="text-2xl" style={{ fontFamily: 'var(--sf-display)' }}>{s.title}</h3>
                <div className="flex-1 border-b" style={{ borderColor: 'hsl(var(--sf-border))' }} />
              </div>
              <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
                {items.filter((i) => s.filter === '__all__' || i.categoryIds.includes(s.filter)).map((item) => (
                  <li key={item.id} className="flex gap-4 group">
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden" style={{ background: 'hsl(var(--sf-muted))' }}>
                      <img src={item.images[0].url} alt={item.images[0].alt} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h4 className="text-lg leading-tight" style={{ fontFamily: 'var(--sf-display)' }}>{item.title}</h4>
                        <span className="text-base font-medium whitespace-nowrap">{formatMoney(item.variants[0].price)}</span>
                      </div>
                      <p className="text-sm opacity-70 mt-1">{item.description}</p>
                      <div className="mt-3 flex items-center gap-3">
                        {item.badges?.[0] ? (
                          <span className="text-xs uppercase tracking-[0.2em] px-2 py-0.5 border" style={{ borderColor: 'hsl(var(--sf-accent))', color: 'hsl(var(--sf-accent))' }}>{item.badges[0]}</span>
                        ) : null}
                        <button onClick={() => { const v = item.variants[0]; addToCart({ productId: item.id, variantId: v.id, quantity: 1, name: item.title, variantLabel: v.name, imageUrl: item.images[0]?.url, unitPrice: v.price, inStock: v.inStock }) }} className="text-xs underline opacity-80 hover:opacity-100">
                          Add to order
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Review quote */}
      <section data-edit-id="review" className="border-t py-20 px-6" style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-muted) / 0.4)' }} id="visit">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-4 gap-0.5" style={{ color: 'hsl(var(--sf-accent))' }}>
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
          </div>
          <p className="text-2xl leading-snug text-balance" style={{ fontFamily: 'var(--sf-display)' }}>
            {c('review.quote', '"An honest, generous, deeply seasonal kitchen. Every plate feels like it could only have come from this room."')}
          </p>
          <div className="mt-4 text-xs uppercase tracking-[0.2em] opacity-70">
            {c('review.attribution', '— New York Eater · 2025')}
          </div>
        </div>
      </section>

      {/* Sticky cart bar */}
      {cart && cart.lines.length > 0 ? (
        <div className="sticky bottom-0 z-20 border-t" style={{ background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))', borderColor: 'hsl(var(--sf-border))' }}>
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="text-sm">{cart.lines.reduce((s, l) => s + l.quantity, 0)} items in your order · {formatMoney(cart.subtotal)}</div>
            <Button size="sm" className="rounded-none" style={{ background: 'hsl(var(--sf-accent))', color: 'hsl(var(--sf-primary-foreground))' }}>View order</Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
