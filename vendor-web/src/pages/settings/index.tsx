import { useState, useEffect, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVendorStore } from '@/stores/vendorStore'
import { useAuthStore } from '@/stores/authStore'
import { useUpdateVendor, useUpdateStore, useStores } from '@/hooks/useVendor'
import type { StoreRecord } from '@/api/vendor'
import { useBusinessUnitScopeLabel, type BusinessUnitScopeMode } from '@/hooks/useBusinessUnitScope'
import StoresPage from '@/pages/stores'
import { StoresListToolbar } from '@/components/business-units/StoresListToolbar'
import BusinessUnitDetailPanel from '@/components/business-units/BusinessUnitDetailPanel'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import { vendorApi } from '@/api/vendor'
import {
  Save, Loader2, Store, MapPin, FileText, Globe,
  Clock, ChevronDown, ChevronUp, Building2, Phone,
  Camera, ImageIcon, X, Eye, Copy, ExternalLink, ShoppingBag,
  ChevronRight, Check,
  Info, CheckCircle2, Landmark, HelpCircle, Lock, Building, Plus,
  Link2, AlertCircle, BadgeCheck, Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BUSINESS_UNIT_STORE_LABEL } from '@/lib/businessUnitLabels'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import {
  FormPageWithNav,
  FormSectionNav,
  useFormActiveSection,
} from '@/components/common/FormSectionNav'
import type { FormSectionDef } from '@/components/common/FormSectionNav'
import type { Vendor } from '@/types'
import { ImageCropModal } from '@/components/common/ImageCropModal'
import { APP_VERSION, APP_BUILD, LAST_UPDATED, CHANGELOG } from '@/constants/vendorAppMeta'
import { PhoneInput } from '@/components/ui/PhoneInput'

type Section = 'profile' | 'contact' | 'address' | 'tax' | 'hours-availability' | 'order-acceptance' | 'external-domain'

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

export default function SettingsPage() {
  const vendor = useVendorStore((s) => s.vendor)
  const selectedStore = useVendorStore((s) => s.selectedStore)
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
  const [searchParams] = useSearchParams()
  const updateVendor = useUpdateVendor()

  // Deep-link: /settings?section=order-acceptance opens that accordion automatically
  const VALID_SECTIONS: Section[] = ['profile', 'contact', 'address', 'tax', 'hours-availability', 'order-acceptance', 'external-domain']
  const rawSection = searchParams.get('section')
  const sectionParam = (rawSection && VALID_SECTIONS.includes(rawSection as Section) ? rawSection as Section : null)
  const [openSection, setOpenSection] = useState<Section | null>(sectionParam ?? 'profile')
  const [buListSearch, setBuListSearch] = useState('')
  const [activeNavSection, setActiveNavSection] = useState<string | null>(null)

  const settingsSections = useMemo<FormSectionDef[]>(() => [
    { key: 'profile',          label: 'Business Profile',       icon: Store,     hint: 'Name, branding, logo and banners.' },
    { key: 'contact',          label: 'Contact Information',     icon: Phone,     hint: 'Phone, email and support details.' },
    { key: 'address',          label: 'Addresses',               icon: MapPin,    hint: 'Branch location and HQ address.' },
    { key: 'tax',              label: 'Tax & Compliance',        icon: FileText,  hint: 'GST, PAN and tax registration.' },
    { key: 'hours-availability', label: 'Business Hours',        icon: Clock,     hint: 'Walk-in hours on your Business Front.' },
    { key: 'order-acceptance', label: 'Online Orders',           icon: ShoppingBag, hint: 'When customers can place orders.' },
    { key: 'external-domain',  label: 'External Domain',         icon: Globe,     hint: 'Own domain & registrar access.' },
  ], [])

  const openSectionsMap = useMemo<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {}
    settingsSections.forEach(s => { m[s.key] = openSection === s.key })
    return m
  }, [openSection, settingsSections])

  const openAndScrollTo = (key: string) => {
    setOpenSection(key as Section)
    setTimeout(() => {
      document.getElementById(`form-section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  const openAndScrollToSection = (key: string) => {
    setOpenSection(key as Section)
    setTimeout(() => {
      const el = document.getElementById(`form-section-${key}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        setTimeout(() => {
          document.getElementById(`form-section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 200)
      }
    }, 150)
  }

  // URL ?section= deep-link (from search, nav, or first load)
  useEffect(() => {
    if (!sectionParam) return
    openAndScrollToSection(sectionParam)
  }, [sectionParam])

  // Custom event — fired when already on settings page (e.g. Configure button in BU panel)
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent<string>).detail
      if (key) openAndScrollToSection(key)
    }
    window.addEventListener('open-settings-section', handler)
    return () => window.removeEventListener('open-settings-section', handler)
  }, [])

  const showSupportAuditLink =
    !!vendor?.id &&
    !!user?.vendor_role?.vendor_id &&
    user.vendor_role.vendor_id === vendor.id &&
    (user.vendor_role.role === 'owner' || user.vendor_role.role === 'platform_staff')

  function copyAllBuLinks() {
    const base = vendor?.slug ? getCustomerStorefrontBaseUrl(vendor.slug) : ''
    const lines = stores.map((s) => {
      const key = s.code || s.id
      const url = base ? `${base}?branch=${encodeURIComponent(key)}` : key
      return `${s.name}: ${url}`
    }).join('\n')
    navigator.clipboard.writeText(lines).then(() => toast.success(`${stores.length} store links copied!`))
  }

  const supportAuditChip = showSupportAuditLink ? (
    <Link
      to="/settings/support-activity"
      className="inline-flex items-center gap-1 rounded-full border border-blue-200/80 bg-blue-50/60 px-2 py-0.5 text-[0.68rem] font-medium text-blue-800 hover:bg-blue-100/80 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
    >
      <HelpCircle className="h-2.5 w-2.5 shrink-0" />
      Support audit
    </Link>
  ) : null

  const statusChip = (
    <div
      className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[0.68rem] text-muted-foreground"
      title={vendor?.status ?? undefined}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${vendor?.status === 'approved' ? 'bg-green-500' : 'bg-amber-500'}`} />
      {vendorStatusLabel(vendor?.status)}
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1
          className="flex min-w-0 shrink-0 flex-wrap items-baseline gap-x-1.5 text-lg font-bold text-foreground"
          title={`Settings — ${scopeHeading}`}
        >
          <span>Settings</span>
          <span className="min-w-0 truncate text-sm font-semibold text-muted-foreground">
            {scopeHeading}
          </span>
        </h1>

        {allBusinessUnitsMode && (
          <StoresListToolbar
            stores={stores}
            listSearch={buListSearch}
            onListSearchChange={setBuListSearch}
            onCopyLinks={copyAllBuLinks}
            compact
          />
        )}

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
          <Link
            to="/stores"
            title={`Create new ${BUSINESS_UNIT_STORE_LABEL}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            New unit
          </Link>
          <button
            type="button"
            onClick={() => openAndScrollTo('external-domain')}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            External Domain
          </button>
          {supportAuditChip}
          {statusChip}
        </div>
      </div>
      <p className="text-[0.7rem] text-muted-foreground leading-snug">
        {settingsScopeHelpText(scopeMode, scopeLabel)}
      </p>

      {allBusinessUnitsMode ? (
        <StoresPage
          embeddedInSettings
          hideToolbar
          listSearch={buListSearch}
          onListSearchChange={setBuListSearch}
        />
      ) : showUnitDetailInSettings && activeStoreRecord ? (
        <section className="space-y-2">
          <BusinessUnitDetailPanel
            key={activeStoreRecord.id}
            store={activeStoreRecord}
            embeddedInSettings
          />
        </section>
      ) : null}

      <FormPageWithNav
        activeSectionKey={activeNavSection}
        nav={(
          <FormSectionNav
            sections={settingsSections}
            openSections={openSectionsMap}
            visitedSections={new Set(VALID_SECTIONS)}
            completedSections={new Set<string>()}
            hasErrorSections={new Set<string>()}
            onNavigate={openAndScrollTo}
            onActiveSectionChange={setActiveNavSection}
            scrollOffset={100}
            stickyTopClass="top-16"
          />
        )}
      >
        <div key={scopeStoreId ?? 'all-units'} className="flex flex-col gap-4">
          <div id="form-section-profile">
            <ProfileSection
              vendor={vendor}
              open={openSection === 'profile'}
              toggle={() => setOpenSection(openSection === 'profile' ? null : 'profile')}
              onSave={updateVendor}
            />
          </div>
          <div id="form-section-contact">
            <ContactSection
              vendor={vendor}
              open={openSection === 'contact'}
              toggle={() => setOpenSection(openSection === 'contact' ? null : 'contact')}
              onSave={updateVendor}
            />
          </div>
          <div id="form-section-address">
            <AddressSection
              vendor={vendor}
              activeStore={activeStoreRecord}
              hqEditable={allBusinessUnitsMode}
              unitEditable={!allBusinessUnitsMode && Boolean(activeStoreRecord)}
              open={openSection === 'address'}
              toggle={() => setOpenSection(openSection === 'address' ? null : 'address')}
              onSaveVendor={updateVendor}
            />
          </div>
          <div id="form-section-tax">
            <TaxSection
              vendor={vendor}
              open={openSection === 'tax'}
              toggle={() => setOpenSection(openSection === 'tax' ? null : 'tax')}
              onSave={updateVendor}
            />
          </div>
          <div id="form-section-hours-availability">
            <BusinessHoursSection
              vendor={vendor}
              open={openSection === 'hours-availability'}
              toggle={() => setOpenSection(openSection === 'hours-availability' ? null : 'hours-availability')}
              onSave={updateVendor}
            />
          </div>
          <div id="form-section-order-acceptance">
            <OrderAcceptanceSection
              vendor={vendor}
              open={openSection === 'order-acceptance'}
              toggle={() => setOpenSection(openSection === 'order-acceptance' ? null : 'order-acceptance')}
              onSave={updateVendor}
            />
          </div>
          <div id="form-section-external-domain">
            <ExternalDomainSection
              vendor={vendor}
              open={openSection === 'external-domain'}
              toggle={() => setOpenSection(openSection === 'external-domain' ? null : 'external-domain')}
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

function ProfileSection({ vendor, open, toggle, onSave }: SectionProps) {
  const qc = useQueryClient()
  const setVendor = useVendorStore((s) => s.setVendor)
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
  const logoRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)
  const extraBannerRef = useRef<HTMLInputElement>(null)

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

  const handleLogoFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCropFile(file)
    setCropTarget('logo')
    if (logoRef.current) logoRef.current.value = ''
  }

  const handleBannerFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCropFile(file)
    setCropTarget('banner')
    if (bannerRef.current) bannerRef.current.value = ''
  }

  const handleCropConfirm = async (croppedFile: File) => {
    const target = cropTarget
    setCropFile(null)
    setCropTarget(null)
    if (target === 'logo') {
      setLogoUploading(true)
      try {
        const { logo_url } = await vendorApi.uploadVendorLogo(croppedFile)
        if (vendor) setVendor({ ...vendor, logo_url })
        await qc.invalidateQueries({ queryKey: ['vendor', 'me'] })
        toast.success('Logo updated')
      } catch {
        toast.error('Could not upload logo — use a PNG or JPG file under 2MB')
      }
      setLogoUploading(false)
    } else if (target === 'banner') {
      setBannerUploading(true)
      try {
        const { banner_url } = await vendorApi.uploadVendorBanner(croppedFile)
        if (vendor) setVendor({ ...vendor, banner_url })
        await qc.invalidateQueries({ queryKey: ['vendor', 'me'] })
        toast.success('Banner updated')
      } catch {
        toast.error('Could not upload banner — use a PNG or JPG file under 5MB')
      }
      setBannerUploading(false)
    }
  }

  const removeLogo = () => onSave.mutate({ logo_url: '' })
  const removeBanner = () => onSave.mutate({ banner_url: '' })

  const handleExtraBannerFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (extraBannerRef.current) extraBannerRef.current.value = ''
    setExtraBannerUploading(true)
    try {
      const { extra_banners } = await vendorApi.uploadVendorExtraBanner(file)
      if (vendor) setVendor({ ...vendor, theme_config: { ...(vendor.theme_config || {}), extra_banners } })
      await qc.invalidateQueries({ queryKey: ['vendor', 'me'] })
      toast.success('Banner added')
    } catch {
      toast.error('Could not upload banner — use a PNG or JPG under 5MB')
    }
    setExtraBannerUploading(false)
  }

  const removeExtraBanner = async (url: string) => {
    try {
      const { extra_banners } = await vendorApi.removeVendorExtraBanner(url)
      if (vendor) setVendor({ ...vendor, theme_config: { ...(vendor.theme_config || {}), extra_banners } })
      await qc.invalidateQueries({ queryKey: ['vendor', 'me'] })
      toast.success('Banner removed')
    } catch {
      toast.error('Could not remove banner')
    }
  }

  const extraBanners: string[] = (vendor?.theme_config as any)?.extra_banners ?? []

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  const imgUrl = (url?: string | null) => {
    if (!url) return ''
    if (url.startsWith('http')) return url
    return `${API_URL.replace('/api/v1', '')}${url}`
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

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Logo & banner — single compact row */}
        <div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">Store branding</span>
            <span className="text-xs text-muted-foreground">PNG/JPG · banner 3:1</span>
          </div>
          <div className="flex items-stretch gap-2">
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileSelected} />
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                title="Upload logo"
                className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-blue-400 group"
              >
                {logoUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                ) : vendor?.logo_url ? (
                  <>
                    <img src={imgUrl(vendor.logo_url)} alt="Logo" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Camera className="h-3.5 w-3.5 text-white" />
                    </div>
                  </>
                ) : (
                  <Building2 className="h-5 w-5 text-gray-400" />
                )}
              </button>
              {vendor?.logo_url && (
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

            {/* Banners grid: primary + extras + add slot */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {/* Primary banner */}
                <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerFileSelected} />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => bannerRef.current?.click()}
                    title="Upload primary banner (1200×400)"
                    className="group relative flex h-16 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-blue-400"
                  >
                    {bannerUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : vendor?.banner_url ? (
                      <>
                        <img src={imgUrl(vendor.banner_url)} alt="Banner 1" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <Camera className="h-3.5 w-3.5 text-white" />
                        </div>
                      </>
                    ) : (
                      <span className="flex flex-col items-center gap-0.5 text-gray-400">
                        <ImageIcon className="h-4 w-4" />
                        <span className="text-[10px]">Primary</span>
                      </span>
                    )}
                  </button>
                  {vendor?.banner_url && (
                    <button type="button" aria-label="Remove banner" onClick={removeBanner}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-background bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                  <span className="mt-0.5 block text-center text-[10px] text-muted-foreground">Banner 1</span>
                </div>

                {/* Extra banners */}
                {extraBanners.map((url, i) => (
                  <div key={url} className="relative">
                    <div className="group relative flex h-16 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      <img src={imgUrl(url)} alt={`Banner ${i + 2}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>
                    <button type="button" aria-label="Remove banner" onClick={() => removeExtraBanner(url)}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-background bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90">
                      <X className="h-2.5 w-2.5" />
                    </button>
                    <span className="mt-0.5 block text-center text-[10px] text-muted-foreground">Banner {i + 2}</span>
                  </div>
                ))}

                {/* Add extra banner slot */}
                <input ref={extraBannerRef} type="file" accept="image/*" className="hidden" onChange={handleExtraBannerFileSelected} />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => extraBannerRef.current?.click()}
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
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="sm:col-span-2 lg:col-span-1">
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

// â”€â”€ Contact Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function supportPhonesFromVendor(vendor: Vendor): string[] {
  const settings = (vendor.settings || {}) as Record<string, unknown>
  const extra = Array.isArray(settings.support_phones)
    ? (settings.support_phones as string[]).filter((p) => typeof p === 'string' && p.trim())
    : []
  const primary = vendor.support_phone?.trim() || ''
  if (primary) {
    return [primary, ...extra.filter((p) => p.trim() !== primary)]
  }
  return extra.length > 0 ? extra : ['']
}

function supportEmailsFromVendor(vendor: Vendor): string[] {
  const settings = (vendor.settings || {}) as Record<string, unknown>
  const extra = Array.isArray(settings.support_emails)
    ? (settings.support_emails as string[]).filter((e) => typeof e === 'string' && e.trim())
    : []
  const primary = vendor.support_email?.trim() || ''
  if (primary) {
    return [primary, ...extra.filter((e) => e.trim().toLowerCase() !== primary.toLowerCase())]
  }
  return extra.length > 0 ? extra : ['']
}

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
    onSave.mutate({
      is_gst_registered: form.is_gst_registered,
      gstin: form.gstin || undefined,
      pan_number: form.pan_number || undefined,
      default_tax_rate: form.default_tax_rate ? parseFloat(form.default_tax_rate) : undefined,
    } as Partial<Vendor>)
  }

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

function BusinessHoursSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>({})
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
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    savingRef.current = true
    onSave.mutate({ business_hours: hours } as Partial<Vendor>, {
      onSettled: () => { savingRef.current = false },
    })
  }

  const updateDay = (day: string, field: string, value: string | boolean) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

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
        setOtpDevHint(res.dev_hint ?? '')
        setOtpSent(true)
      } catch {
        toast.error('Could not send verification code — try again')
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
    } catch (err: any) {
      setOtpError(err?.response?.data?.detail ?? 'Invalid code — try again')
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
    if (!registrar) { toast.error('Select a registrar first'); return }
    if (!regEmail.trim()) { toast.error('Enter the registrar login email first'); return }
    savingRef.current = true
    // Save ALL form fields together with the status — so "Edit" can pre-populate them
    onSave.mutate({
      external_domain_enabled: true,
      external_domain_scope: domainScope,
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
      onSuccess: () => { setAccessStatus('pending'); toast.success('Access marked as pending — KIT ERP team will verify') },
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

  return (
    <SectionWrapper
      title="External Domain"
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
                    { label: 'Login email', value: regEmail, mono: true },
                    { label: 'Scope', value: domainScope === 'all' ? 'All BU / Stores' : 'Per BU / Store' },
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
            {/* Scope: compact inline toggle */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
              <div>
                <span className="text-xs font-medium text-foreground">Same domain for all BU / Stores</span>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {domainScope === 'all' ? '(1 domain)' : '(1 per BU)'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={domainScope === 'all'}
                onClick={() => setDomainScope(s => s === 'all' ? 'per_unit' : 'all')}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${domainScope === 'all' ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${domainScope === 'all' ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
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
                <Label className="text-xs font-medium">Registrar <span className="text-red-500">*</span></Label>
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

            {/* Registrar email + Account holder */}
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

            {/* Expiry + Recovery contact */}
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
                    {editMode ? 'Update & re-submit' : "I've granted access"}
                  </Button>
                )}
                {accessStatus === 'revoked' && (
                  <Button type="button" size="sm" variant="outline" onClick={handleGrantedAccess}>
                    Re-grant access
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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
