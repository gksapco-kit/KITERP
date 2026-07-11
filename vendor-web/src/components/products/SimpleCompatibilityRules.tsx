import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Eye, EyeOff, Info, Link2, Loader2, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { ConfigAttribute, ConfigRule, RuleAction, RuleConditionGroup } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { toast } from 'sonner'
import { flattenAttributes } from '@/lib/productConfigTree'
import { RuleBuilder } from '@/components/products/RuleBuilder'
import { BusinessFrontProductMock, ruleHighlightColor, type PreviewCompatRule } from '@/components/products/BusinessFrontProductMock'
import { cn } from '@/lib/utils'
import { MAX_VARIANT_COMBINATIONS, isOverComboLimit } from '@/lib/variantOptionTypes'
import {
  configRulesToPreviewCompat,
  estimateEffectiveCombinations,
  countCombinationsRemovedByRule,
} from '@/lib/variantComboEstimate'

interface Props {
  productId: string
  onBack: () => void
  onContinue: () => void
  onSkip: () => void
}

type SimpleRuleKind = 'show_choice' | 'hide_choice' | 'hide_value'

interface DraftRule {
  id: string
  kind: SimpleRuleKind
  whenAttr: string
  whenValue: string
  targetAttr: string
  targetValue?: string
}

interface QuickPreset {
  id: string
  label: string
  shortLabel: string
  plainHelp: string
  kind: SimpleRuleKind
  whenAttr: string
  whenValue: string
  targetAttr: string
  targetValue?: string
}

const KIND_CARDS: {
  value: SimpleRuleKind
  label: string
  plain: string
  icon: typeof EyeOff
}[] = [
  {
    value: 'hide_value',
    label: 'Hide one value',
    plain: 'e.g. hide Red when Size is XL',
    icon: EyeOff,
  },
  {
    value: 'hide_choice',
    label: 'Hide a whole option',
    plain: 'e.g. hide Color for one Size',
    icon: EyeOff,
  },
  {
    value: 'show_choice',
    label: 'Show an option later',
    plain: 'e.g. show Storage only after Color',
    icon: Eye,
  },
]

let _id = 0
const newDraft = (seed?: Partial<DraftRule>): DraftRule => ({
  id: `d_${++_id}`,
  kind: 'hide_value',
  whenAttr: '',
  whenValue: '',
  targetAttr: '',
  ...seed,
})

/** Two clear starters: Hide or Show — details are edited after. */
function buildQuickPresets(attributes: ConfigAttribute[]): QuickPreset[] {
  const usable = attributes.filter(a => a.options.length > 0)
  if (usable.length < 2) return []

  const [a, b] = usable
  const aOpt = a.options[0]
  const bOpt = b.options[0]
  if (!aOpt || !bOpt) return []

  return [
    {
      id: 'hide-something',
      label: `Hide ${bOpt.display_name} when ${a.display_name} is ${aOpt.display_name}`,
      shortLabel: `Hide ${bOpt.display_name} when ${a.display_name} is ${aOpt.display_name}`,
      plainHelp: `If someone picks ${aOpt.display_name}, ${bOpt.display_name} is not offered.`,
      kind: 'hide_value',
      whenAttr: a.name,
      whenValue: aOpt.name,
      targetAttr: b.name,
      targetValue: bOpt.name,
    },
    {
      id: 'show-later',
      label: `Show ${b.display_name} when ${a.display_name} is ${aOpt.display_name}`,
      shortLabel: `Show ${b.display_name} when ${a.display_name} is ${aOpt.display_name}`,
      plainHelp: `${b.display_name} stays hidden until ${aOpt.display_name} is chosen.`,
      kind: 'show_choice',
      whenAttr: a.name,
      whenValue: aOpt.name,
      targetAttr: b.name,
    },
  ]
}

function draftToApiRule(draft: DraftRule, attributes: ConfigAttribute[], priority: number): {
  name: string
  conditions: RuleConditionGroup
  actions: RuleAction[]
} | null {
  const when = attributes.find(a => a.name === draft.whenAttr)
  const target = attributes.find(a => a.name === draft.targetAttr)
  if (!when || !target || !draft.whenValue) return null

  const whenOpt = when.options.find(o => o.name === draft.whenValue)
  const whenLabel = whenOpt?.display_name ?? draft.whenValue

  const conditions: RuleConditionGroup = {
    op: 'AND',
    children: [{ attribute: draft.whenAttr, operator: 'equals', value: draft.whenValue }],
  }

  if (draft.kind === 'show_choice') {
    return {
      name: `Show ${target.display_name} when ${when.display_name} is ${whenLabel}`,
      conditions,
      actions: [{ type: 'show_field', target: draft.targetAttr }],
    }
  }
  if (draft.kind === 'hide_choice') {
    return {
      name: `Hide ${target.display_name} when ${when.display_name} is ${whenLabel}`,
      conditions,
      actions: [{ type: 'hide_field', target: draft.targetAttr }],
    }
  }
  if (draft.kind === 'hide_value' && draft.targetValue) {
    const targetOpt = target.options.find(o => o.name === draft.targetValue)
    const targetLabel = targetOpt?.display_name ?? draft.targetValue
    return {
      name: `Hide ${targetLabel} when ${when.display_name} is ${whenLabel}`,
      conditions,
      actions: [{ type: 'disable_option', target: `${draft.targetAttr}:${draft.targetValue}` }],
    }
  }
  return null
}

function ruleSummary(rule: ConfigRule, attributes: ConfigAttribute[]): string {
  const attrLabel = (name: string) => attributes.find(a => a.name === name)?.display_name ?? name
  const action = rule.actions[0]
  if (!action) return rule.name
  const [attrPart, optPart] = (action.target ?? '').split(':')
  if (action.type === 'show_field') return `Show "${attrLabel(attrPart)}" under certain conditions`
  if (action.type === 'hide_field') return `Hide "${attrLabel(attrPart)}" under certain conditions`
  if (action.type === 'disable_option') {
    const opt = attributes.find(a => a.name === attrPart)?.options.find(o => o.name === optPart)
    return `Hide value "${opt?.display_name ?? optPart}" under certain conditions`
  }
  return rule.name
}

function draftPlainSentence(draft: DraftRule, attributes: ConfigAttribute[]): string {
  const when = attributes.find(a => a.name === draft.whenAttr)
  const target = attributes.find(a => a.name === draft.targetAttr)
  const whenVal = when?.options.find(o => o.name === draft.whenValue)?.display_name
  const targetVal = target?.options.find(o => o.name === draft.targetValue)?.display_name

  if (!when || !whenVal || !target) return 'Pick the choices below to finish this rule.'

  if (draft.kind === 'hide_value') {
    if (!targetVal) return `When ${when.display_name} is ${whenVal}, hide a value in ${target.display_name}…`
    return `When ${when.display_name} is ${whenVal}, hide ${targetVal}.`
  }
  if (draft.kind === 'hide_choice') {
    return `When ${when.display_name} is ${whenVal}, hide ${target.display_name}.`
  }
  return `When ${when.display_name} is ${whenVal}, show ${target.display_name}.`
}

function isDraftComplete(d: DraftRule): boolean {
  if (!d.whenAttr || !d.whenValue || !d.targetAttr) return false
  if (d.kind === 'hide_value' && !d.targetValue) return false
  return true
}

export function SimpleCompatibilityRules({ productId, onBack, onContinue, onSkip }: Props) {
  const qc = useQueryClient()
  const attrKey = ['product-config-attributes', productId]
  const rulesKey = ['product-config-rules', productId]
  const [drafts, setDrafts] = useState<DraftRule[]>([])
  const [showExpert, setShowExpert] = useState(false)
  const [triggeredRuleIds, setTriggeredRuleIds] = useState<string[]>([])
  const onTriggeredRuleIdsChange = useMemo(
    () => (ids: string[]) => {
      setTriggeredRuleIds(prev => {
        if (prev.length === ids.length && prev.every((id, i) => id === ids[i])) return prev
        return ids
      })
    },
    [],
  )

  const { data: attrData, isLoading: attrsLoading } = useQuery({
    queryKey: attrKey,
    queryFn: () => vendorApi.productListConfigAttributes(productId),
  })
  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: rulesKey,
    queryFn: () => vendorApi.productListConfigRules(productId),
  })

  const attributes = useMemo(() => flattenAttributes(attrData?.items ?? []), [attrData])
  const roots = useMemo(() => attrData?.items ?? [], [attrData])
  const rules = rulesData?.items ?? []
  const attrsWithOptions = attributes.filter(a => a.options.length > 0)
  const quickPresets = useMemo(() => buildQuickPresets(attributes), [attributes])

  const exampleHint = useMemo(() => {
    const preferred =
      quickPresets.find(p => p.kind === 'hide_value')
      ?? quickPresets.find(p => p.kind === 'hide_choice')
      ?? quickPresets[0]
    if (!preferred) {
      return 'Most products can skip this. Add two or more choices first if you need rules.'
    }
    return `Most products can skip this. Example: ${preferred.label}.`
  }, [quickPresets])

  const saveDraftsMutation = useMutation({
    mutationFn: async () => {
      const existingNames = new Set(rules.map(r => r.name))
      let priority = rules.length
      for (const draft of drafts) {
        const payload = draftToApiRule(draft, attributes, priority)
        if (!payload || existingNames.has(payload.name)) continue
        await vendorApi.productCreateConfigRule(productId, {
          ...payload,
          priority,
          execution_mode: 'always',
          is_active: true,
        })
        existingNames.add(payload.name)
        priority += 1
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rulesKey })
      setDrafts([])
      toast.success('Compatibility rules saved')
      onContinue()
    },
    onError: () => toast.error('Could not save rules — check your selections'),
  })

  const saveOneDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const draft = drafts.find(d => d.id === draftId)
      if (!draft) throw new Error('Draft not found')
      const priority = rules.length + drafts.findIndex(d => d.id === draftId)
      const payload = draftToApiRule(draft, attributes, Math.max(0, priority))
      if (!payload) throw new Error('incomplete')
      if (rules.some(r => r.name === payload.name)) throw new Error('duplicate')
      await vendorApi.productCreateConfigRule(productId, {
        ...payload,
        priority: Math.max(0, priority),
        execution_mode: 'always',
        is_active: true,
      })
      return draftId
    },
    onSuccess: (draftId) => {
      qc.invalidateQueries({ queryKey: rulesKey })
      setDrafts(prev => prev.filter(d => d.id !== draftId))
      toast.success('Rule saved')
    },
    onError: (err: Error) => {
      if (err.message === 'incomplete') toast.error('Finish the rule selections before saving')
      else if (err.message === 'duplicate') toast.error('A similar rule already exists')
      else toast.error('Could not save rule — check your selections')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => vendorApi.productDeleteConfigRule(productId, ruleId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: rulesKey }); toast.success('Rule removed') },
    onError: () => toast.error('Could not remove rule'),
  })

  const applyPreset = (preset: QuickPreset) => {
    setDrafts(prev => {
      const duplicate = prev.some(d =>
        d.kind === preset.kind
        && d.whenAttr === preset.whenAttr
        && d.whenValue === preset.whenValue
        && d.targetAttr === preset.targetAttr
        && d.targetValue === preset.targetValue,
      )
      if (duplicate) {
        toast.info('That example is already added — edit it below')
        return prev
      }
      toast.success('Example added — tweak it below if needed')
      return [...prev, newDraft({
        kind: preset.kind,
        whenAttr: preset.whenAttr,
        whenValue: preset.whenValue,
        targetAttr: preset.targetAttr,
        targetValue: preset.targetValue,
      })]
    })
  }

  const addBlankDraft = () => {
    const a = attrsWithOptions[0]
    const b = attrsWithOptions[1] ?? attrsWithOptions[0]
    setDrafts(prev => [...prev, newDraft({
      whenAttr: a?.name ?? '',
      whenValue: a?.options[0]?.name ?? '',
      targetAttr: b?.name ?? '',
      targetValue: b?.options[0]?.name,
    })])
  }

  const updateDraft = (id: string, patch: Partial<DraftRule>) =>
    setDrafts(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)))

  const removeDraft = (id: string) => setDrafts(prev => prev.filter(d => d.id !== id))

  const validDrafts = drafts.filter(isDraftComplete)
  const needsMultipleChoices = roots.length < 2
  const previewRules = useMemo<PreviewCompatRule[]>(
    () => drafts.map(d => ({
      id: d.id,
      label: draftPlainSentence(d, attributes),
      kind: d.kind,
      whenAttr: d.whenAttr,
      whenValue: d.whenValue,
      targetAttr: d.targetAttr,
      targetValue: d.targetValue,
    })),
    [drafts, attributes],
  )
  const comboBreakdown = useMemo(() => {
    const savedPreview = configRulesToPreviewCompat(rules)
    return estimateEffectiveCombinations(roots, [...savedPreview, ...previewRules])
  }, [roots, rules, previewRules])
  const comboEstimate = comboBreakdown.effective
  const overComboLimit = isOverComboLimit(comboEstimate)

  const savedPreviewRules = useMemo(() => configRulesToPreviewCompat(rules), [rules])
  const ruleImpactById = useMemo(() => {
    const map = new Map<string, number>()
    for (const preview of savedPreviewRules) {
      if (!preview.id) continue
      map.set(preview.id, countCombinationsRemovedByRule(attributes, savedPreviewRules, preview.id))
    }
    return map
  }, [attributes, savedPreviewRules])

  if (attrsLoading || rulesLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  }

  if (showExpert) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Advanced compatibility rules</h2>
            <p className="text-sm text-muted-foreground">Full IF/THEN editor — for complex logic only.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowExpert(false)}>
            Back to simple rules
          </Button>
        </div>
        <RuleBuilder productId={productId} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Does one choice affect another?</h2>
        <p className="mt-1 text-sm text-muted-foreground">{exampleHint}</p>
        {!needsMultipleChoices && drafts.length === 0 && rules.length === 0 && (
          <p className="mt-1.5 text-xs font-medium text-primary">
            Tip: start with a ready example below — you can edit it after. Preview updates on the right.
          </p>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <div className="min-w-0 space-y-4">
      {overComboLimit && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{comboEstimate.toLocaleString('en-IN')}</strong> combinations exceeds the max of{' '}
            <strong>{MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')}</strong> per product.
            Go back and remove option values before creating variants.
          </span>
        </div>
      )}
      {needsMultipleChoices && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Go back and add at least two product choices (e.g. Size and Color) before setting rules.</span>
        </div>
      )}

      {!needsMultipleChoices && (
        <>
          {quickPresets.length > 0 && drafts.length === 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Start with an example
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {quickPresets.map(p => {
                  const Icon = p.kind === 'show_choice' ? Eye : EyeOff
                  return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={cn(
                      'rounded-lg border bg-card px-3 py-2.5 text-left transition-colors',
                      'hover:border-primary/50 hover:bg-primary/5',
                    )}
                  >
                    <span className="flex items-start gap-2 text-sm font-semibold leading-snug text-foreground">
                      <Icon
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          p.kind === 'show_choice' ? 'text-emerald-600' : 'text-amber-600',
                        )}
                        aria-hidden
                      />
                      <span>{p.shortLabel}</span>
                    </span>
                    <span className="mt-1 block pl-6 text-[11px] leading-snug text-muted-foreground">{p.plainHelp}</span>
                  </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  Need complex logic?{' '}
                  <button type="button" onClick={() => setShowExpert(true)} className="font-medium text-primary hover:underline">
                    Open advanced rule editor
                  </button>
                </p>
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Skip — all combinations are fine
                </button>
              </div>
            </div>
          )}

          {drafts.map((draft, index) => {
            const whenAttr = attributes.find(a => a.name === draft.whenAttr)
            const targetAttr = attributes.find(a => a.name === draft.targetAttr)
            const complete = isDraftComplete(draft)
            const sentence = draftPlainSentence(draft, attributes)
            const isTriggered = triggeredRuleIds.includes(draft.id)
            const highlight = ruleHighlightColor(index)

            return (
              <div
                key={draft.id}
                className={cn(
                  'space-y-3 rounded-lg border bg-card p-3 shadow-sm transition-shadow',
                  isTriggered && 'ring-2',
                )}
                style={isTriggered ? {
                  borderColor: highlight.border,
                  boxShadow: `0 0 0 1px ${highlight.ring}`,
                } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: highlight.border }}
                        title={`Rule ${index + 1} color`}
                      />
                      Rule {index + 1}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {complete ? 'ready to save' : 'almost ready'}
                      </span>
                      {isTriggered && (
                        <span
                          className="rounded-full px-1.5 py-px text-[10px] font-semibold"
                          style={{ backgroundColor: highlight.bg, color: highlight.text }}
                        >
                          Active on preview combo
                        </span>
                      )}
                    </p>
                    <p className={cn(
                      'mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px]',
                      isTriggered
                        ? ''
                        : complete ? 'bg-emerald-50 text-emerald-800' : 'bg-muted text-muted-foreground',
                    )}
                      style={isTriggered ? { backgroundColor: highlight.bg, color: highlight.text } : undefined}
                    >
                      {complete && <Check className="h-3 w-3 shrink-0" />}
                      <span className="truncate">{sentence}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      disabled={!complete || saveOneDraftMutation.isPending}
                      onClick={() => saveOneDraftMutation.mutate(draft.id)}
                      className="rounded p-1 text-muted-foreground hover:text-emerald-600 disabled:pointer-events-none disabled:opacity-40"
                      title={complete ? 'Save rule' : 'Finish selections to save'}
                    >
                      {saveOneDraftMutation.isPending && saveOneDraftMutation.variables === draft.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Save className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => removeDraft(draft.id)} className="rounded p-1 text-muted-foreground hover:text-red-500" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">What should happen?</p>
                  <div className="grid gap-1.5 sm:grid-cols-3">
                    {KIND_CARDS.map(k => {
                      const Icon = k.icon
                      const selected = draft.kind === k.value
                      return (
                        <button
                          key={k.value}
                          type="button"
                          onClick={() => updateDraft(draft.id, { kind: k.value, targetValue: k.value === 'hide_value' ? draft.targetValue : undefined })}
                          className={cn(
                            'rounded-md border px-2 py-2 text-left transition-colors',
                            selected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                              : 'hover:border-primary/30 hover:bg-muted/40',
                          )}
                        >
                          <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
                            <Icon className="h-3 w-3 shrink-0 text-primary" />
                            {k.label}
                          </span>
                          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{k.plain}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sentence-style builder */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-2 text-sm">
                  <span className="text-muted-foreground">When</span>
                  <Select
                    className="h-8 min-w-[7rem] flex-1 text-sm sm:flex-none"
                    value={draft.whenAttr}
                    onChange={v => updateDraft(draft.id, { whenAttr: v, whenValue: '' })}
                    options={attrsWithOptions.map(a => ({ value: a.name, label: a.display_name }))}
                  />
                  <span className="text-muted-foreground">is</span>
                  <Select
                    className="h-8 min-w-[7rem] flex-1 text-sm sm:flex-none"
                    value={draft.whenValue}
                    onChange={v => updateDraft(draft.id, { whenValue: v })}
                    options={[
                      { value: '', label: 'Pick…' },
                      ...(whenAttr?.options ?? []).map(o => ({ value: o.name, label: o.display_name })),
                    ]}
                  />
                  <span className="text-muted-foreground">
                    {draft.kind === 'show_choice' ? 'show' : 'hide'}
                  </span>
                  {draft.kind === 'hide_value' ? (
                    <>
                      <Select
                        className="h-8 min-w-[7rem] flex-1 text-sm sm:flex-none"
                        value={draft.targetValue ?? ''}
                        onChange={v => updateDraft(draft.id, { targetValue: v })}
                        options={[
                          { value: '', label: 'Pick value…' },
                          ...(targetAttr?.options ?? []).map(o => ({ value: o.name, label: o.display_name })),
                        ]}
                      />
                      <span className="text-muted-foreground">in</span>
                      <Select
                        className="h-8 min-w-[7rem] flex-1 text-sm sm:flex-none"
                        value={draft.targetAttr}
                        onChange={v => updateDraft(draft.id, { targetAttr: v, targetValue: undefined })}
                        options={attributes
                          .filter(a => a.name !== draft.whenAttr)
                          .map(a => ({ value: a.name, label: a.display_name }))}
                      />
                    </>
                  ) : (
                    <Select
                      className="h-8 min-w-[7rem] flex-1 text-sm sm:flex-none"
                      value={draft.targetAttr}
                      onChange={v => updateDraft(draft.id, { targetAttr: v, targetValue: undefined })}
                      options={attributes
                        .filter(a => a.name !== draft.whenAttr)
                        .map(a => ({ value: a.name, label: a.display_name }))}
                    />
                  )}
                </div>
              </div>
            )
          })}

          {drafts.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={addBlankDraft}>
                <Plus className="h-3.5 w-3.5" /> Add another rule
              </Button>
              {quickPresets.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const unused = quickPresets.find(p => !drafts.some(d =>
                      d.kind === p.kind && d.whenAttr === p.whenAttr && d.whenValue === p.whenValue
                      && d.targetAttr === p.targetAttr && d.targetValue === p.targetValue,
                    ))
                    if (unused) applyPreset(unused)
                    else toast.info('All ready examples are already added')
                  }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  + Add another example
                </button>
              )}
            </div>
          )}
        </>
      )}

      {rules.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Already saved</p>
          {rules.map(rule => {
            const blocked = ruleImpactById.get(rule.id) ?? 0
            return (
              <div key={rule.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{ruleSummary(rule, attributes)}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums',
                    blocked > 0
                      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80'
                      : 'bg-muted text-muted-foreground',
                  )}
                  title={
                    blocked > 0
                      ? `This rule removes ${blocked.toLocaleString('en-IN')} variant combination${blocked === 1 ? '' : 's'}`
                      : 'This rule does not change the combination count yet'
                  }
                >
                  {blocked > 0
                    ? `−${blocked.toLocaleString('en-IN')} variant${blocked === 1 ? '' : 's'}`
                    : '0 variants'}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                  onClick={() => deleteMutation.mutate(rule.id)}
                  title="Remove rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
        </div>

        <BusinessFrontProductMock
          productId={productId}
          attributes={attributes}
          comboEstimate={comboEstimate}
          previewRules={previewRules}
          onTriggeredRuleIdsChange={onTriggeredRuleIdsChange}
        />
      </div>

      <div className="sticky bottom-0 z-10 mt-2 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {(drafts.length > 0 || quickPresets.length === 0) && (
            <button
              type="button"
              onClick={() => setShowExpert(true)}
              className="text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
            >
              Open advanced rule editor
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={onSkip} disabled={overComboLimit}>
            Skip — all combinations OK
          </Button>
          {overComboLimit ? (
            <Button size="sm" disabled title={`Max ${MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')} combinations`}>
              Reduce options to continue
            </Button>
          ) : validDrafts.length > 0 ? (
            <Button
              size="sm"
              disabled={saveDraftsMutation.isPending}
              onClick={() => saveDraftsMutation.mutate()}
            >
              {saveDraftsMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Link2 className="h-4 w-4" />}
              Save {validDrafts.length} rule{validDrafts.length === 1 ? '' : 's'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : drafts.length > 0 ? (
            <Button size="sm" disabled title="Finish the rule above first">
              Finish rule to save
            </Button>
          ) : (
            <Button size="sm" onClick={onContinue}>
              Continue
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
