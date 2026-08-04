import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Boxes, Layers, Loader2, RotateCcw, Sparkles, Trash2, Undo2,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { VariantGenerateMode } from '@/api/vendor'
import { isPristineDefaultVariant } from '@/lib/productVariants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  productId: string
}

const MODE_OPTIONS: { value: VariantGenerateMode; label: string; hint: string }[] = [
  { value: 'all', label: 'Generate All', hint: 'Create every valid combination that does not exist yet' },
  { value: 'selected', label: 'Selected', hint: 'Only create the combinations you check below' },
  { value: 'missing', label: 'Missing', hint: 'Same as All, but only shows what is missing' },
  { value: 'regenerate', label: 'Regenerate', hint: 'Delete previously generated variants, then recreate fresh' },
]

const STATUS_BADGE: Record<string, { variant: 'success' | 'secondary' | 'destructive'; label: string }> = {
  new: { variant: 'success', label: 'New' },
  exists: { variant: 'secondary', label: 'Exists' },
  excluded: { variant: 'destructive', label: 'Excluded' },
}

export function VariantGeneratorButton({ productId }: Props) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const [mode, setMode] = useState<VariantGenerateMode>('all')
  const [excludedHashes, setExcludedHashes] = useState<Set<string>>(new Set())
  const [checkedRows, setCheckedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) { setExcludedHashes(new Set()); setCheckedRows(new Set()) }
  }, [open])
  useEffect(() => { setCheckedRows(new Set()) }, [mode])

  const previewKey = ['product-config-variants-preview', productId, mode, Array.from(excludedHashes).sort().join(',')]
  const { data: preview, isLoading, isFetching } = useQuery({
    queryKey: previewKey,
    queryFn: () => vendorApi.productPreviewVariants(productId, { mode, excluded_hashes: Array.from(excludedHashes) }),
    enabled: open,
  })

  const items = preview?.items ?? []
  const isExclusionMode = mode !== 'selected'

  const excludeSelected = () => {
    setExcludedHashes(prev => new Set([...prev, ...checkedRows]))
    setCheckedRows(new Set())
  }

  const undoExclude = (hash: string) => {
    setExcludedHashes(prev => { const next = new Set(prev); next.delete(hash); return next })
  }

  const generateMutation = useMutation({
    mutationFn: () => vendorApi.productGenerateVariants(productId, {
      mode,
      excluded_hashes: Array.from(excludedHashes),
      selected_hashes: mode === 'selected' ? Array.from(checkedRows) : undefined,
    }),
    onSuccess: async (result) => {
      if (result.created_count > 0) {
        try {
          const list = await vendorApi.productListVariants(productId)
          const leftoverIds = list.items
            .filter(v => isPristineDefaultVariant(v, false, { allowPersisted: true }))
            .map(v => v.id)
          if (leftoverIds.length > 0) {
            await vendorApi.productBulkDeleteVariants(productId, leftoverIds)
          }
        } catch {
          /* best-effort cleanup */
        }
      }
      qc.invalidateQueries({ queryKey: ['product-config-variants-preview', productId] })
      qc.invalidateQueries({ queryKey: ['product-variants', productId] })
      qc.invalidateQueries({ queryKey: ['vendor', 'product', productId] })
      toast.success(
        `${result.created_count} variant${result.created_count === 1 ? '' : 's'} created`
        + (result.skipped_existing_count ? ` — ${result.skipped_existing_count} already existed` : '')
        + (result.deleted_count ? ` — ${result.deleted_count} old variant(s) replaced` : ''),
      )
      setOpen(false)
    },
    onError: () => toast.error('Could not generate variants — please try again'),
  })

  const deleteInvalidMutation = useMutation({
    mutationFn: () => vendorApi.productDeleteInvalidVariants(productId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['product-config-variants-preview', productId] })
      toast.success(result.deleted_count > 0
        ? `Removed ${result.deleted_count} variant(s) that no longer match your configuration`
        : 'No invalid variants found')
    },
    onError: () => toast.error('Could not check for invalid variants'),
  })

  const generateCount = useMemo(() => {
    if (mode === 'selected') return checkedRows.size
    return preview?.new_count ?? 0
  }, [mode, checkedRows, preview])

  const allChecked = items.length > 0 && items.every(i => checkedRows.has(i.variant_hash))
  const toggleAll = () => {
    if (allChecked) setCheckedRows(new Set())
    else setCheckedRows(new Set(items.map(i => i.variant_hash)))
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
          <Sparkles className="h-3.5 w-3.5" /> Generate Variants
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={deleteInvalidMutation.isPending}
          onClick={() => deleteInvalidMutation.mutate()}
          title="Remove previously generated variants that no longer match the current attributes/options/rules"
        >
          {deleteInvalidMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Delete invalid variants
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Boxes className="h-4 w-4" /> Generate Variants — Preview</DialogTitle>
            <DialogDescription>
              Every configuration rule is evaluated first — only combinations that are actually reachable
              become variants. Nothing is created until you press Generate.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <StatCard label="Total combinations" value={preview?.total_combinations ?? 0} />
                <StatCard label="New" value={preview?.new_count ?? 0} tone="text-emerald-600" />
                <StatCard label="Already exist" value={preview?.existing_count ?? 0} tone="text-blue-600" />
                <StatCard label="Excluded" value={preview?.excluded_count ?? 0} tone="text-gray-500" />
              </div>

              <div className="inline-flex flex-wrap rounded-md border bg-muted/40 p-0.5 text-xs font-medium">
                {MODE_OPTIONS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    title={m.hint}
                    className={cn(
                      'rounded px-3 py-1.5 transition-colors',
                      mode === m.value ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{MODE_OPTIONS.find(m => m.value === mode)?.hint}</p>

              {preview?.truncated && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Showing the first {preview.max_combinations.toLocaleString('en-IN')} combinations — there may be more.
                  Consider narrowing options or tightening rules.
                </div>
              )}

              <div className="max-h-80 overflow-y-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      <th className="w-8 px-2 py-2"><input type="checkbox" className="accent-primary" checked={allChecked} onChange={toggleAll} /></th>
                      <th className="px-2 py-2 font-medium">Combination</th>
                      <th className="px-2 py-2 font-medium">SKU</th>
                      <th className="px-2 py-2 font-medium">Barcode</th>
                      <th className="px-2 py-2 font-medium">Price Δ</th>
                      <th className="px-2 py-2 font-medium">Hash</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr><td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                        No combinations to show — add attributes/options, or adjust the mode above.
                      </td></tr>
                    )}
                    {items.map(item => {
                      const badge = STATUS_BADGE[item.status]
                      const isExcluded = item.status === 'excluded'
                      return (
                        <tr key={item.variant_hash} className={cn('border-t', isExcluded && 'opacity-60')}>
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={checkedRows.has(item.variant_hash)}
                              onChange={e => setCheckedRows(prev => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(item.variant_hash); else next.delete(item.variant_hash)
                                return next
                              })}
                            />
                          </td>
                          <td className={cn('px-2 py-1.5 font-medium text-foreground', isExcluded && 'line-through')}>{item.label}</td>
                          <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{item.sku_preview}</td>
                          <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                            {item.barcode_preview || '— manual —'}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">{item.price_delta ? `+${item.price_delta}` : '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{item.variant_hash.slice(0, 10)}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                              {isExcluded && (
                                <button type="button" onClick={() => undoExclude(item.variant_hash)} className="text-muted-foreground hover:text-primary" title="Undo exclude">
                                  <Undo2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {isFetching && !isLoading && <p className="text-[11px] text-muted-foreground">Refreshing preview…</p>}
            </div>
          )}

          <DialogFooter className="items-center sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
              {isExclusionMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={checkedRows.size === 0}
                  onClick={excludeSelected}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Exclude selected ({checkedRows.size})
                </Button>
              )}
            </div>
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={generateCount === 0 || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
              Generate {generateCount.toLocaleString('en-IN')} variant{generateCount === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', tone)}>{value.toLocaleString('en-IN')}</p>
    </div>
  )
}
