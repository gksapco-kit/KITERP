import type { ReactNode } from 'react'

/**
 * Read-only master facts (HSN, barcode, SKU/SAC, …) shown on PR/PO lines
 * so users can see codes without opening the product/service form.
 */
export type MasterFact = {
  label: string
  value: string
}

function FactField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide leading-none text-gray-400 dark:text-gray-500 select-none">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

const factBoxCls =
  'flex h-8 items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200'

/**
 * Full-size read-only master fields (own row). Always renders the expected
 * slots so HSN / barcode stay visible even when empty. Slots stretch evenly
 * across the full row width.
 */
export function LineMasterFactsRow({
  facts,
  slots,
  loading = false,
  className = '',
}: {
  facts: MasterFact[]
  /** Ordered slots to always show (empty → "—"). */
  slots: string[]
  loading?: boolean
  className?: string
}) {
  const byLabel = new Map(facts.map(f => [f.label.toUpperCase(), f.value]))
  const cols = Math.max(slots.length, 1)
  const slotGridClass =
    cols <= 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'

  return (
    <div
      className={`grid min-w-0 gap-2 ${slotGridClass} ${className}`}
      title="From product / service master"
    >
      {slots.map(label => {
        const value = byLabel.get(label.toUpperCase())?.trim()
        return (
          <FactField key={label} label={label}>
            <div className={`${factBoxCls} font-mono tabular-nums`}>
              {loading ? 'Loading…' : (value || '—')}
            </div>
          </FactField>
        )
      })}
    </div>
  )
}

/** Compact chips for collapsed glimpse only. */
export function LineMasterFacts({
  facts,
  emptyHint,
  className = '',
}: {
  facts: MasterFact[]
  emptyHint?: string | null
  className?: string
}) {
  const visible = facts.filter(f => f.value?.trim())
  if (!visible.length) {
    if (!emptyHint) return null
    return (
      <div className={`flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400 ${className}`}>
        <span>{emptyHint}</span>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      title="From product / service master"
    >
      {visible.map(f => (
        <span
          key={f.label}
          className="inline-flex max-w-full items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] dark:border-gray-700 dark:bg-gray-900/50"
        >
          <span className="shrink-0 font-semibold uppercase tracking-wide text-gray-400">
            {f.label}
          </span>
          <span className="truncate font-mono tabular-nums text-gray-700 dark:text-gray-200">
            {f.value}
          </span>
        </span>
      ))}
    </div>
  )
}

export const PRODUCT_MASTER_SLOTS = ['HSN', 'Barcode', 'SKU', 'Material', 'GST'] as const
export const SERVICE_MASTER_SLOTS = ['SAC', 'Code', 'GST'] as const

export function getMasterFactValue(facts: MasterFact[], label: string): string {
  const hit = facts.find(f => f.label.toUpperCase() === label.toUpperCase())
  return hit?.value?.trim() || ''
}

export function buildProductMasterFacts(src: {
  hsn_code?: string | null
  barcode?: string | null
  sku?: string | null
  material_code?: string | null
  gst_rate?: number | null
  is_taxable?: boolean
} | null | undefined): MasterFact[] {
  if (!src) return []
  const facts: MasterFact[] = []
  if (src.hsn_code?.trim()) facts.push({ label: 'HSN', value: src.hsn_code.trim() })
  if (src.barcode?.trim()) facts.push({ label: 'Barcode', value: src.barcode.trim() })
  if (src.sku?.trim()) facts.push({ label: 'SKU', value: src.sku.trim() })
  if (src.material_code?.trim()) facts.push({ label: 'Material', value: src.material_code.trim() })
  if (src.is_taxable !== false && src.gst_rate != null && Number(src.gst_rate) > 0) {
    facts.push({ label: 'GST', value: `${src.gst_rate}%` })
  }
  return facts
}

export function buildServiceMasterFacts(src: {
  sac_code?: string | null
  material_code?: string | null
  purchase_price?: number | null
  gst_rate?: number | null
  tax_rate?: number | null
  is_taxable?: boolean
} | null | undefined): MasterFact[] {
  if (!src) return []
  const facts: MasterFact[] = []
  if (src.sac_code?.trim()) facts.push({ label: 'SAC', value: src.sac_code.trim() })
  if (src.material_code?.trim()) facts.push({ label: 'Code', value: src.material_code.trim() })
  const rate = src.gst_rate ?? src.tax_rate
  if (src.is_taxable !== false && rate != null && Number(rate) > 0) {
    facts.push({ label: 'GST', value: `${rate}%` })
  }
  return facts
}
