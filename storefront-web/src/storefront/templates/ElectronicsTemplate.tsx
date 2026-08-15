import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cpu, Headphones, Smartphone, Star, Zap } from 'lucide-react'
import { useStorefront, formatMoney } from '../StorefrontContext'
import { StorefrontShell } from '../components/StorefrontShell'
import { buildSurfaceStyle, type StorefrontConfig } from '../theming'
import { getTemplate } from '../templates'
import { useContentField } from '../editContext'
import type { Product } from '../types'
import { Button } from '@/components/ui/button'

const TEMPLATE_ID = 'electronics'

export const ElectronicsTemplate = ({ config, basePath = '/templates/electronics/preview', liveCatalog = false }: { config?: StorefrontConfig; basePath?: string; liveCatalog?: boolean }) => {
  const tpl = getTemplate(TEMPLATE_ID)!
  const preset = config?.preset ?? 'bold'
  const style = buildSurfaceStyle(tpl, config?.brand)

  return (
    <div className="sf-surface" data-preset={preset} style={style}>
      <StorefrontShell
        storeName={config?.storeName ?? tpl.name}
        tagline={config?.tagline ?? tpl.tagline}
        basePath={basePath}
        nav={[
          { label: 'Phones',  to: `${basePath}#phones` },
          { label: 'Laptops', to: `${basePath}#laptops` },
          { label: 'Audio',   to: `${basePath}#audio` },
          { label: 'Deals',   to: `${basePath}#deals` },
          { label: 'Support', to: `${basePath}#support` },
        ]}
      >
        <ElectronicsHome filterMockElectronicsOnly={!liveCatalog} />
      </StorefrontShell>
    </div>
  )
}

const ElectronicsHome = ({ filterMockElectronicsOnly = true }: { filterMockElectronicsOnly?: boolean }) => {
  const { adapter, addToCart } = useStorefront()
  const [products, setProducts] = useState<Product[]>([])
  const c = useContentField()

  useEffect(() => {
    adapter.listProducts().then((r) =>
      setProducts(filterMockElectronicsOnly ? r.items.filter((p) => p.id.startsWith('p-el-')) : r.items)
    )
  }, [adapter, filterMockElectronicsOnly])

  const hero = products[0]

  return (
    <>
      {/* Deals strip */}
      <div data-edit-id="deals" className="text-center text-xs py-2" style={{ background: 'hsl(var(--sf-accent))', color: 'hsl(var(--sf-primary-foreground))' }}>
        <Zap className="inline h-3 w-3 mr-1" />
        {c('deals.text', 'Spring Sale · up to 25% off select audio · 2-year warranty included')}
      </div>

      {/* Hero */}
      <section data-edit-id="hero" className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-16 lg:py-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div>
            <span className="inline-block text-xs uppercase tracking-[0.25em] opacity-70 mb-5">
              {c('hero.badge', 'Aurora X14 · just landed')}
            </span>
            <h1 className="text-[clamp(1.65rem,4vw_+_0.45rem,2.65rem)] sm:text-[clamp(2rem,4.5vw_+_0.5rem,3.25rem)] md:text-[clamp(2.35rem,5vw_+_0.45rem,3.75rem)] lg:text-[clamp(2.75rem,5.5vw,4.25rem)] font-bold leading-[0.95] mb-6 tracking-tight" style={{ fontFamily: 'var(--sf-display)' }}>
              {c('hero.line1', 'Power,')} <span style={{ color: 'hsl(var(--sf-accent))' }}>{c('hero.line2', 'perfected.')}</span>
            </h1>
            <p className="text-lg opacity-80 mb-8 max-w-lg">
              {c('hero.subtitle', 'The fastest mobile chip we\'ve ever shipped. 120Hz OLED. Triple 50MP camera. A titanium frame you can actually feel.')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="rounded-none h-12 px-8" style={{ background: 'hsl(var(--sf-accent))', color: 'hsl(var(--sf-primary-foreground))' }}>
                {c('hero.cta1', 'Pre-order')} — {hero ? formatMoney(hero.variants[0].price) : '$899'}
              </Button>
              <Button size="lg" variant="outline" className="rounded-none h-12 px-8 bg-transparent" style={{ borderColor: 'hsl(var(--sf-fg) / 0.4)', color: 'hsl(var(--sf-fg))' }}>
                Compare models
              </Button>
            </div>
            <dl data-edit-id="specs" className="grid grid-cols-3 gap-6 mt-12 max-w-md">
              {[
                { l: 'Display', v: c('specs.display', '6.7" OLED') },
                { l: 'Refresh', v: c('specs.refresh', '120 Hz') },
                { l: 'Battery', v: c('specs.battery', '4800 mAh') },
              ].map((s) => (
                <div key={s.l}>
                  <dd className="text-2xl" style={{ fontFamily: 'var(--sf-display)' }}>{s.v}</dd>
                  <dt className="text-xs uppercase tracking-[0.18em] opacity-60 mt-1">{s.l}</dt>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-[min(100%,260px)] sm:max-w-md">
            <div className="absolute inset-0 rounded-full blur-3xl opacity-40" style={{ background: 'hsl(var(--sf-accent))' }} />
            <img src={c('hero.image', 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80')} alt="Smartphone hero" className="relative h-full w-full object-contain object-center" />
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="border-y py-16 px-6 sm:px-12" style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-muted) / 0.3)' }}>
        <div className="max-w-7xl mx-auto grid sm:grid-cols-3 gap-4">
          {[
            { Icon: Smartphone, name: 'Phones',   count: '48 products' },
            { Icon: Cpu,        name: 'Laptops',  count: '26 products' },
            { Icon: Headphones, name: 'Audio',    count: '92 products' },
          ].map(({ Icon, name, count }) => (
            <a key={name} href="#" className="group p-8 border flex items-center gap-5 transition-colors" style={{ borderColor: 'hsl(var(--sf-border))' }}>
              <div className="h-14 w-14 grid place-items-center" style={{ background: 'hsl(var(--sf-accent) / 0.15)', color: 'hsl(var(--sf-accent))' }}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="text-lg" style={{ fontFamily: 'var(--sf-display)' }}>{name}</div>
                <div className="text-xs opacity-60">{count}</div>
              </div>
              <span className="opacity-50 group-hover:opacity-100 transition-opacity">→</span>
            </a>
          ))}
        </div>
      </section>

      {/* Product grid */}
      <section data-edit-id="products" className="max-w-7xl mx-auto px-6 sm:px-12 py-20" id="deals">
        <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] opacity-70">
              {c('products.eyebrow', 'Featured')}
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl mt-2" style={{ fontFamily: 'var(--sf-display)' }}>
              {c('products.heading', 'Top rated this season')}
            </h2>
          </div>
          <div className="flex gap-2 text-xs">
            {['All', 'Aurora', 'Volt', 'Hush', 'Pulse'].map((b, i) => (
              <button key={b} className="px-3 py-1.5 border" style={{ borderColor: 'hsl(var(--sf-border))', background: i === 0 ? 'hsl(var(--sf-fg))' : 'transparent', color: i === 0 ? 'hsl(var(--sf-bg))' : 'hsl(var(--sf-fg))' }}>{b}</button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <article key={p.id} className="border flex flex-col" style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-bg))' }}>
              <div className="aspect-square relative" style={{ background: 'hsl(var(--sf-muted) / 0.4)' }}>
                <img src={p.images[0].url} alt={p.images[0].alt} className="absolute inset-0 w-full h-full object-cover object-center" loading="lazy" />
                {p.badges?.[0] ? (
                  <span className="absolute top-3 left-3 text-xs uppercase tracking-[0.18em] px-2 py-1" style={{ background: 'hsl(var(--sf-accent))', color: 'hsl(var(--sf-primary-foreground))' }}>{p.badges[0]}</span>
                ) : null}
              </div>
              <div className="p-5 border-t flex-1 flex flex-col" style={{ borderColor: 'hsl(var(--sf-border))' }}>
                <div className="text-xs uppercase tracking-[0.18em] opacity-60">{p.brand}</div>
                <h3 className="text-lg mt-1 mb-2" style={{ fontFamily: 'var(--sf-display)' }}>{p.title}</h3>
                {p.attributes ? (
                  <ul className="text-xs opacity-70 space-y-1 mb-4">
                    {Object.entries(p.attributes).slice(0, 3).map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-2"><span>{k}</span><span className="font-medium opacity-100">{v}</span></li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-auto flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">{formatMoney(p.variants[0].price)}</div>
                    {p.rating ? <div className="text-xs opacity-60 flex items-center gap-1"><Star className="h-3 w-3 fill-current" />{p.rating.value} ({p.rating.count})</div> : null}
                  </div>
                  <Button size="sm" className="rounded-none" onClick={() => { const v = p.variants[0]; addToCart({ productId: p.id, variantId: v.id, quantity: 1, name: p.title, variantLabel: v.name, imageUrl: p.images[0]?.url, unitPrice: v.price, inStock: v.inStock }) }} style={{ background: 'hsl(var(--sf-accent))', color: 'hsl(var(--sf-primary-foreground))' }}>
                    Add
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section data-edit-id="trust" className="border-t py-12 px-6" style={{ borderColor: 'hsl(var(--sf-border))' }} id="support">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-8 text-sm">
          {[
            { t: c('trust.item1_title', '2-year warranty'), d: c('trust.item1_desc', 'On every product, no fine print.') },
            { t: c('trust.item2_title', 'Free shipping'),   d: c('trust.item2_desc', 'Orders over $50, anywhere in the country.') },
            { t: c('trust.item3_title', 'Expert support'),  d: c('trust.item3_desc', 'Real engineers, 7 days a week.') },
          ].map((b) => (
            <div key={b.t}>
              <div className="text-base mb-1" style={{ fontFamily: 'var(--sf-display)' }}>{b.t}</div>
              <p className="opacity-70">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Unused import suppression */}
      <Link to="#" className="hidden" />
    </>
  )
}
