import type { CardItem } from '../../types/builder'

interface CategoryStackCardProps {
  item: CardItem
  interactive?: boolean
  onClick?: () => void
}

export function CategoryStackCard({ item, interactive, onClick }: CategoryStackCardProps) {
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      className={`group w-full overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-sm transition ${
        interactive ? 'cursor-pointer hover:border-brand-200 hover:shadow-md' : 'cursor-default'
      }`}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">No image</div>
        )}
      </div>
      <div className="p-3">
        {item.badge && (
          <span className="mb-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
            {item.badge}
          </span>
        )}
        <p className="line-clamp-2 text-sm font-semibold text-gray-900">{item.title}</p>
        {item.price && <p className="mt-1 text-xs font-bold text-brand-600">{item.price}</p>}
      </div>
    </button>
  )
}
