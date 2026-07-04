import { useCallback, useEffect, useState } from 'react'
import {
  loadProductVariantPresets,
  type ProductVariantPresets,
} from '@/lib/productVariantPresets'

export function useProductVariantPresets(vendorId?: string) {
  const [presets, setPresets] = useState<ProductVariantPresets>(() => loadProductVariantPresets(vendorId))

  const refresh = useCallback(() => {
    setPresets(loadProductVariantPresets(vendorId))
  }, [vendorId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('kiterp:variant-presets-changed', handler)
    return () => window.removeEventListener('kiterp:variant-presets-changed', handler)
  }, [refresh])

  return { presets, refresh }
}
