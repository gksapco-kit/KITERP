/**
 * POSSearchGrid — Configurable advanced search + table-view catalog for the POS.
 *
 * Features:
 *  • Configurable filter bar at the top: user toggles which search fields are visible
 *  • Products & services rendered as a scrollable table with configurable columns
 *  • Settings panel (gear icon) to drag-toggle filter fields and table columns
 *  • All config persisted to localStorage under POS_GRID_CFG_KEY
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Settings2, X, Package, Wrench, Plus, Check,
  ChevronUp, ChevronDown, Search, GripVertical, Eye, EyeOff,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface POSGridProduct {
  id: string
  name: string
  sku?: string
  price?: number
  quantity?: number | null
  tax_rate?: number
  gst_rate?: number
  hsn_code?: string
  sac_code?: string
  category?: string
  company?: string
  brand?: string
  rack_no?: string
  batch_no?: string
  expiry_date?: string
  packing?: string
  uom?: string
  mrp?: number
  item_type: 'product' | 'service'
  service_type?: string
  duration_minutes?: number
  image_url?: string
  images?: { url?: string; file_url?: string }[]
  variants?: POSGridVariant[]
}

export interface POSGridVariant {
  id: string
  name?: string
  sku?: string
  price?: number
  quantity?: number | null
  tax_rate?: number
  hsn_code?: string
  barcode?: string
  batch_no?: string
  expiry_date?: string
  mrp?: number
  is_active?: boolean
}

export interface AddToCartItem {
  id: string
  variant_id?: string
  name: string
  sku?: string
  price: number
  tax_rate: number
  hsn_code?: string
  item_type: 'product' | 'service'
  image_url?: string
  duration_minutes?: number
}

// ─── Config definitions ───────────────────────────────────────────────────────

interface FilterField {
  key: string
  label: string
  type: 'text' | 'number' | 'select'
  placeholder?: string
  options?: string[]
  enabled: boolean
}

interface TableColumn {
  key: string
  label: string
  enabled: boolean
  width?: number
  align?: 'left' | 'right' | 'center'
}

const DEFAULT_FILTER_FIELDS: FilterField[] = [
  { key: 'name',     label: 'Product Name',  type: 'text',   placeholder: 'Search name…',     enabled: true  },
  { key: 'sku',      label: 'Code / SKU',    type: 'text',   placeholder: 'SKU / code…',      enabled: true  },
  { key: 'category', label: 'Category',      type: 'text',   placeholder: 'Category…',        enabled: false },
  { key: 'company',  label: 'Company',       type: 'text',   placeholder: 'Brand / company…', enabled: false },
  { key: 'batch_no', label: 'Batch No.',     type: 'text',   placeholder: 'Batch…',           enabled: false },
  { key: 'uom',      label: 'UOM / Pack',    type: 'text',   placeholder: 'e.g. Strip…',      enabled: false },
  { key: 'rack_no',  label: 'Rack No.',      type: 'text',   placeholder: 'Rack…',            enabled: false },
  { key: 'hsn',      label: 'HSN / SAC',     type: 'text',   placeholder: 'HSN code…',        enabled: false },
  { key: 'price_min',label: 'Price Min',     type: 'number', placeholder: '0',                enabled: false },
  { key: 'price_max',label: 'Price Max',     type: 'number', placeholder: '9999',             enabled: false },
  { key: 'gst',      label: 'GST Rate %',    type: 'text',   placeholder: 'e.g. 18',          enabled: false },
  { key: 'stock_min',label: 'Min Stock',     type: 'number', placeholder: '0',                enabled: false },
  { key: 'expiry',   label: 'Expiry Before', type: 'text',   placeholder: 'YYYY-MM',          enabled: false },
]

const DEFAULT_TABLE_COLUMNS: TableColumn[] = [
  { key: 'name',     label: 'Product / Service',  enabled: true,  width: 220, align: 'left'  },
  { key: 'sku',      label: 'Code / SKU',          enabled: true,  width: 110, align: 'left'  },
  { key: 'type',     label: 'Type',                enabled: true,  width: 80,  align: 'center'},
  { key: 'category', label: 'Category',            enabled: false, width: 100, align: 'left'  },
  { key: 'uom',      label: 'UOM / Pack',          enabled: false, width: 90,  align: 'left'  },
  { key: 'batch',    label: 'Batch No.',           enabled: false, width: 90,  align: 'left'  },
  { key: 'expiry',   label: 'Expiry',              enabled: false, width: 90,  align: 'left'  },
  { key: 'stock',    label: 'Stock / Qty',         enabled: true,  width: 80,  align: 'right' },
  { key: 'mrp',      label: 'MRP',                 enabled: false, width: 80,  align: 'right' },
  { key: 'price',    label: 'Unit Rate (₹)',       enabled: true,  width: 100, align: 'right' },
  { key: 'gst',      label: 'GST %',              enabled: true,  width: 70,  align: 'right' },
  { key: 'hsn',      label: 'HSN / SAC',          enabled: false, width: 90,  align: 'left'  },
  { key: 'rack',     label: 'Rack No.',           enabled: false, width: 80,  align: 'left'  },
  { key: 'company',  label: 'Company',             enabled: false, width: 110, align: 'left'  },
  { key: 'barcode',  label: 'Barcode',             enabled: false, width: 120, align: 'left'  },
  { key: 'duration', label: 'Duration',            enabled: false, width: 80,  align: 'center'},
  { key: 'action',   label: 'Add',                 enabled: true,  width: 56,  align: 'center'},
]

const CFG_KEY = 'pos_grid_cfg_v2'

interface GridConfig {
  filters: FilterField[]
  columns: TableColumn[]
}

function loadConfig(): GridConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY)
    if (!raw) return { filters: DEFAULT_FILTER_FIELDS, columns: DEFAULT_TABLE_COLUMNS }
    const saved = JSON.parse(raw) as Partial<GridConfig>
    // Merge saved enabled states with defaults (handles new fields added over time)
    const filters = DEFAULT_FILTER_FIELDS.map(f => {
      const s = (saved.filters || []).find(sf => sf.key === f.key)
      return s ? { ...f, enabled: s.enabled } : f
    })
    const columns = DEFAULT_TABLE_COLUMNS.map(c => {
      const s = (saved.columns || []).find(sc => sc.key === c.key)
      return s ? { ...c, enabled: s.enabled, width: s.width ?? c.width } : c
    })
    return { filters, columns }
  } catch {
    return { filters: DEFAULT_FILTER_FIELDS, columns: DEFAULT_TABLE_COLUMNS }
  }
}

function saveConfig(cfg: GridConfig) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
}

// ─── Drag-reorder helper ──────────────────────────────────────────────────────

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function ConfigPanel({
  config, onChange, onClose,
}: {
  config: GridConfig
  onChange: (c: GridConfig) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'filters' | 'columns'>('filters')
  const dragIdx = useRef<number | null>(null)

  const toggleFilter = (key: string) => {
    onChange({
      ...config,
      filters: config.filters.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f),
    })
  }

  const toggleColumn = (key: string) => {
    onChange({
      ...config,
      columns: config.columns.map(c => c.key === key ? { ...c, enabled: !c.enabled } : c),
    })
  }

  const handleFilterDrop = (toIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === toIdx) return
    onChange({ ...config, filters: reorder(config.filters, dragIdx.current, toIdx) })
    dragIdx.current = null
  }

  const handleColumnDrop = (toIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === toIdx) return
    onChange({ ...config, columns: reorder(config.columns, dragIdx.current, toIdx) })
    dragIdx.current = null
  }

  return (
    <div className="absolute right-0 top-10 z-50 w-72 bg-popover text-popover-foreground rounded-xl border border-border shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <span className="text-sm font-bold text-gray-800">Configure Grid</span>
        <div className="flex items-center gap-2">
          <button onClick={() => onChange({ filters: DEFAULT_FILTER_FIELDS, columns: DEFAULT_TABLE_COLUMNS })}
            className="text-xs text-gray-400 hover:text-red-500 font-medium">Reset</button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
      </div>
      {/* Tab switcher */}
      <div className="flex border-b">
        {(['filters', 'columns'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${tab === t ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'filters' ? '🔍 Filter Fields' : '📋 Table Columns'}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-y-auto p-2 space-y-1">
        {tab === 'filters' && config.filters.map((f, i) => (
          <div key={f.key}
            draggable
            onDragStart={() => { dragIdx.current = i }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleFilterDrop(i)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer group">
            <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab group-hover:text-gray-400 shrink-0" />
            <button type="button" onClick={() => toggleFilter(f.key)}
              className={`shrink-0 relative inline-flex h-4.5 w-8 h-4 items-center rounded-full transition-colors ${f.enabled ? 'bg-primary' : 'bg-gray-300'}`}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                style={{ transform: f.enabled ? 'translateX(17px)' : 'translateX(2px)' }} />
            </button>
            <span className={`text-xs flex-1 ${f.enabled ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{f.label}</span>
            {f.enabled ? <Eye className="w-3 h-3 text-blue-400 shrink-0" /> : <EyeOff className="w-3 h-3 text-gray-300 shrink-0" />}
          </div>
        ))}
        {tab === 'columns' && config.columns.map((c, i) => (
          <div key={c.key}
            draggable
            onDragStart={() => { dragIdx.current = i }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleColumnDrop(i)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer group">
            <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab group-hover:text-gray-400 shrink-0" />
            <button type="button" onClick={() => toggleColumn(c.key)}
              className={`shrink-0 relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${c.enabled ? 'bg-primary' : 'bg-gray-300'}`}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                style={{ transform: c.enabled ? 'translateX(17px)' : 'translateX(2px)' }} />
            </button>
            <span className={`text-xs flex-1 ${c.enabled ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{c.label}</span>
            {c.enabled ? <Eye className="w-3 h-3 text-blue-400 shrink-0" /> : <EyeOff className="w-3 h-3 text-gray-300 shrink-0" />}
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t bg-gray-50 text-xs text-gray-400 text-center">
        Drag rows to reorder · Toggle to show/hide
      </div>
    </div>
  )
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

function CellContent({
  colKey, item, variant, onAdd,
}: {
  colKey: string
  item: POSGridProduct
  variant?: POSGridVariant
  onAdd: () => void
}) {
  const price = variant?.price ?? item.price ?? 0
  const stock = variant?.quantity ?? item.quantity
  const sku = variant?.sku ?? item.sku
  const gst = item.tax_rate ?? item.gst_rate ?? 0
  const hsn = item.hsn_code ?? item.sac_code

  switch (colKey) {
    case 'name':
      return (
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-900 truncate leading-tight">{item.name}</div>
          {variant?.name && <div className="text-xs text-blue-600 font-semibold truncate">{variant.name}</div>}
          {item.item_type === 'service' && item.service_type && (
            <div className="text-xs text-primary/80 truncate">{item.service_type}</div>
          )}
        </div>
      )
    case 'sku':     return <span className="font-mono text-xs text-gray-600">{sku || '—'}</span>
    case 'type':    return (
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${item.item_type === 'service' ? 'bg-primary/12 text-primary' : 'bg-blue-100 text-blue-700'}`}>
        {item.item_type === 'service' ? 'SVC' : 'PRD'}
      </span>
    )
    case 'category': return <span className="text-xs text-gray-500 truncate">{item.category || '—'}</span>
    case 'uom':     return <span className="text-xs text-gray-500">{item.uom || item.packing || '—'}</span>
    case 'batch':   return <span className="text-xs font-mono text-gray-600">{variant?.batch_no ?? item.batch_no ?? '—'}</span>
    case 'expiry':  return <span className="text-xs text-gray-600">{variant?.expiry_date ?? item.expiry_date ?? '—'}</span>
    case 'stock':   return (
      <span className={`text-xs font-medium ${stock != null && stock < 5 ? 'text-red-600' : 'text-gray-700'}`}>
        {stock != null ? stock : '—'}
      </span>
    )
    case 'mrp':     return <span className="text-xs text-gray-500">{item.mrp != null ? formatCurrency(item.mrp) : '—'}</span>
    case 'price':   return <span className="text-xs font-bold text-gray-900">{formatCurrency(price)}</span>
    case 'gst':     return <span className="text-xs text-gray-600">{gst}%</span>
    case 'hsn':     return <span className="font-mono text-xs text-gray-500">{hsn || '—'}</span>
    case 'rack':    return <span className="text-xs text-gray-500">{item.rack_no || '—'}</span>
    case 'company': return <span className="text-xs text-gray-500 truncate">{item.company || item.brand || '—'}</span>
    case 'barcode': return <span className="font-mono text-xs text-gray-500">{variant?.barcode || '—'}</span>
    case 'duration':return <span className="text-xs text-gray-500">{item.duration_minutes ? `${item.duration_minutes}min` : '—'}</span>
    case 'action':  return (
      <button onClick={e => { e.stopPropagation(); onAdd() }}
        className="w-7 h-7 rounded-lg bg-blue-500 hover:bg-primary flex items-center justify-center transition-colors">
        <Plus className="w-3.5 h-3.5 text-white" />
      </button>
    )
    default: return null
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface POSSearchGridProps {
  products: POSGridProduct[]
  services: POSGridProduct[]
  onAddToCart: (item: AddToCartItem) => void
  onVariantPick: (product: POSGridProduct) => void
  externalSearch?: string   // syncs the Name filter from the top POS search bar
}

export function POSSearchGrid({ products, services, onAddToCart, onVariantPick, externalSearch }: POSSearchGridProps) {
  const [config, setConfig] = useState<GridConfig>(loadConfig)
  const [showConfig, setShowConfig] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortKey, setSortKey] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service'>('all')
  const configRef = useRef<HTMLDivElement>(null)

  // Keep the grid's Name filter in sync with the top search box
  useEffect(() => {
    if (externalSearch !== undefined) {
      setFilters(prev => ({ ...prev, name: externalSearch }))
    }
  }, [externalSearch])

  // Persist config changes
  useEffect(() => { saveConfig(config) }, [config])

  // Close config panel on outside click
  useEffect(() => {
    if (!showConfig) return
    const handler = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node)) setShowConfig(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showConfig])

  const setFilter = (key: string, val: string) => setFilters(prev => ({ ...prev, [key]: val }))

  // Build flat item list (products expanded by variant)
  const allItems: Array<{ item: POSGridProduct; variant?: POSGridVariant }> = useMemo(() => {
    const rows: Array<{ item: POSGridProduct; variant?: POSGridVariant }> = []
    if (typeFilter !== 'service') {
      for (const p of products) {
        const activeVariants = (p.variants || []).filter((v: POSGridVariant) => v.is_active !== false)
        if (activeVariants.length > 0) {
          for (const v of activeVariants) rows.push({ item: p, variant: v })
        } else {
          rows.push({ item: p })
        }
      }
    }
    if (typeFilter !== 'product') {
      for (const s of services) rows.push({ item: s })
    }
    return rows
  }, [products, services, typeFilter])

  // Apply filters
  const filtered = useMemo(() => {
    return allItems.filter(({ item, variant }) => {
      const f = filters

      if (f.name && !`${item.name} ${variant?.name ?? ''}`.toLowerCase().includes(f.name.toLowerCase())) return false
      if (f.sku) {
        const sku = (variant?.sku ?? item.sku ?? '').toLowerCase()
        if (!sku.includes(f.sku.toLowerCase())) return false
      }
      if (f.category && !(item.category ?? '').toLowerCase().includes(f.category.toLowerCase())) return false
      if (f.company && !`${item.company ?? ''} ${item.brand ?? ''}`.toLowerCase().includes(f.company.toLowerCase())) return false
      if (f.batch_no) {
        const batch = (variant?.batch_no ?? item.batch_no ?? '').toLowerCase()
        if (!batch.includes(f.batch_no.toLowerCase())) return false
      }
      if (f.uom && !(item.uom ?? item.packing ?? '').toLowerCase().includes(f.uom.toLowerCase())) return false
      if (f.rack_no && !(item.rack_no ?? '').toLowerCase().includes(f.rack_no.toLowerCase())) return false
      if (f.hsn) {
        const hsn = (item.hsn_code ?? item.sac_code ?? '').toLowerCase()
        if (!hsn.includes(f.hsn.toLowerCase())) return false
      }
      if (f.gst) {
        const gst = String(item.tax_rate ?? item.gst_rate ?? '')
        if (!gst.startsWith(f.gst)) return false
      }
      if (f.price_min) {
        const min = parseFloat(f.price_min)
        const price = variant?.price ?? item.price ?? 0
        if (price < min) return false
      }
      if (f.price_max) {
        const max = parseFloat(f.price_max)
        const price = variant?.price ?? item.price ?? 0
        if (price > max) return false
      }
      if (f.stock_min) {
        const min = parseFloat(f.stock_min)
        const stock = variant?.quantity ?? item.quantity ?? 0
        if (stock < min) return false
      }
      if (f.expiry) {
        const exp = variant?.expiry_date ?? item.expiry_date ?? ''
        if (!exp || exp > f.expiry + '-99') return false
      }
      return true
    })
  }, [allItems, filters])

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sortKey) {
        case 'name':  av = a.item.name; bv = b.item.name; break
        case 'price': av = a.variant?.price ?? a.item.price ?? 0; bv = b.variant?.price ?? b.item.price ?? 0; break
        case 'stock': av = a.variant?.quantity ?? a.item.quantity ?? -1; bv = b.variant?.quantity ?? b.item.quantity ?? -1; break
        case 'sku':   av = a.variant?.sku ?? a.item.sku ?? ''; bv = b.variant?.sku ?? b.item.sku ?? ''; break
        default:      av = a.item.name; bv = b.item.name
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(String(bv)) : String(bv).localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [filtered, sortKey, sortDir])

  const enabledFilters = config.filters.filter(f => f.enabled)
  const enabledCols = config.columns.filter(c => c.enabled)
  const activeFilterCount = Object.values(filters).filter(v => v.trim()).length

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const makeAddFn = (item: POSGridProduct, variant?: POSGridVariant) => () => {
    // If product has variants and none selected, open picker
    const activeVariants = (item.variants || []).filter((v: POSGridVariant) => v.is_active !== false)
    if (item.item_type === 'product' && activeVariants.length > 1 && !variant) {
      onVariantPick(item)
      return
    }
    const price = variant?.price ?? item.price ?? 0
    const tax_rate = variant?.tax_rate ?? item.tax_rate ?? item.gst_rate ?? 0
    const hsn_code = variant?.hsn_code ?? item.hsn_code ?? item.sac_code
    const imgUrl = item.images?.[0]?.url || item.images?.[0]?.file_url || item.image_url
    onAddToCart({
      id: item.id,
      variant_id: variant?.id,
      name: variant?.name ? `${item.name} — ${variant.name}` : item.name,
      sku: variant?.sku ?? item.sku,
      price,
      tax_rate,
      hsn_code,
      item_type: item.item_type,
      image_url: imgUrl,
      duration_minutes: item.duration_minutes,
    })
  }

  return (
    <div className="flex flex-col gap-2 h-full">

      {/* ── Top bar: type tabs + config gear ── */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-1">
          {([
            { id: 'all',     label: `All (${products.length + services.length})` },
            { id: 'product', label: `Products (${products.reduce((n, p) => n + Math.max((p.variants || []).filter((v: any) => v.is_active !== false).length, 1), 0)})`, icon: Package },
            { id: 'service', label: `Services (${services.length})`, icon: Wrench },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTypeFilter(t.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors ${typeFilter === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {'icon' in t && t.icon && <t.icon className="w-3.5 h-3.5" />} {t.label}
            </button>
          ))}
        </div>
        <div className="relative shrink-0" ref={configRef}>
          <button onClick={() => setShowConfig(v => !v)}
            title="Configure filter fields and table columns"
            className={`flex items-center gap-1 px-2.5 h-8 rounded-lg border text-xs font-medium transition-colors relative ${showConfig ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-blue-50 hover:border-blue-300'}`}>
            <Settings2 className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          {showConfig && (
            <ConfigPanel config={config} onChange={setConfig} onClose={() => setShowConfig(false)} />
          )}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      {enabledFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50/60 border border-blue-100 rounded-xl">
          {enabledFilters.map(f => (
            <div key={f.key} className="flex flex-col gap-0.5" style={{ minWidth: 90, maxWidth: 140, flex: '1 1 90px' }}>
              <label className="text-xs font-bold text-blue-600 uppercase tracking-wide px-1">{f.label}</label>
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                placeholder={f.placeholder || f.label}
                value={filters[f.key] || ''}
                onChange={e => setFilter(f.key, e.target.value)}
                className="h-7 px-2 text-xs border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent w-full"
              />
            </div>
          ))}
          {activeFilterCount > 0 && (
            <div className="flex flex-col justify-end">
              <button onClick={() => setFilters({})}
                className="h-7 px-2 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-100 whitespace-nowrap">
                Clear ({activeFilterCount})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Results count ── */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-gray-400">
          {sorted.length === allItems.length
            ? `${sorted.length} item${sorted.length !== 1 ? 's' : ''}`
            : `${sorted.length} of ${allItems.length} items`}
        </span>
        {activeFilterCount > 0 && (
          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
            {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
          </span>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto border rounded-xl bg-white relative">
        <table className="w-full text-left border-collapse" style={{ minWidth: enabledCols.reduce((s, c) => s + (c.width || 100), 0) }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-700 text-white">
              {enabledCols.map(col => {
                const isSorted = sortKey === col.key
                const sortable = ['name', 'sku', 'price', 'stock'].includes(col.key)
                return (
                  <th key={col.key}
                    style={{ width: col.width, minWidth: col.width }}
                    className={`px-2.5 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap border-r border-gray-600 last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${sortable ? 'cursor-pointer select-none hover:bg-gray-600' : ''}`}
                    onClick={() => sortable && handleSort(col.key)}
                  >
                    <span className="flex items-center gap-1 justify-inherit">
                      {col.label}
                      {isSorted && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={enabledCols.length} className="py-12 text-center">
                  <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No items match the current filters</p>
                  {activeFilterCount > 0 && (
                    <button onClick={() => setFilters({})} className="mt-2 text-xs text-blue-600 underline">Clear filters</button>
                  )}
                </td>
              </tr>
            ) : sorted.map(({ item, variant }, idx) => {
              const activeVariants = (item.variants || []).filter((v: POSGridVariant) => v.is_active !== false)
              const hasMultipleVariants = activeVariants.length > 1 && !variant

              return (
                <tr key={`${item.id}-${variant?.id ?? 'novar'}`}
                  className={`border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
                  onClick={() => makeAddFn(item, variant)()}
                >
                  {enabledCols.map(col => (
                    <td key={col.key}
                      style={{ width: col.width, minWidth: col.width }}
                      className={`px-2.5 py-2 border-r border-gray-100 last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                    >
                      {col.key === 'action' ? (
                        <div className="flex items-center justify-center gap-1">
                          {hasMultipleVariants && (
                            <button
                              onClick={e => { e.stopPropagation(); onVariantPick(item) }}
                              className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 whitespace-nowrap">
                              {activeVariants.length}v
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); makeAddFn(item, variant)() }}
                            className="w-6 h-6 rounded-lg bg-blue-500 hover:bg-primary flex items-center justify-center transition-colors">
                            <Plus className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <CellContent colKey={col.key} item={item} variant={variant} onAdd={makeAddFn(item, variant)} />
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
