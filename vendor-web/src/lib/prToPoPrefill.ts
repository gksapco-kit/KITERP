/** Prefill CreatePOModal when converting an approved Purchase Requisition. */
export const PO_FROM_PR_KEY = 'po_from_pr_prefill'

/**
 * Prefill key for creating a PR/PO directly from an inventory reorder/low-stock alert.
 * Stored in sessionStorage; consumed and cleared by the target page on mount.
 */
export const PR_FROM_INVENTORY_KEY = 'pr_from_inventory_prefill'
export const PO_FROM_INVENTORY_KEY = 'po_from_inventory_prefill'

export interface InventoryAlertPrefill {
  productId: string
  variantId?: string
  productName: string
  sku?: string
  /** Quantity to request — e.g. reorder_quantity or (threshold - current) */
  quantity: number
  storeId?: string
  /** Source: 'reorder' or 'low_stock' */
  source: 'reorder' | 'low_stock'
}

export interface PrToPoPrefill {
  requisitionId: string
  prNumber: string
  supplierId?: string
  expectedDate?: string
  notes?: string
  storeId?: string
  items: Array<{
    prItemId: string
    productId: string
    variantId?: string
    quantity: number
    unitCost: number
    note?: string
    plantId?: string
    storageLocationId?: string
  }>
}

type PrLike = {
  id: string
  pr_number: string
  header_supplier_id?: string | null
  required_date?: string | null
  title?: string | null
  notes?: string | null
  store_id?: string | null
  items: Array<{
    id: string
    is_converted?: boolean
    product_id?: string | null
    service_id?: string | null
    variant_id?: string | null
    quantity: number
    estimated_price?: number | string | null
    notes?: string | null
    description?: string
    plant_id?: string | null
    storage_location_id?: string | null
    needed_by_date?: string | null
  }>
}

function toMoney(value: number | string | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Build PO-create prefill from an approved (or partially converted) PR. */
export function buildPrToPoPrefill(pr: PrLike): PrToPoPrefill | null {
  const convertible = (pr.items ?? []).filter((it) => {
    if (it.is_converted) return false
    return Boolean(it.product_id || it.service_id)
  })
  if (!convertible.length) return null

  const noteParts = [pr.title, pr.notes].filter(Boolean)
  const earliestNeedBy = convertible
    .map((it) => it.needed_by_date)
    .filter(Boolean)
    .sort()[0] as string | undefined

  return {
    requisitionId: pr.id,
    prNumber: pr.pr_number,
    supplierId: pr.header_supplier_id || undefined,
    expectedDate: pr.required_date || earliestNeedBy || undefined,
    notes: noteParts.length ? `From ${pr.pr_number}: ${noteParts.join(' — ')}` : `From ${pr.pr_number}`,
    storeId: pr.store_id || undefined,
    items: convertible.map((it) => ({
      prItemId: it.id,
      productId: (it.product_id || it.service_id) as string,
      variantId: it.variant_id || undefined,
      quantity: Number(it.quantity) || 1,
      unitCost: toMoney(it.estimated_price),
      note: it.notes || it.description || undefined,
      plantId: it.plant_id || undefined,
      storageLocationId: it.storage_location_id || undefined,
    })),
  }
}

/** API payload for one-click PR → PO conversion (no edit screen). */
export function buildPoCreatePayloadFromPr(pr: PrLike): Record<string, unknown> | null {
  const prefill = buildPrToPoPrefill(pr)
  if (!prefill?.supplierId || !prefill.items.length) return null

  const first = prefill.items[0]
  return {
    supplier_id: prefill.supplierId,
    expected_delivery_date: prefill.expectedDate || undefined,
    notes: prefill.notes || undefined,
    requisition_id: prefill.requisitionId,
    pr_item_ids: prefill.items.map((i) => i.prItemId),
    items: prefill.items.map((i) => ({
      product_id: i.productId,
      variant_id: i.variantId || undefined,
      quantity: Math.max(1, Math.round(i.quantity)),
      unit_cost: i.unitCost,
      description: i.note || undefined,
      plant_id: i.plantId || first.plantId || undefined,
      storage_location_id: i.storageLocationId || first.storageLocationId || undefined,
    })),
  }
}
