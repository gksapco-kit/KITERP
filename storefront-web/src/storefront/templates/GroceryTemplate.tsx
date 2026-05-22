import { useEffect, useState } from 'react'
import { Clock, Plus, Search, Truck } from 'lucide-react'
import { useStorefront, formatMoney } from '../StorefrontContext'
import { StorefrontShell } from '../components/StorefrontShell'
import { buildSurfaceStyle, type StorefrontConfig } from '../theming'
import { getTemplate } from '../templates'
import { useContentField } from '../editContext'
import type { Category, Product } from '../types'
import { Button } from '@/components/ui/button'

const TEMPLATE_ID = 'grocery'

export const GroceryTemplate = ({ config, basePath = '/templates/grocery/preview', liveCatalog = false }: { config?: StorefrontConfig; basePath?: string; liveCatalog?: boolean }) => {
  const tpl = getTemplate(TEMPLATE_ID)!
  const preset = config?.preset ?? 'minimal'
  const style = buildSurfaceStyle(tpl, config?.brand)

  return (
    <div className="sf-surface" data-preset={preset} style={style}>
      <StorefrontShell
        storeName={config?.storeName ?? tpl.name}
        tagline={config?.tagline ?? tpl.tagline}
        basePath={basePath}
        nav={[
          { label: 'Fruits & Veg', to: `${basePath}#fruits` },
          { label: 'Bakery',       to: `${basePath}#bakery` },
          { label: 'Beverages',    to: `${basePath}#beverages` },
          { label: 'Snacks',       to: `${basePath}#snacks` },
          { label: 'Offers',       to: `${basePath}#offers` },
        ]}
      >
        <GroceryHome filterMockGroceryOnly={!liveCatalog} />
      </StorefrontShell>
    </div>
  )
}

const GroceryHome = ({ filterMockGroceryOnly = true }: { filterMockGroceryOnly?: boolean }) => {
  const { adapter, addToCart, cart } = useStorefront()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const c = useContentField()

  useEffect(() => {
    Promise.all([adapter.listProducts(), adapter.listCategories()]).then(([p, cat]) => {
      setProducts(filterMockGroceryOnly ? p.items.filter((x) => x.id.startsWith('p-gr-')) : p.items)
      setCategories(filterMockGroceryOnly ? cat.filter((x) => x.id.startsWith('c-gr-')) : cat)
    })
  }, [adapter, filterMockGroceryOnly])

  return (
    <>
      {/* Hero / search */}
      <section data-edit-id="hero" className="px-4 sm:px-6 py-12" style={{ background: 'hsl(var(--sf-muted) / 0.5)' }}>
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl mb-4" style={{ fontFamily: 'var(--sf-display)' }}>
            {c('hero.line1', 'Fresh from the market,')}{' '}
            <span style={{ color: 'hsl(var(--sf-accent))' }}>{c('hero.line2', 'at your door.')}</span>
          </h1>
          <p className="opacity-70 mb-6">{c('hero.subtitle', 'Order before 4pm for same-day delivery.')}</p>
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
            <input
              type="search"
              placeholder={c('hero.search', 'Search for milk, bread, fruits…')}
              className="w-full h-12 pl-11 pr-32 border outline-none text-sm"
              style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-bg))', color: 'hsl(var(--sf-fg))' }}
            />
            <Button className="absolute right-1 top-1 h-10 rounded-none" style={{ background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))' }}>
              Search
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-xs opacity-70">
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> {c('hero.badge1', 'Free delivery over $30')}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {c('hero.badge2', '2-hour delivery slots')}</span>
            <span>· {c('hero.badge3', 'No minimum order')}</span>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section data-edit-id="categories" className="max-w-7xl mx-auto px-4 sm:px-6 py-12" id="fruits">
        <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--sf-display)' }}>
          {c('categories.heading', 'Shop by category')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <a key={cat.id} href="#" className="group border flex flex-col items-center p-4 text-center transition-colors" style={{ borderColor: 'hsl(var(--sf-border))' }}>
              {cat.image ? <img src={cat.image.url} alt={cat.image.alt} className="h-16 w-16 object-cover rounded-full mb-3" loading="lazy" /> : null}
              <span className="text-sm">{cat.name}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Promo banners */}
      <section data-edit-id="promo" className="max-w-7xl mx-auto px-4 sm:px-6" id="offers">
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { t: c('promo.1_title', 'Weekend Bundle'), d: c('promo.1_desc', 'Save 15% on fresh produce'), color: 'hsl(var(--sf-accent))' },
            { t: c('promo.2_title', 'Bakery Daily'),   d: c('promo.2_desc', 'Loaves baked at 6am'),        color: 'hsl(var(--sf-primary))' },
            { t: c('promo.3_title', 'Pantry Top-Up'),  d: c('promo.3_desc', 'Buy 2, get 1 free on staples'), color: 'hsl(var(--sf-accent))' },
          ].map((b, i) => (
            <div key={b.t} className="p-6" style={{ background: b.color, color: 'hsl(var(--sf-primary-foreground))' }}>
              <div className="text-xs uppercase tracking-[0.18em] opacity-90">Offer 0{i + 1}</div>
              <div className="text-xl mt-2 mb-1" style={{ fontFamily: 'var(--sf-display)' }}>{b.t}</div>
              <div className="text-sm opacity-90">{b.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Product grid */}
      <section data-edit-id="products" className="max-w-7xl mx-auto px-4 sm:px-6 py-12" id="bakery">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl" style={{ fontFamily: 'var(--sf-display)' }}>
            {c('products.heading', 'Best sellers')}
          </h2>
          <a href="#" className="text-sm underline opacity-70">See all</a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {products.map((p) => (
            <article key={p.id} className="border flex flex-col" style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-bg))' }}>
              <div className="aspect-square relative" style={{ background: 'hsl(var(--sf-muted) / 0.4)' }}>
                <img src={p.images[0].url} alt={p.images[0].alt} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                {p.badges?.[0] ? (
                  <span className="absolute top-2 left-2 text-xs uppercase tracking-[0.15em] px-1.5 py-0.5" style={{ background: 'hsl(var(--sf-accent))', color: 'hsl(var(--sf-primary-foreground))' }}>{p.badges[0]}</span>
                ) : null}
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <h3 className="text-sm font-medium leading-tight">{p.title}</h3>
                <p className="text-xs opacity-60 mb-3">{p.subtitle}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-sm font-semibold">{formatMoney(p.variants[0].price)}</span>
                  <button onClick={() => { const v = p.variants[0]; addToCart({ productId: p.id, variantId: v.id, quantity: 1, name: p.title, variantLabel: v.name, imageUrl: p.images[0]?.url, unitPrice: v.price, inStock: v.inStock }) }} className="h-8 w-8 grid place-items-center" style={{ background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))' }} aria-label={`Add ${p.title}`}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Sticky cart summary */}
      {cart && cart.lines.length > 0 ? (
        <div className="sticky bottom-4 z-20 px-4 max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4 px-5 py-3 shadow-lg" style={{ background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))' }}>
            <div className="text-sm">{cart.lines.reduce((s, l) => s + l.quantity, 0)} items · {formatMoney(cart.subtotal)}</div>
            <Button size="sm" className="rounded-none" style={{ background: 'hsl(var(--sf-accent))', color: 'hsl(var(--sf-primary-foreground))' }}>Checkout</Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
