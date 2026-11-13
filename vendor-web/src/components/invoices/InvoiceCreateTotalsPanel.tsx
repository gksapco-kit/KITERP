import { useEffect, useState } from 'react'
import { IndianRupee, Percent, PlusCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { CheckboxFieldLabel } from '@/components/common/FieldLabel'
import { formatCurrency, cn } from '@/lib/utils'
import {
  emptyInvoiceAdditionalChargeRow,
  type InvoiceAdditionalChargeRow,
} from '@/lib/invoiceAdditionalCharges'

export type InvoiceTotalsPreview = {
  lineTaxable: number
  chargesTotal: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  totalTax: number
  discount: number
  roundOff: number
  grandTotal: number
}

type Props = {
  totals: InvoiceTotalsPreview
  isInterState: boolean
  additionalCharges: InvoiceAdditionalChargeRow[]
  onAdditionalChargesChange: (rows: InvoiceAdditionalChargeRow[]) => void
  discountAmount: number
  onDiscountAmountChange: (n: number) => void
  defaultTaxRate?: number
  className?: string
  showPaymentSection?: boolean
  paymentReceived?: number
  onPaymentReceivedChange?: (n: number) => void
  paymentMethod?: string
  onPaymentMethodChange?: (method: string) => void
  markFullyPaid?: boolean
  onMarkFullyPaidChange?: (v: boolean) => void
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
]

function SummaryRow({
  label,
  value,
  bold,
  valueClass,
}: {
  label: string
  value: string
  bold?: boolean
  valueClass?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 text-sm',
        bold && 'text-base font-bold',
      )}
    >
      <span className={cn('text-muted-foreground', bold && 'text-foreground')}>{label}</span>
      <span className={cn('tabular-nums font-medium text-foreground', valueClass, bold && 'text-base')}>
        {value}
      </span>
    </div>
  )
}

export function InvoiceCreateTotalsPanel({
  totals,
  isInterState,
  additionalCharges,
  onAdditionalChargesChange,
  discountAmount,
  onDiscountAmountChange,
  defaultTaxRate = 18,
  className,
  showPaymentSection = false,
  paymentReceived = 0,
  onPaymentReceivedChange,
  paymentMethod = 'cash',
  onPaymentMethodChange,
  markFullyPaid = false,
  onMarkFullyPaidChange,
}: Props) {
  const [showDiscount, setShowDiscount] = useState(discountAmount > 0)

  useEffect(() => {
    if (discountAmount > 0) setShowDiscount(true)
  }, [discountAmount])

  const updateCharge = (index: number, patch: Partial<InvoiceAdditionalChargeRow>) => {
    onAdditionalChargesChange(
      additionalCharges.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }

  const addCharge = () => {
    onAdditionalChargesChange([...additionalCharges, emptyInvoiceAdditionalChargeRow(defaultTaxRate)])
  }

  const removeCharge = (index: number) => {
    onAdditionalChargesChange(additionalCharges.filter((_, i) => i !== index))
  }

  const taxableAfterDiscount = Math.max(0, totals.taxableAmount - totals.discount)
  const cgstPct =
    taxableAfterDiscount > 0 && totals.cgst > 0
      ? Math.round((totals.cgst / taxableAfterDiscount) * 1000) / 10
      : 0
  const sgstPct = cgstPct

  return (
    <div className={cn('w-full max-w-md space-y-2 rounded-lg border border-border bg-card p-3', className)}>
      <button
        type="button"
        onClick={addCharge}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <PlusCircle className="h-4 w-4" />
        Add Another Charge
      </button>

      {additionalCharges.map((row, index) => (
        <div key={row.id} className="flex flex-wrap items-end gap-2 rounded-md border border-border/70 bg-muted/20 p-2">
          <div className="min-w-[7rem] flex-1">
            <label className="text-[10px] text-muted-foreground">Charge name</label>
            <Input
              className="mt-0.5 h-8 text-xs"
              placeholder="e.g. Freight"
              value={row.name}
              onChange={(e) => updateCharge(index, { name: e.target.value })}
            />
          </div>
          <div className="w-24">
            <label className="text-[10px] text-muted-foreground">Amount (₹)</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="mt-0.5 h-8 text-xs tabular-nums"
              value={row.amount}
              onChange={(e) => updateCharge(index, { amount: e.target.value })}
            />
          </div>
          <div className="w-16">
            <label className="text-[10px] text-muted-foreground">Tax %</label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              className="mt-0.5 h-8 text-xs tabular-nums"
              value={row.tax_rate}
              onChange={(e) => updateCharge(index, { tax_rate: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground"
            aria-label="Remove charge"
            onClick={() => removeCharge(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {additionalCharges.length > 0 &&
        additionalCharges.some((c) => Number(c.amount) > 0 && c.name.trim()) &&
        totals.chargesTotal > 0 && (
          <SummaryRow label="Additional charges" value={formatCurrency(totals.chargesTotal)} />
        )}

      <div className="border-t border-border" />

      <SummaryRow label="Taxable Amount" value={formatCurrency(taxableAfterDiscount)} />

      {!isInterState && totals.cgst > 0 && (
        <SummaryRow
          label={cgstPct > 0 ? `CGST @${cgstPct}%` : 'CGST'}
          value={formatCurrency(totals.cgst)}
        />
      )}
      {!isInterState && totals.sgst > 0 && (
        <SummaryRow
          label={sgstPct > 0 ? `SGST @${sgstPct}%` : 'SGST'}
          value={formatCurrency(totals.sgst)}
        />
      )}
      {isInterState && totals.igst > 0 && (
        <SummaryRow label="IGST" value={formatCurrency(totals.igst)} />
      )}

      {!showDiscount ? (
        <button
          type="button"
          onClick={() => setShowDiscount(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Percent className="h-3.5 w-3.5" />
          Add Discount
        </button>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Invoice discount (₹)</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="mt-0.5 h-8 text-xs tabular-nums"
              value={discountAmount || ''}
              onChange={(e) => onDiscountAmountChange(Math.max(0, parseFloat(e.target.value) || 0))}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              onDiscountAmountChange(0)
              setShowDiscount(false)
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {totals.discount > 0 && (
        <SummaryRow
          label="Discount"
          value={`-${formatCurrency(totals.discount)}`}
          valueClass="text-red-600 dark:text-red-400"
        />
      )}

      {totals.roundOff !== 0 && (
        <SummaryRow label="Round Off" value={formatCurrency(totals.roundOff)} />
      )}

      <div className="border-t border-border" />

      <SummaryRow label="Total Amount" value={formatCurrency(totals.grandTotal)} bold />

      {showPaymentSection && onPaymentReceivedChange && (
        <>
          <div className="border-t border-border pt-2">
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-foreground">
              <IndianRupee className="h-3.5 w-3.5" />
              Payment received
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[5.5rem] flex-1">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-8 text-xs tabular-nums"
                  value={paymentReceived || ''}
                  onChange={(e) => {
                    const n = Math.max(0, parseFloat(e.target.value) || 0)
                    onPaymentReceivedChange(n)
                    if (onMarkFullyPaidChange && n < totals.grandTotal) {
                      onMarkFullyPaidChange(false)
                    }
                  }}
                />
              </div>
              {onPaymentMethodChange && (
                <Select
                  className="w-[7.5rem]"
                  triggerClassName="h-8 text-xs"
                  value={paymentMethod}
                  onChange={onPaymentMethodChange}
                  options={PAYMENT_METHODS}
                />
              )}
            </div>
            {onMarkFullyPaidChange && (
              <div className="mt-1.5">
                <CheckboxFieldLabel
                  label="Mark as fully paid"
                  checked={markFullyPaid}
                  onChange={(checked) => {
                    onMarkFullyPaidChange(checked)
                    onPaymentReceivedChange(checked ? totals.grandTotal : paymentReceived)
                  }}
                  labelClassName="text-xs"
                />
              </div>
            )}
            <SummaryRow
              label="Balance due"
              value={formatCurrency(Math.max(0, totals.grandTotal - (paymentReceived || 0)))}
              valueClass={totals.grandTotal - (paymentReceived || 0) > 0 ? undefined : 'text-green-700 dark:text-green-400'}
            />
          </div>
        </>
      )}
    </div>
  )
}
