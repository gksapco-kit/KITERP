import { useMemo } from 'react'
import { useStorageLocationTree } from '@/hooks/useVendor'
import type { StorageLocation } from '@/types'
import { Loader2 } from 'lucide-react'

function flattenLocations(
  nodes: StorageLocation[],
  prefix = '',
): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  for (const node of nodes) {
    out.push({ id: node.id, label: prefix + node.name })
    if (node.children?.length) {
      out.push(...flattenLocations(node.children, prefix + node.name + ' / '))
    }
  }
  return out
}

type Props = {
  storeId: string
  value: string
  onChange: (id: string) => void
  className?: string
  allowEmpty?: boolean
  emptyLabel?: string
}

export function StorageLocationSelect({
  storeId,
  value,
  onChange,
  className,
  allowEmpty = true,
  emptyLabel = 'No specific location (BU-level)',
}: Props) {
  const { data, isLoading } = useStorageLocationTree(storeId || null)

  const options = useMemo(
    () => flattenLocations(data?.locations ?? []),
    [data?.locations],
  )

  if (!storeId) {
    return (
      <p className="text-xs text-gray-400">Select a business unit first to pick a storage location.</p>
    )
  }

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
  }

  if (options.length === 0) {
    return (
      <p className="text-xs text-gray-400">
        No storage locations for this unit.{' '}
        <a href="/storage-locations" className="text-indigo-600 underline">Create locations</a>
      </p>
    )
  }

  return (
    <select
      className={className}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {options.map(o => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  )
}
