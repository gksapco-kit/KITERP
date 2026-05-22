import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Heart, Star } from 'lucide-react'
import { useStorefront, formatMoney } from '../StorefrontContext'
import { StorefrontShell } from '../components/StorefrontShell'
import { buildSurfaceStyle, type StorefrontConfig } from '../theming'
import { getTemplate } from '../templates'
import { useContentField } from '../editContext'
import type { Product } from '../types'
import { Button } from '@/components/ui/button'

const TEMPLATE_ID = 'fashion'

interface Props {
  config?: StorefrontConfig
  basePath?: string
  /** Live /store/:slug — use full vendor catalog instead of mock fashion SKUs. */
  liveCatalog?: boolean
}

export const FashionTemplate = ({ config, basePath = '/templates/fashion/preview', liveCatalog = false }: Props) => {
  const tpl = getTemplate(TEMPLATE_ID)!
  const preset = config?.preset ?? 'classic'
  const style = buildSurfaceStyle(tpl, config?.brand)
  const storeName = config?.storeName ?? tpl.name
  const tagline = config?.tagline ?? tpl.tagline

  return (
    <div className="sf-surface" data-preset={preset} style={style}>
      <StorefrontShell
        storeName={storeName}
        tagline={tagline}
        basePath={basePath}
        nav={[
          { label: 'Women', to: `${basePath}#women` },
          { label: 'Men', to: `${basePath}#men` },
          { label: 'Accessories', to: `${basePath}#accessories` },
          { label: 'Lookbook', to: `${basePath}#lookbook` },
          { label: 'About', to: `${basePath}#about` },
        ]}
      >
        <FashionHome basePath={basePath} filterMockFashionOnly={!liveCatalog} />
      </StorefrontShell>
    </div>
  )
}

const FashionHome = ({ basePath, filterMockFashionOnly = true }: { basePath: string; filterMockFashionOnly?: boolean }) => {
  const { adapter, addToCart } = useStorefront()
  const [products, setProducts] = useState<Product[]>([])
  const [search] = useSearchParams()
  const filter = search.get('category')
  const c = useContentField()

  useEffect(() => {
    adapter.listProducts({ categorySlug: filter ?? undefined }).then((r) =>
      setProducts(filterMockFashionOnly ? r.items.filter((p) => p.id.startsWith('p-fa-')) : r.items)
    )
  }, [adapter, filter, filterMockFashionOnly])

  const featured = products[0]
  const rest = products.slice(1)

  const marqueeItems = c('marquee.items', 'Made in Portugal,Hand-finished,Free returns,Carbon-neutral shipping,Small batch,Since 2014')
    .split(',').map(s => s.trim()).filter(Boolean)

  return (
    <>
      {/* Hero */}
      <section data-edit-id="hero" className="relative overflow-hidden border-b" style={{ borderColor: 'hsl(var(--sf-border))' }}>
        <div className="grid grid-cols-1 xl:grid-cols-2">
          <div className="flex w-full min-w-0 max-w-xl flex-col justify-center px-4 py-12 sm:px-8 sm:py-16 md:px-12 xl:py-28">
            <span className="text-xs sm:text-xs uppercase tracking-[0.22em] sm:tracking-[0.3em] opacity-70 mb-4 sm:mb-6">
              {c('hero.season', 'Autumn/Winter Collection')}
            </span>
            <h1 className="text-[clamp(1.45rem,3.5vw_+_0.45rem,2.75rem)] sm:text-[clamp(1.75rem,3.8vw_+_0.45rem,3.25rem)] md:text-[clamp(2rem,4vw_+_0.45rem,3.5rem)] lg:text-[clamp(2.35rem,4.8vw_+_0.5rem,4.25rem)] leading-[1.06] sm:leading-[0.98] mb-5 sm:mb-6 hyphens-none break-words" style={{ fontFamily: 'var(--sf-display)' }}>
              <span className="block">{c('hero.line1', 'Quiet luxury,')}</span>
              <em className="block italic font-normal mt-1" style={{ color: 'hsl(var(--sf-accent))' }}>
                {c('hero.line2', 'built to last.')}
              </em>
            </h1>
            <p className="text-base opacity-80 mb-8 max-w-md text-pretty">
              {c('hero.subtitle', 'Editorial silhouettes, considered fabrics, made in small runs. Discover pieces designed to outlive the season.')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="rounded-none h-12 px-7" style={{ background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))' }}>
                {c('hero.cta1', 'Shop the collection')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-none h-12 px-7 bg-transparent" style={{ borderColor: 'hsl(var(--sf-fg) / 0.6)', color: 'hsl(var(--sf-fg))' }}>
                {c('hero.cta2', 'View lookbook')}
              </Button>
            </div>
          </div>
          <div
            className="relative h-[min(44dvh,320px)] w-full min-h-[260px] sm:h-[min(50dvh,480px)] sm:min-h-[360px] md:h-[min(56dvh,560px)] md:min-h-[400px] xl:h-auto xl:min-h-[640px]"
            style={{ background: 'hsl(var(--sf-muted))' }}
          >
            <img
              src={c('hero.image', 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=80')}
              alt="Featured fashion lookbook image"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>
        </div>
      </section>

      {/* Marquee */}
      <section data-edit-id="marquee" className="overflow-hidden border-b py-4" style={{ borderColor: 'hsl(var(--sf-border))' }}>
        <div className="sf-marquee-track whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="inline-flex items-center gap-10 mr-10 text-sm opacity-80" style={{ fontFamily: 'var(--sf-display)' }}>
              {marqueeItems.map((item, j) => (
                <span key={j} className="inline-flex items-center gap-4">
                  <span>{item}</span>
                  {j < marqueeItems.length - 1 && <span>·</span>}
                </span>
              ))}
            </span>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section data-edit-id="categories" className="max-w-7xl mx-auto px-6 sm:px-12 py-20" id="women">
        <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] opacity-70">
              {c('categories.eyebrow', 'Shop by category')}
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl mt-2" style={{ fontFamily: 'var(--sf-display)' }}>
              {c('categories.title', 'The edit')}
            </h2>
          </div>
          <Link to="#" className="text-sm underline opacity-80">View all</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-1">
          {[
            { name: 'Women', img: 'https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=900&q=80' },
            { name: 'Men', img: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=900&q=80' },
            { name: 'Accessories', img: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80' },
          ].map((cat) => (
            <a key={cat.name} href="#" className="group relative aspect-[4/5] overflow-hidden">
              <img src={cat.img} alt={`${cat.name} category`} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <h3 className="text-2xl text-white" style={{ fontFamily: 'var(--sf-display)' }}>{cat.name}</h3>
                <span className="text-xs uppercase tracking-[0.2em] text-white/80">Shop now →</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Featured product */}
      {featured ? (
        <section className="border-y" style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-muted))' }}>
          <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20 grid lg:grid-cols-2 gap-12 items-center">
            <div className="aspect-[4/5] relative overflow-hidden">
              <img src={featured.images[0].url} alt={featured.images[0].alt} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-[0.3em] opacity-70">Featured · {featured.brand}</span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl mt-3 mb-4" style={{ fontFamily: 'var(--sf-display)' }}>{featured.title}</h2>
              <div className="flex items-center gap-3 mb-6 text-sm opacity-80">
                {featured.rating ? (
                  <><Star className="h-4 w-4 fill-current" /><span>{featured.rating.value} · {featured.rating.count} reviews</span></>
                ) : null}
              </div>
              <p className="text-base opacity-80 mb-8 max-w-lg">{featured.description}</p>
              <div className="text-2xl mb-6" style={{ fontFamily: 'var(--sf-display)' }}>{formatMoney(featured.variants[0].price)}</div>
              <div className="flex flex-wrap gap-2 mb-8">
                {featured.variants.map((v) => (
                  <span key={v.id} className={`px-4 py-2 text-xs border ${v.inStock ? '' : 'opacity-40 line-through'}`} style={{ borderColor: 'hsl(var(--sf-border))' }}>{v.name}</span>
                ))}
              </div>
              <div className="flex gap-3">
                <Button size="lg" className="rounded-none h-12 flex-1" style={{ background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))' }}
                  onClick={() => {
                    const v = featured.variants.find((v) => v.inStock)!
                    addToCart({ productId: featured.id, variantId: v.id, quantity: 1, name: featured.title, variantLabel: v.name, imageUrl: featured.images[0]?.url, unitPrice: v.price, inStock: v.inStock })
                  }}>
                  Add to cart
                </Button>
                <Button size="lg" variant="outline" className="rounded-none h-12 px-4 bg-transparent" style={{ borderColor: 'hsl(var(--sf-fg) / 0.6)', color: 'hsl(var(--sf-fg))' }}>
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Product grid */}
      <section className="max-w-7xl mx-auto px-6 sm:px-12 py-20" id="lookbook">
        <div className="flex items-end justify-between mb-10">
          <h2 className="text-3xl sm:text-4xl" style={{ fontFamily: 'var(--sf-display)' }}>New arrivals</h2>
          <Link to="#" className="text-sm underline opacity-80">View all</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
          {rest.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={() => {
              const v = p.variants.find((v) => v.inStock) ?? p.variants[0]
              addToCart({ productId: p.id, variantId: v.id, quantity: 1, name: p.title, variantLabel: v.name, imageUrl: p.images[0]?.url, unitPrice: v.price, inStock: v.inStock })
            }} />
          ))}
        </div>
      </section>

      {/* About strip */}
      <section data-edit-id="about" className="border-t" style={{ borderColor: 'hsl(var(--sf-border))' }} id="about">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <span className="text-xs uppercase tracking-[0.3em] opacity-70">
            {c('about.eyebrow', 'Our craft')}
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl mt-3 mb-6 text-balance" style={{ fontFamily: 'var(--sf-display)' }}>
            {c('about.headline', 'We make fewer pieces, with more care.')}
          </h2>
          <p className="opacity-80 max-w-2xl mx-auto text-pretty">
            {c('about.body', 'Every garment is cut and finished in our partner workshop in Porto. We work with mills that have served the same families for generations — and we tell you exactly where each piece comes from.')}
          </p>
        </div>
      </section>
    </>
  )
}

const ProductCard = ({ product, onAdd }: { product: Product; onAdd: () => void }) => (
  <div className="group">
    <div className="aspect-[4/5] relative overflow-hidden mb-4" style={{ background: 'hsl(var(--sf-muted))' }}>
      <img src={product.images[0].url} alt={product.images[0].alt} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
      {product.badges?.[0] ? (
        <span className="absolute top-3 left-3 text-xs uppercase tracking-[0.2em] px-2 py-1" style={{ background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))' }}>{product.badges[0]}</span>
      ) : null}
      <button onClick={onAdd} className="absolute bottom-3 left-3 right-3 h-10 text-xs uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'hsl(var(--sf-fg))', color: 'hsl(var(--sf-bg))' }}>
        Quick add
      </button>
    </div>
    <div className="flex items-baseline justify-between gap-2">
      <div>
        <h3 className="text-base">{product.title}</h3>
        <p className="text-xs opacity-60">{product.subtitle}</p>
      </div>
      <span className="text-sm">{formatMoney(product.variants[0].price)}</span>
    </div>
  </div>
)
