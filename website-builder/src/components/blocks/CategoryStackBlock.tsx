import { resolveStackCategories } from '../../lib/categoryStackData'
import { stackCategoryPath, stackItemPath } from '../../lib/categoryStackNav'
import { SectionHeading } from '../builder/SectionHeading'
import type { Block } from '../../types/builder'
import { CategoryStackCard } from './CategoryStackCard'

interface CategoryStackBlockProps {
  block: Block
  layoutStyle: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

export function CategoryStackBlock({ block, layoutStyle, interactive, onNavigate }: CategoryStackBlockProps) {
  const { props } = block
  const categories = resolveStackCategories(block)
  const previewCount = Math.min(Math.max(props.columns ?? 4, 1), 8)
  const seeAllLabel = props.stackSeeAllLabel ?? 'See all'

  const previewGridClass = (() => {
    switch (previewCount) {
      case 1:
        return 'grid-cols-1'
      case 2:
        return 'grid-cols-2'
      case 3:
        return 'grid-cols-3'
      case 5:
        return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
      case 6:
        return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
      case 7:
        return 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7'
      case 8:
        return 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8'
      default:
        return 'grid-cols-2 sm:grid-cols-4'
    }
  })()

  const goCategory = (categoryId: string) => {
    if (!interactive || !onNavigate) return
    onNavigate(stackCategoryPath(block.id, categoryId))
  }

  const goItem = (itemId: string) => {
    if (!interactive || !onNavigate || !itemId) return
    onNavigate(stackItemPath(block.id, itemId))
  }

  return (
    <section style={layoutStyle} className="w-full min-w-0 space-y-10">
      <SectionHeading title={props.text} subtitle={props.subtitle} styles={block.styles} />

      {categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
          Add categories in the properties panel.
        </p>
      ) : (
        categories.map((category) => {
          const preview = category.items.slice(0, previewCount)
          const total = category.items.length
          return (
            <div key={category.id} className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 sm:text-xl">
                    {category.label}
                    <span className="ml-2 text-base font-normal text-gray-500">
                      ({total} {total === 1 ? 'item' : 'items'})
                    </span>
                  </h3>
                </div>
                {total > 0 && (
                  <button
                    type="button"
                    onClick={() => goCategory(category.id)}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-brand-600 shadow-sm transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    {seeAllLabel}
                  </button>
                )}
              </div>

              {preview.length === 0 ? (
                <p className="text-sm text-gray-400">No items in this category yet.</p>
              ) : (
                <div className={`grid gap-4 ${previewGridClass}`}>
                  {preview.map((item) => (
                    <CategoryStackCard
                      key={item.id}
                      item={item}
                      interactive={interactive}
                      onClick={() => item.id && goItem(item.id)}
                    />
                  ))}
                </div>
              )}

              {total > previewCount && (
                <button
                  type="button"
                  onClick={() => goCategory(category.id)}
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700 sm:hidden"
                >
                  {seeAllLabel} →
                </button>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}
