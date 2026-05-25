import { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BUSINESS_UNIT_STORE_LABEL } from '@/lib/businessUnitLabels'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import type { Vendor } from '@/types'
import { ImageCropModal } from '@/components/common/ImageCropModal'
import { APP_VERSION, APP_BUILD, LAST_UPDATED, CHANGELOG } from '@/constants/vendorAppMeta'
import { PhoneInput } from '@/components/ui/PhoneInput'

type Section = 'profile' | 'contact' | 'address' | 'tax' | 'hours-availability' | 'order-acceptance' | 'about'

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
  const stores = storesData?.stores ?? []
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
  const VALID_SECTIONS: Section[] = ['profile', 'contact', 'address', 'tax', 'hours-availability', 'order-acceptance', 'about']
  const rawSection = searchParams.get('section')
  const sectionParam = (rawSection && VALID_SECTIONS.includes(rawSection as Section) ? rawSection as Section : null)
  const [openSection, setOpenSection] = useState<Section | null>(sectionParam ?? 'profile')
  const [buListSearch, setBuListSearch] = useState('')

  // If the URL ?section= changes (e.g. navigating from universal search), update state + scroll
  useEffect(() => {
    if (sectionParam) {
      setOpenSection(sectionParam)
      // Give React a tick to expand the section before scrolling
      setTimeout(() => {
        const el = document.getElementById(`settings-section-${sectionParam}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [sectionParam])

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
    <div className="mx-auto max-w-6xl space-y-3">
      {/* Single header row: title + toolbar + chips */}
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

      <div key={scopeStoreId ?? 'all-units'} className="space-y-4">
        <div className="flex flex-col gap-4">
        <div id="settings-section-profile">
          <ProfileSection
            vendor={vendor}
            open={openSection === 'profile'}
            toggle={() => setOpenSection(openSection === 'profile' ? null : 'profile')}
            onSave={updateVendor}
          />
        </div>
        <div id="settings-section-contact">
          <ContactSection
            vendor={vendor}
            open={openSection === 'contact'}
            toggle={() => setOpenSection(openSection === 'contact' ? null : 'contact')}
            onSave={updateVendor}
          />
        </div>
        <div id="settings-section-address">
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
        <div id="settings-section-tax">
          <TaxSection
            vendor={vendor}
            open={openSection === 'tax'}
            toggle={() => setOpenSection(openSection === 'tax' ? null : 'tax')}
            onSave={updateVendor}
          />
        </div>
        <div id="settings-section-hours-availability">
          <BusinessHoursSection
            vendor={vendor}
            open={openSection === 'hours-availability'}
            toggle={() => setOpenSection(openSection === 'hours-availability' ? null : 'hours-availability')}
            onSave={updateVendor}
          />
        </div>
        <div id="settings-section-order-acceptance">
          <OrderAcceptanceSection
            vendor={vendor}
            open={openSection === 'order-acceptance'}
            toggle={() => setOpenSection(openSection === 'order-acceptance' ? null : 'order-acceptance')}
            onSave={updateVendor}
          />
        </div>
        </div>
      </div>
      <div id="settings-section-about" className="mt-6 border-t border-border pt-6">
        <AboutSection
          open={openSection === 'about'}
          toggle={() => setOpenSection(openSection === 'about' ? null : 'about')}
        />
      </div>
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
  open,
  toggle,
  children,
}: {
  title: string
  icon: React.ElementType
  /** Fixed subtitle (e.g. About); omit to use live business-unit scope from the header picker. */
  subtitle?: string
  /** Optional second line — descriptive help text shown below the scope label. */
  helpText?: string
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
      open={open}
      toggle={toggle}
    >
      {children}
    </CollapsibleSection>
  )
}

const SUPPORT_PHONE = (import.meta.env.VITE_SUPPORT_PHONE as string | undefined)?.trim()
const SUPPORT_CHAT_URL = (import.meta.env.VITE_SUPPORT_CHAT_URL as string | undefined)?.trim()
  || 'mailto:support@kiterp.com?subject=Vendor%20Dashboard%20Help'

function AboutSection({ open, toggle }: { open: boolean; toggle: () => void }) {
  const [showChangelog, setShowChangelog] = useState(false)
  const telHref = SUPPORT_PHONE
    ? `tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`
    : ''

  return (
    <SectionWrapper title="About" icon={Info} subtitle="App version & support" open={open} toggle={toggle}>
      <div className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2 text-muted-foreground"><Globe className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-medium text-foreground">Vendor Admin â€” KITERP</p>
              <p className="text-xs text-muted-foreground">Build {APP_BUILD}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-foreground">v{APP_VERSION}</p>
            <p className="text-xs text-muted-foreground">{LAST_UPDATED}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_PHONE ? (
            <a
              href={telHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90"
            >
              <Phone className="w-3.5 h-3.5" /> Call support
            </a>
          ) : null}
          <a
            href={SUPPORT_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:bg-accent/70 dark:hover:bg-secondary/50"
          >
            Chat with support
          </a>
        </div>
        {!SUPPORT_PHONE && (
          <p className="text-xs text-gray-400">
            Optional: set <code className="bg-gray-100 px-1 rounded">VITE_SUPPORT_PHONE</code> in your environment for a one-tap call button.
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500 py-2 border-t">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
          Up to date
        </div>
        <button
          type="button"
          onClick={() => setShowChangelog(v => !v)}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          {showChangelog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showChangelog ? 'Hide' : 'Show'} release notes
        </button>
        {showChangelog && (
          <div className="border rounded-xl divide-y overflow-hidden">
            {CHANGELOG.map(e => (
              <div key={e.version} className="p-3">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-mono font-semibold text-gray-800">v{e.version}</span>
                  <span className="text-xs text-gray-400">{e.date}</span>
                </div>
                <p className="text-xs text-gray-600">{e.notes}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionWrapper>
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


// Social, Display, and Module settings live in System Configuration:
// /system/social-links | /system/storefront-display | /system/modules
