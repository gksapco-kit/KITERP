import { useCallback, useMemo, useState } from 'react'

export type SalesScopeApiParams = {
  store_id?: string
  sales_area_id?: string
}

/**
 * Shared BU → Branch → Sales Area filter state for sales module list pages.
 * `store_id` sent to APIs prefers branch, then business unit.
 */
export function useSalesScopeFilter(onScopeChange?: () => void) {
  const [businessUnitId, setBusinessUnitId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [salesAreaId, setSalesAreaId] = useState('')

  const handleBusinessUnitChange = useCallback((id: string) => {
    setBusinessUnitId(id)
    setBranchId('')
    setSalesAreaId('')
    onScopeChange?.()
  }, [onScopeChange])

  const handleBranchChange = useCallback((id: string) => {
    setBranchId(id)
    setSalesAreaId('')
    onScopeChange?.()
  }, [onScopeChange])

  const handleSalesAreaChange = useCallback((id: string) => {
    setSalesAreaId(id)
    onScopeChange?.()
  }, [onScopeChange])

  const storeId = branchId || businessUnitId || undefined

  const apiParams = useMemo((): SalesScopeApiParams => ({
    ...(storeId ? { store_id: storeId } : {}),
    ...(salesAreaId ? { sales_area_id: salesAreaId } : {}),
  }), [storeId, salesAreaId])

  return {
    businessUnitId,
    branchId,
    salesAreaId,
    storeId,
    apiParams,
    setBusinessUnitId,
    setBranchId,
    setSalesAreaId,
    handleBusinessUnitChange,
    handleBranchChange,
    handleSalesAreaChange,
  }
}
