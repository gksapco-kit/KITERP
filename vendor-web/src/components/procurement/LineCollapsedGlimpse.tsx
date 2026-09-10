import { formatCurrency } from '@/lib/utils'
import { uomLabel } from '@/lib/uomOptions'
import { LineMasterFacts, type MasterFact } from '@/components/procurement/LineMasterFacts'

function moneyCompact(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  } catch {
    return formatCurrency(amount, currency)
  }
}

export type LineCollapsedGlimpseProps = {
  typeLabel: string
  title: string
  quantity?: string | number | null
  uom?: string | null
  /** Unit purchase / cost price */
  unitPrice?: number | null
  currency?: string
  taxCode?: string | null
  taxAmount?: number
  variantName?: string | null
  /** Master codes (HSN, barcode, SKU, SAC, …) */
  masterFacts?: MasterFact[]
  /** Extra short hints (priority, plant, etc.) */
  extras?: Array<string | null | undefined>
}

/**
 * Compact secondary details shown on a collapsed procurement line —
 * qty, unit price, tax, and master codes — without expanding.
 */
export function LineCollapsedGlimpse({
  typeLabel,
  title,
  quantity,
  uom,
  unitPrice,
  currency = 'INR',
  taxCode,
  taxAmount = 0,
  variantName,
  masterFacts = [],
  extras = [],
}: LineCollapsedGlimpseProps) {
  const qtyLabel = [
    quantity != null && String(quantity).trim() !== '' ? String(quantity) : null,
    uomLabel(uom || '') || uom || null,
  ].filter(Boolean).join(' ')

  const meta: string[] = []
  if (qtyLabel) meta.push(qtyLabel)
  if (unitPrice != null && Number.isFinite(unitPrice)) {
    meta.push(`@ ${moneyCompact(unitPrice, currency)}`)
  }
  if (taxCode?.trim()) {
    meta.push(taxCode.trim())
  } else if (taxAmount > 0) {
    meta.push(`+${moneyCompact(taxAmount, currency)} tax`)
  }
  if (variantName?.trim()) meta.push(variantName.trim())
  for (const e of extras) {
    if (e?.trim()) meta.push(e.trim())
  }

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {typeLabel}
        </span>
        <span className="min-w-0 truncate text-xs font-medium text-gray-800 dark:text-gray-200">
          {title}
        </span>
      </span>
      {meta.length > 0 && (
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-0.5 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
          {meta.map((part, i) => (
            <span key={`${part}-${i}`} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-300 dark:text-gray-600" aria-hidden>·</span>}
              <span className="tabular-nums truncate max-w-[11rem]">{part}</span>
            </span>
          ))}
        </span>
      )}
      {masterFacts.length > 0 && (
        <LineMasterFacts facts={masterFacts} className="pl-0.5" />
      )}
    </span>
  )
}

export { moneyCompact as collapsedMoneyCompact }
