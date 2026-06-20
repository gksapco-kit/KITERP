import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import {
  Globe, Plus, ExternalLink, Edit3, Trash2, Eye, EyeOff,
  ChevronRight, ChevronLeft, ChevronDown, Info,
  MoreVertical, Loader2, Layout, FileText, Calendar,
  CheckCircle2, AlertCircle, Sparkles, Rocket, Check, Copy,
  Globe2, ClipboardCopy,
  Pencil,
  X,
  Smartphone,
  ShoppingBag,
  Wrench,
  Star,
  Mail,
  ShoppingCart,
  Search,
  ClipboardList,
  Users,
  CreditCard,
  BookOpen,
  CalendarCheck,
  GalleryHorizontal,
  Lock,
  Store,
  Palette,
  Paintbrush,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useSiteList, useCreateSite, useDeleteSite, usePublishSite, useUnpublishSite, useUpdateSite, useWebsiteTemplates } from '@/hooks/useWebsites'
import { useStores } from '@/hooks/useVendor'
import { websiteApi } from '@/api/websites'
import type { SiteListItem } from '@/types/websites'
import { cn } from '@/lib/utils'
import { extractApiError } from '@/lib/errorMessages'
import { imageCategoryForBusinessType, stylePresetForBusinessType, getAvailableSetupFeatures, getDefaultSetupFeatures, buildPagesFromSetupFeatures, buildGenerateSitePrompt, type SetupFeatureId, type SetupFeatureOption, resolveWebsiteSetupFromBusinessSettings } from '@/lib/businessSitePresets'
import {
  CUSTOM_WEBSITE_PALETTE_ID,
  DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS,
  DEFAULT_WEBSITE_COLOR_PALETTE_ID,
  getWebsiteColorPaletteLabel,
  resolveWebsitePaletteColors,
  WEBSITE_COLOR_PALETTES,
  WEBSITE_PALETTE_COLOR_FIELDS,
  type WebsiteColorPaletteId,
  type WebsitePaletteColors,
} from '@/lib/websiteColorPalettes'
import { companyTypeLabel } from '@/data/companyTypes'
import { useVendorStore } from '@/stores/vendorStore'
import { resolveSiteStoreLink } from '@/lib/liveStorefrontUrl'
import { copyBuilderSiteDraftPreviewLink, openBuilderSiteDraftPreview } from '@/lib/openBuilderSiteDraftPreview'
import { CustomDomainVerifyPanel } from '@/components/websites/CustomDomainVerifyPanel'
import { format } from 'date-fns'
import { isTemplateSandboxSite } from '@/lib/websiteSandbox'
import { countSitesWithName, resolveUniqueSiteName, suggestSiteCopyName } from '@/lib/websiteSiteNames'
import { resolveSiteStaticThumbnail } from '@/lib/websiteSitePreview'
import { WebsiteSiteGlimpse } from '@/components/websites/WebsiteSiteGlimpse'
import { WebsiteScopeBadge } from '@/components/websites/WebsiteScopeBadge'

const BUSINESS_PRESETS = [
  {
    id: 'retail',
    label: 'Healthy Retail',
    icon: '🥗',
    desc: 'Snacks, groceries, beverages, wellness',
    niche: 'healthy food and wellness retail',
    defaultName: 'My Wellness Store',
    sells: 'products',
    prompt: 'Create a healthy retail website with announcement bar, plant-based marquee highlights, split hero, shop-by-category cards, bestsellers grid, product highlights, why-choose-us features, our story timeline, testimonials, gifting CTA, FAQ, and newsletter.',
  },
  {
    id: 'services',
    label: 'Service Business',
    icon: '🧰',
    desc: 'Services, quotes, bookings, leads',
    niche: 'local service business',
    defaultName: 'My Service Business',
    sells: 'services',
    prompt: 'Create a service business website with a strong hero, service cards, instant quote request, booking section, testimonials, process steps, FAQ, contact form and location information.',
  },
  {
    id: 'restaurant',
    label: 'Restaurant / Cafe',
    icon: '🍽️',
    desc: 'Menu, location, booking, offers',
    niche: 'restaurant cafe food business',
    defaultName: 'My Restaurant',
    sells: 'both',
    prompt: 'Create a restaurant or cafe website with menu sections, gallery, offers, booking widget, opening hours, reviews, location map, newsletter and contact details.',
  },
  {
    id: 'fashion',
    label: 'Fashion / Boutique',
    icon: '👗',
    desc: 'Collections, lookbook, offers',
    niche: 'fashion boutique ecommerce',
    defaultName: 'My Boutique',
    sells: 'products',
    prompt: 'Create a premium fashion boutique website with hero collection, featured products, lookbook gallery, trust badges, reviews, recently viewed products, payment methods and newsletter signup.',
  },
  {
    id: 'electronics',
    label: 'Electronics Store',
    icon: '💻',
    desc: 'Catalog, warranty, stock, filters',
    niche: 'electronics ecommerce',
    defaultName: 'Electronics Store',
    sells: 'products',
    prompt: 'Create an electronics store website with product grid, live stock, filters, warranty highlights, offers, reviews, payment methods, FAQ, cart and checkout sections.',
  },
  {
    id: 'salon',
    label: 'Salon / Spa',
    icon: '💇',
    desc: 'Treatments, staff, booking',
    niche: 'salon spa beauty services',
    defaultName: 'My Salon',
    sells: 'services',
    prompt: 'Create a beauty salon or spa website with premium hero, services, pricing, staff/team, booking widget, testimonials, gallery, FAQ, location and contact form.',
  },
  {
    id: 'clinic',
    label: 'Clinic / Healthcare',
    icon: '🩺',
    desc: 'Trust, appointments, services',
    niche: 'clinic healthcare appointments',
    defaultName: 'My Clinic',
    sells: 'services',
    prompt: 'Create a trustworthy clinic website with services, doctor/team section, appointment booking, patient testimonials, FAQs, location map, contact form and clear call-to-action.',
  },
  {
    id: 'consulting',
    label: 'Consultant / Agency',
    icon: '📈',
    desc: 'Leads, portfolio, case studies',
    niche: 'consulting agency professional services',
    defaultName: 'My Agency',
    sells: 'services',
    prompt: 'Create a professional consultant or agency website with hero, service packages, portfolio/case study style sections, testimonials, stats, lead form, FAQ and newsletter.',
  },
]

const SELLING_MODES = [
  { id: 'products', label: 'Products', desc: 'Catalog, cart, checkout, product filters' },
  { id: 'services', label: 'Services', desc: 'Service cards, bookings, quote requests' },
  { id: 'both', label: 'Both', desc: 'Products and services on the same website' },
]

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
    label: 'Specific store',
    desc: 'Website scoped to a single business unit / outlet',
    icon: Store,
  },
  {
    id: 'external',
    label: 'External use',
    desc: 'Marketing or portfolio site on your own domain — not tied to a store',
    icon: Globe2,
  },
]

const STATUS_CONFIG = {
  draft:     { label: 'Draft — not live', shortLabel: 'Draft', icon: AlertCircle,  color: 'text-amber-600 bg-amber-50 border-amber-200' },
  published: { label: 'Live for customers', shortLabel: 'Live', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  archived:  { label: 'Archived', shortLabel: 'Archived', icon: EyeOff,       color: 'text-gray-500 bg-gray-50 border-gray-200' },
}

const SITE_CARD_GRID = 'grid grid-cols-2 lg:grid-cols-4 gap-3'

const SETUP_FEATURE_ICONS: Record<SetupFeatureId, LucideIcon> = {
  homepage_copy: FileText,
  mobile_layout: Smartphone,
  products_sections: ShoppingBag,
  services_sections: Wrench,
  reviews_trust: Star,
  contact_form: Mail,
  commerce_blocks: ShoppingCart,
  seo_content: Search,
  publish_checklist: ClipboardList,
  about_page: Users,
  services_page: Wrench,
  pricing_page: CreditCard,
  blog_page: BookOpen,
  booking_blocks: CalendarCheck,
  menu_gallery: GalleryHorizontal,
}

function SetupFeaturesPicker({
  features,
  selected,
  businessType,
  sellingMode,
  disabled,
  onToggle,
  onSelectRecommended,
}: {
  features: SetupFeatureOption[]
  selected: SetupFeatureId[]
  businessType: string
  sellingMode: string
  disabled?: boolean
  onToggle: (id: SetupFeatureId, locked?: boolean) => void
  onSelectRecommended: () => void
}) {
  const core = features.filter(f => f.locked)
  const optional = features.filter(f => !f.locked)
  const optionalSelected = optional.filter(f => selected.includes(f.id)).length

  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/80 overflow-hidden">
      <div className="px-4 py-3.5 border-b border-gray-100 bg-white/90">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">4. Your ready-made setup includes</p>
            <p className="text-xs text-gray-500 mt-0.5">Core features are always on. Toggle optional sections below.</p>
          </div>
          <span className="shrink-0 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary tabular-nums">
            {selected.length} of {features.length}
          </span>
        </div>
      </div>

      {core.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Always included</p>
          <div className="flex flex-wrap gap-2">
            {core.map(feature => {
              const Icon = SETUP_FEATURE_ICONS[feature.id]
              return (
                <div
                  key={feature.id}
                  title={feature.description}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1.5 text-[11px] font-medium text-emerald-800"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                  <Icon className="h-3.5 w-3.5 opacity-70" />
                  <span>{feature.label}</span>
                  <Lock className="h-3 w-3 opacity-40" aria-hidden />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {optional.length > 0 && (
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Optional sections
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 tabular-nums">{optionalSelected}/{optional.length} on</span>
              <button
                type="button"
                disabled={disabled}
                onClick={onSelectRecommended}
                className="text-[10px] font-semibold text-primary hover:text-primary/80 disabled:opacity-50"
              >
                Reset to recommended
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {optional.map(feature => {
              const Icon = SETUP_FEATURE_ICONS[feature.id]
              const checked = selected.includes(feature.id)
              return (
                <button
                  key={feature.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggle(feature.id, false)}
                  aria-pressed={checked}
                  className={cn(
                    'group relative flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                    checked
                      ? 'border-primary bg-primary/[0.06] shadow-sm shadow-primary/10'
                      : 'border-gray-200 bg-white hover:border-primary/30 hover:bg-gray-50/80',
                    disabled && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                      checked ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-primary/10 group-hover:text-primary',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 min-w-0 pr-6">
                    <span className={cn('block text-xs font-semibold leading-tight', checked ? 'text-gray-900' : 'text-gray-800')}>
                      {feature.label}
                    </span>
                    <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                      {feature.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all',
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
      )}

      <div className="px-4 py-3 bg-gray-50/90 border-t border-gray-100">
        <p className="text-[11px] text-gray-500 leading-relaxed flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            We generate pages, modern layouts, and category photos from your{' '}
            <strong className="font-medium text-gray-700">{businessType}</strong> setup
            {sellingMode !== 'both' ? ` (${sellingMode})` : ''}.
          </span>
        </p>
      </div>
    </div>
  )
}

function ColorPalettePicker({
  selected,
  customColors,
  disabled,
  onSelect,
  onCustomColorsChange,
}: {
  selected: WebsiteColorPaletteId
  customColors: WebsitePaletteColors
  disabled?: boolean
  onSelect: (id: WebsiteColorPaletteId) => void
  onCustomColorsChange: (colors: WebsitePaletteColors) => void
}) {
  const activeColors = resolveWebsitePaletteColors(selected, customColors)
  const isCustom = selected === CUSTOM_WEBSITE_PALETTE_ID

  const updateCustomColor = (key: keyof WebsitePaletteColors, value: string) => {
    onCustomColorsChange({ ...customColors, [key]: value })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/80 overflow-hidden">
      <div className="px-4 py-3.5 border-b border-gray-100 bg-white/90">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Choose your color palette</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Pick a preset or draft your own colors for the website. You can fine-tune these in the builder later.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {getWebsiteColorPaletteLabel(selected)}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {WEBSITE_COLOR_PALETTES.map(palette => {
            const checked = selected === palette.id
            return (
              <button
                key={palette.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(palette.id)}
                aria-pressed={checked}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                  checked
                    ? 'border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/20'
                    : 'border-gray-200 bg-white hover:border-primary/30 hover:shadow-sm',
                  disabled && 'opacity-60 cursor-not-allowed',
                )}
              >
                <div className="flex h-14 items-stretch border-b border-gray-100" aria-hidden>
                  <span className="flex-[2]" style={{ backgroundColor: palette.colors.primary_color }} />
                  <span className="flex-1" style={{ backgroundColor: palette.colors.accent_color }} />
                  <span
                    className="flex-1 border-l border-gray-100"
                    style={{ backgroundColor: palette.colors.bg_color }}
                  />
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-xs font-semibold text-gray-900">{palette.label}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500 leading-snug line-clamp-2">
                    {palette.description}
                  </p>
                </div>
                {checked && (
                  <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                    <Check className="h-3 w-3 stroke-[3]" aria-hidden />
                  </span>
                )}
              </button>
            )
          })}

          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(CUSTOM_WEBSITE_PALETTE_ID)}
            aria-pressed={isCustom}
            className={cn(
              'group relative flex flex-col overflow-hidden rounded-xl border-2 border-dashed text-left transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
              isCustom
                ? 'border-primary bg-primary/[0.04] shadow-sm shadow-primary/10 ring-1 ring-primary/20'
                : 'border-gray-300 bg-white hover:border-primary/40 hover:bg-gray-50/80',
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          >
            <div className="flex h-14 items-stretch border-b border-gray-100" aria-hidden>
              <span className="flex-[2]" style={{ backgroundColor: customColors.primary_color }} />
              <span className="flex-1" style={{ backgroundColor: customColors.accent_color }} />
              <span
                className="flex-1 border-l border-gray-100"
                style={{ backgroundColor: customColors.bg_color }}
              />
            </div>
            <div className="px-3 py-2.5">
              <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                <Paintbrush className="h-3.5 w-3.5 text-primary" />
                Custom palette
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">
                Draft your own primary, accent, and background colors.
              </p>
            </div>
            {isCustom && (
              <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                <Check className="h-3 w-3 stroke-[3]" aria-hidden />
              </span>
            )}
          </button>
        </div>

        {isCustom && (
          <div className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-semibold text-gray-900">Draft your palette</p>
              <div
                className="flex h-8 flex-1 max-w-[220px] overflow-hidden rounded-lg border border-gray-200 shadow-inner"
                aria-hidden
              >
                {WEBSITE_PALETTE_COLOR_FIELDS.map(({ key }) => (
                  <span key={key} className="flex-1" style={{ backgroundColor: customColors[key] }} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WEBSITE_PALETTE_COLOR_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/80 px-2.5 py-2">
                  <input
                    type="color"
                    value={customColors[key]}
                    disabled={disabled}
                    onChange={e => updateCustomColor(key, e.target.value)}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5"
                    aria-label={`${label} color`}
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`palette-${key}`} className="block text-xs font-medium text-gray-700">
                      {label}
                    </label>
                    <input
                      id={`palette-${key}`}
                      type="text"
                      value={customColors[key]}
                      disabled={disabled}
                      onChange={e => {
                        const v = e.target.value.trim()
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateCustomColor(key, v)
                      }}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        if (!/^#[0-9A-Fa-f]{6}$/.test(v)) {
                          updateCustomColor(key, customColors[key])
                        }
                      }}
                      className="mt-0.5 w-full bg-transparent font-mono text-[11px] text-gray-500 outline-none"
                      spellCheck={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isCustom && (
          <div
            className="flex h-10 overflow-hidden rounded-xl border border-gray-200 shadow-inner"
            aria-label="Selected palette preview"
          >
            <span className="flex-[2]" style={{ backgroundColor: activeColors.primary_color }} />
            <span className="flex-1" style={{ backgroundColor: activeColors.accent_color }} />
            <span className="flex-1" style={{ backgroundColor: activeColors.bg_color }} />
            <span className="flex-1 border-l border-gray-100" style={{ backgroundColor: activeColors.surface_color }} />
            <span className="w-10" style={{ backgroundColor: activeColors.text_color }} />
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-gray-50/90 border-t border-gray-100">
        <p className="text-[11px] text-gray-500 leading-relaxed flex items-start gap-2">
          <Palette className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            Your palette applies to buttons, heroes, cards, and CTAs across every generated page.
          </span>
        </p>
      </div>
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
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedPaletteId, setSelectedPaletteId] = useState<WebsiteColorPaletteId>(DEFAULT_WEBSITE_COLOR_PALETTE_ID)
  const [customPaletteColors, setCustomPaletteColors] = useState<WebsitePaletteColors>(
    DEFAULT_CUSTOM_WEBSITE_PALETTE_COLORS,
  )

  const isExternalScope = websiteStoreScope === 'external'
  const showStoreScopePicker = storeCount > 1
  const currentScopeOption = WEBSITE_STORE_SCOPE_OPTIONS.find(o => o.id === websiteStoreScope)
  const activeStoreForSettings = websiteStoreScope === 'store' && websiteStoreId
    ? stores.find(s => s.id === websiteStoreId)
    : singleStore ?? stores.find(s => s.is_default) ?? stores[0]

  const settingsSetup = resolveWebsiteSetupFromBusinessSettings(vendor, activeStoreForSettings)
  const effectiveBusinessType = isExternalScope ? businessType : settingsSetup.businessTypeId
  const effectiveSellingMode = isExternalScope ? sellingMode : settingsSetup.sellingMode

  const selectedBusiness = BUSINESS_PRESETS.find(t => t.id === effectiveBusinessType) || BUSINESS_PRESETS[0]
  const availableFeatures = getAvailableSetupFeatures(effectiveBusinessType, effectiveSellingMode)
  const settingsBusinessLabel = companyTypeLabel(
    (activeStoreForSettings?.settings as Record<string, unknown> | undefined)?.company_type as string
      || vendor?.business_type,
  )
  const settingsSellingLabel = SELLING_MODES.find(s => s.id === settingsSetup.sellingMode)?.label ?? 'Both'

  useEffect(() => {
    if (storeCount <= 1) {
      setWebsiteStoreScope('store')
      if (singleStore) setWebsiteStoreId(singleStore.id)
      return
    }
    setWebsiteStoreScope(prev => (prev === 'store' || prev === 'all' || prev === 'external' ? prev : 'store'))
  }, [storeCount, singleStore?.id])

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
    setBusinessType(settingsSetup.businessTypeId)
    setSellingMode(settingsSetup.sellingMode)
  }, [isExternalScope, settingsSetup.businessTypeId, settingsSetup.sellingMode])

  useEffect(() => {
    setSelectedFeatures(getDefaultSetupFeatures(effectiveBusinessType, effectiveSellingMode))
  }, [effectiveBusinessType, effectiveSellingMode])

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
    const siteDesc = `${selectedBusiness.label} website for ${effectiveSellingMode === 'both' ? 'products and services' : effectiveSellingMode}.`
    const imageCategoryId = imageCategoryForBusinessType(effectiveBusinessType)
    const businessStylePreset = stylePresetForBusinessType(effectiveBusinessType)
    const paletteColors = resolveWebsitePaletteColors(selectedPaletteId, customPaletteColors)
    const stylePreset = {
      ...businessStylePreset,
      ...paletteColors,
      color_palette_id: selectedPaletteId,
    }
    const pages = buildPagesFromSetupFeatures(selectedFeatures, effectiveSellingMode)
    const selectedStore = stores.find(s => s.id === websiteStoreId)
    const resolvedScope = storeCount <= 1 ? 'store' : websiteStoreScope
    try {
      const site = await createSite.mutateAsync({
        name: siteName,
        description: siteDesc,
        style_config: {
          ...stylePreset,
          image_category_id: imageCategoryId,
          business_type: effectiveBusinessType,
          selling_mode: effectiveSellingMode,
          website_store_scope: resolvedScope,
          website_store_id: resolvedScope === 'store' ? (websiteStoreId || singleStore?.id) : null,
          website_store_name: resolvedScope === 'store'
            ? (selectedStore?.name || singleStore?.name)
            : null,
        },
      } as any)
      toast.success('Website created. Building your pages…')
      onClose()
      navigate(`/websites/${site.id}`)
      setGenerating(true)

      try {
        const selling = SELLING_MODES.find(s => s.id === effectiveSellingMode)
        const gen = await websiteApi.aiGenerateSite(site.id, {
          business_description: buildGenerateSitePrompt(
            effectiveBusinessType,
            selectedBusiness.label,
            siteName,
            effectiveSellingMode,
            selling?.desc || effectiveSellingMode,
            selectedBusiness.prompt,
            selectedFeatures,
          ),
          niche: selectedBusiness.niche,
          tone: 'professional',
          pages,
          include_pricing: selectedFeatures.includes('pricing_page'),
          include_blog: selectedFeatures.includes('blog_page'),
          image_category: imageCategoryId,
          selling_mode: effectiveSellingMode,
          site_name: siteName,
          business_type: effectiveBusinessType,
          setup_features: selectedFeatures,
        })
        gen.style_config = {
          ...(gen.style_config || {}),
          ...paletteColors,
          color_palette_id: selectedPaletteId,
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className={cn(
          'bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto transition-[max-width] duration-300',
          step === 1 ? 'max-w-xl' : step === 2 ? 'max-w-4xl' : 'max-w-3xl',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary to-info px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                <Globe className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold leading-tight">Create Website</h2>
                  <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                    Step {step} of {WIZARD_STEPS}
                  </span>
                </div>
                <p className="text-primary-foreground/85 text-sm mt-1">
                  {step === 1
                    ? 'Choose where this website is used and give it a name.'
                    : step === 2
                      ? isExternalScope
                        ? 'External marketing site — pick business type and what you sell.'
                        : 'Store website — business type and catalog come from Business Settings.'
                      : 'Pick a color palette for your draft website.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          {/* Step progress */}
          <div className="mt-4 flex items-center gap-2">
            {Array.from({ length: WIZARD_STEPS }, (_, i) => i + 1).map(s => (
              <span
                key={s}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-all duration-300',
                  s <= step ? 'bg-white' : 'bg-white/25',
                )}
              />
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
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

            {storeCount === 1 && singleStore && (
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-accent/60 to-accent/20 px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Store className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{singleStore.name}</p>
                    <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">
                      Business type and what you sell are taken from{' '}
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

            {showStoreScopePicker && (
            <div>
              <label htmlFor="website-scope" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Globe className="h-3 w-3" />
                </span>
                For which store are you creating the website?
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
                  <label htmlFor="website-bu" className="block text-xs font-semibold text-gray-600 mb-1.5">Business unit</label>
                  <div className="relative">
                    <Store className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Select
                      id="website-bu"
                      value={websiteStoreId}
                      onChange={setWebsiteStoreId}
                      options={stores.map(s => ({
                        value: s.id,
                        label: `${s.name}${s.code ? ` (${s.code})` : ''}`,
                      }))}
                      aria-label="Business unit"
                      className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm"
                    />
                  </div>
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
                    onChange={setSellingMode}
                    options={SELLING_MODES.map(s => ({ value: s.id, label: s.label }))}
                    aria-label="Selling mode"
                    className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500 leading-snug">{SELLING_MODES.find(s => s.id === sellingMode)?.desc}</p>
              </div>
            </div>
            )}

            <SetupFeaturesPicker
              features={availableFeatures}
              selected={selectedFeatures}
              businessType={selectedBusiness.label}
              sellingMode={effectiveSellingMode}
              disabled={isLoading}
              onToggle={toggleFeature}
              onSelectRecommended={() => setSelectedFeatures(getDefaultSetupFeatures(effectiveBusinessType, effectiveSellingMode))}
            />
            </>
            )}

            {step === 3 && (
            <ColorPalettePicker
              selected={selectedPaletteId}
              customColors={customPaletteColors}
              disabled={isLoading}
              onSelect={handlePaletteSelect}
              onCustomColorsChange={setCustomPaletteColors}
            />
            )}

            <div className="-mx-6 -mb-6 mt-1 flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4">
              {step === 1 ? (
                <>
                  <p className="hidden text-xs text-gray-400 sm:block">Next: choose your ready-made setup</p>
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
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {generating ? 'Generating website…' : 'Build My Website'}
                  </Button>
                </>
              )}
            </div>
          </div>
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
            <p className="text-xs text-gray-500 mt-0.5">Change how this site appears in Website Builder.</p>
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

function SiteCard({
  site,
  stores,
  sameNameCount,
}: {
  site: SiteListItem
  stores: { id: string; code?: string | null }[]
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
  const [renameOpen, setRenameOpen] = useState(false)
  const [renamingSite, setRenamingSite] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [copyingPreviewLink, setCopyingPreviewLink] = useState(false)
  const [previewLinkCopied, setPreviewLinkCopied] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0, openUp: false })

  const testUrl = resolveSiteStoreLink(vendor?.slug, site, stores)

  useEscapeToClose(() => setMenuOpen(false), menuOpen)

  useEffect(() => {
    if (!menuOpen || !menuBtnRef.current) return
    const rect = menuBtnRef.current.getBoundingClientRect()
    const menuHeight = 320
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

  const statusCfg = STATUS_CONFIG[site.status] || STATUS_CONFIG.draft
  const StatusIcon = statusCfg.icon

  const handleDelete = async () => {
    if (!confirm(`Delete "${site.name}"? This cannot be undone.`)) return
    try {
      await deleteSite.mutateAsync(site.id)
      toast.success('Site deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleTogglePublish = async () => {
    try {
      if (site.is_published) {
        await unpublishSite.mutateAsync()
        toast.success('Store taken offline — customers will no longer see this site')
      } else {
        await publishSite.mutateAsync()
        toast.success('Store is live! Customers can now visit your site.')
      }
    } catch {
      toast.error('Failed to update status')
    }
    setMenuOpen(false)
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
    const otherNames = (queryClient.getQueryData<SiteListItem[]>(['websites']) ?? [])
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
      const existingNames = (queryClient.getQueryData<SiteListItem[]>(['websites']) ?? []).map(s => s.name)
      const finalName = resolveUniqueSiteName(name, existingNames)
      const payload = await websiteApi.exportSite(site.id)
      await websiteApi.importSite({
        ...payload,
        site: { ...payload.site, name: finalName },
      })
      await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
      if (finalName !== name.trim()) {
        toast.success(`Name already in use — saved as "${finalName}"`)
      } else {
        toast.success(`"${finalName}" saved — find it in Website Builder`)
      }
      setSaveAsOpen(false)
    } catch {
      toast.error('Could not save template copy')
    } finally {
      setCopyingSite(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all overflow-visible group">
      {/* Thumbnail */}
      <div
        className="relative h-24 rounded-t-xl bg-gradient-to-br from-accent via-info/10 to-primary/15 cursor-pointer overflow-hidden"
        onClick={() => navigate(`/websites/${site.id}`)}
      >
        <WebsiteSiteGlimpse
          siteId={site.id}
          vendorSlug={vendor?.slug}
          fallbackImage={staticThumb}
          templates={websiteTemplates}
          className="absolute inset-0"
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-semibold text-[11px] flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full">
            <Edit3 className="w-3 h-3" /> Open Builder
          </span>
        </div>
        {/* Status badge */}
        <div
          className={cn('absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium', statusCfg.color)}
          title={statusCfg.label}
        >
          <StatusIcon className="w-2.5 h-2.5" />
          {statusCfg.shortLabel}
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
                className="w-52 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl py-1 max-h-[min(90vh,20rem)] overflow-y-auto"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { navigate(`/websites/${site.id}`); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-accent"
                >
                  <Edit3 className="w-4 h-4 text-gray-400" /> Open Builder
                </button>
                {testUrl && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { window.open(testUrl, '_blank'); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-accent"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-400" /> View Store
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowDomainPanel(v => !v); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-accent"
                >
                  <Globe2 className="w-4 h-4 text-gray-400" /> Custom domain
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleTogglePublish}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-accent"
                >
                  {site.is_published
                    ? <><EyeOff className="w-4 h-4 text-gray-400" /> Take offline</>
                    : <><Eye className="w-4 h-4 text-gray-400" /> Publish store</>
                  }
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleRename}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-accent"
                >
                  <Pencil className="w-4 h-4 text-gray-400" /> Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleCopyTemplateSaveAs}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-accent"
                >
                  <ClipboardCopy className="w-4 h-4 text-gray-400" /> Copy template / Save As
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
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
          <WebsiteScopeBadge
            scope={site.website_store_scope}
            storeName={site.website_store_name}
          />
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
        existingSiteNames={(queryClient.getQueryData<SiteListItem[]>(['websites']) ?? []).map(s => s.name)}
        open={saveAsOpen}
        saving={copyingSite}
        onClose={() => !copyingSite && setSaveAsOpen(false)}
        onSave={handleSaveAsConfirm}
      />
    </div>
  )
}

export default function WebsitesPage() {
  const { data: sites = [], isLoading } = useSiteList()
  const { data: storesData } = useStores({ limit: 200 })
  const stores = storesData?.stores ?? []
  const [createOpen, setCreateOpen] = useState(false)
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
            <Globe className="w-6 h-6 text-primary" /> Website Builder
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Create your store website in minutes — pick a style, edit text and photos, then publish
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                sameNameCount={countSitesWithName(sites as SiteListItem[], site.name)}
              />
            ))}
          </div>
        </>
      )}

      {createOpen && <CreateSiteModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
