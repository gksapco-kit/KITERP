import { useEffect, useState } from 'react'
import { resolveCardImageHeight } from '../../lib/cardSectionLayout'
import { SectionHeading } from '../builder/SectionHeading'
import type { Block } from '../../types/builder'
import { CardGridItems } from './CardGridItems'

interface TabsSectionBlockProps {
  block: Block
  layoutStyle: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

export function TabsSectionBlock({ block, layoutStyle, interactive, onNavigate }: TabsSectionBlockProps) {
  const { props } = block
  const categories = props.tabCategories ?? []
  const [activeId, setActiveId] = useState(categories[0]?.id ?? '')

  useEffect(() => {
    if (!categories.length) {
      setActiveId('')
      return
    }
    if (!categories.some((c) => c.id === activeId)) {
      setActiveId(categories[0].id)
    }
  }, [categories, activeId])

  const active = categories.find((c) => c.id === activeId) ?? categories[0]
  const cols = props.columns ?? 2

  return (
    <section style={layoutStyle} className="w-full min-w-0">
      <SectionHeading title={props.text} subtitle={props.subtitle} styles={block.styles} />

      {categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
          No categories yet — add a category in the properties panel.
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-1">
            {categories.map((cat) => {
              const isActive = cat.id === active?.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveId(cat.id)}
                  className={`relative rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {cat.label}
                  {cat.items.length > 0 && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {cat.items.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <CardGridItems
            cards={active?.items ?? []}
            columns={cols}
            imageHeight={resolveCardImageHeight(props)}
            interactive={interactive}
            onNavigate={onNavigate}
            emptyMessage={`No items in "${active?.label ?? 'this category'}" yet.`}
          />
        </>
      )}
    </section>
  )
}
