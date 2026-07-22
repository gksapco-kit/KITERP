import { useForm, FormProvider, Controller, type FieldErrors } from 'react-hook-form'
import { SectionLabel } from '@/components/common/FieldLabel'
import { FormColumnLabel } from '@/components/common/FieldLabel'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useService, useServices, useCreateService, useUpdateService, useDeleteService, useCategoryTree, useStores, useServiceBOM, useServiceResources } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { mediaUrl, cn } from '@/lib/utils'
import {
  ServiceMediaUpload,
  StagedMediaUpload,
  CatalogMediaSectionHeader,
  STAGED_SERVICE_HELPER,
  EDIT_MEDIA_HELPER,
  reorderMediaList,
  adjustPrimaryIndexOnReorder,
  adjustPrimaryIndexOnRemove,
  findFirstImageIndex,
} from '@/components/common/ImageUpload'
import { CategoryHierarchyPicker } from '@/components/common/CategoryHierarchyPicker'
import { AiDescriptionTextarea } from '@/components/common/AiDescriptionTextarea'
import { filterCategoryTree } from '@/lib/categoryHierarchy'
import {
  ArrowLeft, Loader2,
  Briefcase, IndianRupee, Receipt, Settings, CalendarClock,
  Clock, Eye, Search, Puzzle, BarChart3, Edit2, History,
  Calendar, MapPin, Star, Globe, Tag, Repeat, Plus, Trash2,
  GripVertical, Film, Box, Image as ImageIcon, Copy, MessageSquare, ToggleRight, Info, Layers, Pencil, FileDown,
  Printer, Store, Hash, Factory, Users, X, Gift,
} from 'lucide-react'
import {
  BOOKING_DOC_TYPES, getServiceDocTemplates, setServiceDocTemplates,
  type BookingDocTypeId,
} from '@/lib/bookingDocuments'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  FormPageWithNav,
  FormSectionTabs,
  FormField,
  handleFormInvalid,
  formDisplayCompact,
  formEditLayout,
  formSectionSurfaceClass,
  formSelectClass,
  formTextareaClass,
  useFormActiveSection,
} from '@/components/common/FormSectionNav'
import { CatalogEditStickyBar } from '@/components/common/CatalogEditStickyBar'
import { BusinessUnitScopePicker, type StoreScope } from '@/components/common/BusinessUnitScopePicker'
import type { FormSectionDef } from '@/components/common/FormSectionNav'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CatalogItemLink } from '@/components/common/CatalogItemLink'
import { normalizeCatalogAddons, serializeCatalogAddons, type CatalogAddon } from '@/lib/catalogAddons'
import { newPlan, type PlanDraft, type AvailSlot } from './planDraft'
import { DEFAULT_AVAILABILITY, LEAD_TIME_UNITS, CURRENCY_SYMBOL, UOM_OPTIONS, UOM_GROUPS, SUBSCRIPTION_INTERVALS, SCHEDULE_MODE_OPTIONS, SERVICE_MODE_OPTIONS, SERVICE_TYPE_OPTIONS, DAYS_SHORT } from './serviceCatalogConstants'
import { ServicePlansEditor } from './ServicePlansEditor'
import { InputWithPrefix } from './variantPanelUi'
import { ServiceBOMEditor } from '@/components/services/ServiceBOMEditor'
import { ServiceResourcesEditor } from '@/components/services/ServiceResourcesEditor'
import { ServiceCostSummary } from '@/components/services/ServiceCostSummary'

// ── Lead time helpers ─────────────────────────────────────────────

function hoursToLeadTime(hours?: number | string): { value: string; unit: string } {
  if (!hours || Number(hours) === 0) return { value: '', unit: 'hours' }
  const h = Number(hours)
  for (const u of [...LEAD_TIME_UNITS].reverse()) {
    if (h >= u.toHours) {
      const qty = h / u.toHours
      if (Math.abs(qty - Math.round(qty)) < 0.001) return { value: String(Math.round(qty)), unit: u.value }
    }
  }
  return { value: String(h), unit: 'hours' }
}

function leadTimeToHours(value: string, unit: string): number | undefined {
  const n = parseFloat(value)
  if (!n || isNaN(n)) return undefined
  const u = LEAD_TIME_UNITS.find(x => x.value === unit)
  return u ? n * u.toHours : n
}

function formatLeadTime(hours?: number): string | undefined {
  if (!hours || hours === 0) return undefined
  const { value, unit } = hoursToLeadTime(hours)
  const lbl = LEAD_TIME_UNITS.find(u => u.value === unit)?.label || unit
  return `${value} ${lbl}`
}

// ── Zod Schema ────────────────────────────────────────────────────

const optStr = z.string().optional().or(z.literal(''))
const optNum = z.coerce.number().optional().or(z.literal('').transform(() => undefined))
const optInt = z.coerce.number().int().optional().or(z.literal('').transform(() => undefined))

const SERVICE_NAME_MAX = 255
const SERVICE_NAME_MAX_MSG = 'Service name cannot exceed 255 characters'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(SERVICE_NAME_MAX, SERVICE_NAME_MAX_MSG),
  slug: z.string().max(255).regex(/^[a-z0-9-]*$/, 'Slug: lowercase, numbers, hyphens only').optional().or(z.literal('')),
  material_code: z.string().max(40).optional().or(z.literal('')),
  description: optStr,
  short_description: z.string().max(500, 'Short description cannot exceed 500 characters').optional().or(z.literal('')),
  brand: optStr,
  service_type: z.string().default('one_time'),
  category: optStr,
  subcategory: optStr,
  tags: optStr,
  // Pricing
  price_type: z.string().default('fixed'),
  price: optNum,
  price_min: optNum,
  price_max: optNum,
  currency: z.string().default('INR'),
  discount_percentage: z.coerce.number().min(0).max(100).optional().or(z.literal('').transform(() => undefined)),
  discount_amount: optNum,
  discount_start_date: optStr,
  discount_end_date: optStr,
  offer_label: optStr,
  is_on_sale: z.boolean().default(false),
  // Tax
  is_taxable: z.boolean().default(true),
  tax_rate: z.coerce.number().min(0).max(100).optional().or(z.literal('').transform(() => undefined)),
  sac_code: optStr,
  gst_rate: z.coerce.number().min(0).max(100).optional().or(z.literal('').transform(() => undefined)),
  // Configuration
  uom: z.string().default('per_session'),
  service_mode: z.string().default('in_store'),
  duration_minutes: optInt,
  buffer_minutes: z.coerce.number().int().min(0).default(0),
  service_capacity: z.coerce.number().int().min(1).default(1),
  // Subscription
  is_subscription: z.boolean().default(false),
  subscription_interval: optStr,
  subscription_price: optNum,
  subscription_price_type: z.string().default('per_cycle'),
  subscription_trial_days: optInt,
  subscription_setup_fee: optNum,
  subscription_billing_cycles: optInt,
  // Booking & Quotes
  requires_booking: z.boolean().default(true),
  booking_label: z.string().max(100).default('Booking'),
  subscription_label: z.string().max(100).default('Subscription'),
  quote_request_label: z.string().max(100).default('Quote Requests'),
  allow_quote_request: z.boolean().default(false),
  quote_form_config: z.any().optional(),
  max_bookings_per_slot: z.coerce.number().int().min(1).default(1),
  advance_booking_days: z.coerce.number().int().min(0).default(30),
  booking_lead_time_hours: optInt,
  cancellation_policy: optStr,
  cancellation_hours: optInt,
  rescheduling_policy: optStr,
  no_show_policy: optStr,
  // Lifecycle
  service_expiry_date: optStr,
  validity_period_days: optInt,
  renewal_required: z.boolean().default(false),
  // Visibility
  status: z.string().default('active'),
  is_featured: z.boolean().default(false),
  is_visible: z.boolean().default(true),
  is_popular: z.boolean().default(false),
  is_new_service: z.boolean().default(false),
  // SEO
  meta_title: optStr,
  meta_description: optStr,
  meta_keywords: optStr,
  // Advanced
  prerequisites: optStr,
  whats_included: optStr,
  whats_not_included: optStr,
  service_areas: optStr,
  addons: optStr,
  service_packages: optStr,
})

type FormData = z.infer<typeof schema>

// ── UI Helpers ────────────────────────────────────────────────────

const selectCls = formSelectClass
const textareaCls = formTextareaClass

function Section({ title, icon: Icon, open, onToggle: _onToggle, badge, children, sectionId }: {
  title: string; icon: React.ElementType; open: boolean; onToggle: () => void
  badge?: React.ReactNode; children: React.ReactNode; sectionId?: string
}) {
  if (!open) return null
  const activeFormSection = useFormActiveSection()
  const scrollActive = !!sectionId && activeFormSection === sectionId
  return (
    <Card
      id={sectionId ? `form-section-${sectionId}` : undefined}
      className={cn('overflow-hidden shadow-sm', formDisplayCompact.scrollMarginEdit, formSectionSurfaceClass(scrollActive))}
    >
      <CardContent className={cn('p-2', 'bg-muted/20 dark:bg-black/20')}>
        <div className="mb-1 flex items-center gap-1.5 border-b border-border/60 pb-1">
          <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</h3>
          {badge ? <span className="shrink-0">{badge}</span> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function FormMediaCard({ children }: { children: React.ReactNode }) {
  const activeFormSection = useFormActiveSection()
  return (
    <Card
      id="form-section-media"
      className={cn('shadow-sm', formSectionSurfaceClass(activeFormSection === 'basic'))}
    >
      {children}
    </Card>
  )
}

function Toggle({ label, checked, onChange, small }: {
  label?: string; checked: boolean; onChange: (v: boolean) => void; small?: boolean
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex shrink-0 rounded-full border-2 border-transparent transition-colors
          ${small ? 'h-5 w-9' : 'h-6 w-11'} ${checked ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`pointer-events-none inline-block rounded-full bg-background shadow-sm transform transition-transform
          ${small ? 'h-4 w-4' : 'h-5 w-5'} ${checked ? (small ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0'}`} />
      </button>
      <span className={`text-foreground ${small ? 'text-xs' : 'text-sm'}`}>{label}</span>
    </label>
  )
}

function DisplayField({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <FormColumnLabel className="tracking-wide mb-0.5">{label}</FormColumnLabel>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  )
}

function csvToArray(v?: string): string[] {
  if (!v) return []
  return v.split(',').map(t => t.trim()).filter(Boolean)
}

interface ServicePackageDraft {
  _key: string
  name: string
  price: string
  includes: string
}

let packageKeySeq = 0
function nextPackageKey(): string {
  packageKeySeq += 1
  return `pkg-${packageKeySeq}`
}

function emptyServicePackage(): ServicePackageDraft {
  return { _key: nextPackageKey(), name: '', price: '', includes: '' }
}

/** Accepts the legacy JSON-string form, an already-parsed array, or nothing — always returns editable rows. */
function normalizeServicePackages(v: unknown): ServicePackageDraft[] {
  let arr: unknown = v
  if (typeof v === 'string') {
    if (!v.trim()) return []
    try { arr = JSON.parse(v) } catch { return [] }
  }
  if (!Array.isArray(arr)) return []
  return arr.map((pkg) => {
    const p = (pkg || {}) as { name?: string; price?: number | string; includes?: string[] }
    return {
      _key: nextPackageKey(),
      name: p.name || '',
      price: p.price != null ? String(p.price) : '',
      includes: Array.isArray(p.includes) ? p.includes.join(', ') : '',
    }
  })
}

function serializeServicePackages(rows: ServicePackageDraft[]): Array<{ name: string; price?: number; includes: string[] }> {
  return rows
    .filter(row => row.name.trim())
    .map(row => ({
      name: row.name.trim(),
      price: row.price.trim() ? parseFloat(row.price) : undefined,
      includes: csvToArray(row.includes),
    }))
}

// ── Quote Form Configurator ──────────────────────────────────────

interface QuoteFormFieldDraft {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'time' | 'number' | 'email' | 'phone' | 'select'
  required: boolean
  enabled: boolean
  placeholder: string
  options: string[]
}

const DEFAULT_QUOTE_FIELDS: QuoteFormFieldDraft[] = [
  { key: 'name', label: 'Full Name', type: 'text', required: true, enabled: true, placeholder: 'Customer name', options: [] },
  { key: 'email', label: 'Email', type: 'email', required: true, enabled: true, placeholder: 'Email address', options: [] },
  { key: 'phone', label: 'Phone Number', type: 'phone', required: false, enabled: true, placeholder: 'Phone number', options: [] },
  { key: 'message', label: 'Message', type: 'textarea', required: true, enabled: true, placeholder: 'Describe your requirements...', options: [] },
  { key: 'quantity', label: 'Quantity', type: 'number', required: false, enabled: false, placeholder: 'Qty', options: [] },
  { key: 'preferred_date', label: 'Preferred Date', type: 'date', required: false, enabled: true, placeholder: '', options: [] },
  { key: 'preferred_time', label: 'Preferred Time', type: 'time', required: false, enabled: true, placeholder: '', options: [] },
  { key: 'budget', label: 'Budget Range', type: 'select', required: false, enabled: false, placeholder: 'Select budget', options: ['Under ₹1,000', '₹1,000 - ₹5,000', '₹5,000 - ₹10,000', '₹10,000 - ₹25,000', 'Above ₹25,000'] },
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: 'Aa' },
  { value: 'textarea', label: 'Long Text', icon: '¶' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'email', label: 'Email', icon: '@' },
  { value: 'phone', label: 'Phone', icon: '📱' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'time', label: 'Time', icon: '🕐' },
  { value: 'select', label: 'Dropdown', icon: '▼' },
] as const

function QuoteFormConfigurator({ fields, onChange }: {
  fields: QuoteFormFieldDraft[]
  onChange: (fields: QuoteFormFieldDraft[]) => void
}) {
  const [editingOptions, setEditingOptions] = useState<string | null>(null)
  const [newOption, setNewOption] = useState('')

  const isDefault = (key: string) => DEFAULT_QUOTE_FIELDS.some(d => d.key === key)

  const addField = () => {
    const key = `custom_${Date.now()}`
    onChange([...fields, {
      key, label: 'New Field', type: 'text', required: false,
      enabled: true, placeholder: '', options: [],
    }])
  }

  const removeField = (key: string) => {
    onChange(fields.filter(f => f.key !== key))
  }

  const addOption = (key: string) => {
    if (!newOption.trim()) return
    onChange(fields.map(f => f.key === key ? { ...f, options: [...(f.options || []), newOption.trim()] } : f))
    setNewOption('')
  }

  const removeOption = (key: string, idx: number) => {
    onChange(fields.map(f => f.key === key ? { ...f, options: (f.options || []).filter((_, i) => i !== idx) } : f))
  }

  return (
    <div className="space-y-1.5">
      {fields.map(f => (
        <div key={f.key} className={`rounded-lg border transition-colors ${
          f.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
        }`}>
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button type="button" onClick={() => onChange(fields.map(x => x.key === f.key ? { ...x, enabled: !x.enabled } : x))}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${f.enabled ? 'bg-primary' : 'bg-gray-200'}`}>
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${f.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>

            {f.enabled ? (
              <select value={f.type}
                onChange={e => onChange(fields.map(x => x.key === f.key ? { ...x, type: e.target.value as any } : x))}
                className="h-7 rounded border border-gray-200 bg-gray-50 px-1.5 text-xs text-gray-500 shrink-0">
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            ) : (
              <span className="text-xs text-gray-400 w-5 text-center shrink-0">
                {FIELD_TYPES.find(t => t.value === f.type)?.icon || '?'}
              </span>
            )}

            <div className="flex-1 min-w-0">
              <div className="relative group">
                <input type="text" value={f.label}
                  onChange={e => onChange(fields.map(x => x.key === f.key ? { ...x, label: e.target.value } : x))}
                  disabled={!f.enabled}
                  className={`w-full text-sm font-medium text-gray-800 rounded-md px-2 py-1 transition-all ${
                    f.enabled
                      ? 'border border-dashed border-transparent hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-transparent focus:bg-blue-50/30'
                      : 'bg-transparent border-none'
                  } outline-none`}
                />
                {f.enabled && <Pencil className="w-3 h-3 text-gray-300 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-blue-400 transition-colors" />}
              </div>
            </div>

            {f.enabled && (
              <>
                <button type="button" onClick={() => onChange(fields.map(x => x.key === f.key ? { ...x, required: !x.required } : x))}
                  className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors shrink-0 ${
                    f.required ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                  {f.required ? 'Required' : 'Optional'}
                </button>
                {!isDefault(f.key) && (
                  <button type="button" onClick={() => removeField(f.key)}
                    className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-500 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>

          {f.enabled && (
            <div className="px-3 pb-2.5 pt-0 space-y-2">
              <input type="text" value={f.placeholder}
                onChange={e => onChange(fields.map(x => x.key === f.key ? { ...x, placeholder: e.target.value } : x))}
                placeholder="Placeholder text shown to customer..."
                className="w-full text-xs text-gray-400 rounded-md px-2 py-1 border border-dashed border-transparent hover:border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-transparent outline-none transition-all"
              />
              {f.type === 'select' && (
                <div className="pl-1">
                  <FormColumnLabel className="mb-1">Dropdown Options</FormColumnLabel>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {(f.options || []).map((opt, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs pl-2 pr-1 py-0.5 rounded-full">
                        {opt}
                        <button type="button" aria-label="Close" onClick={() => removeOption(f.key, i)} className="hover:text-red-500 transition-colors">
                <X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  {editingOptions === f.key ? (
                    <div className="flex items-center gap-1">
                      <input type="text" value={newOption} onChange={e => setNewOption(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(f.key) } }}
                        placeholder="Option text..." autoFocus
                        className="flex-1 h-7 rounded border border-gray-200 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-blue-400" />
                      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => addOption(f.key)}
                        className="h-7 px-2 bg-primary text-white text-xs rounded hover:bg-primary/90">Add</button>
                      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setEditingOptions(null); setNewOption('') }}
                        className="h-7 px-1.5 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setEditingOptions(f.key)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add option
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <button type="button" onClick={addField}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-all">
        <Plus className="w-4 h-4" /> Add Custom Field
      </button>
    </div>
  )
}

// ── Availability Editor ───────────────────────────────────────────

function AvailabilityEditor({ availability, onChange }: {
  availability: AvailSlot[]
  onChange: (slots: AvailSlot[]) => void
}) {
  const slotsForDay = (day: number) => availability.filter(s => s.day_of_week === day)
  const isDayOn = (day: number) => slotsForDay(day).some(s => s.is_available)

  const toggleDay = (day: number) => {
    const existing = slotsForDay(day)
    if (existing.length === 0) {
      onChange([...availability, { day_of_week: day, start_time: '09:00', end_time: '18:00', is_available: true }])
    } else if (isDayOn(day)) {
      onChange(availability.map(s => s.day_of_week === day ? { ...s, is_available: false } : s))
    } else {
      onChange(availability.map(s => s.day_of_week === day ? { ...s, is_available: true } : s))
    }
  }

  const updateSlotTime = (day: number, slotIdx: number, field: 'start_time' | 'end_time', value: string) => {
    let count = 0
    onChange(availability.map(s => {
      if (s.day_of_week === day) {
        if (count === slotIdx) { count++; return { ...s, [field]: value } }
        count++
      }
      return s
    }))
  }

  const addSlot = (day: number) => {
    const existing = slotsForDay(day)
    const lastEnd = existing.length > 0 ? existing[existing.length - 1].end_time : '09:00'
    const [h, m] = lastEnd.split(':').map(Number)
    const nextStart = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const nextEnd = `${String(Math.min(h + 3, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    onChange([...availability, { day_of_week: day, start_time: nextStart, end_time: nextEnd, is_available: true }])
  }

  const removeSlot = (day: number, slotIdx: number) => {
    const daySlots = slotsForDay(day)
    if (daySlots.length <= 1) { toggleDay(day); return }
    let count = 0
    onChange(availability.filter(s => {
      if (s.day_of_week === day) {
        if (count === slotIdx) { count++; return false }
        count++
      }
      return true
    }))
  }

  const timeCls = cn(
    'h-8 w-[8.5rem] shrink-0 rounded-md border border-border bg-background px-2.5',
    'text-xs text-foreground [color-scheme:light] dark:[color-scheme:dark]',
    'focus:outline-none focus:ring-1 focus:ring-primary/50',
    '[&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70',
  )

  return (
    <div className="space-y-1.5">
      {DAYS_SHORT.map((dayLabel, day) => {
        const daySlots = slotsForDay(day)
        const isOn = isDayOn(day)
        return (
          <div
            key={day}
            className={cn(
              'rounded-lg border px-3 py-2.5 transition-colors',
              isOn
                ? 'border-primary/25 bg-primary/[0.06] dark:bg-primary/[0.08]'
                : 'border-border bg-muted/20 opacity-90',
            )}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
              <button
                type="button"
                onClick={() => toggleDay(day)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
                  isOn ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span className={cn(
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  isOn ? 'translate-x-4' : 'translate-x-0',
                )} />
              </button>
              <span className={cn(
                'w-8 shrink-0 text-xs font-medium',
                isOn ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {dayLabel}
              </span>
              {!isOn && <span className="text-xs text-muted-foreground">Closed</span>}
              {isOn && (
                <div className="min-w-0 flex-1 space-y-1.5">
                  {daySlots.filter(s => s.is_available).map((slot, si) => (
                    <div key={si} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <input
                        type="time"
                        value={slot.start_time}
                        onChange={e => updateSlotTime(day, si, 'start_time', e.target.value)}
                        className={timeCls}
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={slot.end_time}
                        onChange={e => updateSlotTime(day, si, 'end_time', e.target.value)}
                        className={timeCls}
                      />
                      {daySlots.filter(s => s.is_available).length > 1 && (
                        <button
                          type="button"
                          aria-label="Close"
                          onClick={() => removeSlot(day, si)}
                          className="p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isOn && (
                <button
                  type="button"
                  onClick={() => addSlot(day)}
                  className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:text-primary/80"
                >
                  <Plus className="h-3 w-3" /> Slot
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

const toSlug = (s: string) =>
  (s || '').toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

// ── Main Component ────────────────────────────────────────────────

export default function ServiceForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const isEdit = !!id

  const { data: service, isLoading } = useService(id || '')
  const { data: serviceBomData } = useServiceBOM(isEdit && id ? id : null)
  const { data: serviceResourcesData } = useServiceResources(isEdit && id ? id : null)
  const { data: allServicesData } = useServices({ size: 500 })
  const allServices = (allServicesData?.items || []) as Array<{ id: string; name: string }>
  const createService = useCreateService()
  const updateService = useUpdateService()
  const deleteService = useDeleteService()
  const { data: categoryData } = useCategoryTree()
  const serviceCategories = useMemo(
    () => filterCategoryTree(categoryData?.categories || [], 'service'),
    [categoryData?.categories],
  )

  const [viewMode, setViewMode] = useState(searchParams.get('mode') === 'view')
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [visitedSections, setVisitedSections] = useState<Set<string>>(new Set(['basic']))
  const [activeFormSection, setActiveFormSection] = useState<string | null>('basic')
  const toggle = (key: string) => {
    setActiveTab(key)
    setActiveFormSection(key)
    setVisitedSections(p => new Set(p).add(key))
  }
  const openAndScrollTo = toggle
  const [activeViewTab, setActiveViewTab] = useState('basic')
  const [catalogStoreScope, setCatalogStoreScope] = useState<StoreScope>('all')
  const [catalogStoreIds, setCatalogStoreIds] = useState<string[]>([])
  const { data: storesData } = useStores()
  const businessUnits = storesData?.stores ?? []
  const [availability, setAvailability] = useState<AvailSlot[]>(DEFAULT_AVAILABILITY)
  const [plans, setPlans] = useState<PlanDraft[]>(() => (isEdit ? [] : [newPlan(0)]))

  const insertPlanAt = useCallback((insertAt: number) => {
    setPlans(p => {
      const next = [...p]
      next.splice(insertAt, 0, newPlan(insertAt))
      return next
    })
    setExpandedPlans(ep => ({ ...ep, [insertAt]: true }))
  }, [])
  const [expandedPlans, setExpandedPlans] = useState<Record<number, boolean>>(() =>
    isEdit ? {} : { 0: true } as Record<number, boolean>,
  )
  const [confirmDeletePlan, setConfirmDeletePlan] = useState<number | null>(null)
  const [leadTimeUnit, setLeadTimeUnit] = useState('hours')
  const [quoteFields, setQuoteFields] = useState<QuoteFormFieldDraft[]>([...DEFAULT_QUOTE_FIELDS])
  const [serviceAvailability, setServiceAvailability] = useState<AvailSlot[]>([...DEFAULT_AVAILABILITY])

  // Print document templates for this service (persisted in localStorage when editing)
  const [printDocIds, setPrintDocIds] = useState<BookingDocTypeId[]>(() =>
    id ? getServiceDocTemplates(id) : [],
  )
  const [showDocPicker, setShowDocPicker] = useState(false)

  // Structured add-ons (linked services / products with booking trigger rules)
  type ServiceAddonItem = CatalogAddon
  const [serviceAddons, setServiceAddons] = useState<ServiceAddonItem[]>([])

  // Bundled service packages (e.g. "Basic" / "Premium" tiers with a price and included items)
  const [servicePackages, setServicePackages] = useState<ServicePackageDraft[]>([])
  const [svcAddonSearch, setSvcAddonSearch] = useState('')
  const [svcAddonResults, setSvcAddonResults] = useState<Array<{ id: string; name: string; item_type: 'product' | 'service' }>>([])
  const [svcAddonLoading, setSvcAddonLoading] = useState(false)
  const [svcAddonPickerOpen, setSvcAddonPickerOpen] = useState(false)

  const searchServiceAddons = useCallback(async (q: string) => {
    setSvcAddonLoading(true)
    try {
      const trimmed = q.trim()
      const params = trimmed.length >= 2 ? { search: trimmed, size: 10 } : { size: 10 }
      const [pRes, sRes] = await Promise.all([
        vendorApi.listProducts(params),
        vendorApi.listServices(params),
      ])
      const combined = [
        ...(pRes?.items || []).map((p: any) => ({ id: p.id, name: p.name, item_type: 'product' as const })),
        ...(sRes?.items || []).map((s: any) => ({ id: s.id, name: s.name, item_type: 'service' as const })),
      ].filter(x => !serviceAddons.some(a => a.id === x.id) && x.id !== id)
      setSvcAddonResults(combined)
    } catch { setSvcAddonResults([]) }
    finally { setSvcAddonLoading(false) }
  }, [serviceAddons, id])

  useEffect(() => {
    if (!svcAddonPickerOpen) return
    const delay = svcAddonSearch.trim().length >= 2 ? 300 : 0
    const t = setTimeout(() => searchServiceAddons(svcAddonSearch), delay)
    return () => clearTimeout(t)
  }, [svcAddonSearch, searchServiceAddons, svcAddonPickerOpen])

  const addPrintDoc = (docId: BookingDocTypeId) => {
    setPrintDocIds(prev => {
      if (prev.includes(docId)) return prev
      const next = [...prev, docId]
      if (id) setServiceDocTemplates(id, next)
      return next
    })
    setShowDocPicker(false)
  }

  const removePrintDoc = (docId: BookingDocTypeId) => {
    setPrintDocIds(prev => {
      const next = prev.filter(x => x !== docId)
      if (id) setServiceDocTemplates(id, next)
      return next
    })
  }

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [pendingPrimaryIndex, setPendingPrimaryIndex] = useState(0)
  const nameMaxToastAt = useRef(0)
  const notifyServiceNameMax = useCallback(() => {
    const now = Date.now()
    if (now - nameMaxToastAt.current < 1200) return
    nameMaxToastAt.current = now
    toast.error(SERVICE_NAME_MAX_MSG)
  }, [])

  const formMethods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'active', price_type: 'fixed', currency: 'INR', uom: 'per_session',
      material_code: '',
      service_mode: 'in_store', service_type: 'one_time', is_taxable: true,
      requires_booking: true, booking_label: 'Booking', subscription_label: 'Subscription', quote_request_label: 'Quote Requests', is_visible: true, buffer_minutes: 0,
      service_capacity: 1, max_bookings_per_slot: 1, advance_booking_days: 30,
      is_on_sale: false, is_subscription: false, allow_quote_request: false,
      quote_form_config: [],
      subscription_price_type: 'per_cycle',
    },
  })
  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = formMethods

  const onFormInvalid = useCallback((validationErrors: FieldErrors) => {
    handleFormInvalid(validationErrors, {
      onFieldPath: (path) => {
        const section = path.startsWith('variants') ? 'variants' : path.split('.')[0]
        if (section) openAndScrollTo(section)
      },
    })
  }, [])

  const watchedPriceType    = watch('price_type')
  const watchedCategory     = watch('category')
  const watchedSubcategory  = watch('subcategory')
  const watchedCurrency     = watch('currency')
  const watchedDiscountPct  = watch('discount_percentage')
  const watchedDiscountAmt  = watch('discount_amount')
  const watchedName         = watch('name')
  const watchedShortDescription = watch('short_description')
  const watchedDescription  = watch('description')
  const watchedMetaDescription = watch('meta_description')
  const watchedPrerequisites = watch('prerequisites')

  const currencySymbol = CURRENCY_SYMBOL[watchedCurrency] || watchedCurrency

  // Auto-set is_on_sale
  useEffect(() => {
    const has = (watchedDiscountPct && Number(watchedDiscountPct) > 0) ||
                (watchedDiscountAmt && Number(watchedDiscountAmt) > 0)
    setValue('is_on_sale', !!has)
  }, [watchedDiscountPct, watchedDiscountAmt, setValue])

  // ── Auto-fill discount_amount + discount_percentage for each plan on load/change ──
  useEffect(() => {
    if (!plans.length) return
    setPlans(prev => prev.map(plan => {
      const p = parseFloat(plan.price || '0')
      const c = parseFloat(plan.compare_at_price || '0')
      if (c > 0 && p > 0 && c > p) {
        const pct = parseFloat(((c - p) / c * 100).toFixed(2))
        const amt = parseFloat((c - p).toFixed(2))
        const currPct = parseFloat(plan.discount_percentage || '0')
        const currAmt = parseFloat(plan.discount_amount || '0')
        const needsPct = Math.abs(pct - currPct) > 0.01
        const needsAmt = Math.abs(amt - currAmt) > 0.01
        if (needsPct || needsAmt) {
          return {
            ...plan,
            discount_percentage: needsPct ? pct.toFixed(2) : plan.discount_percentage,
            discount_amount: needsAmt ? amt.toFixed(2) : plan.discount_amount,
          }
        }
      }
      return plan
    }))
  }, [ // re-run only when plan prices change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    plans.map(p => `${p.price}|${p.compare_at_price}`).join(',')
  ])

  useEffect(() => {
    if (!service) return
    reset({
      name: service.name, slug: toSlug(service.slug),
      material_code: service.material_code || '',
      description: service.description || '', short_description: service.short_description || '',
      brand: service.brand || '', service_type: service.service_type || 'one_time',
      category: service.category || '', subcategory: service.subcategory || '',
      tags: (service.tags || []).join(', '),
      price_type: service.price_type || 'fixed',
      price: service.price ?? undefined, price_min: service.price_min ?? undefined, price_max: service.price_max ?? undefined,
      currency: service.currency || 'INR',
      discount_percentage: service.discount_percentage ?? undefined,
      discount_amount: service.discount_amount ?? undefined,
      discount_start_date: service.discount_start_date?.split('T')[0] || '',
      discount_end_date: service.discount_end_date?.split('T')[0] || '',
      offer_label: service.offer_label || '',
      is_on_sale: !!(service.discount_percentage || service.discount_amount),
      is_taxable: service.is_taxable, tax_rate: service.tax_rate ?? undefined,
      sac_code: service.sac_code || '', gst_rate: service.gst_rate ?? undefined,
      uom: service.uom || 'fixed', service_mode: service.service_mode || 'in_store',
      duration_minutes: service.duration_minutes ?? undefined,
      buffer_minutes: service.buffer_minutes ?? 0, service_capacity: service.service_capacity ?? 1,
      requires_booking: service.requires_booking,
      booking_label: service.booking_label || 'Booking',
      subscription_label: service.subscription_label || 'Subscription',
      quote_request_label: service.quote_request_label || 'Quote Requests',
      allow_quote_request: service.allow_quote_request ?? false,
      quote_form_config: service.quote_form_config || [],
      max_bookings_per_slot: service.max_bookings_per_slot ?? 1,
      advance_booking_days: service.advance_booking_days ?? 30,
      booking_lead_time_hours: (() => {
        const lt = hoursToLeadTime(service.booking_lead_time_hours)
        return lt.value ? Number(lt.value) : undefined
      })(),
      cancellation_policy: service.cancellation_policy || '',
      cancellation_hours: service.cancellation_hours ?? undefined,
      rescheduling_policy: service.rescheduling_policy || '',
      no_show_policy: service.no_show_policy || '',
      service_expiry_date: service.service_expiry_date || '',
      validity_period_days: service.validity_period_days ?? undefined,
      renewal_required: service.renewal_required,
      // Subscription
      is_subscription: service.is_subscription ?? false,
      subscription_interval: service.subscription_interval || '',
      subscription_price: service.subscription_price ?? undefined,
      subscription_price_type: service.subscription_price_type || 'per_cycle',
      subscription_trial_days: service.subscription_trial_days ?? undefined,
      subscription_setup_fee: service.subscription_setup_fee ?? undefined,
      subscription_billing_cycles: service.subscription_billing_cycles ?? undefined,
      status: service.status, is_featured: service.is_featured, is_visible: service.is_visible,
      is_popular: service.is_popular, is_new_service: service.is_new_service,
      meta_title: service.meta_title || '', meta_description: service.meta_description || '',
      meta_keywords: (service.meta_keywords || []).join(', '),
      prerequisites: service.prerequisites || '',
      whats_included: (service.whats_included || []).join(', '),
      whats_not_included: (service.whats_not_included || []).join(', '),
      service_areas: (service.service_areas || []).join(', '),
      addons: '',
      service_packages: '',
    })

    setServiceAddons(normalizeCatalogAddons(service.addons))
    setServicePackages(normalizeServicePackages(service.service_packages))

    // Load plans with all per-plan feature overrides
    if (service.plans?.length) {
      setPlans(service.plans.map((p: any) => ({
        _key: p.id,
        name: p.name || '',
        description: p.description || '',
        color: p.color || undefined,
        price: p.price != null ? String(p.price) : '',
        uom: p.uom || 'per_session',
        price_type: p.price_type || 'per_cycle',
        subscription_interval: p.subscription_interval || 'monthly',
        subscription_trial_days: p.subscription_trial_days != null ? String(p.subscription_trial_days) : '',
        subscription_setup_fee: p.subscription_setup_fee != null ? String(p.subscription_setup_fee) : '',
        subscription_billing_cycles: p.subscription_billing_cycles != null ? String(p.subscription_billing_cycles) : '',
        subscription_schedule_modes: p.subscription_schedule_modes || ['dates', 'cycles', 'pick_dates', 'weekly', 'recurring'],
        duration_minutes: p.duration_minutes != null ? String(p.duration_minutes) : '',
        is_active: p.is_active ?? true,
        enable_pricing: !!(p.plan_price_type || p.price_min || p.price_max || p.discount_percentage || p.discount_amount),
        enable_tax: !!(p.tax_rate || p.sac_code || p.gst_rate || p.is_taxable === false),
        enable_booking: !!(p.requires_booking != null || p.max_bookings_per_slot || p.cancellation_policy),
        enable_availability: !!(p.availability?.length),
        enable_lifecycle: !!(p.service_expiry_date || p.validity_period_days || p.renewal_required),
        service_frequency: p.service_frequency || (p.subscription_interval ? 'recurring' : 'once'),
        service_mode: p.service_mode || 'in_store',
        buffer_minutes: p.buffer_minutes != null ? String(p.buffer_minutes) : '0',
        service_capacity: p.service_capacity != null ? String(p.service_capacity) : '1',
        max_quantity_per_order: p.max_quantity_per_order != null ? String(p.max_quantity_per_order) : '',
        min_quantity_per_order: p.min_quantity_per_order != null ? String(p.min_quantity_per_order) : '',
        plan_price_type: p.plan_price_type || 'fixed',
        price_min: p.price_min != null ? String(p.price_min) : '',
        price_max: p.price_max != null ? String(p.price_max) : '',
        compare_at_price: p.compare_at_price != null ? String(p.compare_at_price) : '',
        cost_price: p.cost_price != null ? String(p.cost_price) : '',
        currency: p.currency || 'INR',
        discount_percentage: p.discount_percentage != null ? String(p.discount_percentage) : '',
        discount_amount: p.discount_amount != null ? String(p.discount_amount) : '',
        offer_label: p.offer_label || '',
        discount_start_date: p.discount_start_date?.split('T')[0] || '',
        discount_end_date: p.discount_end_date?.split('T')[0] || '',
        is_taxable: p.is_taxable ?? true,
        tax_rate: p.tax_rate != null ? String(p.tax_rate) : '',
        sac_code: p.sac_code || '',
        gst_rate: p.gst_rate != null ? String(p.gst_rate) : '',
        requires_booking: p.requires_booking ?? true,
        max_bookings_per_slot: p.max_bookings_per_slot != null ? String(p.max_bookings_per_slot) : '1',
        advance_booking_days: p.advance_booking_days != null ? String(p.advance_booking_days) : '30',
        booking_lead_time_value: (() => { const lt = hoursToLeadTime(p.booking_lead_time_hours); return lt.value })(),
        booking_lead_time_unit: (() => { const lt = hoursToLeadTime(p.booking_lead_time_hours); return lt.unit })(),
        cancellation_policy: p.cancellation_policy || '',
        cancellation_hours: p.cancellation_hours != null ? String(p.cancellation_hours) : '',
        rescheduling_policy: p.rescheduling_policy || '',
        no_show_policy: p.no_show_policy || '',
        availability: p.availability?.length
          ? (() => {
              const loaded: AvailSlot[] = []
              for (let d = 0; d < 7; d++) {
                const ds = p.availability.filter((a: any) => a.day_of_week === d)
                if (ds.length) ds.forEach((s: any) => loaded.push({ day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, is_available: s.is_available ?? true }))
                else { const def = DEFAULT_AVAILABILITY.find(x => x.day_of_week === d); loaded.push(def ? { ...def, is_available: false } : { day_of_week: d, start_time: '09:00', end_time: '18:00', is_available: false }) }
              }
              return loaded
            })()
          : [...DEFAULT_AVAILABILITY],
        service_expiry_date: p.service_expiry_date || '',
        validity_period_days: p.validity_period_days != null ? String(p.validity_period_days) : '',
        renewal_required: p.renewal_required ?? false,
      })))
    }

    // Parse lead time unit from stored hours
    if (service.booking_lead_time_hours) {
      const lt = hoursToLeadTime(service.booking_lead_time_hours)
      setLeadTimeUnit(lt.unit)
    }

    if (service.availability?.length) {
      // Load all slots per day (multiple time ranges supported)
      const saved = service.availability as AvailSlot[]
      const loadedMulti: AvailSlot[] = []
      for (let day = 0; day < 7; day++) {
        const daySlots = saved.filter((a: any) => a.day_of_week === day)
        if (daySlots.length > 0) {
          daySlots.forEach((s: any) => loadedMulti.push({
            day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, is_available: s.is_available ?? true,
          }))
        } else {
          const def = DEFAULT_AVAILABILITY.find(d => d.day_of_week === day)
          loadedMulti.push(def ? { ...def, is_available: false } : { day_of_week: day, start_time: '09:00', end_time: '18:00', is_available: false })
        }
      }
      setAvailability(loadedMulti)
      setServiceAvailability(loadedMulti)
    }

    if (service.quote_form_config?.length) {
      const savedConfig = service.quote_form_config as QuoteFormFieldDraft[]
      const merged = DEFAULT_QUOTE_FIELDS.map(def => {
        const saved = savedConfig.find((f: any) => f.key === def.key)
        return saved ? { ...def, ...saved } : { ...def, enabled: false }
      })
      const customFields = savedConfig.filter(f => !DEFAULT_QUOTE_FIELDS.some(d => d.key === f.key))
      setQuoteFields([...merged, ...customFields.map(f => ({ ...f, options: f.options || [] }))])
    }

    setCatalogStoreScope(service.store_scope === 'selected' ? 'selected' : 'all')
    setCatalogStoreIds(service.store_ids || [])
  }, [service, reset])

  const pendingPreviewsRef = useRef<string[]>([])
  pendingPreviewsRef.current = pendingPreviews

  useEffect(() => {
    return () => {
      pendingPreviewsRef.current.forEach(URL.revokeObjectURL)
    }
  }, [])

  const onSubmit = async (raw: FormData) => {
    setIsSaving(true)
    try {
      const data: Record<string, unknown> = { ...raw }
      data.booking_label = (typeof raw.booking_label === 'string' ? raw.booking_label.trim() : '') || 'Booking'
      data.subscription_label = (typeof raw.subscription_label === 'string' ? raw.subscription_label.trim() : '') || 'Subscription'
      data.quote_request_label = (typeof raw.quote_request_label === 'string' ? raw.quote_request_label.trim() : '') || 'Quote Requests'
      // Convert lead time value + unit to hours
      if (raw.booking_lead_time_hours != null) {
        data.booking_lead_time_hours = leadTimeToHours(String(raw.booking_lead_time_hours), leadTimeUnit)
      }
      data.tags = csvToArray(raw.tags)
      data.meta_keywords = csvToArray(raw.meta_keywords)
      data.addons = serializeCatalogAddons(serviceAddons)
      data.whats_included = csvToArray(raw.whats_included)
      data.whats_not_included = csvToArray(raw.whats_not_included)
      data.service_areas = csvToArray(raw.service_areas)
      data.service_packages = serializeServicePackages(servicePackages)
      data.availability = availability.filter(a => a.is_available).map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time, is_available: true }))

      // Serialize plans with per-plan configuration
      data.plans = plans.filter(p => p.name?.trim()).map((p, i) => {
        const isRecurring = p.service_frequency === 'recurring'
        const plan: Record<string, unknown> = {
          name: p.name,
          description: p.description || undefined,
          price: p.price ? parseFloat(p.price) : undefined,
          uom: p.uom,
          price_type: isRecurring ? p.price_type : 'per_unit',
          service_frequency: p.service_frequency,
          service_mode: p.service_mode,
          duration_minutes: p.duration_minutes ? parseInt(p.duration_minutes) : undefined,
          buffer_minutes: p.buffer_minutes ? parseInt(p.buffer_minutes) : 0,
          service_capacity: p.service_capacity ? parseInt(p.service_capacity) : 1,
          max_quantity_per_order: p.max_quantity_per_order ? parseInt(p.max_quantity_per_order) : undefined,
          min_quantity_per_order: p.min_quantity_per_order ? parseInt(p.min_quantity_per_order) : undefined,
          currency: p.currency,
          subscription_interval: isRecurring ? (p.subscription_interval || undefined) : undefined,
          subscription_trial_days: isRecurring && p.subscription_trial_days ? parseInt(p.subscription_trial_days) : undefined,
          subscription_setup_fee: isRecurring && p.subscription_setup_fee ? parseFloat(p.subscription_setup_fee) : undefined,
          subscription_billing_cycles: isRecurring && p.subscription_billing_cycles ? parseInt(p.subscription_billing_cycles) : undefined,
          subscription_schedule_modes: isRecurring && p.subscription_schedule_modes?.length ? p.subscription_schedule_modes : undefined,
          is_active: p.is_active,
          sort_order: i,
        }
        if (p.enable_pricing) {
          plan.plan_price_type = p.plan_price_type
          plan.price_min = p.price_min ? parseFloat(p.price_min) : undefined
          plan.price_max = p.price_max ? parseFloat(p.price_max) : undefined
          plan.compare_at_price = p.compare_at_price ? parseFloat(p.compare_at_price) : undefined
          plan.cost_price = p.cost_price ? parseFloat(p.cost_price) : undefined
          plan.currency = p.currency
          plan.discount_percentage = p.discount_percentage ? parseFloat(p.discount_percentage) : undefined
          plan.discount_amount = p.discount_amount ? parseFloat(p.discount_amount) : undefined
          plan.offer_label = p.offer_label || undefined
          plan.discount_start_date = p.discount_start_date || undefined
          plan.discount_end_date = p.discount_end_date || undefined
        }
        if (p.enable_booking) {
          plan.requires_booking = p.requires_booking
          plan.max_bookings_per_slot = p.max_bookings_per_slot ? parseInt(p.max_bookings_per_slot) : 1
          plan.advance_booking_days = p.advance_booking_days ? parseInt(p.advance_booking_days) : 30
          plan.booking_lead_time_hours = leadTimeToHours(p.booking_lead_time_value, p.booking_lead_time_unit)
          plan.cancellation_policy = p.cancellation_policy || undefined
          plan.cancellation_hours = p.cancellation_hours ? parseInt(p.cancellation_hours) : undefined
          plan.rescheduling_policy = p.rescheduling_policy || undefined
          plan.no_show_policy = p.no_show_policy || undefined
        }
        if (p.enable_availability) {
          plan.availability = p.availability.filter(a => a.is_available).map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time, is_available: true }))
        }
        if (p.enable_tax) {
          plan.is_taxable = true
          plan.tax_rate = p.tax_rate ? parseFloat(p.tax_rate) : undefined
          plan.sac_code = p.sac_code || undefined
          plan.gst_rate = p.gst_rate ? parseFloat(p.gst_rate) : undefined
        }
        if (p.enable_lifecycle) {
          plan.service_expiry_date = p.service_expiry_date || undefined
          plan.validity_period_days = p.validity_period_days ? parseInt(p.validity_period_days) : undefined
          plan.renewal_required = p.renewal_required
        }
        return plan
      })

      // Auto-sync service-level fields from first active plan
      {
        type PlanRow = { is_active?: boolean; price?: number; service_frequency?: string; service_mode?: string; duration_minutes?: number; buffer_minutes?: number; service_capacity?: number; subscription_interval?: string; subscription_trial_days?: number; subscription_setup_fee?: number; subscription_billing_cycles?: number; subscription_schedule_modes?: string[]; is_taxable?: boolean; tax_rate?: number; sac_code?: string; gst_rate?: number; service_expiry_date?: string; validity_period_days?: number; renewal_required?: boolean; requires_booking?: boolean }
        const allPlans = (data.plans as PlanRow[]) || []
        const firstActive = allPlans.find(p => p.is_active !== false && p.price != null && Number(p.price) > 0)
        if (firstActive) {
          data.service_mode = firstActive.service_mode || data.service_mode
          data.duration_minutes = firstActive.duration_minutes ?? data.duration_minutes
          data.buffer_minutes = firstActive.buffer_minutes ?? data.buffer_minutes
          data.service_capacity = firstActive.service_capacity ?? data.service_capacity
          if (raw.is_subscription && firstActive.service_frequency === 'recurring') {
            data.subscription_price = Number(firstActive.price)
            data.subscription_interval = firstActive.subscription_interval || data.subscription_interval
            data.subscription_trial_days = firstActive.subscription_trial_days ?? data.subscription_trial_days
            data.subscription_setup_fee = firstActive.subscription_setup_fee ?? data.subscription_setup_fee
            data.subscription_billing_cycles = firstActive.subscription_billing_cycles ?? data.subscription_billing_cycles
            data.subscription_schedule_modes = firstActive.subscription_schedule_modes || data.subscription_schedule_modes
          }
          if (firstActive.is_taxable != null) data.is_taxable = firstActive.is_taxable
          if (firstActive.tax_rate != null) data.tax_rate = firstActive.tax_rate
          if (firstActive.sac_code) data.sac_code = firstActive.sac_code
          if (firstActive.gst_rate != null) data.gst_rate = firstActive.gst_rate
          if (firstActive.requires_booking != null) data.requires_booking = firstActive.requires_booking
        }
      }

      // Include quote form config (only enabled fields)
      if (raw.allow_quote_request) {
        data.quote_form_config = quoteFields.filter(f => f.enabled).map(({ key, label, type, required, enabled, placeholder, options }) => ({
          key, label, type, required, enabled, placeholder, ...(options?.length ? { options } : {}),
        }))
      }

      // Include service-level availability
      data.availability = serviceAvailability.filter(a => a.is_available).map(({ day_of_week, start_time, end_time }) => ({
        day_of_week, start_time, end_time, is_available: true,
      }))

      if (catalogStoreScope === 'selected' && catalogStoreIds.length === 0) {
        toast.error('Select at least one business unit, or choose All business units.')
        openAndScrollTo('visibility')
        return
      }
      data.store_scope = catalogStoreScope
      data.store_ids = catalogStoreScope === 'selected' ? catalogStoreIds : []

      for (const k of Object.keys(data)) {
        if (data[k] === '' || data[k] === undefined) delete data[k]
      }

      const serviceName = String(data.name || '').trim()
      if (serviceName) {
        const nameTaken = allServices.some(
          (s) => s.name.trim().toLowerCase() === serviceName.toLowerCase() && (!isEdit || s.id !== id),
        )
        if (nameTaken) {
          toast.error('A service with this name already exists')
          return
        }
      }

      if (isEdit) {
        await updateService.mutateAsync({ id, data })
        navigate('/services')
      } else {
        const newService = await createService.mutateAsync(data)
        // Persist selected print doc templates now that we have a service ID
        if (printDocIds.length > 0) setServiceDocTemplates(newService.id, printDocIds)
        const uploadedMediaIds: string[] = []
        for (const file of pendingFiles) {
          try {
            const result = await vendorApi.uploadServiceMedia(newService.id, file)
            if (result.item?.id) uploadedMediaIds.push(result.item.id)
          } catch {
            toast.error(`Upload failed: ${file.name}`)
          }
        }
        if (uploadedMediaIds.length > 0) {
          const primaryId = uploadedMediaIds[pendingPrimaryIndex]
          const primaryFile = pendingFiles[pendingPrimaryIndex]
          if (primaryId && primaryFile?.type.startsWith('image/')) {
            try { await vendorApi.setPrimaryServiceMedia(newService.id, primaryId) } catch { /* best-effort */ }
          }
        }
        setPendingFiles([])
        setPendingPreviews([])
        setPendingPrimaryIndex(0)
        navigate('/services')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleMediaUpload = useCallback(async (file: File) => {
    if (!id) return
    try { await vendorApi.uploadServiceMedia(id, file); qc.invalidateQueries({ queryKey: ['vendor', 'service', id] }); qc.invalidateQueries({ queryKey: ['vendor', 'services'] }); toast.success('Media uploaded') }
    catch { toast.error('Failed to upload media') }
  }, [id, qc])

  const handleMediaDelete = useCallback(async (mediaId: string) => {
    if (!id) return
    try { await vendorApi.deleteServiceMedia(id, mediaId); qc.invalidateQueries({ queryKey: ['vendor', 'service', id] }); toast.success('Media removed') }
    catch { toast.error('Failed to remove media') }
  }, [id, qc])

  const handleMediaSetPrimary = useCallback(async (mediaId: string) => {
    if (!id) return
    try { await vendorApi.setPrimaryServiceMedia(id, mediaId); qc.invalidateQueries({ queryKey: ['vendor', 'service', id] }); toast.success('Primary image updated') }
    catch { toast.error('Failed to set primary') }
  }, [id, qc])

  const handleMediaReorder = useCallback(async (mediaIds: string[]) => {
    if (!id) return
    try {
      await vendorApi.reorderServiceMedia(id, mediaIds)
      qc.invalidateQueries({ queryKey: ['vendor', 'service', id] })
    } catch { toast.error('Failed to reorder media') }
  }, [id, qc])

  const handleMediaEdit = useCallback(async (mediaId: string, file: File, wasPrimary: boolean) => {
    if (!id) return
    const result = await vendorApi.uploadServiceMedia(id, file)
    await vendorApi.deleteServiceMedia(id, mediaId)
    if (wasPrimary && result.item?.id) await vendorApi.setPrimaryServiceMedia(id, result.item.id)
    qc.invalidateQueries({ queryKey: ['vendor', 'service', id] })
  }, [id, qc])

  const addPendingFiles = useCallback((fileList: FileList | File[] | null) => {
    if (!fileList || (Array.isArray(fileList) ? fileList.length === 0 : fileList.length === 0)) return
    const newFiles = Array.from(fileList)
    setPendingFiles(p => {
      const next = [...p, ...newFiles]
      if (p.length === 0) {
        const firstImage = findFirstImageIndex(next)
        if (firstImage >= 0) setPendingPrimaryIndex(firstImage)
      }
      return next
    })
    setPendingPreviews(p => [...p, ...newFiles.map(f => URL.createObjectURL(f))])
  }, [])

  const removePendingFile = useCallback((index: number) => {
    setPendingPreviews(p => { URL.revokeObjectURL(p[index]); return p.filter((_, i) => i !== index) })
    setPendingFiles(p => {
      const next = p.filter((_, i) => i !== index)
      setPendingPrimaryIndex(pi => adjustPrimaryIndexOnRemove(pi, index, next.length))
      return next
    })
  }, [])

  const reorderPendingFiles = useCallback((from: number, to: number) => {
    setPendingFiles(p => reorderMediaList(p, from, to))
    setPendingPreviews(p => reorderMediaList(p, from, to))
    setPendingPrimaryIndex(p => adjustPrimaryIndexOnReorder(p, from, to))
  }, [])

  const replacePendingFile = useCallback((index: number, file: File) => {
    setPendingPreviews(p => {
      URL.revokeObjectURL(p[index])
      return p.map((url, i) => (i === index ? URL.createObjectURL(file) : url))
    })
    setPendingFiles(p => p.map((f, i) => (i === index ? file : f)))
  }, [])

  const formValues = watch()
  const serviceSections: FormSectionDef[] = useMemo(() => [
    { key: 'basic',             label: 'Basic',             icon: Briefcase, hint: 'Name, type, duration, descriptions, and media.' },
    { key: 'subscription',      label: 'Plans',             icon: Repeat, hint: 'Plan tiers, billing cycle, and trial setup.' },
    { key: 'serviceBom',        label: 'Service BOM',       icon: Factory, visible: isEdit, hint: 'Materials and products consumed per service delivery.' },
    { key: 'resources',         label: 'Resources',         icon: Users, visible: isEdit, hint: 'Staff, equipment, and facilities required to perform the service.' },
    { key: 'visibility',        label: 'Visibility',        icon: Eye, hint: 'Status, visibility, and featured flags.' },
    { key: 'storefrontOptions', label: 'Business Front',    icon: Globe, hint: 'Booking rules, quotes, and customer options.' },
    { key: 'seo',               label: 'SEO',               icon: Search, hint: 'Search and social preview metadata.' },
    { key: 'advanced',          label: 'Advanced',          icon: Settings, hint: 'Extra fields and structured data.' },
    { key: 'addons',            label: 'Add-ons',           icon: Puzzle, hint: 'Linked products or services at booking.' },
    { key: 'printDocs',         label: 'Print Docs',        icon: Printer, hint: 'Templates printed with bookings.' },
    { key: 'stats',             label: 'Statistics',        icon: BarChart3, visible: isEdit, hint: 'Booking and performance summary (read-only).' },
  ], [isEdit])

  useEffect(() => {
    const visible = serviceSections.filter((s) => s.visible !== false)
    if (!visible.some((s) => s.key === activeTab)) {
      setActiveTab(visible[0]?.key ?? 'basic')
    }
  }, [serviceSections, activeTab])

  const serviceViewSections = useMemo((): FormSectionDef[] => {
    if (!service) return []
    const svcAddons = normalizeCatalogAddons(service.addons)
    let svcPackages: unknown[] = []
    try {
      const sp = (service as { service_packages?: unknown }).service_packages
      svcPackages = typeof sp === 'string' ? JSON.parse(sp) : (sp || [])
      if (!Array.isArray(svcPackages)) svcPackages = []
    } catch { svcPackages = [] }
    const svcPrintDocs = getServiceDocTemplates(service.id as string)
    const hasAdvanced = !!(service.whats_included?.length || service.whats_not_included?.length || service.service_areas?.length || service.prerequisites)
    const hasSeo = !!(service.meta_title || service.meta_description || service.meta_keywords)
    const hasPlans = (service as { is_subscription?: boolean; plans?: unknown[] }).is_subscription && ((service as { plans?: unknown[] }).plans?.length ?? 0) > 0
    return [
      { key: 'basic',             label: 'Basic',             icon: Briefcase, hint: 'Name, type, duration, descriptions, and media.' },
      { key: 'subscription',      label: 'Plans',             icon: Repeat, visible: hasPlans, hint: 'Plan tiers, billing cycle, and trial setup.' },
      { key: 'serviceBom',        label: 'Service BOM',       icon: Factory, hint: 'Materials consumed and estimated material cost.' },
      { key: 'resources',         label: 'Resources',         icon: Users, hint: 'Staff, equipment, and resource planning.' },
      { key: 'visibility',        label: 'Visibility',        icon: Eye, hint: 'Status, visibility, and featured flags.' },
      { key: 'storefrontOptions', label: 'Business Front',    icon: Globe, hint: 'Booking rules, quotes, and customer options.' },
      { key: 'seo',               label: 'SEO',               icon: Search, visible: hasSeo, hint: 'Search and social preview metadata.' },
      { key: 'advanced',          label: 'Advanced',          icon: Settings, visible: hasAdvanced, hint: 'Extra fields and structured data.' },
      { key: 'addons',            label: 'Add-ons',           icon: Puzzle, visible: svcAddons.length > 0 || svcPackages.length > 0, hint: 'Linked products or services at booking.' },
      { key: 'printDocs',         label: 'Print Docs',        icon: Printer, visible: svcPrintDocs.length > 0, hint: 'Templates printed with bookings.' },
      { key: 'stats',             label: 'Statistics',        icon: BarChart3, hint: 'Booking and performance summary.' },
      { key: 'history',           label: 'History',           icon: History, hint: 'Who changed what and when — export via full report.' },
    ]
  }, [service])

  useEffect(() => {
    if (!viewMode || !service) return
    const visible = serviceViewSections.filter(s => s.visible !== false)
    if (!visible.some(s => s.key === activeViewTab)) {
      setActiveViewTab(visible[0]?.key ?? 'basic')
    }
  }, [viewMode, service, serviceViewSections, activeViewTab])

  const serviceCompletedSections = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    if (formValues.name) s.add('basic')
    if (plans.length > 0) s.add('subscription')
    if (formValues.short_description) s.add('storefrontOptions')
    if (formValues.meta_title || formValues.meta_description) s.add('seo')
    return s
  }, [formValues, plans])

  const serviceErrorSections = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    if (errors.name) s.add('basic')
    return s
  }, [errors])

  if (isEdit && isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>

  // ── Display (View) Mode ──────────────────────────────────────────
  if (viewMode && service) {
    const sym = CURRENCY_SYMBOL[service.currency] || service.currency
    const uomLbl = UOM_OPTIONS.find(u => u.value === service.uom)?.label || service.uom
    const typeLbl = SERVICE_TYPE_OPTIONS.find(t => t.value === service.service_type)?.label || service.service_type
    const modeLbl = SERVICE_MODE_OPTIONS.find(m => m.value === service.service_mode)?.label || service.service_mode
    const history: any[] = (service as any).change_history || []
    const priceDisplay = service.price_type === 'not_applicable' ? 'Not applicable' :
      service.price_type === 'free' ? 'Free' :
      service.price ? `${sym}${service.price.toLocaleString()}` :
      (service.price_min && service.price_max) ? `${sym}${service.price_min}–${sym}${service.price_max}` : 'Quote'

    const svcAddons = normalizeCatalogAddons(service.addons)
    const svcPackages: any[] = (service as any).service_packages || []
    const svcPrintDocs: string[] = getServiceDocTemplates(service.id as string)
    const showTab = (key: string) => activeViewTab === key
    const viewNavCompleted = new Set<string>()
    if (service.name) viewNavCompleted.add('basic')
    if ((service as any).is_subscription && (service as any).plans?.length) viewNavCompleted.add('subscription')
    viewNavCompleted.add('storefrontOptions')
    viewNavCompleted.add('visibility')
    if (service.meta_title || service.meta_description) viewNavCompleted.add('seo')
    if (svcAddons.length > 0) viewNavCompleted.add('addons')
    if (history.length > 0) viewNavCompleted.add('history')
    viewNavCompleted.add('stats')
    if ((serviceBomData as unknown[])?.length) viewNavCompleted.add('serviceBom')
    if ((serviceResourcesData as unknown[])?.length) viewNavCompleted.add('resources')

    return (
      <FormPageWithNav activeSectionKey={activeViewTab} nav={null}>
      <div className={formEditLayout.formStack}>
        <div className={formEditLayout.stickyBar}>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <Button variant="ghost" size="sm" className="h-8 px-2 text-foreground" onClick={() => navigate('/services')}>
                <ArrowLeft className="w-4 h-4 mr-1" />Back
              </Button>
              <h1 className="truncate text-base font-bold text-foreground sm:text-xl">{service.name}</h1>
              <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
                service.status === 'active' ? 'bg-green-500/15 text-green-700 dark:text-green-300' :
                service.status === 'archived' ? 'bg-red-500/10 text-red-600 dark:text-red-300' : 'bg-muted text-muted-foreground'
              }`}>{service.status}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/12 text-primary font-medium">{typeLbl}</span>
              {!service.is_visible && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium">Hidden</span>}
            </div>
            <Button onClick={() => setViewMode(false)} size="sm" className="h-8 gap-1.5 shrink-0">
              <Edit2 className="w-3.5 h-3.5" />Edit Service
            </Button>
          </div>
        </div>

        <FormSectionTabs
          sections={serviceViewSections}
          activeKey={activeViewTab}
          onChange={setActiveViewTab}
          completedSections={viewNavCompleted}
          hasErrorSections={new Set()}
        />

      <div className={formDisplayCompact.pageGap}>

        {showTab('basic') && (
        <>
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            {((service as any).media?.length > 0 || service.image_url || service.gallery?.length > 0) && (
              <div className="mb-3 flex gap-2 overflow-x-auto sm:gap-3">
                {((service as any).media?.length > 0
                  ? (service as any).media.sort((a: any, b: any) => a.position - b.position)
                  : [
                      ...(service.image_url ? [{ id: 'main', url: service.image_url, media_type: 'image', is_primary: true, position: 0 }] : []),
                      ...(service.gallery || []).map((url: string, i: number) => ({ id: `g${i}`, url, media_type: 'image', is_primary: false, position: i + 1 })),
                    ]
                ).map((img: any) => {
                  const mt = img.media_type || 'image'
                  return (
                    <div key={img.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-gray-50 sm:h-24 sm:w-24">
                      {mt === 'video' ? (
                        <video src={mediaUrl(img.url)} className="w-full h-full object-cover" muted playsInline onMouseOver={e => (e.target as HTMLVideoElement).play()} onMouseOut={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }} />
                      ) : mt === 'model3d' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-600">
                          <Box className="w-8 h-8" />
                          <span className="text-xs mt-0.5 font-medium">3D Model</span>
                        </div>
                      ) : (
                        <img src={mediaUrl(img.url)} alt={img.alt_text || service.name} className="w-full h-full object-cover" />
                      )}
                      {mt === 'video' && <span className="absolute bottom-0.5 right-0.5 bg-primary text-white text-[8px] font-bold px-1 rounded">VID</span>}
                      {mt === 'model3d' && <span className="absolute bottom-0.5 right-0.5 bg-cyan-600 text-white text-[8px] font-bold px-1 rounded">3D</span>}
                      {img.is_primary && (
                        <span className="absolute top-0.5 left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-yellow-900 shadow-sm" aria-label="Primary image">
                          <Star className="h-2.5 w-2.5 fill-current" />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DisplayField label="Service Code" value={service.material_code ? <span className="font-mono text-gray-700">{service.material_code}</span> : undefined} />
              <DisplayField label="Service Mode" value={modeLbl} />
              <DisplayField label="Category" value={service.category} />
              <DisplayField label="Subcategory" value={service.subcategory} />
              <DisplayField label="Brand" value={service.brand} />
              <DisplayField label="Service Type" value={typeLbl} />
            </div>
            {service.short_description && <p className="text-sm text-gray-500 mt-3 border-t pt-3">{service.short_description}</p>}
            {service.description && <p className="text-sm text-gray-700 mt-1">{service.description}</p>}
            {(service.tags || []).length > 0 && (
              <div className="flex gap-1 flex-wrap mt-3">
                {service.tags.map((t: string, i: number) => <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500"><Tag className="w-2.5 h-2.5 inline mr-0.5" />{t}</span>)}
              </div>
            )}
          </CardContent>
        </Card>

        {(service.price || service.price_min || service.discount_percentage || service.discount_amount) && (
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Star className="w-3.5 h-3.5" />Pricing</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DisplayField label="Price Type" value={
                  service.price_type === 'not_applicable' ? 'Not applicable' :
                  service.price_type === 'free' ? 'Free' :
                  service.price_type === 'quote' ? 'Quote' :
                  service.price_type
                } />
                <DisplayField label="Price" value={service.price ? `${sym}${service.price.toLocaleString()}` : undefined} />
                <DisplayField label="Min Price" value={service.price_min ? `${sym}${service.price_min.toLocaleString()}` : undefined} />
                <DisplayField label="Max Price" value={service.price_max ? `${sym}${service.price_max.toLocaleString()}` : undefined} />
                <DisplayField label="Discount %" value={service.discount_percentage ? `${service.discount_percentage}%` : undefined} />
                <DisplayField label="Discount Amt" value={service.discount_amount ? `${sym}${service.discount_amount}` : undefined} />
                <DisplayField label="Offer Label" value={service.offer_label} />
                <DisplayField label="Tax" value={service.is_taxable ? `${service.tax_rate ?? 0}% GST${service.sac_code ? ` (SAC: ${service.sac_code})` : ''}` : 'Not taxable'} />
              </div>
            </CardContent>
          </Card>
        )}
        </>
        )}

        {showTab('storefrontOptions') && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><ToggleRight className="w-3.5 h-3.5" />Business Front Options</p>
            <div className="divide-y rounded-lg border">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-gray-700 font-medium">{service.booking_label || 'Booking'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${service.requires_booking ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {service.requires_booking ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-primary" />
                  <p className="text-sm text-gray-700 font-medium">{service.subscription_label || 'Subscription'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(service as any).is_subscription ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                  {(service as any).is_subscription ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <p className="text-sm text-gray-700 font-medium">{service.quote_request_label || 'Quote Requests'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${service.allow_quote_request ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {service.allow_quote_request ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm text-gray-700 font-medium">Free</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${service.price_type === 'free' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {service.price_type === 'free' ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-700 font-medium">Price not applicable</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${service.price_type === 'not_applicable' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {service.price_type === 'not_applicable' ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            {service.allow_quote_request && Array.isArray(service.quote_form_config) && service.quote_form_config.length > 0 && (
              <div className="mt-3 space-y-1">
                <FormColumnLabel className="tracking-wide">Quote Form Fields</FormColumnLabel>
                <div className="flex flex-wrap gap-1.5">
                  {service.quote_form_config.map((f: any, i: number) => (
                    f.enabled !== false && (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${f.required ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {(f.label || f.name || '').replace(/_/g, ' ')}{f.required ? '*' : ''}
                      </span>
                    )
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {showTab('subscription') && (service as any).is_subscription && (service as any).plans?.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" />Subscription Plans</p>
              <div className="space-y-4">
                {(service as any).plans.filter((v: any) => v.is_active !== false).map((v: any) => {
                  const freq = v.service_frequency || 'once'
                  const isRec = freq === 'recurring'
                  const interval = v.subscription_interval || (service as any).subscription_interval
                  const vPriceType = v.price_type || 'per_cycle'
                  const vUom = v.uom || service.uom || 'session'
                  const vuomLbl = UOM_OPTIONS.find(u => u.value === vUom)?.label || vUom
                  const priceSuffix = isRec && vPriceType === 'per_cycle' && interval ? `/${interval}` : `/${vuomLbl}`
                  const vModeLbl = SERVICE_MODE_OPTIONS.find(m => m.value === v.service_mode)?.label
                  return (
                    <div key={v.id} className="rounded-xl border-2 border-primary/20 bg-accent/60 p-4 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">{v.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isRec ? 'bg-primary/10 text-primary' : 'bg-blue-100 text-blue-700'}`}>{isRec ? 'Recurring' : 'One-time'}</span>
                        {isRec && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vPriceType === 'per_cycle' ? 'bg-accent text-primary' : 'bg-blue-50 text-blue-600'}`}>{vPriceType === 'per_cycle' ? 'Per Cycle' : 'Per UOM'}</span>}
                        {isRec && interval && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{interval}</span>}
                        {vModeLbl && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{vModeLbl}</span>}
                      </div>
                      <div className="flex items-baseline gap-2">
                        {v.price != null && (
                          <span className="text-xl font-bold text-primary">{sym}{v.price}<span className="text-xs font-normal text-gray-500">{priceSuffix}</span></span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                        {v.subscription_trial_days ? <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{v.subscription_trial_days}d free trial</span> : null}
                        {v.subscription_setup_fee ? <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{sym}{v.subscription_setup_fee} setup</span> : null}
                        {v.subscription_billing_cycles ? <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">max {v.subscription_billing_cycles} cycles</span> : null}
                        {v.duration_minutes ? <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{v.duration_minutes} {vuomLbl.replace(/\s*\(.*\)/, '').toLowerCase()}</span> : null}
                      </div>
                      {v.description && <p className="text-xs text-gray-400 italic">{v.description}</p>}
                      {v.subscription_schedule_modes?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {v.subscription_schedule_modes.map((m: string) => (
                            <span key={m} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium capitalize">{m.replace('_', ' ')}</span>
                          ))}
                        </div>
                      )}
                      {/* Per-plan feature badges */}
                      {(v.service_mode || v.buffer_minutes || v.service_capacity > 1 || v.duration_minutes ||
                        v.plan_price_type || v.discount_percentage || v.discount_amount ||
                        v.tax_rate || v.sac_code || v.gst_rate ||
                        v.requires_booking != null || v.cancellation_policy ||
                        v.availability?.length || v.service_expiry_date || v.validity_period_days || v.renewal_required) && (
                        <div className="border-t border-primary/30 pt-2 space-y-2">
                          {/* Config */}
                          <div className="flex gap-3 text-xs flex-wrap">
                            <span className="font-medium text-blue-600 flex items-center gap-1"><Settings className="w-3 h-3" />Config:</span>
                            {vModeLbl && <span>{vModeLbl}</span>}
                            {v.duration_minutes ? <span>{v.duration_minutes} {(UOM_OPTIONS.find(u => u.value === vUom)?.label?.replace(/\s*\(.*\)/, '') || 'min').toLowerCase()}</span> : null}
                          </div>
                          {/* Pricing */}
                          {(v.discount_percentage || v.discount_amount || v.offer_label) && (
                            <div className="flex gap-3 text-xs">
                              <span className="font-medium text-green-600 flex items-center gap-1"><IndianRupee className="w-3 h-3" />Discount:</span>
                              {v.discount_percentage ? <span>{v.discount_percentage}%</span> : null}
                              {v.discount_amount ? <span>{sym}{v.discount_amount}</span> : null}
                              {v.offer_label && <span className="italic">{v.offer_label}</span>}
                            </div>
                          )}
                          {/* Tax */}
                          {(v.tax_rate || v.gst_rate || v.sac_code) && (
                            <div className="flex gap-3 text-xs">
                              <span className="font-medium text-amber-600 flex items-center gap-1"><Receipt className="w-3 h-3" />Tax:</span>
                              {v.tax_rate ? <span>{v.tax_rate}%</span> : null}
                              {v.gst_rate ? <span>GST {v.gst_rate}%</span> : null}
                              {v.sac_code && <span>SAC: {v.sac_code}</span>}
                            </div>
                          )}
                          {/* Booking */}
                          {v.cancellation_policy && (
                            <div className="flex gap-3 text-xs">
                              <span className="font-medium text-indigo-600 flex items-center gap-1"><CalendarClock className="w-3 h-3" />Booking:</span>
                              <span>{v.cancellation_policy}</span>
                            </div>
                          )}
                          {/* Availability */}
                          {v.availability?.length > 0 && (
                            <div className="flex gap-2 flex-wrap text-xs">
                              <span className="font-medium text-cyan-600 flex items-center gap-1"><Calendar className="w-3 h-3" />Availability:</span>
                              {v.availability.filter((a: any) => a.is_available).map((a: any) => (
                                <span key={a.day_of_week} className="bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded text-xs">
                                  {DAYS_SHORT[a.day_of_week]} {a.start_time}–{a.end_time}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Lifecycle */}
                          {(v.service_expiry_date || v.validity_period_days || v.renewal_required) && (
                            <div className="flex gap-3 text-xs">
                              <span className="font-medium text-rose-600 flex items-center gap-1"><Clock className="w-3 h-3" />Lifecycle:</span>
                              {v.service_expiry_date && <span>Expires {v.service_expiry_date}</span>}
                              {v.validity_period_days && <span>{v.validity_period_days}d validity</span>}
                              {v.renewal_required && <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-full">Renewal req.</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {showTab('advanced') && (service.whats_included?.length || service.whats_not_included?.length || service.service_areas?.length || service.prerequisites) && (
          <Card>
            <CardContent className={formDisplayCompact.cardBody}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />Details</p>
              {service.prerequisites && <div className="mb-3"><FormColumnLabel className="mb-1">Prerequisites</FormColumnLabel><p className="text-sm text-gray-700">{service.prerequisites}</p></div>}
              {service.whats_included?.length > 0 && (
                <div className="mb-3">
                  <FormColumnLabel className="mb-1">What's Included</FormColumnLabel>
                  <div className="flex gap-1.5 flex-wrap">{service.whats_included.map((w: string, i: number) => <span key={i} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">{w}</span>)}</div>
                </div>
              )}
              {service.whats_not_included?.length > 0 && (
                <div className="mb-3">
                  <FormColumnLabel className="mb-1">Not Included</FormColumnLabel>
                  <div className="flex gap-1.5 flex-wrap">{service.whats_not_included.map((w: string, i: number) => <span key={i} className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-100">{w}</span>)}</div>
                </div>
              )}
              {service.service_areas?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase mb-1 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />Service Areas</p>
                  <div className="flex gap-1.5 flex-wrap">{service.service_areas.map((a: string, i: number) => <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{a}</span>)}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showTab('seo') && (service.meta_title || service.meta_description || service.meta_keywords) && (
          <Card>
            <CardContent className={formDisplayCompact.cardBody}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Search className="w-3.5 h-3.5" />SEO & Metadata</p>
              <div className="space-y-2">
                <DisplayField label="Meta Title" value={service.meta_title} />
                <DisplayField label="Meta Description" value={service.meta_description} />
                {service.meta_keywords && (
                  <DisplayField label="Meta Keywords" value={
                    <div className="flex flex-wrap gap-1.5">
                      {(typeof service.meta_keywords === 'string'
                        ? (service.meta_keywords as string).split(',').map((k: string) => k.trim()).filter(Boolean)
                        : (service.meta_keywords as string[])
                      ).map((k: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{k}</span>
                      ))}
                    </div>
                  } />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {showTab('addons') && ((svcAddons.length > 0) || (service as any).service_packages) && (
          <Card>
            <CardContent className={formDisplayCompact.cardBody}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Puzzle className="w-3.5 h-3.5" />Add-ons & Packages</p>
              {svcAddons.length > 0 && (
                <div className="mb-3">
                  <FormColumnLabel className="mb-1">Linked Add-ons</FormColumnLabel>
                  <div className="space-y-2">
                    {svcAddons.map((addon, i) => (
                      <div key={addon.id || i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <CatalogItemLink id={addon.id} name={addon.name} itemType={addon.item_type} className="text-foreground" />
                          {addon.addon_type && <span className="ml-2 text-xs text-muted-foreground capitalize">{addon.addon_type}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {addon.optional !== undefined && <span>{addon.optional ? 'Optional' : 'Required'}</span>}
                          {addon.booking_trigger && <span className="capitalize">{addon.booking_trigger.replace(/_/g, ' ')}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(service as any).service_packages && (() => {
                let pkgs: any[] = []
                try { pkgs = typeof (service as any).service_packages === 'string' ? JSON.parse((service as any).service_packages) : (service as any).service_packages } catch { }
                if (!Array.isArray(pkgs) || pkgs.length === 0) return null
                return (
                  <div>
                    <FormColumnLabel className="mb-2">Service Packages</FormColumnLabel>
                    <div className="space-y-2">
                      {pkgs.map((pkg: any, i: number) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 bg-gray-50/50">
                          <span className="text-sm font-medium text-gray-800">{pkg.name || `Package ${i + 1}`}</span>
                          {pkg.price != null && <span className="text-sm font-bold text-gray-700">{sym}{pkg.price}</span>}
                          {pkg.includes?.length > 0 && (
                            <div className="flex gap-1 flex-wrap ml-3">
                              {pkg.includes.map((inc: string, j: number) => (
                                <span key={j} className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-100">{inc}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {showTab('serviceBom') && (
          <Card>
            <CardContent className={formDisplayCompact.cardBody}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5" />Service Bill of Materials
              </p>
              <ServiceCostSummary serviceId={service.id as string} currency={service.currency} />
              {(serviceBomData as Record<string, unknown>[] | undefined)?.length ? (
                <div className="mt-4 border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Material</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Unit Cost</th>
                        <th className="px-3 py-2 text-left">Line Cost</th>
                        <th className="px-3 py-2 text-left">Auto Reserve</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(serviceBomData as Record<string, unknown>[]).map((item, i) => (
                        <tr key={(item.id as string) || i}>
                          <td className="px-3 py-2">
                            <span className="font-medium">{item.component_name as string}</span>
                            {item.component_sku && <span className="text-xs text-gray-400 ml-2">{item.component_sku as string}</span>}
                          </td>
                          <td className="px-3 py-2">{item.qty_per_service as number}</td>
                          <td className="px-3 py-2">{sym}{Number(item.unit_cost ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2 font-medium">{sym}{Number(item.line_cost ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2">{item.auto_reserve !== false ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic mt-2">No materials defined. Edit the service to add a BOM.</p>
              )}
            </CardContent>
          </Card>
        )}

        {showTab('resources') && (
          <Card>
            <CardContent className={formDisplayCompact.cardBody}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />Service Resources
              </p>
              {(serviceResourcesData as Record<string, unknown>[] | undefined)?.length ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Resource</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Duration</th>
                        <th className="px-3 py-2 text-left">Rate</th>
                        <th className="px-3 py-2 text-left">Cost</th>
                        <th className="px-3 py-2 text-left">Reserve</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(serviceResourcesData as Record<string, unknown>[]).map((item, i) => (
                        <tr key={(item.id as string) || i}>
                          <td className="px-3 py-2 capitalize">{(item.resource_type as string)?.replace('_', ' ')}</td>
                          <td className="px-3 py-2 font-medium">{item.resource_name as string}</td>
                          <td className="px-3 py-2">{item.quantity as number}</td>
                          <td className="px-3 py-2">{item.duration_minutes ? `${item.duration_minutes} min` : '—'}</td>
                          <td className="px-3 py-2">{sym}{Number(item.cost_rate ?? 0).toFixed(2)}/{(item.cost_type as string) === 'fixed' ? 'fixed' : 'hr'}</td>
                          <td className="px-3 py-2 font-medium">{sym}{Number(item.line_cost ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2">{item.auto_reserve !== false ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No resources defined. Edit the service to add resource requirements.</p>
              )}
            </CardContent>
          </Card>
        )}

        {showTab('visibility') && (
        <>
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Store className="w-3.5 h-3.5" />Business Unit Availability</p>
            <p className="text-sm text-gray-600">
              {(service.store_scope === 'selected'
                ? (service.store_ids?.length
                  ? service.store_ids.map(id => businessUnits.find(s => s.id === id)?.name || id).join(', ')
                  : 'None selected')
                : 'All business units')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />Visibility & Marketing</p>
            <div className="flex gap-2 flex-wrap">
              {service.is_featured  && <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 font-medium">⭐ Featured</span>}
              {service.is_popular   && <span className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-medium">🔥 Popular</span>}
              {service.is_new_service && <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">✨ New</span>}
              {service.is_visible   ? <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">👁 Visible</span>
                                    : <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">Hidden</span>}
            </div>
          </CardContent>
        </Card>
        </>
        )}

        {showTab('stats') && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Statistics</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <div className="rounded-lg border p-2 text-center sm:p-2.5">
                <p className="text-xl font-bold text-blue-700">{priceDisplay}</p>
                <p className="text-xs text-gray-400 mt-0.5">{uomLbl}</p>
              </div>
              <div className="text-center rounded-lg border p-2 sm:p-2.5">
                <p className="text-xl font-bold">{service.duration_minutes ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">Duration (min)</p>
              </div>
              <div className="text-center rounded-lg border p-2 sm:p-2.5">
                <p className="text-xl font-bold">{service.view_count ?? 0}</p>
                <p className="text-xs text-gray-400 mt-0.5">Views</p>
              </div>
              <div className="text-center rounded-lg border p-2 sm:p-2.5">
                <p className="text-xl font-bold">{service.booking_count ?? 0}</p>
                <p className="text-xs text-gray-400 mt-0.5">Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {showTab('history') && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2">
                <History className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <SectionLabel>Change History</SectionLabel>
                  <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-500">v{service.version_number}</span>
                  <span className="text-xs text-gray-400 ml-1">{history.length} entries</span>
                  <p className="mt-1 text-xs text-muted-foreground max-w-md">
                    Each save creates a version. Recent edits are listed below; use View Full Report for a complete export.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(`/services/${service.id}/audit`)}>
                <FileDown className="w-4 h-4" />View Full Report
              </Button>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">No history available yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...history].reverse().map((h: any, i: number) => {
                  const changes = h.changes || {}
                  const isCreation = changes._action?.new === 'Service created'
                  const changedFields = Object.keys(changes).filter(k => k !== '_action')
                  return (
                    <div key={i} className="text-xs border rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-600">v{h.version}</span>
                        <span className="text-gray-400">{h.changed_at ? new Date(h.changed_at).toLocaleString() : ''}</span>
                        {h.changed_by_name && <span className="text-gray-500">by {h.changed_by_name}</span>}
                      </div>
                      {isCreation ? (
                        <span className="text-green-600 font-medium">Service created</span>
                      ) : changedFields.length > 0 ? changedFields.map((field, j) => (
                        <div key={j} className="flex gap-2 text-xs text-gray-500 flex-wrap">
                          <span className="font-medium text-gray-700 capitalize">{field.replace(/_/g, ' ')}:</span>
                          <span className="text-red-500 line-through truncate max-w-[120px]">{String(changes[field]?.old ?? '(empty)')}</span>
                          <span>→</span>
                          <span className="text-green-600 truncate max-w-[120px]">{String(changes[field]?.new ?? '(empty)')}</span>
                        </div>
                      )) : (
                        <span className="text-gray-400 italic">No field changes recorded</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {showTab('printDocs') && svcPrintDocs.length > 0 && (
          <Card>
            <CardContent className={cn(formDisplayCompact.cardBodyTight, 'space-y-1.5')}>
              <div className="flex items-center gap-2 mb-1">
                <Printer className="w-4 h-4 text-gray-500" />
                <span className="font-semibold text-gray-800">Print Documents</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {svcPrintDocs.map((docId) => {
                  const doc = BOOKING_DOC_TYPES.find(d => d.id === docId)
                  return doc ? (
                    <span key={docId} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground">
                      {doc.label}
                    </span>
                  ) : null
                })}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
      </div>
      </FormPageWithNav>
    )
  }

  // ── Edit / Create Mode ────────────────────────────────────────────

  const handleDeleteService = () => {
    if (!id) return
    deleteService.mutate(id, { onSuccess: () => navigate('/services') })
  }

  return (
    <FormPageWithNav activeSectionKey={activeTab} nav={null}>
      <CatalogEditStickyBar
        backLabel={isEdit ? 'View' : 'Back'}
        onBack={() => (isEdit ? setViewMode(true) : navigate('/services'))}
        title={isEdit ? (service?.name || 'Edit Service') : 'New Service'}
        status={formValues.status ?? 'draft'}
        onStatusChange={(value) => setValue('status', value as 'active' | 'draft' | 'archived')}
        visibleControl={(
          <Controller
            name="is_visible"
            control={control}
            render={({ field }) => (
              <Toggle label="Visible" checked={field.value} onChange={field.onChange} />
            )}
          />
        )}
        onSave={handleSubmit(onSubmit, onFormInvalid)}
        saveLabel={isEdit ? 'Save Service' : 'Create Service'}
        isSaving={isSaving || deleteService.isPending}
        isEdit={isEdit}
        onDelete={handleDeleteService}
        isDeleting={deleteService.isPending}
        deleteConfirmMessage="Delete this service?"
      />

      <FormSectionTabs
        sections={serviceSections}
        activeKey={activeTab}
        onChange={toggle}
        completedSections={serviceCompletedSections}
        hasErrorSections={serviceErrorSections}
      />

      <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit, onFormInvalid)} className={formEditLayout.formStack}>

        {/* 1. Basic */}
        <Section title="Basic" icon={Briefcase} open={activeTab === 'basic'} onToggle={() => toggle('basic')} sectionId="basic">
          <div className={formEditLayout.sectionBody}>
            <div className={formEditLayout.fieldGridWide}>
              <FormField label="Service Name" name="name" required>
                <Input
                  {...register('name')}
                  placeholder="e.g. AC Repair & Service"
                  maxLength={SERVICE_NAME_MAX}
                  onKeyDown={(e) => {
                    const el = e.currentTarget
                    const selLen = (el.selectionEnd ?? 0) - (el.selectionStart ?? 0)
                    const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
                    if (isPrintable && el.value.length >= SERVICE_NAME_MAX && selLen === 0) {
                      e.preventDefault()
                      notifyServiceNameMax()
                    }
                  }}
                  onPaste={(e) => {
                    const el = e.currentTarget
                    const paste = e.clipboardData.getData('text')
                    const start = el.selectionStart ?? el.value.length
                    const end = el.selectionEnd ?? el.value.length
                    const next = el.value.slice(0, start) + paste + el.value.slice(end)
                    if (next.length > SERVICE_NAME_MAX) {
                      e.preventDefault()
                      const truncated = next.slice(0, SERVICE_NAME_MAX)
                      setValue('name', truncated, { shouldDirty: true, shouldValidate: true })
                      notifyServiceNameMax()
                    }
                  }}
                />
              </FormField>
              <FormField label="Service Code">
                <div className="space-y-1">
                  <div className="relative">
                    <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <Input
                      {...register('material_code')}
                      readOnly
                      placeholder="Auto-generated on save"
                      className="w-full min-w-0 cursor-default bg-gray-50 pl-8 pr-9 font-mono text-gray-700"
                    />
                    {isEdit && watch('material_code') ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(String(watch('material_code') || ''))
                          toast.success('Material code copied')
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Copy material code"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-400">Unique item code, assigned automatically.</p>
                </div>
              </FormField>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Category</Label>
                <CategoryHierarchyPicker
                  tree={serviceCategories}
                  category={watchedCategory || ''}
                  subcategory={watchedSubcategory || ''}
                  onChange={(cat, sub) => {
                    setValue('category', cat)
                    setValue('subcategory', sub)
                  }}
                />
                {(watchedCategory || watchedSubcategory) && (
                  <p className="text-xs text-gray-500">
                    Selected: {[watchedCategory, watchedSubcategory].filter(Boolean).join(' › ')}
                  </p>
                )}
              </div>
              <FormField label="Tags (comma separated)">
                <Input {...register('tags')} placeholder="repair, home-service, ac" />
              </FormField>
            </div>
            <div className={formEditLayout.fieldGrid3}>
              <FormField label="Short Description">
                <AiDescriptionTextarea
                  value={watchedShortDescription || ''}
                  onChange={(v) => setValue('short_description', v, { shouldDirty: true })}
                  rows={2}
                  className={textareaCls}
                  placeholder="Brief summary (max 500 chars)"
                  maxLength={500}
                  context={{
                    field_kind: 'service_short',
                    name: watchedName,
                    category: [watchedCategory, watchedSubcategory].filter(Boolean).join(' › '),
                  }}
                />
              </FormField>
              <FormField label="Full Description" className="sm:col-span-2">
                <AiDescriptionTextarea
                  value={watchedDescription || ''}
                  onChange={(v) => setValue('description', v, { shouldDirty: true })}
                  rows={2}
                  className={textareaCls}
                  placeholder="Detailed service description..."
                  maxLength={2000}
                  context={{
                    field_kind: 'service_description',
                    name: watchedName,
                    category: [watchedCategory, watchedSubcategory].filter(Boolean).join(' › '),
                    extra_context: { short_description: watchedShortDescription },
                  }}
                />
              </FormField>
            </div>
          </div>
        </Section>

        {/* Media — below basic on the same tab */}
        {activeTab === 'basic' && isEdit && service ? (
          <FormMediaCard><div className={formEditLayout.mediaCard}><CatalogMediaSectionHeader helperText={EDIT_MEDIA_HELPER} />
            <ServiceMediaUpload
              media={(service as any).media || []}
              onUpload={handleMediaUpload}
              onDelete={handleMediaDelete}
              onSetPrimary={handleMediaSetPrimary}
              onReorder={handleMediaReorder}
              onEditMedia={handleMediaEdit}
            />
          </div></FormMediaCard>
        ) : activeTab === 'basic' && !isEdit ? (
          <FormMediaCard><div className={formEditLayout.mediaCard}>
            <CatalogMediaSectionHeader helperText={STAGED_SERVICE_HELPER} />
            <StagedMediaUpload
              files={pendingFiles}
              previews={pendingPreviews}
              primaryIndex={pendingPrimaryIndex}
              onPrimaryIndexChange={setPendingPrimaryIndex}
              onReorderFiles={reorderPendingFiles}
              onAddFiles={addPendingFiles}
              onRemoveFile={removePendingFile}
              onReplaceFile={replacePendingFile}
              pickerTitle="Service media"
            />
          </div></FormMediaCard>
        ) : null}

        {/* Business Front Options */}
        <Section
          title="Business Front Options"
          icon={ToggleRight}
          open={activeTab === 'storefrontOptions'}
          onToggle={() => toggle('storefrontOptions')} sectionId="storefrontOptions"
        >
          <div className="pt-2">
            <p className="mb-2 text-xs text-gray-500">Control how customers interact with this service on the business front.</p>
            <div className="divide-y rounded-lg border">
              <div className="flex items-center justify-between px-3 py-2 gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <CalendarClock className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Input
                      {...register('booking_label')}
                      placeholder="Booking"
                      className="h-7 text-sm font-medium text-gray-800 border-transparent bg-transparent px-1 -mx-1 hover:border-input focus:border-input focus:bg-background shadow-none"
                    />
                    <p className="text-xs text-gray-400">Customers can book appointments or schedule sessions. This name appears on the business front.</p>
                  </div>
                </div>
                <Controller name="requires_booking" control={control} render={({ field }) => (
                  <Toggle checked={field.value} onChange={field.onChange} small />
                )} />
              </div>
              <div className="flex items-center justify-between px-3 py-2 gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Repeat className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Input
                      {...register('subscription_label')}
                      placeholder="Subscription"
                      className="h-7 text-sm font-medium text-gray-800 border-transparent bg-transparent px-1 -mx-1 hover:border-input focus:border-input focus:bg-background shadow-none"
                    />
                    <p className="text-xs text-gray-400">Offer recurring plans with billing intervals. This name appears on the business front.</p>
                  </div>
                </div>
                <Controller name="is_subscription" control={control} render={({ field }) => (
                  <Toggle checked={field.value} onChange={field.onChange} small />
                )} />
              </div>
              <div className="flex items-center justify-between px-3 py-2 gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Input
                      {...register('quote_request_label')}
                      placeholder="Quote Requests"
                      className="h-7 text-sm font-medium text-gray-800 border-transparent bg-transparent px-1 -mx-1 hover:border-input focus:border-input focus:bg-background shadow-none"
                    />
                    <p className="text-xs text-gray-400">Allow customers to request pricing quotes. This name appears on the business front.</p>
                  </div>
                </div>
                <Controller name="allow_quote_request" control={control} render={({ field }) => (
                  <Toggle checked={field.value} onChange={field.onChange} small />
                )} />
              </div>
              <div className="flex items-center justify-between px-3 py-2 gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">Free</p>
                    <p className="text-xs text-gray-400">Show &quot;Free&quot; on the business front instead of a price or quote label.</p>
                  </div>
                </div>
                <Toggle
                  checked={watchedPriceType === 'free'}
                  onChange={(on) => {
                    setValue('price_type', on ? 'free' : 'fixed', { shouldDirty: true })
                  }}
                  small
                />
              </div>
              <div className="flex items-center justify-between px-3 py-2 gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Tag className="w-4 h-4 text-gray-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">Price not applicable</p>
                    <p className="text-xs text-gray-400">Hide the PRICE section on the business front. Customers reach you via quotation instead of seeing &quot;Get a Quote&quot;.</p>
                  </div>
                </div>
                <Toggle
                  checked={watchedPriceType === 'not_applicable'}
                  onChange={(on) => {
                    setValue('price_type', on ? 'not_applicable' : 'fixed', { shouldDirty: true })
                    if (on) setValue('allow_quote_request', true, { shouldDirty: true })
                  }}
                  small
                />
              </div>
            </div>

            {/* Quote Form Field Configurator */}
            {watch('allow_quote_request') && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Quote Request Form Fields</p>
                    <p className="text-xs text-gray-400">Toggle fields on/off and mark them as required or optional</p>
                  </div>
                </div>
                <QuoteFormConfigurator fields={quoteFields} onChange={setQuoteFields} />
              </div>
            )}

            {/* Service-Level Weekly Availability */}
            {watch('requires_booking') && (() => {
              const isAllDay = serviceAvailability
                .filter(s => s.is_available)
                .every(s => s.start_time === '00:00' && s.end_time === '23:59')
              const toggleAllDay = () => {
                if (isAllDay) {
                  setServiceAvailability(serviceAvailability.map(s =>
                    s.is_available ? { ...s, start_time: '09:00', end_time: '18:00' } : s
                  ))
                } else {
                  setServiceAvailability(serviceAvailability.map(s =>
                    s.is_available ? { ...s, start_time: '00:00', end_time: '23:59' } : s
                  ))
                }
              }
              return (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Booking Availability</p>
                      <p className="text-xs text-muted-foreground">Set your weekly availability for customer bookings. Plans can override these slots.</p>
                    </div>
                    <label className="flex cursor-pointer select-none items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isAllDay}
                        onClick={toggleAllDay}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
                          isAllDay ? 'bg-primary' : 'bg-muted',
                        )}
                      >
                        <span className={cn(
                          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                          isAllDay ? 'translate-x-4' : 'translate-x-0',
                        )} />
                      </button>
                      <span className="text-xs font-medium text-muted-foreground">Available all day (24 hrs)</span>
                    </label>
                  </div>
                  <AvailabilityEditor availability={serviceAvailability} onChange={setServiceAvailability} />
                </div>
              )
            })()}
          </div>
        </Section>

        {activeTab === 'subscription' && (
          <ServicePlansEditor
            plans={plans}
            setPlans={setPlans}
            expandedPlans={expandedPlans}
            setExpandedPlans={setExpandedPlans}
            confirmDeletePlan={confirmDeletePlan}
            setConfirmDeletePlan={setConfirmDeletePlan}
            insertPlanAt={insertPlanAt}
            AvailabilityEditor={AvailabilityEditor}
          />
        )}
        {/* Pricing, Tax, Booking, Availability, and Lifecycle are now inside each plan card */}

        {/* 8. Business unit availability */}
        <Section title="Business Unit Availability" icon={Store} open={activeTab === 'visibility'} onToggle={() => toggle('visibility')} sectionId="visibility-bu">
          <div className={formEditLayout.sectionBody}>
            <BusinessUnitScopePicker
              stores={businessUnits}
              scope={catalogStoreScope}
              selectedIds={catalogStoreIds}
              onScopeChange={setCatalogStoreScope}
              onSelectedChange={setCatalogStoreIds}
              hideHeader
            />
          </div>
        </Section>

        {/* 8b. Visibility & Marketing */}
        <Section title="Visibility & Marketing" icon={Eye} open={activeTab === 'visibility'} onToggle={() => toggle('visibility')} sectionId="visibility">
          <div className={formEditLayout.sectionBody}>
            <p className="mb-2 rounded bg-blue-50 px-3 py-1.5 text-xs text-gray-400">Status and visibility are controlled from the top sticky bar.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
              <Controller name="is_featured" control={control} render={({ field }) => (
                <Toggle label="⭐ Featured Service" checked={field.value} onChange={field.onChange} small />
              )} />
              <Controller name="is_popular" control={control} render={({ field }) => (
                <Toggle label="🔥 Popular" checked={field.value} onChange={field.onChange} small />
              )} />
              <Controller name="is_new_service" control={control} render={({ field }) => (
                <Toggle label="✨ New Service" checked={field.value} onChange={field.onChange} small />
              )} />
            </div>
          </div>
        </Section>

        {/* 9. SEO */}
        <Section title="SEO & Metadata" icon={Search} open={activeTab === 'seo'} onToggle={() => toggle('seo')} sectionId="seo">
          <div className={formEditLayout.sectionBody}>
            <div className={formEditLayout.fieldGridWide}>
              <FormField label="Meta Title"><Input {...register('meta_title')} placeholder="SEO title (leave blank to auto-generate)" /></FormField>
              <FormField label="Meta Keywords (comma separated)">
                <Input {...register('meta_keywords')} placeholder="ac repair, cooling service" />
              </FormField>
            </div>
            <FormField label="Meta Description">
              <AiDescriptionTextarea
                value={watchedMetaDescription || ''}
                onChange={(v) => setValue('meta_description', v, { shouldDirty: true })}
                rows={2}
                className={textareaCls}
                placeholder="SEO description..."
                maxLength={160}
                context={{
                  field_kind: 'service_meta',
                  name: watchedName,
                  category: [watchedCategory, watchedSubcategory].filter(Boolean).join(' › '),
                  extra_context: { short_description: watchedShortDescription },
                }}
              />
            </FormField>
          </div>
        </Section>

        {/* 10. Advanced Features */}
        <Section title="Advanced Features" icon={Puzzle} open={activeTab === 'advanced'} onToggle={() => toggle('advanced')} sectionId="advanced">
          <div className={formEditLayout.sectionBody}>
            <div className={formEditLayout.fieldGrid3}>
              <FormField label="Prerequisites">
                <AiDescriptionTextarea
                  value={watchedPrerequisites || ''}
                  onChange={(v) => setValue('prerequisites', v, { shouldDirty: true })}
                  rows={2}
                  className={textareaCls}
                  placeholder="What the customer needs to prepare..."
                  maxLength={1000}
                  context={{
                    field_kind: 'general',
                    name: watchedName,
                    category: [watchedCategory, watchedSubcategory].filter(Boolean).join(' › '),
                    extra_context: {
                      purpose: 'Write prerequisites / preparation notes for customers booking this service',
                    },
                  }}
                />
              </FormField>
              <FormField label="What's Included (comma separated)">
                <Input {...register('whats_included')} placeholder="Inspection, Labor, Parts" />
              </FormField>
              <FormField label="What's Not Included (comma separated)">
                <Input {...register('whats_not_included')} placeholder="Travel charges, Spare parts" />
              </FormField>
            </div>
            <div className={formEditLayout.fieldGridWide}>
              <FormField label="Service Areas (pin codes or names, comma separated)">
                <Input {...register('service_areas')} placeholder="560001, 560002, Koramangala" />
              </FormField>
            </div>
            <div>
              <FormColumnLabel className="mb-1.5">Service Packages</FormColumnLabel>
              <p className="text-xs text-gray-400 mb-2">Optional bundles customers can choose instead of a single price — e.g. "Basic" vs "Premium".</p>
              <div className="space-y-2">
                {servicePackages.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No packages yet.</p>
                )}
                {servicePackages.map((pkg, i) => (
                  <div key={pkg._key} className="rounded-lg border border-gray-200 p-2.5 space-y-2 bg-gray-50/50">
                    <div className="flex items-start gap-2">
                      <div className="grid flex-1 grid-cols-2 gap-2">
                        <Input
                          value={pkg.name}
                          onChange={e => setServicePackages(rows => rows.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
                          placeholder="Package name (Basic)"
                        />
                        <InputWithPrefix
                          prefix={CURRENCY_SYMBOL[watch('currency')] || watch('currency') || '₹'}
                          type="number"
                          min="0"
                          step="0.01"
                          value={pkg.price}
                          onChange={e => setServicePackages(rows => rows.map((r, idx) => idx === i ? { ...r, price: e.target.value } : r))}
                          placeholder="999"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setServicePackages(rows => rows.filter((_, idx) => idx !== i))}
                        className="mt-1 shrink-0 rounded p-1.5 text-destructive hover:bg-destructive/10"
                        title="Remove package"
                        aria-label="Remove package"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <Input
                      value={pkg.includes}
                      onChange={e => setServicePackages(rows => rows.map((r, idx) => idx === i ? { ...r, includes: e.target.value } : r))}
                      placeholder="What's included, comma separated (Inspection, Labor, Parts)"
                    />
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setServicePackages(rows => [...rows, emptyServicePackage()])} className="gap-2 mt-2">
                <Plus className="w-3.5 h-3.5" /> Add package
              </Button>
            </div>
          </div>
        </Section>

        {/* Add-ons & Linked Services/Products */}
        <Section title="Add-ons & Linked Items" icon={Plus} open={activeTab === 'addons'} onToggle={() => toggle('addons')} sectionId="addons">
          <div className={formEditLayout.sectionBody}>
            <p className="text-xs text-gray-500">
              Attach products or services that can be sold or booked alongside this service — e.g. spare parts, installation, warranty, follow-up sessions.
              Set <strong>when booking is triggered</strong> based on the order channel or status.
            </p>

            {/* Search input */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products or services to add…"
                    value={svcAddonSearch}
                    onChange={e => setSvcAddonSearch(e.target.value)}
                    onFocus={() => setSvcAddonPickerOpen(true)}
                    onBlur={() => setTimeout(() => setSvcAddonPickerOpen(false), 150)}
                    autoComplete="off"
                    className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {svcAddonLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />}
                </div>
              </div>
              {svcAddonPickerOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {svcAddonLoading ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">Loading products and services…</p>
                  ) : svcAddonResults.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">
                      {svcAddonSearch.trim().length >= 2 ? 'No matching products or services' : 'No products or services available to add'}
                    </p>
                  ) : (
                    svcAddonResults.map(r => (
                    <button key={r.id} type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-indigo-50 border-b border-gray-50 last:border-0"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setServiceAddons(prev => [...prev, {
                          id: r.id, name: r.name, item_type: r.item_type,
                          addon_type: r.item_type === 'service' ? 'demo' : 'other',
                          booking_trigger: 'at_sale',
                          optional: true,
                        }])
                        setSvcAddonSearch('')
                        setSvcAddonResults([])
                        setSvcAddonPickerOpen(false)
                      }}>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase ${r.item_type === 'service' ? 'bg-primary/12 text-primary' : 'bg-blue-100 text-blue-700'}`}>
                        {r.item_type === 'service' ? 'SVC' : 'PRD'}
                      </span>
                      <CatalogItemLink id={r.id} name={r.name} itemType={r.item_type} stopPropagation className="text-gray-800 text-xs" />
                    </button>
                  )))}
                </div>
              )}
            </div>

            {/* Addon list */}
            {serviceAddons.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                <Plus className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                <p className="text-xs text-gray-400">No add-ons yet. Search to link spare parts, warranties, follow-up sessions, or any complementary item.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {serviceAddons.map((addon, ai) => (
                  <div key={addon.id} className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0 ${addon.item_type === 'service' ? 'bg-primary/12 text-primary' : 'bg-blue-100 text-blue-700'}`}>
                        {addon.item_type === 'service' ? 'Service' : 'Product'}
                      </span>
                      <CatalogItemLink
                        id={addon.id}
                        name={addon.name}
                        itemType={addon.item_type}
                        className="text-sm text-gray-800 flex-1 truncate block min-w-0"
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                        <input type="checkbox" checked={addon.optional} onChange={e => setServiceAddons(p => p.map((a, i) => i === ai ? { ...a, optional: e.target.checked } : a))} className="rounded" />
                        Optional
                      </label>
                      <button type="button" aria-label="Close" onClick={() => setServiceAddons(p => p.filter((_, i) => i !== ai))}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Add-on Category</label>
                        <select value={addon.addon_type}
                          onChange={e => setServiceAddons(p => p.map((a, i) => i === ai ? { ...a, addon_type: e.target.value } : a))}
                          className="w-full h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                          <option value="install">Installation</option>
                          <option value="demo">Demo / Training</option>
                          <option value="warranty">Warranty</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="delivery">Delivery</option>
                          <option value="setup">Setup / Config</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Book When</label>
                        <select value={addon.booking_trigger}
                          onChange={e => setServiceAddons(p => p.map((a, i) => i === ai ? { ...a, booking_trigger: e.target.value } : a))}
                          className="w-full h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                          <option value="at_sale">At Point of Sale / POS</option>
                          <option value="after_delivery">After Delivery (online)</option>
                          <option value="on_status">On Specific Order Status</option>
                        </select>
                      </div>
                      {addon.booking_trigger === 'on_status' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Trigger Status</label>
                          <select value={addon.trigger_status || 'delivered'}
                            onChange={e => setServiceAddons(p => p.map((a, i) => i === ai ? { ...a, trigger_status: e.target.value } : a))}
                            className="w-full h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            <optgroup label="— Order Statuses —">
                              <option value="confirmed">Order Confirmed</option>
                              <option value="processing">Processing</option>
                              <option value="shipped">Shipped</option>
                              <option value="out_for_delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="installed">Installed</option>
                            </optgroup>
                            <optgroup label="— Booking Statuses —">
                              <option value="booking_confirmed">Booking Confirmed</option>
                              <option value="booking_scheduled">Booking Scheduled</option>
                              <option value="booking_in_progress">In Progress</option>
                              <option value="booking_completed">Booking Completed</option>
                              <option value="booking_no_show">No Show</option>
                              <option value="booking_rescheduled">Rescheduled</option>
                              <option value="booking_cancelled">Booking Cancelled</option>
                            </optgroup>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                      addon.booking_trigger === 'at_sale' ? 'bg-green-50 text-green-700 border border-green-200' :
                      addon.booking_trigger === 'after_delivery' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      <Clock className="w-3 h-3 shrink-0" />
                      {addon.booking_trigger === 'at_sale' && 'Booking can be scheduled immediately when sold at POS or checkout.'}
                      {addon.booking_trigger === 'after_delivery' && 'For online/source purchases — booking available only after the item is delivered.'}
                      {addon.booking_trigger === 'on_status' && `Booking opens when order reaches "${addon.trigger_status || 'delivered'}" status.`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Service BOM — materials consumed per delivery */}
        {isEdit && id && (
          <Section title="Service BOM" icon={Factory} open={activeTab === 'serviceBom'} onToggle={() => toggle('serviceBom')} sectionId="serviceBom">
            <div className="pt-2 space-y-4">
              <ServiceCostSummary serviceId={id} currency={watch('currency')} />
              <ServiceBOMEditor serviceId={id} serviceName={watch('name')} />
            </div>
          </Section>
        )}

        {/* Resources — staff, equipment, facilities */}
        {isEdit && id && (
          <Section title="Resources" icon={Users} open={activeTab === 'resources'} onToggle={() => toggle('resources')} sectionId="resources">
            <div className="pt-2">
              <ServiceResourcesEditor
                serviceId={id}
                serviceName={watch('name')}
                defaultDurationMinutes={watch('duration_minutes') ? Number(watch('duration_minutes')) : undefined}
              />
            </div>
          </Section>
        )}

        {/* 11. Print Document Templates */}
        <Section title="Print Documents" icon={Printer} open={activeTab === 'printDocs'} onToggle={() => toggle('printDocs')} sectionId="printDocs">
          <p className="text-xs text-gray-400 mb-3">
            Choose which document templates are available when printing from a booking for this service.
            {!isEdit && ' Templates will be saved once the service is created.'}
          </p>

          {/* Selected chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {printDocIds.length === 0 && (
              <span className="text-xs text-gray-400 italic">No document templates selected yet.</span>
            )}
            {printDocIds.map(docId => {
              const doc = BOOKING_DOC_TYPES.find(d => d.id === docId)
              if (!doc) return null
              return (
                <span key={docId}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${doc.bg} ${doc.border} ${doc.color}`}>
                  {doc.label}
                  <button type="button" aria-label="Close" onClick={() => removePrintDoc(docId as BookingDocTypeId)}
                    className="hover:opacity-70 transition-opacity" title="Remove">
                <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>

          {/* Add picker */}
          <div className="relative">
            {!showDocPicker ? (
              <button type="button" onClick={() => setShowDocPicker(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-primary/60 hover:text-primary hover:bg-accent transition-all font-medium">
                <Plus className="w-3.5 h-3.5" /> Add document template
              </button>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Select a template</p>
                  <button type="button" aria-label="Close" onClick={() => setShowDocPicker(false)}
                    className="p-0.5 rounded hover:bg-gray-200 transition-colors">
                <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {BOOKING_DOC_TYPES.filter(doc => !printDocIds.includes(doc.id as BookingDocTypeId)).map(doc => (
                    <button key={doc.id} type="button"
                      onClick={() => addPrintDoc(doc.id as BookingDocTypeId)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:${doc.bg} transition-colors group`}>
                      <div className={`w-7 h-7 rounded-lg ${doc.bg} border ${doc.border} flex items-center justify-center shrink-0`}>
                        <Printer className={`w-3.5 h-3.5 ${doc.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${doc.color}`}>{doc.label}</p>
                        <p className="text-xs text-gray-400">{doc.desc}</p>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary/80 transition-colors shrink-0" />
                    </button>
                  ))}
                  {BOOKING_DOC_TYPES.every(doc => printDocIds.includes(doc.id as BookingDocTypeId)) && (
                    <p className="px-3 py-4 text-xs text-gray-400 text-center">All templates added</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* 12. Statistics */}
        {isEdit && (
          <Section title="Statistics" icon={BarChart3} open={activeTab === 'stats'} onToggle={() => toggle('stats')} sectionId="stats">
            <div className="grid grid-cols-3 gap-4 text-center pt-4">
              <div className="rounded-lg border p-4">
                <p className="text-2xl font-bold">{service?.view_count ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Views</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-2xl font-bold">{service?.booking_count ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Bookings</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-2xl font-bold">v{service?.version_number ?? 1}</p>
                <p className="text-xs text-gray-500 mt-1">Version</p>
              </div>
            </div>
          </Section>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="cancel" size="sm" onClick={() => isEdit ? setViewMode(true) : navigate('/services')}>Cancel</Button>
          <Button type="submit" disabled={isSaving} size="sm">
            {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {isEdit ? 'Save Service' : 'Create Service'}
          </Button>
        </div>
      </form>
      </FormProvider>
    </FormPageWithNav>
  )
}


