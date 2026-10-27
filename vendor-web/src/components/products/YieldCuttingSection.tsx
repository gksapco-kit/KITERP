import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import { useYieldProfiles, useYieldTemplates } from '@/hooks/useYield'
import { convertWeight, stockUnitsPerSale, uomDimension } from '@/lib/stockConversion'
import { yieldPercent, costPerOutput, formatQty, formatMoney, rawInputFor } from '@/lib/yieldCalc'
import type { YieldProfile, YieldProfileLine, YieldProfileTemplate } from '@/api/yield'

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

/** Profiles for this product category. An exact category or profile name wins over a partial category. */
function profilesForCategory(profiles: YieldProfile[], category: string): YieldProfile[] {
  const c = norm(category)
  if (!c) return []
  const exact = profiles.filter((p) => norm(p.category) === c || norm(p.name) === c)
  if (exact.length) return exact
  return profiles.filter((p) => {
    const pc = norm(p.category)
    return !!pc && (c.includes(pc) || pc.includes(c))
  })
}

type CutChoice = YieldProfileLine & { key: string; profileId: string; profileName: string; profileUom: string }

function factorInPool(
  line: { input_per_output: number; input_uom?: string | null },
  profileUom: string,
  poolUom: string,
): number {
  const from = line.input_uom || profileUom || 'kg'
  return convertWeight(Number(line.input_per_output), from, poolUom || 'kg') ?? Number(line.input_per_output)
}

const isSavedProfile = (id: string | null | undefined) => !!id && !id.startsWith('template:')

function templateProfile(template: YieldProfileTemplate): YieldProfile {
  return {
    id: `template:${template.name}`,
    name: template.name,
    category: template.category,
    input_uom: template.input_uom,
    description: null,
    is_active: true,
    lines: template.lines,
  }
}

function cutChoices(profiles: YieldProfile[]): CutChoice[] {
  const rows: CutChoice[] = []
  for (const profile of profiles) {
    profile.lines.forEach((line, index) => {
      if (!line.cut_name?.trim()) return
      rows.push({
        ...line,
        key: `${profile.id}::${index}::${line.cut_name}`,
        profileId: profile.id,
        profileName: profile.name,
        profileUom: profile.input_uom || 'kg',
      })
    })
  }
  return rows
}

export function YieldCuttingSection({
  enabled, profileId, category, stockAtProduct, stockUom, variants, rawCost, readOnly,
  onToggle, onProfileChange, onVariantYield, onEnableProductStock,
}: Props) {
  const { data: profiles = [] } = useYieldProfiles()
  const { data: templates = [] } = useYieldTemplates()
  const active = profiles.filter((p) => p.is_active || p.id === profileId)
  const selectedProfile = active.find((p) => p.id === profileId)
  const poolUom = stockUom || 'kg'
  const weightPool = uomDimension(poolUom) !== 'count'

  const savedForCategory = useMemo(
    () => profilesForCategory(active, category),
    [active, category],
  )
  const templateForCategory = useMemo(
    () => profilesForCategory(templates.map(templateProfile), category),
    [templates, category],
  )
  const categoryProfiles = savedForCategory.length ? savedForCategory : templateForCategory
  const suggested = savedForCategory.length === 1 ? savedForCategory[0] : undefined
  const choices = useMemo(() => {
    if (selectedProfile) return cutChoices([selectedProfile])
    if (categoryProfiles.length) return cutChoices(categoryProfiles)
    const saved = cutChoices(active)
    if (saved.length) return saved
    return cutChoices(templates.map(templateProfile))
  }, [selectedProfile, categoryProfiles, active, templates])
  const cutNameCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const line of choices) counts.set(norm(line.cut_name), (counts.get(norm(line.cut_name)) || 0) + 1)
    return counts
  }, [choices])

  useEffect(() => {
    if (enabled && !profileId && suggested && !readOnly) onProfileChange(suggested.id)
  }, [enabled, profileId, suggested, readOnly, onProfileChange])

  const rows = variants
    .map((v, index) => ({ v, index }))
    .filter(({ v }) => v?.name?.trim() && v.is_active !== false)

  const choiceFor = (cut: string | null | undefined, factor: number) => {
    const named = choices.filter((line) => line.cut_name === cut)
    if (!named.length) return undefined
    if (named.length === 1) return named[0]
    return named.find((line) => Math.abs(factorInPool(line, line.profileUom, poolUom) - factor) < 0.0001) ?? named[0]
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            {choices.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {category ? (
                  <>Cuts for <span className="font-medium text-foreground">{category}</span>. </>
                ) : null}
                Select a cut and one sale updates from the qty.
              </p>
            ) : <span />}
            <Link to="/inventory/yield-profiles" className="text-xs text-primary inline-flex items-center gap-1 shrink-0">
              Manage profiles <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {category && choices.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No cutting profile matches category “{category}”. On Yield Profiles, set Product category to {category} and add the cuts.
            </p>
          )}
          {!category && choices.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add cuts on Yield Profiles. They show in the Cut list here.
            </p>
          )}

          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add a variant with Qty and UOM on the Price &amp; Variants tab, then pick its cut here.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Qty</th>
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
                    const packQty = Number(v.uom_quantity)
                    const output = stockUnitsPerSale({
                      stockUom: poolUom, uom: v.uom, uomQuantity: v.uom_quantity, weightKg: v.weight_kg, stockPerSale: null,
                    })
                    const chosen = choiceFor(v.yield_cut, factor)
                    const chosenFactor = chosen ? factorInPool(chosen, chosen.profileUom, poolUom) : 0
                    const stepRaw = chosen && Math.abs(chosenFactor - factor) < 0.0001 ? Number(chosen.rounding_step) : 0
                    const step = stepRaw > 0
                      ? convertWeight(stepRaw, chosen?.input_uom || chosen?.profileUom || 'kg', poolUom)
                      : undefined
                    const saleQty = output > 0 ? output : (packQty > 0 ? packQty : 0)
                    const saleUom = output > 0 ? poolUom : (v.uom || poolUom)
                    const raw = factor > 0 && saleQty > 0 ? rawInputFor(saleQty, factor, step) : 0
                    const selectValue = chosen ? chosen.key : (v.yield_cut ? `custom::${v.yield_cut}` : '')
                    const cutOptions = [
                      { value: '', label: 'Select cut' },
                      ...choices.map((line) => ({
                        value: line.key,
                        label: (cutNameCounts.get(norm(line.cut_name)) || 0) > 1
                          ? `${line.cut_name} (${line.profileName})`
                          : line.cut_name,
                      })),
                      ...(v.yield_cut && !chosen ? [{ value: `custom::${v.yield_cut}`, label: v.yield_cut }] : []),
                    ]
                    return (
                      <tr key={index} className="border-t border-border">
                        <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                          {packQty > 0
                            ? formatQty(packQty, v.uom || poolUom)
                            : <span className="text-amber-600">Set Qty</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          {choices.length > 0 ? (
                            <Select
                              value={selectValue}
                              onChange={(key) => {
                                const line = choices.find((item) => item.key === key)
                                if (!line) {
                                  onVariantYield(index, undefined, undefined)
                                  return
                                }
                                if (isSavedProfile(line.profileId) && line.profileId !== profileId) onProfileChange(line.profileId)
                                onVariantYield(index, factorInPool(line, line.profileUom, poolUom), line.cut_name)
                              }}
                              options={cutOptions}
                              className="w-48"
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
                          {factor > 0 && saleQty > 0
                            ? <>sells {formatQty(saleQty, saleUom)} · cuts <strong>{formatQty(raw, poolUom)}</strong> raw</>
                            : saleQty > 0 ? `sells ${formatQty(saleQty, saleUom)}` : <span className="text-amber-600">set Qty + UOM</span>}
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
