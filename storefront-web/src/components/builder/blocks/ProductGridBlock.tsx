import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Star, ShoppingCart, Check, Loader2, Heart } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useAuthStore } from '@/stores/authStore'
import { useAddToCart } from '@/hooks/useStore'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockType?: string
}

function mediaUrl(url: string | null | undefined) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:')) return url
  return url
}

export default function ProductGridBlock({ site, style, props, liveItems, blockType = 'product_grid' }: Props) {
  const { storePath } = useVendor()
  const { isAuthenticated } = useAuthStore()
  const addToCart = useAddToCart()
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const handleAddToCart = async (e: React.MouseEvent, item: LiveItem) => {
    e.preventDefault()
    e.stopPropagation()
    if (!item.id || String(item.id).startsWith('ph-')) return
    if (!isAuthenticated) {
      window.location.href = storePath('/login')
      return
    }
    try {
      await addToCart.mutateAsync({ product_id: item.id, qty: 1 } as any)
      setAddedIds(prev => { const next = new Set(prev); next.add(item.id!); return next })
      setTimeout(() => setAddedIds(prev => { const next = new Set(prev); next.delete(item.id!); return next }), 2000)
    } catch { /* mutation handles */ }
  }

  const title = (props.title as string) || 'Products'
  const columns = Math.min(Math.max(Number(props.columns ?? 4), 2), 4)
  const showBadges = props.show_badges !== false
  const textColor = style.text_color || '#111827'

  const colClass: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  }

  const editorialFallback = Array.from({ length: columns }).map((_, i) => ({
    id: `ph-${i}`,
    title: `Product ${i + 1}`,
    subtitle: 'Subtitle',
    price_formatted: '₹999',
    image_url: null as string | null,
    meta: {} as Record<string, unknown>,
  })) as LiveItem[]

  /** ── Editorial category cards (matches vendor builder / Fashion browser) ── */
  if (blockType === 'category_cards' && props.layout === 'editorial') {
    const eyebrow = (props.eyebrow as string) || ''
    const cats: { title: string; image_url?: string | null }[] = liveItems.length > 0
      ? liveItems.map(c => ({
          title: c.title,
          image_url: c.image_url || (c.meta as any)?.image_url,
        }))
      : ((props.categories as { title?: string; image_url?: string }[]) || [
          { title: 'Women' },
          { title: 'Men' },
          { title: 'Accessories' },
        ]).map(c => ({ title: c.title || 'Category', image_url: c.image_url }))

    return (
      <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: style.bg_color }}>
        <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
          <div>
            {eyebrow && (
              <span className="text-[11px] uppercase tracking-[0.3em] opacity-70 block" style={{ color: textColor }}>
                {eyebrow}
              </span>
            )}
            <h2 className="text-3xl sm:text-4xl md:text-5xl mt-2" style={{ fontFamily: style.font_heading, color: textColor }}>
              {title}
            </h2>
          </div>
          <span className="text-sm underline opacity-80 cursor-pointer" style={{ color: textColor }}>View all</span>
        </div>
        <div className="grid md:grid-cols-3 gap-1">
          {cats.slice(0, 9).map((c, i) => (
            <Link key={`${c.title}-${i}`} to={storePath('/products')} className="group relative aspect-[4/5] overflow-hidden block">
              {c.image_url ? (
                <img src={mediaUrl(c.image_url)} alt={c.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 text-white">
                <h3 className="text-2xl" style={{ fontFamily: style.font_heading }}>{c.title}</h3>
                <span className="text-xs uppercase tracking-[0.2em] text-white/80">Shop now →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    )
  }

  /** ── Editorial product grid + optional featured row (vendor / Atelier) ── */
  if (blockType === 'product_grid' && props.layout === 'editorial') {
    const rawItems = liveItems.length > 0 ? liveItems : (props.layout === 'editorial' ? editorialFallback : [])
    const useSpotlight = props.featured_spotlight !== false && rawItems.length >= 1
    const featuredOne = useSpotlight ? rawItems[0] : null
    const gridList = useSpotlight ? rawItems.slice(1) : rawItems
    const gridCls = columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'

    return (
      <div style={{ backgroundColor: style.surface_color || style.bg_color }}>
        <section className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10 gap-4">
            <h2 className="text-3xl sm:text-4xl" style={{ fontFamily: style.font_heading, color: textColor }}>{title}</h2>
            <span className="text-sm underline opacity-80" style={{ color: textColor }}>View all</span>
          </div>

          {featuredOne && (
            <div
              className="border-y mb-16 sm:mb-20 -mx-6 sm:-mx-12 px-6 sm:px-12"
              style={{ borderColor: `${textColor}18`, backgroundColor: style.bg_color }}
            >
              <div className="max-w-7xl mx-auto py-16 sm:py-20 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
                <div className="aspect-[4/5] relative overflow-hidden bg-gray-100">
                  {featuredOne.image_url ? (
                    <img src={mediaUrl(featuredOne.image_url)} alt={featuredOne.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-gray-300" /></div>
                  )}
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-[0.3em] opacity-70" style={{ color: textColor }}>
                    Featured{(featuredOne.meta as any)?.brand != null && String((featuredOne.meta as any).brand).trim() !== '' ? ` · ${(featuredOne.meta as any).brand}` : ''}
                  </span>
                  <h3 className="text-3xl sm:text-4xl lg:text-5xl mt-3 mb-4 text-balance" style={{ fontFamily: style.font_heading, color: textColor }}>
                    {featuredOne.title}
                  </h3>
                  <p className="text-base opacity-80 mb-8 max-w-lg leading-relaxed" style={{ color: textColor }}>
                    {(featuredOne as any).description || featuredOne.subtitle || ' '}
                  </p>
                  <div className="text-2xl mb-8" style={{ fontFamily: style.font_heading, color: textColor }}>
                    {featuredOne.price_formatted || '—'}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      style={{ backgroundColor: style.primary_color, color: '#fff' }}
                      className="h-12 px-8 text-xs font-bold uppercase tracking-[0.2em] rounded-none"
                      onClick={e => handleAddToCart(e, featuredOne)}
                    >
                      Add to cart
                    </button>
                    <button
                      type="button"
                      style={{ border: `1px solid ${textColor}99`, color: textColor }}
                      className="h-12 w-12 rounded-none bg-transparent flex items-center justify-center"
                      aria-label="Wishlist"
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={`grid gap-x-6 gap-y-12 ${gridCls}`}>
            {gridList.map(item => {
              const outOfStock = item.meta?.stock_status === 'out_of_stock'
              const isPh = String(item.id || '').startsWith('ph-')
              return (
                <div key={item.id || item.title} className="group">
                  <Link to={item.url ? storePath(item.url) : storePath('/products')} className="block">
                    <div className="aspect-[4/5] relative overflow-hidden mb-4 bg-gray-100">
                      {item.image_url ? (
                        <img src={mediaUrl(item.image_url)} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-300" /></div>
                      )}
                      {showBadges && !!item.meta?.is_featured && (
                        <span style={{ backgroundColor: style.primary_color, color: '#fff' }} className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.2em] px-2 py-1">Featured</span>
                      )}
                      {!isPh && (
                        <div
                          className="absolute bottom-3 left-3 right-3 h-10 text-[10px] uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-semibold"
                          style={{ backgroundColor: textColor, color: style.bg_color }}
                        >
                          Quick add
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color: textColor }}>{item.title}</div>
                      {item.subtitle && <div className="text-xs opacity-60 truncate">{item.subtitle}</div>}
                    </div>
                    <span className="text-sm shrink-0" style={{ color: textColor }}>{item.price_formatted || '—'}</span>
                  </div>
                  {!isPh && (
                    <button
                      type="button"
                      onClick={e => handleAddToCart(e, item)}
                      disabled={outOfStock}
                      className="mt-3 w-full py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-50"
                      style={{ backgroundColor: style.primary_color }}
                    >
                      {outOfStock ? 'Out of stock' : 'Add to cart'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    )
  }

  /** ── Default product / menu grid (original business front behavior) ── */
  const items = liveItems.length > 0
    ? liveItems
    : (props.items as LiveItem[] | undefined) || []

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No products available yet</p>
        </div>
      ) : (
        <div className={`grid ${colClass[columns] || colClass[4]} gap-6`}>
          {items.map(item => {
            const isAdded = addedIds.has(item.id!)
            const isAdding = addToCart.isPending && addToCart.variables && (addToCart.variables as any).product_id === item.id
            const outOfStock = item.meta?.stock_status === 'out_of_stock'
            return (
              <div
                key={item.id}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col"
              >
                <Link
                  to={item.url ? storePath(item.url) : storePath('/products')}
                  className="block"
                >
                  <div className="aspect-square bg-gray-50 overflow-hidden relative">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingBag className="w-12 h-12" />
                      </div>
                    )}
                    {showBadges && !!item.meta?.is_on_sale && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">SALE</span>
                    )}
                    {showBadges && !!item.meta?.is_featured && (
                      <span className="absolute top-2 right-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Star className="w-3 h-3" />Featured</span>
                    )}
                  </div>
                  <div className="p-4 pb-2">
                    {item.subtitle && <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{item.subtitle}</p>}
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2 mb-2">{item.title}</h3>
                    {item.price_formatted && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold" style={{ color: style.primary_color }}>{item.price_formatted}</span>
                        {item.meta?.compare_at_price != null && String(item.meta.compare_at_price) !== '' && (
                          <span className="text-sm text-gray-400 line-through">
                            {String(item.meta.currency ?? '')} {Number(item.meta.compare_at_price).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-2 inline-block ${outOfStock ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                      {outOfStock ? 'Out of Stock' : 'In Stock'}
                    </span>
                  </div>
                </Link>

                <div className="px-4 pb-4 mt-auto pt-2">
                  <button
                    onClick={e => handleAddToCart(e, item)}
                    disabled={outOfStock || isAdded || !!isAdding}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60 hover:opacity-90"
                    style={{ backgroundColor: isAdded ? '#10b981' : style.primary_color }}
                  >
                    {isAdding ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isAdded ? (
                      <><Check className="w-4 h-4" /> Added!</>
                    ) : outOfStock ? (
                      'Out of Stock'
                    ) : (
                      <><ShoppingCart className="w-4 h-4" /> Add to Cart</>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
