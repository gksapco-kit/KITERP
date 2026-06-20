import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { SectionLabel } from '@/components/common/FieldLabel'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { ResizableTable } from '@/components/table/ResizableTable'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { useOrderStats, useReviews, useProducts, useStores } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { apiClient } from '@/api/client'
import { toast } from 'sonner'
import {
  BarChart3, TrendingUp, ShoppingCart, Users, Package, Star,
  Download, FileText, ChevronDown, ChevronUp, Loader2, IndianRupee,
  Receipt, Clock, Calendar, Layers, Search, X,
  ArrowUpRight, CheckCircle, AlertCircle, ArrowUp, ArrowDown,
  Filter, MessageCircle, Phone, Plus, Trash2, Send,
  BarChart as BarChartIcon, PieChart as PieChartIcon,
  Activity, Minus, Tag, BookOpen, Settings2, ChevronRight,
  Bell, Zap, ExternalLink, ToggleLeft, ToggleRight,
  ClipboardList, Truck, Factory, PackagePlus, ListChecks,
  BadgeAlert, BadgeCheck, CircleDot, Hammer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ClickableImageButton,
  ImageLightboxSession,
  urlsToLightboxItems,
} from '@/components/common/ImageAttachmentLightbox'
import { PhoneInput } from '@/components/ui/PhoneInput'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
type ReportId =
  | 'sales_overview' | 'revenue_summary' | 'orders_status'
  | 'top_products'   | 'top_customers'   | 'pos_report'
  | 'inventory_report' | 'reviews_report'
  | 'bookings_report'  | 'invoices_report' | 'coupons_report'
  | 'mrp_report'

interface ReportDef {
  id: ReportId; label: string; description: string
  icon: React.ElementType; color: string; bg: string
}

interface MRPItem {
  product_id: string
  name: string
  sku: string
  category: string
  unit_price: number
  available_stock: number
  required_qty: number
  gap: number               // positive = shortage, negative = surplus
  order_refs: string[]
  suggested_action: 'buy' | 'produce' | 'sufficient'
}

interface POLine { product_id: string; name: string; qty: number; unit_price: number }
interface ProductionLine { product_id: string; name: string; qty: number }

interface ProdAttachment { name: string; dataUrl: string; type: string; size: number }

interface StockDispatch {
  id: string; date: string; qty: number; notes: string; dispatchedBy: string
}

interface ProdHistoryEntry {
  id: string; orderNo: string; template: string; items: ProductionLine[]
  team: string; targetDate: string; status: 'draft' | 'in_progress' | 'completed' | 'on_hold'
  progress: number; notes: string; createdAt: string
  attachments: ProdAttachment[]; stockDispatches: StockDispatch[]
}

interface WaContact {
  id: string
  number: string
  label: string
  enabled: boolean
  reports: string[]
  smart_triggers: string[]
  frequency: 'hourly' | 'twice_daily' | 'daily' | 'weekly' | 'monthly'
  time: string
  day_of_week?: string   // for weekly: mon–sun
  interval_hours?: number // for hourly
}

type DateRange = '7d' | '30d' | '90d' | '365d' | 'custom'
type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'hbar'
type SortDir = 'asc' | 'desc'
type SalesDayRow = { date: string; orders: number; revenue: number }

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const REPORTS: ReportDef[] = [
  { id: 'sales_overview',   label: 'Sales Overview',     description: 'Daily sales trend with revenue & order counts',      icon: BarChart3,   color: 'text-blue-600',    bg: 'bg-blue-50' },
  { id: 'revenue_summary',  label: 'Revenue Summary',    description: 'Revenue by today, week, month & year',              icon: IndianRupee,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'orders_status',    label: 'Orders by Status',   description: 'Order distribution across fulfilment stages',       icon: ShoppingCart, color: 'text-primary',  bg: 'bg-accent' },
  { id: 'top_products',     label: 'Top Products',       description: 'Best-performing products by stock & price',         icon: Package,      color: 'text-orange-600',  bg: 'bg-orange-50' },
  { id: 'top_customers',    label: 'Top Customers',      description: 'Highest-spending customers and order frequency',    icon: Users,        color: 'text-pink-600',    bg: 'bg-pink-50' },
  { id: 'pos_report',       label: 'POS Sales',          description: 'Point-of-sale transactions and payment methods',    icon: Receipt,      color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  { id: 'bookings_report',  label: 'Service Bookings',   description: 'Booking stats, status breakdown, and schedules',    icon: BookOpen,     color: 'text-cyan-600',    bg: 'bg-cyan-50' },
  { id: 'invoices_report',  label: 'Invoices',           description: 'Paid vs unpaid, total invoiced, overdue summary',   icon: FileText,     color: 'text-rose-600',    bg: 'bg-rose-50' },
  { id: 'coupons_report',   label: 'Coupons',            description: 'Active coupons, usage stats, and discount totals',  icon: Tag,          color: 'text-lime-600',    bg: 'bg-lime-50' },
  { id: 'inventory_report', label: 'Inventory',          description: 'Stock levels, low-stock alerts and valuation',      icon: Layers,       color: 'text-teal-600',    bg: 'bg-teal-50' },
  { id: 'reviews_report',   label: 'Reviews & Ratings',  description: 'Customer satisfaction and review trends',           icon: Star,         color: 'text-amber-600',   bg: 'bg-amber-50' },
  { id: 'mrp_report',       label: 'Material Requirements Plan', description: 'Shortage analysis from open orders — convert to PO or production', icon: ClipboardList, color: 'text-primary', bg: 'bg-accent' },
]

const DATE_RANGES: { label: string; value: DateRange; days: number }[] = [
  { label: '7 days',  value: '7d',   days: 7 },
  { label: '30 days', value: '30d',  days: 30 },
  { label: '90 days', value: '90d',  days: 90 },
  { label: '1 year',  value: '365d', days: 365 },
  { label: 'Custom',  value: 'custom', days: 0 },
]

const STATUS_COLORS: Record<string, { bar: string; badge: string; dot: string; hex: string }> = {
  pending:     { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-400',  hex: '#f59e0b' },
  confirmed:   { bar: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-500',   hex: '#3b82f6' },
  shipped:     { bar: 'bg-primary', badge: 'bg-primary/12 text-primary', dot: 'bg-primary', hex: '#64C3A0' },
  delivered:   { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-800',   dot: 'bg-green-500',  hex: '#22c55e' },
  cancelled:   { bar: 'bg-red-400',    badge: 'bg-red-100 text-red-800',       dot: 'bg-red-400',    hex: '#ef4444' },
  completed:   { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-800',   dot: 'bg-green-500',  hex: '#22c55e' },
  scheduled:   { bar: 'bg-primary/70', badge: 'bg-primary/12 text-primary', dot: 'bg-primary/70', hex: '#50a080' },
  in_progress: { bar: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-400',   hex: '#60a5fa' },
}

const CHART_TYPES: { type: ChartType; label: string; icon: React.ElementType }[] = [
  { type: 'bar',   label: 'Bar',       icon: BarChartIcon },
  { type: 'line',  label: 'Line',      icon: Activity },
  { type: 'area',  label: 'Area',      icon: TrendingUp },
  { type: 'pie',   label: 'Pie',       icon: PieChartIcon },
  { type: 'donut', label: 'Donut',     icon: PieChartIcon },
  { type: 'hbar',  label: 'H-Bar',     icon: Minus },
]

const DEFAULT_PALETTE = ['#3b82f6','#64C3A0','#f59e0b','#22c55e','#ef4444','#ec4899','#06b6d4','#84cc16','#f97316','#0d9488']

const PROD_TEMPLATES: { id: string; label: string; emoji: string; description: string; defaultNotes: string }[] = [
  { id: 'standard',   label: 'Standard Production',  emoji: '🏭', description: 'Regular batch production order', defaultNotes: 'Follow standard operating procedures. Ensure quality checks at each stage.' },
  { id: 'urgent',     label: 'Urgent / Priority',    emoji: '🔴', description: 'Fast-track order to meet demand', defaultNotes: 'PRIORITY ORDER — expedite all stages. Notify supervisor on completion. Skip non-critical inspections if needed.' },
  { id: 'batch',      label: 'Batch Production',     emoji: '📦', description: 'Multiple batches of same product', defaultNotes: 'Produce in equal batches. Record each batch number, yield and QC result before proceeding to next batch.' },
  { id: 'rework',     label: 'Rework / Repair',      emoji: '🔧', description: 'Rework defective units to meet spec', defaultNotes: 'Identify root cause of defect. Document rework steps. Re-inspect all reworked units before dispatch.' },
  { id: 'assembly',   label: 'Assembly Order',       emoji: '⚙️', description: 'Assemble components into finished goods', defaultNotes: 'Verify all components available before starting. Follow assembly checklist. Label finished units.' },
  { id: 'custom',     label: 'Custom Order',         emoji: '✏️', description: 'Custom requirements (edit as needed)', defaultNotes: '' },
]

const MRP_OPTIONAL_COLS: { id: string; label: string }[] = [
  { id: 'unit_price',   label: 'Unit Price' },
  { id: 'reorder_level', label: 'Reorder Level' },
  { id: 'lead_time',    label: 'Lead Time' },
  { id: 'supplier',     label: 'Preferred Supplier' },
  { id: 'last_ordered', label: 'Last Ordered' },
  { id: 'location',     label: 'Storage Location' },
]

const SMART_TRIGGERS: { id: string; label: string; description: string; icon: React.ElementType; color: string; bg: string; badge?: string }[] = [
  { id: 'daily_revenue',    label: 'Daily Revenue Digest',    description: 'End-of-day summary of revenue & orders',           icon: IndianRupee,  color: 'text-emerald-600', bg: 'bg-emerald-50', badge: 'Daily' },
  { id: 'new_order',        label: 'New Order Alert',          description: 'Instant alert when a new order is placed',         icon: ShoppingCart, color: 'text-blue-600',    bg: 'bg-blue-50',    badge: 'Instant' },
  { id: 'low_stock',        label: 'Low Stock Alert',          description: 'Alert when any product stock drops below 10',      icon: Package,      color: 'text-orange-600',  bg: 'bg-orange-50',  badge: 'Instant' },
  { id: 'booking_reminder', label: 'Booking Reminder',         description: "Today's upcoming service bookings summary",        icon: BookOpen,     color: 'text-cyan-600',    bg: 'bg-cyan-50',    badge: 'Morning' },
  { id: 'weekly_perf',      label: 'Weekly Performance',       description: 'Week-over-week revenue and order comparison',      icon: TrendingUp,   color: 'text-primary',  bg: 'bg-accent',  badge: 'Weekly' },
  { id: 'review_alert',     label: 'New Review Alert',         description: 'Alert when a new customer review is posted',       icon: Star,         color: 'text-amber-600',   bg: 'bg-amber-50',   badge: 'Instant' },
  { id: 'pending_orders',   label: 'Pending Orders Nudge',     description: 'Reminder when orders stay pending > 2 hours',      icon: Clock,        color: 'text-rose-600',    bg: 'bg-rose-50',    badge: 'Hourly' },
  { id: 'unpaid_invoices',  label: 'Unpaid Invoice Alert',     description: 'Summary of outstanding unpaid invoices',           icon: FileText,     color: 'text-red-600',     bg: 'bg-red-50',     badge: 'Daily' },
  { id: 'pos_summary',      label: 'POS End-of-Day Summary',   description: 'Daily POS sales count, revenue and top payment',   icon: Receipt,      color: 'text-indigo-600',  bg: 'bg-indigo-50',  badge: 'Evening' },
  { id: 'revenue_milestone',label: 'Revenue Milestone Hit',    description: 'Alert when daily revenue crosses ₹10,000',         icon: TrendingUp,   color: 'text-green-600',   bg: 'bg-green-50',   badge: 'Instant' },
  { id: 'coupon_expiry',    label: 'Coupon Expiry Warning',    description: 'Alert 24h before any active coupon expires',       icon: Tag,          color: 'text-lime-600',    bg: 'bg-lime-50',    badge: 'Daily' },
  { id: 'morning_briefing', label: 'Morning Briefing',         description: 'Start-of-day snapshot: pending orders, bookings',  icon: Calendar,     color: 'text-sky-600',     bg: 'bg-sky-50',     badge: 'Morning' },
]

// Preset bundles for quick report + trigger selection
const WA_PRESETS: { label: string; icon: string; reports: string[]; triggers: string[] }[] = [
  {
    label: 'Business Owner',
    icon: '👤',
    reports: ['sales_overview', 'revenue_summary', 'top_customers', 'invoices_report'],
    triggers: ['daily_revenue', 'revenue_milestone', 'weekly_perf', 'morning_briefing'],
  },
  {
    label: 'Operations',
    icon: '⚙️',
    reports: ['orders_status', 'inventory_report', 'pos_report', 'bookings_report'],
    triggers: ['new_order', 'low_stock', 'pending_orders', 'booking_reminder', 'pos_summary'],
  },
  {
    label: 'Sales Manager',
    icon: '📊',
    reports: ['sales_overview', 'top_products', 'top_customers', 'coupons_report'],
    triggers: ['daily_revenue', 'new_order', 'review_alert', 'coupon_expiry'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportXLS(filename: string, headers: string[], rows: (string | number)[][]) {
  const tableHtml = [
    '<table border="1">',
    `<tr>${headers.map(h => `<th style="background:#e8f0fe;font-weight:bold">${h}</th>`).join('')}</tr>`,
    ...rows.map(r => `<tr>${r.map(c => `<td>${String(c).replace(/</g, '&lt;')}</td>`).join('')}</tr>`),
    '</table>',
  ].join('')
  const blob = new Blob(
    [`\uFEFF<html><head><meta charset="UTF-8"></head><body>${tableHtml}</body></html>`],
    { type: 'application/vnd.ms-excel;charset=UTF-8' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

async function exportPDF(el: HTMLElement, filename: string) {
  const { default: html2canvas } = await import('html2canvas')
  const { jsPDF } = await import('jspdf')
  toast.promise(
    (async () => {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
      pdf.save(filename)
    })(),
    { loading: 'Generating PDF…', success: 'PDF downloaded!', error: 'Export failed.' },
  )
}

function sortData<T>(arr: T[], key: string, dir: SortDir): T[] {
  return [...arr].sort((a: any, b: any) => {
    const av = a[key], bv = b[key]
    const cmp = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''))
    return dir === 'asc' ? cmp : -cmp
  })
}

function filterRows<T>(arr: T[], search: string, keys: string[]): T[] {
  if (!search.trim()) return arr
  const q = search.toLowerCase()
  return arr.filter((r: any) => keys.some(k => String(r[k] || '').toLowerCase().includes(q)))
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHART COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function BarChart({ data, valueKey, labelKey, color = '#3b82f6', height = 140 }: {
  data: Record<string, any>[]; valueKey: string; labelKey: string; color?: string; height?: number
}) {
  const max = Math.max(1, ...data.map(d => d[valueKey] || 0))
  const barW = Math.max(6, Math.floor(500 / (data.length + 1)))
  const gap  = Math.max(2, Math.floor(barW * 0.25))
  const totalW = (barW + gap) * data.length
  return (
    <div className="overflow-x-auto"><svg width={totalW} height={height + 28} className="min-w-full">
      {data.map((d, i) => {
        const val = d[valueKey] || 0; const barH = Math.max(2, (val / max) * height)
        const x = i * (barW + gap)
        return <g key={i}><rect x={x} y={height - barH} width={barW} height={barH} fill={color} rx={3} opacity={0.85} />
          <text x={x + barW / 2} y={height + 16} textAnchor="middle" fontSize={9} fill="#9ca3af">{String(d[labelKey] || '').slice(-5)}</text></g>
      })}
    </svg></div>
  )
}

function LineChart({ data, valueKey, labelKey, color = '#3b82f6', height = 140, fill = false }: {
  data: Record<string, any>[]; valueKey: string; labelKey: string; color?: string; height?: number; fill?: boolean
}) {
  if (data.length < 2) return <p className="text-xs text-gray-400 text-center py-4">Need at least 2 data points.</p>
  const max = Math.max(1, ...data.map(d => d[valueKey] || 0))
  const pad = 6; const w = Math.max(300, data.length * 20); const h = height
  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((d[valueKey] || 0) / max) * (h - pad * 2)
    return { x, y }
  })
  const line = points.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = `M${points[0].x},${h - pad} L${line} L${points[points.length - 1].x},${h - pad} Z`
  return (
    <div className="overflow-x-auto"><svg width={w} height={h + 28} className="min-w-full">
      {fill && <path d={areaPath} fill={color} opacity={0.12} />}
      <polyline fill="none" stroke={color} strokeWidth={2} points={line} strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />)}
      {data.map((d, i) => (
        <text key={i} x={points[i].x} y={h + 16} textAnchor="middle" fontSize={9} fill="#9ca3af">{String(d[labelKey] || '').slice(-5)}</text>
      ))}
    </svg></div>
  )
}

function PieDonut({ segments, donut = false, size = 'md', onSegmentClick }: {
  segments: { label: string; value: number; color: string }[]
  donut?: boolean; size?: 'sm' | 'md' | 'lg'
  onSegmentClick?: (label: string) => void
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const dim = size === 'sm' ? 130 : size === 'lg' ? 230 : 170
  const cx = dim / 2; const cy = dim / 2; const r = dim * 0.375

  if (donut) {
    const stroke = size === 'lg' ? 34 : 24
    const circumference = 2 * Math.PI * r; let offset = 0
    // midpoint angle for callout labels
    const midAngles: number[] = []
    let running = 0
    segments.forEach(seg => {
      const pct = seg.value / total
      midAngles.push(running + pct / 2)
      running += pct
    })
    return (
      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative shrink-0" style={{ width: dim, height: dim }}>
          <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
            {segments.map((seg, i) => {
              const pct = seg.value / total; const dash = pct * circumference; const space = circumference - dash
              const so = -circumference * offset; offset += pct
              return (
                <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={stroke}
                  strokeDasharray={`${dash} ${space}`} strokeDashoffset={so}
                  style={{ transformOrigin: `${cx}px ${cy}px`, transform: 'rotate(-90deg)', cursor: onSegmentClick ? 'pointer' : 'default' }}
                  onClick={() => onSegmentClick?.(seg.label)}
                />
              )
            })}
            {/* Callout labels for slices >= 8% */}
            {segments.map((seg, i) => {
              const pct = seg.value / total
              if (pct < 0.08) return null
              const angle = midAngles[i] * 2 * Math.PI - Math.PI / 2
              const lx = cx + (r + stroke * 0.5 + 2) * Math.cos(angle)
              const ly = cy + (r + stroke * 0.5 + 2) * Math.sin(angle)
              return (
                <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                  fontSize={size === 'lg' ? 11 : 9} fontWeight="700" fill="#fff" pointerEvents="none">
                  {Math.round(pct * 100)}%
                </text>
              )
            })}
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size === 'lg' ? 18 : 14} fontWeight="bold" fill="#111827">{total}</text>
            <text x={cx} y={cy + (size === 'lg' ? 14 : 10)} textAnchor="middle" fontSize={size === 'lg' ? 12 : 10} fill="#6b7280">total</text>
          </svg>
        </div>
        <Legend segments={segments} total={total} onSegmentClick={onSegmentClick} />
      </div>
    )
  }
  // Solid pie with mid-point callout labels
  let cumulativeAngle = -Math.PI / 2
  const slices: { d: string; color: string; label: string; pct: number; midAngle: number }[] = []
  segments.forEach(seg => {
    const pct = seg.value / total; const angle = pct * 2 * Math.PI
    const x1 = cx + r * Math.cos(cumulativeAngle); const y1 = cy + r * Math.sin(cumulativeAngle)
    const midAngle = cumulativeAngle + angle / 2
    cumulativeAngle += angle
    const x2 = cx + r * Math.cos(cumulativeAngle); const y2 = cy + r * Math.sin(cumulativeAngle)
    const large = angle > Math.PI ? 1 : 0
    slices.push({ d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`, color: seg.color, label: seg.label, pct, midAngle })
  })
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="shrink-0">
        {slices.map((sl, i) => (
          <path key={i} d={sl.d} fill={sl.color} opacity={0.88}
            style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
            onClick={() => onSegmentClick?.(sl.label)}
          />
        ))}
        {/* Percentage labels inside slices >= 8% */}
        {slices.map((sl, i) => {
          if (sl.pct < 0.08) return null
          const lx = cx + r * 0.62 * Math.cos(sl.midAngle)
          const ly = cy + r * 0.62 * Math.sin(sl.midAngle)
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fontSize={size === 'lg' ? 12 : 10} fontWeight="700" fill="#fff" pointerEvents="none">
              {Math.round(sl.pct * 100)}%
            </text>
          )
        })}
      </svg>
      <Legend segments={segments} total={total} onSegmentClick={onSegmentClick} />
    </div>
  )
}

function Legend({ segments, total, onSegmentClick }: {
  segments: { label: string; value: number; color: string }[]
  total: number
  onSegmentClick?: (label: string) => void
}) {
  return (
    <div className="space-y-1.5 flex-1 min-w-0">
      {segments.map((seg, i) => {
        const pct = Math.round((seg.value / total) * 100)
        return (
        <div key={i}
          className={`group rounded-xl px-2.5 py-1.5 -mx-1 transition-colors ${onSegmentClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
          onClick={() => onSegmentClick?.(seg.label)}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-gray-600 capitalize flex-1 text-xs font-medium">{seg.label}</span>
            <span className="font-semibold text-gray-900 tabular-nums text-xs">{seg.value}</span>
            <span className="text-xs font-medium w-8 text-right" style={{ color: seg.color }}>{pct}%</span>
          </div>
          {/* Mini proportion bar */}
          <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: seg.color, opacity: 0.7 }} />
          </div>
        </div>
        )
      }
      )}
    </div>
  )
}

function HBarChart({ segments, max }: { segments: { label: string; value: number; color: string }[]; max: number }) {
  return (
    <div className="space-y-3">
      {segments.map((seg, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-sm capitalize text-gray-700 w-24 truncate">{seg.label}</span>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex-1">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (seg.value / max) * 100)}%`, background: seg.color }} />
          </div>
          <span className="text-sm font-semibold text-gray-900 tabular-nums w-10 text-right">{seg.value}</span>
        </div>
      ))}
    </div>
  )
}

function renderChart(
  type: ChartType, data: Record<string, any>[], valueKey: string, labelKey: string,
  color: string, height: number,
  onSegmentClick?: (label: string) => void,
  chartSize: 'sm' | 'md' | 'lg' = 'md',
) {
  const segments = data.map((d, i) => ({ label: String(d[labelKey] || ''), value: d[valueKey] || 0, color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length] }))
  const max = Math.max(1, ...data.map(d => d[valueKey] || 0))
  switch (type) {
    case 'bar':   return <BarChart data={data} valueKey={valueKey} labelKey={labelKey} color={color} height={height} />
    case 'line':  return <LineChart data={data} valueKey={valueKey} labelKey={labelKey} color={color} height={height} />
    case 'area':  return <LineChart data={data} valueKey={valueKey} labelKey={labelKey} color={color} height={height} fill />
    case 'pie':   return <PieDonut segments={segments.slice(0, 12)} size={chartSize} onSegmentClick={onSegmentClick} />
    case 'donut': return <PieDonut segments={segments.slice(0, 12)} donut size={chartSize} onSegmentClick={onSegmentClick} />
    case 'hbar':  return <HBarChart segments={segments} max={max} />
    default:      return <BarChart data={data} valueKey={valueKey} labelKey={labelKey} color={color} height={height} />
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REUSABLE UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({ label, value, sub, icon: Icon, bg, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; bg: string; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}><Icon className={`w-5 h-5 ${color}`} /></div>
      </div>
    </div>
  )
}

function Section({ title, action, children, viewReport, onViewReport }: {
  title: string; action?: React.ReactNode; children: React.ReactNode
  viewReport?: string; onViewReport?: (id: ReportId) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <div className="flex items-center gap-2">
          {action}
          {viewReport && onViewReport && (
            <button
              onClick={() => onViewReport(viewReport as ReportId)}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
            >
              <ArrowUpRight className="w-3 h-3" /> View Report
            </button>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function ChartTypePicker({ value, onChange, allowed }: { value: ChartType; onChange: (t: ChartType) => void; allowed?: ChartType[] }) {
  const list = allowed ? CHART_TYPES.filter(c => allowed.includes(c.type)) : CHART_TYPES
  return (
    <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-lg">
      {list.map(c => (
        <button key={c.type} onClick={() => onChange(c.type)} title={c.label}
          className={`p-1.5 rounded-md transition-all ${value === c.type ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          <c.icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  )
}

function SortHeader({ label, sortKey, activeSortKey, sortDir, onSort }: {
  label: string; sortKey: string; activeSortKey: string; sortDir: SortDir
  onSort: (key: string) => void
}) {
  const active = activeSortKey === sortKey
  return (
    <th className="py-2 pr-4 cursor-pointer select-none hover:text-gray-700 transition-colors" onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </span>
    </th>
  )
}

function ReportToolbar({ search, onSearch, filterLabel, filterValue, filterOptions, onFilter, placeholder }: {
  search: string; onSearch: (s: string) => void
  filterLabel?: string; filterValue?: string; filterOptions?: { value: string; label: string }[]
  onFilter?: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px] max-w-sm">
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder={placeholder || 'Search…'}
          className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400" />
        {search && <button type="button" aria-label="Close" onClick={() => onSearch('')}>
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>}
      </div>
      {filterOptions && filterOptions.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select value={filterValue || 'all'} onChange={e => onFilter?.(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="all">{filterLabel || 'All'}</option>
            {filterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReportsPage() {
  const navigate   = useNavigate()
  const reportRef  = useRef<HTMLDivElement>(null)
  const qc         = useQueryClient()
  const { vendor, selectedStore } = useVendorStore()

  // ── Store filter ──────────────────────────────────────────────────────
  const [selectedStoreId, setSelectedStoreId] = useState<string>(selectedStore?.id ?? 'all')

  // Sync with global store selection
  useEffect(() => {
    setSelectedStoreId(selectedStore?.id ?? 'all')
  }, [selectedStore?.id])
  const { data: storesData } = useStores()
  const reportStores: { id: string; name: string; code?: string }[] = storesData?.stores ?? []

  // ── Report selector state ──────────────────────────────────────────────
  const [activeReport, setActiveReport]   = useState<ReportId>('sales_overview')
  const [dateRange,    setDateRange]      = useState<DateRange>('30d')
  const [customFrom,   setCustomFrom]     = useState('')
  const [customTo,     setCustomTo]       = useState('')
  const [selectorOpen, setSelectorOpen]   = useState(false)
  const [selectorSearch, setSelectorSearch] = useState('')
  const [waOpen,       setWaOpen]         = useState(false)

  // ── Chart type state ───────────────────────────────────────────────────
  const [salesChart,   setSalesChart]     = useState<ChartType>('bar')
  const [statusChart,  setStatusChart]    = useState<ChartType>('donut')
  const [posChart,     setPosChart]       = useState<ChartType>('hbar')
  const [bookingsChart,setBookingsChart]  = useState<ChartType>('donut')

  // ── MRP state ──────────────────────────────────────────────────────────
  const [mrpSelected,      setMrpSelected]      = useState<Set<string>>(new Set())
  const [mrpStatusFilter,  setMrpStatusFilter]  = useState<'all' | 'shortage' | 'sufficient'>('all')
  const [mrpActionFilter,  setMrpActionFilter]  = useState<'all' | 'buy' | 'produce' | 'sufficient'>('all')
  const [mrpSearch,        setMrpSearch]        = useState('')
  const [mrpSortKey,       setMrpSortKey]       = useState('gap')
  const [mrpSortDir,       setMrpSortDir]       = useState<SortDir>('desc')
  const [mrpOrderFilter,   setMrpOrderFilter]   = useState('')
  const [mrpOptCols,       setMrpOptCols]       = useState<Set<string>>(new Set(['unit_price']))
  const [mrpColsOpen,      setMrpColsOpen]      = useState(false)
  const [mrpShareOpen,     setMrpShareOpen]      = useState(false)
  const [mrpDetailRow,     setMrpDetailRow]     = useState<string | null>(null)

  // PO modal state
  const [poModal,          setPoModal]          = useState(false)
  const [poSupplier,       setPoSupplier]       = useState('')
  const [poSupplierOpen,   setPoSupplierOpen]   = useState(false)
  const [savedSuppliers,   setSavedSuppliers]   = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mrp_suppliers') || '[]') } catch { return [] }
  })
  const [poDelivery,       setPoDelivery]       = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10)
  })
  const [poRef,            setPoRef]            = useState(() => `PO-${Date.now().toString().slice(-6)}`)
  const [poPaymentTerms,   setPoPaymentTerms]   = useState('Net 30')
  const [poNotes,          setPoNotes]          = useState('')

  // Production order modal state
  const [prodModal,        setProdModal]        = useState(false)
  const [prodTab,          setProdTab]          = useState<'new' | 'history'>('new')
  const [prodTemplate,     setProdTemplate]     = useState('standard')
  const [prodTeam,         setProdTeam]         = useState('')
  const [prodTarget,       setProdTarget]       = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10)
  })
  const [prodStatus,       setProdStatus]       = useState<'draft' | 'in_progress' | 'completed' | 'on_hold'>('draft')
  const [prodProgress,     setProdProgress]     = useState(0)
  const [prodNotes,        setProdNotes]        = useState('')
  const [prodRef,          setProdRef]          = useState(() => `WO-${Date.now().toString().slice(-6)}`)
  const [prodAttachments,  setProdAttachments]  = useState<ProdAttachment[]>([])
  const [prodAttachLightboxIndex, setProdAttachLightboxIndex] = useState<number | null>(null)
  const prodImageAttachments = useMemo(
    () => prodAttachments.filter((a) => a.type.startsWith('image/')),
    [prodAttachments],
  )
  const prodLightboxItems = useMemo(
    () => urlsToLightboxItems(
      prodImageAttachments.map((a) => a.dataUrl),
      { idPrefix: 'prod-report', altText: (i) => prodImageAttachments[i]?.name ?? `Attachment ${i + 1}` },
    ),
    [prodImageAttachments],
  )
  const [stockDispatches,  setStockDispatches]  = useState<StockDispatch[]>([])
  const [dispatchQty,      setDispatchQty]      = useState('')
  const [dispatchNotes,    setDispatchNotes]    = useState('')
  const [dispatchBy,       setDispatchBy]       = useState('')
  const [prodHistory,      setProdHistory]      = useState<ProdHistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('mrp_prod_history') || '[]') } catch { return [] }
  })
  const [viewHistoryEntry, setViewHistoryEntry] = useState<ProdHistoryEntry | null>(null)

  useEscapeToClose(() => setProdModal(false), prodModal)
  useEscapeToClose(() => setPoModal(false), poModal)
  useEscapeToClose(() => setPoSupplierOpen(false), poSupplierOpen)
  useEscapeToClose(() => setMrpShareOpen(false), mrpShareOpen)
  useEscapeToClose(() => setMrpColsOpen(false), mrpColsOpen)
  useEscapeToClose(() => setSelectorOpen(false), selectorOpen)
  useEscapeToClose(() => setWaOpen(false), waOpen)

  // ── Search / filter / sort state ───────────────────────────────────────
  const [search,       setSearch]         = useState('')
  const [filterVal,    setFilterVal]      = useState('all')
  const [sortKey,      setSortKey]        = useState('')
  const [sortDir,      setSortDir]        = useState<SortDir>('desc')

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function resetToolbar() { setSearch(''); setFilterVal('all'); setSortKey(''); setSortDir('desc') }

  // ── Compute days from date range ───────────────────────────────────────
  const days = useMemo(() => {
    if (dateRange === 'custom' && customFrom && customTo) {
      const diff = Math.ceil((new Date(customTo).getTime() - new Date(customFrom).getTime()) / 86400000)
      return Math.max(1, diff)
    }
    return DATE_RANGES.find(r => r.value === dateRange)?.days ?? 30
  }, [dateRange, customFrom, customTo])

  const def = REPORTS.find(r => r.id === activeReport)!

  // ── Data queries ───────────────────────────────────────────────────────
  const { data: dashboard, isLoading: dashLoading } = useQuery({ queryKey: ['reports', 'dashboard'], queryFn: vendorApi.getDashboardStats })
  const { data: revenue }        = useQuery({ queryKey: ['reports', 'revenue'], queryFn: vendorApi.getRevenueSummary })
  const { data: salesByDay, isLoading: salesLoading } = useQuery({ queryKey: ['reports', 'sales-by-day', days], queryFn: () => vendorApi.getSalesByDay(days) })
  const { data: topProducts }    = useQuery({ queryKey: ['reports', 'top-products'], queryFn: () => vendorApi.getTopProducts(20) })
  const { data: topCustomers }   = useQuery({ queryKey: ['reports', 'top-customers'], queryFn: () => vendorApi.getTopCustomers(20) })
  const { data: ordersByStatus } = useQuery({ queryKey: ['reports', 'orders-by-status'], queryFn: vendorApi.getOrdersByStatus })
  const { data: posOrdersData }  = useQuery({ queryKey: ['reports', 'pos-orders'], queryFn: () => vendorApi.listOrders({ source: 'pos', size: 200 }) })
  const { data: allOrdersData }  = useQuery({ queryKey: ['reports', 'all-orders'], queryFn: () => vendorApi.listOrders({ size: 200 }) })
  const { data: bookingsData }   = useQuery({ queryKey: ['reports', 'bookings'], queryFn: () => vendorApi.listBookings({ size: 200 }) })
  const { data: couponsData }    = useQuery({ queryKey: ['reports', 'coupons'], queryFn: () => vendorApi.listCoupons({ size: 200 }) })
  const { data: reviewsData }    = useReviews({ page: 1, size: 50 })
  const { data: productsData }   = useProducts({ page: 1, size: 200 })
  const { data: statsData }      = useOrderStats()

  // WhatsApp preferences
  const { data: waPrefs } = useQuery<any>({
    queryKey: ['notification-preferences'],
    queryFn: async () => (await apiClient.get('/vendors/me/notifications/preferences')).data,
    staleTime: 60_000,
  })
  const saveWaPrefs = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const merged = { ...waPrefs, ...patch }
      await apiClient.put('/vendors/me/notifications/preferences', merged)
      return merged
    },
    onSuccess: (d) => { qc.setQueryData(['notification-preferences'], d); toast.success('Saved') },
    onError: () => toast.error('Failed to save'),
  })

  // ── Derived data ───────────────────────────────────────────────────────
  const salesRows   = useMemo(() => (salesByDay?.data || []) as SalesDayRow[], [salesByDay])
  const productRows = useMemo(() => (topProducts?.items || []) as any[], [topProducts])
  const customerRows= useMemo(() => (topCustomers?.items || []) as any[], [topCustomers])
  const posOrders   = useMemo(() => (posOrdersData?.items || []) as any[], [posOrdersData])
  const allOrders   = useMemo(() => (allOrdersData?.items || []) as any[], [allOrdersData])
  const bookings    = useMemo(() => ((bookingsData as any)?.items || (bookingsData as any)?.data || []) as any[], [bookingsData])
  const coupons     = useMemo(() => ((couponsData as any)?.items || (couponsData as any)?.data || []) as any[], [couponsData])
  const reviews     = useMemo(() => (reviewsData?.items || []) as any[], [reviewsData])
  const allProducts = useMemo(() => (productsData?.items || []) as any[], [productsData])

  const statusSegments = useMemo(() => {
    const raw = ordersByStatus?.data as Record<string, number> | undefined
    if (!raw) return []
    return Object.entries(raw).map(([label, value], i) => ({
      label, value, color: STATUS_COLORS[label]?.hex || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
    }))
  }, [ordersByStatus])
  const statusTotal = useMemo(() => statusSegments.reduce((s, x) => s + x.value, 0), [statusSegments])

  const posStats = useMemo(() => {
    const count = posOrders.length; const rev = posOrders.reduce((s: number, o: any) => s + (o.total || 0), 0)
    const byMethod: Record<string, number> = {}
    posOrders.forEach((o: any) => { byMethod[o.payment_method || 'unknown'] = (byMethod[o.payment_method || 'unknown'] || 0) + 1 })
    return { count, rev, avg: count ? rev / count : 0, byMethod }
  }, [posOrders])

  const bookingStats = useMemo(() => {
    const byStatus: Record<string, number> = {}
    bookings.forEach((b: any) => { byStatus[b.status || 'unknown'] = (byStatus[b.status || 'unknown'] || 0) + 1 })
    return { count: bookings.length, byStatus }
  }, [bookings])

  const invoiceStats = useMemo(() => {
    const paid = allOrders.filter((o: any) => o.status === 'delivered' || o.status === 'completed')
    const paidTotal = paid.reduce((s: number, o: any) => s + (o.total || 0), 0)
    const unpaid = allOrders.filter((o: any) => o.status === 'pending' || o.status === 'confirmed')
    const unpaidTotal = unpaid.reduce((s: number, o: any) => s + (o.total || 0), 0)
    return { paidCount: paid.length, paidTotal, unpaidCount: unpaid.length, unpaidTotal, total: allOrders.length }
  }, [allOrders])

  const couponStats = useMemo(() => {
    const active = coupons.filter((c: any) => c.is_active || c.active)
    const totalDiscount = coupons.reduce((s: number, c: any) => s + (c.discount_value || c.discount || 0), 0)
    return { total: coupons.length, active: active.length, totalDiscount }
  }, [coupons])

  // Inventory summary with store filter for the reports page
  const { data: invSummaryData } = useQuery({
    queryKey: ['reports', 'inventory-summary', selectedStoreId],
    queryFn: () => vendorApi.inventorySummary(selectedStoreId !== 'all' ? { store_id: selectedStoreId } : {}),
    staleTime: 30_000,
  })
  const invSummaryItems = useMemo(() => (invSummaryData?.items || []) as any[], [invSummaryData])

  const inventoryStats = useMemo(() => {
    // Use inventory summary data when available (has per-store info), fallback to products
    if (invSummaryItems.length > 0) {
      const total = invSummaryItems.reduce((s: number, p: any) => s + (p.current_quantity || 0), 0)
      const low = invSummaryItems.filter((p: any) => p.is_low_stock)
      const outOfStock = invSummaryItems.filter((p: any) => (p.current_quantity || 0) === 0)
      const valuation = invSummaryItems.reduce((s: number, p: any) => {
        // Try store-specific qty if filtered
        const qty = p.current_quantity || 0
        const price = p.price || p.selling_price || 0
        return s + price * qty
      }, 0)
      return { totalStock: total, lowCount: low.length, outCount: outOfStock.length, valuation, items: invSummaryItems }
    }
    const total = allProducts.reduce((s: number, p: any) => s + (p.stock || 0), 0)
    const low = allProducts.filter((p: any) => (p.stock || 0) < 10 && (p.stock || 0) > 0)
    const outOfStock = allProducts.filter((p: any) => (p.stock || 0) === 0)
    const valuation = allProducts.reduce((s: number, p: any) => s + (p.price || 0) * (p.stock || 0), 0)
    return { totalStock: total, lowCount: low.length, outCount: outOfStock.length, valuation, items: allProducts }
  }, [invSummaryItems, allProducts, selectedStoreId])

  const reviewStats = useMemo(() => {
    if (!reviews.length) return { avg: 0, total: 0, dist: {} as Record<number, number> }
    const avg = reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length
    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    reviews.forEach((r: any) => { dist[r.rating || 1] = (dist[r.rating || 1] || 0) + 1 })
    return { avg, total: reviews.length, dist }
  }, [reviews])

  const maxSpent = useMemo(() => Math.max(1, ...customerRows.map((c: any) => c.spent || 0)), [customerRows])
  const maxStock = useMemo(() => Math.max(1, ...productRows.map((p: any) => p.stock || 0)), [productRows])

  // ── MRP computation ────────────────────────────────────────────────────
  const mrpData = useMemo<MRPItem[]>(() => {
    const openOrders = allOrders.filter((o: any) =>
      ['pending', 'confirmed', 'processing', 'accepted'].includes(o.status),
    )
    // Try to build demand from order line items
    const demand: Record<string, { qty: number; orders: string[]; price: number }> = {}
    openOrders.forEach((o: any) => {
      const items: any[] = o.items || o.order_items || o.line_items || []
      items.forEach((item: any) => {
        const pid = String(item.product_id || item.product?.id || item.id || '')
        const qty = Number(item.quantity || item.qty || 1)
        const price = Number(item.unit_price || item.price || item.product?.price || 0)
        if (!pid) return
        if (!demand[pid]) demand[pid] = { qty: 0, orders: [], price }
        demand[pid].qty += qty
        const ref = o.order_number || o.id || ''
        if (ref && !demand[pid].orders.includes(ref)) demand[pid].orders.push(ref)
      })
    })

    const hasItemData = Object.keys(demand).length > 0

    if (hasItemData) {
      return Object.entries(demand).map(([pid, d]) => {
        const product = allProducts.find((p: any) => String(p.id) === pid)
        const available = Number(product?.stock ?? 0)
        const gap = d.qty - available
        return {
          product_id: pid,
          name: product?.name || `Product ${pid}`,
          sku: product?.sku || product?.barcode || `SKU-${pid.slice(-6)}`,
          category: product?.category_name || product?.category || 'Uncategorised',
          unit_price: d.price || Number(product?.price ?? 0),
          available_stock: available,
          required_qty: d.qty,
          gap,
          order_refs: d.orders,
          suggested_action: gap > 0 ? 'buy' : 'sufficient',
        } as MRPItem
      })
    }

    // Fallback: stock-level based plan (no order-item data available)
    const openCount = openOrders.length || 1
    return allProducts.map((p: any) => {
      // Estimate demand: each product may appear in ~30% of open orders
      const required = Math.max(1, Math.round(openCount * 0.3))
      const available = Number(p.stock ?? 0)
      const gap = required - available
      return {
        product_id: String(p.id),
        name: p.name,
        sku: p.sku || p.barcode || `SKU-${String(p.id).slice(-6)}`,
        category: p.category_name || p.category || 'Uncategorised',
        unit_price: Number(p.price ?? 0),
        available_stock: available,
        required_qty: required,
        gap,
        order_refs: openOrders.slice(0, 3).map((o: any) => o.order_number || o.id || ''),
        suggested_action: gap > 0 ? 'buy' : 'sufficient',
      } as MRPItem
    })
  }, [allOrders, allProducts])

  // All unique order refs across MRP data
  const mrpOrderRefs = useMemo(() => {
    const refs = new Set<string>()
    mrpData.forEach(r => r.order_refs.forEach(o => { if (o) refs.add(o) }))
    return Array.from(refs).sort()
  }, [mrpData])

  const mrpFiltered = useMemo(() => {
    let rows = mrpData
    if (mrpStatusFilter === 'shortage')   rows = rows.filter(r => r.gap > 0)
    if (mrpStatusFilter === 'sufficient') rows = rows.filter(r => r.gap <= 0)
    if (mrpActionFilter !== 'all') rows = rows.filter(r => r.suggested_action === mrpActionFilter)
    if (mrpOrderFilter) rows = rows.filter(r => r.order_refs.includes(mrpOrderFilter))
    if (mrpSearch.trim()) {
      const q = mrpSearch.toLowerCase()
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) || r.order_refs.some(o => o.toLowerCase().includes(q)),
      )
    }
    return sortData(rows, mrpSortKey || 'gap', mrpSortDir)
  }, [mrpData, mrpStatusFilter, mrpActionFilter, mrpSearch, mrpOrderFilter, mrpSortKey, mrpSortDir])

  const mrpSummary = useMemo(() => {
    const shortages  = mrpData.filter(r => r.gap > 0)
    const totalShort = shortages.reduce((s, r) => s + r.gap, 0)
    const buyValue   = shortages.reduce((s, r) => s + Math.max(0, r.gap) * r.unit_price, 0)
    return {
      total:     mrpData.length,
      shortages: shortages.length,
      sufficient: mrpData.filter(r => r.gap <= 0).length,
      totalShort,
      buyValue,
      openOrders: allOrders.filter((o: any) => ['pending','confirmed','processing','accepted'].includes(o.status)).length,
    }
  }, [mrpData, allOrders])

  const selectedMRPItems = useMemo(
    () => mrpFiltered.filter(r => mrpSelected.has(r.product_id)),
    [mrpFiltered, mrpSelected],
  )
  const poLines: POLine[] = selectedMRPItems.filter(r => r.suggested_action === 'buy' || r.gap > 0).map(r => ({
    product_id: r.product_id, name: r.name, qty: Math.max(0, r.gap), unit_price: r.unit_price,
  }))
  const prodLines: ProductionLine[] = selectedMRPItems.filter(r => r.gap > 0).map(r => ({
    product_id: r.product_id, name: r.name, qty: Math.max(0, r.gap),
  }))

  function mrpSort(key: string) {
    if (mrpSortKey === key) setMrpSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setMrpSortKey(key); setMrpSortDir('desc') }
  }

  function toggleMrpRow(id: string) {
    setMrpSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllMrp() {
    if (mrpSelected.size === mrpFiltered.length) setMrpSelected(new Set())
    else setMrpSelected(new Set(mrpFiltered.map(r => r.product_id)))
  }

  const mrpHeaders = ['Product', 'SKU', 'Category', 'Required Qty', 'Available Stock', 'Gap/Surplus', 'Unit Price', 'Est. Shortage Value', 'Suggested Action', 'Order Refs']
  const mrpRows = () => mrpFiltered.map(r => [r.name, r.sku, r.category, r.required_qty, r.available_stock,
    r.gap, r.unit_price, Math.max(0, r.gap) * r.unit_price, r.suggested_action, r.order_refs.join(', ')])

  function exportMrpCSV() {
    exportCSV('mrp-report.csv', mrpHeaders, mrpRows()); toast.success('MRP CSV downloaded.')
  }

  function exportMrpXLS() {
    exportXLS('mrp-report.xls', mrpHeaders, mrpRows()); toast.success('MRP Excel downloaded.')
  }

  async function exportMrpPDF() {
    if (!reportRef.current) return
    await exportPDF(reportRef.current, 'mrp-report.pdf')
  }

  function shareMrpWhatsApp() {
    const lines = [
      `📋 *MRP Report — ${vendor?.display_name || 'Store'}*`,
      `📅 ${new Date().toLocaleDateString('en-IN')}`,
      ``,
      `📊 *Summary*`,
      `• Open Orders: ${mrpSummary.openOrders}`,
      `• Materials Tracked: ${mrpSummary.total}`,
      `• ⚠ Shortages: ${mrpSummary.shortages}`,
      `• ✅ Sufficient: ${mrpSummary.sufficient}`,
      `• Est. Procurement Value: ${formatCurrency(mrpSummary.buyValue)}`,
      ``,
      `🔴 *Top Shortages:*`,
      ...mrpFiltered.filter(r => r.gap > 0).slice(0, 5).map(r => `• ${r.name}: need ${r.gap} more (have ${r.available_stock})`),
      ``,
      `_Sent via KITERP_`,
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  function shareMrpEmail() {
    const subject = encodeURIComponent(`MRP Report — ${vendor?.display_name || 'Store'} — ${new Date().toLocaleDateString('en-IN')}`)
    const body = encodeURIComponent([
      `MRP Report Summary`,
      `Date: ${new Date().toLocaleDateString('en-IN')}`,
      ``,
      `Open Orders: ${mrpSummary.openOrders}`,
      `Materials Tracked: ${mrpSummary.total}`,
      `Shortages: ${mrpSummary.shortages}`,
      `Sufficient: ${mrpSummary.sufficient}`,
      `Est. Procurement Value: ${formatCurrency(mrpSummary.buyValue)}`,
      ``,
      `Top Shortages:`,
      ...mrpFiltered.filter(r => r.gap > 0).slice(0, 10).map(r => `  - ${r.name} (${r.sku}): Need ${r.gap}, Have ${r.available_stock}`),
    ].join('\n'))
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  function printMrpReport() { window.print() }

  function shareMrpNative() {
    if (navigator.share) {
      navigator.share({
        title: `MRP Report — ${vendor?.display_name}`,
        text: `Shortages: ${mrpSummary.shortages} | Procurement Value: ${formatCurrency(mrpSummary.buyValue)}`,
      }).catch(() => {})
    } else { toast.info('Native share not supported on this browser.') }
  }

  function saveSupplier(name: string) {
    if (!name.trim() || savedSuppliers.includes(name.trim())) return
    const next = [name.trim(), ...savedSuppliers].slice(0, 20)
    setSavedSuppliers(next)
    localStorage.setItem('mrp_suppliers', JSON.stringify(next))
  }

  function createPO() {
    if (!poLines.length) { toast.error('No shortage items selected.'); return }
    saveSupplier(poSupplier)
    exportXLS(`${poRef}-${new Date().toISOString().slice(0, 10)}.xls`,
      ['PO Ref', 'Supplier', 'Delivery Date', 'Payment Terms', 'Item', 'Qty', 'Unit Price (₹)', 'Line Total (₹)'],
      poLines.map(l => [poRef, poSupplier || '—', poDelivery, poPaymentTerms, l.name, l.qty, l.unit_price, l.qty * l.unit_price]),
    )
    exportCSV(`${poRef}.csv`,
      ['Item', 'Qty', 'Unit Price', 'Line Total'],
      poLines.map(l => [l.name, l.qty, formatCurrency(l.unit_price), formatCurrency(l.qty * l.unit_price)]),
    )
    toast.success(`PO ${poRef} created — ${poSupplier || 'Supplier TBD'} — ${poLines.length} items`)
    setPoModal(false); setMrpSelected(new Set())
    setPoRef(`PO-${Date.now().toString().slice(-6)}`)
  }

  function addStockDispatch() {
    if (!dispatchQty || Number(dispatchQty) <= 0) { toast.error('Enter a valid quantity.'); return }
    const entry: StockDispatch = {
      id: Date.now().toString(), date: new Date().toISOString().slice(0, 10),
      qty: Number(dispatchQty), notes: dispatchNotes, dispatchedBy: dispatchBy,
    }
    setStockDispatches(prev => [...prev, entry])
    setDispatchQty(''); setDispatchNotes(''); setDispatchBy('')
    toast.success(`${entry.qty} units dispatched to stock.`)
  }

  function handleProdAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        setProdAttachments(prev => [...prev, {
          name: file.name, dataUrl: ev.target?.result as string, type: file.type, size: file.size,
        }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function saveProdHistoryEntry() {
    if (!prodLines.length) { toast.error('No items selected for production.'); return }
    const entry: ProdHistoryEntry = {
      id: Date.now().toString(), orderNo: prodRef,
      template: PROD_TEMPLATES.find(t => t.id === prodTemplate)?.label || prodTemplate,
      items: prodLines, team: prodTeam, targetDate: prodTarget,
      status: prodStatus, progress: prodProgress, notes: prodNotes,
      createdAt: new Date().toISOString(), attachments: prodAttachments, stockDispatches,
    }
    const next = [entry, ...prodHistory]
    setProdHistory(next)
    localStorage.setItem('mrp_prod_history', JSON.stringify(next))
    exportXLS(`${prodRef}-production-order.xls`,
      ['Work Order', 'Template', 'Item', 'Qty to Produce', 'Team', 'Target Date', 'Status', 'Progress'],
      prodLines.map(l => [prodRef, entry.template, l.name, l.qty, prodTeam, prodTarget, prodStatus, `${prodProgress}%`]),
    )
    toast.success(`Work Order ${prodRef} saved — ${prodLines.length} items`)
    setProdModal(false); setMrpSelected(new Set())
    setStockDispatches([]); setProdAttachments([])
    setProdRef(`WO-${Date.now().toString().slice(-6)}`)
    setProdProgress(0); setProdStatus('draft')
  }

  function deleteProdHistory(id: string) {
    const next = prodHistory.filter(h => h.id !== id)
    setProdHistory(next)
    localStorage.setItem('mrp_prod_history', JSON.stringify(next))
  }

  const filteredReports = REPORTS.filter(r =>
    r.label.toLowerCase().includes(selectorSearch.toLowerCase()) ||
    r.description.toLowerCase().includes(selectorSearch.toLowerCase()),
  )

  // ── WhatsApp per-contact helpers ──────────────────────────────────────
  const rawContacts: WaContact[] = waPrefs?.report_wa_contacts || []
  const [newNumber, setNewNumber]   = useState('')
  const [newLabel,  setNewLabel]    = useState('')
  const [expandedContact, setExpandedContact] = useState<string | null>(null)
  const [chartSize, setChartSize] = useState<'sm' | 'md' | 'lg'>('md')

  function saveContacts(contacts: WaContact[]) {
    saveWaPrefs.mutate({ report_wa_contacts: contacts })
  }

  function addContact() {
    const n = newNumber.trim().replace(/\s/g, '')
    if (!n) return
    const contact: WaContact = {
      id: Date.now().toString(),
      number: n,
      label: newLabel.trim() || 'Contact',
      enabled: true,
      reports: ['sales_overview', 'revenue_summary'],
      smart_triggers: ['daily_revenue', 'new_order'],
      frequency: 'daily',
      time: '09:00',
      interval_hours: undefined,
      day_of_week: 'mon',
    }
    saveContacts([...rawContacts, contact])
    setNewNumber(''); setNewLabel('')
    setExpandedContact(contact.id)
  }

  function removeContact(id: string) {
    saveContacts(rawContacts.filter(c => c.id !== id))
  }

  function updateContact(id: string, patch: Partial<WaContact>) {
    saveContacts(rawContacts.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function toggleContactReport(contactId: string, reportId: string) {
    const c = rawContacts.find(x => x.id === contactId)!
    const next = c.reports.includes(reportId) ? c.reports.filter(r => r !== reportId) : [...c.reports, reportId]
    updateContact(contactId, { reports: next })
  }

  function toggleContactTrigger(contactId: string, triggerId: string) {
    const c = rawContacts.find(x => x.id === contactId)!
    const next = c.smart_triggers.includes(triggerId) ? c.smart_triggers.filter(t => t !== triggerId) : [...c.smart_triggers, triggerId]
    updateContact(contactId, { smart_triggers: next })
  }

  function buildReportText(contact: WaContact): string {
    let lines: string[] = [`📊 *Report Summary for ${vendor?.display_name || 'Your Store'}*`]
    if (contact.reports.includes('sales_overview'))
      lines.push(`\n💰 *Sales*\nRevenue: ${formatCurrency(dashboard?.total_revenue ?? 0)} | Orders: ${dashboard?.total_orders ?? 0}\nToday: ${formatCurrency(dashboard?.today_revenue ?? 0)}`)
    if (contact.reports.includes('revenue_summary') && revenue)
      lines.push(`\n📈 *Revenue*\nToday: ${formatCurrency(revenue.today ?? 0)} | Week: ${formatCurrency(revenue.this_week ?? 0)}\nMonth: ${formatCurrency(revenue.this_month ?? 0)}`)
    if (contact.reports.includes('orders_status') && statusSegments.length)
      lines.push(`\n📦 *Orders by Status*\n${statusSegments.map(s => `${s.label}: ${s.value}`).join(' | ')}`)
    if (contact.reports.includes('pos_report'))
      lines.push(`\n🏪 *POS*\nSales: ${posStats.count} | Revenue: ${formatCurrency(posStats.rev)} | Avg: ${formatCurrency(posStats.avg)}`)
    if (contact.reports.includes('inventory_report'))
      lines.push(`\n📦 *Inventory*\nTotal Stock: ${inventoryStats.totalStock} | Low Stock: ${inventoryStats.lowCount} | Out: ${inventoryStats.outCount}`)
    if (contact.smart_triggers.includes('daily_revenue'))
      lines.push(`\n🔔 Today's Revenue: ${formatCurrency(dashboard?.today_revenue ?? 0)}`)
    if (contact.smart_triggers.includes('pending_orders'))
      lines.push(`\n⏳ Pending Orders: ${statusSegments.find(s => s.label === 'pending')?.value ?? 0}`)
    if (contact.smart_triggers.includes('low_stock'))
      lines.push(`\n⚠️ Low Stock Items: ${inventoryStats.lowCount}`)
    lines.push(`\n_Sent via KITERP at ${new Date().toLocaleString('en-IN')}_`)
    return lines.join('\n')
  }

  function sendToContact(contact: WaContact) {
    const text = buildReportText(contact)
    const clean = contact.number.replace(/[^\d+]/g, '')
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`, '_blank')
  }

  // ── CSV handler ────────────────────────────────────────────────────────
  function handleCSV() {
    switch (activeReport) {
      case 'sales_overview':
        exportCSV('sales-overview.csv', ['Date', 'Orders', 'Revenue'], salesRows.map(r => [r.date, r.orders, r.revenue])); break
      case 'revenue_summary':
        exportCSV('revenue-summary.csv', ['Period', 'Revenue'], [['Today', revenue?.today ?? 0], ['This Week', revenue?.this_week ?? 0], ['This Month', revenue?.this_month ?? 0], ['This FY', revenue?.this_fy ?? 0]]); break
      case 'orders_status':
        exportCSV('orders-by-status.csv', ['Status', 'Count', '%'], statusSegments.map(s => [s.label, s.value, `${Math.round((s.value / statusTotal) * 100)}%`])); break
      case 'top_products':
        exportCSV('top-products.csv', ['Rank', 'Product', 'Price', 'Stock'], productRows.map((p: any, i: number) => [i + 1, p.name, p.price, p.stock])); break
      case 'top_customers':
        exportCSV('top-customers.csv', ['Rank', 'Name', 'Email', 'Orders', 'Spent'], customerRows.map((c: any, i: number) => [i + 1, c.name, c.email, c.orders, c.spent])); break
      case 'pos_report':
        exportCSV('pos-sales.csv', ['Date', 'Order #', 'Customer', 'Total', 'Payment', 'Status'],
          posOrders.slice(0, 200).map((o: any) => [new Date(o.created_at).toLocaleDateString(), o.order_number, o.customer_name || 'Walk-in', o.total, o.payment_method || '', o.status])); break
      case 'bookings_report':
        exportCSV('bookings.csv', ['Booking #', 'Service', 'Customer', 'Date', 'Status'],
          bookings.map((b: any) => [b.booking_number || '', b.service_name || '', b.customer_name || '', b.booking_date || '', b.status || ''])); break
      case 'invoices_report':
        exportCSV('invoices.csv', ['Order #', 'Customer', 'Total', 'Status', 'Date'],
          allOrders.map((o: any) => [o.order_number, o.customer_name || '', o.total, o.status, new Date(o.created_at).toLocaleDateString()])); break
      case 'coupons_report':
        exportCSV('coupons.csv', ['Code', 'Type', 'Discount', 'Active', 'Uses'],
          coupons.map((c: any) => [c.code || '', c.discount_type || '', c.discount_value || c.discount || 0, c.is_active ? 'Yes' : 'No', c.usage_count || 0])); break
      case 'inventory_report':
        exportCSV('inventory.csv', ['Product', 'Stock', 'Price', 'Value'],
          allProducts.map((p: any) => [p.name, p.stock || 0, p.price || 0, (p.stock || 0) * (p.price || 0)])); break
      case 'reviews_report':
        exportCSV('reviews.csv', ['Customer', 'Rating', 'Comment', 'Date'],
          reviews.map((r: any) => [r.customer_name || '', r.rating, r.comment || '', r.created_at ? new Date(r.created_at).toLocaleDateString() : ''])); break
      case 'mrp_report':
        exportMrpCSV(); return
      default: toast.info('No export available.')
    }
    toast.success('CSV downloaded.')
  }

  async function handlePDF() { if (reportRef.current) await exportPDF(reportRef.current, `${activeReport}.pdf`) }

  const isLoading = dashLoading || salesLoading

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 max-w-7xl">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Reports & Insights</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Analyse Your Store Performance With Downloadable Reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCSV} className="gap-1.5 text-xs"><Download className="w-3.5 h-3.5" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={handlePDF} className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={() => setWaOpen(v => !v)} className="gap-1.5 text-xs text-green-700 border-green-200 hover:bg-green-50">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </Button>
        </div>
      </div>

      {/* ── Store filter ───────────────────────────────────────────── */}
      {reportStores.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Store:</span>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setSelectedStoreId('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${selectedStoreId === 'all' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary'}`}>
              All Stores
            </button>
            {reportStores.map(s => (
              <button key={s.id}
                onClick={() => setSelectedStoreId(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${selectedStoreId === s.id ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary'}`}>
                {s.name}{s.code ? ` · ${s.code}` : ''}
              </button>
            ))}
          </div>
          {selectedStoreId !== 'all' && (
            <span className="text-xs text-primary bg-primary/10 dark:bg-primary/20 px-2 py-1 rounded-lg font-medium">
              Showing data for: {reportStores.find(s => s.id === selectedStoreId)?.name}
            </span>
          )}
        </div>
      )}

      {/* ── Report selector + date range ──────────────────────── */}
      <div className="flex flex-wrap gap-3 items-start">
        {/* Selector dropdown */}
        <div className="relative">
          <button onClick={() => setSelectorOpen(v => !v)}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 hover:border-blue-400 hover:shadow-sm transition-all duration-150 min-w-[220px] max-h-[90vh] overflow-y-auto">
            <div className={`p-1 rounded-lg ${def.bg} shrink-0`}><def.icon className={`w-4 h-4 ${def.color}`} /></div>
            <span className="flex-1 text-left">{def.label}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
          </button>
          {selectorOpen && (
            <div className="absolute left-0 top-full mt-2 w-[380px] bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl z-50 overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="px-3 pt-3 pb-2 border-b">
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input value={selectorSearch} onChange={e => setSelectorSearch(e.target.value)} placeholder="Search reports…"
                    className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400" autoFocus />
                  {selectorSearch && <button type="button" aria-label="Close" onClick={() => setSelectorSearch('')}>
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>}
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
                {filteredReports.map(r => (
                  <button key={r.id} onClick={() => { setActiveReport(r.id); setSelectorOpen(false); setSelectorSearch(''); resetToolbar() }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${activeReport === r.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>
                    <div className={`p-1.5 rounded-lg shrink-0 ${r.bg}`}><r.icon className={`w-4 h-4 ${r.color}`} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{r.label}</p>
                      <p className="text-xs text-gray-500 truncate">{r.description}</p>
                    </div>
                    {activeReport === r.id && <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                ))}
                {filteredReports.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No reports match "{selectorSearch}"</p>}
              </div>
            </div>
          )}
          {selectorOpen && <div className="fixed inset-0 z-40" onClick={() => setSelectorOpen(false)} />}
        </div>

        {/* Date range pills + custom */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
          {DATE_RANGES.map(r => (
            <button key={r.value} onClick={() => { setDateRange(r.value); if (r.value !== 'custom') resetToolbar() }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${dateRange === r.value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {r.label}
            </button>
          ))}
        </div>
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        )}

        <span className="hidden lg:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
          <def.icon className={`w-3.5 h-3.5 ${def.color}`} />{def.description}
        </span>
      </div>

      {/* ── WhatsApp Panel ──────────────────────────────────────── */}
      {waOpen && (
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-green-100 rounded-lg"><MessageCircle className="w-4 h-4 text-green-600" /></div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">WhatsApp Report Sharing</h3>
                <p className="text-xs text-gray-500">Each contact has its own report selection, triggers & schedule</p>
              </div>
            </div>
            <button type="button" aria-label="Close" onClick={() => setWaOpen(false)} className="p-1.5 rounded-lg hover:bg-green-100 transition-colors">
                <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Add new contact */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-700 mb-3 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Contact</p>
              <div className="flex flex-wrap gap-2">
                <PhoneInput value={newNumber} onChange={setNewNumber} defaultCountryIso="IN" />
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (e.g. Owner, Manager)"
                  onKeyDown={e => e.key === 'Enter' && addContact()}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-green-400" />
                <Button size="sm" onClick={addContact} className="gap-1 bg-green-600 hover:bg-green-700 text-white shrink-0">
                  <Plus className="w-3 h-3" /> Add Contact
                </Button>
              </div>
            </div>

            {/* Contact cards */}
            {rawContacts.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No contacts yet. Add a number above to get started.</p>
              </div>
            )}

            {rawContacts.map(contact => {
              const isExpanded = expandedContact === contact.id
              const activeReportCount = contact.reports.length
              const activeTriggerCount = contact.smart_triggers.length
              return (
                <div key={contact.id} className={`border rounded-2xl overflow-hidden transition-all duration-200 ${contact.enabled ? 'border-green-200' : 'border-gray-200 opacity-70'}`}>
                  {/* Contact header row */}
                  <div className={`flex items-center gap-3 px-4 py-3 ${contact.enabled ? 'bg-green-50/60' : 'bg-gray-50'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${contact.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {contact.label[0]?.toUpperCase() || '#'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{contact.label}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{contact.number}</p>
                    </div>
                    {/* Summary badges */}
                    <div className="hidden sm:flex items-center gap-1.5">
                      {activeReportCount > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{activeReportCount} reports</span>
                      )}
                      {activeTriggerCount > 0 && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{activeTriggerCount} triggers</span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold capitalize">{contact.frequency} {contact.time}</span>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Enabled toggle */}
                      <button onClick={() => updateContact(contact.id, { enabled: !contact.enabled })} title={contact.enabled ? 'Disable' : 'Enable'}>
                        {contact.enabled
                          ? <ToggleRight className="w-6 h-6 text-green-500" />
                          : <ToggleLeft className="w-6 h-6 text-gray-300" />}
                      </button>
                      {/* Send now */}
                      <button onClick={() => sendToContact(contact)} title="Send report now"
                        className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete */}
                      <button onClick={() => removeContact(contact.id)} title="Remove contact"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {/* Expand */}
                      <button onClick={() => setExpandedContact(isExpanded ? null : contact.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded config */}
                  {isExpanded && (
                    <div className="px-4 pb-5 pt-3 space-y-5 border-t border-gray-100">

                      {/* ── Quick preset bundles ── */}
                      <div>
                        <SectionLabel className="mb-2">Quick Presets</SectionLabel>
                        <div className="flex flex-wrap gap-2">
                          {WA_PRESETS.map(p => (
                            <button key={p.label} onClick={() => updateContact(contact.id, { reports: p.reports, smart_triggers: p.triggers })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-green-300 bg-green-50/50 text-xs font-medium text-green-800 hover:bg-green-100 transition-colors">
                              <span>{p.icon}</span> {p.label}
                            </button>
                          ))}
                          <button onClick={() => updateContact(contact.id, { reports: REPORTS.map(r => r.id), smart_triggers: SMART_TRIGGERS.map(t => t.id) })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 text-xs font-medium text-blue-800 hover:bg-blue-100 transition-colors">
                            ⚡ Select All
                          </button>
                          <button onClick={() => updateContact(contact.id, { reports: [], smart_triggers: [] })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                            Clear All
                          </button>
                        </div>
                      </div>

                      {/* ── Schedule ── */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> Schedule
                        </p>
                        <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Frequency</p>
                              <select value={contact.frequency}
                                onChange={e => updateContact(contact.id, { frequency: e.target.value as WaContact['frequency'] })}
                                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                                <option value="hourly">Every N Hours</option>
                                <option value="twice_daily">Twice Daily (AM + PM)</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </div>

                            {contact.frequency === 'hourly' && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Every (hours)</p>
                                <input type="number" min={1} max={23}
                                  value={contact.interval_hours ?? 4}
                                  onChange={e => updateContact(contact.id, { interval_hours: Number(e.target.value) })}
                                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs w-20 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
                              </div>
                            )}

                            {contact.frequency === 'weekly' && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Day of week</p>
                                <select value={contact.day_of_week ?? 'mon'}
                                  onChange={e => updateContact(contact.id, { day_of_week: e.target.value })}
                                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                                  {['mon','tue','wed','thu','fri','sat','sun'].map(d => (
                                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div>
                              <p className="text-xs text-gray-500 mb-1">Send at</p>
                              <input type="time" value={contact.time}
                                onChange={e => updateContact(contact.id, { time: e.target.value })}
                                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 bg-white w-24" />
                            </div>
                          </div>

                          {contact.enabled && (
                            <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium">
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                              {contact.frequency === 'hourly'
                                ? `Sends every ${contact.interval_hours ?? 4}h starting at ${contact.time}`
                                : contact.frequency === 'twice_daily'
                                ? `Sends at ${contact.time} and 12 hours later`
                                : contact.frequency === 'weekly'
                                ? `Sends every ${(contact.day_of_week ?? 'mon').charAt(0).toUpperCase() + (contact.day_of_week ?? 'mon').slice(1)} at ${contact.time}`
                                : contact.frequency === 'monthly'
                                ? `Sends on the 1st of each month at ${contact.time}`
                                : `Sends daily at ${contact.time}`}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Reports to share ── */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                            <FileText className="w-3 h-3" /> Reports to include
                            <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">{contact.reports.length}/{REPORTS.length}</span>
                          </p>
                          <div className="flex gap-1">
                            <button onClick={() => updateContact(contact.id, { reports: REPORTS.map(r => r.id) })}
                              className="text-xs text-blue-600 hover:underline font-semibold">All</button>
                            <span className="text-gray-300 text-xs">|</span>
                            <button onClick={() => updateContact(contact.id, { reports: [] })}
                              className="text-xs text-gray-500 hover:underline font-semibold">None</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {REPORTS.map(r => {
                            const on = contact.reports.includes(r.id)
                            return (
                              <button key={r.id} onClick={() => toggleContactReport(contact.id, r.id)}
                                title={`Preview: ${r.description}`}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left text-xs font-medium transition-all ${
                                  on ? 'border-green-400 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:border-green-200 hover:bg-green-50/30'
                                }`}>
                                <r.icon className={`w-3.5 h-3.5 shrink-0 ${on ? 'text-green-600' : 'text-gray-400'}`} />
                                <span className="truncate flex-1">{r.label}</span>
                                {on
                                  ? <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />
                                  : <button onClick={e => { e.stopPropagation(); setActiveReport(r.id as ReportId); setWaOpen(false) }}
                                      title="Preview this report"
                                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 shrink-0">
                                      <ArrowUpRight className="w-3 h-3" />
                                    </button>
                                }
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* ── Smart triggers ── */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-amber-500" /> Smart Auto-Triggers
                            <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">{contact.smart_triggers.length}/{SMART_TRIGGERS.length}</span>
                          </p>
                          <div className="flex gap-1">
                            <button onClick={() => updateContact(contact.id, { smart_triggers: SMART_TRIGGERS.map(t => t.id) })}
                              className="text-xs text-amber-600 hover:underline font-semibold">All</button>
                            <span className="text-gray-300 text-xs">|</span>
                            <button onClick={() => updateContact(contact.id, { smart_triggers: [] })}
                              className="text-xs text-gray-500 hover:underline font-semibold">None</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {SMART_TRIGGERS.map(t => {
                            const on = contact.smart_triggers.includes(t.id)
                            return (
                              <button key={t.id} onClick={() => toggleContactTrigger(contact.id, t.id)}
                                className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                                  on ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-amber-200 hover:bg-amber-50/30'
                                }`}>
                                <div className={`p-1 rounded-lg shrink-0 mt-0.5 ${on ? t.bg : 'bg-gray-100'}`}>
                                  <t.icon className={`w-3 h-3 ${on ? t.color : 'text-gray-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className={`text-xs font-medium ${on ? 'text-amber-800' : 'text-gray-700'}`}>{t.label}</p>
                                    {t.badge && (
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                                        on ? 'bg-amber-200 text-amber-900' : 'bg-gray-100 text-gray-500'
                                      }`}>{t.badge}</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
                                </div>
                                {on && <CheckCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* ── Message preview ── */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
                        <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1.5">
                          <Bell className="w-3 h-3" /> WhatsApp Message Preview
                          <span className="ml-auto text-xs text-gray-400 font-normal">Based on current data</span>
                        </p>
                        {/* Mockup phone bubble */}
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-green-100 mb-3 max-h-[90vh] overflow-y-auto">
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                              <MessageCircle className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-gray-700">KITERP Bot → {contact.label}</span>
                          </div>
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed max-h-36 overflow-y-auto">{buildReportText(contact)}</pre>
                        </div>
                        <Button size="sm" onClick={() => sendToContact(contact)}
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs w-full justify-center">
                          <Send className="w-3 h-3" /> Send now to {contact.label} ({contact.number})
                        </Button>
                      </div>

                    </div>
                  )}
                </div>
              )
            })}

            {/* Chart size selector (global setting) */}
            <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-500">Chart size in reports:</p>
              {(['sm','md','lg'] as const).map(s => (
                <button key={s} onClick={() => setChartSize(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${chartSize === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Report content ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
      ) : (
        <div ref={reportRef} className="space-y-5">

          {/* ══ SALES OVERVIEW ═════════════════════════════════════ */}
          {activeReport === 'sales_overview' && (() => {
            const filtered = filterRows(salesRows, search, ['date'])
            const sorted   = sortKey ? sortData(filtered, sortKey, sortDir) : filtered
            return <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Revenue" value={formatCurrency(dashboard?.total_revenue ?? 0)} icon={IndianRupee} bg="bg-emerald-50" color="text-emerald-600" />
                <StatCard label="Total Orders"  value={dashboard?.total_orders ?? 0} icon={ShoppingCart} bg="bg-blue-50" color="text-blue-600" />
                <StatCard label="Today Revenue" value={formatCurrency(dashboard?.today_revenue ?? 0)} icon={TrendingUp} bg="bg-accent" color="text-primary" />
                <StatCard label="Today Orders"  value={dashboard?.today_orders ?? 0} icon={Clock} bg="bg-amber-50" color="text-amber-600" />
              </div>
              <Section title={`Daily Sales — Last ${days} Days`}
                action={<ChartTypePicker value={salesChart} onChange={setSalesChart} allowed={['bar','line','area']} />}
                viewReport="revenue_summary" onViewReport={setActiveReport}>
                {salesRows.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No sales data for this period.</p>
                  : <>{renderChart(salesChart, salesRows, 'revenue', 'date', '#3b82f6', 140)}
                      <div className="mt-4">{renderChart(salesChart, salesRows, 'orders', 'date', '#64C3A0', 80)}</div>
                    </>}
              </Section>
              <Section title="Daily Sales Table">
                <ReportToolbar search={search} onSearch={setSearch} placeholder="Search by date…" />
                <div className="overflow-auto max-h-72">
                  <ResizableTable tableId="rpt-daily-sales" defaultWidths={[120, 80, 110, 110]}>
                    <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
                      <SortHeader label="Date" sortKey="date" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Orders" sortKey="orders" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Revenue" sortKey="revenue" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="py-2 text-right"><TableColumnLabel>Avg Order</TableColumnLabel></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.map(r => (
                        <tr key={r.date} className="hover:bg-gray-50">
                          <td className="py-2 pr-4 text-gray-700">{r.date}</td>
                          <td className="py-2 pr-4 text-right font-medium">{r.orders}</td>
                          <td className="py-2 pr-4 text-right font-medium text-emerald-700">{formatCurrency(r.revenue)}</td>
                          <td className="py-2 text-right text-gray-500">{r.orders > 0 ? formatCurrency(r.revenue / r.orders) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ResizableTable>
                </div>
              </Section>
            </>
          })()}

          {/* ══ REVENUE SUMMARY ════════════════════════════════════ */}
          {activeReport === 'revenue_summary' && <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[{ l: 'Today', v: revenue?.today ?? 0, i: Clock, b: 'bg-blue-50', c: 'text-blue-600' },
                { l: 'This Week', v: revenue?.this_week ?? 0, i: Calendar, b: 'bg-accent', c: 'text-primary' },
                { l: 'This Month', v: revenue?.this_month ?? 0, i: BarChart3, b: 'bg-emerald-50', c: 'text-emerald-600' },
                { l: 'This Year', v: revenue?.this_fy ?? 0, i: TrendingUp, b: 'bg-amber-50', c: 'text-amber-600' },
              ].map(s => <StatCard key={s.l} label={s.l} value={formatCurrency(s.v)} icon={s.i} bg={s.b} color={s.c} />)}
            </div>
            <Section title="Revenue Breakdown" viewReport="orders_status" onViewReport={setActiveReport}>
              {[{ l: 'Today', v: revenue?.today ?? 0 }, { l: 'This Week', v: revenue?.this_week ?? 0 }, { l: 'This Month', v: revenue?.this_month ?? 0 }, { l: 'This Year', v: revenue?.this_fy ?? 0 }].map(item => {
                const max = revenue?.this_fy || 1; const pct = Math.min(100, (item.v / max) * 100)
                return <div key={item.l} className="mb-5 last:mb-0">
                  <div className="flex justify-between text-sm mb-1.5"><span className="font-medium text-gray-700">{item.l}</span><span className="font-semibold text-gray-900">{formatCurrency(item.v)}</span></div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-info rounded-full transition-all duration-700" style={{ width: `${pct}%` }} /></div>
                  <p className="text-xs text-gray-400 mt-1">{Math.round(pct)}% of annual revenue</p>
                </div>
              })}
            </Section>
          </>}

          {/* ══ ORDERS BY STATUS ═══════════════════════════════════ */}
          {activeReport === 'orders_status' && <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Orders" value={statusTotal} icon={ShoppingCart} bg="bg-blue-50" color="text-blue-600" />
              <StatCard label="Delivered"    value={statusSegments.find(s => s.label === 'delivered')?.value ?? 0} icon={CheckCircle} bg="bg-green-50" color="text-green-600" />
              <StatCard label="Pending"      value={statusSegments.find(s => s.label === 'pending')?.value ?? 0} icon={Clock} bg="bg-amber-50" color="text-amber-600" />
              <StatCard label="Cancelled"    value={statusSegments.find(s => s.label === 'cancelled')?.value ?? 0} icon={AlertCircle} bg="bg-red-50" color="text-red-600" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Section title="Order Distribution" action={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 hidden sm:block">Click segment to filter</span>
                  <ChartTypePicker value={statusChart} onChange={setStatusChart} allowed={['pie','donut','hbar']} />
                </div>
              } viewReport="pos_report" onViewReport={setActiveReport}>
                {statusSegments.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No data.</p>
                  : renderChart(
                      statusChart,
                      statusSegments.map(s => ({ ...s, [s.label]: s.value })),
                      'value', 'label', '#3b82f6', 140,
                      (label) => navigate(`/orders?status=${label}`),
                      chartSize,
                    )}
              </Section>
              <Section title="Status Breakdown">
                <div className="space-y-3">
                  {statusSegments.map(seg => {
                    const c = STATUS_COLORS[seg.label] || { bar: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' }
                    return (
                      <button key={seg.label} onClick={() => navigate(`/orders?status=${seg.label}`)}
                        className="flex items-center gap-3 w-full group hover:bg-gray-50 rounded-lg px-1 py-0.5 transition-colors">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                        <span className="text-sm capitalize text-gray-700 w-24 text-left group-hover:text-blue-600 transition-colors">{seg.label}</span>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex-1"><div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(100, (seg.value / statusTotal) * 100)}%` }} /></div>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums w-8 text-right">{seg.value}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-12 text-center ${c.badge}`}>{Math.round((seg.value / statusTotal) * 100)}%</span>
                        <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
                      </button>
                    )
                  })}
                </div>
              </Section>
            </div>
          </>}

          {/* ══ TOP PRODUCTS ═══════════════════════════════════════ */}
          {activeReport === 'top_products' && (() => {
            const filtered = filterRows(productRows, search, ['name'])
            const sorted   = sortKey ? sortData(filtered, sortKey, sortDir) : filtered
            return <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Total Products" value={dashboard?.total_products ?? 0} icon={Package} bg="bg-teal-50" color="text-teal-600" />
                <StatCard label="Avg Price" value={productRows.length ? formatCurrency(productRows.reduce((s: number, p: any) => s + (p.price || 0), 0) / productRows.length) : '—'} icon={IndianRupee} bg="bg-emerald-50" color="text-emerald-600" />
                <StatCard label="Total Stock" value={productRows.reduce((s: number, p: any) => s + (p.stock || 0), 0)} icon={Layers} bg="bg-blue-50" color="text-blue-600" />
              </div>
              <Section title="Top Products" viewReport="inventory_report" onViewReport={setActiveReport}>
                <ReportToolbar search={search} onSearch={setSearch} placeholder="Search products…"
                  filterLabel="Stock Level" filterValue={filterVal}
                  filterOptions={[{ value: 'low', label: 'Low (<10)' }, { value: 'medium', label: 'Medium (10-50)' }, { value: 'high', label: 'High (>50)' }]}
                  onFilter={setFilterVal} />
                <div className="overflow-auto max-h-96">
                  <ResizableTable tableId="rpt-top-products" defaultWidths={[40, 240, 100, 90]}>
                    <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
                      <th className="py-2 pr-2 w-8"><TableColumnLabel>#</TableColumnLabel></th>
                      <SortHeader label="Product" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Price" sortKey="price" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Stock" sortKey="stock" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.filter((p: any) => {
                        if (filterVal === 'low') return (p.stock || 0) < 10
                        if (filterVal === 'medium') return (p.stock || 0) >= 10 && (p.stock || 0) <= 50
                        if (filterVal === 'high') return (p.stock || 0) > 50
                        return true
                      }).map((p: any, i: number) => (
                        <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/products/${p.id}`)}>
                          <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                          <td className="py-2 pr-4 font-medium text-blue-600 hover:underline">{p.name}</td>
                          <td className="py-2 pr-4 text-right">{formatCurrency(p.price)}</td>
                          <td className="py-2 pr-4 text-right"><span className={`font-medium ${(p.stock || 0) < 10 ? 'text-red-600' : 'text-gray-700'}`}>{p.stock}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </ResizableTable>
                </div>
              </Section>
            </>
          })()}

          {/* ══ TOP CUSTOMERS ═════════════════════════════════════ */}
          {activeReport === 'top_customers' && (() => {
            const filtered = filterRows(customerRows, search, ['name', 'email'])
            const sorted   = sortKey ? sortData(filtered, sortKey, sortDir) : filtered
            return <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Total Customers" value={dashboard?.total_customers ?? 0} icon={Users} bg="bg-pink-50" color="text-pink-600" />
                <StatCard label="Total Revenue" value={formatCurrency(dashboard?.total_revenue ?? 0)} icon={IndianRupee} bg="bg-emerald-50" color="text-emerald-600" />
                <StatCard label="Avg Spend" value={customerRows.length ? formatCurrency(customerRows.reduce((s: number, c: any) => s + (c.spent || 0), 0) / customerRows.length) : '—'} icon={TrendingUp} bg="bg-accent" color="text-primary" />
              </div>
              <Section title="Top Customers" viewReport="reviews_report" onViewReport={setActiveReport}>
                <ReportToolbar search={search} onSearch={setSearch} placeholder="Search by name or email…" />
                <div className="overflow-auto max-h-96">
                  <ResizableTable tableId="rpt-top-customers" defaultWidths={[40, 200, 80, 100]}>
                    <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
                      <th className="py-2 pr-2 w-8"><TableColumnLabel>#</TableColumnLabel></th>
                      <SortHeader label="Customer" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Orders" sortKey="orders" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Spent" sortKey="spent" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.map((c: any, i: number) => (
                        <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                          <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                          <td className="py-2 pr-4"><p className="font-medium text-blue-600 hover:underline">{c.name}</p><p className="text-xs text-gray-400">{c.email}</p></td>
                          <td className="py-2 pr-4 text-right">{c.orders}</td>
                          <td className="py-2 pr-4 text-right font-medium">{formatCurrency(c.spent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ResizableTable>
                </div>
              </Section>
            </>
          })()}

          {/* ══ POS REPORT ════════════════════════════════════════ */}
          {activeReport === 'pos_report' && (() => {
            const filtered = filterRows(posOrders, search, ['order_number', 'customer_name', 'payment_method'])
            const fv = filterVal !== 'all' ? filtered.filter((o: any) => o.payment_method === filterVal) : filtered
            const sorted = sortKey ? sortData(fv, sortKey, sortDir) : fv
            const methodSegs = Object.entries(posStats.byMethod).map(([m, c], i) => ({ label: m, value: c, color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length] }))
            return <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total POS Sales" value={posStats.count} icon={Receipt} bg="bg-indigo-50" color="text-indigo-600" />
                <StatCard label="POS Revenue" value={formatCurrency(posStats.rev)} icon={IndianRupee} bg="bg-emerald-50" color="text-emerald-600" />
                <StatCard label="Avg Transaction" value={formatCurrency(posStats.avg)} icon={TrendingUp} bg="bg-amber-50" color="text-amber-600" />
                <StatCard label="POS Today" value={formatCurrency(dashboard?.pos_today ?? 0)} icon={Clock} bg="bg-blue-50" color="text-blue-600" />
              </div>
              {methodSegs.length > 0 && (
                <Section title="Payment Method Breakdown" action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 hidden sm:block">Click to filter</span>
                    <ChartTypePicker value={posChart} onChange={setPosChart} allowed={['hbar','pie','donut']} />
                  </div>
                } viewReport="orders_status" onViewReport={setActiveReport}>
                  {renderChart(
                    posChart, methodSegs, 'value', 'label', '#6366f1', 140,
                    (label) => navigate(`/pos?payment_method=${label}`),
                    chartSize,
                  )}
                </Section>
              )}
              <Section title="POS Transactions">
                <ReportToolbar search={search} onSearch={setSearch} placeholder="Search orders…"
                  filterLabel="Payment" filterValue={filterVal}
                  filterOptions={Object.keys(posStats.byMethod).map(m => ({ value: m, label: m }))} onFilter={setFilterVal} />
                <div className="overflow-auto max-h-96">
                  <ResizableTable tableId="rpt-pos-orders" defaultWidths={[100, 100, 140, 90, 100, 90]}>
                    <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
                      <SortHeader label="Date" sortKey="created_at" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Order #" sortKey="order_number" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="py-2 pr-4"><TableColumnLabel>Customer</TableColumnLabel></th>
                      <SortHeader label="Total" sortKey="total" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="py-2 pr-4"><TableColumnLabel>Payment</TableColumnLabel></th>
                      <th className="py-2"><TableColumnLabel>Status</TableColumnLabel></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.slice(0, 30).map((o: any) => {
                        const sc = STATUS_COLORS[o.status] || { badge: 'bg-gray-100 text-gray-700' }
                        return <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                          <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                          <td className="py-2 pr-4 font-medium text-blue-600">{o.order_number}</td>
                          <td className="py-2 pr-4 text-gray-600">{o.customer_name || <span className="italic text-gray-400">Walk-in</span>}</td>
                          <td className="py-2 pr-4 text-right font-medium">{formatCurrency(o.total)}</td>
                          <td className="py-2 pr-4 capitalize text-gray-600">{o.payment_method || '—'}</td>
                          <td className="py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sc.badge}`}>{o.status}</span></td>
                        </tr>
                      })}
                    </tbody>
                  </ResizableTable>
                </div>
              </Section>
            </>
          })()}

          {/* ══ BOOKINGS REPORT ═══════════════════════════════════ */}
          {activeReport === 'bookings_report' && (() => {
            const filtered = filterRows(bookings, search, ['booking_number', 'service_name', 'customer_name'])
            const fv = filterVal !== 'all' ? filtered.filter((b: any) => b.status === filterVal) : filtered
            const sorted = sortKey ? sortData(fv, sortKey, sortDir) : fv
            const bSegs = Object.entries(bookingStats.byStatus).map(([s, c], i) => ({ label: s, value: c, color: STATUS_COLORS[s]?.hex || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length] }))
            return <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Total Bookings" value={bookingStats.count} icon={BookOpen} bg="bg-cyan-50" color="text-cyan-600" />
                <StatCard label="Confirmed" value={bookingStats.byStatus['confirmed'] || 0} icon={CheckCircle} bg="bg-green-50" color="text-green-600" />
                <StatCard label="Pending" value={bookingStats.byStatus['pending'] || 0} icon={Clock} bg="bg-amber-50" color="text-amber-600" />
              </div>
              {bSegs.length > 0 && (
                <Section title="Booking Status Distribution" action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 hidden sm:block">Click to filter</span>
                    <ChartTypePicker value={bookingsChart} onChange={setBookingsChart} allowed={['pie','donut','hbar']} />
                  </div>
                } viewReport="invoices_report" onViewReport={setActiveReport}>
                  {renderChart(
                    bookingsChart, bSegs, 'value', 'label', '#06b6d4', 140,
                    (label) => navigate(`/bookings?status=${label}`),
                    chartSize,
                  )}
                </Section>
              )}
              <Section title="Bookings">
                <ReportToolbar search={search} onSearch={setSearch} placeholder="Search bookings…"
                  filterLabel="Status" filterValue={filterVal}
                  filterOptions={Object.keys(bookingStats.byStatus).map(s => ({ value: s, label: s }))} onFilter={setFilterVal} />
                <div className="overflow-auto max-h-96">
                  <ResizableTable tableId="rpt-bookings" defaultWidths={[100, 120, 160, 150, 90]}>
                    <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
                      <SortHeader label="Date" sortKey="booking_date" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Booking #" sortKey="booking_number" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="py-2 pr-4"><TableColumnLabel>Service</TableColumnLabel></th>
                      <th className="py-2 pr-4"><TableColumnLabel>Customer</TableColumnLabel></th>
                      <th className="py-2"><TableColumnLabel>Status</TableColumnLabel></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.slice(0, 30).map((b: any) => {
                        const sc = STATUS_COLORS[b.status] || { badge: 'bg-gray-100 text-gray-700' }
                        return <tr key={b.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                          <td className="py-2 pr-4 text-gray-500">{b.booking_date ? new Date(b.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                          <td className="py-2 pr-4 font-medium text-blue-600">{b.booking_number || '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{b.service_name || '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{b.customer_name || '—'}</td>
                          <td className="py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sc.badge}`}>{b.status || '—'}</span></td>
                        </tr>
                      })}
                    </tbody>
                  </ResizableTable>
                  {bookings.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No bookings found.</p>}
                </div>
              </Section>
            </>
          })()}

          {/* ══ INVOICES REPORT ═══════════════════════════════════ */}
          {activeReport === 'invoices_report' && (() => {
            const filtered = filterRows(allOrders, search, ['order_number', 'customer_name'])
            const fv = filterVal !== 'all' ? filtered.filter((o: any) => {
              if (filterVal === 'paid') return o.status === 'delivered' || o.status === 'completed'
              if (filterVal === 'unpaid') return o.status === 'pending' || o.status === 'confirmed'
              return true
            }) : filtered
            const sorted = sortKey ? sortData(fv, sortKey, sortDir) : fv
            const invSegs = [
              { label: 'Paid', value: invoiceStats.paidCount, color: '#22c55e' },
              { label: 'Unpaid', value: invoiceStats.unpaidCount, color: '#f59e0b' },
            ]
            return <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Invoices" value={invoiceStats.total} icon={FileText} bg="bg-blue-50" color="text-blue-600" />
                <StatCard label="Paid" value={invoiceStats.paidCount} sub={formatCurrency(invoiceStats.paidTotal)} icon={CheckCircle} bg="bg-green-50" color="text-green-600" />
                <StatCard label="Unpaid" value={invoiceStats.unpaidCount} sub={formatCurrency(invoiceStats.unpaidTotal)} icon={Clock} bg="bg-amber-50" color="text-amber-600" />
                <StatCard label="Total Value" value={formatCurrency(invoiceStats.paidTotal + invoiceStats.unpaidTotal)} icon={IndianRupee} bg="bg-emerald-50" color="text-emerald-600" />
              </div>
              <Section title="Paid vs Unpaid" viewReport="orders_status" onViewReport={setActiveReport}><PieDonut segments={invSegs} donut /></Section>
              <Section title="All Invoices">
                <ReportToolbar search={search} onSearch={setSearch} placeholder="Search invoices…"
                  filterLabel="Status" filterValue={filterVal} filterOptions={[{ value: 'paid', label: 'Paid' }, { value: 'unpaid', label: 'Unpaid' }]} onFilter={setFilterVal} />
                <div className="overflow-auto max-h-96">
                  <ResizableTable tableId="rpt-invoices" defaultWidths={[100, 110, 150, 90, 90]}>
                    <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
                      <SortHeader label="Date" sortKey="created_at" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Order #" sortKey="order_number" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="py-2 pr-4"><TableColumnLabel>Customer</TableColumnLabel></th>
                      <SortHeader label="Total" sortKey="total" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="py-2"><TableColumnLabel>Status</TableColumnLabel></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.slice(0, 30).map((o: any) => {
                        const sc = STATUS_COLORS[o.status] || { badge: 'bg-gray-100 text-gray-700' }
                        return <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                          <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                          <td className="py-2 pr-4 font-medium text-blue-600">{o.order_number}</td>
                          <td className="py-2 pr-4 text-gray-600">{o.customer_name || '—'}</td>
                          <td className="py-2 pr-4 text-right font-medium">{formatCurrency(o.total)}</td>
                          <td className="py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sc.badge}`}>{o.status}</span></td>
                        </tr>
                      })}
                    </tbody>
                  </ResizableTable>
                </div>
              </Section>
            </>
          })()}

          {/* ══ COUPONS REPORT ════════════════════════════════════ */}
          {activeReport === 'coupons_report' && (() => {
            const filtered = filterRows(coupons, search, ['code', 'description'])
            const sorted = sortKey ? sortData(filtered, sortKey, sortDir) : filtered
            return <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Total Coupons" value={couponStats.total} icon={Tag} bg="bg-lime-50" color="text-lime-600" />
                <StatCard label="Active" value={couponStats.active} icon={CheckCircle} bg="bg-green-50" color="text-green-600" />
                <StatCard label="Total Discount Value" value={formatCurrency(couponStats.totalDiscount)} icon={IndianRupee} bg="bg-amber-50" color="text-amber-600" />
              </div>
              <Section title="Coupons">
                <ReportToolbar search={search} onSearch={setSearch} placeholder="Search coupons…"
                  filterLabel="Status" filterValue={filterVal}
                  filterOptions={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} onFilter={setFilterVal} />
                <div className="overflow-auto max-h-96">
                  <ResizableTable tableId="rpt-coupons" defaultWidths={[120, 90, 100, 80, 80]}>
                    <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
                      <SortHeader label="Code" sortKey="code" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="py-2 pr-4"><TableColumnLabel>Type</TableColumnLabel></th>
                      <SortHeader label="Discount" sortKey="discount_value" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="py-2 pr-4"><TableColumnLabel>Uses</TableColumnLabel></th>
                      <th className="py-2"><TableColumnLabel>Status</TableColumnLabel></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.filter((c: any) => {
                        if (filterVal === 'active') return c.is_active
                        if (filterVal === 'inactive') return !c.is_active
                        return true
                      }).map((c: any) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="py-2 pr-4 font-mono font-medium text-blue-600">{c.code}</td>
                          <td className="py-2 pr-4 text-gray-600 capitalize">{c.discount_type || 'fixed'}</td>
                          <td className="py-2 pr-4 text-right font-medium">{c.discount_type === 'percentage' ? `${c.discount_value || c.discount || 0}%` : formatCurrency(c.discount_value || c.discount || 0)}</td>
                          <td className="py-2 pr-4 text-right text-gray-500">{c.usage_count || 0}</td>
                          <td className="py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </ResizableTable>
                  {coupons.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No coupons found.</p>}
                </div>
              </Section>
            </>
          })()}

          {/* ══ INVENTORY REPORT ══════════════════════════════════ */}
          {activeReport === 'inventory_report' && (() => {
            const useInvSummary = invSummaryItems.length > 0
            const baseItems = useInvSummary
              ? invSummaryItems.map((p: any) => ({ ...p, name: p.product_name, stock: p.current_quantity, price: p.price || 0, id: p.product_id }))
              : allProducts
            const filtered = filterRows(baseItems, search, ['name'])
            const fv = filterVal !== 'all' ? filtered.filter((p: any) => {
              const stk = p.stock || p.current_quantity || 0
              if (filterVal === 'out') return stk === 0
              if (filterVal === 'low') return stk > 0 && stk < 10
              if (filterVal === 'ok') return stk >= 10
              return true
            }) : filtered
            const sorted = sortKey ? sortData(fv, sortKey, sortDir) : fv
            const hasStores = reportStores.length > 0 && selectedStoreId === 'all'
            const colCount = 4 + (hasStores ? reportStores.length : 0)
            return <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label={selectedStoreId !== 'all' ? `${reportStores.find(s=>s.id===selectedStoreId)?.name} Stock` : 'Total Stock'} value={inventoryStats.totalStock} icon={Layers} bg="bg-teal-50" color="text-teal-600" />
                <StatCard label="Low Stock Items" value={inventoryStats.lowCount} icon={AlertCircle} bg="bg-amber-50" color="text-amber-600" />
                <StatCard label="Out of Stock" value={inventoryStats.outCount} icon={X} bg="bg-red-50" color="text-red-600" />
                <StatCard label="Total Valuation" value={formatCurrency(inventoryStats.valuation)} icon={IndianRupee} bg="bg-emerald-50" color="text-emerald-600" />
              </div>
              <Section title="Inventory Details" viewReport="top_products" onViewReport={setActiveReport}>
                <ReportToolbar search={search} onSearch={setSearch} placeholder="Search products…"
                  filterLabel="Stock Level" filterValue={filterVal}
                  filterOptions={[{ value: 'out', label: 'Out of Stock' }, { value: 'low', label: 'Low (<10)' }, { value: 'ok', label: 'In Stock (10+)' }]} onFilter={setFilterVal} />
                <div className="overflow-auto max-h-96">
                  <ResizableTable tableId="rpt-inventory-value" defaultWidths={[240, 90, 100, 110, ...reportStores.map(() => 90)]}>
                    <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
                      <SortHeader label="Product" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label={selectedStoreId !== 'all' ? 'Store Stock' : 'Total Stock'} sortKey="stock" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Price" sortKey="price" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="py-2 text-right px-2"><TableColumnLabel>Value</TableColumnLabel></th>
                      {hasStores && reportStores.map(s => (
                        <th key={s.id} className="py-2 text-right px-2 text-indigo-500">{s.code || s.name}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.map((p: any) => {
                        const stock = p.stock || p.current_quantity || 0; const isLow = stock < 10
                        return <tr key={p.id || p.product_id} className={`hover:bg-gray-50 cursor-pointer ${stock === 0 ? 'bg-red-50/50' : ''}`} onClick={() => navigate(`/products/${p.id || p.product_id}`)}>
                          <td className="py-2 pr-4 font-medium text-blue-600 hover:underline">{p.name || p.product_name}</td>
                          <td className="py-2 pr-4 text-right"><span className={`font-semibold ${stock === 0 ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-700'}`}>{stock}</span></td>
                          <td className="py-2 pr-4 text-right">{formatCurrency(p.price || 0)}</td>
                          <td className="py-2 text-right text-gray-500 px-2">{formatCurrency(stock * (p.price || 0))}</td>
                          {hasStores && reportStores.map(s => {
                            const sq = (p.store_quantities || []).find((q: any) => q.store_id === s.id)
                            return <td key={s.id} className="py-2 text-right px-2 text-indigo-600 font-medium">{sq ? sq.quantity : <span className="text-gray-300">—</span>}</td>
                          })}
                        </tr>
                      })}
                    </tbody>
                  </ResizableTable>
                  {sorted.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No products found.</p>}
                </div>
              </Section>
            </>
          })()}

          {/* ══ REVIEWS & RATINGS ═════════════════════════════════ */}
          {activeReport === 'reviews_report' && (() => {
            const filtered = filterRows(reviews, search, ['customer_name', 'comment'])
            const fv = filterVal !== 'all' ? filtered.filter((r: any) => String(r.rating) === filterVal) : filtered
            const sorted = sortKey ? sortData(fv, sortKey, sortDir) : fv
            const distSegs = Object.entries(reviewStats.dist).sort(([a], [b]) => Number(b) - Number(a)).map(([stars, count]) => ({
              label: `${stars} stars`, value: count, color: DEFAULT_PALETTE[5 - Number(stars)],
            }))
            return <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Average Rating" value={reviewStats.avg.toFixed(1)} sub={`out of 5 (${reviewStats.total} reviews)`} icon={Star} bg="bg-amber-50" color="text-amber-600" />
                <StatCard label="5-Star Reviews" value={reviewStats.dist[5] || 0} icon={Star} bg="bg-green-50" color="text-green-600" />
                <StatCard label="1-Star Reviews" value={reviewStats.dist[1] || 0} icon={AlertCircle} bg="bg-red-50" color="text-red-600" />
              </div>
              <Section title="Rating Distribution" viewReport="top_customers" onViewReport={setActiveReport}>
                <div className="space-y-3">
                  {distSegs.map(seg => (
                    <div key={seg.label} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 w-20">{seg.label}</span>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex-1">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (seg.value / reviewStats.total) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-8 text-right">{seg.value}</span>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Recent Reviews">
                <ReportToolbar search={search} onSearch={setSearch} placeholder="Search reviews…"
                  filterLabel="Rating" filterValue={filterVal}
                  filterOptions={[5, 4, 3, 2, 1].map(n => ({ value: String(n), label: `${n} Star${n > 1 ? 's' : ''}` }))} onFilter={setFilterVal} />
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {sorted.map((r: any) => (
                    <div key={r.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-0.5 mb-1.5">
                        {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />)}
                        <span className="text-xs text-gray-400 ml-1.5 font-medium">{r.rating}/5</span>
                      </div>
                      {r.comment && <p className="text-sm text-gray-600 line-clamp-2">{r.comment}</p>}
                      <p className="text-xs text-gray-400 mt-1.5">{r.customer_name || 'Customer'} &middot; {r.created_at ? formatDate(r.created_at) : ''}</p>
                    </div>
                  ))}
                  {reviews.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No reviews yet.</p>}
                </div>
              </Section>
            </>
          })()}

          {/* ══ MRP REPORT ════════════════════════════════════════ */}
          {activeReport === 'mrp_report' && (
            <div className="space-y-4">

              {/* ── Summary stat cards ─────────────────────────────────── */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard label="Open Orders" value={mrpSummary.openOrders} icon={ShoppingCart} bg="bg-blue-50" color="text-blue-600" />
                <StatCard label="Materials Tracked" value={mrpSummary.total} icon={ClipboardList} bg="bg-accent" color="text-primary" />
                <StatCard label="Shortage Items" value={mrpSummary.shortages} icon={BadgeAlert} bg="bg-red-50" color="text-red-600" />
                <StatCard label="Sufficient Items" value={mrpSummary.sufficient} icon={BadgeCheck} bg="bg-green-50" color="text-green-600" />
                <StatCard label="Est. Procurement Value" value={formatCurrency(mrpSummary.buyValue)} icon={IndianRupee} bg="bg-amber-50" color="text-amber-600" />
              </div>
              {/* Production history quick-access */}
              {prodHistory.length > 0 && (
                <div className="flex items-center gap-3 bg-accent border border-primary/30 rounded-xl px-4 py-2.5">
                  <Factory className="w-4 h-4 text-primary/80 shrink-0" />
                  <p className="text-xs text-primary flex-1">
                    <strong>{prodHistory.length}</strong> production order{prodHistory.length > 1 ? 's' : ''} on record.
                    Latest: <strong>{prodHistory[0].orderNo}</strong> · {prodHistory[0].status.replace('_',' ')} · {prodHistory[0].progress}%
                  </p>
                  <button onClick={() => { setProdModal(true); setProdTab('history') }}
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" /> View History
                  </button>
                </div>
              )}

              {/* ── Toolbar: filters + export panel ────────────────────── */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[180px] max-w-xs shadow-sm max-h-[90vh] overflow-y-auto">
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input value={mrpSearch} onChange={e => setMrpSearch(e.target.value)} placeholder="Search product, SKU, order…"
                    className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400" />
                  {mrpSearch && <button type="button" aria-label="Close" onClick={() => setMrpSearch('')}>
                <X className="w-3 h-3 text-gray-400" /></button>}
                </div>

                {/* Order number filter */}
                <div className="relative">
                  <select value={mrpOrderFilter} onChange={e => setMrpOrderFilter(e.target.value)}
                    className={`text-xs border rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-ring max-w-[160px] ${mrpOrderFilter ? 'border-primary/60 text-primary font-semibold' : 'border-gray-200'}`}>
                    <option value="">All Orders</option>
                    {mrpOrderRefs.map(ref => <option key={ref} value={ref}>{ref}</option>)}
                  </select>
                  {mrpOrderFilter && (
                    <button type="button" aria-label="Close" onClick={() => setMrpOrderFilter('')} className="absolute right-6 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-primary/80" />
                    </button>
                  )}
                </div>

                {/* Status filter pills */}
                <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5">
                  {(['all','shortage','sufficient'] as const).map(f => (
                    <button key={f} onClick={() => setMrpStatusFilter(f)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${mrpStatusFilter === f ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                      {f === 'all' ? 'All' : f === 'shortage' ? '⚠ Short' : '✓ OK'}
                    </button>
                  ))}
                </div>

                {/* Action filter */}
                <select value={mrpActionFilter} onChange={e => setMrpActionFilter(e.target.value as 'all' | 'buy' | 'produce' | 'sufficient')}
                  className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="all">All Actions</option>
                  <option value="buy">Buy (PO)</option>
                  <option value="produce">Produce</option>
                  <option value="sufficient">Sufficient</option>
                </select>

                {/* Column config */}
                <div className="relative">
                  <button onClick={() => setMrpColsOpen(v => !v)}
                    className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 bg-white transition-colors ${mrpColsOpen ? 'border-primary/60 text-primary' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <Settings2 className="w-3.5 h-3.5" /> Columns
                  </button>
                  {mrpColsOpen && (
                    <div className="absolute right-0 top-full mt-2 bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl z-50 p-3 min-w-[200px] max-h-[90vh] overflow-y-auto">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-2">Optional Columns</p>
                      {MRP_OPTIONAL_COLS.map(col => (
                        <label key={col.id} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded-lg px-1">
                          <input type="checkbox" checked={mrpOptCols.has(col.id)}
                            onChange={() => setMrpOptCols(prev => {
                              const next = new Set(prev)
                              next.has(col.id) ? next.delete(col.id) : next.add(col.id)
                              return next
                            })}
                            className="rounded border-gray-300 text-primary" />
                          <span className="text-xs text-gray-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {mrpColsOpen && <div className="fixed inset-0 z-40" onClick={() => setMrpColsOpen(false)} />}
                </div>

                {/* Share / Export panel */}
                <div className="relative">
                  <button onClick={() => setMrpShareOpen(v => !v)}
                    className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 bg-white transition-colors ${mrpShareOpen ? 'border-blue-400 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <Download className="w-3.5 h-3.5" /> Export &amp; Share
                  </button>
                  {mrpShareOpen && (
                    <div className="absolute right-0 top-full mt-2 bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl z-50 p-2 min-w-[210px] space-y-0.5 max-h-[90vh] overflow-y-auto">
                      <button onClick={() => { exportMrpCSV(); setMrpShareOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 text-xs text-gray-700 font-medium">
                        <Download className="w-3.5 h-3.5 text-gray-500" /> Download CSV
                      </button>
                      <button onClick={() => { exportMrpXLS(); setMrpShareOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-green-50 text-xs text-green-700 font-medium">
                        <FileText className="w-3.5 h-3.5 text-green-500" /> Download Excel (.xls)
                      </button>
                      <button onClick={() => { exportMrpPDF(); setMrpShareOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 text-xs text-red-700 font-medium">
                        <FileText className="w-3.5 h-3.5 text-red-500" /> Download PDF
                      </button>
                      <div className="border-t my-1" />
                      <button onClick={() => { shareMrpWhatsApp(); setMrpShareOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-green-50 text-xs text-green-700 font-medium">
                        <MessageCircle className="w-3.5 h-3.5 text-green-500" /> Share via WhatsApp
                      </button>
                      <button onClick={() => { shareMrpEmail(); setMrpShareOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-50 text-xs text-blue-700 font-medium">
                        <Send className="w-3.5 h-3.5 text-blue-500" /> Share via Email
                      </button>
                      <button onClick={() => { printMrpReport(); setMrpShareOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 text-xs text-gray-700 font-medium">
                        <Layers className="w-3.5 h-3.5 text-gray-500" /> Print Report
                      </button>
                      <button onClick={() => { shareMrpNative(); setMrpShareOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent text-xs text-primary font-medium">
                        <ExternalLink className="w-3.5 h-3.5 text-primary/80" /> More Share Options…
                      </button>
                    </div>
                  )}
                  {mrpShareOpen && <div className="fixed inset-0 z-40" onClick={() => setMrpShareOpen(false)} />}
                </div>
              </div>

              {/* ── Active filter chips ─────────────────────────────────── */}
              {(mrpOrderFilter || mrpStatusFilter !== 'all' || mrpActionFilter !== 'all') && (
                <div className="flex flex-wrap gap-1.5">
                  {mrpOrderFilter && (
                    <span className="inline-flex items-center gap-1 text-xs bg-primary/12 text-primary px-2.5 py-1 rounded-full font-semibold">
                      Order: {mrpOrderFilter}
                      <button type="button" aria-label="Close" onClick={() => setMrpOrderFilter('')}>
                <X className="w-2.5 h-2.5" /></button>
                    </span>
                  )}
                  {mrpStatusFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-semibold capitalize">
                      {mrpStatusFilter} only
                      <button type="button" aria-label="Close" onClick={() => setMrpStatusFilter('all')}>
                <X className="w-2.5 h-2.5" /></button>
                    </span>
                  )}
                  {mrpActionFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-semibold capitalize">
                      Action: {mrpActionFilter}
                      <button type="button" aria-label="Close" onClick={() => setMrpActionFilter('all')}>
                <X className="w-2.5 h-2.5" /></button>
                    </span>
                  )}
                </div>
              )}

              {/* ── Bulk action bar ────────────────────────────────────── */}
              {mrpSelected.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 bg-primary/90 text-white rounded-2xl px-4 py-3 shadow-lg">
                  <ListChecks className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold">{mrpSelected.size} item{mrpSelected.size > 1 ? 's' : ''} selected</span>
                  <div className="flex-1" />
                  <button onClick={() => setPoModal(true)}
                    className="flex items-center gap-1.5 bg-white text-primary hover:bg-accent px-4 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-sm max-h-[90vh] overflow-y-auto">
                    <Truck className="w-3.5 h-3.5" /> Create Purchase Order
                  </button>
                  <button onClick={() => { setProdTab('new'); setProdModal(true) }}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary/80 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-colors border border-primary/60">
                    <Factory className="w-3.5 h-3.5" /> Plan Production
                  </button>
                  <button type="button" aria-label="Close" onClick={() => setMrpSelected(new Set())} className="p-1.5 rounded-lg hover:bg-primary/90 transition-colors ml-1">
                <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* ── MRP Table ─────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm max-h-[90vh] overflow-y-auto">
                <div className="overflow-auto">
                  <ResizableTable tableId="rpt-mrp" defaultWidths={[40, 200, 130, 90, 90, 80, 90, 90, 130, 80]}>
                    <thead className="sticky top-0 bg-white z-10 border-b">
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                        <th className="py-3 px-4 w-8">
                          <input type="checkbox"
                            checked={mrpFiltered.length > 0 && mrpSelected.size === mrpFiltered.length}
                            onChange={toggleAllMrp}
                            className="rounded border-gray-300 text-primary focus:ring-ring cursor-pointer" />
                        </th>
                        <th className="py-3 pr-3 cursor-pointer select-none hover:text-gray-700" onClick={() => mrpSort('name')}>
                          Product {mrpSortKey === 'name' && (mrpSortDir === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-3 pr-3 hidden md:table-cell"><TableColumnLabel>SKU / Category</TableColumnLabel></th>
                        <th className="py-3 pr-3 text-right cursor-pointer select-none hover:text-gray-700" onClick={() => mrpSort('required_qty')}>
                          Required {mrpSortKey === 'required_qty' && (mrpSortDir === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-3 pr-3 text-right cursor-pointer select-none hover:text-gray-700" onClick={() => mrpSort('available_stock')}>
                          In Stock {mrpSortKey === 'available_stock' && (mrpSortDir === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-3 pr-3 text-right cursor-pointer select-none hover:text-gray-700" onClick={() => mrpSort('gap')}>
                          Gap {mrpSortKey === 'gap' && (mrpSortDir === 'asc' ? '↑' : '↓')}
                        </th>
                        {mrpOptCols.has('unit_price') && <th className="py-3 pr-3 text-right hidden lg:table-cell"><TableColumnLabel>Unit Price</TableColumnLabel></th>}
                        <th className="py-3 pr-3 text-right hidden lg:table-cell"><TableColumnLabel>Est. Value</TableColumnLabel></th>
                        <th className="py-3 pr-3 hidden xl:table-cell"><TableColumnLabel>Order Refs</TableColumnLabel></th>
                        <th className="py-3 px-4"><TableColumnLabel>Action</TableColumnLabel></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mrpFiltered.map(row => {
                        const isSelected = mrpSelected.has(row.product_id)
                        const isShortage = row.gap > 0
                        const isSurplus  = row.gap < 0
                        const isExpanded = mrpDetailRow === row.product_id
                        return (
                          <>
                            <tr key={row.product_id}
                              className={`transition-colors ${isSelected ? 'bg-accent' : 'hover:bg-gray-50/60'}`}>
                              <td className="py-3 px-4">
                                <input type="checkbox" checked={isSelected} onChange={() => toggleMrpRow(row.product_id)}
                                  className="rounded border-gray-300 text-primary focus:ring-ring cursor-pointer" />
                              </td>
                              <td className="py-3 pr-3">
                                <button className="text-left w-full" onClick={() => setMrpDetailRow(isExpanded ? null : row.product_id)}>
                                  <p className="font-semibold text-gray-900 leading-tight flex items-center gap-1">
                                    {row.name}
                                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </p>
                                  <p className="text-xs text-gray-400 md:hidden mt-0.5">{row.sku} · {row.category}</p>
                                </button>
                              </td>
                              <td className="py-3 pr-3 hidden md:table-cell">
                                <p className="text-xs font-mono text-gray-600">{row.sku}</p>
                                <p className="text-xs text-gray-400">{row.category}</p>
                              </td>
                              <td className="py-3 pr-3 text-right">
                                <span className="font-semibold text-gray-900">{row.required_qty}</span>
                                <span className="text-xs text-gray-400 ml-0.5">u</span>
                              </td>
                              <td className="py-3 pr-3 text-right">
                                <span className={`font-semibold ${row.available_stock === 0 ? 'text-red-600' : row.available_stock < 10 ? 'text-amber-600' : 'text-gray-900'}`}>
                                  {row.available_stock}
                                </span>
                              </td>
                              <td className="py-3 pr-3 text-right">
                                {isShortage ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg text-xs">
                                    <BadgeAlert className="w-3 h-3" /> −{row.gap}
                                  </span>
                                ) : isSurplus ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg text-xs">
                                    <BadgeCheck className="w-3 h-3" /> +{Math.abs(row.gap)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg text-xs">
                                    <CircleDot className="w-3 h-3" /> Exact
                                  </span>
                                )}
                              </td>
                              {mrpOptCols.has('unit_price') && (
                                <td className="py-3 pr-3 text-right hidden lg:table-cell text-gray-600 text-xs">{formatCurrency(row.unit_price)}</td>
                              )}
                              <td className="py-3 pr-3 text-right hidden lg:table-cell">
                                {isShortage
                                  ? <span className="text-sm font-semibold text-red-700">{formatCurrency(row.gap * row.unit_price)}</span>
                                  : <span className="text-sm text-gray-400">—</span>}
                              </td>
                              <td className="py-3 pr-3 hidden xl:table-cell">
                                {row.order_refs.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {row.order_refs.slice(0, 2).map(ref => (
                                      <button key={ref} onClick={() => setMrpOrderFilter(ref)}
                                        className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-1.5 py-0.5 rounded font-mono font-semibold transition-colors">
                                        {ref}
                                      </button>
                                    ))}
                                    {row.order_refs.length > 2 && <span className="text-xs text-gray-400">+{row.order_refs.length - 2}</span>}
                                  </div>
                                ) : <span className="text-xs text-gray-400">—</span>}
                              </td>
                              <td className="py-3 px-4">
                                {isShortage ? (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <button onClick={() => { setMrpSelected(new Set([row.product_id])); setPoModal(true) }}
                                      className="flex items-center gap-1 text-xs font-bold bg-primary hover:bg-primary/90 text-white px-2 py-1 rounded-lg transition-colors">
                                      <Truck className="w-2.5 h-2.5" /> PO
                                    </button>
                                    <button onClick={() => { setMrpSelected(new Set([row.product_id])); setProdTab('new'); setProdModal(true) }}
                                      className="flex items-center gap-1 text-xs font-bold bg-primary hover:bg-primary/90 text-white px-2 py-1 rounded-lg transition-colors">
                                      <Hammer className="w-2.5 h-2.5" /> Produce
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> OK
                                  </span>
                                )}
                              </td>
                            </tr>
                            {/* Expanded detail row */}
                            {isExpanded && (
                              <tr key={`${row.product_id}-detail`} className="bg-accent/70">
                                <td colSpan={10} className="px-6 py-4">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                                      <p className="text-gray-500 mb-1">Product ID</p>
                                      <p className="font-mono font-semibold text-gray-800">{row.product_id}</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                                      <p className="text-gray-500 mb-1">SKU</p>
                                      <p className="font-mono font-semibold text-gray-800">{row.sku || '—'}</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                                      <p className="text-gray-500 mb-1">Category</p>
                                      <p className="font-semibold text-gray-800 capitalize">{row.category || '—'}</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                                      <p className="text-gray-500 mb-1">Unit Price</p>
                                      <p className="font-semibold text-gray-800">{formatCurrency(row.unit_price)}</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                                      <p className="text-gray-500 mb-1">Total Shortage Value</p>
                                      <p className="font-bold text-red-700">{formatCurrency(Math.max(0, row.gap) * row.unit_price)}</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-gray-100 col-span-2 sm:col-span-3 lg:col-span-5">
                                      <p className="text-gray-500 mb-2">Order References ({row.order_refs.length})</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {row.order_refs.length > 0
                                          ? row.order_refs.map(ref => (
                                            <button key={ref} onClick={() => setMrpOrderFilter(ref)}
                                              className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 px-2 py-1 rounded-lg font-mono font-semibold transition-colors">
                                              📦 {ref}
                                            </button>
                                          ))
                                          : <span className="text-gray-400">No specific order refs (estimated from open orders)</span>}
                                      </div>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-gray-100 flex gap-2 col-span-2 sm:col-span-3 lg:col-span-5">
                                      <p className="text-gray-500 text-xs">Quick Actions:</p>
                                      <button onClick={() => { setMrpSelected(new Set([row.product_id])); setPoModal(true) }}
                                        className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                        <Truck className="w-3 h-3" /> Create Purchase Order
                                      </button>
                                      <button onClick={() => { setMrpSelected(new Set([row.product_id])); setProdTab('new'); setProdModal(true) }}
                                        className="text-xs font-bold text-primary bg-accent hover:bg-primary/12 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                        <Factory className="w-3 h-3" /> Plan Production
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                      {mrpFiltered.length === 0 && (
                        <tr><td colSpan={10} className="text-center py-14 text-gray-400">
                          <ClipboardList className="w-9 h-9 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No materials match the current filters.</p>
                        </td></tr>
                      )}
                    </tbody>
                  </ResizableTable>
                </div>
                {mrpFiltered.length > 0 && (
                  <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gray-50 border-t text-xs text-gray-600">
                    <span>{mrpFiltered.length} items shown</span>
                    <span className="text-red-600 font-semibold">{mrpFiltered.filter(r => r.gap > 0).length} shortages</span>
                    <span className="text-green-600 font-semibold">{mrpFiltered.filter(r => r.gap <= 0).length} sufficient</span>
                    <span className="ml-auto font-semibold text-gray-800">
                      Shortage value: {formatCurrency(mrpFiltered.filter(r => r.gap > 0).reduce((s, r) => s + r.gap * r.unit_price, 0))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Purchase Order Modal (enhanced) ─────────────────────────────── */}
      {poModal && (
        <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm backdrop-blur-sm overflow-y-auto" onClick={() => setPoModal(false)}>
          <div className="bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="p-2 bg-blue-100 rounded-xl"><Truck className="w-5 h-5 text-blue-600" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2">

                  <div className="flex items-start justify-between gap-3 mb-4">

                    <div className="min-w-0"><h2 className="font-bold text-gray-900">Create Purchase Order</h2></div>

                    <button type="button" aria-label="Close"
                type="button"
                onClick={() => setPoModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

                  </div>
                  <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg">{poRef}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{poLines.length} line item{poLines.length !== 1 ? 's' : ''} · {formatCurrency(poLines.reduce((s, l) => s + l.qty * l.unit_price, 0))} total</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setPoModal(false)} className="p-2 hover:bg-blue-100 rounded-xl transition-colors">
                <X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Supplier with autocomplete */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Supplier Name</label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-400">
                    <Search className="w-3.5 h-3.5 text-gray-400 ml-3 shrink-0" />
                    <input
                      value={poSupplier}
                      onChange={e => { setPoSupplier(e.target.value); setPoSupplierOpen(true) }}
                      onFocus={() => setPoSupplierOpen(true)}
                      placeholder="Search or type supplier name…"
                      className="flex-1 px-3 py-2 text-sm outline-none"
                      list="supplier-list"
                    />
                    {poSupplier && <button type="button" aria-label="Close" onClick={() => setPoSupplier('')} className="pr-3">
                <X className="w-3 h-3 text-gray-400" /></button>}
                  </div>
                  <datalist id="supplier-list">
                    {savedSuppliers.map(s => <option key={s} value={s} />)}
                  </datalist>
                  {/* Recent suppliers dropdown */}
                  {poSupplierOpen && savedSuppliers.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-[90vh] overflow-y-auto">
                      <p className="text-xs font-bold text-gray-400 uppercase px-3 pt-2 pb-1">Recent Suppliers</p>
                      {savedSuppliers.filter(s => !poSupplier || s.toLowerCase().includes(poSupplier.toLowerCase())).slice(0, 6).map(s => (
                        <button key={s} onClick={() => { setPoSupplier(s); setPoSupplierOpen(false) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-700 font-medium">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {poSupplierOpen && <div className="fixed inset-0 z-20" onClick={() => setPoSupplierOpen(false)} />}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Expected Delivery</label>
                  <input type="date" value={poDelivery} onChange={e => setPoDelivery(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Payment Terms</label>
                  <select value={poPaymentTerms} onChange={e => setPoPaymentTerms(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>Net 30</option><option>Net 15</option><option>Net 60</option>
                    <option>Immediate</option><option>50% Advance + 50% Delivery</option><option>Cash on Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">PO Reference</label>
                  <input value={poRef} onChange={e => setPoRef(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              {/* Line items */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5"><PackagePlus className="w-3.5 h-3.5 text-blue-500" /> Items to Order</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <ResizableTable tableId="rpt-po-lines" defaultWidths={[200, 90, 100, 100]}>
                    <thead className="bg-gray-50 border-b"><tr className="text-xs font-medium text-gray-500 uppercase">
                      <th className="py-2 px-3 text-left"><TableColumnLabel>Product</TableColumnLabel></th>
                      <th className="py-2 px-3 text-right"><TableColumnLabel>Qty</TableColumnLabel></th>
                      <th className="py-2 px-3 text-right"><TableColumnLabel>Unit Price</TableColumnLabel></th>
                      <th className="py-2 px-3 text-right"><TableColumnLabel>Line Total</TableColumnLabel></th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {poLines.map(l => (
                        <tr key={l.product_id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-medium">{l.name}</td>
                          <td className="py-2.5 px-3 text-right">
                            <input type="number" min={1} defaultValue={l.qty}
                              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">{formatCurrency(l.unit_price)}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-blue-700">{formatCurrency(l.qty * l.unit_price)}</td>
                        </tr>
                      ))}
                      {poLines.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-xs">No shortage items selected. Go back and select shortage rows.</td></tr>}
                    </tbody>
                    {poLines.length > 0 && (
                      <tfoot className="bg-blue-50 border-t">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 text-right text-xs font-bold text-gray-600 uppercase">Grand Total</td>
                          <td className="py-2.5 px-3 text-right font-bold text-blue-800 text-base">{formatCurrency(poLines.reduce((s, l) => s + l.qty * l.unit_price, 0))}</td>
                        </tr>
                      </tfoot>
                    )}
                  </ResizableTable>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes / Special Requirements</label>
                <textarea value={poNotes} onChange={e => setPoNotes(e.target.value)} rows={2}
                  placeholder="Delivery instructions, quality requirements, packaging notes…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setPoModal(false)}
                  className="btn-cancel flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 transition-colors">
                  Cancel
                </button>
                <button onClick={createPO}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2">
                  <Truck className="w-4 h-4" /> Create PO &amp; Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Production Plan Modal ─────────────────────────────────────────── */}
      {prodModal && (
        <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm backdrop-blur-sm overflow-y-auto" onClick={() => setProdModal(false)}>
          <div className="bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-accent to-primary/10 sticky top-0 z-10">
              <div className="p-2 bg-primary/12 rounded-xl"><Factory className="w-5 h-5 text-primary" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900">Production Order</h2>
                  <span className="text-xs font-mono bg-primary/12 text-primary px-2 py-0.5 rounded-lg">{prodRef}</span>
                </div>
              </div>
              {/* Tabs */}
              <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 gap-0.5">
                {(['new','history'] as const).map(t => (
                  <button key={t} onClick={() => setProdTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${prodTab === t ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t === 'new' ? '+ New Order' : `📋 History (${prodHistory.length})`}
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Close" onClick={() => setProdModal(false)} className="p-2 hover:bg-primary/12 rounded-xl transition-colors ml-2">
                <X className="w-4 h-4 text-gray-500" /></button>
            </div>

            {prodTab === 'new' ? (
              <div className="p-6 space-y-5">
                {/* Template picker */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Order Template</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROD_TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => { setProdTemplate(t.id); if (t.defaultNotes) setProdNotes(t.defaultNotes) }}
                        className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                          prodTemplate === t.id ? 'border-primary/60 bg-accent' : 'border-gray-200 hover:border-primary/30 hover:bg-accent/50'
                        }`}>
                        <span className="text-lg leading-none">{t.emoji}</span>
                        <div>
                          <p className={`text-xs font-medium leading-tight ${prodTemplate === t.id ? 'text-primary' : 'text-gray-700'}`}>{t.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5 leading-tight">{t.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Order details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Work Order Ref</label>
                    <input value={prodRef} onChange={e => setProdRef(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Team / Department</label>
                    <input value={prodTeam} onChange={e => setProdTeam(e.target.value)} placeholder="e.g. Assembly Line A"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Target Completion Date</label>
                    <input type="date" value={prodTarget} onChange={e => setProdTarget(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                    <select value={prodStatus} onChange={e => setProdStatus(e.target.value as typeof prodStatus)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="draft">📝 Draft</option>
                      <option value="in_progress">🔄 In Progress</option>
                      <option value="on_hold">⏸ On Hold</option>
                      <option value="completed">✅ Completed</option>
                    </select>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">Completion Progress</label>
                    <span className="text-xs font-bold text-primary">{prodProgress}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={prodProgress} onChange={e => setProdProgress(Number(e.target.value))}
                    className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                </div>

                {/* Items to produce */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5"><Hammer className="w-3.5 h-3.5 text-primary/80" /> Items to Manufacture</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <ResizableTable tableId="rpt-manufacture" defaultWidths={[220, 90, 100]}>
                      <thead className="bg-gray-50 border-b"><tr className="text-xs font-medium text-gray-500 uppercase">
                        <th className="py-2 px-3 text-left"><TableColumnLabel>Product</TableColumnLabel></th>
                        <th className="py-2 px-3 text-right"><TableColumnLabel>Qty</TableColumnLabel></th>
                        <th className="py-2 px-3 text-right hidden sm:table-cell"><TableColumnLabel>Priority</TableColumnLabel></th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {prodLines.map((l, i) => (
                          <tr key={l.product_id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3 font-medium">{l.name}</td>
                            <td className="py-2.5 px-3 text-right">
                              <input type="number" min={1} defaultValue={l.qty}
                                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                            </td>
                            <td className="py-2.5 px-3 text-right hidden sm:table-cell">
                              <select defaultValue={i === 0 ? 'high' : 'medium'}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                                <option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">🟢 Low</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                        {prodLines.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-6 text-gray-400 text-xs">Select items in the MRP table first, then open this modal.</td></tr>
                        )}
                      </tbody>
                    </ResizableTable>
                  </div>
                </div>

                {/* Stock dispatches */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5">
                    <PackagePlus className="w-3.5 h-3.5 text-green-500" /> Stock Dispatches from Production
                  </p>
                  {stockDispatches.length > 0 && (
                    <div className="mb-3 border border-gray-200 rounded-xl overflow-hidden">
                      <ResizableTable tableId="rpt-stock-dispatches" defaultWidths={[120, 80, 120, 160, 40]}>
                        <thead className="bg-gray-50 border-b"><tr className="font-semibold text-gray-500 uppercase">
                          <th className="py-2 px-3 text-left"><TableColumnLabel>Date</TableColumnLabel></th>
                          <th className="py-2 px-3 text-right"><TableColumnLabel>Qty</TableColumnLabel></th>
                          <th className="py-2 px-3"><TableColumnLabel>Dispatched By</TableColumnLabel></th>
                          <th className="py-2 px-3"><TableColumnLabel>Notes</TableColumnLabel></th>
                          <th className="py-2 px-2 w-8" />
                        </tr></thead>
                        <tbody className="divide-y">
                          {stockDispatches.map(d => (
                            <tr key={d.id} className="hover:bg-gray-50">
                              <td className="py-2 px-3 text-gray-600">{d.date}</td>
                              <td className="py-2 px-3 text-right font-semibold text-green-700">{d.qty}</td>
                              <td className="py-2 px-3 text-gray-600">{d.dispatchedBy || '—'}</td>
                              <td className="py-2 px-3 text-gray-500">{d.notes || '—'}</td>
                              <td className="py-2 px-2">
                                <button type="button" aria-label="Close" onClick={() => setStockDispatches(prev => prev.filter(x => x.id !== d.id))}>
                <X className="w-3 h-3 text-red-400 hover:text-red-600" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-green-50 border-t">
                          <tr><td colSpan={2} className="py-2 px-3 text-right text-xs font-bold text-green-800">
                            Total Dispatched: {stockDispatches.reduce((s, d) => s + d.qty, 0)} units
                          </td><td colSpan={3} /></tr>
                        </tfoot>
                      </ResizableTable>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <input type="number" min={1} value={dispatchQty} onChange={e => setDispatchQty(e.target.value)}
                      placeholder="Qty to stock" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-green-400" />
                    <input value={dispatchBy} onChange={e => setDispatchBy(e.target.value)}
                      placeholder="Dispatched by" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-green-400" />
                    <input value={dispatchNotes} onChange={e => setDispatchNotes(e.target.value)}
                      placeholder="Notes" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-green-400" />
                    <button onClick={addStockDispatch}
                      className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>

                {/* File attachments */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-gray-400" /> Attachments (images, documents)
                  </p>
                  {prodAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {prodAttachments.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs">
                          {a.type.startsWith('image/') ? (
                            <ClickableImageButton
                              src={a.dataUrl}
                              alt={a.name}
                              title="View image"
                              className="w-8 h-8 rounded-lg shrink-0"
                              imgClassName="w-8 h-8 object-cover rounded-lg"
                              onClick={() => setProdAttachLightboxIndex(
                                prodAttachments.slice(0, i).filter((x) => x.type.startsWith('image/')).length,
                              )}
                            />
                          ) : (
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate max-w-[120px]">{a.name}</p>
                            <p className="text-gray-400">{(a.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button type="button" aria-label="Close" onClick={(e) => { e.stopPropagation(); setProdAttachments(prev => prev.filter((_, j) => j !== i)) }}>
                <X className="w-3 h-3 text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <ImageLightboxSession
                    items={prodLightboxItems}
                    openIndex={prodAttachLightboxIndex}
                    onClose={() => setProdAttachLightboxIndex(null)}
                  />
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border border-dashed border-gray-300 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors">
                    <Plus className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Click to attach images or documents</span>
                    <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleProdAttachFile} className="hidden" />
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Instructions / Notes</label>
                  <textarea value={prodNotes} onChange={e => setProdNotes(e.target.value)} rows={3}
                    placeholder="Raw materials needed, machine assignments, quality checks, safety notes…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setProdModal(false)}
                    className="btn-cancel flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 transition-colors">
                    Cancel
                  </button>
                  <button onClick={saveProdHistoryEntry}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2">
                    <Factory className="w-4 h-4" /> Save &amp; Download Order
                  </button>
                </div>
              </div>
            ) : (
              /* ── History tab ── */
              <div className="p-6 space-y-3">
                {prodHistory.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Factory className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No production orders saved yet.</p>
                  </div>
                ) : prodHistory.map(entry => (
                  <div key={entry.id} className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-primary">{entry.orderNo}</span>
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">{entry.template}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            entry.status === 'completed' ? 'bg-green-100 text-green-800' :
                            entry.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            entry.status === 'on_hold' ? 'bg-amber-100 text-amber-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>{entry.status.replace('_', ' ')}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {entry.items.length} items · Team: {entry.team || '—'} · Target: {entry.targetDate}
                          · Created: {new Date(entry.createdAt).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                      {/* Progress bar */}
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${entry.progress}%` }} />
                        </div>
                        <span className="text-xs font-bold text-primary w-8 text-right">{entry.progress}%</span>
                      </div>
                      <button onClick={() => setViewHistoryEntry(viewHistoryEntry?.id === entry.id ? null : entry)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors ml-1">
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${viewHistoryEntry?.id === entry.id ? 'rotate-180' : ''}`} />
                      </button>
                      <button onClick={() => deleteProdHistory(entry.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                      </button>
                    </div>
                    {viewHistoryEntry?.id === entry.id && (
                      <div className="px-4 pb-4 pt-3 space-y-3 border-t">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div><p className="text-gray-500">Items</p>{entry.items.map(i => <p key={i.product_id} className="font-semibold">{i.name} × {i.qty}</p>)}</div>
                          <div><p className="text-gray-500">Status</p><p className="font-semibold capitalize">{entry.status.replace('_',' ')}</p></div>
                          <div><p className="text-gray-500">Progress</p><p className="font-semibold text-primary">{entry.progress}%</p></div>
                          <div><p className="text-gray-500">Stock Dispatched</p><p className="font-semibold text-green-700">{entry.stockDispatches.reduce((s, d) => s + d.qty, 0)} units</p></div>
                        </div>
                        {entry.attachments.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Attachments ({entry.attachments.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {entry.attachments.map((a, i) => (
                                <a key={i} href={a.dataUrl} download={a.name}
                                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 transition-colors">
                                  {a.type.startsWith('image/') ? '🖼' : '📄'} {a.name}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {entry.notes && <div><p className="text-xs text-gray-500 mb-1">Notes</p><p className="text-xs text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{entry.notes}</p></div>}
                        <button onClick={() => {
                          exportXLS(`${entry.orderNo}-production-order.xls`,
                            ['Work Order', 'Template', 'Item', 'Qty', 'Team', 'Target Date', 'Status', 'Progress'],
                            entry.items.map(l => [entry.orderNo, entry.template, l.name, l.qty, entry.team, entry.targetDate, entry.status, `${entry.progress}%`]),
                          ); toast.success('Production order downloaded.')
                        }} className="flex items-center gap-1.5 text-xs font-bold text-primary bg-accent hover:bg-primary/12 px-3 py-2 rounded-lg transition-colors">
                          <Download className="w-3.5 h-3.5" /> Re-download Order
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
