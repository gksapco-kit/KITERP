import { useMemo } from 'react'
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
      <p className={cn('text-xs text-muted-foreground rounded-lg border border-dashed border-border px-3 py-4', className)}>
        {emptyLabel}
      </p>
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
