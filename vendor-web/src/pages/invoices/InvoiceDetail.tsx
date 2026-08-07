import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useStoreName } from '@/components/common/BusinessUnitSelect'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { useUpdateInvoice, useInvoiceSettings, useQuotationSettings } from '@/hooks/useVendor'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import apiClient from '@/api/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, Download, FileText, Printer,
  IndianRupee, Calendar, User, Phone, Mail, Building2,
  Hash, MapPin, Pencil, Save, X, Plus, Trash2, CalendarDays, ShoppingBag, Settings2,
  MessageCircle, MessageSquare, Share2, Eye,
  Minimize2, Maximize2, PanelLeft, PanelRight,
} from 'lucide-react'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { printInvoice, generateInvoiceHtml, DEFAULT_INVOICE_SETTINGS, DEFAULT_QUOTATION_SETTINGS, loadPosInvoiceSettings, resolveInvoiceTemplateLogoPath } from '@/lib/invoiceTemplates'
import type { InvoiceSettings } from '@/lib/invoiceTemplates'
import {
  invoiceBadgeClass,
  invoiceRefLinkClass,
  invoiceStatusBadge,
  invoiceTypeBadge,
} from '@/lib/invoiceBadges'
import { fetchAsDataUrl, downloadAsPdf, shareViaWhatsApp, shareViaSms, buildShareMessage } from '@/lib/printUtils'
import { QuotationExtraFieldsEditor, QuotationExtraFieldsDisplay } from '@/components/quotations/QuotationExtraFieldsEditor'
import {
  normalizeQuotationExtraFields,
  serializeQuotationExtraFields,
  type QuotationExtraField,
} from '@/types/quotation'

interface LineItem {
  name: string
  hsn_sac: string
  qty: number
  rate: number
  tax_rate: number
}

async function downloadPdf(id: string, invoiceNumber: string) {
  try {
    const res = await apiClient.get(`/vendors/me/invoices/${id}/pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${(invoiceNumber || id).replace(/\//g, '-')}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch {
    toast.error('Could not download invoice PDF — try again or use Print Invoice instead')
  }
}

async function printWithTemplate(inv: Record<string, unknown>, invSettings: InvoiceSettings) {
  await printInvoice(inv, invSettings)
}

async function downloadInvoicePdf(inv: Record<string, unknown>, invSettings: InvoiceSettings) {
  // Merge with defaults first — same as printInvoice — so template/color are always set.
  const s = { ...DEFAULT_INVOICE_SETTINGS, ...invSettings }
  const rawLogo = resolveInvoiceTemplateLogoPath(s, inv.vendor_logo_url as string)
  const rawSig  = s.signature_url || ''
  const [logoDataUrl, sigDataUrl] = await Promise.all([
    s.show_logo      && rawLogo ? fetchAsDataUrl(rawLogo) : Promise.resolve(''),
    s.show_signature && rawSig  ? fetchAsDataUrl(rawSig)  : Promise.resolve(''),
  ])
  const enriched: InvoiceSettings = { ...s, logo_url: logoDataUrl || undefined, signature_url: sigDataUrl || undefined }
  const html = generateInvoiceHtml({ ...inv, vendor_logo_url: logoDataUrl || inv.vendor_logo_url }, enriched, '')
  const filename = `${String(inv.invoice_number || 'invoice').replace(/\//g, '-')}.pdf`
  await downloadAsPdf(html, filename, { margin: s.pdf_margin ?? 5, orientation: s.pdf_orientation ?? 'portrait', imageQuality: s.pdf_image_quality ?? 0.98 })
}

function InfoRow({ icon: Icon, label, value, compact }: { icon: React.ElementType; label: string; value?: string | null; compact?: boolean }) {
  if (!value) return null
  if (compact) {
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 flex items-center gap-1 mb-0.5">
          <Icon className="w-3 h-3 shrink-0" /> {label}
        </p>
        <p className="text-xs text-gray-700 break-words leading-snug">{value}</p>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-gray-700">{value}</p>
      </div>
    </div>
  )
}

function formatAddressLine(address?: Record<string, string> | null): string | null {
  if (!address || typeof address !== 'object') return null
  const street = address.street_address || address.street || address.address_line1 || address.line1
  const line2 = address.line2 || address.address_line2
  const state = address.state || address.region
  const parts = [
    street,
    line2,
    address.city,
    state,
    address.postal_code || address.pincode || address.zip,
    address.country,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

function hasAddressData(address?: Record<string, string> | null): boolean {
  return !!(formatAddressLine(address) || addressMetaLine(address))
}

function resolveDocSettings(inv: Record<string, unknown>, base: InvoiceSettings): InvoiceSettings {
  const ship = inv.shipping_address as Record<string, string> | undefined
  if (hasAddressData(ship)) {
    return { ...base, show_shipping_address: true }
  }
  return base
}

function addressMetaLine(address?: Record<string, string> | null): string | null {
  if (!address || typeof address !== 'object') return null
  const bits = [address.label, address.phone].map(v => (v || '').trim()).filter(Boolean)
  return bits.length > 0 ? bits.join(' · ') : null
}

function AddressBlock({ label, address, compact }: { label: string; address?: Record<string, string> | null; compact?: boolean }) {
  const line = formatAddressLine(address)
  const meta = addressMetaLine(address)
  if (!line && !meta) return null
  if (compact) {
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 flex items-center gap-1 mb-0.5">
          <MapPin className="w-3 h-3 shrink-0" /> {label}
        </p>
        {meta && <p className="text-[10px] text-gray-500 mb-0.5">{meta}</p>}
        {line && <p className="text-xs text-gray-700 break-words leading-snug">{line}</p>}
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {label}</p>
      {meta && <p className="text-xs text-gray-500 mb-0.5">{meta}</p>}
      {line && <p className="text-sm text-gray-700">{line}</p>}
    </div>
  )
}

function ContactMetaCard({
  title,
  titleIcon: TitleIcon,
  titleIconClass,
  children,
}: {
  title: string
  titleIcon: React.ElementType
  titleIconClass: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border p-3 space-y-2">
      <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
        <TitleIcon className={`w-3.5 h-3.5 ${titleIconClass}`} /> {title}
      </h3>
      {children}
    </div>
  )
}

function lineTaxRate(item: Record<string, unknown>): number {
  const direct = Number(item.tax_rate || item.gst_rate || 0)
  if (direct > 0) return direct
  const igst = Number(item.igst_rate || 0)
  if (igst > 0) return igst
  return Number(item.cgst_rate || 0) + Number(item.sgst_rate || 0)
}

function lineTaxable(item: Record<string, unknown>): number {
  const qty = Number(item.qty || item.quantity || 0)
  const rate = Number(item.rate || item.price || 0)
  const discount = Number(item.discount || 0)
  return qty * rate - discount
}

function lineTaxAmount(item: Record<string, unknown>): number {
  const fromGst = Number(item.cgst_amt || 0) + Number(item.sgst_amt || 0) + Number(item.igst_amt || 0)
  if (fromGst > 0) return fromGst
  const taxable = lineTaxable(item)
  const taxRate = lineTaxRate(item)
  if (taxRate <= 0) return 0
  return taxable * taxRate / 100
}

function lineAmount(item: Record<string, unknown>): number {
  const taxable = lineTaxable(item)
  const tax = lineTaxAmount(item)
  if (tax > 0) return taxable + tax
  const stored = Number(item.total || 0)
  return stored > 0 ? stored : taxable
}

function parseLineItems(rawItems: Array<Record<string, unknown>>): LineItem[] {
  return rawItems.map(item => ({
    name: String(item.name || item.description || ''),
    hsn_sac: String(item.hsn_sac || item.hsn_code || item.sac_code || ''),
    qty: Number(item.qty || item.quantity || 0),
    rate: Number(item.rate || item.price || 0),
    tax_rate: lineTaxRate(item),
  }))
}

function emptyLineItem(): LineItem {
  return { name: '', hsn_sac: '', qty: 1, rate: 0, tax_rate: 0 }
}

type PanelFocus = 'split' | 'details' | 'preview'

function PanelSectionHeader({
  title,
  icon: Icon,
  focus,
  panel,
  onToggle,
}: {
  title: string
  icon: React.ElementType
  focus: PanelFocus
  panel: 'details' | 'preview'
  onToggle: () => void
}) {
  const isFull = focus === panel
  const isHidden = focus === (panel === 'details' ? 'preview' : 'details')
  if (isHidden) return null

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-800 truncate">{title}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs shrink-0 text-gray-600 hover:text-gray-900"
        onClick={onToggle}
        title={isFull ? 'Show split view' : panel === 'details' ? 'Minimize details — full PDF' : 'Minimize PDF — full details'}
      >
        {isFull ? (
          <>
            <Maximize2 className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Split view</span>
          </>
        ) : (
          <>
            <Minimize2 className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Minimize</span>
          </>
        )}
      </Button>
    </div>
  )
}

function CollapsedPanelTab({
  label,
  icon: Icon,
  onClick,
  side,
}: {
  label: string
  icon: React.ElementType
  onClick: () => void
  side: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hidden lg:flex flex-col items-center justify-center gap-1 w-10 shrink-0 rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 text-gray-500 hover:text-blue-700 transition-colors py-4 ${
        side === 'left' ? 'order-1' : 'order-3'
      }`}
      title={`Show ${label}`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[10px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
        {label}
      </span>
    </button>
  )
}

function InvoiceDocumentPreview({
  html,
  loading,
  title,
  onPrint,
  onDownload,
  actionsDisabled,
  compact,
  focus,
  onTogglePanel,
}: {
  html: string
  loading: boolean
  title: string
  onPrint: () => void
  onDownload: () => void
  actionsDisabled?: boolean
  compact?: boolean
  focus?: PanelFocus
  onTogglePanel?: () => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [frameHeight, setFrameHeight] = useState(320)

  const resizeFrame = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return
    const h = doc.documentElement.scrollHeight || doc.body.scrollHeight
    setFrameHeight(Math.max(120, h + 8))
  }, [])

  useEffect(() => {
    if (!html) return
    const t = window.setTimeout(resizeFrame, 60)
    return () => window.clearTimeout(t)
  }, [html, resizeFrame])

  const openFullPreview = () => {
    if (!html) return
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }

  return (
    <div className={`flex flex-col h-full min-h-0 overflow-hidden border rounded-xl bg-white shadow-sm ${
      compact ? '' : 'h-[min(70dvh,640px)]'
    }`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-gray-50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-800 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onTogglePanel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-gray-600"
              onClick={onTogglePanel}
              title={focus === 'preview' ? 'Show split view' : 'Minimize PDF — full details'}
            >
              {focus === 'preview' ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
        {!compact && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs hidden sm:inline-flex"
              disabled={!html || loading}
              onClick={openFullPreview}
            >
              Open
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 sm:w-auto sm:px-3"
              disabled={actionsDisabled || loading}
              onClick={onPrint}
              title="Print"
            >
              <Printer className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline text-xs">Print</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 sm:w-auto sm:px-3"
              disabled={actionsDisabled || loading}
              onClick={onDownload}
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5 text-red-500 sm:mr-1" />
              <span className="hidden sm:inline text-xs">PDF</span>
            </Button>
          </div>
        )}
        {compact && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs shrink-0"
            disabled={!html || loading}
            onClick={openFullPreview}
          >
            Open full
          </Button>
        )}
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-slate-100 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[200px] text-gray-400">
            <Loader2 className="w-7 h-7 animate-spin" />
            <span className="text-sm">Loading preview…</span>
          </div>
        ) : !html ? (
          <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[200px] text-gray-400">
            <FileText className="w-9 h-9" />
            <span className="text-sm">Preview unavailable</span>
          </div>
        ) : (
          <div className="p-2 sm:p-3">
            <div className="bg-white shadow-md rounded-sm mx-auto w-full max-w-full ring-1 ring-black/5">
              <iframe
                ref={iframeRef}
                srcDoc={html}
                title={title}
                onLoad={resizeFrame}
                className="w-full border-0 block bg-white rounded-sm"
                style={{ height: `${frameHeight}px` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isQuotationRoute = location.pathname.startsWith('/quotations/')
  const updateInvoice = useUpdateInvoice()
  const { data: rawInvSettings, isLoading: invoiceSettingsLoading } = useInvoiceSettings()
  const { data: rawQuoteSettings, isLoading: quotationSettingsLoading } = useQuotationSettings()
  const settingsLoading = invoiceSettingsLoading || quotationSettingsLoading

  const invSettings = useMemo<InvoiceSettings>(() => {
    const baseDefaults = isQuotationRoute ? DEFAULT_QUOTATION_SETTINGS : DEFAULT_INVOICE_SETTINGS
    const raw = isQuotationRoute ? rawQuoteSettings : rawInvSettings
    return { ...baseDefaults, ...(raw as Partial<InvoiceSettings> || {}) }
  }, [rawInvSettings, rawQuoteSettings, isQuotationRoute])

  // Effective settings used for print/PDF — layered after inv loads so POS
  // overrides are applied only for POS receipts.
  const effectiveSettings = useCallback((invData?: Record<string, unknown>): InvoiceSettings => {
    const notes  = String((invData || {}).notes || '')
    const num    = String((invData || {}).invoice_number || '')
    const isPOS  = notes.includes('POS Transaction') || /^POS-/i.test(num)
    const pos    = isPOS ? loadPosInvoiceSettings() : {}
    return { ...invSettings, ...pos }
  }, [invSettings])

  const { data: inv, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => vendorApi.getInvoice(id!),
    enabled: !!id,
  })

  const isQuotation = isQuotationRoute || inv?.invoice_type === 'estimate'
  const listPath = isQuotation ? '/quotations' : '/invoices'
  const shareDocType = isQuotation ? 'quotation' as const : 'invoice' as const
  const storeName = useStoreName((inv as { store_id?: string } | undefined)?.store_id)
  /** Invoices created from a web-store / POS / booking order stay in sync with that order. */
  const isOrderLinked = Boolean((inv as { order_id?: string } | undefined)?.order_id)
  const canEditInvoice = Boolean(inv) && !isOrderLinked && inv?.status !== 'paid' && inv?.status !== 'cancelled'

  useEffect(() => {
    if (!inv || isLoading || !id) return
    if (inv.invoice_type === 'estimate' && location.pathname.startsWith('/invoices/')) {
      navigate(`/quotations/${id}`, { replace: true })
      return
    }
    if (inv.invoice_type !== 'estimate' && isQuotationRoute) {
      navigate(`/invoices/${id}`, { replace: true })
    }
  }, [inv, isLoading, id, location.pathname, isQuotationRoute, navigate])

  const [isEditing, setIsEditing] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerGstin, setCustomerGstin] = useState('')
  const [notes, setNotes] = useState('')
  const [editItems, setEditItems] = useState<LineItem[]>([])
  const [editExtraFields, setEditExtraFields] = useState<QuotationExtraField[]>([])
  const displayExtraFields = useMemo(
    () => normalizeQuotationExtraFields(inv?.extra_fields),
    [inv?.extra_fields],
  )

  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [panelFocus, setPanelFocus] = useState<PanelFocus>('split')
  const detailsScrollRef = useRef<HTMLDivElement>(null)

  const applyPanelFocus = useCallback((next: PanelFocus | ((prev: PanelFocus) => PanelFocus)) => {
    setPanelFocus(next)
    requestAnimationFrame(() => {
      detailsScrollRef.current?.scrollTo({ top: 0 })
    })
  }, [])

  const togglePdfPanel = useCallback(() => {
    applyPanelFocus(f => (f === 'split' ? 'details' : 'split'))
  }, [applyPanelFocus])

  const toggleDetailsPanel = useCallback(() => {
    applyPanelFocus(f => (f === 'split' ? 'preview' : 'split'))
  }, [applyPanelFocus])

  const showDetails = panelFocus !== 'preview'
  const showPreview = panelFocus !== 'details'

  const viewSortOptions = useMemo(() => [
    { value: 'name', label: 'Item' },
    { value: 'hsn_sac', label: 'HSN/SAC' },
    { value: 'qty', label: 'Qty' },
    { value: 'rate', label: 'Rate' },
    { value: 'tax_rate', label: 'Tax %' },
    { value: 'amount', label: 'Amount' },
  ], [])

  const viewAccessors = useMemo<Record<string, (r: Record<string, unknown>) => unknown>>(() => ({
    name: (r) => String(r.name || r.description || ''),
    hsn_sac: (r) => String(r.hsn_sac || r.hsn_code || r.sac_code || ''),
    qty: (r) => Number(r.qty || r.quantity || 0),
    rate: (r) => Number(r.rate || r.price || 0),
    tax_rate: (r) => lineTaxRate(r),
    amount: (r) => lineAmount(r),
  }), [])

  const viewTotals = useMemo(() => {
    if (!inv) {
      return { subtotal: 0, totalTax: 0, total: 0, balanceDue: 0, roundOff: 0, useComputed: false }
    }
    const items = (inv.items || []) as Array<Record<string, unknown>>
    let computedSubtotal = 0
    let computedTax = 0
    for (const item of items) {
      computedSubtotal += Number(item.qty || item.quantity || 0) * Number(item.rate || item.price || 0)
      computedTax += lineTaxAmount(item)
    }
    const storedTax = Number(inv.total_tax || 0)
    const useComputed = storedTax === 0 && computedTax > 0
    const discount = Number(inv.discount_amount || 0)
    const subtotal = useComputed ? computedSubtotal : Number(inv.subtotal || 0)
    const totalTax = useComputed ? computedTax : storedTax
    const roundOff = useComputed ? 0 : Number(inv.round_off || 0)
    const total = useComputed
      ? Math.round(subtotal - discount + totalTax)
      : Number(inv.total || 0)
    const amountPaid = Number(inv.amount_paid || 0)
    const balanceDue = useComputed ? total - amountPaid : Number(inv.balance_due || 0)
    return { subtotal, totalTax, total, balanceDue, roundOff, useComputed }
  }, [inv])

  const sortedViewItems = useMemo(
    () => processRows(inv?.items as Record<string, unknown>[] | undefined, '', () => [], sortKey, sortDir, viewAccessors),
    [inv?.items, sortKey, sortDir, viewAccessors],
  )

  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(true)

  useEffect(() => {
    if (!inv || settingsLoading) {
      setPreviewLoading(settingsLoading)
      return
    }
    let cancelled = false
    const run = async () => {
      setPreviewLoading(true)
      const invRecord = inv as Record<string, unknown>
      const s = resolveDocSettings(invRecord, effectiveSettings(invRecord))
      const rawLogo = resolveInvoiceTemplateLogoPath(s, inv.vendor_logo_url as string)
      const rawSig = s.signature_url || ''
      try {
        const [logoDataUrl, sigDataUrl] = await Promise.all([
          s.show_logo && rawLogo ? fetchAsDataUrl(rawLogo) : Promise.resolve(''),
          s.show_signature && rawSig ? fetchAsDataUrl(rawSig) : Promise.resolve(''),
        ])
        if (cancelled) return
        const enriched: InvoiceSettings = {
          ...s,
          logo_url: logoDataUrl || undefined,
          signature_url: sigDataUrl || undefined,
        }
        const html = generateInvoiceHtml(
          { ...invRecord, vendor_logo_url: logoDataUrl || inv.vendor_logo_url },
          enriched,
          '',
        )
        setPreviewHtml(html)
      } catch {
        if (!cancelled) setPreviewHtml('')
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [inv, settingsLoading, effectiveSettings])

  const startEditing = useCallback(() => {
    if (!inv || !canEditInvoice) return
    setCustomerName(inv.customer_name || '')
    setCustomerPhone(inv.customer_phone || '')
    setCustomerGstin(inv.customer_gstin || '')
    setNotes(inv.notes || '')
    setEditItems(parseLineItems(inv.items || []))
    setEditExtraFields(normalizeQuotationExtraFields(inv.extra_fields))
    setIsEditing(true)
  }, [inv, canEditInvoice])

  useEffect(() => {
    if (!canEditInvoice && isEditing) setIsEditing(false)
  }, [canEditInvoice, isEditing])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
  }, [])

  const updateItem = useCallback((index: number, field: keyof LineItem, value: string | number) => {
    setEditItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }, [])

  const addItem = useCallback(() => {
    setEditItems(prev => [...prev, emptyLineItem()])
  }, [])

  const removeItem = useCallback((index: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  const calculatedTotals = useMemo(() => {
    let subtotal = 0
    let totalTax = 0
    for (const item of editItems) {
      const lineTotal = item.qty * item.rate
      subtotal += lineTotal
      totalTax += lineTotal * (item.tax_rate / 100)
    }
    return {
      subtotal,
      totalTax,
      total: subtotal + totalTax,
    }
  }, [editItems])

  const handleSave = useCallback(() => {
    if (!id) return
    const validItems = editItems.filter(item => item.name.trim())
    if (validItems.length === 0) {
      toast.error('Add at least one line item')
      return
    }

    updateInvoice.mutate(
      {
        id,
        data: {
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_gstin: customerGstin,
          notes,
          items: validItems.map(item => ({
            name: item.name,
            hsn_sac: item.hsn_sac || undefined,
            qty: item.qty,
            rate: item.rate,
            tax_rate: item.tax_rate,
          })),
          ...(isQuotation ? { extra_fields: serializeQuotationExtraFields(editExtraFields) } : {}),
        },
      },
      {
        onSuccess: () => {
          setIsEditing(false)
        },
      },
    )
  }, [id, editItems, editExtraFields, isQuotation, customerName, customerPhone, customerGstin, notes, updateInvoice])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    )
  }

  if (!inv) {
    return (
      <div className="text-center py-20">
        <FileText className="w-14 h-14 text-gray-200 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900">{isQuotationRoute ? 'Quotation not found' : 'Invoice not found'}</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate(isQuotationRoute ? '/quotations' : '/invoices')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to {isQuotationRoute ? 'Quotations' : 'Invoices'}
        </Button>
      </div>
    )
  }

  const sb = invoiceStatusBadge[inv.status] || invoiceStatusBadge.draft
  const tb = invoiceTypeBadge[inv.invoice_type] || invoiceTypeBadge.invoice
  const items: Array<Record<string, unknown>> = inv.items || []
  const invRecord = inv as Record<string, unknown>
  const docSettings = resolveDocSettings(invRecord, effectiveSettings(invRecord))
  const docLabel = isQuotation ? 'Quotation' : 'Invoice'

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-7.5rem)] lg:max-h-[calc(100dvh-7.5rem)] lg:min-h-0 lg:overflow-hidden">
      {/* Page header + actions */}
      <div className="shrink-0 space-y-3">
      <div className="flex items-start gap-2 sm:gap-3">
        <Button variant="ghost" size="sm" className="shrink-0 mt-0.5 h-8 w-8 p-0" onClick={() => navigate(listPath)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-all">{inv.invoice_number}</h1>
            <div className="flex items-center gap-2">
              <span className={invoiceBadgeClass(tb)}>{tb.label}</span>
              <span className={invoiceBadgeClass(sb)}>{sb.label}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
            {inv.financial_year && (
              <p className="text-xs text-gray-400">FY {inv.financial_year}</p>
            )}
            {storeName && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <Building2 className="w-3 h-3" />{storeName}
              </span>
            )}
          </div>
        </div>
        {isEditing && (
          <div className="flex shrink-0 gap-2">
            <Button variant="cancel" size="sm" onClick={cancelEditing} disabled={updateInvoice.isPending}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateInvoice.isPending}>
              {updateInvoice.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Action toolbar — single horizontal line */}
      {!isEditing && (
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {canEditInvoice ? (
            <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs px-3" onClick={startEditing}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs px-3"
            disabled={settingsLoading}
            onClick={() => printWithTemplate(invRecord, docSettings)}>
            {settingsLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1.5" />} Print
          </Button>
          <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs px-3"
            disabled={settingsLoading}
            onClick={() => downloadInvoicePdf(invRecord, docSettings)}>
            {settingsLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5 text-red-500" />} Download PDF
          </Button>
          <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs px-3" onClick={() => {
            const msg = buildShareMessage({
              type: shareDocType,
              number: inv.invoice_number as string,
              vendorName: inv.vendor_name as string || '',
              customerOrSupplier: inv.customer_name as string || '',
              total: inv.total as number,
              date: inv.created_at ? new Date(inv.created_at as string).toLocaleDateString('en-IN') : '',
              status: inv.status as string,
              items: (inv.items as Array<Record<string,unknown>>)?.map(i => ({
                name: String(i.name || ''), qty: Number(i.qty || i.quantity || 0), amount: Number(i.total || 0),
              })),
            })
            shareViaWhatsApp(msg, inv.customer_phone as string)
          }}>
            <MessageCircle className="w-3.5 h-3.5 mr-1.5 text-green-600" /> WhatsApp
          </Button>
          <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs px-3" onClick={() => {
            const msg = buildShareMessage({
              type: shareDocType,
              number: inv.invoice_number as string,
              vendorName: inv.vendor_name as string || '',
              customerOrSupplier: inv.customer_name as string || '',
              total: inv.total as number,
              date: inv.created_at ? new Date(inv.created_at as string).toLocaleDateString('en-IN') : '',
            })
            shareViaSms(msg, inv.customer_phone as string)
          }}>
            <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> SMS
          </Button>
          <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs px-3" onClick={() => {
            const docLabelShare = isQuotation ? 'Quotation' : 'Invoice'
            if (navigator.share) {
              navigator.share({ title: `${docLabelShare} ${inv.invoice_number}`, text: `${docLabelShare} ${inv.invoice_number} — Total: ₹${inv.total}` }).catch(() => {})
            } else {
              navigator.clipboard.writeText(`${docLabelShare}: ${inv.invoice_number}\nTotal: ₹${inv.total}\nCustomer: ${inv.customer_name}`)
              toast.success(`${docLabelShare} details copied!`)
            }
          }}>
            <Share2 className="w-3.5 h-3.5 mr-1.5 text-primary" /> Share
          </Button>
          <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs px-3" onClick={() => navigate(isQuotation ? '/quotations/templates' : '/invoices/templates')}>
            <Settings2 className="w-3.5 h-3.5 mr-1.5" /> {isQuotation ? 'Templates' : 'Settings'}
          </Button>
        </div>
      )}

      {/* Mobile: restore hidden panel */}
      {panelFocus === 'preview' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="lg:hidden w-full h-9 text-xs"
          onClick={() => applyPanelFocus('split')}
        >
          <PanelLeft className="w-3.5 h-3.5 mr-1.5" /> Show invoice details
        </Button>
      )}
      {panelFocus === 'details' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="lg:hidden w-full h-9 text-xs"
          onClick={() => applyPanelFocus('split')}
        >
          <PanelRight className="w-3.5 h-3.5 mr-1.5" /> Show PDF preview
        </Button>
      )}
      </div>

      {/* Body: details + PDF preview — fills remaining viewport, scroll inside panels only */}
      <div className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-3 lg:overflow-hidden">
        {panelFocus === 'preview' && (
          <CollapsedPanelTab
            label="Details"
            icon={PanelLeft}
            side="left"
            onClick={() => applyPanelFocus('split')}
          />
        )}

        {showDetails && (
        <div
          className={`order-2 lg:order-1 flex flex-col min-h-0 min-w-0 h-full ${
            panelFocus === 'details' ? 'w-full flex-1' : 'w-full lg:w-1/2 lg:flex-1'
          }`}
        >
          <PanelSectionHeader
            title="Invoice Details"
            icon={FileText}
            focus={panelFocus}
            panel="details"
            onToggle={toggleDetailsPanel}
          />
          <div
            ref={detailsScrollRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-0.5 mt-3"
          >
      {/* Two-column: Customer & Vendor info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Customer */}
        <ContactMetaCard title="Bill To" titleIcon={User} titleIconClass="text-blue-500">
          {isEditing ? (
            <div className="space-y-2">
              <div>
                <Label htmlFor="customer_name" className="text-xs text-gray-500">Name</Label>
                <Input
                  id="customer_name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="h-9"
                />
              </div>
              <div>
                <Label htmlFor="customer_phone" className="text-xs text-gray-500">Phone</Label>
                <PhoneInput
                  id="customer_phone"
                  value={customerPhone}
                  onChange={setCustomerPhone}
                  defaultCountryIso="IN"
                  compactCountry
                  compact
                  subtleFeedback
                />
              </div>
              <div>
                <Label htmlFor="customer_gstin" className="text-xs text-gray-500">GSTIN</Label>
                <Input
                  id="customer_gstin"
                  value={customerGstin}
                  onChange={e => setCustomerGstin(e.target.value)}
                  placeholder="GSTIN"
                  className="h-9"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {inv.customer_name && (
                <p className="text-sm font-semibold text-gray-900 leading-snug">{inv.customer_name}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                <InfoRow compact icon={Mail} label="Email" value={inv.customer_email} />
                <InfoRow compact icon={Phone} label="Phone" value={inv.customer_phone} />
                <InfoRow compact icon={Building2} label="GSTIN" value={inv.customer_gstin} />
              </div>
              {hasAddressData(inv.billing_address) || hasAddressData(inv.shipping_address) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-gray-100">
                  <AddressBlock compact label="Billing Address" address={inv.billing_address} />
                  <AddressBlock compact label="Shipping Address" address={inv.shipping_address} />
                </div>
              ) : null}
            </div>
          )}
        </ContactMetaCard>

        {/* Vendor / Meta */}
        <ContactMetaCard title="From" titleIcon={Building2} titleIconClass="text-indigo-500">
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
              <InfoRow compact icon={Building2} label="Vendor" value={inv.vendor_name} />
              <InfoRow compact icon={Hash} label="GSTIN" value={inv.vendor_gstin} />
              <InfoRow compact icon={Calendar} label="Created" value={formatDate(inv.created_at)} />
              {inv.due_date && (
                <InfoRow
                  compact
                  icon={Calendar}
                  label={isQuotation ? 'Valid Until' : 'Due Date'}
                  value={formatDate(inv.due_date)}
                />
              )}
              {!isQuotation && inv.payment_terms && (
                <InfoRow compact icon={FileText} label="Payment Terms" value={inv.payment_terms} />
              )}
              {inv.place_of_supply && (
                <InfoRow compact icon={MapPin} label="Place of Supply" value={inv.place_of_supply} />
              )}
            </div>
            {inv.is_inter_state && (
              <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 w-fit">Inter-state supply (IGST)</p>
            )}
            {(inv as Record<string, unknown>).booking_id && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Linked Booking</p>
                <button
                  onClick={() => navigate(`/bookings/${(inv as Record<string, unknown>).booking_id}`)}
                  className={invoiceRefLinkClass}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  {String((inv as Record<string, unknown>).booking_number || (inv as Record<string, unknown>).booking_id)}
                </button>
              </div>
            )}
            {(inv as Record<string, unknown>).order_id && !(inv as Record<string, unknown>).booking_id && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Linked Order</p>
                <button
                  onClick={() => navigate(`/orders/${(inv as Record<string, unknown>).order_id}`)}
                  className={invoiceRefLinkClass}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {String((inv as Record<string, unknown>).order_number || (inv as Record<string, unknown>).order_id)}
                </button>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Created from an order — edit the order instead of this invoice.
                </p>
              </div>
            )}
          </div>
        </ContactMetaCard>
      </div>

      {/* Line Items */}
      {isEditing ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Items ({editItems.length})</h3>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </div>
          <div className="divide-y">
            {editItems.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No items yet.{' '}
                <button onClick={addItem} className="text-blue-500 hover:underline">Add one</button>
              </div>
            ) : (
              editItems.map((item, idx) => (
                <div key={idx} className="px-5 py-3 grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-12 sm:col-span-4">
                    <Label className="text-xs text-gray-500">Item Name</Label>
                    <Input
                      value={item.name}
                      onChange={e => updateItem(idx, 'name', e.target.value)}
                      placeholder="Item name"
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Label className="text-xs text-gray-500">HSN/SAC</Label>
                    <Input
                      value={item.hsn_sac}
                      onChange={e => updateItem(idx, 'hsn_sac', e.target.value)}
                      placeholder="HSN/SAC"
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-1">
                    <Label className="text-xs text-gray-500">Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.qty}
                      onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Label className="text-xs text-gray-500">Rate</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.rate}
                      onChange={e => updateItem(idx, 'rate', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-1">
                    <Label className="text-xs text-gray-500">Tax %</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.tax_rate}
                      onChange={e => updateItem(idx, 'tax_rate', Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-1 text-right">
                    <Label className="text-xs text-gray-500">Amount</Label>
                    <p className="text-sm font-medium h-9 flex items-center justify-end">{formatCurrency(item.qty * item.rate)}</p>
                  </div>
                  <div className="col-span-6 sm:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Items ({inv.item_count || items.length})</h3>
          </div>
          <TableToolbar
            search=""
            onSearchChange={() => {}}
            hideSearch
            sortOptions={viewSortOptions}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            className="py-2"
          />
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b text-xs text-gray-500 uppercase">
                <th className="text-left px-5 py-2.5 font-semibold"><TableColumnLabel>#</TableColumnLabel></th>
                <th className="text-left px-5 py-2.5 font-semibold"><TableColumnLabel>Item</TableColumnLabel></th>
                <th className="text-left px-5 py-2.5 font-semibold"><TableColumnLabel>HSN/SAC</TableColumnLabel></th>
                <th className="text-right px-5 py-2.5 font-semibold"><TableColumnLabel>Qty</TableColumnLabel></th>
                <th className="text-right px-5 py-2.5 font-semibold"><TableColumnLabel>Rate</TableColumnLabel></th>
                <th className="text-right px-5 py-2.5 font-semibold"><TableColumnLabel>Tax %</TableColumnLabel></th>
                <th className="text-right px-5 py-2.5 font-semibold"><TableColumnLabel>Amount</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedViewItems.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-400">No line items</td></tr>
              ) : sortedViewItems.map((item, idx) => {
                const qty = Number(item.qty || item.quantity || 0)
                const rate = Number(item.rate || item.price || 0)
                const taxRate = lineTaxRate(item)
                const lineTotal = lineAmount(item)
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm text-gray-400">{idx + 1}</td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{String(item.name || item.description || '-')}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{String(item.hsn_sac || item.hsn_code || item.sac_code || '-')}</td>
                    <td className="px-5 py-3 text-sm text-right">{qty}</td>
                    <td className="px-5 py-3 text-sm text-right">{formatCurrency(rate)}</td>
                    <td className="px-5 py-3 text-sm text-right">{taxRate > 0 ? `${taxRate}%` : '-'}</td>
                    <td className="px-5 py-3 text-sm text-right font-medium">{formatCurrency(lineTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="flex justify-stretch sm:justify-end">
        <div className="bg-white rounded-xl border p-4 sm:p-5 w-full sm:max-w-sm space-y-2">
          {isEditing ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(calculatedTotals.subtotal)}</span>
              </div>
              {calculatedTotals.totalTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Tax</span>
                  <span>{formatCurrency(calculatedTotals.totalTax)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span className="flex items-center gap-1"><IndianRupee className="w-4 h-4" /> Total</span>
                <span>{formatCurrency(calculatedTotals.total)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(viewTotals.subtotal)}</span>
              </div>
              {inv.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-red-500">-{formatCurrency(inv.discount_amount)}</span>
                </div>
              )}
              {inv.is_gst && !inv.is_inter_state && !viewTotals.useComputed && (
                <>
                  {inv.cgst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">CGST</span>
                      <span>{formatCurrency(inv.cgst_amount)}</span>
                    </div>
                  )}
                  {inv.sgst_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">SGST</span>
                      <span>{formatCurrency(inv.sgst_amount)}</span>
                    </div>
                  )}
                </>
              )}
              {inv.is_gst && inv.is_inter_state && !viewTotals.useComputed && inv.igst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IGST</span>
                  <span>{formatCurrency(inv.igst_amount)}</span>
                </div>
              )}
              {viewTotals.totalTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Tax</span>
                  <span>{formatCurrency(viewTotals.totalTax)}</span>
                </div>
              )}
              {viewTotals.roundOff !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Round Off</span>
                  <span>{formatCurrency(viewTotals.roundOff)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span className="flex items-center gap-1"><IndianRupee className="w-4 h-4" /> Total</span>
                <span>{formatCurrency(viewTotals.total)}</span>
              </div>
              {!isQuotation && (inv.amount_paid > 0 || viewTotals.balanceDue > 0) && (
                <>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-gray-500">Amount Paid</span>
                    <span className="text-green-600 font-medium">{formatCurrency(inv.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Balance Due</span>
                    <span className={`font-bold ${viewTotals.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(viewTotals.balanceDue)}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quotation extra fields */}
      {isQuotation && isEditing && (
        <div className="bg-white rounded-xl border p-5">
          <QuotationExtraFieldsEditor fields={editExtraFields} onChange={setEditExtraFields} />
        </div>
      )}
      {isQuotation && !isEditing && displayExtraFields.length > 0 && (
        <QuotationExtraFieldsDisplay fields={displayExtraFields} />
      )}

      {/* Notes & Terms */}
      {isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-5">
            <Label htmlFor="notes" className="text-sm font-semibold text-gray-700 mb-2 block">Notes</Label>
            <textarea
              id="notes"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px] resize-y"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..."
            />
          </div>
          {inv.terms_and_conditions && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{inv.terms_and_conditions}</p>
            </div>
          )}
        </div>
      ) : (
        (inv.notes || inv.terms_and_conditions) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {inv.notes && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{inv.notes}</p>
              </div>
            )}
            {inv.terms_and_conditions && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{inv.terms_and_conditions}</p>
              </div>
            )}
          </div>
        )
      )}
          </div>
        </div>
        )}

        {panelFocus === 'details' && (
          <CollapsedPanelTab
            label="PDF"
            icon={PanelRight}
            side="right"
            onClick={() => applyPanelFocus('split')}
          />
        )}

        {showPreview && (
        <div
          className={`order-1 lg:order-2 flex flex-col min-h-0 min-w-0 lg:h-full ${
            panelFocus === 'preview' ? 'w-full flex-1 min-h-[min(60dvh,520px)] lg:min-h-0' : 'w-full lg:w-1/2 lg:flex-1 min-h-[min(50dvh,480px)] lg:min-h-0'
          }`}
        >
          <InvoiceDocumentPreview
            html={previewHtml}
            loading={previewLoading || settingsLoading}
            title={`${docLabel} Document`}
            actionsDisabled={settingsLoading}
            onPrint={() => printWithTemplate(invRecord, docSettings)}
            onDownload={() => downloadInvoicePdf(invRecord, docSettings)}
            compact
            focus={panelFocus}
            onTogglePanel={togglePdfPanel}
          />
        </div>
        )}
      </div>
    </div>
  )
}
