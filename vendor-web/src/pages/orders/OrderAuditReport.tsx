import { useParams, useNavigate } from 'react-router-dom'
import { ResizableTable } from '@/components/table/ResizableTable'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useOrder } from '@/hooks/useVendor'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { useState, useMemo, useRef, useEffect } from 'react'
import {
  ArrowLeft, Loader2, FileDown, FileSpreadsheet, FileText, Printer,
  Copy, MessageCircle, Mail, Share2, X, ChevronDown,
  ArrowUpDown, ArrowUp, ArrowDown, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Order, OrderStatusHistoryItem } from '@/types'

interface AuditRow {
  fromStatus: string
  toStatus: string
  changedByRole: string
  notes: string
  timestamp: string
  timestampRaw: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-orange-100 text-orange-700',
  returned: 'bg-rose-100 text-rose-700',
  return_requested: 'bg-amber-100 text-amber-700',
  exchange_requested: 'bg-cyan-100 text-cyan-700',
  exchanged: 'bg-teal-100 text-teal-700',
}

function statusBadgeCls(s: string) {
  return STATUS_COLORS[s] || 'bg-gray-100 text-gray-700'
}

function flattenHistory(order: Order | undefined): AuditRow[] {
  if (!order?.status_history) return []
  return [...order.status_history].reverse().map((h: OrderStatusHistoryItem) => ({
    fromStatus: h.from_status || '—',
    toStatus: h.to_status,
    changedByRole: h.changed_by_role || '—',
    notes: h.notes || '—',
    timestamp: h.timestamp ? new Date(h.timestamp).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }) : '—',
    timestampRaw: h.timestamp || '',
  }))
}

function escCsv(v: string) { return `"${(v ?? '').replace(/"/g, '""')}"` }

function buildCsvContent(rows: AuditRow[], order: Order): string {
  const header = ['Timestamp', 'From Status', 'To Status', 'Changed By', 'Notes']
  const csvRows = [header.map(escCsv).join(',')]
  for (const r of rows) {
    csvRows.push([r.timestamp, r.fromStatus, r.toStatus, r.changedByRole, r.notes].map(escCsv).join(','))
  }
  csvRows.push('')
  csvRows.push([escCsv('Order'), escCsv(`#${order.order_number}`)].join(','))
  csvRows.push([escCsv('Current Status'), escCsv(order.status)].join(','))
  csvRows.push([escCsv('Total'), escCsv(formatCurrency(order.total))].join(','))
  csvRows.push([escCsv('Total Changes'), escCsv(String(rows.length))].join(','))
  csvRows.push([escCsv('Report Generated'), escCsv(new Date().toLocaleString('en-IN'))].join(','))
  return '\uFEFF' + csvRows.join('\n')
}

function buildHtmlTable(rows: AuditRow[], order: Order): string {
  const statusPalette = [
    { s: 'pending', c: '#eab308' }, { s: 'confirmed', c: '#3b82f6' }, { s: 'processing', c: '#6366f1' },
    { s: 'shipped', c: '#a855f7' }, { s: 'delivered', c: '#22c55e' }, { s: 'cancelled', c: '#ef4444' },
    { s: 'refunded', c: '#f97316' }, { s: 'returned', c: '#f43f5e' },
  ]
  const getColor = (s: string) => statusPalette.find(p => p.s === s)?.c || '#6b7280'

  const styles = `<style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:24px;color:#1a1a1a}
    h1{font-size:20px;margin-bottom:4px}.meta{color:#666;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f3f4f6;text-align:left;padding:8px 10px;border:1px solid #e5e7eb;font-weight:600;text-transform:uppercase;font-size:10px;color:#6b7280}
    td{padding:6px 10px;border:1px solid #e5e7eb;vertical-align:top}
    .badge{display:inline-block;padding:2px 8px;border-radius:10px;color:#fff;font-weight:600;font-size:11px}
    .summary{margin-top:20px;font-size:12px;color:#666}.summary td{border:none;padding:2px 10px}
    @media print{body{margin:12px}}
  </style>`
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Order Audit - #${order.order_number}</title>${styles}</head><body>`
  html += `<h1>Order Audit Report: #${order.order_number}</h1>`
  html += `<div class="meta">Status: ${order.status} | Total: ${formatCurrency(order.total)} | Payment: ${order.payment_method || '—'} | Generated: ${new Date().toLocaleString('en-IN')}</div>`
  html += `<table><thead><tr><th>Timestamp</th><th>From Status</th><th>To Status</th><th>Changed By</th><th>Notes</th></tr></thead><tbody>`
  for (const r of rows) {
    const fc = getColor(r.fromStatus)
    const tc = getColor(r.toStatus)
    html += `<tr><td>${r.timestamp}</td><td><span class="badge" style="background:${fc}">${r.fromStatus}</span></td><td><span class="badge" style="background:${tc}">${r.toStatus}</span></td><td>${r.changedByRole}</td><td>${r.notes}</td></tr>`
  }
  html += `</tbody></table>`
  html += `<table class="summary"><tr><td><strong>Total Changes:</strong> ${rows.length}</td><td><strong>Created:</strong> ${order.created_at ? formatDateTime(order.created_at) : '—'}</td><td><strong>Last Updated:</strong> ${order.updated_at ? formatDateTime(order.updated_at) : '—'}</td></tr></table>`
  html += `</body></html>`
  return html
}

function buildXlsContent(rows: AuditRow[], order: Order): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>`
  xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`
  xml += `<Styles><Style ss:ID="header"><Font ss:Bold="1" ss:Size="10"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/></Style></Styles>`
  xml += `<Worksheet ss:Name="Order Audit"><Table>`
  xml += `<Row ss:StyleID="header"><Cell><Data ss:Type="String">Timestamp</Data></Cell><Cell><Data ss:Type="String">From Status</Data></Cell><Cell><Data ss:Type="String">To Status</Data></Cell><Cell><Data ss:Type="String">Changed By</Data></Cell><Cell><Data ss:Type="String">Notes</Data></Cell></Row>`
  for (const r of rows) {
    xml += `<Row><Cell><Data ss:Type="String">${r.timestamp}</Data></Cell><Cell><Data ss:Type="String">${r.fromStatus}</Data></Cell><Cell><Data ss:Type="String">${r.toStatus}</Data></Cell><Cell><Data ss:Type="String">${r.changedByRole}</Data></Cell><Cell><Data ss:Type="String">${r.notes}</Data></Cell></Row>`
  }
  xml += `<Row></Row>`
  xml += `<Row><Cell><Data ss:Type="String">Order</Data></Cell><Cell><Data ss:Type="String">#${order.order_number}</Data></Cell></Row>`
  xml += `<Row><Cell><Data ss:Type="String">Current Status</Data></Cell><Cell><Data ss:Type="String">${order.status}</Data></Cell></Row>`
  xml += `<Row><Cell><Data ss:Type="String">Total</Data></Cell><Cell><Data ss:Type="String">${formatCurrency(order.total)}</Data></Cell></Row>`
  xml += `<Row><Cell><Data ss:Type="String">Report Generated</Data></Cell><Cell><Data ss:Type="String">${new Date().toLocaleString('en-IN')}</Data></Cell></Row>`
  xml += `</Table></Worksheet></Workbook>`
  return xml
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function shareReport(order: Order, rows: AuditRow[], action: 'copy' | 'whatsapp' | 'email' | 'print' | 'native') {
  const summary = `Order Audit Report: #${order.order_number}\nStatus: ${order.status} | Total: ${formatCurrency(order.total)}\n${rows.length} status changes`

  if (action === 'copy') {
    const lines = [`Order Audit Report: #${order.order_number}`, '']
    lines.push('Timestamp | From | To | Changed By | Notes')
    lines.push('-'.repeat(80))
    for (const r of rows) {
      lines.push(`${r.timestamp} | ${r.fromStatus} | ${r.toStatus} | ${r.changedByRole} | ${r.notes}`)
    }
    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('Report copied to clipboard')
  } else if (action === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank')
  } else if (action === 'email') {
    window.open(`mailto:?subject=${encodeURIComponent(`Order Audit: #${order.order_number}`)}&body=${encodeURIComponent(summary)}`, '_blank')
  } else if (action === 'print') {
    const html = buildHtmlTable(rows, order)
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300) }
  } else if (navigator.share) {
    navigator.share({ title: `Order Audit: #${order.order_number}`, text: summary }).catch(() => {})
  } else {
    navigator.clipboard.writeText(summary)
    toast.success('Report summary copied')
  }
}

export default function OrderAuditReport() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading } = useOrder(id || '')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchNotes, setSearchNotes] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)

  type SortKey = 'timestampRaw' | 'fromStatus' | 'toStatus' | 'changedByRole' | 'notes'
  const [sortKey, setSortKey] = useState<SortKey | ''>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const exportRef = useRef<HTMLDivElement>(null)
  const shareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false)
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShowShareMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const allRows = useMemo(() => flattenHistory(order), [order])

  const uniqueFromStatuses = useMemo(() => [...new Set(allRows.map(r => r.fromStatus))].sort(), [allRows])
  const uniqueToStatuses = useMemo(() => [...new Set(allRows.map(r => r.toStatus))].sort(), [allRows])
  const uniqueRoles = useMemo(() => [...new Set(allRows.map(r => r.changedByRole))].sort(), [allRows])

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const qNotes = searchNotes.toLowerCase().trim()
    let rows = allRows.filter(r => {
      if (filterFrom && r.fromStatus !== filterFrom) return false
      if (filterTo && r.toStatus !== filterTo) return false
      if (filterRole && r.changedByRole !== filterRole) return false
      if (qNotes && !r.notes.toLowerCase().includes(qNotes)) return false
      if (q && !(
        r.fromStatus.toLowerCase().includes(q) ||
        r.toStatus.toLowerCase().includes(q) ||
        r.changedByRole.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        r.timestamp.toLowerCase().includes(q)
      )) return false
      return true
    })
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey] || ''
        const bv = b[sortKey] || ''
        const cmp = av.localeCompare(bv, undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [allRows, searchQuery, searchNotes, filterFrom, filterTo, filterRole, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) { setSortDir(prev => prev === 'asc' ? 'desc' : 'asc') }
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-gray-300" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
  }

  const activeFilterCount = [searchQuery, searchNotes, filterFrom, filterTo, filterRole].filter(Boolean).length

  const ROW_COLORS = [
    { bg: 'bg-emerald-50', border: 'border-l-emerald-500' },
    { bg: 'bg-blue-50', border: 'border-l-blue-500' },
    { bg: 'bg-purple-50', border: 'border-l-purple-500' },
    { bg: 'bg-amber-50', border: 'border-l-amber-500' },
    { bg: 'bg-rose-50', border: 'border-l-rose-500' },
    { bg: 'bg-cyan-50', border: 'border-l-cyan-500' },
    { bg: 'bg-indigo-50', border: 'border-l-indigo-500' },
    { bg: 'bg-orange-50', border: 'border-l-orange-500' },
    { bg: 'bg-teal-50', border: 'border-l-teal-500' },
    { bg: 'bg-pink-50', border: 'border-l-pink-500' },
  ]

  const statusColorMap = useMemo(() => {
    const statuses = [...new Set(allRows.map(r => r.toStatus))]
    const map: Record<string, typeof ROW_COLORS[0]> = {}
    statuses.forEach((s, i) => { map[s] = ROW_COLORS[i % ROW_COLORS.length] })
    return map
  }, [allRows])

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Order not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/orders')}>Back to Orders</Button>
      </div>
    )
  }

  const slug = order.order_number

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/orders/${id}`)}>
            <ArrowLeft className="w-4 h-4 mr-1" />Back to Order
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Audit Report</h1>
            <p className="text-sm text-gray-500">#{order.order_number} &middot; {formatCurrency(order.total)} &middot; {allRows.length} status changes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div ref={exportRef} className="relative">
            <Button variant="outline" className="gap-2" onClick={() => { setShowExportMenu(!showExportMenu); setShowShareMenu(false) }}>
              <FileDown className="w-4 h-4" />Download<ChevronDown className="w-3.5 h-3.5" />
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg border shadow-lg z-50 py-1">
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { downloadFile(buildCsvContent(filteredRows, order), `order-${slug}-audit.csv`, 'text/csv;charset=utf-8;'); setShowExportMenu(false); toast.success('CSV downloaded') }}>
                  <FileDown className="w-4 h-4 text-green-600" /> Download as CSV
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { downloadFile(buildXlsContent(filteredRows, order), `order-${slug}-audit.xls`, 'application/vnd.ms-excel'); setShowExportMenu(false); toast.success('Excel downloaded') }}>
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" /> Download as Excel
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { const html = buildHtmlTable(filteredRows, order); const win = window.open('', '_blank'); if (win) { win.document.write(html); win.document.close(); toast.success('PDF ready — use Print > Save as PDF') }; setShowExportMenu(false) }}>
                  <FileText className="w-4 h-4 text-red-500" /> Export as PDF
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { shareReport(order, filteredRows, 'print'); setShowExportMenu(false) }}>
                  <Printer className="w-4 h-4 text-gray-500" /> Print
                </button>
              </div>
            )}
          </div>
          {/* Share dropdown */}
          <div ref={shareRef} className="relative">
            <Button variant="outline" className="gap-2" onClick={() => { setShowShareMenu(!showShareMenu); setShowExportMenu(false) }}>
              <Share2 className="w-4 h-4" />Share<ChevronDown className="w-3.5 h-3.5" />
            </Button>
            {showShareMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg border shadow-lg z-50 py-1">
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { shareReport(order, filteredRows, 'copy'); setShowShareMenu(false) }}><Copy className="w-4 h-4 text-gray-400" /> Copy to Clipboard</button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { shareReport(order, filteredRows, 'whatsapp'); setShowShareMenu(false) }}><MessageCircle className="w-4 h-4 text-green-500" /> WhatsApp</button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { shareReport(order, filteredRows, 'email'); setShowShareMenu(false) }}><Mail className="w-4 h-4 text-blue-500" /> Email</button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => { shareReport(order, filteredRows, 'native'); setShowShareMenu(false) }}><Share2 className="w-4 h-4 text-purple-500" /> Share</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{allRows.length}</p>
          <p className="text-xs text-gray-500 mt-1">Status Changes</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <span className={`px-2.5 py-1 text-sm rounded-full font-semibold ${statusBadgeCls(order.status)}`}>{order.status}</span>
          <p className="text-xs text-gray-500 mt-2">Current Status</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(order.total)}</p>
          <p className="text-xs text-gray-500 mt-1">Order Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm font-semibold text-gray-900">{order.created_at ? formatDateTime(order.created_at) : '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Placed</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm font-semibold text-gray-900">{order.updated_at ? formatDateTime(order.updated_at) : '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Last Updated</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search entire report..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-8 rounded-md border border-gray-200 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery('')}>
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-500 gap-1" onClick={() => { setSearchQuery(''); setSearchNotes(''); setFilterFrom(''); setFilterTo(''); setFilterRole(''); setSortKey('') }}>
                  <X className="w-3 h-3" />Clear All ({activeFilterCount})
                </Button>
              )}
              <span className="text-xs text-gray-400 whitespace-nowrap">
                Showing {filteredRows.length} of {allRows.length} entries
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <ResizableTable tableId="order-audit" defaultWidths={[150, 130, 130, 140, 220]}>
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('timestampRaw')}>Timestamp <SortIcon col="timestampRaw" /></button></th>
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('fromStatus')}>From Status <SortIcon col="fromStatus" /></button></th>
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('toStatus')}>To Status <SortIcon col="toStatus" /></button></th>
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('changedByRole')}>Changed By <SortIcon col="changedByRole" /></button></th>
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('notes')}>Notes <SortIcon col="notes" /></button></th>
                </tr>
                {/* Inline filters */}
                <tr className="border-b bg-gray-50/30">
                  <th className="px-4 py-1.5" />
                  <th className="px-4 py-1.5">
                    <select value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-full h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] text-gray-600 font-normal">
                      <option value="">All</option>
                      {uniqueFromStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </th>
                  <th className="px-4 py-1.5">
                    <select value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-full h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] text-gray-600 font-normal">
                      <option value="">All</option>
                      {uniqueToStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </th>
                  <th className="px-4 py-1.5">
                    <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="w-full h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] text-gray-600 font-normal">
                      <option value="">All</option>
                      {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </th>
                  <th className="px-4 py-1.5">
                    <input type="text" placeholder="Search..." value={searchNotes} onChange={e => setSearchNotes(e.target.value)}
                      className="w-full h-7 rounded border border-gray-200 bg-white px-2 text-[11px] text-gray-600 font-normal placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                      {allRows.length === 0
                        ? 'No status history recorded for this order.'
                        : 'No entries match the current filters.'}
                    </td>
                  </tr>
                ) : filteredRows.map((r, i) => {
                  const rc = statusColorMap[r.toStatus] || { bg: 'bg-gray-50', border: 'border-l-gray-400' }
                  return (
                    <tr key={i} className={`border-l-4 ${rc.border} ${rc.bg}`}>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{r.timestamp}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusBadgeCls(r.fromStatus)}`}>{r.fromStatus}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusBadgeCls(r.toStatus)}`}>{r.toStatus}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 capitalize">{r.changedByRole}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[300px]">
                        <span className="block truncate" title={r.notes}>{r.notes}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </ResizableTable>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
