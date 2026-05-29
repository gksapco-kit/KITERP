import { Copy, ShoppingCart, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { gridColumnClass } from '../../lib/blockUtils'
import { SectionCardsHeader } from '../builder/SectionCardsHeader'
import { SectionViewAllFooter } from '../builder/SectionViewAllFooter'
import { resolveBlockProducts } from '../../lib/productDefaults'
import { resolveCardImageHeight } from '../../lib/cardSectionLayout'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block, CatalogProduct } from '../../types/builder'
import { CardItemImage } from '../builder/CardItemImage'

interface ProductListingBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
  editable?: boolean
  onProductsChange?: (products: CatalogProduct[]) => void
}

export function ProductListingBlock({
  block,
  layoutStyle,
  interactive = false,
  onNavigate,
  editable = false,
  onProductsChange,
}: ProductListingBlockProps) {
  const catalogProducts = useBuilderStore((s) => s.catalog.products)
  const addToCart = useBuilderStore((s) => s.addToCart)
  const { props } = block
  const products = resolveBlockProducts(props, catalogProducts)
  const columns = props.columns ?? 3
  const showPrices = props.showPrices !== false
  const showAddToCart = props.showAddToCart !== false
  const colClass = gridColumnClass(columns, 'responsive')
  const imageHeight = resolveCardImageHeight(props)

  const updateProducts = (next: CatalogProduct[]) => onProductsChange?.(next)

  const removeProduct = (index: number) => {
    updateProducts(products.filter((_, i) => i !== index))
  }

  const duplicateProduct = (index: number) => {
    const p = products[index]
    if (!p || !onProductsChange) return
    const copy = { ...p, id: uuid(), name: p.name ? `${p.name} (copy)` : '' }
    const next = [...products]
    next.splice(index + 1, 0, copy)
    updateProducts(next)
  }

  return (
    <section style={layoutStyle} className="w-full">
      <SectionCardsHeader block={block} titleClassName="text-3xl font-bold" />

      {products.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          No products yet — add products in the properties panel
        </p>
      ) : (
        <div className={`grid gap-6 ${colClass}`}>
          {products.map((product, index) => (
            <article
              key={product.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <CardItemImage
                src={product.imageUrl}
                alt={product.name}
                height={imageHeight}
                placeholderClassName="text-sm text-gray-400"
              />
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{product.name}</h3>
                {product.description && (
                  <p className="mt-2 line-clamp-2 flex-1 text-sm text-gray-500 dark:text-gray-400">{product.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between gap-2">
                  {showPrices && <span className="text-xl font-bold text-brand-600 dark:text-brand-400">${product.price.toFixed(2)}</span>}
                  {showAddToCart && interactive && (
                    <button
                      type="button"
                      onClick={() =>
                        addToCart({
                          itemId: product.id,
                          itemType: 'product',
                          name: product.name,
                          price: product.price,
                          quantity: 1,
                          imageUrl: product.imageUrl,
                        })
                      }
                      className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Add to Cart
                    </button>
                  )}
                  {showAddToCart && !interactive && (
                    <span className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-500 dark:bg-gray-700">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Add to Cart
                    </span>
                  )}
                </div>
              </div>

              {editable && onProductsChange && (
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    title="Duplicate product"
                    onClick={() => duplicateProduct(index)}
                    className="rounded-lg bg-white p-1.5 text-gray-600 shadow ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:ring-gray-600"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete product"
                    onClick={() => removeProduct(index)}
                    className="rounded-lg bg-white p-1.5 text-red-600 shadow ring-1 ring-gray-200 hover:bg-red-50 dark:bg-gray-800 dark:ring-gray-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <SectionViewAllFooter block={block} interactive={interactive} onNavigate={onNavigate} />
    </section>
  )
}
