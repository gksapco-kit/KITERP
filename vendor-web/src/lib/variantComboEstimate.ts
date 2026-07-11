/**
 * Rule-aware variant combination counts — used by the options step, create step,
 * and business-front preview so the max limit reflects saved hide/show rules.
 */
import type { ConfigAttribute, ConfigRule, RuleCondition } from '@/api/vendor'
import { flattenAttributes } from '@/lib/productConfigTree'
import {
  estimateVariantCombinations,
  MAX_VARIANT_COMBINATIONS,
} from '@/lib/variantOptionTypes'

/** Draft / saved simple rules applied when counting reachable combinations. */
export type PreviewCompatRule = {
  id?: string
  label?: string
  kind: 'show_choice' | 'hide_choice' | 'hide_value'
  whenAttr: string
  whenValue: string
  targetAttr: string
  targetValue?: string
}

const MAX_ENUMERATE = 250_000

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
  return rules.some(r =>
    r.kind === 'hide_value'
    && r.targetAttr === attrName
    && r.targetValue === optName
    && r.whenAttr
    && r.whenValue
    && selected[r.whenAttr] === r.whenValue,
  )
}

/**
 * Count shopper-reachable combinations after simple hide/show rules.
 * Hidden attributes are skipped (don't multiply). Hidden values are excluded.
 */
export function countCombinationsAfterRules(
  attributes: ConfigAttribute[],
  rules: PreviewCompatRule[],
): number {
  const attrs = flattenAttributes(attributes).filter(
    a => a.is_active !== false && a.options.some(o => o.is_active !== false),
  )
  if (attrs.length === 0) return 0

  const completeRules = rules.filter(r =>
    r.whenAttr && r.whenValue && r.targetAttr && (r.kind !== 'hide_value' || r.targetValue),
  )
  if (completeRules.length === 0) {
    return estimateVariantCombinations(attrs)
  }

  function walk(index: number, selected: Record<string, string>): number {
    if (index >= attrs.length) return 1
    const attr = attrs[index]
    if (!isAttrVisible(attr.name, completeRules, selected)) {
      return walk(index + 1, selected)
    }
    let total = 0
    for (const opt of attr.options) {
      if (opt.is_active === false) continue
      if (isOptionHidden(attr.name, opt.name, completeRules, selected)) continue
      total += walk(index + 1, { ...selected, [attr.name]: opt.name })
      if (total > MAX_ENUMERATE) return total
    }
    return total
  }

  return walk(0, {})
}

function extractSimpleWhen(node: RuleCondition | null | undefined): { attr: string; value: string } | null {
  if (!node) return null
  if ('op' in node && node.op) {
    const children = node.children ?? []
    if (node.op === 'AND' || node.op === 'OR') {
      for (const child of children) {
        const found = extractSimpleWhen(child)
        if (found) return found
      }
      return null
    }
    if (node.op === 'NOT') return null
  }
  if ('attribute' in node && node.attribute && node.operator === 'equals' && node.value != null) {
    return { attr: node.attribute, value: String(node.value) }
  }
  return null
}

/** Map saved API rules into the simple preview shape used for counting. */
export function configRulesToPreviewCompat(rules: ConfigRule[]): PreviewCompatRule[] {
  const out: PreviewCompatRule[] = []
  for (const rule of rules) {
    if (rule.is_active === false) continue
    const action = rule.actions?.[0]
    if (!action?.target) continue
    const when = extractSimpleWhen(rule.conditions)
    if (!when) continue

    if (action.type === 'disable_option') {
      const [targetAttr, targetValue] = action.target.includes(':')
        ? action.target.split(':')
        : [action.target, action.target]
      if (!targetValue) continue
      out.push({
        id: rule.id,
        label: rule.name,
        kind: 'hide_value',
        whenAttr: when.attr,
        whenValue: when.value,
        targetAttr,
        targetValue,
      })
    } else if (action.type === 'hide_field') {
      out.push({
        id: rule.id,
        label: rule.name,
        kind: 'hide_choice',
        whenAttr: when.attr,
        whenValue: when.value,
        targetAttr: action.target,
      })
    } else if (action.type === 'show_field') {
      out.push({
        id: rule.id,
        label: rule.name,
        kind: 'show_choice',
        whenAttr: when.attr,
        whenValue: when.value,
        targetAttr: action.target,
      })
    }
  }
  return out
}

export type ComboEstimateBreakdown = {
  /** Raw cartesian product (option values only). */
  raw: number
  /** Combinations reachable after rules (same as raw when no rules). */
  effective: number
  /** How many combinations rules remove. */
  reducedBy: number
  rulesApplied: number
}

/** Effective combo count for limit checks — prefers rule-reduced total when rules exist. */
export function estimateEffectiveCombinations(
  attributes: ConfigAttribute[],
  rules: ConfigRule[] | PreviewCompatRule[] = [],
): ComboEstimateBreakdown {
  const flat = flattenAttributes(attributes)
  const raw = estimateVariantCombinations(flat)
  const preview = rules.length === 0
    ? []
    : 'actions' in rules[0]
      ? configRulesToPreviewCompat(rules as ConfigRule[])
      : (rules as PreviewCompatRule[])

  if (preview.length === 0 || raw <= 0) {
    return { raw, effective: raw, reducedBy: 0, rulesApplied: 0 }
  }

  let effective = raw
  try {
    effective = countCombinationsAfterRules(flat, preview)
  } catch {
    effective = raw
  }

  return {
    raw,
    effective,
    reducedBy: Math.max(0, raw - effective),
    rulesApplied: preview.length,
  }
}

/** Estimate combos if one more active value is added to the given attribute (rule-aware). */
export function estimateCombinationsWithExtraOptionAware(
  attributes: ConfigAttribute[],
  attributeId: string,
  rules: ConfigRule[] | PreviewCompatRule[] = [],
): number {
  const withExtra = flattenAttributes(attributes).map(a => {
    if (a.id !== attributeId) return a
    return {
      ...a,
      options: [
        ...a.options,
        {
          id: '__pending__',
          attribute_id: a.id,
          parent_option_id: null,
          name: '__pending__',
          display_name: 'New',
          image_url: null,
          icon: null,
          color_code: null,
          price_delta: 0,
          sort_order: a.options.length,
          labels_i18n: {},
          is_active: true,
        },
      ],
    }
  })
  return estimateEffectiveCombinations(withExtra as ConfigAttribute[], rules).effective
}

/**
 * How many combinations this one rule removes (leave-one-out vs the rest).
 * Useful for "blocks N variants" labels on saved rules.
 */
export function countCombinationsRemovedByRule(
  attributes: ConfigAttribute[],
  allRules: PreviewCompatRule[],
  ruleId: string,
): number {
  const withAll = countCombinationsAfterRules(attributes, allRules)
  const without = countCombinationsAfterRules(
    attributes,
    allRules.filter(r => r.id !== ruleId),
  )
  return Math.max(0, without - withAll)
}

export { MAX_VARIANT_COMBINATIONS }
