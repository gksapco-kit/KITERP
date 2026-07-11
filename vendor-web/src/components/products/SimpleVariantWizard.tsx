import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowRight, Info, Loader2, Plus, Sparkles, Trash2, X,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { ConfigAttribute, ConfigInputType } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { slugifyAttributeName } from '@/lib/productConfigTree'
import {
  allOptionsHaveValues,
  getVariantOptionType,
  getVariantOptionTypeForAttribute,
  optionsMissingValues,
  MAX_VARIANT_COMBINATIONS,
  isOverComboLimit,
} from '@/lib/variantOptionTypes'
import {
  estimateEffectiveCombinations,
  estimateCombinationsWithExtraOptionAware,
  configRulesToPreviewCompat,
} from '@/lib/variantComboEstimate'
import { COLOUR_PALETTE, suggestColourName } from '@/lib/productVariantPresets'
import {
  COLOR_SHOW_PART_OPTIONS,
  getColorShowParts,
  toggleColorShowPart,
  withColorShowParts,
  type ColorShowPart,
  type ColorShowParts,
} from '@/lib/colorAppearance'
import { VariantOptionTypeCombobox } from '@/components/products/VariantOptionTypeCombobox'
import {
  VariantSetupEntry, WizardStepIndicator, VARIANT_SETUP_TEMPLATES, type VariantSetupTemplate,
} from '@/components/products/VariantSetupEntry'
import { VariantManagementPanel } from '@/components/products/VariantManagementPanel'
import { SimpleCompatibilityRules } from '@/components/products/SimpleCompatibilityRules'
import { BusinessFrontProductMock } from '@/components/products/BusinessFrontProductMock'

interface Props {
  productId: string
  onDone: () => void
  /** When true, open directly on Prices & stock (e.g. from product form with existing variants). */
  preferManageView?: boolean
  onManageViewChange?: (isManageView: boolean) => void
  onEditSetupChange?: (isEditSetup: boolean) => void
  onHeaderActionsChange?: (actions: VariantWizardHeaderActions | null) => void
  onHeaderStepperChange?: (stepper: VariantWizardHeaderStepper | null) => void
}

export type VariantWizardHeaderActions = {
  showEditVariantOptions: boolean
  onEditVariantOptions: () => void
  editVariantOptionsLabel?: string
  showDone?: boolean
  onDone?: () => void
  doneLabel?: string
}

export type VariantWizardHeaderStepper = {
  steps: { id: string; label: string; hint: string }[]
  current: number
  onStepClick?: (index: number) => void
  canClickStep?: (index: number) => boolean
  showLabels?: boolean
  compact?: boolean
}

const WIZARD_STEPS = [
  { id: 'options', label: 'Product choices', hint: 'What customers pick' },
  { id: 'compatibility', label: 'Compatibility', hint: 'Optional — skip if not needed' },
  { id: 'create', label: 'Create variants', hint: 'Generate combinations' },
  { id: 'prices', label: 'Prices & stock', hint: 'Set pricing' },
]

const SETUP_STEPS = WIZARD_STEPS.slice(0, 3)

function WizardStepNav({
  onBack,
  backLabel = 'Back',
  onContinue,
  continueLabel = 'Continue',
  continueDisabled,
  children,
}: {
  onBack?: () => void
  backLabel?: string
  onContinue?: () => void
  continueLabel?: string
  continueDisabled?: boolean
  children?: ReactNode
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {onBack ? (
        <Button variant="outline" size="sm" onClick={onBack}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {onContinue && (
          <Button size="sm" disabled={continueDisabled} onClick={onContinue}>
            {continueLabel}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}


export function SimpleVariantWizard({
  productId, onDone, preferManageView, onManageViewChange, onEditSetupChange,
  onHeaderActionsChange, onHeaderStepperChange,
}: Props) {
  const [searchParams] = useSearchParams()
  const wantManageFromUrl = searchParams.get('view') === 'manage'
  const isFromCreate = searchParams.get('from') === 'create'
  const preferManage = preferManageView ?? wantManageFromUrl
  const qc = useQueryClient()
  const attrKey = ['product-config-attributes', productId]
  const variantKey = ['product-variants', productId]

  const { data: attrData, isLoading: attrsLoading } = useQuery({
    queryKey: attrKey,
    queryFn: () => vendorApi.productListConfigAttributes(productId),
  })
  const { data: variantData, isLoading: variantsLoading } = useQuery({
    queryKey: variantKey,
    queryFn: () => vendorApi.productListVariants(productId),
  })
  const rulesKey = ['product-config-rules', productId]
  const { data: rulesData } = useQuery({
    queryKey: rulesKey,
    queryFn: () => vendorApi.productListConfigRules(productId),
  })

  const roots = useMemo(() => attrData?.items ?? [], [attrData])
  const savedRules = useMemo(() => rulesData?.items ?? [], [rulesData])
  const variantCount = variantData?.items?.length ?? 0
  const comboBreakdown = useMemo(
    () => estimateEffectiveCombinations(roots, savedRules),
    [roots, savedRules],
  )
  const comboEstimate = comboBreakdown.effective
  const rawComboEstimate = comboBreakdown.raw

  const [showEntry, setShowEntry] = useState<boolean | null>(null)
  const [step, setStep] = useState<number | null>(null)
  const [createdBanner, setCreatedBanner] = useState(false)
  const [wizardReady, setWizardReady] = useState(false)
  const [editSetupMode, setEditSetupMode] = useState(false)
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null)

  useEffect(() => {
    if (attrsLoading || variantsLoading || wizardReady) return

    const hasVariants = variantCount > 0
    // Only skip to manage when explicitly requested, or variants were generated from config options.
    const shouldManage = preferManage
      ? hasVariants
      : hasVariants && roots.length > 0

    if (shouldManage) {
      setShowEntry(false)
      setStep(3)
    } else if (roots.length === 0) {
      setShowEntry(true)
      setStep(0)
    } else {
      setShowEntry(false)
      setStep(0)
    }
    setWizardReady(true)
  }, [attrsLoading, variantsLoading, wizardReady, variantCount, roots.length, preferManage])

  const resolvedShowEntry = showEntry ?? (roots.length === 0 && variantCount === 0)
  const resolvedStep = step ?? 0

  const returnToManage = useCallback(() => {
    setEditSetupMode(false)
    setStep(3)
    setCreatedBanner(false)
  }, [])

  const startEditSetup = useCallback(() => {
    setEditSetupMode(true)
    setStep(0)
    setCreatedBanner(false)
  }, [])

  useEffect(() => {
    onManageViewChange?.(resolvedStep === 3 && variantCount > 0 && !editSetupMode)
  }, [resolvedStep, variantCount, editSetupMode, onManageViewChange])

  useEffect(() => {
    onEditSetupChange?.(editSetupMode)
  }, [editSetupMode, onEditSetupChange])

  useEffect(() => {
    const onManageStep = resolvedStep === 3 && !editSetupMode
    if (!onManageStep) {
      onHeaderActionsChange?.(null)
      return
    }
    onHeaderActionsChange?.({
      showEditVariantOptions: true,
      onEditVariantOptions: startEditSetup,
      editVariantOptionsLabel: roots.length > 0 ? 'Edit variant options' : 'Set up product options',
      showDone: true,
      onDone,
      doneLabel: 'Done — back to product',
    })
  }, [resolvedStep, editSetupMode, roots.length, onHeaderActionsChange, startEditSetup, onDone])

  const displaySteps = editSetupMode ? SETUP_STEPS : WIZARD_STEPS
  const displayStepIndex = editSetupMode ? Math.min(resolvedStep, 2) : resolvedStep
  const optionsReady = allOptionsHaveValues(roots)
  /** Manage-only view: hide full wizard stepper until user opens edit setup. */
  const showStepper = editSetupMode || resolvedStep < 3

  useEffect(() => {
    if (!wizardReady || attrsLoading || variantsLoading || !showStepper) {
      onHeaderStepperChange?.(null)
      return
    }
    onHeaderStepperChange?.({
      steps: displaySteps,
      current: displayStepIndex,
      onStepClick: editSetupMode ? idx => setStep(idx) : undefined,
      canClickStep: editSetupMode
        ? idx => idx === 0 || (idx === 1 && optionsReady) || (idx === 2 && optionsReady)
        : undefined,
      showLabels: true,
      compact: true,
    })
  }, [
    wizardReady, attrsLoading, variantsLoading,
    showStepper, displaySteps, displayStepIndex, editSetupMode, optionsReady, onHeaderStepperChange,
  ])

  const applyTemplate = useMutation({
    mutationFn: async (template: VariantSetupTemplate) => {
      if (template.id === 'scratch') return
      for (let i = 0; i < template.options.length; i++) {
        const opt = template.options[i]
        const catalog = getVariantOptionTypeForAttribute(opt.name)
        const attr = await vendorApi.productCreateConfigAttribute(productId, {
          name: catalog?.value ?? slugifyAttributeName(opt.name),
          display_name: opt.name,
          display_order: i,
          is_required: true,
          input_type: catalog?.inputType,
          ...(catalog?.inputType === 'color'
            ? { validation_rule: withColorShowParts(null, { color: true, name: false, hex: false }) }
            : {}),
        })
        for (let j = 0; j < opt.values.length; j++) {
          const val = opt.values[j]
          await vendorApi.productCreateConfigOption(productId, attr.id, {
            name: slugifyAttributeName(val),
            display_name: val,
            sort_order: j,
          })
        }
      }
    },
    onSuccess: (_, template) => {
      qc.invalidateQueries({ queryKey: attrKey })
      setAppliedTemplateId(template.id)
      setShowEntry(false)
      setStep(0)
      toast.success('Template applied — review your options below')
    },
    onError: () => toast.error('Could not apply template'),
  })

  const handleSelectTemplate = (template: VariantSetupTemplate) => {
    if (template.id === 'scratch') {
      setShowEntry(false)
      setStep(0)
      return
    }
    applyTemplate.mutate(template)
  }

  /** After every option type is removed, return to the ready-template picker. */
  const returnToRecommendations = useCallback(() => {
    setShowEntry(true)
    setStep(0)
    setAppliedTemplateId(null)
  }, [])

  if (attrsLoading || variantsLoading || applyTemplate.isPending || !wizardReady) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  }

  if (resolvedShowEntry) {
    return (
      <VariantSetupEntry
        onSelectTemplate={handleSelectTemplate}
        onManageExisting={() => { setShowEntry(false); setStep(3) }}
        hasExistingVariants={variantCount > 0}
      />
    )
  }

  return (
    <div className="space-y-4">
      {createdBanner && resolvedStep === 3 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Sparkles className="h-4 w-4 shrink-0" />
          Variants created successfully — set prices and stock below.
          <button type="button" onClick={() => setCreatedBanner(false)} className="ml-auto rounded p-1 hover:bg-emerald-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {resolvedStep === 0 && (
        <SimpleOptionsStep
          productId={productId}
          roots={roots}
          comboEstimate={comboEstimate}
          rawComboEstimate={rawComboEstimate}
          rulesApplied={comboBreakdown.rulesApplied}
          reducedBy={comboBreakdown.reducedBy}
          editMode={editSetupMode}
          defaultShowPriceAdjustments={['industrial_motor', 'machinery', 'b2b_bulk'].includes(appliedTemplateId ?? '')}
          onBack={editSetupMode ? returnToManage : undefined}
          onContinue={() => setStep(1)}
          onAllOptionsRemoved={returnToRecommendations}
          onBrowseTemplates={returnToRecommendations}
        />
      )}

      {resolvedStep === 1 && (
        <SimpleCompatibilityRules
          productId={productId}
          onBack={() => setStep(0)}
          onContinue={() => setStep(2)}
          onSkip={() => setStep(2)}
        />
      )}

      {resolvedStep === 2 && (
        <CreateVariantsStep
          productId={productId}
          comboEstimate={comboEstimate}
          editMode={editSetupMode}
          onBack={() => setStep(editSetupMode ? 1 : 1)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: variantKey })
            if (editSetupMode) {
              toast.success('Variants updated — review prices & stock')
              returnToManage()
            } else {
              setCreatedBanner(true)
              setStep(3)
            }
          }}
        />
      )}

      {resolvedStep === 3 && !editSetupMode && (
        <div className="space-y-4">
          {roots.length === 0 && !isFromCreate && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Want to generate variants from Size, Color, or other options? Set up product options first.
              </p>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={startEditSetup}>
                Set up product options
              </Button>
            </div>
          )}
          <VariantManagementPanel productId={productId} />
        </div>
      )}
    </div>
  )
}

function SimpleOptionsStep({
  productId, roots, comboEstimate, rawComboEstimate = comboEstimate, rulesApplied = 0, reducedBy = 0,
  onContinue, editMode, onBack, defaultShowPriceAdjustments,
  onAllOptionsRemoved, onBrowseTemplates,
}: {
  productId: string
  roots: ConfigAttribute[]
  comboEstimate: number
  rawComboEstimate?: number
  rulesApplied?: number
  reducedBy?: number
  onContinue: () => void
  editMode?: boolean
  onBack?: () => void
  defaultShowPriceAdjustments?: boolean
  /** Called when the last option type is deleted — show ready templates again. */
  onAllOptionsRemoved?: () => void
  /** From empty state (e.g. Start from scratch) — reopen template picker. */
  onBrowseTemplates?: () => void
}) {
  const qc = useQueryClient()
  const qKey = ['product-config-attributes', productId]
  const rulesKey = ['product-config-rules', productId]
  const { data: rulesData } = useQuery({
    queryKey: rulesKey,
    queryFn: () => vendorApi.productListConfigRules(productId),
  })
  const savedRules = rulesData?.items ?? []
  const [newValueByAttr, setNewValueByAttr] = useState<Record<string, string>>({})
  const [newOptionPrice, setNewOptionPrice] = useState<Record<string, string>>({})
  const [newColorByAttr, setNewColorByAttr] = useState<Record<string, string>>({})
  /** How Color option labels are saved: name only, hex only, or "Name #HEX". */
  const [colorLabelFormat, setColorLabelFormat] = useState<Record<string, 'name' | 'hex' | 'both'>>({})
  const [showPriceAdjustments, setShowPriceAdjustments] = useState(defaultShowPriceAdjustments ?? false)
  /** Once the user hides prices, don't force them open just because deltas exist. */
  const [priceFieldsDismissed, setPriceFieldsDismissed] = useState(false)

  const usedLabels = useMemo(() => roots.map(r => r.display_name), [roots])
  const missingValues = useMemo(() => optionsMissingValues(roots), [roots])
  const overComboLimit = isOverComboLimit(comboEstimate)
  const canContinue = allOptionsHaveValues(roots) && !overComboLimit
  const nextComboIfExtra = (attrId: string) =>
    estimateCombinationsWithExtraOptionAware(roots, attrId, savedRules)
  const hasPriceDeltas = useMemo(
    () => roots.some(r => r.options.some(o => o.price_delta !== 0)),
    [roots],
  )
  const showPriceFields = showPriceAdjustments || (hasPriceDeltas && !priceFieldsDismissed)

  useEffect(() => {
    if (hasPriceDeltas && !priceFieldsDismissed) setShowPriceAdjustments(true)
  }, [hasPriceDeltas, priceFieldsDismissed])

  const guardComboIncrease = (nextCount: number, actionLabel: string): boolean => {
    if (!isOverComboLimit(nextCount)) return true
    toast.error(
      `Max ${MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')} combinations per product. `
      + `${actionLabel} would create ${nextCount.toLocaleString('en-IN')} — remove some values first.`,
    )
    return false
  }

  const createAttribute = useMutation({
    mutationFn: (vars: { displayName: string; slug: string; inputType?: ConfigInputType }) =>
      vendorApi.productCreateConfigAttribute(productId, {
        name: vars.slug,
        display_name: vars.displayName,
        display_order: roots.length,
        is_required: true,
        input_type: vars.inputType,
        ...(vars.inputType === 'color'
          ? { validation_rule: withColorShowParts(null, { color: true, name: false, hex: false }) }
          : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey })
      toast.success('Option added')
    },
    onError: () => toast.error('Could not add option'),
  })

  const updateAttribute = useMutation({
    mutationFn: (vars: {
      id: string
      version: number
      display_name?: string
      validation_rule?: Record<string, unknown> | null
    }) =>
      vendorApi.productUpdateConfigAttribute(productId, vars.id, {
        ...(vars.display_name != null ? { display_name: vars.display_name } : {}),
        ...(vars.validation_rule !== undefined ? { validation_rule: vars.validation_rule } : {}),
        version_number: vars.version,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
    onError: () => toast.error('Could not update option'),
  })

  const setColorAppearance = (attr: ConfigAttribute, parts: ColorShowParts) => {
    updateAttribute.mutate({
      id: attr.id,
      version: attr.version_number,
      validation_rule: withColorShowParts(attr.validation_rule, parts),
    })
  }

  const toggleColorAppearancePart = (attr: ConfigAttribute, part: ColorShowPart) => {
    setColorAppearance(attr, toggleColorShowPart(getColorShowParts(attr), part))
  }

  const deleteAttribute = useMutation({
    mutationFn: (id: string) => vendorApi.productDeleteConfigAttribute(productId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey })
      toast.success('Option removed')
      // roots still includes the deleted attr until refetch — length 1 means it was the last.
      if (roots.length <= 1) onAllOptionsRemoved?.()
    },
    onError: () => toast.error('Could not remove option'),
  })

  const createOption = useMutation({
    mutationFn: (vars: { attributeId: string; displayName: string; sortOrder: number; colorCode?: string; priceDelta?: number }) =>
      vendorApi.productCreateConfigOption(productId, vars.attributeId, {
        name: slugifyAttributeName(vars.displayName),
        display_name: vars.displayName,
        sort_order: vars.sortOrder,
        color_code: vars.colorCode,
        price_delta: vars.priceDelta ?? 0,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: qKey })
      setNewValueByAttr(prev => ({ ...prev, [vars.attributeId]: '' }))
      setNewOptionPrice(prev => ({ ...prev, [vars.attributeId]: '' }))
      setNewColorByAttr(prev => ({ ...prev, [vars.attributeId]: '' }))
    },
    onError: () => toast.error('Could not add value'),
  })

  const updateOption = useMutation({
    mutationFn: (vars: { id: string; body: Partial<{ display_name: string; price_delta: number; color_code: string }> }) =>
      vendorApi.productUpdateConfigOption(productId, vars.id, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
    onError: () => toast.error('Could not update value'),
  })

  const deleteOption = useMutation({
    mutationFn: (optionId: string) => vendorApi.productDeleteConfigOption(productId, optionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
    onError: () => toast.error('Could not remove value'),
  })

  const pickCatalogType = (typeValue: string) => {
    if (overComboLimit) {
      toast.error(`Already over the ${MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')} combination limit — remove values before adding options.`)
      return
    }
    const catalog = getVariantOptionType(typeValue)
    if (!catalog) return
    createAttribute.mutate({
      displayName: catalog.label,
      slug: catalog.value,
      inputType: catalog.inputType,
    })
  }

  const pickCustomType = (name: string) => {
    if (overComboLimit) {
      toast.error(`Already over the ${MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')} combination limit — remove values before adding options.`)
      return
    }
    const trimmed = name.trim()
    if (!trimmed) return
    if (usedLabels.some(l => l.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('That option is already added')
      return
    }
    createAttribute.mutate({ displayName: trimmed, slug: slugifyAttributeName(trimmed) })
  }

  const getColorLabelFormat = (attrId: string) => colorLabelFormat[attrId] ?? 'name'

  const formatColorDisplayName = (attrId: string, name: string, hex?: string): string => {
    const format = getColorLabelFormat(attrId)
    const cleanName = name.trim()
    const cleanHex = hex?.trim().toUpperCase()
    if (format === 'hex') return cleanHex || cleanName
    if (format === 'both') {
      if (cleanName && cleanHex) return `${cleanName} ${cleanHex}`
      return cleanName || cleanHex || ''
    }
    return cleanName || cleanHex || ''
  }

  /** Strip trailing #hex from a label so we can re-apply format cleanly. Never returns a hex as the "name". */
  const baseColorName = (label: string): string => {
    const trimmed = label.trim()
    if (!trimmed) return ''
    const isHex = (s: string) => /^#?[0-9A-Fa-f]{6}$/.test(s.trim())
    if (isHex(trimmed)) return ''
    // "Name #AABBCC" or "#AAA #BBB" — take everything before the last hex
    const m = trimmed.match(/^(.*?)\s+(#[0-9A-Fa-f]{6})$/i)
    if (m) {
      const name = m[1].trim()
      if (!name || isHex(name)) return ''
      return name
    }
    // Strip any embedded hex codes left over from bad prior labels
    const withoutHex = trimmed.replace(/#[0-9A-Fa-f]{6}/gi, '').replace(/\s+/g, ' ').trim()
    if (!withoutHex || isHex(withoutHex)) return ''
    return withoutHex
  }

  const syncColorLabelPreview = (attrId: string, hex: string, preferredName?: string, forceAuto = false) => {
    const format = colorLabelFormat[attrId] ?? 'name'
    const suggested = preferredName || suggestColourName(hex)
    const currentBase = baseColorName(newValueByAttr[attrId] ?? '')
    const wasAuto =
      forceAuto
      || !currentBase
      || COLOUR_PALETTE.some(c => c.name.toLowerCase() === currentBase.toLowerCase())
      || currentBase === suggestColourName(newColorByAttr[attrId] || '#6366F1')
    const namePart = wasAuto ? suggested : currentBase
    if (format === 'hex') {
      setNewValueByAttr(prev => ({ ...prev, [attrId]: hex }))
    } else if (format === 'both') {
      setNewValueByAttr(prev => ({ ...prev, [attrId]: `${namePart} ${hex}`.trim() }))
    } else if (wasAuto || !currentBase) {
      setNewValueByAttr(prev => ({ ...prev, [attrId]: namePart }))
    }
  }

  const addSuggestedValue = (attr: ConfigAttribute, value: string, colorHex?: string) => {
    const catalog = getVariantOptionTypeForAttribute(attr.display_name, attr.name)
    const colorCode = colorHex
      ?? (catalog?.inputType === 'color'
        ? COLOUR_PALETTE.find(c => c.name.toLowerCase() === value.toLowerCase())?.hex
        : undefined)
    const displayName = catalog?.inputType === 'color'
      ? formatColorDisplayName(attr.id, value, colorCode)
      : value
    const exists = attr.options.some(o => o.display_name.toLowerCase() === displayName.toLowerCase())
    if (exists) return
    const next = nextComboIfExtra(attr.id)
    if (!guardComboIncrease(next, `Adding "${displayName}"`)) return
    createOption.mutate({
      attributeId: attr.id,
      displayName,
      sortOrder: attr.options.length,
      colorCode,
    })
  }

  const addValue = (attr: ConfigAttribute) => {
    const catalog = getVariantOptionTypeForAttribute(attr.display_name, attr.name)
    const pickedHex = newColorByAttr[attr.id]
    const rawLabel = (newValueByAttr[attr.id] ?? '').trim()
    const format = getColorLabelFormat(attr.id)

    if (catalog?.inputType === 'color') {
      const hex = pickedHex
        || COLOUR_PALETTE.find(c => c.name.toLowerCase() === baseColorName(rawLabel).toLowerCase())?.hex
      const namePart = baseColorName(rawLabel) || (hex ? suggestColourName(hex) : '')
      if (format === 'hex' && !hex) {
        toast.error('Pick a color or enter a hex code')
        return
      }
      if (format === 'name' && !namePart) {
        toast.error('Enter a color name')
        return
      }
      if (format === 'both' && (!namePart || !hex)) {
        toast.error('Need both a color name and a hex code')
        return
      }
      const displayName = formatColorDisplayName(attr.id, namePart, hex)
      const exists = attr.options.some(o => o.display_name.toLowerCase() === displayName.toLowerCase())
      if (exists) {
        toast.error('That color is already added')
        return
      }
      const next = nextComboIfExtra(attr.id)
      if (!guardComboIncrease(next, `Adding "${displayName}"`)) return
      createOption.mutate({
        attributeId: attr.id,
        displayName,
        sortOrder: attr.options.length,
        colorCode: hex,
        priceDelta: parseFloat(newOptionPrice[attr.id] || '') || 0,
      })
      return
    }

    if (!rawLabel) return
    const next = nextComboIfExtra(attr.id)
    if (!guardComboIncrease(next, `Adding "${rawLabel}"`)) return
    createOption.mutate({
      attributeId: attr.id,
      displayName: rawLabel,
      sortOrder: attr.options.length,
      priceDelta: parseFloat(newOptionPrice[attr.id] || '') || 0,
    })
  }

  const addPaletteColor = (attr: ConfigAttribute, name: string, hex: string) => {
    addSuggestedValue(attr, name, hex)
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-md">
          <h2 className="text-lg font-semibold text-foreground">What can customers choose?</h2>
          <p className="text-sm text-muted-foreground">
            Add option types and values. Customers pick one of each. Max{' '}
            {MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')} combos.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {comboEstimate > 0 && (
            <Badge
              variant="outline"
              className={cn(
                overComboLimit
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : 'border-blue-200 bg-blue-50 text-blue-900',
              )}
              title={
                rulesApplied > 0 && reducedBy > 0
                  ? `${rawComboEstimate.toLocaleString('en-IN')} without rules · ${reducedBy.toLocaleString('en-IN')} hidden by ${rulesApplied} rule${rulesApplied === 1 ? '' : 's'}`
                  : undefined
              }
            >
              {comboEstimate.toLocaleString('en-IN')} / {MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')} max
              {rulesApplied > 0 && reducedBy > 0 && (
                <span className="ml-1 font-normal opacity-80">
                  (−{reducedBy.toLocaleString('en-IN')} via rules)
                </span>
              )}
            </Badge>
          )}
          {editMode && onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              Back to prices &amp; stock
            </Button>
          )}
          <Button
            size="sm"
            disabled={!canContinue}
            onClick={onContinue}
            title={overComboLimit ? `Reduce options to ${MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')} or fewer combinations` : undefined}
          >
            Continue to compatibility
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <div className="min-w-0 space-y-3">
          {overComboLimit && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{comboEstimate.toLocaleString('en-IN')}</strong> combinations exceeds the limit of{' '}
                <strong>{MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')}</strong> per product.
                Remove option values (or whole options)
                {rulesApplied === 0 ? ', or add compatibility rules that hide invalid combos,' : ''}
                {' '}before continuing. Adding more values is blocked.
              </span>
            </div>
          )}
          <VariantOptionTypeCombobox
            excludeLabels={usedLabels}
            onPickCatalog={pickCatalogType}
            onPickCustom={pickCustomType}
            disabled={createAttribute.isPending || overComboLimit}
          />

          {missingValues.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Add values for: <strong>{missingValues.join(', ')}</strong>
              </span>
            </div>
          )}

          <div className="space-y-2">
            {roots.length === 0 && (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            <p>No options yet — search above to add Color, Size, Pattern, etc.</p>
            {onBrowseTemplates && (
              <button
                type="button"
                onClick={onBrowseTemplates}
                className="mt-2 font-medium text-primary hover:underline"
              >
                Or pick a ready variant recommendation
              </button>
            )}
          </div>
        )}

        {roots.map(attr => {
          const catalog = getVariantOptionTypeForAttribute(attr.display_name, attr.name)
          const isCustom = !catalog
          const existingValues = new Set(attr.options.map(o => o.display_name.toLowerCase()))
          const suggestions = (catalog?.suggestedValues ?? []).filter(s => !existingValues.has(s.toLowerCase()))

          return (
            <Card key={attr.id} className={cn(missingValues.includes(attr.display_name) && 'border-amber-300')}>
              <CardContent className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {isCustom ? (
                    <Input
                      defaultValue={attr.display_name}
                      className="h-8 max-w-xs font-medium"
                      placeholder="Option name"
                      onBlur={e => {
                        const v = e.target.value.trim()
                        if (v && v !== attr.display_name) {
                          updateAttribute.mutate({ id: attr.id, display_name: v, version: attr.version_number })
                        }
                      }}
                    />
                  ) : (
                    <div className="flex min-w-0 shrink-0 items-baseline gap-x-2">
                      <p className="font-semibold text-foreground">{attr.display_name}</p>
                      <p className="text-[10px] text-muted-foreground">{catalog.group}</p>
                    </div>
                  )}

                  {catalog?.inputType === 'color' && (
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Show as</span>
                      <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-[11px]">
                        {COLOR_SHOW_PART_OPTIONS.map(opt => {
                          const parts = getColorShowParts(attr)
                          const active = parts[opt.value]
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={updateAttribute.isPending}
                              title={
                                active
                                  ? `Hide ${opt.label.toLowerCase()} on customer front`
                                  : `Show ${opt.label.toLowerCase()} on customer front`
                              }
                              onClick={() => toggleColorAppearancePart(attr, opt.value)}
                              className={cn(
                                'rounded-full px-2.5 py-0.5 font-medium transition-colors',
                                active
                                  ? 'bg-background text-foreground shadow-sm'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {(() => {
                          const p = getColorShowParts(attr)
                          const bits = [
                            p.color ? 'Color' : null,
                            p.name ? 'Name' : null,
                            p.hex ? 'Hex' : null,
                          ].filter(Boolean)
                          return bits.join(' + ')
                        })()}
                      </span>
                    </div>
                  )}

                  <div className="ml-auto flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (showPriceFields) {
                          setShowPriceAdjustments(false)
                          setPriceFieldsDismissed(true)
                        } else {
                          setShowPriceAdjustments(true)
                          setPriceFieldsDismissed(false)
                        }
                      }}
                      className="rounded px-1.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/5"
                      title={
                        showPriceFields
                          ? 'Hide price adjustment fields'
                          : 'Show price adjustment fields for option values'
                      }
                    >
                      {showPriceFields ? 'Hide prices' : 'Price adjustments'}
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                      onClick={() => deleteAttribute.mutate(attr.id)}
                      title="Remove this option"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {attr.options.length === 0 && (
                  <p className="text-[11px] text-amber-700">Add at least one value for this option.</p>
                )}

                {showPriceFields ? (
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {attr.options.map(o => (
                      <div key={o.id} className="group flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1">
                        {catalog?.inputType === 'color' ? (
                          <label className="relative h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded border" title="Change color">
                            <span
                              className="absolute inset-0"
                              style={{ backgroundColor: o.color_code || '#d1d5db' }}
                            />
                            <input
                              type="color"
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              value={o.color_code && /^#[0-9A-Fa-f]{6}$/.test(o.color_code) ? o.color_code : '#6366F1'}
                              onChange={e => {
                                const hex = e.target.value.toUpperCase()
                                if (hex !== (o.color_code || '').toUpperCase()) {
                                  updateOption.mutate({ id: o.id, body: { color_code: hex } })
                                }
                              }}
                            />
                          </label>
                        ) : o.color_code ? (
                          <span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: o.color_code }} />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-xs">{o.display_name}</span>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">+₹</span>
                          <Input
                            className="h-6 w-24 pl-7 pr-1 text-[11px] tabular-nums"
                            type="number"
                            step="0.01"
                            placeholder="0"
                            defaultValue={o.price_delta ? String(o.price_delta) : ''}
                            title="Extra price when this value is chosen"
                            onBlur={e => {
                              const delta = parseFloat(e.target.value) || 0
                              if (delta !== o.price_delta) {
                                updateOption.mutate({ id: o.id, body: { price_delta: delta } })
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="rounded p-0.5 text-muted-foreground opacity-60 hover:text-red-500 group-hover:opacity-100"
                          onClick={() => deleteOption.mutate(o.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  attr.options.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {attr.options.map(o => (
                        <Badge
                          key={o.id}
                          variant="secondary"
                          className="gap-0.5 py-0.5 pl-1.5 pr-1 text-xs font-normal"
                        >
                          {catalog?.inputType === 'color' ? (
                            <label className="relative h-3.5 w-3.5 shrink-0 cursor-pointer overflow-hidden rounded-full border" title="Change color">
                              <span
                                className="absolute inset-0 rounded-full"
                                style={{ backgroundColor: o.color_code || '#d1d5db' }}
                              />
                              <input
                                type="color"
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                value={o.color_code && /^#[0-9A-Fa-f]{6}$/.test(o.color_code) ? o.color_code : '#6366F1'}
                                onChange={e => {
                                  const hex = e.target.value.toUpperCase()
                                  if (hex !== (o.color_code || '').toUpperCase()) {
                                    updateOption.mutate({ id: o.id, body: { color_code: hex } })
                                  }
                                }}
                              />
                            </label>
                          ) : o.color_code ? (
                            <span className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: o.color_code }} />
                          ) : null}
                          {o.display_name}
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-muted"
                            onClick={() => deleteOption.mutate(o.id)}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )
                )}

                {catalog?.inputType === 'color' ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-medium text-muted-foreground">Color palette — click to add</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Save labels as</span>
                        <div className="inline-flex rounded-md border bg-muted/30 p-0.5 text-[10px]">
                          {([
                            { value: 'name' as const, label: 'Name' },
                            { value: 'hex' as const, label: 'Hex' },
                            { value: 'both' as const, label: 'Name + Hex' },
                          ]).map(opt => {
                            const active = getColorLabelFormat(attr.id) === opt.value
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setColorLabelFormat(prev => ({ ...prev, [attr.id]: opt.value }))
                                  const hex = newColorByAttr[attr.id]
                                  if (hex) {
                                    // Re-apply label using the new format
                                    const namePart = baseColorName(newValueByAttr[attr.id] ?? '') || suggestColourName(hex)
                                    if (opt.value === 'hex') setNewValueByAttr(p => ({ ...p, [attr.id]: hex }))
                                    else if (opt.value === 'both') setNewValueByAttr(p => ({ ...p, [attr.id]: `${namePart} ${hex}` }))
                                    else setNewValueByAttr(p => ({ ...p, [attr.id]: namePart }))
                                  }
                                }}
                                className={cn(
                                  'rounded px-2 py-0.5 font-medium transition-colors',
                                  active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                )}
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const available = COLOUR_PALETTE.filter(c => {
                        const label = formatColorDisplayName(attr.id, c.name, c.hex)
                        const usedByLabel = attr.options.some(o => o.display_name.toLowerCase() === label.toLowerCase())
                        const usedByHex = attr.options.some(
                          o => (o.color_code || '').toUpperCase() === c.hex.toUpperCase(),
                        )
                        return !usedByLabel && !usedByHex
                      })
                      if (available.length === 0) {
                        return (
                          <p className="text-[10px] text-muted-foreground">
                            All palette colors added — pick a custom color below.
                          </p>
                        )
                      }
                      return (
                        <div className="flex max-h-9 min-w-0 flex-wrap gap-1.5 overflow-hidden">
                          {available.map(c => {
                            const label = formatColorDisplayName(attr.id, c.name, c.hex)
                            const blocked = overComboLimit || isOverComboLimit(nextComboIfExtra(attr.id))
                            return (
                              <button
                                key={c.hex}
                                type="button"
                                disabled={blocked || createOption.isPending}
                                title={`Add ${label}`}
                                onClick={() => addPaletteColor(attr, c.name, c.hex)}
                                className={cn(
                                  'group flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-[11px] transition-colors',
                                  blocked
                                    ? 'cursor-not-allowed opacity-40'
                                    : 'hover:border-primary/50 hover:bg-primary/5',
                                )}
                              >
                                <span
                                  className={cn(
                                    'h-5 w-5 shrink-0 rounded border shadow-sm',
                                    c.hex.toUpperCase() === '#FFFFFF' && 'border-gray-300',
                                  )}
                                  style={{ backgroundColor: c.hex }}
                                />
                                <span className="font-medium text-foreground">{c.name}</span>
                                <span className="font-mono text-[9px] text-muted-foreground">{c.hex}</span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">Quick add:</span>
                    {suggestions.slice(0, 12).map(val => (
                      <button
                        key={val}
                        type="button"
                        disabled={overComboLimit || isOverComboLimit(nextComboIfExtra(attr.id))}
                        className="rounded-full border bg-muted/30 px-2 py-px text-[11px] text-foreground hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => addSuggestedValue(attr, val)}
                      >
                        + {val}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-1.5">
                  {catalog?.inputType === 'color' && (
                    <label
                      className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-input shadow-sm"
                      title="Pick a custom color"
                    >
                      <span
                        className="absolute inset-0"
                        style={{ backgroundColor: newColorByAttr[attr.id] || '#E5E7EB' }}
                      />
                      <input
                        type="color"
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        value={newColorByAttr[attr.id] || '#6366F1'}
                        onChange={e => {
                          const hex = e.target.value.toUpperCase()
                          setNewColorByAttr(prev => ({ ...prev, [attr.id]: hex }))
                          syncColorLabelPreview(attr.id, hex)
                        }}
                      />
                    </label>
                  )}
                  <Input
                    value={newValueByAttr[attr.id] ?? ''}
                    onChange={e => {
                      const raw = e.target.value
                      setNewValueByAttr(prev => ({ ...prev, [attr.id]: raw }))
                      if (catalog?.inputType === 'color') {
                        const hexMatch = raw.trim().match(/^#?([0-9A-Fa-f]{6})$/)
                        if (hexMatch) {
                          const hex = `#${hexMatch[1].toUpperCase()}`
                          setNewColorByAttr(prev => ({ ...prev, [attr.id]: hex }))
                          // Pasted/typed hex only — always suggest a real color name
                          syncColorLabelPreview(attr.id, hex, undefined, true)
                        }
                      }
                    }}
                    placeholder={
                      catalog?.inputType === 'color'
                        ? getColorLabelFormat(attr.id) === 'hex'
                          ? 'Pick color or paste #hex'
                          : getColorLabelFormat(attr.id) === 'both'
                            ? 'Name + hex (e.g. Lavender #D6D6E1)'
                            : 'Color name (or paste #hex)'
                        : 'Add a value…'
                    }
                    className="h-7 min-w-[10rem] flex-1 text-xs sm:max-w-md"
                    onKeyDown={e => { if (e.key === 'Enter') addValue(attr) }}
                  />
                  {catalog?.inputType === 'color' && (newColorByAttr[attr.id] || (newValueByAttr[attr.id] ?? '').trim()) && (
                    <span className="max-w-[10rem] truncate font-mono text-[10px] text-muted-foreground" title="Will save as">
                      → {formatColorDisplayName(
                        attr.id,
                        baseColorName(newValueByAttr[attr.id] ?? '') || (newColorByAttr[attr.id] ? suggestColourName(newColorByAttr[attr.id]) : ''),
                        newColorByAttr[attr.id],
                      ) || '…'}
                    </span>
                  )}
                  {showPriceFields && (
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">+₹</span>
                      <Input
                        value={newOptionPrice[attr.id] ?? ''}
                        onChange={e => setNewOptionPrice(p => ({ ...p, [attr.id]: e.target.value }))}
                        placeholder="0"
                        type="number"
                        step="0.01"
                        className="h-7 w-24 pl-7 pr-1 text-[11px] tabular-nums"
                        title="Extra price for this value"
                      />
                    </div>
                  )}
                  <Button
                    size="sm" variant="outline" className="h-7 px-2 text-xs"
                    disabled={
                      createOption.isPending
                      || overComboLimit
                      || isOverComboLimit(nextComboIfExtra(attr.id))
                      || (catalog?.inputType === 'color'
                        ? (getColorLabelFormat(attr.id) === 'hex'
                          ? !newColorByAttr[attr.id] && !/^#?[0-9A-Fa-f]{6}$/.test((newValueByAttr[attr.id] ?? '').trim())
                          : getColorLabelFormat(attr.id) === 'both'
                            ? !(baseColorName(newValueByAttr[attr.id] ?? '') && newColorByAttr[attr.id])
                            : !baseColorName(newValueByAttr[attr.id] ?? ''))
                        : !(newValueByAttr[attr.id] ?? '').trim())
                    }
                    onClick={() => addValue(attr)}
                    title={overComboLimit ? 'Over combination limit' : undefined}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
          </div>
        </div>

        <BusinessFrontProductMock
          productId={productId}
          attributes={roots}
          comboEstimate={rawComboEstimate}
          previewRules={configRulesToPreviewCompat(savedRules)}
        />
      </div>
    </div>
  )
}

function CreateVariantsStep({
  productId, comboEstimate, onBack, onCreated, editMode,
}: {
  productId: string
  comboEstimate: number
  onBack: () => void
  onCreated: () => void
  editMode?: boolean
}) {
  const qc = useQueryClient()
  const previewKey = ['product-config-variants-preview', productId, 'all']

  const { data: preview, isLoading } = useQuery({
    queryKey: previewKey,
    queryFn: () => vendorApi.productPreviewVariants(productId, { mode: 'all' }),
  })

  const generateMutation = useMutation({
    mutationFn: () => vendorApi.productGenerateVariants(productId, { mode: 'all' }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: previewKey })
      toast.success(
        `${result.created_count} variant${result.created_count === 1 ? '' : 's'} created`
        + (result.skipped_existing_count ? ` — ${result.skipped_existing_count} already existed` : ''),
      )
      onCreated()
    },
    onError: () => toast.error('Could not create variants — please try again'),
  })

  const items = preview?.items?.filter(i => i.status === 'new') ?? []
  const newCount = preview?.new_count ?? 0
  const existingCount = preview?.existing_count ?? 0
  const previewSlice = items.slice(0, 8)
  const overComboLimit = isOverComboLimit(comboEstimate)

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Create your variants</h2>
        <p className="text-sm text-muted-foreground">
          Generate SKUs from your option combinations. Existing variants are kept — only new ones are added.
          Max {MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')} combinations per product.
        </p>
      </div>

      {overComboLimit && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>{comboEstimate.toLocaleString('en-IN')}</strong> combinations exceeds the limit of{' '}
            <strong>{MAX_VARIANT_COMBINATIONS.toLocaleString('en-IN')}</strong>. Go back and remove option values before creating variants.
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <>
          <Card className="bg-muted/30">
            <CardContent className="space-y-4 p-6 text-center">
              <p className="text-2xl font-bold text-foreground">
                {overComboLimit
                  ? 'Too many combinations'
                  : newCount > 0
                    ? `${newCount.toLocaleString('en-IN')} new variant${newCount === 1 ? '' : 's'} ready`
                    : existingCount > 0
                      ? 'All variants already exist'
                      : 'No combinations yet'}
              </p>
              {comboEstimate > 0 && newCount === 0 && existingCount > 0 && !overComboLimit && (
                <p className="text-sm text-muted-foreground">
                  {existingCount} variant{existingCount === 1 ? '' : 's'} already created from your options.
                </p>
              )}
              {comboEstimate === 0 && newCount === 0 && existingCount === 0 && (
                <p className="text-sm text-muted-foreground">
                  Add option types (Color, Size, Storage…) with values on Step 1 — use option types, not individual
                  colors as separate options.
                </p>
              )}
              <Button
                size="lg"
                className="mx-auto"
                disabled={overComboLimit || newCount === 0 || generateMutation.isPending}
                onClick={() => generateMutation.mutate()}
              >
                {generateMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Sparkles className="h-4 w-4" />}
                {overComboLimit
                  ? 'Reduce options first'
                  : newCount > 0 ? `Create ${newCount} variant${newCount === 1 ? '' : 's'}` : 'Nothing new to create'}
              </Button>
              {existingCount > 0 && newCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {existingCount} existing variant{existingCount === 1 ? '' : 's'} will be skipped.
                </p>
              )}
            </CardContent>
          </Card>

          {previewSlice.length > 0 && (
            <div className="rounded-lg border">
              <p className="border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">Preview</p>
              <ul className="divide-y">
                {previewSlice.map(item => (
                  <li key={item.variant_hash} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium">{item.label}</span>
                    <Badge variant="success" className="text-[10px]">New</Badge>
                  </li>
                ))}
                {items.length > previewSlice.length && (
                  <li className="px-4 py-2 text-xs text-muted-foreground">
                    and {items.length - previewSlice.length} more…
                  </li>
                )}
              </ul>
            </div>
          )}
        </>
      )}

      <WizardStepNav
        onBack={onBack}
        backLabel={editMode ? 'Back to compatibility' : 'Back'}
        onContinue={existingCount > 0 && newCount === 0 ? onCreated : undefined}
        continueLabel={editMode ? 'Return to prices & stock' : 'Continue to prices & stock'}
      />
    </div>
  )
}

export { VARIANT_SETUP_TEMPLATES }
