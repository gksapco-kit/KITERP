import { useMemo } from 'react'
import { useVendorStore } from '@/stores/vendorStore'
import { useStores } from '@/hooks/useVendor'
import { formatStoreCode } from '@/lib/verification'
import { BUSINESS_UNIT_STORE_LABEL } from '@/lib/businessUnitLabels'

export type BusinessUnitScopeMode = 'all' | 'unit' | 'single' | 'none'

/** Label for settings tiles / scope UI — stays in sync with the header business-unit picker. */
export function useBusinessUnitScopeLabel() {
  const selectedStore = useVendorStore((s) => s.selectedStore)
  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []

  return useMemo(() => {
    const matched = selectedStore
      ? stores.find((s) => s.id === selectedStore.id)
      : undefined
    const effective = matched ?? (stores.length === 1 ? stores[0] : null)

    if (stores.length > 1 && !selectedStore) {
      return {
        label: `Applies to all ${BUSINESS_UNIT_STORE_LABEL}`,
        heading: `All ${BUSINESS_UNIT_STORE_LABEL}`,
        mode: 'all' as const,
        storeId: null as string | null,
        storeName: null as string | null,
      }
    }
    if (selectedStore?.id || effective) {
      const name =
        effective?.name ?? selectedStore?.name ?? BUSINESS_UNIT_STORE_LABEL
      const id = effective?.id ?? selectedStore?.id ?? null
      const code = effective ? formatStoreCode(effective) : null
      const heading = code ? `${code} — ${name}` : name
      return {
        label: `Applies to ${name}`,
        heading,
        mode: (stores.length === 1 ? 'single' : 'unit') as BusinessUnitScopeMode,
        storeId: id,
        storeName: name,
      }
    }
    return {
      label: `Applies to your ${BUSINESS_UNIT_STORE_LABEL}`,
      heading: `Your ${BUSINESS_UNIT_STORE_LABEL}`,
      mode: 'none' as const,
      storeId: null,
      storeName: null,
    }
  }, [
    selectedStore?.id,
    selectedStore?.name,
    stores.length,
    stores.map((s) => `${s.id}:${s.name}`).join('|'),
  ])
}
