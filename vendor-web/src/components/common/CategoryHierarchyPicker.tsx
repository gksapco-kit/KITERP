import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { VendorCategory } from '@/types'
import { flattenCategoryTree, findCategoryNode } from '@/lib/categoryHierarchy'
import { formSelectClass } from '@/components/common/FormSectionNav'

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
  const options = useMemo(() => flattenCategoryTree(tree), [tree])

  const selectedNode = useMemo(
    () => findCategoryNode(tree, category, subcategory),
    [tree, category, subcategory],
  )
  const selectedId = selectedNode?.id ?? ''

  if (!tree.length) {
    return (
      <p className={cn('text-xs text-gray-400 rounded-lg border border-dashed px-3 py-4', className)}>
        {emptyLabel}
      </p>
    )
  }

  return (
    <select
      className={cn(formSelectClass, 'w-full', className)}
      value={selectedId}
      onChange={(e) => {
        const opt = options.find((o) => o.id === e.target.value)
        if (opt) onChange(opt.category, opt.subcategory)
        else onChange('', '')
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {formatOptionLabel(opt.category, opt.subcategory)}
        </option>
      ))}
    </select>
  )
}
