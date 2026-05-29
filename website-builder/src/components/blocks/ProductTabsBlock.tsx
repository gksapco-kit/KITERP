import { useEffect, useState } from 'react'
import { FileText, Package, Star, Truck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SectionHeading } from '../builder/SectionHeading'
import { PRODUCT_TABS_DEFAULTS } from '../../lib/productTabsDefaults'
import type { Block, ProductTabItem } from '../../types/builder'

const TAB_ICONS: Record<string, LucideIcon> = {
  description: FileText,
  specs: Package,
  reviews: Star,
  shipping: Truck,
}

function getTabIcon(tab: ProductTabItem): LucideIcon | null {
  if (tab.id && TAB_ICONS[tab.id]) return TAB_ICONS[tab.id]
  return null
}

function TabContent({ content }: { content: string }) {
  const lines = content.split('\n').filter((line) => line.trim().length > 0)
  const isList = lines.every((line) => line.trim().startsWith('•') || line.trim().startsWith('-'))

  if (isList && lines.length > 1) {
    return (
      <ul className="space-y-2.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
            <span>{line.replace(/^[\s•\-]+/, '').trim()}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
      {content.split('\n\n').map((para, i) => (
        <p key={i}>{para.trim()}</p>
      ))}
    </div>
  )
}

interface ProductTabsBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

export function ProductTabsBlock({ block, layoutStyle }: ProductTabsBlockProps) {
  const { props, styles } = block
  const layout = props.productTabsLayout ?? PRODUCT_TABS_DEFAULTS.productTabsLayout
  const tabs = (props.productTabs ?? []).filter((t) => t.enabled !== false)
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '')

  useEffect(() => {
    if (!tabs.length) {
      setActiveId('')
      return
    }
    if (!tabs.some((t) => t.id === activeId)) {
      setActiveId(tabs[0]?.id ?? '')
    }
  }, [tabs, activeId])

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]

  if (tabs.length === 0) {
    return (
      <section style={layoutStyle} className="w-full py-8 text-center text-sm text-gray-400">
        Add product tabs in the properties panel
      </section>
    )
  }

  const tabButtonClass = (isActive: boolean) => {
    if (layout === 'pills') {
      return isActive
        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
    }
    if (layout === 'boxed') {
      return isActive
        ? 'bg-white text-brand-700 shadow-sm ring-1 ring-brand-200 dark:bg-gray-900 dark:text-brand-300 dark:ring-brand-800'
        : 'text-gray-600 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900/40'
    }
    return isActive
      ? 'text-brand-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-600 dark:text-brand-400'
      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
  }

  const tabListWrapClass =
    layout === 'pills'
      ? 'flex flex-wrap gap-2'
      : layout === 'boxed'
        ? 'flex flex-wrap gap-1 rounded-xl bg-gray-100/80 p-1.5 dark:bg-gray-800/60'
        : 'flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700'

  return (
    <section style={layoutStyle} className="w-full">
      {(props.text || props.subtitle) && (
        <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8" />
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40">
        <div className={`px-4 pt-4 sm:px-6 sm:pt-5 ${layout === 'underline' ? 'pb-0' : 'pb-4'}`}>
          <div className={tabListWrapClass} role="tablist" aria-label="Product information">
              {tabs.map((tab) => {
                const isActive = tab.id === active?.id
                const Icon = getTabIcon(tab)
                return (
                  <button
                    key={tab.id ?? tab.label}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveId(tab.id ?? '')}
                    className={`relative inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${tabButtonClass(isActive)}`}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />}
                    {tab.label}
                  </button>
                )
              })}
            </div>
        </div>

        <div
          role="tabpanel"
          className="border-t border-gray-100 bg-gradient-to-b from-gray-50/50 to-white px-6 py-6 dark:border-gray-800 dark:from-gray-900/30 dark:to-gray-900/60 sm:px-8 sm:py-8"
        >
          {active && (
            <>
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{active.label}</h3>
              <TabContent content={active.content ?? ''} />
            </>
          )}
        </div>
      </div>
    </section>
  )
}
