import { normalizeLabelKey } from '@/lib/fieldHelpRegistry'
import {
  getFieldMappingByLabel,
  getFieldMappingByTableColumn,
  type SchemaFieldMappingRecord,
} from '@/lib/fieldMappingRuntime'

export type FieldDbMeta = {
  table: string
  column: string
  note?: string
}

/** DB column mapping keyed by normalized label / helpKey text. */
export const FIELD_DB_BY_LABEL: Record<string, FieldDbMeta> = {
  // ── User profile ──
  'full name': {
    table: 'user',
    column: 'full_name',
    note: 'Profile field. Not on vendor_user — join user via vendor_user.user_id.',
  },
  'phone number': { table: 'user', column: 'phone' },

  // ── Settings · vendor profile ──
  'business name': { table: 'vendor', column: 'business_name' },
  'brand name': { table: 'vendor', column: 'display_name' },
  description: { table: 'vendor', column: 'description' },
  'business support email': { table: 'vendor', column: 'support_email' },
  'business support phone': { table: 'vendor', column: 'support_phone' },
  'street address': { table: 'vendor', column: 'street_address' },
  city: { table: 'vendor', column: 'city' },
  state: { table: 'vendor', column: 'state' },
  'postal code': { table: 'vendor', column: 'postal_code' },
  gstin: { table: 'vendor', column: 'gstin' },
  'invoice customer gstin': { table: 'invoice', column: 'customer_gstin' },
  'pan number': { table: 'vendor', column: 'pan_number' },
  'default tax rate (%)': { table: 'vendor', column: 'default_tax_rate' },

  // ── External domain (columns on vendor) ──
  'domain name': { table: 'vendor', column: 'external_domain_name' },
  registrar: { table: 'vendor', column: 'external_domain_registrar' },
  'registrar login email': { table: 'vendor', column: 'external_domain_reg_email' },
  'account holder name': { table: 'vendor', column: 'external_domain_holder' },
  'domain expiry date': { table: 'vendor', column: 'external_domain_expiry' },
  '2fa recovery contact': { table: 'vendor', column: 'external_domain_recovery_contact' },

  // ── Coupons ──
  code: { table: 'coupon', column: 'code' },
  title: { table: 'coupon', column: 'title' },
  'discount type': { table: 'coupon', column: 'discount_type' },
  'discount value': { table: 'coupon', column: 'discount_value' },
  'max discount (₹)': { table: 'coupon', column: 'max_discount' },
  'min order (₹)': { table: 'coupon', column: 'min_order_amount' },
  'total usage limit': { table: 'coupon', column: 'usage_limit' },
  'per customer': { table: 'coupon', column: 'usage_per_customer' },
  active: { table: 'coupon', column: 'is_active' },
  'visible on store': { table: 'coupon', column: 'is_public' },

  // ── Invoices & quotations ──
  'select customer (optional)': {
    table: 'invoice',
    column: 'customer_id',
    note: 'FK → customer.id',
  },
  type: { table: 'invoice', column: 'invoice_type' },
  'valid until': { table: 'invoice', column: 'due_date' },
  'customer name': { table: 'invoice', column: 'customer_name' },
  phone: { table: 'invoice', column: 'customer_phone' },
  'inter-state supply (igst)': { table: 'invoice', column: 'is_inter_state' },
  'line items': { table: 'invoice', column: 'items', note: 'JSONB array of line objects' },
  item: { table: 'invoice', column: 'items', note: 'JSONB path — items[].name' },
  'hsn/sac': { table: 'invoice', column: 'items', note: 'JSONB path — items[].hsn_sac' },
  qty: { table: 'invoice', column: 'items', note: 'JSONB path — items[].qty' },
  'rate (₹)': { table: 'invoice', column: 'items', note: 'JSONB path — items[].rate' },
  'tax %': { table: 'invoice', column: 'items', note: 'JSONB path — items[].tax_rate' },
  notes: { table: 'invoice', column: 'notes' },
  'terms & conditions': { table: 'invoice', column: 'terms_and_conditions' },

  // ── Common list columns ──
  customer: { table: 'customer', column: 'full_name' },
  status: { table: 'invoice', column: 'status', note: 'Column varies by screen context' },
  total: { table: 'invoice', column: 'total' },
  date: { table: 'invoice', column: 'created_at' },
  reference: { table: 'invoice', column: 'order_number' },
  email: { table: 'customer', column: 'email' },
  sku: { table: 'product', column: 'sku' },
  price: { table: 'product', column: 'price' },
  quantity: { table: 'product', column: 'stock_quantity' },
}

/** Optional UI screen names per table.column (Models explorer). */
export const COLUMN_SCREENS: Record<string, string[]> = {
  'vendor.business_name': ['Settings · Business Profile'],
  'vendor.display_name': ['Settings · Business Profile', 'Business Front Display'],
  'vendor.gstin': ['Settings · Business Profile', 'Create Invoice'],
  'vendor.external_domain_name': ['Settings · External Domain'],
  'coupon.code': ['Coupons'],
  'coupon.discount_type': ['Coupons'],
  'coupon.discount_value': ['Coupons'],
  'coupon.is_active': ['Coupons'],
  'coupon.is_public': ['Coupons'],
  'invoice.customer_id': ['Create Invoice', 'Invoices'],
  'invoice.customer_gstin': ['Create Invoice', 'Invoices'],
  'invoice.customer_name': ['Create Invoice', 'Invoices'],
  'invoice.items': ['Create Invoice', 'Invoices'],
  'invoice.total': ['Invoices', 'Reports'],
  'invoice.status': ['Invoices'],
  'customer.full_name': ['Customers', 'Create Invoice'],
  'customer.email': ['Customers'],
  'user.full_name': ['Profile · Personal Information'],
  'user.phone': ['Profile · Personal Information'],
  'user.email': ['Profile · Personal Information'],
  'product.sku': ['Products'],
  'product.price': ['Products'],
}

export type ColumnBusinessLogic = {
  table: string
  column: string
  /** Form / report labels that map to this column (wrench help registry). */
  ui_labels: string[]
  note?: string
  /** Screens / modules where this column is surfaced in the UI. */
  screens?: string[]
  /** Set when mapping was saved from Models UI. */
  user_mapping_id?: string
}

const COLUMN_BUSINESS_LOGIC = (() => {
  const map = new Map<string, ColumnBusinessLogic>()
  for (const [labelKey, meta] of Object.entries(FIELD_DB_BY_LABEL)) {
    const key = `${meta.table}.${meta.column}`
    const existing = map.get(key)
    const uiLabel = labelKey
    const screens = COLUMN_SCREENS[key]
    if (existing) {
      existing.ui_labels.push(uiLabel)
      if (!existing.note && meta.note) existing.note = meta.note
      if (!existing.screens && screens) existing.screens = screens
    } else {
      map.set(key, {
        table: meta.table,
        column: meta.column,
        ui_labels: [uiLabel],
        note: meta.note,
        screens,
      })
    }
  }
  for (const [key, screens] of Object.entries(COLUMN_SCREENS)) {
    if (!map.has(key)) {
      const [table, column] = key.split('.')
      map.set(key, { table, column, ui_labels: [], screens })
    } else {
      const entry = map.get(key)!
      if (!entry.screens) entry.screens = screens
    }
  }
  return map
})()

/** Reverse lookup: which UI labels and notes apply to a DB column (Models explorer). */
export function lookupColumnBusinessLogic(table: string, column: string): ColumnBusinessLogic | null {
  const runtime = getFieldMappingByTableColumn(table, column)
  const code = COLUMN_BUSINESS_LOGIC.get(`${table}.${column}`)
  if (runtime) {
    return {
      table,
      column,
      ui_labels: [runtime.ui_label, ...(code?.ui_labels ?? [])].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
      note: runtime.note ?? code?.note,
      screens: runtime.screens?.length ? runtime.screens : code?.screens,
      user_mapping_id: runtime.id,
    }
  }
  return code ?? null
}

function mappingToDbMeta(m: SchemaFieldMappingRecord): FieldDbMeta {
  return {
    table: m.table_name,
    column: m.column_name,
    note: m.note ?? undefined,
  }
}

export type ResolveFieldDbInput = {
  helpKey?: string
  labelText?: string
  dbTable?: string
  dbField?: string
  dbNote?: string
}

export function resolveFieldDbMeta({
  helpKey,
  labelText = '',
  dbTable,
  dbField,
  dbNote,
}: ResolveFieldDbInput): FieldDbMeta | null {
  if (dbTable?.trim() && dbField?.trim()) {
    return {
      table: dbTable.trim(),
      column: dbField.trim(),
      note: dbNote?.trim() || undefined,
    }
  }
  const runtime =
    getFieldMappingByLabel(helpKey ?? '') ?? getFieldMappingByLabel(labelText)
  if (runtime) return mappingToDbMeta(runtime)
  const candidates = [helpKey, labelText].filter((v): v is string => Boolean(v?.trim()))
  for (const raw of candidates) {
    const byKey = FIELD_DB_BY_LABEL[normalizeLabelKey(raw)]
    if (byKey) return byKey
    const fromLogic = lookupDbMetaByUiLabel(normalizeLabelKey(raw))
    if (fromLogic) return fromLogic
    const fromKeywords = dbMetaFromKeywords(raw)
    if (fromKeywords) return fromKeywords
  }
  return null
}

function lookupDbMetaByUiLabel(normalized: string): FieldDbMeta | null {
  if (!normalized) return null
  for (const entry of COLUMN_BUSINESS_LOGIC.values()) {
    if (entry.ui_labels.some((l) => normalizeLabelKey(l) === normalized)) {
      return {
        table: entry.table,
        column: entry.column,
        note: entry.note,
      }
    }
  }
  return null
}

function dbMetaFromKeywords(label: string): FieldDbMeta | null {
  const lower = normalizeLabelKey(label)
  if (!lower) return null
  if (lower.includes('full name') || lower === 'contact name') {
    return {
      table: 'user',
      column: 'full_name',
      note: 'Profile: user.full_name; customer forms: customer.full_name',
    }
  }
  if (lower.includes('email')) {
    return FIELD_DB_BY_LABEL.email ?? { table: 'user', column: 'email', note: 'Table varies by screen' }
  }
  if (lower.includes('phone') || lower.includes('mobile') || lower.includes('whatsapp')) {
    return { table: 'user', column: 'phone', note: 'Table varies by screen (user, customer, vendor)' }
  }
  if (lower.includes('gstin')) {
    return FIELD_DB_BY_LABEL.gstin ?? null
  }
  if (lower.includes('pincode') || lower.includes('postal code') || lower.includes('zip')) {
    return FIELD_DB_BY_LABEL.pincode ?? FIELD_DB_BY_LABEL['postal code'] ?? null
  }
  if (lower.includes('street address')) {
    return FIELD_DB_BY_LABEL['street address']
  }
  if (lower.includes('city')) {
    return FIELD_DB_BY_LABEL.city
  }
  if (lower.includes('state') || lower.includes('province')) {
    return FIELD_DB_BY_LABEL.state
  }
  return null
}
