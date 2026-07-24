import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronRight, ClipboardPaste, Columns3, Copy, DollarSign,
  Download, FileSpreadsheet, Loader2, MoreVertical, Power, PowerOff, SlidersHorizontal, Sparkles,
  Trash2, Undo2, Upload, X, ImageOff, AlertTriangle,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { VariantListItem, VariantPatchFields, PriceAdjustMode } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { VariantDetailsDrawer } from '@/components/products/VariantDetailsDrawer'
import { TablePagination } from '@/components/table/TablePagination'

type ColKey = 'sku' | 'price' | 'compare_at_price' | 'cost_price' | 'quantity' | 'tax_rate' | 'is_active'

interface ColumnDef {
  key: ColKey
  label: string
  type: 'text' | 'number' | 'status'
  width: string
}

const COLUMN_ORDER: ColKey[] = ['sku', 'price', 'compare_at_price', 'cost_price', 'quantity', 'tax_rate', 'is_active']
const DEFAULT_PAGE_SIZE = 25
const COLUMN_DEFS: Record<ColKey, ColumnDef> = {
  sku: { key: 'sku', label: 'SKU', type: 'text', width: '130px' },
  price: { key: 'price', label: 'Price', type: 'number', width: '120px' },
  compare_at_price: { key: 'compare_at_price', label: 'MRP', type: 'number', width: '120px' },
  cost_price: { key: 'cost_price', label: 'Cost', type: 'number', width: '110px' },
  quantity: { key: 'quantity', label: 'Stock', type: 'number', width: '90px' },
  tax_rate: { key: 'tax_rate', label: 'Tax %', type: 'number', width: '90px' },
  is_active: { key: 'is_active', label: 'Status', type: 'status', width: '120px' },
}
const COLS_STORAGE_KEY = 'kit-variant-fastedit-cols-v2'

interface UndoChange { id: string; field: ColKey; prevValue: unknown }
interface UndoBatch { changes: UndoChange[] }

interface Selection { col: ColKey; startRow: number; endRow: number }
interface CellRef { row: number; col: ColKey }

function loadVisibleCols(): Set<ColKey> {
  try {
    const raw = localStorage.getItem(COLS_STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as ColKey[]
      const valid = arr.filter(c => COLUMN_ORDER.includes(c))
      if (valid.length > 0) return new Set(valid)
    }
  } catch { /* ignore */ }
  return new Set(COLUMN_ORDER)
}

function saveVisibleCols(cols: Set<ColKey>) {
  try { localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(Array.from(cols))) } catch { /* ignore */ }
}

function getFieldValue(row: VariantListItem, field: ColKey): unknown {
  switch (field) {
    case 'sku': return row.sku ?? ''
    case 'price': return row.price
    case 'compare_at_price': return row.compare_at_price ?? null
    case 'cost_price': return row.cost_price ?? null
    case 'quantity': return row.quantity
    case 'tax_rate': return row.tax_rate ?? null
    case 'is_active': return row.is_active
  }
}

function parseEditedValue(field: ColKey, raw: string): unknown {
  switch (field) {
    case 'sku': return raw.trim()
    case 'price': return Number(raw) || 0
    case 'compare_at_price': return raw.trim() === '' ? null : Number(raw) || 0
    case 'cost_price': return raw.trim() === '' ? null : Number(raw) || 0
    case 'quantity': return Math.max(0, Math.trunc(Number(raw) || 0))
    case 'tax_rate': return raw.trim() === '' ? null : Number(raw) || 0
    case 'is_active': return raw === 'true'
  }
}

function emptyValueFor(field: ColKey): unknown {
  switch (field) {
    case 'sku': return ''
    case 'price': return 0
    case 'compare_at_price': return null
    case 'cost_price': return null
    case 'quantity': return 0
    case 'tax_rate': return null
    case 'is_active': return false
  }
}

type IssueFilter = 'all' | 'zero_price' | 'no_sku'

function shortCode(value: string, length = 4): string {
  const cleaned = String(value).replace(/[^A-Za-z0-9]+/g, '').toUpperCase()
  return cleaned.slice(0, length) || 'X'
}

function inferBaseSku(items: VariantListItem[]): string {
  const skus = items.map(i => (i.sku ?? '').trim()).filter(Boolean)
  if (skus.length === 0) return 'SKU'
  const partsList = skus.map(s => s.split('-').filter(Boolean))
  if (partsList[0].length <= 1) return partsList[0][0] || 'SKU'
  let common = partsList[0].slice(0, -1)
  for (const parts of partsList.slice(1)) {
    const next: string[] = []
    for (let i = 0; i < Math.min(common.length, Math.max(0, parts.length - 1)); i++) {
      if (common[i] === parts[i]) next.push(common[i])
      else break
    }
    common = next
    if (common.length === 0) break
  }
  return common.length > 0 ? common.join('-') : partsList[0][0] || 'SKU'
}

function buildAutoSku(base: string, variant: VariantListItem, used: Set<string>): string {
  const attrParts = Object.values(variant.attributes || {})
    .filter(v => v != null && String(v).trim())
    .map(v => shortCode(String(v)))
  const fromName = variant.name.split(/[\/|,]+/).map(s => s.trim()).filter(Boolean).map(s => shortCode(s))
  const parts = attrParts.length > 0 ? attrParts : fromName
  let sku = parts.length > 0 ? `${base}-${parts.join('-')}` : `${base}-${shortCode(variant.name)}`
  if (!used.has(sku.toUpperCase())) return sku
  let n = 2
  while (used.has(`${sku}-${n}`.toUpperCase())) n += 1
  return `${sku}-${n}`
}

const CSV_COLS: { key: 'id' | 'name' | ColKey; label: string }[] = [
  { key: 'id', label: 'id' },
  { key: 'name', label: 'name' },
  { key: 'sku', label: 'sku' },
  { key: 'price', label: 'price' },
  { key: 'compare_at_price', label: 'mrp' },
  { key: 'cost_price', label: 'cost' },
  { key: 'quantity', label: 'stock' },
  { key: 'tax_rate', label: 'tax_percent' },
  { key: 'is_active', label: 'status' },
]

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1 }
        else inQuotes = false
      } else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch === '\r') { /* skip */ }
    else cell += ch
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

interface Props {
  productId: string
  search?: string
  onSearchChange?: (value: string) => void
  hideSearch?: boolean
}

export function VariantFastEditGrid({ productId, search: searchProp, onSearchChange, hideSearch }: Props) {
  const qc = useQueryClient()
  const queryKey = ['product-variants', productId]
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => vendorApi.productListVariants(productId),
  })

  const items = data?.items ?? []
  const itemsById = useMemo(() => new Map(items.map(v => [v.id, v])), [items])

  const [internalSearch, setInternalSearch] = useState('')
  const search = searchProp ?? internalSearch
  const setSearch = onSearchChange ?? setInternalSearch
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'low_stock'>('all')
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all')
  const [sort, setSort] = useState<{ col: 'name' | ColKey; dir: 'asc' | 'desc' } | null>(null)
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => loadVisibleCols())
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [detailsTab, setDetailsTab] = useState<'general' | 'media'>('general')
  const csvInputRef = useRef<HTMLInputElement>(null)

  const [overlay, setOverlay] = useState<Record<string, Partial<Record<ColKey, unknown>>>>({})
  const [undoStack, setUndoStack] = useState<UndoBatch[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  const [anchor, setAnchor] = useState<CellRef | null>(null)
  const [focusCell, setFocusCell] = useState<CellRef | null>(null)

  const isSelectingRef = useRef(false)
  const [filling, setFilling] = useState<{ previewEndRow: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const [colMenuOpen, setColMenuOpen] = useState<ColKey | 'name' | null>(null)
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false)
  const [setFieldOpen, setSetFieldOpen] = useState(false)
  const [setFieldValue, setSetFieldValue] = useState('')
  const [rowSelected, setRowSelected] = useState<Set<string>>(new Set())
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const visibleColumnOrder = useMemo(() => COLUMN_ORDER.filter(c => visibleCols.has(c)), [visibleCols])

  const readValue = useCallback((id: string, field: ColKey): unknown => {
    const ov = overlay[id]?.[field]
    if (ov !== undefined) return ov
    const row = itemsById.get(id)
    return row ? getFieldValue(row, field) : undefined
  }, [overlay, itemsById])

  const applyOverlay = useCallback((id: string, field: ColKey, value: unknown) => {
    setOverlay(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }, [])

  const displayRows = useMemo(() => {
    let rows = items
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(v =>
        v.name.toLowerCase().includes(q)
        || (v.sku ?? '').toLowerCase().includes(q)
        || Object.values(v.attributes || {}).some(val => String(val).toLowerCase().includes(q)),
      )
    }
    if (statusFilter !== 'all') {
      rows = rows.filter(v => (readValue(v.id, 'is_active') as boolean) === (statusFilter === 'active'))
    }
    if (stockFilter !== 'all') {
      rows = rows.filter(v => {
        const qty = readValue(v.id, 'quantity') as number
        if (stockFilter === 'out_of_stock') return qty <= 0
        if (stockFilter === 'low_stock') return qty > 0 && qty <= (v.low_stock_threshold || 0)
        return qty > 0
      })
    }
    if (issueFilter === 'zero_price') {
      rows = rows.filter(v => Number(readValue(v.id, 'price') || 0) === 0)
    } else if (issueFilter === 'no_sku') {
      rows = rows.filter(v => !String(readValue(v.id, 'sku') ?? '').trim())
    }
    if (sort) {
      rows = [...rows].sort((a, b) => {
        const av = sort.col === 'name' ? a.name : readValue(a.id, sort.col)
        const bv = sort.col === 'name' ? b.name : readValue(b.id, sort.col)
        let cmp: number
        if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
        else cmp = String(av ?? '').localeCompare(String(bv ?? ''))
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [items, search, statusFilter, stockFilter, issueFilter, sort, readValue])

  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageRows = useMemo(
    () => displayRows.slice(pageStart, pageStart + pageSize),
    [displayRows, pageStart, pageSize],
  )

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, stockFilter, issueFilter, sort, pageSize])

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const goToPage = (p: number) => {
    const next = Math.max(1, Math.min(totalPages, p))
    setPage(next)
    setAnchor(null)
    setFocusCell(null)
    setSetFieldOpen(false)
  }

  const zeroPriceCount = useMemo(
    () => items.filter(v => Number(readValue(v.id, 'price') || 0) === 0).length,
    [items, readValue],
  )
  const noSkuCount = useMemo(
    () => items.filter(v => !String(readValue(v.id, 'sku') ?? '').trim()).length,
    [items, readValue],
  )

  const pushUndo = useCallback((changes: UndoChange[]) => {
    if (changes.length === 0) return
    setUndoStack(stack => [...stack, { changes }].slice(-50))
  }, [])

  const persistPatch = useCallback((id: string, field: ColKey, value: unknown, prevValue: unknown) => {
    setPendingCount(c => c + 1)
    vendorApi.productPatchVariant(productId, id, { [field]: value } as VariantPatchFields)
      .then(() => { qc.invalidateQueries({ queryKey }) })
      .catch(() => {
        toast.error('Could not save — please retry')
        applyOverlay(id, field, prevValue)
      })
      .finally(() => setPendingCount(c => c - 1))
  }, [productId, qc, queryKey, applyOverlay])

  const persistBulkSameValue = useCallback((ids: string[], field: ColKey, value: unknown, prevValues: Record<string, unknown>) => {
    setPendingCount(c => c + 1)
    vendorApi.productBulkUpdateVariants(productId, { variant_ids: ids, set_fields: { [field]: value } as VariantPatchFields })
      .then((res) => {
        qc.invalidateQueries({ queryKey })
        toast.success(`Updated ${res.updated_count} variant${res.updated_count === 1 ? '' : 's'}`)
      })
      .catch(() => {
        toast.error('Bulk update failed')
        ids.forEach(id => applyOverlay(id, field, prevValues[id]))
      })
      .finally(() => setPendingCount(c => c - 1))
  }, [productId, qc, queryKey, applyOverlay])

  const persistPerRow = useCallback((entries: { id: string; field: ColKey; value: unknown; prevValue: unknown }[]) => {
    if (entries.length === 0) return
    setPendingCount(c => c + entries.length)
    Promise.allSettled(entries.map(e =>
      vendorApi.productPatchVariant(productId, e.id, { [e.field]: e.value } as VariantPatchFields),
    )).then(results => {
      let anyError = false
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          anyError = true
          applyOverlay(entries[i].id, entries[i].field, entries[i].prevValue)
        }
      })
      if (anyError) toast.error('Some changes could not be saved')
      qc.invalidateQueries({ queryKey })
    }).finally(() => setPendingCount(c => c - entries.length))
  }, [productId, qc, queryKey, applyOverlay])

  const commitSingleEdit = useCallback((id: string, field: ColKey, value: unknown) => {
    const prevValue = readValue(id, field)
    if (JSON.stringify(prevValue) === JSON.stringify(value)) return
    pushUndo([{ id, field, prevValue }])
    applyOverlay(id, field, value)
    persistPatch(id, field, value, prevValue)
  }, [readValue, pushUndo, applyOverlay, persistPatch])

  const applySameValueToIds = useCallback((ids: string[], field: ColKey, value: unknown) => {
    const prevValues: Record<string, unknown> = {}
    const changes: UndoChange[] = []
    ids.forEach(id => {
      const prev = readValue(id, field)
      if (JSON.stringify(prev) === JSON.stringify(value)) return
      prevValues[id] = prev
      changes.push({ id, field, prevValue: prev })
      applyOverlay(id, field, value)
    })
    if (changes.length === 0) return
    pushUndo(changes)
    persistBulkSameValue(Object.keys(prevValues), field, value, prevValues)
  }, [readValue, applyOverlay, pushUndo, persistBulkSameValue])

  const handleUndo = useCallback(() => {
    setUndoStack(stack => {
      if (stack.length === 0) return stack
      const batch = stack[stack.length - 1]
      const rest = stack.slice(0, -1)
      const entries = batch.changes.map(c => ({ id: c.id, field: c.field, value: c.prevValue, prevValue: readValue(c.id, c.field) }))
      entries.forEach(e => applyOverlay(e.id, e.field, e.value))
      persistPerRow(entries)
      return rest
    })
  }, [readValue, applyOverlay, persistPerRow])

  const selection: Selection | null = anchor && focusCell
    ? { col: anchor.col, startRow: Math.min(anchor.row, focusCell.row), endRow: Math.max(anchor.row, focusCell.row) }
    : null

  const clearSelection = () => {
    setAnchor(null)
    setFocusCell(null)
    setSetFieldOpen(false)
  }

  const clearAllSelections = () => {
    clearSelection()
    setRowSelected(new Set())
  }

  const startSelection = (row: number, col: ColKey) => {
    setAnchor({ row, col })
    setFocusCell({ row, col })
  }

  const extendSelection = (row: number, col: ColKey) => {
    if (!anchor) return
    if (col !== anchor.col) return
    setFocusCell({ row, col })
  }

  const focusCellInput = (row: number, col: ColKey, initial?: string) => {
    if (COLUMN_DEFS[col].type === 'status') return
    startSelection(row, col)
    requestAnimationFrame(() => {
      const el = gridRef.current?.querySelector<HTMLInputElement>(`[data-cell="${row}-${col}"]`)
      if (!el) return
      if (initial !== undefined) el.value = initial
      el.focus()
      el.select()
    })
  }

  const focusGridCell = (row: number, col: ColKey) => {
    const targetPage = Math.floor(row / pageSize) + 1
    if (targetPage !== safePage) setPage(targetPage)
    startSelection(row, col)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = gridRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-cell="${row}-${col}"]`)
        if (!el) return
        el.focus()
        if (el instanceof HTMLInputElement) el.select()
      })
    })
  }

  /** Excel-style Tab / Shift+Tab across visible columns, wrapping by row. */
  const moveFocusByTab = (row: number, col: ColKey, backward: boolean) => {
    const cols = visibleColumnOrder
    const colIdx = cols.indexOf(col)
    if (colIdx < 0 || displayRows.length === 0) return

    let nextRow = row
    let nextColIdx = colIdx + (backward ? -1 : 1)
    if (nextColIdx >= cols.length) {
      if (row >= displayRows.length - 1) return
      nextColIdx = 0
      nextRow = row + 1
    } else if (nextColIdx < 0) {
      if (row <= 0) return
      nextColIdx = cols.length - 1
      nextRow = row - 1
    }

    focusGridCell(nextRow, cols[nextColIdx])
  }

  const commitEditFromInput = (row: number, col: ColKey, raw: string): boolean => {
    const value = parseEditedValue(col, raw)
    // Fast entry: typing into a multi-row selection fills every selected cell (Excel-style).
    const multi = !!selection && selection.col === col && selection.endRow > selection.startRow
    if (multi) {
      const ids = displayRows.slice(selection.startRow, selection.endRow + 1).map(r => r.id)
      applySameValueToIds(ids, col, value)
      return true
    }
    const v = displayRows[row]
    if (!v) return false
    commitSingleEdit(v.id, col, value)
    return false
  }

  const handleFillDown = useCallback(() => {
    if (!selection || selection.endRow <= selection.startRow) return
    const topRow = displayRows[selection.startRow]
    if (!topRow) return
    const value = readValue(topRow.id, selection.col)
    const ids = displayRows.slice(selection.startRow + 1, selection.endRow + 1).map(r => r.id)
    applySameValueToIds(ids, selection.col, value)
  }, [selection, displayRows, readValue, applySameValueToIds])

  const handleCopyToSelected = useCallback(() => {
    if (!selection) return
    const sourceRow = focusCell && focusCell.col === selection.col ? displayRows[focusCell.row] : displayRows[selection.startRow]
    if (!sourceRow) return
    const value = readValue(sourceRow.id, selection.col)
    const ids = displayRows.slice(selection.startRow, selection.endRow + 1).map(r => r.id)
    applySameValueToIds(ids, selection.col, value)
  }, [selection, focusCell, displayRows, readValue, applySameValueToIds])

  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    if (!selection) return
    if ((e.target as HTMLElement)?.closest?.('input, select, textarea')) return
    e.preventDefault()
    const text = displayRows.slice(selection.startRow, selection.endRow + 1)
      .map(r => {
        const val = readValue(r.id, selection.col)
        return selection.col === 'is_active' ? (val ? 'active' : 'inactive') : String(val ?? '')
      })
      .join('\n')
    e.clipboardData.setData('text/plain', text)
  }, [selection, displayRows, readValue])

  const applyPastedLines = useCallback((lines: string[]) => {
    const start = focusCell ?? (selection ? { row: selection.startRow, col: selection.col } : null)
    if (!start) return
    const col = start.col
    if (lines.length <= 1 && selection && selection.endRow > selection.startRow && selection.col === col) {
      applySameValueToIds(
        displayRows.slice(selection.startRow, selection.endRow + 1).map(r => r.id),
        col, parseEditedValue(col, lines[0] ?? ''),
      )
      return
    }
    const entries: { id: string; field: ColKey; value: unknown; prevValue: unknown }[] = []
    lines.forEach((line, i) => {
      const row = displayRows[start.row + i]
      if (!row) return
      const value = col === 'is_active' ? (line.trim().toLowerCase() === 'active' || line.trim().toLowerCase() === 'true') : parseEditedValue(col, line)
      const prevValue = readValue(row.id, col)
      if (JSON.stringify(prevValue) === JSON.stringify(value)) return
      entries.push({ id: row.id, field: col, value, prevValue })
      applyOverlay(row.id, col, value)
    })
    if (entries.length === 0) return
    pushUndo(entries.map(e => ({ id: e.id, field: e.field, prevValue: e.prevValue })))
    persistPerRow(entries)
    const endRow = Math.min(start.row + lines.length - 1, displayRows.length - 1)
    setAnchor({ row: start.row, col })
    setFocusCell({ row: endRow, col })
  }, [focusCell, selection, displayRows, readValue, applyOverlay, pushUndo, persistPerRow, applySameValueToIds])

  const handlePasteEvent = useCallback((e: React.ClipboardEvent) => {
    if ((e.target as HTMLElement)?.closest?.('input, select, textarea')) return
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    const lines = text.split(/\r\n|\n|\r/).filter((_, i, arr) => !(i === arr.length - 1 && arr[arr.length - 1] === ''))
    applyPastedLines(lines)
  }, [applyPastedLines])

  const handlePasteButton = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      const lines = text.split(/\r\n|\n|\r/).filter((_, i, arr) => !(i === arr.length - 1 && arr[arr.length - 1] === ''))
      applyPastedLines(lines)
    } catch {
      toast.error('Could not read clipboard — click a cell and press Ctrl+V instead')
    }
  }, [applyPastedLines])

  useEffect(() => {
    if (!isSelectingRef.current) return
    const onUp = () => { isSelectingRef.current = false }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [selection])

  useEffect(() => {
    if (!filling) return
    const onUp = () => {
      setFilling(prev => {
        if (prev && selection) {
          const topRow = displayRows[selection.startRow]
          if (topRow) {
            const value = readValue(topRow.id, selection.col)
            const ids = displayRows.slice(selection.startRow + 1, prev.previewEndRow + 1).map(r => r.id)
            applySameValueToIds(ids, selection.col, value)
            setAnchor({ row: selection.startRow, col: selection.col })
            setFocusCell({ row: prev.previewEndRow, col: selection.col })
          }
        }
        return null
      })
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filling])

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      clearAllSelections()
      return
    }
    if ((e.target as HTMLElement)?.closest?.('input, select, textarea')) return
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); handleFillDown(); return }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); return }
    if (!focusCell) return

    if (e.key === 'Tab') {
      e.preventDefault()
      moveFocusByTab(focusCell.row, focusCell.col, e.shiftKey)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      focusCellInput(focusCell.row, focusCell.col)
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!selection) return
      e.preventDefault()
      const ids = displayRows.slice(selection.startRow, selection.endRow + 1).map(r => r.id)
      applySameValueToIds(ids, selection.col, emptyValueFor(selection.col))
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = e.key === 'ArrowDown' ? 1 : -1
      const nextRow = Math.max(0, Math.min(displayRows.length - 1, focusCell.row + delta))
      if (e.shiftKey && anchor) setFocusCell({ row: nextRow, col: anchor.col })
      else { setAnchor({ row: nextRow, col: focusCell.col }); setFocusCell({ row: nextRow, col: focusCell.col }) }
      return
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const idx = visibleColumnOrder.indexOf(focusCell.col)
      const nextIdx = Math.max(0, Math.min(visibleColumnOrder.length - 1, idx + (e.key === 'ArrowRight' ? 1 : -1)))
      const nextCol = visibleColumnOrder[nextIdx]
      setAnchor({ row: focusCell.row, col: nextCol })
      setFocusCell({ row: focusCell.row, col: nextCol })
      return
    }
    if (e.key.length === 1 && !mod && !e.altKey && COLUMN_DEFS[focusCell.col].type !== 'status') {
      focusCellInput(focusCell.row, focusCell.col, e.key)
      return
    }
  }

  const toggleColumn = (col: ColKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(col)) { if (next.size > 1) next.delete(col) } else next.add(col)
      saveVisibleCols(next)
      return next
    })
  }

  const gridTemplate = `32px minmax(160px,1.4fr) ${visibleColumnOrder.map(c => COLUMN_DEFS[c].width).join(' ')}`
  const hasMultiRowSelection = !!selection && selection.endRow > selection.startRow
  const allVisibleSelected = pageRows.length > 0 && pageRows.every(r => rowSelected.has(r.id))

  const toggleRowSelected = (id: string) => {
    setRowSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setRowSelected(prev => {
        const next = new Set(prev)
        pageRows.forEach(r => next.delete(r.id))
        return next
      })
    } else {
      setRowSelected(prev => {
        const next = new Set(prev)
        pageRows.forEach(r => next.add(r.id))
        return next
      })
    }
  }

  const runBulkSetFields = async (set_fields: VariantPatchFields) => {
    const ids = Array.from(rowSelected)
    if (ids.length === 0) return
    setBulkPending(true)
    try {
      const res = await vendorApi.productBulkUpdateVariants(productId, { variant_ids: ids, set_fields })
      qc.invalidateQueries({ queryKey })
      toast.success(`Updated ${res.updated_count} variant${res.updated_count === 1 ? '' : 's'}`)
    } catch {
      toast.error('Bulk update failed')
    } finally {
      setBulkPending(false)
    }
  }

  const runBulkPriceAdjust = async (
    field: 'price' | 'compare_at_price' | 'cost_price',
    mode: PriceAdjustMode,
    value: number,
  ) => {
    const ids = Array.from(rowSelected)
    if (ids.length === 0) return
    setBulkPending(true)
    try {
      const res = await vendorApi.productBulkUpdateVariants(productId, {
        variant_ids: ids,
        price_adjustment: { field, mode, value },
      })
      qc.invalidateQueries({ queryKey })
      toast.success(`Updated ${res.updated_count} variant${res.updated_count === 1 ? '' : 's'}`)
      setPriceDialogOpen(false)
    } catch {
      toast.error('Bulk update failed')
    } finally {
      setBulkPending(false)
    }
  }

  const runBulkDelete = async () => {
    const ids = Array.from(rowSelected)
    if (ids.length === 0) return
    setBulkPending(true)
    try {
      const res = await vendorApi.productBulkDeleteVariants(productId, ids)
      qc.invalidateQueries({ queryKey })
      toast.success(`Deleted ${res.deleted_count} variant${res.deleted_count === 1 ? '' : 's'}`)
      setRowSelected(new Set())
      setConfirmDeleteOpen(false)
    } catch {
      toast.error('Could not delete selected variants')
    } finally {
      setBulkPending(false)
    }
  }

  const handleAutoSku = () => {
    const targets = (rowSelected.size > 0
      ? items.filter(v => rowSelected.has(v.id))
      : items
    ).filter(v => !String(readValue(v.id, 'sku') ?? '').trim())

    if (targets.length === 0) {
      toast.info(rowSelected.size > 0 ? 'Selected variants already have SKUs' : 'All variants already have SKUs')
      return
    }

    const base = inferBaseSku(items)
    const used = new Set(
      items
        .map(v => String(readValue(v.id, 'sku') ?? '').trim().toUpperCase())
        .filter(Boolean),
    )
    const entries: { id: string; field: ColKey; value: unknown; prevValue: unknown }[] = []
    targets.forEach(v => {
      const sku = buildAutoSku(base, v, used)
      used.add(sku.toUpperCase())
      const prevValue = readValue(v.id, 'sku')
      entries.push({ id: v.id, field: 'sku', value: sku, prevValue })
      applyOverlay(v.id, 'sku', sku)
    })
    pushUndo(entries.map(e => ({ id: e.id, field: e.field, prevValue: e.prevValue })))
    persistPerRow(entries)
    toast.success(`Generated ${entries.length} SKU${entries.length === 1 ? '' : 's'}`)
  }

  const handleExportCsv = () => {
    const rows = displayRows.length > 0 ? displayRows : items
    if (rows.length === 0) {
      toast.info('No variants to export')
      return
    }
    const lines = [
      CSV_COLS.map(c => c.label).join(','),
      ...rows.map(v => CSV_COLS.map(c => {
        if (c.key === 'id') return escapeCsv(v.id)
        if (c.key === 'name') return escapeCsv(v.name)
        const val = readValue(v.id, c.key)
        if (c.key === 'is_active') return val ? 'active' : 'inactive'
        return escapeCsv(val == null ? '' : String(val))
      }).join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `variants-${productId.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length} variant${rows.length === 1 ? '' : 's'}`)
  }

  const handleImportCsv = async (file: File) => {
    const text = await file.text()
    const table = parseCsv(text)
    if (table.length < 2) {
      toast.error('CSV needs a header row and at least one data row')
      return
    }
    const header = table[0].map(h => h.trim().toLowerCase())
    const idx = (label: string) => header.indexOf(label)
    const idIdx = idx('id')
    const nameIdx = idx('name')
    const skuIdx = idx('sku')
    const fieldMap: { label: string; col: ColKey }[] = [
      { label: 'sku', col: 'sku' },
      { label: 'price', col: 'price' },
      { label: 'mrp', col: 'compare_at_price' },
      { label: 'compare_at_price', col: 'compare_at_price' },
      { label: 'cost', col: 'cost_price' },
      { label: 'cost_price', col: 'cost_price' },
      { label: 'stock', col: 'quantity' },
      { label: 'quantity', col: 'quantity' },
      { label: 'tax_percent', col: 'tax_rate' },
      { label: 'tax_rate', col: 'tax_rate' },
      { label: 'status', col: 'is_active' },
      { label: 'is_active', col: 'is_active' },
    ]
    const byId = new Map(items.map(v => [v.id, v]))
    const bySku = new Map(items.map(v => [(v.sku ?? '').trim().toLowerCase(), v]).filter(([s]) => s) as [string, VariantListItem][])
    const byName = new Map(items.map(v => [v.name.trim().toLowerCase(), v]))

    const entries: { id: string; field: ColKey; value: unknown; prevValue: unknown }[] = []
    let matched = 0
    let unmatched = 0

    for (const row of table.slice(1)) {
      const id = idIdx >= 0 ? row[idIdx]?.trim() : ''
      const sku = skuIdx >= 0 ? row[skuIdx]?.trim() : ''
      const name = nameIdx >= 0 ? row[nameIdx]?.trim() : ''
      const variant = (id && byId.get(id))
        || (sku && bySku.get(sku.toLowerCase()))
        || (name && byName.get(name.toLowerCase()))
        || null
      if (!variant) { unmatched += 1; continue }
      matched += 1
      for (const { label, col } of fieldMap) {
        const colIdx = idx(label)
        if (colIdx < 0) continue
        const raw = row[colIdx] ?? ''
        if (raw.trim() === '' && col !== 'sku' && col !== 'compare_at_price' && col !== 'cost_price' && col !== 'tax_rate') continue
        let value: unknown
        if (col === 'is_active') {
          const t = raw.trim().toLowerCase()
          value = t === 'active' || t === 'true' || t === '1' || t === 'yes'
        } else {
          value = parseEditedValue(col, raw)
        }
        const prevValue = readValue(variant.id, col)
        if (JSON.stringify(prevValue) === JSON.stringify(value)) continue
        entries.push({ id: variant.id, field: col, value, prevValue })
        applyOverlay(variant.id, col, value)
      }
    }

    if (entries.length === 0) {
      toast.info(matched === 0 ? 'No matching variants found in CSV' : 'CSV matched rows but no field changes')
      return
    }
    pushUndo(entries.map(e => ({ id: e.id, field: e.field, prevValue: e.prevValue })))
    persistPerRow(entries)
    toast.success(`Imported ${entries.length} change${entries.length === 1 ? '' : 's'} across ${matched} variant${matched === 1 ? '' : 's'}${unmatched ? ` · ${unmatched} unmatched` : ''}`)
  }

  return (
    <div className="space-y-3">
      {!hideSearch && (
        <div className="flex flex-nowrap items-center justify-between gap-2">
          <h3 className="shrink-0 text-sm font-semibold text-foreground">
            Variant Matrix <span className="font-normal text-muted-foreground">— fast edit</span>
          </h3>
          <div className="relative w-[220px] shrink-0">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-nowrap items-center gap-1 rounded-md border bg-muted/30 px-1.5 py-1">
        <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
          <ToolbarButton icon={ArrowDown} label="Fill down" shortcut="⌘D" disabled={!hasMultiRowSelection} onClick={handleFillDown} />
          <ToolbarButton icon={ClipboardPaste} label="Paste" shortcut="⌘V" onClick={handlePasteButton} />
          <ToolbarButton icon={Copy} label="Copy" title="Copy to selected" disabled={!selection} onClick={handleCopyToSelected} />
          <ToolbarButton icon={Undo2} label="Undo" shortcut="⌘Z" disabled={undoStack.length === 0} onClick={handleUndo} />
          <ToolbarButton
            icon={Sparkles}
            label="Auto SKU"
            title={rowSelected.size > 0 ? 'Auto SKU (selected)' : 'Auto SKU'}
            disabled={
              rowSelected.size > 0
                ? !items.some(v => rowSelected.has(v.id) && !String(readValue(v.id, 'sku') ?? '').trim())
                : noSkuCount === 0
            }
            onClick={handleAutoSku}
          />
          <ToolbarButton icon={Download} label="Export" title="Export CSV" onClick={handleExportCsv} />
          <ToolbarButton icon={Upload} label="Import" title="Import CSV" onClick={() => csvInputRef.current?.click()} />
        </div>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void handleImportCsv(file)
          }}
        />

        <div
          className="ml-1 hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:flex"
          title={pendingCount > 0 ? 'Saving…' : 'All changes saved'}
        >
          {pendingCount > 0 ? (
            <><Loader2 className="h-3 w-3 animate-spin" /><span className="hidden lg:inline">Saving…</span></>
          ) : (
            <><Check className="h-3 w-3 text-emerald-600" /><span className="hidden lg:inline">Saved</span></>
          )}
        </div>

        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1">
          {(zeroPriceCount > 0 || noSkuCount > 0) && (
            <div className="flex items-center gap-1">
              {zeroPriceCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIssueFilter(f => f === 'zero_price' ? 'all' : 'zero_price')}
                  title={`${zeroPriceCount} zero price`}
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                    issueFilter === 'zero_price'
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-amber-200 bg-amber-50/60 text-amber-700 hover:bg-amber-50',
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span className="hidden md:inline">{zeroPriceCount} zero</span>
                  <span className="md:hidden">{zeroPriceCount}</span>
                </button>
              )}
              {noSkuCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIssueFilter(f => f === 'no_sku' ? 'all' : 'no_sku')}
                  title={`${noSkuCount} no SKU`}
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                    issueFilter === 'no_sku'
                      ? 'border-sky-500 bg-sky-50 text-sky-800'
                      : 'border-sky-200 bg-sky-50/60 text-sky-700 hover:bg-sky-50',
                  )}
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  <span className="hidden md:inline">{noSkuCount} no SKU</span>
                  <span className="md:hidden">{noSkuCount}</span>
                </button>
              )}
            </div>
          )}
          <div className="relative">
            <Button size="sm" variant="outline" className="h-6 gap-0.5 px-1.5 text-[11px]" onClick={() => { setColumnsMenuOpen(o => !o); setFiltersMenuOpen(false) }}>
              <Columns3 className="h-3 w-3" /> <span className="hidden sm:inline">Columns</span> <ChevronDown className="h-3 w-3" />
            </Button>
            {columnsMenuOpen && (
              <Dropdown onClose={() => setColumnsMenuOpen(false)}>
                {COLUMN_ORDER.map(col => (
                  <label key={col} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col)}
                      onChange={() => toggleColumn(col)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    {COLUMN_DEFS[col].label}
                  </label>
                ))}
              </Dropdown>
            )}
          </div>
          <div className="relative">
            <Button size="sm" variant="outline" className="h-6 gap-0.5 px-1.5 text-[11px]" onClick={() => { setFiltersMenuOpen(o => !o); setColumnsMenuOpen(false) }}>
              <SlidersHorizontal className="h-3 w-3" /> <span className="hidden sm:inline">Filters</span> <ChevronDown className="h-3 w-3" />
            </Button>
            {filtersMenuOpen && (
              <Dropdown onClose={() => setFiltersMenuOpen(false)} className="w-56">
                <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Issues</p>
                {([
                  { value: 'all' as const, label: 'All' },
                  { value: 'zero_price' as const, label: 'Zero price' },
                  { value: 'no_sku' as const, label: 'Missing SKU' },
                ]).map(opt => (
                  <FilterRadioRow key={opt.value} label={opt.label} checked={issueFilter === opt.value} onClick={() => setIssueFilter(opt.value)} />
                ))}
                <div className="my-1 border-t" />
                <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                {(['all', 'active', 'inactive'] as const).map(opt => (
                  <FilterRadioRow key={opt} label={opt === 'all' ? 'All' : opt === 'active' ? 'Active' : 'Inactive'} checked={statusFilter === opt} onClick={() => setStatusFilter(opt)} />
                ))}
                <div className="my-1 border-t" />
                <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Stock</p>
                {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as const).map(opt => (
                  <FilterRadioRow
                    key={opt}
                    label={opt === 'all' ? 'All' : opt === 'in_stock' ? 'In stock' : opt === 'low_stock' ? 'Low stock' : 'Out of stock'}
                    checked={stockFilter === opt}
                    onClick={() => setStockFilter(opt)}
                  />
                ))}
              </Dropdown>
            )}
          </div>
        </div>
      </div>

      {rowSelected.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1.5">
          <span className="text-xs font-medium">{rowSelected.size} selected</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={bulkPending} onClick={() => setPriceDialogOpen(true)}>
            <DollarSign className="h-3 w-3" /> Adjust price
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={bulkPending} onClick={() => runBulkSetFields({ is_active: true })}>
            <Power className="h-3 w-3" /> Activate
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={bulkPending} onClick={() => runBulkSetFields({ is_active: false })}>
            <PowerOff className="h-3 w-3" /> Deactivate
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={bulkPending} onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
          <button
            type="button"
            className="ml-auto text-xs text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => setRowSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {hasMultiRowSelection && selection && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-md">
          <span className="text-xs font-medium">
            {selection.endRow - selection.startRow + 1} rows selected
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            — Esc to clear · type a value &amp; Enter to fill all
          </span>
          <div className="relative">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSetFieldOpen(o => !o); setSetFieldValue('') }}>
              set {COLUMN_DEFS[selection.col].label} <ChevronRight className="h-3 w-3" />
            </Button>
            {setFieldOpen && (
              <Dropdown onClose={() => setSetFieldOpen(false)} className="w-56" align="bottom">
                {COLUMN_DEFS[selection.col].type === 'status' ? (
                  <div className="flex gap-1.5 p-1">
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => {
                      applySameValueToIds(displayRows.slice(selection.startRow, selection.endRow + 1).map(r => r.id), selection.col, true)
                      setSetFieldOpen(false)
                    }}>Active</Button>
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => {
                      applySameValueToIds(displayRows.slice(selection.startRow, selection.endRow + 1).map(r => r.id), selection.col, false)
                      setSetFieldOpen(false)
                    }}>Inactive</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 p-1">
                    <Input
                      autoFocus
                      value={setFieldValue}
                      onChange={e => setSetFieldValue(e.target.value)}
                      placeholder="New value…"
                      className="h-7 text-xs"
                      onKeyDown={e => { if (e.key === 'Enter') {
                        applySameValueToIds(displayRows.slice(selection.startRow, selection.endRow + 1).map(r => r.id), selection.col, parseEditedValue(selection.col, setFieldValue))
                        setSetFieldOpen(false)
                      } }}
                    />
                    <Button
                      size="sm" className="h-7 text-xs"
                      onClick={() => {
                        applySameValueToIds(displayRows.slice(selection.startRow, selection.endRow + 1).map(r => r.id), selection.col, parseEditedValue(selection.col, setFieldValue))
                        setSetFieldOpen(false)
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </Dropdown>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={clearAllSelections}>
              Clear selection
            </button>
            <button type="button" onClick={clearAllSelections} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Clear selection (Esc)">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div
          ref={gridRef}
          role="grid"
          tabIndex={0}
          onKeyDown={onGridKeyDown}
          onCopy={handleCopy}
          onPaste={handlePasteEvent}
          className="max-h-[65vh] overflow-auto outline-none"
        >
          <div
            className="sticky top-0 z-10 grid items-center gap-0 border-b bg-muted/70 text-[11px] font-medium text-muted-foreground backdrop-blur-sm"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="flex items-center justify-center px-1 py-2">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleSelectAllVisible}
                aria-label="Select all variants on this page"
              />
            </div>
            <HeaderCell label="Variant" menuKey="name" openMenu={colMenuOpen} setOpenMenu={setColMenuOpen} sort={sort} setSort={setSort} colKey="name" />
            {visibleColumnOrder.map(col => (
              <HeaderCell
                key={col}
                label={COLUMN_DEFS[col].label}
                menuKey={col}
                openMenu={colMenuOpen}
                setOpenMenu={setColMenuOpen}
                sort={sort}
                setSort={setSort}
                colKey={col}
                onHide={() => toggleColumn(col)}
              />
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : displayRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No variants match your filters.</div>
          ) : (
            pageRows.map((v, i) => {
              const rowIndex = pageStart + i
              const isRowChecked = rowSelected.has(v.id)
              return (
                <div
                  key={v.id}
                  className={cn(
                    'grid items-stretch gap-0 border-b text-xs last:border-b-0 hover:bg-muted/20',
                    isRowChecked && 'bg-primary/5',
                  )}
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div className="flex items-center justify-center px-1" onMouseDown={e => e.stopPropagation()}>
                    <Checkbox
                      checked={isRowChecked}
                      onCheckedChange={() => toggleRowSelected(v.id)}
                      aria-label={`Select ${v.name}`}
                    />
                  </div>
                  <div className="flex items-center gap-2 truncate px-2 py-2">
                    <button
                      type="button"
                      onClick={() => { setDetailsTab('media'); setDetailsId(v.id) }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-muted ring-offset-background hover:ring-2 hover:ring-primary/40"
                      title={v.media?.[0]?.url ? 'View / edit media' : 'Add media'}
                    >
                      {v.media?.[0]?.url ? (
                        <img src={v.media[0].url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageOff className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDetailsTab('general'); setDetailsId(v.id) }}
                      className="flex min-w-0 flex-1 items-center gap-1 truncate text-left font-medium text-foreground hover:text-primary"
                      title={v.name}
                    >
                      <span className="truncate">{v.name}</span>
                      <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
                    </button>
                  </div>

                  {visibleColumnOrder.map(col => {
                    const isSel = !!selection && selection.col === col && rowIndex >= selection.startRow && rowIndex <= selection.endRow
                    const isFillPreview = !!filling && !!selection && selection.col === col && rowIndex > selection.endRow && rowIndex <= filling.previewEndRow
                    const isTop = isSel && rowIndex === selection!.startRow
                    const bottomRow = selection && selection.col === col ? (filling ? filling.previewEndRow : selection.endRow) : -1
                    const isBottom = (isSel || isFillPreview) && rowIndex === bottomRow
                    const value = readValue(v.id, col)
                    const rawInput = value == null || value === '' ? '' : String(value)
                    const def = COLUMN_DEFS[col]
                    const isZeroPrice = col === 'price' && Number(value || 0) === 0
                    const isMissingSku = col === 'sku' && !String(value ?? '').trim()

                    return (
                      <div
                        key={col}
                        className={cn(
                          'relative flex items-center px-1.5 py-1',
                          (isSel || isFillPreview) && 'bg-primary/5',
                          (isSel || isFillPreview) && 'border-l-2 border-r-2 border-primary',
                          isFillPreview && 'border-dashed',
                          isTop && 'border-t-2 border-primary',
                          isBottom && 'border-b-2 border-primary',
                          isZeroPrice && !isSel && 'bg-amber-50',
                          isMissingSku && !isSel && 'bg-sky-50',
                        )}
                        onMouseEnter={() => {
                          if (filling) {
                            setFilling({ previewEndRow: Math.max(selection?.endRow ?? rowIndex, rowIndex) })
                          } else if (isSelectingRef.current) {
                            extendSelection(rowIndex, col)
                          }
                        }}
                      >
                        {def.type === 'status' ? (
                          <div
                            data-cell={`${rowIndex}-${col}`}
                            onMouseDown={(e) => {
                              if (e.shiftKey && anchor) extendSelection(rowIndex, col)
                              else startSelection(rowIndex, col)
                            }}
                            onFocus={() => startSelection(rowIndex, col)}
                            tabIndex={-1}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Tab') {
                                e.preventDefault()
                                moveFocusByTab(rowIndex, col, e.shiftKey)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                clearAllSelections()
                                gridRef.current?.focus()
                              }
                            }}
                          >
                            <Select
                              value={value ? 'true' : 'false'}
                              onChange={(v) => {
                                const next = v === 'true'
                                const multi = !!selection && selection.col === col && selection.endRow > selection.startRow
                                if (multi) {
                                  applySameValueToIds(
                                    displayRows.slice(selection.startRow, selection.endRow + 1).map(r => r.id),
                                    col,
                                    next,
                                  )
                                } else {
                                  commitSingleEdit(v.id, col, next)
                                }
                              }}
                              menuMinWidth={100}
                              className={cn(
                                'h-7 border-0 bg-transparent px-1 text-xs shadow-none',
                                value ? 'text-emerald-600' : 'text-muted-foreground',
                              )}
                              triggerClassName={cn(
                                'h-7 border-0 bg-transparent px-1 text-xs shadow-none',
                                value ? 'text-emerald-600' : 'text-muted-foreground',
                              )}
                              options={[
                                { value: 'true', label: 'Active' },
                                { value: 'false', label: 'Inactive' },
                              ]}
                            />
                          </div>
                        ) : (
                          <input
                            key={`${v.id}-${col}-${rawInput}`}
                            data-cell={`${rowIndex}-${col}`}
                            data-kiterp-no-field-focus
                            type={def.type === 'number' ? 'number' : 'text'}
                            step={def.type === 'number' ? '0.01' : undefined}
                            defaultValue={rawInput}
                            onMouseDown={(e) => {
                              if (e.shiftKey && anchor) {
                                e.preventDefault()
                                extendSelection(rowIndex, col)
                              } else {
                                startSelection(rowIndex, col)
                              }
                            }}
                            onFocus={(e) => {
                              startSelection(rowIndex, col)
                              e.currentTarget.select()
                            }}
                            onBlur={(e) => {
                              commitEditFromInput(rowIndex, col, e.target.value)
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const appliedToSelection = commitEditFromInput(rowIndex, col, (e.target as HTMLInputElement).value)
                                if (!appliedToSelection) {
                                  const nr = Math.min(displayRows.length - 1, rowIndex + 1)
                                  focusGridCell(nr, col)
                                } else {
                                  ;(e.target as HTMLInputElement).blur()
                                }
                              } else if (e.key === 'Tab') {
                                e.preventDefault()
                                commitEditFromInput(rowIndex, col, (e.target as HTMLInputElement).value)
                                moveFocusByTab(rowIndex, col, e.shiftKey)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                e.currentTarget.value = rawInput
                                e.currentTarget.blur()
                                clearAllSelections()
                                gridRef.current?.focus()
                              } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                if (def.type === 'number' && !e.altKey) return // keep spinner / caret behavior
                                e.preventDefault()
                                commitEditFromInput(rowIndex, col, (e.target as HTMLInputElement).value)
                                const delta = e.key === 'ArrowDown' ? 1 : -1
                                const nr = Math.max(0, Math.min(displayRows.length - 1, rowIndex + delta))
                                if (e.shiftKey && anchor) {
                                  setFocusCell({ row: nr, col: anchor.col })
                                } else {
                                  focusGridCell(nr, col)
                                }
                              }
                            }}
                            className={cn(
                              'h-7 w-full rounded border-0 bg-transparent px-1.5 text-xs tabular-nums shadow-none outline-none',
                              'focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none',
                              'focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none',
                              isZeroPrice && 'text-amber-800',
                              isMissingSku && 'text-sky-800 placeholder:text-sky-400',
                            )}
                            placeholder={isMissingSku ? 'Add SKU…' : undefined}
                          />
                        )}

                        {isBottom && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              isSelectingRef.current = false
                              setFilling({ previewEndRow: rowIndex })
                            }}
                            title="Drag to copy this value into rows below"
                            className="absolute -bottom-1 -right-1 z-10 h-2.5 w-2.5 cursor-ns-resize rounded-[2px] border border-white bg-primary"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {displayRows.length > 0 && (
          <TablePagination
            page={safePage}
            pages={totalPages}
            total={displayRows.length}
            pageSize={pageSize}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
            itemLabel="variants"
            className="border-t bg-muted/20 px-3 py-2"
          />
        )}
      </div>

      {detailsId && (
        <VariantDetailsDrawer
          productId={productId}
          variantId={detailsId}
          initialTab={detailsTab}
          onClose={() => setDetailsId(null)}
        />
      )}

      <PriceAdjustDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        count={rowSelected.size}
        pending={bulkPending}
        onApply={runBulkPriceAdjust}
      />

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {rowSelected.size} variant{rowSelected.size === 1 ? '' : 's'}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={bulkPending} onClick={runBulkDelete}>
              {bulkPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ToolbarButton({
  icon: Icon, label, shortcut, title, onClick, disabled,
}: {
  icon: typeof ArrowDown
  label: string
  shortcut?: string
  title?: string
  onClick: () => void
  disabled?: boolean
}) {
  const tip = title ?? (shortcut ? `${label} (${shortcut})` : label)
  return (
    <Button
      size="sm"
      variant="outline"
      title={tip}
      className="h-6 shrink-0 gap-0.5 px-1.5 text-[11px]"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-3 w-3" />
      {label}
      {shortcut && <span className="hidden text-[9px] text-muted-foreground xl:inline">{shortcut}</span>}
    </Button>
  )
}

function Dropdown({
  children, onClose, className, align = 'bottom',
}: {
  children: React.ReactNode
  onClose: () => void
  className?: string
  align?: 'top' | 'bottom'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])
  return (
    <div
      ref={ref}
      className={cn(
        'absolute right-0 z-30 min-w-[10rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        align === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1',
        className,
      )}
    >
      {children}
    </div>
  )
}

function FilterRadioRow({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted', checked && 'font-medium text-primary')}
    >
      <span className={cn('h-3 w-3 rounded-full border', checked ? 'border-primary bg-primary' : 'border-input')} />
      {label}
    </button>
  )
}

function HeaderCell({
  label, colKey, menuKey, openMenu, setOpenMenu, sort, setSort, onHide,
}: {
  label: string
  colKey: 'name' | ColKey
  menuKey: 'name' | ColKey
  openMenu: 'name' | ColKey | null
  setOpenMenu: (k: 'name' | ColKey | null) => void
  sort: { col: 'name' | ColKey; dir: 'asc' | 'desc' } | null
  setSort: (s: { col: 'name' | ColKey; dir: 'asc' | 'desc' } | null) => void
  onHide?: () => void
}) {
  const isActive = sort?.col === colKey
  const dir = isActive ? sort.dir : null

  const cycleSort = () => {
    if (!isActive) setSort({ col: colKey, dir: 'asc' })
    else if (dir === 'asc') setSort({ col: colKey, dir: 'desc' })
    else setSort(null)
  }

  return (
    <div className="relative flex items-center justify-between gap-1 px-2 py-2">
      <button
        type="button"
        onClick={cycleSort}
        title={
          !isActive ? 'Sort ascending'
            : dir === 'asc' ? 'Sort descending'
              : 'Clear sort'
        }
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1 truncate rounded px-0.5 py-0.5 text-left hover:text-foreground',
          isActive ? 'font-semibold text-primary' : 'text-muted-foreground',
        )}
      >
        <span className="truncate">{label}</span>
        {dir === 'asc' ? (
          <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
        ) : dir === 'desc' ? (
          <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
        ) : (
          <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setOpenMenu(openMenu === menuKey ? null : menuKey)}
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {openMenu === menuKey && (
        <Dropdown onClose={() => setOpenMenu(null)} className="left-0 right-auto w-40">
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => { setSort({ col: colKey, dir: 'asc' }); setOpenMenu(null) }}>
            <ArrowUp className="h-3 w-3" /> Sort ascending
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => { setSort({ col: colKey, dir: 'desc' }); setOpenMenu(null) }}>
            <ArrowDown className="h-3 w-3" /> Sort descending
          </button>
          {isActive && (
            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => { setSort(null); setOpenMenu(null) }}>
              Clear sort
            </button>
          )}
          {onHide && (
            <>
              <div className="my-1 border-t" />
              <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => { onHide(); setOpenMenu(null) }}>
                Hide column
              </button>
            </>
          )}
        </Dropdown>
      )}
    </div>
  )
}

const PRICE_FIELDS: { value: 'price' | 'compare_at_price' | 'cost_price'; label: string }[] = [
  { value: 'price', label: 'Price' },
  { value: 'compare_at_price', label: 'MRP' },
  { value: 'cost_price', label: 'Cost' },
]
const MODE_OPTIONS: { value: PriceAdjustMode; label: string }[] = [
  { value: 'set', label: 'Set to' },
  { value: 'increase_pct', label: 'Increase by %' },
  { value: 'decrease_pct', label: 'Decrease by %' },
  { value: 'increase_amt', label: 'Increase by amount' },
  { value: 'decrease_amt', label: 'Decrease by amount' },
]

function PriceAdjustDialog({
  open, onOpenChange, count, pending, onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  pending: boolean
  onApply: (field: 'price' | 'compare_at_price' | 'cost_price', mode: PriceAdjustMode, value: number) => void
}) {
  const [field, setField] = useState<'price' | 'compare_at_price' | 'cost_price'>('price')
  const [mode, setMode] = useState<PriceAdjustMode>('set')
  const [value, setValue] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Adjust price — {count} variant{count === 1 ? '' : 's'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Field</label>
            <Select value={field} onChange={val => setField(val as typeof field)} options={PRICE_FIELDS.map(f => ({ value: f.value, label: f.label }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Adjustment</label>
            <Select value={mode} onChange={val => setMode(val as PriceAdjustMode)} options={MODE_OPTIONS.map(m => ({ value: m.value, label: m.label }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Value</label>
            <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={pending || value === ''} onClick={() => onApply(field, mode, Number(value) || 0)}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
