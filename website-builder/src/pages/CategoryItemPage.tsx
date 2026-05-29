import { useNavigate, useParams } from 'react-router-dom'
import { Check, Package, Star, Tag } from 'lucide-react'
import { createLinkClickHandler } from '../lib/buttonNavigation'
import {
  findStackBlockInPages,
  findStackItemInPages,
  getHomePageSlug,
  getRelatedStackItems,
} from '../lib/categoryStackData'
import { stackCategoryPath } from '../lib/categoryStackNav'
import { LiveSiteShell } from '../components/live/LiveSiteShell'
import { StackBreadcrumbs } from '../components/live/StackBreadcrumbs'
import { StackExploreSection } from '../components/live/StackExploreSection'
import { useBuilderStore } from '../store/useBuilderStore'

function ItemRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
        />
      ))}
      <span className="ml-1 text-sm text-gray-500">{rating.toFixed(1)}</span>
    </div>
  )
}

export function CategoryItemPage() {
  const { blockId, itemId } = useParams()
  const navigate = useNavigate()
  const pages = useBuilderStore((s) => s.pages)

  const hit = blockId && itemId ? findStackItemInPages(pages, blockId, itemId) : null
  const homeSlug = getHomePageSlug(pages)
  const go = (path: string) => navigate(`/site/${path}`)

  if (!hit || !blockId) {
    return (
      <LiveSiteShell>
        <p className="text-center text-gray-500">Item not found.</p>
        <button
          type="button"
          onClick={() => go(homeSlug)}
          className="mt-4 block w-full text-center text-brand-600 hover:underline"
        >
          Back to home
        </button>
      </LiveSiteShell>
    )
  }

  const { item, category, block, page } = hit
  const stackCtx = findStackBlockInPages(pages, blockId)
  const categories = stackCtx?.categories ?? [category]
  const relatedItems = getRelatedStackItems(category, itemId, 4)
  const collectionTitle = block.props.text ?? 'Collection'
  const titleColor = item.contentStyle?.titleColor
  const descriptionColor = item.contentStyle?.descriptionColor

  const buttonClick = createLinkClickHandler({
    interactive: true,
    link: item.link,
    pages,
    onNavigate: go,
  })

  return (
    <LiveSiteShell>
      <StackBreadcrumbs
        crumbs={[
          { label: 'Home', onClick: () => go(homeSlug) },
          { label: category.label, onClick: () => go(stackCategoryPath(blockId, category.id)) },
          { label: item.title },
        ]}
      />

      <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="grid lg:grid-cols-2">
          <div className="relative bg-gray-50 lg:min-h-[480px]">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full max-h-[520px] w-full object-cover lg:max-h-none lg:min-h-[480px]"
              />
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-gray-400 lg:h-full lg:min-h-[480px]">
                No image
              </div>
            )}
            {item.badge && (
              <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm backdrop-blur">
                {item.badge}
              </span>
            )}
          </div>

          <div className="flex flex-col p-6 sm:p-8 lg:p-10">
            <button
              type="button"
              onClick={() => go(stackCategoryPath(blockId, category.id))}
              className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <Tag className="h-3.5 w-3.5" />
              {category.label}
            </button>

            <h1
              className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl"
              style={titleColor ? { color: titleColor } : undefined}
            >
              {item.title}
            </h1>

            {item.rating != null && item.rating > 0 && (
              <div className="mt-3">
                <ItemRating rating={item.rating} />
              </div>
            )}

            {item.price && (
              <p className="mt-4 text-3xl font-bold tracking-tight text-brand-600">{item.price}</p>
            )}

            {item.description && (
              <p
                className="mt-5 text-base leading-relaxed text-gray-600"
                style={descriptionColor ? { color: descriptionColor } : undefined}
              >
                {item.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {item.buttonText && (
                <a
                  href={item.link || '#'}
                  onClick={buttonClick}
                  className="inline-flex rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  {item.buttonText}
                </a>
              )}
              <button
                type="button"
                onClick={() => go(stackCategoryPath(blockId, category.id))}
                className="inline-flex rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
              >
                View all in {category.label}
              </button>
            </div>

            <div className="mt-8 rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Details</p>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <dt className="font-medium text-gray-700">Category</dt>
                    <dd className="text-gray-500">{category.label}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <dt className="font-medium text-gray-700">Collection</dt>
                    <dd className="text-gray-500">{collectionTitle}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Tag className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <dt className="font-medium text-gray-700">Items in category</dt>
                    <dd className="text-gray-500">
                      {category.items.length} {category.items.length === 1 ? 'item' : 'items'}
                    </dd>
                  </div>
                </div>
                {page.name && (
                  <div className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <div>
                      <dt className="font-medium text-gray-700">Page</dt>
                      <dd className="text-gray-500">{page.name}</dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </article>

      <StackExploreSection
        blockId={blockId}
        categories={categories}
        currentCategoryId={category.id}
        relatedItems={relatedItems}
        currentItemId={itemId}
        onNavigate={go}
      />
    </LiveSiteShell>
  )
}
