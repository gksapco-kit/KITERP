import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VendorCategory } from '@/types'
import { categoryNodeToFields, findCategoryNode } from '@/lib/categoryHierarchy'

interface Props {
  tree: VendorCategory[]
  category: string
  subcategory?: string
  onChange: (category: string, subcategory: string) => void
  className?: string
  emptyLabel?: string
}

function TreeNode({
  node,
  tree,
  level,
  selectedId,
  onSelect,
}: {
  node: VendorCategory
  tree: VendorCategory[]
  level: number
  selectedId: string | null
  onSelect: (node: VendorCategory) => void
}) {
  const hasChildren = (node.children?.length ?? 0) > 0
  const [open, setOpen] = useState(level < 2)
  const isSelected = selectedId === node.id

  return (
    <div>
      <div
        className="flex items-center gap-1"
        style={{ paddingLeft: `${level * 16}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 shrink-0"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-[18px] shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node)}
          className={cn(
            'flex-1 text-left px-2 py-1.5 rounded text-sm transition-colors',
            isSelected
              ? 'bg-blue-50 text-blue-800 font-medium ring-1 ring-blue-200'
              : 'text-gray-700 hover:bg-gray-50',
          )}
        >
          <span className={level === 0 ? 'font-medium' : ''}>{node.name}</span>
        </button>
      </div>
      {open && hasChildren && node.children!.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          tree={tree}
          level={level + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export function CategoryHierarchyPicker({
  tree,
  category,
  subcategory = '',
  onChange,
  className,
  emptyLabel = 'No categories yet. Create categories under Inventory → Categories.',
}: Props) {
  const selectedNode = useMemo(
    () => findCategoryNode(tree, category, subcategory),
    [tree, category, subcategory],
  )
  const selectedId = selectedNode?.id ?? null

  const handleSelect = (node: VendorCategory) => {
    const fields = categoryNodeToFields(tree, node)
    onChange(fields.category, fields.subcategory)
  }

  if (!tree.length) {
    return (
      <p className={cn('text-xs text-gray-400 rounded-lg border border-dashed px-3 py-4', className)}>
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className={cn('rounded-lg border bg-white max-h-52 overflow-y-auto p-2', className)}>
      {tree.map(node => (
        <TreeNode
          key={node.id}
          node={node}
          tree={tree}
          level={0}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}
