import { Plus } from 'lucide-react'
import { gridColumnClass } from '../../lib/blockUtils'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { CatalogProduct } from '../../types/builder'

interface ProductListingWidgetProps {
  title?: string
  subtitle?: string
  columns?: number
  showPrices?: boolean
  interactive?: boolean
}

export function ProductListingWidget({
  title = 'Our Products',
  subtitle,
  columns = 3,
  showPrices = true,
  interactive = false,
}: ProductListingWidgetProps) {
  const products = useBuilderStore((s) => s.catalog.products)
  const addToCart = useBuilderStore((s) => s.addToCart)
  const colClass = gridColumnClass(columns)

  return (
    <section>
      <h2 className="mb-2 text-3xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="mb-8 text-gray-600">{subtitle}</p>}
      <div className={`grid gap-6 ${colClass}`}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            showPrice={showPrices}
            onAdd={
              interactive
                ? () =>
                    addToCart({
                      itemId: product.id,
                      itemType: 'product',
                      name: product.name,
                      price: product.price,
                      quantity: 1,
                      imageUrl: product.imageUrl,
                    })
                : undefined
            }
          />
        ))}
      </div>
    </section>
  )
}

function ProductCard({
  product,
  showPrice,
  onAdd,
}: {
  product: CatalogProduct
  showPrice: boolean
  onAdd?: () => void
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
      <img src={product.imageUrl} alt={product.name} className="h-48 w-full object-cover" />
      <div className="p-4">
        <h3 className="font-semibold text-gray-900">{product.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{product.description}</p>
        <div className="mt-4 flex items-center justify-between">
          {showPrice && <span className="text-lg font-bold text-brand-600">${product.price}</span>}
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
