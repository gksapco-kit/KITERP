import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowRight, Ban, CheckCircle2,
  Eye, EyeOff, Layers, Loader2, Plus, Sparkles, Trash2, Wand2, XCircle,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type {
  ConfigAttribute, ConfigRule, RuleAction, RuleActionType, RuleCondition, RuleConditionGroup, RuleConditionLeaf,
  RuleComparisonOperator, RuleExecutionMode, RuleLogicalOperator,
} from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { evaluateRules, describeCondition, ACTION_LABELS, OPERATOR_LABELS } from '@/lib/ruleEngine'
import { flattenAttributes } from '@/lib/productConfigTree'

interface Props {
  productId: string
}

// ── Helpers ──────────────────────────────────────────────────────
const OPERATOR_OPTIONS = (Object.keys(OPERATOR_LABELS) as RuleComparisonOperator[]).map(op => ({
  value: op, label: OPERATOR_LABELS[op],
}))

const ACTION_OPTIONS = (Object.keys(ACTION_LABELS) as RuleActionType[]).map(t => ({
  value: t, label: ACTION_LABELS[t],
}))

const ACTION_ICON: Record<RuleActionType, React.ComponentType<{ className?: string }>> = {
  show_field: Eye, hide_field: EyeOff, require_field: CheckCircle2,
  disable_option: Ban, enable_option: CheckCircle2, auto_select: Wand2,
  change_default: Sparkles, warning: AlertTriangle, error: XCircle, prevent_save: Ban,
}

function isGroup(node: RuleCondition): node is RuleConditionGroup {
  return 'op' in node && !!node.op
}

const emptyGroup = (): RuleConditionGroup => ({ op: 'AND', children: [] })
const emptyLeaf = (attrName?: string): RuleCondition => ({ attribute: attrName || '', operator: 'equals', value: '' })

let _seed = 0
const localId = () => `tmp_${Date.now().toString(36)}_${_seed++}`

// ── Condition group editor (recursive — unlimited nested groups) ──
function ConditionGroupEditor({
  group, onChange, onRemove, depth, attributes,
}: {
  group: RuleConditionGroup
  onChange: (g: RuleConditionGroup) => void
  onRemove?: () => void
  depth: number
  attributes: ConfigAttribute[]
}) {
  const setOp = (op: RuleLogicalOperator) => onChange({ ...group, op })
  const updateChild = (idx: number, next: RuleCondition) =>
    onChange({ ...group, children: group.children.map((c, i) => (i === idx ? next : c)) })
  const removeChild = (idx: number) =>
    onChange({ ...group, children: group.children.filter((_, i) => i !== idx) })
  const addLeaf = () => onChange({ ...group, children: [...group.children, emptyLeaf(attributes[0]?.name)] })
  const addGroup = () => onChange({ ...group, children: [...group.children, emptyGroup()] })

  return (
    <div className={cn('relative rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-3', depth > 0 && 'mt-2')}>
      <div className="mb-2 flex items-center justify-between">
        <div className="inline-flex rounded-md border bg-card p-0.5 text-xs font-semibold">
          {(['AND', 'OR', 'NOT'] as RuleLogicalOperator[]).map(op => (
            <button
              key={op}
              type="button"
              onClick={() => setOp(op)}
              className={cn(
                'rounded px-2.5 py-1 transition-colors',
                group.op === op ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted',
              )}
              title={
                op === 'AND' ? 'All conditions in this group must be true'
                  : op === 'OR' ? 'Any condition in this group can be true'
                    : 'Inverts the first condition in this group'
              }
            >
              {op}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {depth > 0 && (
            <span className="mr-1 text-[11px] text-muted-foreground">nested group</span>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500" title="Remove group">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {group.children.length === 0 && (
          <p className="py-1 text-xs text-muted-foreground">No conditions yet — add one below, or leave empty to always match.</p>
        )}
        {group.children.map((child, idx) => (
          <div key={idx}>
            {idx > 0 && (
              <div className="my-1 flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                <Badge variant="soft" className="text-[10px]">{group.op}</Badge>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            {isGroup(child) ? (
              <ConditionGroupEditor
                group={child}
                depth={depth + 1}
                attributes={attributes}
                onChange={next => updateChild(idx, next)}
                onRemove={() => removeChild(idx)}
              />
            ) : (
              <ConditionLeafRow
                leaf={child as RuleConditionLeaf}
                attributes={attributes}
                onChange={next => updateChild(idx, next)}
                onRemove={() => removeChild(idx)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-3 border-t border-dashed pt-2">
        <button type="button" onClick={addLeaf} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" /> Add condition
        </button>
        <button type="button" onClick={addGroup} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" /> Add group
        </button>
      </div>
    </div>
  )
}

function ConditionLeafRow({
  leaf, attributes, onChange, onRemove,
}: {
  leaf: RuleConditionLeaf
  attributes: ConfigAttribute[]
  onChange: (l: RuleCondition) => void
  onRemove: () => void
}) {
  const attr = attributes.find(a => a.name === leaf.attribute)
  const hasOptions = !!attr?.options?.length

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-card px-2 py-1.5 shadow-sm ring-1 ring-border">
      <Select
        className="h-8 w-40 text-xs"
        value={leaf.attribute || ''}
        onChange={v => onChange({ ...leaf, attribute: v })}
        options={attributes.map(a => ({ value: a.name, label: a.display_name }))}
      />
      <Select
        className="h-8 w-32 text-xs"
        value={leaf.operator || 'equals'}
        onChange={v => onChange({ ...leaf, operator: v as RuleComparisonOperator })}
        options={OPERATOR_OPTIONS}
      />
      {hasOptions ? (
        <Select
          className="h-8 w-36 text-xs"
          value={String(leaf.value ?? '')}
          onChange={v => onChange({ ...leaf, value: v })}
          options={attr!.options.map(o => ({ value: o.name, label: o.display_name }))}
        />
      ) : (
        <Input
          className="h-8 w-32 text-xs"
          value={String(leaf.value ?? '')}
          placeholder="value"
          onChange={e => onChange({ ...leaf, value: e.target.value })}
        />
      )}
      {leaf.operator === 'between' && (
        <>
          <span className="text-xs text-muted-foreground">and</span>
          <Input
            className="h-8 w-24 text-xs"
            value={String(leaf.value2 ?? '')}
            placeholder="value"
            onChange={e => onChange({ ...leaf, value2: e.target.value })}
          />
        </>
      )}
      <button type="button" onClick={onRemove} className="ml-auto rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500" title="Remove condition">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Action row editor ────────────────────────────────────────────
function ActionRow({
  action, index, attributes, onChange, onRemove,
}: {
  action: RuleAction
  index: number
  attributes: ConfigAttribute[]
  onChange: (a: RuleAction) => void
  onRemove: () => void
}) {
  const Icon = ACTION_ICON[action.type] || Sparkles
  const targetAttr = attributes.find(a => a.name === (action.target?.split(':')[0] || action.target))
  const needsOptionTarget = action.type === 'disable_option' || action.type === 'enable_option' || action.type === 'auto_select'
  const [attrPart, optPart] = (action.target || '').split(':')

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-card px-2 py-1.5 shadow-sm ring-1 ring-border">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{index + 1}</span>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Select
        className="h-8 w-40 text-xs"
        value={action.type}
        onChange={v => onChange({ ...action, type: v as RuleActionType, target: undefined, value: undefined })}
        options={ACTION_OPTIONS}
      />

      {['show_field', 'hide_field', 'require_field', 'change_default'].includes(action.type) && (
        <Select
          className="h-8 w-36 text-xs"
          value={action.target || ''}
          onChange={v => onChange({ ...action, target: v })}
          options={attributes.map(a => ({ value: a.name, label: a.display_name }))}
        />
      )}

      {needsOptionTarget && (
        <>
          <Select
            className="h-8 w-32 text-xs"
            value={attrPart || ''}
            onChange={v => onChange({ ...action, target: v })}
            options={attributes.map(a => ({ value: a.name, label: a.display_name }))}
          />
          {targetAttr && !!targetAttr.options?.length && (
            <Select
              className="h-8 w-32 text-xs"
              value={optPart || ''}
              onChange={v => onChange({ ...action, target: `${attrPart}:${v}` })}
              options={targetAttr.options.map(o => ({ value: o.name, label: o.display_name }))}
            />
          )}
        </>
      )}

      {action.type === 'require_field' && (
        <Select
          className="h-8 w-24 text-xs"
          value={action.value === false ? 'false' : 'true'}
          onChange={v => onChange({ ...action, value: v === 'true' })}
          options={[{ value: 'true', label: 'TRUE' }, { value: 'false', label: 'FALSE' }]}
        />
      )}

      {action.type === 'change_default' && (
        <Input
          className="h-8 w-28 text-xs"
          value={String(action.value ?? '')}
          placeholder="new default"
          onChange={e => onChange({ ...action, value: e.target.value })}
        />
      )}

      {(action.type === 'warning' || action.type === 'error' || action.type === 'prevent_save') && (
        <Input
          className="h-8 min-w-[10rem] flex-1 text-xs"
          value={action.message || ''}
          placeholder="Message shown to the user"
          onChange={e => onChange({ ...action, message: e.target.value })}
        />
      )}

      <button type="button" onClick={onRemove} className="ml-auto rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500" title="Remove action">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Live evaluation preview panel ─────────────────────────────────
function LiveEvaluationPanel({ rule, attributes }: { rule: ConfigRule; attributes: ConfigAttribute[] }) {
  const relevantAttrs = useMemo(() => {
    const names = new Set<string>()
    const collect = (node: RuleCondition) => {
      if (isGroup(node)) node.children.forEach(collect)
      else if ('attribute' in node && node.attribute) names.add(node.attribute)
    }
    collect(rule.conditions)
    // also include attributes targeted by actions so their resulting state is visible
    for (const a of rule.actions) {
      if (a.target) names.add(a.target.split(':')[0])
    }
    return attributes.filter(a => names.has(a.name))
  }, [rule, attributes])

  const [sample, setSample] = useState<Record<string, string>>({})

  const effectiveSample = useMemo(() => {
    const next = { ...sample }
    for (const a of relevantAttrs) {
      if (next[a.name] === undefined) next[a.name] = a.options?.[0]?.name ?? ''
    }
    return next
  }, [sample, relevantAttrs])

  const result = useMemo(() => evaluateRules([rule], effectiveSample), [rule, effectiveSample])

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-sm font-semibold text-foreground">Live Evaluation</p>
        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
        </span>
      </div>
      <p className="px-3 pt-2 text-[11px] text-muted-foreground">See how this rule behaves with sample values.</p>

      <div className="space-y-2 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sample inputs</p>
        {relevantAttrs.length === 0 && (
          <p className="text-xs text-muted-foreground">Pick an attribute in a condition to preview it here.</p>
        )}
        {relevantAttrs.map(a => (
          <div key={a.id} className="flex items-center justify-between gap-2">
            <span className="text-xs text-foreground">{a.display_name}</span>
            {a.options?.length ? (
              <Select
                className="h-7 w-32 text-xs"
                value={effectiveSample[a.name] ?? ''}
                onChange={v => setSample(s => ({ ...s, [a.name]: v }))}
                options={a.options.map(o => ({ value: o.name, label: o.display_name }))}
              />
            ) : (
              <Input
                className="h-7 w-32 text-xs"
                value={effectiveSample[a.name] ?? ''}
                onChange={e => setSample(s => ({ ...s, [a.name]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto border-t px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Result</p>
        {result.matched_rule_ids.length === 0 ? (
          <p className="rounded-md bg-muted/50 px-2 py-2 text-xs text-muted-foreground">
            Conditions are not met with these sample values — actions will not run.
          </p>
        ) : (
          <p className="rounded-md bg-emerald-50 px-2 py-2 text-xs font-medium text-emerald-700">
            Conditions matched — actions below are applied.
          </p>
        )}
        {result.shown.map(f => <StatusChip key={`s-${f}`} label={f} tone="shown" text="shown" />)}
        {result.hidden.map(f => <StatusChip key={`h-${f}`} label={f} tone="hidden" text="hidden" />)}
        {result.required.map(f => <StatusChip key={`r-${f}`} label={f} tone="required" text="required" />)}
        {Object.entries(result.auto_select).map(([k, v]) => (
          <StatusChip key={`a-${k}`} label={k} tone="shown" text={`auto-set to "${String(v)}"`} />
        ))}
        {result.warnings.map((w, i) => (
          <div key={`w-${i}`} className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
          </div>
        ))}
        {result.errors.map((e, i) => (
          <div key={`e-${i}`} className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t px-3 py-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Shown / Active</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Required</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-400" /> Hidden / Disabled</span>
      </div>
    </div>
  )
}

function StatusChip({ label, tone, text }: { label: string; tone: 'shown' | 'hidden' | 'required'; text: string }) {
  const toneClasses = {
    shown: 'bg-emerald-50 text-emerald-700',
    hidden: 'bg-gray-100 text-gray-600',
    required: 'bg-blue-50 text-blue-700',
  }[tone]
  return (
    <div className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs', toneClasses)}>
      <span className="font-semibold">{label}</span> {text}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export function RuleBuilder({ productId }: Props) {
  const qc = useQueryClient()
  const attrKey = ['product-config-attributes', productId]
  const rulesKey = ['product-config-rules', productId]

  const { data: attrData } = useQuery({
    queryKey: attrKey,
    queryFn: () => vendorApi.productListConfigAttributes(productId),
  })
  const attributes = useMemo(() => flattenAttributes(attrData?.items ?? []), [attrData])

  const exampleTryHint = useMemo(() => {
    const usable = attributes.filter(a => a.options.length > 0)
    if (usable.length < 2) {
      return 'No rules yet. Add two or more product choices to build IF/THEN examples from your config.'
    }
    const [a, b] = usable
    const aOpt = a.options[0]
    const bOpt = b.options[0]
    if (!aOpt || !bOpt) {
      return 'No rules yet. Create an IF/THEN rule from your product choices.'
    }
    return `No rules yet. Try: “If ${a.display_name} = ${aOpt.display_name} then hide ${bOpt.display_name}”.`
  }, [attributes])

  const { data: rulesData, isLoading } = useQuery({
    queryKey: rulesKey,
    queryFn: () => vendorApi.productListConfigRules(productId),
  })
  const rules = rulesData?.items ?? []

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<ConfigRule | null>(null)

  const startNewRule = () => {
    const blank: ConfigRule = {
      id: 'new',
      product_id: productId,
      name: '',
      description: '',
      priority: rules.length,
      execution_mode: 'always',
      conditions: emptyGroup(),
      actions: [],
      is_active: true,
      version_number: 1,
    }
    setDraft(blank)
    setEditingId('new')
  }

  const startEdit = (rule: ConfigRule) => {
    setDraft(JSON.parse(JSON.stringify(rule)))
    setEditingId(rule.id)
  }

  const cancelEdit = () => { setEditingId(null); setDraft(null) }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) return
      if (editingId === 'new') {
        return vendorApi.productCreateConfigRule(productId, {
          name: draft.name, description: draft.description || undefined,
          priority: draft.priority, execution_mode: draft.execution_mode,
          conditions: draft.conditions, actions: draft.actions, is_active: draft.is_active,
        })
      }
      return vendorApi.productUpdateConfigRule(productId, draft.id, {
        name: draft.name, description: draft.description || undefined,
        priority: draft.priority, execution_mode: draft.execution_mode,
        conditions: draft.conditions, actions: draft.actions, is_active: draft.is_active,
        version_number: draft.version_number,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rulesKey })
      toast.success(editingId === 'new' ? 'Rule created' : 'Rule saved')
      cancelEdit()
    },
    onError: () => toast.error('Could not save rule — please check the conditions and try again'),
  })

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => vendorApi.productDeleteConfigRule(productId, ruleId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: rulesKey }); toast.success('Rule deleted') },
    onError: () => toast.error('Could not delete rule'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ rule, is_active }: { rule: ConfigRule; is_active: boolean }) =>
      vendorApi.productUpdateConfigRule(productId, rule.id, { is_active, version_number: rule.version_number }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rulesKey }),
    onError: () => toast.error('Could not update rule'),
  })

  const validateDraft = (): string[] => {
    if (!draft) return []
    const issues: string[] = []
    if (!draft.name.trim()) issues.push('Give this rule a name so your team can recognize it later.')
    const checkConditions = (node: RuleCondition) => {
      if (isGroup(node)) {
        if (node.children.length === 0) issues.push('A condition group is empty — add a condition or remove the group.')
        node.children.forEach(checkConditions)
      } else if ('attribute' in node) {
        if (!node.attribute) issues.push('A condition is missing an attribute.')
        if (node.value === '' || node.value === undefined) issues.push(`Condition on "${node.attribute || 'attribute'}" needs a value.`)
      }
    }
    checkConditions(draft.conditions)
    if (draft.actions.length === 0) issues.push('Add at least one THEN action, otherwise this rule does nothing.')
    draft.actions.forEach((a, i) => {
      const needsTarget = a.type !== 'warning' && a.type !== 'error' && a.type !== 'prevent_save'
      if (needsTarget && !a.target) issues.push(`Action #${i + 1} (${ACTION_LABELS[a.type]}) needs a target field.`)
    })
    return issues
  }

  const handleValidate = () => {
    const issues = validateDraft()
    if (issues.length === 0) toast.success('This rule looks good — no issues found.')
    else issues.slice(0, 3).forEach(issue => toast.warning(issue))
  }

  if (isLoading) return <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>

  if (editingId && draft) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{editingId === 'new' ? 'New rule' : 'Edit rule'}</p>
            <p className="text-xs text-muted-foreground">Build conditional logic with no code — describe what should happen, in plain language.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleValidate}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Validate rule
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={cancelEdit}>Cancel</Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!draft.name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save rule'}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <div className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Rule name</label>
                <Input
                  className="h-8 text-xs"
                  placeholder='e.g. "Show cooling for high voltage"'
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  When multiple rules apply <span className="text-muted-foreground/70">(runs actions)</span>
                </label>
                <Select
                  className="h-8 text-xs"
                  value={draft.execution_mode}
                  onChange={v => setDraft({ ...draft, execution_mode: v as RuleExecutionMode })}
                  options={[
                    { value: 'always', label: 'Always — re-apply while true' },
                    { value: 'first_match', label: 'Once — only on first match' },
                  ]}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Description (optional)</label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Explain why this rule exists, for teammates editing it later"
                  value={draft.description || ''}
                  onChange={e => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <Badge className="bg-blue-600">IF</Badge>
                <p className="text-xs text-muted-foreground">All of the following conditions are met</p>
              </div>
              <ConditionGroupEditor
                group={isGroup(draft.conditions) ? draft.conditions : emptyGroup()}
                depth={0}
                attributes={attributes}
                onChange={g => setDraft({ ...draft, conditions: g })}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-violet-600">THEN</Badge>
                  <p className="text-xs text-muted-foreground">Perform the following actions</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, actions: [...draft.actions, { type: 'show_field' }] })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add action
                </button>
              </div>
              <div className="space-y-1.5">
                {draft.actions.length === 0 && (
                  <p className="rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                    No actions yet — add what should happen when the conditions above are true.
                  </p>
                )}
                {draft.actions.map((action, idx) => (
                  <ActionRow
                    key={idx}
                    action={action}
                    index={idx}
                    attributes={attributes}
                    onChange={next => setDraft({ ...draft, actions: draft.actions.map((a, i) => (i === idx ? next : a)) })}
                    onRemove={() => setDraft({ ...draft, actions: draft.actions.filter((_, i) => i !== idx) })}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">In plain English: </span>
              If {describeCondition(draft.conditions).toLowerCase() || 'always'}, then{' '}
              {draft.actions.length
                ? draft.actions.map(a => `${ACTION_LABELS[a.type].toLowerCase()}${a.target ? ` ${a.target}` : ''}`).join(', ')
                : 'nothing happens yet'}.
            </div>
          </div>

          <div className="lg:col-span-1">
            <LiveEvaluationPanel rule={draft} attributes={attributes} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Create IF/THEN rules to control what buyers see as they configure this product — no SQL, no code.
        </p>
        <Button size="sm" className="h-8 shrink-0 text-xs" onClick={startNewRule}>
          <Plus className="h-3.5 w-3.5" /> New rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center">
          <Layers className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{exampleTryHint}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className={cn('rounded-lg border bg-card p-3', !rule.is_active && 'opacity-60')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{rule.name}</p>
                    {rule.execution_mode === 'first_match' && <Badge variant="soft" className="text-[10px]">Once</Badge>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="font-medium text-blue-600">IF</span> {describeCondition(rule.conditions)}
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span className="font-medium text-violet-600">THEN</span>{' '}
                    {rule.actions.map(a => ACTION_LABELS[a.type]).join(', ') || 'no actions'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={checked => toggleActiveMutation.mutate({ rule, is_active: checked })}
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startEdit(rule)}>Edit</Button>
                  <button
                    type="button"
                    className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                    onClick={() => deleteMutation.mutate(rule.id)}
                    title="Delete rule"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
