import { VariantManagementPanel } from '@/components/products/VariantManagementPanel'

interface Props {
  productId: string
}

/** Backward-compatible alias — use VariantManagementPanel for cards/fast-edit toggle. */
export function VariantManagementGrid({ productId }: Props) {
  return <VariantManagementPanel productId={productId} />
}
