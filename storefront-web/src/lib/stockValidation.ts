import { useCartStore } from '@/stores/cartStore'
import { useGuestCartStore } from '@/stores/guestCartStore'

export type StockEntity = {
  track_inventory?: boolean
  allow_backorders?: boolean
  quantity?: number
  stock_status?: string
  max_quantity_per_order?: number | null
  min_quantity_per_order?: number | null
}

export type CartStockLine = {
  product_id: string
  variant_id?: string
  qty: number
}

export type StockValidationResult =
  | { ok: true }
  | { ok: false; message: string }

export function getCurrentCartStockLines(vendorSlug: string, isAuthenticated: boolean): CartStockLine[] {
  if (!isAuthenticated) {
    return useGuestCartStore.getState().getItems(vendorSlug).map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      qty: item.qty,
    }))
  }
  const items = useCartStore.getState().cart?.items ?? []
  return items.map((item) => ({
    product_id: String(item.product_id),
    variant_id: item.variant_id ? String(item.variant_id) : undefined,
    qty: Number(item.qty),
  }))
}

export function getCartQtyForVariant(
  cartLines: CartStockLine[],
  productId: string,
  variantId?: string,
): number {
  return cartLines.reduce((sum, line) => {
    if (line.product_id !== productId) return sum
    if (variantId) {
      return line.variant_id === variantId ? sum + line.qty : sum
    }
    if (!line.variant_id || line.variant_id === productId) return sum + line.qty
    return sum
  }, 0)
}

function resolveStockContext(product: StockEntity, variant?: StockEntity) {
  return {
    track: variant?.track_inventory ?? product.track_inventory ?? true,
    allowBackorders: variant?.allow_backorders ?? product.allow_backorders ?? false,
    quantity: variant?.quantity ?? product.quantity ?? 0,
    stockStatus: variant?.stock_status ?? product.stock_status ?? 'in_stock',
    maxPerOrder: variant?.max_quantity_per_order ?? product.max_quantity_per_order ?? null,
    minPerOrder: variant?.min_quantity_per_order ?? product.min_quantity_per_order ?? null,
  }
}

function capByOrderLimit(available: number, maxPerOrder: number | null | undefined, cartQtyExcludingLine: number): number {
  if (maxPerOrder == null || maxPerOrder <= 0) return available
  return Math.max(0, Math.min(available, maxPerOrder - cartQtyExcludingLine))
}

function validateMinOrderQuantity(
  label: string,
  totalQty: number,
  minPerOrder: number | null | undefined,
): StockValidationResult | null {
  if (totalQty <= 0) return null
  if (minPerOrder == null || minPerOrder <= 1) return null
  if (totalQty >= minPerOrder) return null
  return {
    ok: false,
    message: `Minimum ${minPerOrder} of ${label} required per order.`,
  }
}

/** Minimum qty per order for a variant (defaults to 1). */
export function getMinAddQuantity(input: {
  product: StockEntity
  variant?: StockEntity
}): number {
  const { minPerOrder } = resolveStockContext(input.product, input.variant)
  if (minPerOrder == null || minPerOrder <= 1) return 1
  return minPerOrder
}

export function validateAddToCartStock(input: {
  productName: string
  product: StockEntity
  variant?: StockEntity
  variantLabel?: string
  requestQty: number
  cartQty: number
}): StockValidationResult {
  const label = input.variantLabel?.trim() || input.productName
  const { track, allowBackorders, quantity, stockStatus, maxPerOrder, minPerOrder } = resolveStockContext(
    input.product,
    input.variant,
  )

  if (stockStatus === 'out_of_stock') {
    return { ok: false, message: `${label} is out of stock.` }
  }

  const totalQty = input.cartQty + input.requestQty
  const minError = validateMinOrderQuantity(label, totalQty, minPerOrder)
  if (minError) return minError

  if (maxPerOrder != null && maxPerOrder > 0 && totalQty > maxPerOrder) {
    const remaining = maxPerOrder - input.cartQty
    if (input.cartQty > 0 && remaining <= 0) {
      return {
        ok: false,
        message: `You already have the maximum allowed (${maxPerOrder}) of ${label} in your cart.`,
      }
    }
    if (input.cartQty > 0) {
      return {
        ok: false,
        message: `Only ${remaining} more ${label} can be added — max ${maxPerOrder} per order.`,
      }
    }
    return {
      ok: false,
      message: `Maximum ${maxPerOrder} of ${label} allowed per order.`,
    }
  }

  if (!track || allowBackorders) {
    return { ok: true }
  }

  const available = Math.max(0, quantity)
  if (available <= 0) {
    return { ok: false, message: `${label} is out of stock.` }
  }

  const totalRequested = input.cartQty + input.requestQty
  if (totalRequested <= available) {
    return { ok: true }
  }

  const remaining = available - input.cartQty
  if (input.cartQty > 0 && remaining <= 0) {
    return {
      ok: false,
      message: `You already have the maximum available quantity (${available}) of ${label} in your cart.`,
    }
  }

  if (input.cartQty > 0) {
    return {
      ok: false,
      message: `Only ${remaining} more ${label} can be added — ${available} in stock and ${input.cartQty} already in your cart.`,
    }
  }

  return {
    ok: false,
    message: `Only ${available} ${label} available in stock.`,
  }
}

/** Max qty allowed on one cart line (other lines for same variant count toward the cap). */
export function getMaxLineQuantity(input: {
  vendorSlug: string
  isAuthenticated: boolean
  productId: string
  product: StockEntity
  variant?: StockEntity & { id?: string }
  currentLineQty: number
}): number {
  const cartLines = getCurrentCartStockLines(input.vendorSlug, input.isAuthenticated)
  const cartQty = getCartQtyForVariant(cartLines, input.productId, input.variant?.id)
  const cartQtyExcludingLine = Math.max(0, cartQty - input.currentLineQty)
  const { track, allowBackorders, quantity, stockStatus, maxPerOrder } = resolveStockContext(
    input.product,
    input.variant,
  )
  if (stockStatus === 'out_of_stock') return 0
  const orderCap = capByOrderLimit(Number.MAX_SAFE_INTEGER, maxPerOrder, cartQtyExcludingLine)
  if (!track || allowBackorders) return Math.min(99, orderCap)
  return capByOrderLimit(Math.max(0, quantity), maxPerOrder, cartQtyExcludingLine)
}

/** Max qty user can add on product page (cart qty for variant is subtracted). */
export function getMaxAddQuantity(input: {
  vendorSlug: string
  isAuthenticated: boolean
  productId: string
  product: StockEntity
  variant?: StockEntity & { id?: string }
}): number | null {
  const cartLines = getCurrentCartStockLines(input.vendorSlug, input.isAuthenticated)
  const cartQty = getCartQtyForVariant(cartLines, input.productId, input.variant?.id)
  const { track, allowBackorders, quantity, stockStatus, maxPerOrder } = resolveStockContext(
    input.product,
    input.variant,
  )
  if (stockStatus === 'out_of_stock') return 0
  const orderCap = capByOrderLimit(Number.MAX_SAFE_INTEGER, maxPerOrder, cartQty)
  if (!track || allowBackorders) return orderCap >= Number.MAX_SAFE_INTEGER ? null : orderCap
  const stockCap = Math.max(0, Math.max(0, quantity) - cartQty)
  const capped = capByOrderLimit(stockCap, maxPerOrder, cartQty)
  return capped
}

export function assertCanSetCartLineQty(input: {
  vendorSlug: string
  isAuthenticated: boolean
  productId: string
  productName: string
  product: StockEntity
  variant?: StockEntity & { id?: string; name?: string }
  variantLabel?: string
  currentLineQty: number
  newQty: number
}): StockValidationResult {
  if (input.newQty <= 0) return { ok: true }
  const cartLines = getCurrentCartStockLines(input.vendorSlug, input.isAuthenticated)
  const cartQty = getCartQtyForVariant(cartLines, input.productId, input.variant?.id)
  const cartQtyExcludingLine = Math.max(0, cartQty - input.currentLineQty)
  return validateAddToCartStock({
    productName: input.productName,
    product: input.product,
    variant: input.variant,
    variantLabel: input.variantLabel,
    requestQty: input.newQty,
    cartQty: cartQtyExcludingLine,
  })
}

export function assertCanAddToCart(input: {
  vendorSlug: string
  isAuthenticated: boolean
  productId: string
  productName: string
  product: StockEntity
  variant?: StockEntity & { id?: string; name?: string }
  variantLabel?: string
  requestQty: number
}): StockValidationResult {
  const cartLines = getCurrentCartStockLines(input.vendorSlug, input.isAuthenticated)
  const cartQty = getCartQtyForVariant(cartLines, input.productId, input.variant?.id)
  return validateAddToCartStock({
    productName: input.productName,
    product: input.product,
    variant: input.variant,
    variantLabel: input.variantLabel,
    requestQty: input.requestQty,
    cartQty,
  })
}
