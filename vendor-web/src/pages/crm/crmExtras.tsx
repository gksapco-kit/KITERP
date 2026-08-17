/**
 * Shared "extras" for CRM entities (contacts + accounts):
 * photos (with captions), document attachments, reminders, schedules, and
 * free-form custom fields. Everything is persisted inside the entity's
 * `custom_fields` JSON so no extra tables/migrations are required.
 *
 * Usage in a form:
 *   const extras = useCrmExtras(existing?.custom_fields)
 *   ... render {extras.sections} ...
 *   const custom_fields = extras.serialize({ company, location })
 *
 * Usage in a read-only view:
 *   <CrmExtrasView cf={record.custom_fields} />
 */
import { useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus, Loader2, Trash2, ImagePlus, Bell, CalendarClock, FileText, Paperclip, Download,
  Star, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { crmApi } from '@/api/crm'
import { formatDateTime, cn, mediaUrl } from '@/lib/utils'
import { Field } from './_shared'
import { MediaUploadPickerModal, galleryImageToFile } from '@/components/common/MediaUploadPickerModal'

// Common dialing codes; default to India (+91) given the primary market.
export const COUNTRY_CODES = [
  '+91', '+1', '+44', '+61', '+65', '+971', '+49', '+33', '+81', '+86', '+92', '+880',
]

export const CURRENCIES = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'JPY', symbol: '¥' },
]
export const currencySymbol = (code: string) => CURRENCIES.find(c => c.code === code)?.symbol || code

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10), o = n % 10
  return TENS[t] + (o ? '-' + ONES[o] : '')
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100), rest = n % 100
  return [h ? `${ONES[h]} hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ')
}
/** Amount in words using the Indian numbering system (crore/lakh/thousand). */
export function amountInWords(num: number): string {
  const n = Math.floor(Math.abs(num))
  if (n === 0) return ''
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const below = n % 1000
  const parts = [
    crore ? `${threeDigits(crore)} crore` : '',
    lakh ? `${twoDigits(lakh)} lakh` : '',
    thousand ? `${twoDigits(thousand)} thousand` : '',
    below ? threeDigits(below) : '',
  ].filter(Boolean)
  const words = parts.join(' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Keys managed by dedicated UI — kept out of the free-form "custom fields" list.
export const RESERVED_CUSTOM_KEYS = [
  'company', 'location', 'photos', 'reminders', 'schedules', 'documents',
  'checklist', 'responsible_name', 'notes', 'owner_name', 'type_label',
  'monitor_manager_id', 'monitor_additional',
  'ticket_type', 'due_at', 'reminder_at', 'duration_minutes',
]

/** Split a stored "+91 98765 43210" into a country code + the remaining number. */
export function splitPhone(phone?: string | null): { cc: string; number: string } {
  if (!phone) return { cc: '+91', number: '' }
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) {
    const idx = trimmed.indexOf(' ')
    if (idx > 0) {
      const cc = trimmed.slice(0, idx)
      return { cc: COUNTRY_CODES.includes(cc) ? cc : '+91', number: trimmed.slice(idx + 1).trim() }
    }
  }
  return { cc: '+91', number: trimmed }
}

export function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter(x => x && typeof x === 'object') as Record<string, unknown>[]) : []
}
export const str = (v: unknown) => (v == null ? '' : String(v))

const crmSectionLabelCls = 'text-xs font-medium text-gray-500 flex items-center gap-1'
const crmSectionIconCls = 'w-3 h-3'
const crmIconActionCls =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:pointer-events-none'

function CrmIconAction({
  title, onClick, disabled, children, active,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(crmIconActionCls, active && 'border-primary/40 bg-primary/5 text-primary')}
    >
      {children}
    </button>
  )
}

const crmPresetBtnBase =
  'text-[10px] leading-tight px-2 py-0.5 rounded-full border transition-colors'

type CrmUrgencyTone = 'green' | 'golden' | 'pink'

/** Calendar days from today to *value* (negative = overdue). */
export function crmCalendarDaysUntil(value?: string): number | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTarget = new Date(d)
  startOfTarget.setHours(0, 0, 0, 0)
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000)
}

/** Pink = due soon/overdue, golden = within a week, green = further out. */
export function crmUrgencyTone(days: number): CrmUrgencyTone {
  if (days <= 1) return 'pink'
  if (days <= 7) return 'golden'
  return 'green'
}

function urgencyMetaCls(tone: CrmUrgencyTone): string {
  const map: Record<CrmUrgencyTone, string> = {
    green: 'rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-[10px] leading-tight text-emerald-800',
    golden: 'rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] leading-tight text-amber-900',
    pink: 'rounded-md bg-pink-50 border border-pink-200 px-2 py-1 text-[10px] leading-tight text-pink-800',
  }
  return map[tone]
}

function urgencyMetaTextCls(tone: CrmUrgencyTone): { day: string; sep: string; remain: string } {
  const map: Record<CrmUrgencyTone, { day: string; sep: string; remain: string }> = {
    green: { day: 'font-medium text-emerald-900', sep: 'text-emerald-500', remain: 'text-emerald-700' },
    golden: { day: 'font-medium text-amber-950', sep: 'text-amber-600', remain: 'text-amber-800' },
    pink: { day: 'font-medium text-pink-900', sep: 'text-pink-500', remain: 'text-pink-700' },
  }
  return map[tone]
}

function urgencyPresetCls(tone: CrmUrgencyTone): string {
  const map: Record<CrmUrgencyTone, string> = {
    green: `${crmPresetBtnBase} bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100`,
    golden: `${crmPresetBtnBase} bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100`,
    pink: `${crmPresetBtnBase} bg-pink-50 text-pink-800 border-pink-200 hover:bg-pink-100`,
  }
  return map[tone]
}

function urgencyInputCls(tone: CrmUrgencyTone): string {
  const map: Record<CrmUrgencyTone, string> = {
    green: 'h-8 text-xs border-emerald-200 bg-emerald-50/40 focus-visible:ring-0 focus-visible:border-emerald-400',
    golden: 'h-8 text-xs border-amber-200 bg-amber-50/40 focus-visible:ring-0 focus-visible:border-amber-400',
    pink: 'h-8 text-xs border-pink-200 bg-pink-50/50 focus-visible:ring-0 focus-visible:border-pink-400',
  }
  return map[tone]
}

const crmPresetBtnCls =
  `${crmPresetBtnBase} bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200`

/** Format a Date for `<input type="datetime-local" />` in local time. */
export function toDatetimeLocalValue(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseDatetimeLocal(value?: string): Date {
  if (value) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(from)
  let diff = (weekday - d.getDay() + 7) % 7
  if (diff === 0) diff = 7
  d.setDate(d.getDate() + diff)
  return d
}

/** Weekday + calendar date, e.g. "Monday, 24 Jun" */
export function formatCrmDayLabel(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
}

/** Human-readable days until/since a datetime */
export function crmDaysRemainingLabel(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTarget = new Date(d)
  startOfTarget.setHours(0, 0, 0, 0)
  const days = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day left'
  if (days === -1) return '1 day ago'
  if (days > 0) return `${days} days left`
  return `${Math.abs(days)} days ago`
}

function DateTimeMeta({ value, scheduleAccent = false }: { value: string; scheduleAccent?: boolean }) {
  if (!value) return null
  const day = formatCrmDayLabel(value)
  const remain = crmDaysRemainingLabel(value)
  if (!day && !remain) return null

  if (scheduleAccent) {
    const days = crmCalendarDaysUntil(value)
    const tone = days != null ? crmUrgencyTone(days) : 'pink'
    const text = urgencyMetaTextCls(tone)
    return (
      <p className={urgencyMetaCls(tone)}>
        <span className={text.day}>{day}</span>
        {remain && <span className={text.sep}> · </span>}
        {remain && <span className={text.remain}>{remain}</span>}
      </p>
    )
  }

  return (
    <p className="text-[10px] leading-tight text-gray-500 px-0.5">
      <span className="font-medium text-gray-600">{day}</span>
      {remain && <span className="text-gray-400"> · </span>}
      {remain && <span>{remain}</span>}
    </p>
  )
}

export const CRM_DATETIME_PRESETS: { label: string; apply: (base: Date) => Date }[] = [
  { label: 'Now', apply: () => new Date() },
  { label: 'Tomorrow', apply: d => addDays(d, 1) },
  { label: '+1d', apply: d => addDays(d, 1) },
  { label: '+2d', apply: d => addDays(d, 2) },
  { label: '+3d', apply: d => addDays(d, 3) },
  { label: 'Mon', apply: d => nextWeekday(d, 1) },
  { label: 'Tue', apply: d => nextWeekday(d, 2) },
  { label: 'Wed', apply: d => nextWeekday(d, 3) },
  { label: 'Thu', apply: d => nextWeekday(d, 4) },
  { label: 'Fri', apply: d => nextWeekday(d, 5) },
  { label: 'Week', apply: d => addDays(d, 7) },
  { label: 'Month', apply: d => addMonths(d, 1) },
  { label: 'Quarter', apply: d => addMonths(d, 3) },
  { label: 'Half year', apply: d => addMonths(d, 6) },
  { label: 'Year', apply: d => addMonths(d, 12) },
]

function DateTimePresets({
  value, onChange, scheduleAccent = false,
}: {
  value: string
  onChange: (v: string) => void
  scheduleAccent?: boolean
}) {
  const base = parseDatetimeLocal(value)
  return (
    <div className="flex flex-wrap gap-1">
      {CRM_DATETIME_PRESETS.map(p => {
        const target = toDatetimeLocalValue(p.apply(base))
        const days = crmCalendarDaysUntil(target)
        const tone = scheduleAccent && days != null ? crmUrgencyTone(days) : null
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(target)}
            className={tone ? urgencyPresetCls(tone) : crmPresetBtnCls}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

export function CrmDateTimeField({
  value, onChange, className, inputClassName, scheduleAccent = false, showPresets = true,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  inputClassName?: string
  scheduleAccent?: boolean
  showPresets?: boolean
}) {
  const display = value || toDatetimeLocalValue()
  const days = scheduleAccent && value ? crmCalendarDaysUntil(value) : null
  const inputTone = days != null ? crmUrgencyTone(days) : 'pink'

  return (
    <div className={cn('space-y-1 min-w-0', className)}>
      <Input
        type="datetime-local"
        value={display}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (!value) onChange(toDatetimeLocalValue()) }}
        className={cn(
          scheduleAccent ? urgencyInputCls(inputTone) : 'h-8 text-xs',
          inputClassName,
        )}
      />
      <DateTimeMeta value={value} scheduleAccent={scheduleAccent} />
      {showPresets && (
        <DateTimePresets value={value} onChange={onChange} scheduleAccent={scheduleAccent} />
      )}
    </div>
  )
}

/** Narrow duration input with due-day context */
export function CrmDurationField({
  value, onChange, dueAt, scheduleAccent = false,
}: {
  value: string
  onChange: (v: string) => void
  dueAt?: string
  scheduleAccent?: boolean
}) {
  const days = scheduleAccent && dueAt ? crmCalendarDaysUntil(dueAt) : null
  const inputTone = days != null ? crmUrgencyTone(days) : 'pink'

  return (
    <div className="space-y-1 min-w-0 w-full">
      <Input
        type="number"
        min={0}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="min"
        className={cn('w-full px-2', scheduleAccent ? urgencyInputCls(inputTone) : 'h-9 text-sm')}
      />
      {dueAt && scheduleAccent && <DateTimeMeta value={dueAt} scheduleAccent />}
      {dueAt && !scheduleAccent && (
        <div className="text-[10px] leading-tight text-gray-500">
          <p className="font-medium text-gray-600 truncate">{formatCrmDayLabel(dueAt).split(',')[0]}</p>
          <p className="truncate">{crmDaysRemainingLabel(dueAt)}</p>
        </div>
      )}
    </div>
  )
}

/** Due | Reminder | Duration — three equal columns */
export function CrmScheduleRow({
  dueAt, onDueAt, reminderAt, onReminderAt, duration, onDuration,
}: {
  dueAt: string
  onDueAt: (v: string) => void
  reminderAt: string
  onReminderAt: (v: string) => void
  duration: string
  onDuration: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
      <Field label="Due at">
        <CrmDateTimeField value={dueAt} onChange={onDueAt} scheduleAccent />
      </Field>
      <Field label="Reminder at">
        <CrmDateTimeField value={reminderAt} onChange={onReminderAt} scheduleAccent />
      </Field>
      <Field label="Duration">
        <CrmDurationField value={duration} onChange={onDuration} dueAt={dueAt} scheduleAccent />
      </Field>
    </div>
  )
}

type CustomField = { id: number; key: string; value: string }
type Photo = { id: number; url: string; caption: string; is_primary: boolean }
type DocItem = { id: number; url: string; filename: string; content_type: string }
type Reminder = { id: number; at: string; note: string }
type Schedule = { id: number; at: string; title: string; note: string }

export function useCrmExtras(customFieldsJson?: Record<string, unknown> | null) {
  const cf = (customFieldsJson || {}) as Record<string, unknown>
  const idRef = useRef(0)
  const nextId = () => idRef.current++

  const [customFields, setCustomFields] = useState<CustomField[]>(() =>
    Object.entries(cf)
      .filter(([k]) => !RESERVED_CUSTOM_KEYS.includes(k))
      .map(([k, v]) => ({ id: nextId(), key: k, value: v == null ? '' : String(v) })),
  )
  const [photos, setPhotos] = useState<Photo[]>(() =>
    asArray(cf.photos)
      .map(p => ({ id: nextId(), url: str(p.url), caption: str(p.caption), is_primary: !!p.is_primary }))
      .filter(p => p.url),
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [documents, setDocuments] = useState<DocItem[]>(() =>
    asArray(cf.documents)
      .map(d => ({ id: nextId(), url: str(d.url), filename: str(d.filename) || 'document', content_type: str(d.content_type) }))
      .filter(d => d.url),
  )
  const [reminders, setReminders] = useState<Reminder[]>(() =>
    asArray(cf.reminders).map(r => ({ id: nextId(), at: str(r.at), note: str(r.note) })),
  )
  const [schedules, setSchedules] = useState<Schedule[]>(() =>
    asArray(cf.schedules).map(s => ({ id: nextId(), at: str(s.at), title: str(s.title), note: str(s.note) })),
  )
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  const addField = () => setCustomFields(prev => [...prev, { id: nextId(), key: '', value: '' }])
  const updateField = (id: number, patch: Partial<CustomField>) =>
    setCustomFields(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)))
  const removeField = (id: number) => setCustomFields(prev => prev.filter(f => f.id !== id))

  const appendPhoto = (url: string) =>
    setPhotos(prev => [...prev, { id: nextId(), url, caption: '', is_primary: prev.length === 0 }])

  const onPickPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setUploadingPhoto(true)
    try {
      for (const file of Array.from(files)) {
        const { url } = await vendorApi.uploadVendorBrandingAsset(file)
        appendPhoto(url)
      }
    } catch { /* keep form usable on failure */ } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }
  // Stock-gallery / external URL picks → re-upload to our storage so they persist.
  const addPhotoFromUrl = async (url: string) => {
    setUploadingPhoto(true)
    try {
      const file = await galleryImageToFile(url)
      const res = await vendorApi.uploadVendorBrandingAsset(file)
      appendPhoto(res.url)
    } catch {
      appendPhoto(url) // fall back to referencing the URL directly
    } finally {
      setUploadingPhoto(false)
    }
  }
  const updatePhoto = (id: number, caption: string) =>
    setPhotos(prev => prev.map(p => (p.id === id ? { ...p, caption } : p)))
  const setPrimaryPhoto = (id: number) =>
    setPhotos(prev => prev.map(p => ({ ...p, is_primary: p.id === id })))
  const movePhoto = (id: number, dir: -1 | 1) =>
    setPhotos(prev => {
      const i = prev.findIndex(p => p.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const removePhoto = (id: number) =>
    setPhotos(prev => {
      const next = prev.filter(p => p.id !== id)
      if (next.length && !next.some(p => p.is_primary)) next[0].is_primary = true
      return next
    })

  const onPickDocs = async (files: FileList | null) => {
    if (!files?.length) return
    setUploadingDoc(true)
    try {
      for (const file of Array.from(files)) {
        const d = await crmApi.uploadDocument(file)
        setDocuments(prev => [...prev, {
          id: nextId(), url: d.url, filename: d.filename, content_type: d.content_type || '',
        }])
      }
    } catch { /* keep form usable on failure */ } finally {
      setUploadingDoc(false)
      if (docInputRef.current) docInputRef.current.value = ''
    }
  }
  const removeDoc = (id: number) => setDocuments(prev => prev.filter(d => d.id !== id))

  const addReminder = () => setReminders(prev => [...prev, { id: nextId(), at: toDatetimeLocalValue(), note: '' }])
  const updateReminder = (id: number, patch: Partial<Reminder>) =>
    setReminders(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  const removeReminder = (id: number) => setReminders(prev => prev.filter(r => r.id !== id))

  const addSchedule = () => setSchedules(prev => [...prev, { id: nextId(), at: toDatetimeLocalValue(), title: '', note: '' }])
  const updateSchedule = (id: number, patch: Partial<Schedule>) =>
    setSchedules(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  const removeSchedule = (id: number) => setSchedules(prev => prev.filter(s => s.id !== id))

  /** Merge all extras into the provided base custom_fields object. */
  const serialize = (base: Record<string, unknown> = {}): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...base }
    for (const f of customFields) {
      const key = f.key.trim()
      if (key && !RESERVED_CUSTOM_KEYS.includes(key)) out[key] = f.value.trim()
    }
    const cleanPhotos = photos.filter(p => p.url)
      .map(p => ({ url: p.url, caption: p.caption.trim(), is_primary: p.is_primary }))
    if (cleanPhotos.length && !cleanPhotos.some(p => p.is_primary)) cleanPhotos[0].is_primary = true
    if (cleanPhotos.length) out.photos = cleanPhotos

    const cleanDocs = documents.filter(d => d.url)
      .map(d => ({ url: d.url, filename: d.filename, content_type: d.content_type }))
    if (cleanDocs.length) out.documents = cleanDocs

    const cleanReminders = reminders.filter(r => r.at || r.note.trim())
      .map(r => ({ at: r.at, note: r.note.trim() }))
    if (cleanReminders.length) out.reminders = cleanReminders

    const cleanSchedules = schedules.filter(s => s.at || s.title.trim() || s.note.trim())
      .map(s => ({ at: s.at, title: s.title.trim(), note: s.note.trim() }))
    if (cleanSchedules.length) out.schedules = cleanSchedules

    return out
  }

  const actionToolbar: ReactNode = (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-gray-50/80 px-3 py-2">
      <span className="text-[11px] font-medium text-gray-500 mr-0.5">Add</span>
      <CrmIconAction title="Attach documents" disabled={uploadingDoc} active={documents.length > 0} onClick={() => docInputRef.current?.click()}>
        {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
      </CrmIconAction>
      <CrmIconAction title="Add photos" disabled={uploadingPhoto} active={photos.length > 0} onClick={() => setPickerOpen(true)}>
        {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
      </CrmIconAction>
      <CrmIconAction title="Add custom field" active={customFields.length > 0} onClick={addField}>
        <Plus className="w-4 h-4" />
      </CrmIconAction>
      <CrmIconAction title="Add reminder" active={reminders.length > 0} onClick={addReminder}>
        <Bell className="w-4 h-4" />
      </CrmIconAction>
      <CrmIconAction title="Add schedule" active={schedules.length > 0} onClick={addSchedule}>
        <CalendarClock className="w-4 h-4" />
      </CrmIconAction>
    </div>
  )

  const documentsSection: ReactNode = documents.length > 0 ? (
    <div className="space-y-2">
      <p className={crmSectionLabelCls}><Paperclip className={crmSectionIconCls} /> Documents</p>
      <ul className="space-y-1.5">
        {documents.map(d => (
          <li key={d.id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
            <FileText className="w-3 h-3 text-gray-400 shrink-0" />
            <a href={mediaUrl(d.url)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-xs text-blue-600 hover:underline">
              {d.filename}
            </a>
            <button type="button" aria-label="Remove document" onClick={() => removeDoc(d.id)}
              className="text-gray-400 hover:text-red-500">
              <Trash2 className="w-3 h-3" />
            </button>
          </li>
        ))}
      </ul>
      <input ref={docInputRef} type="file" multiple className="hidden"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        onChange={(e) => onPickDocs(e.target.files)} />
    </div>
  ) : (
    <input ref={docInputRef} type="file" multiple className="hidden"
      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
      onChange={(e) => onPickDocs(e.target.files)} />
  )

  const photosSection: ReactNode = photos.length > 0 ? (
    <div className="space-y-2">
      <p className={crmSectionLabelCls}><ImagePlus className={crmSectionIconCls} /> Photos</p>
      <div className="flex flex-wrap gap-3">
        {photos.map((p, idx) => (
          <div key={p.id} className="w-24">
            <div className="group relative h-24 w-24 overflow-hidden rounded-lg border bg-gray-50">
              <img src={p.url} alt={p.caption || 'photo'} className="h-full w-full object-cover" />
              {p.is_primary && (
                <span className="absolute top-0.5 left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-yellow-900 shadow-sm" aria-label="Primary photo">
                  <Star className="h-2.5 w-2.5 fill-current" />
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/55 px-1 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" title="Set as primary" aria-label="Set as primary"
                  onClick={() => setPrimaryPhoto(p.id)}
                  className="rounded p-0.5 text-white hover:bg-white/20 disabled:opacity-40" disabled={p.is_primary}>
                  <Star className="h-3.5 w-3.5" />
                </button>
                <button type="button" title="Move left" aria-label="Move left"
                  onClick={() => movePhoto(p.id, -1)}
                  className="rounded p-0.5 text-white hover:bg-white/20 disabled:opacity-40" disabled={idx === 0}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button type="button" title="Move right" aria-label="Move right"
                  onClick={() => movePhoto(p.id, 1)}
                  className="rounded p-0.5 text-white hover:bg-white/20 disabled:opacity-40" disabled={idx === photos.length - 1}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button type="button" title="Remove" aria-label="Remove photo"
                  onClick={() => removePhoto(p.id)}
                  className="rounded p-0.5 text-white hover:bg-white/20">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <Input value={p.caption} onChange={(e) => updatePhoto(p.id, e.target.value)}
              placeholder="Caption" className="mt-1 h-7 px-2 text-[11px]" />
          </div>
        ))}
      </div>
      <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => onPickPhotos(e.target.files)} />
      <MediaUploadPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add photos"
        galleryMultiSelect
        onChooseLocal={() => photoInputRef.current?.click()}
        onChooseGalleryUrl={(url) => addPhotoFromUrl(url)}
        onChooseGalleryUrls={async (urls) => { for (const u of urls) await addPhotoFromUrl(u) }}
        onChooseExternalUrl={(url) => addPhotoFromUrl(url)}
      />
    </div>
  ) : (
    <>
      <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => onPickPhotos(e.target.files)} />
      <MediaUploadPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add photos"
        galleryMultiSelect
        onChooseLocal={() => photoInputRef.current?.click()}
        onChooseGalleryUrl={(url) => addPhotoFromUrl(url)}
        onChooseGalleryUrls={async (urls) => { for (const u of urls) await addPhotoFromUrl(u) }}
        onChooseExternalUrl={(url) => addPhotoFromUrl(url)}
      />
    </>
  )

  const sections: ReactNode = (
    <>
      {customFields.length > 0 && (
        <div className="space-y-2">
          <p className={crmSectionLabelCls}>Custom fields</p>
          {customFields.map(f => (
            <div key={f.id} className="flex gap-2">
              <Input value={f.key} onChange={(e) => updateField(f.id, { key: e.target.value })} placeholder="Field name" className="flex-1 h-8 text-xs" />
              <Input value={f.value} onChange={(e) => updateField(f.id, { value: e.target.value })} placeholder="Value" className="flex-1 h-8 text-xs" />
              <Button type="button" variant="cancel" size="icon" className="h-8 w-8 shrink-0" aria-label="Remove field" onClick={() => removeField(f.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {reminders.length > 0 && (
        <div className="space-y-2">
          <p className={crmSectionLabelCls}><Bell className={crmSectionIconCls} /> Reminders</p>
          {reminders.map(r => (
            <div key={r.id} className="flex gap-2 items-start">
              <CrmDateTimeField
                value={r.at}
                onChange={v => updateReminder(r.id, { at: v })}
                className="w-full max-w-[240px] shrink-0"
              />
              <Input value={r.note} onChange={(e) => updateReminder(r.id, { note: e.target.value })} placeholder="Remind me to…" className="flex-1 h-8 text-xs min-w-0" />
              <Button type="button" variant="cancel" size="icon" className="h-8 w-8 shrink-0" aria-label="Remove reminder" onClick={() => removeReminder(r.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {schedules.length > 0 && (
        <div className="space-y-2">
          <p className={crmSectionLabelCls}><CalendarClock className={crmSectionIconCls} /> Schedules</p>
          {schedules.map(s => (
            <div key={s.id} className="space-y-2 rounded-lg border p-2">
              <div className="flex gap-2 items-start">
                <CrmDateTimeField
                  value={s.at}
                  onChange={v => updateSchedule(s.id, { at: v })}
                  className="w-full max-w-[240px] shrink-0"
                />
                <Input value={s.title} onChange={(e) => updateSchedule(s.id, { title: e.target.value })} placeholder="Meeting, call, demo…" className="flex-1 h-8 text-xs min-w-0" />
                <Button type="button" variant="cancel" size="icon" className="h-8 w-8 shrink-0" aria-label="Remove schedule" onClick={() => removeSchedule(s.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Input value={s.note} onChange={(e) => updateSchedule(s.id, { note: e.target.value })} placeholder="Notes (optional)" className="h-8 text-xs" />
            </div>
          ))}
        </div>
      )}
    </>
  )

  return { actionToolbar, sections, documentsSection, photosSection, serialize }
}

export function CrmExtrasView({ cf }: { cf?: Record<string, unknown> | null }) {
  const data = (cf || {}) as Record<string, unknown>
  const extra = Object.entries(data).filter(([k]) => !RESERVED_CUSTOM_KEYS.includes(k))
  const notes = str(data.notes)
  const responsible = str(data.responsible_name)
  const dueAt = str(data.due_at)
  const reminderAt = str(data.reminder_at)
  const duration = data.duration_minutes
  const ticketType = str(data.ticket_type)
  const typeLabel = str(data.type_label)
  const photos = asArray(data.photos)
    .map(p => ({ url: str(p.url), caption: str(p.caption), is_primary: !!p.is_primary }))
    .filter(p => p.url)
  const documents = asArray(data.documents).map(d => ({ url: str(d.url), filename: str(d.filename) || 'document' })).filter(d => d.url)
  const reminders = asArray(data.reminders).map(r => ({ at: str(r.at), note: str(r.note) }))
  const schedules = asArray(data.schedules).map(s => ({ at: str(s.at), title: str(s.title), note: str(s.note) }))

  return (
    <>
      {(ticketType || typeLabel || responsible || dueAt || reminderAt || duration != null || notes) && (
        <dl className="rounded-lg border px-4">
          {(ticketType || typeLabel) && (
            <div className="grid grid-cols-3 gap-3 py-2 border-b">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Type</dt>
              <dd className="col-span-2 text-sm text-gray-800">{typeLabel || ticketType.replace(/_/g, ' ')}</dd>
            </div>
          )}
          {responsible && (
            <div className="grid grid-cols-3 gap-3 py-2 border-b">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Responsible</dt>
              <dd className="col-span-2 text-sm text-gray-800">{responsible}</dd>
            </div>
          )}
          {dueAt && (
            <div className="grid grid-cols-3 gap-3 py-2 border-b">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Due</dt>
              <dd className="col-span-2 text-sm text-gray-800">
                {formatDateTime(dueAt)}
                <span className="block text-xs text-gray-500 mt-0.5">
                  {formatCrmDayLabel(dueAt)} · {crmDaysRemainingLabel(dueAt)}
                </span>
              </dd>
            </div>
          )}
          {reminderAt && (
            <div className="grid grid-cols-3 gap-3 py-2 border-b">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Reminder</dt>
              <dd className="col-span-2 text-sm text-gray-800">
                {formatDateTime(reminderAt)}
                <span className="block text-xs text-gray-500 mt-0.5">
                  {formatCrmDayLabel(reminderAt)} · {crmDaysRemainingLabel(reminderAt)}
                </span>
              </dd>
            </div>
          )}
          {duration != null && duration !== '' && (
            <div className="grid grid-cols-3 gap-3 py-2 border-b">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Duration</dt>
              <dd className="col-span-2 text-sm text-gray-800">{String(duration)} min</dd>
            </div>
          )}
          {notes && (
            <div className="grid grid-cols-3 gap-3 py-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Notes</dt>
              <dd className="col-span-2 text-sm text-gray-800 whitespace-pre-wrap">{notes}</dd>
            </div>
          )}
        </dl>
      )}

      {extra.length > 0 && (
        <dl className="rounded-lg border px-4">
          {extra.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-3 py-2 border-b last:border-b-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{k}</dt>
              <dd className="col-span-2 text-sm text-gray-800 break-words">{str(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {documents.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Documents</p>
          <ul className="space-y-1">
            {documents.map((d, i) => (
              <li key={i}>
                <a href={mediaUrl(d.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-blue-600 hover:bg-gray-50">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{d.filename}</span>
                  <Download className="w-4 h-4 text-gray-400 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {photos.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1.5"><ImagePlus className="w-3.5 h-3.5" /> Photos</p>
          <div className="flex flex-wrap gap-3">
            {photos.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block w-24">
                <div className="relative h-24 w-24 overflow-hidden rounded-md border bg-gray-50">
                  <img src={p.url} alt={p.caption || 'photo'} className="h-full w-full object-cover" />
                  {p.is_primary && (
                    <span className="absolute top-0.5 left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-yellow-900 shadow-sm" aria-label="Primary photo">
                      <Star className="h-2.5 w-2.5 fill-current" />
                    </span>
                  )}
                </div>
                {p.caption && <p className="text-[11px] text-gray-500 mt-1 truncate">{p.caption}</p>}
              </a>
            ))}
          </div>
        </div>
      )}

      {reminders.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Reminders</p>
          <ul className="space-y-1">
            {reminders.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm rounded-lg border bg-gray-50 px-3 py-2">
                <Bell className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="min-w-0">
                  {r.at && <span className="font-medium text-gray-700">{formatDateTime(r.at)} · </span>}
                  <span className="text-gray-700">{r.note || '—'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {schedules.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Schedules</p>
          <ul className="space-y-1">
            {schedules.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm rounded-lg border bg-gray-50 px-3 py-2">
                <CalendarClock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span className="min-w-0">
                  {s.at && <span className="font-medium text-gray-700">{formatDateTime(s.at)} · </span>}
                  <span className="text-gray-700">{s.title || '—'}</span>
                  {s.note && <span className="block text-xs text-gray-500">{s.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
