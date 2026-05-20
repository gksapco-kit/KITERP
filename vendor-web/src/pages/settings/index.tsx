import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVendorStore } from '@/stores/vendorStore'
import { useAuthStore } from '@/stores/authStore'
import { useUpdateVendor, useStores } from '@/hooks/useVendor'
import StoresPage from '@/pages/stores'
import { vendorApi } from '@/api/vendor'
import {
  Save, Loader2, Store, MapPin, FileText, Globe,
  Clock, ChevronDown, ChevronUp, Building2, Phone,
  Camera, ImageIcon, X, Eye, Copy, ExternalLink, ShoppingBag,
  ChevronRight, Check, Settings2,
  Info, CheckCircle2, Landmark, HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Vendor } from '@/types'
import { ImageCropModal } from '@/components/common/ImageCropModal'
import { APP_VERSION, APP_BUILD, LAST_UPDATED, CHANGELOG } from '@/constants/vendorAppMeta'
import { IdChip, VerifiedBadge, vendorVerificationLevel, formatStoreCode, formatVendorCode } from '@/lib/verification'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
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

export default function SettingsPage() {
  const { vendor, selectedStore } = useVendorStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []
  /** No branch filter — show Business Units hub instead of single-store overview card. */
  const allBusinessUnitsMode = stores.length > 1 && !selectedStore
  const [searchParams] = useSearchParams()
  const updateVendor = useUpdateVendor()

  // Deep-link: /settings?section=order-acceptance opens that accordion automatically
  const VALID_SECTIONS: Section[] = ['profile', 'contact', 'address', 'tax', 'hours-availability', 'order-acceptance', 'about']
  const rawSection = searchParams.get('section')
  const sectionParam = (rawSection && VALID_SECTIONS.includes(rawSection as Section) ? rawSection as Section : null)
  const [openSection, setOpenSection] = useState<Section | null>(sectionParam ?? 'profile')

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

  return (
    <div className={cn('mx-auto space-y-4', allBusinessUnitsMode ? 'max-w-6xl' : 'max-w-3xl')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <div className="flex flex-wrap items-center gap-2">
          {showSupportAuditLink && (
            <Link
              to="/settings/support-activity"
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/60 px-2.5 py-1 text-[11px] font-medium text-blue-800 hover:bg-blue-100/80 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
            >
              <HelpCircle className="h-3 w-3 shrink-0" />
              Support audit
            </Link>
          )}
          <div
            className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
            title={vendor?.status ?? undefined}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${vendor?.status === 'approved' ? 'bg-green-500' : 'bg-amber-500'}`} />
            {vendorStatusLabel(vendor?.status)}
          </div>
        </div>
      </div>

      {/* All business units: show management grid; one branch selected: store overview card */}
      {allBusinessUnitsMode ? (
        <StoresPage embeddedInSettings />
      ) : (() => {
        const activeKey = selectedStore?.code || selectedStore?.id
        const slug = vendor?.slug?.trim()
        const storeBase = slug ? getCustomerStorefrontBaseUrl(slug) : ''
        const activeLink = slug
          ? (selectedStore
              ? `${storeBase}?branch=${encodeURIComponent(activeKey!)}`
              : storeBase)
          : '#'
        const linkDisplay = activeLink.startsWith('http') ? activeLink.replace(/^https?:\/\//, '') : activeLink
        const activeName = selectedStore?.name || vendor?.business_name || 'Business'
        const activeDesc = selectedStore?.description || vendor?.business_type || ''

        return (
          <Card className={cn(selectedStore && 'ring-2 ring-ring ring-offset-1')}>
            {/* Header row: icon + name/link + logged-in + manage button */}
            <CardContent className="py-4 pb-0">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl',
                  selectedStore ? 'bg-accent' : 'bg-primary/15 dark:bg-secondary/80',
                )}>
                  {vendor?.logo_url && !selectedStore ? (
                    <img src={mediaUrl(vendor.logo_url)} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : selectedStore ? (
                    <Store className="h-7 w-7 text-primary" />
                  ) : (
                    <Building2 className="h-7 w-7 text-primary" />
                  )}
                </div>

                {/* Name + link */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate font-semibold text-foreground">{activeName}</p>
                    <VerifiedBadge level={vendorVerificationLevel(vendor)} size="xs" />
                    {selectedStore ? (
                      <IdChip
                        label="Business unit"
                        code={formatStoreCode({ id: selectedStore.id, code: selectedStore.code })}
                        fullValue={selectedStore.id}
                        className="!py-0 !px-1.5"
                      />
                    ) : (
                      vendor && (
                        <IdChip
                          label="Business"
                          code={formatVendorCode(vendor)}
                          fullValue={vendor.id}
                          className="!py-0 !px-1.5"
                        />
                      )
                    )}
                  </div>
                  {activeDesc && <p className="mt-0.5 truncate text-xs text-muted-foreground">{activeDesc}</p>}
                  {/* Store / vendor link */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <a
                      href={activeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate"
                    >
                      {linkDisplay}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeLink)
                        toast.success(selectedStore ? `${selectedStore.name} link copied!` : 'Store link copied!')
                      }}
                      className="shrink-0 rounded p-1 transition-colors hover:bg-accent/80 dark:hover:bg-secondary/50"
                      title="Copy link"
                    >
                      <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </div>
                  {/* Secondary: main vendor link when a branch is selected */}
                  {selectedStore && slug && (
                    <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-border">
                      <span className="text-[10px] text-gray-400 shrink-0">All stores:</span>
                      <a
                        href={storeBase}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-blue-600 hover:underline flex items-center gap-1 truncate"
                      >
                        {storeBase.replace(/^https?:\/\//, '')}
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Right: logged-in + manage */}
                <div className="text-right shrink-0 space-y-2">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Logged in as</p>
                    <p className="font-medium text-foreground">{user?.full_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/stores')}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary font-medium transition-colors px-2 py-1 rounded-lg hover:bg-accent ml-auto"
                  >
                    <Settings2 className="w-3 h-3" />
                    Business Units
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </CardContent>

            <CardContent className="border-t border-border pt-3 pb-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                To filter orders and reports by branch, use the{' '}
                <strong className="font-medium text-foreground">business unit selector in the top bar</strong>.
                {' '}
                <button
                  type="button"
                  onClick={() => navigate('/stores')}
                  className="font-medium text-primary hover:underline"
                >
                  Manage business units
                </button>
              </p>
            </CardContent>
          </Card>
        )
      })()}


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
          open={openSection === 'address'}
          toggle={() => setOpenSection(openSection === 'address' ? null : 'address')}
          onSave={updateVendor}
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
      <div id="settings-section-about">
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

function SectionWrapper({ title, icon: Icon, open, toggle, children }: {
  title: string; icon: React.ElementType; open: boolean; toggle: () => void; children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5 sm:py-[1.125rem]',
          'transition-colors',
          'hover:bg-accent/80 dark:hover:bg-secondary/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              'bg-primary/12 text-primary ring-1 ring-inset ring-primary/20',
              'dark:bg-primary/25 dark:ring-primary/40',
            )}
            aria-hidden
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
          </span>
          <span className="truncate text-base font-semibold leading-snug tracking-tight text-foreground">{title}</span>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground dark:text-foreground/80">
          {open ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        </span>
      </button>
      {open && (
        <CardContent className="border-t border-border bg-muted/25 px-4 pb-6 pt-0 dark:bg-black/20 sm:px-6">
          {children}
        </CardContent>
      )}
    </Card>
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
    <SectionWrapper title="About" icon={Info} open={open} toggle={toggle}>
      <div className="space-y-4 pt-2">
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
            <p className="text-[10px] text-muted-foreground">{LAST_UPDATED}</p>
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
          <p className="text-[11px] text-gray-400">
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
                  <span className="text-[10px] text-gray-400">{e.date}</span>
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

function SaveButton({ loading }: { loading: boolean }) {
  return (
    <Button type="submit" disabled={loading} className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Save Changes
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
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropTarget, setCropTarget] = useState<'logo' | 'banner' | null>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  const imgUrl = (url?: string | null) => {
    if (!url) return ''
    if (url.startsWith('http')) return url
    return `${API_URL.replace('/api/v1', '')}${url}`
  }

  return (
    <SectionWrapper title="Business profile" icon={Store} open={open} toggle={toggle}>
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

      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        {/* Logo & Banner */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Store Branding</Label>
          <div className="flex gap-5 items-start">
            {/* Logo */}
            <div className="flex flex-col items-center gap-1.5">
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileSelected} />
              <button type="button" onClick={() => logoRef.current?.click()}
                className="relative w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 flex items-center justify-center overflow-hidden group transition-colors bg-gray-50">
                {logoUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                ) : vendor?.logo_url ? (
                  <>
                    <img src={imgUrl(vendor.logo_url)} alt="Logo" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-0.5 text-gray-400">
                    <Building2 className="w-6 h-6" />
                    <span className="text-[9px]">Add Logo</span>
                  </div>
                )}
              </button>
              {vendor?.logo_url && (
                <button type="button" aria-label="Close" type="button" onClick={removeLogo} className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5">
                <X className="w-2.5 h-2.5" /> Remove
                </button>
              )}
              <span className="text-[10px] text-gray-400">Logo</span>
            </div>

            {/* Banner */}
            <div className="flex-1 flex flex-col gap-1.5">
              <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerFileSelected} />
              <button type="button" onClick={() => bannerRef.current?.click()}
                className="relative w-full h-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 flex items-center justify-center overflow-hidden group transition-colors bg-gray-50">
                {bannerUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                ) : vendor?.banner_url ? (
                  <>
                    <img src={imgUrl(vendor.banner_url)} alt="Banner" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-0.5 text-gray-400">
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-[10px]">Add Store Banner (1200x400)</span>
                  </div>
                )}
              </button>
              {vendor?.banner_url && (
                <button type="button" aria-label="Close" type="button" onClick={removeBanner} className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5 self-start">
                <X className="w-2.5 h-2.5" /> Remove
                </button>
              )}
              <span className="text-[10px] text-gray-400">Store Banner</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Business Name</Label>
            <Input
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              minLength={2}
              maxLength={255}
            />
            <p className="text-xs text-gray-400">Legal / registered name (e.g. on invoices). Store URL is unchanged.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Display Name</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Offering Type</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.offering_type}
            onChange={(e) => setForm({ ...form, offering_type: e.target.value })}
          >
            {OFFERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <textarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Tell customers about your business..."
            maxLength={2000}
          />
          <p className="text-xs text-gray-400">{form.description.length}/2000</p>
        </div>

        <div className="flex justify-end pt-2">
          <SaveButton loading={onSave.isPending} />
        </div>
      </form>
    </SectionWrapper>
  )
}

// â”€â”€ Contact Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ContactSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [form, setForm] = useState({
    support_email: '',
    support_phone: '',
  })

  useEffect(() => {
    if (vendor) {
      setForm({
        support_email: vendor.support_email || '',
        support_phone: vendor.support_phone || '',
      })
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave.mutate({
      support_email: form.support_email || undefined,
      support_phone: form.support_phone || undefined,
    } as Partial<Vendor>)
  }

  return (
    <SectionWrapper title="Contact Information" icon={Phone} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Primary Email</Label>
            <Input value={vendor?.primary_email || ''} disabled className="bg-gray-50" />
          </div>
          <div className="space-y-1.5">
            <Label>Primary Phone</Label>
            <Input value={vendor?.primary_phone || ''} disabled className="bg-gray-50" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Support Email</Label>
            <Input
              type="email"
              value={form.support_email}
              onChange={(e) => setForm({ ...form, support_email: e.target.value })}
              placeholder="support@yourstore.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Support Phone</Label>
            <PhoneInput
              value={form.support_phone}
              onChange={(v) => setForm({ ...form, support_phone: v })}
              defaultCountryIso="IN"
            />
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

function AddressSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [form, setForm] = useState({
    street_address: '',
    city: '',
    state: '',
    postal_code: '',
    latitude: '' as string,
    longitude: '' as string,
    service_radius_km: '10',
  })
  const savingRef = useRef(false)

  useEffect(() => {
    if (vendor && !savingRef.current) {
      setForm({
        street_address: vendor.street_address || '',
        city: vendor.city || '',
        state: vendor.state || '',
        postal_code: vendor.postal_code || '',
        latitude: vendor.latitude != null ? String(vendor.latitude) : '',
        longitude: vendor.longitude != null ? String(vendor.longitude) : '',
        service_radius_km: String(vendor.service_radius_km ?? 10),
      })
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    savingRef.current = true
    onSave.mutate({
      street_address: form.street_address || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      postal_code: form.postal_code || undefined,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      service_radius_km: form.service_radius_km ? parseInt(form.service_radius_km) : undefined,
    } as Partial<Vendor>, {
      onSettled: () => { savingRef.current = false },
    })
  }

  return (
    <SectionWrapper title="Business address (HQ)" icon={MapPin} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <div className="space-y-1.5">
          <Label>Street Address</Label>
          <Input
            value={form.street_address}
            onChange={(e) => setForm({ ...form, street_address: e.target.value })}
            placeholder="123 Main Street, Suite 100"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Hyderabad" />
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Telangana" />
          </div>
          <div className="space-y-1.5">
            <Label>Postal Code</Label>
            <Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="500001" />
          </div>
          <div className="space-y-1.5">
            <Label>Radius (km)</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={form.service_radius_km}
              onChange={(e) => setForm({ ...form, service_radius_km: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Latitude</Label>
            <Input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              placeholder="17.385044"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Longitude</Label>
            <Input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              placeholder="78.486671"
            />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <SaveButton loading={onSave.isPending} />
        </div>
      </form>
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
    <SectionWrapper title="Tax & Compliance" icon={FileText} open={open} toggle={toggle}>
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
    <SectionWrapper title="Hours & ordering" icon={Clock} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-3 pt-4">
        <p className="text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Opening hours</strong> — shown on your storefront (when you are open for visitors).
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
  const [useCustomHours, setUseCustomHours] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    if (vendor && !savingRef.current) {
      setEnabled(vendor.order_acceptance_enabled !== false)
      const h: Record<string, { open: string; close: string; closed: boolean }> = {}
      const hasCustom = vendor.order_acceptance_hours && Object.keys(vendor.order_acceptance_hours).length > 0
      setUseCustomHours(!!hasCustom)
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
      order_acceptance_hours: useCustomHours ? hours : {},
    } as Partial<Vendor>, {
      onSettled: () => { savingRef.current = false },
    })
  }

  const updateDay = (day: string, field: string, value: string | boolean) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  const copyFromOpeningHours = () => {
    if (!vendor?.business_hours) {
      toast.error('Save opening hours first')
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
    setUseCustomHours(true)
    toast.success('Copied opening hours')
  }

  return (
    <SectionWrapper title="Online orders" icon={ShoppingBag} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Controls when customers can place orders. If custom hours are off, the storefront uses your opening hours from the section above.
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm font-medium text-gray-700">Accept Orders</span>
        </label>
        <p className="text-xs text-gray-500">
          When disabled, customers cannot place new orders on your storefront.
        </p>

        {enabled && (
          <>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomHours}
                onChange={(e) => setUseCustomHours(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-medium text-foreground">Use custom order hours (different from opening hours)</span>
            </label>
            {useCustomHours && (
              <Button type="button" variant="outline" size="sm" onClick={copyFromOpeningHours}>
                Copy from opening hours
              </Button>
            )}

            {useCustomHours && (
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
