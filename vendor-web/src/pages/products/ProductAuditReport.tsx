import { useParams, useNavigate } from 'react-router-dom'
import { ResizableTable } from '@/components/table/ResizableTable'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProduct } from '@/hooks/useVendor'
import { formatDateTime } from '@/lib/utils'
import { useState, useMemo, useRef, useEffect } from 'react'
import {
  ArrowLeft, Loader2, FileDown, FileSpreadsheet, FileText, Printer,
  Copy, MessageCircle, Mail, Share2, X, ChevronDown,
  ArrowUpDown, ArrowUp, ArrowDown, Search,
} from 'lucide-react'
import { toast } from 'sonner'

interface AuditRow {
  version: string
  timestamp: string
  timestampRaw: string
  changedBy: string
  userId: string
  action: 'Created' | 'Updated'
  field: string
  oldValue: string
  newValue: string
}

function flattenHistory(product: any): AuditRow[] {
  const history = [...(product?.change_history || [])].reverse()
  const rows: AuditRow[] = []

  for (const entry of history) {
    const changes = entry.changes || {}
    const isCreation = changes._action?.new === 'Product created'
    const ts = entry.changed_at || ''
    const tsFormatted = ts ? new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }) : '—'

    if (isCreation) {
      rows.push({
        version: `v${entry.version || 1}`,
        timestamp: tsFormatted,
        timestampRaw: ts,
        changedBy: entry.changed_by_name || 'Unknown',
        userId: entry.changed_by || '',
        action: 'Created',
        field: '—',
        oldValue: '—',
        newValue: 'Product created',
      })
    } else {
      const fields = Object.keys(changes).filter(k => k !== '_action')
      for (const field of fields) {
        const c = changes[field]
        rows.push({
          version: `v${entry.version || '?'}`,
          timestamp: tsFormatted,
          timestampRaw: ts,
          changedBy: entry.changed_by_name || 'Unknown',
          userId: entry.changed_by || '',
          action: 'Updated',
          field: field.replace(/_/g, ' '),
          oldValue: c.old || '(empty)',
          newValue: c.new || '(empty)',
        })
      }
    }
  }
  return rows
}

function escCsv(v: string) {
  return `"${(v ?? '').replace(/"/g, '""')}"`
}

function buildCsvContent(rows: AuditRow[], product: any): string {
  const header = ['Version', 'Timestamp', 'Changed By', 'User ID', 'Action', 'Field', 'Old Value', 'New Value']
  const csvRows = [header.map(escCsv).join(',')]
  for (const r of rows) {
    csvRows.push([r.version, r.timestamp, r.changedBy, r.userId, r.action, r.field, r.oldValue, r.newValue].map(escCsv).join(','))
  }
  csvRows.push('')
  csvRows.push([escCsv('Product'), escCsv(product.name)].join(','))
  csvRows.push([escCsv('Slug'), escCsv(product.slug || '')].join(','))
  csvRows.push([escCsv('SKU'), escCsv(product.sku || '')].join(','))
  csvRows.push([escCsv('Current Version'), escCsv(`v${product.version_number || 1}`)].join(','))
  csvRows.push([escCsv('Current Status'), escCsv(product.status || '')].join(','))
  csvRows.push([escCsv('Total Edits'), escCsv(String((product.change_history || []).length))].join(','))
  csvRows.push([escCsv('Report Generated'), escCsv(new Date().toLocaleString('en-IN'))].join(','))
  return '\uFEFF' + csvRows.join('\n')
}

function buildHtmlTable(rows: AuditRow[], product: any): string {
  const htmlPalette = [
    { bg: '#ecfdf5', border: '#10b981', badge: '#059669' },
    { bg: '#eff6ff', border: '#3b82f6', badge: '#2563eb' },
    { bg: '#faf5ff', border: '#a855f7', badge: '#9333ea' },
    { bg: '#fffbeb', border: '#f59e0b', badge: '#d97706' },
    { bg: '#fff1f2', border: '#f43f5e', badge: '#e11d48' },
    { bg: '#ecfeff', border: '#06b6d4', badge: '#0891b2' },
    { bg: '#eef2ff', border: '#6366f1', badge: '#4f46e5' },
    { bg: '#fff7ed', border: '#f97316', badge: '#ea580c' },
    { bg: '#f0fdfa', border: '#14b8a6', badge: '#0d9488' },
    { bg: '#fdf2f8', border: '#ec4899', badge: '#db2777' },
    { bg: '#f7fee7', border: '#84cc16', badge: '#65a30d' },
    { bg: '#fdf4ff', border: '#d946ef', badge: '#c026d3' },
  ]
  const versions = [...new Set(rows.map(r => r.version))]
  const vMap: Record<string, typeof htmlPalette[0]> = {}
  versions.forEach((v, i) => { vMap[v] = htmlPalette[i % htmlPalette.length] })

  const styles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #1a1a1a; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f3f4f6; text-align: left; padding: 8px 10px; border: 1px solid #e5e7eb; font-weight: 600; text-transform: uppercase; font-size: 10px; color: #6b7280; }
      td { padding: 6px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
      .old { color: #dc2626; text-decoration: line-through; }
      .new { color: #16a34a; font-weight: 500; }
      .vbadge { display: inline-block; padding: 2px 8px; border-radius: 10px; color: #fff; font-weight: 700; font-size: 11px; }
      .summary { margin-top: 20px; font-size: 12px; color: #666; }
      .summary td { border: none; padding: 2px 10px; }
      @media print { body { margin: 12px; } }
    </style>`

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Audit Report - ${product.name}</title>${styles}</head><body>`
  html += `<h1>Product Audit Report: ${product.name}</h1>`
  html += `<div class="meta">Slug: ${product.slug || '—'} &nbsp;|&nbsp; SKU: ${product.sku || '—'} &nbsp;|&nbsp; Status: ${product.status} &nbsp;|&nbsp; Version: v${product.version_number || 1} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}</div>`
  html += `<table><thead><tr><th>Version</th><th>Timestamp</th><th>Changed By</th><th>Action</th><th>Field</th><th>Old Value</th><th>New Value</th></tr></thead><tbody>`
  for (const r of rows) {
    const vc = vMap[r.version] || htmlPalette[0]
    html += `<tr style="background:${vc.bg};border-left:4px solid ${vc.border}"><td><span class="vbadge" style="background:${vc.badge}">${r.version}</span></td><td>${r.timestamp}</td><td>${r.changedBy}</td><td>${r.action}</td><td>${r.field}</td><td class="old">${r.oldValue}</td><td class="new">${r.newValue}</td></tr>`
  }
  html += `</tbody></table>`
  html += `<table class="summary"><tr><td><strong>Total Edits:</strong> ${(product.change_history || []).length}</td><td><strong>Created:</strong> ${product.created_at ? formatDateTime(product.created_at) : '—'}</td><td><strong>Last Updated:</strong> ${product.updated_at ? formatDateTime(product.updated_at) : '—'}</td></tr></table>`
  html += `</body></html>`
  return html
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

function buildXlsContent(rows: AuditRow[], product: any): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>`
  xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`
  xml += `<Styles><Style ss:ID="header"><Font ss:Bold="1" ss:Size="10"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/></Style>`
  xml += `<Style ss:ID="old"><Font ss:Color="#DC2626"/></Style>`
  xml += `<Style ss:ID="new"><Font ss:Color="#16A34A" ss:Bold="1"/></Style></Styles>`
  xml += `<Worksheet ss:Name="Audit Report"><Table>`
  // Header
  xml += `<Row ss:StyleID="header"><Cell><Data ss:Type="String">Version</Data></Cell><Cell><Data ss:Type="String">Timestamp</Data></Cell><Cell><Data ss:Type="String">Changed By</Data></Cell><Cell><Data ss:Type="String">User ID</Data></Cell><Cell><Data ss:Type="String">Action</Data></Cell><Cell><Data ss:Type="String">Field</Data></Cell><Cell><Data ss:Type="String">Old Value</Data></Cell><Cell><Data ss:Type="String">New Value</Data></Cell></Row>`
  for (const r of rows) {
    xml += `<Row><Cell><Data ss:Type="String">${r.version}</Data></Cell><Cell><Data ss:Type="String">${r.timestamp}</Data></Cell><Cell><Data ss:Type="String">${r.changedBy}</Data></Cell><Cell><Data ss:Type="String">${r.userId}</Data></Cell><Cell><Data ss:Type="String">${r.action}</Data></Cell><Cell><Data ss:Type="String">${r.field}</Data></Cell><Cell ss:StyleID="old"><Data ss:Type="String">${r.oldValue}</Data></Cell><Cell ss:StyleID="new"><Data ss:Type="String">${r.newValue}</Data></Cell></Row>`
  }
  // Summary
  xml += `<Row></Row>`
  xml += `<Row><Cell><Data ss:Type="String">Product</Data></Cell><Cell><Data ss:Type="String">${product.name}</Data></Cell></Row>`
  xml += `<Row><Cell><Data ss:Type="String">Slug</Data></Cell><Cell><Data ss:Type="String">${product.slug || ''}</Data></Cell></Row>`
  xml += `<Row><Cell><Data ss:Type="String">Current Version</Data></Cell><Cell><Data ss:Type="String">v${product.version_number || 1}</Data></Cell></Row>`
  xml += `<Row><Cell><Data ss:Type="String">Status</Data></Cell><Cell><Data ss:Type="String">${product.status || ''}</Data></Cell></Row>`
  xml += `<Row><Cell><Data ss:Type="String">Report Generated</Data></Cell><Cell><Data ss:Type="String">${new Date().toLocaleString('en-IN')}</Data></Cell></Row>`
  xml += `</Table></Worksheet></Workbook>`
  return xml
}

function shareReport(product: any, rows: AuditRow[], action: 'copy' | 'whatsapp' | 'email' | 'print' | 'native') {
  const summary = `Product Audit Report: ${product.name}\nVersion: v${product.version_number || 1} | Status: ${product.status}\nTotal changes: ${rows.length} entries | ${(product.change_history || []).length} edits`

  if (action === 'copy') {
    const lines = [`Product Audit Report: ${product.name}`, `Slug: ${product.slug}`, '']
    lines.push('Version | Timestamp | Changed By | Action | Field | Old Value | New Value')
    lines.push('-'.repeat(90))
    for (const r of rows) {
      lines.push(`${r.version} | ${r.timestamp} | ${r.changedBy} | ${r.action} | ${r.field} | ${r.oldValue} | ${r.newValue}`)
    }
    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('Report copied to clipboard')
  } else if (action === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank')
  } else if (action === 'email') {
    window.open(`mailto:?subject=${encodeURIComponent(`Audit Report: ${product.name}`)}&body=${encodeURIComponent(summary)}`, '_blank')
  } else if (action === 'print') {
    const html = buildHtmlTable(rows, product)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      setTimeout(() => win.print(), 300)
    }
  } else if (navigator.share) {
    navigator.share({ title: `Audit Report: ${product.name}`, text: summary }).catch(() => {})
  } else {
    navigator.clipboard.writeText(summary)
    toast.success('Report summary copied')
  }
}

export default function ProductAuditReport() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: product, isLoading } = useProduct(id || '')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOld, setSearchOld] = useState('')
  const [searchNew, setSearchNew] = useState('')
  const [filterVersion, setFilterVersion] = useState('')
  const [filterAction, setFilterAction] = useState<'' | 'Created' | 'Updated'>('')
  const [filterField, setFilterField] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)

  type SortKey = 'version' | 'timestampRaw' | 'changedBy' | 'action' | 'field' | 'oldValue' | 'newValue'
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

  const allRows = useMemo(() => flattenHistory(product), [product])

  const uniqueVersions = useMemo(() => {
    const set = new Set(allRows.map(r => r.version))
    return [...set].sort((a, b) => {
      const na = parseInt(a.replace('v', '')) || 0
      const nb = parseInt(b.replace('v', '')) || 0
      return nb - na
    })
  }, [allRows])

  const uniqueFields = useMemo(() => {
    const set = new Set(allRows.filter(r => r.action === 'Updated').map(r => r.field))
    return [...set].sort()
  }, [allRows])

  const uniqueUsers = useMemo(() => {
    const set = new Set(allRows.map(r => r.changedBy))
    return [...set].sort()
  }, [allRows])

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const qOld = searchOld.toLowerCase().trim()
    const qNew = searchNew.toLowerCase().trim()
    let rows = allRows.filter(r => {
      if (filterVersion && r.version !== filterVersion) return false
      if (filterAction && r.action !== filterAction) return false
      if (filterField && r.field !== filterField) return false
      if (filterUser && r.changedBy !== filterUser) return false
      if (qOld && !r.oldValue.toLowerCase().includes(qOld)) return false
      if (qNew && !r.newValue.toLowerCase().includes(qNew)) return false
      if (q && !(
        r.version.toLowerCase().includes(q) ||
        r.timestamp.toLowerCase().includes(q) ||
        r.changedBy.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        r.field.toLowerCase().includes(q) ||
        r.oldValue.toLowerCase().includes(q) ||
        r.newValue.toLowerCase().includes(q)
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
  }, [allRows, searchQuery, searchOld, searchNew, filterVersion, filterAction, filterField, filterUser, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-gray-300" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
  }

  const versionColors = useMemo(() => {
    const palette = [
      { bg: 'bg-emerald-50', border: 'border-l-emerald-500', badge: 'bg-emerald-600' },
      { bg: 'bg-blue-50', border: 'border-l-blue-500', badge: 'bg-blue-600' },
      { bg: 'bg-purple-50', border: 'border-l-purple-500', badge: 'bg-purple-600' },
      { bg: 'bg-amber-50', border: 'border-l-amber-500', badge: 'bg-amber-600' },
      { bg: 'bg-rose-50', border: 'border-l-rose-500', badge: 'bg-rose-600' },
      { bg: 'bg-cyan-50', border: 'border-l-cyan-500', badge: 'bg-cyan-600' },
      { bg: 'bg-indigo-50', border: 'border-l-indigo-500', badge: 'bg-indigo-600' },
      { bg: 'bg-orange-50', border: 'border-l-orange-500', badge: 'bg-orange-600' },
      { bg: 'bg-teal-50', border: 'border-l-teal-500', badge: 'bg-teal-600' },
      { bg: 'bg-pink-50', border: 'border-l-pink-500', badge: 'bg-pink-600' },
      { bg: 'bg-lime-50', border: 'border-l-lime-500', badge: 'bg-lime-600' },
      { bg: 'bg-fuchsia-50', border: 'border-l-fuchsia-500', badge: 'bg-fuchsia-600' },
    ]
    const versions = [...new Set(allRows.map(r => r.version))]
    const map: Record<string, typeof palette[0]> = {}
    versions.forEach((v, i) => { map[v] = palette[i % palette.length] })
    return map
  }, [allRows])

  const activeFilterCount = [searchQuery, searchOld, searchNew, filterVersion, filterAction, filterField, filterUser].filter(Boolean).length

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Product not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/products')}>Back to Products</Button>
      </div>
    )
  }

  const slug = product.slug || product.name

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/products/${id}`)}>
            <ArrowLeft className="w-4 h-4 mr-1" />Back to Product
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Report</h1>
            <p className="text-sm text-gray-500">{product.name} &middot; v{product.version_number || 1} &middot; {allRows.length} change entries</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div ref={exportRef} className="relative">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => { setShowExportMenu(!showExportMenu); setShowShareMenu(false) }}
            >
              <FileDown className="w-4 h-4" />Download
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg border shadow-lg z-50 py-1">
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => { downloadFile(buildCsvContent(filteredRows, product), `${slug}-audit.csv`, 'text/csv;charset=utf-8;'); setShowExportMenu(false); toast.success('CSV downloaded') }}
                >
                  <FileDown className="w-4 h-4 text-green-600" /> Download as CSV
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => { downloadFile(buildXlsContent(filteredRows, product), `${slug}-audit.xls`, 'application/vnd.ms-excel'); setShowExportMenu(false); toast.success('Excel downloaded') }}
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" /> Download as Excel
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    const html = buildHtmlTable(filteredRows, product)
                    const win = window.open('', '_blank')
                    if (win) { win.document.write(html); win.document.close(); toast.success('PDF ready — use Print > Save as PDF') }
                    setShowExportMenu(false)
                  }}
                >
                  <FileText className="w-4 h-4 text-red-500" /> Export as PDF
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => { shareReport(product, filteredRows, 'print'); setShowExportMenu(false) }}
                >
                  <Printer className="w-4 h-4 text-gray-500" /> Print
                </button>
              </div>
            )}
          </div>

          {/* Share dropdown */}
          <div ref={shareRef} className="relative">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => { setShowShareMenu(!showShareMenu); setShowExportMenu(false) }}
            >
              <Share2 className="w-4 h-4" />Share
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
            {showShareMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg border shadow-lg z-50 py-1">
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => { shareReport(product, filteredRows, 'copy'); setShowShareMenu(false) }}
                >
                  <Copy className="w-4 h-4 text-gray-400" /> Copy to Clipboard
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => { shareReport(product, filteredRows, 'whatsapp'); setShowShareMenu(false) }}
                >
                  <MessageCircle className="w-4 h-4 text-green-500" /> WhatsApp
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => { shareReport(product, filteredRows, 'email'); setShowShareMenu(false) }}
                >
                  <Mail className="w-4 h-4 text-blue-500" /> Email
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => { shareReport(product, filteredRows, 'native'); setShowShareMenu(false) }}
                >
                  <Share2 className="w-4 h-4 text-purple-500" /> Share
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{((product as any).change_history || []).length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Edits</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">v{product.version_number || 1}</p>
          <p className="text-xs text-gray-500 mt-1">Current Version</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{uniqueUsers.length}</p>
          <p className="text-xs text-gray-500 mt-1">Contributors</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm font-semibold text-gray-900">{product.created_at ? formatDateTime(product.created_at) : '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Created</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm font-semibold text-gray-900">{product.updated_at ? formatDateTime(product.updated_at) : '—'}</p>
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
                <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-500 gap-1" onClick={() => { setSearchQuery(''); setSearchOld(''); setSearchNew(''); setFilterVersion(''); setFilterAction(''); setFilterField(''); setFilterUser(''); setSortKey('') }}>
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
            <ResizableTable tableId="product-audit" defaultWidths={[70, 140, 130, 100, 130, 160, 160]}>
              <thead>
                {/* Sortable headers */}
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('version')}>Version <SortIcon col="version" /></button></th>
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('timestampRaw')}>Timestamp <SortIcon col="timestampRaw" /></button></th>
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('changedBy')}>Changed By <SortIcon col="changedBy" /></button></th>
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('action')}>Action <SortIcon col="action" /></button></th>
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('field')}>Field <SortIcon col="field" /></button></th>
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('oldValue')}>Old Value <SortIcon col="oldValue" /></button></th>
                  <th className="text-left px-4 py-2.5"><button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase hover:text-gray-800 transition-colors" onClick={() => toggleSort('newValue')}>New Value <SortIcon col="newValue" /></button></th>
                </tr>
                {/* Inline filter row */}
                <tr className="border-b bg-gray-50/30">
                  <th className="px-4 py-1.5">
                    <select value={filterVersion} onChange={e => setFilterVersion(e.target.value)} className="w-full h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] text-gray-600 font-normal">
                      <option value="">All</option>
                      {uniqueVersions.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </th>
                  <th className="px-4 py-1.5" />
                  <th className="px-4 py-1.5">
                    <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="w-full h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] text-gray-600 font-normal">
                      <option value="">All</option>
                      {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </th>
                  <th className="px-4 py-1.5">
                    <select value={filterAction} onChange={e => setFilterAction(e.target.value as any)} className="w-full h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] text-gray-600 font-normal">
                      <option value="">All</option>
                      <option value="Created">Created</option>
                      <option value="Updated">Updated</option>
                    </select>
                  </th>
                  <th className="px-4 py-1.5">
                    <select value={filterField} onChange={e => setFilterField(e.target.value)} className="w-full h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] text-gray-600 font-normal">
                      <option value="">All</option>
                      {uniqueFields.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </th>
                  <th className="px-4 py-1.5">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchOld}
                      onChange={e => setSearchOld(e.target.value)}
                      className="w-full h-7 rounded border border-gray-200 bg-white px-2 text-[11px] text-gray-600 font-normal placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </th>
                  <th className="px-4 py-1.5">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchNew}
                      onChange={e => setSearchNew(e.target.value)}
                      className="w-full h-7 rounded border border-gray-200 bg-white px-2 text-[11px] text-gray-600 font-normal placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      {allRows.length === 0
                        ? 'No change history recorded yet. Changes will be tracked after the next edit.'
                        : 'No entries match the current filters.'}
                    </td>
                  </tr>
                ) : filteredRows.map((r, i) => {
                  const vc = versionColors[r.version] || { bg: 'bg-gray-50', border: 'border-l-gray-400', badge: 'bg-gray-600' }
                  return (
                  <tr key={i} className={`border-l-4 ${vc.border} ${vc.bg}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${vc.badge}`}>{r.version}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{r.timestamp}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.changedBy}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        r.action === 'Created' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>{r.action}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 capitalize">{r.field}</td>
                    <td className="px-4 py-3 text-sm text-red-500 max-w-[200px]">
                      <span className="line-through block truncate" title={r.oldValue}>{r.oldValue}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-green-700 font-medium max-w-[200px]">
                      <span className="block truncate" title={r.newValue}>{r.newValue}</span>
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
