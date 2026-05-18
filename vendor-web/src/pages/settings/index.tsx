import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVendorStore } from '@/stores/vendorStore'
import { useAuthStore } from '@/stores/authStore'
import { useUpdateVendor, useStores } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import {
  Save, Loader2, Store, MapPin, FileText, Globe,
  Clock, ChevronDown, ChevronUp, Building2, Phone,
  Camera, ImageIcon, X, Eye, Copy, ExternalLink, ShoppingBag,
  Palette,   ClipboardList, ChevronRight, Check, Settings2,
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

type Section = 'profile' | 'contact' | 'address' | 'tax' | 'hours' | 'order-acceptance' | 'social' | 'display' | 'modules' | 'about'

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
  const { vendor, selectedStore, setSelectedStore } = useVendorStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const updateVendor = useUpdateVendor()
  const [openSection, setOpenSection] = useState<Section | null>('profile')
  const [storeDropOpen, setStoreDropOpen] = useState(false)

  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []

  const showSupportAuditLink =
    !!vendor?.id &&
    !!user?.vendor_role?.vendor_id &&
    user.vendor_role.vendor_id === vendor.id &&
    (user.vendor_role.role === 'owner' || user.vendor_role.role === 'platform_staff')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={`w-2 h-2 rounded-full ${vendor?.status === 'approved' ? 'bg-green-500' : 'bg-amber-500'}`} />
          {vendor?.status}
        </div>
      </div>

      {showSupportAuditLink && (
        <Card className="border-blue-100 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900">
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Platform support activity</p>
                <p className="text-sm text-muted-foreground">
                  View when platform staff opened this dashboard from admin and what changes they made while signed in.
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="shrink-0" asChild>
              <Link to="/settings/support-activity">View audit log</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Unified Store & Overview card */}
      {(() => {
        const activeKey = selectedStore?.code || selectedStore?.id
        const slug = vendor?.slug?.trim()
        const storeBase = slug ? getCustomerStorefrontBaseUrl(slug) : ''
        const activeLink = slug
          ? (selectedStore
              ? `${storeBase}?branch=${encodeURIComponent(activeKey!)}`
              : storeBase)
          : '#'
        const linkDisplay = activeLink.startsWith('http') ? activeLink.replace(/^https?:\/\//, '') : activeLink
        const activeName = selectedStore?.name || vendor?.business_name || 'All Stores'
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
                        label="Store"
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
                    Company Codes
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </CardContent>

            {/* Divider */}
            <div className="mx-4 mt-3 border-t border-border" />

            {/* Store selector dropdown trigger */}
            <CardContent className="pt-3 pb-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStoreDropOpen(v => !v)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all',
                    storeDropOpen
                      ? 'border-primary/60 bg-accent/70'
                      : 'border-border hover:border-primary/40 hover:bg-accent/30 dark:hover:bg-secondary/40',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    selectedStore ? 'bg-primary' : 'bg-gradient-to-br from-primary to-info'
                  )}>
                    {selectedStore ? <Check className="w-4 h-4 text-white" /> : <Store className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {selectedStore?.name || vendor?.display_name || 'All Stores'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedStore
                        ? selectedStore.description || selectedStore.code || 'Active store'
                        : `${stores.length} store${stores.length !== 1 ? 's' : ''} · click to switch`}
                    </p>
                  </div>
                  <ChevronDown className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    storeDropOpen && 'rotate-180',
                  )}
                  />
                </button>

                {storeDropOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setStoreDropOpen(false)} />
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                      {/* All stores option */}
                      <button
                        type="button"
                        onClick={() => { setSelectedStore(null); setStoreDropOpen(false) }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors',
                          !selectedStore && 'bg-accent'
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-info flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{vendor?.display_name || 'All Stores'}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {vendor?.slug?.trim()
                              ? `${getCustomerStorefrontBaseUrl(vendor.slug.trim()).replace(/^https?:\/\//, '')} · all branches`
                              : 'Store URL'}
                          </p>
                        </div>
                        {!selectedStore && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>

                      {stores.length > 0 && <div className="border-t border-border" />}

                      {stores.map((s) => {
                        const branchKey = s.code || s.id
                        const vs = vendor?.slug?.trim()
                        const branchLink = vs
                          ? `${getCustomerStorefrontBaseUrl(vs).replace(/^https?:\/\//, '')}?branch=${branchKey}`
                          : ''
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedStore({ id: s.id, name: s.name, code: s.code, description: s.description })
                              setStoreDropOpen(false)
                              toast.success(`Switched to ${s.name}`)
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors',
                              selectedStore?.id === s.id && 'bg-accent'
                            )}
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Store className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground">{branchLink}</p>
                            </div>
                            {selectedStore?.id === s.id && <Check className="w-4 h-4 text-primary shrink-0" />}
                          </button>
                        )
                      })}

                      {stores.length === 0 && (
                        <p className="px-4 py-4 text-center text-sm text-muted-foreground">No branches configured yet</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Document Templates quick links */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-500" /> Document Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <button
            onClick={() => navigate('/invoices/templates')}
            className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-accent/70 dark:hover:bg-secondary/50"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-foreground">Invoice Templates</p>
                <p className="text-xs text-gray-500">Customise your invoice appearance, logo & colours</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => navigate('/purchase-orders/templates')}
            className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-accent/70 dark:hover:bg-secondary/50"
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-foreground">Purchase Order Templates</p>
                <p className="text-xs text-gray-500">Choose layout, colour & content for your POs</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </CardContent>
      </Card>

      <ProfileSection
        vendor={vendor}
        open={openSection === 'profile'}
        toggle={() => setOpenSection(openSection === 'profile' ? null : 'profile')}
        onSave={updateVendor}
      />
      <ContactSection
        vendor={vendor}
        open={openSection === 'contact'}
        toggle={() => setOpenSection(openSection === 'contact' ? null : 'contact')}
        onSave={updateVendor}
      />
      <AddressSection
        vendor={vendor}
        open={openSection === 'address'}
        toggle={() => setOpenSection(openSection === 'address' ? null : 'address')}
        onSave={updateVendor}
      />
      <TaxSection
        vendor={vendor}
        open={openSection === 'tax'}
        toggle={() => setOpenSection(openSection === 'tax' ? null : 'tax')}
        onSave={updateVendor}
      />
      <BusinessHoursSection
        vendor={vendor}
        open={openSection === 'hours'}
        toggle={() => setOpenSection(openSection === 'hours' ? null : 'hours')}
        onSave={updateVendor}
      />
      <OrderAcceptanceSection
        vendor={vendor}
        open={openSection === 'order-acceptance'}
        toggle={() => setOpenSection(openSection === 'order-acceptance' ? null : 'order-acceptance')}
        onSave={updateVendor}
      />
      <SocialLinksSection
        vendor={vendor}
        open={openSection === 'social'}
        toggle={() => setOpenSection(openSection === 'social' ? null : 'social')}
        onSave={updateVendor}
      />
      <DisplayFieldsSection
        vendor={vendor}
        open={openSection === 'display'}
        toggle={() => setOpenSection(openSection === 'display' ? null : 'display')}
        onSave={updateVendor}
      />
      <ModulesSection
        vendor={vendor}
        open={openSection === 'modules'}
        toggle={() => setOpenSection(openSection === 'modules' ? null : 'modules')}
        onSave={updateVendor}
      />
      <AboutSection
        open={openSection === 'about'}
        toggle={() => setOpenSection(openSection === 'about' ? null : 'about')}
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
              <p className="text-sm font-medium text-foreground">Vendor Admin — KITERP</p>
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

// ── Profile Section ──────────────────────────────────────────────────

function ProfileSection({ vendor, open, toggle, onSave }: SectionProps) {
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
        await vendorApi.uploadVendorLogo(croppedFile)
        window.location.reload()
      } catch {
        toast.error('Could not upload logo — use a PNG or JPG file under 2MB')
      }
      setLogoUploading(false)
    } else if (target === 'banner') {
      setBannerUploading(true)
      try {
        await vendorApi.uploadVendorBanner(croppedFile)
        window.location.reload()
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
    <SectionWrapper title="Store Profile" icon={Store} open={open} toggle={toggle}>
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
        <div className="flex justify-end border-b border-border pb-3 -mt-1">
          <SaveButton loading={onSave.isPending} />
        </div>
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

// ── Contact Section ──────────────────────────────────────────────────

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
        <div className="flex justify-end border-b border-border pb-3 -mt-1">
          <SaveButton loading={onSave.isPending} />
        </div>
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

// ── Address Section ──────────────────────────────────────────────────

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
    <SectionWrapper title="Address & Location" icon={MapPin} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <div className="flex justify-end border-b border-border pb-3 -mt-1">
          <SaveButton loading={onSave.isPending} />
        </div>
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

// ── Tax Section ──────────────────────────────────────────────────────

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
        <div className="flex justify-end border-b border-border pb-3 -mt-1">
          <SaveButton loading={onSave.isPending} />
        </div>
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

// ── Business Hours Section ───────────────────────────────────────────

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
    <SectionWrapper title="Business Hours" icon={Clock} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-3 pt-4">
        <div className="flex justify-end border-b border-border pb-3 -mt-1">
          <SaveButton loading={onSave.isPending} />
        </div>
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

// ── Order Acceptance Section ─────────────────────────────────────────

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

  return (
    <SectionWrapper title="Order Acceptance" icon={ShoppingBag} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <div className="flex justify-end border-b border-border pb-3 -mt-1">
          <SaveButton loading={onSave.isPending} />
        </div>
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
              <span className="text-sm font-medium text-gray-700">Set custom order acceptance hours</span>
            </label>

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

// ── Social Links Section ─────────────────────────────────────────────

const SOCIAL_FIELDS = [
  { key: 'website', label: 'Website', placeholder: 'https://yourstore.com' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+919876543210' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourstore' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourstore' },
  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/yourstore' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourstore' },
]

function SocialLinksSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [links, setLinks] = useState<Record<string, string>>({})
  const savingRef = useRef(false)

  useEffect(() => {
    if (vendor && !savingRef.current) {
      const l: Record<string, string> = {}
      for (const f of SOCIAL_FIELDS) {
        l[f.key] = vendor.social_links?.[f.key] || ''
      }
      setLinks(l)
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(links)) {
      if (v.trim()) cleaned[k] = v.trim()
    }
    savingRef.current = true
    onSave.mutate({ social_links: cleaned } as Partial<Vendor>, {
      onSettled: () => { savingRef.current = false },
    })
  }

  return (
    <SectionWrapper title="Social & Web Links" icon={Globe} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <div className="flex justify-end border-b border-border pb-3 -mt-1">
          <SaveButton loading={onSave.isPending} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SOCIAL_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              {f.key === 'whatsapp' ? (
                <PhoneInput
                  value={links[f.key] || ''}
                  onChange={(v) => setLinks({ ...links, [f.key]: v })}
                  defaultCountryIso="IN"
                />
              ) : (
                <Input
                  value={links[f.key] || ''}
                  onChange={(e) => setLinks({ ...links, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <SaveButton loading={onSave.isPending} />
        </div>
      </form>
    </SectionWrapper>
  )
}

// ── Storefront Display Section ──────────────────────────────────────

const PRODUCT_DISPLAY_FIELDS = [
  { key: 'brand', label: 'Brand' },
  { key: 'short_description', label: 'Short Description' },
  { key: 'specifications', label: 'Specifications' },
  { key: 'warranty', label: 'Warranty Info' },
  { key: 'return_policy', label: 'Return Policy' },
  { key: 'shipping_info', label: 'Shipping Info' },
  { key: 'offer_label', label: 'Offer / Sale Label' },
  { key: 'sku', label: 'SKU / Barcode' },
  { key: 'stock_status', label: 'Stock Status' },
  { key: 'tags', label: 'Tags' },
]

const SERVICE_DISPLAY_FIELDS = [
  { key: 'brand', label: 'Brand' },
  { key: 'short_description', label: 'Short Description' },
  { key: 'whats_included', label: "What's Included" },
  { key: 'whats_not_included', label: "What's Not Included" },
  { key: 'prerequisites', label: 'Prerequisites' },
  { key: 'service_areas', label: 'Service Areas' },
  { key: 'cancellation_policy', label: 'Cancellation Policy' },
  { key: 'offer_label', label: 'Offer / Sale Label' },
  { key: 'service_mode', label: 'Service Mode' },
  { key: 'tags', label: 'Tags' },
]

// ── Modules & Features Section ───────────────────────────────────────────────

const FINANCE_MODE_OPTIONS = [
  {
    value: 'basic',
    label: 'Basic Finance',
    description: 'Simple income, expense, salary and transfer tracking. Perfect for small businesses.',
  },
  {
    value: 'advanced',
    label: 'Advanced Finance (Full ERP)',
    description: 'Full chart of accounts, journal entries, AR/AP, budgets, reports and more.',
  },
]

function ModulesSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [financeMode, setFinanceMode] = useState<string>('advanced')
  const savingRef = useRef(false)

  useEffect(() => {
    if (vendor && !savingRef.current) {
      const mode = (vendor.settings as Record<string, unknown>)?.finance_mode as string | undefined
      setFinanceMode(mode ?? 'advanced')
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const existingSettings = (vendor?.settings || {}) as Record<string, unknown>
    savingRef.current = true
    onSave.mutate({
      settings: {
        ...existingSettings,
        finance_mode: financeMode,
      },
    } as Partial<Vendor>, {
      onSettled: () => { savingRef.current = false },
    })
  }

  return (
    <SectionWrapper title="Module Settings" icon={Landmark} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-6 pt-4">
        <div className="flex justify-end border-b border-border pb-3 -mt-1">
          <SaveButton loading={onSave.isPending} />
        </div>

        {/* Finance Mode */}
        <div>
          <label className="text-sm font-semibold text-gray-900 block mb-1">Finance Module</label>
          <p className="text-xs text-gray-500 mb-3">
            Choose how the Finance section appears in the sidebar and which features are available.
          </p>
          <div className="space-y-2">
            {FINANCE_MODE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  financeMode === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <input
                  type="radio"
                  name="finance_mode"
                  value={opt.value}
                  checked={financeMode === opt.value}
                  onChange={() => setFinanceMode(opt.value)}
                  className="mt-0.5 w-4 h-4 text-blue-600"
                />
                <div>
                  <p className={cn('text-sm font-semibold', financeMode === opt.value ? 'text-blue-900' : 'text-gray-900')}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <SaveButton loading={onSave.isPending} />
        </div>
      </form>
    </SectionWrapper>
  )
}

function DisplayFieldsSection({ vendor, open, toggle, onSave }: SectionProps) {
  const [productFields, setProductFields] = useState<Record<string, boolean>>({})
  const [serviceFields, setServiceFields] = useState<Record<string, boolean>>({})
  const savingRef = useRef(false)

  useEffect(() => {
    if (vendor && !savingRef.current) {
      const df = (vendor.settings as Record<string, unknown>)?.display_fields as Record<string, Record<string, boolean>> | undefined
      const pf: Record<string, boolean> = {}
      for (const f of PRODUCT_DISPLAY_FIELDS) {
        pf[f.key] = df?.product?.[f.key] ?? true
      }
      setProductFields(pf)

      const sf: Record<string, boolean> = {}
      for (const f of SERVICE_DISPLAY_FIELDS) {
        sf[f.key] = df?.service?.[f.key] ?? true
      }
      setServiceFields(sf)
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const existingSettings = (vendor?.settings || {}) as Record<string, unknown>
    savingRef.current = true
    onSave.mutate({
      settings: {
        ...existingSettings,
        display_fields: {
          product: productFields,
          service: serviceFields,
        },
      },
    } as Partial<Vendor>, {
      onSettled: () => { savingRef.current = false },
    })
  }

  const toggleAll = (type: 'product' | 'service', value: boolean) => {
    if (type === 'product') {
      const updated: Record<string, boolean> = {}
      for (const f of PRODUCT_DISPLAY_FIELDS) updated[f.key] = value
      setProductFields(updated)
    } else {
      const updated: Record<string, boolean> = {}
      for (const f of SERVICE_DISPLAY_FIELDS) updated[f.key] = value
      setServiceFields(updated)
    }
  }

  return (
    <SectionWrapper title="Storefront Display" icon={Eye} open={open} toggle={toggle}>
      <form onSubmit={handleSubmit} className="space-y-6 pt-4">
        <div className="flex justify-end border-b border-border pb-3 -mt-1">
          <SaveButton loading={onSave.isPending} />
        </div>
        <p className="text-sm text-gray-500">
          Control which fields are shown to customers on your storefront product and service pages.
        </p>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold">Product Fields</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => toggleAll('product', true)} className="text-xs text-blue-600 hover:underline">Show All</button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={() => toggleAll('product', false)} className="text-xs text-blue-600 hover:underline">Hide All</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_DISPLAY_FIELDS.map((f) => (
              <label key={f.key} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/70 dark:hover:bg-secondary/50">
                <input
                  type="checkbox"
                  checked={productFields[f.key] ?? true}
                  onChange={(e) => setProductFields({ ...productFields, [f.key]: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold">Service Fields</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => toggleAll('service', true)} className="text-xs text-blue-600 hover:underline">Show All</button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={() => toggleAll('service', false)} className="text-xs text-blue-600 hover:underline">Hide All</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SERVICE_DISPLAY_FIELDS.map((f) => (
              <label key={f.key} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/70 dark:hover:bg-secondary/50">
                <input
                  type="checkbox"
                  checked={serviceFields[f.key] ?? true}
                  onChange={(e) => setServiceFields({ ...serviceFields, [f.key]: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <SaveButton loading={onSave.isPending} />
        </div>
      </form>
    </SectionWrapper>
  )
}
