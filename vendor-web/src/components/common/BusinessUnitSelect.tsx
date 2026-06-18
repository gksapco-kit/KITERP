import { useEffect, useMemo } from 'react'
import { useStores } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import type { StoreRecord } from '@/api/vendor'

/**
 * Resolve the default business unit to pre-select in creation forms:
 * the active header "Business Unit / Store" selection, else the vendor's
 * default (flagged) store, else the only/oldest active store.
 */
export function useDefaultBusinessUnitId(): { defaultId: string | null; stores: StoreRecord[]; isLoading: boolean } {
  const selectedStore = useVendorStore((s) => s.selectedStore)
  const { data, isLoading } = useStores()
  const stores = useMemo(() => (data?.stores ?? []).filter((s) => s.is_active), [data])

  const defaultId = useMemo(() => {
    if (selectedStore?.id && stores.some((s) => s.id === selectedStore.id)) return selectedStore.id
    const flagged = stores.find((s) => s.is_default)
    if (flagged) return flagged.id
    return stores[0]?.id ?? null
  }, [selectedStore?.id, stores])

  return { defaultId, stores, isLoading }
}

/** Resolve a store id to a human label ("CODE — Name"), for detail views. */
export function useStoreName(storeId?: string | null): string | null {
  const { data } = useStores()
  if (!storeId) return null
  const s = (data?.stores ?? []).find((x) => x.id === storeId)
  if (!s) return null
  return s.code ? `${s.code} — ${s.name}` : s.name
}

interface BusinessUnitSelectProps {
  value: string
  onChange: (storeId: string) => void
  /** Adds an "All business units" option (value ""). */
  allowAll?: boolean
  /** When true (default) and value is empty without allowAll, auto-selects the default BU. */
  autoSelectDefault?: boolean
  className?: string
  disabled?: boolean
  id?: string
}

/** Single business-unit (store) selector for creation forms. */
export function BusinessUnitSelect({
  value,
  onChange,
  allowAll = false,
  autoSelectDefault = true,
  className,
  disabled,
  id,
}: BusinessUnitSelectProps) {
  const { defaultId, stores } = useDefaultBusinessUnitId()

  useEffect(() => {
    if (!value && !allowAll && autoSelectDefault && defaultId) {
      onChange(defaultId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultId, value, allowAll, autoSelectDefault])

  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        'w-full h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-gray-50 disabled:text-gray-500'
      }
    >
      {allowAll && <option value="">All business units</option>}
      {!allowAll && !value && <option value="">Select a business unit…</option>}
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.code ? `${s.code} — ${s.name}` : s.name}
          {s.is_default ? ' (default)' : ''}
        </option>
      ))}
    </select>
  )
}
