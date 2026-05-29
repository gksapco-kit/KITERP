import { Heart } from 'lucide-react'
import { resolveBlockProducts } from '../../lib/productDefaults'
import { WISHLIST_DEFAULTS } from '../../lib/wishlistDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

interface WishlistBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`
}

export function WishlistBlock({ block, layoutStyle }: WishlistBlockProps) {
  const catalog = useBuilderStore((s) => s.catalog.products)
  const { props, styles } = block
  const products = resolveBlockProducts(props, catalog)
  const layout = props.wishlistLayout ?? WISHLIST_DEFAULTS.wishlistLayout
  const showPrices = props.showWishlistPrices !== false
  const isList = layout === 'list'

  if (products.length === 0) {
    return (
      <section style={layoutStyle} className="py-12 text-center text-sm text-gray-400">
        Add products to your wishlist in the properties panel
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-6xl">
        {(props.text || props.subtitle) && <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8" />}
        <div className={isList ? 'flex flex-col gap-3' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
          {products.map((p) => (
            <article
              key={p.id}
              className={`group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900 ${
                isList ? 'flex gap-4 p-4' : 'p-4'
              }`}
            >
              <button type="button" className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-rose-500 shadow dark:bg-gray-800" aria-label="Remove">
                <Heart className="h-4 w-4 fill-current" />
              </button>
              {p.imageUrl && (
                <img
                  src={p.imageUrl}
                  alt=""
                  className={isList ? 'h-24 w-24 shrink-0 rounded-xl object-cover' : 'mb-3 aspect-square w-full rounded-xl object-cover'}
                />
              )}
              <div className={isList ? 'flex flex-1 flex-col justify-center' : ''}>
                <h3 className="font-semibold text-gray-900 dark:text-white">{p.name}</h3>
                {showPrices && <p className="mt-1 font-bold text-brand-600">{formatPrice(p.price)}</p>}
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{p.description}</p>
                <button type="button" className="mt-3 w-fit rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white">
                  Move to cart
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
