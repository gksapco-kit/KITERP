import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Star, Heart, Share2, Loader2, Check } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useAddToCart } from '@/hooks/useStore'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

export default function ProductDetailBlock({ site, style, props, liveItems }: Props) {
  const [qty, setQty] = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)
  const { storePath } = useVendor()
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const addToCart = useAddToCart()

  const product = liveItems[0]
  const title = product?.title || (props.title as string) || 'Product'
  const description = product?.description || (props.description as string) || ''
  const price = product?.price_formatted || null
  const imageUrl = product?.image_url || null
  const showVariants = props.show_variants !== false
  const showReviews = props.show_reviews !== false

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      navigate(storePath('/login'))
      return
    }
    if (!product) return
    try {
      await addToCart.mutateAsync({ product_id: product.id, qty } as any)
      setAddedToCart(true)
      setTimeout(() => setAddedToCart(false), 2000)
    } catch {
      // error handled by mutation
    }
  }

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-12">
        {/* Image */}
        <div>
          {imageUrl ? (
            <img src={imageUrl} alt={title} className="w-full rounded-2xl shadow-lg object-cover aspect-square" loading="lazy" />
          ) : (
            <div className="w-full aspect-square rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300">
              <ShoppingCart className="w-16 h-16" />
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product?.subtitle && <p className="text-sm text-gray-400 uppercase tracking-wide mb-1">{product.subtitle}</p>}
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{title}</h1>

          {product?.rating != null && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < (product.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                ))}
              </div>
              <span className="text-sm text-gray-500">({product.rating}/5)</span>
            </div>
          )}

          {price && (
            <div className="text-3xl font-bold mb-6" style={{ color: style.primary_color }}>{price}</div>
          )}

          {description && <p className="text-gray-600 leading-relaxed mb-6">{description}</p>}

          {/* Quantity */}
          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm font-medium text-gray-700">Quantity:</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-4 py-2 hover:bg-gray-50 text-gray-700 font-bold">−</button>
              <span className="px-4 py-2 border-x border-gray-200 min-w-[48px] text-center">{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="px-4 py-2 hover:bg-gray-50 text-gray-700 font-bold">+</button>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleAddToCart}
              disabled={addToCart.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-white font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ backgroundColor: addedToCart ? '#10b981' : style.primary_color }}
            >
              {addToCart.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : addedToCart ? (
                <><Check className="w-5 h-5" /> Added to Cart!</>
              ) : (
                <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
              )}
            </button>
            <button className="p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              <Heart className="w-5 h-5 text-gray-400" />
            </button>
            <button className="p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              <Share2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap gap-2">
            {!!product?.meta?.stock_status && (
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${product.meta.stock_status === 'out_of_stock' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                {product.meta.stock_status === 'out_of_stock' ? 'Out of Stock' : '✓ In Stock'}
              </span>
            )}
            {!!product?.meta?.is_featured && (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-amber-50 text-amber-600">⭐ Featured</span>
            )}
            {!!product?.meta?.sku && (
              <span className="text-xs text-gray-400 px-3 py-1 rounded-full bg-gray-50">SKU: {product.meta.sku as string}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
