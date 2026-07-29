import { useCartStore } from '@/stores/cartStore'
import { useGuestCartStore } from '@/stores/guestCartStore'

export type StockEntity = {
  track_inventory?: boolean
  allow_backorders?: boolean
  quantity?: number
  stock_status?: string
  low_stock_threshold?: number | null
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
  const allowBackorders = variant?.allow_backorders ?? product.allow_backorders ?? false
  const quantity = variant?.quantity ?? product.quantity ?? 0
  const stockStatus = variant?.stock_status ?? product.stock_status ?? 'in_stock'
  const maxPerOrder = variant?.max_quantity_per_order ?? product.max_quantity_per_order ?? null
  const minPerOrder = variant?.min_quantity_per_order ?? product.min_quantity_per_order ?? null
  const lowStockThreshold =
    variant?.low_stock_threshold ?? product.low_stock_threshold ?? null
  const explicitTrack = variant?.track_inventory ?? product.track_inventory
  const hasOnHandQty = variant?.quantity != null || product.quantity != null
  // Enforce on-hand quantity unless backorders are allowed; respect explicit track_inventory=false only when no qty is set.
  const track =
    !allowBackorders &&
    (explicitTrack !== false || hasOnHandQty)

  return {
    track,
    allowBackorders,
    quantity,
    stockStatus,
    maxPerOrder,
    minPerOrder,
    lowStockThreshold,
  }
}

/**
 * Stock label for UI: prefer on-hand qty when inventory is tracked.
 * Fixes stale stock_status="in_stock" while quantity is 0 (common after editing qty without updating status).
 */
export function getEffectiveStockStatus(product: StockEntity, variant?: StockEntity): string {
  const { track, allowBackorders, quantity, stockStatus, lowStockThreshold } = resolveStockContext(
    product,
    variant,
  )

  if (stockStatus === 'discontinued') return 'discontinued'

  if (allowBackorders) {
    if (quantity <= 0) return stockStatus === 'backorder' ? 'backorder' : 'backorder'
    return stockStatus === 'out_of_stock' ? 'in_stock' : stockStatus
  }

  if (track) {
    if (quantity <= 0) return 'out_of_stock'
    if (stockStatus === 'out_of_stock') {
      const thresh = lowStockThreshold ?? 5
      return quantity <= thresh ? 'low_stock' : 'in_stock'
    }
    if (
      (stockStatus === 'in_stock' || stockStatus === 'low_stock') &&
      lowStockThreshold != null &&
      quantity <= lowStockThreshold
    ) {
      return 'low_stock'
    }
    if (stockStatus === 'low_stock' && (lowStockThreshold == null || quantity > lowStockThreshold)) {
      return 'in_stock'
    }
    return stockStatus
  }

  return stockStatus
}

/** On-hand quantity for the selected product/variant, or null when unlimited. */
export function getOnHandQuantity(product: StockEntity, variant?: StockEntity): number | null {
  const { track, allowBackorders, quantity } = resolveStockContext(product, variant)
  if (getEffectiveStockStatus(product, variant) === 'out_of_stock') return 0
  if (!track || allowBackorders) return null
  return Math.max(0, quantity)
}

/** Whether the product/variant can be purchased (matches add-to-cart validation). */
export function canPurchaseProduct(product: StockEntity, variant?: StockEntity): boolean {
  const onHand = getOnHandQuantity(product, variant)
  if (onHand !== null) return onHand > 0
  return getEffectiveStockStatus(product, variant) !== 'out_of_stock'
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
  const { track, allowBackorders, quantity, maxPerOrder, minPerOrder } = resolveStockContext(
    input.product,
    input.variant,
  )

  if (getEffectiveStockStatus(input.product, input.variant) === 'out_of_stock') {
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
      message: `Maximum stock reached — you already have all ${available} available of ${label} in your cart.`,
    }
  }

  if (input.cartQty > 0) {
    return {
      ok: false,
      message: `Maximum stock reached — only ${remaining} more of ${label} can be added (${available} on hand, ${input.cartQty} already in cart).`,
    }
  }

  return {
    ok: false,
    message: `Maximum stock reached — only ${available} of ${label} available on hand.`,
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
  const { track, allowBackorders, quantity, maxPerOrder } = resolveStockContext(
    input.product,
    input.variant,
  )
  if (getEffectiveStockStatus(input.product, input.variant) === 'out_of_stock') return 0
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
  const { track, allowBackorders, quantity, maxPerOrder } = resolveStockContext(
    input.product,
    input.variant,
  )
  if (getEffectiveStockStatus(input.product, input.variant) === 'out_of_stock') return 0
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
