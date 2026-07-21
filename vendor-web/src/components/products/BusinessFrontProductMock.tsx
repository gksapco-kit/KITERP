import { useEffect, useMemo, useState } from 'react'
import { MonitorSmartphone, ShoppingCart } from 'lucide-react'
import type { ConfigAttribute } from '@/api/vendor'
import { useProduct } from '@/hooks/useVendor'
import { formatCurrency, cn } from '@/lib/utils'
import { getVariantOptionTypeForAttribute, estimateVariantCombinations, MAX_VARIANT_COMBINATIONS, isOverComboLimit } from '@/lib/variantOptionTypes'
import {
  countCombinationsAfterRules,
  previewRuleTargetValues,
  type PreviewCompatRule,
} from '@/lib/variantComboEstimate'
import { COLOUR_PALETTE } from '@/lib/productVariantPresets'
import {
  formatColorChoiceLabel,
  getColorShowParts,
  resolveColorParts,
} from '@/lib/colorAppearance'

export type { PreviewCompatRule } from '@/lib/variantComboEstimate'

/** Distinct colors so each rule can be matched to selections in the preview. */
export const RULE_HIGHLIGHT_COLORS = [
  { border: '#0d9488', bg: '#ccfbf1', text: '#0f766e', ring: 'rgba(13,148,136,0.45)' }, // teal
  { border: '#d97706', bg: '#fef3c7', text: '#b45309', ring: 'rgba(217,119,6,0.45)' }, // amber
  { border: '#7c3aed', bg: '#ede9fe', text: '#6d28d9', ring: 'rgba(124,58,237,0.45)' }, // violet
  { border: '#e11d48', bg: '#ffe4e6', text: '#be123c', ring: 'rgba(225,29,72,0.45)' }, // rose
  { border: '#2563eb', bg: '#dbeafe', text: '#1d4ed8', ring: 'rgba(37,99,235,0.45)' }, // blue
  { border: '#059669', bg: '#d1fae5', text: '#047857', ring: 'rgba(5,150,105,0.45)' }, // green
] as const

export function ruleHighlightColor(index: number) {
  return RULE_HIGHLIGHT_COLORS[index % RULE_HIGHLIGHT_COLORS.length]
}

interface Props {
  productId: string
  attributes: ConfigAttribute[]
  /** Estimated variant combinations from current option values. */
  comboEstimate?: number
  /** Optional compatibility drafts — preview hides/shows as shoppers would see. */
  previewRules?: PreviewCompatRule[]
  /** Fired when the current combo triggers a different set of rules. */
  onTriggeredRuleIdsChange?: (ids: string[]) => void
}

function resolveSwatch(opt: { display_name: string; color_code?: string | null }): string | null {
  if (opt.color_code) return opt.color_code
  return COLOUR_PALETTE.find(c => c.name.toLowerCase() === opt.display_name.toLowerCase())?.hex ?? null
}

function lightSwatch(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length < 6) return true
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 210
}

function selectionNames(
  attributes: ConfigAttribute[],
  selections: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const attr of attributes) {
    const opt = attr.options.find(o => o.id === selections[attr.id])
    if (opt) out[attr.name] = opt.name
  }
  return out
}

function isAttrVisible(
  attrName: string,
  rules: PreviewCompatRule[],
  selected: Record<string, string>,
): boolean {
  const hide = rules.some(r =>
    r.kind === 'hide_choice'
    && r.targetAttr === attrName
    && r.whenAttr
    && r.whenValue
    && selected[r.whenAttr] === r.whenValue,
  )
  if (hide) return false

  const showRules = rules.filter(r => r.kind === 'show_choice' && r.targetAttr === attrName && r.whenAttr && r.whenValue)
  if (showRules.length === 0) return true
  return showRules.some(r => selected[r.whenAttr] === r.whenValue)
}

function isOptionHidden(
  attrName: string,
  optName: string,
  rules: PreviewCompatRule[],
  selected: Record<string, string>,
): boolean {
  const hide = rules.some(r =>
    r.kind === 'hide_value'
    && r.targetAttr === attrName
    && previewRuleTargetValues(r).includes(optName)
    && r.whenAttr
    && r.whenValue
    && selected[r.whenAttr] === r.whenValue,
  )
  if (hide) return true

  const showRules = rules.filter(r =>
    r.kind === 'show_value'
    && r.targetAttr === attrName
    && previewRuleTargetValues(r).includes(optName)
    && r.whenAttr
    && r.whenValue,
  )
  if (showRules.length === 0) return false
  return !showRules.some(r => selected[r.whenAttr] === r.whenValue)
}

function isRuleTriggered(rule: PreviewCompatRule, selected: Record<string, string>): boolean {
  if (!rule.whenAttr || !rule.whenValue || !rule.targetAttr) return false
  if ((rule.kind === 'hide_value' || rule.kind === 'show_value') && previewRuleTargetValues(rule).length === 0) {
    return false
  }
  return selected[rule.whenAttr] === rule.whenValue
}

function ruleShortLabel(rule: PreviewCompatRule, attributes: ConfigAttribute[], _index: number): string {
  if (rule.label) return rule.label
  const when = attributes.find(a => a.name === rule.whenAttr)
  const target = attributes.find(a => a.name === rule.targetAttr)
  const whenVal = when?.options.find(o => o.name === rule.whenValue)?.display_name ?? rule.whenValue
  const whenName = when?.display_name ?? rule.whenAttr
  if (rule.kind === 'hide_value' || rule.kind === 'show_value') {
    const labels = previewRuleTargetValues(rule).map(v =>
      target?.options.find(o => o.name === v)?.display_name ?? v,
    )
    const verb = rule.kind === 'hide_value' ? 'hide' : 'show'
    return `When ${whenName} is ${whenVal}, ${verb} ${labels.join(', ')}`
  }
  if (rule.kind === 'hide_choice') {
    return `When ${whenName} is ${whenVal}, hide ${target?.display_name ?? rule.targetAttr}`
  }
  return `When ${whenName} is ${whenVal}, show ${target?.display_name ?? rule.targetAttr}`
}

/**
 * Live mock of how option pickers appear on the business-front product page.
 * Selections update as config attributes/values change on the left.
 */
export function BusinessFrontProductMock({
  productId, attributes, comboEstimate = 0, previewRules = [], onTriggeredRuleIdsChange,
}: Props) {
  const { data: product } = useProduct(productId)
  const [selections, setSelections] = useState<Record<string, string>>({})

  // Keep selections in sync when options are added/removed; default to first value.
  useEffect(() => {
    setSelections(prev => {
      const next: Record<string, string> = {}
      for (const attr of attributes) {
        if (attr.options.length === 0) continue
        const stillValid = attr.options.some(o => o.id === prev[attr.id])
        next[attr.id] = stillValid ? prev[attr.id] : attr.options[0].id
      }
      return next
    })
  }, [attributes])

  const selectedByName = useMemo(
    () => selectionNames(attributes, selections),
    [attributes, selections],
  )

  // If a rule hides the currently selected value, move to the first visible option.
  useEffect(() => {
    if (previewRules.length === 0) return
    setSelections(prev => {
      let changed = false
      const next = { ...prev }
      const names = selectionNames(attributes, next)
      for (const attr of attributes) {
        if (!isAttrVisible(attr.name, previewRules, names)) continue
        const cur = attr.options.find(o => o.id === next[attr.id])
        if (cur && isOptionHidden(attr.name, cur.name, previewRules, names)) {
          const fallback = attr.options.find(o => !isOptionHidden(attr.name, o.name, previewRules, names))
          if (fallback) {
            next[attr.id] = fallback.id
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [attributes, previewRules, selectedByName])

  const primaryImage = useMemo(() => {
    const images = product?.images ?? []
    return images.find(i => i.is_primary)?.url || images[0]?.url || null
  }, [product?.images])

  const visibleAttributes = useMemo(
    () => attributes.filter(a => isAttrVisible(a.name, previewRules, selectedByName)),
    [attributes, previewRules, selectedByName],
  )

  const selectedOpts = useMemo(() => {
    return visibleAttributes.flatMap(attr => {
      const opt = attr.options.find(o => o.id === selections[attr.id])
      if (!opt || isOptionHidden(attr.name, opt.name, previewRules, selectedByName)) return []
      return [{ attr, opt }]
    })
  }, [visibleAttributes, selections, previewRules, selectedByName])

  const priceDelta = selectedOpts.reduce((sum, s) => sum + (s.opt.price_delta || 0), 0)
  const basePrice = product?.price ?? 0
  const displayPrice = basePrice + priceDelta
  const compareAt = product?.compare_at_price
  const currency = product?.currency || 'INR'
  const selectionLabel = selectedOpts.map(s => s.opt.display_name).join(' / ')
  const accentSwatch = selectedOpts
    .map(s => resolveSwatch(s.opt))
    .find(Boolean) as string | undefined

  const hasAnyValues = attributes.some(a => a.options.length > 0)
  const totalCombos = comboEstimate > 0
    ? comboEstimate
    : estimateVariantCombinations(attributes.filter(a => a.options.length > 0))
  const activeRules = useMemo(
    () => previewRules.filter(r =>
      r.whenAttr && r.whenValue && r.targetAttr
      && ((r.kind !== 'hide_value' && r.kind !== 'show_value') || previewRuleTargetValues(r).length > 0),
    ),
    [previewRules],
  )
  const activeRuleCount = activeRules.length

  /** Rules whose "when" condition matches the current combo — each gets a color. */
  const triggered = useMemo(() => {
    return activeRules
      .map((rule, index) => ({ rule, index, color: ruleHighlightColor(index) }))
      .filter(({ rule }) => isRuleTriggered(rule, selectedByName))
  }, [activeRules, selectedByName])

  const triggeredIdsKey = triggered.map(t => t.rule.id ?? String(t.index)).join(',')
  useEffect(() => {
    if (!onTriggeredRuleIdsChange) return
    onTriggeredRuleIdsChange(triggeredIdsKey ? triggeredIdsKey.split(',') : [])
  }, [triggeredIdsKey, onTriggeredRuleIdsChange])

  /** Map attrName:optName → first triggered rule color (for chip rings). */
  const chipRuleColor = useMemo(() => {
    const map = new Map<string, (typeof RULE_HIGHLIGHT_COLORS)[number]>()
    for (const { rule, color } of triggered) {
      const whenKey = `${rule.whenAttr}:${rule.whenValue}`
      if (!map.has(whenKey)) map.set(whenKey, color)
      if ((rule.kind === 'hide_value' || rule.kind === 'show_value')) {
        for (const tv of previewRuleTargetValues(rule)) {
          const tKey = `${rule.targetAttr}:${tv}`
          if (!map.has(tKey)) map.set(tKey, color)
        }
      }
      if (rule.kind === 'hide_choice' || rule.kind === 'show_choice') {
        const aKey = `${rule.targetAttr}:*`
        if (!map.has(aKey)) map.set(aKey, color)
      }
    }
    return map
  }, [triggered])

  const validCombos = useMemo(() => {
    if (activeRuleCount === 0) return totalCombos
    if (totalCombos <= 0) return 0
    try {
      return countCombinationsAfterRules(attributes, activeRules)
    } catch {
      return totalCombos
    }
  }, [attributes, activeRules, activeRuleCount, totalCombos])

  const reducedBy = totalCombos > validCombos ? totalCombos - validCombos : 0
  const displayCombo = activeRuleCount > 0 ? validCombos : totalCombos

  return (
    <aside className="lg:sticky lg:top-3 lg:self-start">
      <div className="mb-1 flex items-center gap-1 px-0.5">
        <MonitorSmartphone className="h-3 w-3 text-muted-foreground" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Business front preview
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {/* Browser chrome */}
        <div className="flex items-center gap-1 border-b bg-muted/40 px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          <div className="ml-1.5 flex-1 truncate rounded bg-background px-1.5 py-px text-[9px] text-muted-foreground">
            yourstore.com/products/{product?.name ? product.name.toLowerCase().replace(/\s+/g, '-') : '…'}
          </div>
        </div>

        <div className="space-y-1.5 p-2">
          {/* Product media — compact strip */}
          <div
            className="relative flex h-16 items-center justify-center overflow-hidden rounded-md border bg-muted/30"
            style={accentSwatch ? { background: `linear-gradient(145deg, ${accentSwatch}22, transparent 60%)` } : undefined}
          >
            {primaryImage ? (
              <img src={primaryImage} alt={product?.name || 'Product'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <div
                  className="h-7 w-7 rounded-full border border-dashed"
                  style={accentSwatch ? { backgroundColor: accentSwatch, borderColor: accentSwatch } : undefined}
                />
                <span className="text-[9px]">Product image</span>
              </div>
            )}
          </div>

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {product?.brand && (
                <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{product.brand}</p>
              )}
              <h3 className="truncate text-xs font-semibold leading-tight text-foreground">
                {product?.name || 'Your product'}
              </h3>
              {selectionLabel && (
                <p className="truncate text-[10px] text-muted-foreground">{selectionLabel}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold leading-none text-foreground">{formatCurrency(displayPrice, currency)}</p>
              {compareAt != null && compareAt > displayPrice && (
                <p className="text-[9px] text-muted-foreground line-through">{formatCurrency(compareAt, currency)}</p>
              )}
              {priceDelta !== 0 && (
                <p className={cn('text-[9px] font-medium', priceDelta > 0 ? 'text-amber-700' : 'text-emerald-700')}>
                  {priceDelta > 0 ? '+' : ''}{formatCurrency(priceDelta, currency)}
                </p>
              )}
            </div>
          </div>

          {!hasAnyValues ? (
            <p className="rounded border border-dashed px-2 py-2 text-center text-[10px] text-muted-foreground">
              Add option values on the left to preview choices.
            </p>
          ) : (
            <div className="space-y-1.5">
              {visibleAttributes.map(attr => {
                const catalog = getVariantOptionTypeForAttribute(attr.display_name, attr.name)
                const isColor = catalog?.inputType === 'color' || attr.input_type === 'color'
                const visibleOpts = attr.options.filter(
                  o => !isOptionHidden(attr.name, o.name, previewRules, selectedByName),
                )
                const selectedId = selections[attr.id]
                const selectedStillVisible = visibleOpts.some(o => o.id === selectedId)

                if (attr.options.length === 0) {
                  return (
                    <div key={attr.id}>
                      <p className="text-[10px] font-medium text-foreground">{attr.display_name}</p>
                      <p className="text-[9px] text-amber-700">Add values to show this choice</p>
                    </div>
                  )
                }

                if (visibleOpts.length === 0) {
                  return (
                    <div key={attr.id}>
                      <p className="text-[10px] font-medium text-muted-foreground line-through">{attr.display_name}</p>
                      <p className="text-[9px] text-muted-foreground">Hidden by your rule</p>
                    </div>
                  )
                }

                return (
                  <div key={attr.id}>
                    <p className="mb-0.5 flex flex-wrap items-center gap-1 text-[10px] font-medium text-foreground">
                      <span>
                        {attr.display_name}
                        {selectedStillVisible && (() => {
                          const sel = attr.options.find(o => o.id === selectedId)
                          if (!sel) return null
                          if (!isColor) {
                            return (
                              <span className="ml-1 font-normal text-muted-foreground">
                                — {sel.display_name}
                              </span>
                            )
                          }
                          const parts = getColorShowParts(attr)
                          const text = formatColorChoiceLabel(parts, sel)
                          const { name } = resolveColorParts(sel)
                          const label = text || name
                          return (
                            <span className="ml-1 font-normal text-muted-foreground">
                              — {label}
                            </span>
                          )
                        })()}
                      </span>
                      {chipRuleColor.get(`${attr.name}:*`) && (
                        <span
                          className="rounded px-1 py-px text-[9px] font-semibold"
                          style={{
                            backgroundColor: chipRuleColor.get(`${attr.name}:*`)!.bg,
                            color: chipRuleColor.get(`${attr.name}:*`)!.text,
                          }}
                        >
                          rule
                        </span>
                      )}
                    </p>
                    {isColor ? (() => {
                      const parts = getColorShowParts(attr)
                      const showSwatch = parts.color
                      const showText = parts.name || parts.hex
                      const swatchOnly = showSwatch && !showText
                      const stacked = parts.name && parts.hex

                      return (
                        <div className={cn('flex flex-wrap', stacked || (showSwatch && showText) ? 'gap-1.5' : 'gap-1')}>
                          {visibleOpts.map(opt => {
                            const { hex, name } = resolveColorParts(opt)
                            const selected = opt.id === selectedId
                            const ruleColor = chipRuleColor.get(`${attr.name}:${opt.name}`)
                            const label = formatColorChoiceLabel(parts, opt)

                            if (swatchOnly) {
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  title={name}
                                  aria-pressed={selected}
                                  onClick={() => setSelections(prev => ({ ...prev, [attr.id]: opt.id }))}
                                  className={cn(
                                    'relative h-6 w-6 rounded-full border transition-transform hover:scale-110',
                                    selected && !ruleColor && 'border-primary ring-2 ring-primary/35 ring-offset-1',
                                    !selected && !ruleColor && (lightSwatch(hex) ? 'border-gray-300' : 'border-black/10'),
                                  )}
                                  style={{
                                    backgroundColor: hex,
                                    ...(ruleColor ? {
                                      borderColor: ruleColor.border,
                                      boxShadow: selected
                                        ? `0 0 0 2px ${ruleColor.ring}`
                                        : `0 0 0 1.5px ${ruleColor.border}`,
                                    } : undefined),
                                  }}
                                />
                              )
                            }

                            return (
                              <button
                                key={opt.id}
                                type="button"
                                title={opt.display_name}
                                aria-pressed={selected}
                                onClick={() => setSelections(prev => ({ ...prev, [attr.id]: opt.id }))}
                                className={cn(
                                  'inline-flex max-w-[5.5rem] items-center gap-1.5 rounded-md border bg-card text-left transition-all',
                                  stacked ? 'px-1.5 py-1' : 'h-6 px-1.5',
                                  !ruleColor && 'hover:border-foreground/20 hover:bg-muted/50',
                                  selected && !ruleColor && 'border-primary bg-primary/[0.07] ring-1 ring-primary/25',
                                  !selected && !ruleColor && 'border-border/80',
                                )}
                                style={ruleColor ? {
                                  borderColor: ruleColor.border,
                                  backgroundColor: selected ? ruleColor.bg : undefined,
                                  boxShadow: selected ? `0 0 0 1px ${ruleColor.ring}` : undefined,
                                } : undefined}
                              >
                                {showSwatch && (
                                  <span
                                    className={cn(
                                      'relative shrink-0 rounded-full border shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
                                      stacked ? 'h-5 w-5' : 'h-3.5 w-3.5',
                                      lightSwatch(hex) ? 'border-gray-300' : 'border-transparent',
                                      selected && !ruleColor && 'ring-1 ring-primary/40 ring-offset-1',
                                    )}
                                    style={{ backgroundColor: hex }}
                                  />
                                )}
                                {showText && (
                                  <span className="min-w-0 flex-1">
                                    {stacked ? (
                                      <span className="flex flex-col gap-0.5 leading-none">
                                        <span className="truncate text-[10px] font-semibold tracking-tight text-foreground">
                                          {name}
                                        </span>
                                        <span className="truncate font-mono text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
                                          {hex}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="block truncate text-[10px] font-semibold leading-none text-foreground">
                                        {label}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )
                    })() : (
                      <div className="flex flex-wrap gap-1">
                        {visibleOpts.map(opt => {
                          const selected = opt.id === selectedId
                          const ruleColor = chipRuleColor.get(`${attr.name}:${opt.name}`)
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setSelections(prev => ({ ...prev, [attr.id]: opt.id }))}
                              className={cn(
                                'inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded border px-1.5 text-[10px] font-semibold transition-all',
                                selected && !ruleColor && 'border-primary bg-primary text-primary-foreground',
                                !selected && !ruleColor && 'border-border bg-background text-foreground hover:border-primary/40',
                              )}
                              style={ruleColor ? {
                                borderColor: ruleColor.border,
                                backgroundColor: selected ? ruleColor.border : ruleColor.bg,
                                color: selected ? '#fff' : ruleColor.text,
                                boxShadow: selected ? `0 0 0 2px ${ruleColor.ring}` : undefined,
                              } : undefined}
                            >
                              {opt.display_name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {attributes.some(a => !isAttrVisible(a.name, previewRules, selectedByName)) && (
                <p className="text-[9px] text-muted-foreground">
                  Some options are hidden by your rules — try different selections above.
                </p>
              )}
              {triggered.length > 0 && (
                <div className="space-y-1 rounded-md border border-dashed bg-muted/20 px-1.5 py-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Rules for this combo
                  </p>
                  <ul className="space-y-1">
                    {triggered.map(({ rule, index, color }) => (
                      <li
                        key={rule.id ?? index}
                        className="flex items-start gap-1.5 rounded px-1.5 py-1 text-[10px] leading-snug"
                        style={{ backgroundColor: color.bg, color: color.text, borderLeft: `3px solid ${color.border}` }}
                      >
                        <span
                          className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color.border }}
                        />
                        <span className="min-w-0 font-medium">
                          Rule {index + 1}: {ruleShortLabel(rule, attributes, index)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {activeRuleCount > 0 && triggered.length === 0 && (
                <p className="text-[9px] text-muted-foreground">
                  No rules match this combo — change a value above to trigger one.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[10px] font-semibold text-primary-foreground opacity-90"
          >
            <ShoppingCart className="h-3 w-3" />
            Add to cart
          </button>
          {totalCombos > 0 && (
            <div className="space-y-0.5 text-center text-[10px] text-muted-foreground">
              <p>
                <span className={cn('font-semibold', isOverComboLimit(displayCombo) ? 'text-red-700' : 'text-foreground')}>
                  {displayCombo.toLocaleString('en-IN')}
                </span>
                {' '}
                {activeRuleCount > 0 ? 'valid combination' : 'possible combination'}
                {displayCombo === 1 ? '' : 's'}
                <span className="text-muted-foreground">
                  {' · '}max {MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')}
                </span>
                {activeRuleCount > 0 && (
                  <span> · {activeRuleCount} rule{activeRuleCount === 1 ? '' : 's'} applied</span>
                )}
              </p>
              {isOverComboLimit(displayCombo) && (
                <p className="font-medium text-red-700">
                  Over limit — remove values until {MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')} or fewer
                </p>
              )}
              {activeRuleCount > 0 && reducedBy > 0 && !isOverComboLimit(displayCombo) && (
                <p className="text-emerald-700">
                  −{reducedBy.toLocaleString('en-IN')} hidden
                  <span className="text-muted-foreground"> (was {totalCombos.toLocaleString('en-IN')})</span>
                </p>
              )}
              {activeRuleCount > 0 && reducedBy === 0 && !isOverComboLimit(displayCombo) && (
                <p className="text-amber-700">
                  Rules applied, but no combinations removed yet — try different when/hide values
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
