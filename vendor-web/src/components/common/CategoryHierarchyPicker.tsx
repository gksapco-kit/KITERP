import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FolderTree } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VendorCategory } from '@/types'
import { flattenCategoryTree, findCategoryNode } from '@/lib/categoryHierarchy'
import { Select, type SelectOption } from '@/components/ui/select'

interface Props {
  tree: VendorCategory[]
  category: string
  subcategory?: string
  onChange: (category: string, subcategory: string) => void
  className?: string
  emptyLabel?: string
  emptyHref?: string
  placeholder?: string
}

function formatOptionLabel(category: string, subcategory: string): string {
  if (!subcategory) return category
  return `${category} › ${subcategory.split(' / ').join(' › ')}`
}

export function CategoryHierarchyPicker({
  tree,
  category,
  subcategory = '',
  onChange,
  className,
  emptyLabel = 'No categories yet. Create categories under Inventory → Categories.',
  emptyHref = '/categories',
  placeholder = 'Select category…',
}: Props) {
  const flatOptions = useMemo(() => flattenCategoryTree(tree), [tree])

  const options = useMemo((): SelectOption[] => {
    return [
      { value: '', label: placeholder },
      ...flatOptions.map((opt) => ({
        value: opt.id,
        label: formatOptionLabel(opt.category, opt.subcategory),
      })),
    ]
  }, [flatOptions, placeholder])

  const selectedNode = useMemo(
    () => findCategoryNode(tree, category, subcategory),
    [tree, category, subcategory],
  )
  const selectedId = selectedNode?.id ?? ''

  if (!tree.length) {
    return (
      <div
        role="status"
        title={emptyLabel}
        className="flex h-8 min-h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border border-dashed border-input bg-muted/40 px-2.5 sm:h-9 sm:min-h-9"
      >
        <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          No categories yet
        </span>
        {emptyHref ? (
          <Link
            to={emptyHref}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            Create
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <Select
      value={selectedId}
      onChange={(id) => {
        const opt = flatOptions.find((o) => o.id === id)
        if (opt) onChange(opt.category, opt.subcategory)
        else onChange('', '')
      }}
      options={options}
      placeholder={placeholder}
      aria-label="Category"
      className={cn('w-full', className)}
    />
  )
}
