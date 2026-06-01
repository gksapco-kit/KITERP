import { catalogItemPath } from '@/lib/catalogAddons'
import { cn } from '@/lib/utils'

interface CatalogItemLinkProps {
  id: string
  name: string
  itemType: 'product' | 'service'
  className?: string
  /** Stop click propagation (e.g. inside buttons or rows). */
  stopPropagation?: boolean
}

export function CatalogItemLink({
  id,
  name,
  itemType,
  className,
  stopPropagation = false,
}: CatalogItemLinkProps) {
  const href = catalogItemPath(itemType, id)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm',
        className,
      )}
      onClick={stopPropagation ? e => e.stopPropagation() : undefined}
    >
      {name}
    </a>
  )
}
