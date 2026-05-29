import { ChevronRight, Home } from 'lucide-react'

interface Crumb {
  label: string
  onClick?: () => void
}

interface StackBreadcrumbsProps {
  crumbs: Crumb[]
}

export function StackBreadcrumbs({ crumbs }: StackBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-1 text-sm text-gray-500">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        const isHome = i === 0 && crumb.label === 'Home'
        return (
          <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />}
            {isLast ? (
              <span className="font-medium text-gray-900">{crumb.label}</span>
            ) : crumb.onClick ? (
              <button
                type="button"
                onClick={crumb.onClick}
                className="inline-flex items-center gap-1 font-medium transition hover:text-brand-600"
              >
                {isHome && <Home className="h-3.5 w-3.5" />}
                {crumb.label}
              </button>
            ) : (
              <span>{crumb.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
