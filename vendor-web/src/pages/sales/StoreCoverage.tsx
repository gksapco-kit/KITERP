import { useState, useCallback, useRef, useEffect, useMemo, type RefObject } from 'react'
import {
  MapPin, Plus, Trash2, ChevronDown, Globe, Navigation,
  Shield, CheckCircle2, XCircle, TestTube2, Loader2,
  GripVertical, Settings2, Map as MapIcon, Info, RefreshCw, ChevronRight,
  Building2, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useStores, useBranches } from '@/hooks/useVendor'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { BRANCH_LABEL } from '@/lib/businessUnitLabels'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BuilderStepSlider } from '@/components/websites/BuilderStepSlider'
import { CoverageRadiusMap } from '@/components/maps/CoverageRadiusMap'
import { COUNTRIES, POPULAR_COUNTRIES } from '@/data/countries'

// ── Static Geo Data ────────────────────────────────────────────────────────────

const STATES_BY_COUNTRY: Record<string, string[]> = {
  IN: ['Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
       'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
       'Maharashtra', 'Manipur', 'Meghalaya', 'Odisha', 'Punjab', 'Rajasthan',
       'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'],
  US: ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
       'Connecticut', 'Florida', 'Georgia', 'Hawaii', 'Illinois', 'Indiana',
       'Massachusetts', 'Michigan', 'Minnesota', 'Missouri', 'New Jersey',
       'New York', 'North Carolina', 'Ohio', 'Oregon', 'Pennsylvania',
       'Tennessee', 'Texas', 'Virginia', 'Washington'],
  GB: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  AE: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al-Quwain', 'Fujairah', 'Ras Al Khaimah'],
  CA: ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
       'Newfoundland and Labrador', 'Nova Scotia', 'Ontario',
       'Prince Edward Island', 'Quebec', 'Saskatchewan'],
  AU: ['Australian Capital Territory', 'New South Wales', 'Northern Territory',
       'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'],
  DE: ['Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen',
       'Hamburg', 'Hesse', 'Lower Saxony', 'North Rhine-Westphalia',
       'Rhineland-Palatinate', 'Saxony', 'Schleswig-Holstein', 'Thuringia'],
  SG: ['Central Region', 'East Region', 'North Region', 'North-East Region', 'West Region'],
  MY: ['Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Melaka', 'Negeri Sembilan',
       'Pahang', 'Penang', 'Perak', 'Sabah', 'Sarawak', 'Selangor'],
  JP: ['Aichi', 'Fukuoka', 'Hokkaido', 'Hyogo', 'Kanagawa', 'Osaka', 'Saitama', 'Tokyo'],
  FR: ['Île-de-France', 'Auvergne-Rhône-Alpes', 'Hauts-de-France', 'Grand Est',
       'Nouvelle-Aquitaine', 'Occitanie', 'Provence-Alpes-Côte d\'Azur', 'Bretagne'],
  SA: ['Riyadh', 'Mecca', 'Medina', 'Eastern Province', 'Asir', 'Tabuk', 'Hail', 'Al Qassim'],
  NZ: ['Auckland', 'Bay of Plenty', 'Canterbury', 'Manawatu-Whanganui', 'Northland',
       'Otago', 'Southland', 'Waikato', 'Wellington'],
  ZA: ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
       'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'],
}

const CITIES_BY_STATE: Record<string, string[]> = {
  // India
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli', 'Vellore'],
  Delhi: ['New Delhi', 'South Delhi', 'North Delhi', 'East Delhi', 'West Delhi'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
  Telangana: ['Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Prayagraj', 'Noida', 'Ghaziabad'],
  // US
  California: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Fresno'],
  'New York': ['New York City', 'Buffalo', 'Albany', 'Rochester', 'Yonkers'],
  Texas: ['Houston', 'Austin', 'Dallas', 'San Antonio', 'Fort Worth', 'El Paso'],
  Florida: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale'],
  // UK
  England: ['London', 'Birmingham', 'Manchester', 'Leeds', 'Sheffield', 'Liverpool', 'Bristol'],
  Scotland: ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee'],
  Wales: ['Cardiff', 'Swansea', 'Newport'],
  // UAE
  Dubai: ['Downtown Dubai', 'Deira', 'Bur Dubai', 'Jumeirah', 'Business Bay', 'Marina', 'DIFC'],
  'Abu Dhabi': ['Abu Dhabi City', 'Al Ain', 'Khalifa City', 'Yas Island'],
  Sharjah: ['Sharjah City', 'Khor Fakkan', 'Dibba Al Hisn'],
  // Canada
  Ontario: ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London'],
  'British Columbia': ['Vancouver', 'Victoria', 'Kelowna', 'Abbotsford', 'Burnaby'],
  Quebec: ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil'],
  // Australia
  'New South Wales': ['Sydney', 'Newcastle', 'Wollongong', 'Central Coast'],
  Victoria: ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo'],
  Queensland: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns'],
}

const POSTAL_LABEL: Record<string, string> = {
  IN: 'PIN Code', US: 'ZIP Code', GB: 'Postcode', AE: 'Area / No postal',
  CA: 'Postal Code', AU: 'Postcode', DE: 'PLZ', FR: 'Code Postal',
  JP: 'Postal Code', SG: 'Postal Code', MY: 'Postcode', SA: 'Postal Code',
  NZ: 'Postcode', ZA: 'Postal Code',
}

const REGION_LABEL: Record<string, string> = {
  IN: 'State', US: 'State', GB: 'Country (UK)', AE: 'Emirate',
  CA: 'Province / Territory', AU: 'State / Territory', DE: 'State (Bundesland)',
  FR: 'Region', JP: 'Prefecture', SG: 'Region', MY: 'State',
  SA: 'Province', NZ: 'Region', ZA: 'Province',
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ConditionType = 'country' | 'region' | 'city' | 'postal' | 'area' | 'radius'
type RuleAction = 'include' | 'exclude'
type RangeMode = 'values' | 'range'
type AppliesTo = 'orders' | 'delivery' | 'pickup' | 'quotes' | 'catalog'
type CoverageMode = 'everywhere' | 'restricted'

const MAX_RADIUS_KM = 21900

interface CoverageRule {
  id: string
  action: RuleAction
  condition_type: ConditionType
  country: string
  regions: string[]
  cities: string[]
  range_mode: RangeMode
  postal_values: string[]
  postal_from: string
  postal_to: string
  area_values: string[]
  radius_km: number
  lat: string
  lng: string
  applies_to: AppliesTo[]
  is_active: boolean
  notes: string
}

interface TestResult {
  covered: boolean
  matched_rule_id: string | null
  reason: string
}

function newRule(): CoverageRule {
  return {
    id: crypto.randomUUID(),
    action: 'include',
    condition_type: 'country',
    country: '',
    regions: [],
    cities: [],
    range_mode: 'values',
    postal_values: [],
    postal_from: '',
    postal_to: '',
    area_values: [],
    radius_km: 10,
    lat: '',
    lng: '',
    applies_to: ['orders', 'delivery'],
    is_active: true,
    notes: '',
  }
}

const ALL_APPLIES: { key: AppliesTo; label: string }[] = [
  { key: 'orders', label: 'Orders' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'catalog', label: 'Catalog browse' },
]

const CONDITION_TYPES: { value: ConditionType; label: string }[] = [
  { value: 'country', label: 'Country only' },
  { value: 'region', label: 'State / Region' },
  { value: 'city', label: 'City' },
  { value: 'postal', label: 'Postal / ZIP / PIN Code' },
  { value: 'area', label: 'Area / Locality' },
  { value: 'radius', label: 'Radius from point' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function sortedCountries() {
  const popular = POPULAR_COUNTRIES
    .map(iso => COUNTRIES.find(c => c.iso === iso))
    .filter(Boolean) as typeof COUNTRIES
  const rest = COUNTRIES.filter(c => !POPULAR_COUNTRIES.includes(c.iso))
  return { popular, rest }
}

function postalLabel(countryIso: string) {
  return POSTAL_LABEL[countryIso] ?? 'Postal Code'
}

function regionLabel(countryIso: string) {
  return REGION_LABEL[countryIso] ?? 'State / Region'
}

function getStatesForCountry(iso: string): string[] {
  return STATES_BY_COUNTRY[iso] ?? []
}

function getCitiesForState(state: string): string[] {
  return CITIES_BY_STATE[state] ?? []
}

// ── Reusable dropdown ──────────────────────────────────────────────────────────

function Dropdown({
  value, onChange, placeholder, options, disabled = false, className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { value: string; label: string }[]
  disabled?: boolean
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ── Multi-select chips ─────────────────────────────────────────────────────────

function ChipSelect({
  values, options, onChange, placeholder, disabled = false,
}: {
  values: string[]
  options: string[]
  onChange: (v: string[]) => void
  placeholder: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEscapeToClose(close, open)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      close()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, close])

  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v])
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'flex min-h-[2.25rem] w-full flex-wrap gap-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-left',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        {values.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          values.map(v => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {v}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); toggle(v) }}
                className="ml-0.5 hover:text-destructive"
              >×</button>
            </span>
          ))
        )}
        <ChevronDown className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && options.length > 0 && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
        >
          {options.map(o => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={values.includes(o)}
                onChange={() => toggle(o)}
                className="h-3.5 w-3.5 rounded"
              />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Postal tag input ───────────────────────────────────────────────────────────

function PostalTagInput({
  values, onChange, placeholder,
}: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus-within:ring-1 focus-within:ring-ring">
      {values.map(v => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {v}
          <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-destructive">×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() } }}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : 'Add more…'}
        className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

// ── Rule summary label ─────────────────────────────────────────────────────────

function ruleSummary(rule: CoverageRule): string {
  const country = rule.country
    ? (COUNTRIES.find(c => c.iso === rule.country)?.name ?? rule.country)
    : 'All countries'
  const parts: string[] = [country]
  if (rule.regions.length) parts.push(rule.regions.join(', '))
  if (rule.cities.length) parts.push(rule.cities.join(', '))
  if (rule.condition_type === 'postal') {
    if (rule.range_mode === 'range' && (rule.postal_from || rule.postal_to))
      parts.push(`${rule.postal_from} → ${rule.postal_to}`)
    else if (rule.postal_values.length)
      parts.push(rule.postal_values.slice(0, 3).join(', ') + (rule.postal_values.length > 3 ? ` +${rule.postal_values.length - 3}` : ''))
  }
  if (rule.condition_type === 'area' && rule.area_values.length)
    parts.push(rule.area_values.slice(0, 3).join(', '))
  if (rule.condition_type === 'radius' && rule.lat && rule.lng)
    parts.push(`${rule.radius_km} km radius`)
  return parts.join(' › ')
}

// ── Single Rule Row (collapsed summary + expandable editor) ───────────────────

function RuleRow({
  rule, onUpdate, onDelete, index,
}: {
  rule: CoverageRule
  onUpdate: (updates: Partial<CoverageRule>) => void
  onDelete: () => void
  index: number
}) {
  const [expanded, setExpanded] = useState(false)

  const states = getStatesForCountry(rule.country)
  const cities = rule.regions.length > 0
    ? rule.regions.flatMap(r => getCitiesForState(r))
    : getCitiesForState(rule.regions[0] ?? '')

  const { popular, rest } = sortedCountries()
  const showRegion = ['region', 'city', 'postal', 'area'].includes(rule.condition_type)
  const showCity = ['city', 'postal', 'area'].includes(rule.condition_type)
  const showPostal = rule.condition_type === 'postal'
  const showArea = rule.condition_type === 'area'
  const showRadius = rule.condition_type === 'radius'

  const condLabel = CONDITION_TYPES.find(t => t.value === rule.condition_type)?.label ?? rule.condition_type

  return (
    <div className={cn(
      'rounded-lg border bg-card transition-all',
      expanded ? 'border-primary/40 shadow-sm' : 'border-border hover:border-border/80',
      !rule.is_active && 'opacity-55',
    )}>
      {/* ── Collapsed summary row (always visible, click to expand) ── */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30 cursor-grab" onClick={e => e.stopPropagation()} />

        <span className="w-6 text-center text-[11px] font-mono text-muted-foreground shrink-0">#{index + 1}</span>

        {/* Action badge */}
        <span className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none',
          rule.action === 'include'
            ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
        )}>
          {rule.action === 'include' ? '✓ Include' : '✕ Exclude'}
        </span>

        {/* Condition type pill */}
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {condLabel}
        </span>

        {/* Summary */}
        <span className="flex-1 min-w-0 truncate text-sm text-foreground">
          {ruleSummary(rule)}
        </span>

        {/* Applies-to mini chips */}
        <div className="hidden sm:flex gap-1 shrink-0">
          {rule.applies_to.slice(0, 3).map(a => (
            <span key={a} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">{a}</span>
          ))}
          {rule.applies_to.length > 3 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">+{rule.applies_to.length - 3}</span>
          )}
        </div>

        {/* Active toggle — stop propagation so toggle doesn't expand/collapse */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <Switch checked={rule.is_active} onCheckedChange={v => onUpdate({ is_active: v })} />
          <span className="text-xs text-muted-foreground w-8">{rule.is_active ? 'On' : 'Off'}</span>
        </div>

        {/* Delete — stop propagation */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
      </div>

      {/* ── Expanded editor (visible when row is open) ── */}
      {expanded && (
        <div className="border-t border-border/60 px-3 pb-3 pt-3 space-y-3 bg-muted/20 rounded-b-lg">
          {/* Row 1: Type → Country → Region → City */}
          <div className="flex flex-wrap gap-2 items-end">
            {/* Action toggle */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Action</span>
              <div className="flex gap-1 h-9 items-center">
                {(['include', 'exclude'] as RuleAction[]).map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => onUpdate({ action: a })}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                      rule.action === a && a === 'include' && 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
                      rule.action === a && a === 'exclude' && 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
                      rule.action !== a && 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {a === 'include' ? '✓ Include' : '✕ Exclude'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 min-w-[160px]">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Condition type</span>
              <Dropdown
                value={rule.condition_type}
                onChange={v => onUpdate({ condition_type: v as ConditionType, country: '', regions: [], cities: [], postal_values: [], area_values: [] })}
                placeholder="Select type"
                options={CONDITION_TYPES}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-1 min-w-[180px]">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Country</span>
              <select
                value={rule.country}
                onChange={e => onUpdate({ country: e.target.value, regions: [], cities: [], postal_values: [], area_values: [] })}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— All countries —</option>
                <optgroup label="Popular">
                  {popular.map(c => <option key={c.iso} value={c.iso}>{c.flag} {c.name}</option>)}
                </optgroup>
                <optgroup label="All countries">
                  {rest.map(c => <option key={c.iso} value={c.iso}>{c.flag} {c.name}</option>)}
                </optgroup>
              </select>
            </div>

            {showRegion && (
              <div className="flex flex-col gap-1 min-w-[200px]">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {rule.country ? regionLabel(rule.country) : 'State / Region'}
                </span>
                {states.length > 0 ? (
                  <ChipSelect
                    values={rule.regions}
                    options={states}
                    onChange={v => onUpdate({ regions: v, cities: [] })}
                    placeholder={`Select ${rule.country ? regionLabel(rule.country).toLowerCase() : 'region'}…`}
                    disabled={!rule.country}
                  />
                ) : (
                  <Input
                    value={rule.regions[0] ?? ''}
                    onChange={e => onUpdate({ regions: e.target.value ? [e.target.value] : [] })}
                    placeholder="Enter region name"
                    disabled={!rule.country}
                    className="h-9"
                  />
                )}
              </div>
            )}

            {showCity && (
              <div className="flex flex-col gap-1 min-w-[200px]">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">City</span>
                {cities.length > 0 ? (
                  <ChipSelect
                    values={rule.cities}
                    options={cities}
                    onChange={v => onUpdate({ cities: v })}
                    placeholder="Select cities…"
                    disabled={rule.regions.length === 0}
                  />
                ) : (
                  <Input
                    value={rule.cities[0] ?? ''}
                    onChange={e => onUpdate({ cities: e.target.value ? [e.target.value] : [] })}
                    placeholder="Enter city"
                    className="h-9"
                  />
                )}
              </div>
            )}
          </div>

          {/* Postal */}
          {showPostal && (
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground min-w-max">
                  {rule.country ? postalLabel(rule.country) : 'Postal code'} mode
                </span>
                {(['values', 'range'] as RangeMode[]).map(m => (
                  <button key={m} type="button" onClick={() => onUpdate({ range_mode: m })}
                    className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                      rule.range_mode === m ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
                  >
                    {m === 'values' ? '● Values / List' : '↔ From – To Range'}
                  </button>
                ))}
              </div>
              {rule.range_mode === 'values' ? (
                <div>
                  <PostalTagInput
                    values={rule.postal_values}
                    onChange={v => onUpdate({ postal_values: v })}
                    placeholder={`Type ${rule.country ? postalLabel(rule.country).toLowerCase() : 'code'} and press Enter…`}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Press <kbd className="rounded border bg-muted px-1 text-[10px]">Enter</kbd> or <kbd className="rounded border bg-muted px-1 text-[10px]">,</kbd> after each code</p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground">From</span>
                    <Input value={rule.postal_from} onChange={e => onUpdate({ postal_from: e.target.value })} placeholder="e.g. 400001" className="h-9 w-32" />
                  </div>
                  <span className="mt-4 text-muted-foreground">→</span>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground">To</span>
                    <Input value={rule.postal_to} onChange={e => onUpdate({ postal_to: e.target.value })} placeholder="e.g. 400099" className="h-9 w-32" />
                  </div>
                  <p className="mt-4 text-[11px] text-muted-foreground self-end">All codes between from–to (inclusive)</p>
                </div>
              )}
            </div>
          )}

          {/* Area */}
          {showArea && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Areas / Localities</span>
              <PostalTagInput
                values={rule.area_values}
                onChange={v => onUpdate({ area_values: v })}
                placeholder="Type area name and press Enter (e.g. Andheri East)…"
              />
            </div>
          )}

          {/* Radius */}
          {showRadius && (
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Center Latitude</span>
                <Input value={rule.lat} onChange={e => onUpdate({ lat: e.target.value })} placeholder="e.g. 19.0760" className="h-9 w-36" type="number" step="0.0001" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Center Longitude</span>
                <Input value={rule.lng} onChange={e => onUpdate({ lng: e.target.value })} placeholder="e.g. 72.8777" className="h-9 w-36" type="number" step="0.0001" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Radius (km)</span>
                <div className="flex items-center gap-2">
                  <Input value={rule.radius_km} onChange={e => onUpdate({ radius_km: Math.min(MAX_RADIUS_KM, Math.max(1, Number(e.target.value) || 1)) })} type="number" min={1} max={MAX_RADIUS_KM} className="h-9 w-24" />
                  <span className="text-sm text-muted-foreground">km</span>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => navigator.geolocation?.getCurrentPosition(pos =>
                  onUpdate({ lat: String(pos.coords.latitude.toFixed(5)), lng: String(pos.coords.longitude.toFixed(5)) })
                )}
                className="h-9 gap-1.5 text-xs"
              >
                <Navigation className="h-3.5 w-3.5" /> Use my location
              </Button>
            </div>
          )}

          {/* Applies-to + note */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">Applies to</span>
            <div className="flex flex-wrap gap-2">
              {ALL_APPLIES.map(({ key, label }) => {
                const checked = rule.applies_to.includes(key)
                return (
                  <label key={key} className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={checked} className="h-3.5 w-3.5 rounded"
                      onChange={() => onUpdate({
                        applies_to: checked ? rule.applies_to.filter(x => x !== key) : [...rule.applies_to, key],
                      })}
                    />
                    <span className={cn(checked ? 'text-foreground font-medium' : 'text-muted-foreground')}>{label}</span>
                  </label>
                )
              })}
            </div>
            <Input
              value={rule.notes}
              onChange={e => onUpdate({ notes: e.target.value })}
              placeholder="Optional note…"
              className="ml-auto h-7 max-w-[200px] text-xs"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Map Picker Tab ─────────────────────────────────────────────────────────────

function MapPicker({
  mapLat, mapLng, mapRadius,
  onMapLatChange, onMapLngChange, onMapRadiusChange,
  onAddAsRule,
}: {
  mapLat: string
  mapLng: string
  mapRadius: number
  onMapLatChange: (v: string) => void
  onMapLngChange: (v: string) => void
  onMapRadiusChange: (v: number) => void
  onAddAsRule: () => void
}) {
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const lat = parseFloat(mapLat) || 20.5937
  const lng = parseFloat(mapLng) || 78.9629
  const hasPin = Boolean(mapLat && mapLng)

  const useMyLocation = () => {
    setLocError(null)
    if (!navigator.geolocation) { setLocError('Geolocation not supported'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        onMapLatChange(pos.coords.latitude.toFixed(5))
        onMapLngChange(pos.coords.longitude.toFixed(5))
        setLocating(false)
      },
      err => { setLocError(err.message); setLocating(false) },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  return (
    <div className="space-y-4">
      <CoverageRadiusMap
        lat={lat}
        lng={lng}
        radiusKm={mapRadius}
        hasPin={hasPin}
        onMapClick={(clickLat, clickLng) => {
          onMapLatChange(clickLat.toFixed(5))
          onMapLngChange(clickLng.toFixed(5))
        }}
      />

      <div className="rounded-xl border border-green-200 bg-green-50/50 dark:bg-green-500/5 p-3 flex gap-2 text-xs text-green-800 dark:text-green-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Click the map to place the pin. The <strong>green shaded circle</strong> shows your coverage area —
          it grows and shrinks as you change the radius below.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Latitude</Label>
          <Input
            value={mapLat}
            onChange={e => onMapLatChange(e.target.value)}
            placeholder="e.g. 19.0760"
            type="number" step="0.0001"
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Longitude</Label>
          <Input
            value={mapLng}
            onChange={e => onMapLngChange(e.target.value)}
            placeholder="e.g. 72.8777"
            type="number" step="0.0001"
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
          <Label className="text-xs">Radius (km) — {mapRadius.toLocaleString()} km</Label>
          <BuilderStepSlider
            value={Math.min(mapRadius, MAX_RADIUS_KM)}
            min={1}
            max={MAX_RADIUS_KM}
            step={1}
            onChange={v => onMapRadiusChange(Math.min(MAX_RADIUS_KM, Math.max(1, v)))}
            buttonSize="md"
            sliderClassName="h-2"
            showValue={false}
            aria-label="Coverage radius in kilometers"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={useMyLocation}
            disabled={locating}
            className="gap-1.5"
          >
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
            Use my location
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onAddAsRule}
            disabled={!mapLat || !mapLng}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add as coverage rule
          </Button>
        </div>
      </div>
      {locError && <p className="text-xs text-destructive">{locError}</p>}
      {mapLat && mapLng && (
        <p className="text-xs text-muted-foreground">
          Pin: {parseFloat(mapLat).toFixed(5)}, {parseFloat(mapLng).toFixed(5)} — radius {mapRadius} km
          {' · '}
          <a
            href={`https://www.openstreetmap.org/?mlat=${mapLat}&mlon=${mapLng}#map=13/${mapLat}/${mapLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open in OSM
          </a>
        </p>
      )}
    </div>
  )
}

// ── Test Address Tab ───────────────────────────────────────────────────────────

function TestAddress({ rules }: { rules: CoverageRule[] }) {
  const [testCountry, setTestCountry] = useState('')
  const [testRegion, setTestRegion] = useState('')
  const [testCity, setTestCity] = useState('')
  const [testPostal, setTestPostal] = useState('')
  const [testLat, setTestLat] = useState('')
  const [testLng, setTestLng] = useState('')
  const [result, setResult] = useState<TestResult | null>(null)
  const [locating, setLocating] = useState(false)

  const runTest = () => {
    if (!testCountry && !testPostal && !testRegion && !testCity && !testLat) {
      setResult({ covered: false, matched_rule_id: null, reason: 'Please enter at least one field to test.' })
      return
    }
    const activeRules = rules.filter(r => r.is_active)
    let matched: CoverageRule | null = null

    for (const rule of activeRules) {
      const ct = rule.condition_type
      const countryOk = !rule.country || rule.country === testCountry
      if (!countryOk) continue

      if (ct === 'country') { matched = rule; break }

      const regionOk = rule.regions.length === 0 || rule.regions.includes(testRegion)
      if (!regionOk) continue

      if (ct === 'region') { matched = rule; break }

      const cityOk = rule.cities.length === 0 || rule.cities.includes(testCity)
      if (!cityOk) continue

      if (ct === 'city') { matched = rule; break }

      if (ct === 'postal') {
        if (rule.range_mode === 'values') {
          if (rule.postal_values.length === 0 || rule.postal_values.includes(testPostal)) { matched = rule; break }
        } else {
          const from = rule.postal_from
          const to = rule.postal_to
          if ((!from && !to) || (testPostal >= from && testPostal <= to)) { matched = rule; break }
        }
      }

      if (ct === 'area') {
        if (rule.area_values.length === 0 || rule.area_values.some(a => testCity.toLowerCase().includes(a.toLowerCase()))) {
          matched = rule; break
        }
      }

      if (ct === 'radius' && testLat && testLng && rule.lat && rule.lng) {
        const R = 6371
        const dLat = (parseFloat(testLat) - parseFloat(rule.lat)) * Math.PI / 180
        const dLng = (parseFloat(testLng) - parseFloat(rule.lng)) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(parseFloat(rule.lat) * Math.PI / 180) * Math.cos(parseFloat(testLat) * Math.PI / 180) * Math.sin(dLng / 2) ** 2
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        if (dist <= rule.radius_km) { matched = rule; break }
      }
    }

    if (!matched) {
      setResult({ covered: false, matched_rule_id: null, reason: 'No active rule matches this address.' })
      return
    }
    const isExclude = matched.action === 'exclude'
    setResult({
      covered: !isExclude,
      matched_rule_id: matched.id,
      reason: isExclude
        ? `Excluded by rule #${rules.indexOf(matched) + 1} (${matched.condition_type})`
        : `Covered by rule #${rules.indexOf(matched) + 1} (${matched.condition_type})`,
    })
  }

  const { popular, rest } = sortedCountries()
  const states = getStatesForCountry(testCountry)
  const cities = getCitiesForState(testRegion)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Enter a customer address to check which coverage rule matches and whether the address is in or out of coverage.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Country</Label>
          <select
            value={testCountry}
            onChange={e => { setTestCountry(e.target.value); setTestRegion(''); setTestCity('') }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— Select country —</option>
            <optgroup label="Popular">
              {popular.map(c => <option key={c.iso} value={c.iso}>{c.flag} {c.name}</option>)}
            </optgroup>
            <optgroup label="All">
              {rest.map(c => <option key={c.iso} value={c.iso}>{c.flag} {c.name}</option>)}
            </optgroup>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">{testCountry ? regionLabel(testCountry) : 'State / Region'}</Label>
          {states.length > 0 ? (
            <select
              value={testRegion}
              onChange={e => { setTestRegion(e.target.value); setTestCity('') }}
              disabled={!testCountry}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Select —</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <Input value={testRegion} onChange={e => setTestRegion(e.target.value)} placeholder="Enter region" className="h-9" />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">City</Label>
          {cities.length > 0 ? (
            <select
              value={testCity}
              onChange={e => setTestCity(e.target.value)}
              disabled={!testRegion}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Select —</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <Input value={testCity} onChange={e => setTestCity(e.target.value)} placeholder="Enter city" className="h-9" />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">{testCountry ? postalLabel(testCountry) : 'Postal / ZIP Code'}</Label>
          <Input value={testPostal} onChange={e => setTestPostal(e.target.value)} placeholder="e.g. 400001" className="h-9" />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Latitude (optional)</Label>
          <Input value={testLat} onChange={e => setTestLat(e.target.value)} placeholder="e.g. 19.0760" type="number" step="0.0001" className="h-9" />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Longitude (optional)</Label>
          <div className="flex gap-2">
            <Input value={testLng} onChange={e => setTestLng(e.target.value)} placeholder="e.g. 72.8777" type="number" step="0.0001" className="h-9 flex-1" />
            <Button
              type="button" variant="outline" size="sm"
              className="h-9 px-2"
              onClick={() => {
                setLocating(true)
                navigator.geolocation?.getCurrentPosition(pos => {
                  setTestLat(pos.coords.latitude.toFixed(5))
                  setTestLng(pos.coords.longitude.toFixed(5))
                  setLocating(false)
                }, () => setLocating(false))
              }}
            >
              {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      <Button onClick={runTest} className="gap-2">
        <TestTube2 className="h-4 w-4" /> Run coverage test
      </Button>

      {result && (
        <div className={cn(
          'rounded-xl border p-4 flex items-start gap-3',
          result.covered ? 'border-green-200 bg-green-50 dark:bg-green-500/5' : 'border-red-200 bg-red-50 dark:bg-red-500/5',
        )}>
          {result.covered
            ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
            : <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />}
          <div>
            <p className={cn('font-semibold text-sm', result.covered ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}>
              {result.covered ? 'Address is within coverage' : 'Address is out of coverage'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{result.reason}</p>
          </div>
        </div>
      )}

      {rules.filter(r => r.is_active).length === 0 && (
        <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
          No active rules configured. Add rules in the <strong>Rules</strong> tab first.
        </div>
      )}
    </div>
  )
}

// ── Per-store config state ────────────────────────────────────────────────────

interface StoreConfig {
  coverageMode: CoverageMode
  rules: CoverageRule[]
  activeTab: string
  mapLat: string
  mapLng: string
  mapRadius: number
  expanded: boolean
}

function defaultStoreConfig(): StoreConfig {
  return { coverageMode: 'everywhere', rules: [], activeTab: 'rules', mapLat: '', mapLng: '', mapRadius: 15, expanded: false }
}

// ── Coverage mode options ─────────────────────────────────────────────────────

const COVERAGE_MODE_OPTIONS: {
  value: CoverageMode
  label: string
  hint: string
  icon: React.ReactNode
  activeClass: string
  dotClass: string
}[] = [
  {
    value: 'everywhere',
    label: 'Serve everywhere',
    hint: 'No geographic restrictions applied',
    icon: <Globe className="h-4 w-4" />,
    activeClass: 'border-green-300 bg-green-50 dark:bg-green-500/10',
    dotClass: 'bg-green-500',
  },
  {
    value: 'restricted',
    label: 'Restricted',
    hint: 'Only zones matching rules below are served',
    icon: <Shield className="h-4 w-4" />,
    activeClass: 'border-amber-300 bg-amber-50 dark:bg-amber-500/10',
    dotClass: 'bg-amber-500',
  },
]

function CoverageModeSelect({
  value,
  onChange,
}: {
  value: CoverageMode
  onChange: (v: CoverageMode) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useEscapeToClose(close, open)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, close])

  const selected = COVERAGE_MODE_OPTIONS.find(o => o.value === value)!

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          selected.activeClass,
        )}
      >
        <span className={cn('h-2 w-2 rounded-full shrink-0', selected.dotClass)} />
        <span className="text-foreground">{selected.label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform ml-1', open && 'rotate-180')} />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {COVERAGE_MODE_OPTIONS.map(opt => {
            const isActive = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); close() }}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                  isActive && 'bg-muted/40',
                )}
              >
                {/* Icon circle */}
                <span className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                  isActive ? opt.activeClass : 'border-border bg-muted/30 text-muted-foreground',
                )}>
                  {opt.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium text-sm text-foreground">{opt.label}</span>
                    {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{opt.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Per-store accordion panel ─────────────────────────────────────────────────

function StoreCoveragePanel({
  store,
  config,
  onUpdate,
  businessUnitLabel,
  onRemove,
  panelRef,
}: {
  store: { id: string; name: string; code?: string | null }
  config: StoreConfig
  onUpdate: (patch: Partial<StoreConfig>) => void
  /** Parent BU label when this panel is branch-scoped. */
  businessUnitLabel?: string
  onRemove?: () => void
  panelRef?: RefObject<HTMLDivElement | null>
}) {
  const { coverageMode, rules, activeTab, mapLat, mapLng, mapRadius, expanded } = config
  const ruleCount = rules.filter(r => r.is_active).length

  const addRule = () => onUpdate({ rules: [...rules, newRule()], activeTab: 'rules' })

  const updateRule = (id: string, updates: Partial<CoverageRule>) =>
    onUpdate({ rules: rules.map(r => r.id === id ? { ...r, ...updates } : r) })

  const deleteRule = (id: string) =>
    onUpdate({ rules: rules.filter(r => r.id !== id) })

  const addMapAsRule = () => {
    const rule = newRule()
    rule.condition_type = 'radius'
    rule.lat = mapLat
    rule.lng = mapLng
    rule.radius_km = mapRadius
    onUpdate({ rules: [...rules, rule], activeTab: 'rules' })
  }

  return (
    <div
      ref={panelRef}
      className={cn('rounded-xl border bg-card shadow-sm transition-all', expanded ? 'border-primary/30' : 'border-border')}
    >
      {/* Store header — BU info + coverage mode */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/30 transition-colors">
        <button
          type="button"
          onClick={() => onUpdate({ expanded: !expanded })}
          className="flex flex-1 items-center gap-3 min-w-0 text-left"
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {store.code && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">{store.code}</span>
              )}
              <span className="font-semibold text-sm text-foreground truncate">{store.name}</span>
            </div>
            {businessUnitLabel ? (
              <span className="text-[11px] text-muted-foreground truncate">Business unit: {businessUnitLabel}</span>
            ) : null}
          </div>
        </button>

        <div
          className="shrink-0"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <CoverageModeSelect
            value={coverageMode}
            onChange={v => onUpdate({ coverageMode: v })}
          />
        </div>

        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove coverage profile"
            title="Remove coverage profile"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onUpdate({ expanded: !expanded })}
          className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={expanded ? 'Collapse store coverage' : 'Expand store coverage'}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {coverageMode === 'restricted' ? (
            <Tabs value={activeTab} onValueChange={t => onUpdate({ activeTab: t })}>
              {/* Toolbar: tab strip + actions */}
              <div className="flex flex-wrap items-center gap-2">
                <TabsList className="h-8">
                  <TabsTrigger value="rules" className="gap-1.5 text-xs h-7">
                    <Settings2 className="h-3.5 w-3.5" /> Rules
                    {ruleCount > 0 && (
                      <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">{ruleCount}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="map" className="gap-1.5 text-xs h-7">
                    <MapIcon className="h-3.5 w-3.5" /> Map Picker
                  </TabsTrigger>
                  <TabsTrigger value="test" className="gap-1.5 text-xs h-7">
                    <TestTube2 className="h-3.5 w-3.5" /> Test Address
                  </TabsTrigger>
                </TabsList>
                <div className="ml-auto flex items-center gap-2">
                  {activeTab === 'rules' && (
                    <Button size="sm" onClick={addRule} variant="outline" className="gap-1.5 h-8 text-xs">
                      <Plus className="h-3.5 w-3.5" /> Add rule
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                    <RefreshCw className="h-3 w-3" /> Save
                  </Button>
                </div>
              </div>

              {/* Rules tab */}
              <TabsContent value="rules" className="space-y-3 mt-3">
                {rules.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
                    <Shield className="mx-auto h-7 w-7 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No rules yet — click <strong>Add rule</strong> to define coverage zones.</p>
                    <Button size="sm" onClick={addRule} variant="outline" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Add first rule
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      Top-to-bottom priority. <strong>Exclude</strong> overrides <strong>Include</strong>.
                    </div>
                    {rules.map((rule, i) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        index={i}
                        onUpdate={updates => updateRule(rule.id, updates)}
                        onDelete={() => deleteRule(rule.id)}
                      />
                    ))}
                    <Button size="sm" onClick={addRule} variant="outline" className="w-full gap-1.5 border-dashed">
                      <Plus className="h-3.5 w-3.5" /> Add another rule
                    </Button>
                  </>
                )}
              </TabsContent>

              {/* Map tab */}
              <TabsContent value="map" className="mt-3">
                <MapPicker
                  mapLat={mapLat}
                  mapLng={mapLng}
                  mapRadius={mapRadius}
                  onMapLatChange={v => onUpdate({ mapLat: v })}
                  onMapLngChange={v => onUpdate({ mapLng: v })}
                  onMapRadiusChange={v => onUpdate({ mapRadius: v })}
                  onAddAsRule={addMapAsRule}
                />
              </TabsContent>

              {/* Test tab */}
              <TabsContent value="test" className="mt-3">
                <TestAddress rules={rules} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                  <RefreshCw className="h-3 w-3" /> Save
                </Button>
              </div>
              {coverageMode === 'everywhere' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-green-500" />
                  This store serves all customer locations. Switch to <strong>Restricted</strong> to add zone rules.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

interface CoverageScope {
  id: string
  buId: string
  branchId: string
  storeId: string
}

const modalNativeSelectClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

function scopeDedupeKey(buId: string, branchId: string) {
  return `${buId}::${branchId || 'bu'}`
}

function formatBuLabel(store: { code?: string | null; name: string }) {
  return store.code ? `${store.code} · ${store.name}` : store.name
}

function comboLabel(
  buId: string,
  branchId: string,
  buStores: Array<{ id: string; name: string; code?: string | null }>,
  storeById: Map<string, { id: string; name: string; code?: string | null; parent_id?: string | null }>,
) {
  const bu = buStores.find((s) => s.id === buId) ?? storeById.get(buId)
  if (!branchId) return bu ? `${formatBuLabel(bu)} (all branches)` : 'Business unit'
  const branch = storeById.get(branchId)
  if (!branch) return 'Branch'
  const branchName = branch.code ? `${branch.code} — ${branch.name}` : branch.name
  return bu ? `${formatBuLabel(bu)} → ${branchName}` : branchName
}

export default function StoreCoveragePage() {
  const { data: storesData, isLoading: storesLoading } = useStores()
  const { data: allStoresData } = useStores({ include_branches: true })
  const buStores = useMemo(
    () =>
      (storesData?.stores ?? []).filter(
        (s) => s.is_active && s.unit_type !== 'branch',
      ),
    [storesData],
  )

  const storeById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code?: string | null; parent_id?: string | null }>()
    for (const s of allStoresData?.stores ?? []) {
      map.set(s.id, s)
    }
    return map
  }, [allStoresData])

  // Coverage profiles on this page
  const [coverageScopes, setCoverageScopes] = useState<CoverageScope[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createBuId, setCreateBuId] = useState('')
  const [createBranchId, setCreateBranchId] = useState('')
  const lastPanelRef = useRef<HTMLDivElement | null>(null)

  const { data: createBranchesData, isLoading: createBranchesLoading } = useBranches(
    createModalOpen && createBuId ? createBuId : null,
  )
  const createBranches = useMemo(
    () => (createBranchesData?.branches ?? []).filter((b) => b.is_active),
    [createBranchesData],
  )

  const existingScopeKeys = useMemo(
    () => new Set(coverageScopes.map((s) => scopeDedupeKey(s.buId, s.branchId))),
    [coverageScopes],
  )

  const availableCombos = useMemo(() => {
    const list: Array<{ buId: string; branchId: string }> = []
    for (const bu of buStores) {
      list.push({ buId: bu.id, branchId: '' })
      for (const s of allStoresData?.stores ?? []) {
        if (s.parent_id === bu.id && s.is_active !== false) {
          list.push({ buId: bu.id, branchId: s.id })
        }
      }
    }
    return list.filter((c) => !existingScopeKeys.has(scopeDedupeKey(c.buId, c.branchId)))
  }, [buStores, allStoresData, existingScopeKeys])

  const createComboTaken = createBuId
    ? existingScopeKeys.has(scopeDedupeKey(createBuId, createBranchId))
    : false

  const canCreateCoverage =
    Boolean(createBuId) &&
    !createComboTaken &&
    !(createBranchesLoading && createBranchId)

  // Per-store config keyed by store id
  const [configs, setConfigs] = useState<Record<string, StoreConfig>>({})

  const getConfig = useCallback((id: string): StoreConfig =>
    configs[id] ?? defaultStoreConfig(), [configs])

  const patchConfig = useCallback((id: string, patch: Partial<StoreConfig>) => {
    setConfigs(prev => ({ ...prev, [id]: { ...(prev[id] ?? defaultStoreConfig()), ...patch } }))
  }, [])

  const totalActiveRules = Object.values(configs).reduce(
    (sum, c) => sum + (c.coverageMode === 'restricted' ? c.rules.filter(r => r.is_active).length : 0), 0,
  )

  const openCreateModal = useCallback(() => {
    if (availableCombos.length === 0) {
      toast.info('Every business unit and branch already has a coverage profile.')
      return
    }
    const next = availableCombos[0]
    setCreateBuId(next.buId)
    setCreateBranchId(next.branchId)
    setCreateModalOpen(true)
  }, [availableCombos])

  useEscapeToClose(() => setCreateModalOpen(false), createModalOpen)

  const handleCreateBuChange = (id: string) => {
    setCreateBuId(id)
    setCreateBranchId('')
  }

  const addCoverageScope = useCallback((buId: string, branchId: string) => {
    const storeId = branchId || buId
    const dedupeKey = scopeDedupeKey(buId, branchId)
    if (coverageScopes.some((s) => scopeDedupeKey(s.buId, s.branchId) === dedupeKey)) {
      toast.error('This business unit / branch already has a coverage profile.')
      return false
    }

    const scope: CoverageScope = {
      id: crypto.randomUUID(),
      buId,
      branchId,
      storeId,
    }
    setCoverageScopes(prev => [...prev, scope])
    setConfigs(prev => ({
      ...prev,
      [storeId]: { ...(prev[storeId] ?? defaultStoreConfig()), expanded: true },
    }))
    toast.success('Coverage profile created.')
    window.setTimeout(() => {
      lastPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return true
  }, [coverageScopes])

  const confirmCreateCoverage = () => {
    if (!canCreateCoverage || !createBuId) return
    if (addCoverageScope(createBuId, createBranchId)) {
      setCreateModalOpen(false)
      setCreateBuId('')
      setCreateBranchId('')
    }
  }

  const removeCoverageScope = useCallback((scopeId: string) => {
    setCoverageScopes(prev => prev.filter(s => s.id !== scopeId))
  }, [])

  const resolveScopePanel = useCallback((scope: CoverageScope) => {
    const store = storeById.get(scope.storeId)
    const bu = storeById.get(scope.buId) ?? buStores.find(s => s.id === scope.buId)
    if (!store) {
      const fallback = buStores.find(s => s.id === scope.storeId)
        ?? (allStoresData?.stores ?? []).find(s => s.id === scope.storeId)
      if (!fallback) return null
      return {
        store: { id: fallback.id, name: fallback.name, code: fallback.code },
        businessUnitLabel: scope.branchId && bu ? formatBuLabel(bu) : undefined,
      }
    }
    return {
      store: { id: store.id, name: store.name, code: store.code },
      businessUnitLabel: scope.branchId && bu ? formatBuLabel(bu) : undefined,
    }
  }, [storeById, buStores, allStoresData])

  const scopedPanels = useMemo(
    () =>
      coverageScopes
        .map((scope) => ({ scope, panel: resolveScopePanel(scope) }))
        .filter((row): row is { scope: CoverageScope; panel: NonNullable<ReturnType<typeof resolveScopePanel>> } => row.panel != null),
    [coverageScopes, resolveScopePanel],
  )

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-16">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-xl font-bold text-foreground">Store Coverage</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Define service zones per business unit or branch — each location has its own coverage mode and rules.
          </p>
        </div>

        {/* BU + Branch selectors */}
        {!storesLoading && buStores.length > 0 && (
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {totalActiveRules > 0 && (
              <Badge variant="warning" className="gap-1">
                {totalActiveRules} rule{totalActiveRules !== 1 ? 's' : ''} total
              </Badge>
            )}
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0 gap-1.5"
              disabled={availableCombos.length === 0 && coverageScopes.length > 0}
              onClick={openCreateModal}
            >
              <Plus className="h-4 w-4" />
              Add BU / Branch coverage
            </Button>
          </div>
        )}
      </div>

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New coverage profile</DialogTitle>
            <DialogDescription>
              Choose a business unit and optional branch. Each combination can have its own coverage rules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="coverage-create-bu" className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Business Unit
              </Label>
              <select
                id="coverage-create-bu"
                value={createBuId}
                onChange={(e) => handleCreateBuChange(e.target.value)}
                className={modalNativeSelectClass}
              >
                <option value="">— Select business unit —</option>
                {buStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `${s.code} — ${s.name}` : s.name}
                    {s.is_default ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coverage-create-branch" className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {BRANCH_LABEL}
              </Label>
              <select
                id="coverage-create-branch"
                value={createBranchId}
                onChange={(e) => setCreateBranchId(e.target.value)}
                disabled={!createBuId || createBranchesLoading}
                className={modalNativeSelectClass}
              >
                {createBranchesLoading ? (
                  <option value="">Loading branches…</option>
                ) : (
                  <>
                    <option value="">All branches</option>
                    {createBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code ? `${b.code} — ${b.name}` : b.name}
                        {b.is_default ? ' (default)' : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            {createBuId ? (
              <p className="text-xs text-muted-foreground">
                {createComboTaken ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    A profile already exists for this combination — pick a different business unit or branch.
                  </span>
                ) : (
                  <>
                    Creating coverage for{' '}
                    <strong className="text-foreground">
                      {comboLabel(createBuId, createBranchId, buStores, storeById)}
                    </strong>
                    {availableCombos.length > 1 ? (
                      <span> · {availableCombos.length - (createComboTaken ? 0 : 1)} more available</span>
                    ) : null}
                  </>
                )}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!canCreateCoverage} onClick={confirmCreateCoverage}>
              Create profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading */}
      {storesLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading business units…
        </div>
      )}

      {/* Empty store list */}
      {!storesLoading && buStores.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center space-y-2">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No business units found</p>
          <p className="text-xs text-muted-foreground/70">Create a business unit under Business Units first.</p>
        </div>
      )}

      {/* Empty — no profiles yet */}
      {!storesLoading && buStores.length > 0 && coverageScopes.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center space-y-3">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No coverage profiles yet</p>
          <p className="text-xs text-muted-foreground/70 max-w-md mx-auto">
            Create a profile for each business unit or branch that needs its own service zones and rules.
          </p>
          <Button type="button" size="sm" className="gap-1.5" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Add BU / Branch coverage
          </Button>
        </div>
      )}

      {/* Coverage profiles */}
      {!storesLoading && scopedPanels.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Coverage profiles ({scopedPanels.length})
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              disabled={availableCombos.length === 0}
              onClick={openCreateModal}
            >
              <Plus className="h-3.5 w-3.5" />
              Add another
            </Button>
          </div>
          {scopedPanels.map(({ scope, panel }, index) => (
            <StoreCoveragePanel
              key={scope.id}
              panelRef={index === scopedPanels.length - 1 ? lastPanelRef : undefined}
              store={panel.store}
              businessUnitLabel={panel.businessUnitLabel}
              config={getConfig(scope.storeId)}
              onUpdate={patch => patchConfig(scope.storeId, patch)}
              onRemove={() => removeCoverageScope(scope.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
