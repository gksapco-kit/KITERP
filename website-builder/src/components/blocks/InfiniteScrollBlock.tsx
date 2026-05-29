import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { gridColumnClass } from '../../lib/blockUtils'
import { INFINITE_SCROLL_DEFAULTS } from '../../lib/infiniteScrollDefaults'
import { resolveBlockProducts } from '../../lib/productDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

interface InfiniteScrollBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
}

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`
}

export function InfiniteScrollBlock({ block, layoutStyle, interactive = false }: InfiniteScrollBlockProps) {
  const catalog = useBuilderStore((s) => s.catalog.products)
  const { props, styles } = block
  const products = resolveBlockProducts(props, catalog)
  const initial = props.infiniteScrollInitialCount ?? INFINITE_SCROLL_DEFAULTS.infiniteScrollInitialCount
  const loadCount = props.infiniteScrollLoadCount ?? INFINITE_SCROLL_DEFAULTS.infiniteScrollLoadCount
  const trigger = props.infiniteScrollTrigger ?? INFINITE_SCROLL_DEFAULTS.infiniteScrollTrigger
  const columns = props.infiniteScrollColumns ?? INFINITE_SCROLL_DEFAULTS.infiniteScrollColumns
  const showLoader = props.showInfiniteScrollLoader !== false
  const showPrices = props.showInfiniteScrollPrices !== false
  const [visible, setVisible] = useState(initial)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const visibleProducts = products.slice(0, visible)
  const hasMore = visible < products.length

  const loadMore = () => {
    if (!hasMore || loading) return
    setLoading(true)
    window.setTimeout(() => {
      setVisible((v) => Math.min(v + loadCount, products.length))
      setLoading(false)
    }, interactive ? 600 : 300)
  }

  useEffect(() => {
    if (trigger !== 'scroll' || !interactive || !hasMore || loading) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        setLoading(true)
        window.setTimeout(() => {
          setVisible((v) => Math.min(v + loadCount, products.length))
          setLoading(false)
        }, 600)
      },
      { rootMargin: '120px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [trigger, interactive, hasMore, loading, loadCount, products.length])

  if (products.length === 0) {
    return (
      <section style={layoutStyle} className="py-12 text-center text-sm text-gray-400">
        Add products in the properties panel
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-6xl">
        {(props.text || props.subtitle) && (
          <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8" />
        )}
        <div className={`grid gap-4 ${gridColumnClass(columns, 'responsive')}`}>
          {visibleProducts.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              {p.imageUrl && <img src={p.imageUrl} alt="" className="aspect-square w-full object-cover" />}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">{p.name}</h3>
                {showPrices && <p className="mt-1 font-bold text-brand-600">{formatPrice(p.price)}</p>}
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{p.description}</p>
              </div>
            </article>
          ))}
        </div>

        {hasMore && (
          <div className="mt-8 flex flex-col items-center gap-3">
            {loading && showLoader && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}
            {trigger === 'button' && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {props.buttonText ?? 'Load more'}
              </button>
            )}
            {trigger === 'scroll' && <div ref={sentinelRef} className="h-4 w-full" aria-hidden />}
          </div>
        )}

        {!hasMore && products.length > initial && (
          <p className="mt-6 text-center text-sm text-gray-400">You&apos;ve seen all {products.length} products</p>
        )}
      </div>
    </section>
  )
}
