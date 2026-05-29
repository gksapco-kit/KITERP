import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { CategoryStackCard } from '../components/blocks/CategoryStackCard'
import { LiveSiteShell } from '../components/live/LiveSiteShell'
import { gridColumnClass } from '../lib/blockUtils'
import { findStackCategoryInPages } from '../lib/categoryStackData'
import { stackItemPath } from '../lib/categoryStackNav'
import { useBuilderStore } from '../store/useBuilderStore'

export function CategoryAllPage() {
  const { blockId, categoryId } = useParams()
  const navigate = useNavigate()
  const pages = useBuilderStore((s) => s.pages)

  const hit =
    blockId && categoryId ? findStackCategoryInPages(pages, blockId, categoryId) : null

  if (!hit) {
    return (
      <LiveSiteShell>
        <p className="text-center text-gray-500">Category not found.</p>
        <p className="mt-4 text-center">
          <Link to="/site/home" className="text-brand-600 hover:underline">
            Back to home
          </Link>
        </p>
      </LiveSiteShell>
    )
  }

  const { category } = hit
  const cols = Math.min(Math.max(hit.block.props.columns ?? 4, 2), 6)

  return (
    <LiveSiteShell>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
        {category.label}
        <span className="ml-2 text-lg font-normal text-gray-500">
          ({category.items.length} {category.items.length === 1 ? 'item' : 'items'})
        </span>
      </h1>

      <div className={`mt-8 grid gap-5 ${gridColumnClass(cols, 'responsive')}`}>
        {category.items.map((item) => (
          <CategoryStackCard
            key={item.id}
            item={item}
            interactive
            onClick={() => item.id && blockId && navigate(`/site/${stackItemPath(blockId, item.id)}`)}
          />
        ))}
      </div>
    </LiveSiteShell>
  )
}
