import { useMemo } from 'react'
import type { StoreLocation } from '@/api/store'
import { useVendor, type VendorData } from '@/contexts/VendorContext'
import { useBranch } from '@/contexts/BranchContext'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { applyBranchToVendor } from '@/lib/branchStorefrontIdentity'

function branchFromSiteScope(
  branches: StoreLocation[],
  styleConfig: Record<string, unknown> | undefined,
): StoreLocation | null {
  const scope = String(styleConfig?.website_store_scope ?? '').trim().toLowerCase()
  const storeId = String(styleConfig?.website_store_id ?? '').trim()
  if (scope !== 'store' || !storeId) return null
  return branches.find((s) => s.id === storeId) ?? null
}

/** Active business unit: ?branch= param first, then a store-scoped website assignment. */
export function useEffectiveBranch(): StoreLocation | null {
  const { selectedBranch, branches } = useBranch()
  const { builderSite } = useBuilderSite()

  return useMemo(() => {
    if (selectedBranch) return selectedBranch
    const styleConfig = (builderSite?.style_config ?? {}) as Record<string, unknown>
    return branchFromSiteScope(branches, styleConfig)
  }, [selectedBranch, branches, builderSite?.style_config])
}

/** Vendor profile as shown on the storefront — per active business unit when one is resolved. */
export function useEffectiveVendor(): VendorData | null {
  const { vendor } = useVendor()
  const branch = useEffectiveBranch()
  return useMemo(
    () => (vendor ? applyBranchToVendor(vendor, branch) : null),
    [vendor, branch],
  )
}
