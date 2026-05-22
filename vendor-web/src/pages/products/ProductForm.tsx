import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { ResizableTable } from '@/components/table/ResizableTable'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProduct, useProducts, useCreateProduct, useUpdateProduct, useCategoryTree, useCreateCategory, useProductMerchandising, useSyncProductMerchandising, useBundles, usePriceRules, useCreatePriceRule, useUpdatePriceRule, useDeletePriceRule } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { mediaUrl, cn } from '@/lib/utils'
import type { ProductPriceRule, PriceRuleType } from '@/types'
import { ProductImageUpload, getMediaType } from '@/components/common/ImageUpload'
import {
  ArrowLeft, Loader2, Upload, X, ChevronDown, ChevronUp,
  Package, IndianRupee, Receipt, Boxes, RotateCcw,
  Truck, Eye, Search, Settings, Download, Repeat, BarChart3,
  Layers, Link2, Plus, Trash2, Copy, ShoppingBag, Pencil, Clock,
  FileDown, Film, Box, Star, Calculator, DollarSign, MapPin,
  Calendar, Hash, Radio, Users, Globe, Tag, MessageSquare, ToggleRight,
  Factory,
} from 'lucide-react'
import { BOMEditor } from '@/components/mrp/BOMEditor'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { extractApiError } from '@/lib/errorMessages'

// ── Zod schema ──────────────────────────────────────────────────

const optStr = z.string().optional().or(z.literal(''))
const optNum = z.coerce.number().optional().or(z.literal('').transform(() => undefined))
const optInt = z.coerce.number().int().optional().or(z.literal('').transform(() => undefined))

const variantRowSchema = z.object({
  id: z.string().optional(),  // DB id — present for saved variants, absent for new ones
  name: z.string().max(255),
  sku: optStr,
  barcode: optStr,
  uom: z.string().default('piece'),
  price_type: z.string().default('per_unit'),
  price: z.coerce.number().min(0).default(0),
  compare_at_price: optNum,
  cost_price: optNum,
  currency: z.string().default('INR'),
  discount_percentage: z.coerce.number().min(0).max(100).optional().or(z.literal('').transform(() => undefined)),
  discount_amount: optNum,
  offer_label: optStr,
  is_on_sale: z.boolean().default(false),
  // Tax
  is_taxable: z.boolean().default(true),
  tax_rate: z.coerce.number().min(0).max(100).optional().or(z.literal('').transform(() => undefined)),
  hsn_code: optStr,
  gst_rate: z.coerce.number().min(0).max(100).optional().or(z.literal('').transform(() => undefined)),
  // Inventory
  quantity: z.coerce.number().int().min(0).default(0),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
  stock_status: z.string().default('in_stock'),
  reorder_point: optInt,
  reorder_quantity: optInt,
  allow_backorders: z.boolean().default(false),
  track_inventory: z.boolean().default(true),
  // Shipping (per variant)
  weight_kg: optNum,
  // Lifecycle
  show_lifecycle: z.boolean().default(false),
  expiration_date: optStr,
  manufacture_date: optStr,
  best_before_date: optStr,
  warranty_period_days: optInt,
  warranty_type: optStr,
  // Return & warranty
  show_return_warranty: z.boolean().default(false),
  is_returnable: z.boolean().default(true),
  return_days: optInt,
  refund_policy: optStr,
  return_policy: optStr,
  return_conditions: optStr,
  color: optStr,
  attributes_json: optStr,
  // Subscription (variant-level)
  subscription_interval: optStr,
  subscription_trial_days: optInt,
  subscription_setup_fee: optNum,
  subscription_billing_cycles: optInt,
  subscription_schedule_modes: z.array(z.string()).optional(),
  is_active: z.boolean().default(true),
})

const schema = z.object({
  // Basic
  name: z.string().min(2, 'Product name must be at least 2 characters').max(255),
  slug: z.string().max(255).regex(/^[a-z0-9-]*$/, 'Slug can only contain lowercase letters, numbers, and hyphens').optional().or(z.literal('')),
  description: optStr,
  short_description: z.string().max(500).optional().or(z.literal('')),
  brand: optStr,
  product_type: z.string().default('physical'),
  category: optStr,
  subcategory: optStr,
  tags: z.string().optional().or(z.literal('')),
  // Unit of Measure
  uom: z.string().default('piece'),
  // Pricing
  price: z.coerce.number().min(0, 'Price must be 0 or higher').default(0),
  compare_at_price: optNum,
  cost_price: optNum,
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
  hsn_code: optStr,
  gst_rate: z.coerce.number().min(0).max(100).optional().or(z.literal('').transform(() => undefined)),
  // Inventory
  sku: optStr,
  barcode: optStr,
  track_inventory: z.boolean().default(true),
  quantity: z.coerce.number().int().min(0).default(0),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
  reorder_point: optInt,
  reorder_quantity: optInt,
  stock_status: z.string().default('in_stock'),
  allow_backorders: z.boolean().default(false),
  // Lifecycle
  expiration_date: optStr,
  manufacture_date: optStr,
  best_before_date: optStr,
  warranty_period_days: optInt,
  warranty_type: optStr,
  // Return
  return_warranty_per_variant: z.boolean().default(false),
  return_policy: optStr,
  return_days: optInt,
  is_returnable: z.boolean().default(true),
  return_conditions: optStr,
  refund_policy: optStr,
  // Shipping
  weight_kg: optNum,
  length_cm: optNum,
  width_cm: optNum,
  height_cm: optNum,
  shipping_cost_type: z.string().default('fixed'),
  shipping_class: optStr,
  requires_shipping: z.boolean().default(true),
  shipping_cost: optNum,
  free_shipping_threshold: optNum,
  // Visibility
  status: z.string().default('active'),
  is_featured: z.boolean().default(false),
  is_visible: z.boolean().default(true),
  is_new_arrival: z.boolean().default(false),
  is_best_seller: z.boolean().default(false),
  // SEO
  meta_title: optStr,
  meta_description: optStr,
  meta_keywords: optStr,
  og_image_url: optStr,
  canonical_url: optStr,
  // Advanced
  attributes: optStr,
  specifications: optStr,
  custom_fields: optStr,
  // Digital
  is_digital: z.boolean().default(false),
  download_url: optStr,
  download_limit: optInt,
  download_expiry_days: optInt,
  // Subscription
  is_subscription: z.boolean().default(false),
  subscription_interval: optStr,
  subscription_price: optNum,
  subscription_trial_days: optInt,
  subscription_setup_fee: optNum,
  subscription_billing_cycles: optInt,
  // Quote Request
  allow_quote_request: z.boolean().default(false),
  quote_form_config: z.any().optional(),
  // Variants
  variants: z.array(variantRowSchema).default([]),
})

type FormData = z.infer<typeof schema>

// ── Helpers ─────────────────────────────────────────────────────

function Section({ title, icon: Icon, open, onToggle, children, surface = 'standard', surfaceHint }: {
  title: string
  icon: React.ElementType
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  /** Subtle visual split: product (catalog identity) vs variants (sellable SKUs) — same page, different accent. */
  surface?: 'standard' | 'product' | 'variants'
  /** Optional line under title when surface is product or variants (e.g. subscription vs physical). */
  surfaceHint?: string
}) {
  const isProduct = surface === 'product'
  const isVariants = surface === 'variants'
  return (
    <Card
      className={cn(
        'overflow-hidden',
        isProduct && 'border-l-[3px] border-l-blue-500/75 ring-1 ring-blue-100/70',
        isVariants && 'border-l-[3px] border-l-indigo-500/75 ring-1 ring-indigo-100/70',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-t-xl px-6 py-4 transition-colors',
          !isProduct && !isVariants && 'hover:bg-accent/80 dark:hover:bg-secondary/60',
          isProduct && 'bg-gradient-to-r from-blue-50/80 via-white to-white hover:from-blue-50 dark:from-blue-950/40 dark:via-card dark:to-card dark:hover:from-blue-950/60',
          isVariants && 'bg-gradient-to-r from-indigo-50/80 via-white to-white hover:from-indigo-50 dark:from-indigo-950/40 dark:via-card dark:to-card dark:hover:from-indigo-950/60',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon
            className={cn(
              'w-5 h-5 shrink-0',
              isProduct && 'text-blue-600',
              isVariants && 'text-indigo-600',
              !isProduct && !isVariants && 'text-muted-foreground',
            )}
          />
          <div className="flex flex-col items-start min-w-0 text-left gap-0.5">
            <span className="font-semibold text-gray-900 leading-tight">{title}</span>
            {isProduct && (
              <span className="text-xs font-medium text-blue-600/80 uppercase tracking-wide">
                {surfaceHint ?? 'Main product'}
              </span>
            )}
            {isVariants && (
              <span className="text-xs font-medium text-indigo-600/80 uppercase tracking-wide">
                {surfaceHint ?? 'SKUs & options'}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground dark:text-foreground/80" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground dark:text-foreground/80" />}
      </button>
      {open && (
        <CardContent
          className={cn(
            'border-t pb-6 pt-0',
            !isProduct && !isVariants && 'border-border bg-muted/15 dark:bg-black/20',
            isProduct && 'border-blue-100/60 bg-gradient-to-b from-blue-50/25 to-card dark:border-blue-900/50 dark:from-blue-950/30 dark:to-card',
            isVariants && 'border-indigo-100/60 bg-gradient-to-b from-indigo-50/25 to-card dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-card',
          )}
        >
          {children}
        </CardContent>
      )}
    </Card>
  )
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && ' *'}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-primary' : 'bg-gray-200'}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
const textareaCls = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none'

function safeJsonStr(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  return JSON.stringify(v, null, 2)
}

function parseJsonField(v: string | undefined): unknown {
  if (!v || v.trim() === '') return undefined
  try { return JSON.parse(v) } catch { return undefined }
}

// ── Quote Form Configurator ──────────────────────────────────────

interface QuoteFormFieldDraft {
  key: string; label: string
  type: 'text' | 'textarea' | 'date' | 'time' | 'number' | 'email' | 'phone' | 'select'
  required: boolean; enabled: boolean; placeholder: string; options: string[]
}

const DEFAULT_QUOTE_FIELDS: QuoteFormFieldDraft[] = [
  { key: 'name', label: 'Full Name', type: 'text', required: true, enabled: true, placeholder: 'Customer name', options: [] },
  { key: 'email', label: 'Email', type: 'email', required: true, enabled: true, placeholder: 'Email address', options: [] },
  { key: 'phone', label: 'Phone Number', type: 'phone', required: false, enabled: true, placeholder: 'Phone number', options: [] },
  { key: 'message', label: 'Message', type: 'textarea', required: true, enabled: true, placeholder: 'Describe your requirements...', options: [] },
  { key: 'quantity', label: 'Quantity', type: 'number', required: false, enabled: true, placeholder: 'Qty', options: [] },
  { key: 'preferred_date', label: 'Preferred Date', type: 'date', required: false, enabled: true, placeholder: '', options: [] },
  { key: 'preferred_time', label: 'Preferred Time', type: 'time', required: false, enabled: false, placeholder: '', options: [] },
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
  fields: QuoteFormFieldDraft[]; onChange: (f: QuoteFormFieldDraft[]) => void
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
                  <p className="text-xs font-medium text-gray-400 uppercase mb-1">Dropdown Options</p>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {(f.options || []).map((opt, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs pl-2 pr-1 py-0.5 rounded-full">
                        {opt}
                        <button type="button" onClick={() => removeOption(f.key, i)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
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

// ── Option rows ──────────────────────────────────────────────────

interface OptionRow {
  name: string
  values: string
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap(a => curr.map(c => [...a, c])),
    [[]],
  )
}

const UOM_OPTIONS: { value: string; label: string; group: string }[] = [
  // Quantity / Count
  { value: 'piece', label: 'Piece (pc)', group: 'Count' },
  { value: 'unit', label: 'Unit', group: 'Count' },
  { value: 'pair', label: 'Pair', group: 'Count' },
  { value: 'dozen', label: 'Dozen (12)', group: 'Count' },
  { value: 'gross', label: 'Gross (144)', group: 'Count' },
  { value: 'set', label: 'Set', group: 'Count' },
  { value: 'pack', label: 'Pack', group: 'Count' },
  { value: 'bundle', label: 'Bundle', group: 'Count' },
  { value: 'box', label: 'Box', group: 'Count' },
  { value: 'case', label: 'Case', group: 'Count' },
  { value: 'carton', label: 'Carton', group: 'Count' },
  { value: 'pallet', label: 'Pallet', group: 'Count' },
  { value: 'roll', label: 'Roll', group: 'Count' },
  { value: 'sheet', label: 'Sheet', group: 'Count' },
  { value: 'bag', label: 'Bag', group: 'Count' },
  { value: 'bottle', label: 'Bottle', group: 'Count' },
  { value: 'can', label: 'Can', group: 'Count' },
  { value: 'jar', label: 'Jar', group: 'Count' },
  { value: 'tube', label: 'Tube', group: 'Count' },
  { value: 'sachet', label: 'Sachet', group: 'Count' },
  { value: 'pouch', label: 'Pouch', group: 'Count' },
  // Weight
  { value: 'mg', label: 'Milligram (mg)', group: 'Weight' },
  { value: 'g', label: 'Gram (g)', group: 'Weight' },
  { value: 'kg', label: 'Kilogram (kg)', group: 'Weight' },
  { value: 'tonne', label: 'Metric Ton (t)', group: 'Weight' },
  { value: 'oz', label: 'Ounce (oz)', group: 'Weight' },
  { value: 'lb', label: 'Pound (lb)', group: 'Weight' },
  { value: 'quintal', label: 'Quintal (100 kg)', group: 'Weight' },
  // Volume
  { value: 'ml', label: 'Millilitre (ml)', group: 'Volume' },
  { value: 'cl', label: 'Centilitre (cl)', group: 'Volume' },
  { value: 'l', label: 'Litre (L)', group: 'Volume' },
  { value: 'kl', label: 'Kilolitre (kL)', group: 'Volume' },
  { value: 'fl_oz', label: 'Fluid Ounce (fl oz)', group: 'Volume' },
  { value: 'pt', label: 'Pint (pt)', group: 'Volume' },
  { value: 'qt', label: 'Quart (qt)', group: 'Volume' },
  { value: 'gal', label: 'Gallon (gal)', group: 'Volume' },
  { value: 'cup', label: 'Cup', group: 'Volume' },
  { value: 'tbsp', label: 'Tablespoon (tbsp)', group: 'Volume' },
  // Length
  { value: 'mm', label: 'Millimetre (mm)', group: 'Length' },
  { value: 'cm', label: 'Centimetre (cm)', group: 'Length' },
  { value: 'm', label: 'Metre (m)', group: 'Length' },
  { value: 'km', label: 'Kilometre (km)', group: 'Length' },
  { value: 'in', label: 'Inch (in)', group: 'Length' },
  { value: 'ft', label: 'Foot (ft)', group: 'Length' },
  { value: 'yd', label: 'Yard (yd)', group: 'Length' },
  // Area
  { value: 'sq_m', label: 'Square Metre (m²)', group: 'Area' },
  { value: 'sq_ft', label: 'Square Foot (ft²)', group: 'Area' },
  { value: 'sq_yd', label: 'Square Yard (yd²)', group: 'Area' },
  { value: 'acre', label: 'Acre', group: 'Area' },
  { value: 'hectare', label: 'Hectare (ha)', group: 'Area' },
  // Time / Service
  { value: 'hour', label: 'Hour (hr)', group: 'Time' },
  { value: 'day', label: 'Day', group: 'Time' },
  { value: 'week', label: 'Week', group: 'Time' },
  { value: 'month', label: 'Month', group: 'Time' },
  { value: 'year', label: 'Year', group: 'Time' },
  { value: 'session', label: 'Session', group: 'Time' },
  // Energy / Power
  { value: 'watt', label: 'Watt (W)', group: 'Energy' },
  { value: 'kw', label: 'Kilowatt (kW)', group: 'Energy' },
  { value: 'kwh', label: 'Kilowatt-Hour (kWh)', group: 'Energy' },
  // Data
  { value: 'mb', label: 'Megabyte (MB)', group: 'Data' },
  { value: 'gb', label: 'Gigabyte (GB)', group: 'Data' },
  { value: 'tb', label: 'Terabyte (TB)', group: 'Data' },
]

const UOM_GROUPS = [...new Set(UOM_OPTIONS.map(u => u.group))]

// ── Variant Media Section ────────────────────────────────────────

const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.glb,.gltf'

function VariantMediaSection({
  variantId, variantName, initialMedia, onChanged,
}: {
  variantId: string
  variantName: string
  initialMedia: { url: string; media_type: 'image' | 'video' | 'model3d'; is_primary: boolean; alt_text?: string; position: number }[]
  onChanged: () => void
}) {
  const [media, setMedia] = useState(initialMedia)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMedia(initialMedia) }, [initialMedia])

  const resolveUrl = (url: string) => mediaUrl(url)

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/')
      const is3D = file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf')
      const label = is3D ? '3D model' : isVideo ? 'Video' : 'Image'
      try {
        const result = await vendorApi.uploadVariantMedia(variantId, file)
        setMedia(result.media)
        onChanged()
        toast.success(`${label} uploaded successfully`)
      } catch (err: any) {
        const detail = err?.response?.data?.detail || err?.message || 'Unknown error'
        toast.error(`${label} upload failed: ${detail}`)
      }
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDelete = async (url: string) => {
    try {
      const result = await vendorApi.deleteVariantMedia(variantId, url)
      setMedia(result.media)
      onChanged()
      toast.success('Media removed')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Unknown error'
      toast.error(`Failed to delete media: ${detail}`)
    }
  }

  const handleSetPrimary = async (url: string) => {
    try {
      const result = await vendorApi.setPrimaryVariantMedia(variantId, url)
      setMedia(result.media)
      onChanged()
      toast.success('Primary image updated')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Unknown error'
      toast.error(`Failed to set primary: ${detail}`)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-indigo-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          Variant Media
          <span className="font-normal text-gray-400 normal-case tracking-normal">(overrides product media when shown)</span>
        </p>
        <span className="text-xs text-gray-400">{media.length} file{media.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        onDragOver={e => e.preventDefault()}
        className="border border-dashed border-indigo-200 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 mx-auto text-indigo-400 animate-spin" />
        ) : (
          <Upload className="w-5 h-5 mx-auto text-indigo-300" />
        )}
        <p className="text-xs text-gray-500 mt-1">{uploading ? 'Uploading…' : 'Drop or click to add images, videos, 3D models'}</p>
        <input ref={inputRef} type="file" multiple accept={MEDIA_ACCEPT} className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>

      {/* Media grid */}
      {media.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
          {media.map((item, i) => {
            const mt = item.media_type || 'image'
            const url = resolveUrl(item.url)
            return (
              <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border bg-gray-50">
                {mt === 'video' ? (
                  <video src={url} className="w-full h-full object-cover" muted playsInline onMouseOver={e => (e.target as HTMLVideoElement).play()} onMouseOut={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }} />
                ) : mt === 'model3d' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-600">
                    <Box className="w-6 h-6" />
                    <span className="text-[8px] mt-0.5">3D</span>
                  </div>
                ) : (
                  <img src={url} alt={item.alt_text || variantName} className="w-full h-full object-cover" />
                )}
                {item.is_primary && (
                  <span className="absolute top-0.5 left-0.5 bg-yellow-400 text-yellow-900 text-[7px] px-1 rounded font-bold">Primary</span>
                )}
                {mt === 'video' && <span className="absolute bottom-0.5 right-0.5 bg-primary text-white text-[7px] px-1 rounded">VID</span>}
                {mt === 'model3d' && <span className="absolute bottom-0.5 right-0.5 bg-cyan-600 text-white text-[7px] px-1 rounded">3D</span>}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {!item.is_primary && mt === 'image' && (
                    <button type="button" onClick={() => handleSetPrimary(item.url)} className="bg-yellow-400 text-yellow-900 rounded p-1" title="Set primary">
                      <Star className="w-3 h-3" />
                    </button>
                  )}
                  <button type="button" onClick={() => handleDelete(item.url)} className="bg-red-500 text-white rounded p-1" title="Delete">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main form ───────────────────────────────────────────────────

function ProductDisplay({ product, onEdit, onBack, priceRules = [], merchMappings = [], allProducts = [] }: {
  product: any
  onEdit: () => void
  onBack: () => void
  priceRules?: any[]
  merchMappings?: Array<{ target_type: string; target_product_id: string; target_category: string; relation_type: string; bundle_id?: string; trigger_stage: string; priority: number }>
  allProducts?: Array<{ id: string; name: string; category?: string; sku?: string }>
}) {
  const navigate = useNavigate()
  const symbol = product.currency === 'INR' ? '\u20B9' : '$'
  const images = (product.images || []).sort((a: any, b: any) => a.position - b.position)
  const uomLabel = UOM_OPTIONS.find(u => u.value === product.uom)?.label || product.uom || 'Piece'
  const hasVariants = (product.variants?.length || 0) > 0
  const hasBasePrice = product.price > 0
  const hasBasePricing = hasBasePrice || product.compare_at_price || product.cost_price || product.is_on_sale || product.discount_percentage || product.discount_amount
  const pType = product.product_type || 'physical'
  const isPhysical = pType === 'physical'
  const isDigital = pType === 'digital' || pType === 'bundle' || product.is_digital
  const isSubscription = pType === 'subscription' || product.is_subscription

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
            product.status === 'active' ? 'bg-green-100 text-green-700' :
            product.status === 'archived' ? 'bg-red-50 text-red-600' :
            'bg-gray-100 text-gray-700'
          }`}>{product.status}</span>
        </div>
        <Button onClick={onEdit} className="gap-2"><Pencil className="w-4 h-4" />Edit Product</Button>
      </div>

      {/* Media */}
      {images.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 overflow-x-auto">
              {images.map((img: any) => {
                const mt = img.media_type || 'image'
                return (
                  <div key={img.id} className="w-28 h-28 rounded-lg overflow-hidden border bg-gray-50 shrink-0 relative">
                    {mt === 'video' ? (
                      <video src={mediaUrl(img.url)} className="w-full h-full object-cover" muted playsInline onMouseOver={e => (e.target as HTMLVideoElement).play()} onMouseOut={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }} />
                    ) : mt === 'model3d' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-600">
                        <Box className="w-8 h-8" />
                        <span className="text-xs mt-0.5 font-medium">3D Model</span>
                      </div>
                    ) : (
                      <img src={mediaUrl(img.url)} alt={img.alt_text || product.name} className="w-full h-full object-cover" />
                    )}
                    {mt === 'video' && <span className="absolute bottom-0.5 right-0.5 bg-primary text-white text-[8px] font-bold px-1 rounded">VID</span>}
                    {mt === 'model3d' && <span className="absolute bottom-0.5 right-0.5 bg-cyan-600 text-white text-[8px] font-bold px-1 rounded">3D</span>}
                    {img.is_primary && <span className="absolute top-0.5 left-0.5 bg-yellow-400 text-yellow-900 text-[8px] px-1 rounded font-bold">Primary</span>}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic Info */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">Basic Information</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3">
            <DisplayField label="Product Name" value={product.name} />
            <DisplayField label="Slug" value={product.slug} />
            <DisplayField label="Brand" value={product.brand} />
            <DisplayField label="Type" value={<span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-50 text-blue-700 capitalize">{product.product_type || 'physical'}</span>} />
            <DisplayField label="Category" value={product.category} />
            <DisplayField label="Subcategory" value={product.subcategory} />
            <DisplayField label="Unit of Measure" value={uomLabel} />
            <DisplayField label="SKU" value={product.sku} />
            <DisplayField label="Barcode" value={product.barcode} />
          </div>
          {product.short_description && (
            <DisplayField label="Short Description" value={product.short_description} />
          )}
          {product.description && (
            <DisplayField label="Description" value={<p className="whitespace-pre-line text-gray-600 text-sm">{product.description}</p>} />
          )}
          {product.tags?.length > 0 && (
            <DisplayField label="Tags" value={
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((t: string) => (
                  <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{t}</span>
                ))}
              </div>
            } />
          )}
        </CardContent>
      </Card>

      {/* Pricing — hide when variants carry all pricing and base is zero */}
      {(!hasVariants || hasBasePricing) && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <IndianRupee className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">Pricing</span>
              {hasVariants && <span className="text-xs text-gray-400">(base product)</span>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
              <DisplayField label="Price" value={<span className="text-lg font-bold text-gray-900">{symbol}{product.price?.toLocaleString()}</span>} />
              <DisplayField label="Compare at Price" value={product.compare_at_price ? `${symbol}${product.compare_at_price.toLocaleString()}` : null} />
              <DisplayField label="Cost Price" value={product.cost_price ? `${symbol}${product.cost_price.toLocaleString()}` : null} />
              <DisplayField label="Currency" value={product.currency} />
            </div>
            {(product.is_on_sale || product.discount_percentage || product.discount_amount) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 pt-2 border-t">
                <DisplayField label="On Sale" value={product.is_on_sale ? 'Yes' : 'No'} />
                <DisplayField label="Discount %" value={product.discount_percentage ? `${product.discount_percentage}%` : null} />
                <DisplayField label="Discount Amount" value={product.discount_amount ? `${symbol}${product.discount_amount}` : null} />
                <DisplayField label="Offer Label" value={product.offer_label} />
                {product.discount_start_date && <DisplayField label="Sale Starts" value={product.discount_start_date} />}
                {product.discount_end_date && <DisplayField label="Sale Ends" value={product.discount_end_date} />}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tax — only show if there's actual tax info */}
      {(product.is_taxable || product.tax_rate || product.hsn_code || product.gst_rate) && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Receipt className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">Tax</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
              <DisplayField label="Taxable" value={product.is_taxable ? 'Yes' : 'No'} />
              <DisplayField label="Tax Rate" value={product.tax_rate != null ? `${product.tax_rate}%` : null} />
              <DisplayField label="HSN Code" value={product.hsn_code} />
              <DisplayField label="GST Rate" value={product.gst_rate != null ? `${product.gst_rate}%` : null} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory — hide base inventory when variants carry all stock */}
      {!hasVariants && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Boxes className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">Inventory</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
              <DisplayField label="Quantity" value={
                <span className={`font-semibold ${product.quantity <= (product.low_stock_threshold || 5) ? 'text-red-600' : 'text-gray-900'}`}>
                  {product.quantity}
                </span>
              } />
              <DisplayField label="Stock Status" value={
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  product.stock_status === 'in_stock' ? 'bg-green-100 text-green-700' :
                  product.stock_status === 'out_of_stock' ? 'bg-red-100 text-red-700' :
                  product.stock_status === 'backorder' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>{(product.stock_status || 'in_stock').replace('_', ' ')}</span>
              } />
              <DisplayField label="Low Stock Threshold" value={product.low_stock_threshold} />
              <DisplayField label="Track Inventory" value={product.track_inventory ? 'Yes' : 'No'} />
              <DisplayField label="Allow Backorders" value={product.allow_backorders ? 'Yes' : 'No'} />
              <DisplayField label="Reorder Point" value={product.reorder_point} />
              <DisplayField label="Reorder Qty" value={product.reorder_quantity} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variants */}
      {product.variants?.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-gray-900">Variants ({product.variants.length})</span>
              <span className="ml-auto text-xs text-gray-400">
                {product.variants.filter((v: any) => v.quantity <= (v.low_stock_threshold ?? 5)).length} low stock
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500 w-6">#</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Variant</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500">SKU / Barcode</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Pricing</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Stock</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Tax / HSN</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500">UOM</th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {product.variants.map((v: any, i: number) => {
                  const vUomLabel = UOM_OPTIONS.find((u: any) => u.value === v.uom)?.label || v.uom || 'pc'
                  const qty = v.quantity ?? 0
                  const thresh = v.low_stock_threshold ?? 5
                  const isLow = qty <= thresh
                  const isOut = qty === 0
                  const stockStatus = isOut ? { bg: 'bg-red-100', text: 'text-red-700', label: 'Out' }
                    : isLow ? { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Low' }
                    : { bg: 'bg-green-100', text: 'text-green-700', label: 'OK' }

                  return (
                    <tr key={v.id || i} className={`hover:bg-gray-50/60 ${!v.is_active ? 'opacity-40' : ''}`}>
                      {/* # */}
                      <td className="px-2 py-2 text-gray-300 font-mono">{i + 1}</td>

                      {/* Variant name + color swatch + attributes */}
                      <td className="px-2 py-2 min-w-[140px]">
                        <div className="flex items-center gap-1.5">
                          {v.color && (
                            <span
                              className="w-3 h-3 rounded-full border border-gray-200 shrink-0"
                              title={v.color}
                              style={{ backgroundColor: v.color.toLowerCase().startsWith('#') ? v.color : v.color }}
                            />
                          )}
                          <span className="font-medium text-gray-900 leading-tight">{v.name}</span>
                        </div>
                        {v.is_on_sale && v.discount_percentage && (
                          <span className="inline-block mt-0.5 bg-orange-100 text-orange-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                            {v.discount_percentage}% OFF
                          </span>
                        )}
                      </td>

                      {/* SKU + Barcode stacked */}
                      <td className="px-2 py-2 min-w-[130px]">
                        <p className="font-mono text-gray-700 leading-tight">{v.sku || '—'}</p>
                        {v.barcode && (
                          <p className="font-mono text-gray-400 text-xs mt-0.5 tracking-wide">{v.barcode}</p>
                        )}
                      </td>

                      {/* Price / Compare / Cost stacked */}
                      <td className="px-2 py-2 min-w-[110px]">
                        <p className="font-semibold text-gray-900">{symbol}{v.price?.toLocaleString()}</p>
                        {v.compare_at_price && (
                          <p className="text-gray-400 line-through text-xs">{symbol}{v.compare_at_price?.toLocaleString()}</p>
                        )}
                        {v.cost_price && (
                          <p className="text-gray-400 text-xs">Cost: {symbol}{v.cost_price?.toLocaleString()}</p>
                        )}
                      </td>

                      {/* Stock qty + threshold badge */}
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                            {qty}
                          </span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${stockStatus.bg} ${stockStatus.text}`}>
                            {stockStatus.label}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5">min {thresh}</p>
                      </td>

                      {/* Tax % + HSN stacked */}
                      <td className="px-2 py-2">
                        <p className="text-gray-700">
                          {v.tax_rate != null ? `${v.tax_rate}%` : v.gst_rate != null ? `${v.gst_rate}%` : '—'}
                        </p>
                        {v.hsn_code && (
                          <p className="text-gray-400 text-xs mt-0.5 font-mono">{v.hsn_code}</p>
                        )}
                      </td>

                      {/* UOM */}
                      <td className="px-2 py-2 text-gray-500">{vUomLabel}</td>

                      {/* Flags: active + backorders */}
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {v.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {v.allow_backorders && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Backorder</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Return & Warranty — only if any relevant data is set */}
      {(product.return_days || product.warranty_period_days || product.warranty_type || product.refund_policy || product.return_policy || product.return_conditions || product.is_returnable === false) && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <RotateCcw className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">Return & Warranty</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
              <DisplayField label="Returnable" value={product.is_returnable ? 'Yes' : 'No'} />
              <DisplayField label="Return Days" value={product.return_days} />
              <DisplayField label="Refund Policy" value={product.refund_policy ? product.refund_policy.replace('_', ' ') : null} />
              <DisplayField label="Warranty (days)" value={product.warranty_period_days} />
              <DisplayField label="Warranty Type" value={product.warranty_type} />
            </div>
            {product.return_policy && (
              <DisplayField label="Return Policy" value={<p className="whitespace-pre-line text-gray-600 text-sm">{product.return_policy}</p>} />
            )}
            {product.return_conditions && (
              <DisplayField label="Return Conditions" value={<p className="whitespace-pre-line text-gray-600 text-sm">{product.return_conditions}</p>} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Lifecycle — only if any date is set */}
      {(product.manufacture_date || product.expiration_date || product.best_before_date) && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">Product Lifecycle</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3">
              <DisplayField label="Manufacture Date" value={product.manufacture_date} />
              <DisplayField label="Expiration Date" value={product.expiration_date} />
              <DisplayField label="Best Before Date" value={product.best_before_date} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shipping */}
      {pType !== 'digital' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">Shipping & Delivery</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
              <DisplayField label="Requires Shipping" value={product.requires_shipping ? 'Yes' : 'No'} />
              <DisplayField label="Weight" value={product.weight_kg ? `${product.weight_kg} kg` : null} />
              <DisplayField label="Dimensions" value={
                (product.length_cm || product.width_cm || product.height_cm)
                  ? `${product.length_cm || '—'} × ${product.width_cm || '—'} × ${product.height_cm || '—'} cm`
                  : null
              } />
              <DisplayField label="Shipping Class" value={product.shipping_class ? product.shipping_class.charAt(0).toUpperCase() + product.shipping_class.slice(1) : null} />
              <DisplayField label="Shipping Cost Type" value={product.shipping_cost_type ? product.shipping_cost_type.replace('_', ' ') : null} />
              <DisplayField label="Shipping Cost" value={product.shipping_cost != null ? `${symbol}${product.shipping_cost}` : null} />
              <DisplayField label="Free Shipping Threshold" value={product.free_shipping_threshold != null ? `${symbol}${product.free_shipping_threshold}` : null} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visibility */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">Visibility & Marketing</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
            <DisplayField label="Status" value={product.status ? product.status.charAt(0).toUpperCase() + product.status.slice(1) : null} />
            <DisplayField label="Visible" value={product.is_visible ? 'Yes' : 'No'} />
            <DisplayField label="Featured" value={product.is_featured ? 'Yes' : 'No'} />
            <DisplayField label="New Arrival" value={product.is_new_arrival ? 'Yes' : 'No'} />
            <DisplayField label="Best Seller" value={product.is_best_seller ? 'Yes' : 'No'} />
          </div>
        </CardContent>
      </Card>

      {/* SEO & Metadata */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Search className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">SEO & Metadata</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <DisplayField label="Meta Title" value={product.meta_title} />
            <DisplayField label="Canonical URL" value={product.canonical_url} />
          </div>
          <DisplayField label="Meta Description" value={product.meta_description} />
          {product.meta_keywords?.length > 0 ? (
            <DisplayField label="Meta Keywords" value={
              <div className="flex flex-wrap gap-1.5">
                {product.meta_keywords.map((k: string) => (
                  <span key={k} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{k}</span>
                ))}
              </div>
            } />
          ) : (
            <DisplayField label="Meta Keywords" value={null} />
          )}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <DisplayField label="OG Image URL" value={product.og_image_url ? (
              <a href={product.og_image_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs break-all">{product.og_image_url}</a>
            ) : null} />
          </div>
        </CardContent>
      </Card>

      {/* Advanced — Attributes, Specifications, Custom Fields */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">Advanced Features</span>
          </div>
          <DisplayField label="Attributes" value={
            hasJsonContent(product.attributes) ? <JsonDisplay data={product.attributes} /> : null
          } />
          <DisplayField label="Specifications" value={
            hasJsonContent(product.specifications) ? <JsonDisplay data={product.specifications} /> : null
          } />
          <DisplayField label="Custom Fields" value={
            hasJsonContent(product.custom_fields) ? <JsonDisplay data={product.custom_fields} /> : null
          } />
        </CardContent>
      </Card>

      {/* Digital Product */}
      {isDigital && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Download className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">Digital Product</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3">
              <DisplayField label="Is Digital" value={product.is_digital ? 'Yes' : 'No'} />
              <DisplayField label="Download Limit" value={product.download_limit} />
              <DisplayField label="Download Expiry (days)" value={product.download_expiry_days} />
            </div>
            <DisplayField label="Download URL" value={product.download_url ? (
              <a href={product.download_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs break-all">{product.download_url}</a>
            ) : null} />
          </CardContent>
        </Card>
      )}

      {/* Subscription Plans */}
      {isSubscription && product.variants && product.variants.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Repeat className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">Subscription Plans</span>
            </div>
            <div className="space-y-3">
              {product.variants.filter((v: { is_active?: boolean }) => v.is_active !== false).map((v: { id: string; name?: string; price?: number; uom?: string; price_type?: string; subscription_interval?: string; subscription_trial_days?: number; subscription_setup_fee?: number; subscription_billing_cycles?: number; subscription_schedule_modes?: string[] }) => {
                const interval = v.subscription_interval || product.subscription_interval
                const vPriceType = (v as any).price_type || 'per_unit'
                const vUom = v.uom || 'piece'
                const uomLbl = UOM_OPTIONS.find(u => u.value === vUom)?.label || vUom
                const priceSuffix = vPriceType === 'per_cycle' && interval ? `/${interval}` : `/${uomLbl}`
                return (
                  <div key={v.id} className="rounded-lg border border-primary/30 bg-accent/80 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary">{v.name || 'Default Plan'}</span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase">{vPriceType === 'per_cycle' ? 'Per Cycle' : `Per ${uomLbl}`}</span>
                      </div>
                      <span className="text-lg font-bold text-primary">{symbol}{(v.price ?? 0).toLocaleString()}{priceSuffix}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><span className="text-gray-500">Interval:</span> <span className="font-medium">{interval ? interval.charAt(0).toUpperCase() + interval.slice(1) : '—'}</span></div>
                      <div><span className="text-gray-500">Max Cycles:</span> <span className="font-medium">{v.subscription_billing_cycles || 'Indefinite'}</span></div>
                      <div><span className="text-gray-500">Trial:</span> <span className="font-medium">{v.subscription_trial_days ? `${v.subscription_trial_days} days` : 'None'}</span></div>
                      <div><span className="text-gray-500">Setup Fee:</span> <span className="font-medium">{v.subscription_setup_fee ? `${symbol}${v.subscription_setup_fee.toLocaleString()}` : 'None'}</span></div>
                    </div>
                    {v.subscription_schedule_modes && v.subscription_schedule_modes.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-gray-400 uppercase font-medium">Scheduling:</span>
                        {v.subscription_schedule_modes.map(m => (
                          <span key={m} className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{
                            ({ dates: 'Date Range', cycles: 'Cycles', pick_dates: 'Pick Dates', weekly: 'Weekly', recurring: 'Recurring' } as Record<string, string>)[m] || m
                          }</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">Statistics</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">{product.view_count ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Views</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">{product.purchase_count ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Purchases</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">v{product.version_number ?? 1}</p>
              <p className="text-xs text-gray-500 mt-1">Version</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Front Options */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <ToggleRight className="w-5 h-5 text-gray-500" />
            <span className="font-semibold text-gray-900">Business Front Options</span>
          </div>
          <div className="divide-y rounded-lg border">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Quote Requests</p>
                  <p className="text-xs text-gray-400">Allow customers to request pricing quotes for this product</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${product.allow_quote_request ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {product.allow_quote_request ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
          {product.allow_quote_request && Array.isArray(product.quote_form_config) && product.quote_form_config.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Quote Form Fields</p>
              <div className="overflow-x-auto rounded-lg border">
                <ResizableTable tableId="product-quote-fields" defaultWidths={[180, 100, 80, 80]}>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Field</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Type</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Enabled</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {product.quote_form_config.map((f: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium capitalize">{(f.label || f.name || '').replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2 text-gray-500 capitalize">{f.type || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${f.enabled !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {f.enabled !== false ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${f.required ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                            {f.required ? 'Required' : 'Optional'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ResizableTable>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Merchandising */}
      {(merchMappings.length > 0) && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Link2 className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">Merchandising</span>
            </div>
            {(['cross_sell', 'upsell'] as const).map(relType => {
              const rows = merchMappings.filter(m => m.relation_type === relType)
              if (rows.length === 0) return null
              const meta = relType === 'cross_sell'
                ? { title: 'Cross-sell (Related Items)', bgBadge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200 bg-emerald-50/30' }
                : { title: 'Upsell (Upgrade Options)', bgBadge: 'bg-amber-100 text-amber-700', border: 'border-amber-200 bg-amber-50/30' }
              return (
                <div key={relType} className={`rounded-xl border p-4 space-y-2 ${meta.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-800">{meta.title}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bgBadge}`}>{rows.length}</span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((row, i) => {
                      const targetProd = allProducts.find(p => p.id === row.target_product_id)
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm bg-white rounded-lg border px-3 py-2">
                          <span className="text-gray-500 text-xs w-20 shrink-0">{row.target_type === 'category' ? 'Category' : 'Product'}</span>
                          <span className="font-medium flex-1 truncate">
                            {row.target_type === 'category' ? row.target_category : (targetProd ? targetProd.name : row.target_product_id)}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{row.trigger_stage}</span>
                          {row.priority > 0 && <span className="text-xs text-gray-400">P{row.priority}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Advanced Pricing */}
      {priceRules.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">Advanced Pricing Rules</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">{priceRules.length}</span>
            </div>
            {(['party', 'location', 'scheduled', 'quantity', 'channel'] as const).map(ruleType => {
              const typeRules = priceRules.filter((r: any) => r.rule_type === ruleType)
              if (typeRules.length === 0) return null
              const typeLabel: Record<string, string> = { party: 'Party / Customer', location: 'Location', scheduled: 'Scheduled', quantity: 'Quantity Tiers', channel: 'Channel' }
              return (
                <div key={ruleType} className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{typeLabel[ruleType]}</p>
                  <div className="overflow-x-auto rounded-lg border">
                    <ResizableTable tableId={`product-price-rules-${ruleType}`} defaultWidths={[150, 120, 90, 80, 80]}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Name</th>
                          {ruleType === 'party' && <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Group</th>}
                          {ruleType === 'location' && <><th className="text-left px-3 py-2 text-xs font-medium text-gray-500">State</th><th className="text-left px-3 py-2 text-xs font-medium text-gray-500">City</th><th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Pincode</th></>}
                          {ruleType === 'scheduled' && <><th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Start</th><th className="text-left px-3 py-2 text-xs font-medium text-gray-500">End</th></>}
                          {ruleType === 'quantity' && <><th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Min Qty</th><th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Max Qty</th></>}
                          {ruleType === 'channel' && <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Channel</th>}
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Price</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Discount %</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {typeRules.map((rule: any) => (
                          <tr key={rule.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{rule.name}</td>
                            {ruleType === 'party' && <td className="px-3 py-2 text-gray-600">{rule.customer_group || '—'}</td>}
                            {ruleType === 'location' && <><td className="px-3 py-2 text-gray-600">{rule.state || '—'}</td><td className="px-3 py-2 text-gray-600">{rule.city || '—'}</td><td className="px-3 py-2 text-gray-600">{rule.pincode || '—'}</td></>}
                            {ruleType === 'scheduled' && <><td className="px-3 py-2 text-gray-600">{rule.start_date ? new Date(rule.start_date).toLocaleDateString() : '—'}</td><td className="px-3 py-2 text-gray-600">{rule.end_date ? new Date(rule.end_date).toLocaleDateString() : '—'}</td></>}
                            {ruleType === 'quantity' && <><td className="px-3 py-2 text-gray-600">{rule.min_quantity ?? '—'}</td><td className="px-3 py-2 text-gray-600">{rule.max_quantity ?? '∞'}</td></>}
                            {ruleType === 'channel' && <td className="px-3 py-2 text-gray-600 capitalize">{rule.channel || '—'}</td>}
                            <td className="px-3 py-2 font-medium">{rule.price != null ? `${symbol}${rule.price.toLocaleString()}` : '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{rule.discount_percentage != null ? `${rule.discount_percentage}%` : '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {rule.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </ResizableTable>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Change History — link to report */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-500" />
              <div>
                <span className="font-semibold text-gray-900">Change History</span>
                <span className="text-xs text-gray-400 ml-2">{(product.change_history || []).length} entries &middot; v{product.version_number || 1}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate(`/products/${product.id}/audit`)}
            >
              <FileDown className="w-4 h-4" />
              View Full Report
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 mt-4 pt-4 border-t">
            <DisplayField label="Created At" value={product.created_at ? new Date(product.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null} />
            <DisplayField label="Updated At" value={product.updated_at ? new Date(product.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null} />
            <DisplayField label="Published At" value={product.published_at ? new Date(product.published_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function hasJsonContent(obj: unknown): boolean {
  if (!obj) return false
  if (typeof obj === 'string') {
    try { const p = JSON.parse(obj); return typeof p === 'object' && p !== null && Object.keys(p).length > 0 } catch { return false }
  }
  return typeof obj === 'object' && Object.keys(obj as Record<string, unknown>).length > 0
}

function JsonDisplay({ data }: { data: unknown }) {
  const obj = typeof data === 'string' ? (() => { try { return JSON.parse(data) } catch { return null } })() : data
  if (!obj || typeof obj !== 'object') return <span className="text-gray-400">—</span>
  const entries = Object.entries(obj as Record<string, unknown>)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-baseline gap-2 text-sm">
          <span className="text-gray-500 font-medium">{key}:</span>
          <span className="text-gray-900">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
        </div>
      ))}
    </div>
  )
}

function DisplayField({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === undefined) {
    return (
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-300">—</p>
      </div>
    )
  }
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  )
}

// ── Add Price Rule inline form ────────────────────────────────
function AddPriceRuleForm({ ruleType, productId, variants, onSave, onCancel, saving }: {
  ruleType: PriceRuleType
  productId: string
  variants: { id: string; name: string }[]
  onSave: (data: any) => void
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState('')
  const [variantId, setVariantId] = useState('')
  const [price, setPrice] = useState('')
  const [discountPct, setDiscountPct] = useState('')
  const [discountAmt, setDiscountAmt] = useState('')
  const [priority, setPriority] = useState('0')
  const [notes, setNotes] = useState('')
  // Party
  const [customerGroup, setCustomerGroup] = useState('')
  // Location
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [region, setRegion] = useState('')
  const [country, setCountry] = useState('India')
  // Scheduled
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // Quantity
  const [minQty, setMinQty] = useState('')
  const [maxQty, setMaxQty] = useState('')
  // Channel
  const [channel, setChannel] = useState('')

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Rule name is required'); return }
    if (!price && !discountPct && !discountAmt) { toast.error('Set at least a price, discount %, or discount amount'); return }
    const data: Record<string, unknown> = {
      rule_type: ruleType,
      name: name.trim(),
      priority: parseInt(priority) || 0,
      is_active: true,
      notes: notes || undefined,
    }
    if (variantId) data.variant_id = variantId
    if (price) data.price = parseFloat(price)
    if (discountPct) data.discount_percentage = parseFloat(discountPct)
    if (discountAmt) data.discount_amount = parseFloat(discountAmt)
    if (ruleType === 'party') {
      if (!customerGroup.trim()) { toast.error('Customer group is required for party pricing'); return }
      data.customer_group = customerGroup.trim()
    }
    if (ruleType === 'location') {
      data.state = state || undefined
      data.city = city || undefined
      data.pincode = pincode || undefined
      data.region = region || undefined
      data.country = country || undefined
    }
    if (ruleType === 'scheduled') {
      if (!startDate) { toast.error('Start date is required for scheduled pricing'); return }
      data.start_date = new Date(startDate).toISOString()
      if (endDate) data.end_date = new Date(endDate).toISOString()
    }
    if (ruleType === 'quantity') {
      if (!minQty) { toast.error('Min quantity is required for quantity tiers'); return }
      data.min_quantity = parseInt(minQty)
      if (maxQty) data.max_quantity = parseInt(maxQty)
    }
    if (ruleType === 'channel') {
      if (!channel) { toast.error('Channel is required'); return }
      data.channel = channel
    }
    onSave(data)
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none'
  const selectCls = inputCls

  return (
    <div className="border border-indigo-200 rounded-xl bg-indigo-50/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-indigo-700">New {ruleType.charAt(0).toUpperCase() + ruleType.slice(1)} Pricing Rule</h4>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="col-span-2 md:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Rule Name *</label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Wholesale Rate" />
        </div>
        {variants.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Apply to Variant</label>
            <select className={selectCls} value={variantId} onChange={e => setVariantId(e.target.value)}>
              <option value="">All variants (product-level)</option>
              {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
          <input type="number" className={inputCls} value={priority} onChange={e => setPriority(e.target.value)} placeholder="0" min="0" />
        </div>
      </div>

      {/* Type-specific fields */}
      {ruleType === 'party' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer Group *</label>
            <select className={selectCls} value={customerGroup} onChange={e => setCustomerGroup(e.target.value)}>
              <option value="">Select group…</option>
              <option value="wholesale">Wholesale</option>
              <option value="retail">Retail</option>
              <option value="vip">VIP</option>
              <option value="employee">Employee</option>
              <option value="distributor">Distributor</option>
              <option value="dealer">Dealer</option>
              <option value="agent">Agent</option>
              <option value="institutional">Institutional</option>
              <option value="government">Government</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      )}

      {ruleType === 'location' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
            <input className={inputCls} value={country} onChange={e => setCountry(e.target.value)} placeholder="India" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
            <input className={inputCls} value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Karnataka" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
            <input className={inputCls} value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Bangalore" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
            <input className={inputCls} value={pincode} onChange={e => setPincode(e.target.value)} placeholder="e.g. 560001" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
            <input className={inputCls} value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. South India" />
          </div>
        </div>
      )}

      {ruleType === 'scheduled' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
            <input type="datetime-local" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input type="datetime-local" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      )}

      {ruleType === 'quantity' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min Quantity *</label>
            <input type="number" min="1" className={inputCls} value={minQty} onChange={e => setMinQty(e.target.value)} placeholder="e.g. 10" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max Quantity (leave blank for unlimited)</label>
            <input type="number" min="1" className={inputCls} value={maxQty} onChange={e => setMaxQty(e.target.value)} placeholder="e.g. 49" />
          </div>
        </div>
      )}

      {ruleType === 'channel' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sales Channel *</label>
            <select className={selectCls} value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="">Select channel…</option>
              <option value="online">Online Store</option>
              <option value="pos">POS (Point of Sale)</option>
              <option value="wholesale">Wholesale</option>
              <option value="marketplace">Marketplace</option>
              <option value="mobile_app">Mobile App</option>
              <option value="social">Social Commerce</option>
            </select>
          </div>
        </div>
      )}

      {/* Pricing outcome */}
      <div>
        <h5 className="text-xs font-medium text-gray-600 mb-2">Pricing (set at least one)</h5>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fixed Price</label>
            <input type="number" step="0.01" min="0" className={inputCls} value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 899.00" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Discount %</label>
            <input type="number" step="0.01" min="0" max="100" className={inputCls} value={discountPct} onChange={e => setDiscountPct(e.target.value)} placeholder="e.g. 15" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Discount Amount (₹)</label>
            <input type="number" step="0.01" min="0" className={inputCls} value={discountAmt} onChange={e => setDiscountAmt(e.target.value)} placeholder="e.g. 100" />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
        <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal note about this rule…" />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="button" onClick={handleSubmit} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create Rule
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}


const toSlug = (s: string) =>
  (s || '').toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

export default function ProductForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const isEdit = !!id
  const startInEditMode = !isEdit || searchParams.get('edit') === 'true'
  const [isViewMode, setIsViewMode] = useState(!startInEditMode)
  // Pre-fill barcode from ?barcode= query param (set when navigating from a failed scan)
  const prefillBarcode = !isEdit ? (searchParams.get('barcode') || '') : ''

  const { data: product, isLoading } = useProduct(id || '')
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const { data: categoryData } = useCategoryTree()
  const createCategory = useCreateCategory()
  const { data: allProductsData } = useProducts({ size: 500 })
  const allProducts = (allProductsData?.items || []) as Array<{ id: string; name: string; category?: string; sku?: string }>
  const productCategories = (categoryData?.categories || []).filter(
    c => c.applies_to === 'product' || c.applies_to === 'both'
  )

  // Price rules
  const { data: priceRules = [] } = usePriceRules(id || '')
  const createPriceRule = useCreatePriceRule()
  const updatePriceRule = useUpdatePriceRule()
  const deletePriceRule = useDeletePriceRule()
  const [priceRuleTab, setPriceRuleTab] = useState<PriceRuleType>('party')
  const [showAddRule, setShowAddRule] = useState(false)

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Staged variant media for new products (index → files+previews)
  const [pendingVariantMedia, setPendingVariantMedia] = useState<Map<number, { file: File; preview: string }[]>>(new Map())

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ basic: true })
  const toggle = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }))
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [quoteFields, setQuoteFields] = useState<QuoteFormFieldDraft[]>([...DEFAULT_QUOTE_FIELDS])

  const { register, handleSubmit, reset, setValue, getValues, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'active', quantity: 0, price: 0, currency: 'INR', product_type: 'physical', uom: 'piece',
      is_taxable: true, track_inventory: true, is_returnable: true, requires_shipping: true,
      is_visible: true, low_stock_threshold: 5, stock_status: 'in_stock',
      allow_quote_request: false, quote_form_config: [],
      variants: [],
    },
  })

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control,
    name: 'variants',
  })

  // Apply prefill barcode once form is ready (new product only)
  useEffect(() => {
    if (prefillBarcode) {
      setValue('barcode', prefillBarcode)
      // Also copy to the first variant so it's visible in the variants table
      const currentVariants = getValues('variants')
      if (Array.isArray(currentVariants) && currentVariants.length > 0 && !currentVariants[0]?.barcode) {
        setValue('variants.0.barcode', prefillBarcode)
      }
      // Auto-open the inventory and variants sections so the user can see it
      setOpenSections(s => ({ ...s, inventory: true, variants: true }))
    }
  }, [prefillBarcode]) // eslint-disable-line react-hooks/exhaustive-deps

  const [optionRows, setOptionRows] = useState<OptionRow[]>([{ name: '', values: '' }])
  const [expandedVariants, setExpandedVariants] = useState<Record<number, boolean>>({})
  const toggleVariant = (idx: number) => setExpandedVariants(p => ({ ...p, [idx]: !p[idx] }))
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState<number | null>(null)
  const [confirmDeleteOption, setConfirmDeleteOption] = useState<number | null>(null)

  // ── Merchandising state ──
  type MerchMapping = { target_type: 'product' | 'category'; target_product_id: string; target_category: string; relation_type: 'cross_sell' | 'upsell'; bundle_id?: string; trigger_stage: 'PDP' | 'CART' | 'CHECKOUT'; priority: number }
  const [merchMappings, setMerchMappings] = useState<MerchMapping[]>([])
  const { data: merchData } = useProductMerchandising(id || '')
  const { data: bundlesData } = useBundles()
  const bundles = bundlesData?.items || []

  useEffect(() => {
    if (merchData) {
      const mapRow = (m: { target_type?: string; target_product_id?: string; target_category?: string; bundle_id?: string; trigger_stage?: string; priority?: number }, rel: 'cross_sell' | 'upsell'): MerchMapping => ({
        target_type: (m.target_type === 'category' ? 'category' : 'product') as 'product' | 'category',
        target_product_id: m.target_product_id || '',
        target_category: m.target_category || '',
        relation_type: rel,
        bundle_id: m.bundle_id,
        trigger_stage: (m.trigger_stage || 'PDP') as 'PDP' | 'CART' | 'CHECKOUT',
        priority: m.priority || 0,
      })
      setMerchMappings([
        ...(merchData.cross_sell || []).map(m => mapRow(m, 'cross_sell')),
        ...(merchData.upsell || []).map(m => mapRow(m, 'upsell')),
      ])
    }
  }, [merchData])

  const addMerchMapping = (type: 'cross_sell' | 'upsell') => {
    setMerchMappings(prev => [...prev, { target_type: 'product', target_product_id: '', target_category: '', relation_type: type, trigger_stage: 'PDP', priority: prev.filter(m => m.relation_type === type).length }])
  }
  const removeMerchMapping = (idx: number) => setMerchMappings(prev => prev.filter((_, i) => i !== idx))
  const updateMerchMapping = (idx: number, updates: Partial<MerchMapping>) => {
    setMerchMappings(prev => prev.map((m, i) => i === idx ? { ...m, ...updates } : m))
  }

  const copyVariant = (index: number) => {
    const all = getValues('variants') || []
    const s = all[index]
    if (!s) return

    const copyName = s.name ? `${s.name} (copy)` : ''

    // Parse source attributes to update option rows
    let srcAttrs: Record<string, string> = {}
    try { srcAttrs = s.attributes_json ? JSON.parse(s.attributes_json) : {} } catch { /* ignore */ }

    // Build new attributes with "(copy)" suffix on each value
    const newAttrs: Record<string, string> = {}
    for (const [optName, optVal] of Object.entries(srcAttrs)) {
      newAttrs[optName] = optVal ? `${optVal} (copy)` : optVal
    }

    // Sync the option rows: add a new row for each copied value
    if (Object.keys(newAttrs).length > 0) {
      setOptionRows(prev => {
        const updated = [...prev]
        // Remove trailing empty rows
        while (updated.length > 1 && !updated[updated.length - 1].name.trim() && !updated[updated.length - 1].values.trim()) {
          updated.pop()
        }
        for (const [optName, newVal] of Object.entries(newAttrs)) {
          updated.push({ name: optName, values: newVal })
        }
        return updated
      })
    }

    const newVariant = {
      name: copyName,
      sku: s.sku ? `${s.sku}-copy` : '',
      barcode: s.barcode || '',
      uom: s.uom || 'piece',
      price_type: s.price_type || 'per_unit',
      price: Number(s.price) || 0,
      compare_at_price: s.compare_at_price ? Number(s.compare_at_price) : undefined,
      cost_price: s.cost_price ? Number(s.cost_price) : undefined,
      currency: s.currency || 'INR',
      discount_percentage: s.discount_percentage ? Number(s.discount_percentage) : undefined,
      discount_amount: s.discount_amount ? Number(s.discount_amount) : undefined,
      offer_label: s.offer_label || '',
      is_on_sale: !!s.is_on_sale,
      is_taxable: s.is_taxable !== false,
      tax_rate: s.tax_rate ? Number(s.tax_rate) : undefined,
      hsn_code: s.hsn_code || '',
      gst_rate: s.gst_rate ? Number(s.gst_rate) : undefined,
      quantity: Number(s.quantity) || 0,
      low_stock_threshold: Number(s.low_stock_threshold) || 5,
      stock_status: s.stock_status || 'in_stock',
      reorder_point: s.reorder_point ? Number(s.reorder_point) : undefined,
      reorder_quantity: s.reorder_quantity ? Number(s.reorder_quantity) : undefined,
      allow_backorders: !!s.allow_backorders,
      track_inventory: s.track_inventory !== false,
      show_lifecycle: !!s.show_lifecycle,
      expiration_date: s.expiration_date || '',
      manufacture_date: s.manufacture_date || '',
      best_before_date: s.best_before_date || '',
      warranty_period_days: s.warranty_period_days ? Number(s.warranty_period_days) : undefined,
      warranty_type: s.warranty_type || '',
      show_return_warranty: !!s.show_return_warranty,
      is_returnable: s.is_returnable !== false,
      return_days: s.return_days ? Number(s.return_days) : undefined,
      refund_policy: s.refund_policy || '',
      return_policy: s.return_policy || '',
      return_conditions: s.return_conditions || '',
      color: s.color || '',
      attributes_json: Object.keys(newAttrs).length > 0 ? JSON.stringify(newAttrs) : (s.attributes_json || ''),
      subscription_interval: s.subscription_interval || '',
      subscription_trial_days: s.subscription_trial_days ? Number(s.subscription_trial_days) : undefined,
      subscription_setup_fee: s.subscription_setup_fee ? Number(s.subscription_setup_fee) : undefined,
      subscription_billing_cycles: s.subscription_billing_cycles ? Number(s.subscription_billing_cycles) : undefined,
      subscription_schedule_modes: s.subscription_schedule_modes || ['dates', 'cycles', 'pick_dates', 'weekly', 'recurring'],
      is_active: s.is_active !== false,
    }
    const newIdx = all.length
    appendVariant(newVariant)
    setExpandedVariants(p => ({ ...p, [newIdx]: true }))
    toast.success(`Variant "${copyName || index + 1}" copied`)
  }

  const productType = watch('product_type')
  const isPhysical    = !productType || productType === 'physical'
  const isDigitalType = productType === 'digital'
  const isSubscriptionType = productType === 'subscription'
  const isBundleType  = productType === 'bundle'
  const watchedCategory = watch('category')
  const watchedSubcategory = watch('subcategory')
  const watchedVariants = watch('variants')

  const handleQuickCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (name.length < 2) {
      toast.error('Category name must be at least 2 characters')
      return
    }
    try {
      await createCategory.mutateAsync({
        name,
        applies_to: 'product',
        sort_order: 0,
      })
      setValue('category', name)
      setValue('subcategory', '')
      setNewCategoryName('')
      setShowCreateCategory(false)
    } catch {
      /* useCreateCategory shows toast */
    }
  }

  // ── Auto-fill discount fields for bundle base price on load/change ──
  const watchedBasePrice     = watch('price')
  const watchedBaseCompareAt = watch('compare_at_price')
  useEffect(() => {
    const p = parseFloat(String(watchedBasePrice || 0))
    const c = parseFloat(String(watchedBaseCompareAt || 0))
    if (c > 0 && p > 0 && c > p) {
      const pct = parseFloat(((c - p) / c * 100).toFixed(2))
      const amt = parseFloat((c - p).toFixed(2))
      const currPct = parseFloat(String(watch('discount_percentage') || 0))
      const currAmt = parseFloat(String(watch('discount_amount') || 0))
      if (Math.abs(pct - currPct) > 0.01) setValue('discount_percentage', pct)
      if (Math.abs(amt - currAmt) > 0.01) setValue('discount_amount', amt)
      setValue('is_on_sale', true)
    }
  }, [watchedBasePrice, watchedBaseCompareAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fill discount fields for every variant on load/change ──
  useEffect(() => {
    if (!Array.isArray(watchedVariants)) return
    watchedVariants.forEach((v, index) => {
      const p = parseFloat(String(v?.price || 0))
      const c = parseFloat(String(v?.compare_at_price || 0))
      if (c > 0 && p >= 0 && c > p) {
        const pct = parseFloat(((c - p) / c * 100).toFixed(2))
        const amt = parseFloat((c - p).toFixed(2))
        const currPct = parseFloat(String(v?.discount_percentage || 0))
        const currAmt = parseFloat(String(v?.discount_amount || 0))
        if (Math.abs(pct - currPct) > 0.01) setValue(`variants.${index}.discount_percentage`, pct)
        if (Math.abs(amt - currAmt) > 0.01) setValue(`variants.${index}.discount_amount`, amt)
        if (!v?.is_on_sale) setValue(`variants.${index}.is_on_sale`, true)
      }
    })
  }, [ // re-run only when prices actually change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    watchedVariants?.map(v => `${v?.price}|${v?.compare_at_price}`).join(',')
  ])

  // Hoist base-price sync so it's available in both Base Pricing and Sale & Discounts IIFEs
  const syncBasePrices = (newP: number, newC: number) => {
    if (newC > 0 && newP > 0 && newC > newP) {
      const pct = parseFloat(((newC - newP) / newC * 100).toFixed(2))
      const amt = parseFloat((newC - newP).toFixed(2))
      setValue('discount_percentage', pct)
      setValue('discount_amount', amt)
      setValue('is_on_sale', true)
      const lbl = watch('offer_label') || ''
      if (lbl === '' || /^\d/.test(lbl)) {
        setValue('offer_label', `${pct.toFixed(1)}% OFF`)
      }
    }
  }

  // Bundle item IDs (stored as related_product_ids on save)
  const [bundleItemIds, setBundleItemIds] = useState<string[]>([])

  // Add-ons (linked services / products that can be sold alongside)
  interface AddonItem {
    id: string
    name: string
    item_type: 'product' | 'service'
    addon_type: string          // 'install' | 'demo' | 'warranty' | 'maintenance' | 'delivery' | 'other'
    booking_trigger: string     // 'at_sale' | 'after_delivery' | 'on_status'
    trigger_status?: string     // e.g. 'delivered', 'shipped' — used when booking_trigger = 'on_status'
    optional: boolean
  }
  const [productAddons, setProductAddons] = useState<AddonItem[]>([])
  const [addonSearch, setAddonSearch] = useState('')
  const [addonSearchResults, setAddonSearchResults] = useState<Array<{ id: string; name: string; item_type: 'product' | 'service' }>>([])
  const [addonSearchLoading, setAddonSearchLoading] = useState(false)

  // Search products + services for add-on picker
  const searchAddons = useCallback(async (q: string) => {
    if (q.length < 2) { setAddonSearchResults([]); return }
    setAddonSearchLoading(true)
    try {
      const [pRes, sRes] = await Promise.all([
        vendorApi.listProducts({ search: q, size: 8 }),
        vendorApi.listServices({ search: q, size: 8 }),
      ])
      const combined = [
        ...(pRes?.items || []).map((p: any) => ({ id: p.id, name: p.name, item_type: 'product' as const })),
        ...(sRes?.items || []).map((s: any) => ({ id: s.id, name: s.name, item_type: 'service' as const })),
      ].filter(x => !productAddons.some(a => a.id === x.id))
      setAddonSearchResults(combined)
    } catch { setAddonSearchResults([]) }
    finally { setAddonSearchLoading(false) }
  }, [productAddons])

  useEffect(() => {
    const t = setTimeout(() => searchAddons(addonSearch), 300)
    return () => clearTimeout(t)
  }, [addonSearch, searchAddons])

  useEffect(() => {
    if (!product) return
    reset({
      name: product.name, slug: toSlug(product.slug),
      description: product.description || '', short_description: product.short_description || '',
      brand: product.brand || '', product_type: product.product_type || 'physical',
      category: product.category || '', subcategory: product.subcategory || '',
      tags: (product.tags || []).join(', '),
      uom: product.uom || 'piece',
      price: product.price, compare_at_price: product.compare_at_price ?? undefined,
      cost_price: product.cost_price ?? undefined, currency: product.currency || 'INR',
      discount_percentage: product.discount_percentage ?? undefined,
      discount_amount: product.discount_amount ?? undefined,
      discount_start_date: product.discount_start_date?.split('T')[0] || '',
      discount_end_date: product.discount_end_date?.split('T')[0] || '',
      offer_label: product.offer_label || '', is_on_sale: product.is_on_sale,
      is_taxable: product.is_taxable, tax_rate: product.tax_rate ?? undefined,
      hsn_code: product.hsn_code || '', gst_rate: product.gst_rate ?? undefined,
      sku: product.sku || '', barcode: product.barcode || '',
      track_inventory: product.track_inventory, quantity: product.quantity,
      low_stock_threshold: product.low_stock_threshold,
      reorder_point: product.reorder_point ?? undefined,
      reorder_quantity: product.reorder_quantity ?? undefined,
      stock_status: product.stock_status || 'in_stock',
      allow_backorders: product.allow_backorders,
      expiration_date: product.expiration_date || '',
      manufacture_date: product.manufacture_date || '',
      best_before_date: product.best_before_date || '',
      warranty_period_days: product.warranty_period_days ?? undefined,
      warranty_type: product.warranty_type || '',
      return_policy: product.return_policy || '',
      return_days: product.return_days ?? undefined,
      is_returnable: product.is_returnable,
      return_conditions: product.return_conditions || '',
      refund_policy: product.refund_policy || '',
      weight_kg: product.weight_kg ?? undefined, length_cm: product.length_cm ?? undefined,
      width_cm: product.width_cm ?? undefined, height_cm: product.height_cm ?? undefined,
      shipping_class: product.shipping_class || '', requires_shipping: product.requires_shipping,
      shipping_cost_type: product.shipping_cost_type || 'fixed',
      shipping_cost: product.shipping_cost ?? undefined,
      free_shipping_threshold: product.free_shipping_threshold ?? undefined,
      status: product.status, is_featured: product.is_featured, is_visible: product.is_visible,
      is_new_arrival: product.is_new_arrival, is_best_seller: product.is_best_seller,
      allow_quote_request: (product as any).allow_quote_request ?? false,
      quote_form_config: (product as any).quote_form_config || [],
      meta_title: product.meta_title || '', meta_description: product.meta_description || '',
      meta_keywords: (product.meta_keywords || []).join(', '),
      og_image_url: product.og_image_url || '', canonical_url: product.canonical_url || '',
      attributes: safeJsonStr(product.attributes),
      specifications: safeJsonStr(product.specifications),
      custom_fields: safeJsonStr(product.custom_fields),
      is_digital: product.is_digital, download_url: product.download_url || '',
      download_limit: product.download_limit ?? undefined,
      download_expiry_days: product.download_expiry_days ?? undefined,
      is_subscription: product.is_subscription,
      subscription_interval: product.subscription_interval || '',
      subscription_price: product.subscription_price ?? undefined,
      subscription_trial_days: product.subscription_trial_days ?? undefined,
      subscription_setup_fee: product.subscription_setup_fee ?? undefined,
      subscription_billing_cycles: product.subscription_billing_cycles ?? undefined,
      variants: (product.variants || []).map(v => ({
        id: v.id,
        name: v.name,
        sku: v.sku || '',
        barcode: v.barcode || '',
        uom: v.uom || 'piece',
        price_type: (v as any).price_type || 'per_unit',
        price: v.price,
        compare_at_price: v.compare_at_price ?? undefined,
        cost_price: v.cost_price ?? undefined,
        currency: v.currency || 'INR',
        discount_percentage: v.discount_percentage ?? undefined,
        discount_amount: v.discount_amount ?? undefined,
        offer_label: v.offer_label || '',
        is_on_sale: v.is_on_sale ?? false,
        is_taxable: v.is_taxable ?? true,
        tax_rate: v.tax_rate ?? undefined,
        hsn_code: v.hsn_code || '',
        gst_rate: v.gst_rate ?? undefined,
        quantity: v.quantity ?? 0,
        low_stock_threshold: v.low_stock_threshold ?? 5,
        stock_status: v.stock_status || 'in_stock',
        reorder_point: v.reorder_point ?? undefined,
        reorder_quantity: v.reorder_quantity ?? undefined,
        allow_backorders: v.allow_backorders ?? false,
        track_inventory: v.track_inventory ?? true,
        weight_kg: (v as any).weight_kg ?? undefined,
        show_lifecycle: !!(v.expiration_date || v.manufacture_date || v.best_before_date || v.warranty_period_days || v.warranty_type),
        expiration_date: v.expiration_date ?? '',
        manufacture_date: v.manufacture_date ?? '',
        best_before_date: v.best_before_date ?? '',
        warranty_period_days: v.warranty_period_days ?? undefined,
        warranty_type: v.warranty_type ?? '',
        show_return_warranty: !!(v.return_days || v.refund_policy || v.return_policy || v.return_conditions || v.is_returnable === false),
        is_returnable: v.is_returnable ?? true,
        return_days: v.return_days ?? undefined,
        refund_policy: v.refund_policy ?? '',
        return_policy: v.return_policy ?? '',
        return_conditions: v.return_conditions ?? '',
        color: v.color ?? '',
        attributes_json: safeJsonStr(v.attributes),
        subscription_interval: (v as any).subscription_interval || '',
        subscription_trial_days: (v as any).subscription_trial_days ?? undefined,
        subscription_setup_fee: (v as any).subscription_setup_fee ?? undefined,
        subscription_billing_cycles: (v as any).subscription_billing_cycles ?? undefined,
        subscription_schedule_modes: (v as any).subscription_schedule_modes || ['dates', 'cycles', 'pick_dates', 'weekly', 'recurring'],
        is_active: v.is_active,
      })),
    })

    // Load quote form config (defaults + custom fields)
    if ((product as any).quote_form_config?.length) {
      const savedConfig = (product as any).quote_form_config as QuoteFormFieldDraft[]
      const merged = DEFAULT_QUOTE_FIELDS.map(def => {
        const saved = savedConfig.find((f: any) => f.key === def.key)
        return saved ? { ...def, ...saved } : { ...def, enabled: false }
      })
      const customFields = savedConfig.filter(f => !DEFAULT_QUOTE_FIELDS.some(d => d.key === f.key))
      setQuoteFields([...merged, ...customFields.map(f => ({ ...f, options: f.options || [] }))])
    }
  }, [product, reset])

  // Initialise bundle items when editing a bundle product
  useEffect(() => {
    if (product?.product_type === 'bundle') {
      setBundleItemIds((product as any).related_product_ids || [])
    }
  }, [product])

  useEffect(() => {
    return () => { pendingPreviews.forEach(URL.revokeObjectURL) }
  }, [pendingPreviews])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    register('name').onChange(e)
    if (!isEdit) {
      setValue('slug', toSlug(e.target.value), { shouldValidate: true })
    }
  }

  const addPendingFiles = (files: FileList | null) => {
    if (!files) return
    const newFiles = Array.from(files)
    setPendingFiles(prev => [...prev, ...newFiles])
    setPendingPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))])
  }

  const removePendingFile = (index: number) => {
    URL.revokeObjectURL(pendingPreviews[index])
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
    setPendingPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async (raw: FormData) => {
    try {
      const {
        variants: variantRows,
        show_lifecycle: _sl,
        show_return_warranty: _srw,
        return_warranty_per_variant: _rwpv,
        ...rest
      } = raw as FormData & { show_lifecycle?: boolean; show_return_warranty?: boolean; return_warranty_per_variant?: boolean }

      const data: Record<string, unknown> = { ...rest }
      data.tags = raw.tags ? raw.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      data.meta_keywords = raw.meta_keywords ? raw.meta_keywords.split(',').map(t => t.trim()).filter(Boolean) : []
      data.attributes = parseJsonField(raw.attributes) || {}
      data.specifications = parseJsonField(raw.specifications) || {}
      data.custom_fields = parseJsonField(raw.custom_fields) || {}

      data.variants = (variantRows || [])
        .filter(v => v.name?.trim())
        .map(v => ({
          id: v.id || undefined,
          name: v.name.trim(),
          sku: v.sku?.trim() || undefined,
          barcode: v.barcode?.trim() || undefined,
          uom: v.uom || 'piece',
          price_type: v.price_type || 'per_unit',
          price: v.price,
          compare_at_price: v.compare_at_price,
          cost_price: v.cost_price,
          currency: v.currency || 'INR',
          discount_percentage: v.discount_percentage,
          discount_amount: v.discount_amount,
          offer_label: v.offer_label?.trim() || undefined,
          is_on_sale: v.is_on_sale ?? false,
          is_taxable: v.is_taxable ?? true,
          tax_rate: v.tax_rate,
          hsn_code: v.hsn_code?.trim() || undefined,
          gst_rate: v.gst_rate,
          quantity: v.quantity ?? 0,
          low_stock_threshold: v.low_stock_threshold ?? 5,
          stock_status: v.stock_status || 'in_stock',
          reorder_point: v.reorder_point,
          reorder_quantity: v.reorder_quantity,
          allow_backorders: v.allow_backorders ?? false,
          track_inventory: v.track_inventory ?? true,
          weight_kg: v.weight_kg ?? undefined,
          expiration_date: v.expiration_date || undefined,
          manufacture_date: v.manufacture_date || undefined,
          best_before_date: v.best_before_date || undefined,
          warranty_period_days: v.warranty_period_days ?? undefined,
          warranty_type: v.warranty_type || undefined,
          is_returnable: v.is_returnable ?? true,
          return_days: v.return_days ?? undefined,
          refund_policy: v.refund_policy || undefined,
          return_policy: v.return_policy || undefined,
          return_conditions: v.return_conditions || undefined,
          color: v.color || undefined,
          attributes: (parseJsonField(v.attributes_json) as Record<string, unknown>) || {},
          subscription_interval: v.subscription_interval || undefined,
          subscription_trial_days: v.subscription_trial_days ?? undefined,
          subscription_setup_fee: v.subscription_setup_fee ?? undefined,
          subscription_billing_cycles: v.subscription_billing_cycles ?? undefined,
          subscription_schedule_modes: v.subscription_schedule_modes?.length ? v.subscription_schedule_modes : undefined,
          is_active: v.is_active ?? true,
        }))

      // Auto-set type flags from product_type
      if (raw.product_type === 'digital') data.is_digital = true
      if (raw.product_type === 'bundle')  data.is_digital = true
      if (raw.product_type === 'subscription') {
        data.is_subscription = true
        // Derive product-level subscription fields from the first active variant for backward compat
        const firstActiveVariant = (data.variants as Array<{ is_active?: boolean; price?: number; subscription_interval?: string; subscription_trial_days?: number; subscription_setup_fee?: number; subscription_billing_cycles?: number }> || []).find(v => v.is_active !== false && v.price != null && Number(v.price) > 0)
        if (firstActiveVariant) {
          data.subscription_price = Number(firstActiveVariant.price)
          data.subscription_interval = firstActiveVariant.subscription_interval || data.subscription_interval
          data.subscription_trial_days = firstActiveVariant.subscription_trial_days ?? data.subscription_trial_days
          data.subscription_setup_fee = firstActiveVariant.subscription_setup_fee ?? data.subscription_setup_fee
          data.subscription_billing_cycles = firstActiveVariant.subscription_billing_cycles ?? data.subscription_billing_cycles
        }
      }
      // Bundle items stored as related_product_ids
      if (raw.product_type === 'bundle') data.related_product_ids = bundleItemIds

      // Include quote form config; explicitly clear when disabled
      if (raw.allow_quote_request) {
        data.quote_form_config = quoteFields.filter(f => f.enabled).map(({ key, label, type, required, enabled, placeholder, options }) => ({
          key, label, type, required, enabled, placeholder, ...(options?.length ? { options } : {}),
        }))
      } else {
        data.quote_form_config = null
      }

      // Strip empty strings so the backend gets null instead
      for (const k of Object.keys(data)) {
        if (data[k] === '' || data[k] === undefined) delete data[k]
      }

      const syncMerch = async (productId: string) => {
        try {
          const mappings = merchMappings
            .filter(m => m.target_type === 'category' ? !!m.target_category : !!m.target_product_id)
            .map(m => ({
              target_type: m.target_type,
              target_product_id: m.target_type === 'product' ? m.target_product_id : undefined,
              target_category: m.target_type === 'category' ? m.target_category : undefined,
              relation_type: m.relation_type,
              bundle_id: m.bundle_id || undefined,
              trigger_stage: m.trigger_stage,
              priority: m.priority,
            }))
          if (mappings.length > 0 || isEdit) {
            await vendorApi.syncProductMerchandising(productId, { mappings })
          }
        } catch { /* best-effort */ }
      }


      if (isEdit) {
        await updateProduct.mutateAsync({ id: id!, data })
        await syncMerch(id!)
        navigate('/products')
      } else {
        const newProduct = await createProduct.mutateAsync(
          { data, images: pendingFiles.length > 0 ? pendingFiles : undefined }
        )
        await syncMerch(newProduct.id)
        // Upload staged variant media now that variants have DB IDs
        if (pendingVariantMedia.size > 0) {
          for (const [variantIndex, items] of pendingVariantMedia.entries()) {
            const dbVariant = (newProduct as any).variants?.[variantIndex]
            if (dbVariant?.id && items.length > 0) {
              for (const { file } of items) {
                try { await vendorApi.uploadVariantMedia(dbVariant.id, file) } catch { /* best-effort */ }
              }
            }
          }
          setPendingVariantMedia(new Map())
        }
        setPendingFiles([])
        setPendingPreviews([])
        navigate(`/products/${newProduct.id}?edit=true`, { replace: true })
      }
    } catch (err) {
      // Mutations already toast via apiError(); avoid duplicate “Request failed with status code …”
      if (!isAxiosError(err)) {
        toast.error(extractApiError(err, 'Submit failed'))
      }
    }
  }

  const handleUpload = useCallback(async (file: File) => {
    if (!id) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const isVideo = file.type.startsWith('video/')
    const is3D = ext === 'glb' || ext === 'gltf'
    const label = isVideo ? 'Video' : is3D ? '3D model' : 'Image'
    try {
      await vendorApi.uploadProductImage(id, file)
      qc.invalidateQueries({ queryKey: ['vendor', 'product', id] })
      toast.success(`${label} uploaded`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Upload failed'
      toast.error(`${label} upload failed: ${msg}`)
    }
  }, [id, qc])

  const handleDelete = useCallback(async (imageId: string) => {
    if (!id) return
    try {
      await vendorApi.deleteProductImage(id, imageId)
      qc.invalidateQueries({ queryKey: ['vendor', 'product', id] })
      toast.success('Image deleted')
    } catch { toast.error('Failed to delete image') }
  }, [id, qc])

  const handleSetPrimary = useCallback(async (imageId: string) => {
    if (!id) return
    try {
      await vendorApi.setPrimaryProductImage(id, imageId)
      qc.invalidateQueries({ queryKey: ['vendor', 'product', id] })
      toast.success('Primary image updated')
    } catch { toast.error('Failed to set primary image') }
  }, [id, qc])

  const updateOptionRow = (index: number, field: keyof OptionRow, value: string) => {
    const oldRow = optionRows[index]
    setOptionRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))

    // Sync option value changes → variant names & attributes
    if (field === 'values' && oldRow?.name.trim()) {
      const optName = oldRow.name.trim()
      const oldVal = oldRow.values.trim()
      const newVal = value.trim()
      if (oldVal && newVal && oldVal !== newVal) {
        const variants = getValues('variants') || []
        variants.forEach((v: Record<string, unknown>, vi: number) => {
          let attrs: Record<string, string> = {}
          try { attrs = v.attributes_json ? JSON.parse(v.attributes_json as string) : {} } catch { /* */ }
          const matchKey = Object.keys(attrs).find(k => k.toLowerCase() === optName.toLowerCase())
          if (matchKey && attrs[matchKey] === oldVal) {
            attrs[matchKey] = newVal
            setValue(`variants.${vi}.attributes_json`, JSON.stringify(attrs))
            // Rebuild the variant name from all attribute values
            const newName = Object.values(attrs).join(' / ')
            setValue(`variants.${vi}.name`, newName)
          }
        })
      }
    }
  }
  const addOptionRow = () => setOptionRows(prev => [...prev, { name: '', values: '' }])
  const removeOptionRow = (index: number) => setOptionRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index))

  const makeVariantDefaults = (name: string, attrs: Record<string, string>) => ({
    name,
    sku: '',
    // If this is the first variant and we have a prefill barcode from a scan, apply it
    barcode: variantFields.length === 0 && prefillBarcode ? prefillBarcode : '',
    uom: getValues('uom') || 'piece',
    price_type: isSubscriptionType ? 'per_cycle' : 'per_unit',
    price: Number(getValues('price')) || 0,
    compare_at_price: undefined,
    cost_price: undefined,
    currency: getValues('currency') || 'INR',
    discount_percentage: undefined,
    discount_amount: undefined,
    offer_label: '',
    is_on_sale: false,
    is_taxable: true,
    tax_rate: undefined,
    hsn_code: '',
    gst_rate: undefined,
    quantity: 0,
    low_stock_threshold: 5,
    stock_status: 'in_stock',
    reorder_point: undefined,
    reorder_quantity: undefined,
    allow_backorders: false,
    track_inventory: true,
    show_lifecycle: false,
    expiration_date: '',
    manufacture_date: '',
    best_before_date: '',
    warranty_period_days: undefined,
    warranty_type: '',
    show_return_warranty: false,
    is_returnable: true,
    return_days: undefined,
    refund_policy: '',
    return_policy: '',
    return_conditions: '',
    color: '',
    attributes_json: JSON.stringify(attrs),
    subscription_interval: '',
    subscription_trial_days: undefined,
    subscription_setup_fee: undefined,
    subscription_billing_cycles: undefined,
    subscription_schedule_modes: ['dates', 'cycles', 'pick_dates', 'weekly', 'recurring'],
    is_active: true,
  })

  const generateVariantsFromOptions = () => {
    const validRows = optionRows.filter(r => r.name.trim() && r.values.trim())
    if (validRows.length === 0) {
      toast.error('Add at least one option with a name and values')
      return
    }

    const existingNames = new Set(
      (getValues('variants') || []).map((v: { name?: string }) => (v.name || '').toLowerCase().trim())
    )

    // Check if rows should create individual variants (each row = 1 variant)
    // or combinations (cartesian product across option dimensions)
    // Individual: all rows have single values (no commas)
    // Combinations: at least one row has multiple comma-separated values,
    //   OR multiple rows share the same option name
    const nameCount = new Map<string, number>()
    for (const row of validRows) {
      const key = row.name.trim().toLowerCase()
      nameCount.set(key, (nameCount.get(key) || 0) + 1)
    }
    const hasMultiValues = validRows.some(r => r.values.includes(','))
    const hasSharedNames = [...nameCount.values()].some(c => c > 1)
    const useCombinations = hasMultiValues || hasSharedNames

    let added = 0
    let skipped = 0

    if (useCombinations) {
      // Merge rows with same name, then cartesian product
      const merged = new Map<string, string[]>()
      for (const row of validRows) {
        const key = row.name.trim()
        const vals = row.values.split(',').map(v => v.trim()).filter(Boolean)
        const existing = merged.get(key) || []
        merged.set(key, [...existing, ...vals])
      }
      const keys = [...merged.keys()]
      const valueArrays = keys.map(k => [...new Set(merged.get(k)!)])
      if (valueArrays.some(a => a.length === 0)) {
        toast.error('Each option must have at least one value')
        return
      }
      const combos = cartesianProduct(valueArrays)
      for (const combo of combos) {
        const attrs: Record<string, string> = {}
        keys.forEach((k, i) => { attrs[k] = combo[i] })
        const name = combo.join(' / ')
        if (existingNames.has(name.toLowerCase().trim())) { skipped++; continue }
        existingNames.add(name.toLowerCase().trim())
        appendVariant(makeVariantDefaults(name, attrs))
        added++
      }
    } else {
      // Each row generates its own individual variant
      for (const row of validRows) {
        const optName = row.name.trim()
        const val = row.values.trim()
        if (existingNames.has(val.toLowerCase())) { skipped++; continue }
        existingNames.add(val.toLowerCase())
        appendVariant(makeVariantDefaults(val, { [optName]: val }))
        added++
      }
    }

    if (added > 0) {
      const startIdx = variantFields.length
      const expanded: Record<number, boolean> = {}
      for (let i = 0; i < added; i++) expanded[startIdx + i] = true
      setExpandedVariants(p => ({ ...p, ...expanded }))
    }
    if (skipped > 0 && added > 0) {
      toast.success(`Added ${added} variant(s), skipped ${skipped} duplicate(s)`)
    } else if (skipped > 0) {
      toast.info(`All ${skipped} variant(s) already exist — nothing added`)
    } else {
      toast.success(`Added ${added} variant row(s)`)
    }
  }

  if (isEdit && isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>

  if (isViewMode && isEdit && product) {
    return (
      <ProductDisplay
        product={product}
        onEdit={() => setIsViewMode(false)}
        onBack={() => navigate('/products')}
        priceRules={priceRules as any[]}
        merchMappings={merchMappings}
        allProducts={allProducts}
      />
    )
  }

  const isSaving = createProduct.isPending || updateProduct.isPending
  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-b shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/products')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
            <h1 className="text-xl font-bold">{isEdit ? 'Edit Product' : 'New Product'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Controller name="status" control={control} render={({ field }) => (
              <select
                value={field.value}
                onChange={field.onChange}
                className={`h-9 rounded-md border px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  field.value === 'active' ? 'border-green-300 bg-green-50 text-green-700' :
                  field.value === 'archived' ? 'border-red-300 bg-red-50 text-red-600' :
                  'border-gray-300 bg-gray-50 text-gray-700'
                }`}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            )} />
            <Controller name="is_visible" control={control} render={({ field }) => (
              <Toggle label="Visible" checked={field.value} onChange={field.onChange} />
            )} />
            <Button
              type="button"
              onClick={handleSubmit(onSubmit, (validationErrors) => {
                const firstField = Object.keys(validationErrors)[0]
                const firstErr = (validationErrors as Record<string, { message?: string }>)[firstField]
                toast.error(`Validation: ${firstField} — ${firstErr?.message || 'invalid'}`)
              })}
              disabled={isSaving}
              size="sm"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {isEdit ? 'Save Product' : 'Create Product'}
            </Button>
          </div>
        </div>
      </div>

      {/* Media card for EDIT mode (outside form — instant upload) */}
      {isEdit && product && (
        <Card><div className="p-6"><h3 className="font-semibold mb-3">Media</h3>
          <ProductImageUpload images={product.images || []} onUpload={handleUpload} onDelete={handleDelete} onSetPrimary={handleSetPrimary} />
        </div></Card>
      )}

      {/* ── Form ──────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit, (validationErrors) => {
        toast.error('Please fix the form errors before saving')
        const firstField = Object.keys(validationErrors)[0]
        const firstErr = (validationErrors as Record<string, { message?: string }>)[firstField]
        toast.error(`Validation: ${firstField} — ${firstErr?.message || 'invalid'}`)
      })} className="space-y-3">

        {/* 1. Basic Information */}
        <Section title="Basic Information" icon={Package} open={openSections.basic ?? true} onToggle={() => toggle('basic')} surface="product">
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" required error={errors.name?.message}><Input {...register('name')} onChange={handleNameChange} placeholder="Product name" /></Field>
              <Field label="Slug" required error={errors.slug?.message}><Input {...register('slug')} placeholder="product-slug" readOnly={isEdit} className={isEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Brand"><Input {...register('brand')} placeholder="e.g. Samsung" /></Field>
              <Field label="Product Type">
                <select {...register('product_type')} className={selectCls}>
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                  <option value="subscription">Subscription</option>
                  <option value="bundle">Bundle</option>
                </select>
              </Field>
            </div>
            {/* Product type context banner */}
            {productType && productType !== 'physical' && (
              <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                isDigitalType ? 'bg-blue-50 border-blue-200 text-blue-800' :
                isSubscriptionType ? 'bg-accent border-primary/30 text-primary' :
                isBundleType ? 'bg-amber-50 border-amber-200 text-amber-800' : ''
              }`}>
                {isDigitalType && <Download className="w-4 h-4 mt-0.5 shrink-0" />}
                {isSubscriptionType && <Repeat className="w-4 h-4 mt-0.5 shrink-0" />}
                {isBundleType && <ShoppingBag className="w-4 h-4 mt-0.5 shrink-0" />}
                <div>
                  {isDigitalType && <><strong>Digital Product:</strong> Shipping, inventory, and return sections are hidden. Add download URL and access limits in the Digital Product section below.</>}
                  {isSubscriptionType && <><strong>Subscription Product:</strong> Each plan/variant carries its own billing interval, per-cycle price, trial period &amp; setup fee. The end user can select their preferred plan on the business front.</>}
                  {isBundleType && <><strong>Bundle Product:</strong> Variants are replaced by the Bundle Items section — select products to include. Add download details if the bundle is digital.</>}
                </div>
              </div>
            )}
            <Field label="Short Description">
              <textarea {...register('short_description')} rows={2} className={textareaCls} placeholder="Brief summary (max 500 chars)" maxLength={500} />
            </Field>
            <Field label="Description">
              <textarea {...register('description')} rows={4} className={textareaCls} placeholder="Detailed product description..." />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Category</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs text-blue-600 hover:text-blue-700"
                    onClick={() => {
                      setShowCreateCategory((v) => !v)
                      if (showCreateCategory) setNewCategoryName('')
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    {showCreateCategory ? 'Cancel' : 'Create category'}
                  </Button>
                </div>
                {showCreateCategory && (
                  <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/70 p-3 space-y-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New category name"
                      className="h-9 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void handleQuickCreateCategory()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      disabled={createCategory.isPending}
                      onClick={() => void handleQuickCreateCategory()}
                    >
                      {createCategory.isPending ? 'Creating…' : 'Create & select'}
                    </Button>
                  </div>
                )}
                <select {...register('category')} className={selectCls}
                  onChange={e => { register('category').onChange(e); setValue('subcategory', '') }}
                >
                  <option value="">Select category</option>
                  {productCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <Field label="Subcategory">
                {(() => {
                  const selectedCat = productCategories.find(c => c.name === watchedCategory)
                  const subs = (selectedCat?.children || []).filter(s => s.applies_to === 'product' || s.applies_to === 'both')
                  return subs.length > 0 ? (
                    <select {...register('subcategory')} className={selectCls}>
                      <option value="">Select subcategory</option>
                      {subs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  ) : (
                    <Input {...register('subcategory')} placeholder="e.g. Smartphones" />
                  )
                })()}
              </Field>
            </div>
            {(() => {
              const selectedCat = productCategories.find(c => c.name === watchedCategory)
              const selectedSub = (selectedCat?.children || []).find(s => s.name === watchedSubcategory)
              const catFields = selectedCat?.custom_fields || []
              const subFields = selectedSub?.custom_fields || []
              const allFields = [...catFields, ...subFields]
              if (allFields.length === 0) return null
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Category Attributes</p>
                  <div className="grid grid-cols-2 gap-3">
                    {allFields.map((f, i) => (
                      <div key={`cf-${i}`} className="space-y-1">
                        <Label className="text-xs">{f.name} {f.required && <span className="text-red-500">*</span>}</Label>
                        {f.type === 'select' || f.type === 'multiselect' ? (
                          <select className={selectCls + ' h-9 text-sm'}>
                            <option value="">Select {f.name}</option>
                            {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : f.type === 'boolean' ? (
                          <select className={selectCls + ' h-9 text-sm'}>
                            <option value="">Select</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <Input type={f.type === 'number' ? 'number' : 'text'} placeholder={f.name} className="h-9 text-sm" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
            <Field label="Tags (comma separated)"><Input {...register('tags')} placeholder="tag1, tag2, tag3" /></Field>
            {/* SKU & Barcode — visible for all non-bundle products so users can always set the product-level barcode */}
            {!isBundleType && (
              <div className="grid grid-cols-3 gap-4">
                <Field label="SKU"><Input {...register('sku')} placeholder="e.g. PROD-001" /></Field>
                <Field label="Barcode"><Input {...register('barcode')} placeholder="e.g. 1234567890123" /></Field>
                <Field label="HSN Code"><Input {...register('hsn_code')} placeholder="e.g. 85171300" maxLength={8} /></Field>
              </div>
            )}
          </div>
        </Section>

        {/* ── Media (new product only — staged until product is created) ── */}
        {!isEdit && (
          <Card>
            <div className="p-6">
              <h3 className="font-semibold mb-1">Media</h3>
              <p className="text-xs text-gray-400 mb-3">Images, videos &amp; 3D models — uploaded after product is created</p>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={e => { e.preventDefault(); addPendingFiles(e.dataTransfer.files) }}
                onDragOver={e => e.preventDefault()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">Click or drag files here</p>
                <div className="flex items-center justify-center gap-3 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Eye className="w-3 h-3" />Images</span>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Film className="w-3 h-3" />Videos</span>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Box className="w-3 h-3" />3D Models</span>
                </div>
                <p className="text-xs text-gray-300 mt-1">Images: 5 MB · Videos: 50 MB · 3D (GLB/GLTF): 30 MB</p>
                <input ref={fileInputRef} type="file" multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.glb,.gltf"
                  className="hidden"
                  onChange={e => { addPendingFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = '' }} />
              </div>
              {pendingFiles.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mt-4">
                  {pendingFiles.map((file, i) => {
                    const mt = getMediaType(file)
                    return (
                      <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border bg-gray-50">
                        {mt === 'video' ? (
                          <video src={pendingPreviews[i]} className="w-full h-full object-cover" muted />
                        ) : mt === 'model3d' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-600">
                            <Box className="w-10 h-10" />
                            <span className="text-xs mt-1 font-medium">{file.name.split('.').pop()?.toUpperCase()}</span>
                          </div>
                        ) : (
                          <img src={pendingPreviews[i]} alt="" className="w-full h-full object-cover" />
                        )}
                        {mt === 'video' && <span className="absolute top-1 right-1 bg-primary text-white text-xs px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5"><Film className="w-2.5 h-2.5" />Video</span>}
                        {mt === 'model3d' && <span className="absolute top-1 right-1 bg-cyan-600 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5"><Box className="w-2.5 h-2.5" />3D</span>}
                        <button type="button" onClick={() => removePendingFile(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                        {i === 0 && mt === 'image' && <span className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full font-semibold">Primary</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* 4b. Variants — not applicable for bundle (bundle = set of other products) */}
        {!isBundleType && (
          <Section
            title={isSubscriptionType ? 'Subscription Plans' : 'Variants & Options'}
            icon={isSubscriptionType ? Repeat : Layers}
            open={!!openSections.variants}
            onToggle={() => toggle('variants')}
            surface="variants"
            surfaceHint={isSubscriptionType ? 'Plan tiers & pricing' : undefined}
          >
          <div className="space-y-4 pt-4">
            <p className="text-sm text-gray-600">
              {isSubscriptionType
                ? 'Each variant represents a subscription plan tier. Set the per-cycle price on each plan.'
                : 'Each variant has its own UOM, pricing, discount, and stock. Add SKUs for each size, color, or other combination the vendor offers.'}
            </p>
            {!isSubscriptionType && <div className="rounded-lg border bg-gray-50/80 p-4 space-y-3">
              <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Generate from options</p>
              <p className="text-xs text-gray-500">Define option names and their values. All combinations will be created as variant rows.</p>
              <div className="space-y-2">
                {(() => {
                  const allVariants = watchedVariants || []
                  const claimed = new Set<number>()

                  // Build rows with their variant numbers
                  const rowsWithNums = optionRows.map((row, i) => {
                    let variantNum: number | null = null
                    if (row.name.trim() && row.values.trim()) {
                      const optKey = row.name.trim().toLowerCase()
                      const optVal = row.values.trim()
                      for (let vi = 0; vi < allVariants.length; vi++) {
                        if (claimed.has(vi)) continue
                        try {
                          const attrs = allVariants[vi].attributes_json ? JSON.parse(allVariants[vi].attributes_json as string) : {}
                          const matchKey = Object.keys(attrs).find(k => k.toLowerCase() === optKey)
                          if (matchKey && attrs[matchKey] === optVal) { variantNum = vi + 1; claimed.add(vi); break }
                        } catch { /* */ }
                      }
                    }
                    return { row, originalIndex: i, variantNum }
                  })

                  // Sort: matched rows by variant number, unmatched at the end
                  rowsWithNums.sort((a, b) => {
                    if (a.variantNum && b.variantNum) return a.variantNum - b.variantNum
                    if (a.variantNum) return -1
                    if (b.variantNum) return 1
                    return a.originalIndex - b.originalIndex
                  })

                  return rowsWithNums.map(({ row, originalIndex: i, variantNum }) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                      variantNum ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>{variantNum ?? '—'}</span>
                    <div className="w-1/3">
                      <Input
                        value={row.name}
                        onChange={e => updateOptionRow(i, 'name', e.target.value)}
                        placeholder="Option name (e.g. Size)"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        value={row.values}
                        onChange={e => updateOptionRow(i, 'values', e.target.value)}
                        placeholder="Values, comma separated (e.g. S, M, L, XL)"
                        className="h-9 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 text-indigo-500 hover:text-indigo-700"
                      title="Copy option"
                      onClick={() => setOptionRows(prev => [...prev, { name: row.name, values: `${row.values} (copy)` }])}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    {confirmDeleteOption === i ? (
                      <div className="flex items-center gap-1">
                        <Button type="button" size="sm" className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => { removeOptionRow(i); setConfirmDeleteOption(null) }}>
                          Yes
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirmDeleteOption(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 px-2 text-red-500 hover:text-red-700"
                        onClick={() => setConfirmDeleteOption(i)}
                        disabled={optionRows.length <= 1}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  ))
                })()}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addOptionRow}>
                  <Plus className="w-3 h-3 mr-1" />Add option
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={generateVariantsFromOptions}>
                  Generate variant rows
                </Button>
              </div>
            </div>}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  appendVariant(makeVariantDefaults('', {}))
                  setExpandedVariants(p => ({ ...p, [variantFields.length]: true }))
                }}
              >
                <Plus className="w-4 h-4 mr-1" />{isSubscriptionType ? 'Add plan' : 'Add variant'}
              </Button>
            </div>
            {variantFields.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6 border border-dashed rounded-lg">{isSubscriptionType ? 'No plans yet — add at least one subscription plan with a per-cycle price.' : 'No variants yet — optional if you sell a single SKU only.'}</p>
            ) : (
              <div className="space-y-4">
                {variantFields.map((vf, index) => {
                  const isActive = watch(`variants.${index}.is_active`)
                  const isExpanded = expandedVariants[index] ?? false
                  const variantName = watch(`variants.${index}.name`)
                  return (
                  <div key={vf.id} className={`rounded-xl shadow-md transition-all duration-200 ${
                    isActive
                      ? 'border-2 border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30'
                      : 'border-2 border-gray-300 bg-gray-50 opacity-70'
                  }`}>
                    {/* Collapsible header */}
                    <div
                      className={`flex items-center justify-between gap-3 px-5 py-3 cursor-pointer select-none rounded-t-xl ${
                        isActive ? 'hover:bg-indigo-50/50' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => toggleVariant(index)}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                          isActive ? 'bg-indigo-600 text-white' : 'bg-gray-400 text-white'
                        }`}>{index + 1}</span>
                        <span className={`text-base font-semibold ${isActive ? 'text-gray-800' : 'text-gray-500'}`}>{isSubscriptionType ? 'Plan' : 'Variant'} {index + 1}</span>
                        {watch(`variants.${index}.color`) && (
                          <span
                            className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
                            style={{ backgroundColor: watch(`variants.${index}.color`) }}
                          />
                        )}
                        {variantName && (
                          <span className={`text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>— {variantName}</span>
                        )}
                        {!isActive && (
                          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Inactive</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        <Controller
                          name={`variants.${index}.is_active`}
                          control={control}
                          render={({ field }) => (
                            <Toggle label="Active" checked={field.value} onChange={field.onChange} />
                          )}
                        />
                        <Button type="button" variant="ghost" size="sm" className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 h-8" title="Copy variant" onClick={(e) => {
                          e.preventDefault()
                          copyVariant(index)
                        }}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        {confirmDeleteVariant === index ? (
                          <div className="flex items-center gap-1">
                            <Button type="button" size="sm" className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={(e) => { e.preventDefault(); removeVariant(index); setConfirmDeleteVariant(null) }}>
                              Delete
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.preventDefault(); setConfirmDeleteVariant(null) }}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8" title="Delete variant" onClick={(e) => { e.preventDefault(); setConfirmDeleteVariant(index) }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                    {/* Collapsible body */}
                    {isExpanded && (
                    <div className={`px-4 pb-4 pt-2 space-y-3 border-t ${isActive ? 'border-indigo-100' : 'border-gray-200'}`}>
                    {/* Identity */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Field label="Label" error={(errors.variants as unknown as { [k: number]: { name?: { message?: string } } })?.[index]?.name?.message}>
                        <Input {...register(`variants.${index}.name`, {
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                            const newName = e.target.value
                            const variants = getValues('variants') || []
                            const v = variants[index]
                            if (!v) return
                            let attrs: Record<string, string> = {}
                            try { attrs = v.attributes_json ? JSON.parse(v.attributes_json as string) : {} } catch { /* */ }
                            const attrKeys = Object.keys(attrs)
                            if (attrKeys.length === 1) {
                              const optKey = attrKeys[0]
                              const oldVal = attrs[optKey]
                              attrs[optKey] = newName
                              setValue(`variants.${index}.attributes_json`, JSON.stringify(attrs))
                              // Update the matching option row
                              setOptionRows(prev => prev.map(r => {
                                if (r.name.trim().toLowerCase() === optKey.toLowerCase() && r.values.trim() === oldVal) {
                                  return { ...r, values: newName }
                                }
                                return r
                              }))
                            } else if (attrKeys.length > 1) {
                              const parts = newName.split('/').map((p: string) => p.trim())
                              attrKeys.forEach((key, ki) => {
                                if (parts[ki] !== undefined) {
                                  const oldVal = attrs[key]
                                  attrs[key] = parts[ki]
                                  setOptionRows(prev => prev.map(r => {
                                    if (r.name.trim().toLowerCase() === key.toLowerCase() && r.values.trim() === oldVal) {
                                      return { ...r, values: parts[ki] }
                                    }
                                    return r
                                  }))
                                }
                              })
                              setValue(`variants.${index}.attributes_json`, JSON.stringify(attrs))
                            }
                          }
                        })} placeholder="e.g. S / Red" />
                      </Field>
                      <Field label="SKU"><Input {...register(`variants.${index}.sku`)} placeholder="Optional" /></Field>
                      <Field label="Barcode"><Input {...register(`variants.${index}.barcode`)} placeholder="Optional" /></Field>
                      <Field label="UOM">
                        <select {...register(`variants.${index}.uom`)} className={selectCls}>
                          {UOM_GROUPS.map(group => (
                            <optgroup key={group} label={group}>
                              {UOM_OPTIONS.filter(u => u.group === group).map(u => (
                                <option key={u.value} value={u.value}>{u.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </Field>
                    </div>
                    {/* Color — compact: swatch + input inline */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium text-gray-500 shrink-0">Color</Label>
                      <input
                        type="color"
                        value={watch(`variants.${index}.color`) || '#ffffff'}
                        onChange={e => setValue(`variants.${index}.color`, e.target.value)}
                        className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0.5 shrink-0"
                      />
                      <Input
                        {...register(`variants.${index}.color`)}
                        placeholder="#hex or name"
                        className="h-8 text-xs w-28"
                      />
                      {[
                        { n: 'Red', h: '#EF4444' }, { n: 'Blue', h: '#3B82F6' }, { n: 'Green', h: '#22C55E' },
                        { n: 'Yellow', h: '#EAB308' }, { n: 'Purple', h: '#A855F7' }, { n: 'Black', h: '#111827' },
                        { n: 'White', h: '#FFFFFF' }, { n: 'Gray', h: '#6B7280' },
                      ].map(c => (
                        <button key={c.h} type="button" title={c.n}
                          className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 shrink-0 ${
                            watch(`variants.${index}.color`)?.toLowerCase() === c.h.toLowerCase()
                              ? 'border-indigo-600 ring-2 ring-indigo-300 scale-110' : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: c.h }}
                          onClick={() => setValue(`variants.${index}.color`, c.h)}
                        />
                      ))}
                    </div>
                    {/* ── Subscription Billing + Price basis (compact) ── */}
                    {isSubscriptionType && (
                      <div className="pt-2 border-t border-primary/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-primary uppercase tracking-wider flex items-center gap-1">
                            <Repeat className="w-3 h-3" />Billing
                          </p>
                          <div className="inline-flex rounded border border-primary/30 overflow-hidden text-xs">
                            <button type="button"
                              className={`px-2.5 py-1 font-medium ${watch(`variants.${index}.price_type`) === 'per_cycle' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-accent'}`}
                              onClick={() => setValue(`variants.${index}.price_type`, 'per_cycle')}
                            >Per Cycle</button>
                            <button type="button"
                              className={`px-2.5 py-1 font-medium ${watch(`variants.${index}.price_type`) === 'per_unit' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-accent'}`}
                              onClick={() => setValue(`variants.${index}.price_type`, 'per_unit')}
                            >Per UOM</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <Field label="Interval">
                            <select {...register(`variants.${index}.subscription_interval`)} className={selectCls}>
                              <option value="">Select…</option>
                              <option value="daily">Daily</option><option value="weekly">Weekly</option>
                              <option value="biweekly">Bi-Weekly</option><option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option><option value="biannual">Half-Yearly</option>
                              <option value="yearly">Yearly</option>
                            </select>
                          </Field>
                          <Field label="Max Cycles"><Input type="number" min="0" {...register(`variants.${index}.subscription_billing_cycles`)} placeholder="0 = ∞" /></Field>
                          <Field label="Trial (days)"><Input type="number" min="0" {...register(`variants.${index}.subscription_trial_days`)} placeholder="14" /></Field>
                          <Field label="Setup Fee"><Input type="number" step="0.01" min="0" {...register(`variants.${index}.subscription_setup_fee`)} placeholder="99" /></Field>
                        </div>
                        {/* Schedule modes allowed for customers */}
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1.5">Customer scheduling options</p>
                          <div className="flex flex-wrap gap-1.5">
                            {([
                              { id: 'dates', label: 'Date Range' },
                              { id: 'cycles', label: 'Cycles' },
                              { id: 'pick_dates', label: 'Pick Dates' },
                              { id: 'weekly', label: 'Weekly' },
                              { id: 'recurring', label: 'Recurring' },
                            ] as const).map(opt => {
                              const modes: string[] = watch(`variants.${index}.subscription_schedule_modes`) || ['dates', 'cycles', 'pick_dates', 'weekly', 'recurring']
                              const active = modes.includes(opt.id)
                              return (
                                <button key={opt.id} type="button"
                                  onClick={() => {
                                    const next = active ? modes.filter(m => m !== opt.id) : [...modes, opt.id]
                                    if (next.length === 0) return
                                    setValue(`variants.${index}.subscription_schedule_modes`, next)
                                  }}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                    active
                                      ? 'bg-primary text-white border-primary'
                                      : 'bg-white text-gray-400 border-gray-200 hover:border-primary/40 hover:text-primary'
                                  }`}>
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* ── Pricing + Discount (merged, compact) ── */}
                    {(() => {
                      const vPriceType = watch(`variants.${index}.price_type`) || 'per_unit'
                      const vUom = watch(`variants.${index}.uom`) || 'piece'
                      const uomLbl = UOM_OPTIONS.find(u => u.value === vUom)?.label || vUom
                      const priceLabel = isSubscriptionType
                        ? (vPriceType === 'per_cycle' ? 'Price / Cycle' : `Price / ${uomLbl}`)
                        : `Price / ${uomLbl}`
                      // Pure derived display values — NO setValue here to avoid infinite loops
                      const price     = parseFloat(String(watch(`variants.${index}.price`) || 0))
                      const compareAt = parseFloat(String(watch(`variants.${index}.compare_at_price`) || 0))
                      const cost      = parseFloat(String(watch(`variants.${index}.cost_price`) || 0))
                      const discPct   = parseFloat(String(watch(`variants.${index}.discount_percentage`) || 0))
                      const discAmt   = parseFloat(String(watch(`variants.${index}.discount_amount`) || 0))
                      const promoStart = watch(`variants.${index}.discount_start_date` as any) as string | undefined
                      const promoEnd   = watch(`variants.${index}.discount_end_date` as any) as string | undefined
                      const autoDiscPct = (compareAt > 0 && price >= 0 && compareAt > price)
                        ? parseFloat(((compareAt - price) / compareAt * 100).toFixed(2)) : 0
                      const autoDiscAmt = (compareAt > 0 && price >= 0 && compareAt > price)
                        ? parseFloat((compareAt - price).toFixed(2)) : 0
                      const profit = (price > 0 && cost > 0) ? price - cost : null
                      const margin = profit != null ? (profit / price * 100) : null
                      const hasDiscount = discPct > 0 || discAmt > 0

                      // Helper: recompute and setValue after a price input changes
                      const syncPriceFields = (newPrice: number, newCompareAt: number) => {
                        if (newCompareAt > 0 && newPrice >= 0 && newCompareAt > newPrice) {
                          const pct = parseFloat(((newCompareAt - newPrice) / newCompareAt * 100).toFixed(2))
                          const amt = parseFloat((newCompareAt - newPrice).toFixed(2))
                          setValue(`variants.${index}.discount_percentage`, pct)
                          setValue(`variants.${index}.discount_amount`, amt)
                          setValue(`variants.${index}.is_on_sale`, true)
                          const lbl = watch(`variants.${index}.offer_label`) || ''
                          const dateStr = (promoStart && promoEnd)
                            ? ` · Valid ${new Date(promoStart).toLocaleDateString('en-IN',{ day:'2-digit',month:'short' })}–${new Date(promoEnd).toLocaleDateString('en-IN',{ day:'2-digit',month:'short' })}`
                            : ''
                          if (lbl === '' || /^\d/.test(lbl)) {
                            setValue(`variants.${index}.offer_label`, `${pct.toFixed(1)}% OFF${dateStr}`)
                          }
                        }
                      }
                      return (
                        <>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            <Field label={priceLabel} error={(errors.variants as unknown as { [k: number]: { price?: { message?: string } } })?.[index]?.price?.message}>
                              <Input type="number" step="0.01" min="0"
                                {...register(`variants.${index}.price`)}
                                onChange={e => {
                                  register(`variants.${index}.price`).onChange(e)
                                  syncPriceFields(parseFloat(e.target.value||'0'), parseFloat(String(watch(`variants.${index}.compare_at_price`)||0)))
                                }}
                                placeholder={isSubscriptionType && vPriceType === 'per_cycle' ? '499' : '99'} />
                            </Field>
                            <Field label="Compare at">
                              <Input type="number" step="0.01" min="0"
                                {...register(`variants.${index}.compare_at_price`)}
                                onChange={e => {
                                  register(`variants.${index}.compare_at_price`).onChange(e)
                                  syncPriceFields(parseFloat(String(watch(`variants.${index}.price`)||0)), parseFloat(e.target.value||'0'))
                                }} />
                            </Field>
                            <Field label="Cost"><Input type="number" step="0.01" min="0" {...register(`variants.${index}.cost_price`)} /></Field>
                            <Field label="Disc %">
                              <Input type="number" step="0.01" min="0" max="100" {...register(`variants.${index}.discount_percentage`)} placeholder="0" />
                            </Field>
                            <Field label="Disc Amt"><Input type="number" step="0.01" min="0" {...register(`variants.${index}.discount_amount`)} placeholder="0" /></Field>
                            <Field label="Currency">
                              <select {...register(`variants.${index}.currency`)} className={selectCls}>
                                <option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                              </select>
                            </Field>
                          </div>
                          {/* ── Live price metrics ── */}
                          {(profit != null || autoDiscPct > 0 || compareAt > 0) && (
                            <div className="flex items-center gap-3 flex-wrap mt-1">
                              {autoDiscPct > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                  <Tag className="w-3 h-3" />{autoDiscPct.toFixed(1)}% OFF
                                  {compareAt > 0 && <span className="font-normal opacity-70 ml-1">vs ₹{compareAt.toLocaleString()}</span>}
                                </span>
                              )}
                              {profit != null && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${profit >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                  <BarChart3 className="w-3 h-3" />
                                  {profit >= 0 ? 'Profit' : 'Loss'}: ₹{Math.abs(profit).toLocaleString()}
                                  {margin != null && <span className="font-normal opacity-80 ml-0.5">({margin.toFixed(1)}%)</span>}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )
                    })()}
                    {/* Offer label + promo dates — visible when a discount is active */}
                    {(parseFloat(String(watch(`variants.${index}.discount_percentage`) || 0)) > 0 || parseFloat(String(watch(`variants.${index}.discount_amount`) || 0)) > 0) && (() => {
                      const pStart = watch(`variants.${index}.discount_start_date` as any) as string | undefined
                      const pEnd   = watch(`variants.${index}.discount_end_date` as any) as string | undefined
                      const pDisc  = parseFloat(String(watch(`variants.${index}.discount_percentage`) || 0))
                      const pAmt   = parseFloat(String(watch(`variants.${index}.discount_amount`) || 0))
                      const hasDates = !!(pStart && pEnd)
                      return (
                        <div className="space-y-2 p-3 bg-orange-50/50 border border-orange-100 rounded-lg">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-orange-600 uppercase tracking-wide flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Promotional Discount
                            </p>
                            {/* Live discount summary */}
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {pDisc > 0 && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                                  {pDisc.toFixed(1)}% OFF
                                </span>
                              )}
                              {pAmt > 0 && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                                  ₹{pAmt.toLocaleString()} OFF
                                </span>
                              )}
                              {hasDates && (
                                <span className="text-xs text-orange-600 px-2 py-0.5 rounded-full bg-white border border-orange-200">
                                  {new Date(pStart!).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })} → {new Date(pEnd!).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Field label="Offer Label">
                              <Input
                                {...register(`variants.${index}.offer_label`)}
                                placeholder={pDisc > 0 ? `${pDisc.toFixed(1)}% OFF` : '"Flash Sale"'}
                              />
                            </Field>
                            <Field label="Promo Start">
                              <Input type="datetime-local" {...register(`variants.${index}.discount_start_date` as any)} />
                            </Field>
                            <Field label="Promo End">
                              <Input type="datetime-local" {...register(`variants.${index}.discount_end_date` as any)} />
                            </Field>
                          </div>
                          {hasDates && (
                            <p className="text-xs text-orange-600 flex items-center gap-1.5">
                              <Clock className="w-3 h-3 shrink-0" />
                              Offer valid from <strong>{new Date(pStart!).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</strong> to <strong>{new Date(pEnd!).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</strong>
                            </p>
                          )}
                        </div>
                      )
                    })()}
                    {/* ── Tax (compact row) ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                      <Field label="Tax %"><Input type="number" step="0.01" min="0" max="100" {...register(`variants.${index}.tax_rate`)} placeholder="0" /></Field>
                      <Field label="GST %"><Input type="number" step="0.01" min="0" max="100" {...register(`variants.${index}.gst_rate`)} placeholder="0" /></Field>
                      <Field label="HSN"><Input {...register(`variants.${index}.hsn_code`)} placeholder="85171290" maxLength={8} /></Field>
                      <div className="flex items-center pb-1.5">
                        <Controller name={`variants.${index}.is_taxable`} control={control} render={({ field }) => (
                          <Toggle label="Taxable" checked={field.value} onChange={field.onChange} />
                        )} />
                      </div>
                    </div>
                    {/* ── Inventory (compact) ── */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <Field label="Qty on hand">
                          <Input type="number" min="0" {...register(`variants.${index}.quantity`)}
                            className="border-indigo-200 bg-indigo-50/60 font-semibold" />
                        </Field>
                        <Field label="Low stock Alert at"><Input type="number" min="0" {...register(`variants.${index}.low_stock_threshold`)} /></Field>
                        <Field label="Status">
                          <select {...register(`variants.${index}.stock_status`)} className={selectCls}>
                            <option value="in_stock">In Stock</option><option value="out_of_stock">Out of Stock</option>
                            <option value="backorder">Backorder</option><option value="discontinued">Discontinued</option>
                          </select>
                        </Field>
                        <Field label="Reorder at"><Input type="number" min="0" {...register(`variants.${index}.reorder_point`)} /></Field>
                        <Field label="Weight (kg)"><Input type="number" step="0.001" min="0" placeholder="0.000" {...register(`variants.${index}.weight_kg`)} /></Field>
                      </div>
                    </div>
                    {/* ── Toggles (single compact row) ── */}
                    <div className="flex flex-wrap gap-4 pt-1">
                      <Controller name={`variants.${index}.track_inventory`} control={control} render={({ field }) => (
                        <Toggle label="Track Inventory" checked={field.value} onChange={field.onChange} />
                      )} />
                      <Controller name={`variants.${index}.allow_backorders`} control={control} render={({ field }) => (
                        <Toggle label="Backorders" checked={field.value} onChange={field.onChange} />
                      )} />
                      <Controller name={`variants.${index}.show_lifecycle`} control={control} render={({ field }) => (
                        <Toggle label="Lifecycle" checked={field.value} onChange={field.onChange} />
                      )} />
                      {watch('return_warranty_per_variant') && (
                        <Controller name={`variants.${index}.show_return_warranty`} control={control} render={({ field }) => (
                          <Toggle label="Return & Warranty" checked={field.value} onChange={field.onChange} />
                        )} />
                      )}
                    </div>
                    {/* Lifecycle dates — expandable */}
                    {watch(`variants.${index}.show_lifecycle`) && (
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Manufactured"><Input type="date" {...register(`variants.${index}.manufacture_date`)} /></Field>
                        <Field label="Expires"><Input type="date" {...register(`variants.${index}.expiration_date`)} /></Field>
                        <Field label="Best before"><Input type="date" {...register(`variants.${index}.best_before_date`)} /></Field>
                      </div>
                    )}
                    {/* Return & Warranty — expandable */}
                    {watch('return_warranty_per_variant') && watch(`variants.${index}.show_return_warranty`) && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <Field label="Return Window (days)"><Input type="number" min="0" {...register(`variants.${index}.return_days`)} placeholder="30" /></Field>
                          <Field label="Refund Policy">
                            <select {...register(`variants.${index}.refund_policy`)} className={selectCls}>
                              <option value="">Select...</option>
                              <option value="full_refund">Full Refund</option>
                              <option value="store_credit">Store Credit</option>
                              <option value="exchange_only">Exchange Only</option>
                            </select>
                          </Field>
                          <Field label="Warranty (days)"><Input type="number" min="0" {...register(`variants.${index}.warranty_period_days`)} /></Field>
                          <Field label="Warranty Type">
                            <select {...register(`variants.${index}.warranty_type`)} className={selectCls}>
                              <option value="">None</option>
                              <option value="manufacturer">Manufacturer</option>
                              <option value="vendor">Vendor</option>
                            </select>
                          </Field>
                        </div>
                        <Field label="Return Conditions"><Input {...register(`variants.${index}.return_conditions`)} placeholder='e.g. "Unopened, with tags"' className="max-w-lg" /></Field>
                      </div>
                    )}
                    {/* Hidden fields — keep form state but no visible UI */}
                    <input type="hidden" {...register(`variants.${index}.attributes_json`)} />
                    <input type="hidden" {...register(`variants.${index}.id`)} />

                    {/* ── Variant Media (existing variants — live upload) ── */}
                    {isEdit && watch(`variants.${index}.id`) && (
                      <VariantMediaSection
                        key={watch(`variants.${index}.id`)}
                        variantId={watch(`variants.${index}.id`) as string}
                        variantName={variantName || `Variant ${index + 1}`}
                        initialMedia={product?.variants?.find(v => v.id === watch(`variants.${index}.id`))?.media || []}
                        onChanged={() => qc.invalidateQueries({ queryKey: ['vendor', 'product', id] })}
                      />
                    )}

                    {/* ── Variant Media (new product — staged until saved) ── */}
                    {!isEdit && (() => {
                      const staged = pendingVariantMedia.get(index) || []
                      const addFiles = (files: FileList | null) => {
                        if (!files) return
                        const newItems = Array.from(files).map(f => ({ file: f, preview: URL.createObjectURL(f) }))
                        setPendingVariantMedia(prev => {
                          const next = new Map(prev)
                          next.set(index, [...(next.get(index) || []), ...newItems])
                          return next
                        })
                      }
                      const removeFile = (fi: number) => {
                        setPendingVariantMedia(prev => {
                          const next = new Map(prev)
                          const arr = [...(next.get(index) || [])]
                          URL.revokeObjectURL(arr[fi].preview)
                          arr.splice(fi, 1)
                          next.set(index, arr)
                          return next
                        })
                      }
                      return (
                        <div className="mt-4 pt-4 border-t border-indigo-100">
                          <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                            <Eye className="w-3.5 h-3.5" />Variant Media
                            <span className="font-normal text-gray-400 normal-case tracking-normal">(uploaded when product is saved)</span>
                          </p>
                          <label className="flex items-center gap-2 cursor-pointer w-fit">
                            <div className="flex items-center gap-1.5 border border-dashed border-indigo-300 rounded-lg px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <Upload className="w-3.5 h-3.5" />Add images / videos / 3D
                            </div>
                            <input type="file" multiple accept={MEDIA_ACCEPT} className="hidden" onChange={e => addFiles(e.target.files)} />
                          </label>
                          {staged.length > 0 && (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
                              {staged.map(({ file, preview }, fi) => {
                                const mt = getMediaType(file)
                                return (
                                  <div key={fi} className="relative group aspect-square rounded-lg overflow-hidden border bg-gray-50">
                                    {mt === 'video' ? (
                                      <video src={preview} className="w-full h-full object-cover" muted />
                                    ) : mt === 'model3d' ? (
                                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-600">
                                        <Box className="w-5 h-5" /><span className="text-[8px] mt-0.5">3D</span>
                                      </div>
                                    ) : (
                                      <img src={preview} alt="" className="w-full h-full object-cover" />
                                    )}
                                    {mt === 'video' && <span className="absolute bottom-0.5 right-0.5 bg-primary text-white text-[7px] px-1 rounded">VID</span>}
                                    {mt === 'model3d' && <span className="absolute bottom-0.5 right-0.5 bg-cyan-600 text-white text-[7px] px-1 rounded">3D</span>}
                                    {fi === 0 && mt === 'image' && <span className="absolute top-0.5 left-0.5 bg-yellow-400 text-yellow-900 text-[7px] px-1 rounded font-bold">Primary</span>}
                                    <button type="button" onClick={() => removeFile(fi)}
                                      className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        </Section>
        )}

        {/* ── Bundle Items (only for bundle product type) ─────── */}
        {isBundleType && (
          <Section title="Bundle Items" icon={ShoppingBag} open={!!openSections.bundle} onToggle={() => toggle('bundle')}>
            <div className="space-y-4 pt-4">
              <p className="text-sm text-gray-500">Select products to include in this bundle. Customers will receive all selected items as a set.</p>
              {allProducts.filter(p => !id || p.id !== id).length === 0 ? (
                <p className="text-sm text-gray-400 italic">No other products found. Create products first, then add them here.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {allProducts.filter(p => !id || p.id !== id).map(p => {
                    const checked = bundleItemIds.includes(p.id)
                    return (
                      <label key={p.id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${checked ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-transparent hover:bg-gray-100'}`}>
                        <input type="checkbox" checked={checked} onChange={e => setBundleItemIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))} className="rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
                          {p.category && <p className="text-xs text-gray-400">{p.category}</p>}
                        </div>
                        {checked && <span className="text-xs text-indigo-600 font-medium shrink-0">In bundle</span>}
                      </label>
                    )
                  })}
                </div>
              )}
              {bundleItemIds.length > 0 && (
                <p className="text-xs text-indigo-600 font-medium">{bundleItemIds.length} item{bundleItemIds.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>
          </Section>
        )}

        {/* 5c. Pricing & Inventory — bundle only (other types use variant-level pricing) */}
        {isBundleType && <Section title="Pricing & Inventory" icon={IndianRupee} open={openSections.pricing ?? true} onToggle={() => toggle('pricing')}>
          <div className="space-y-6 pt-4">

            {/* Base Pricing */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-indigo-500" />
                Base Pricing
                {isBundleType && <span className="text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Bundle total price</span>}
                {isSubscriptionType && <span className="text-xs font-normal text-primary bg-accent border border-primary/30 px-2 py-0.5 rounded-full">Per-cycle price &amp; billing config are on each plan</span>}
              </h4>
              {(() => {
                const bPrice     = parseFloat(String(watch('price') || 0))
                const bCompareAt = parseFloat(String(watch('compare_at_price') || 0))
                const bCost      = parseFloat(String(watch('cost_price') || 0))
                const bAutoDiscPct = (bCompareAt > 0 && bPrice >= 0 && bCompareAt > bPrice)
                  ? parseFloat(((bCompareAt - bPrice) / bCompareAt * 100).toFixed(2))
                  : 0
                const bProfit = (bPrice > 0 && bCost > 0) ? bPrice - bCost : null
                const bMargin = bProfit != null ? (bProfit / bPrice * 100) : null
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Field label="Price *" error={errors.price?.message}>
                        <Input type="number" step="0.01" min="0"
                          {...register('price')}
                          onChange={e => {
                            register('price').onChange(e)
                            syncBasePrices(parseFloat(e.target.value||'0'), parseFloat(String(watch('compare_at_price')||0)))
                          }}
                          placeholder="0.00" />
                      </Field>
                      <Field label="Compare At Price">
                        <Input type="number" step="0.01" min="0"
                          {...register('compare_at_price')}
                          onChange={e => {
                            register('compare_at_price').onChange(e)
                            syncBasePrices(parseFloat(String(watch('price')||0)), parseFloat(e.target.value||'0'))
                          }}
                          placeholder="Original / MRP" />
                      </Field>
                      <Field label="Cost Price"><Input type="number" step="0.01" min="0" {...register('cost_price')} placeholder="Your cost" /></Field>
                      <Field label="Currency">
                        <select {...register('currency')} className={selectCls}>
                          <option value="INR">INR ₹</option>
                          <option value="USD">USD $</option>
                          <option value="EUR">EUR €</option>
                          <option value="GBP">GBP £</option>
                        </select>
                      </Field>
                    </div>
                    {(bProfit != null || bAutoDiscPct > 0) && (
                      <div className="flex items-center gap-3 flex-wrap mt-2">
                        {bAutoDiscPct > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                            <Tag className="w-3.5 h-3.5" />{bAutoDiscPct.toFixed(1)}% OFF vs ₹{bCompareAt.toLocaleString()}
                          </span>
                        )}
                        {bProfit != null && (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${bProfit >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            <BarChart3 className="w-3.5 h-3.5" />
                            {bProfit >= 0 ? 'Profit' : 'Loss'}: ₹{Math.abs(bProfit).toLocaleString()} ({bMargin?.toFixed(1)}% margin)
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* SKU & Identification */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">SKU & Identification</h4>
              <div className="grid grid-cols-3 gap-4">
                <Field label="SKU"><Input {...register('sku')} placeholder="e.g. PROD-001" /></Field>
                <Field label="Barcode"><Input {...register('barcode')} placeholder="e.g. 1234567890123" /></Field>
                <Field label="Unit of Measure">
                  <select {...register('uom')} className={selectCls}>
                    <option value="piece">Piece</option>
                    <option value="kg">Kilogram</option>
                    <option value="g">Gram</option>
                    <option value="l">Litre</option>
                    <option value="ml">Millilitre</option>
                    <option value="m">Metre</option>
                    <option value="cm">Centimetre</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                    <option value="set">Set</option>
                    <option value="pair">Pair</option>
                    <option value="dozen">Dozen</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Sale & Discounts */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-500" /> Sale &amp; Discounts
              </h4>
              {(() => {
                // Pure derived display values — NO setValue here to avoid infinite re-renders
                const bP = parseFloat(String(watch('price') || 0))
                const bC = parseFloat(String(watch('compare_at_price') || 0))
                const bAutoDiscPct2 = (bC > 0 && bP > 0 && bC > bP) ? parseFloat(((bC - bP) / bC * 100).toFixed(2)) : 0
                const bAutoDiscAmt2 = (bC > 0 && bP > 0 && bC > bP) ? parseFloat((bC - bP).toFixed(2)) : 0
                const bPStart = watch('discount_start_date')
                const bPEnd   = watch('discount_end_date')

                return (
                  <div className="space-y-3">
                    {/* Amounts row */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Field label="Discount %">
                        <Input type="number" step="0.01" min="0" max="100" {...register('discount_percentage')} placeholder="Auto from price gap" />
                      </Field>
                      <Field label="Discount Amount">
                        <Input type="number" step="0.01" min="0" {...register('discount_amount')} placeholder="₹ off — auto-filled" />
                      </Field>
                      <Field label="Offer Label">
                        <Input {...register('offer_label')} placeholder={bAutoDiscPct2 > 0 ? `${bAutoDiscPct2.toFixed(1)}% OFF` : '"Diwali Sale"'} />
                      </Field>
                    </div>
                    {/* Discount summary badges */}
                    {(bAutoDiscPct2 > 0 || bAutoDiscAmt2 > 0) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {bAutoDiscPct2 > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                            <Tag className="w-3.5 h-3.5" />{bAutoDiscPct2.toFixed(1)}% OFF
                          </span>
                        )}
                        {bAutoDiscAmt2 > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            ₹{bAutoDiscAmt2.toLocaleString()} savings
                          </span>
                        )}
                      </div>
                    )}
                    {/* Promotional window */}
                    <div className="p-3 rounded-lg border border-orange-100 bg-orange-50/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-orange-700 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> Promotional Period
                        </span>
                        <Controller name="is_on_sale" control={control} render={({ field }) => (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Mark On Sale</span>
                            <button type="button" onClick={() => field.onChange(!field.value)}
                              className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${field.value ? 'bg-orange-500' : 'bg-gray-200'}`}>
                              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${field.value ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Promo Starts"><Input type="datetime-local" {...register('discount_start_date')} /></Field>
                        <Field label="Promo Ends"><Input type="datetime-local" {...register('discount_end_date')} /></Field>
                      </div>
                      {bPStart && bPEnd && (
                        <p className="text-xs text-orange-700 font-medium flex items-center gap-1.5 bg-white border border-orange-200 rounded-lg px-2.5 py-1.5">
                          <Clock className="w-3 h-3 shrink-0" />
                          {bAutoDiscPct2 > 0 ? `${bAutoDiscPct2.toFixed(1)}% OFF` : 'Offer'} valid from <strong>{new Date(bPStart).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</strong> to <strong>{new Date(bPEnd).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Tax */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Tax</h4>
              <div className="space-y-3">
                <Controller name="is_taxable" control={control} render={({ field }) => (
                  <Toggle label="Taxable" checked={field.value} onChange={field.onChange} />
                )} />
                {watch('is_taxable') && (
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Tax Rate (%)"><Input type="number" step="0.01" min="0" max="100" {...register('tax_rate')} placeholder="e.g. 18" /></Field>
                    <Field label="HSN Code"><Input {...register('hsn_code')} placeholder="e.g. 6204" /></Field>
                    <Field label="GST Rate (%)"><Input type="number" step="0.01" min="0" max="100" {...register('gst_rate')} placeholder="e.g. 18" /></Field>
                  </div>
                )}
              </div>
            </div>

            {/* Inventory — hidden for digital and bundle */}
            {!isDigitalType && !isBundleType && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-indigo-500" />
                  Inventory
                  <span className="text-xs font-normal text-gray-400">(product-level; set per variant in Variants section)</span>
                </h4>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-6">
                    <Controller name="track_inventory" control={control} render={({ field }) => (
                      <Toggle label="Track Inventory" checked={field.value} onChange={field.onChange} />
                    )} />
                    <Controller name="allow_backorders" control={control} render={({ field }) => (
                      <Toggle label="Allow Backorders" checked={field.value} onChange={field.onChange} />
                    )} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Quantity"><Input type="number" min="0" {...register('quantity')} placeholder="0" /></Field>
                    <Field label="Low Stock Alert (qty)"><Input type="number" min="0" {...register('low_stock_threshold')} placeholder="5" /></Field>
                    <Field label="Reorder Point"><Input type="number" min="0" {...register('reorder_point')} placeholder="e.g. 10" /></Field>
                    <Field label="Reorder Qty"><Input type="number" min="0" {...register('reorder_quantity')} placeholder="e.g. 50" /></Field>
                  </div>
                  <Field label="Stock Status">
                    <select {...register('stock_status')} className={selectCls}>
                      <option value="in_stock">In Stock</option>
                      <option value="out_of_stock">Out of Stock</option>
                      <option value="pre_order">Pre-Order</option>
                      <option value="discontinued">Discontinued</option>
                    </select>
                  </Field>
                </div>
              </div>
            )}
          </div>
        </Section>}

        {/* 5d. Advanced Pricing Rules — party, location, scheduled, quantity, channel */}
        {isEdit && id && (
          <Section title="Advanced Pricing" icon={DollarSign} open={!!openSections.advancedPricing} onToggle={() => toggle('advancedPricing')}>
            <div className="space-y-4 pt-4">
              {/* Rule type tabs */}
              <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
                {([
                  { type: 'party' as PriceRuleType, label: 'Party / Customer', icon: Users },
                  { type: 'location' as PriceRuleType, label: 'Location', icon: MapPin },
                  { type: 'scheduled' as PriceRuleType, label: 'Scheduled / Future', icon: Calendar },
                  { type: 'quantity' as PriceRuleType, label: 'Quantity Tiers', icon: Hash },
                  { type: 'channel' as PriceRuleType, label: 'Channel', icon: Radio },
                ]).map(tab => (
                  <button
                    key={tab.type} type="button"
                    onClick={() => { setPriceRuleTab(tab.type); setShowAddRule(false) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${priceRuleTab === tab.type ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Description per tab */}
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                {priceRuleTab === 'party' && 'Set special prices for specific customers or customer groups (e.g. Wholesale, VIP, Employee).'}
                {priceRuleTab === 'location' && 'Adjust prices based on geography — state, city, pincode, or region.'}
                {priceRuleTab === 'scheduled' && 'Schedule future price changes with start and end dates. Useful for upcoming sales, seasonal pricing, or price increases.'}
                {priceRuleTab === 'quantity' && 'Offer tiered pricing based on order quantity — e.g. buy 10+ at ₹90, buy 50+ at ₹80.'}
                {priceRuleTab === 'channel' && 'Different prices for sales channels — Online, POS, Wholesale, Marketplace.'}
              </div>

              {/* Existing rules table */}
              {(() => {
                const tabRules = (priceRules as ProductPriceRule[]).filter(r => r.rule_type === priceRuleTab)
                const symbol = watch('currency') === 'USD' ? '$' : watch('currency') === 'EUR' ? '€' : watch('currency') === 'GBP' ? '£' : '₹'
                return (
                  <>
                    {tabRules.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border">
                        <ResizableTable tableId={`product-form-price-rules-${priceRuleTab}`} defaultWidths={[150, 120, 90, 80, 80, 80]}>
                          <thead className="bg-gray-50 text-left">
                            <tr>
                              <th className="px-3 py-2 font-medium text-gray-600">Name</th>
                              {priceRuleTab === 'party' && <><th className="px-3 py-2 font-medium text-gray-600">Group</th></>}
                              {priceRuleTab === 'location' && <><th className="px-3 py-2 font-medium text-gray-600">State</th><th className="px-3 py-2 font-medium text-gray-600">City</th><th className="px-3 py-2 font-medium text-gray-600">Pincode</th></>}
                              {priceRuleTab === 'scheduled' && <><th className="px-3 py-2 font-medium text-gray-600">Start</th><th className="px-3 py-2 font-medium text-gray-600">End</th></>}
                              {priceRuleTab === 'quantity' && <><th className="px-3 py-2 font-medium text-gray-600">Min Qty</th><th className="px-3 py-2 font-medium text-gray-600">Max Qty</th></>}
                              {priceRuleTab === 'channel' && <th className="px-3 py-2 font-medium text-gray-600">Channel</th>}
                              <th className="px-3 py-2 font-medium text-gray-600">Price</th>
                              <th className="px-3 py-2 font-medium text-gray-600">Discount %</th>
                              <th className="px-3 py-2 font-medium text-gray-600">Active</th>
                              <th className="px-3 py-2 font-medium text-gray-600 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {tabRules.map(rule => (
                              <tr key={rule.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium">{rule.name}</td>
                                {priceRuleTab === 'party' && <td className="px-3 py-2 text-gray-600">{rule.customer_group || '—'}</td>}
                                {priceRuleTab === 'location' && <>
                                  <td className="px-3 py-2 text-gray-600">{rule.state || '—'}</td>
                                  <td className="px-3 py-2 text-gray-600">{rule.city || '—'}</td>
                                  <td className="px-3 py-2 text-gray-600">{rule.pincode || '—'}</td>
                                </>}
                                {priceRuleTab === 'scheduled' && <>
                                  <td className="px-3 py-2 text-gray-600">{rule.start_date ? new Date(rule.start_date).toLocaleDateString() : '—'}</td>
                                  <td className="px-3 py-2 text-gray-600">{rule.end_date ? new Date(rule.end_date).toLocaleDateString() : '—'}</td>
                                </>}
                                {priceRuleTab === 'quantity' && <>
                                  <td className="px-3 py-2 text-gray-600">{rule.min_quantity ?? '—'}</td>
                                  <td className="px-3 py-2 text-gray-600">{rule.max_quantity ?? '∞'}</td>
                                </>}
                                {priceRuleTab === 'channel' && <td className="px-3 py-2 text-gray-600 capitalize">{rule.channel || '—'}</td>}
                                <td className="px-3 py-2 font-medium">{rule.price != null ? `${symbol}${rule.price.toLocaleString()}` : '—'}</td>
                                <td className="px-3 py-2 text-gray-600">{rule.discount_percentage != null ? `${rule.discount_percentage}%` : '—'}</td>
                                <td className="px-3 py-2">
                                  <button type="button" onClick={() => updatePriceRule.mutate({ productId: id!, ruleId: rule.id, data: { is_active: !rule.is_active } })}
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {rule.is_active ? 'Active' : 'Inactive'}
                                  </button>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button type="button" onClick={() => { if (confirm('Delete this price rule?')) deletePriceRule.mutate({ productId: id!, ruleId: rule.id }) }}
                                    className="text-red-500 hover:text-red-700 p-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </ResizableTable>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No {priceRuleTab} pricing rules yet.</p>
                    )}
                  </>
                )
              })()}

              {/* Add new rule */}
              {!showAddRule ? (
                <Button type="button" variant="outline" onClick={() => setShowAddRule(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" /> Add {priceRuleTab.charAt(0).toUpperCase() + priceRuleTab.slice(1)} Pricing Rule
                </Button>
              ) : (
                <AddPriceRuleForm
                  ruleType={priceRuleTab}
                  productId={id!}
                  variants={(product?.variants || []).map(v => ({ id: v.id, name: v.name }))}
                  onSave={(data) => {
                    createPriceRule.mutate({ productId: id!, data })
                    setShowAddRule(false)
                  }}
                  onCancel={() => setShowAddRule(false)}
                  saving={createPriceRule.isPending}
                />
              )}
            </div>
          </Section>
        )}

        {/* 6. Return & Warranty — not for digital or bundle */}
        {!isDigitalType && !isBundleType && <Section title="Return & Warranty" icon={RotateCcw} open={!!openSections.returns} onToggle={() => toggle('returns')}>
          <div className="space-y-4 pt-4">
            <Controller name="return_warranty_per_variant" control={control} render={({ field }) => (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                <Toggle label="Manage per variant" checked={field.value} onChange={field.onChange} />
                <span className="text-xs text-gray-500">
                  {field.value ? 'Each variant has its own return & warranty settings' : 'Product-level settings apply to all variants'}
                </span>
              </div>
            )} />
            {!watch('return_warranty_per_variant') && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Return Window (days)"><Input type="number" min="0" {...register('return_days')} placeholder="e.g. 30" /></Field>
                  <Field label="Refund Policy">
                    <select {...register('refund_policy')} className={selectCls}>
                      <option value="">Select...</option>
                      <option value="full_refund">Full Refund</option>
                      <option value="store_credit">Store Credit</option>
                      <option value="exchange_only">Exchange Only</option>
                    </select>
                  </Field>
                  <Field label="Warranty (days)"><Input type="number" min="0" {...register('warranty_period_days')} placeholder="e.g. 365" /></Field>
                  <Field label="Warranty Type">
                    <select {...register('warranty_type')} className={selectCls}>
                      <option value="">None</option>
                      <option value="manufacturer">Manufacturer</option>
                      <option value="vendor">Vendor</option>
                    </select>
                  </Field>
                </div>
                <Field label="Return Policy"><textarea {...register('return_policy')} rows={2} className={textareaCls} placeholder="Describe your return policy..." /></Field>
                <Field label="Return Conditions"><Input {...register('return_conditions')} placeholder='e.g. "Unopened, with tags, within 30 days"' /></Field>
              </>
            )}
          </div>
        </Section>}

        {/* 7. Shipping & Delivery — physical and subscription only */}
        {(isPhysical || isSubscriptionType) && (
          <Section title="Shipping & Delivery" icon={Truck} open={!!openSections.shipping} onToggle={() => toggle('shipping')}>
            <div className="space-y-4 pt-4">
              <Controller name="requires_shipping" control={control} render={({ field }) => (
                <Toggle label="Requires Shipping" checked={field.value} onChange={field.onChange} />
              )} />
              <div className="grid grid-cols-4 gap-4">
                <Field label="Weight (kg)"><Input type="number" step="0.001" min="0" {...register('weight_kg')} /></Field>
                <Field label="Length (cm)"><Input type="number" step="0.01" min="0" {...register('length_cm')} /></Field>
                <Field label="Width (cm)"><Input type="number" step="0.01" min="0" {...register('width_cm')} /></Field>
                <Field label="Height (cm)"><Input type="number" step="0.01" min="0" {...register('height_cm')} /></Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Shipping Class">
                  <select {...register('shipping_class')} className={selectCls}>
                    <option value="">Standard</option>
                    <option value="express">Express</option>
                    <option value="fragile">Fragile</option>
                    <option value="oversized">Oversized</option>
                  </select>
                </Field>
                <Field label="Shipping Cost Type">
                  <select {...register('shipping_cost_type')} className={selectCls}>
                    <option value="fixed">Fixed</option>
                    <option value="variable">Variable (by weight)</option>
                    <option value="per_uom">Per UOM</option>
                    <option value="free">Free</option>
                    <option value="calculated">Calculated at checkout</option>
                  </select>
                </Field>
                {watch('shipping_cost_type') !== 'free' && watch('shipping_cost_type') !== 'calculated' && (
                  <Field label={
                    watch('shipping_cost_type') === 'variable' ? 'Cost per kg' :
                    watch('shipping_cost_type') === 'per_uom' ? 'Cost per unit' : 'Shipping Cost'
                  }>
                    <Input type="number" step="0.01" min="0" {...register('shipping_cost')} placeholder={
                      watch('shipping_cost_type') === 'variable' ? 'Rate per kg' :
                      watch('shipping_cost_type') === 'per_uom' ? 'Rate per unit' : 'Fixed amount'
                    } />
                  </Field>
                )}
                <Field label="Free Shipping Threshold"><Input type="number" step="0.01" min="0" {...register('free_shipping_threshold')} placeholder="Min order for free" /></Field>
              </div>
              {watch('shipping_cost_type') && watch('shipping_cost_type') !== 'fixed' && (
                <p className="text-xs text-gray-500 mt-1">
                  {watch('shipping_cost_type') === 'variable' && 'Shipping cost is calculated based on product weight (cost per kg × weight).'}
                  {watch('shipping_cost_type') === 'per_uom' && 'Shipping cost is calculated based on quantity ordered (cost per unit × qty).'}
                  {watch('shipping_cost_type') === 'free' && 'Free shipping for this product. Threshold still applies for other products in the order.'}
                  {watch('shipping_cost_type') === 'calculated' && 'Shipping will be calculated at checkout based on carrier rates and destination.'}
                </p>
              )}
            </div>
          </Section>
        )}

        {/* Business Front Options */}
        <Section title="Business Front Options" icon={ToggleRight} open={!!openSections.storefrontOptions} onToggle={() => toggle('storefrontOptions')}>
          <div className="pt-4 space-y-4">
            <p className="text-xs text-gray-500">Control how customers interact with this product on the business front.</p>
            <div className="divide-y rounded-lg border">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Quote Requests</p>
                    <p className="text-xs text-gray-400">Allow customers to request pricing quotes for this product</p>
                  </div>
                </div>
                <Controller name="allow_quote_request" control={control} render={({ field }) => (
                  <Toggle label="" checked={field.value} onChange={field.onChange} />
                )} />
              </div>
            </div>

            {watch('allow_quote_request') && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Quote Request Form Fields</p>
                  <p className="text-xs text-gray-400">Toggle fields on/off and mark them as required or optional</p>
                </div>
                <QuoteFormConfigurator fields={quoteFields} onChange={setQuoteFields} />
              </div>
            )}
          </div>
        </Section>

        {/* 8. Visibility & Marketing — status + business front visibility live in sticky header */}
        <Section title="Visibility & Marketing" icon={Eye} open={!!openSections.visibility} onToggle={() => toggle('visibility')}>
          <div className="space-y-4 pt-4">
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-700">Draft / Active / Archived</span> and <span className="font-medium text-gray-700">Visible</span> are set in the bar at the top so you can change them without scrolling.
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <Controller name="is_featured" control={control} render={({ field }) => (
                <Toggle label="Featured Product" checked={field.value} onChange={field.onChange} />
              )} />
              <Controller name="is_new_arrival" control={control} render={({ field }) => (
                <Toggle label="New Arrival" checked={field.value} onChange={field.onChange} />
              )} />
              <Controller name="is_best_seller" control={control} render={({ field }) => (
                <Toggle label="Best Seller" checked={field.value} onChange={field.onChange} />
              )} />
            </div>
          </div>
        </Section>

        {/* 8a-extra: Add-ons & Linked Services */}
        <Section title="Add-ons & Linked Services" icon={Plus} open={!!openSections.addons} onToggle={() => toggle('addons')}>
          <div className="space-y-4 pt-4">
            <p className="text-xs text-gray-500">
              Link services or products that can accompany this item — e.g. installation, demo, warranty, maintenance.
              Configure <strong>when booking is triggered</strong> for each add-on based on the order channel and status.
            </p>

            {/* Search & Add */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products or services to add as add-on…"
                    value={addonSearch}
                    onChange={e => setAddonSearch(e.target.value)}
                    autoComplete="off"
                    className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {addonSearchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />}
                </div>
              </div>
              {addonSearchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {addonSearchResults.map(r => (
                    <button key={r.id} type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-indigo-50 border-b border-gray-50 last:border-0"
                      onClick={() => {
                        setProductAddons(prev => [...prev, {
                          id: r.id, name: r.name, item_type: r.item_type,
                          addon_type: r.item_type === 'service' ? 'install' : 'other',
                          booking_trigger: 'at_sale',
                          optional: true,
                        }])
                        setAddonSearch('')
                        setAddonSearchResults([])
                      }}>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase ${r.item_type === 'service' ? 'bg-primary/12 text-primary' : 'bg-blue-100 text-blue-700'}`}>
                        {r.item_type === 'service' ? 'SVC' : 'PRD'}
                      </span>
                      <span className="font-medium text-gray-800">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Addon list */}
            {productAddons.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                <Plus className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                <p className="text-xs text-gray-400">No add-ons yet. Search above to add installation, demo, warranty services or products.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {productAddons.map((addon, ai) => (
                  <div key={addon.id} className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50/50">
                    {/* Header row */}
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0 ${addon.item_type === 'service' ? 'bg-primary/12 text-primary' : 'bg-blue-100 text-blue-700'}`}>
                        {addon.item_type === 'service' ? 'Service' : 'Product'}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{addon.name}</span>
                      <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                        <input type="checkbox" checked={addon.optional} onChange={e => setProductAddons(p => p.map((a, i) => i === ai ? { ...a, optional: e.target.checked } : a))} className="rounded" />
                        Optional
                      </label>
                      <button type="button" onClick={() => setProductAddons(p => p.filter((_, i) => i !== ai))}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Config row */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {/* Add-on type */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Type</label>
                        <select
                          value={addon.addon_type}
                          onChange={e => setProductAddons(p => p.map((a, i) => i === ai ? { ...a, addon_type: e.target.value } : a))}
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

                      {/* Booking trigger channel */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Book When</label>
                        <select
                          value={addon.booking_trigger}
                          onChange={e => setProductAddons(p => p.map((a, i) => i === ai ? { ...a, booking_trigger: e.target.value } : a))}
                          className="w-full h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                          <option value="at_sale">At Point of Sale / POS</option>
                          <option value="after_delivery">After Delivery (online orders)</option>
                          <option value="on_status">On Specific Order Status</option>
                        </select>
                      </div>

                      {/* Status trigger (conditional) */}
                      {addon.booking_trigger === 'on_status' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Trigger Status</label>
                          <select
                            value={addon.trigger_status || 'delivered'}
                            onChange={e => setProductAddons(p => p.map((a, i) => i === ai ? { ...a, trigger_status: e.target.value } : a))}
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

                    {/* Trigger description badge */}
                    <div className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                      addon.booking_trigger === 'at_sale' ? 'bg-green-50 text-green-700 border border-green-200' :
                      addon.booking_trigger === 'after_delivery' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      <Clock className="w-3 h-3 shrink-0" />
                      {addon.booking_trigger === 'at_sale' && 'Booking can be scheduled immediately when this item is sold at POS or during checkout.'}
                      {addon.booking_trigger === 'after_delivery' && 'For online/source purchases — booking becomes available only after the order is delivered.'}
                      {addon.booking_trigger === 'on_status' && `Booking opens when the order reaches "${addon.trigger_status || 'delivered'}" status.`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* 8b. Merchandising */}
        <Section title="Merchandising" icon={Link2} open={!!openSections.merch} onToggle={() => toggle('merch')}>
          <div className="space-y-6 pt-4">

            {/* ── Cross-sell & Upsell sections ── */}
            {(['cross_sell', 'upsell'] as const).map(relType => {
              const meta = relType === 'cross_sell'
                ? { title: 'Cross-sell (Related Items)', desc: 'Complementary products shown alongside this item', color: 'emerald', bgBadge: 'bg-emerald-100 text-emerald-700' }
                : { title: 'Upsell (Upgrade Options)', desc: 'Higher-value alternatives to suggest as upgrades', color: 'amber', bgBadge: 'bg-amber-100 text-amber-700' }
              const rows = merchMappings.map((m, i) => ({ ...m, _idx: i })).filter(r => r.relation_type === relType)
              const currentProductId = product?.id
              const availableProducts = allProducts.filter(p => p.id !== currentProductId)
              const categories = [...new Set(availableProducts.map(p => p.category || 'Uncategorized'))].sort()

              return (
                <div key={relType} className="border rounded-xl overflow-hidden">
                  <div className={`px-4 py-3 bg-gradient-to-r ${relType === 'cross_sell' ? 'from-emerald-50 to-white' : 'from-amber-50 to-white'} border-b`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{meta.title}</p>
                        <p className="text-xs text-gray-500">{meta.desc}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bgBadge}`}>{rows.length}</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {rows.map(row => {
                      const targetProd = allProducts.find(p => p.id === row.target_product_id)
                      const catProductCount = row.target_type === 'category' && row.target_category
                        ? availableProducts.filter(p => (p.category || 'Uncategorized') === row.target_category).length
                        : 0
                      return (
                        <div key={row._idx} className="border rounded-lg p-3 space-y-3 bg-gray-50/50">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-2">
                              {/* Product / Category toggle */}
                              <div className="flex items-center gap-1">
                                <label className="text-xs font-medium text-gray-600 mr-2">Target</label>
                                <button
                                  type="button"
                                  onClick={() => updateMerchMapping(row._idx, { target_type: 'product', target_category: '' })}
                                  className={`px-3 py-1 text-xs font-medium rounded-l-md border transition-colors ${row.target_type === 'product' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                >
                                  Product
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateMerchMapping(row._idx, { target_type: 'category', target_product_id: '' })}
                                  className={`px-3 py-1 text-xs font-medium rounded-r-md border border-l-0 transition-colors ${row.target_type === 'category' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                >
                                  Category
                                </button>
                              </div>

                              {/* Conditional picker */}
                              {row.target_type === 'product' ? (
                                <div className="space-y-1">
                                  <select
                                    value={row.target_product_id}
                                    onChange={e => updateMerchMapping(row._idx, { target_product_id: e.target.value })}
                                    className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  >
                                    <option value="">Select a product…</option>
                                    {categories.map(cat => (
                                      <optgroup key={cat} label={cat}>
                                        {availableProducts.filter(p => (p.category || 'Uncategorized') === cat).map(p => (
                                          <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                                        ))}
                                      </optgroup>
                                    ))}
                                  </select>
                                  {targetProd && <p className="text-xs text-gray-400">SKU: {targetProd.sku || '—'}</p>}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <select
                                    value={row.target_category}
                                    onChange={e => updateMerchMapping(row._idx, { target_category: e.target.value })}
                                    className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  >
                                    <option value="">Select a category…</option>
                                    {categories.map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                    {productCategories.filter(c => !categories.includes(c.name)).map(c => (
                                      <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                  </select>
                                  {row.target_category && (
                                    <p className="text-xs text-gray-400">
                                      All products in "{row.target_category}" ({catProductCount} product{catProductCount !== 1 ? 's' : ''})
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            <button type="button" onClick={() => removeMerchMapping(row._idx)} className="mt-5 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            {/* Trigger Stage */}
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-gray-600">Trigger Stage</label>
                              <select
                                value={row.trigger_stage}
                                onChange={e => updateMerchMapping(row._idx, { trigger_stage: e.target.value as 'PDP' | 'CART' | 'CHECKOUT' })}
                                className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="PDP">PDP (Product Page)</option>
                                <option value="CART">CART</option>
                                <option value="CHECKOUT">CHECKOUT</option>
                              </select>
                            </div>

                            {/* Priority */}
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-gray-600">Priority</label>
                              <input
                                type="number"
                                min={0}
                                value={row.priority}
                                onChange={e => updateMerchMapping(row._idx, { priority: Number(e.target.value) || 0 })}
                                className="w-full border rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            {/* Bundle (optional) */}
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-gray-600">Bundle (opt.)</label>
                              <select
                                value={row.bundle_id || ''}
                                onChange={e => updateMerchMapping(row._idx, { bundle_id: e.target.value || undefined })}
                                className="w-full border rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="">None</option>
                                {bundles.map(b => (
                                  <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    <button
                      type="button"
                      onClick={() => addMerchMapping(relType)}
                      className={`w-full border-2 border-dashed rounded-lg py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${relType === 'cross_sell' ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50' : 'border-amber-300 text-amber-600 hover:bg-amber-50'}`}
                    >
                      <Plus className="w-4 h-4" /> Add {relType === 'cross_sell' ? 'Cross-sell' : 'Upsell'} Link
                    </button>
                  </div>
                </div>
              )
            })}

            {/* ── Quick-reference: bundles ── */}
            {bundles.length > 0 && (
              <div className="border rounded-xl p-4 bg-gray-50/50 space-y-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-gray-500" />
                  <p className="text-sm font-semibold text-gray-700">Available Bundles</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bundles.map(b => (
                    <span key={b.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {b.name}
                      {b.discount_type !== 'none' && (
                        <span className="text-primary/80">
                          ({b.discount_type === 'percentage' ? `${b.discount_value}%` : `₹${b.discount_value}`} off)
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Bundles can be linked to any cross-sell or upsell mapping above.</p>
              </div>
            )}

            {/* ── Legend ── */}
            <div className="grid grid-cols-3 gap-3 text-xs text-gray-500 pt-2 border-t">
              <div><span className="font-semibold text-gray-700">PDP</span> — Product Detail Page</div>
              <div><span className="font-semibold text-gray-700">CART</span> — Shopping Cart</div>
              <div><span className="font-semibold text-gray-700">CHECKOUT</span> — Checkout Flow</div>
            </div>
          </div>
        </Section>

        {/* 9. SEO & Metadata */}
        <Section title="SEO & Metadata" icon={Search} open={!!openSections.seo} onToggle={() => toggle('seo')}>
          <div className="space-y-4 pt-4">
            <Field label="Meta Title"><Input {...register('meta_title')} placeholder="SEO title (defaults to product name)" /></Field>
            <Field label="Meta Description"><textarea {...register('meta_description')} rows={2} className={textareaCls} placeholder="SEO description..." /></Field>
            <Field label="Meta Keywords (comma separated)"><Input {...register('meta_keywords')} placeholder="keyword1, keyword2" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="OG Image URL"><Input {...register('og_image_url')} placeholder="https://..." /></Field>
              <Field label="Canonical URL"><Input {...register('canonical_url')} placeholder="https://..." /></Field>
            </div>
          </div>
        </Section>

        {/* 10. Advanced Features */}
        <Section title="Advanced Features" icon={Settings} open={!!openSections.advanced} onToggle={() => toggle('advanced')}>
          <div className="space-y-4 pt-4">
            <Field label="Attributes (JSON)"><textarea {...register('attributes')} rows={3} className={`${textareaCls} font-mono text-xs`} placeholder='{"color": ["Red","Blue"], "size": ["S","M","L"]}' /></Field>
            <Field label="Specifications (JSON)"><textarea {...register('specifications')} rows={3} className={`${textareaCls} font-mono text-xs`} placeholder='{"weight": "250g", "material": "Cotton"}' /></Field>
            <Field label="Custom Fields (JSON)"><textarea {...register('custom_fields')} rows={3} className={`${textareaCls} font-mono text-xs`} placeholder='{"vendor_note": "Handle with care"}' /></Field>
          </div>
        </Section>

        {/* 11. Digital Products — shown for digital and bundle types */}
        {(isDigitalType || isBundleType || product?.is_digital) && (
          <Section title="Digital Product" icon={Download} open={openSections.digital ?? (isDigitalType || isBundleType)} onToggle={() => toggle('digital')}>
            <div className="space-y-4 pt-4">
              <Controller name="is_digital" control={control} render={({ field }) => (
                <Toggle label="Is Digital Product" checked={field.value} onChange={field.onChange} />
              )} />
              <Field label="Download URL"><Input {...register('download_url')} placeholder="https://storage.example.com/file.zip" /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Download Limit"><Input type="number" min="0" {...register('download_limit')} placeholder="e.g. 5" /></Field>
                <Field label="Download Expiry (days)"><Input type="number" min="0" {...register('download_expiry_days')} placeholder="e.g. 30" /></Field>
              </div>
            </div>
          </Section>
        )}

        {/* 12. Subscription removed — billing config is now on each variant/plan */}

        {/* 13. Bill of Materials (MRP) */}
        {isEdit && id && (
          <Section title="Bill of Materials (BOM)" icon={Factory} open={!!openSections.bom} onToggle={() => toggle('bom')}>
            <div className="pt-4">
              <BOMEditor productId={id} productName={watch('name')} />
            </div>
          </Section>
        )}

        {/* 14. Reports (UI-only links) */}
        {isEdit && (
          <Section title="Reports & Analytics" icon={BarChart3} open={!!openSections.reports} onToggle={() => toggle('reports')}>
            <div className="space-y-3 pt-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-bold">{product?.view_count ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Views</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-bold">{product?.purchase_count ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Purchases</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-bold">v{product?.version_number ?? 1}</p>
                  <p className="text-xs text-gray-500 mt-1">Version</p>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="cancel" size="sm" onClick={() => navigate('/products')}>Cancel</Button>
          <Button type="submit" disabled={isSaving} size="sm">
            {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {isEdit ? 'Save Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </div>
  )
}
