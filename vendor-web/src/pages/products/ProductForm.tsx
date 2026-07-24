import { useForm, FormProvider, Controller, useFieldArray, type FieldErrors } from 'react-hook-form'
import { SectionLabel } from '@/components/common/FieldLabel'
import { FormColumnLabel } from '@/components/common/FieldLabel'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { ProductModifiers } from './ProductModifiers'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TablePagination } from '@/components/table/TablePagination'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProduct, useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useCategoryTree, useCreateCategory, useProductMerchandising, useSyncProductMerchandising, useBundles, usePriceRules, useCreatePriceRule, useUpdatePriceRule, useDeletePriceRule, useStores, vendorKeys } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { mediaUrl, cn } from '@/lib/utils'
import type { Product, ProductPriceRule, PriceRuleType } from '@/types'
import {
  ProductImageUpload,
  StagedMediaUpload,
  VariantMediaUpload,
  CatalogMediaSectionHeader,
  getMediaType,
  MEDIA_ACCEPT,
  STAGED_PRODUCT_HELPER,
  STAGED_VARIANT_HELPER,
  EDIT_MEDIA_HELPER,
  MEDIA_FORMATS_HELPER,
  reorderMediaList,
  adjustPrimaryIndexOnReorder,
  adjustPrimaryIndexOnRemove,
  findFirstImageIndex,
  type VariantMediaItem,
} from '@/components/common/ImageUpload'
import { AiDescriptionTextarea } from '@/components/common/AiDescriptionTextarea'
import {
  ArrowLeft, Loader2, Upload, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Package, IndianRupee, Receipt, Boxes, RotateCcw,
  Truck, Eye, Search, Settings, Download, Repeat, BarChart3,
  Layers, Link2, Plus, Trash2, Copy, ShoppingBag, Pencil, Clock,
  FileDown, Film, Box, Star, Calculator, DollarSign, MapPin,
  Calendar, Hash, Radio, Users, Globe, Tag, MessageSquare, ToggleRight,
  Factory, Store, Zap,
} from 'lucide-react'
import { variantToUpdatePayload } from '@/lib/productVariants'
import { CUSTOMER_PRICING_GROUPS } from '@/lib/customerGroups'
import { BOMEditor } from '@/components/mrp/BOMEditor'
import { CategoryHierarchyPicker } from '@/components/common/CategoryHierarchyPicker'
import { collectCustomFieldsFromSelection, filterCategoryTree } from '@/lib/categoryHierarchy'
import {
  FormPageWithNav,
  FormSectionNav,
  FormSectionTabs,
  FormField,
  handleFormInvalid,
  formDisplayCompact,
  formEditLayout,
  formInputScopeClass,
  formLabelClass,
  formSectionSurfaceClass,
  formSelectClass,
  formTextareaClass,
  useFormActiveSection,
} from '@/components/common/FormSectionNav'
import { CatalogEditStickyBar } from '@/components/common/CatalogEditStickyBar'
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog'
import { PRODUCT_TYPE_FILTER_OPTIONS } from '@/components/catalog/CatalogListFilters'
import { BusinessUnitScopePicker, type StoreScope } from '@/components/common/BusinessUnitScopePicker'
import type { FormSectionDef } from '@/components/common/FormSectionNav'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { extractApiError } from '@/lib/errorMessages'
import { CatalogItemLink } from '@/components/common/CatalogItemLink'
import { normalizeCatalogAddons, serializeCatalogAddons, type CatalogAddon } from '@/lib/catalogAddons'
import { UOM_OPTIONS, UOM_GROUPS, formatUomDisplay } from '@/lib/uomOptions'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'

import { askConfirm } from '@/components/common/ConfirmProvider'
// ── Zod schema ──────────────────────────────────────────────────

const optStr = z.string().optional().or(z.literal(''))
const optNum = z.coerce.number().optional().or(z.literal('').transform(() => undefined))
/** Empty number inputs must stay undefined — z.coerce.number() turns '' into 0. */
const optInt = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.coerce.number().int().optional(),
)
/** Optional order limits: blank = no limit; backend rejects 0 (ge=1 when set). */
const optOrderLimitInt = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.union([
    z.undefined(),
    z.coerce.number().int().refine(n => n >= 1, {
      message: 'Enter 1 or more, or leave blank',
    }),
  ]),
)

const variantRowSchema = z.object({
  id: z.string().optional(),  // DB id — present for saved variants, absent for new ones
  name: z.string().min(1, 'Variant name is required').max(255, 'Variant name cannot exceed 255 characters'),
  sku: optStr,
  barcode: optStr,
  uom: z.string().default('piece'),
  uom_quantity: optNum,
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
  max_quantity_per_order: optOrderLimitInt,
  min_quantity_per_order: optOrderLimitInt,
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
  name: z.string().min(2, 'Product name must be at least 2 characters').max(255, 'Product name cannot exceed 255 characters'),
  slug: z.string().max(255).regex(/^[a-z0-9-]*$/, 'Slug can only contain lowercase letters, numbers, and hyphens').optional().or(z.literal('')),
  material_code: z.string().max(40).optional().or(z.literal('')),
  description: optStr,
  short_description: z.string().max(500, 'Short description cannot exceed 500 characters').optional().or(z.literal('')),
  brand: optStr,
  product_type: z.string().default('physical'),
  category: optStr,
  subcategory: optStr,
  tags: z.string().optional().or(z.literal('')),
  // Unit of Measure
  uom: z.string().default('piece'),
  uom_quantity: optNum,
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
  weight_unit: z.string().default('kg'),
  length_cm: optNum,
  length_unit: z.string().default('cm'),
  width_cm: optNum,
  width_unit: z.string().default('cm'),
  height_cm: optNum,
  height_unit: z.string().default('cm'),
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

function Section({ title, icon: Icon, open, onToggle: _onToggle, children, surface = 'standard', surfaceHint, sectionId, badge }: {
  title: string
  icon: React.ElementType
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  surface?: 'standard' | 'product' | 'variants'
  surfaceHint?: string
  sectionId?: string
  badge?: React.ReactNode
}) {
  if (!open) return null
  const activeFormSection = useFormActiveSection()
  const scrollActive = !!sectionId && activeFormSection === sectionId
  const isProduct = surface === 'product'
  const isVariants = surface === 'variants'
  return (
    <Card
      id={sectionId ? `form-section-${sectionId}` : undefined}
      className={cn(
        'overflow-hidden',
        formDisplayCompact.scrollMarginEdit,
        formSectionSurfaceClass(scrollActive),
        isProduct && 'border-l-[3px] border-l-blue-500/75',
        isVariants && 'border-l-[3px] border-l-indigo-500/75',
        scrollActive && isProduct && 'ring-2 ring-blue-400/40',
        scrollActive && isVariants && 'ring-2 ring-indigo-400/40',
      )}
    >
      <CardContent
        className={cn(
          'p-2',
          !isProduct && !isVariants && 'bg-muted/15 dark:bg-black/20',
          isProduct && 'bg-gradient-to-b from-blue-50/25 to-card dark:border-blue-900/50 dark:from-blue-950/30 dark:to-card',
          isVariants && 'bg-gradient-to-b from-indigo-50/25 to-card dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-card',
        )}
      >
        <div className="mb-1 flex items-center gap-1.5 border-b border-border/60 pb-1">
          <Icon
            className={cn(
              'h-4 w-4 shrink-0',
              isProduct && 'text-blue-600',
              isVariants && 'text-indigo-600',
              !isProduct && !isVariants && 'text-muted-foreground',
            )}
          />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {isProduct && (
              <span className="text-[0.625rem] font-medium uppercase tracking-wide text-blue-600/80">
                {surfaceHint ?? 'Main product'}
              </span>
            )}
            {isVariants && (
              <span className="text-[0.625rem] font-medium uppercase tracking-wide text-indigo-600/80">
                {surfaceHint ?? 'SKUs & options'}
              </span>
            )}
            {badge}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

const VARIANT_ACCENT_PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6',
]

const LIGHT_ACCENT_FALLBACK = '#94A3B8'

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const c = color.trim()
  if (!c.startsWith('#')) return null
  const hex = c.length === 4
    ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
    : c
  if (hex.length < 7) return null
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 5 + 2), 16)
  if ([r, g, b].some(n => Number.isNaN(n))) return null
  return { r, g, b }
}


function isLightAccentColor(color: string): boolean {
  const c = color.trim().toLowerCase()
  if (c === 'white') return true
  const rgb = parseHexColor(c.startsWith('#') ? c : `#${c}`)
  if (!rgb) return false
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return lum >= 0.9
}

function variantUiAccentColor(color: string, index: number): string {
  if (isLightAccentColor(color)) return LIGHT_ACCENT_FALLBACK
  return color
}

function resolveVariantAccentColor(raw: string | undefined | null, index: number): string {
  const c = raw?.trim()
  if (c) {
    if (c.startsWith('#')) return c
    if (/^[0-9A-Fa-f]{6}$/.test(c)) return `#${c}`
    return c
  }
  return VARIANT_ACCENT_PALETTE[index % VARIANT_ACCENT_PALETTE.length]
}

function variantAccentBarGradient(color: string, active: boolean): string {
  if (!active) return 'linear-gradient(to bottom, #9ca3af 0%, #d1d5db 100%)'
  const ui = variantUiAccentColor(color, 0)
  if (isLightAccentColor(color)) {
    return 'linear-gradient(to bottom, #64748b 0%, #94a3b8 50%, #cbd5e1 100%)'
  }
  if (ui.startsWith('#') && ui.length >= 7) {
    const r = parseInt(ui.slice(1, 3), 16)
    const g = parseInt(ui.slice(3, 5), 16)
    const b = parseInt(ui.slice(5, 7), 16)
    return `linear-gradient(to bottom, rgb(${r},${g},${b}) 0%, rgba(${r},${g},${b},0.55) 50%, rgba(${r},${g},${b},0.18) 100%)`
  }
  return `linear-gradient(to bottom, ${ui} 0%, color-mix(in srgb, ${ui} 35%, white) 100%)`
}

function variantPanelSurfaceClass(active: boolean): string {
  return active
    ? 'bg-gradient-to-b from-muted/40 via-card to-card dark:from-primary/[0.07] dark:via-card dark:to-card'
    : 'bg-gradient-to-b from-muted/25 to-card dark:from-muted/15 dark:to-card'
}

/** Soft panel like Basic / Media — tinted background + left accent, no outer box border. */
function FormTintPanel({
  accentColor,
  active = true,
  title,
  hint,
  icon: Icon,
  header,
  headerAccentOnly = false,
  children,
  className,
  panelId,
}: {
  accentColor: string
  active?: boolean
  title?: string
  hint?: string
  icon?: React.ElementType
  header?: React.ReactNode
  headerAccentOnly?: boolean
  children: React.ReactNode
  className?: string
  panelId?: string
}) {
  if (headerAccentOnly && header) {
    return (
      <div id={panelId} className={cn('flex overflow-visible rounded-lg border-0 shadow-none', !active && 'opacity-85', className)}>
        <div
          className="w-1 shrink-0 self-stretch min-h-full"
          style={{ background: variantAccentBarGradient(accentColor, active) }}
          aria-hidden
        />
        <div className={cn('flex min-w-0 flex-1 flex-col', variantPanelSurfaceClass(active))}>
          {header}
          {children ? (
            <div className="border-t border-border/25 px-2 pb-1.5 pt-1.5 sm:px-2.5">{children}</div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div id={panelId} className={cn('flex overflow-hidden rounded-lg border-0 shadow-none', !active && 'opacity-80', className)}>
      <div
        className="w-1 shrink-0 self-stretch min-h-full"
        style={{ background: variantAccentBarGradient(accentColor, active) }}
        aria-hidden
      />
      <div className={cn('flex min-w-0 flex-1 flex-col', variantPanelSurfaceClass(active))}>
      {header ?? ((title || Icon) && (
        <div className="mb-0.5 flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5">
          {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: accentColor }} />}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {title && <h4 className="text-sm font-semibold text-foreground">{title}</h4>}
            {hint && (
              <span className="text-[0.625rem] font-medium uppercase tracking-wide" style={{ color: accentColor }}>
                {hint}
              </span>
            )}
          </div>
        </div>
      ))}
      <div className="px-2 pb-1.5 pt-0 sm:px-2.5">{children}</div>
      </div>
    </div>
  )
}


/** Compact variant/plan editor — dense fields for narrow product form columns. */
const variantFormUi = {
  body: [
    'space-y-2',
    '[&_[data-field]]:!space-y-0.5',
    '[&_label]:!mb-0 [&_label]:!text-[10px] [&_label]:!font-medium [&_label]:!leading-tight [&_label]:text-muted-foreground',
    '[&_input:not([type=color]):not([type=hidden])]:!h-7 [&_input:not([type=color]):not([type=hidden])]:!min-h-7',
    '[&_input:not([type=color]):not([type=hidden])]:!py-0 [&_input:not([type=color]):not([type=hidden])]:!text-xs',
    '[&_input:not([type=color]):not([type=hidden])]:!px-1.5 [&_input:not([type=color]):not([type=hidden])]:!rounded-md',
    '[&_select]:!h-7 [&_select]:!min-h-7 [&_select]:!text-xs [&_select]:!px-1.5 [&_select]:!py-0 [&_select]:!rounded-md',
    '[&_input[type=datetime-local]]:!text-[11px] [&_input[type=datetime-local]]:!px-1 [&_input[type=datetime-local]]:!pr-7',
    '[&_input[type=datetime-local]::-webkit-calendar-picker-indicator]:![width:0.9rem] [&_input[type=datetime-local]::-webkit-calendar-picker-indicator]:![height:0.9rem]',
  ].join(' '),
  bodyLayout:
    'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_10.5rem] xl:grid-cols-[minmax(0,1fr)_12.5rem] gap-2.5 lg:gap-3 lg:items-start',
  fieldsColumn: 'min-w-0 space-y-2',
  mediaColumn:
    'min-w-0 rounded-md border border-border/50 bg-muted/10 p-1 sm:p-1.5 lg:sticky lg:top-16',
  grid: 'gap-x-1.5 gap-y-1.5',
  pricingGrid: 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6',
  promoGrid:
    'grid grid-cols-[minmax(0,0.55fr)_minmax(0,0.65fr)_minmax(0,0.95fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]',
  inventoryGrid: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5',
  sectionHeading: 'text-[11px] font-semibold tracking-wide text-foreground',
  sectionHint: 'text-[10px] font-normal text-muted-foreground',
} as const

function VariantFormSection({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-1', className)}>
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
        <h5 className={variantFormUi.sectionHeading}>{title}</h5>
        {hint ? <span className={variantFormUi.sectionHint}>{hint}</span> : null}
      </div>
      {children}
    </section>
  )
}

function VariantMetricChip({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'discount' | 'profit' | 'loss'
  icon: React.ElementType
  children: React.ReactNode
}) {
  const toneCls = {
    discount: 'bg-orange-50 text-orange-700 border-orange-200',
    profit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    loss: 'bg-red-50 text-red-700 border-red-200',
  }[tone]
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', toneCls)}>
      <Icon className="w-2.5 h-2.5 shrink-0" />
      {children}
    </span>
  )
}

function InputWithSuffix({ suffix, className, ...props }: React.ComponentProps<typeof Input> & { suffix: string }) {
  return (
    <div className="relative min-w-0">
      <Input className={cn('w-full pr-5', className)} {...props} />
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-medium leading-none text-muted-foreground">{suffix}</span>
    </div>
  )
}

function InputWithPrefix({ prefix, className, ...props }: React.ComponentProps<typeof Input> & { prefix: string }) {
  return (
    <div className="relative min-w-0">
      <Input className={cn('w-full pl-5', className)} {...props} />
      <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-medium leading-none text-muted-foreground">{prefix}</span>
    </div>
  )
}

function Toggle({ label, checked, onChange, compact }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; compact?: boolean
}) {
  return (
    <label className={cn('flex cursor-pointer select-none items-center', compact ? 'gap-1.5' : 'gap-2')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 rounded-full border-2 transition-colors',
          compact ? 'h-4 w-7' : 'h-5 w-9',
          checked
            ? 'border-transparent bg-primary'
            : 'border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block rounded-full bg-white shadow-sm ring-1 ring-black/5 transform transition-transform',
            compact ? 'h-3 w-3' : 'h-4 w-4',
            checked ? (compact ? 'translate-x-3' : 'translate-x-4') : 'translate-x-0',
          )}
        />
      </button>
      <span className={cn('text-foreground', compact ? 'text-[11px] leading-none' : 'text-xs sm:text-sm')}>{label}</span>
    </label>
  )
}

const selectCls = formSelectClass
const textareaCls = formTextareaClass

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

const FIELD_TYPE_OPTIONS = FIELD_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))
const UOM_SELECT_OPTIONS = UOM_GROUPS.flatMap(group =>
  UOM_OPTIONS.filter(u => u.group === group).map(u => ({ value: u.value, label: u.label, group })),
)
const CURRENCY_SELECT_OPTIONS = [
  { value: 'INR', label: '₹ INR' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
]
const CURRENCY_BUNDLE_OPTIONS = [
  { value: 'INR', label: 'INR ₹' },
  { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' },
  { value: 'GBP', label: 'GBP £' },
]
const SUBSCRIPTION_INTERVAL_OPTIONS = selectOptionsWithBlank('Select…', [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' },
])
const STOCK_STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'pre_order', label: 'Pre-Order' },
  { value: 'discontinued', label: 'Discontinued' },
]
const VARIANT_STOCK_STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'backorder', label: 'Backorder' },
  { value: 'discontinued', label: 'Discontinued' },
]
const REFUND_POLICY_OPTIONS = selectOptionsWithBlank('Select...', [
  { value: 'full_refund', label: 'Full Refund' },
  { value: 'store_credit', label: 'Store Credit' },
  { value: 'exchange_only', label: 'Exchange Only' },
])
const WARRANTY_TYPE_OPTIONS = selectOptionsWithBlank('None', [
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'vendor', label: 'Vendor' },
])
const WEIGHT_UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'lb', label: 'lb' },
  { value: 'oz', label: 'oz' },
]
const LENGTH_UNIT_OPTIONS = [
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
  { value: 'm', label: 'm' },
  { value: 'in', label: 'in' },
  { value: 'ft', label: 'ft' },
]
const SHIPPING_CLASS_OPTIONS = selectOptionsWithBlank('Standard', [
  { value: 'express', label: 'Express' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'oversized', label: 'Oversized' },
])
const SHIPPING_COST_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'variable', label: 'Variable (by weight)' },
  { value: 'per_uom', label: 'Per UOM' },
  { value: 'free', label: 'Free' },
  { value: 'calculated', label: 'Calculated at checkout' },
]
const SALES_CHANNEL_OPTIONS = selectOptionsWithBlank('Select channel…', [
  { value: 'online', label: 'Online Store' },
  { value: 'pos', label: 'POS (Point of Sale)' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'mobile_app', label: 'Mobile App' },
  { value: 'social', label: 'Social Commerce' },
])
const ADDON_TYPE_OPTIONS = [
  { value: 'install', label: 'Installation' },
  { value: 'demo', label: 'Demo / Training' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'setup', label: 'Setup / Config' },
  { value: 'other', label: 'Other' },
]
const BOOKING_TRIGGER_OPTIONS = [
  { value: 'at_sale', label: 'At Point of Sale / POS' },
  { value: 'after_delivery', label: 'After Delivery (online orders)' },
  { value: 'on_status', label: 'On Specific Order Status' },
]
const TRIGGER_STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Order Confirmed', group: '— Order Statuses —' },
  { value: 'processing', label: 'Processing', group: '— Order Statuses —' },
  { value: 'shipped', label: 'Shipped', group: '— Order Statuses —' },
  { value: 'out_for_delivery', label: 'Out for Delivery', group: '— Order Statuses —' },
  { value: 'delivered', label: 'Delivered', group: '— Order Statuses —' },
  { value: 'installed', label: 'Installed', group: '— Order Statuses —' },
  { value: 'booking_confirmed', label: 'Booking Confirmed', group: '— Booking Statuses —' },
  { value: 'booking_scheduled', label: 'Booking Scheduled', group: '— Booking Statuses —' },
  { value: 'booking_in_progress', label: 'In Progress', group: '— Booking Statuses —' },
  { value: 'booking_completed', label: 'Booking Completed', group: '— Booking Statuses —' },
  { value: 'booking_no_show', label: 'No Show', group: '— Booking Statuses —' },
  { value: 'booking_rescheduled', label: 'Rescheduled', group: '— Booking Statuses —' },
  { value: 'booking_cancelled', label: 'Booking Cancelled', group: '— Booking Statuses —' },
]
const TRIGGER_STAGE_OPTIONS = [
  { value: 'PDP', label: 'PDP (Product Page)' },
  { value: 'CART', label: 'CART' },
  { value: 'CHECKOUT', label: 'CHECKOUT' },
]
const YES_NO_OPTIONS = selectOptionsWithBlank('Select', [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
])

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
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors ${f.enabled ? 'border-transparent bg-primary' : 'border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600'}`}>
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${f.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>

            {f.enabled ? (
              <Select
                value={f.type}
                onChange={v => onChange(fields.map(x => x.key === f.key ? { ...x, type: v as any } : x))}
                options={FIELD_TYPE_OPTIONS}
                className="h-7 shrink-0 text-xs text-gray-500"
                wrapperClassName="w-auto shrink-0"
                menuMinWidth={160}
              />
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
  mode?: 'default' | 'colour' | 'size'
  linkedSize?: string
  colourHex?: string
}

// ── Variant Media (edit mode — live upload) ─────────────────────

function VariantMediaEdit({
  variantId,
  variantName,
  initialMedia,
  onChanged,
  layout = 'inline',
}: {
  variantId: string
  variantName: string
  initialMedia: VariantMediaItem[]
  onChanged: (media: VariantMediaItem[]) => void
  layout?: 'inline' | 'stacked'
}) {
  const [media, setMedia] = useState(initialMedia)

  useEffect(() => { setMedia(initialMedia) }, [initialMedia])

  const commitMedia = (next: VariantMediaItem[]) => {
    setMedia(next)
    onChanged(next)
  }

  const uploadFile = async (file: File) => {
    const mt = getMediaType(file)
    const label = mt === 'model3d' ? '3D model' : mt === 'video' ? 'Video' : 'Image'
    try {
      const result = await vendorApi.uploadVariantMedia(variantId, file)
      commitMedia(result.media)
      toast.success(`${label} uploaded successfully`)
    } catch (err: unknown) {
      const detail = extractApiError(err, 'Unknown error')
      toast.error(`${label} upload failed: ${detail}`)
    }
  }

  const handleDelete = async (url: string) => {
    try {
      const result = await vendorApi.deleteVariantMedia(variantId, url)
      commitMedia(result.media)
      toast.success('Media removed')
    } catch (err: unknown) {
      toast.error(`Failed to delete media: ${extractApiError(err, 'Unknown error')}`)
    }
  }

  const handleSetPrimary = async (url: string) => {
    try {
      const result = await vendorApi.setPrimaryVariantMedia(variantId, url)
      commitMedia(result.media)
      toast.success('Primary image updated')
    } catch (err: unknown) {
      toast.error(`Failed to set primary: ${extractApiError(err, 'Unknown error')}`)
    }
  }

  const handleReorder = async (urls: string[]) => {
    try {
      const result = await vendorApi.reorderVariantMedia(variantId, urls)
      commitMedia(result.media)
    } catch {
      toast.error('Failed to reorder media')
    }
  }

  return (
    <VariantFormSection title="Media" hint="Overrides product media">
      <VariantMediaUpload
        media={media}
        onUpload={uploadFile}
        onDelete={handleDelete}
        onSetPrimary={handleSetPrimary}
        onReorder={handleReorder}
        pickerTitle={`Variant media — ${variantName}`}
        layout={layout}
      />
    </VariantFormSection>
  )
}

// ── Main form ───────────────────────────────────────────────────

function ProductDisplay({ product, onEdit, onEditVariant, onDeleteVariant, onBack, priceRules = [], merchMappings = [], allProducts = [], initialTab = 'basic' }: {
  product: any
  onEdit: () => void
  onEditVariant: (variantId: string) => void
  onDeleteVariant: (variantId: string) => Promise<void>
  onBack: () => void
  priceRules?: any[]
  merchMappings?: Array<{ target_type: string; target_product_id: string; target_category: string; relation_type: string; bundle_id?: string; trigger_stage: string; priority: number }>
  allProducts?: Array<{ id: string; name: string; category?: string; sku?: string }>
  initialTab?: string
}) {
  const navigate = useNavigate()
  const symbol = product.currency === 'INR' ? '\u20B9' : '$'
  const images = (product.images || []).sort((a: any, b: any) => a.position - b.position)
  const uomLabel = formatUomDisplay(product.uom_quantity, product.uom || 'piece')
  const hasVariants = (product.variants?.length || 0) > 0
  const hasBasePrice = product.price > 0
  const hasBasePricing = hasBasePrice || product.compare_at_price || product.cost_price || product.is_on_sale || product.discount_percentage || product.discount_amount
  const pType = product.product_type || 'physical'
  const isBundleView = pType === 'bundle'
  const isDigital = pType === 'digital' || isBundleView || product.is_digital
  const isSubscription = pType === 'subscription' || product.is_subscription
  const productAddons = normalizeCatalogAddons((product as { addons?: unknown }).addons)
  const changeHistory: any[] = product.change_history || []
  const [activeViewTab, setActiveViewTab] = useState(initialTab || 'basic')
  const [confirmDeleteVariantId, setConfirmDeleteVariantId] = useState<string | null>(null)
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null)
  const { data: storesData } = useStores()
  const businessUnits = storesData?.stores ?? []
  const showTab = (key: string) => activeViewTab === key

  const viewSections: FormSectionDef[] = useMemo(() => [
    { key: 'basic',             label: 'Basic',             icon: Package, hint: 'Name, type, category, descriptions, and media.' },
    { key: 'variants',          label: isBundleView ? 'Bundle' : isSubscription ? 'Price & Plans' : 'Price & Variants', icon: Layers, visible: !isBundleView, hint: 'Pricing, stock, SKUs, and per-variant settings.' },
    { key: 'bundle',            label: 'Bundle Items',      icon: ShoppingBag, visible: isBundleView, hint: 'Products included in this bundle.' },
    { key: 'visibility',        label: 'Visibility',        icon: Eye, hint: 'Status, featured flags, and catalog visibility.' },
    { key: 'returns',           label: 'Returns',           icon: RotateCcw, visible: !isDigital && !!(product.return_days || product.warranty_period_days || product.warranty_type || product.refund_policy || product.return_policy || product.return_conditions || product.is_returnable === false), hint: 'Return window, warranty, and refund rules.' },
    { key: 'shipping',          label: 'Shipping',          icon: Truck, visible: pType !== 'digital', hint: 'Weight, dimensions, shipping class, and delivery.' },
    { key: 'storefrontOptions', label: 'Business Front',    icon: Globe, hint: 'Quote requests and customer-facing options.' },
    { key: 'addons',            label: 'Add-ons',           icon: Link2, hint: 'Linked products or services sold with this item.' },
    { key: 'merch',             label: 'Merchandising',     icon: Tag, visible: merchMappings.length > 0, hint: 'Cross-sell and upsell relationships.' },
    { key: 'seo',               label: 'SEO',               icon: Search, hint: 'Search titles, descriptions, and social preview.' },
    { key: 'advanced',          label: 'Advanced',          icon: Settings, hint: 'Custom attributes, specifications, and JSON fields.' },
    { key: 'digital',           label: 'Digital',           icon: Download, visible: isDigital, hint: 'Download limits, expiry, and file delivery.' },
    { key: 'reports',           label: 'Reports',           icon: BarChart3, hint: 'Views, purchases, and version summary.' },
    { key: 'pricing-rules',     label: 'Pricing Rules',     icon: DollarSign, visible: priceRules.length > 0, hint: 'Party, location, quantity, and channel price rules.' },
    { key: 'modifiers',         label: 'Modifiers',         icon: Plus, hint: 'Custom options shown when adding this product to POS.' },
    { key: 'history',           label: 'History',           icon: Clock, hint: 'Who changed what and when — open the full report to export.' },
  ], [isBundleView, isSubscription, isDigital, pType, product, merchMappings.length, priceRules.length])

  useEffect(() => {
    const visible = viewSections.filter((s) => s.visible !== false)
    if (!visible.some((s) => s.key === activeViewTab)) {
      setActiveViewTab(visible[0]?.key ?? 'basic')
    }
  }, [viewSections, activeViewTab])

  const viewCompleted = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    if (images.length > 0) s.add('media')
    if (product.name) s.add('basic')
    if (product.price) s.add('pricing')
    if (hasVariants) s.add('variants')
    if (product.requires_shipping !== undefined) s.add('shipping')
    if (product.is_visible !== undefined) s.add('visibility')
    if (product.meta_title || product.meta_description) s.add('seo')
    if (productAddons.length > 0) s.add('addons')
    if (merchMappings.length > 0) s.add('merch')
    if (priceRules.length > 0) s.add('pricing-rules')
    if (changeHistory.length > 0) s.add('history')
    s.add('reports')
    return s
  }, [product, images, hasVariants, productAddons.length, merchMappings.length, priceRules.length, changeHistory.length])

  return (
    <FormPageWithNav activeSectionKey={activeViewTab} nav={null}>
    <div className={formEditLayout.formStack}>
      <div className={formEditLayout.stickyBar}>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
            <h1 className="truncate text-base font-bold sm:text-xl">{product.name}</h1>
            <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
              product.status === 'active' ? 'bg-green-100 text-green-700' :
              product.status === 'archived' ? 'bg-red-50 text-red-600' :
              'bg-gray-100 text-gray-700'
            }`}>{product.status}</span>
          </div>
          <Button onClick={onEdit} size="sm" className="h-8 gap-1.5 shrink-0"><Pencil className="w-3.5 h-3.5" />Edit Product</Button>
        </div>
      </div>

      <FormSectionTabs
        sections={viewSections}
        activeKey={activeViewTab}
        onChange={setActiveViewTab}
        completedSections={viewCompleted}
        hasErrorSections={new Set()}
      />

      <div className={formDisplayCompact.pageGap}>
      {showTab('basic') && images.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 overflow-x-auto">
              {images.map((img: any) => {
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
                      <img src={mediaUrl(img.url)} alt={img.alt_text || product.name} className="w-full h-full object-cover" />
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
          </CardContent>
        </Card>
      )}

      {showTab('basic') && (
      <Card>
        <CardContent className={formDisplayCompact.cardBody}>
          <div className={formDisplayCompact.sectionHeader}>
            <Package className={formDisplayCompact.sectionHeaderIcon} />
            <span className={formDisplayCompact.sectionHeaderTitle}>Basic Information</span>
          </div>
          <div className={formDisplayCompact.fieldGrid}>
            <DisplayField label="Product Name" value={product.name} />
            <DisplayField label="Material Code" value={product.material_code ? <span className="font-mono text-gray-700">{product.material_code}</span> : undefined} />
            <DisplayField label="Brand" value={product.brand} />
            <DisplayField label="Type" value={<span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-50 text-blue-700 capitalize">{product.product_type || 'physical'}</span>} />
            <DisplayField label="Category" value={product.category} />
            <DisplayField label="Subcategory" value={product.subcategory} />
            <DisplayField label="Unit of Measure" value={uomLabel} />
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
      )}

      {(showTab('variants') || showTab('bundle')) && (
      <>
      {/* Variant configuration engine — available from display mode */}
      {showTab('variants') && !isBundleView && !isSubscription && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Layers className={formDisplayCompact.sectionHeaderIcon} />
                  <span className={formDisplayCompact.sectionHeaderTitle}>Variant configuration</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open the config engine to set options, compatibility rules, generate variants, and manage prices &amp; stock.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 gap-1.5"
                onClick={() => navigate(`/products/${product.id}/configure`)}
              >
                {hasVariants ? <Zap className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
                {hasVariants ? 'Fast entry variants' : 'Configure & Manage Variants'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Pricing — hide when variants carry all pricing and base is zero */}
      {(!hasVariants || hasBasePricing) && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className={formDisplayCompact.sectionHeader}>
              <IndianRupee className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Pricing</span>
              {hasVariants && <span className="text-xs text-gray-400">(base product)</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-1.5">
              <DisplayField label="Price" value={<span className="text-lg font-bold text-gray-900">{symbol}{product.price?.toLocaleString()}</span>} />
              <DisplayField label="Compare at Price" value={product.compare_at_price ? `${symbol}${product.compare_at_price.toLocaleString()}` : null} />
              <DisplayField label="Cost Price" value={product.cost_price ? `${symbol}${product.cost_price.toLocaleString()}` : null} />
              <DisplayField label="Currency" value={product.currency} />
            </div>
            {(product.is_on_sale || product.discount_percentage || product.discount_amount) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-1.5 pt-2 border-t">
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
      {(product.is_taxable || product.tax_rate || product.gst_rate) && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className={formDisplayCompact.sectionHeader}>
              <Receipt className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Tax</span>
            </div>
            <div className={formDisplayCompact.fieldGrid}>
              <DisplayField label="Taxable" value={product.is_taxable ? 'Yes' : 'No'} />
              <DisplayField label="Tax Rate" value={product.tax_rate != null ? `${product.tax_rate}%` : null} />
              <DisplayField label="GST Rate" value={product.gst_rate != null ? `${product.gst_rate}%` : null} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory — hide base inventory when variants carry all stock */}
      {!hasVariants && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className={formDisplayCompact.sectionHeader}>
              <Boxes className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Inventory</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-1.5">
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
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-gray-500" />
              <span className={formDisplayCompact.sectionHeaderTitle}>Variants ({product.variants.length})</span>
              <span className="ml-auto text-xs text-gray-400">
                {product.variants.filter((v: any) => v.quantity <= (v.low_stock_threshold ?? 5)).length} low stock
              </span>
              {!isSubscription && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/products/${product.id}/configure`)
                  }}
                >
                  <Layers className="h-3 w-3" />
                  Config engine
                </Button>
              )}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500 w-6"><TableColumnLabel>#</TableColumnLabel></th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500"><TableColumnLabel>Variant</TableColumnLabel></th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500"><TableColumnLabel>SKU / Barcode</TableColumnLabel></th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500"><TableColumnLabel>Pricing</TableColumnLabel></th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500"><TableColumnLabel>Stock</TableColumnLabel></th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500"><TableColumnLabel>Tax / HSN</TableColumnLabel></th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500"><TableColumnLabel>UOM</TableColumnLabel></th>
                  <th className="text-left px-2 py-1.5 font-semibold text-gray-500"><TableColumnLabel>Flags</TableColumnLabel></th>
                  <th className="text-right px-2 py-1.5 font-semibold text-gray-500 w-24"><TableColumnLabel>Actions</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {product.variants.map((v: any, i: number) => {
                  const vUomLabel = formatUomDisplay(v.uom_quantity, v.uom || 'piece')
                  const qty = v.quantity ?? 0
                  const thresh = v.low_stock_threshold ?? 5
                  const isLow = qty <= thresh
                  const isOut = qty === 0
                  const stockStatus = isOut ? { bg: 'bg-red-100', text: 'text-red-700', label: 'Out' }
                    : isLow ? { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Low' }
                    : { bg: 'bg-green-100', text: 'text-green-700', label: 'OK' }
                  const isConfirmingDelete = confirmDeleteVariantId === v.id
                  const isDeleting = deletingVariantId === v.id

                  return (
                    <tr
                      key={v.id || i}
                      className={`hover:bg-gray-50/60 cursor-pointer ${!v.is_active ? 'opacity-40' : ''}`}
                      onClick={() => v.id && onEditVariant(v.id)}
                      title="Click to edit this variant"
                    >
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

                      {/* Actions */}
                      <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {isConfirmingDelete ? (
                          <div className="inline-flex flex-col items-end gap-1">
                            <p className="text-[10px] font-medium text-red-600">Delete?</p>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-6 px-2 text-[10px]"
                                disabled={isDeleting}
                                onClick={async () => {
                                  if (!v.id) return
                                  setDeletingVariantId(v.id)
                                  try {
                                    await onDeleteVariant(v.id)
                                    setConfirmDeleteVariantId(null)
                                  } catch (err) {
                                    toast.error(extractApiError(err, 'Could not delete variant'))
                                  } finally {
                                    setDeletingVariantId(null)
                                  }
                                }}
                              >
                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px]"
                                disabled={isDeleting}
                                onClick={() => setConfirmDeleteVariantId(null)}
                              >
                                No
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Edit variant"
                              onClick={() => v.id && onEditVariant(v.id)}
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-500" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                              title="Delete variant"
                              onClick={() => v.id && setConfirmDeleteVariantId(v.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      </>
      )}

      {showTab('returns') && (product.return_days || product.warranty_period_days || product.warranty_type || product.refund_policy || product.return_policy || product.return_conditions || product.is_returnable === false) && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className={formDisplayCompact.sectionHeader}>
              <RotateCcw className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Return & Warranty</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-1.5">
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

      {showTab('advanced') && (product.manufacture_date || product.expiration_date || product.best_before_date) && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className={formDisplayCompact.sectionHeader}>
              <Package className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Product Lifecycle</span>
            </div>
            <div className={formDisplayCompact.fieldGrid}>
              <DisplayField label="Manufacture Date" value={product.manufacture_date} />
              <DisplayField label="Expiration Date" value={product.expiration_date} />
              <DisplayField label="Best Before Date" value={product.best_before_date} />
            </div>
          </CardContent>
        </Card>
      )}

      {showTab('shipping') && pType !== 'digital' && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className={formDisplayCompact.sectionHeader}>
              <Truck className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Shipping & Delivery</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-1.5">
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

      {showTab('visibility') && (
      <>
      <Card>
        <CardContent className={formDisplayCompact.cardBody}>
          <div className={formDisplayCompact.sectionHeader}>
            <Store className={formDisplayCompact.sectionHeaderIcon} />
            <span className={formDisplayCompact.sectionHeaderTitle}>Business Unit Availability</span>
          </div>
          <DisplayField
            label="Availability"
            value={
              (product as Product).store_scope === 'selected'
                ? ((product as Product).store_ids?.length
                  ? (product as Product).store_ids!
                      .map(id => businessUnits.find(s => s.id === id)?.name || id)
                      .join(', ')
                  : 'None selected')
                : 'All business units'
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className={formDisplayCompact.cardBody}>
          <div className={formDisplayCompact.sectionHeader}>
            <Eye className={formDisplayCompact.sectionHeaderIcon} />
            <span className={formDisplayCompact.sectionHeaderTitle}>Visibility & Marketing</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-1.5">
            <DisplayField label="Status" value={product.status ? product.status.charAt(0).toUpperCase() + product.status.slice(1) : null} />
            <DisplayField label="Visible" value={product.is_visible ? 'Yes' : 'No'} />
            <DisplayField label="Featured" value={product.is_featured ? 'Yes' : 'No'} />
            <DisplayField label="New Arrival" value={product.is_new_arrival ? 'Yes' : 'No'} />
            <DisplayField label="Best Seller" value={product.is_best_seller ? 'Yes' : 'No'} />
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {showTab('seo') && (
      <Card>
        <CardContent className={formDisplayCompact.cardBody}>
          <div className={formDisplayCompact.sectionHeader}>
            <Search className={formDisplayCompact.sectionHeaderIcon} />
            <span className={formDisplayCompact.sectionHeaderTitle}>SEO & Metadata</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
            <DisplayField label="OG Image URL" value={product.og_image_url ? (
              <a href={product.og_image_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs break-all">{product.og_image_url}</a>
            ) : null} />
          </div>
        </CardContent>
      </Card>
      )}

      {showTab('advanced') && (
      <Card>
        <CardContent className={formDisplayCompact.cardBody}>
          <div className={formDisplayCompact.sectionHeader}>
            <Settings className={formDisplayCompact.sectionHeaderIcon} />
            <span className={formDisplayCompact.sectionHeaderTitle}>Advanced Features</span>
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
      )}

      {showTab('digital') && isDigital && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className={formDisplayCompact.sectionHeader}>
              <Download className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Digital Product</span>
            </div>
            <div className={formDisplayCompact.fieldGrid}>
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

      {showTab('variants') && isSubscription && product.variants && product.variants.length > 0 && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className={formDisplayCompact.sectionHeader}>
              <Repeat className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Subscription Plans</span>
            </div>
            <div className="space-y-3">
              {product.variants.filter((v: { is_active?: boolean }) => v.is_active !== false).map((v: { id: string; name?: string; price?: number; uom?: string; price_type?: string; subscription_interval?: string; subscription_trial_days?: number; subscription_setup_fee?: number; subscription_billing_cycles?: number; subscription_schedule_modes?: string[] }) => {
                const interval = v.subscription_interval || product.subscription_interval
                const vPriceType = (v as any).price_type || 'per_unit'
                const vUom = v.uom || 'piece'
                const uomLbl = formatUomDisplay((v as { uom_quantity?: number }).uom_quantity, vUom)
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

      {showTab('reports') && (
      <Card>
        <CardContent className={formDisplayCompact.cardBody}>
          <div className={formDisplayCompact.sectionHeader}>
            <BarChart3 className={formDisplayCompact.sectionHeaderIcon} />
            <span className={formDisplayCompact.sectionHeaderTitle}>Statistics</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            <div className="rounded-lg border p-2 sm:p-2.5">
              <p className="text-lg font-bold sm:text-xl">{product.view_count ?? 0}</p>
              <p className="text-[0.65rem] text-gray-500 mt-0.5">Views</p>
            </div>
            <div className="rounded-lg border p-2 sm:p-2.5">
              <p className="text-lg font-bold sm:text-xl">{product.purchase_count ?? 0}</p>
              <p className="text-[0.65rem] text-gray-500 mt-0.5">Purchases</p>
            </div>
            <div className="rounded-lg border p-2 sm:p-2.5">
              <p className="text-lg font-bold sm:text-xl">v{product.version_number ?? 1}</p>
              <p className="text-xs text-gray-500 mt-1">Version</p>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {showTab('storefrontOptions') && (
      <Card>
        <CardContent className={formDisplayCompact.cardBody}>
          <div className={formDisplayCompact.sectionHeader}>
            <ToggleRight className={formDisplayCompact.sectionHeaderIcon} />
            <span className={formDisplayCompact.sectionHeaderTitle}>Business Front Options</span>
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
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Field</TableColumnLabel></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Type</TableColumnLabel></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Enabled</TableColumnLabel></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Required</TableColumnLabel></th>
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
      )}

      {showTab('merch') && merchMappings.length > 0 && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className={formDisplayCompact.sectionHeader}>
              <Link2 className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Merchandising</span>
            </div>
            {(['cross_sell', 'upsell'] as const).map(relType => {
              const rows = merchMappings.filter(m => m.relation_type === relType)
              if (rows.length === 0) return null
              const meta = relType === 'cross_sell'
                ? { title: 'Cross-sell (Related Items)', bgBadge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', border: 'border-emerald-200/60 bg-emerald-500/10 dark:border-emerald-800/50 dark:bg-emerald-950/30' }
                : { title: 'Upsell (Upgrade Options)', bgBadge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', border: 'border-amber-200/60 bg-amber-500/10 dark:border-amber-800/50 dark:bg-amber-950/30' }
              return (
                <div key={relType} className={`rounded-xl border p-4 space-y-2 ${meta.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground">{meta.title}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bgBadge}`}>{rows.length}</span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((row, i) => {
                      const targetProd = allProducts.find(p => p.id === row.target_product_id)
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm bg-card rounded-lg border border-border px-3 py-2">
                          <span className="text-muted-foreground text-xs w-20 shrink-0">{row.target_type === 'category' ? 'Category' : 'Product'}</span>
                          <span className="font-medium flex-1 truncate text-foreground">
                            {row.target_type === 'category' ? row.target_category : (targetProd ? targetProd.name : row.target_product_id)}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{row.trigger_stage}</span>
                          {row.priority > 0 && <span className="text-xs text-muted-foreground">P{row.priority}</span>}
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

      {showTab('pricing-rules') && priceRules.length > 0 && (
        <Card>
          <CardContent className={formDisplayCompact.cardBody}>
            <div className={formDisplayCompact.sectionHeader}>
              <DollarSign className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Advanced Pricing Rules</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">{priceRules.length}</span>
            </div>
            {(['party', 'location', 'scheduled', 'quantity', 'channel'] as const).map(ruleType => {
              const typeRules = priceRules.filter((r: any) => r.rule_type === ruleType)
              if (typeRules.length === 0) return null
              const typeLabel: Record<string, string> = { party: 'Party / Customer', location: 'Location', scheduled: 'Scheduled', quantity: 'Quantity Tiers', channel: 'Channel' }
              return (
                <div key={ruleType} className="space-y-2">
                  <SectionLabel>{typeLabel[ruleType]}</SectionLabel>
                  <div className="overflow-x-auto rounded-lg border">
                    <ResizableTable tableId={`product-price-rules-${ruleType}`} defaultWidths={[150, 120, 90, 80, 80]}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Name</TableColumnLabel></th>
                          {ruleType === 'party' && <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Group</TableColumnLabel></th>}
                          {ruleType === 'location' && <><th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>State</TableColumnLabel></th><th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>City</TableColumnLabel></th><th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Pincode</TableColumnLabel></th></>}
                          {ruleType === 'scheduled' && <><th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Start</TableColumnLabel></th><th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>End</TableColumnLabel></th></>}
                          {ruleType === 'quantity' && <><th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Min Qty</TableColumnLabel></th><th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Max Qty</TableColumnLabel></th></>}
                          {ruleType === 'channel' && <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Channel</TableColumnLabel></th>}
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Price</TableColumnLabel></th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Discount %</TableColumnLabel></th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500"><TableColumnLabel>Status</TableColumnLabel></th>
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

      {showTab('addons') && productAddons.length > 0 && (
        <Card>
          <CardContent className={formDisplayCompact.cardBodyTight}>
            <div className="flex items-center gap-3 mb-1">
              <Link2 className={formDisplayCompact.sectionHeaderIcon} />
              <span className={formDisplayCompact.sectionHeaderTitle}>Add-ons & Linked Services</span>
            </div>
            <div className="space-y-2">
              {productAddons.map((addon, i) => (
                <div key={addon.id || i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <CatalogItemLink
                      id={addon.id}
                      name={addon.name}
                      itemType={addon.item_type}
                      className="text-foreground"
                    />
                    {addon.addon_type && <span className="ml-2 text-xs text-muted-foreground capitalize">{addon.addon_type}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {addon.optional !== undefined && <span>{addon.optional ? 'Optional' : 'Required'}</span>}
                    {addon.booking_trigger && <span className="capitalize">{addon.booking_trigger.replace(/_/g, ' ')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showTab('modifiers') && (
      <Card>
        <CardContent className={formDisplayCompact.cardBody}>
          <div className="flex items-center gap-3 mb-4">
            <Plus className="w-5 h-5 text-gray-500 shrink-0" />
            <div>
              <span className={formDisplayCompact.sectionHeaderTitle}>Modifiers & Add-ons</span>
              <p className="mt-1 text-xs text-muted-foreground max-w-md">
                Define custom options (e.g. spice level, extras). Shown as a picker when this product is added to a POS transaction.
              </p>
            </div>
          </div>
          {product.id && <ProductModifiers productId={product.id} />}
        </CardContent>
      </Card>
      )}

      {showTab('history') && (
      <Card>
        <CardContent className={formDisplayCompact.cardBody}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-500 shrink-0" />
              <div>
                <span className={formDisplayCompact.sectionHeaderTitle}>Change History</span>
                <span className="text-xs text-gray-400 ml-2">{changeHistory.length} entries &middot; v{product.version_number || 1}</span>
                <p className="mt-1 text-xs text-muted-foreground max-w-md">
                  Each save creates a version. Recent edits appear below; export the full audit trail for every field change.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => navigate(`/products/${product.id}/audit`)}
            >
              <FileDown className="w-4 h-4" />
              View Full Report
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 pt-2 border-t">
            <DisplayField label="Created At" value={product.created_at ? new Date(product.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null} />
            <DisplayField label="Updated At" value={product.updated_at ? new Date(product.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null} />
            <DisplayField label="Published At" value={product.published_at ? new Date(product.published_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null} />
          </div>
          {changeHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center">
              No edits recorded yet. Changes will appear here after you save the product in edit mode.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {[...changeHistory].reverse().map((h: any, i: number) => {
                const changes = h.changes || {}
                const isCreation = changes._action?.new === 'Product created'
                const changedFields = Object.keys(changes).filter(k => k !== '_action')
                return (
                  <div key={i} className="text-xs border rounded-lg p-2.5 bg-muted/20">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-700">v{h.version ?? '?'}</span>
                      <span className="text-gray-400">
                        {h.changed_at ? new Date(h.changed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                      {h.changed_by_name && <span className="text-gray-500">by {h.changed_by_name}</span>}
                    </div>
                    {isCreation ? (
                      <span className="text-green-600 font-medium">Product created</span>
                    ) : changedFields.length > 0 ? (
                      <div className="space-y-1">
                        {changedFields.slice(0, 6).map((field) => (
                          <div key={field} className="flex flex-wrap gap-1.5 text-gray-600">
                            <span className="font-medium text-gray-800 capitalize">{field.replace(/_/g, ' ')}:</span>
                            <span className="text-red-500 line-through max-w-[140px] truncate">{String(changes[field]?.old ?? '(empty)')}</span>
                            <span>→</span>
                            <span className="text-green-600 max-w-[140px] truncate">{String(changes[field]?.new ?? '(empty)')}</span>
                          </div>
                        ))}
                        {changedFields.length > 6 && (
                          <p className="text-gray-400 italic">+{changedFields.length - 6} more fields — see full report</p>
                        )}
                      </div>
                    ) : (
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

    </div>
    </div>
    </FormPageWithNav>
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
      <div className="min-w-0 space-y-0">
        <p className="text-[0.62rem] font-medium uppercase leading-none tracking-wide text-gray-400">{label}</p>
        <p className="text-xs leading-snug text-gray-300 sm:text-sm">—</p>
      </div>
    )
  }
  return (
    <div className="min-w-0 space-y-0">
      <p className="text-[0.62rem] font-medium uppercase leading-none tracking-wide text-gray-400">{label}</p>
      <div className="text-xs leading-snug text-gray-900 sm:text-sm">{value}</div>
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
          <Label className="block text-xs font-medium text-gray-600 mb-1">Rule Name <span className="text-red-500">*</span></Label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Wholesale Rate" />
        </div>
        {variants.length > 0 && (
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Apply to Variant</Label>
            <Select
              value={variantId}
              onChange={setVariantId}
              options={selectOptionsWithBlank(
                'All variants (product-level)',
                variants.map(v => ({ value: v.id, label: v.name })),
              )}
              className={selectCls}
            />
          </div>
        )}
        <div>
          <Label className="block text-xs font-medium text-gray-600 mb-1">Priority</Label>
          <input type="number" className={inputCls} value={priority} onChange={e => setPriority(e.target.value)} placeholder="0" min="0" />
        </div>
      </div>

      {/* Type-specific fields */}
      {ruleType === 'party' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Customer Group <span className="text-red-500">*</span></Label>
            <Select
              value={customerGroup}
              onChange={setCustomerGroup}
              options={selectOptionsWithBlank(
                'Select group…',
                CUSTOMER_PRICING_GROUPS.map(g => ({ value: g.value, label: g.label })),
              )}
              className={selectCls}
            />
            <p className="text-xs text-gray-400 mt-1">Must match the pricing group set on the customer's record for this rule to apply.</p>
          </div>
        </div>
      )}

      {ruleType === 'location' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Country</Label>
            <input className={inputCls} value={country} onChange={e => setCountry(e.target.value)} placeholder="India" />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">State</Label>
            <input className={inputCls} value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Karnataka" />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">City</Label>
            <input className={inputCls} value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Bangalore" />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Pincode</Label>
            <input className={inputCls} value={pincode} onChange={e => setPincode(e.target.value)} placeholder="e.g. 560001" />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Region</Label>
            <input className={inputCls} value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. South India" />
          </div>
        </div>
      )}

      {ruleType === 'scheduled' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Start Date <span className="text-red-500">*</span></Label>
            <input type="datetime-local" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">End Date</Label>
            <input type="datetime-local" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      )}

      {ruleType === 'quantity' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Min Quantity <span className="text-red-500">*</span></Label>
            <input type="number" min="1" className={inputCls} value={minQty} onChange={e => setMinQty(e.target.value)} placeholder="e.g. 10" />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Max Quantity (leave blank for unlimited)</Label>
            <input type="number" min="1" className={inputCls} value={maxQty} onChange={e => setMaxQty(e.target.value)} placeholder="e.g. 49" />
          </div>
        </div>
      )}

      {ruleType === 'channel' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Sales Channel <span className="text-red-500">*</span></Label>
            <Select
              value={channel}
              onChange={setChannel}
              options={SALES_CHANNEL_OPTIONS}
              className={selectCls}
            />
          </div>
        </div>
      )}

      {/* Pricing outcome */}
      <div>
        <h5 className="text-xs font-medium text-gray-600 mb-2">Pricing (set at least one)</h5>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Fixed Price</Label>
            <input type="number" step="0.01" min="0" className={inputCls} value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 899.00" />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Discount %</Label>
            <input type="number" step="0.01" min="0" max="100" className={inputCls} value={discountPct} onChange={e => setDiscountPct(e.target.value)} placeholder="e.g. 15" />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-600 mb-1">Discount Amount (₹)</Label>
            <input type="number" step="0.01" min="0" className={inputCls} value={discountAmt} onChange={e => setDiscountAmt(e.target.value)} placeholder="e.g. 100" />
          </div>
        </div>
      </div>

      <div>
        <Label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</Label>
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

function fieldPathToSection(path: string): string | null {
  if (path.startsWith('variants')) return 'variants'
  if (/^(name|slug|brand|product_type|description|short_description|category|subcategory|tags|uom|uom_quantity)$/.test(path)) {
    return 'basic'
  }
  if (/^(meta_|og_|canonical|attributes|specifications|custom_fields)/.test(path)) return 'seo'
  if (/^download/.test(path)) return 'digital'
  if (/^(weight|length|width|height|shipping|requires_shipping|free_shipping)/.test(path)) return 'shipping'
  if (/^(return|refund|warranty|is_returnable)/.test(path)) return 'returns'
  if (/^(status|is_visible|is_featured|is_new|is_best)/.test(path)) return 'visibility'
  if (/^(allow_quote|quote_form)/.test(path)) return 'storefrontOptions'
  if (/^(price|compare_at|cost|currency|discount|offer_label|sku|barcode|quantity|tax|gst|hsn)/.test(path)) {
    return 'variants'
  }
  return 'basic'
}

function isAutoSeededPlaceholderVariant(
  v: { name?: string; sku?: string; barcode?: string; quantity?: number },
  isSubscription: boolean,
): boolean {
  const defaultName = isSubscription ? 'Plan 1' : 'Variant 1'
  return v.name?.trim() === defaultName
    && !v.sku?.trim()
    && !v.barcode?.trim()
    && (v.quantity ?? 0) === 0
}

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
  const { data: inventorySettings } = useQuery({
    queryKey: ['inventory-settings'],
    queryFn: () => vendorApi.getInventorySettings(),
    staleTime: 60_000,
  })
  const autoGenerateBarcode = inventorySettings?.auto_generate_barcode !== false
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const { data: categoryData } = useCategoryTree()
  const createCategory = useCreateCategory()
  const { data: allProductsData } = useProducts({ size: 500 })
  const allProducts = (allProductsData?.items || []) as Array<{ id: string; name: string; category?: string; sku?: string }>
  const productCategories = useMemo(
    () => filterCategoryTree(categoryData?.categories || [], 'product'),
    [categoryData?.categories],
  )

  // Price rules
  const { data: priceRules = [] } = usePriceRules(id || '')
  const createPriceRule = useCreatePriceRule()
  const updatePriceRule = useUpdatePriceRule()
  const deletePriceRule = useDeletePriceRule()
  const [priceRuleTab, setPriceRuleTab] = useState<PriceRuleType>('party')
  const [showAddRule, setShowAddRule] = useState(false)

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPrimaryIndex, setPendingPrimaryIndex] = useState(0)
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  // Staged variant media for new products (variant index → files + previews + primary)
  type StagedVariantBucket = { files: File[]; previews: string[]; primaryIndex: number }
  const [pendingVariantMedia, setPendingVariantMedia] = useState<Map<number, StagedVariantBucket>>(new Map())

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'basic')
  const [visitedSections, setVisitedSections] = useState<Set<string>>(() => new Set([searchParams.get('tab') || 'basic']))
  const [activeFormSection, setActiveFormSection] = useState<string | null>(() => searchParams.get('tab') || 'basic')
  const toggle = (key: string) => {
    setActiveTab(key)
    setActiveFormSection(key)
    setVisitedSections(p => new Set(p).add(key))
  }
  const openAndScrollTo = toggle
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [quoteFields, setQuoteFields] = useState<QuoteFormFieldDraft[]>([...DEFAULT_QUOTE_FIELDS])

  const formMethods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'active', quantity: 0, price: 0, currency: 'INR', product_type: 'physical', uom: 'piece', uom_quantity: undefined,
      material_code: '',
      is_taxable: true, track_inventory: true, is_returnable: true, requires_shipping: true,
      weight_unit: 'kg', length_unit: 'cm', width_unit: 'cm', height_unit: 'cm',
      is_visible: true, low_stock_threshold: 5, stock_status: 'in_stock',
      allow_quote_request: false, quote_form_config: [],
      variants: [],
    },
  })
  const { register, handleSubmit, reset, setValue, getValues, watch, control, formState: { errors, isDirty } } = formMethods
  /** After create-page variant seed, treat current values as the clean baseline. */
  const createBaselineReadyRef = useRef(isEdit)
  const allowLeaveRef = useRef(false)
  const unsavedDirtyRef = useRef(false)

  const onFormInvalid = useCallback((validationErrors: FieldErrors) => {
    handleFormInvalid(validationErrors, {
      onFieldPath: (path) => {
        const section = fieldPathToSection(path)
        if (section) openAndScrollTo(section)
      },
    })
  }, [])

  const { fields: variantFields, append: appendVariant, remove: removeVariant, replace: replaceVariants } = useFieldArray({
    control,
    name: 'variants',
  })
  const createVariantSeeded = useRef(false)
  /** Avoid re-resetting the form when product query refetches (e.g. variant media upload/delete). */
  const hydratedProductIdRef = useRef<string | null>(null)
  const wasViewModeRef = useRef(isViewMode)

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
      setActiveTab('variants')
      setActiveFormSection('variants')
      setVisitedSections(s => new Set(s).add('variants'))
    }
  }, [prefillBarcode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link: /products/:id?edit=true&tab=variants opens Price & Variants
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (!tab || isViewMode) return
    setActiveTab(tab)
    setActiveFormSection(tab)
    setVisitedSections(s => new Set(s).add(tab))
    const t = window.setTimeout(() => {
      document.getElementById(`form-section-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [searchParams, isViewMode])

  const [optionRows, setOptionRows] = useState<OptionRow[]>([{ name: '', values: '', mode: 'default' }])
  const [expandedVariants, setExpandedVariants] = useState<Record<number, boolean>>({})
  const toggleVariant = (idx: number) => setExpandedVariants(p => ({ ...p, [idx]: !p[idx] }))
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState<number | null>(null)
  const [scrollToVariantIndex, setScrollToVariantIndex] = useState<number | null>(null)
  const [variantsPage, setVariantsPage] = useState(1)
  const [variantsPageSize, setVariantsPageSize] = useState(10)

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

  const openVariantEditor = useCallback((variantId: string) => {
    const variants = product?.variants || []
    const idx = variants.findIndex((v: { id: string }) => v.id === variantId)
    setIsViewMode(false)
    setActiveTab('variants')
    setActiveFormSection('variants')
    setVisitedSections(p => new Set(p).add('variants'))
    if (idx >= 0) {
      setExpandedVariants({ [idx]: true })
      setScrollToVariantIndex(idx)
    }
  }, [product])

  const deleteVariantById = useCallback(async (variantId: string) => {
    if (!id || !product) return
    const remaining = (product.variants || []).filter((v: { id: string }) => v.id !== variantId)
    await updateProduct.mutateAsync({
      id,
      data: { variants: remaining.map(variantToUpdatePayload) },
    })
  }, [id, product, updateProduct])

  useEffect(() => {
    if (scrollToVariantIndex == null || isViewMode) return
    setVariantsPage(Math.floor(scrollToVariantIndex / variantsPageSize) + 1)
    const timer = window.setTimeout(() => {
      document.getElementById(`variant-panel-${scrollToVariantIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollToVariantIndex(null)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [scrollToVariantIndex, isViewMode, variantsPageSize])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(variantFields.length / variantsPageSize))
    if (variantsPage > totalPages) setVariantsPage(totalPages)
  }, [variantFields.length, variantsPage, variantsPageSize])

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
      uom_quantity: s.uom_quantity ? Number(s.uom_quantity) : undefined,
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
  const isPhysical    = !productType || productType === 'physical' || productType === 'raw_material'
  const isDigitalType = productType === 'digital'
  const isSubscriptionType = productType === 'subscription'
  const isBundleType  = productType === 'bundle'
  const watchedCategory = watch('category')
  const watchedSubcategory = watch('subcategory')
  const watchedVariants = watch('variants')
  const watchedName = watch('name')
  const watchedBrand = watch('brand')
  const watchedShortDescription = watch('short_description')
  const watchedDescription = watch('description')
  const watchedMetaDescription = watch('meta_description')

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
  const [bundleItemSearch, setBundleItemSearch] = useState('')
  const [catalogStoreScope, setCatalogStoreScope] = useState<StoreScope>('all')
  const [catalogStoreIds, setCatalogStoreIds] = useState<string[]>([])
  const { data: storesData } = useStores()
  const businessUnits = storesData?.stores ?? []

  // Add-ons (linked services / products that can be sold alongside)
  type AddonItem = CatalogAddon
  const [productAddons, setProductAddons] = useState<AddonItem[]>([])
  const [addonSearch, setAddonSearch] = useState('')
  const [addonSearchResults, setAddonSearchResults] = useState<Array<{ id: string; name: string; item_type: 'product' | 'service' }>>([])
  const [addonSearchLoading, setAddonSearchLoading] = useState(false)
  const [addonPickerOpen, setAddonPickerOpen] = useState(false)

  // Search products + services for add-on picker (browse on focus, filter when typing)
  const searchAddons = useCallback(async (q: string) => {
    setAddonSearchLoading(true)
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
      ].filter(x => !productAddons.some(a => a.id === x.id) && x.id !== id)
      setAddonSearchResults(combined)
    } catch { setAddonSearchResults([]) }
    finally { setAddonSearchLoading(false) }
  }, [productAddons, id])

  useEffect(() => {
    if (!addonPickerOpen) return
    const delay = addonSearch.trim().length >= 2 ? 300 : 0
    const t = setTimeout(() => searchAddons(addonSearch), delay)
    return () => clearTimeout(t)
  }, [addonSearch, searchAddons, addonPickerOpen])

  useEffect(() => {
    if (!product) return
    // Media upload/delete invalidates the product query. Re-running reset() remounts
    // useFieldArray rows and collapses open variant panels — only hydrate once per
    // product (or when switching from view → edit).
    const enteringEditFromView = wasViewModeRef.current && !isViewMode
    wasViewModeRef.current = isViewMode
    if (isViewMode) return
    const shouldHydrate =
      hydratedProductIdRef.current !== product.id || enteringEditFromView
    if (!shouldHydrate) return
    hydratedProductIdRef.current = product.id

    reset({
      name: product.name, slug: toSlug(product.slug),
      material_code: product.material_code || '',
      description: product.description || '', short_description: product.short_description || '',
      brand: product.brand || '', product_type: product.product_type || 'physical',
      category: product.category || '', subcategory: product.subcategory || '',
      tags: (product.tags || []).join(', '),
      uom: product.uom || 'piece',
      uom_quantity: product.uom_quantity ?? undefined,
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
      weight_kg: product.weight_kg ?? undefined, weight_unit: (product as any).weight_unit || 'kg',
      length_cm: product.length_cm ?? undefined, length_unit: (product as any).length_unit || 'cm',
      width_cm: product.width_cm ?? undefined, width_unit: (product as any).width_unit || 'cm',
      height_cm: product.height_cm ?? undefined, height_unit: (product as any).height_unit || 'cm',
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
        name: v.name === 'Default' ? 'Variant' : v.name,
        sku: v.sku || '',
        barcode: v.barcode || '',
        uom: v.uom || 'piece',
        uom_quantity: v.uom_quantity ?? undefined,
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
        max_quantity_per_order: (v as { max_quantity_per_order?: number }).max_quantity_per_order ?? undefined,
        min_quantity_per_order: (v as { min_quantity_per_order?: number }).min_quantity_per_order ?? undefined,
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

    setProductAddons(normalizeCatalogAddons((product as { addons?: unknown }).addons))
    if (product.product_type === 'bundle') {
      setBundleItemIds((product as { related_product_ids?: string[] }).related_product_ids || [])
    }
    setCatalogStoreScope(product.store_scope === 'selected' ? 'selected' : 'all')
    setCatalogStoreIds(product.store_ids || [])
  }, [product, reset, isViewMode])

  const pendingPreviewsRef = useRef<string[]>([])
  pendingPreviewsRef.current = pendingPreviews

  useEffect(() => {
    return () => {
      pendingPreviewsRef.current.forEach(URL.revokeObjectURL)
    }
  }, [])

  const addPendingFiles = (files: FileList | File[] | null) => {
    if (!files || (Array.isArray(files) ? files.length === 0 : files.length === 0)) return
    const newFiles = Array.from(files)
    setPendingFiles(prev => {
      const next = [...prev, ...newFiles]
      if (prev.length === 0) {
        const firstImage = findFirstImageIndex(next)
        if (firstImage >= 0) setPendingPrimaryIndex(firstImage)
      }
      return next
    })
    setPendingPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))])
  }

  const removePendingFile = (index: number) => {
    URL.revokeObjectURL(pendingPreviews[index])
    setPendingFiles(prev => {
      const next = prev.filter((_, i) => i !== index)
      setPendingPrimaryIndex(p => adjustPrimaryIndexOnRemove(p, index, next.length))
      return next
    })
    setPendingPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const reorderPendingFiles = (from: number, to: number) => {
    setPendingFiles(prev => reorderMediaList(prev, from, to))
    setPendingPreviews(prev => reorderMediaList(prev, from, to))
    setPendingPrimaryIndex(prev => adjustPrimaryIndexOnReorder(prev, from, to))
  }

  const replacePendingFile = (index: number, file: File) => {
    URL.revokeObjectURL(pendingPreviews[index])
    setPendingFiles(prev => prev.map((f, i) => (i === index ? file : f)))
    setPendingPreviews(prev => prev.map((url, i) => (i === index ? URL.createObjectURL(file) : url)))
  }

  const emptyStagedVariantBucket = (): StagedVariantBucket => ({ files: [], previews: [], primaryIndex: 0 })

  const addStagedVariantFiles = (variantIndex: number, incoming: FileList | File[]) => {
    const newFiles = Array.from(incoming)
    if (!newFiles.length) return
    setPendingVariantMedia(prev => {
      const next = new Map(prev)
      const bucket = next.get(variantIndex) ?? emptyStagedVariantBucket()
      const mergedFiles = [...bucket.files, ...newFiles]
      const mergedPreviews = [...bucket.previews, ...newFiles.map(f => URL.createObjectURL(f))]
      let primaryIndex = bucket.primaryIndex
      if (bucket.files.length === 0) {
        const firstImage = findFirstImageIndex(mergedFiles)
        if (firstImage >= 0) primaryIndex = firstImage
      }
      next.set(variantIndex, { files: mergedFiles, previews: mergedPreviews, primaryIndex })
      return next
    })
  }

  const removeStagedVariantFile = (variantIndex: number, fileIndex: number) => {
    setPendingVariantMedia(prev => {
      const next = new Map(prev)
      const bucket = next.get(variantIndex)
      if (!bucket) return prev
      URL.revokeObjectURL(bucket.previews[fileIndex])
      const files = bucket.files.filter((_, i) => i !== fileIndex)
      const previews = bucket.previews.filter((_, i) => i !== fileIndex)
      const primaryIndex = adjustPrimaryIndexOnRemove(bucket.primaryIndex, fileIndex, files.length)
      if (files.length === 0) next.delete(variantIndex)
      else next.set(variantIndex, { files, previews, primaryIndex })
      return next
    })
  }

  const reorderStagedVariantFiles = (variantIndex: number, from: number, to: number) => {
    setPendingVariantMedia(prev => {
      const next = new Map(prev)
      const bucket = next.get(variantIndex)
      if (!bucket) return prev
      next.set(variantIndex, {
        files: reorderMediaList(bucket.files, from, to),
        previews: reorderMediaList(bucket.previews, from, to),
        primaryIndex: adjustPrimaryIndexOnReorder(bucket.primaryIndex, from, to),
      })
      return next
    })
  }

  const setStagedVariantPrimary = (variantIndex: number, primaryIndex: number) => {
    setPendingVariantMedia(prev => {
      const next = new Map(prev)
      const bucket = next.get(variantIndex)
      if (!bucket) return prev
      next.set(variantIndex, { ...bucket, primaryIndex })
      return next
    })
  }

  const replaceStagedVariantFile = (variantIndex: number, fileIndex: number, file: File) => {
    setPendingVariantMedia(prev => {
      const next = new Map(prev)
      const bucket = next.get(variantIndex)
      if (!bucket) return prev
      URL.revokeObjectURL(bucket.previews[fileIndex])
      next.set(variantIndex, {
        ...bucket,
        files: bucket.files.map((f, i) => (i === fileIndex ? file : f)),
        previews: bucket.previews.map((url, i) => (i === fileIndex ? URL.createObjectURL(file) : url)),
      })
      return next
    })
  }

  const flushStagedVariantMedia = async (
    savedProduct: { variants?: { id: string }[] },
    variantRows: Array<{ name?: string; attributes_json?: string }> | undefined,
    mediaMap: Map<number, StagedVariantBucket>,
  ) => {
    if (mediaMap.size === 0) return
    const substantiveFormIndices = (variantRows || [])
      .map((v, i) => (v.name?.trim() ? i : -1))
      .filter(i => i >= 0)
    for (const [variantIndex, bucket] of mediaMap.entries()) {
      const payloadIdx = substantiveFormIndices.indexOf(variantIndex)
      if (payloadIdx < 0) continue
      const dbVariant = savedProduct.variants?.[payloadIdx]
      if (!dbVariant?.id || bucket.files.length === 0) continue
      let lastMedia: VariantMediaItem[] = []
      for (const file of bucket.files) {
        try {
          const result = await vendorApi.uploadVariantMedia(dbVariant.id, file)
          lastMedia = result.media
        } catch { /* best-effort */ }
      }
      const sorted = [...lastMedia].sort((a, b) => a.position - b.position)
      const primaryItem = sorted[bucket.primaryIndex]
      if (primaryItem && (primaryItem.media_type || 'image') === 'image' && !primaryItem.is_primary) {
        try { await vendorApi.setPrimaryVariantMedia(dbVariant.id, primaryItem.url) } catch { /* best-effort */ }
      }
    }
  }

  const persistProduct = useCallback(async (
    raw: FormData,
    opts?: { omitPlaceholderVariants?: boolean },
  ): Promise<Product | null> => {
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

    let substantiveVariants = (variantRows || []).filter(v => v.name?.trim())
    if (opts?.omitPlaceholderVariants && !isEdit) {
      substantiveVariants = substantiveVariants.filter(
        v => !isAutoSeededPlaceholderVariant(v, isSubscriptionType),
      )
    }

    data.variants = substantiveVariants
      .map(v => ({
        id: v.id || undefined,
        name: v.name.trim(),
        sku: v.sku?.trim() || undefined,
        barcode: v.barcode?.trim() || undefined,
        uom: v.uom || 'piece',
        uom_quantity: v.uom_quantity ?? undefined,
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
        max_quantity_per_order: v.max_quantity_per_order ?? undefined,
        min_quantity_per_order: v.min_quantity_per_order ?? undefined,
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

    if (raw.product_type === 'digital') data.is_digital = true
    if (raw.product_type === 'bundle') data.is_digital = true
    if (raw.product_type === 'subscription') {
      data.is_subscription = true
      const firstActiveVariant = (data.variants as Array<{ is_active?: boolean; price?: number; subscription_interval?: string; subscription_trial_days?: number; subscription_setup_fee?: number; subscription_billing_cycles?: number }> || []).find(v => v.is_active !== false && v.price != null && Number(v.price) > 0)
      if (firstActiveVariant) {
        data.subscription_price = Number(firstActiveVariant.price)
        data.subscription_interval = firstActiveVariant.subscription_interval || data.subscription_interval
        data.subscription_trial_days = firstActiveVariant.subscription_trial_days ?? data.subscription_trial_days
        data.subscription_setup_fee = firstActiveVariant.subscription_setup_fee ?? data.subscription_setup_fee
        data.subscription_billing_cycles = firstActiveVariant.subscription_billing_cycles ?? data.subscription_billing_cycles
      }
    }
    if (raw.product_type === 'bundle') data.related_product_ids = bundleItemIds

    data.addons = serializeCatalogAddons(productAddons)

    if (catalogStoreScope === 'selected' && catalogStoreIds.length === 0) {
      toast.error('Select at least one business unit, or choose All business units.')
      openAndScrollTo('visibility')
      return null
    }
    data.store_scope = catalogStoreScope
    data.store_ids = catalogStoreScope === 'selected' ? catalogStoreIds : []

    if (raw.allow_quote_request) {
      data.quote_form_config = quoteFields.filter(f => f.enabled).map(({ key, label, type, required, enabled, placeholder, options }) => ({
        key, label, type, required, enabled, placeholder, ...(options?.length ? { options } : {}),
      }))
    } else {
      data.quote_form_config = null
    }

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

    const productName = String(data.name || '').trim()
    if (productName) {
      const nameTaken = allProducts.some(
        (p) => p.name.trim().toLowerCase() === productName.toLowerCase() && (!isEdit || p.id !== id),
      )
      if (nameTaken) {
        toast.error('A product with this name already exists')
        return null
      }
    }

    if (isEdit) {
      const updatedProduct = await updateProduct.mutateAsync({ id: id!, data })
      await syncMerch(id!)
      await flushStagedVariantMedia(updatedProduct, substantiveVariants, pendingVariantMedia)
      setPendingVariantMedia(new Map())
      return updatedProduct as Product
    }

    const newProduct = await createProduct.mutateAsync(
      { data, images: pendingFiles.length > 0 ? pendingFiles : undefined, primaryImageIndex: pendingPrimaryIndex },
    )
    await syncMerch(newProduct.id)
    await flushStagedVariantMedia(newProduct, substantiveVariants, pendingVariantMedia)
    setPendingVariantMedia(new Map())
    setPendingFiles([])
    setPendingPreviews([])
    setPendingPrimaryIndex(0)
    return newProduct as Product
  }, [
    allProducts, bundleItemIds, catalogStoreIds, catalogStoreScope, createProduct,
    id, isEdit, isSubscriptionType, merchMappings, openAndScrollTo, pendingFiles, pendingPrimaryIndex,
    pendingVariantMedia, productAddons, quoteFields, updateProduct,
  ])

  const onSubmit = async (raw: FormData) => {
    try {
      const saved = await persistProduct(raw)
      if (!saved) return
      allowLeaveRef.current = true
      unsavedDirtyRef.current = false
      navigate('/products')
    } catch (err) {
      if (!isAxiosError(err)) {
        toast.error(extractApiError(err, 'Submit failed'))
      }
    }
  }

  const [isOpeningVariantConfig, setIsOpeningVariantConfig] = useState(false)

  const handleOpenVariantConfig = handleSubmit(async (raw) => {
    try {
      setIsOpeningVariantConfig(true)
      const saved = await persistProduct(raw, { omitPlaceholderVariants: !isEdit })
      if (!saved) return
      const hasRealVariants = (raw.variants || []).some(
        v => v.name?.trim() && (!isEdit || !isAutoSeededPlaceholderVariant(v, isSubscriptionType)),
      )
      qc.invalidateQueries({ queryKey: ['vendor', 'product', saved.id] })
      allowLeaveRef.current = true
      unsavedDirtyRef.current = false
      navigate(
        isEdit && hasRealVariants
          ? `/products/${saved.id}/configure?view=manage`
          : `/products/${saved.id}/configure?from=create`,
        { replace: !isEdit },
      )
    } catch (err) {
      if (!isAxiosError(err)) {
        toast.error(extractApiError(err, 'Could not open variant setup'))
      }
    } finally {
      setIsOpeningVariantConfig(false)
    }
  }, onFormInvalid)

  const handleUpload = useCallback(async (file: File) => {
    if (!id) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const isVideo = file.type.startsWith('video/')
    const is3D = ext === 'glb' || ext === 'gltf'
    const label = isVideo ? 'Video' : is3D ? '3D model' : 'Image'
    try {
      await vendorApi.uploadProductImage(id, file)
      qc.invalidateQueries({ queryKey: ['vendor', 'product', id] })
      qc.invalidateQueries({ queryKey: ['vendor', 'products'] })
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

  const handleReorderImages = useCallback(async (imageIds: string[]) => {
    if (!id) return
    try {
      await vendorApi.reorderProductImages(id, imageIds)
      qc.invalidateQueries({ queryKey: ['vendor', 'product', id] })
    } catch { toast.error('Failed to reorder media') }
  }, [id, qc])

  const handleEditImage = useCallback(async (imageId: string, file: File, wasPrimary: boolean) => {
    if (!id) return
    const uploaded = await vendorApi.uploadProductImage(id, file)
    await vendorApi.deleteProductImage(id, imageId)
    if (wasPrimary) await vendorApi.setPrimaryProductImage(id, uploaded.id)
    qc.invalidateQueries({ queryKey: ['vendor', 'product', id] })
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
  const addOptionRow = () => setOptionRows(prev => [...prev, { name: '', values: '', mode: 'default' }])
  const removeOptionRow = (index: number) => setOptionRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index))

  const syncVariantNameAttributes = useCallback((index: number, newName: string) => {
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
  }, [getValues, setValue])

  const makeVariantDefaults = (name: string, attrs: Record<string, string>) => ({
    id: undefined as string | undefined,
    name,
    sku: '',
    // If this is the first variant and we have a prefill barcode from a scan, apply it
    barcode: variantFields.length === 0 && prefillBarcode ? prefillBarcode : '',
    uom: getValues('uom') || 'piece',
    uom_quantity: getValues('uom_quantity') ?? undefined,
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
    max_quantity_per_order: undefined,
    min_quantity_per_order: undefined,
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
    subscription_interval: isSubscriptionType ? 'monthly' : '',
    subscription_trial_days: undefined,
    subscription_setup_fee: undefined,
    subscription_billing_cycles: undefined,
    subscription_schedule_modes: ['dates', 'cycles', 'pick_dates', 'weekly', 'recurring'],
    is_active: true,
  })

  // Create page: start with one variant/plan row so fields are immediately editable
  useEffect(() => {
    if (isEdit) return
    if (isBundleType) {
      if (variantFields.length > 0) replaceVariants([])
      createVariantSeeded.current = false
      return
    }
    if (variantFields.length === 0 && !createVariantSeeded.current) {
      appendVariant(makeVariantDefaults(
        isSubscriptionType ? 'Plan 1' : 'Variant 1',
        {},
      ))
      setExpandedVariants({ 0: true })
      setVisitedSections(s => new Set(s).add('variants'))
      createVariantSeeded.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per create session; makeVariantDefaults is stable enough for our guards
  }, [isEdit, isBundleType, variantFields.length, isSubscriptionType])

  // Seeded default variant marks RHF dirty — reset defaults once so leave-guard stays quiet until real edits
  useEffect(() => {
    if (isEdit || createBaselineReadyRef.current) return
    if (!createVariantSeeded.current || variantFields.length < 1) return
    reset(getValues())
    createBaselineReadyRef.current = true
  }, [isEdit, variantFields.length, reset, getValues])

  useEffect(() => {
    if (isEdit || isBundleType || variantFields.length !== 1) return
    const v0 = getValues('variants.0')
    if (isSubscriptionType && (v0?.name === 'Default' || v0?.name === 'Variant')) {
      setValue('variants.0.name', 'Plan 1')
      setValue('variants.0.price_type', 'per_cycle')
      setValue('variants.0.subscription_interval', 'monthly')
    }
  }, [isSubscriptionType, isEdit, isBundleType, variantFields.length, getValues, setValue])

  const formValues = watch()
  const productSections: FormSectionDef[] = useMemo(() => [
    { key: 'basic',            label: 'Basic',             icon: Package, hint: 'Name, type, category, descriptions, and media.' },
    { key: 'variants',         label: isBundleType ? 'Bundle' : isSubscriptionType ? 'Price & Plans' : 'Price & Variants', icon: Layers, visible: !isBundleType, hint: 'SKUs, pricing, options, stock, and per-variant settings.' },
    { key: 'tax',              label: 'Tax',               icon: Receipt, hint: 'GST, tax rates, and HSN/SAC codes per product or variant.' },
    { key: 'bundle',           label: 'Bundle Items',      icon: Layers, visible: isBundleType, hint: 'Products included in this bundle.' },
    { key: 'visibility',       label: 'Visibility',        icon: Eye, hint: 'Status, visibility toggle, and marketing flags.' },
    { key: 'returns',          label: 'Returns',           icon: RotateCcw, visible: !isDigitalType && !isBundleType, hint: 'Return window, warranty, and refund policy.' },
    { key: 'shipping',         label: 'Shipping',          icon: Truck, visible: !isDigitalType, hint: 'Weight, dimensions, and delivery settings.' },
    { key: 'storefrontOptions',label: 'Business Front',    icon: Globe, hint: 'Quote requests and storefront display options.' },
    { key: 'addons',           label: 'Add-ons',           icon: Link2, hint: 'Optional linked products or services.' },
    { key: 'merch',            label: 'Merchandising',     icon: Tag, hint: 'Cross-sell and upsell on the business front.' },
    { key: 'seo',              label: 'SEO',               icon: Search, hint: 'Meta title, description, and search preview.' },
    { key: 'advanced',         label: 'Advanced',          icon: Settings, hint: 'Attributes, specifications, and custom JSON.' },
    { key: 'digital',          label: 'Digital',           icon: Download, visible: isDigitalType || isBundleType, hint: 'Download URL, limits, and expiry.' },
    { key: 'bom',              label: 'BOM',               icon: Factory, visible: isEdit && !isBundleType, hint: 'Manufacturing components and quantities.' },
    { key: 'reports',          label: 'Reports',             icon: BarChart3, visible: isEdit, hint: 'Views, purchases, and version stats (read-only).' },
    { key: 'pricing-rules',    label: 'Pricing Rules',     icon: DollarSign, visible: isEdit && !!id, hint: 'Party, location, quantity, and channel price rules.' },
  ], [isEdit, isBundleType, isSubscriptionType, isDigitalType, id])

  useEffect(() => {
    const visible = productSections.filter((s) => s.visible !== false)
    if (!visible.some((s) => s.key === activeTab)) {
      setActiveTab(visible[0]?.key ?? 'basic')
    }
  }, [productSections, activeTab])

  const completedSections = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    if (formValues.name) s.add('basic')
    if (isEdit && (product?.images?.length ?? 0) > 0) s.add('basic')
    if (!isEdit && pendingFiles.length > 0) s.add('basic')
    if ((formValues.variants?.length ?? 0) > 0) s.add('variants')
    if (formValues.short_description || formValues.description) s.add('storefrontOptions')
    if (formValues.is_visible !== undefined) s.add('visibility')
    if (formValues.requires_shipping !== undefined) s.add('shipping')
    if (formValues.is_returnable !== undefined) s.add('returns')
    if (formValues.is_taxable !== undefined || formValues.tax_rate || formValues.gst_rate || formValues.hsn_code) s.add('tax')
    if (formValues.meta_title || formValues.meta_description) s.add('seo')
    return s
  }, [formValues, product, isEdit])

  const hasErrorSections = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    if (errors.name || errors.product_type) s.add('basic')
    if (errors.variants) s.add('variants')
    return s
  }, [errors])

  const hasUnsavedChanges = !isViewMode && (
    isDirty || pendingFiles.length > 0 || pendingVariantMedia.size > 0
  )

  useLayoutEffect(() => {
    if (allowLeaveRef.current) {
      unsavedDirtyRef.current = false
      return
    }
    unsavedDirtyRef.current = hasUnsavedChanges
  }, [hasUnsavedChanges])

  const saveForLeaveGuard = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      void handleSubmit(
        async (raw) => {
          try {
            const saved = await persistProduct(raw)
            if (!saved) {
              resolve(false)
              return
            }
            allowLeaveRef.current = true
            unsavedDirtyRef.current = false
            resolve(true)
          } catch (err) {
            if (!isAxiosError(err)) {
              toast.error(extractApiError(err, 'Submit failed'))
            }
            resolve(false)
          }
        },
        (validationErrors) => {
          onFormInvalid(validationErrors)
          resolve(false)
        },
      )()
    })
  }, [handleSubmit, persistProduct, onFormInvalid])

  const discardForLeaveGuard = useCallback(() => {
    allowLeaveRef.current = true
    unsavedDirtyRef.current = false
  }, [])

  const {
    dialogOpen: unsavedDialogOpen,
    saving: unsavedSaving,
    handleCancel: handleUnsavedCancel,
    handleDiscard: handleUnsavedDiscard,
    handleSave: handleUnsavedSave,
    confirmIfDirty,
  } = useUnsavedChangesGuard({
    when: hasUnsavedChanges,
    dirtyRef: unsavedDirtyRef,
    onSave: saveForLeaveGuard,
    onDiscard: discardForLeaveGuard,
  })

  const leaveProductForm = useCallback(() => {
    confirmIfDirty(() => navigate('/products'))
  }, [confirmIfDirty, navigate])

  if (isEdit && isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>

  if (isViewMode && isEdit && product) {
    return (
      <ProductDisplay
        product={product}
        onEdit={() => {
          setIsViewMode(false)
          const tab = searchParams.get('tab')
          if (tab) {
            setActiveTab(tab)
            setActiveFormSection(tab)
            setVisitedSections(s => new Set(s).add(tab))
          }
        }}
        onEditVariant={openVariantEditor}
        onDeleteVariant={deleteVariantById}
        onBack={() => navigate('/products')}
        priceRules={priceRules as any[]}
        merchMappings={merchMappings}
        allProducts={allProducts}
        initialTab={searchParams.get('tab') || 'basic'}
      />
    )
  }

  const isSaving = createProduct.isPending || updateProduct.isPending

  const handleDeleteProduct = () => {
    if (!id) return
    allowLeaveRef.current = true
    unsavedDirtyRef.current = false
    deleteProduct.mutate(id, { onSuccess: () => navigate('/products') })
  }

  return (
    <FormPageWithNav
      activeSectionKey={activeTab}
      nav={null}
    >
      <CatalogEditStickyBar
        onBack={leaveProductForm}
        title={isEdit ? 'Edit Product' : 'New Product'}
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
        saveLabel={isEdit ? 'Update Product' : 'Create Product'}
        isSaving={isSaving}
        isEdit={isEdit}
        onDelete={handleDeleteProduct}
        isDeleting={deleteProduct.isPending}
        deleteConfirmMessage="Delete this product?"
      />

      <FormSectionTabs
        sections={productSections}
        activeKey={activeTab}
        onChange={toggle}
        completedSections={completedSections}
        hasErrorSections={hasErrorSections}
      />

      {/* ── Form ──────────────────────────────────────────────── */}
      <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit, onFormInvalid)} className={formEditLayout.formStack}>

        {/* 1. Basic */}
        <Section title="Basic" icon={Package} open={activeTab === 'basic'} onToggle={() => toggle('basic')} surface="product" sectionId="basic">
          <div className={formEditLayout.sectionBody}>
            <div className={cn(formEditLayout.fieldGridWide, 'items-start')}>
              <FormField label="Name" required><Input className="w-full min-w-0" {...register('name')} placeholder="Product name" /></FormField>
              <FormField label="Brand"><Input className="w-full min-w-0" {...register('brand')} placeholder="e.g. Samsung" /></FormField>
              <FormField label="Product Type">
                <Controller
                  name="product_type"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={String(field.value ?? '')}
                      onChange={field.onChange}
                      options={PRODUCT_TYPE_FILTER_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                      className={cn(selectCls, 'w-full min-w-0')}
                    />
                  )}
                />
              </FormField>
              <FormField label="Tags (comma separated)"><Input {...register('tags')} placeholder="tag1, tag2, tag3" /></FormField>
              <FormField label="Material Code">
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
                          navigator.clipboard?.writeText(String(getValues('material_code') || ''))
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
            </div>
            {/* Product type context banner */}
            {productType && productType !== 'physical' && (
              <div className={cn(
                formEditLayout.typeBanner,
                isDigitalType ? 'border-blue-200 bg-blue-50 text-blue-800' :
                isSubscriptionType ? 'border-primary/30 bg-accent text-primary' :
                isBundleType ? 'border-amber-200 bg-amber-50 text-amber-800' : '',
              )}>
                {isDigitalType && <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {isSubscriptionType && <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {isBundleType && <ShoppingBag className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <div>
                  {isDigitalType && <><strong>Digital Product:</strong> Shipping, inventory, and return sections are hidden. Add download URL and access limits in the Digital Product section below.</>}
                  {isSubscriptionType && <><strong>Subscription Product:</strong> Each plan/variant carries its own billing interval, per-cycle price, trial period &amp; setup fee. The end user can select their preferred plan on the business front.</>}
                  {isBundleType && <><strong>Bundle Product:</strong> Variants are replaced by the Bundle Items section — select products to include. Add download details if the bundle is digital.</>}
                </div>
              </div>
            )}
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
                    field_kind: 'product_short',
                    name: watchedName,
                    category: [watchedCategory, watchedSubcategory].filter(Boolean).join(' › '),
                    extra_context: { brand: watchedBrand, product_type: productType },
                  }}
                />
              </FormField>
              <FormField label="Description" className="sm:col-span-2">
                <AiDescriptionTextarea
                  value={watchedDescription || ''}
                  onChange={(v) => setValue('description', v, { shouldDirty: true })}
                  rows={2}
                  className={textareaCls}
                  placeholder="Detailed product description..."
                  maxLength={2000}
                  context={{
                    field_kind: 'product_description',
                    name: watchedName,
                    category: [watchedCategory, watchedSubcategory].filter(Boolean).join(' › '),
                    extra_context: {
                      brand: watchedBrand,
                      product_type: productType,
                      short_description: watchedShortDescription,
                    },
                  }}
                />
              </FormField>
            </div>
            <div className={cn(formEditLayout.fieldGrid, 'items-start')}>
              <div className="space-y-1.5 sm:col-span-2">
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
                <CategoryHierarchyPicker
                  tree={productCategories}
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
            </div>
            {(() => {
              const allFields = collectCustomFieldsFromSelection(
                productCategories,
                watchedCategory || '',
                watchedSubcategory,
              )
              if (allFields.length === 0) return null
              return (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 space-y-1.5">
                  <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-blue-700">Category Attributes</p>
                  <div className={formEditLayout.fieldGridWide}>
                    {allFields.map((f, i) => (
                      <div key={`cf-${i}`} className="space-y-1">
                        <Label className="text-xs">{f.name} {f.required && <span className="text-red-500">*</span>}</Label>
                        {f.type === 'select' || f.type === 'multiselect' ? (
                          <Select
                            value=""
                            onChange={() => {}}
                            options={selectOptionsWithBlank(`Select ${f.name}`, (f.options || []).map(o => ({ value: o, label: o })))}
                            className={cn(selectCls, 'h-9 text-sm')}
                          />
                        ) : f.type === 'boolean' ? (
                          <Select
                            value=""
                            onChange={() => {}}
                            options={YES_NO_OPTIONS}
                            className={cn(selectCls, 'h-9 text-sm')}
                          />
                        ) : (
                          <Input type={f.type === 'number' ? 'number' : 'text'} placeholder={f.name} className="h-9 text-sm" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </Section>

        {/* Media — below basic on the same tab */}
        {activeTab === 'basic' && isEdit && product && (
          <Card id="form-section-media" className={cn(formDisplayCompact.scrollMarginEdit, formSectionSurfaceClass(activeTab === 'basic'))}>
            <div className={formEditLayout.mediaCard}>
              <CatalogMediaSectionHeader helperText={EDIT_MEDIA_HELPER} />
              <ProductImageUpload images={product.images || []} onUpload={handleUpload} onDelete={handleDelete} onSetPrimary={handleSetPrimary} onReorder={handleReorderImages} onEditImage={handleEditImage} />
            </div>
          </Card>
        )}

        {activeTab === 'basic' && !isEdit && (
          <Card id="form-section-media" className={cn(formDisplayCompact.scrollMarginEdit, formSectionSurfaceClass(activeTab === 'basic'))}>
            <div className={formEditLayout.mediaCard}>
              <CatalogMediaSectionHeader helperText={STAGED_PRODUCT_HELPER} />
              <StagedMediaUpload
                files={pendingFiles}
                previews={pendingPreviews}
                primaryIndex={pendingPrimaryIndex}
                onPrimaryIndexChange={setPendingPrimaryIndex}
                onReorderFiles={reorderPendingFiles}
                onAddFiles={addPendingFiles}
                onRemoveFile={removePendingFile}
                onReplaceFile={replacePendingFile}
                pickerTitle="Product media"
              />
            </div>
          </Card>
        )}

        {/* 4b. Variants — not applicable for bundle (bundle = set of other products) */}
        {!isBundleType && activeTab === 'variants' && (
          <div
            id="form-section-variants"
            className={cn(formDisplayCompact.scrollMarginEdit, 'flex flex-col gap-1.5 sm:gap-2')}
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {isSubscriptionType
                    ? 'Each plan has its own pricing, stock, and media.'
                    : isEdit
                      ? 'Add variants manually, or use Fast entry variants for prices & stock in bulk.'
                      : 'Add variants manually, or open Configure & Manage Variants to set up options in bulk (saves the product first).'}
                </p>
                <div className="flex shrink-0 gap-2 self-end sm:self-auto">
                {!isSubscriptionType && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isOpeningVariantConfig || isSaving}
                    onClick={() => void handleOpenVariantConfig()}
                    title={variantFields.length > 0
                      ? 'Fast-edit variant prices, stock, SKUs, and activation'
                      : isEdit
                        ? 'Define configurable attributes, IF/THEN rules, generate variants in bulk, and manage every variant in a grid'
                        : 'Save this product and open the guided variant setup wizard'}
                  >
                    {(isOpeningVariantConfig || isSaving) ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : variantFields.length > 0 ? (
                      <Zap className="w-4 h-4 mr-1" />
                    ) : (
                      <Layers className="w-4 h-4 mr-1" />
                    )}
                    {variantFields.length > 0 ? 'Fast entry variants' : 'Configure & Manage Variants'}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextIndex = (getValues('variants') || []).length
                    appendVariant(makeVariantDefaults(
                      isSubscriptionType ? `Plan ${nextIndex + 1}` : `Variant ${nextIndex + 1}`,
                      {},
                    ))
                    setExpandedVariants(p => ({ ...p, [nextIndex]: true }))
                    setVariantsPage(Math.floor(nextIndex / variantsPageSize) + 1)
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />{isSubscriptionType ? 'Add plan' : 'Add variant'}
                </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:gap-2.5">
            {variantFields.length === 0 ? (
              <p className="rounded-lg bg-muted/25 py-4 text-center text-xs text-gray-500 sm:text-sm">
                {isSubscriptionType
                  ? 'No plans yet — use Add plan to define pricing.'
                  : isEdit
                    ? 'No variants yet — use Add variant, or open Configure & Manage Variants for bulk generation.'
                    : 'No variants yet — use Add variant, or Configure & Manage Variants to set up options in bulk.'}
              </p>
            ) : (
              <>
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(variantFields.length / variantsPageSize))
                  const safePage = Math.min(variantsPage, totalPages)
                  const pageStart = (safePage - 1) * variantsPageSize
                  const pageFields = variantFields.slice(pageStart, pageStart + variantsPageSize)
                  return (
                    <>
                {pageFields.map((vf, i) => {
                  const index = pageStart + i
                  const isActive = watch(`variants.${index}.is_active`)
                  const isExpanded = expandedVariants[index] ?? false
                  const variantName = watch(`variants.${index}.name`)
                  const variantDbId = watch(`variants.${index}.id`) as string | undefined
                  const variantColor = watch(`variants.${index}.color`) as string | undefined
                  const accentColor = resolveVariantAccentColor(variantColor, index)
                  const uiAccent = variantUiAccentColor(accentColor, index)
                  const lightAccent = isLightAccentColor(accentColor)
                  const vPrice = parseFloat(String(watch(`variants.${index}.price`) || 0))
                  const vQtyOnHand = watch(`variants.${index}.quantity`) ?? 0
                  const vUomQty = watch(`variants.${index}.uom_quantity`)
                  const vUom = watch(`variants.${index}.uom`) || 'piece'
                  const vCurrency = watch(`variants.${index}.currency`) || 'INR'
                  const vCurrSym = CURRENCY_SYMBOLS[vCurrency] || '₹'
                  const vPackLabel = formatUomDisplay(vUomQty, vUom)
                  const variantDisplayNum = index + 1
                  return (
                  <FormTintPanel
                    key={variantDbId || vf.id}
                    panelId={`variant-panel-${index}`}
                    accentColor={accentColor}
                    active={isActive}
                    headerAccentOnly
                    className={cn(
                      'overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm',
                      !isActive && 'border-border/50 opacity-90',
                    )}
                    header={
                    <div
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-1.5 sm:px-2.5 cursor-pointer select-none',
                        isActive ? 'hover:bg-muted/30' : 'hover:bg-muted/20',
                      )}
                      onClick={() => toggleVariant(index)}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0',
                            !isActive && 'bg-gray-400',
                          )}
                          style={isActive ? { backgroundColor: uiAccent } : undefined}
                        >{variantDisplayNum}</span>
                        {isSubscriptionType ? (
                          <Input
                            {...register(`variants.${index}.name`, {
                              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                                register(`variants.${index}.name`).onChange(e)
                                syncVariantNameAttributes(index, e.target.value)
                              },
                            })}
                            onClick={e => e.stopPropagation()}
                            onFocus={e => e.stopPropagation()}
                            placeholder={`Plan ${index + 1}`}
                            className={cn(
                              'h-7 min-w-[6.5rem] max-w-[11rem] flex-1 text-xs font-semibold',
                              'bg-background border-border text-foreground',
                              !isActive && 'text-muted-foreground',
                            )}
                            style={isActive && !lightAccent ? { color: uiAccent } : undefined}
                          />
                        ) : (
                          <Input
                            {...register(`variants.${index}.name`, {
                              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                                register(`variants.${index}.name`).onChange(e)
                                syncVariantNameAttributes(index, e.target.value)
                              },
                            })}
                            onClick={e => e.stopPropagation()}
                            onFocus={e => e.stopPropagation()}
                            placeholder={`Variant ${index + 1}`}
                            className={cn(
                              'h-7 min-w-[6.5rem] max-w-[11rem] flex-1 text-xs font-semibold',
                              'bg-background border-border text-foreground',
                              !isActive && 'text-muted-foreground',
                            )}
                            style={isActive && !lightAccent ? { color: uiAccent } : undefined}
                          />
                        )}
                        {!isActive && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground shrink-0">Inactive</span>
                        )}
                        {!isExpanded && (
                          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                            <span className="font-medium text-foreground tabular-nums">{vCurrSym}{vPrice.toLocaleString()}</span>
                            <span className="text-border">·</span>
                            <span>{vPackLabel}</span>
                            <span className="text-border">·</span>
                            <span>Stock {vQtyOnHand}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <Controller
                          name={`variants.${index}.is_active`}
                          control={control}
                          render={({ field }) => (
                            <Toggle compact label="Active" checked={field.value} onChange={field.onChange} />
                          )}
                        />
                        <Button type="button" variant="ghost" size="sm" className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 h-7 w-7 p-0" title="Copy variant" onClick={(e) => {
                          e.preventDefault()
                          copyVariant(index)
                        }}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        {confirmDeleteVariant === index ? (
                          <div className="flex items-center gap-1">
                            <Button type="button" size="sm" className="h-6 px-1.5 text-[10px] bg-red-600 hover:bg-red-700 text-white" onClick={(e) => { e.preventDefault(); removeVariant(index); setConfirmDeleteVariant(null) }}>
                              Delete
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={(e) => { e.preventDefault(); setConfirmDeleteVariant(null) }}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0" title="Delete variant" onClick={(e) => { e.preventDefault(); setConfirmDeleteVariant(index) }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                    }
                  >
                    {isExpanded && (
                    <div className={cn(variantFormUi.body, variantFormUi.bodyLayout)}>
                    <div className={variantFormUi.fieldsColumn}>
                    {/* ── Subscription Billing + Price basis (compact) ── */}
                    {isSubscriptionType && (
                      <VariantFormSection title="Billing">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-[10px] text-muted-foreground">Per-cycle or per-UOM pricing</p>
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
                        <div className={cn('grid grid-cols-2 md:grid-cols-4', variantFormUi.grid)}>
                          <FormField label="Interval">
                            <Controller
                              name={`variants.${index}.subscription_interval`}
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={String(field.value ?? '')}
                                  onChange={field.onChange}
                                  options={SUBSCRIPTION_INTERVAL_OPTIONS}
                                  className={selectCls}
                                />
                              )}
                            />
                          </FormField>
                          <FormField label="Max Cycles"><Input type="number" min="0" {...register(`variants.${index}.subscription_billing_cycles`)} placeholder="0 = ∞" /></FormField>
                          <FormField label="Trial (days)"><Input type="number" min="0" {...register(`variants.${index}.subscription_trial_days`)} placeholder="14" /></FormField>
                          <FormField label="Setup Fee"><Input type="number" step="0.01" min="0" {...register(`variants.${index}.subscription_setup_fee`)} placeholder="99" /></FormField>
                        </div>
                        {/* Schedule modes allowed for customers */}
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-1">Customer scheduling options</p>
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
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-primary'
                                  }`}>
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </VariantFormSection>
                    )}
                    {/* ── Pricing + Discount (merged, compact) ── */}
                    {(() => {
                      const vPriceType = watch(`variants.${index}.price_type`) || 'per_unit'
                      const priceLabel = isSubscriptionType
                        ? (vPriceType === 'per_cycle' ? 'Price / Cycle' : 'Price')
                        : 'Price'
                      const price     = parseFloat(String(watch(`variants.${index}.price`) || 0))
                      const compareAt = parseFloat(String(watch(`variants.${index}.compare_at_price`) || 0))
                      const cost      = parseFloat(String(watch(`variants.${index}.cost_price`) || 0))
                      const discPct   = parseFloat(String(watch(`variants.${index}.discount_percentage`) || 0))
                      const discAmt   = parseFloat(String(watch(`variants.${index}.discount_amount`) || 0))
                      const promoStart = watch(`variants.${index}.discount_start_date` as any) as string | undefined
                      const promoEnd   = watch(`variants.${index}.discount_end_date` as any) as string | undefined
                      const autoDiscPct = (compareAt > 0 && price >= 0 && compareAt > price)
                        ? parseFloat(((compareAt - price) / compareAt * 100).toFixed(2)) : 0
                      const profit = (price > 0 && cost > 0) ? price - cost : null
                      const margin = profit != null ? (profit / price * 100) : null
                      const currSym = CURRENCY_SYMBOLS[watch(`variants.${index}.currency`) || 'INR'] || '₹'
                      const hasPromoDates = !!(promoStart && promoEnd)

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
                          <VariantFormSection title="Pricing">
                            <div className={cn(
                              variantFormUi.pricingGrid,
                              variantFormUi.grid,
                              '[&_input[type=number]]:tabular-nums',
                            )}>
                              <FormField label="Qty">
                                <Input type="number" min="0" step="any" className="w-full"
                                  {...register(`variants.${index}.uom_quantity`)} placeholder="1" />
                              </FormField>
                              <FormField label="UOM">
                                <Controller
                                  name={`variants.${index}.uom`}
                                  control={control}
                                  render={({ field }) => (
                                    <Select
                                      value={String(field.value ?? '')}
                                      onChange={field.onChange}
                                      options={UOM_SELECT_OPTIONS}
                                      className={cn(selectCls, 'w-full')}
                                    />
                                  )}
                                />
                              </FormField>
                              <FormField label={priceLabel}>
                                <Input type="number" step="0.01" min="0" className="w-full"
                                  {...register(`variants.${index}.price`)}
                                  onChange={e => {
                                    register(`variants.${index}.price`).onChange(e)
                                    syncPriceFields(parseFloat(e.target.value||'0'), parseFloat(String(watch(`variants.${index}.compare_at_price`)||0)))
                                  }}
                                  placeholder={isSubscriptionType && vPriceType === 'per_cycle' ? '499' : '99'} />
                              </FormField>
                              <FormField label="Compare at">
                                <Input type="number" step="0.01" min="0" className="w-full"
                                  {...register(`variants.${index}.compare_at_price`)}
                                  onChange={e => {
                                    register(`variants.${index}.compare_at_price`).onChange(e)
                                    syncPriceFields(parseFloat(String(watch(`variants.${index}.price`)||0)), parseFloat(e.target.value||'0'))
                                  }} placeholder="MRP" />
                              </FormField>
                              <FormField label="Cost">
                                <Input type="number" step="0.01" min="0" className="w-full"
                                  {...register(`variants.${index}.cost_price`)} placeholder="0" />
                              </FormField>
                              <FormField label="Currency">
                                <Controller
                                  name={`variants.${index}.currency`}
                                  control={control}
                                  render={({ field }) => (
                                    <Select
                                      value={String(field.value ?? '')}
                                      onChange={field.onChange}
                                      options={CURRENCY_SELECT_OPTIONS}
                                      className={cn(selectCls, 'w-full')}
                                    />
                                  )}
                                />
                              </FormField>
                            </div>
                            {(autoDiscPct > 0 || profit != null) && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {autoDiscPct > 0 && (
                                  <VariantMetricChip tone="discount" icon={Tag}>
                                    {autoDiscPct.toFixed(1)}% off
                                    {compareAt > 0 && <span className="font-normal opacity-75">vs {currSym}{compareAt.toLocaleString()}</span>}
                                  </VariantMetricChip>
                                )}
                                {profit != null && (
                                  <VariantMetricChip tone={profit >= 0 ? 'profit' : 'loss'} icon={BarChart3}>
                                    {profit >= 0 ? 'Margin' : 'Loss'}: {currSym}{Math.abs(profit).toLocaleString()}
                                    {margin != null && <span className="font-normal opacity-80">({margin.toFixed(1)}%)</span>}
                                  </VariantMetricChip>
                                )}
                              </div>
                            )}
                          </VariantFormSection>

                          <VariantFormSection title="Promotion">
                            <div className={cn(variantFormUi.promoGrid, variantFormUi.grid, 'min-w-0 [&>div]:min-w-0')}>
                              <FormField label="Disc %" name={`variants.${index}.discount_percentage`} className="min-w-0">
                                <InputWithSuffix suffix="%" type="number" step="0.01" min="0" max="100" className="w-full"
                                  {...register(`variants.${index}.discount_percentage`)} placeholder="0" />
                              </FormField>
                              <FormField label="Disc Amt" name={`variants.${index}.discount_amount`} className="min-w-0">
                                <InputWithPrefix prefix={currSym} type="number" step="0.01" min="0" className="w-full"
                                  {...register(`variants.${index}.discount_amount`)} placeholder="0" />
                              </FormField>
                              <FormField label="Offer Label" className="min-w-0">
                                <Input className="w-full min-w-0" {...register(`variants.${index}.offer_label`)}
                                  placeholder={autoDiscPct > 0 ? `${autoDiscPct.toFixed(1)}% OFF` : 'Flash Sale'} />
                              </FormField>
                              <FormField label="Promo Start" className="min-w-0">
                                <Input type="datetime-local" className="w-full min-w-0"
                                  {...register(`variants.${index}.discount_start_date` as any)} />
                              </FormField>
                              <FormField label="Promo End" className="min-w-0">
                                <Input type="datetime-local" className="w-full min-w-0"
                                  {...register(`variants.${index}.discount_end_date` as any)} />
                              </FormField>
                              <div className="flex min-w-0 items-end pb-0.5">
                                <Controller name={`variants.${index}.is_on_sale`} control={control} render={({ field }) => (
                                  <Toggle compact label="On Sale" checked={field.value} onChange={field.onChange} />
                                )} />
                              </div>
                            </div>
                            {(discPct > 0 || discAmt > 0 || hasPromoDates) && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                                {discPct > 0 && <span className="font-medium text-orange-700">{discPct.toFixed(1)}% OFF</span>}
                                {discAmt > 0 && <span className="font-medium text-orange-700">{currSym}{discAmt.toLocaleString()} off</span>}
                                {hasPromoDates && (
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {new Date(promoStart!).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                    {' → '}
                                    {new Date(promoEnd!).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                  </span>
                                )}
                              </div>
                            )}
                          </VariantFormSection>
                        </>
                      )
                    })()}

                    <VariantFormSection
                      title="Inventory & IDs"
                      hint={autoGenerateBarcode ? 'Barcodes auto-fill on variant generate' : 'Barcodes are manual — Inventory Config'}
                    >
                      <div className={cn(variantFormUi.inventoryGrid, variantFormUi.grid)}>
                        <FormField label="SKU"><Input {...register(`variants.${index}.sku`)} placeholder="Optional" /></FormField>
                        <FormField label="Barcode">
                          <Input
                            {...register(`variants.${index}.barcode`)}
                            placeholder={autoGenerateBarcode ? 'Auto when generating variants, or type here' : 'Enter barcode manually'}
                          />
                        </FormField>
                        <FormField label="Qty on hand">
                          <Input type="number" min="0" {...register(`variants.${index}.quantity`)}
                            className="font-semibold bg-primary/10 border-primary/30 dark:bg-primary/15 dark:border-primary/40" />
                        </FormField>
                        <FormField label="Low stock at"><Input type="number" min="0" {...register(`variants.${index}.low_stock_threshold`)} placeholder="5" /></FormField>
                        <FormField label="Status">
                          <Controller
                            name={`variants.${index}.stock_status`}
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={String(field.value ?? '')}
                                onChange={field.onChange}
                                options={VARIANT_STOCK_STATUS_OPTIONS}
                                className={selectCls}
                              />
                            )}
                          />
                        </FormField>
                        <FormField label="Reorder at"><Input type="number" min="0" {...register(`variants.${index}.reorder_point`)} placeholder="—" /></FormField>
                        <FormField label="Max per order">
                          <Input type="number" min="1" {...register(`variants.${index}.max_quantity_per_order`)} placeholder="No limit" />
                        </FormField>
                        <FormField label="Min per order">
                          <Input type="number" min="1" {...register(`variants.${index}.min_quantity_per_order`)} placeholder="1" />
                        </FormField>
                        <FormField label="Weight (kg)" className="max-w-[7.5rem]">
                          <Input type="number" step="0.001" min="0" placeholder="0.000" {...register(`variants.${index}.weight_kg`)} />
                        </FormField>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Controller name={`variants.${index}.track_inventory`} control={control} render={({ field }) => (
                          <Toggle compact label="Track Inventory" checked={field.value} onChange={field.onChange} />
                        )} />
                        <Controller name={`variants.${index}.allow_backorders`} control={control} render={({ field }) => (
                          <Toggle compact label="Backorders" checked={field.value} onChange={field.onChange} />
                        )} />
                        <Controller name={`variants.${index}.show_lifecycle`} control={control} render={({ field }) => (
                          <Toggle compact label="Lifecycle" checked={field.value} onChange={field.onChange} />
                        )} />
                        {watch('return_warranty_per_variant') && (
                          <Controller name={`variants.${index}.show_return_warranty`} control={control} render={({ field }) => (
                            <Toggle compact label="Return & Warranty" checked={field.value} onChange={field.onChange} />
                          )} />
                        )}
                      </div>
                    </VariantFormSection>
                    {/* Lifecycle dates — expandable */}
                    {watch(`variants.${index}.show_lifecycle`) && (
                      <div className="grid grid-cols-3 gap-2">
                        <FormField label="Manufactured"><Input type="date" {...register(`variants.${index}.manufacture_date`)} /></FormField>
                        <FormField label="Expires"><Input type="date" {...register(`variants.${index}.expiration_date`)} /></FormField>
                        <FormField label="Best before"><Input type="date" {...register(`variants.${index}.best_before_date`)} /></FormField>
                      </div>
                    )}
                    {/* Return & Warranty — expandable */}
                    {watch('return_warranty_per_variant') && watch(`variants.${index}.show_return_warranty`) && (
                      <div className="space-y-2">
                        <div className={cn('grid grid-cols-2 md:grid-cols-4', variantFormUi.grid)}>
                          <FormField label="Return Window (days)"><Input type="number" min="0" {...register(`variants.${index}.return_days`)} placeholder="30" /></FormField>
                          <FormField label="Refund Policy">
                            <Controller
                              name={`variants.${index}.refund_policy`}
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={String(field.value ?? '')}
                                  onChange={field.onChange}
                                  options={REFUND_POLICY_OPTIONS}
                                  className={selectCls}
                                />
                              )}
                            />
                          </FormField>
                          <FormField label="Warranty (days)"><Input type="number" min="0" {...register(`variants.${index}.warranty_period_days`)} /></FormField>
                          <FormField label="Warranty Type">
                            <Controller
                              name={`variants.${index}.warranty_type`}
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={String(field.value ?? '')}
                                  onChange={field.onChange}
                                  options={WARRANTY_TYPE_OPTIONS}
                                  className={selectCls}
                                />
                              )}
                            />
                          </FormField>
                        </div>
                        <FormField label="Return Conditions"><Input {...register(`variants.${index}.return_conditions`)} placeholder='e.g. "Unopened, with tags"' className="max-w-lg" /></FormField>
                      </div>
                    )}
                    {/* Hidden fields — keep form state but no visible UI */}
                    <input type="hidden" {...register(`variants.${index}.attributes_json`)} />
                    <input type="hidden" {...register(`variants.${index}.id`)} />
                    </div>

                    <aside className={variantFormUi.mediaColumn}>
                    {/* ── Variant Media (saved variants — live upload; new rows — staged until save) ── */}
                    {(() => {
                      const variantId = watch(`variants.${index}.id`) as string | undefined
                      const skuNum = index + 1
                      const displayName = variantName || `Variant ${skuNum}`

                      if (variantId) {
                        return (
                          <VariantMediaEdit
                            key={variantId}
                            variantId={variantId}
                            variantName={displayName}
                            initialMedia={product?.variants?.find(v => v.id === variantId)?.media || []}
                            onChanged={(nextMedia) => {
                              // Patch cache only — full invalidate remounts the form and collapses the variant panel.
                              if (!id) return
                              qc.setQueryData(vendorKeys.product(id), (old: Product | undefined) => {
                                if (!old?.variants) return old
                                return {
                                  ...old,
                                  variants: old.variants.map((v) =>
                                    v.id === variantId ? { ...v, media: nextMedia } : v,
                                  ),
                                }
                              })
                            }}
                            layout="stacked"
                          />
                        )
                      }

                      const bucket = pendingVariantMedia.get(index) ?? emptyStagedVariantBucket()
                      return (
                        <VariantFormSection title="Media" hint="Saved with product">
                          <StagedMediaUpload
                            files={bucket.files}
                            previews={bucket.previews}
                            primaryIndex={bucket.primaryIndex}
                            onPrimaryIndexChange={(pi) => setStagedVariantPrimary(index, pi)}
                            onReorderFiles={(from, to) => reorderStagedVariantFiles(index, from, to)}
                            onAddFiles={(files) => addStagedVariantFiles(index, files)}
                            onRemoveFile={(fi) => removeStagedVariantFile(index, fi)}
                            onReplaceFile={(fi, file) => replaceStagedVariantFile(index, fi, file)}
                            pickerTitle={`Variant media — ${displayName}`}
                            layout="stacked"
                          />
                        </VariantFormSection>
                      )
                    })()}
                    </aside>
                    </div>
                    )}
                  </FormTintPanel>
                  )
                })}
                {variantFields.length > 0 && (
                <TablePagination
                  page={safePage}
                  pages={totalPages}
                  total={variantFields.length}
                  pageSize={variantsPageSize}
                  onPageChange={setVariantsPage}
                  onPageSizeChange={setVariantsPageSize}
                  itemLabel="variants"
                  rowsPerPageLabel="Variants per page"
                  pageSizeOptions={[5, 10, 25, 50, 100]}
                  className="rounded-lg border bg-muted/20 px-3 py-2"
                />
                )}
                    </>
                  )
                })()}
              </>
            )}
            </div>
          </div>
        )}

        {/* ── Bundle Items (only for bundle product type) ─────── */}
        {isBundleType && (
          <Section title="Bundle Items" icon={ShoppingBag} open={activeTab === 'bundle'} onToggle={() => toggle('bundle')} sectionId="bundle">
            <div className={formEditLayout.sectionBody}>
              <p className="text-sm text-gray-500">Select products to include in this bundle. Customers will receive all selected items as a set.</p>
              {(() => {
                const eligible = allProducts.filter(p => !id || p.id !== id)
                const q = bundleItemSearch.trim().toLowerCase()
                const filtered = q
                  ? eligible.filter(p =>
                      p.name?.toLowerCase().includes(q) ||
                      p.sku?.toLowerCase().includes(q) ||
                      p.category?.toLowerCase().includes(q)
                    )
                  : eligible
                if (eligible.length === 0) {
                  return <p className="text-sm text-gray-400 italic">No other products found. Create products first, then add them here.</p>
                }
                return (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by name, SKU, or category…"
                        value={bundleItemSearch}
                        onChange={e => setBundleItemSearch(e.target.value)}
                        autoComplete="off"
                        className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    {filtered.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No products match your search.</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                        {filtered.map(p => {
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
                  </>
                )
              })()}
              {bundleItemIds.length > 0 && (
                <p className="text-xs text-indigo-600 font-medium">{bundleItemIds.length} item{bundleItemIds.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>
          </Section>
        )}

        {/* 5c. Pricing & Inventory — bundle only (other types use variant-level pricing) */}
        {isBundleType && <Section title="Pricing & Inventory" icon={IndianRupee} open={activeTab === 'bundle'} onToggle={() => toggle('bundle')}>
          <div className={formEditLayout.sectionBody}>

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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                      <FormField label="Qty">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          {...register('uom_quantity')}
                          placeholder="e.g. 500"
                        />
                      </FormField>
                      <FormField label="UOM">
                        <Controller
                          name="uom"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={String(field.value ?? '')}
                              onChange={field.onChange}
                              options={UOM_SELECT_OPTIONS}
                              className={selectCls}
                            />
                          )}
                        />
                      </FormField>
                      <FormField label="Price *">
                        <Input type="number" step="0.01" min="0"
                          {...register('price')}
                          onChange={e => {
                            register('price').onChange(e)
                            syncBasePrices(parseFloat(e.target.value||'0'), parseFloat(String(watch('compare_at_price')||0)))
                          }}
                          placeholder="0.00" />
                      </FormField>
                      <FormField label="Compare At Price">
                        <Input type="number" step="0.01" min="0"
                          {...register('compare_at_price')}
                          onChange={e => {
                            register('compare_at_price').onChange(e)
                            syncBasePrices(parseFloat(String(watch('price')||0)), parseFloat(e.target.value||'0'))
                          }}
                          placeholder="Original / MRP" />
                      </FormField>
                      <FormField label="Cost Price"><Input type="number" step="0.01" min="0" {...register('cost_price')} placeholder="Your cost" /></FormField>
                      <FormField label="Currency">
                        <Controller
                          name="currency"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={String(field.value ?? '')}
                              onChange={field.onChange}
                              options={CURRENCY_BUNDLE_OPTIONS}
                              className={selectCls}
                            />
                          )}
                        />
                      </FormField>
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
                      <FormField label="Discount %">
                        <Input type="number" step="0.01" min="0" max="100" {...register('discount_percentage')} placeholder="Auto from price gap" />
                      </FormField>
                      <FormField label="Discount Amount">
                        <Input type="number" step="0.01" min="0" {...register('discount_amount')} placeholder="₹ off — auto-filled" />
                      </FormField>
                      <FormField label="Offer Label">
                        <Input {...register('offer_label')} placeholder={bAutoDiscPct2 > 0 ? `${bAutoDiscPct2.toFixed(1)}% OFF` : '"Diwali Sale"'} />
                      </FormField>
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
                              className={`relative inline-flex h-5 w-9 rounded-full border-2 transition-colors ${field.value ? 'border-transparent bg-orange-500' : 'border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600'}`}>
                              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${field.value ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="Promo Starts"><Input type="datetime-local" {...register('discount_start_date')} /></FormField>
                        <FormField label="Promo Ends"><Input type="datetime-local" {...register('discount_end_date')} /></FormField>
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
                    <FormField label="Quantity"><Input type="number" min="0" {...register('quantity')} placeholder="0" /></FormField>
                    <FormField label="Low Stock Alert (qty)"><Input type="number" min="0" {...register('low_stock_threshold')} placeholder="5" /></FormField>
                    <FormField label="Reorder Point"><Input type="number" min="0" {...register('reorder_point')} placeholder="e.g. 10" /></FormField>
                    <FormField label="Reorder Qty"><Input type="number" min="0" {...register('reorder_quantity')} placeholder="e.g. 50" /></FormField>
                  </div>
                  <FormField label="Stock Status">
                    <Controller
                      name="stock_status"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={String(field.value ?? '')}
                          onChange={field.onChange}
                          options={STOCK_STATUS_OPTIONS}
                          className={selectCls}
                        />
                      )}
                    />
                  </FormField>
                </div>
              </div>
            )}
          </div>
        </Section>}

        {/* 5d. Advanced Pricing Rules — party, location, scheduled, quantity, channel */}
        {isEdit && id && (
          <Section title="Advanced Pricing" icon={DollarSign} open={activeTab === 'pricing-rules'} onToggle={() => toggle('pricing-rules')} sectionId="pricing-rules">
            <div className={formEditLayout.sectionBody}>
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
                              <th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>Name</TableColumnLabel></th>
                              {priceRuleTab === 'party' && <><th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>Group</TableColumnLabel></th></>}
                              {priceRuleTab === 'location' && <><th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>State</TableColumnLabel></th><th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>City</TableColumnLabel></th><th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>Pincode</TableColumnLabel></th></>}
                              {priceRuleTab === 'scheduled' && <><th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>Start</TableColumnLabel></th><th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>End</TableColumnLabel></th></>}
                              {priceRuleTab === 'quantity' && <><th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>Min Qty</TableColumnLabel></th><th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>Max Qty</TableColumnLabel></th></>}
                              {priceRuleTab === 'channel' && <th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>Channel</TableColumnLabel></th>}
                              <th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>Price</TableColumnLabel></th>
                              <th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>Discount %</TableColumnLabel></th>
                              <th className="px-3 py-2 font-medium text-gray-600"><TableColumnLabel>Active</TableColumnLabel></th>
                              <th className="px-3 py-2 font-medium text-gray-600 text-right"><TableColumnLabel>Actions</TableColumnLabel></th>
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
                                  <button type="button" onClick={async () => { if (await askConfirm('Delete this price rule?')) deletePriceRule.mutate({ productId: id!, ruleId: rule.id }) }}
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

        {/* Tax & Compliance */}
        <Section title="Tax & Compliance" icon={Receipt} open={activeTab === 'tax'} onToggle={() => toggle('tax')} sectionId="tax">
          <div className={formEditLayout.sectionBody}>
            {variantFields.length > 0 && !isBundleType ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Set tax rates and HSN codes for each variant.</p>
                {variantFields.map((vf, index) => (
                  <div key={vf.id} className="rounded-lg border border-border/80 bg-muted/10 p-3 space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {watch(`variants.${index}.name`) || (isSubscriptionType ? `Plan ${index + 1}` : `Variant ${index + 1}`)}
                    </p>
                    <div className={cn('grid grid-cols-2 md:grid-cols-6 items-end', variantFormUi.grid)}>
                      <FormField label="Tax %">
                        <Input type="number" step="0.01" min="0" max="100" {...register(`variants.${index}.tax_rate`)} placeholder="0" />
                      </FormField>
                      <FormField label="GST %">
                        <Input type="number" step="0.01" min="0" max="100" {...register(`variants.${index}.gst_rate`)} placeholder="0" />
                      </FormField>
                      <FormField label="HSN">
                        <Input {...register(`variants.${index}.hsn_code`)} placeholder="85171290" maxLength={8} />
                      </FormField>
                      <div className="flex items-center pb-1.5">
                        <Controller name={`variants.${index}.is_taxable`} control={control} render={({ field }) => (
                          <Toggle label="Taxable" checked={field.value} onChange={field.onChange} />
                        )} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center">
                  <Controller name="is_taxable" control={control} render={({ field }) => (
                    <Toggle label="Taxable" checked={field.value} onChange={field.onChange} />
                  )} />
                </div>
                {watch('is_taxable') && (
                  <div className={cn('grid grid-cols-2 md:grid-cols-6', variantFormUi.grid)}>
                    <FormField label="Tax %">
                      <Input type="number" step="0.01" min="0" max="100" {...register('tax_rate')} placeholder="e.g. 18" />
                    </FormField>
                    <FormField label="GST %">
                      <Input type="number" step="0.01" min="0" max="100" {...register('gst_rate')} placeholder="e.g. 18" />
                    </FormField>
                    <FormField label="HSN">
                      <Input {...register('hsn_code')} placeholder="85171290" maxLength={8} />
                    </FormField>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* 6. Return & Warranty — not for digital or bundle */}
        {!isDigitalType && !isBundleType && <Section title="Return & Warranty" icon={RotateCcw} open={activeTab === 'returns'} onToggle={() => toggle('returns')} sectionId="returns">
          <div className={formEditLayout.sectionBody}>
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
                  <FormField label="Return Window (days)"><Input type="number" min="0" {...register('return_days')} placeholder="e.g. 30" /></FormField>
                  <FormField label="Refund Policy">
                    <Controller
                      name="refund_policy"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={String(field.value ?? '')}
                          onChange={field.onChange}
                          options={REFUND_POLICY_OPTIONS}
                          className={selectCls}
                        />
                      )}
                    />
                  </FormField>
                  <FormField label="Warranty (days)"><Input type="number" min="0" {...register('warranty_period_days')} placeholder="e.g. 365" /></FormField>
                  <FormField label="Warranty Type">
                    <Controller
                      name="warranty_type"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={String(field.value ?? '')}
                          onChange={field.onChange}
                          options={WARRANTY_TYPE_OPTIONS}
                          className={selectCls}
                        />
                      )}
                    />
                  </FormField>
                </div>
                <FormField label="Return Policy"><textarea {...register('return_policy')} rows={2} className={textareaCls} placeholder="Describe your return policy..." /></FormField>
                <FormField label="Return Conditions"><Input {...register('return_conditions')} placeholder='e.g. "Unopened, with tags, within 30 days"' /></FormField>
              </>
            )}
          </div>
        </Section>}

        {/* 7. Shipping & Delivery — physical and subscription only */}
        {(isPhysical || isSubscriptionType) && (
          <Section title="Shipping & Delivery" icon={Truck} open={activeTab === 'shipping'} onToggle={() => toggle('shipping')} sectionId="shipping">
            <div className={formEditLayout.sectionBody}>
              <Controller name="requires_shipping" control={control} render={({ field }) => (
                <Toggle label="Requires Shipping" checked={field.value} onChange={field.onChange} />
              )} />
              {watch('requires_shipping') && (<>
              <div className="grid grid-cols-4 gap-4">
                <FormField label={`Weight (${watch('weight_unit') || 'kg'})`}>
                  <div className="flex">
                    <Input type="number" step="0.001" min="0" {...register('weight_kg')} className="rounded-r-none border-r-0 flex-1 min-w-0" />
                    <Controller
                      name="weight_unit"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={String(field.value ?? 'kg')}
                          onChange={field.onChange}
                          options={WEIGHT_UNIT_OPTIONS}
                          className={cn(selectCls, 'rounded-l-none border-l-0 w-[4.5rem] shrink-0 px-1')}
                          wrapperClassName="w-[4.5rem] shrink-0"
                          menuMinWidth={80}
                        />
                      )}
                    />
                  </div>
                </FormField>
                <FormField label={`Length (${watch('length_unit') || 'cm'})`}>
                  <div className="flex">
                    <Input type="number" step="0.01" min="0" {...register('length_cm')} className="rounded-r-none border-r-0 flex-1 min-w-0" />
                    <Controller
                      name="length_unit"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={String(field.value ?? 'cm')}
                          onChange={field.onChange}
                          options={LENGTH_UNIT_OPTIONS}
                          className={cn(selectCls, 'rounded-l-none border-l-0 w-[4.5rem] shrink-0 px-1')}
                          wrapperClassName="w-[4.5rem] shrink-0"
                          menuMinWidth={80}
                        />
                      )}
                    />
                  </div>
                </FormField>
                <FormField label={`Width (${watch('width_unit') || 'cm'})`}>
                  <div className="flex">
                    <Input type="number" step="0.01" min="0" {...register('width_cm')} className="rounded-r-none border-r-0 flex-1 min-w-0" />
                    <Controller
                      name="width_unit"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={String(field.value ?? 'cm')}
                          onChange={field.onChange}
                          options={LENGTH_UNIT_OPTIONS}
                          className={cn(selectCls, 'rounded-l-none border-l-0 w-[4.5rem] shrink-0 px-1')}
                          wrapperClassName="w-[4.5rem] shrink-0"
                          menuMinWidth={80}
                        />
                      )}
                    />
                  </div>
                </FormField>
                <FormField label={`Height (${watch('height_unit') || 'cm'})`}>
                  <div className="flex">
                    <Input type="number" step="0.01" min="0" {...register('height_cm')} className="rounded-r-none border-r-0 flex-1 min-w-0" />
                    <Controller
                      name="height_unit"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={String(field.value ?? 'cm')}
                          onChange={field.onChange}
                          options={LENGTH_UNIT_OPTIONS}
                          className={cn(selectCls, 'rounded-l-none border-l-0 w-[4.5rem] shrink-0 px-1')}
                          wrapperClassName="w-[4.5rem] shrink-0"
                          menuMinWidth={80}
                        />
                      )}
                    />
                  </div>
                </FormField>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField label="Shipping Class">
                  <Controller
                    name="shipping_class"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={String(field.value ?? '')}
                        onChange={field.onChange}
                        options={SHIPPING_CLASS_OPTIONS}
                        className={selectCls}
                      />
                    )}
                  />
                </FormField>
                <FormField label="Shipping Cost Type">
                  <Controller
                    name="shipping_cost_type"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={String(field.value ?? '')}
                        onChange={field.onChange}
                        options={SHIPPING_COST_TYPE_OPTIONS}
                        className={selectCls}
                      />
                    )}
                  />
                </FormField>
                {watch('shipping_cost_type') !== 'free' && watch('shipping_cost_type') !== 'calculated' && (
                  <FormField label={
                    watch('shipping_cost_type') === 'variable' ? 'Cost per kg' :
                    watch('shipping_cost_type') === 'per_uom' ? 'Cost per unit' : 'Shipping Cost'
                  }>
                    <Input type="number" step="0.01" min="0" {...register('shipping_cost')} placeholder={
                      watch('shipping_cost_type') === 'variable' ? 'Rate per kg' :
                      watch('shipping_cost_type') === 'per_uom' ? 'Rate per unit' : 'Fixed amount'
                    } />
                  </FormField>
                )}
                <FormField label="Free Shipping Threshold"><Input type="number" step="0.01" min="0" {...register('free_shipping_threshold')} placeholder="Min order for free" /></FormField>
              </div>
              {watch('shipping_cost_type') && watch('shipping_cost_type') !== 'fixed' && (
                <p className="text-xs text-gray-500 mt-1">
                  {watch('shipping_cost_type') === 'variable' && 'Shipping cost is calculated based on product weight (cost per kg × weight).'}
                  {watch('shipping_cost_type') === 'per_uom' && 'Shipping cost is calculated based on quantity ordered (cost per unit × qty).'}
                  {watch('shipping_cost_type') === 'free' && 'Free shipping for this product. Threshold still applies for other products in the order.'}
                  {watch('shipping_cost_type') === 'calculated' && 'Shipping will be calculated at checkout based on carrier rates and destination.'}
                </p>
              )}
              </>)}
            </div>
          </Section>
        )}

        {/* Business Front Options */}
        <Section title="Business Front Options" icon={ToggleRight} open={activeTab === 'storefrontOptions'} onToggle={() => toggle('storefrontOptions')} sectionId="storefrontOptions">
          <div className={formEditLayout.sectionBody}>
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

        {/* 8b. Visibility & Marketing — status + business front visibility live in sticky header */}
        <Section title="Visibility & Marketing" icon={Eye} open={activeTab === 'visibility'} onToggle={() => toggle('visibility')} sectionId="visibility">
          <div className={formEditLayout.sectionBody}>
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-700">Draft / Active / Archived</span> and <span className="font-medium text-gray-700">Visible</span> are set in the bar at the top so you can change them without scrolling.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
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
        <Section title="Add-ons & Linked Services" icon={Plus} open={activeTab === 'addons'} onToggle={() => toggle('addons')} sectionId="addons">
          <div className={formEditLayout.sectionBody}>
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
                    onFocus={() => setAddonPickerOpen(true)}
                    onBlur={() => setTimeout(() => setAddonPickerOpen(false), 150)}
                    autoComplete="off"
                    className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {addonSearchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />}
                </div>
              </div>
              {addonPickerOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {addonSearchLoading ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">Loading products and services…</p>
                  ) : addonSearchResults.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">
                      {addonSearch.trim().length >= 2 ? 'No matching products or services' : 'No products or services available to add'}
                    </p>
                  ) : (
                    addonSearchResults.map(r => (
                    <button key={r.id} type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-indigo-50 border-b border-gray-50 last:border-0"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setProductAddons(prev => [...prev, {
                          id: r.id, name: r.name, item_type: r.item_type,
                          addon_type: r.item_type === 'service' ? 'install' : 'other',
                          booking_trigger: 'at_sale',
                          optional: true,
                        }])
                        setAddonSearch('')
                        setAddonSearchResults([])
                        setAddonPickerOpen(false)
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
                      <CatalogItemLink
                        id={addon.id}
                        name={addon.name}
                        itemType={addon.item_type}
                        className="text-sm text-gray-800 flex-1 truncate block min-w-0"
                      />
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
                        <Select
                          value={addon.addon_type}
                          onChange={v => setProductAddons(p => p.map((a, i) => i === ai ? { ...a, addon_type: v } : a))}
                          options={ADDON_TYPE_OPTIONS}
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Booking trigger channel */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Book When</label>
                        <Select
                          value={addon.booking_trigger}
                          onChange={v => setProductAddons(p => p.map((a, i) => i === ai ? { ...a, booking_trigger: v } : a))}
                          options={BOOKING_TRIGGER_OPTIONS}
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Status trigger (conditional) */}
                      {addon.booking_trigger === 'on_status' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Trigger Status</label>
                          <Select
                            value={addon.trigger_status || 'delivered'}
                            onChange={v => setProductAddons(p => p.map((a, i) => i === ai ? { ...a, trigger_status: v } : a))}
                            options={TRIGGER_STATUS_OPTIONS}
                            className="h-8 text-xs"
                          />
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
        <Section title="Merchandising" icon={Link2} open={activeTab === 'merch'} onToggle={() => toggle('merch')} sectionId="merch">
          <div className={formEditLayout.sectionBody}>

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
                <div key={relType} className="border border-border rounded-xl overflow-hidden bg-card">
                  <div className={cn(
                    'px-4 py-3 border-b',
                    relType === 'cross_sell'
                      ? 'bg-emerald-500/10 dark:bg-emerald-950/35 border-emerald-200/50 dark:border-emerald-800/50'
                      : 'bg-amber-500/10 dark:bg-amber-950/35 border-amber-200/50 dark:border-amber-800/50',
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{meta.title}</p>
                        <p className="text-xs text-muted-foreground">{meta.desc}</p>
                      </div>
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        relType === 'cross_sell'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
                      )}>{rows.length}</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {rows.map(row => {
                      const targetProd = allProducts.find(p => p.id === row.target_product_id)
                      const catProductCount = row.target_type === 'category' && row.target_category
                        ? availableProducts.filter(p => (p.category || 'Uncategorized') === row.target_category).length
                        : 0
                      return (
                        <div key={row._idx} className="border border-border rounded-lg p-3 space-y-3 bg-muted/25 dark:bg-muted/15">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-2">
                              {/* Product / Category toggle */}
                              <div className="flex items-center gap-1">
                                <label className="text-xs font-medium text-muted-foreground mr-2">Target</label>
                                <button
                                  type="button"
                                  onClick={() => updateMerchMapping(row._idx, { target_type: 'product', target_category: '' })}
                                  className={`px-3 py-1 text-xs font-medium rounded-l-md border transition-colors ${row.target_type === 'product' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted/40'}`}
                                >
                                  Product
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateMerchMapping(row._idx, { target_type: 'category', target_product_id: '' })}
                                  className={`px-3 py-1 text-xs font-medium rounded-r-md border border-l-0 transition-colors ${row.target_type === 'category' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted/40'}`}
                                >
                                  Category
                                </button>
                              </div>

                              {/* Conditional picker */}
                              {row.target_type === 'product' ? (
                                <div className="space-y-1">
                                  <Select
                                    value={row.target_product_id}
                                    onChange={v => updateMerchMapping(row._idx, { target_product_id: v })}
                                    options={selectOptionsWithBlank(
                                      'Select a product…',
                                      categories.flatMap(cat =>
                                        availableProducts
                                          .filter(p => (p.category || 'Uncategorized') === cat)
                                          .map(p => ({
                                            value: p.id,
                                            label: `${p.name}${p.sku ? ` (${p.sku})` : ''}`,
                                            group: cat,
                                          })),
                                      ),
                                    )}
                                    className={cn(selectCls, 'w-full')}
                                  />
                                  {targetProd && <p className="text-xs text-muted-foreground">SKU: {targetProd.sku || '—'}</p>}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <Select
                                    value={row.target_category}
                                    onChange={v => updateMerchMapping(row._idx, { target_category: v })}
                                    options={selectOptionsWithBlank('Select a category…', [
                                      ...categories.map(cat => ({ value: cat, label: cat })),
                                      ...productCategories
                                        .filter(c => !categories.includes(c.name))
                                        .map(c => ({ value: c.name, label: c.name })),
                                    ])}
                                    className={cn(selectCls, 'w-full')}
                                  />
                                  {row.target_category && (
                                    <p className="text-xs text-muted-foreground">
                                      All products in "{row.target_category}" ({catProductCount} product{catProductCount !== 1 ? 's' : ''})
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            <button type="button" onClick={() => removeMerchMapping(row._idx)} className="mt-5 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            {/* Trigger Stage */}
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">Trigger Stage</label>
                              <Select
                                value={row.trigger_stage}
                                onChange={v => updateMerchMapping(row._idx, { trigger_stage: v as 'PDP' | 'CART' | 'CHECKOUT' })}
                                options={TRIGGER_STAGE_OPTIONS}
                                className={cn(selectCls, 'w-full')}
                              />
                            </div>

                            {/* Priority */}
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">Priority</label>
                              <input
                                type="number"
                                min={0}
                                value={row.priority}
                                onChange={e => updateMerchMapping(row._idx, { priority: Number(e.target.value) || 0 })}
                                className={cn(selectCls, 'w-full')}
                              />
                            </div>

                            {/* Bundle (optional) */}
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">Bundle (opt.)</label>
                              <Select
                                value={row.bundle_id || ''}
                                onChange={v => updateMerchMapping(row._idx, { bundle_id: v || undefined })}
                                options={selectOptionsWithBlank('None', bundles.map(b => ({ value: b.id, label: b.name })))}
                                className={cn(selectCls, 'w-full')}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    <button
                      type="button"
                      onClick={() => addMerchMapping(relType)}
                      className={`w-full border-2 border-dashed rounded-lg py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${relType === 'cross_sell' ? 'border-emerald-300/70 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/40' : 'border-amber-300/70 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 dark:hover:bg-amber-950/40'}`}
                    >
                      <Plus className="w-4 h-4" /> Add {relType === 'cross_sell' ? 'Cross-sell' : 'Upsell'} Link
                    </button>
                  </div>
                </div>
              )
            })}

            {/* ── Quick-reference: bundles ── */}
            {bundles.length > 0 && (
              <div className="border border-border rounded-xl p-4 bg-muted/25 dark:bg-muted/15 space-y-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Available Bundles</p>
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
                <p className="text-xs text-muted-foreground">Bundles can be linked to any cross-sell or upsell mapping above.</p>
              </div>
            )}

            {/* ── Legend ── */}
            <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
              <div><span className="font-semibold text-gray-700">PDP</span> — Product Detail Page</div>
              <div><span className="font-semibold text-gray-700">CART</span> — Shopping Cart</div>
              <div><span className="font-semibold text-gray-700">CHECKOUT</span> — Checkout Flow</div>
            </div>
          </div>
        </Section>

        {/* 9. SEO & Metadata */}
        <Section title="SEO & Metadata" icon={Search} open={activeTab === 'seo'} onToggle={() => toggle('seo')} sectionId="seo">
          <div className={formEditLayout.sectionBody}>
            <div className={formEditLayout.fieldGridWide}>
              <FormField label="Meta Title"><Input {...register('meta_title')} placeholder="SEO title (defaults to product name)" /></FormField>
              <FormField label="Meta Keywords (comma separated)"><Input {...register('meta_keywords')} placeholder="keyword1, keyword2" /></FormField>
              <FormField label="OG Image URL"><Input {...register('og_image_url')} placeholder="https://..." /></FormField>
              <FormField label="Canonical URL"><Input {...register('canonical_url')} placeholder="https://..." /></FormField>
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
                  field_kind: 'product_meta',
                  name: watchedName,
                  category: [watchedCategory, watchedSubcategory].filter(Boolean).join(' › '),
                  extra_context: { brand: watchedBrand, short_description: watchedShortDescription },
                }}
              />
            </FormField>
          </div>
        </Section>

        {/* 10. Advanced Features */}
        <Section title="Advanced Features" icon={Settings} open={activeTab === 'advanced'} onToggle={() => toggle('advanced')} sectionId="advanced">
          <div className={formEditLayout.sectionBody}>
            <div className={formEditLayout.fieldGrid3}>
              <FormField label="Attributes (JSON)"><textarea {...register('attributes')} rows={2} className={`${textareaCls} font-mono text-xs`} placeholder='{"color": ["Red","Blue"]}' /></FormField>
              <FormField label="Specifications (JSON)"><textarea {...register('specifications')} rows={2} className={`${textareaCls} font-mono text-xs`} placeholder='{"weight": "250g"}' /></FormField>
              <FormField label="Custom Fields (JSON)"><textarea {...register('custom_fields')} rows={2} className={`${textareaCls} font-mono text-xs`} placeholder='{"vendor_note": "..."}' /></FormField>
            </div>
          </div>
        </Section>

        {/* 11. Digital Products — shown for digital and bundle types */}
        {(isDigitalType || isBundleType || product?.is_digital) && (
          <Section title="Digital Product" icon={Download} open={activeTab === 'digital'} onToggle={() => toggle('digital')} sectionId="digital">
            <div className={formEditLayout.sectionBody}>
              <div className={formEditLayout.fieldGridWide}>
                <Controller name="is_digital" control={control} render={({ field }) => (
                  <Toggle label="Is Digital Product" checked={field.value} onChange={field.onChange} />
                )} />
                <FormField label="Download URL"><Input {...register('download_url')} placeholder="https://storage.example.com/file.zip" /></FormField>
                <FormField label="Download Limit"><Input type="number" min="0" {...register('download_limit')} placeholder="e.g. 5" /></FormField>
                <FormField label="Download Expiry (days)"><Input type="number" min="0" {...register('download_expiry_days')} placeholder="e.g. 30" /></FormField>
              </div>
            </div>
          </Section>
        )}

        {/* 12. Subscription removed — billing config is now on each variant/plan */}

        {/* 13. Bill of Materials (MRP) */}
        {isEdit && id && (
          <Section title="Bill of Materials (BOM)" icon={Factory} open={activeTab === 'bom'} onToggle={() => toggle('bom')} sectionId="bom">
            <div className="pt-4">
              <BOMEditor productId={id} productName={watch('name')} />
            </div>
          </Section>
        )}

        {/* 14. Reports (UI-only links) */}
        {isEdit && (
          <Section title="Reports & Analytics" icon={BarChart3} open={activeTab === 'reports'} onToggle={() => toggle('reports')} sectionId="reports">
            <div className={formEditLayout.sectionBody}>
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
          <Button type="button" variant="cancel" size="sm" onClick={leaveProductForm}>Cancel</Button>
          <Button type="submit" disabled={isSaving} size="sm">
            {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {isEdit ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
      </FormProvider>
      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        saving={unsavedSaving}
        onCancel={handleUnsavedCancel}
        onDiscard={handleUnsavedDiscard}
        onSave={handleUnsavedSave}
      />
    </FormPageWithNav>
  )
}



