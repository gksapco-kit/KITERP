import { ArrowRight, Layers } from 'lucide-react'
import { CategoryStackCard } from '../blocks/CategoryStackCard'
import type { TabCategory } from '../../types/builder'
import { stackCategoryPath, stackItemPath } from '../../lib/categoryStackNav'

interface StackExploreSectionProps {
  blockId: string
  categories: TabCategory[]
  currentCategoryId?: string
  relatedItems?: TabCategory['items']
  currentItemId?: string
  onNavigate: (path: string) => void
}

function categoryCoverImage(category: TabCategory): string | undefined {
  return category.items.find((i) => i.imageUrl)?.imageUrl
}

export function StackExploreSection({
  blockId,
  categories,
  currentCategoryId,
  relatedItems = [],
  currentItemId,
  onNavigate,
}: StackExploreSectionProps) {
  const otherCategories = categories.filter((c) => c.id !== currentCategoryId)

  return (
    <div className="mt-16 space-y-14 border-t border-gray-100 pt-14">
      {relatedItems.length > 0 && (
        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">You may also like</h2>
              <p className="mt-1 text-sm text-gray-500">More items from this category</p>
            </div>
            {currentCategoryId && (
              <button
                type="button"
                onClick={() => onNavigate(stackCategoryPath(blockId, currentCategoryId))}
                className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 sm:inline-flex"
              >
                View all <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedItems.map((item) => (
              <CategoryStackCard
                key={item.id}
                item={item}
                interactive
                onClick={() => item.id && onNavigate(stackItemPath(blockId, item.id))}
              />
            ))}
          </div>
          {currentCategoryId && (
            <button
              type="button"
              onClick={() => onNavigate(stackCategoryPath(blockId, currentCategoryId))}
              className="mt-4 text-sm font-semibold text-brand-600 hover:text-brand-700 sm:hidden"
            >
              View all in category →
            </button>
          )}
        </section>
      )}

      {otherCategories.length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Explore other categories</h2>
            <p className="mt-1 text-sm text-gray-500">Browse more collections</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherCategories.map((cat) => {
              const cover = categoryCoverImage(cat)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onNavigate(stackCategoryPath(blockId, cat.id))}
                  className="group flex overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition hover:border-brand-200 hover:shadow-md"
                >
                  <div className="h-24 w-24 shrink-0 overflow-hidden bg-gray-100 sm:h-28 sm:w-28">
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <Layers className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
                    <p className="truncate font-semibold text-gray-900 group-hover:text-brand-700">{cat.label}</p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {cat.items.length} {cat.items.length === 1 ? 'item' : 'items'}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">
                      Browse <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <footer className="rounded-2xl bg-gray-50 px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Quick links</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onNavigate(stackCategoryPath(blockId, cat.id))}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      cat.id === currentCategoryId
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-gray-700 shadow-sm hover:bg-brand-50 hover:text-brand-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            {currentItemId && currentCategoryId && (
              <p className="max-w-xs text-sm text-gray-500">
                Viewing item in{' '}
                <button
                  type="button"
                  onClick={() => onNavigate(stackCategoryPath(blockId, currentCategoryId))}
                  className="font-medium text-brand-600 hover:underline"
                >
                  {categories.find((c) => c.id === currentCategoryId)?.label}
                </button>
                . Explore related items above or switch categories.
              </p>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
