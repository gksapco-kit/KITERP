import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVendorStore } from '@/stores/vendorStore'
import { toast } from 'sonner'
import {
  playTone, playToneForDuration, loadLocalRingtone, getLocalRingtoneName, clearLocalRingtone,
  TONE_OPTIONS, TONE_CATEGORIES, type ToneName,
} from '@/hooks/useNotificationSound'
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications'
import {
  Loader2, Bell, BellOff, Mail, MessageSquare, MessageCircle, Smartphone, Monitor, Moon, Clock,
  RefreshCw, Play, BellRing, CheckCircle, XCircle, AlertCircle,
  Save, Send, ArrowLeft, CheckCircle2, Volume2, VolumeX, Zap,
  ShoppingCart, Package, CreditCard, Star, AlertTriangle, Upload, Trash2,
  Plus, Repeat2, CalendarClock, MailOpen, ChevronDown, ChevronUp, Music2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveSlot { id: string; days: string[]; start: string; end: string }

interface NotificationPreferences {
  notifications_enabled: boolean
  in_app: boolean; email: boolean; sms: boolean; push: boolean; whatsapp: boolean
  new_orders: boolean; order_updates: boolean; low_stock: boolean
  payments: boolean; new_reviews: boolean; system_updates: boolean
  sound_enabled: boolean; sound_tone: ToneName; volume: number; tone_duration_sec: number
  per_event_tones: Record<string, string>
  schedule_enabled: boolean; schedule_mode: string; schedule_slots: ActiveSlot[]
  sync_with_store_hours: boolean
  repeat_enabled: boolean; repeat_interval_min: number
  repeat_max_count: number          // 0 = unlimited
  repeat_stop_on_read: boolean      // stop when any notification is marked read
  repeat_stop_on_focus: boolean     // stop when browser tab gains focus
  repeat_stop_on_order_accept: boolean  // stop when an order is accepted
  repeat_show_stop_button: boolean  // show on-screen "Stop repeating" action
  repeat_apply_events: string[]     // empty = all events; else only listed keys
  notify_mode: string; digest_time: string
}

const DEFAULT: NotificationPreferences = {
  notifications_enabled: true,
  in_app: true, email: true, sms: false, push: false, whatsapp: false,
  new_orders: true, order_updates: true, low_stock: true,
  payments: true, new_reviews: true, system_updates: true,
  sound_enabled: true, sound_tone: 'chime', volume: 70, tone_duration_sec: 3, per_event_tones: {},
  schedule_enabled: false, schedule_mode: 'quiet', schedule_slots: [],
  sync_with_store_hours: false,
  repeat_enabled: false, repeat_interval_min: 5,
  repeat_max_count: 0,
  repeat_stop_on_read: true, repeat_stop_on_focus: false,
  repeat_stop_on_order_accept: true, repeat_show_stop_button: true,
  repeat_apply_events: [],
  notify_mode: 'instant', digest_time: '09:00',
}

// ── EVENT definitions ─────────────────────────────────────────────────────────

const EVENTS = [
  { key: 'new_orders',    label: 'New Orders',    icon: ShoppingCart, color: 'bg-blue-100 text-blue-600' },
  { key: 'order_updates', label: 'Order Updates', icon: ShoppingCart, color: 'bg-sky-100 text-sky-600' },
  { key: 'low_stock',     label: 'Low Stock',     icon: Package,      color: 'bg-orange-100 text-orange-600' },
  { key: 'payments',      label: 'Payments',      icon: CreditCard,   color: 'bg-green-100 text-green-600' },
  { key: 'new_reviews',   label: 'New Reviews',   icon: Star,         color: 'bg-yellow-100 text-yellow-600' },
  { key: 'system_updates',label: 'System',        icon: AlertTriangle,color: 'bg-primary/12 text-primary' },
] as const

const DAYS_SHORT = ['mon','tue','wed','thu','fri','sat','sun'] as const
const DAYS_LABEL: Record<string, string> = {
  mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun',
}
// [label, value-in-minutes]
const REPEAT_OPTIONS: [string, number][] = [
  ['5 min', 5], ['15 min', 15], ['30 min', 30],
  ['1 hr', 60], ['2 hr', 120], ['4 hr', 240],
  ['1 day', 1440],
]
const REPEAT_OPTION_VALUES = REPEAT_OPTIONS.map(([, v]) => v)
const MAX_COUNT_OPTIONS = [
  { value: 0,  label: 'Unlimited' },
  { value: 1,  label: '1×' },
  { value: 2,  label: '2×' },
  { value: 3,  label: '3×' },
  { value: 5,  label: '5×' },
  { value: 10, label: '10×' },
]
const DURATION_OPTIONS: { sec: number; label: string }[] = [
  { sec: 1,  label: '1 s'  },
  { sec: 3,  label: '3 s'  },
  { sec: 5,  label: '5 s'  },
  { sec: 10, label: '10 s' },
  { sec: 30, label: '30 s' },
]

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
        'disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted dark:bg-secondary',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

// ── Settings nav sections ─────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'sec-channels', label: 'Channels',  icon: Bell },
  { id: 'sec-events',   label: 'Events',    icon: Zap },
  { id: 'sec-sound',    label: 'Sound',     icon: Volume2 },
  { id: 'sec-schedule', label: 'Schedule',  icon: CalendarClock },
  { id: 'sec-repeat',   label: 'Repeat',    icon: Repeat2 },
  { id: 'sec-digest',   label: 'Alert Mode', icon: MailOpen },
]

function SectionCard({ id, icon: Icon, iconColor, title, subtitle, children, dimmed }: {
  id?: string; icon: React.ElementType; iconColor: string; title: string; subtitle: string; children: React.ReactNode; dimmed?: boolean
}) {
  return (
    <Card
      id={id}
      className={cn(
        'scroll-mt-20 border-border',
        dimmed && 'pointer-events-none select-none opacity-50',
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-foreground">
          <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

function PreferenceRow({ icon: Icon, iconColor, title, description, checked, onChange, disabled, badge, children }: {
  icon: React.ElementType; iconColor: string; title: string; description: string
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; badge?: string
  children?: React.ReactNode
}) {
  return (
    <div className="border-b border-border py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className={cn('mt-0.5 shrink-0 rounded-lg p-2', iconColor)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {badge ? (
              <span className="mt-1 inline-flex w-fit rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {badge}
              </span>
            ) : null}
            <p className={cn('text-xs text-muted-foreground', badge ? 'mt-1.5' : 'mt-0.5')}>{description}</p>
          </div>
        </div>
        <div className="shrink-0 pt-0.5">
          <Toggle checked={checked} onChange={onChange} disabled={disabled} />
        </div>
      </div>
      {children}
    </div>
  )
}

function PermissionBadge({ status }: { status: string }) {
  if (status === 'granted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950/50 dark:text-green-300">
        <CheckCircle className="h-3 w-3" />
        Enabled
      </span>
    )
  }
  if (status === 'denied') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-300">
        <XCircle className="h-3 w-3" />
        Blocked
      </span>
    )
  }
  if (status === 'unsupported') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        Not supported
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/45 dark:text-amber-200">
      <AlertCircle className="h-3 w-3" />
      Not enabled
    </span>
  )
}

// ── Per-event tone select (native, grouped, includes custom when file exists) ──

function ToneSelect({ value, onChange }: {
  value: string; onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="max-w-[140px] rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">Default tone</option>
      {TONE_CATEGORIES.map(cat => {
        const tones = TONE_OPTIONS.filter(t =>
          t.category === cat.key &&
          t.value !== 'silent' &&
          t.value !== 'local'
        )
        if (!tones.length) return null
        return (
          <optgroup key={cat.key} label={cat.label}>
            {tones.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

// ── Scrollable Tone Dropdown ──────────────────────────────────────────────────

function ToneDropdown({ value, onChange, volume }: {
  value: ToneName; onChange: (v: ToneName) => void; volume: number
}) {
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const selected = TONE_OPTIONS.find(t => t.value === value)
  const close = useCallback(() => setOpen(false), [])

  return (
    <div className="relative" ref={dropRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-200 rounded-xl bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Music2 className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium text-gray-900 truncate">{selected?.label ?? 'Select tone'}</p>
            <p className="text-xs text-gray-400 truncate">{selected?.description}</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                {TONE_CATEGORIES.map(cat => {
                const tones = TONE_OPTIONS.filter(t =>
                  t.category === cat.key && t.value !== 'local'
                )
                if (!tones.length) return null
                return (
                  <div key={cat.key}>
                    <div className="px-3 py-1.5 bg-gray-50 sticky top-0 z-10">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{cat.label}</p>
                    </div>
                    {tones.map(t => (
                      <div
                        key={t.value}
                        className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${value === t.value ? 'bg-blue-50' : ''}`}
                        onClick={() => { onChange(t.value); close() }}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {value === t.value
                            ? <CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            : <span className="w-3.5 h-3.5 shrink-0" />
                          }
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${value === t.value ? 'text-blue-700' : 'text-gray-900'}`}>
                              {t.label}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{t.description}</p>
                          </div>
                        </div>
                        {t.value !== 'silent' && t.value !== 'local' && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); playTone(t.value, volume) }}
                            className="ml-2 p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-100 transition-colors shrink-0"
                            title={`Preview ${t.label}`}
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient()
  const { vendor } = useVendorStore()
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT)
  const [testSent, setTestSent] = useState(false)
  const [localFileName, setLocalFileName] = useState<string | null>(getLocalRingtoneName())
  const [localLoading, setLocalLoading] = useState(false)
  // Tracks which built-in tone is shown in the dropdown, even when custom ('local') is active
  const [selectedBuiltIn, setSelectedBuiltIn] = useState<ToneName>('chime')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isSupported, permission, request } = useBrowserNotifications()

  const { data: savedPrefs, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: async () => { const r = await apiClient.get('/vendors/me/notifications/preferences'); return r.data },
  })

  useEffect(() => {
    if (savedPrefs) {
      setPrefs(savedPrefs)
      if (savedPrefs.sound_tone !== 'local') {
        setSelectedBuiltIn(savedPrefs.sound_tone as ToneName)
      }
    }
  }, [savedPrefs])

  const save = useMutation({
    mutationFn: async (p: NotificationPreferences) => { const r = await apiClient.put('/vendors/me/notifications/preferences', p); return r.data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }); toast.success('Preferences saved.') },
    onError: () => toast.error('Failed to save preferences.'),
  })

  const sendTest = useMutation({
    mutationFn: async () => { await apiClient.post('/vendors/me/notifications/test') },
    onSuccess: () => {
      setTestSent(true)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Test notification sent!')
      setTimeout(() => setTestSent(false), 4000)
    },
    onError: () => toast.error('Failed to send test notification.'),
  })

  function set<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    setPrefs(prev => ({ ...prev, [key]: value }))
  }

  async function handleRequestPermission() {
    const r = await request()
    if (r === 'granted') toast.success('Browser notifications enabled!')
    else if (r === 'denied') toast.error('Permission denied. Enable in browser settings.')
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLocalLoading(true)
    try {
      await loadLocalRingtone(file)
      setLocalFileName(file.name)
      set('sound_tone', 'local')
      toast.success(`"${file.name}" loaded as custom ringtone.`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load file.')
    } finally {
      setLocalLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleClearLocal() {
    clearLocalRingtone()
    setLocalFileName(null)
    if (prefs.sound_tone === 'local') set('sound_tone', 'chime')
  }

  // ── Schedule slot helpers ─────────────────────────────────────────────────

  function addSlot() {
    const slot: ActiveSlot = {
      id: Date.now().toString(),
      days: ['mon','tue','wed','thu','fri'],
      start: prefs.schedule_mode === 'quiet' ? '22:00' : '09:00',
      end:   prefs.schedule_mode === 'quiet' ? '08:00' : '17:00',
    }
    set('schedule_slots', [...prefs.schedule_slots, slot])
  }

  function removeSlot(id: string) {
    set('schedule_slots', prefs.schedule_slots.filter(s => s.id !== id))
  }

  function updateSlot(id: string, patch: Partial<ActiveSlot>) {
    set('schedule_slots', prefs.schedule_slots.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  function toggleSlotDay(id: string, day: string) {
    const slot = prefs.schedule_slots.find(s => s.id === id)!
    const days = slot.days.includes(day) ? slot.days.filter(d => d !== day) : [...slot.days, day]
    updateSlot(id, { days })
  }

  const storeHours = vendor?.business_hours as Record<string, { open: string; close: string; closed?: boolean }> | undefined
  const isDisabled = !prefs.notifications_enabled

  // ── Custom repeat interval unit state ────────────────────────────────────
  type RepeatUnit = 'min' | 'hr' | 'day' | 'week'
  const UNIT_MULTIPLIERS: Record<RepeatUnit, number> = { min: 1, hr: 60, day: 1440, week: 10080 }
  const [customRepeatUnit, setCustomRepeatUnit] = useState<RepeatUnit>('min')
  const [customRepeatVal, setCustomRepeatVal]   = useState<number>(1)

  /** Convert minutes back to the best-fit unit for display */
  function minutesToUnit(minutes: number): { val: number; unit: RepeatUnit } {
    if (minutes % 10080 === 0) return { val: minutes / 10080, unit: 'week' }
    if (minutes % 1440  === 0) return { val: minutes / 1440,  unit: 'day'  }
    if (minutes % 60    === 0) return { val: minutes / 60,    unit: 'hr'   }
    return { val: minutes, unit: 'min' }
  }

  // ── Scroll spy ───────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<string>(NAV_SECTIONS[0].id)

  useEffect(() => {
    const TRIGGER = 120 // px from top of viewport where section becomes "active"

    function updateActive() {
      // If scrolled to the very bottom, always highlight the last section
      const scrollBottom = window.scrollY + window.innerHeight
      const pageHeight   = document.documentElement.scrollHeight
      if (pageHeight - scrollBottom < 10) {
        setActiveSection(NAV_SECTIONS[NAV_SECTIONS.length - 1].id)
        return
      }

      // Find the last section whose top edge is above the trigger line
      let active = NAV_SECTIONS[0].id
      for (const s of NAV_SECTIONS) {
        const el = document.getElementById(s.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= TRIGGER) {
          active = s.id
        }
      }
      setActiveSection(active)
    }

    window.addEventListener('scroll', updateActive, { passive: true })
    updateActive() // run once on mount
    return () => window.removeEventListener('scroll', updateActive)
  }, [])

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="pb-32">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/notifications" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="min-w-0 flex-1 basis-[min(100%,16rem)]">
          <h1 className="text-2xl font-bold text-foreground">Notification Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Control how, when, and where you receive notifications.</p>
        </div>
        {/* Master toggle in header for quick access */}
        <div
          className={cn(
            'ml-auto flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 transition-all',
            prefs.notifications_enabled
              ? 'border-primary/30 bg-primary/10 dark:bg-primary/15'
              : 'border-destructive/30 bg-destructive/10 dark:bg-destructive/15',
          )}
        >
          {prefs.notifications_enabled
            ? <Bell className="h-3.5 w-3.5 text-primary" />
            : <BellOff className="h-3.5 w-3.5 text-destructive" />}
          <span
            className={cn(
              'text-xs font-medium',
              prefs.notifications_enabled ? 'text-primary' : 'text-destructive',
            )}
          >
            {prefs.notifications_enabled ? 'On' : 'Off'}
          </span>
          <Toggle checked={prefs.notifications_enabled} onChange={v => set('notifications_enabled', v)} />
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* Left nav — always visible from md+, truly sticky via inline style */}
        <aside
          className="hidden md:block w-40 shrink-0 self-start"
          style={{ position: 'sticky', top: 72 }}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
            <p className="px-4 pb-2 pt-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Sections</p>
            <nav className="space-y-0.5 px-2 pb-2">
              {NAV_SECTIONS.map(s => {
                const isActive = activeSection === s.id
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={e => {
                      e.preventDefault()
                      document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <s.icon className="w-3.5 h-3.5 shrink-0" />
                    {s.label}
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground/50" />
                    )}
                  </a>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

      {/* ── Delivery Channels ─────────────────────────────────────────────── */}
      <SectionCard id="sec-channels" icon={Bell} iconColor="text-blue-600" title="Delivery Channels" subtitle="Choose how notifications reach you." dimmed={isDisabled}>
        <PreferenceRow icon={Monitor} iconColor="bg-blue-100 text-blue-600" title="In-App" description="Notification inbox in the dashboard." checked={prefs.in_app} onChange={v => set('in_app', v)} />
        <PreferenceRow icon={Mail} iconColor="bg-indigo-100 text-indigo-600" title="Email" description="Sent to your registered email address." checked={prefs.email} onChange={v => set('email', v)} />
        <PreferenceRow icon={MessageSquare} iconColor="bg-green-100 text-green-600" title="SMS" description="Text message to your phone." checked={prefs.sms} onChange={v => set('sms', v)} badge="Coming soon" disabled />
        <PreferenceRow icon={MessageCircle} iconColor="bg-emerald-100 text-emerald-600" title="WhatsApp" description="Message via WhatsApp to your linked number." checked={prefs.whatsapp} onChange={v => set('whatsapp', v)} badge="Coming soon" disabled />
        <PreferenceRow icon={Smartphone} iconColor="bg-primary/12 text-primary" title="Mobile Push" description="Native push on the mobile app." checked={prefs.push} onChange={v => set('push', v)} badge="Coming soon" disabled />

        {/* Browser desktop push — inline permission row */}
        <div className="border-t border-border py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 gap-3">
              <div className="mt-0.5 shrink-0 rounded-lg bg-primary/15 p-2 text-primary ring-1 ring-inset ring-primary/25 dark:bg-primary/20">
                <BellRing className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Browser (Desktop)</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Pop-up alerts even when the tab is in the background.</p>
              </div>
            </div>
            <div className="shrink-0 pt-0.5">
              <PermissionBadge status={isSupported ? permission : 'unsupported'} />
            </div>
          </div>
          {isSupported && permission === 'default' && (
            <div className="mt-2 pl-11">
              <Button size="sm" onClick={handleRequestPermission} className="gap-2">
                <Bell className="w-4 h-4" /> Enable Browser Notifications
              </Button>
            </div>
          )}
          {permission === 'denied' && (
            <div className="mt-2 ml-11 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-2">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Click the lock icon in your browser address bar → set Notifications to "Allow" → reload.
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Notification Events + per-event tone ─────────────────────────── */}
      <SectionCard id="sec-events" icon={Zap} iconColor="text-orange-500" title="Notification Events" subtitle="Choose which events trigger an alert and set a custom tone per event." dimmed={isDisabled}>
        {EVENTS.map(ev => (
        <div className="border-t border-border py-3 last:border-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 gap-3">
              <div className={cn('mt-0.5 shrink-0 rounded-lg p-2', ev.color)}>
                <ev.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{ev.label}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tone</span>
                  <ToneSelect
                    value={prefs.per_event_tones[ev.key] ?? ''}
                    onChange={v => set('per_event_tones', { ...prefs.per_event_tones, [ev.key]: v })}
                  />
                  {(prefs.per_event_tones[ev.key]) && (
                    <button
                      type="button"
                      onClick={() => playTone((prefs.per_event_tones[ev.key] as ToneName), prefs.volume)}
                      className="text-muted-foreground transition-colors hover:text-primary"
                      title="Preview"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0 pt-0.5">
              <Toggle
                checked={prefs[ev.key as keyof NotificationPreferences] as boolean}
                onChange={v => set(ev.key as keyof NotificationPreferences, v as never)}
              />
            </div>
          </div>
        </div>
        ))}
      </SectionCard>

      {/* ── Notification Sound Settings ───────────────────────────────────── */}
      <SectionCard id="sec-sound" icon={Volume2} iconColor="text-blue-600" title="Notification Sound Settings" subtitle="Choose your ringtone, volume, and test your setup." dimmed={isDisabled}>
        {/* Sound on/off */}
        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${prefs.sound_enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
              {prefs.sound_enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Enable sound alerts</p>
              <p className="text-xs text-gray-500 mt-0.5">Play a sound when new notifications arrive.</p>
            </div>
          </div>
          <Toggle checked={prefs.sound_enabled} onChange={v => set('sound_enabled', v)} />
        </div>

        {prefs.sound_enabled && (
          <div className="pt-3 space-y-5">
            {/* ── Ringtone — two option cards ── */}
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Ringtone</p>
              <div className="space-y-2">

                {/* Option A: Built-in tone */}
                <div className={`rounded-xl border p-3 transition-all ${
                  prefs.sound_tone !== 'local'
                    ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                    : 'border-gray-200 bg-white'
                }`}>
                  {/* Row 1 — label + status */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Music2 className={`w-4 h-4 ${prefs.sound_tone !== 'local' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="text-sm font-semibold text-gray-900">Standard Tone</span>
                    </div>
                    {prefs.sound_tone !== 'local' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> In Use
                      </span>
                    ) : (
                      <Button size="sm" variant="outline"
                        className="h-7 px-3 text-xs gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                        onClick={() => { set('sound_tone', selectedBuiltIn); playTone(selectedBuiltIn, prefs.volume) }}>
                        <Play className="w-3 h-3" /> Use this
                      </Button>
                    )}
                  </div>
                  {/* Row 2 — dropdown + preview */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <ToneDropdown
                        value={selectedBuiltIn}
                        onChange={v => {
                          setSelectedBuiltIn(v)
                          if (prefs.sound_tone !== 'local') {
                            set('sound_tone', v)
                            if (v !== 'silent') playTone(v, prefs.volume)
                          }
                        }}
                        volume={prefs.volume}
                      />
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 shrink-0"
                      onClick={() => playTone(selectedBuiltIn, prefs.volume)}
                      disabled={selectedBuiltIn === 'silent'}>
                      <Play className="w-3.5 h-3.5" /> Preview
                    </Button>
                  </div>
                </div>

                {/* Option B: Custom / local ringtone */}
                <div className={`rounded-xl border p-3 transition-all ${
                  prefs.sound_tone === 'local'
                    ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                    : 'border-gray-200 bg-white'
                }`}>
                  {/* Row 1 — label + status */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Upload className={`w-4 h-4 ${prefs.sound_tone === 'local' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="text-sm font-semibold text-gray-900">Custom Ringtone</span>
                    </div>
                    {localFileName ? (
                      prefs.sound_tone === 'local' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> In Use
                        </span>
                      ) : (
                        <Button size="sm" variant="outline"
                          className="h-7 px-3 text-xs gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                          onClick={() => { set('sound_tone', 'local'); playTone('local', prefs.volume) }}>
                          <Play className="w-3 h-3" /> Use this
                        </Button>
                      )
                    ) : null}
                  </div>
                  {/* Row 2 — filename/upload + preview + file actions */}
                  <div className="flex gap-2">
                    <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border ${
                      prefs.sound_tone === 'local' ? 'border-blue-200 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}>
                      {localFileName ? (
                        <p className={`text-xs truncate flex-1 ${prefs.sound_tone === 'local' ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                          {localFileName}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 flex-1">No file uploaded · MP3, OGG, WAV · max 5 MB</p>
                      )}
                      {localFileName && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-0.5 bg-white hover:border-gray-300 transition-colors">
                            Replace
                          </button>
                          <button type="button" onClick={handleClearLocal} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {localFileName ? (
                      <Button variant="outline" size="sm" className="gap-1.5 shrink-0"
                        onClick={() => playTone('local', prefs.volume)}>
                        <Play className="w-3.5 h-3.5" /> Preview
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1.5 shrink-0"
                        onClick={() => fileInputRef.current?.click()} disabled={localLoading}>
                        {localLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Upload
                      </Button>
                    )}
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
              </div>
            </div>

            {/* Volume */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-700">Volume</p>
                <span className="text-xs font-mono text-gray-500">{prefs.volume}%</span>
              </div>
              <div className="flex items-center gap-3">
                <VolumeX className="w-4 h-4 text-gray-400 shrink-0" />
                <input type="range" min={0} max={100} step={5} value={prefs.volume}
                  onChange={e => set('volume', Number(e.target.value))}
                  onMouseUp={() => playTone(prefs.sound_tone === 'local' ? 'local' : selectedBuiltIn, prefs.volume)}
                  onTouchEnd={() => playTone(prefs.sound_tone === 'local' ? 'local' : selectedBuiltIn, prefs.volume)}
                  className="flex-1 h-2 rounded-full accent-blue-600 cursor-pointer" />
                <Volume2 className="w-4 h-4 text-gray-600 shrink-0" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Release slider to preview selected tone.</p>
            </div>

            {/* Tone duration */}
            {prefs.sound_tone !== 'silent' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-700">Alert duration</p>
                  <span className="text-xs font-mono text-gray-500">{prefs.tone_duration_sec} s</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map(({ sec, label }) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => set('tone_duration_sec', sec)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        prefs.tone_duration_sec === sec
                          ? 'bg-primary text-white border-blue-600'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">How long the tone plays on each alert. Preview below uses this duration.</p>
              </div>
            )}

            {/* Preview & test buttons */}
            <div className="flex flex-wrap gap-2 pt-1 border-t">
              <Button variant="outline" size="sm" className="gap-2"
                onClick={() => playTone(prefs.sound_tone === 'local' ? 'local' : selectedBuiltIn, prefs.volume)}
                disabled={selectedBuiltIn === 'silent' && prefs.sound_tone !== 'local'}>
                <Play className="w-3.5 h-3.5" /> Preview tone
              </Button>
              <Button variant="outline" size="sm" className="gap-2"
                onClick={() => sendTest.mutate()}
                disabled={sendTest.isPending || testSent}>
                {sendTest.isPending ? <Loader2 className="w-4 h-4 animate-spin" />
                  : testSent ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                  : <Send className="w-4 h-4" />}
                {testSent ? 'Sent! Check inbox.' : 'Send test notification'}
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Unified Notification Schedule ─────────────────────────────────── */}
      <SectionCard
        id="sec-schedule"
        icon={CalendarClock}
        iconColor="text-indigo-600"
        title="Notification Schedule"
        subtitle="Define when sounds and alerts are active. Choose quiet periods or active-only windows."
        dimmed={isDisabled}
      >
        {/* Master schedule toggle */}
        <PreferenceRow
          icon={CalendarClock}
          iconColor={prefs.schedule_enabled ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}
          title="Enable scheduling"
          description="Apply time-based rules to control when notifications are sounded."
          checked={prefs.schedule_enabled}
          onChange={v => set('schedule_enabled', v)}
        >
          {prefs.schedule_enabled && (
            <div className="mt-4 space-y-4 pl-11">

              {/* Mode picker */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Schedule mode</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'quiet',  icon: Moon,         label: 'Silence during',   desc: 'Mute alerts in these periods' },
                    { value: 'active', icon: CalendarClock, label: 'Active windows only', desc: 'Only alert during these slots' },
                  ].map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => set('schedule_mode', m.value)}
                      className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                        prefs.schedule_mode === m.value
                          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <m.icon className={`w-4 h-4 mt-0.5 shrink-0 ${prefs.schedule_mode === m.value ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <div>
                        <p className="text-xs font-medium text-gray-900">{m.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">
                  {prefs.schedule_mode === 'quiet' ? 'Silence periods' : 'Active windows'}
                </p>
                {prefs.schedule_slots.length === 0 && (
                  <p className="text-xs text-gray-400 italic mb-2">No periods added yet — click "+ Add" below.</p>
                )}
                <div className="space-y-3">
                  {prefs.schedule_slots.map((slot, idx) => (
                    <div key={slot.id} className="border border-border rounded-xl p-3 bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-700">
                          {prefs.schedule_mode === 'quiet' ? `Silence period ${idx + 1}` : `Window ${idx + 1}`}
                        </p>
                        <button type="button" onClick={() => removeSlot(slot.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Day selector */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">Days <span className="text-gray-400">(empty = every day)</span></p>
                        <div className="flex gap-1 flex-wrap">
                      {DAYS_SHORT.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleSlotDay(slot.id, d)}
                          className={`w-9 h-8 rounded-lg text-xs font-medium transition-all duration-150 select-none ${
                            slot.days.includes(d)
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white border border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'
                          }`}
                        >
                          {DAYS_LABEL[d]}
                        </button>
                      ))}
                        </div>
                      </div>

                      {/* Time range */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                            <Clock className="w-3 h-3" />
                            {prefs.schedule_mode === 'quiet' ? 'Start (silence from)' : 'From'}
                          </label>
                          <input type="time" value={slot.start}
                            onChange={e => updateSlot(slot.id, { start: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                            <Clock className="w-3 h-3" />
                            {prefs.schedule_mode === 'quiet' ? 'End (resume alerts)' : 'To'}
                          </label>
                          <input type="time" value={slot.end}
                            onChange={e => updateSlot(slot.id, { end: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2 text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                  onClick={addSlot}
                >
                  <Plus className="w-4 h-4" />
                  {prefs.schedule_mode === 'quiet' ? 'Add silence period' : 'Add window'}
                </Button>
              </div>

              {/* Sync with store hours */}
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${prefs.sync_with_store_hours ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400'}`}>
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Sync with store hours</p>
                    <p className="text-xs text-gray-500 mt-0.5">Only ring when your store is open. Overrides slots above.</p>
                    {prefs.sync_with_store_hours && storeHours && (
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                        {DAYS_SHORT.map(d => {
                          const h = storeHours[d] ?? storeHours[d + 'day'] ?? storeHours[`${d}day`]
                          return <p key={d} className="text-xs text-gray-500">{DAYS_LABEL[d]}: {h?.closed ? 'Closed' : h ? `${h.open}–${h.close}` : '—'}</p>
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <Toggle checked={prefs.sync_with_store_hours} onChange={v => set('sync_with_store_hours', v)} />
              </div>

              <p className="text-xs text-gray-400">
                {prefs.schedule_mode === 'quiet'
                  ? 'Sounds and browser pop-ups are suppressed during silence periods. In-app notifications are always recorded.'
                  : 'Sounds and browser pop-ups are only fired during active windows. In-app notifications are always recorded.'}
              </p>
            </div>
          )}
        </PreferenceRow>
      </SectionCard>

      {/* ── Repeat Alerts ─────────────────────────────────────────────────── */}
      <SectionCard id="sec-repeat" icon={Repeat2} iconColor="text-rose-500" title="Repeat Alerts" subtitle="Re-ring if you have unread notifications after a set interval." dimmed={isDisabled}>
        <PreferenceRow icon={Repeat2} iconColor={prefs.repeat_enabled ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-400'}
          title="Enable repeat alerts" description="Sound the tone again every few minutes while there are unread notifications."
          checked={prefs.repeat_enabled} onChange={v => set('repeat_enabled', v)}>
          {prefs.repeat_enabled && (
            <div className="mt-4 pl-11 space-y-5">

              {/* ── Interval ── */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Repeat interval</p>
                {/* Preset chips */}
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  {REPEAT_OPTIONS.map(([label, mins]) => (
                    <button key={mins} type="button"
                      onClick={() => set('repeat_interval_min', mins)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 select-none ${
                        prefs.repeat_interval_min === mins && REPEAT_OPTION_VALUES.includes(prefs.repeat_interval_min)
                          ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                    >{label}</button>
                  ))}
                </div>
                {/* Custom value + unit */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Custom:</span>
                  <input
                    type="number" min={1} step={1}
                    value={REPEAT_OPTION_VALUES.includes(prefs.repeat_interval_min) ? customRepeatVal : minutesToUnit(prefs.repeat_interval_min).val}
                    placeholder="1"
                    onChange={e => {
                      const v = Math.max(1, Number(e.target.value))
                      if (!isNaN(v)) {
                        setCustomRepeatVal(v)
                        set('repeat_interval_min', v * UNIT_MULTIPLIERS[customRepeatUnit])
                      }
                    }}
                    className={`w-16 text-xs text-center border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400 ${
                      !REPEAT_OPTION_VALUES.includes(prefs.repeat_interval_min)
                        ? 'border-rose-500 bg-rose-50 text-rose-700 font-medium'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  />
                  <select
                    value={REPEAT_OPTION_VALUES.includes(prefs.repeat_interval_min) ? customRepeatUnit : minutesToUnit(prefs.repeat_interval_min).unit}
                    onChange={e => {
                      const unit = e.target.value as RepeatUnit
                      setCustomRepeatUnit(unit)
                      const num = REPEAT_OPTION_VALUES.includes(prefs.repeat_interval_min) ? customRepeatVal : minutesToUnit(prefs.repeat_interval_min).val
                      set('repeat_interval_min', num * UNIT_MULTIPLIERS[unit])
                    }}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  >
                    <option value="min">min</option>
                    <option value="hr">hr</option>
                    <option value="day">day</option>
                    <option value="week">week</option>
                  </select>
                </div>
                {!REPEAT_OPTION_VALUES.includes(prefs.repeat_interval_min) && (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">
                    Custom: every {minutesToUnit(prefs.repeat_interval_min).val} {minutesToUnit(prefs.repeat_interval_min).unit}{minutesToUnit(prefs.repeat_interval_min).val !== 1 ? 's' : ''}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">Respects your schedule settings.</p>
              </div>

              {/* ── Max repetitions ── */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Max repetitions</p>
                <div className="flex gap-2 flex-wrap">
                  {MAX_COUNT_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => set('repeat_max_count', opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        prefs.repeat_max_count === opt.value
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-rose-400'
                      }`}
                    >{opt.label}</button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  {prefs.repeat_max_count === 0
                    ? 'Alert will repeat until a stop condition is met.'
                    : `Alert will repeat at most ${prefs.repeat_max_count} time${prefs.repeat_max_count > 1 ? 's' : ''}, then stop automatically.`}
                </p>
              </div>

              {/* ── Stop conditions ── */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Stop repeating when…</p>
                <div className="space-y-2">
                  {([
                    { key: 'repeat_stop_on_read',         label: 'Notification is marked as read',              desc: 'Stops the moment any unread alert is dismissed or read.' },
                    { key: 'repeat_stop_on_order_accept',  label: 'Order is accepted / confirmed',               desc: 'Stops automatically when the related order is actioned.' },
                    { key: 'repeat_show_stop_button',      label: 'Show "Stop repeating" button on screen',      desc: 'A dismissible banner appears on each re-ring letting you stop instantly.' },
                    { key: 'repeat_stop_on_focus',         label: 'Browser tab comes into focus',                desc: 'Stops when you switch back to this dashboard tab.' },
                  ] as { key: keyof NotificationPreferences; label: string; desc: string }[]).map(cond => (
                    <div key={cond.key} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800">{cond.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{cond.desc}</p>
                      </div>
                      <Toggle
                        checked={prefs[cond.key] as boolean}
                        onChange={v => set(cond.key, v as never)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Apply to events ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-700">Apply repeats to</p>
                  <button type="button"
                    onClick={() => set('repeat_apply_events', prefs.repeat_apply_events.length === 0 ? EVENTS.map(e => e.key) : [])}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    {prefs.repeat_apply_events.length === 0 ? 'Select specific' : 'All events'}
                  </button>
                </div>
                {prefs.repeat_apply_events.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Repeat alerts apply to <strong className="text-gray-600">all events</strong>. Tap "Select specific" to limit.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {EVENTS.map(ev => {
                      const active = prefs.repeat_apply_events.includes(ev.key)
                      return (
                        <button key={ev.key} type="button"
                          onClick={() => set('repeat_apply_events',
                            active
                              ? prefs.repeat_apply_events.filter(k => k !== ev.key)
                              : [...prefs.repeat_apply_events, ev.key]
                          )}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-rose-300'
                          }`}
                        >
                          <ev.icon className="w-3 h-3" />
                          {ev.label}
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1.5">
                  {prefs.repeat_apply_events.length === 0
                    ? 'All event types will trigger repeat alerts.'
                    : `Only: ${prefs.repeat_apply_events.map(k => EVENTS.find(e => e.key === k)?.label).filter(Boolean).join(', ')}.`}
                </p>
              </div>

            </div>
          )}
        </PreferenceRow>
      </SectionCard>

      {/* ── Notification Digest ───────────────────────────────────────────── */}
      <SectionCard id="sec-digest" icon={MailOpen} iconColor="text-primary" title="Notification Delivery Mode" subtitle="Control when sounds and browser alerts fire. Your inbox always updates in real time." dimmed={isDisabled}>
        <div className="space-y-2 py-2">
          {([
            {
              value: 'instant',
              label: 'Instant',
              description: 'Sound and browser alert fire the moment each event occurs.',
              hint: null,
              icon: Zap,
            },
            {
              value: 'digest_hourly',
              label: 'Hourly digest',
              description: 'Individual events are silent. One summary alert fires at the top of every hour if you have unread notifications.',
              hint: (() => {
                const now = new Date()
                const next = new Date(now)
                next.setHours(now.getHours() + 1, 0, 0, 0)
                const diff = Math.round((next.getTime() - now.getTime()) / 60_000)
                return `Next digest in ~${diff} min (at ${next.getHours().toString().padStart(2,'0')}:00)`
              })(),
              icon: Clock,
            },
            {
              value: 'digest_daily',
              label: 'Daily digest',
              description: 'All events are silent during the day. A single summary fires at your chosen time if you have unread notifications.',
              hint: `Fires at ${prefs.digest_time || '09:00'} every day`,
              icon: MailOpen,
            },
          ] as const).map(mode => (
            <button
              key={mode.value}
              type="button"
              onClick={() => set('notify_mode', mode.value)}
              className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 ${
                prefs.notify_mode === mode.value
                  ? 'border-primary bg-accent ring-1 ring-ring shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${prefs.notify_mode === mode.value ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                <mode.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{mode.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{mode.description}</p>
                {prefs.notify_mode === mode.value && mode.hint && (
                  <p className="text-xs text-primary font-medium mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />{mode.hint}
                  </p>
                )}
              </div>
              {prefs.notify_mode === mode.value && <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
            </button>
          ))}
        </div>

        {/* Daily digest time picker */}
        {prefs.notify_mode === 'digest_daily' && (
          <div className="pt-3 border-t flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent text-primary shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-700 mb-1">Send daily digest at</p>
              <input
                type="time"
                value={prefs.digest_time}
                onChange={e => set('digest_time', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-36"
              />
            </div>
            <p className="text-xs text-gray-400 text-right">Fires daily if<br />you have unread<br />notifications</p>
          </div>
        )}

        {/* Info note */}
        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-100">
          <Bell className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">Your notification inbox updates in real time regardless of delivery mode. Digest mode only affects sounds and browser alerts.</p>
        </div>
      </SectionCard>

        </div>{/* end main content */}
      </div>{/* end two-column flex */}

      {/* ── Sticky save bar ───────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:shadow-[0_-8px_30px_rgba(0,0,0,0.35)] lg:left-60 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="text-xs text-muted-foreground">Changes are saved to your account.</p>
        <Button onClick={() => save.mutate(prefs)} disabled={save.isPending} className="gap-2 shadow">
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save preferences
        </Button>
      </div>
    </div>
  )
}
