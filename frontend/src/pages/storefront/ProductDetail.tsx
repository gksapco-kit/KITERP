import { useState } from 'react'
import { useParams, Link, useOutletContext } from 'react-router-dom'
import { Star, ShoppingCart, ShoppingBag, ChevronLeft, Minus, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStorefrontProduct } from '@/hooks/useStorefront'
import type { StorefrontVendor } from '@/api/storefront.api'

export default function ProductDetail() {
  const { vendorSlug, productSlug } = useParams<{ vendorSlug: string; productSlug: string }>()
  const { themeColor } = useOutletContext<{ vendor: StorefrontVendor; themeColor: string }>()
  const { data: product, isLoading, error } = useStorefrontProduct(vendorSlug || '', productSlug || '')
  const base = `/store/${vendorSlug}`

  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="aspect-square bg-gray-200 rounded-xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-10 bg-gray-200 rounded w-1/3 mt-6" />
            <div className="h-20 bg-gray-200 rounded mt-4" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900 mt-4">Product Not Found</h2>
        <Link to={`${base}/products`} className="mt-4 inline-block text-sm hover:underline" style={{ color: themeColor }}>
          Back to Products
        </Link>
      </div>
    )
  }

  const images = product.images.sort((a, b) => a.position - b.position)
  const currentImage = images[selectedImage]
  const symbol = product.currency === 'INR' ? '\u20B9' : '$'
  const variant = selectedVariant ? product.variants.find((v) => v.id === selectedVariant) : null
  const displayPrice = variant ? variant.price : product.price
  const inStock = product.track_inventory ? (variant ? variant.quantity > 0 : product.quantity > 0) : true

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to={base} className="hover:text-gray-600">Home</Link>
        <span>/</span>
        <Link to={`${base}/products`} className="hover:text-gray-600">Products</Link>
        <span>/</span>
        <span className="text-gray-700">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Images */}
        <div>
          <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 border">
            {currentImage ? (
              <img
                src={currentImage.url}
                alt={currentImage.alt_text || product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <ShoppingBag className="w-20 h-20" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 ${
                    i === selectedImage ? 'border-primary' : 'border-transparent'
                  }`}
                  style={i === selectedImage ? { borderColor: themeColor } : {}}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.category && (
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {product.category}
            </span>
          )}
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mt-1">{product.name}</h1>

          {/* Rating */}
          {product.avg_rating != null && product.avg_rating > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < Math.round(product.avg_rating!) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-500">
                {product.avg_rating.toFixed(1)} ({product.review_count} reviews)
              </span>
            </div>
          )}

          {/* Price */}
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-3xl font-bold" style={{ color: themeColor }}>
              {symbol}{displayPrice.toLocaleString()}
            </span>
            {product.compare_at_price && product.compare_at_price > displayPrice && (
              <>
                <span className="text-lg text-gray-400 line-through">
                  {symbol}{product.compare_at_price.toLocaleString()}
                </span>
                <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                  {Math.round(((product.compare_at_price - displayPrice) / product.compare_at_price) * 100)}% off
                </span>
              </>
            )}
          </div>

          {product.is_taxable && product.tax_rate && (
            <p className="text-xs text-gray-400 mt-1">Inclusive of {product.tax_rate}% GST</p>
          )}

          {/* Variants */}
          {product.variants.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Options</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(selectedVariant === v.id ? null : v.id)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selectedVariant === v.id
                        ? 'border-2 text-white'
                        : 'border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                    style={selectedVariant === v.id ? { borderColor: themeColor, backgroundColor: themeColor } : {}}
                  >
                    {v.name}
                    {Object.values(v.attributes).length > 0 && (
                      <span className="ml-1 text-xs opacity-75">
                        ({Object.values(v.attributes).join(', ')})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Quantity</p>
            <div className="inline-flex items-center border rounded-lg">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-5 py-2 font-medium min-w-[48px] text-center">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Add to Cart / Out of Stock */}
          <div className="mt-8 flex gap-3">
            {inStock ? (
              <Button
                size="lg"
                className="gap-2 px-8 text-white"
                style={{ backgroundColor: themeColor }}
              >
                <ShoppingCart className="w-5 h-5" /> Add to Cart
              </Button>
            ) : (
              <Button size="lg" disabled className="gap-2 px-8">
                Out of Stock
              </Button>
            )}
          </div>

          {inStock && (
            <div className="flex items-center gap-2 mt-3 text-sm text-green-600">
              <Check className="w-4 h-4" /> In Stock
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="mt-8 border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Back link */}
      <div className="mt-12">
        <Link
          to={`${base}/products`}
          className="inline-flex items-center gap-1 text-sm hover:underline"
          style={{ color: themeColor }}
        >
          <ChevronLeft className="w-4 h-4" /> Back to all products
        </Link>
      </div>
    </div>
  )
}
