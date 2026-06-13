import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVendorStore } from '@/stores/vendorStore'
import { useAuthStore } from '@/stores/authStore'
import { useUpdateVendor, useUpdateStore, useStores, vendorKeys } from '@/hooks/useVendor'
import type { StoreRecord } from '@/api/vendor'
import { useBusinessUnitScopeLabel, type BusinessUnitScopeMode } from '@/hooks/useBusinessUnitScope'
import StoresPage from '@/pages/stores'
import { StoresListToolbar } from '@/components/business-units/StoresListToolbar'
import BusinessUnitDetailPanel from '@/components/business-units/BusinessUnitDetailPanel'
import { StorefrontLinkModeToggle } from '@/components/business-units/StorefrontLinkModeToggle'
import { BusinessUnitDetailNav } from '@/components/business-units/BusinessUnitDetailNav'
import { vendorApi } from '@/api/vendor'
import {
  resolveStorefrontLinkMode,
  STOREFRONT_LINK_MODE_KEY,
  type StorefrontLinkMode,
} from '@/lib/liveStorefrontUrl'
import {
  resolveBrandingMode,
  BRANDING_MODE_KEY,
  type BrandingMode,
} from '@/lib/brandingMode'
import { BrandingModeToggle } from '@/components/business-units/BrandingModeToggle'
import {
  Save, Loader2, Store, MapPin, FileText, Globe,
  Clock, ChevronDown, ChevronUp, Building2, Phone,
  Camera, ImageIcon, X, Eye, Copy, ExternalLink, ShoppingBag,
  ChevronRight, Check,
  Info, CheckCircle2, Landmark, HelpCircle, Lock, Building, Plus,
  Link2, AlertCircle, BadgeCheck, Mail, Star, Server, ListChecks, ShieldCheck,
} from 'lucide-react'
import {
  buildSelfManagedDnsRecords,
  type ExternalDomainDnsMode,
} from '@/lib/externalDomainDns'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { cn } from '@/lib/utils'
import { companyTypeLabel } from '@/data/companyTypes'
import { BUSINESS_UNIT_STORE_LABEL } from '@/lib/businessUnitLabels'
import { getBusinessUnitVisual } from '@/lib/businessUnitVisuals'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import {
  galleryImageToFile,
  resolveBrandingImageUrl,
} from '@/components/common/MediaUploadPickerModal'
import { useImageSourcePicker } from '@/components/common/ImageSourcePicker'
import {
  FormPageWithNav,
  FormSectionNav,
  formDisplayCompact,
  useFormActiveSection,
} from '@/components/common/FormSectionNav'
import type { FormSectionDef } from '@/components/common/FormSectionNav'
import type { Vendor } from '@/types'
import { ImageCropModal } from '@/components/common/ImageCropModal'
import {
  ClickableImageButton,
  ImageLightboxSession,
  SingleImagePreview,
  urlsToLightboxItems,
} from '@/components/common/CatalogMediaLightbox'
import { APP_VERSION, APP_BUILD, LAST_UPDATED, CHANGELOG } from '@/constants/vendorAppMeta'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { APP_SAVE_REQUEST_EVENT } from '@/lib/appSave'
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  SettingsDirtyProvider,
  useSettingsDirtyContext,
  useSettingsSectionDirty,
} from '@/pages/settings/SettingsDirtyContext'
import {
  isAddressSectionDirty,
  isBusinessHoursSectionDirty,
  isContactSectionDirty,
  isExternalDomainSectionDirty,
  isOrderAcceptanceSectionDirty,
  isProfileSectionDirty,
  isTaxSectionDirty,
  supportEmailsFromVendor,
  supportPhonesFromVendor,
} from '@/pages/settings/settingsDirtyHelpers'

type Section = 'profile' | 'contact' | 'address' | 'tax' | 'hours-availability' | 'order-acceptance' | 'external-domain'

function submitSettingsSectionForms(sectionKey: string): boolean {
  const sectionEl = document.getElementById(`form-section-${sectionKey}`)
  if (!sectionEl) return false

  const editableForms = Array.from(sectionEl.querySelectorAll<HTMLFormElement>('form')).filter(
    (form) => !form.querySelector('fieldset[disabled]'),
  )
  if (editableForms.length === 0) return false

  for (const form of editableForms) {
    form.requestSubmit()
  }
  return true
}

function vendorStatusLabel(status?: string | null): string {
  switch (status) {
    case 'approved':
      return 'Approved'
    case 'pending':
      return 'Pending review'
    case 'rejected':
      return 'Rejected'
    case 'suspended':
      return 'Suspended'
    default:
      return status ? status.replace(/_/g, ' ') : 'Unknown'
  }
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace('/api/v1', '')
function mediaUrl(url?: string | null) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_BASE}${url}`
}

const OFFERING_OPTIONS = [
  { value: 'products', label: 'Products Only' },
  { value: 'services', label: 'Services Only' },
  { value: 'both', label: 'Products & Services' },
]

function settingsScopeHelpText(mode: BusinessUnitScopeMode, scopeLabel: string): string {
  const picker = BUSINESS_UNIT_STORE_LABEL
  switch (mode) {
    case 'all':
      return `${scopeLabel}. Change ${picker} in the top bar to edit settings for a single branch.`
    case 'unit':
    case 'single':
      return `${scopeLabel}. Change ${picker} in the top bar to switch branches or view all units.`
    case 'none':
      return `${scopeLabel}. Select a ${picker} in the top bar to scope settings to one branch.`
  }
}

/** Derive green "Done" markers from saved vendor / unit data. */
function computeSettingsCompletedSections(
  vendor: Vendor | null,
  activeStore: StoreRecord | undefined,
  allBusinessUnitsMode: boolean,
): Set<string> {
  const done = new Set<string>()
  if (!vendor) return done

  const ext = vendor as Vendor & {
    external_domain_enabled?: boolean
    external_domain_name?: string
    external_domain_access_status?: string
  }

  if (vendor.business_name?.trim() || vendor.display_name?.trim()) {
    done.add('profile')
  }

  if (vendor.support_phone?.trim() || vendor.support_email?.trim()) {
    done.add('contact')
  }

  const unitAddr = activeStore?.address
  const hasUnitAddress = Boolean(unitAddr?.street?.trim() && unitAddr?.city?.trim())
  const hasHqAddress = Boolean(vendor.street_address?.trim() && vendor.city?.trim())
  if (allBusinessUnitsMode ? hasHqAddress : hasUnitAddress || hasHqAddress) {
    done.add('address')
  }

  if (vendor.gstin?.trim() || vendor.pan_number?.trim()) {
    done.add('tax')
  }

  if (vendor.business_hours && Object.keys(vendor.business_hours).length > 0) {
    done.add('hours-availability')
  }

  const customOrderHours =
    vendor.order_acceptance_hours != null && Object.keys(vendor.order_acceptance_hours).length > 0
  if (vendor.order_acceptance_enabled === false || customOrderHours || done.has('hours-availability')) {
    done.add('order-acceptance')
  }

  const domainStatus = ext.external_domain_access_status
  if (domainStatus === 'active') {
    done.add('external-domain')
  }

  return done
}

function computeSettingsPendingSections(vendor: Vendor | null): Set<string> {
  const pending = new Set<string>()
  if (!vendor) return pending

  const ext = vendor as Vendor & { external_domain_access_status?: string }
  if (ext.external_domain_access_status === 'pending') {
    pending.add('external-domain')
  }

  return pending
}

export default function SettingsPage() {
  return (
    <SettingsDirtyProvider>
      <SettingsPageBody />
    </SettingsDirtyProvider>
  )
}

function SettingsPageBody() {
  const vendor = useVendorStore((s) => s.vendor)
  const selectedStore = useVendorStore((s) => s.selectedStore)
  const setSelectedStore = useVendorStore((s) => s.setSelectedStore)
  const { user } = useAuthStore()
  const { data: storesData } = useStores()
  const stores = [...(storesData?.stores ?? [])].sort((a, b) => {
    const an = parseInt(a.code ?? '', 10)
    const bn = parseInt(b.code ?? '', 10)
    if (!isNaN(an) && !isNaN(bn)) return an - bn
    if (!isNaN(an)) return -1
    if (!isNaN(bn)) return 1
    return (a.code ?? '').localeCompare(b.code ?? '')
  })
  const { label: scopeLabel, heading: scopeHeading, mode: scopeMode, storeId: scopeStoreId } =
    useBusinessUnitScopeLabel()
  /** No branch filter — show Business Units hub instead of single-store overview card. */
  const allBusinessUnitsMode = scopeMode === 'all'
  const activeStoreRecord = selectedStore
    ? stores.find((s) => s.id === selectedStore.id)
    : stores.length === 1
      ? stores[0]
      : undefined
  const showUnitDetailInSettings = !allBusinessUnitsMode && Boolean(activeStoreRecord)
  const showUnitsZone = allBusinessUnitsMode || (showUnitDetailInSettings && Boolean(activeStoreRecord))
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const updateVendor = useUpdateVendor()
  const { hasDirty, hasDirtyRef, discardAll, formResetKey } = useSettingsDirtyContext()

  const storefrontLinkMode = resolveStorefrontLinkMode(vendor?.settings)
  const handleSetStorefrontLinkMode = useCallback(
    (mode: StorefrontLinkMode) => {
      const current = useVendorStore.getState().vendor
      if (!current) return
      if (resolveStorefrontLinkMode(current.settings) === mode) {
        if (mode === 'single') navigate('/websites/templates?singleFront=1')
        return
      }
      updateVendor.mutate(
        {
          settings: { ...(current.settings ?? {}), [STOREFRONT_LINK_MODE_KEY]: mode },
        },
        {
          onSuccess: () => {
            if (mode === 'single') navigate('/websites/templates?singleFront=1')
          },
        },
      )
    },
    [navigate, updateVendor],
  )

  const brandingMode = resolveBrandingMode(vendor?.settings)
  const handleSetBrandingMode = useCallback(
    (mode: BrandingMode) => {
      const current = useVendorStore.getState().vendor
      if (!current) return
      if (resolveBrandingMode(current.settings) === mode) return
      updateVendor.mutate({
        settings: { ...(current.settings ?? {}), [BRANDING_MODE_KEY]: mode },
      })
    },
    [updateVendor],
  )

  // Deep-link: /settings?section=order-acceptance opens that accordion automatically
  const VALID_SECTIONS: Section[] = ['profile', 'contact', 'address', 'tax', 'hours-availability', 'order-acceptance', 'external-domain']
  const rawSection = searchParams.get('section')
  const sectionParam = (rawSection && VALID_SECTIONS.includes(rawSection as Section) ? rawSection as Section : null)
  const [openSection, setOpenSection] = useState<Section | null>(sectionParam ?? 'profile')
  const [buListSearch, setBuListSearch] = useState('')
  const [visitedSections, setVisitedSections] = useState<Set<string>>(() =>
    new Set(sectionParam ? [sectionParam] : ['profile']),
  )

  const completedSections = useMemo(
    () => computeSettingsCompletedSections(vendor, activeStoreRecord, allBusinessUnitsMode),
    [vendor, activeStoreRecord, allBusinessUnitsMode],
  )

  const pendingSections = useMemo(
    () => computeSettingsPendingSections(vendor),
    [vendor],
  )

  useEffect(() => {
    if (!openSection) return
    setVisitedSections((prev) => {
      if (prev.has(openSection)) return prev
      const next = new Set(prev)
      next.add(openSection)
      return next
    })
  }, [openSection])

  const settingsSections = useMemo<FormSectionDef[]>(() => [
    { key: 'profile',          label: 'Business Profile',       icon: Store },
    { key: 'contact',          label: 'Contact Information',     icon: Phone },
    { key: 'address',          label: 'Addresses',               icon: MapPin },
    { key: 'tax',              label: 'Tax & Compliance',        icon: FileText },
    { key: 'hours-availability', label: 'Business Hours',        icon: Clock },
    { key: 'order-acceptance', label: 'Online Orders',           icon: ShoppingBag },
    { key: 'external-domain',  label: 'External Domain',         icon: Globe },
  ], [])

  const openSectionsMap = useMemo<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {}
    settingsSections.forEach(s => { m[s.key] = openSection === s.key })
    return m
  }, [openSection, settingsSections])

  /** Align opened section header with the sticky dashboard bar + sidebar top. */
  const scrollFormSectionIntoView = useCallback((key: string) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`form-section-${key}`)?.scrollIntoView({ behavior: 'auto', block: 'start' })
      })
    })
  }, [])

  const saveOpenSection = useCallback(async (): Promise<boolean> => {
    const key = (openSection ?? sectionParam) as Section | null
    if (!key) {
      toast.error('Open a settings section to save.')
      return false
    }
    if (!hasDirtyRef.current) return true

    const trySubmit = () => submitSettingsSectionForms(key)
    if (!trySubmit()) {
      if (openSection !== key) {
        setOpenSection(key)
        await new Promise((r) => window.setTimeout(r, 250))
      }
      if (!trySubmit()) {
        toast.error('Expand the section and fix any errors before saving.')
        return false
      }
    }

    const deadline = Date.now() + 12000
    while (Date.now() < deadline) {
      if (!hasDirtyRef.current) return true
      await new Promise((r) => window.setTimeout(r, 100))
    }

    toast.error('Could not save — check highlighted fields and try again.')
    return false
  }, [openSection, sectionParam, hasDirtyRef])

  const {
    dialogOpen: unsavedDialogOpen,
    saving: unsavedSaving,
    handleCancel: handleUnsavedCancel,
    handleDiscard: handleUnsavedDiscard,
    handleSave: handleUnsavedSave,
    confirmIfDirty,
  } = useUnsavedChangesGuard({
    when: hasDirty,
    onSave: saveOpenSection,
    onDiscard: discardAll,
  })

  const openAndScrollTo = useCallback((key: string) => {
    setOpenSection(key as Section)
    window.setTimeout(() => scrollFormSectionIntoView(key), 180)
  }, [scrollFormSectionIntoView])

  const requestOpenSection = useCallback((key: string) => {
    if (openSection === key) return
    confirmIfDirty(() => openAndScrollTo(key))
  }, [openSection, confirmIfDirty, openAndScrollTo])

  const toggleSection = useCallback((key: Section) => {
    if (openSection === key) {
      confirmIfDirty(() => setOpenSection(null))
      return
    }
    requestOpenSection(key)
  }, [openSection, confirmIfDirty, requestOpenSection])

  // URL ?section= deep-link (from search, nav, or first load)
  useEffect(() => {
    if (!sectionParam) return
    if (sectionParam === openSection) return
    requestOpenSection(sectionParam)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to URL section param
  }, [sectionParam])

  // Custom event — fired when already on settings page (e.g. Configure button in BU panel)
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent<string>).detail
      if (key) requestOpenSection(key)
    }
    window.addEventListener('open-settings-section', handler)
    return () => window.removeEventListener('open-settings-section', handler)
  }, [requestOpenSection])

  // Toolbar Save — universal header button (settings page handler)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      const key = (openSection ?? sectionParam) as Section | null
      if (!key) {
        toast.error('Open a settings section to save.')
        return
      }
      if (submitSettingsSectionForms(key)) return
      if (openSection !== key) {
        openAndScrollTo(key)
        window.setTimeout(() => {
          if (!submitSettingsSectionForms(key)) {
            toast.error('Could not save — expand the section and try again.')
          }
        }, 220)
        return
      }
      toast.error('Could not save — expand the section and try again.')
    }
    window.addEventListener(APP_SAVE_REQUEST_EVENT, handler)
    return () => window.removeEventListener(APP_SAVE_REQUEST_EVENT, handler)
  }, [openSection, sectionParam, openAndScrollTo])

  const showSupportAuditLink =
    !!vendor?.id &&
    !!user?.vendor_role?.vendor_id &&
    user.vendor_role.vendor_id === vendor.id &&
    (user.vendor_role.role === 'owner' || user.vendor_role.role === 'platform_staff')

  const supportAuditChip = showSupportAuditLink ? (
    <Link
      to="/settings/support-activity"
      className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full border border-blue-200/80 bg-blue-50/60 px-1.5 text-[0.65rem] font-medium text-blue-800 hover:bg-blue-100/80 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
    >
      <HelpCircle className="h-2.5 w-2.5 shrink-0" />
      <span className="hidden sm:inline">Support audit</span>
      <span className="sm:hidden">Audit</span>
    </Link>
  ) : null

  const statusChip = (
    <div
      className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-1.5 text-[0.65rem] text-muted-foreground"
      title={vendor?.status ?? undefined}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${vendor?.status === 'approved' ? 'bg-green-500' : 'bg-amber-500'}`} />
      {vendorStatusLabel(vendor?.status)}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="space-y-1">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h1
            className="flex min-w-0 shrink-0 flex-wrap items-baseline gap-x-1 text-base font-bold text-foreground sm:text-lg"
            title={`Settings — ${scopeHeading}`}
          >
            <span>Settings</span>
            <span className="min-w-0 max-w-[9rem] truncate text-xs font-semibold text-muted-foreground sm:max-w-none sm:text-sm">
              {scopeHeading}
            </span>
          </h1>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-0.5 sm:gap-1">
            {allBusinessUnitsMode && (
              <StoresListToolbar
                stores={stores}
                listSearch={buListSearch}
                onListSearchChange={setBuListSearch}
                vendorSlug={vendor?.slug ?? ''}
                vendorSettings={vendor?.settings as Record<string, unknown> | undefined}
                variant="inline"
              />
            )}
            <Button
              asChild
              size="sm"
              className="h-6 gap-1 rounded-full px-2 text-[0.68rem] shadow-sm ring-1 ring-primary/25 hover:shadow-md sm:px-2.5"
            >
              <Link
                to="/stores"
                title={`Create new ${BUSINESS_UNIT_STORE_LABEL}`}
              >
                <Plus className="h-3 w-3 shrink-0" />
                New unit
              </Link>
            </Button>
            <button
              type="button"
              onClick={() => requestOpenSection('external-domain')}
              className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/40 px-1.5 text-[0.68rem] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary sm:gap-1 sm:px-2"
            >
              <Globe className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">External Domain</span>
              <span className="sm:hidden">Domain</span>
            </button>
            {supportAuditChip}
            {statusChip}
          </div>
        </div>

        <p className="text-[0.7rem] text-muted-foreground leading-snug">
          {settingsScopeHelpText(scopeMode, scopeLabel)}
        </p>
      </div>

      {showUnitsZone && (
        <section
          aria-labelledby="settings-units-heading"
          className="rounded-xl border border-border bg-muted/20 shadow-sm"
        >
          <header className="flex flex-col gap-2 border-b border-border bg-card/90 px-4 py-2.5 lg:flex-row lg:items-start lg:justify-between">
            {allBusinessUnitsMode ? (
              <div className="min-w-0">
                <h2
                  id="settings-units-heading"
                  className="flex min-w-0 flex-wrap items-center gap-2"
                >
                  <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                    Step 1 · Units
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                    All business units
                  </span>
                </h2>
                <p className="mt-1 text-xs text-foreground/70">
                  Pick a unit to scope settings, or add a new branch.
                </p>
              </div>
            ) : activeStoreRecord ? (
              <BusinessUnitDetailNav
                className="w-full"
                stores={stores}
                activeStore={activeStoreRecord}
                storefrontLinkMode={storefrontLinkMode}
                onBack={() => confirmIfDirty(() => setSelectedStore(null))}
                onSelectStore={(store) =>
                  confirmIfDirty(() =>
                    setSelectedStore({
                      id: store.id,
                      name: store.name,
                      code: store.code,
                      description: store.description,
                    }),
                  )
                }
              />
            ) : null}

            {allBusinessUnitsMode && stores.length > 0 ? (
              <StorefrontLinkModeToggle
                mode={storefrontLinkMode}
                pending={updateVendor.isPending}
                onConfirm={handleSetStorefrontLinkMode}
              />
            ) : null}
          </header>
          <div className="p-4">
            {allBusinessUnitsMode ? (
              <StoresPage
                embeddedInSettings
                hideToolbar
                listSearch={buListSearch}
                onListSearchChange={setBuListSearch}
              />
            ) : (
              activeStoreRecord && (
                <BusinessUnitDetailPanel
                  key={activeStoreRecord.id}
                  store={activeStoreRecord}
                  embeddedInSettings
                />
              )
            )}
          </div>
        </section>
      )}

      <section
        aria-labelledby="settings-config-heading"
        className="rounded-xl border border-border bg-card shadow-sm"
      >
        <header className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <h2
              id="settings-config-heading"
              className="flex min-w-0 flex-wrap items-center gap-2"
            >
              {showUnitsZone ? (
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                  Step 2 · Configuration
                </span>
              ) : null}
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">{scopeLabel}</span>
            </h2>
            <p className="mt-1 text-xs text-foreground/70">
              Profile, Contact, Addresses, Tax, Hours, Online Orders, and Domain.
            </p>
          </div>

          {/* Right side: branding toggle (all-units) or badge (single BU) */}
          {allBusinessUnitsMode && stores.length > 0 ? (
            <BrandingModeToggle
              mode={brandingMode}
              pending={updateVendor.isPending}
              onConfirm={handleSetBrandingMode}
            />
          ) : showUnitsZone && !allBusinessUnitsMode ? (() => {
            const badge = brandingMode === 'shared'
              ? { label: 'Common Branding for All BUs / Stores', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300' }
              : { label: 'Unique Branding Per BU / Store', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300' }
            return (
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Logo &amp; Banner Branding
                </span>
                <span
                  title="Logo & banner branding mode"
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
            )
          })() : null}
        </header>

        <div className="px-3 py-4 sm:px-4">
          <FormPageWithNav
            activeSectionKey={openSection}
            nav={(
              <FormSectionNav
                sections={settingsSections}
                openSections={openSectionsMap}
                visitedSections={visitedSections}
                completedSections={completedSections}
                pendingSections={pendingSections}
                hasErrorSections={new Set<string>()}
                onNavigate={requestOpenSection}
                highlightKey={openSection}
                scrollOffset={72}
                stickyTopClass="top-14"
                navTitle="Sections"
                showActiveHintInNav={false}
              />
            )}
          >
            <div key={`${formResetKey}-${scopeStoreId ?? 'all-units'}`} className="flex flex-col gap-4">
          <div id="form-section-profile" className={formDisplayCompact.scrollMarginView}>
            <ProfileSection
              vendor={vendor}
              activeStore={activeStoreRecord}
              unitBrandingEditable={
                brandingMode === 'per_unit' &&
                !allBusinessUnitsMode &&
                Boolean(activeStoreRecord)
              }
              showVendorBranding={brandingMode === 'shared' || allBusinessUnitsMode}
              open={openSection === 'profile'}
              toggle={() => toggleSection('profile')}
              onSave={updateVendor}
            />
          </div>
          <div id="form-section-contact" className={formDisplayCompact.scrollMarginView}>
            <ContactSection
              vendor={vendor}
              open={openSection === 'contact'}
              toggle={() => toggleSection('contact')}
              onSave={updateVendor}
            />
          </div>
          <div id="form-section-address" className={formDisplayCompact.scrollMarginView}>
            <AddressSection
              vendor={vendor}
              activeStore={activeStoreRecord}
              hqEditable={allBusinessUnitsMode}
              unitEditable={!allBusinessUnitsMode && Boolean(activeStoreRecord)}
              open={openSection === 'address'}
              toggle={() => toggleSection('address')}
              onSaveVendor={updateVendor}
            />
          </div>
          <div id="form-section-tax" className={formDisplayCompact.scrollMarginView}>
            <TaxSection
              vendor={vendor}
              open={openSection === 'tax'}
              toggle={() => toggleSection('tax')}
              onSave={updateVendor}
            />
          </div>
          <div id="form-section-hours-availability" className={formDisplayCompact.scrollMarginView}>
            <BusinessHoursSection
              vendor={vendor}
              open={openSection === 'hours-availability'}
              toggle={() => toggleSection('hours-availability')}
              onSave={updateVendor}
            />
          </div>
          <div id="form-section-order-acceptance" className={formDisplayCompact.scrollMarginView}>
            <OrderAcceptanceSection
              vendor={vendor}
              open={openSection === 'order-acceptance'}
              toggle={() => toggleSection('order-acceptance')}
              onSave={updateVendor}
            />
          </div>
          <div id="form-section-external-domain" className={formDisplayCompact.scrollMarginView}>
            <ExternalDomainSection
              vendor={vendor}
              open={openSection === 'external-domain'}
              toggle={() => toggleSection('external-domain')}
              onSave={updateVendor}
            />
          </div>
          <div className="border-t border-border pt-4 flex justify-end">
            <Link
              to="/about"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
              App version &amp; support info
            </Link>
          </div>
            </div>
          </FormPageWithNav>
        </div>
      </section>

      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        saving={unsavedSaving}
        onCancel={handleUnsavedCancel}
        onDiscard={handleUnsavedDiscard}
        onSave={handleUnsavedSave}
      />
    </div>
  )
}

interface SectionProps {
  vendor: Vendor | null
  open: boolean
  toggle: () => void
  onSave: ReturnType<typeof useUpdateVendor>
}

function SectionWrapper({
  title,
  icon: Icon,
  subtitle: subtitleOverride,
  helpText,
  badge,
  open,
  toggle,
  children,
}: {
  title: string
  icon: React.ElementType
  subtitle?: string
  helpText?: string
  badge?: React.ReactNode
  open: boolean
  toggle: () => void
  children: React.ReactNode
}) {
  const { label: scopeLabel } = useBusinessUnitScopeLabel()
  return (
    <CollapsibleSection
      title={title}
      icon={Icon}
      subtitle={subtitleOverride ?? scopeLabel}
      helpText={helpText}
      badge={badge}
      open={open}
      toggle={toggle}
    >
      {children}
    </CollapsibleSection>
  )
}

function SaveButton({ loading, compact }: { loading: boolean; compact?: boolean }) {
  return (
    <Button
      type="submit"
      disabled={loading}
      className={cn('gap-1.5', compact && 'h-8 px-3 text-xs')}
    >
      {loading ? (
        <Loader2 className={cn('animate-spin', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      ) : (
        <Save className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      )}
      {compact ? 'Save' : 'Save Changes'}
    </Button>
  )
}

// â”€â”€ Profile Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ProfileSectionProps = SectionProps & {
  activeStore?: StoreRecord
  /** When a single BU is scoped, logo/banner save to that unit — not vendor-wide. */
  unitBrandingEditable: boolean
  /**
   * When true (single-link mode or all-BU view), show and allow editing the vendor-level branding.
   * When false (unique-per-BU mode with one unit selected), hide vendor branding — each BU manages its own.
   */
  showVendorBranding?: boolean
}

function storeSettingStr(settings: Record<string, unknown> | undefined, key: string): string {
  const v = settings?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

function storeExtraBannersList(settings: Record<string, unknown> | undefined): string[] {
  const raw = settings?.extra_banners
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

/** Ignore vendor signup default — not a real business category label. */
function normalizeBusinessCategorySource(raw: string | undefined): string {
  const v = (raw || '').trim()
  if (!v || v.toLowerCase() === 'individual') return ''
  return v
}

function resolveProfileBusinessCategory(
  vendor: { business_type?: string } | null | undefined,
  activeStore: StoreRecord | undefined,
  storeSettings: Record<string, unknown>,
  allStores: StoreRecord[] | undefined,
): { label: string; hint: string } {
  const fromActiveUnit = normalizeBusinessCategorySource(storeSettingStr(storeSettings, 'company_type'))
  if (fromActiveUnit) {
    return {
      label: companyTypeLabel(fromActiveUnit),
      hint: activeStore
        ? `Category selected when ${activeStore.name || 'this business unit'} was created.`
        : 'Category selected when this business unit was created.',
    }
  }

  const stores = allStores ?? []
  const fallbackStore = activeStore ?? stores.find((s) => s.is_default) ?? stores[0]
  const fromFallbackUnit = normalizeBusinessCategorySource(
    storeSettingStr(fallbackStore?.settings as Record<string, unknown> | undefined, 'company_type'),
  )
  if (fromFallbackUnit) {
    return {
      label: companyTypeLabel(fromFallbackUnit),
      hint: fallbackStore?.name
        ? `Category from business unit “${fallbackStore.name}”. Select a unit in the top bar to see its own category.`
        : 'Category from your business unit setup.',
    }
  }

  const fromVendor = normalizeBusinessCategorySource(vendor?.business_type)
  if (fromVendor) {
    return {
      label: companyTypeLabel(fromVendor),
      hint: 'Industry type from account registration. Set per business unit when creating a branch.',
    }
  }

  return {
    label: '—',
    hint: 'Choose a category when creating a business unit, or during signup.',
  }
}

function ProfileSection({ vendor, activeStore: activeStoreProp, unitBrandingEditable, showVendorBranding = true, open, toggle, onSave }: ProfileSectionProps) {
  const qc = useQueryClient()
  const setVendor = useVendorStore((s) => s.setVendor)
  const { data: storesData } = useStores()
  const activeStore = activeStoreProp
    ? storesData?.stores?.find((s) => s.id === activeStoreProp.id) ?? activeStoreProp
    : undefined
  const storeSettings = (activeStore?.settings ?? {}) as Record<string, unknown>
  const [form, setForm] = useState({
    business_name: '',
    display_name: '',
    description: '',
    offering_type: 'both' as string,
  })
  const [logoUploading, setLogoUploading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [extraBannerUploading, setExtraBannerUploading] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropTarget, setCropTarget] = useState<'logo' | 'banner' | null>(null)
  const [bannerLightboxIndex, setBannerLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    if (vendor) {
      setForm({
        business_name: vendor.business_name || '',
        display_name: vendor.display_name || '',
        description: vendor.description || '',
        offering_type: vendor.offering_type || 'both',
      })
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave.mutate({ ...form, offering_type: form.offering_type as 'products' | 'services' | 'both' })
  }

  const isDirty = useMemo(() => isProfileSectionDirty(form, vendor), [form, vendor])
  useSettingsSectionDirty('profile', isDirty)

  const handleLogoFileSelected = (file: File) => {
    setCropFile(file)
    setCropTarget('logo')
  }

  const handleBannerFileSelected = (file: File) => {
    setCropFile(file)
    setCropTarget('banner')
  }

  const uploadLogoFile = async (croppedFile: File) => {
    setLogoUploading(true)
    try {
      if (unitBrandingEditable && activeStore) {
        const { url } = await vendorApi.uploadVendorBrandingAsset(croppedFile)
        await persistUnitBrandingSettings({ logo_url: url })
      } else {
        const { logo_url } = await vendorApi.uploadVendorLogo(croppedFile)
        if (vendor) setVendor({ ...vendor, logo_url })
        await qc.invalidateQueries({ queryKey: ['vendor', 'me'] })
      }
    } catch {
      toast.error('Could not upload logo — use a PNG or JPG file under 2MB')
      throw new Error('logo upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  const handleCropConfirm = async (croppedFile: File) => {
    const target = cropTarget
    setCropFile(null)
    setCropTarget(null)
    if (target === 'logo') {
      await uploadLogoFile(croppedFile)
      toast.success(unitBrandingEditable ? 'Unit logo updated' : 'Logo updated')
    } else if (target === 'banner') {
      setBannerUploading(true)
      try {
        if (unitBrandingEditable && activeStore) {
          const { url } = await vendorApi.uploadVendorBrandingAsset(croppedFile)
          const next = orderedBanners.length === 0 ? [url] : [url, ...orderedBanners.slice(1)]
          await persistBannerOrder(next)
          toast.success('Unit banner updated')
        } else {
          const { banner_url } = await vendorApi.uploadVendorBanner(croppedFile)
          if (vendor) setVendor({ ...vendor, banner_url })
          await qc.invalidateQueries({ queryKey: ['vendor', 'me'] })
          toast.success('Banner updated')
        }
      } catch {
        toast.error('Could not upload banner — use a PNG or JPG file under 5MB')
      }
      setBannerUploading(false)
    }
  }

  const persistUnitBrandingSettings = async (patch: Record<string, unknown>) => {
    if (!activeStore) return
    const settings = { ...storeSettings, ...patch }
    const { store } = await vendorApi.updateStore(activeStore.id, { settings })
    qc.setQueryData(
      vendorKeys.stores(),
      (old: { stores: StoreRecord[]; total: number } | undefined) => {
        if (!old?.stores) return old
        return {
          ...old,
          stores: old.stores.map((s) => (s.id === store.id ? store : s)),
        }
      },
    )
    void qc.invalidateQueries({ queryKey: vendorKeys.stores() })
    return store
  }

  const removeLogo = () => {
    if (unitBrandingEditable && activeStore) {
      void persistUnitBrandingSettings({ logo_url: '' }).then(() => toast.success('Unit logo removed'))
      return
    }
    onSave.mutate({ logo_url: '' })
  }

  const syncThemeExtraBanners = (extra_banners: string[]) => {
    const current = useVendorStore.getState().vendor
    if (!current) return
    setVendor({
      ...current,
      theme_config: { ...(current.theme_config || {}), extra_banners },
    })
  }

  const extraBanners: string[] = unitBrandingEditable
    ? storeExtraBannersList(storeSettings)
    : (vendor?.theme_config as { extra_banners?: string[] } | undefined)?.extra_banners ?? []

  const unitVisual = unitBrandingEditable && activeStore ? getBusinessUnitVisual(activeStore, vendor, 'per_unit') : null
  const businessCategory = useMemo(
    () => resolveProfileBusinessCategory(vendor, activeStore, storeSettings, storesData?.stores),
    [vendor, activeStore, storeSettings, storesData?.stores],
  )
  const displayLogoUrl = unitBrandingEditable
    ? (unitVisual?.logoUrl ?? '')
    : (vendor?.logo_url ? resolveBrandingImageUrl(vendor.logo_url) : '')
  const hasLogoOverride = unitBrandingEditable
    ? Boolean(storeSettingStr(storeSettings, 'logo_url'))
    : Boolean(vendor?.logo_url?.trim())

  const orderedBanners = useMemo(() => {
    const primary = unitBrandingEditable
      ? storeSettingStr(storeSettings, 'banner_url')
      : vendor?.banner_url?.trim()
    const list: string[] = []
    if (primary) list.push(primary)
    for (const u of extraBanners) {
      const trimmed = u?.trim()
      if (trimmed && !list.includes(trimmed)) list.push(trimmed)
    }
    return list
  }, [unitBrandingEditable, storeSettings, vendor?.banner_url, extraBanners])

  const persistBannerOrder = useCallback(async (banners: string[]) => {
    const banner_url = banners[0] ?? ''
    const extra_banners = banners.slice(1)
    if (unitBrandingEditable && activeStore) {
      await persistUnitBrandingSettings({ banner_url, extra_banners })
      return
    }
    const current = useVendorStore.getState().vendor
    if (!current) return
    const theme_config = { ...(current.theme_config || {}), extra_banners }
    const updated = await vendorApi.updateMyVendor({ banner_url, theme_config })
    setVendor(updated)
    void qc.invalidateQueries({ queryKey: vendorKeys.me() })
  }, [activeStore, qc, setVendor, unitBrandingEditable, storeSettings])

  const removeBannerAt = async (index: number) => {
    const urlToRemove = orderedBanners[index]
    if (!urlToRemove) return
    const next = orderedBanners.filter((_, i) => i !== index)
    try {
      await persistBannerOrder(next)
      try {
        await vendorApi.removeVendorExtraBanner(urlToRemove)
        void qc.invalidateQueries({ queryKey: vendorKeys.me() })
      } catch {
        /* file cleanup best-effort */
      }
      toast.success('Banner removed')
    } catch {
      toast.error('Could not remove banner')
    }
  }

  const setPrimaryBanner = async (index: number) => {
    if (index <= 0 || index >= orderedBanners.length) return
    const next = [
      orderedBanners[index],
      ...orderedBanners.slice(0, index),
      ...orderedBanners.slice(index + 1),
    ]
    try {
      await persistBannerOrder(next)
      toast.success('Primary banner updated')
    } catch {
      toast.error('Could not update primary banner')
    }
  }

  const uploadExtraBannerFile = async (file: File) => {
    setExtraBannerUploading(true)
    try {
      if (unitBrandingEditable && activeStore) {
        const { url } = await vendorApi.uploadVendorBrandingAsset(file)
        await persistBannerOrder([...orderedBanners, url])
        toast.success('Banner added')
      } else {
        const { extra_banners } = await vendorApi.uploadVendorExtraBanner(file)
        syncThemeExtraBanners(extra_banners)
        void qc.invalidateQueries({ queryKey: vendorKeys.me() })
        toast.success('Banner added')
      }
    } catch {
      toast.error('Could not upload banner — use a PNG or JPG under 5MB')
    } finally {
      setExtraBannerUploading(false)
    }
  }

  const removeExtraBanner = async (url: string) => {
    const index = orderedBanners.indexOf(url)
    if (index >= 0) {
      await removeBannerAt(index)
      return
    }
    try {
      const { extra_banners } = await vendorApi.removeVendorExtraBanner(url)
      syncThemeExtraBanners(extra_banners)
      void qc.invalidateQueries({ queryKey: vendorKeys.me() })
      toast.success('Banner removed')
    } catch {
      toast.error('Could not remove banner')
    }
  }

  type BrandingTarget = 'logo' | 'banner' | 'extra-banner'

  const applyBrandingImageUrl = async (url: string, target: BrandingTarget) => {
    if (target === 'logo') {
      if (unitBrandingEditable && activeStore) {
        await persistUnitBrandingSettings({ logo_url: url })
      } else {
        await onSave.mutateAsync({ logo_url: url })
      }
      toast.success('Logo updated')
      return
    }
    if (target === 'banner') {
      if (unitBrandingEditable && activeStore) {
        if (orderedBanners.length === 0) {
          await persistBannerOrder([url])
        } else {
          await persistBannerOrder([...orderedBanners, url])
        }
      } else if (orderedBanners.length === 0) {
        await onSave.mutateAsync({ banner_url: url })
      } else {
        await persistBannerOrder([...orderedBanners, url])
      }
      toast.success('Banner updated')
      return
    }
    toast.error('Extra banners must be uploaded as files')
  }

  const applyBrandingFromFile = async (file: File, target: BrandingTarget) => {
    if (target === 'logo') {
      handleLogoFileSelected(file)
      return
    }
    if (target === 'banner') {
      handleBannerFileSelected(file)
      return
    }
    if (target !== 'extra-banner') return
    await uploadExtraBannerFile(file)
  }

  const applyBrandingFromRemoteImage = async (url: string, target: BrandingTarget) => {
    try {
      const file = await galleryImageToFile(url)
      await applyBrandingFromFile(file, target)
    } catch {
      if (target === 'extra-banner') {
        toast.error('Could not load that image — try another from the gallery or upload from device')
        return
      }
      try {
        await applyBrandingImageUrl(url, target)
      } catch {
        toast.error('Could not use that image URL')
      }
    }
  }

  const { openPicker: openLogoPicker, modal: logoPickerModal } = useImageSourcePicker({
    title: 'Logo',
    accept: 'image/jpeg,image/png,image/webp',
    onFile: (file) => { void applyBrandingFromFile(file, 'logo') },
    onUrl: (url) => { void applyBrandingFromRemoteImage(url, 'logo') },
  })

  const { openPicker: openBannerPicker, modal: bannerPickerModal } = useImageSourcePicker({
    title: 'Store banner',
    accept: 'image/jpeg,image/png,image/webp',
    onFile: (file) => { void applyBrandingFromFile(file, 'banner') },
    onUrl: (url) => { void applyBrandingFromRemoteImage(url, 'banner') },
  })

  const { openPicker: openExtraBannerPicker, modal: extraBannerPickerModal } = useImageSourcePicker({
    title: 'Additional banner',
    accept: 'image/jpeg,image/png,image/webp',
    onFile: (file) => { void applyBrandingFromFile(file, 'extra-banner') },
    onUrl: (url) => { void applyBrandingFromRemoteImage(url, 'extra-banner') },
  })

  const imgUrl = resolveBrandingImageUrl

  const bannerLightboxItems = useMemo(
    () => urlsToLightboxItems(
      orderedBanners.map((u) => imgUrl(u)),
      { idPrefix: 'banner', altText: (i) => `Banner ${i + 1}` },
    ),
    [orderedBanners],
  )

  const saveBannerAtIndex = async (index: number, file: File) => {
    setBannerUploading(true)
    try {
      let url: string
      if (unitBrandingEditable && activeStore) {
        const result = await vendorApi.uploadVendorBrandingAsset(file)
        url = result.url
      } else if (index === 0) {
        const { banner_url } = await vendorApi.uploadVendorBanner(file)
        url = banner_url
      } else {
        const result = await vendorApi.uploadVendorBrandingAsset(file)
        url = result.url
      }
      const next = [...orderedBanners]
      if (index < next.length) next[index] = url
      else next.push(url)
      await persistBannerOrder(next)
    } catch {
      toast.error('Could not upload banner — use a PNG or JPG file under 5MB')
      throw new Error('banner upload failed')
    } finally {
      setBannerUploading(false)
    }
  }

  return (
    <SectionWrapper title="Business Profile" helpText="Name, branding, logo, and banners" icon={Store} open={open} toggle={toggle}>
      {/* Image crop modal */}
      {cropFile && cropTarget && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={cropTarget === 'logo' ? 1 : 3}
          title={cropTarget === 'logo' ? 'Crop Logo' : 'Crop Store Banner'}
          onConfirm={handleCropConfirm}
          onCancel={() => { setCropFile(null); setCropTarget(null) }}
        />
      )}

      {logoPickerModal}
      {bannerPickerModal}
      {extraBannerPickerModal}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Logo & banner — shown when: (a) vendor branding (single mode or all-BU view), or (b) per-unit branding editor */}
        {(showVendorBranding || unitBrandingEditable) ? (
        <div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">
              {unitBrandingEditable ? `${activeStore?.name ?? 'Unit'} branding` : 'Store branding'}
            </span>
            <span className="text-xs text-muted-foreground">
              {unitBrandingEditable
                ? 'Applies to this unit only · PNG/JPG · banner 3:1'
                : 'PNG/JPG · banner 3:1 · default for all units'}
            </span>
          </div>
          <div className="flex items-stretch gap-2">
            <div className="relative shrink-0">
              {logoUploading ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : displayLogoUrl ? (
                <SingleImagePreview
                  url={displayLogoUrl}
                  alt="Logo"
                  resolveUrl={(u) => u}
                  editable
                  onSave={uploadLogoFile}
                  className="h-14 w-14 rounded-lg border border-dashed border-gray-300 bg-gray-50"
                  imgClassName="h-full w-full rounded-lg object-cover"
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openLogoPicker() }}
                    title="Replace logo"
                    className="absolute bottom-0.5 right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/80"
                  >
                    <Camera className="h-3 w-3" />
                  </button>
                </SingleImagePreview>
              ) : (
                <button
                  type="button"
                  onClick={() => openLogoPicker()}
                  title="Upload logo"
                  className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-blue-400"
                >
                  <Building2 className="h-5 w-5 text-gray-400" />
                </button>
              )}
              {hasLogoOverride && (
                <button
                  type="button"
                  aria-label="Remove logo"
                  onClick={removeLogo}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-background bg-destructive text-xs text-destructive-foreground shadow-sm hover:bg-destructive/90"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
              <span className="mt-0.5 block text-center text-xs text-muted-foreground">Logo</span>
            </div>

            {/* Banners grid: compact list — delete shifts others up; any banner can be set primary */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {orderedBanners.length === 0 ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => openBannerPicker()}
                      title="Upload primary banner (1200×400)"
                      className="group relative flex h-16 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-blue-400"
                    >
                      {bannerUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : (
                        <span className="flex flex-col items-center gap-0.5 text-gray-400">
                          <ImageIcon className="h-4 w-4" />
                          <span className="text-[10px]">Primary</span>
                        </span>
                      )}
                    </button>
                    <span className="mt-0.5 block text-center text-[10px] text-muted-foreground">Banner 1</span>
                  </div>
                ) : (
                  orderedBanners.map((url, i) => (
                    <div key={url} className="relative">
                      {i === 0 ? (
                        <div className="group relative flex h-16 w-full overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
                          {bannerUploading ? (
                            <div className="flex h-full w-full items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            </div>
                          ) : (
                            <ClickableImageButton
                              src={imgUrl(url)}
                              alt="Banner 1"
                              className="h-full w-full"
                              imgClassName="h-full w-full object-cover"
                              onClick={() => setBannerLightboxIndex(i)}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => openBannerPicker()}
                            title="Replace primary banner"
                            className="absolute bottom-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/80"
                          >
                            <Camera className="h-3 w-3" />
                          </button>
                          <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-primary px-1 py-0.5 text-[9px] font-semibold leading-none text-white shadow-sm">
                            Primary
                          </span>
                        </div>
                      ) : (
                        <div className="group relative flex h-16 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                          <ClickableImageButton
                            src={imgUrl(url)}
                            alt={`Banner ${i + 1}`}
                            className="h-full w-full"
                            imgClassName="h-full w-full object-cover"
                            onClick={() => setBannerLightboxIndex(i)}
                          />
                          <button
                            type="button"
                            onClick={() => void setPrimaryBanner(i)}
                            title="Move to Banner 1 (primary)"
                            className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-white/95 px-1 py-0.5 text-[9px] font-semibold leading-none text-primary shadow-sm transition-colors hover:bg-primary hover:text-white"
                          >
                            <Star className="h-2.5 w-2.5" />
                            Primary
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove banner ${i + 1}`}
                        onClick={() => void removeBannerAt(i)}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-background bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                      <span className="mt-0.5 block text-center text-[10px] text-muted-foreground">Banner {i + 1}</span>
                    </div>
                  ))
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => (orderedBanners.length === 0 ? openBannerPicker() : openExtraBannerPicker())}
                    title="Add another banner"
                    className="flex h-16 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    {extraBannerUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (
                      <span className="flex flex-col items-center gap-0.5 text-gray-400">
                        <span className="text-lg leading-none">+</span>
                        <span className="text-[10px]">Add banner</span>
                      </span>
                    )}
                  </button>
                  <span className="mt-0.5 block text-center text-[10px] text-muted-foreground opacity-0">·</span>
                </div>
              </div>
              <ImageLightboxSession
                items={bannerLightboxItems}
                openIndex={bannerLightboxIndex}
                onClose={() => setBannerLightboxIndex(null)}
                editable
                onSaveImage={saveBannerAtIndex}
              />
            </div>
          </div>
        </div>
        ) : (
          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Per-unit branding active.</span>{' '}
            Each business unit uses its own logo and banners. Switch to{' '}
            <span className="font-semibold text-foreground">Common Branding for All BUs / Stores</span>{' '}
            in the Units section to manage shared branding here.
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-1 flex items-center gap-1">
              <Label className="text-xs font-medium">Business name</Label>
              <button
                type="button"
                className="inline-flex text-muted-foreground hover:text-foreground"
                title="Legal / registered name (e.g. on invoices). Store URL is unchanged."
                aria-label="About business name"
              >
                <HelpCircle className="h-3 w-3" />
              </button>
            </div>
            <Input
              className="h-8 text-sm"
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              minLength={2}
              maxLength={255}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1">
              <Label className="text-xs font-medium">Brand name</Label>
              <button
                type="button"
                className="inline-flex text-muted-foreground hover:text-foreground"
                title="Public name shown on your business front and customer-facing pages."
                aria-label="About brand name"
              >
                <HelpCircle className="h-3 w-3" />
              </button>
            </div>
            <Input
              className="h-8 text-sm"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1">
              <Label className="text-xs font-medium text-muted-foreground">Business category</Label>
              <button
                type="button"
                className="inline-flex text-muted-foreground hover:text-foreground"
                title={businessCategory.hint}
                aria-label="About business category"
              >
                <HelpCircle className="h-3 w-3" />
              </button>
            </div>
            <div
              className="flex h-8 w-full items-center rounded-md border border-border bg-muted/60 px-2.5 text-sm text-muted-foreground"
              aria-readonly="true"
              title={businessCategory.hint}
            >
              <span className="truncate">{businessCategory.label}</span>
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium">Offering type</Label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              value={form.offering_type}
              onChange={(e) => setForm({ ...form, offering_type: e.target.value })}
            >
              {OFFERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">Description</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{form.description.length}/2000</span>
          </div>
          <textarea
            rows={3}
            className="flex min-h-[4.5rem] w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm leading-snug"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Tell customers about your business..."
            maxLength={2000}
          />
        </div>

        <div className="flex justify-end border-t border-border/60 pt-2">
          <SaveButton loading={onSave.isPending} />
        </div>
      </form>
    </SectionWrapper>
  )
}

// ── Contact Section ───────────────────────────────────────────────────────────

function ContactSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [supportEmails, setSupportEmails] = useState<string[]>([''])
  const [supportPhones, setSupportPhones] = useState<string[]>([''])

  useEffect(() => {
    if (vendor) {
      setSupportEmails(supportEmailsFromVendor(vendor))
      setSupportPhones(supportPhonesFromVendor(vendor))
    }
  }, [vendor])

  const updateSupportEmail = (index: number, value: string) => {
    setSupportEmails((prev) => prev.map((e, i) => (i === index ? value : e)))
  }

  const addSupportEmail = () => {
    setSupportEmails((prev) => [...prev, ''])
  }

  const removeSupportEmail = (index: number) => {
    setSupportEmails((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)))
  }

  const updateSupportPhone = (index: number, value: string) => {
    setSupportPhones((prev) => prev.map((p, i) => (i === index ? value : p)))
  }

  const addSupportPhone = () => {
    setSupportPhones((prev) => [...prev, ''])
  }

  const removeSupportPhone = (index: number) => {
    setSupportPhones((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedPhones = supportPhones.map((p) => p.trim()).filter(Boolean)
    const trimmedEmails = supportEmails.map((em) => em.trim()).filter(Boolean)
    onSave.mutate({
      support_email: trimmedEmails[0] || undefined,
      support_phone: trimmedPhones[0] || undefined,
      settings: {
        ...(vendor?.settings || {}),
        support_emails: trimmedEmails.slice(1),
        support_phones: trimmedPhones.slice(1),
      },
    } as Partial<Vendor>)
  }

  const isDirty = useMemo(
    () => isContactSectionDirty(supportEmails, supportPhones, vendor),
    [supportEmails, supportPhones, vendor],
  )
  useSettingsSectionDirty('contact', isDirty)

  return (
    <SectionWrapper title="Contact Information" helpText="Phone, email, and support details" icon={Phone} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Business Support Email</Label>
            <div className="space-y-2">
              {supportEmails.map((email, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {index > 0 && (
                      <span className="mb-1 block text-xs text-muted-foreground">Additional email</span>
                    )}
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => updateSupportEmail(index, e.target.value)}
                      placeholder="support@yourstore.com"
                    />
                  </div>
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remove email address"
                      onClick={() => removeSupportEmail(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto gap-1 px-0 text-blue-600"
              onClick={addSupportEmail}
            >
              <Plus className="h-3.5 w-3.5" />
              Add more
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Business Support Phone</Label>
            <div className="space-y-2">
              {supportPhones.map((phone, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {index > 0 && (
                      <span className="mb-1 block text-xs text-muted-foreground">Additional phone</span>
                    )}
                    <PhoneInput
                      value={phone}
                      onChange={(v) => updateSupportPhone(index, v)}
                      defaultCountryIso="IN"
                    />
                  </div>
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remove phone number"
                      onClick={() => removeSupportPhone(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto gap-1 px-0 text-blue-600"
              onClick={addSupportPhone}
            >
              <Plus className="h-3.5 w-3.5" />
              Add more
            </Button>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <SaveButton loading={onSave.isPending} />
        </div>
      </form>
    </SectionWrapper>
  )
}

// â”€â”€ Address Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ReadOnlyBanner({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs leading-snug text-muted-foreground">
      <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  )
}

type AddressFieldValues = {
  street: string
  city: string
  state: string
  postal: string
}

function UniformAddressFields({
  values,
  onChange,
  streetPlaceholder = '123 Main Street',
}: {
  values: AddressFieldValues
  onChange: (patch: Partial<AddressFieldValues>) => void
  streetPlaceholder?: string
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground">Street address</Label>
        <Input
          value={values.street}
          onChange={(e) => onChange({ street: e.target.value })}
          placeholder={streetPlaceholder}
          className="h-8 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">City</Label>
          <Input
            value={values.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Hyderabad"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">State</Label>
          <Input
            value={values.state}
            onChange={(e) => onChange({ state: e.target.value })}
            placeholder="Telangana"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground">Postal code</Label>
        <Input
          value={values.postal}
          onChange={(e) => onChange({ postal: e.target.value })}
          placeholder="500001"
          className="h-8 text-sm"
        />
      </div>
    </div>
  )
}

function AddressPanelShell({
  title,
  icon: Icon,
  hint,
  editable,
  readOnlyMessage,
  children,
  onSubmit,
  saving,
}: {
  title: string
  icon: React.ElementType
  hint: string
  editable: boolean
  readOnlyMessage?: string
  children: React.ReactNode
  onSubmit: (e: React.FormEvent) => void
  saving: boolean
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'flex h-full flex-col rounded-lg border border-border bg-background',
        !editable && 'opacity-[0.98]',
      )}
    >
      <div className="flex items-start gap-2 border-b border-border px-2.5 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">{title}</p>
          <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
        </div>
        {!editable ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            <Lock className="h-2.5 w-2.5" />
            View only
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {!editable && readOnlyMessage ? <ReadOnlyBanner message={readOnlyMessage} /> : null}
        <fieldset disabled={!editable} className="contents [&_input]:disabled:cursor-default [&_input]:disabled:opacity-100">
          {children}
        </fieldset>
        {editable ? (
          <div className="mt-auto flex justify-end pt-0.5">
            <SaveButton loading={saving} compact />
          </div>
        ) : null}
      </div>
    </form>
  )
}

type AddressSectionProps = {
  vendor: Vendor | null
  activeStore?: StoreRecord
  hqEditable: boolean
  unitEditable: boolean
  open: boolean
  toggle: () => void
  onSaveVendor: ReturnType<typeof useUpdateVendor>
}

function AddressSection({
  vendor,
  activeStore,
  hqEditable,
  unitEditable,
  open,
  toggle,
  onSaveVendor,
}: AddressSectionProps) {
  const updateStore = useUpdateStore()

  const [hqForm, setHqForm] = useState({
    street_address: '',
    city: '',
    state: '',
    postal_code: '',
  })
  const [unitForm, setUnitForm] = useState({
    street: '',
    city: '',
    state: '',
    pincode: '',
  })
  const hqSavingRef = useRef(false)
  const unitSavingRef = useRef(false)

  useEffect(() => {
    if (vendor && !hqSavingRef.current) {
      setHqForm({
        street_address: vendor.street_address || '',
        city: vendor.city || '',
        state: vendor.state || '',
        postal_code: vendor.postal_code || '',
      })
    }
  }, [vendor])

  useEffect(() => {
    if (!unitSavingRef.current) {
      const addr = activeStore?.address
      setUnitForm({
        street: addr?.street ?? '',
        city: addr?.city ?? '',
        state: addr?.state ?? '',
        pincode: addr?.pincode ?? '',
      })
    }
  }, [activeStore?.id, activeStore?.address?.street, activeStore?.address?.city, activeStore?.address?.state, activeStore?.address?.pincode])

  const handleHqSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hqEditable) return
    hqSavingRef.current = true
    onSaveVendor.mutate(
      {
        street_address: hqForm.street_address || undefined,
        city: hqForm.city || undefined,
        state: hqForm.state || undefined,
        postal_code: hqForm.postal_code || undefined,
      } as Partial<Vendor>,
      { onSettled: () => { hqSavingRef.current = false } },
    )
  }

  const handleUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!unitEditable || !activeStore) return
    unitSavingRef.current = true
    updateStore.mutate(
      {
        id: activeStore.id,
        data: {
          address: {
            street: unitForm.street || undefined,
            city: unitForm.city || undefined,
            state: unitForm.state || undefined,
            pincode: unitForm.pincode || undefined,
            country: activeStore.address?.country || 'India',
          },
        },
      },
      { onSettled: () => { unitSavingRef.current = false } },
    )
  }

  const unitHint = unitEditable
    ? `Location for ${activeStore?.name ?? 'this unit'}`
    : `Select a ${BUSINESS_UNIT_STORE_LABEL} in the top bar to edit`

  const isDirty = useMemo(
    () => isAddressSectionDirty(hqForm, unitForm, vendor, activeStore, hqEditable, unitEditable),
    [hqForm, unitForm, vendor, activeStore, hqEditable, unitEditable],
  )
  useSettingsSectionDirty('address', isDirty)

  return (
    <SectionWrapper title="Addresses" helpText="Branch location and registered HQ address" icon={MapPin} open={open} toggle={toggle}>
      <div className="grid grid-cols-1 gap-3 pt-2 lg:grid-cols-2 lg:items-stretch">
        <AddressPanelShell
          title={`${BUSINESS_UNIT_STORE_LABEL} address`}
          icon={Building}
          hint={unitHint}
          editable={unitEditable}
          readOnlyMessage={`Choose a specific ${BUSINESS_UNIT_STORE_LABEL} in the top bar to update its address.`}
          onSubmit={handleUnitSubmit}
          saving={updateStore.isPending}
        >
          <UniformAddressFields
            values={{
              street: unitForm.street,
              city: unitForm.city,
              state: unitForm.state,
              postal: unitForm.pincode,
            }}
            onChange={(patch) =>
              setUnitForm({
                ...unitForm,
                street: patch.street ?? unitForm.street,
                city: patch.city ?? unitForm.city,
                state: patch.state ?? unitForm.state,
                pincode: patch.postal ?? unitForm.pincode,
              })
            }
          />
        </AddressPanelShell>

        <AddressPanelShell
          title="Headquarters (HQ)"
          icon={MapPin}
          hint={`All ${BUSINESS_UNIT_STORE_LABEL} — legal / service location (headquarters)`}
          editable={hqEditable}
          readOnlyMessage={`Switch to All ${BUSINESS_UNIT_STORE_LABEL} in the top bar to edit the HQ address.`}
          onSubmit={handleHqSubmit}
          saving={onSaveVendor.isPending}
        >
          <UniformAddressFields
            values={{
              street: hqForm.street_address,
              city: hqForm.city,
              state: hqForm.state,
              postal: hqForm.postal_code,
            }}
            onChange={(patch) =>
              setHqForm({
                ...hqForm,
                street_address: patch.street ?? hqForm.street_address,
                city: patch.city ?? hqForm.city,
                state: patch.state ?? hqForm.state,
                postal_code: patch.postal ?? hqForm.postal_code,
              })
            }
            streetPlaceholder="123 Main Street, Suite 100"
          />
        </AddressPanelShell>
      </div>
    </SectionWrapper>
  )
}

// â”€â”€ Tax Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TaxSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [form, setForm] = useState({
    is_gst_registered: false,
    gstin: '',
    pan_number: '',
    default_tax_rate: '',
  })

  useEffect(() => {
    if (vendor) {
      setForm({
        is_gst_registered: vendor.is_gst_registered ?? false,
        gstin: vendor.gstin || '',
        pan_number: vendor.pan_number || '',
        default_tax_rate: vendor.default_tax_rate != null ? String(vendor.default_tax_rate) : '',
      })
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const gstin = form.is_gst_registered ? form.gstin.trim() : ''
    const pan = form.pan_number.trim()
    const rateRaw = form.default_tax_rate.trim()
    onSave.mutate({
      is_gst_registered: form.is_gst_registered,
      gstin: gstin || null,
      pan_number: pan || null,
      default_tax_rate: rateRaw ? parseFloat(rateRaw) : null,
    } as Partial<Vendor>)
  }

  const isDirty = useMemo(() => isTaxSectionDirty(form, vendor), [form, vendor])
  useSettingsSectionDirty('tax', isDirty)

  return (
    <SectionWrapper title="Tax & Compliance" helpText="GST, PAN, GSTIN and tax registration details" icon={FileText} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_gst_registered}
            onChange={(e) => setForm({ ...form, is_gst_registered: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm font-medium text-gray-700">GST Registered</span>
        </label>

        {form.is_gst_registered && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>GSTIN</Label>
              <Input
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={form.default_tax_rate}
                onChange={(e) => setForm({ ...form, default_tax_rate: e.target.value })}
                placeholder="18"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>PAN Number</Label>
          <Input
            value={form.pan_number}
            onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })}
            placeholder="AAAAA0000A"
            maxLength={10}
          />
        </div>

        <div className="flex justify-end pt-2">
          <SaveButton loading={onSave.isPending} />
        </div>
      </form>
    </SectionWrapper>
  )
}

// â”€â”€ Business Hours Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type StoreHoliday = { date: string; label: string; closed: boolean }

function BusinessHoursSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>({})
  const [holidays, setHolidays] = useState<StoreHoliday[]>([])
  const savingRef = useRef(false)

  useEffect(() => {
    if (vendor && !savingRef.current) {
      const h: Record<string, { open: string; close: string; closed: boolean }> = {}
      for (const day of DAYS) {
        const existing = vendor.business_hours?.[day]
        h[day] = {
          open: existing?.open || '09:00',
          close: existing?.close || '18:00',
          closed: existing?.closed ?? (day === 'sunday'),
        }
      }
      setHours(h)
      setHolidays(
        (vendor.store_holidays || []).map((entry) => ({
          date: entry.date || '',
          label: entry.label || '',
          closed: entry.closed !== false,
        })),
      )
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    savingRef.current = true
    onSave.mutate({
      business_hours: hours,
      store_holidays: holidays.filter((h) => h.date),
    } as Partial<Vendor>, {
      onSettled: () => { savingRef.current = false },
    })
  }

  const updateDay = (day: string, field: string, value: string | boolean) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  const isDirty = useMemo(() => {
    if (isBusinessHoursSectionDirty(hours, vendor)) return true
    const saved = (vendor?.store_holidays || []).map((h) => ({
      date: h.date || '',
      label: h.label || '',
      closed: h.closed !== false,
    }))
    if (saved.length !== holidays.length) return true
    return holidays.some((h, i) =>
      h.date !== saved[i]?.date || h.label !== saved[i]?.label || h.closed !== saved[i]?.closed,
    )
  }, [hours, holidays, vendor])
  useSettingsSectionDirty('hours-availability', isDirty)

  return (
    <SectionWrapper
      title="Offline Business Hours"
      helpText="Walk-in hours shown on your Business Front"
      icon={Clock}
      open={open}
      toggle={toggle}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Opening hours</strong> — shown on your business front (when you are open for visitors).
        </p>
        {DAYS.map((day) => (
          <div key={day} className="flex items-center gap-4 py-1">
            <div className="w-24">
              <span className="text-sm font-medium capitalize">{day}</span>
            </div>
            <label className="flex items-center gap-2 w-24">
              <input
                type="checkbox"
                checked={!hours[day]?.closed}
                onChange={(e) => updateDay(day, 'closed', !e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-xs text-gray-500">{hours[day]?.closed ? 'Closed' : 'Open'}</span>
            </label>
            {!hours[day]?.closed && (
              <>
                <Input
                  type="time"
                  value={hours[day]?.open || '09:00'}
                  onChange={(e) => updateDay(day, 'open', e.target.value)}
                  className="w-32 text-sm"
                />
                <span className="text-gray-400">to</span>
                <Input
                  type="time"
                  value={hours[day]?.close || '18:00'}
                  onChange={(e) => updateDay(day, 'close', e.target.value)}
                  className="w-32 text-sm"
                />
              </>
            )}
          </div>
        ))}

        <div className="border-t pt-4 mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">Store holidays</p>
              <p className="text-xs text-muted-foreground">Dates when your store is closed (bookings and orders may be blocked).</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setHolidays((prev) => [...prev, { date: '', label: '', closed: true }])}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
          {holidays.length === 0 ? (
            <p className="text-xs text-muted-foreground">No holidays configured.</p>
          ) : (
            <div className="space-y-2">
              {holidays.map((holiday, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    value={holiday.date}
                    onChange={(e) => setHolidays((prev) => prev.map((h, i) => i === index ? { ...h, date: e.target.value } : h))}
                    className="w-40 text-sm"
                  />
                  <Input
                    value={holiday.label}
                    onChange={(e) => setHolidays((prev) => prev.map((h, i) => i === index ? { ...h, label: e.target.value } : h))}
                    placeholder="Label (e.g. Diwali)"
                    className="flex-1 min-w-[140px] text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => setHolidays((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <SaveButton loading={onSave.isPending} />
        </div>
      </form>
    </SectionWrapper>
  )
}

// â”€â”€ Order Acceptance Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OrderAcceptanceSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [enabled, setEnabled] = useState(true)
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>({})
  const [sameAsOfflineHours, setSameAsOfflineHours] = useState(true)
  const savingRef = useRef(false)

  useEffect(() => {
    if (vendor && !savingRef.current) {
      setEnabled(vendor.order_acceptance_enabled !== false)
      const h: Record<string, { open: string; close: string; closed: boolean }> = {}
      const hasCustom =
        vendor.order_acceptance_hours != null &&
        Object.keys(vendor.order_acceptance_hours).length > 0
      setSameAsOfflineHours(!hasCustom)
      for (const day of DAYS) {
        const existing = vendor.order_acceptance_hours?.[day]
        h[day] = {
          open: existing?.open || '00:00',
          close: existing?.close || '23:59',
          closed: existing?.closed ?? false,
        }
      }
      setHours(h)
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    savingRef.current = true
    onSave.mutate({
      order_acceptance_enabled: enabled,
      order_acceptance_hours: sameAsOfflineHours ? {} : hours,
    } as Partial<Vendor>, {
      onSettled: () => { savingRef.current = false },
    })
  }

  const updateDay = (day: string, field: string, value: string | boolean) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  const copyFromOfflineBusinessHours = () => {
    if (!vendor?.business_hours || Object.keys(vendor.business_hours).length === 0) {
      toast.error('Save Offline Business Hours first')
      return
    }
    const h: Record<string, { open: string; close: string; closed: boolean }> = {}
    for (const day of DAYS) {
      const existing = vendor.business_hours?.[day]
      h[day] = {
        open: existing?.open || '09:00',
        close: existing?.close || '18:00',
        closed: existing?.closed ?? day === 'sunday',
      }
    }
    setHours(h)
    toast.success('Copied from Offline Business Hours')
  }

  const isDirty = useMemo(
    () => isOrderAcceptanceSectionDirty(enabled, sameAsOfflineHours, hours, vendor),
    [enabled, sameAsOfflineHours, hours, vendor],
  )
  useSettingsSectionDirty('order-acceptance', isDirty)

  return (
    <SectionWrapper
      title="Online Orders"
      helpText="Control when customers can place orders online"
      icon={ShoppingBag}
      open={open}
      toggle={toggle}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm font-medium text-foreground">Accept orders online</span>
        </label>
        <p className="text-xs text-muted-foreground">
          When disabled, customers cannot place new orders on your business front.
        </p>

        {enabled && (
          <>
            <div className="space-y-2" role="radiogroup" aria-label="Online order hours">
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <input
                  type="radio"
                  name="orderHoursMode"
                  checked={sameAsOfflineHours}
                  onChange={() => setSameAsOfflineHours(true)}
                  className="h-4 w-4 border-gray-300 text-blue-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">Same as Offline Business Hours</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Online order times follow your offline hours — no separate schedule to configure.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <input
                  type="radio"
                  name="orderHoursMode"
                  checked={!sameAsOfflineHours}
                  onChange={() => setSameAsOfflineHours(false)}
                  className="h-4 w-4 border-gray-300 text-blue-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">Configure Different Hours</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Set a custom weekly schedule for when customers can place orders online.
                  </span>
                </span>
              </label>
            </div>

            {!sameAsOfflineHours && (
              <>
                <p className="text-xs text-muted-foreground">
                  Set custom online order hours below, or copy your offline hours as a starting point.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={copyFromOfflineBusinessHours}>
                  Copy from Offline Business Hours
                </Button>
              </>
            )}

            {!sameAsOfflineHours && (
              <div className="space-y-3 pl-7">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center gap-4 py-1">
                    <div className="w-24">
                      <span className="text-sm font-medium capitalize">{day}</span>
                    </div>
                    <label className="flex items-center gap-2 w-24">
                      <input
                        type="checkbox"
                        checked={!hours[day]?.closed}
                        onChange={(e) => updateDay(day, 'closed', !e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-xs text-gray-500">{hours[day]?.closed ? 'Closed' : 'Open'}</span>
                    </label>
                    {!hours[day]?.closed && (
                      <>
                        <Input
                          type="time"
                          value={hours[day]?.open || '00:00'}
                          onChange={(e) => updateDay(day, 'open', e.target.value)}
                          className="w-32 text-sm"
                        />
                        <span className="text-gray-400">to</span>
                        <Input
                          type="time"
                          value={hours[day]?.close || '23:59'}
                          onChange={(e) => updateDay(day, 'close', e.target.value)}
                          className="w-32 text-sm"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-2">
          <SaveButton loading={onSave.isPending} />
        </div>
      </form>
    </SectionWrapper>
  )
}


// ── External Domain & Registrar Access Section ────────────────────────────

const REGISTRAR_OPTIONS = [
  'GoDaddy', 'Namecheap', 'Cloudflare', 'Google Domains', 'BigRock',
  'Hostinger', 'Bluehost', 'HostGator', 'Reseller Club', 'Net4India', 'Other',
]

const ACCESS_STATUS_META: Record<string, { label: string; color: string }> = {
  not_requested: { label: 'Not requested', color: 'text-gray-500 bg-gray-100 border-gray-200' },
  pending:        { label: 'Pending verification', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  active:         { label: 'Access active', color: 'text-green-700 bg-green-50 border-green-200' },
  revoked:        { label: 'Revoked', color: 'text-red-600 bg-red-50 border-red-200' },
}

const KIT_ERP_SUPPORT_EMAIL = 'support@kiterp.com'

function ExternalDomainSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [enabled, setEnabled] = useState(false)
  const [domainScope, setDomainScope] = useState<'all' | 'per_unit'>('all')
  const [dnsMode, setDnsMode] = useState<ExternalDomainDnsMode>('kit_assisted')
  const [domainName, setDomainName] = useState('')
  const [registrar, setRegistrar] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [holder, setHolder] = useState('')
  const [expiry, setExpiry] = useState('')
  const [accessStatus, setAccessStatus] = useState('not_requested')
  const [recoveryContact, setRecoveryContact] = useState('')
  const [notes, setNotes] = useState('')
  const savingRef = useRef(false)

  // Edit mode — shows full form even when pending (to update submitted details)
  const [editMode, setEditMode] = useState(false)

  // OTP flow for deactivating an active domain
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpTo, setOtpTo] = useState('')
  const [otpDevHint, setOtpDevHint] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')

  const handleToggleOff = async () => {
    if (accessStatus === 'active') {
      // Require OTP to deactivate a live domain
      setShowOtpModal(true)
      setOtpSent(false)
      setOtpCode('')
      setOtpError('')
      setOtpLoading(true)
      try {
        const res = await vendorApi.sendDomainDeactivationOtp()
        setOtpTo(res.to)
        const hint = res.dev_hint ?? ''
        setOtpDevHint(hint)
        if (hint) {
          setOtpCode(hint)
          toast.message(`Dev mode: your code is ${hint}`, { duration: 12_000 })
        }
        setOtpSent(true)
      } catch (err) {
        const msg = extractApiError(err, 'Could not send verification code')
        setOtpError(msg)
        toast.error(msg)
      }
      setOtpLoading(false)
    } else {
      // Pending — just confirm and revoke
      setEnabled(false)
      setAccessStatus('not_requested')
    }
  }

  const handleOtpSubmit = async () => {
    if (!otpCode.trim()) { setOtpError('Enter the 6-digit code'); return }
    setOtpLoading(true)
    setOtpError('')
    try {
      await vendorApi.verifyDomainDeactivationOtp(otpCode.trim())
      setEnabled(false)
      setAccessStatus('revoked')
      setShowOtpModal(false)
      toast.success('External domain deactivated — your KIT ERP link is now primary')
    } catch (err) {
      setOtpError(extractApiError(err, 'Invalid code — try again'))
    }
    setOtpLoading(false)
  }

  useEffect(() => {
    if (vendor && !savingRef.current) {
      const v = vendor as any
      const status = v.external_domain_access_status ?? 'not_requested'
      setAccessStatus(status)
      // Force ON if access is pending or active — domain is in use regardless of the saved flag
      const forcedEnabled = status === 'pending' || status === 'active'
        ? true
        : (v.external_domain_enabled ?? false)
      setEnabled(forcedEnabled)
      setDomainName(v.external_domain_name ?? '')
      setRegistrar(v.external_domain_registrar ?? '')
      setRegEmail(v.external_domain_reg_email ?? '')
      setHolder(v.external_domain_holder ?? '')
      setExpiry(v.external_domain_expiry ?? '')
      setRecoveryContact(v.external_domain_recovery_contact ?? '')
      setNotes(v.external_domain_notes ?? '')
      setDomainScope(v.external_domain_scope === 'per_unit' ? 'per_unit' : 'all')
      setDnsMode(v.external_domain_dns_mode === 'self_managed' ? 'self_managed' : 'kit_assisted')
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (enabled && !domainName.trim()) {
      toast.error('Domain name is required')
      return
    }
    if (enabled && !registrar) {
      toast.error('Please select the registrar')
      return
    }
    savingRef.current = true
    const newStatus =
      accessStatus === 'not_requested' && enabled ? 'not_requested' : accessStatus
    onSave.mutate({
      external_domain_enabled: enabled,
      external_domain_scope: domainScope,
      external_domain_dns_mode: dnsMode,
      external_domain_name: domainName.trim() || undefined,
      external_domain_registrar: registrar || undefined,
      external_domain_reg_email: regEmail.trim() || undefined,
      external_domain_holder: holder.trim() || undefined,
      external_domain_expiry: expiry || undefined,
      external_domain_access_status: newStatus,
      external_domain_recovery_contact: recoveryContact.trim() || undefined,
      external_domain_notes: notes.trim() || undefined,
    } as any, { onSettled: () => { savingRef.current = false } })
  }

  const handleGrantedAccess = () => {
    if (!domainName.trim()) { toast.error('Enter the domain name first'); return }
    if (dnsMode === 'kit_assisted') {
      if (!registrar) { toast.error('Select a registrar first'); return }
      if (!regEmail.trim()) { toast.error('Enter the registrar login email first'); return }
    }
    savingRef.current = true
    // Save ALL form fields together with the status — so "Edit" can pre-populate them
    onSave.mutate({
      external_domain_enabled: true,
      external_domain_scope: domainScope,
      external_domain_dns_mode: dnsMode,
      external_domain_access_status: 'pending',
      external_domain_name: domainName.trim(),
      external_domain_registrar: registrar,
      external_domain_reg_email: regEmail.trim(),
      external_domain_holder: holder.trim() || undefined,
      external_domain_expiry: expiry || undefined,
      external_domain_recovery_contact: recoveryContact.trim() || undefined,
      external_domain_notes: notes.trim() || undefined,
    } as any, {
      onSettled: () => { savingRef.current = false },
      onSuccess: () => {
        setAccessStatus('pending')
        toast.success(
          dnsMode === 'self_managed'
            ? 'Submitted — KIT ERP will verify your DNS records and go live'
            : 'Access marked as pending — KIT ERP team will verify',
        )
      },
    })
  }

  const handleRevokeAccess = () => {
    savingRef.current = true
    onSave.mutate({ external_domain_access_status: 'revoked' } as any, {
      onSettled: () => { savingRef.current = false },
      onSuccess: () => { setAccessStatus('revoked'); toast.info('Access revoked') },
    })
  }

  const statusMeta = ACCESS_STATUS_META[accessStatus] ?? ACCESS_STATUS_META.not_requested
  const registrarDelegateGuide: Record<string, string> = {
    GoDaddy: 'https://www.godaddy.com/help/invite-a-delegate-15087',
    Namecheap: 'https://www.namecheap.com/support/knowledgebase/article.aspx/567',
    Cloudflare: 'https://developers.cloudflare.com/fundamentals/account-and-billing/account-setup/create-account/',
  }
  const guideUrl = registrar ? (registrarDelegateGuide[registrar] ?? null) : null

  const domainBadge = domainName ? (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium
      bg-card border-border text-muted-foreground" title={domainName}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
        accessStatus === 'active' ? 'bg-green-500' :
        accessStatus === 'pending' ? 'bg-amber-400' : 'bg-gray-400'
      }`} />
      <span className="max-w-[10rem] truncate font-mono">{domainName}</span>
    </div>
  ) : null

  const isDirty = useMemo(
    () =>
      isExternalDomainSectionDirty(
        {
          enabled,
          domainScope,
          dnsMode,
          domainName,
          registrar,
          regEmail,
          holder,
          expiry,
          accessStatus,
          recoveryContact,
          notes,
        },
        vendor,
      ),
    [enabled, domainScope, dnsMode, domainName, registrar, regEmail, holder, expiry, accessStatus, recoveryContact, notes, vendor],
  )
  useSettingsSectionDirty('external-domain', isDirty)

  return (
    <SectionWrapper
      title="External Domain"
      subtitle={
        enabled
          ? domainScope === 'all'
            ? 'One domain for all business unit / store fronts'
            : 'A unique domain per business unit front website'
          : undefined
      }
      helpText="Use your own domain instead of the default KIT ERP link"
      icon={Globe}
      badge={domainBadge}
      open={open}
      toggle={toggle}
    >
      <form onSubmit={handleSubmit} className="space-y-3">

        {/* Scope + preview info — always visible when expanded */}
        <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border text-xs hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-muted-foreground">Scope</span>
            <span className="font-medium text-foreground flex items-center gap-1">
              <Globe className="h-3 w-3 text-muted-foreground" />
              {domainScope === 'all' ? 'All Business Units / Stores' : 'Per Business Unit (BU-specific)'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-muted-foreground">Status</span>
            <span className={`font-medium flex items-center gap-1 ${
              accessStatus === 'active' ? 'text-green-600' :
              accessStatus === 'pending' ? 'text-amber-600' : 'text-muted-foreground'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                accessStatus === 'active' ? 'bg-green-500' :
                accessStatus === 'pending' ? 'bg-amber-400' : 'bg-gray-300'
              }`} />
              {accessStatus === 'active' ? 'Connected' :
               accessStatus === 'pending' ? 'Awaiting KIT ERP team' :
               accessStatus === 'revoked' ? 'Revoked' : 'Not configured'}
            </span>
          </div>
          {domainName && (
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-muted-foreground">Requested domain</span>
              <a
                href={`https://${domainName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-medium text-primary hover:underline underline-offset-2 flex items-center gap-1"
                title={`https://${domainName}`}
              >
                {domainName}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          )}
          {!domainName && (
            <div className="px-3 py-2 text-muted-foreground italic">No domain requested yet</div>
          )}
        </div>
        {/* ── Toggle row ── */}
        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => { if (!enabled) setEnabled(true); else handleToggleOff() }}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                !enabled ? 'bg-gray-300' : accessStatus === 'active' ? 'bg-green-500' : 'bg-amber-400'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm font-medium text-foreground">Use an external domain</span>
          </label>
          {enabled && accessStatus !== 'not_requested' && accessStatus !== 'revoked' && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              accessStatus === 'active' ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}>
              {accessStatus === 'active' ? '● Connected' : '● Awaiting KIT ERP'}
            </span>
          )}
        </div>

        {/* ── OFF state ── */}
        {!enabled && (
          <p className="text-xs text-muted-foreground">
            {(domainName && (accessStatus === 'pending' || accessStatus === 'active'))
              ? `${domainName} — ${accessStatus === 'active' ? 'was live, now paused.' : 'request pending.'} Toggle ON to manage.`
              : 'Toggle on to use your own domain. KIT ERP handles DNS — your default link stays active until setup is complete.'}
          </p>
        )}

        {enabled && (
          <div className="space-y-3">

            {/* ── PENDING or ACTIVE: compact summary ── */}
            {(accessStatus === 'pending' || accessStatus === 'active') && !editMode ? (
              <div className={`rounded-lg border text-xs overflow-hidden ${accessStatus === 'active' ? 'border-green-200' : 'border-amber-200'}`}>
                <div className={`flex items-center justify-between gap-2 px-3 py-2 ${accessStatus === 'active' ? 'bg-green-50' : 'bg-amber-50'}`}>
                  <span className={`font-medium flex items-center gap-1.5 ${accessStatus === 'active' ? 'text-green-700' : 'text-amber-700'}`}>
                    {accessStatus === 'active' ? <BadgeCheck className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {accessStatus === 'active' ? 'Domain is live' : 'Awaiting KIT ERP verification'}
                  </span>
                  <div className="flex items-center gap-2">
                    {accessStatus === 'pending' && (
                      <button type="button" className="text-primary hover:underline" onClick={() => setEditMode(true)}>Edit</button>
                    )}
                    <button type="button" className="text-red-500 hover:underline" onClick={handleToggleOff}>
                      {accessStatus === 'active' ? 'Deactivate' : 'Cancel'}
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-border bg-card">
                  {[
                    { label: 'Domain', value: domainName, link: domainName ? `https://${domainName}` : null },
                    { label: 'Registrar', value: registrar },
                    { label: 'Login email', value: dnsMode === 'kit_assisted' ? regEmail : '', mono: true },
                    { label: 'Scope', value: domainScope === 'all' ? 'All BU / Stores' : 'Per BU / Store' },
                    { label: 'DNS setup', value: dnsMode === 'self_managed' ? 'Managed by you' : 'KIT ERP assisted' },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="text-muted-foreground">{r.label}</span>
                      {r.link
                        ? <a href={r.link} target="_blank" rel="noopener noreferrer" className={`font-medium text-primary flex items-center gap-1 hover:underline ${r.mono ? 'font-mono' : ''}`}>{r.value}<ExternalLink className="h-3 w-3" /></a>
                        : <span className={`font-medium text-foreground ${r.mono ? 'font-mono' : ''}`}>{r.value}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ── NOT REQUESTED / REVOKED / EDIT MODE: compact form ── */
              <>
            {/* Scope: same for all vs unique per business unit front */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Where does this domain apply?</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'all', title: 'One for all', desc: 'Same domain across every business unit / store front' },
                  { key: 'per_unit', title: 'Per business unit', desc: 'A unique domain for each business unit front website' },
                ] as const).map(opt => {
                  const active = domainScope === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDomainScope(opt.key)}
                      className={`flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors ${
                        active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-background hover:bg-muted/40'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Globe className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                        {opt.title}
                      </span>
                      <span className="text-[10px] leading-snug text-muted-foreground">{opt.desc}</span>
                    </button>
                  )
                })}
              </div>
              {domainScope === 'per_unit' && (
                <p className="flex items-start gap-1 text-[10px] leading-snug text-muted-foreground">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  Add the domain for this business unit below. Repeat from each business unit's settings to map a unique domain to each front website.
                </p>
              )}
            </div>

            {/* DNS management mode: self-managed vs KIT ERP assisted */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">How should DNS be configured?</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'self_managed', title: 'I\'ll manage DNS', desc: 'Add the records yourself at your registrar', icon: Server },
                  { key: 'kit_assisted', title: 'KIT ERP help', desc: 'Grant access and we configure it for you', icon: ShieldCheck },
                ] as const).map(opt => {
                  const active = dnsMode === opt.key
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDnsMode(opt.key)}
                      className={`flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors ${
                        active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-background hover:bg-muted/40'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Icon className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                        {opt.title}
                      </span>
                      <span className="text-[10px] leading-snug text-muted-foreground">{opt.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Domain + Registrar row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Domain name <span className="text-red-500">*</span></Label>
                <Input
                  value={domainName}
                  onChange={e => setDomainName(e.target.value)}
                  placeholder="yourbusiness.com"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">
                  Registrar {dnsMode === 'kit_assisted' && <span className="text-red-500">*</span>}
                </Label>
                <select
                  value={registrar}
                  onChange={e => setRegistrar(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select registrar…</option>
                  {REGISTRAR_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* KIT-assisted only: registrar credentials for delegated access */}
            {dnsMode === 'kit_assisted' && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Registrar login email <span className="text-red-500">*</span></Label>
                    <Input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="your-email@example.com"
                    />
                    <p className="text-[10px] text-muted-foreground">Email used to log into your registrar account.</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Account holder name</Label>
                    <Input
                      value={holder}
                      onChange={e => setHolder(e.target.value)}
                      placeholder="Name on the domain registration"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Domain expiry date</Label>
                    <Input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">2FA recovery contact</Label>
                    <Input
                      value={recoveryContact}
                      onChange={e => setRecoveryContact(e.target.value)}
                      placeholder="Phone or backup email"
                    />
                    <p className="text-[10px] text-muted-foreground">Used if registrar requires 2FA verification.</p>
                  </div>
                </div>

                {/* Delegated access instructions */}
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Grant KIT ERP team access</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Add <strong className="font-semibold text-foreground">{KIT_ERP_SUPPORT_EMAIL}</strong> as a
                        delegated contact or team member in your {registrar || 'registrar'} account.
                        This allows our team to manage DNS records on your behalf — you retain full ownership and
                        can revoke access at any time.
                      </p>
                    </div>
                  </div>

                  {guideUrl && (
                    <a
                      href={guideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      How to add a delegate in {registrar}
                    </a>
                  )}

                  {/* KIT ERP email to copy */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs font-mono text-foreground">{KIT_ERP_SUPPORT_EMAIL}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => { navigator.clipboard.writeText(KIT_ERP_SUPPORT_EMAIL); toast.success('Email copied') }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Self-managed: DNS records to add at the registrar */}
            {dnsMode === 'self_managed' && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Add these DNS records at your registrar</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Sign in to your DNS provider and create the records below. Changes can take up to
                      a few hours to propagate. Your default KIT ERP link stays live until the domain is verified.
                    </p>
                  </div>
                </div>

                {!domainName.trim() ? (
                  <p className="rounded-lg border border-dashed border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                    Enter your domain name above to see the exact records to add.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border bg-background">
                    <div className="hidden grid-cols-[64px_1fr_1fr_32px] gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                      <span>Type</span>
                      <span>Host / Name</span>
                      <span>Value / Target</span>
                      <span />
                    </div>
                    {buildSelfManagedDnsRecords(domainName, (vendor as Vendor | null)?.slug, (vendor as Vendor | null)?.id).map((rec, i) => (
                      <div
                        key={`${rec.type}-${i}`}
                        className="grid grid-cols-1 gap-1 border-b border-border px-3 py-2 last:border-b-0 sm:grid-cols-[64px_1fr_1fr_32px] sm:items-center sm:gap-2"
                      >
                        <span className="inline-flex w-fit items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                          {rec.type}
                        </span>
                        <code className="block truncate font-mono text-[11px] text-foreground" title={rec.host}>{rec.host}</code>
                        <code className="block truncate font-mono text-[11px] text-foreground" title={rec.value}>{rec.value}</code>
                        <button
                          type="button"
                          aria-label="Copy record value"
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => { navigator.clipboard.writeText(rec.value); toast.success('Value copied') }}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <p className="text-[10px] leading-snug text-muted-foreground sm:col-span-4">{rec.note}</p>
                      </div>
                    ))}
                  </div>
                )}

                <p className="flex items-start gap-1 text-[10px] leading-snug text-muted-foreground">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  Prefer not to touch DNS? Switch to <strong className="font-medium text-foreground">KIT ERP help</strong> above and our team will configure it for you.
                </p>
              </div>
            )}

            {/* Access status */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                {accessStatus === 'active' ? (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-green-600" />
                ) : accessStatus === 'pending' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-xs font-medium text-foreground">Access status</span>
                <span className={`text-[10px] font-medium ${statusMeta.color.replace('bg-', 'text-').split(' ')[0]}`}>
                  {statusMeta.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {editMode && (
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditMode(false)}>Cancel</button>
                )}
                {(accessStatus === 'not_requested' || (accessStatus === 'pending' && editMode)) && (
                  <Button type="button" size="sm" onClick={() => { handleGrantedAccess(); setEditMode(false) }}>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    {editMode
                      ? 'Update & re-submit'
                      : dnsMode === 'self_managed'
                        ? "I've added the records"
                        : "I've granted access"}
                  </Button>
                )}
                {accessStatus === 'revoked' && (
                  <Button type="button" size="sm" variant="outline" onClick={handleGrantedAccess}>
                    {dnsMode === 'self_managed' ? 'Re-submit' : 'Re-grant access'}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Notes for KIT ERP team (optional)…"
                className="flex-1 mr-3 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <Button type="submit" size="sm" disabled={onSave.isPending} className="shrink-0">
                {onSave.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </>
          )}
          </div>
        )}
      </form>

      {/* OTP modal — deactivating an active domain */}
      {showOtpModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Verify to deactivate domain</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {otpSent
                    ? <>A 6-digit code was sent to <strong>{otpTo}</strong>. Enter it below to confirm deactivation.</>
                    : 'Sending verification code…'}
                </p>
              </div>
            </div>

            {otpSent && otpDevHint && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <strong>Dev mode:</strong> your code is <span className="font-mono font-bold tracking-widest">{otpDevHint}</span>
              </div>
            )}

            {otpSent && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Verification code</Label>
                <Input
                  value={otpCode}
                  onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError('') }}
                  placeholder="6-digit code"
                  maxLength={6}
                  className="font-mono text-center tracking-widest text-lg"
                  autoFocus
                />
                {otpError && <p className="text-xs text-red-600">{otpError}</p>}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => setShowOtpModal(false)}>
                Cancel
              </Button>
              {otpSent && (
                <Button type="button" size="sm" className="flex-1" disabled={otpLoading || otpCode.length !== 6} onClick={handleOtpSubmit}>
                  {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm deactivation'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </SectionWrapper>
  )
}

// Social, Display, and Module settings live in System Configuration:
// /system/social-links | /system/storefront-display | /system/modules
