import type { Product, ProductVariant } from '@/types'
import {
  assertCanSetCartLineQty,
  getMaxLineQuantity,
  type StockValidationResult,
} from '@/lib/stockValidation'
import { resolveSelectedVariant, variantDisplayLabel } from '@/lib/variantOptions'

type CartLineRef = {
  productId: string
  variantId?: string
  variantLabel?: string
  name: string
  quantity: number
}

function resolveCartLineVariant(
  product: Product | undefined,
  line: CartLineRef,
): ProductVariant | undefined {
  if (!product) return undefined
  const activeVariants = (product.variants ?? []).filter((v) => v.is_active !== false)
  const variantId =
    line.variantId && line.variantId !== line.productId ? line.variantId : undefined
  return resolveSelectedVariant(activeVariants, variantId, line.variantLabel)
}

function resolveCartLineProductName(line: CartLineRef): string {
  if (line.variantLabel) {
    const sep = line.name.lastIndexOf(' - ')
    if (sep > 0) return line.name.slice(0, sep)
  }
  return line.name
}

export function validateCartLineQtyChange(input: {
  vendorSlug: string
  isAuthenticated: boolean
  product?: Product
  line: CartLineRef
  newQty: number
}): StockValidationResult {
  if (!input.product || input.newQty <= 0) return { ok: true }
  const variant = resolveCartLineVariant(input.product, input.line)
  return assertCanSetCartLineQty({
    vendorSlug: input.vendorSlug,
    isAuthenticated: input.isAuthenticated,
    productId: input.line.productId,
    productName: resolveCartLineProductName(input.line),
    product: input.product,
    variant,
    variantLabel: variant ? variantDisplayLabel(variant) || variant.name : input.line.variantLabel,
    currentLineQty: input.line.quantity,
    newQty: input.newQty,
  })
}

export function maxCartLineQty(input: {
  vendorSlug: string
  isAuthenticated: boolean
  product?: Product
  line: CartLineRef
}): number {
  if (!input.product) return 99
  const variant = resolveCartLineVariant(input.product, input.line)
  return getMaxLineQuantity({
    vendorSlug: input.vendorSlug,
    isAuthenticated: input.isAuthenticated,
    productId: input.line.productId,
    product: input.product,
    variant,
    currentLineQty: input.line.quantity,
  })
}
