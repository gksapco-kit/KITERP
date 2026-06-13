import { useMemo } from 'react'
import { useVendor, type VendorData } from '@/contexts/VendorContext'
import { useBranch } from '@/contexts/BranchContext'
import { applyBranchToVendor } from '@/lib/branchStorefrontIdentity'

/** Vendor profile as shown on the storefront — switches to the active ?branch= unit when set. */
export function useEffectiveVendor(): VendorData | null {
  const { vendor } = useVendor()
  const { selectedBranch } = useBranch()
  return useMemo(
    () => (vendor ? applyBranchToVendor(vendor, selectedBranch) : null),
    [vendor, selectedBranch],
  )
}
