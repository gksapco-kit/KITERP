import { resolveBlockProducts } from '../../lib/productDefaults'
import { RECENTLY_VIEWED_DEFAULTS } from '../../lib/recentlyViewedDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

interface RecentlyViewedBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`
}

export function RecentlyViewedBlock({ block, layoutStyle }: RecentlyViewedBlockProps) {
  const catalog = useBuilderStore((s) => s.catalog.products)
  const { props, styles } = block
  const products = resolveBlockProducts(props, catalog)
  const layout = props.recentlyViewedLayout ?? RECENTLY_VIEWED_DEFAULTS.recentlyViewedLayout
  const showPrices = props.showRecentlyViewedPrices !== false
  const isScroll = layout === 'scroll'

  if (products.length === 0) {
    return (
      <section style={layoutStyle} className="py-12 text-center text-sm text-gray-400">
        Add recently viewed products in the properties panel
      </section>
    )
  }

  const card = (p: (typeof products)[0]) => (
    <article key={p.id} className={`shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${isScroll ? 'w-40' : ''}`}>
      {p.imageUrl && <img src={p.imageUrl} alt="" className={`object-cover ${isScroll ? 'h-32 w-full' : 'aspect-square w-full'}`} />}
      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</h3>
        {showPrices && <p className="mt-0.5 text-sm font-semibold text-brand-600">{formatPrice(p.price)}</p>}
      </div>
    </article>
  )

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-6xl">
        {(props.text || props.subtitle) && <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />}
        {isScroll ? (
          <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2">{products.map(card)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{products.map(card)}</div>
        )}
      </div>
    </section>
  )
}
