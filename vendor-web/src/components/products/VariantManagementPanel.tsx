import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, Search, Trash2, DollarSign, Power, PowerOff, ImageOff, LayoutGrid, Zap,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { VariantListItem, PriceAdjustMode } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { VariantDetailsDrawer } from '@/components/products/VariantDetailsDrawer'
import { VariantFastEditGrid } from '@/components/products/VariantFastEditGrid'
import {
  getVariantManageView, setVariantManageView, type VariantManageView,
} from '@/lib/variantSetupMode'

interface Props {
  productId: string
  forcedView?: VariantManageView
  emptyMessage?: string
  compact?: boolean
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

export function VariantManagementPanel({
  productId, forcedView, emptyMessage, compact,
}: Props) {
  const qc = useQueryClient()
  const queryKey = ['product-variants', productId]
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => vendorApi.productListVariants(productId),
  })

  const [view, setView] = useState<VariantManageView>(() => forcedView ?? getVariantManageView())
  const activeView = forcedView ?? view

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const allItems = data?.items ?? []
  const items = useMemo(() => {
    if (!search.trim()) return allItems
    const q = search.trim().toLowerCase()
    return allItems.filter(v =>
      v.name.toLowerCase().includes(q)
      || (v.sku ?? '').toLowerCase().includes(q)
      || (v.barcode ?? '').toLowerCase().includes(q)
      || Object.values(v.attributes || {}).some(val => String(val).toLowerCase().includes(q)),
    )
  }, [allItems, search])

  const patchMutation = useMutation({
    mutationFn: (vars: { id: string; field: string; value: unknown }) =>
      vendorApi.productPatchVariant(productId, vars.id, { [vars.field]: vars.value }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => toast.error('Could not save — please retry'),
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof vendorApi.productBulkUpdateVariants>[1]) =>
      vendorApi.productBulkUpdateVariants(productId, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey })
      toast.success(`Updated ${res.updated_count} variant${res.updated_count === 1 ? '' : 's'}`)
      setPriceDialogOpen(false)
    },
    onError: () => toast.error('Bulk update failed'),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => vendorApi.productBulkDeleteVariants(productId, ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey })
      toast.success(`Deleted ${res.deleted_count} variant${res.deleted_count === 1 ? '' : 's'}`)
      setSelected(new Set())
      setConfirmDeleteOpen(false)
    },
    onError: () => toast.error('Could not delete selected variants'),
  })

  const toggleActive = (v: VariantListItem) =>
    patchMutation.mutate({ id: v.id, field: 'is_active', value: !v.is_active })

  const changeView = (next: VariantManageView) => {
    setView(next)
    setVariantManageView(next)
  }

  const defaultEmpty = 'No variants yet — set up product options first, then create variants.'

  return (
    <div className="space-y-3">
      <div className="flex flex-nowrap items-center gap-2">
        <div className="relative min-w-0 flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className={cn('pl-8', compact ? 'h-8 text-xs' : 'h-9 text-sm')}
          />
        </div>
        {activeView !== 'fast' && (
          <p className={cn('shrink-0 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
            {items.length.toLocaleString('en-IN')} variant{items.length === 1 ? '' : 's'}
            {data && data.total !== items.length && !search && ` of ${data.total.toLocaleString('en-IN')}`}
          </p>
        )}

        {!forcedView && (
          <div className="ml-auto inline-flex shrink-0 rounded-md border bg-muted/40 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => changeView('cards')}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2.5 py-1 transition-colors',
                activeView === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cards
            </button>
            <button
              type="button"
              onClick={() => changeView('fast')}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2.5 py-1 transition-colors',
                activeView === 'fast' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Zap className="h-3.5 w-3.5" /> Fast edit
            </button>
          </div>
        )}
      </div>

      {activeView !== 'fast' && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1">
          <span className="text-xs font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPriceDialogOpen(true)}>
            <DollarSign className="h-3 w-3" /> Adjust price
          </Button>
          <Button
            size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => bulkUpdateMutation.mutate({ variant_ids: Array.from(selected), set_fields: { is_active: true } })}
          >
            <Power className="h-3 w-3" /> Activate
          </Button>
          <Button
            size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => bulkUpdateMutation.mutate({ variant_ids: Array.from(selected), set_fields: { is_active: false } })}
          >
            <PowerOff className="h-3 w-3" /> Deactivate
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        </div>
      )}

      {activeView === 'fast' ? (
        allItems.length === 0 && !isLoading ? (
          <div className="rounded-lg border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
            {emptyMessage ?? defaultEmpty}
          </div>
        ) : (
          <VariantFastEditGrid productId={productId} search={search} onSearchChange={setSearch} hideSearch />
        )
      ) : isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
          {emptyMessage ?? defaultEmpty}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {items.map(v => (
            <VariantCard
              key={v.id}
              variant={v}
              selected={selected.has(v.id)}
              onToggleSelect={() => setSelected(prev => {
                const next = new Set(prev)
                if (next.has(v.id)) next.delete(v.id); else next.add(v.id)
                return next
              })}
              onOpenDetails={() => setDetailsId(v.id)}
              onPatch={(field, value) => patchMutation.mutate({ id: v.id, field, value })}
              onToggleActive={() => toggleActive(v)}
            />
          ))}
        </div>
      )}

      <PriceAdjustDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        count={selected.size}
        pending={bulkUpdateMutation.isPending}
        onApply={(field, mode, value) => bulkUpdateMutation.mutate({
          variant_ids: Array.from(selected),
          price_adjustment: { field, mode, value },
        })}
      />

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete {selected.size} variant{selected.size === 1 ? '' : 's'}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive" size="sm" disabled={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}
            >
              {bulkDeleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detailsId && (
        <VariantDetailsDrawer
          productId={productId}
          variantId={detailsId}
          onClose={() => setDetailsId(null)}
        />
      )}
    </div>
  )
}

function VariantCard({
  variant: v, selected, onToggleSelect, onOpenDetails, onPatch, onToggleActive,
}: {
  variant: VariantListItem
  selected: boolean
  onToggleSelect: () => void
  onOpenDetails: () => void
  onPatch: (field: string, value: unknown) => void
  onToggleActive: () => void
}) {
  const sym = CURRENCY_SYMBOLS[v.currency] ?? v.currency
  const titleLower = v.name.toLowerCase()
  const attrChips = Object.entries(v.attributes || {})
    .filter(([, val]) => val != null && String(val).trim())
    .filter(([, val]) => !titleLower.includes(String(val).toLowerCase()))

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all hover:border-primary/25 hover:shadow-sm',
        selected && 'ring-2 ring-primary/30',
        !v.is_active && 'opacity-75',
      )}
    >
      <CardContent className="relative p-2">
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          {v.stock_status === 'out_of_stock' && (
            <Badge variant="destructive" className="h-4 px-1 text-[8px] leading-none">OOS</Badge>
          )}
          <Switch checked={v.is_active} onCheckedChange={onToggleActive} className="scale-[0.72]" />
        </div>

        <div className="flex items-center gap-1.5 pr-10">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="shrink-0" />
          <button
            type="button"
            onClick={onOpenDetails}
            className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-muted ring-1 ring-border/50"
          >
            {v.media?.[0]?.url ? (
              <img src={v.media[0].url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <ImageOff className="h-3.5 w-3.5 text-muted-foreground/60" />
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenDetails}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-xs font-semibold leading-tight text-foreground hover:text-primary">
              {v.name}
            </p>
            {(attrChips.length > 0 || v.sku) && (
              <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
                {attrChips.length > 0 && (
                  <span>{attrChips.map(([, val]) => String(val)).join(' · ')}</span>
                )}
                {attrChips.length > 0 && v.sku && <span className="mx-1 text-border">|</span>}
                {v.sku && <span className="font-mono">{v.sku}</span>}
              </p>
            )}
          </button>
        </div>

        <div className="mt-1.5 grid grid-cols-3 gap-1 border-t border-border/50 pt-1.5">
          <EditableField compact label="Price" type="number" value={v.price} prefix={sym} onCommit={val => onPatch('price', Number(val) || 0)} />
          <EditableField compact label="Stock" type="number" value={v.quantity} onCommit={val => onPatch('quantity', Number(val) || 0)} />
          <EditableField
            compact label="MRP" type="number" value={v.compare_at_price ?? ''} prefix={sym}
            onCommit={val => onPatch('compare_at_price', val === '' ? null : Number(val))}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function EditableField({
  label, value, onCommit, type = 'text', prefix, compact,
}: {
  label: string
  value: string | number
  onCommit: (value: string) => void
  type?: 'text' | 'number'
  prefix?: string
  compact?: boolean
}) {
  return (
    <label className="block">
      <span className={cn(
        'mb-px block text-muted-foreground',
        compact ? 'text-[9px] font-medium uppercase tracking-wide' : 'text-xs',
      )}>
        {label}
      </span>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">{prefix}</span>
        )}
        <input
          key={`${label}-${String(value)}`}
          type={type}
          defaultValue={value}
          onBlur={e => { if (e.target.value !== String(value)) onCommit(e.target.value) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className={cn(
            'w-full rounded border border-input bg-background tabular-nums',
            'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30',
            compact ? 'h-6 px-1 text-[11px]' : 'h-8 px-2 text-sm',
            prefix && (compact ? 'pl-4' : 'pl-6'),
          )}
          step={type === 'number' ? '0.01' : undefined}
        />
      </div>
    </label>
  )
}

const PRICE_FIELDS: { value: 'price' | 'compare_at_price' | 'cost_price'; label: string }[] = [
  { value: 'price', label: 'Price' },
  { value: 'compare_at_price', label: 'Original price (MRP)' },
  { value: 'cost_price', label: 'Cost price' },
]
const MODE_OPTIONS: { value: PriceAdjustMode; label: string }[] = [
  { value: 'set', label: 'Set to' },
  { value: 'increase_pct', label: 'Increase by %' },
  { value: 'decrease_pct', label: 'Decrease by %' },
  { value: 'increase_amt', label: 'Increase by amount' },
  { value: 'decrease_amt', label: 'Decrease by amount' },
]

function PriceAdjustDialog({
  open, onOpenChange, count, pending, onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  pending: boolean
  onApply: (field: 'price' | 'compare_at_price' | 'cost_price', mode: PriceAdjustMode, value: number) => void
}) {
  const [field, setField] = useState<'price' | 'compare_at_price' | 'cost_price'>('price')
  const [mode, setMode] = useState<PriceAdjustMode>('set')
  const [value, setValue] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Adjust price — {count} variant{count === 1 ? '' : 's'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Field</label>
            <Select value={field} onChange={val => setField(val as typeof field)} options={PRICE_FIELDS.map(f => ({ value: f.value, label: f.label }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Adjustment</label>
            <Select value={mode} onChange={val => setMode(val as PriceAdjustMode)} options={MODE_OPTIONS.map(m => ({ value: m.value, label: m.label }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Value</label>
            <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={pending || value === ''} onClick={() => onApply(field, mode, Number(value) || 0)}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
