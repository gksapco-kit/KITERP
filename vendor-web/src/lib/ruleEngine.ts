// vendor-web/src/lib/ruleEngine.ts
//
// Client-side mirror of backend/app/services/rule_engine.py — keep both in sync.
// Runs entirely in the browser so the Product Configurator can show/hide/require
// fields, auto-select options, and surface warnings/errors instantly as the user
// picks values (no round trip per keystroke). The backend re-validates the same
// logic before anything is actually saved.
import type { ConfigRule, RuleCondition, RuleComparisonOperator, RuleEvaluationResult } from '@/api/vendor'

export const OPERATOR_LABELS: Record<RuleComparisonOperator, string> = {
  equals: 'equals',
  not_equals: 'not equals',
  contains: 'contains',
  gt: 'greater than',
  lt: 'less than',
  between: 'between',
  starts_with: 'starts with',
  ends_with: 'ends with',
}

export const ACTION_LABELS: Record<string, string> = {
  show_field: 'Show field',
  hide_field: 'Hide field',
  require_field: 'Require field',
  disable_option: 'Disable option',
  enable_option: 'Enable option',
  auto_select: 'Auto-select option',
  change_default: 'Change default value',
  warning: 'Show warning',
  error: 'Show error',
  prevent_save: 'Prevent save',
}

function toComparable(value: unknown): unknown {
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const s = value.trim()
    if (s !== '' && !Number.isNaN(Number(s))) return Number(s)
    return s
  }
  return value
}

function compare(actual: unknown, operator: RuleComparisonOperator, expected: unknown, expected2?: unknown): boolean {
  const a = toComparable(actual)

  switch (operator) {
    case 'equals':
      if (Array.isArray(a)) return a.includes(expected)
      return a === toComparable(expected)
    case 'not_equals':
      if (Array.isArray(a)) return !a.includes(expected)
      return a !== toComparable(expected)
    case 'contains':
      if (Array.isArray(a)) return a.includes(expected)
      return String(a ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase())
    case 'starts_with':
      return String(a ?? '').toLowerCase().startsWith(String(expected ?? '').toLowerCase())
    case 'ends_with':
      return String(a ?? '').toLowerCase().endsWith(String(expected ?? '').toLowerCase())
    case 'gt': {
      const av = Number(a)
      return Number.isFinite(av) && av > Number(expected)
    }
    case 'lt': {
      const av = Number(a)
      return Number.isFinite(av) && av < Number(expected)
    }
    case 'between': {
      const av = Number(a)
      if (!Number.isFinite(av)) return false
      const lo = Number(expected)
      const hi = Number(expected2)
      return av >= Math.min(lo, hi) && av <= Math.max(lo, hi)
    }
    default:
      return false
  }
}

/** Evaluate a nested AND/OR/NOT condition tree. Empty/undefined = always true. */
export function evaluateCondition(node: RuleCondition | null | undefined, selection: Record<string, unknown>): boolean {
  if (!node) return true

  if ('op' in node && node.op) {
    const children = node.children ?? []
    const results = children.map(c => evaluateCondition(c, selection))
    if (node.op === 'AND') return results.length === 0 || results.every(Boolean)
    if (node.op === 'OR') return results.some(Boolean)
    if (node.op === 'NOT') return !(results[0] ?? false)
    return true
  }

  if ('attribute' in node && node.attribute && node.operator) {
    return compare(selection[node.attribute], node.operator, node.value, node.value2)
  }
  return true
}

const emptyResult = (): RuleEvaluationResult => ({
  shown: [], hidden: [], required: [],
  disabled_options: {}, enabled_options: {},
  auto_select: {}, defaults: {},
  warnings: [], errors: [], prevent_save: false, matched_rule_ids: [],
})

/** Evaluate every active rule against a selection. Priority ascending; later/higher
 * priority rules override earlier ones for the same target. Mirrors evaluate_rules()
 * in backend/app/services/rule_engine.py exactly. */
export function evaluateRules(rules: ConfigRule[], selection: Record<string, unknown>): RuleEvaluationResult {
  const result = emptyResult()
  const shown = new Set<string>()
  const hidden = new Set<string>()
  const required = new Set<string>()
  const disabled: Record<string, Set<string>> = {}
  const enabled: Record<string, Set<string>> = {}

  const ordered = [...rules]
    .filter(r => r.is_active)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.name.localeCompare(b.name))

  for (const rule of ordered) {
    if (!evaluateCondition(rule.conditions, selection)) continue
    result.matched_rule_ids.push(rule.id)

    for (const action of rule.actions ?? []) {
      const target = action.target
      switch (action.type) {
        case 'show_field':
          if (target) { shown.add(target); hidden.delete(target) }
          break
        case 'hide_field':
          if (target) { hidden.add(target); shown.delete(target) }
          break
        case 'require_field':
          if (target) {
            if (action.value === false) required.delete(target)
            else required.add(target)
          }
          break
        case 'disable_option':
          if (target) {
            const [attr, option] = target.includes(':') ? target.split(':') : [target, target]
            if (!disabled[attr]) disabled[attr] = new Set()
            disabled[attr].add(option)
          }
          break
        case 'enable_option':
          if (target) {
            const [attr, option] = target.includes(':') ? target.split(':') : [target, target]
            if (!enabled[attr]) enabled[attr] = new Set()
            enabled[attr].add(option)
          }
          break
        case 'auto_select':
          if (target) result.auto_select[target] = action.value
          break
        case 'change_default':
          if (target) result.defaults[target] = action.value
          break
        case 'warning':
          result.warnings.push(action.message || (typeof action.value === 'string' ? action.value : 'Rule warning'))
          break
        case 'error':
          result.errors.push(action.message || (typeof action.value === 'string' ? action.value : 'Rule error'))
          break
        case 'prevent_save':
          result.prevent_save = true
          if (action.message) result.errors.push(action.message)
          break
      }
    }
  }

  result.shown = Array.from(shown).sort()
  result.hidden = Array.from(hidden).sort()
  result.required = Array.from(required).sort()
  result.disabled_options = Object.fromEntries(Object.entries(disabled).map(([k, v]) => [k, Array.from(v).sort()]))
  result.enabled_options = Object.fromEntries(Object.entries(enabled).map(([k, v]) => [k, Array.from(v).sort()]))
  return result
}

/** Human-readable one-line summary of a condition tree, e.g. "Voltage equals 220V AND Material equals Cotton". */
export function describeCondition(node: RuleCondition | null | undefined): string {
  if (!node) return 'Always'
  if ('op' in node && node.op) {
    const parts = (node.children ?? []).map(describeCondition)
    if (node.op === 'NOT') return `NOT (${parts[0] ?? ''})`
    const joined = parts.join(` ${node.op} `)
    return parts.length > 1 ? `(${joined})` : joined
  }
  if ('attribute' in node && node.attribute) {
    const opLabel = node.operator ? OPERATOR_LABELS[node.operator] : ''
    if (node.operator === 'between') return `${node.attribute} ${opLabel} ${String(node.value)} and ${String(node.value2)}`
    return `${node.attribute} ${opLabel} ${String(node.value ?? '')}`.trim()
  }
  return ''
}
