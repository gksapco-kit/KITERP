import { useEffect } from 'react'
import { setStorefrontBuContext } from '@/api/client'
import { useEffectiveBranch } from '@/hooks/useEffectiveVendor'
import { branchCodeForStore } from '@/lib/branchMatching'

/**
 * Keeps API client + customer session bags keyed to the active business unit
 * (URL ?branch= or website_store_id on a store-scoped site).
 */
export default function StorefrontBuAuthSync() {
  const branch = useEffectiveBranch()

  useEffect(() => {
    const storeId = branch?.id ?? null
    const code = branch ? branchCodeForStore(branch) : null
    setStorefrontBuContext(storeId, code)
  }, [branch?.id, branch?.code])

  return null
}
