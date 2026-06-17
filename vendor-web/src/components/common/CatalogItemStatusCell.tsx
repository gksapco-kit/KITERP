type CatalogItemStatusCellProps = {
  status: string
  isVisible?: boolean
}

export function CatalogItemStatusCell({ status, isVisible = true }: CatalogItemStatusCellProps) {
  const statusClass =
    status === 'active'
      ? 'bg-green-100 text-green-700'
      : status === 'archived'
        ? 'bg-red-50 text-red-600'
        : 'bg-gray-100 text-gray-700'

  const visibilityClass = isVisible
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
    : 'bg-amber-50 text-amber-800 border border-amber-100'

  return (
    <div className="flex flex-wrap gap-1">
      <span className={`px-2 py-0.5 text-xs rounded-full font-semibold whitespace-nowrap capitalize ${statusClass}`}>
        {status}
      </span>
      <span className={`px-2 py-0.5 text-xs rounded-full font-semibold whitespace-nowrap ${visibilityClass}`}>
        {isVisible ? 'Visible' : 'Hidden'}
      </span>
    </div>
  )
}
