import { Plus } from 'lucide-react'
import { resolveBlockProducts } from '../../lib/productDefaults'
import { FREQUENTLY_BOUGHT_TOGETHER_DEFAULTS } from '../../lib/frequentlyBoughtTogetherDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

interface FrequentlyBoughtTogetherBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`
}

export function FrequentlyBoughtTogetherBlock({ block, layoutStyle }: FrequentlyBoughtTogetherBlockProps) {
  const catalog = useBuilderStore((s) => s.catalog.products)
  const { props, styles } = block
  const products = resolveBlockProducts(props, catalog)
  const layout = props.bundleLayout ?? FREQUENTLY_BOUGHT_TOGETHER_DEFAULTS.bundleLayout
  const mainId = props.bundleMainProductId ?? products[0]?.id
  const showSavings = props.showBundleSavings !== false
  const savingsPct = props.bundleSavingsPercent ?? FREQUENTLY_BOUGHT_TOGETHER_DEFAULTS.bundleSavingsPercent
  const savingsLabel = (props.bundleSavingsLabel ?? FREQUENTLY_BOUGHT_TOGETHER_DEFAULTS.bundleSavingsLabel ?? 'Save {percent}% when bought together').replace('{percent}', String(savingsPct))
  const isStacked = layout === 'stacked'

  if (products.length === 0) {
    return (
      <section style={layoutStyle} className="py-12 text-center text-sm text-gray-400">
        Add bundle products in the properties panel
      </section>
    )
  }

  const total = products.reduce((sum, p) => sum + p.price, 0)
  const discounted = showSavings ? total * (1 - savingsPct / 100) : total

  const productChip = (p: (typeof products)[0], highlight?: boolean) => (
    <div
      key={p.id}
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        highlight ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
      } ${isStacked ? 'w-full' : 'min-w-[160px] shrink-0'}`}
    >
      {p.imageUrl && <img src={p.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
        <p className="text-sm font-semibold text-brand-600">{formatPrice(p.price)}</p>
      </div>
    </div>
  )

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-4xl">
        {(props.text || props.subtitle) && <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />}
        <div className={`rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900/50 ${isStacked ? '' : ''}`}>
          <div className={`flex flex-wrap items-center gap-2 ${isStacked ? 'flex-col' : 'justify-center'}`}>
            {products.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-2 ${isStacked ? 'w-full' : ''}`}>
                {i > 0 && <Plus className="h-4 w-4 shrink-0 text-gray-400" />}
                {productChip(p, p.id === mainId)}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col items-center gap-2 border-t border-gray-200 pt-6 dark:border-gray-700 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-sm text-gray-500">Bundle price</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPrice(discounted)}
                {showSavings && total > discounted && (
                  <span className="ml-2 text-base font-normal text-gray-400 line-through">{formatPrice(total)}</span>
                )}
              </p>
              {showSavings && <p className="text-sm font-medium text-emerald-600">{savingsLabel}</p>}
            </div>
            <button type="button" className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md">
              {props.buttonText ?? 'Add all to cart'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
