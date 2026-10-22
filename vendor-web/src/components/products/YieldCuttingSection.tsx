import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Wand2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import { useYieldProfiles } from '@/hooks/useYield'
import { stockUnitsPerSale, uomDimension } from '@/lib/stockConversion'
import { yieldPercent, costPerOutput, formatQty, formatMoney } from '@/lib/yieldCalc'
import type { YieldProfile } from '@/api/yield'

export interface YieldVariantRow {
  name?: string
  uom?: string
  uom_quantity?: number | string | null
  weight_kg?: number | string | null
  yield_factor?: number | string | null
  yield_cut?: string | null
  is_active?: boolean
}

interface Props {
  enabled: boolean
  profileId: string
  category: string
  stockAtProduct: boolean
  stockUom: string
  variants: YieldVariantRow[]
  rawCost?: number | null
  readOnly?: boolean
  onToggle: (enabled: boolean) => void
  onProfileChange: (profileId: string) => void
  onVariantYield: (index: number, factor: number | undefined, cut: string | undefined) => void
  onEnableProductStock: () => void
}

const norm = (s: string | null | undefined) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Best profile cut for a variant name: exact, then either name containing the other. */
function matchCut(profile: YieldProfile, variantName: string) {
  const v = norm(variantName)
  if (!v) return undefined
  return (
    profile.lines.find((l) => norm(l.cut_name) === v)
    ?? profile.lines.find((l) => v.includes(norm(l.cut_name)) || norm(l.cut_name).includes(v))
  )
}

export function YieldCuttingSection({
  enabled, profileId, category, stockAtProduct, stockUom, variants, rawCost, readOnly,
  onToggle, onProfileChange, onVariantYield, onEnableProductStock,
}: Props) {
  const { data: profiles = [] } = useYieldProfiles()
  const active = profiles.filter((p) => p.is_active || p.id === profileId)
  const profile = active.find((p) => p.id === profileId)
  const poolUom = stockUom || 'kg'
  const weightPool = uomDimension(poolUom) !== 'count'

  const suggested = useMemo(
    () => active.find((p) => p.category && norm(p.category) === norm(category)),
    [active, category],
  )

  useEffect(() => {
    if (enabled && !profileId && suggested && !readOnly) onProfileChange(suggested.id)
  }, [enabled, profileId, suggested, readOnly, onProfileChange])

  const rows = variants
    .map((v, index) => ({ v, index }))
    .filter(({ v }) => v?.name?.trim() && v.is_active !== false)

  const applyProfile = () => {
    if (!profile) return
    for (const { v, index } of rows) {
      const line = matchCut(profile, v.name || '')
      if (line) onVariantYield(index, line.input_per_output, line.cut_name)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Switch checked={enabled} onCheckedChange={onToggle} disabled={readOnly} />
        <div>
          <p className="text-sm font-medium">Sold after cutting / processing</p>
          <p className="text-xs text-muted-foreground">
            Customers buy the finished cut (1 kg boneless) but your stock is raw (whole chicken).
            Set how much raw stock each cut needs — every sale then removes the right raw weight.
          </p>
        </div>
      </div>

      {enabled && (
        <>
          {(!stockAtProduct || !weightPool) && (
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1 min-w-[12rem]">
                Raw stock must be one balance at product level, counted by weight (kg). Each cut variant then draws from it.
              </span>
              {!readOnly && (
                <Button type="button" size="sm" variant="outline" onClick={onEnableProductStock}>
                  Use product-level stock in kg
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Yield profile</span>
              <Select
                value={profileId}
                onChange={onProfileChange}
                options={[
                  { value: '', label: '— None —' },
                  ...active.map((p) => ({ value: p.id, label: p.category ? `${p.name} (${p.category})` : p.name })),
                ]}
                className="w-64"
                disabled={readOnly}
              />
            </label>
            {profile && !readOnly && (
              <Button type="button" size="sm" variant="outline" onClick={applyProfile}>
                <Wand2 className="h-4 w-4 mr-1" /> Fill factors from profile
              </Button>
            )}
            <Link to="/inventory/yield-profiles" className="text-xs text-primary inline-flex items-center gap-1 ml-auto">
              Manage profiles <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add one variant per cut on the Price &amp; Variants tab (e.g. Boneless – 1 kg, Curry cut – 500 g), then set their factors here.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Variant</th>
                    <th className="text-left px-3 py-2 font-medium">Cut</th>
                    <th className="text-left px-3 py-2 font-medium w-32">Raw per 1 {poolUom}</th>
                    <th className="text-right px-3 py-2 font-medium">Yield</th>
                    <th className="text-right px-3 py-2 font-medium">One sale</th>
                    {rawCost ? <th className="text-right px-3 py-2 font-medium">Cost / {poolUom}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ v, index }) => {
                    const factor = Number(v.yield_factor) || 0
                    const output = stockUnitsPerSale({
                      stockUom: poolUom, uom: v.uom, uomQuantity: v.uom_quantity, weightKg: v.weight_kg, stockPerSale: null,
                    })
                    const cutOptions = profile?.lines ?? []
                    return (
                      <tr key={index} className="border-t border-border">
                        <td className="px-3 py-1.5">{v.name}</td>
                        <td className="px-2 py-1.5">
                          {cutOptions.length > 0 ? (
                            <Select
                              value={v.yield_cut || ''}
                              onChange={(cut) => {
                                const line = cutOptions.find((l) => l.cut_name === cut)
                                onVariantYield(index, line ? line.input_per_output : factor || undefined, cut || undefined)
                              }}
                              options={[{ value: '', label: '—' }, ...cutOptions.map((l) => ({ value: l.cut_name, label: l.cut_name }))]}
                              className="w-44"
                              disabled={readOnly}
                            />
                          ) : (
                            <Input
                              value={v.yield_cut || ''}
                              onChange={(e) => onVariantYield(index, factor || undefined, e.target.value || undefined)}
                              placeholder="Boneless"
                              className="h-8 w-40"
                              disabled={readOnly}
                            />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number" step="0.01" min="0.01"
                            value={v.yield_factor ?? ''}
                            onChange={(e) => onVariantYield(index, e.target.value ? Number(e.target.value) : undefined, v.yield_cut || undefined)}
                            placeholder="1.30"
                            className="h-8"
                            disabled={readOnly}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {factor > 0 ? `${yieldPercent(factor)}%` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-xs">
                          {factor > 0 && output > 0
                            ? <>sells {formatQty(output, poolUom)} · cuts <strong>{formatQty(output * factor, poolUom)}</strong> raw</>
                            : output > 0 ? `sells ${formatQty(output, poolUom)}` : <span className="text-amber-600">set Qty + UOM</span>}
                        </td>
                        {rawCost ? (
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(costPerOutput(rawCost, factor))}</td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[0.7rem] text-muted-foreground">
            Raw per 1 {poolUom}: e.g. boneless 1.30 means 1.30 {poolUom} of raw stock gives 1 {poolUom} to the customer.
            {rawCost ? ` Cost / ${poolUom} uses the product cost price (₹${rawCost}) as the raw cost.` : ' Set a cost price to see the real cost of each cut.'}
          </p>
        </>
      )}
    </div>
  )
}
