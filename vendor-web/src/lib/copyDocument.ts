import type { PurchaseRequisition, PurchaseRequisitionItem, VendorInvoice } from '@/types'
import { emptyItem, type ItemRow, type RequisitionType } from '@/components/procurement/procurementLineItemTypes'

export const PO_COPY_FROM_ID_KEY = 'po_copy_from_id'
export const PR_COPY_FROM_ID_KEY = 'pr_copy_from_id'
export const SALES_DOC_COPY_FROM_KEY = 'sales_doc_copy_from'
export const AP_INVOICE_COPY_FROM_ID_KEY = 'ap_invoice_copy_from_id'

export function parsePrTitleNotes(notes?: string | null): { title: string; internalNotes: string } {
  if (!notes?.trim()) return { title: '', internalNotes: '' }
  const idx = notes.indexOf('\n\n')
  if (idx === -1) return { title: notes.trim(), internalNotes: '' }
  return { title: notes.slice(0, idx).trim(), internalNotes: notes.slice(idx + 2).trim() }
}

export function prToCopyItemRows(pr: PurchaseRequisition): ItemRow[] {
  if (!pr.items?.length) return [emptyItem()]
  return pr.items.map((it: PurchaseRequisitionItem) => {
    const itemType = (it.item_type || pr.requisition_type || 'product') as RequisitionType
    return {
      ...emptyItem(itemType),
      item_type: itemType,
      priority: pr.priority || 'medium',
      reference_id: it.product_id || it.service_id || it.asset_category_id || '',
      variant_id: it.variant_id || '',
      description: it.description || it.product_name || it.service_name || '',
      quantity: it.quantity,
      uom: it.unit_of_measure || it.uom || 'piece',
      estimated_price: it.estimated_price != null ? String(it.estimated_price) : '',
      needed_by_date: it.needed_by_date || '',
      notes: it.notes || '',
      plant_id: it.plant_id || '',
      storage_location_id: it.storage_location_id || '',
      tax_code: it.tax_code || '',
    }
  })
}

export function vendorInvoiceToCopyLines(invoice: VendorInvoice): Array<{
  description: string
  qty: number
  uom: string
  unit_price: number
  tax_code: string
}> {
  const lines = invoice.items ?? []
  if (!lines.length) return [{ description: '', qty: 1, uom: 'PCS', unit_price: 0, tax_code: '' }]
  return lines.map(item => ({
    description: item.description || item.product_name || '',
    qty: Number(item.invoiced_qty) || 1,
    uom: item.uom || 'PCS',
    unit_price: Number(item.unit_price) || 0,
    tax_code: item.tax_code || '',
  }))
}

export function salesInvoiceToCopyPrefill(inv: Record<string, unknown>) {
  const rawItems = Array.isArray(inv.items) ? inv.items as Array<Record<string, unknown>> : []
  const items = rawItems.map(row => ({
    name: String(row.name || ''),
    hsn_sac: String(row.hsn_sac || row.hsn_code || ''),
    qty: Number(row.qty ?? row.quantity ?? 1),
    rate: Number(row.rate ?? row.price ?? 0),
    discount: Number(row.discount || 0),
    tax_rate: Number(row.tax_rate ?? row.gst_rate ?? 18),
    product_id: row.product_id ? String(row.product_id) : undefined,
    variant_id: row.variant_id ? String(row.variant_id) : undefined,
    kind: (row.kind === 'service' ? 'service' : 'product') as 'product' | 'service',
  }))
  return {
    customer_id: inv.customer_id ? String(inv.customer_id) : '',
    customer_name: String(inv.customer_name || ''),
    customer_email: String(inv.customer_email || ''),
    customer_phone: String(inv.customer_phone || ''),
    customer_gstin: String(inv.customer_gstin || ''),
    notes: String(inv.notes || ''),
    terms_and_conditions: String(inv.terms_and_conditions || ''),
    place_of_supply: String(inv.place_of_supply || ''),
    is_inter_state: Boolean(inv.is_inter_state),
    sales_area_id: inv.sales_area_id ? String(inv.sales_area_id) : '',
    store_id: inv.store_id ? String(inv.store_id) : '',
    items: items.length ? items : undefined,
  }
}
