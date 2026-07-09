import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { formatVariantDisplayLabel } from '@/lib/productVariantPresets'
import type { ProductVariant } from '@/types'
import { cn } from '@/lib/utils'

type VariantInlineEditorProps = {
  productId: string
  variants: ProductVariant[]
  field: 'price' | 'quantity'
  currency?: string
  display: React.ReactNode
  savingKey: string | null
  onSaveVariant: (variantId: string, value: number) => Promise<void>
}

export function VariantInlineEditor({
  productId,
  variants,
  field,
  currency = 'INR',
  display,
  savingKey,
  onSaveVariant,
}: VariantInlineEditorProps) {
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 })

  useEffect(() => {
    if (!open) return
    const initial: Record<string, string> = {}
    for (const v of variants) {
      if (!v.id) continue
      initial[v.id] = String(field === 'price' ? (v.price ?? 0) : (v.quantity ?? 0))
    }
    setDrafts(initial)
    setErrors({})
  }, [open, variants, field])

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const panelWidth = Math.max(rect.width, 240)
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 8)
    setPos({
      top: rect.bottom + window.scrollY + 4,
      left: left + window.scrollX,
      width: panelWidth,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const saveVariant = async (variantId: string) => {
    const raw = drafts[variantId] ?? ''
    const value = field === 'price' ? Number(raw) : Math.max(0, Math.round(Number(raw) || 0))
    if (field === 'price' && (Number.isNaN(value) || value < 0)) {
      setErrors((e) => ({ ...e, [variantId]: 'Enter a valid price' }))
      return
    }
    if (field === 'quantity' && (Number.isNaN(value) || value < 0 || !Number.isInteger(value))) {
      setErrors((e) => ({ ...e, [variantId]: 'Enter a whole number ≥ 0' }))
      return
    }
    const current = variants.find((v) => v.id === variantId)
    const currentVal = field === 'price' ? (current?.price ?? 0) : (current?.quantity ?? 0)
    if (value === currentVal) return

    setErrors((e) => { const next = { ...e }; delete next[variantId]; return next })
    try {
      await onSaveVariant(variantId, value)
    } catch {
      setErrors((e) => ({ ...e, [variantId]: 'Could not save' }))
    }
  }

  const editableVariants = variants.filter((v) => v.id)

  const panel = open ? createPortal(
    <div
      ref={panelRef}
      data-stop-row-click
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="rounded-lg border border-blue-200 bg-white shadow-lg p-2.5 space-y-2 animate-in fade-in-0 zoom-in-95"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-0.5">
        Edit {field === 'price' ? 'prices' : 'stock'} per variant
      </p>
      {editableVariants.map((v) => {
        const label = formatVariantDisplayLabel(v.name || '', v.attributes)
        const isSaving = savingKey === `${productId}:variant:${v.id}:${field}`
        return (
          <div key={v.id} className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-gray-600 truncate flex-1 min-w-0" title={label}>{label}</span>
            <div className="relative shrink-0 w-24">
              {field === 'price' && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {currency === 'INR' ? '₹' : '$'}
                </span>
              )}
              <Input
                type="number"
                min={0}
                step={field === 'price' ? '0.01' : '1'}
                value={drafts[v.id!] ?? ''}
                disabled={isSaving}
                onChange={(e) => setDrafts((d) => ({ ...d, [v.id!]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void saveVariant(v.id!) }
                  if (e.key === 'Escape') setOpen(false)
                }}
                onBlur={() => void saveVariant(v.id!)}
                className={cn('h-7 text-xs', field === 'price' ? 'pl-5' : '')}
              />
              {isSaving && <Loader2 className="absolute right-1.5 top-1.5 w-3 h-3 animate-spin text-blue-500" />}
            </div>
          </div>
        )
      })}
      {editableVariants.length === 0 && (
        <p className="text-xs text-gray-400 px-0.5">No editable variants</p>
      )}
      {Object.entries(errors).map(([id, msg]) => (
        <p key={id} className="text-[10px] text-red-600">{msg}</p>
      ))}
    </div>,
    document.body,
  ) : null

  return (
    <>
      <div
        ref={triggerRef}
        data-stop-row-click
        role="button"
        tabIndex={0}
        title={`Double-click to edit ${field === 'price' ? 'variant prices' : 'variant stock'}`}
        onDoubleClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            setOpen((v) => !v)
          }
        }}
        className={cn(
          'w-full min-w-0 rounded-md px-1.5 py-1 transition-colors select-none',
          open && 'bg-blue-50/60 ring-1 ring-blue-200',
        )}
      >
        {display}
      </div>
      {panel}
    </>
  )
}

export function formatVariantPriceRange(variants: ProductVariant[], currency = 'INR') {
  const symbol = currency === 'INR' ? '₹' : '$'
  const prices = variants.map((v) => v.price).filter((p) => p > 0).sort((a, b) => a - b)
  if (prices.length === 0) return { text: '—', sub: '' }
  const low = prices[0]
  const high = prices[prices.length - 1]
  const text = low === high ? formatCurrency(low) : `${symbol}${low.toLocaleString()} – ${symbol}${high.toLocaleString()}`
  return { text, sub: `${variants.length} variant${variants.length > 1 ? 's' : ''}` }
}

export function formatVariantStockTotal(variants: ProductVariant[]) {
  const total = variants.reduce((s, v) => s + (v.quantity || 0), 0)
  const outCount = variants.filter((v) => v.stock_status === 'out_of_stock' || (v.quantity || 0) === 0).length
  const isAllOut = outCount === variants.length
  const hasLow = !isAllOut && outCount > 0
  return { total, outCount, isAllOut, hasLow, variantCount: variants.length }
}
