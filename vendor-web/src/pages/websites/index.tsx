import { useState, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import {
  Globe, Plus, ExternalLink, Edit3, Trash2, Eye, EyeOff,
  ChevronRight, ChevronLeft, ChevronDown, Info,
  MoreVertical, MoreHorizontal, Loader2, Layout, FileText, Calendar,
  SlidersHorizontal,
  Sparkles, Rocket, Check, Copy,
  Globe2, ClipboardCopy,
  Pencil,
  X,
  ShoppingBag,
  ShoppingCart,
  Search,
  LayoutTemplate,
  Store,
  Paintbrush,
  Download,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  useSiteList,
  useCreateSite,
  useDeleteSite,
  usePublishSite,
  useUnpublishSite,
  useUpdateSite,
  useWebsiteTemplates,
  websitesListQueryKey,
} from '@/hooks/useWebsites'
import { useStores } from '@/hooks/useVendor'
import { websiteApi } from '@/api/websites'
import type { SiteListItem } from '@/types/websites'
import { cn } from '@/lib/utils'
import { extractApiError } from '@/lib/errorMessages'
import { imageCategoryForBusinessType, stylePresetForBusinessType, getAvailableSetupFeatures, getCoreSetupFeatures, getDefaultSetupFeatures, normalizeSetupFeatures, buildPagesFromSetupFeatures, buildGenerateSitePrompt, type SetupFeatureId, resolveWebsiteSetupFromBusinessSettings } from '@/lib/businessSitePresets'
import {
  CUSTOM_WEBSITE_PALETTE_ID,
  DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS,
  DEFAULT_WEBSITE_COLOR_PALETTE_ID,
  resolveWebsitePaletteColors,
  type WebsiteColorPaletteId,
  type WebsitePaletteColors,
} from '@/lib/websiteColorPalettes'
import { ColorPalettePicker, SetupFeaturesPicker } from '@/components/websites/siteInputParametersPickers'
import { WEBSITE_SELLING_MODES } from '@/lib/websiteCreateWizardPresets'
import { companyTypeLabel } from '@/data/companyTypes'
import { useVendorStore } from '@/stores/vendorStore'
import { resolveStorefrontLinkMode } from '@/lib/liveStorefrontUrl'
import {
  isBuilderSiteAssignedToAnyStore,
  isBuilderSiteEffectivelyLive,
  isBuilderSiteExternal,
  resolveBuilderSiteLiveBlockReason,
  resolveBuilderSiteViewLiveLinks,
  resolveExternalSiteLiveLinks,
  resolveSiteScopeBadgeProps,
} from '@/lib/builderDraftTemplateSites'
import {
  assignExternalSiteSubdomainWithRetry,
  externalSiteNeedsLiveUrl,
  externalSitePublicUrl,
} from '@/lib/externalSiteSubdomain'
import { resolveSiteCardDisplayStatus, SITE_CARD_STATUS_DISPLAY } from '@/lib/siteCardDisplayStatus'
import { copyBuilderSiteDraftPreviewLink, openBuilderSiteDraftPreview } from '@/lib/openBuilderSiteDraftPreview'
import { CustomDomainVerifyPanel } from '@/components/websites/CustomDomainVerifyPanel'
import { format } from 'date-fns'
import { isTemplateSandboxSite } from '@/lib/websiteSandbox'
import { RecentlyDeletedTemplatesModal } from '@/components/websites/RecentlyDeletedTemplatesModal'
import { countSitesWithName, resolveUniqueSiteName, suggestSiteCopyName } from '@/lib/websiteSiteNames'
import { resolveSiteStaticThumbnail } from '@/lib/websiteSitePreview'
import { downloadSiteExportJson, siteExportFilename, type SiteExportMode } from '@/lib/downloadSiteExport'
import { WebsiteSiteGlimpse } from '@/components/websites/WebsiteSiteGlimpse'
import { WebsiteScopeBadge } from '@/components/websites/WebsiteScopeBadge'
import { SiteInputParametersModal } from '@/components/websites/SiteInputParametersModal'
import { formatStoreCode } from '@/lib/verification'
import {
  WEBSITE_CREATION_APPROACHES,
  WEBSITE_CREATE_BUSINESS_PRESETS,
  type WebsiteCreationApproach,
} from '@/lib/websiteCreateWizardPresets'

const BUSINESS_PRESETS = WEBSITE_CREATE_BUSINESS_PRESETS

type WebsiteStoreScope = 'all' | 'store' | 'external'

const WEBSITE_STORE_SCOPE_OPTIONS: {
  id: WebsiteStoreScope
  label: string
  desc: string
  icon: LucideIcon
}[] = [
  {
    id: 'all',
    label: 'All stores',
    desc: 'One website for every business unit — shared catalog and branding',
    icon: Globe,
  },
  {
    id: 'store',
    label: 'An individual store',
    desc: 'Website scoped to a single business unit / outlet',
    icon: Store,
  },
  {
    id: 'external',
    label: 'Other Use',
    desc: 'Marketing or portfolio site on your own domain — not tied to a store',
    icon: Globe2,
  },
]

const SITE_CARD_GRID = 'grid grid-cols-2 lg:grid-cols-4 gap-3'

function WebsiteCreationApproachPicker({
  selected,
  disabled,
  onSelect,
}: {
  selected: WebsiteCreationApproach
  disabled?: boolean
  onSelect: (id: WebsiteCreationApproach) => void
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
          <LayoutTemplate className="h-3 w-3" />
        </span>
        How do you want to start?
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {WEBSITE_CREATION_APPROACHES.map(option => {
          const Icon = option.icon
          const checked = selected === option.id
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option.id)}
              aria-pressed={checked}
              className={cn(
                'group relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                checked
                  ? 'border-primary bg-primary/[0.06] shadow-sm shadow-primary/10'
                  : 'border-gray-200 bg-white hover:border-primary/30 hover:bg-gray-50/80',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                  checked ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-primary/10 group-hover:text-primary',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1 min-w-0 pr-6">
                <span className={cn('block text-sm font-semibold leading-tight', checked ? 'text-gray-900' : 'text-gray-800')}>
                  {option.label}
                </span>
                <span className="block text-xs text-gray-500 mt-1 leading-snug">
                  {option.desc}
                </span>
              </span>
              <span
                className={cn(
                  'absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all',
                  checked
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 bg-white group-hover:border-primary/50',
                )}
                aria-hidden
              >
                {checked && <Check className="h-3 w-3 stroke-[3]" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}


function CreateSiteWizardMoreMenu({
  onInputParameters,
  disabled,
}: {
  onInputParameters: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEscapeToClose(() => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative ml-auto shrink-0" ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
          open
            ? 'border-violet-300 bg-violet-100 text-violet-800'
            : 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        More
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onInputParameters()
            }}
            className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-accent"
          >
            <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Input parameters
              <span className="mt-0.5 block text-[11px] font-normal text-gray-500">
                View and edit template setup inputs
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}


function CreateSiteModal({
 onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createSite = useCreateSite()
  const { data: storesData } = useStores()
  const vendor = useVendorStore(s => s.vendor)
  const stores = storesData?.stores ?? []
  const storeCount = stores.length
  const singleStore = storeCount === 1 ? stores[0] : null

  const [name, setName] = useState('')
  const [websiteStoreScope, setWebsiteStoreScope] = useState<WebsiteStoreScope>(
    storeCount <= 1 ? 'store' : 'store',
  )
  const [websiteStoreId, setWebsiteStoreId] = useState('')
  const [businessType, setBusinessType] = useState(BUSINESS_PRESETS[0].id)
  const [sellingMode, setSellingMode] = useState(BUSINESS_PRESETS[0].sells)
  const [selectedFeatures, setSelectedFeatures] = useState<SetupFeatureId[]>(() =>
    getDefaultSetupFeatures(BUSINESS_PRESETS[0].id, BUSINESS_PRESETS[0].sells),
  )
  const [generating, setGenerating] = useState(false)
  const [creationApproach, setCreationApproach] = useState<WebsiteCreationApproach>('ready_pages')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedPaletteId, setSelectedPaletteId] = useState<WebsiteColorPaletteId>(DEFAULT_WEBSITE_COLOR_PALETTE_ID)
  const [customPaletteColors, setCustomPaletteColors] = useState<WebsitePaletteColors>(
    DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS,
  )
  const [inputParamsOpen, setInputParamsOpen] = useState(false)

  const isExternalScope = websiteStoreScope === 'external'
  const showStoreScopePicker = storeCount > 1
  const currentScopeOption = WEBSITE_STORE_SCOPE_OPTIONS.find(o => o.id === websiteStoreScope)
  const activeStoreForSettings = websiteStoreScope === 'store'
    ? (websiteStoreId
      ? stores.find(s => s.id === websiteStoreId)
      : singleStore ?? stores.find(s => s.is_default) ?? stores[0])
    : undefined
  const builtForStore = websiteStoreScope === 'store'
    ? (activeStoreForSettings ?? singleStore)
    : null

  const settingsSetup = resolveWebsiteSetupFromBusinessSettings(vendor, activeStoreForSettings)
  const effectiveBusinessType = isExternalScope ? businessType : settingsSetup.businessTypeId
  const effectiveSellingMode = isExternalScope ? sellingMode : settingsSetup.sellingMode

  const selectedBusiness = BUSINESS_PRESETS.find(t => t.id === effectiveBusinessType) || BUSINESS_PRESETS[0]
  const availableFeatures = getAvailableSetupFeatures(effectiveBusinessType, effectiveSellingMode)
  const settingsBusinessLabel = companyTypeLabel(
    (activeStoreForSettings?.settings as Record<string, unknown> | undefined)?.company_type as string
      || vendor?.business_type,
  )
  const settingsSellingLabel = WEBSITE_SELLING_MODES.find(s => s.id === settingsSetup.sellingMode)?.label ?? 'Both'

  useEffect(() => {
    if (storeCount <= 1) {
      setWebsiteStoreScope(prev => (prev === 'external' ? 'external' : 'store'))
      return
    }
    setWebsiteStoreScope(prev => (prev === 'store' || prev === 'all' || prev === 'external' ? prev : 'store'))
  }, [storeCount])

  useEffect(() => {
    if (websiteStoreScope !== 'store') {
      setWebsiteStoreId('')
      return
    }
    if (!websiteStoreId && stores.length > 0) {
      setWebsiteStoreId(stores.find(s => s.is_default)?.id ?? stores[0].id)
    }
  }, [websiteStoreScope, stores, websiteStoreId])

  useEffect(() => {
    if (isExternalScope) return
    if (!vendor) return
    setBusinessType(settingsSetup.businessTypeId)
    setSellingMode(settingsSetup.sellingMode)
  }, [isExternalScope, vendor, websiteStoreScope, websiteStoreId, settingsSetup.businessTypeId, settingsSetup.sellingMode])

  useEffect(() => {
    if (isExternalScope) return
    if (!vendor) return
    setSelectedFeatures(prev =>
      normalizeSetupFeatures(prev, settingsSetup.businessTypeId, settingsSetup.sellingMode),
    )
  }, [isExternalScope, vendor, websiteStoreScope, websiteStoreId, settingsSetup.businessTypeId, settingsSetup.sellingMode])

  const toggleFeature = (id: SetupFeatureId, locked?: boolean) => {
    if (locked) return
    setSelectedFeatures(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id],
    )
  }

  const handleGuidedCreate = async () => {
    if (websiteStoreScope === 'store' && !websiteStoreId) {
      toast.error('Select a business unit for this website.')
      return
    }
    const siteName = name.trim() || selectedBusiness.defaultName
    const siteDesc = creationApproach === 'scratch'
      ? `${selectedBusiness.label} website — built from scratch.`
      : `${selectedBusiness.label} website for ${effectiveSellingMode === 'both'
        ? 'products and services'
        : effectiveSellingMode === 'none'
          ? 'informational content'
          : effectiveSellingMode}.`
    const imageCategoryId = imageCategoryForBusinessType(effectiveBusinessType)
    const normalizedFeatures = creationApproach === 'scratch'
      ? getCoreSetupFeatures(effectiveBusinessType, effectiveSellingMode)
      : normalizeSetupFeatures(selectedFeatures, effectiveBusinessType, effectiveSellingMode)
    const businessStylePreset = stylePresetForBusinessType(effectiveBusinessType)
    const paletteColors = resolveWebsitePaletteColors(selectedPaletteId, customPaletteColors)
    const stylePreset = {
      ...businessStylePreset,
      ...paletteColors,
      color_palette_id: selectedPaletteId,
    }
    const pages = buildPagesFromSetupFeatures(normalizedFeatures, effectiveSellingMode)
    const selectedStore = stores.find(s => s.id === websiteStoreId)
    const resolvedScope = isExternalScope
      ? 'external'
      : (storeCount <= 1 ? 'store' : websiteStoreScope)
    try {
      const site = await createSite.mutateAsync({
        name: siteName,
        description: siteDesc,
        style_config: {
          ...stylePreset,
          image_category_id: imageCategoryId,
          business_type: effectiveBusinessType,
          selling_mode: effectiveSellingMode,
          creation_approach: creationApproach,
          setup_features: normalizedFeatures,
          website_store_scope: resolvedScope,
          website_store_id: resolvedScope === 'store' ? (websiteStoreId || singleStore?.id) : null,
          website_store_name: resolvedScope === 'store'
            ? (selectedStore?.name || singleStore?.name)
            : null,
          website_home_store_id: resolvedScope === 'store'
            ? (websiteStoreId || singleStore?.id)
            : null,
          storefront_assigned: false,
        },
      } as any)
      onClose()
      navigate(`/websites/${site.id}`)

      if (creationApproach === 'scratch') {
        try {
          await websiteApi.ensureBlankSite(site.id)
          await queryClient.invalidateQueries({ queryKey: ['websites', site.id] })
          await queryClient.invalidateQueries({ queryKey: ['websites'] })
          toast.success('Blank website ready — start adding pages and sections in the builder.')
        } catch (e) {
          toast.error(extractApiError(e, 'Website created but could not open a blank canvas. Open the builder to continue.'))
          await queryClient.invalidateQueries({ queryKey: ['websites', site.id] })
        }
        return
      }

      toast.success('Website created. Building your pages…')
      setGenerating(true)

      try {
        const selling = WEBSITE_SELLING_MODES.find(s => s.id === effectiveSellingMode)
        const gen = await websiteApi.aiGenerateSite(site.id, {
          business_description: buildGenerateSitePrompt(
            effectiveBusinessType,
            selectedBusiness.label,
            siteName,
            effectiveSellingMode,
            selling?.desc || effectiveSellingMode,
            selectedBusiness.prompt,
            normalizedFeatures,
          ),
          niche: selectedBusiness.niche,
          tone: 'professional',
          pages,
          include_pricing: normalizedFeatures.includes('pricing_page'),
          include_blog: normalizedFeatures.includes('blog_page'),
          image_category: imageCategoryId,
          selling_mode: effectiveSellingMode,
          site_name: siteName,
          business_type: effectiveBusinessType,
          setup_features: normalizedFeatures,
        })
        gen.style_config = {
          ...(gen.style_config || {}),
          ...paletteColors,
          color_palette_id: selectedPaletteId,
          setup_features: normalizedFeatures,
          business_type: effectiveBusinessType,
          selling_mode: effectiveSellingMode,
          creation_approach: creationApproach,
          image_category_id: imageCategoryId,
          website_store_scope: resolvedScope,
          website_store_id: resolvedScope === 'store' ? (websiteStoreId || singleStore?.id) : null,
          website_store_name: resolvedScope === 'store'
            ? (selectedStore?.name || singleStore?.name)
            : null,
          website_home_store_id: resolvedScope === 'store'
            ? (websiteStoreId || singleStore?.id)
            : null,
        }
        await websiteApi.aiApplyGeneratedSite(site.id, gen)
        await queryClient.invalidateQueries({ queryKey: ['websites', site.id] })
        await queryClient.invalidateQueries({ queryKey: ['websites'] })
        toast.success(`Your website is ready — ${gen.pages?.length ?? pages.length} page(s) with modern layouts and photos.`)
      } catch (e) {
        let msg = 'Smart setup could not finish. A starter site was created — open the builder to continue.'
        if (isAxiosError(e)) {
          const d = e.response?.data as { detail?: unknown } | undefined
          if (d?.detail != null) msg = Array.isArray(d.detail) ? d.detail.map(x => typeof x === 'object' && x && 'msg' in x ? String((x as { msg: string }).msg) : String(x)).join('; ') : String(d.detail)
          else msg = e.message || msg
        }
        toast.error(msg)
        await queryClient.invalidateQueries({ queryKey: ['websites', site.id] })
      } finally {
        setGenerating(false)
      }
    } catch (e) { toast.error(extractApiError(e, 'Failed to create site')) }
  }

  const isLoading = createSite.isPending || generating
  const step1Incomplete = websiteStoreScope === 'store' && storeCount > 1 && !websiteStoreId

  const handleContinue = () => {
    if (step1Incomplete) {
      toast.error('Select a business unit for this website.')
      return
    }
    setStep(2)
  }

  const handleContinueToPalette = () => {
    setStep(3)
  }

  const handlePaletteSelect = (id: WebsiteColorPaletteId) => {
    if (id === CUSTOM_WEBSITE_PALETTE_ID && selectedPaletteId !== CUSTOM_WEBSITE_PALETTE_ID) {
      setCustomPaletteColors(resolveWebsitePaletteColors(selectedPaletteId, customPaletteColors))
    }
    setSelectedPaletteId(id)
  }

  const WIZARD_STEPS = 3

  const stepLabels = ['Basics', 'Structure', 'Colors'] as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={cn(
          'flex w-full max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl transition-[max-width] duration-300',
          step === 1 ? 'max-w-xl' : step === 2 ? 'max-w-4xl' : 'max-w-3xl',
        )}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-website-title"
      >
        {/* Header */}
        <div className="relative shrink-0 bg-gradient-to-br from-primary via-primary to-info px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                {step === 3 ? <Paintbrush className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="create-website-title" className="text-xl font-bold leading-tight">Create Website</h2>
                  <span className="inline-flex items-center rounded-full bg-black/20 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-white/30">
                    Step {step} of {WIZARD_STEPS}
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/90">
                  {step === 1
                    ? 'Choose where this website is used and give it a name.'
                    : step === 2
                      ? creationApproach === 'scratch'
                        ? 'Build from scratch — pick your color palette next.'
                        : isExternalScope
                          ? 'Ready pages — pick business type and choose sections to include.'
                          : 'Ready pages — choose sections for your store website.'
                      : 'Pick a color palette for your draft website.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full bg-white/15 p-1.5 ring-1 ring-white/25 transition-colors hover:bg-white/25"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
          {/* Step progress */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center gap-2">
              {Array.from({ length: WIZARD_STEPS }, (_, i) => i + 1).map(s => (
                <span
                  key={s}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-all duration-300',
                    s < step ? 'bg-white' : s === step ? 'bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.35)]' : 'bg-white/30',
                  )}
                />
              ))}
            </div>
            <div className="flex justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/75">
              {stepLabels.map((label, i) => (
                <span
                  key={label}
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    i === 0 ? 'text-left' : i === stepLabels.length - 1 ? 'text-right' : 'text-center',
                    i + 1 === step && 'text-white',
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            {(step === 2 || step === 3) ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2.5">
                {!isExternalScope ? (
                  <>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Template built for</span>
                    <WebsiteScopeBadge
                      scope={websiteStoreScope}
                      storeId={builtForStore?.id ?? null}
                      storeName={
                        websiteStoreScope === 'store'
                          ? builtForStore?.name ?? null
                          : null
                      }
                      storeCode={
                        websiteStoreScope === 'store' && builtForStore
                          ? formatStoreCode(builtForStore)
                          : null
                      }
                    />
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Template built for</span>
                    <WebsiteScopeBadge scope="external" />
                  </>
                )}
                {name.trim() ? (
                  <span className="text-xs text-gray-500">
                    · <span className="font-medium text-gray-700">{name.trim()}</span>
                  </span>
                ) : null}
                <CreateSiteWizardMoreMenu
                  disabled={isLoading}
                  onInputParameters={() => setInputParamsOpen(true)}
                />
              </div>
            ) : null}
            {step === 1 && (
            <>
            {/* Name */}
            <div>
              <label htmlFor="website-name" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Pencil className="h-3 w-3" />
                </span>
                Name your website template
              </label>
              <div className="relative">
                <input
                  id="website-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={selectedBusiness.defaultName}
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onKeyDown={e => e.key === 'Enter' && !step1Incomplete && handleContinue()}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-500">This name identifies your website template in the builder and on published pages.</p>
            </div>

            {storeCount === 1 && singleStore && !isExternalScope && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                    <Store className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Built for</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatStoreCode(singleStore)} · {singleStore.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">
                      This label appears on your template card while drafting. Business type and what you sell come from{' '}
                      <Link to="/settings" className="font-medium text-primary underline underline-offset-2" onClick={onClose}>Business Settings</Link>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setWebsiteStoreScope('external')}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Need an external marketing site instead?
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {storeCount === 1 && singleStore && isExternalScope && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                    <Globe className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Built for</p>
                    <p className="text-sm font-semibold text-gray-900">Other Use</p>
                    <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">
                      Marketing site — not tied to a business unit or company code. You choose business type and what you sell in the next step.
                    </p>
                    <button
                      type="button"
                      onClick={() => setWebsiteStoreScope('store')}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Use your business unit instead?
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showStoreScopePicker && (
            <div>
              <label htmlFor="website-scope" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Globe className="h-3 w-3" />
                </span>
                This website is for
              </label>
              <div className="relative">
                {currentScopeOption ? (
                  <currentScopeOption.icon className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary" />
                ) : null}
                <Select
                  id="website-scope"
                  value={websiteStoreScope}
                  onChange={(v) => setWebsiteStoreScope(v as WebsiteStoreScope)}
                  options={WEBSITE_STORE_SCOPE_OPTIONS.map(opt => ({ value: opt.id, label: opt.label }))}
                  aria-label="Website store scope"
                  className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm"
                />
              </div>
              {currentScopeOption && (
                <p className="mt-1.5 text-xs text-gray-500 leading-snug">{currentScopeOption.desc}</p>
              )}
              {websiteStoreScope === 'store' && (
                <div className="mt-3">
                  <label htmlFor="website-bu" className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Business unit
                    <span className="ml-1 font-normal text-gray-400">— shown on your template card while drafting</span>
                  </label>
                  <div className="relative">
                    <Store className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Select
                      id="website-bu"
                      value={websiteStoreId}
                      onChange={setWebsiteStoreId}
                      options={stores.map(s => ({
                        value: s.id,
                        label: `${formatStoreCode(s)} · ${s.name}`,
                      }))}
                      aria-label="Business unit"
                      className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm"
                    />
                  </div>
                  {builtForStore ? (
                    <div className="mt-2">
                      <WebsiteScopeBadge
                        scope="store"
                        storeId={builtForStore.id}
                        storeName={builtForStore.name}
                        storeCode={formatStoreCode(builtForStore)}
                      />
                    </div>
                  ) : null}
                </div>
              )}
              {!isExternalScope && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <p className="leading-relaxed">
                    Business type (<strong className="font-semibold text-gray-700">{settingsBusinessLabel}</strong>) and what you sell (
                    <strong className="font-semibold text-gray-700">{settingsSellingLabel}</strong>) come from{' '}
                    <Link to="/settings" className="font-medium text-primary underline underline-offset-2" onClick={onClose}>Business Settings</Link>
                    {websiteStoreScope === 'store' && activeStoreForSettings ? ` for ${activeStoreForSettings.name}` : ''}.
                  </p>
                </div>
              )}
            </div>
            )}
            </>
            )}

            {step === 2 && (
            <>
            <WebsiteCreationApproachPicker
              selected={creationApproach}
              disabled={isLoading}
              onSelect={setCreationApproach}
            />

            {isExternalScope && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="biz-type" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Layout className="h-3 w-3" />
                  </span>
                  Choose your business type
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-base leading-none">{selectedBusiness.icon}</span>
                  <Select
                    id="biz-type"
                    value={businessType}
                    onChange={(v) => {
                      const t = BUSINESS_PRESETS.find(b => b.id === v)
                      if (!t) return
                      setBusinessType(t.id)
                      setSellingMode(t.sells)
                      setSelectedFeatures(getDefaultSetupFeatures(t.id, t.sells))
                    }}
                    options={BUSINESS_PRESETS.map(t => ({ value: t.id, label: `${t.icon} ${t.label}` }))}
                    aria-label="Business type"
                    className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500 leading-snug">{selectedBusiness.desc}</p>
              </div>
              <div>
                <label htmlFor="sell-mode" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                    <ShoppingCart className="h-3 w-3" />
                  </span>
                  What do you sell?
                </label>
                <div className="relative">
                  <ShoppingBag className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-blue-500" />
                  <Select
                    id="sell-mode"
                    value={sellingMode}
                    onChange={(v) => {
                      setSellingMode(v)
                      setSelectedFeatures(prev => normalizeSetupFeatures(prev, businessType, v))
                    }}
                    options={WEBSITE_SELLING_MODES.map(s => ({ value: s.id, label: s.label }))}
                    aria-label="Selling mode"
                    className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500 leading-snug">{WEBSITE_SELLING_MODES.find(s => s.id === sellingMode)?.desc}</p>
              </div>
            </div>
            )}

            {creationApproach === 'ready_pages' ? (
            <SetupFeaturesPicker
              features={availableFeatures}
              selected={selectedFeatures}
              businessType={selectedBusiness.label}
              sellingMode={effectiveSellingMode}
              disabled={isLoading}
              onToggle={toggleFeature}
              onSelectRecommended={() => setSelectedFeatures(getDefaultSetupFeatures(effectiveBusinessType, effectiveSellingMode))}
            />
            ) : (
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/80 px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                  <Paintbrush className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Blank canvas in the builder</p>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                    No pages or sections are generated. After you pick a color palette, we open the builder so you can add blocks, pages, and layouts yourself.
                  </p>
                </div>
              </div>
            </div>
            )}
            </>
            )}

            {step === 3 && (
            <ColorPalettePicker
              selected={selectedPaletteId}
              customColors={customPaletteColors}
              disabled={isLoading}
              onSelect={handlePaletteSelect}
              onCustomColorsChange={setCustomPaletteColors}
              title="Choose your color palette"
              description="Pick a preset or draft your own colors. You can fine-tune these in the builder later."
              idPrefix="create-site-palette"
            />
            )}
          </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/90 px-6 py-4">
              {step === 1 ? (
                <>
                  <p className="hidden text-xs text-gray-400 sm:block">Next: ready pages or build from scratch</p>
                  <div className="ml-auto flex items-center gap-2">
                    <Button variant="cancel" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button onClick={handleContinue} disabled={step1Incomplete} className="bg-primary hover:bg-primary/90 text-white">
                      Continue
                      <ChevronRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </>
              ) : step === 2 ? (
                <>
                  <Button variant="cancel" onClick={() => setStep(1)} disabled={isLoading}>
                    <ChevronLeft className="w-4 h-4 mr-1.5" />
                    Back
                  </Button>
                  <div className="flex items-center gap-2">
                    <p className="hidden text-xs text-gray-400 sm:block">Next: pick your color palette</p>
                    <Button onClick={handleContinueToPalette} disabled={isLoading} className="bg-primary hover:bg-primary/90 text-white">
                      Continue
                      <ChevronRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button variant="cancel" onClick={() => setStep(2)} disabled={isLoading}>
                    <ChevronLeft className="w-4 h-4 mr-1.5" />
                    Back
                  </Button>
                  <Button onClick={handleGuidedCreate} disabled={isLoading} className="bg-primary hover:bg-primary/90 text-white">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : creationApproach === 'scratch' ? <Paintbrush className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {generating ? 'Generating website…' : creationApproach === 'scratch' ? 'Create & Open Builder' : 'Build My Website'}
                  </Button>
                </>
              )}
            </div>

        <SiteInputParametersModal
          open={inputParamsOpen}
          onClose={() => setInputParamsOpen(false)}
          onCloseParent={onClose}
          disabled={isLoading}
          lockWebsiteScope
          name={name}
          setName={setName}
          websiteStoreScope={websiteStoreScope}
          setWebsiteStoreScope={setWebsiteStoreScope}
          websiteStoreId={websiteStoreId}
          setWebsiteStoreId={setWebsiteStoreId}
          businessType={businessType}
          setBusinessType={setBusinessType}
          sellingMode={sellingMode}
          setSellingMode={setSellingMode}
          selectedFeatures={selectedFeatures}
          setSelectedFeatures={setSelectedFeatures}
          selectedPaletteId={selectedPaletteId}
          customPaletteColors={customPaletteColors}
          onPaletteSelect={handlePaletteSelect}
          onCustomColorsChange={setCustomPaletteColors}
          stores={stores}
          storeCount={storeCount}
          singleStore={singleStore}
          showStoreScopePicker={showStoreScopePicker}
          isExternalScope={isExternalScope}
          effectiveBusinessType={effectiveBusinessType}
          effectiveSellingMode={effectiveSellingMode}
          availableFeatures={availableFeatures}
          selectedBusiness={selectedBusiness}
          settingsBusinessLabel={settingsBusinessLabel}
          settingsSellingLabel={settingsSellingLabel}
          activeStoreForSettings={activeStoreForSettings}
          builtForStore={builtForStore}
          toggleFeature={toggleFeature}
          defaultName={selectedBusiness.defaultName}
        />
      </div>
    </div>
  )
}

function RenameSiteModal({
  siteName,
  open,
  saving,
  onClose,
  onSave,
}: {
  siteName: string
  open: boolean
  saving: boolean
  onClose: () => void
  onSave: (name: string) => void | Promise<void>
}) {
  const [name, setName] = useState(siteName)
  useEscapeToClose(onClose, open)

  useEffect(() => {
    if (open) setName(siteName)
  }, [open, siteName])

  if (!open) return null

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card text-foreground shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Rename website</h2>
            <p className="text-xs text-gray-500 mt-0.5">Change how this site appears in Business Website Builder.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="rename-site-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Website name
            </label>
            <input
              id="rename-site-name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && name.trim() && !saving) void onSave(name.trim())
              }}
              autoFocus
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={!name.trim() || saving}
              onClick={() => void onSave(name.trim())}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
              Save name
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeleteSiteConfirmModal({
  siteName,
  open,
  deleting,
  onClose,
  onConfirm,
}: {
  siteName: string
  open: boolean
  deleting: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  useEscapeToClose(() => !deleting && onClose(), open)

  if (!open) return null

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl bg-card text-foreground shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Move to Recently deleted?</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Move &quot;{siteName}&quot; to Recently deleted
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            It stays there for 30 days — restore anytime before then, or delete permanently from Recently deleted.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void onConfirm()}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Move to Recently deleted
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CopySiteSaveAsModal({
  siteName,
  existingSiteNames,
  open,
  saving,
  onClose,
  onSave,
}: {
  siteName: string
  existingSiteNames: string[]
  open: boolean
  saving: boolean
  onClose: () => void
  onSave: (name: string) => void | Promise<void>
}) {
  const [name, setName] = useState('')
  useEscapeToClose(onClose, open)

  useEffect(() => {
    if (open) setName(suggestSiteCopyName(siteName, existingSiteNames))
  }, [open, siteName, existingSiteNames])

  if (!open) return null

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card text-foreground shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Copy template / Save As</h2>
            <p className="text-xs text-gray-500 mt-0.5">Save a copy of this site as a new website.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="copy-site-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Website name
            </label>
            <input
              id="copy-site-name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && name.trim() && !saving) void onSave(name.trim())
              }}
              autoFocus
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={!name.trim() || saving}
              onClick={() => void onSave(name.trim())}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardCopy className="w-4 h-4 mr-2" />}
              Save copy
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SiteCardMenuDivider() {
  return <div className="my-0.5 border-t border-gray-100" role="separator" />
}

function SiteCardMenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-0.5">
      <p className="px-3 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

function SiteCardMenuToggle({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  pending = false,
  icon: Icon,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  pending?: boolean
  icon?: LucideIcon
}) {
  return (
    <div
      role="menuitem"
      className="flex items-center gap-2.5 px-3 py-2"
      onClick={e => e.stopPropagation()}
    >
      {Icon ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <Icon className={cn('h-4 w-4', checked ? 'text-primary' : 'text-gray-400')} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {hint ? <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${label} ${checked ? 'on' : 'off'}`}
        disabled={disabled || pending}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-primary' : 'bg-gray-200',
          (disabled || pending) && 'cursor-not-allowed opacity-60',
        )}
      >
        {pending ? (
          <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
        ) : (
          <span
            className={cn(
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
              checked ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        )}
      </button>
    </div>
  )
}

function SiteCardMenuItem({
  icon: Icon,
  label,
  onClick,
  destructive = false,
  disabled = false,
  iconSpin = false,
  iconClassName,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
  iconSpin?: boolean
  iconClassName?: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 whitespace-nowrap px-3 py-2 text-left text-sm transition-colors',
        destructive ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-accent',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <Icon
          className={cn(
            'h-4 w-4',
            destructive ? 'text-red-500' : 'text-gray-400',
            iconSpin && 'animate-spin',
            iconClassName,
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  )
}

function SiteCard({
  site,
  stores,
  allSites,
  sameNameCount,
}: {
  site: SiteListItem
  stores: { id: string; code?: string | null; name?: string; settings?: Record<string, unknown> | null }[]
  allSites: SiteListItem[]
  sameNameCount: number
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const vendor = useVendorStore(s => s.vendor)
  const deleteSite = useDeleteSite()
  const publishSite = usePublishSite(site.id)
  const unpublishSite = useUnpublishSite(site.id)
  const updateSite = useUpdateSite(site.id)
  const { data: websiteTemplates = [] } = useWebsiteTemplates()
  const staticThumb = resolveSiteStaticThumbnail(site, websiteTemplates)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDomainPanel, setShowDomainPanel] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [copyingSite, setCopyingSite] = useState(false)
  const [downloadingExport, setDownloadingExport] = useState<SiteExportMode | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renamingSite, setRenamingSite] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [copyingPreviewLink, setCopyingPreviewLink] = useState(false)
  const [previewLinkCopied, setPreviewLinkCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const websitesListKey = websitesListQueryKey(vendor?.id)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0, openUp: false })

  const storefrontLinkMode = resolveStorefrontLinkMode(vendor?.settings)
  const isExternalSite = isBuilderSiteExternal(site, stores.length)
  const isLiveOnStorefront = isBuilderSiteEffectivelyLive(
    allSites,
    site.id,
    stores,
    vendor?.settings,
  )
  const viewLiveLinks = isExternalSite
    ? resolveExternalSiteLiveLinks({
        subdomain: site.subdomain,
        custom_domain: site.custom_domain,
        is_published: site.is_published,
      })
    : isLiveOnStorefront
      ? resolveBuilderSiteViewLiveLinks(
          vendor?.slug,
          storefrontLinkMode,
          allSites,
          site.id,
          stores,
          vendor?.settings,
        )
      : []
  const isAssignedToStore = isBuilderSiteAssignedToAnyStore(site, stores, vendor?.settings)
  const liveBlockReason = resolveBuilderSiteLiveBlockReason(
    allSites,
    site.id,
    stores,
    vendor?.settings,
  )
  const displayStatus = (() => {
    if (!isExternalSite) {
      return resolveSiteCardDisplayStatus({
        site,
        viewLiveLinksCount: viewLiveLinks.length,
        liveBlockReason,
        isAssignedToStore,
      })
    }
    if (!site.is_published) {
      return { id: 'draft' as const, ...SITE_CARD_STATUS_DISPLAY.draft }
    }
    if (viewLiveLinks.length > 0) {
      return {
        id: 'live' as const,
        ...SITE_CARD_STATUS_DISPLAY.live,
        label: 'Live — visitors can access your Other Use site',
      }
    }
    return {
      id: 'ready_for_assign' as const,
      ...SITE_CARD_STATUS_DISPLAY.ready_for_assign,
      label: 'Published — set a subdomain or custom domain in the builder',
      shortLabel: 'Needs URL',
    }
  })()
  const scopeBadge = resolveSiteScopeBadgeProps(site, stores)
  const StatusIcon = displayStatus.icon
  const showViewLive = (displayStatus.id === 'live' || (isExternalSite && site.is_published)) && viewLiveLinks.length > 0

  useEscapeToClose(() => setMenuOpen(false), menuOpen)

  useEffect(() => {
    if (!menuOpen || !menuBtnRef.current) return
    const rect = menuBtnRef.current.getBoundingClientRect()
    const menuHeight = 400
    const openUp = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight
    setMenuPos({
      top: openUp ? rect.top + window.scrollY - 4 : rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
      openUp,
    })
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        menuBtnRef.current?.contains(e.target as Node)
        || menuRef.current?.contains(e.target as Node)
      ) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleDeleteClick = () => {
    setMenuOpen(false)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteSite.mutateAsync(site.id)
      toast.success('Moved to Recently deleted — restore within 30 days')
      setDeleteConfirmOpen(false)
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to delete'))
    } finally {
      setDeleting(false)
    }
  }

  const handleTogglePublish = async (next: boolean) => {
    if (publishSite.isPending || unpublishSite.isPending) return
    try {
      if (!next) {
        await unpublishSite.mutateAsync()
        toast.success(
          isExternalSite
            ? 'Unpublished — hidden from visitors'
            : 'Removed from templates — turn on again to make it available',
        )
      } else {
        let generatedLiveUrl: string | null = null
        if (isExternalSite && externalSiteNeedsLiveUrl(site)) {
          try {
            const slug = await assignExternalSiteSubdomainWithRetry(
              sub => updateSite.mutateAsync({ subdomain: sub } as any),
              site.name,
              site.id,
            )
            generatedLiveUrl = externalSitePublicUrl(slug)
            await navigator.clipboard.writeText(generatedLiveUrl).catch(() => {})
          } catch {
            toast.error('Could not auto-generate a live URL — open the builder to set one manually')
            return
          }
        }
        await publishSite.mutateAsync()
        toast.success(
          isExternalSite
            ? (generatedLiveUrl
              ? `Published — live at ${generatedLiveUrl} (copied to clipboard)`
              : 'Published — your site is live for visitors')
            : 'Added to templates — assign it in Template Gallery',
        )
      }
    } catch {
      toast.error('Failed to update template status')
    }
  }

  const handleCopyTemplateSaveAs = () => {
    setSaveAsOpen(true)
    setMenuOpen(false)
  }

  const handleRename = () => {
    setRenameOpen(true)
    setMenuOpen(false)
  }

  const handleRenameConfirm = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (trimmed.toLowerCase() === site.name.trim().toLowerCase()) {
      setRenameOpen(false)
      return
    }
    const otherNames = (queryClient.getQueryData<SiteListItem[]>(websitesListKey) ?? [])
      .filter(s => s.id !== site.id)
      .map(s => s.name)
    if (otherNames.some(n => n.trim().toLowerCase() === trimmed.toLowerCase())) {
      toast.error('That name is already used by another website')
      return
    }
    setRenamingSite(true)
    try {
      await updateSite.mutateAsync({ name: trimmed } as any)
      toast.success(`Renamed to "${trimmed}"`)
      setRenameOpen(false)
    } catch {
      toast.error('Could not rename website')
    } finally {
      setRenamingSite(false)
    }
  }

  const handlePreview = async () => {
    if (previewing) return
    setPreviewing(true)
    try {
      await openBuilderSiteDraftPreview(site.id)
    } finally {
      setPreviewing(false)
    }
  }

  const handleCopyPreviewLink = async () => {
    if (copyingPreviewLink || previewing) return
    setCopyingPreviewLink(true)
    try {
      await copyBuilderSiteDraftPreviewLink(site.id)
      setPreviewLinkCopied(true)
      setTimeout(() => setPreviewLinkCopied(false), 2000)
    } finally {
      setCopyingPreviewLink(false)
    }
  }

  const handleSaveAsConfirm = async (name: string) => {
    setCopyingSite(true)
    try {
      const existingNames = (queryClient.getQueryData<SiteListItem[]>(websitesListKey) ?? []).map(s => s.name)
      const finalName = resolveUniqueSiteName(name, existingNames)
      const payload = await websiteApi.exportSite(site.id, 'dynamic')
      await websiteApi.importSite({
        ...payload,
        site: { ...payload.site, name: finalName },
      })
      await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
      if (finalName !== name.trim()) {
        toast.success(`Name already in use — saved as "${finalName}"`)
      } else {
        toast.success(`"${finalName}" saved — find it in Business Website Builder`)
      }
      setSaveAsOpen(false)
    } catch {
      toast.error('Could not save template copy')
    } finally {
      setCopyingSite(false)
    }
  }

  const handleDownloadExport = async (mode: SiteExportMode) => {
    if (downloadingExport) return
    setDownloadingExport(mode)
    setMenuOpen(false)
    try {
      const payload = await websiteApi.exportSite(site.id, mode)
      downloadSiteExportJson(payload, siteExportFilename(site.name, mode))
      toast.success(
        mode === 'static'
          ? 'Static site export downloaded'
          : 'Dynamic configuration export downloaded',
      )
    } catch {
      toast.error('Could not download website export')
    } finally {
      setDownloadingExport(null)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all overflow-visible group">
      {/* Thumbnail */}
      <div
        className="relative aspect-[16/10] rounded-t-xl bg-gradient-to-br from-accent via-info/10 to-primary/15 cursor-pointer overflow-hidden"
        onClick={() => navigate(`/websites/${site.id}`)}
      >
        <WebsiteSiteGlimpse
          siteId={site.id}
          vendorSlug={vendor?.slug}
          fallbackImage={staticThumb}
          templates={websiteTemplates}
          variant="card"
          scaleMode="cover"
          className="absolute inset-0"
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-semibold text-[11px] flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full">
            <Edit3 className="w-3 h-3" /> Open builder
          </span>
        </div>
        {/* Status badge */}
        <div
          className={cn('absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium', displayStatus.color)}
          title={displayStatus.label}
        >
          <StatusIcon className="w-2.5 h-2.5" />
          {displayStatus.shortLabel}
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate text-sm leading-tight">{site.name}</h3>
              {sameNameCount > 1 && (
                <span
                  className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 border border-amber-200"
                  title={`${sameNameCount} sites share this name`}
                >
                  {format(new Date(site.created_at), 'MMM d')}
                </span>
              )}
            </div>
          </div>

          {/* Menu */}
          <div className="relative shrink-0">
            <button
              ref={menuBtnRef}
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen(v => !v)}
              className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && createPortal(
              <div
                ref={menuRef}
                role="menu"
                style={{
                  position: 'absolute',
                  top: menuPos.top,
                  right: menuPos.right,
                  zIndex: 9999,
                  transform: menuPos.openUp ? 'translateY(-100%)' : undefined,
                }}
                className="min-w-[12.5rem] w-56 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl py-1"
              >
                <div className="border-b border-gray-100 px-3 py-2">
                  <p className="truncate text-xs font-medium text-gray-900">{site.name}</p>
                  <p className="text-[10px] leading-snug text-muted-foreground">{displayStatus.label}</p>
                </div>

                <SiteCardMenuGroup label="Edit">
                  <SiteCardMenuItem
                    icon={Edit3}
                    label="Open builder"
                    onClick={() => { navigate(`/websites/${site.id}`); setMenuOpen(false) }}
                  />
                  <SiteCardMenuItem
                    icon={previewing ? Loader2 : Eye}
                    label={previewing ? 'Opening preview…' : 'Preview draft'}
                    disabled={previewing || copyingPreviewLink}
                    iconSpin={previewing}
                    onClick={() => {
                      void (async () => {
                        await handlePreview()
                        setMenuOpen(false)
                      })()
                    }}
                  />
                  {showViewLive
                    ? viewLiveLinks.map(link => (
                      <SiteCardMenuItem
                        key={link.href}
                        icon={ExternalLink}
                        label={viewLiveLinks.length > 1 ? `View live · ${link.label}` : 'View live'}
                        onClick={() => { window.open(link.href, '_blank'); setMenuOpen(false) }}
                      />
                    ))
                    : (
                      <SiteCardMenuItem
                        icon={copyingPreviewLink ? Loader2 : previewLinkCopied ? Check : Copy}
                        label={previewLinkCopied ? 'Preview link copied' : 'Copy preview link'}
                        disabled={previewing || copyingPreviewLink}
                        iconSpin={copyingPreviewLink}
                        iconClassName={previewLinkCopied ? 'text-emerald-500' : undefined}
                        onClick={() => {
                          void (async () => {
                            await handleCopyPreviewLink()
                            setMenuOpen(false)
                          })()
                        }}
                      />
                    )}
                </SiteCardMenuGroup>

                {!isExternalSite ? (
                  <SiteCardMenuGroup label="Templates">
                    <SiteCardMenuToggle
                      icon={LayoutTemplate}
                      label="Template gallery"
                      hint={site.is_published ? 'On — ready to assign' : 'Off — hidden from gallery'}
                      checked={site.is_published}
                      pending={publishSite.isPending || unpublishSite.isPending}
                      onChange={next => { void handleTogglePublish(next) }}
                    />
                    {(displayStatus.id === 'ready_for_assign' || displayStatus.id === 'needs_activation') && (
                      <SiteCardMenuItem
                        icon={Store}
                        label={displayStatus.id === 'needs_activation' ? 'Activate in Templates' : 'Assign in Templates'}
                        onClick={() => { navigate('/websites/templates'); setMenuOpen(false) }}
                      />
                    )}
                  </SiteCardMenuGroup>
                ) : (
                  <SiteCardMenuGroup label="Publish">
                    <SiteCardMenuToggle
                      icon={Globe}
                      label="Publish site"
                      hint={site.is_published ? 'On — live for visitors' : 'Off — draft only'}
                      checked={site.is_published}
                      pending={publishSite.isPending || unpublishSite.isPending}
                      onChange={next => { void handleTogglePublish(next) }}
                    />
                  </SiteCardMenuGroup>
                )}

                <SiteCardMenuGroup label="Download">
                  <SiteCardMenuItem
                    icon={downloadingExport === 'static' ? Loader2 : Download}
                    label="Static data (full backup)"
                    iconSpin={downloadingExport === 'static'}
                    disabled={!!downloadingExport}
                    onClick={() => { void handleDownloadExport('static') }}
                  />
                  <SiteCardMenuItem
                    icon={downloadingExport === 'dynamic' ? Loader2 : Download}
                    label="Dynamic config (live sync)"
                    iconSpin={downloadingExport === 'dynamic'}
                    disabled={!!downloadingExport}
                    onClick={() => { void handleDownloadExport('dynamic') }}
                  />
                </SiteCardMenuGroup>

                <SiteCardMenuGroup label="Manage">
                  <SiteCardMenuItem
                    icon={Search}
                    label="SEO settings"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate(`/websites/seo?siteId=${site.id}`)
                    }}
                  />
                  <SiteCardMenuItem
                    icon={Globe2}
                    label="Custom domain"
                    onClick={() => { setShowDomainPanel(v => !v); setMenuOpen(false) }}
                  />
                  <SiteCardMenuItem
                    icon={Pencil}
                    label="Rename"
                    onClick={handleRename}
                  />
                  <SiteCardMenuItem
                    icon={ClipboardCopy}
                    label="Save a copy"
                    onClick={handleCopyTemplateSaveAs}
                  />
                </SiteCardMenuGroup>

                <SiteCardMenuDivider />
                <SiteCardMenuItem
                  icon={Trash2}
                  label="Delete"
                  destructive
                  disabled={deleting}
                  onClick={handleDeleteClick}
                />
              </div>,
              document.body,
            )}
          </div>
        </div>

        {showDomainPanel && (
          <div className="mt-3">
            <CustomDomainVerifyPanel
              siteId={site.id}
              customDomain={site.custom_domain}
              domainVerified={(site as { domain_verified?: boolean }).domain_verified}
              onUpdated={() => queryClient.invalidateQueries({ queryKey: ['websites'] })}
            />
          </div>
        )}

        {/* Scope: what this website was built for */}
        <div className="mt-2">
          <WebsiteScopeBadge {...scopeBadge} />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500">
          <span className="flex items-center gap-0.5">
            <FileText className="w-2.5 h-2.5" />
            {site.page_count} pg{site.page_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-0.5 truncate">
            <Calendar className="w-2.5 h-2.5 shrink-0" />
            {format(new Date(site.updated_at), 'MMM d, yy')}
          </span>
        </div>

        {/* CTA */}
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={previewing || copyingPreviewLink}
              className="flex-1 h-7 text-[11px] px-2 min-w-0"
              onClick={() => void handlePreview()}
            >
              {previewing ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Eye className="w-3 h-3 mr-1" />
              )}
              {previewing ? 'Opening…' : 'Preview'}
            </Button>
            {showViewLive && viewLiveLinks.length === 1 ? (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="flex-1 h-7 text-[11px] px-2 min-w-0 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
              >
                <a href={viewLiveLinks[0].href} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View live
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={previewing || copyingPreviewLink}
                title="Copy preview link"
                aria-label="Copy preview link"
                className="h-7 w-7 shrink-0 px-0"
                onClick={() => void handleCopyPreviewLink()}
              >
                {copyingPreviewLink ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : previewLinkCopied ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            )}
          </div>
          <Button
            size="sm"
            className="w-full h-7 text-[11px] px-2 bg-primary hover:bg-primary/90 text-white"
            onClick={() => navigate(`/websites/${site.id}`)}
          >
            <Edit3 className="w-3 h-3 mr-1" /> Open builder
          </Button>
        </div>
      </div>

      <RenameSiteModal
        siteName={site.name}
        open={renameOpen}
        saving={renamingSite}
        onClose={() => !renamingSite && setRenameOpen(false)}
        onSave={handleRenameConfirm}
      />

      <CopySiteSaveAsModal
        siteName={site.name}
        existingSiteNames={(queryClient.getQueryData<SiteListItem[]>(websitesListKey) ?? []).map(s => s.name)}
        open={saveAsOpen}
        saving={copyingSite}
        onClose={() => !copyingSite && setSaveAsOpen(false)}
        onSave={handleSaveAsConfirm}
      />

      <DeleteSiteConfirmModal
        siteName={site.name}
        open={deleteConfirmOpen}
        deleting={deleting}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

export default function WebsitesPage() {
  const { data: sites = [], isLoading } = useSiteList()
  const { data: storesData } = useStores({ limit: 200 })
  const stores = storesData?.stores ?? []
  const [createOpen, setCreateOpen] = useState(false)
  const [recentlyDeletedOpen, setRecentlyDeletedOpen] = useState(false)
  const [openingTemplateEditor, setOpeningTemplateEditor] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createSite = useCreateSite()

  const openTemplateEditorSandbox = async (templateName: string) => {
    if (openingTemplateEditor) return
    setOpeningTemplateEditor(true)
    try {
      // Reuse an existing template-sandbox site instead of creating a new one every time.
      const existing = (sites as SiteListItem[]).find(
        s => s.description?.startsWith('Sandbox:') && !s.is_published,
      )
      let siteId: string
      if (existing) {
        siteId = existing.id
      } else {
        const created = await createSite.mutateAsync({
          name: `Template edit — ${new Date().toISOString().slice(0, 10)}`,
          description: 'Sandbox: pick a template in the builder',
          style_config: {},
        } as any)
        siteId = created.id
      }
      try {
        const blank = await websiteApi.ensureBlankSite(siteId)
        queryClient.setQueryData(['websites', blank.id], blank)
      } catch {
        toast.error('Could not clear the template sandbox. Try again.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
      navigate(
        `/websites/${siteId}?templateMode=true&expectBlank=1&templateName=${encodeURIComponent(templateName)}`,
      )
    } catch (e) {
      toast.error(extractApiError(e, 'Could not open template editor'))
    } finally {
      setOpeningTemplateEditor(false)
    }
  }

  // Auto-open builder when arriving from template browser with ?openTemplate=<id>
  useEffect(() => {
    const templateId = searchParams.get('openTemplate')
    const templateName = searchParams.get('templateName') ?? templateId ?? 'Template'
    if (!templateId) return
    setSearchParams({}, { replace: true })
    ;(async () => {
      try {
        // Reuse an existing template-sandbox site instead of creating a new one each time.
        const existing = (sites as SiteListItem[]).find(
          s => s.description?.startsWith('Sandbox for template:') && !s.is_published,
        )
        let siteId: string
        if (existing) {
          siteId = existing.id
        } else {
          const created = await createSite.mutateAsync({
            name: `${templateName} — Template Edit`,
            description: `Sandbox for template: ${templateId}`,
            style_config: {},
          } as any)
          siteId = created.id
        }
        try {
          const blank = await websiteApi.ensureBlankSite(siteId)
          queryClient.setQueryData(['websites', blank.id], blank)
        } catch {
          toast.error('Could not clear the template sandbox. Try opening again.')
        }
        await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
        navigate(
          `/websites/${siteId}?templateMode=true&expectBlank=1&templateName=${encodeURIComponent(templateName)}`,
        )
      } catch {
        toast.error('Could not open template for editing. Make sure you are logged in.')
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const mainSites = (sites as SiteListItem[]).filter(s => !isTemplateSandboxSite(s))

  return (
    <div className="max-w-[1440px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" /> Business Website Builder
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Create your store website in minutes — pick a style, edit text and photos, then publish
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setRecentlyDeletedOpen(true)}
            className="border-primary/30 text-primary hover:bg-accent hover:border-primary/60"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Recently Deleted
          </Button>
          <Button
            variant="outline"
            disabled={openingTemplateEditor}
            onClick={() => { void openTemplateEditorSandbox('Template library') }}
            className="border-primary/30 text-primary hover:bg-accent hover:border-primary/60"
          >
            {openingTemplateEditor
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening…</>
              : <><Pencil className="w-4 h-4 mr-2" /> Edit Template</>}
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> New Website
          </Button>
        </div>
      </div>

      {/* Feature highlights */}
      {sites.length === 0 && !isLoading && (
        <div className="bg-gradient-to-br from-accent via-info/10 to-primary/10 border border-primary/20 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-md flex items-center justify-center mx-auto mb-4">
            <Globe className="w-10 h-10 text-primary/80" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Build Your First Store Website</h2>
          <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
            Choose your business type, enter your name, pick what to include — we build modern pages with photos and layouts automatically.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 text-left">
            {[
              { icon: Rocket, label: 'Guided Setup', desc: 'Business type → ready-made store website' },
              { icon: Layout, label: 'Ready Sections', desc: 'Products, services, reviews, contact, checkout' },
              { icon: Sparkles, label: 'AI Copy', desc: 'Homepage, SEO, FAQs, and CTAs generated' },
              { icon: Globe, label: 'Go Live', desc: 'Mobile-ready pages with publish checklist' },
            ].map(f => (
              <div key={f.label} className="bg-white rounded-xl p-4 shadow-sm border border-white max-h-[90vh] overflow-y-auto">
                <f.icon className="w-5 h-5 text-primary mb-2" />
                <div className="text-sm font-semibold text-gray-800">{f.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>

          <Button
            onClick={() => setCreateOpen(true)}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white shadow-lg"
          >
            <Rocket className="w-4 h-4 mr-2" /> Start Guided Setup
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary/80" />
        </div>
      )}

      {/* Sites grid */}
      {!isLoading && sites.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {mainSites.length} website{mainSites.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className={SITE_CARD_GRID}>
            {/* Add new card */}
            <button
              onClick={() => setCreateOpen(true)}
              className="border-2 border-dashed border-primary/30 rounded-xl min-h-[220px] flex flex-col items-center justify-center gap-2 text-primary/80 hover:border-primary/60 hover:bg-accent transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold">Add New Website</div>
            </button>

            {mainSites.map(site => (
              <SiteCard
                key={site.id}
                site={site}
                stores={stores}
                allSites={mainSites}
                sameNameCount={countSitesWithName(sites as SiteListItem[], site.name)}
              />
            ))}
          </div>
        </>
      )}

      {createOpen && <CreateSiteModal onClose={() => setCreateOpen(false)} />}
      {recentlyDeletedOpen && (
        <RecentlyDeletedTemplatesModal onClose={() => setRecentlyDeletedOpen(false)} />
      )}
    </div>
  )
}
