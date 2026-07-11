import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { SectionLabel } from '@/components/common/FieldLabel'
import { FormColumnLabel } from '@/components/common/FieldLabel'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProducts, useServices, useInvoiceSettings, vendorKeys, useMyMembership, useStores } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { formatCurrency } from '@/lib/utils'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { ResizableTable } from '@/components/table/ResizableTable'
import { TablePagination } from '@/components/table/TablePagination'
import { toast } from 'sonner'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { InvoiceAccentColorPicker } from '@/components/invoices/InvoiceAccentColorPicker'
import {
  printInvoice,
  generateInvoiceHtml,
  PAPER_SIZES,
  DEFAULT_INVOICE_SETTINGS,
  loadPosInvoiceSettings,
  savePosInvoiceSettings,
  INVOICE_TEMPLATE_IDS,
  INVOICE_TEMPLATE_LABELS,
  resolveInvoiceTemplateLogoPath,
  type InvoiceSettings,
  type PaperSize,
} from '@/lib/invoiceTemplates'
import { fetchAsDataUrl, downloadAsPdf, openPrintWindow, shareViaWhatsApp, shareViaSms, buildShareMessage, shareInvoiceViaWhatsApp } from '@/lib/printUtils'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Receipt,
  IndianRupee, CreditCard, Smartphone, Banknote, Loader2,
  X, PlayCircle, StopCircle, Package, Wrench,
  RotateCcw, UserPlus, User, ExternalLink as FullRecordIcon,
  History, ChevronLeft, ChevronRight, Printer, Mail,
  MessageSquare, Phone, FileText, Eye, Calendar, Clock,
  Copy, Check, ExternalLink, ArrowLeft, Settings, Download,
  Tag, Star, Gift, Award, ImageIcon, ScanLine,
  AlertTriangle, ChevronDown, ChevronUp, PackagePlus, RefreshCw,
  LayoutGrid, LayoutList, XCircle, UserX, Info, CalendarDays, Pencil,
  UtensilsCrossed, Users,
} from 'lucide-react'
import { POSBookingPanel } from './POSBookingPanel'
import { CreateBookingModal } from '@/pages/bookings/CreateBookingModal'
import { QuickCreateCustomerModal } from '@/components/customers/QuickCreateCustomerModal'
import { extractApiError } from '@/lib/errorMessages'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
import { POSSearchGrid } from './POSSearchGrid'
import type { AddToCartItem } from './POSSearchGrid'
import type { Customer } from '@/types'
import { StaffPicker, type StaffPickerValue } from '@/components/commission/StaffPicker'
type TxnMode = 'sale' | 'return'

interface CartItem {
  product_id: string
  variant_id?: string
  name: string
  sku?: string
  price: number
  qty: number
  tax_rate: number
  hsn_code?: string
  discount: number
  item_type: 'product' | 'service'
  image_url?: string
  booking_date?: string
  booking_time?: string
  duration_minutes?: number
  booking_notes?: string
  modifiers?: Array<{ group_id: string; group_name: string; option_id: string; option_name: string; price_delta: number }>
}

/** Per-line payable amount (discount + tax share) for split-by-cover billing. */
function computeCartLineAmounts(
  cart: CartItem[],
  discountType: 'flat' | 'percentage',
  cartDiscount: number,
  couponDiscountAmt = 0,
  loyaltyDiscountValue = 0,
): number[] {
  if (!cart.length) return []
  const itemDiscountTotal = cart.reduce((s, i) => s + i.discount, 0)
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const manualCartDiscount = discountType === 'percentage' ? subtotal * cartDiscount / 100 : cartDiscount
  const cartLevelDiscount = manualCartDiscount + couponDiscountAmt + loyaltyDiscountValue
  const pretaxAfterItemDiscounts = subtotal - itemDiscountTotal
  return cart.map(i => {
    const itemBase = i.price * i.qty - i.discount
    const proportion = pretaxAfterItemDiscounts > 0 ? itemBase / pretaxAfterItemDiscounts : 1 / cart.length
    const itemShareOfCartDiscount = cartLevelDiscount * proportion
    const taxable = Math.max(0, itemBase - itemShareOfCartDiscount)
    const tax = taxable * (i.tax_rate / 100)
    return Math.round((itemBase - itemShareOfCartDiscount + tax) * 100) / 100
  })
}

// Renders a catalog thumbnail with automatic fallback when the URL is broken/missing.
function CatalogImage({ url, type, size = 'sm' }: {
  url?: string | null; type: 'product' | 'service'; size?: 'sm' | 'md'
}) {
  const [failed, setFailed] = useState(false)
  const dim = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10'
  const safeUrl = url && url !== 'null' && url !== 'undefined' ? url : null
  if (!safeUrl || failed) {
    return (
      <div className={`${dim} rounded flex items-center justify-center shrink-0 ${type === 'service' ? 'bg-accent' : 'bg-blue-50'}`}>
        {type === 'service'
          ? <Wrench className="w-4 h-4 text-primary/70" />
          : <Package className="w-4 h-4 text-blue-400" />}
      </div>
    )
  }
  return (
    <img
      src={safeUrl}
      alt=""
      className={`${dim} rounded object-cover shrink-0 border`}
      onError={() => setFailed(true)}
    />
  )
}

const POS_PENDING_CUSTOMER_KEY = 'pos_pending_customer'

export default function POS() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tableFromUrl = searchParams.get('table')
  const orderFromUrl = searchParams.get('order')

  // ── Locked business unit (store) — POS operates against the staff member's assigned store ──
  const { data: myMembership, isLoading: membershipLoading } = useMyMembership()
  const { data: storesData } = useStores()
  const lockedStoreId = myMembership?.effective_store_id ?? myMembership?.store_id ?? null
  const lockedStoreName = useMemo(() => {
    if (!lockedStoreId) return null
    const match = (storesData?.stores ?? []).find((s) => s.id === lockedStoreId)
    return match?.name ?? null
  }, [lockedStoreId, storesData])

  // ── Modifier picker ──────────────────────────────────────────────
  const [modifierPendingItem, setModifierPendingItem] = useState<{
    id: string; variant_id?: string; name: string; sku?: string; price: number;
    tax_rate?: number; hsn_code?: string; sac_code?: string;
    item_type: 'product' | 'service'; duration_minutes?: number; image_url?: string
  } | null>(null)
  const [posView, setPosView] = useState<'billing' | 'history'>('billing')
  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [catalogView, setCatalogView] = useState<'cards' | 'grid'>(() =>
    (localStorage.getItem('pos_catalog_view') as 'cards' | 'grid' | null) ?? 'cards'
  )
  const [cartDiscount, setCartDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat')
  const [paymentModal, setPaymentModal] = useState(false)
  const [restaurantTableLabel, setRestaurantTableLabel] = useState<string | null>(null)
  const [restaurantCovers, setRestaurantCovers] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'products' | 'services'>('all')
  const [txnMode, setTxnMode] = useState<TxnMode>('sale')
  const [returnLookup, setReturnLookup] = useState('')
  const [originalTxn, setOriginalTxn] = useState<Record<string, unknown> | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [cartNotes, setCartNotes] = useState('')

  // Return mode: recent orders
  const [returnOrders, setReturnOrders] = useState<Record<string, unknown>[]>([])
  const [returnOrdersLoading, setReturnOrdersLoading] = useState(false)
  const [returnSearch, setReturnSearch] = useState('')

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; full_name: string; phone?: string; email?: string } | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<{ id: string; full_name: string; phone?: string; email?: string }[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [recentCustomers, setRecentCustomers] = useState<{ id: string; full_name: string; phone?: string; email?: string }[]>([])
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<StaffPickerValue | null>(null)

  // Invoice settings for POS printing
  const { data: rawInvSettings } = useInvoiceSettings()
  const { data: vendorData } = useQuery({ queryKey: ['myVendor'], queryFn: vendorApi.getMyVendor, staleTime: 5 * 60 * 1000 })
  const invSettings = useMemo<Partial<InvoiceSettings>>(() => ({
    ...DEFAULT_INVOICE_SETTINGS,
    ...(rawInvSettings as Partial<InvoiceSettings> || {}),
  }), [rawInvSettings])
  const [showPosSettings, setShowPosSettings] = useState(false)
  // POS-specific template overrides — merged on top of the vendor invoice settings.
  // Persisted in localStorage so they survive page reloads.
  const [posSettings, setPosSettings] = useState<Partial<InvoiceSettings>>(
    () => loadPosInvoiceSettings()
  )

  // Coupon
  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; message: string } | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)

  // Loyalty
  const [loyaltyAccount, setLoyaltyAccount] = useState<{ points_balance: number; lifetime_earned: number; tier: string } | null>(null)
  const [loyaltyProgram, setLoyaltyProgram] = useState<{ is_active: boolean; currency_per_point: number; min_redeem_points: number; max_redeem_percent: number } | null>(null)
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0)

  // Default customer from vendor settings
  const [defaultCustomerId, setDefaultCustomerId] = useState<string | null>(null)

  // Post-sale receipt
  const [receiptData, setReceiptData] = useState<Record<string, unknown> | null>(null)

  // Variant picker — shown when a catalog product has multiple variants
  const [variantPickerProduct, setVariantPickerProduct] = useState<any | null>(null)

  // Barcode scanner
  const [showCameraScanner, setShowCameraScanner] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const scanQueueRef = useRef<string[]>([])
  const scanProcessingRef = useRef(false)
  const scanInputRef = useRef<HTMLInputElement>(null)

  // Booking slot panel — index of the cart service item whose panel is open
  const [bookingPanelIdx, setBookingPanelIdx] = useState<number | null>(null)
  // Full booking modal triggered from POSBookingPanel
  const [fullBookingPreFill, setFullBookingPreFill] = useState<{
    date: string; startTime: string; endTime: string; staffId: string; serviceId?: string
  } | null>(null)

  const applyBookingSlot = useCallback((
    idx: number, date: string, fromTime: string, toTime: string, overriddenPrice?: number, staffId?: string,
  ) => {
    setCart(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        booking_date: date,
        booking_time: fromTime,
        // store end time in booking_notes so backend can receive it
        booking_notes: toTime ? `to:${toTime}` : updated[idx].booking_notes,
        ...(overriddenPrice != null ? { price: overriddenPrice } : {}),
        ...(staffId ? { staff_id: staffId } as any : {}),
      }
      return updated
    })
    setBookingPanelIdx(null)
  }, [])

  // Suggestion dropdown
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Scan Report — accumulates failed scan entries within the session
  const [scanReport, setScanReport] = useState<{ id: string; barcode: string; ts: Date; status: 'not_found' | 'error' }[]>([])
  const [scanReportOpen, setScanReportOpen] = useState(false)

  const addScanReport = useCallback((barcode: string, status: 'not_found' | 'error') => {
    setScanReport(prev => [{ id: `${barcode}-${Date.now()}`, barcode, ts: new Date(), status }, ...prev])
    setScanReportOpen(true)
  }, [])

  const removeScanReport = useCallback((id: string) => {
    setScanReport(prev => prev.filter(e => e.id !== id))
  }, [])

  // Close suggestion dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setHighlightIdx(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!tableFromUrl) {
      setRestaurantTableLabel(null)
      return
    }
    let cancelled = false
    vendorApi.restaurantListTables()
      .then(d => {
        if (cancelled) return
        const t = d.items.find(x => x.id === tableFromUrl)
        setRestaurantTableLabel(t ? `${t.zone_name ? `${t.zone_name} · ` : ''}${t.label}` : 'Table')
      })
      .catch(() => {
        if (!cancelled) setRestaurantTableLabel('Table')
      })
    return () => { cancelled = true }
  }, [tableFromUrl])

  const restaurantOrderPrefilledRef = useRef<string | null>(null)

  // Prefill cart when arriving from Restaurant → Request Bill (?table=&order=)
  useEffect(() => {
    if (!orderFromUrl || txnMode !== 'sale') return
    if (restaurantOrderPrefilledRef.current === orderFromUrl) return

    let cancelled = false
    vendorApi.restaurantGetOrder(orderFromUrl)
      .then(order => {
        if (cancelled) return
        const items: CartItem[] = (order.items ?? [])
          .filter(i => i.qty > 0)
          .map(i => {
            const modifierExtra = (i.modifiers ?? []).reduce((s, m) => s + m.price_delta, 0)
            return {
              product_id: i.product_id ?? '',
              name: i.name,
              price: i.unit_price + modifierExtra,
              qty: i.qty,
              tax_rate: i.tax_rate ?? 0,
              discount: 0,
              item_type: (i.item_type === 'service' ? 'service' : 'product') as 'product' | 'service',
              modifiers: i.modifiers,
            }
          })
        if (items.length === 0) {
          toast.warning('No items on this order to bill')
          restaurantOrderPrefilledRef.current = orderFromUrl
          return
        }
        setCart(items)
        if (order.table_label) setRestaurantTableLabel(order.table_label)
        if (order.covers && order.covers > 0) setRestaurantCovers(order.covers)
        restaurantOrderPrefilledRef.current = orderFromUrl
        toast.success(`Loaded ${items.length} item${items.length === 1 ? '' : 's'} from table order`)
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load restaurant order for billing')
      })
    return () => { cancelled = true }
  }, [orderFromUrl, txnMode])

  const processScanQueueRef = useRef<(() => Promise<void>) | null>(null)

  // History
  const [histPage, setHistPage] = useState(1)
  const [histPageSize, setHistPageSize] = useState(20)
  const [histSearch, setHistSearch] = useState('')
  const [histSortKey, setHistSortKey] = useState('created_at')
  const [histSortDir, setHistSortDir] = useState<SortDir>('desc')
  const [histTypeFilter, setHistTypeFilter] = useState<string>('')
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null)

  /** Register history: sales & returns only. Credit/debit memos live under Finance → Credit & Debit Memos. */
  const registerHistoryTypes = histTypeFilter || 'sale,return'

  const { data: posOrdersData, isLoading: posOrdersLoading } = useQuery({
    queryKey: vendorKeys.posTransactions({ page: histPage, size: histPageSize, search: histSearch, type: registerHistoryTypes }),
    queryFn: () =>
      vendorApi.posListTransactions({
        page: histPage,
        size: histPageSize,
        search: histSearch.trim() || undefined,
        transaction_type: registerHistoryTypes,
      }),
  })
  const posOrders = (posOrdersData?.items || []) as Record<string, unknown>[]
  const posTotalOrders = posOrdersData?.total || 0
  const totalHistPages = Math.max(1, Math.ceil(posTotalOrders / histPageSize))

  const filteredPosOrders = useMemo(() => {
    return processRows(
      posOrders, '', (o: any) => [o.order_number, o.transaction_number, o.customer_name || '', o.payment_method || '', o.status, String(o.total)],
      histSortKey, histSortDir,
      {
        created_at: (o: any) => o.created_at,
        order_number: (o: any) => o.order_number,
        customer_name: (o: any) => o.customer_name || '',
        item_count: (o: any) => o.item_count,
        total: (o: any) => o.total,
        payment_method: (o: any) => o.payment_method || '',
        status: (o: any) => o.status,
      },
    )
  }, [posOrders, histSortKey, histSortDir])

  const { data: productsData } = useProducts({ size: 500, status: 'active', search: search || undefined, store_id: lockedStoreId || undefined })
  const { data: servicesData } = useServices({ size: 500, status: 'active', search: search || undefined, store_id: lockedStoreId || undefined })
  // Explicitly stamp item_type so POSSearchGrid and addToCart work correctly
  const products = useMemo(
    () => (productsData?.items || []).map((p: any) => ({ ...p, item_type: 'product' as const })),
    [productsData],
  )
  const services = useMemo(
    () => (servicesData?.items || []).map((s: any) => ({ ...s, item_type: 'service' as const })),
    [servicesData],
  )

  // Full unfiltered catalog for client-side suggestion matching
  const { data: allProductsData } = useProducts({ size: 500, status: 'active', store_id: lockedStoreId || undefined })
  const { data: allServicesData } = useServices({ size: 500, status: 'active', store_id: lockedStoreId || undefined })
  const allCatalogItems = useMemo(() => {
    const prods = (allProductsData?.items || []).map((p: any) => ({ ...p, item_type: 'product' as const }))
    const svcs  = (allServicesData?.items  || []).map((s: any) => ({ ...s, item_type: 'service' as const }))
    return [...prods, ...svcs]
  }, [allProductsData, allServicesData])

  // Compute suggestion matches — search across all relevant fields client-side
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []

    type MatchField = 'name' | 'sku' | 'barcode' | 'hsn' | 'category' | 'tag' | 'description'
    const results: { item: any; matchField: MatchField; matchValue: string }[] = []

    for (const item of allCatalogItems) {
      let matchField: MatchField | null = null
      let matchValue = ''

      if (item.name?.toLowerCase().includes(q)) { matchField = 'name'; matchValue = item.name }
      else if (item.sku?.toLowerCase().includes(q)) { matchField = 'sku'; matchValue = item.sku }
      else if (item.barcode?.toLowerCase().includes(q)) { matchField = 'barcode'; matchValue = item.barcode }
      else if (item.hsn_code?.toLowerCase().includes(q)) { matchField = 'hsn'; matchValue = item.hsn_code }
      else if (item.category?.toLowerCase().includes(q)) { matchField = 'category'; matchValue = item.category }
      else if (item.subcategory?.toLowerCase().includes(q)) { matchField = 'category'; matchValue = item.subcategory }
      else if (item.tags?.some((t: string) => t.toLowerCase().includes(q))) {
        const tag = item.tags.find((t: string) => t.toLowerCase().includes(q))
        matchField = 'tag'; matchValue = tag
      }
      else if (item.short_description?.toLowerCase().includes(q)) { matchField = 'description'; matchValue = item.short_description }
      else if (item.description?.toLowerCase().includes(q)) { matchField = 'description'; matchValue = item.description }

      if (matchField) results.push({ item, matchField, matchValue })
      if (results.length >= 12) break
    }
    return results
  }, [search, allCatalogItems])

  useEffect(() => {
    vendorApi.posGetCurrentSession().then((data) => {
      setSession(data.session)
      setSessionLoading(false)
    }).catch(() => setSessionLoading(false))
  }, [])

  // Load recent customers on mount
  useEffect(() => {
    vendorApi.listCustomers({ size: 10, sort: 'updated_at', order: 'desc' }).then(r => {
      setRecentCustomers(r.items || [])
    }).catch(() => {})
  }, [])

  // Auto-select a customer created on the MasterDataNew full-page form
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(POS_PENDING_CUSTOMER_KEY)
      if (raw) {
        sessionStorage.removeItem(POS_PENDING_CUSTOMER_KEY)
        const cust = JSON.parse(raw) as { id: string; full_name: string; phone?: string; email?: string }
        if (cust?.id && cust?.full_name) {
          setSelectedCustomer(cust)
          setRecentCustomers(prev => [cust, ...prev.filter(c => c.id !== cust.id)].slice(0, 10))
          toast.success(`${cust.full_name} added & selected`)
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load loyalty program config
  useEffect(() => {
    vendorApi.getLoyaltyProgram().then(p => setLoyaltyProgram(p)).catch(() => {})
  }, [])

  // Load default customer from vendor settings
  useEffect(() => {
    if (vendorData?.settings?.default_pos_customer_id) {
      const defId = vendorData.settings.default_pos_customer_id as string
      setDefaultCustomerId(defId)
      if (!selectedCustomer) {
        vendorApi.getCustomer(defId).then(c => {
          setSelectedCustomer({ id: c.id, full_name: c.full_name, phone: c.phone, email: c.email })
        }).catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorData])

  // Load loyalty account when customer selected
  useEffect(() => {
    if (selectedCustomer?.id && loyaltyProgram?.is_active) {
      vendorApi.getLoyaltyAccount(selectedCustomer.id).then(a => setLoyaltyAccount(a)).catch(() => setLoyaltyAccount(null))
    } else {
      setLoyaltyAccount(null)
      setLoyaltyRedeem(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id, loyaltyProgram?.is_active])

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomerResults([]); return }
    const timer = setTimeout(() => {
      vendorApi.listCustomers({ search: customerSearch, size: 10 }).then(r => {
        setCustomerResults(r.items || [])
        setShowCustomerDropdown(true)
      }).catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  const handleQuickCreateSelect = (cust: { id: string; full_name: string; phone?: string; email?: string }) => {
    setSelectedCustomer(cust)
    setRecentCustomers(prev => [cust, ...prev.filter(c => c.id !== cust.id)].slice(0, 10))
    setShowQuickCreate(false)
  }

  const selectCustomer = (cust: { id: string; full_name: string; phone?: string; email?: string }) => {
    setSelectedCustomer(cust)
    setCustomerSearch('')
    setShowCustomerDropdown(false)
    setRecentCustomers(prev => [cust, ...prev.filter(c => c.id !== cust.id)].slice(0, 10))
  }

  const openSession = async () => {
    setLoading(true)
    try {
      const s = await vendorApi.posOpenSession({ opening_cash: 0 })
      setSession(s)
      toast.success('POS session opened!')
    } catch { toast.error('Could not open POS session — another session may already be active') }
    setLoading(false)
  }

  const closeSession = async () => {
    if (!session) return
    setLoading(true)
    try {
      await vendorApi.posCloseSession(session.id as string, { closing_cash: 0 })
      setSession(null)
      setCart([])
      setSelectedSalesPerson(null)
      toast.success('Session closed!')
    } catch { toast.error('Could not close POS session — ensure all pending transactions are completed') }
    setLoading(false)
  }

  const getNextSlotTime = useCallback((): string => {
    const now = new Date()
    const mins = now.getMinutes()
    const nextSlot = new Date(now)
    nextSlot.setMinutes(mins < 30 ? 30 : 60, 0, 0)
    if (mins >= 30) nextSlot.setHours(nextSlot.getHours())
    return nextSlot.toTimeString().slice(0, 5)
  }, [])

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const addToCart = useCallback((item: {
    id: string; variant_id?: string; name: string; sku?: string; price: number;
    tax_rate?: number; hsn_code?: string; sac_code?: string;
    item_type: 'product' | 'service'; duration_minutes?: number; image_url?: string
    modifiers?: Array<{ group_id: string; group_name: string; option_id: string; option_name: string; price_delta: number }>
  }) => {
    setCart(prev => {
      // Items with modifiers always get a new line (can't merge with different modifier combos)
      if (item.modifiers && item.modifiers.length > 0) {
        const isService = item.item_type === 'service'
        const modifierExtra = item.modifiers.reduce((s, m) => s + m.price_delta, 0)
        return [...prev, {
          product_id: item.id,
          variant_id: item.variant_id,
          name: item.name,
          sku: item.sku,
          price: item.price + modifierExtra,
          qty: 1,
          tax_rate: item.tax_rate || 0,
          hsn_code: item.hsn_code || item.sac_code,
          discount: 0,
          item_type: item.item_type,
          image_url: item.image_url,
          duration_minutes: item.duration_minutes,
          booking_date: isService ? todayStr : undefined,
          booking_time: isService ? getNextSlotTime() : undefined,
          modifiers: item.modifiers,
        }]
      }
      // Key by product_id + variant_id so each variant gets a separate line
      const idx = prev.findIndex(i =>
        i.product_id === item.id && (i.variant_id ?? '') === (item.variant_id ?? '') && !i.modifiers?.length,
      )
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 }
        return updated
      }
      const isService = item.item_type === 'service'
      return [...prev, {
        product_id: item.id,
        variant_id: item.variant_id,
        name: item.name,
        sku: item.sku,
        price: item.price,
        qty: 1,
        tax_rate: item.tax_rate || 0,
        hsn_code: item.hsn_code || item.sac_code,
        discount: 0,
        item_type: item.item_type,
        image_url: item.image_url,
        duration_minutes: item.duration_minutes,
        booking_date: isService ? todayStr : undefined,
        booking_time: isService ? getNextSlotTime() : undefined,
      }]
    })
  }, [todayStr, getNextSlotTime])

  /** Checks modifier groups before adding a product to cart — shows picker if any exist. */
  const handleProductAdd = useCallback(async (item: {
    id: string; variant_id?: string; name: string; sku?: string; price: number;
    tax_rate?: number; hsn_code?: string; sac_code?: string; item_type: 'product' | 'service'; image_url?: string; duration_minutes?: number
  }) => {
    if (item.item_type === 'service') { addToCart(item); return }
    try {
      const { items: groups } = await vendorApi.productListModifiers(item.id)
      const active = groups.filter(g => g.is_active && g.options?.some(o => o.is_active))
      if (active.length > 0) {
        setModifierPendingItem(item)
      } else {
        addToCart(item)
      }
    } catch {
      addToCart(item)
    }
  }, [addToCart])

  const processScanQueue = useCallback(async () => {
    if (scanProcessingRef.current) return
    scanProcessingRef.current = true
    setScanLoading(true)
    while (scanQueueRef.current.length > 0) {
      const code = scanQueueRef.current.shift()!
      try {
        const result = await vendorApi.barcodeLookup(code)
        const p = result.product
        const v = result.variant
        const price = v?.price ?? p.price ?? 0
        const name = v ? `${p.name} — ${v.name}` : p.name
        const sku = v?.sku ?? p.sku
        const taxRate = v?.tax_rate ?? (p as any).tax_rate ?? (p as any).gst_rate ?? 0
        const hsnCode = v?.hsn_code ?? (p as any).hsn_code
        const imgUrl = (p as any).images?.[0]?.url || (p as any).images?.[0]?.file_url
        addToCart({ id: p.id, variant_id: v?.id, name, sku, price, tax_rate: taxRate, hsn_code: hsnCode, item_type: 'product', image_url: imgUrl })
        toast.success(`Added: ${name}`, { duration: 2000 })
      } catch (err: any) {
        if (err?.response?.status === 404) {
          addScanReport(code, 'not_found')
          toast.error(`Product not found: ${code}`, { duration: 4000 })
        } else {
          addScanReport(code, 'error')
          toast.error('Barcode scan error. Please try again.')
        }
      }
    }
    scanProcessingRef.current = false
    setScanLoading(false)
  }, [addToCart, addScanReport])

  // Keep ref in sync so retryBarcodeScan can call it without circular deps
  processScanQueueRef.current = processScanQueue

  const retryBarcodeScan = useCallback((entryId: string, barcode: string) => {
    removeScanReport(entryId) // optimistic — pass the entry id, not the barcode string
    scanQueueRef.current.push(barcode)
    processScanQueueRef.current?.()
  }, [removeScanReport])

  const handleBarcodeScan = useCallback((code: string) => {
    setShowCameraScanner(false)
    scanQueueRef.current.push(code)
    processScanQueue()
  }, [processScanQueue])

  useBarcodeScanner({ enabled: posView === 'billing' && !showCameraScanner, onScan: handleBarcodeScan })

  const switchMode = (mode: TxnMode) => {
    setTxnMode(mode)
    setCart([])
    setCartDiscount(0)
    setOriginalTxn(null)
    setReturnLookup('')
    setCartNotes('')
    setReturnSearch('')
    setCouponCode('')
    setCouponApplied(null)
    setLoyaltyRedeem(0)
    setSelectedSalesPerson(null)
    if (mode === 'return') loadReturnOrders()
  }

  // Coupon validation
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    try {
      const result = await vendorApi.validateCoupon(couponCode.trim(), subtotal)
      if (result.valid) {
        setCouponApplied({ code: couponCode.trim().toUpperCase(), discount: result.discount_amount, message: result.message })
        toast.success(result.message)
      } else {
        toast.error(result.message)
        setCouponApplied(null)
      }
    } catch {
      toast.error('Could not validate coupon')
    }
    setCouponLoading(false)
  }

  const removeCoupon = () => {
    setCouponApplied(null)
    setCouponCode('')
  }

  // Loyalty redemption value
  const loyaltyDiscountValue = loyaltyRedeem * (loyaltyProgram?.currency_per_point || 1)

  const loadReturnOrders = async (searchTerm?: string) => {
    setReturnOrdersLoading(true)
    try {
      const res = await vendorApi.posListTransactions({
        page: 1, size: 20, search: searchTerm || undefined,
        transaction_type: 'sale',
      })
      setReturnOrders(res.items || [])
    } catch { setReturnOrders([]) }
    setReturnOrdersLoading(false)
  }

  const selectReturnOrder = async (order: Record<string, unknown>) => {
    setLookupLoading(true)
    try {
      const txn = await vendorApi.posGetTransaction(order.id as string)
      if (txn.transaction_type !== 'sale') {
        toast.error('Can only return against a sale transaction')
        setLookupLoading(false)
        return
      }
      setOriginalTxn(txn)
      const returnItems: CartItem[] = (txn.items || []).map((i: Record<string, unknown>) => ({
        product_id: i.product_id as string,
        name: i.name as string,
        sku: i.sku as string | undefined,
        price: i.price as number,
        qty: i.qty as number,
        tax_rate: i.tax_rate as number || 0,
        hsn_code: i.hsn_code as string | undefined,
        discount: i.discount as number || 0,
        item_type: (i.item_type as 'product' | 'service') || 'product',
      }))
      setCart(returnItems)
      toast.success(`Loaded ${returnItems.length} items from ${txn.transaction_number}`)
    } catch { toast.error('Could not load transaction — the order number may be invalid or deleted') }
    setLookupLoading(false)
  }

  const lookupOriginalTxn = async () => {
    if (!returnLookup.trim()) return
    setLookupLoading(true)
    try {
      const txn = await vendorApi.posLookupTransaction(returnLookup.trim())
      if (txn.transaction_type !== 'sale') {
        toast.error('Can only return against a sale transaction')
        setLookupLoading(false)
        return
      }
      setOriginalTxn(txn)
      const returnItems: CartItem[] = (txn.items || []).map((i: Record<string, unknown>) => ({
        product_id: i.product_id as string,
        name: i.name as string,
        sku: i.sku as string | undefined,
        price: i.price as number,
        qty: i.qty as number,
        tax_rate: i.tax_rate as number || 0,
        hsn_code: i.hsn_code as string | undefined,
        discount: i.discount as number || 0,
        item_type: (i.item_type as 'product' | 'service') || 'product',
      }))
      setCart(returnItems)
      toast.success(`Loaded ${returnItems.length} items from ${txn.transaction_number}`)
    } catch {
      toast.error('Transaction not found')
    }
    setLookupLoading(false)
  }

  const updateQty = (idx: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], qty: Math.max(1, updated[idx].qty + delta) }
      return updated
    })
  }

  const updateItemDiscount = (idx: number, val: number) => {
    setCart(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], discount: Math.max(0, val) }
      return updated
    })
  }

  const removeFromCart = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx))

  const itemDiscountTotal = cart.reduce((s, i) => s + i.discount, 0)
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  // All cart-level discounts computed first so tax can use them
  const manualCartDiscount = discountType === 'percentage' ? subtotal * cartDiscount / 100 : cartDiscount
  const couponDiscountAmt = couponApplied?.discount || 0
  const cartLevelDiscount = manualCartDiscount + couponDiscountAmt + loyaltyDiscountValue
  // Tax is calculated on each item's taxable base after its share of ALL discounts
  // (item discount + proportional share of cart/coupon/loyalty discounts)
  const pretaxAfterItemDiscounts = subtotal - itemDiscountTotal
  const totalTax = cart.reduce((s, i) => {
    const itemBase = i.price * i.qty - i.discount
    const proportion = pretaxAfterItemDiscounts > 0 ? itemBase / pretaxAfterItemDiscounts : 0
    const itemShareOfCartDiscount = cartLevelDiscount * proportion
    const taxable = Math.max(0, itemBase - itemShareOfCartDiscount)
    return s + taxable * i.tax_rate / 100
  }, 0)
  const manualDiscount = manualCartDiscount + itemDiscountTotal
  const effectiveDiscount = manualDiscount + couponDiscountAmt + loyaltyDiscountValue
  const grandTotal = Math.max(0, Math.round(subtotal - effectiveDiscount + totalTax))
  const cartLineAmounts = useMemo(
    () => computeCartLineAmounts(
      cart,
      discountType,
      cartDiscount,
      couponApplied?.discount || 0,
      loyaltyDiscountValue,
    ),
    [cart, discountType, cartDiscount, couponApplied, loyaltyDiscountValue],
  )

  if (membershipLoading || sessionLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>

  if (!lockedStoreId) {
    const isPrivileged = myMembership?.role === 'owner' || myMembership?.role === 'admin'
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center px-6">
        <UserX className="w-16 h-16 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-700">No business unit assigned</h2>
        <p className="text-gray-500 max-w-md">
          {isPrivileged
            ? 'The POS is scoped to a single business unit, but no business unit exists yet. Create one under Business Units / Stores to start billing.'
            : "The POS is scoped to a single business unit. You are not assigned to one yet, so billing, catalog and stock can't be loaded. Ask an admin to assign you to a store under Team settings."}
        </p>
      </div>
    )
  }

  if (receiptData) return (
    <PostSaleReceipt
      data={receiptData}
      invSettings={invSettings}
      vendor={vendorData}
      posSettings={posSettings}
      onClose={() => setReceiptData(null)}
      onNewSale={() => { setReceiptData(null); switchMode('sale') }}
    />
  )

  if (!session && posView !== 'history') return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <Receipt className="w-16 h-16 text-gray-300" />
      <h2 className="text-xl font-bold text-gray-700">Point of Sale</h2>
      <p className="text-gray-500">Open a session to start billing</p>
      <Button onClick={openSession} disabled={loading} className="gap-2" size="lg">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
        Open POS Session
      </Button>
      <Button variant="outline" onClick={() => setPosView('history')} className="gap-2">
        <History className="w-4 h-4" /> Transaction History
      </Button>
    </div>
  )

  if (posView === 'history') return (
    <POSTransactionHistory
      orders={filteredPosOrders}
      loading={posOrdersLoading}
      page={histPage}
      totalPages={totalHistPages}
      total={posTotalOrders}
      pageSize={histPageSize}
      onPageChange={setHistPage}
      onPageSizeChange={setHistPageSize}
      search={histSearch}
      onSearchChange={setHistSearch}
      sortKey={histSortKey}
      sortDir={histSortDir}
      onSortKeyChange={setHistSortKey}
      onSortDirChange={setHistSortDir}
      typeFilter={histTypeFilter}
      onTypeFilterChange={setHistTypeFilter}
      selectedTxn={selectedTxn}
      onSelectTxn={setSelectedTxn}
      onBack={() => setPosView('billing')}
      invSettings={invSettings}
      vendor={vendorData}
      posSettings={posSettings}
    />
  )

  return (
    <div className="flex flex-col gap-2 h-[calc(100vh-6rem)]">
      {tableFromUrl && restaurantTableLabel && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm shrink-0">
          <span className="flex items-center gap-2 text-amber-950 font-medium">
            <UtensilsCrossed className="w-4 h-4 text-amber-700 shrink-0" />
            Restaurant · {restaurantTableLabel}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" type="button" onClick={() => navigate('/restaurant/floor')}>
              Change table
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" type="button" onClick={() => {
              searchParams.delete('table')
              setSearchParams(searchParams, { replace: true })
            }}>
              Clear
            </Button>
          </div>
        </div>
      )}
      <div className="flex gap-3 flex-1 min-h-0">
      {/* ── Left: Catalog ── */}
      <div className="flex-[6] min-w-0 flex flex-col space-y-2 overflow-hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" /> POS Billing
            {lockedStoreName && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {lockedStoreName}
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            {loyaltyProgram?.is_active && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 font-medium">
                <Award className="w-3 h-3" /> Loyalty Active
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowPosSettings(true)} className="gap-1" title="Invoice Settings">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPosView('history')} className="gap-1">
              <History className="w-4 h-4" />History
            </Button>
            <Button variant="outline" size="sm" onClick={closeSession} disabled={loading} className="gap-1 text-red-600 border-red-200 hover:bg-red-50">
              <StopCircle className="w-4 h-4" />End
            </Button>
          </div>
        </div>

        {/* Transaction mode */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([
            { key: 'sale' as TxnMode, label: 'Sale', icon: ShoppingCart, color: 'text-green-600' },
            { key: 'return' as TxnMode, label: 'Return', icon: RotateCcw, color: 'text-red-600' },
          ]).map(m => (
            <button key={m.key} onClick={() => switchMode(m.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                txnMode === m.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            ><m.icon className={`w-3.5 h-3.5 ${txnMode === m.key ? m.color : ''}`} /> {m.label}</button>
          ))}
        </div>

        {/* Return: compact order selection */}
        {txnMode === 'return' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Return / Refund</p>
            {originalTxn ? (
              <div className="flex items-center justify-between text-xs bg-white rounded-lg p-2.5 border border-green-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  <span className="font-semibold">{originalTxn.transaction_number as string}</span>
                  <span className="text-gray-500">{formatCurrency(originalTxn.total as number)}</span>
                  <span className="text-gray-400">{(originalTxn.item_count as number)} items</span>
                </div>
                <button type="button" aria-label="Close" onClick={() => { setOriginalTxn(null); setCart([]); setSelectedSalesPerson(null) }} className="text-gray-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input type="text" value={returnSearch}
                      onChange={e => { setReturnSearch(e.target.value); loadReturnOrders(e.target.value) }}
                      placeholder="Search orders..."
                      className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-red-300 focus:outline-none"
                    />
                  </div>
                  <Input
                    placeholder="POS-XXXXXX"
                    value={returnLookup}
                    onChange={e => setReturnLookup(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lookupOriginalTxn()}
                    className="h-8 text-xs w-28"
                  />
                  <Button size="sm" variant="outline" onClick={lookupOriginalTxn} disabled={lookupLoading} className="h-8 px-2">
                    {lookupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-0.5 bg-white rounded-lg border p-1">
                  {returnOrdersLoading ? (
                    <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                  ) : returnOrders.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">No recent sales found</p>
                  ) : returnOrders.map((o: any) => (
                    <button key={o.id} onClick={() => selectReturnOrder(o)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-red-50 text-left text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-blue-600 shrink-0">{o.order_number || o.transaction_number}</span>
                        <span className="text-gray-400 truncate">{o.customer_name || 'Walk-in'}</span>
                      </div>
                      <span className="font-bold shrink-0 ml-2">{formatCurrency(o.total)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search + suggestion dropdown + barcode scan + view toggle */}
        <div className="flex gap-2 items-center">
          <div ref={searchContainerRef} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
            <Input
              ref={scanInputRef}
              placeholder="Search by name, SKU, barcode, HSN, category, tag…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setShowSuggestions(true)
                setHighlightIdx(-1)
              }}
              onFocus={() => { if (search.length >= 2) setShowSuggestions(true) }}
              onKeyDown={(e) => {
                if (!showSuggestions || suggestions.length === 0) return
                if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1)) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, -1)) }
                else if (e.key === 'Enter' && highlightIdx >= 0) {
                  e.preventDefault()
                  const { item } = suggestions[highlightIdx]
                  addToCart({ id: item.id, name: item.name, sku: item.sku, price: item.sale_price ?? item.price ?? 0, tax_rate: item.gst_rate ?? item.tax_rate ?? 0, hsn_code: item.hsn_code ?? item.sac_code, item_type: item.item_type, image_url: item.images?.[0]?.url ?? item.images?.[0]?.file_url, duration_minutes: item.duration_minutes })
                  // Keep search text so the grid stays filtered; just close the dropdown
                  setShowSuggestions(false); setHighlightIdx(-1)
                }
                else if (e.key === 'Escape') { setShowSuggestions(false); setHighlightIdx(-1) }
              }}
              className="pl-10"
            />
            {search && (
              <button type="button" aria-label="Close" onClick={() => { setSearch(''); setShowSuggestions(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}

            {/* ── Suggestion Dropdown ── */}
            {showSuggestions && search.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                {suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">
                    No matches for "<span className="font-medium text-gray-600">{search}</span>"
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-border flex items-center justify-between">
                      <span>{suggestions.length} match{suggestions.length !== 1 ? 'es' : ''}</span>
                      <span className="text-xs text-gray-300 normal-case font-normal">↑↓ navigate · Enter to add</span>
                    </div>
                    {suggestions.map(({ item, matchField, matchValue }, idx) => {
                      const imgUrl = item.images?.[0]?.url ?? item.images?.[0]?.file_url
                      const price = item.sale_price ?? item.price ?? 0
                      const isHighlighted = idx === highlightIdx
                      const FIELD_LABELS: Record<string, string> = { name: 'Name', sku: 'SKU', barcode: 'Barcode', hsn: 'HSN', category: 'Category', tag: 'Tag', description: 'Desc' }
                      const FIELD_COLORS: Record<string, string> = { name: 'bg-blue-50 text-blue-700', sku: 'bg-accent text-primary', barcode: 'bg-orange-50 text-orange-700', hsn: 'bg-teal-50 text-teal-700', category: 'bg-emerald-50 text-emerald-700', tag: 'bg-pink-50 text-pink-700', description: 'bg-gray-100 text-gray-600' }
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            addToCart({ id: item.id, name: item.name, sku: item.sku, price, tax_rate: item.gst_rate ?? item.tax_rate ?? 0, hsn_code: item.hsn_code ?? item.sac_code, item_type: item.item_type, image_url: imgUrl, duration_minutes: item.duration_minutes })
                            // Keep search so the grid stays filtered; just close the dropdown
                            setShowSuggestions(false); setHighlightIdx(-1)
                          }}
                          onMouseEnter={() => setHighlightIdx(idx)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-gray-50 last:border-0 ${isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          {/* Thumbnail */}
                          {imgUrl ? (
                            <img src={imgUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0 border border-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          ) : (
                            <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${item.item_type === 'service' ? 'bg-accent' : 'bg-blue-50'}`}>
                              {item.item_type === 'service' ? <Wrench className="w-4 h-4 text-primary/70" /> : <Package className="w-4 h-4 text-blue-400" />}
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${FIELD_COLORS[matchField]}`}>
                                {FIELD_LABELS[matchField]}{matchField !== 'name' && matchField !== 'description' ? `: ${matchValue}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {item.sku && <span className="text-xs text-gray-400 font-mono">{item.sku}</span>}
                              {item.category && <span className="text-xs text-gray-400">{item.category}</span>}
                            </div>
                          </div>

                          {/* Price + type */}
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-gray-900">₹{price.toLocaleString()}</p>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${item.item_type === 'service' ? 'bg-accent text-primary' : 'bg-blue-50 text-blue-600'}`}>
                              {item.item_type}
                            </span>
                          </div>

                          {/* Add indicator */}
                          <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isHighlighted ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
          {/* Camera scan */}
          <button
            title="Scan barcode with camera (hardware scanner also always active)"
            onClick={() => setShowCameraScanner(true)}
            disabled={scanLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-lg border bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50 text-xs font-medium text-blue-600"
          >
            {scanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            {scanLoading ? 'Looking up…' : 'Camera'}
          </button>
          {/* View toggle: card / grid */}
          <div className="flex border rounded-lg overflow-hidden shrink-0">
            <button title="Card view"
              onClick={() => { setCatalogView('cards'); localStorage.setItem('pos_catalog_view', 'cards') }}
              className={`px-2 h-9 flex items-center transition-colors ${catalogView === 'cards' ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              <LayoutList className="w-4 h-4" />
            </button>
            <button title="Grid / table view with configurable filters"
              onClick={() => { setCatalogView('grid'); localStorage.setItem('pos_catalog_view', 'grid') }}
              className={`px-2 h-9 flex items-center border-l transition-colors ${catalogView === 'grid' ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Scanner ready indicator + Scan Report badge */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">Hardware scanner ready — just scan any barcode</span>
          </div>
          {scanReport.length > 0 && (
            <button
              onClick={() => setScanReportOpen(o => !o)}
              className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="w-3 h-3" />
              Scan Report ({scanReport.length})
              {scanReportOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Scan Report panel */}
        {scanReport.length > 0 && scanReportOpen && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium text-amber-800">Scan Report — {scanReport.length} unmatched barcode{scanReport.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Create All */}
                <button
                  onClick={() => {
                    scanReport.forEach(e => window.open(`/products/new?barcode=${encodeURIComponent(e.barcode)}`, '_blank'))
                  }}
                  className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                >
                  <PackagePlus className="w-3 h-3" /> Create All
                </button>
                {/* Export CSV */}
                <button
                  onClick={() => {
                    const rows = ['Barcode,Timestamp,Status', ...scanReport.map(e => `${e.barcode},${e.ts.toISOString()},${e.status}`)]
                    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `scan-report-${new Date().toISOString().slice(0,10)}.csv`
                    a.click(); URL.revokeObjectURL(url)
                  }}
                  className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:underline"
                >
                  <Download className="w-3 h-3" /> Export
                </button>
                {/* Clear all */}
                <button onClick={() => setScanReport([])} className="text-xs text-gray-400 hover:text-red-500 hover:underline">Clear all</button>
              </div>
            </div>

            {/* Entries list */}
            <div className="max-h-40 overflow-y-auto divide-y divide-amber-100">
              {scanReport.map(entry => (
                <div key={entry.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="font-mono text-xs text-gray-800 min-w-0 truncate flex-1">{entry.barcode}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {Math.round((Date.now() - entry.ts.getTime()) / 60000) < 1
                      ? 'just now'
                      : `${Math.round((Date.now() - entry.ts.getTime()) / 60000)}m ago`}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium shrink-0">Not Found</span>
                  {/* Row actions */}
                  <button
                    title="Create product with this barcode"
                    onClick={() => window.open(`/products/new?barcode=${encodeURIComponent(entry.barcode)}`, '_blank')}
                    className="shrink-0 flex items-center gap-0.5 text-xs text-blue-600 hover:underline font-medium"
                  >
                    <PackagePlus className="w-3 h-3" /> Create
                  </button>
                  <button
                    title="Retry lookup"
                    onClick={() => retryBarcodeScan(entry.id, entry.barcode)}
                    className="shrink-0 text-gray-400 hover:text-indigo-600"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button type="button" aria-label="Close"
                    title="Dismiss"
                    onClick={() => removeScanReport(entry.id)}
                    className="shrink-0 text-gray-300 hover:text-red-400"
                  >
                <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Grid view (configurable filters + table) ── */}
        {catalogView === 'grid' ? (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <POSSearchGrid
              products={products}
              services={services}
              externalSearch={search}
              onAddToCart={(item: AddToCartItem) => handleProductAdd({
                id: item.id,
                variant_id: item.variant_id,
                name: item.name,
                sku: item.sku,
                price: item.price,
                tax_rate: item.tax_rate,
                hsn_code: item.hsn_code,
                item_type: item.item_type,
                image_url: item.image_url,
                duration_minutes: item.duration_minutes,
              })}
              onVariantPick={(p: any) => setVariantPickerProduct(p)}
            />
          </div>
        ) : (
          <>
            {/* Filter tabs — card view */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setFilter('all')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >All ({products.length + services.length})</button>
              <button onClick={() => setFilter('products')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === 'products' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              ><Package className="w-3.5 h-3.5" /> Products ({products.reduce((n: number, p: any) => {
                  const av = (p.variants || []).filter((v: any) => v.is_active !== false)
                  return n + (av.length > 0 ? av.length : 1)
                }, 0)})</button>
              <button onClick={() => setFilter('services')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === 'services' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              ><Wrench className="w-3.5 h-3.5" /> Services ({services.length})</button>
            </div>

            {/* Catalog list — card view */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {(filter === 'all' || filter === 'products') && products.length > 0 && (
                <>
                  {filter === 'all' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 sticky top-0 bg-gray-50/90 backdrop-blur-sm rounded text-xs font-medium text-gray-500 uppercase tracking-wide z-10">
                      <Package className="w-3 h-3 text-blue-500" /> Products
                    </div>
                  )}
                  {products.flatMap((p: any) => {
                    const imgUrl = p.images?.[0]?.url || p.images?.[0]?.file_url || p.image_url
                    const activeVariants = (p.variants || []).filter((v: any) => v.is_active !== false)
                    const hasVariants = activeVariants.length > 0

                    if (hasVariants) {
                      return activeVariants.map((v: any) => (
                        <div key={`p-${p.id}-v-${v.id}`}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border hover:bg-blue-50 hover:border-blue-200 transition-colors text-left group">
                          <button
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                            onClick={() => addToCart({ id: p.id, variant_id: v.id, name: `${p.name}${v.name ? ` — ${v.name}` : ''}`, sku: v.sku || p.sku, price: v.price || p.price || 0, tax_rate: v.tax_rate ?? p.tax_rate ?? p.gst_rate ?? 0, hsn_code: v.hsn_code || p.hsn_code, item_type: 'product', image_url: imgUrl })}>
                            <CatalogImage url={imgUrl} type="product" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              <p className="text-xs text-blue-600 font-semibold truncate">{v.name}</p>
                              <p className="text-xs text-gray-400 font-mono">{v.sku || p.sku || 'No SKU'} · Stock: {v.quantity ?? '—'}</p>
                            </div>
                          </button>
                          <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                            <p className="text-sm font-bold">{formatCurrency(v.price || p.price || 0)}</p>
                            <div className="flex items-center gap-1.5">
                              <button onClick={e => { e.stopPropagation(); setVariantPickerProduct(p) }}
                                className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors whitespace-nowrap">
                                {activeVariants.length} variants
                              </button>
                              <button onClick={() => addToCart({ id: p.id, variant_id: v.id, name: `${p.name}${v.name ? ` — ${v.name}` : ''}`, sku: v.sku || p.sku, price: v.price || p.price || 0, tax_rate: v.tax_rate ?? p.tax_rate ?? p.gst_rate ?? 0, hsn_code: v.hsn_code || p.hsn_code, item_type: 'product', image_url: imgUrl })}
                                className="p-0.5 hover:bg-blue-100 rounded transition-colors">
                                <Plus className="w-4 h-4 text-blue-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    }

                    return [(
                      <button key={`p-${p.id}`}
                        onClick={() => handleProductAdd({ id: p.id, name: p.name, sku: p.sku, price: p.price || 0, tax_rate: p.tax_rate || p.gst_rate || 0, hsn_code: p.hsn_code, item_type: 'product', image_url: imgUrl })}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border hover:bg-blue-50 hover:border-blue-200 transition-colors text-left">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CatalogImage url={imgUrl} type="product" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-gray-500">{p.sku || 'No SKU'} · Stock: {p.quantity ?? '—'}</p>
                          </div>
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          <p className="text-sm font-bold">{formatCurrency(p.price || 0)}</p>
                          <Plus className="w-4 h-4 text-blue-500 ml-auto" />
                        </div>
                      </button>
                    )]
                  })}
                </>
              )}

              {(filter === 'all' || filter === 'services') && services.length > 0 && (
                <>
                  {filter === 'all' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 sticky top-0 bg-gray-50/90 backdrop-blur-sm rounded text-xs font-medium text-gray-500 uppercase tracking-wide z-10">
                      <Wrench className="w-3 h-3 text-primary/80" /> Services
                    </div>
                  )}
                  {services.map((s: any) => {
                    const sImgUrl = s.media?.[0]?.url || s.media?.[0]?.file_url || s.image_url
                    return (
                      <button key={`s-${s.id}`} onClick={() => addToCart({ id: s.id, name: s.name, price: s.sale_price ?? s.price ?? 0, tax_rate: s.tax_rate || s.gst_rate || 0, sac_code: s.sac_code, item_type: 'service', duration_minutes: s.duration_minutes, image_url: sImgUrl })}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border hover:bg-accent hover:border-primary/30 transition-colors text-left">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CatalogImage url={sImgUrl} type="service" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{s.name}</p>
                            <p className="text-xs text-gray-500">
                              {s.service_type || 'Service'}
                              {s.duration_minutes ? ` · ${s.duration_minutes}min` : ''}
                              {s.sac_code ? ` · ${s.sac_code}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          {s.sale_price != null && s.sale_price !== s.price ? (
                            <>
                              <p className="text-sm font-bold text-primary">{formatCurrency(s.sale_price)}</p>
                              <p className="text-xs text-gray-400 line-through">{formatCurrency(s.price || 0)}</p>
                            </>
                          ) : (
                            <p className="text-sm font-bold">{formatCurrency(s.sale_price ?? s.price ?? 0)}</p>
                          )}
                          <Plus className="w-4 h-4 text-primary/80 ml-auto mt-0.5" />
                        </div>
                      </button>
                    )
                  })}
                </>
              )}

              {((filter === 'all' && products.length === 0 && services.length === 0) ||
                (filter === 'products' && products.length === 0) ||
                (filter === 'services' && services.length === 0)) && (
                <div className="text-center py-8">
                  <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">{search ? `No results for "${search}"` : `No active ${filter === 'all' ? 'items' : filter} found`}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Right: Cart ── */}
      <div className="flex-[4] min-w-[340px] flex flex-col bg-white rounded-xl border overflow-hidden">
        <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${
          txnMode === 'return' ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          {txnMode === 'return' ? <RotateCcw className="w-4 h-4 text-red-600" /> :
           <ShoppingCart className="w-4 h-4 text-gray-600" />}
          <span className="font-semibold text-sm text-gray-700">
            {txnMode === 'sale' ? 'Cart' : 'Return'} ({cart.length})
          </span>
        </div>

        {/* Customer selection */}
        <div className="px-3 py-2 border-b bg-gray-50/50 space-y-1.5">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="font-medium text-blue-800">{selectedCustomer.full_name}</span>
                  {selectedCustomer.phone && <span className="text-xs text-blue-600 ml-2">{selectedCustomer.phone}</span>}
                  {selectedCustomer.id === defaultCustomerId && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded ml-2">Default</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {selectedCustomer.id !== defaultCustomerId && (
                  <button
                    onClick={async () => {
                      try {
                        const cur = vendorData?.settings || {}
                        await vendorApi.updateMyVendor({ settings: { ...cur, default_pos_customer_id: selectedCustomer.id } } as any)
                        setDefaultCustomerId(selectedCustomer.id)
                        toast.success(`${selectedCustomer.full_name} set as default POS customer`)
                      } catch { toast.error('Could not save default customer') }
                    }}
                    className="text-blue-400 hover:text-blue-600 p-0.5" title="Set as default POS customer"
                  >
                    <Award className="w-3.5 h-3.5" />
                  </button>
                )}
                <button type="button" aria-label="Close" onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }} className="text-blue-400 hover:text-blue-600">
                <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                      placeholder="Search customer..."
                      className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <button onClick={() => setShowQuickCreate(true)}
                    className="flex items-center gap-1 px-2 h-8 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
                    title="Quick create customer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {showCustomerDropdown && customerResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
                    {customerResults.map(cust => (
                      <button key={cust.id}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center justify-between"
                        onMouseDown={() => selectCustomer(cust)}
                      >
                        <span className="font-medium">{cust.full_name}</span>
                        <span className="text-xs text-gray-500">{cust.phone || cust.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Recent customers scrollable */}
              {!customerSearch && recentCustomers.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                  {recentCustomers.map(cust => (
                    <button key={cust.id} onClick={() => selectCustomer(cust)}
                      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs hover:bg-blue-50 hover:border-blue-200 transition-colors"
                    >
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="font-medium text-gray-700 truncate max-w-[80px]">{cust.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {txnMode === 'sale' && (
          <div className="px-3 py-2 border-b bg-gray-50/50 space-y-1">
            <SectionLabel>Salesperson (commission)</SectionLabel>
            <StaffPicker selected={selectedSalesPerson} onSelect={setSelectedSalesPerson} />
          </div>
        )}

        {/* Quick create customer modal */}
        {showQuickCreate && (
          <QuickCreateCustomerModal
            onSelect={handleQuickCreateSelect}
            onClose={() => setShowQuickCreate(false)}
            returnTo="?returnTo=pos"
          />
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto divide-y">
          {!cart.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ShoppingCart className="w-10 h-10 mb-2" />
              <p className="text-sm">Add products or services</p>
              <p className="text-xs text-gray-300 mt-1">Search or click items from catalog</p>
            </div>
          ) : cart.map((item, idx) => (
            <div key={idx} className="px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <CatalogImage url={item.image_url} type={item.item_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(item.price)} x {item.qty}
                    {item.tax_rate > 0 && <span className="ml-1 text-amber-600">({item.tax_rate}%)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(idx, -1)} className="p-1 rounded hover:bg-gray-100"><Minus className="w-3 h-3" /></button>
                  <span className="w-7 text-center text-sm font-medium">{item.qty}</span>
                  <button onClick={() => updateQty(idx, 1)} className="p-1 rounded hover:bg-gray-100"><Plus className="w-3 h-3" /></button>
                </div>
                <p className="text-sm font-bold w-16 text-right">{formatCurrency(item.price * item.qty)}</p>
                <button onClick={() => removeFromCart(idx)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
              </div>
              {/* Item-level discount */}
              {item.discount > 0 && (
                <div className="flex items-center gap-2 pl-5">
                  <span className="text-xs text-green-600">Discount:</span>
                  <input type="number" min={0} value={item.discount} onChange={e => updateItemDiscount(idx, Number(e.target.value))}
                    className="w-20 h-6 text-xs border rounded px-1.5" />
                </div>
              )}
              {item.discount === 0 && (
                <button onClick={() => updateItemDiscount(idx, 1)} className="text-xs text-gray-400 hover:text-green-600 pl-5">+ Add discount</button>
              )}
              {/* Booking slot picker for service items */}
              {item.item_type === 'service' && txnMode === 'sale' && (
                <div className="ml-5 mt-1">
                  {item.booking_date && item.booking_time ? (
                    /* Slot confirmed — show summary with edit button */
                    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-accent/70 px-3 py-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                      <span className="text-xs text-primary font-medium flex-1">
                        {new Date(item.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        {' · '}
                        {item.booking_time}
                        {item.booking_notes?.startsWith('to:') && (
                          <span className="text-primary/70"> – {item.booking_notes.slice(3)}</span>
                        )}
                        {item.duration_minutes && (
                          <span className="text-primary/70 ml-1">· {item.duration_minutes} min</span>
                        )}
                      </span>
                      <button
                        onClick={() => setBookingPanelIdx(idx)}
                        className="flex items-center gap-1 text-xs text-primary/80 hover:text-primary font-medium"
                      >
                        <Pencil className="w-3 h-3" /> Change
                      </button>
                    </div>
                  ) : (
                    /* No slot yet — prompt to open panel */
                    <button
                      onClick={() => setBookingPanelIdx(idx)}
                      className="w-full flex items-center gap-2 rounded-lg border border-primary/30 border-dashed bg-accent/70 px-3 py-1.5 text-xs text-primary hover:bg-primary/12/60 hover:border-primary/40 transition-colors"
                    >
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-medium">Book Slot</span>
                      <span className="text-primary/70 ml-auto flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" /> Set date &amp; time
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Coupon code */}
        {txnMode === 'sale' && (
          <div className="px-3 py-2 border-t bg-gray-50/50">
            {couponApplied ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <Tag className="w-3.5 h-3.5 text-green-600" />
                  <span className="font-semibold text-green-700">{couponApplied.code}</span>
                  <span className="text-green-600">-{formatCurrency(couponApplied.discount)}</span>
                </div>
                <button type="button" aria-label="Close" onClick={removeCoupon} className="text-green-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    type="text" value={couponCode} onChange={e => setCouponCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                    placeholder="Enter coupon code..."
                    className="w-full h-7 pl-7 pr-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()} className="h-7 px-2 text-xs">
                  {couponLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Loyalty points */}
        {loyaltyProgram?.is_active && loyaltyAccount && selectedCustomer && txnMode === 'sale' && (
          <div className="px-3 py-2 border-t bg-amber-50/50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs">
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-medium text-amber-700">Loyalty Points</span>
              </div>
              <span className="text-xs font-bold text-amber-700">{loyaltyAccount.points_balance} pts</span>
            </div>
            {loyaltyAccount.points_balance >= (loyaltyProgram.min_redeem_points || 0) && (
              <div className="flex items-center gap-2">
                <input
                  type="range" min={0}
                  max={Math.min(
                    loyaltyAccount.points_balance,
                    Math.floor(grandTotal * (loyaltyProgram.max_redeem_percent / 100) / (loyaltyProgram.currency_per_point || 1))
                  )}
                  value={loyaltyRedeem}
                  onChange={e => setLoyaltyRedeem(Number(e.target.value))}
                  className="flex-1 h-1.5 accent-amber-500"
                />
                <span className="text-xs font-medium text-amber-700 w-20 text-right">
                  {loyaltyRedeem > 0 ? `${loyaltyRedeem} pts = -${formatCurrency(loyaltyDiscountValue)}` : '0 pts'}
                </span>
              </div>
            )}
            {loyaltyAccount.points_balance < (loyaltyProgram.min_redeem_points || 0) && (
              <p className="text-xs text-amber-600">Min {loyaltyProgram.min_redeem_points} pts to redeem</p>
            )}
          </div>
        )}

        {/* Cart discount + notes */}
        <div className="px-3 py-2 border-t bg-gray-50 space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Discount:</Label>
            <select className="text-xs border rounded px-2 py-1" value={discountType} onChange={(e) => setDiscountType(e.target.value as 'flat' | 'percentage')}>
              <option value="flat">Flat</option>
              <option value="percentage">%</option>
            </select>
            <Input type="number" min={0} value={cartDiscount} onChange={(e) => setCartDiscount(Number(e.target.value))} className="h-7 text-sm w-20" />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Notes:</Label>
            <input type="text" value={cartNotes} onChange={e => setCartNotes(e.target.value)} placeholder="Optional notes..."
              className="flex-1 h-7 text-xs border rounded px-2" />
          </div>
        </div>

        {/* Totals */}
        <div className="px-4 py-2.5 border-t space-y-0.5">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          {manualDiscount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-{formatCurrency(manualDiscount)}</span></div>}
          {couponDiscountAmt > 0 && <div className="flex justify-between text-sm text-green-600"><span className="flex items-center gap-1"><Tag className="w-3 h-3" />{couponApplied?.code}</span><span>-{formatCurrency(couponDiscountAmt)}</span></div>}
          {loyaltyDiscountValue > 0 && <div className="flex justify-between text-sm text-amber-600"><span className="flex items-center gap-1"><Star className="w-3 h-3" />{loyaltyRedeem} pts</span><span>-{formatCurrency(loyaltyDiscountValue)}</span></div>}
          <div className="flex justify-between text-sm"><span className="text-gray-500">Tax</span><span>{formatCurrency(totalTax)}</span></div>
          <div className={`flex justify-between text-lg font-bold border-t pt-1.5 mt-1 ${
            txnMode === 'return' ? 'text-red-600' : ''
          }`}>
            <span>{txnMode === 'return' ? 'Refund' : 'Total'}</span>
            <span>{txnMode === 'return' ? '-' : ''}{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* Pay button */}
        <div className="px-4 py-3 border-t">
          <Button
            className={`w-full gap-2 ${txnMode === 'return' ? 'bg-red-600 hover:bg-red-700' : ''}`}
            size="lg" disabled={!cart.length}
            onClick={() => setPaymentModal(true)}
          >
            {txnMode === 'return'
              ? <><RotateCcw className="w-5 h-5" />Refund {formatCurrency(grandTotal)}</>
              : <><IndianRupee className="w-5 h-5" />Charge {formatCurrency(grandTotal)}</>}
          </Button>
        </div>
      </div>

      {paymentModal && (
        <PaymentModal
          total={grandTotal}
          sessionId={session!.id as string}
          cart={cart}
          lineAmounts={cartLineAmounts}
          discountType={discountType}
          discountValue={cartDiscount}
          txnMode={txnMode}
          originalTxnId={originalTxn?.id as string | undefined}
          selectedCustomer={selectedCustomer}
          notes={cartNotes}
          couponCode={couponApplied?.code}
          loyaltyPointsRedeem={loyaltyRedeem}
          restaurantTableId={tableFromUrl || undefined}
          restaurantCovers={restaurantCovers ?? undefined}
          salesPersonVendorUserId={selectedSalesPerson?.id}
          onClose={() => setPaymentModal(false)}
          onComplete={(result) => {
            setCart([])
            setCartDiscount(0)
            setCartNotes('')
            setCouponCode('')
            setCouponApplied(null)
            setLoyaltyRedeem(0)
            setPaymentModal(false)
            setOriginalTxn(null)
            setReturnLookup('')
            if (!defaultCustomerId) {
              setSelectedCustomer(null)
              setCustomerSearch('')
            }
            queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, 'pos-transactions'] })
            if (tableFromUrl) {
              queryClient.invalidateQueries({ queryKey: ['restaurant', 'kitchen'] })
              queryClient.invalidateQueries({ queryKey: ['restaurant', 'kots'] })
              queryClient.invalidateQueries({ queryKey: ['restaurant', 'tables'] })
            }
            // Close the open restaurant order if one was passed
            if (orderFromUrl && result?.id) {
              vendorApi.restaurantCloseOrder(orderFromUrl, String(result.id)).then(() => {
                queryClient.invalidateQueries({ queryKey: ['restaurant'] })
                navigate('/restaurant/floor')
              }).catch(() => {
                // Non-fatal: order may already be closed or was voided
                navigate('/restaurant/floor')
              })
            }
            if (result) setReceiptData(result)
          }}
        />
      )}

      {/* Modifier Picker Modal */}
      {modifierPendingItem && (
        <ModifierPickerModal
          item={modifierPendingItem}
          onConfirm={(itemWithModifiers) => {
            addToCart(itemWithModifiers)
            setModifierPendingItem(null)
          }}
          onClose={() => setModifierPendingItem(null)}
        />
      )}

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        open={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleBarcodeScan}
        title="Scan Product Barcode"
      />

      {/* Variant Picker Modal — shown when catalog product has variants */}
      {variantPickerProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setVariantPickerProduct(null)}>
          <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{variantPickerProduct.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Select a variant to add to cart</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setVariantPickerProduct(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-3 space-y-1 max-h-72 overflow-y-auto">
              {(variantPickerProduct.variants || [])
                .filter((v: any) => v.is_active !== false)
                .map((v: any) => {
                  const imgUrl = variantPickerProduct.images?.[0]?.url || variantPickerProduct.images?.[0]?.file_url
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        addToCart({
                          id: variantPickerProduct.id,
                          variant_id: v.id,
                          name: `${variantPickerProduct.name}${v.name ? ` — ${v.name}` : ''}`,
                          sku: v.sku || variantPickerProduct.sku,
                          price: v.price || variantPickerProduct.price || 0,
                          tax_rate: v.tax_rate ?? variantPickerProduct.tax_rate ?? variantPickerProduct.gst_rate ?? 0,
                          hsn_code: v.hsn_code || variantPickerProduct.hsn_code,
                          item_type: 'product',
                          image_url: imgUrl,
                        })
                        setVariantPickerProduct(null)
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border hover:bg-blue-50 hover:border-blue-200 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.name || variantPickerProduct.name}</p>
                        <p className="text-xs text-gray-400">{v.sku || '—'} · Stock: {v.quantity ?? '—'}</p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="text-sm font-bold text-blue-600">{formatCurrency(v.price || 0)}</p>
                        <Plus className="w-3.5 h-3.5 text-blue-400 ml-auto mt-0.5" />
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* Book Slot Panel — opens for a service cart item */}
      {bookingPanelIdx !== null && cart[bookingPanelIdx] && (
        <POSBookingPanel
          cartIdx={bookingPanelIdx}
          serviceName={cart[bookingPanelIdx].name}
          serviceId={cart[bookingPanelIdx].product_id}
          servicePrice={cart[bookingPanelIdx].price}
          serviceDurationMinutes={cart[bookingPanelIdx].duration_minutes}
          currentDate={cart[bookingPanelIdx].booking_date || ''}
          currentFromTime={cart[bookingPanelIdx].booking_time || ''}
          currentToTime={
            cart[bookingPanelIdx].booking_notes?.startsWith('to:')
              ? cart[bookingPanelIdx].booking_notes!.slice(3)
              : ''
          }
          customer={selectedCustomer as Customer | null}
          onConfirm={applyBookingSlot}
          onOpenFullBooking={({ date, fromTime, toTime, staffId }) => {
            setFullBookingPreFill({
              date,
              startTime: fromTime,
              endTime: toTime,
              staffId,
              serviceId: cart[bookingPanelIdx]?.product_id,
            })
            setBookingPanelIdx(null)
          }}
          onClose={() => setBookingPanelIdx(null)}
        />
      )}

      {/* Full Booking modal — triggered from POSBookingPanel "Full Booking Details" */}
      {fullBookingPreFill && (
        <CreateBookingModal
          preFill={{
            customer: selectedCustomer as Customer | null,
            serviceId: fullBookingPreFill.serviceId,
            date: fullBookingPreFill.date,
            startTime: fullBookingPreFill.startTime,
            endTime: fullBookingPreFill.endTime,
            staffId: fullBookingPreFill.staffId || undefined,
          }}
          onCreated={() => {
            setFullBookingPreFill(null)
          }}
          onClose={() => setFullBookingPreFill(null)}
        />
      )}

      {/* POS Settings Modal */}
      {showPosSettings && (
        <POSInvoiceSettingsModal
          invSettings={invSettings}
          vendor={vendorData}
          posSettings={posSettings}
          onSettingsChange={(s) => { setPosSettings(s); savePosInvoiceSettings(s) }}
          onClose={() => setShowPosSettings(false)}
          defaultCustomerId={defaultCustomerId}
          defaultCustomerName={
            selectedCustomer?.id === defaultCustomerId ? selectedCustomer?.full_name ?? null : null
          }
          onDefaultCustomerSave={async (custId, custName) => {
            try {
              const cur = vendorData?.settings || {}
              await vendorApi.updateMyVendor({ settings: { ...cur, default_pos_customer_id: custId ?? undefined } } as any)
              setDefaultCustomerId(custId)
              if (custId && custName) {
                const newCust = { id: custId, full_name: custName }
                setSelectedCustomer(newCust)
              } else if (!custId && selectedCustomer?.id === defaultCustomerId) {
                setSelectedCustomer(null)
              }
            } catch { toast.error('Could not save default customer') }
          }}
          loyaltyProgram={loyaltyProgram as any}
          onLoyaltyProgramSave={async (program) => {
            try {
              const updated = await vendorApi.updateLoyaltyProgram(program)
              setLoyaltyProgram(updated)
              toast.success('Loyalty program saved!')
            } catch { toast.error('Could not save loyalty program') }
          }}
        />
      )}
      </div>
    </div>
  )
}

// ── Payment Modal ────────────────────────────────────────────────

function PaymentModal({
 total, sessionId, cart, lineAmounts, discountType, discountValue, txnMode, originalTxnId, selectedCustomer, notes, couponCode, loyaltyPointsRedeem, restaurantTableId, restaurantCovers, salesPersonVendorUserId, onClose, onComplete }: {
  total: number; sessionId: string; cart: CartItem[]; lineAmounts: number[]
  discountType: string; discountValue: number
  txnMode: TxnMode; originalTxnId?: string; selectedCustomer?: { id: string; full_name: string } | null
  notes?: string; couponCode?: string; loyaltyPointsRedeem?: number
  restaurantTableId?: string
  restaurantCovers?: number
  salesPersonVendorUserId?: string
  onClose: () => void; onComplete: (result: Record<string, unknown> | null) => void
}) {
  const isRefund = txnMode === 'return'
  const [method, setMethod] = useState<'cash' | 'upi' | 'card' | 'split' | 'covers' | 'by_item'>('cash')
  const [cashReceived, setCashReceived] = useState(0)
  const [splitCash, setSplitCash] = useState(0)
  const [splitUpi, setSplitUpi] = useState(0)
  const [splitCard, setSplitCard] = useState(0)
  const [loading, setLoading] = useState(false)
  const [tipAmount, setTipAmount] = useState(0)
  const [serviceChargeAmount, setServiceChargeAmount] = useState(0)
  /** Extra line for non-sale checkout (e.g. return reason) — not credit/debit memos; those use Finance → Memos. */
  const [returnDetailNotes, setReturnDetailNotes] = useState('')

  const grandTotal = total + tipAmount + serviceChargeAmount
  const changeDue = method === 'cash' && !isRefund ? Math.max(0, cashReceived - grandTotal) : 0
  const coverCount = restaurantCovers && restaurantCovers >= 2 ? restaurantCovers : 0
  const perCoverAmount =
    coverCount > 0 ? Math.round((grandTotal / coverCount) * 100) / 100 : 0
  const canSplitByItem = coverCount >= 2 && cart.length >= 2 && lineAmounts.length === cart.length
  const [itemCover, setItemCover] = useState<number[]>([])

  useEffect(() => {
    if (!canSplitByItem) return
    setItemCover(cart.map((_, i) => i % coverCount))
  }, [canSplitByItem, cart.length, coverCount])

  const handlePay = async () => {
    setLoading(true)
    let payments: { method: string; amount: number }[]
    let cashRcvd = 0
    if (method === 'covers' && coverCount >= 2) {
      payments = []
      let remaining = grandTotal
      for (let i = 0; i < coverCount; i += 1) {
        const amt = i === coverCount - 1 ? Math.round(remaining * 100) / 100 : perCoverAmount
        payments.push({ method: 'cash', amount: amt })
        remaining -= amt
      }
      cashRcvd = grandTotal
    } else if (method === 'by_item' && canSplitByItem) {
      const coverTotals = Array.from({ length: coverCount }, () => 0)
      cart.forEach((_, idx) => {
        const c = itemCover[idx] ?? 0
        coverTotals[c] += lineAmounts[idx] ?? 0
      })
      const baseSum = coverTotals.reduce((a, b) => a + b, 0)
      const scale = baseSum > 0 ? grandTotal / baseSum : 1
      const scaled = coverTotals.map(t => Math.round(t * scale * 100) / 100)
      const active = scaled.map((v, i) => (v > 0 ? i : -1)).filter(i => i >= 0)
      payments = []
      let paid = 0
      active.forEach((ci, n) => {
        const amt = n === active.length - 1 ? Math.round((grandTotal - paid) * 100) / 100 : scaled[ci]
        payments.push({ method: 'cash', amount: amt })
        paid += amt
      })
      cashRcvd = grandTotal
    } else if (method === 'split') {
      payments = []
      if (splitCash > 0) payments.push({ method: 'cash', amount: splitCash })
      if (splitUpi > 0) payments.push({ method: 'upi', amount: splitUpi })
      if (splitCard > 0) payments.push({ method: 'card', amount: splitCard })
      cashRcvd = splitCash
    } else {
      payments = [{ method, amount: grandTotal }]
      cashRcvd = method === 'cash' ? (isRefund ? grandTotal : cashReceived) : 0
    }

    const allNotes = [
      txnMode !== 'sale' ? `${txnMode.replace('_', ' ').toUpperCase()}` : '',
      method === 'covers' && coverCount >= 2
        ? `Split bill: ${coverCount} covers @ ${formatCurrency(perCoverAmount)} each`
        : '',
      method === 'by_item' && coverCount >= 2
        ? `Split by item across ${coverCount} covers`
        : '',
      returnDetailNotes,
      notes,
    ].filter(Boolean).join(' - ')

    try {
      const result = await vendorApi.posCreateTransaction({
        session_id: sessionId,
        transaction_type: txnMode,
        customer_id: selectedCustomer?.id || undefined,
        items: cart.map(i => ({
          product_id: i.product_id, variant_id: i.variant_id || undefined,
          name: i.name, sku: i.sku, qty: i.qty,
          price: i.price, discount: i.discount, tax_rate: i.tax_rate,
          hsn_code: i.hsn_code, item_type: i.item_type,
          booking_date: i.booking_date || undefined,
          booking_time: i.booking_time || undefined,
          duration_minutes: i.duration_minutes || undefined,
        })),
        discount_type: discountValue > 0 ? discountType : undefined,
        discount_value: discountValue,
        payment_methods: payments,
        cash_received: cashRcvd,
        notes: allNotes || undefined,
        return_of: originalTxnId || undefined,
        coupon_code: couponCode || undefined,
        loyalty_points_redeem: loyaltyPointsRedeem || 0,
        ...(restaurantTableId && txnMode === 'sale' ? { restaurant_table_id: restaurantTableId } : {}),
        ...(txnMode === 'sale' && salesPersonVendorUserId
          ? { sales_person_vendor_user_id: salesPersonVendorUserId }
          : {}),
        tip_amount: tipAmount,
        service_charge_amount: serviceChargeAmount,
      })

      const successMsg = txnMode === 'sale' ? 'Sale completed!' : 'Refund processed!'
      toast.success(successMsg)
      onComplete({
        ...result,
        customer_name: selectedCustomer?.full_name || 'Walk-in',
        payment_method: method,
        change_due: changeDue,
        txn_mode: txnMode,
      })
    } catch (err) {
      toast.error(extractApiError(err, txnMode === 'sale' ? 'Could not complete sale' : 'Could not process refund'))
      setLoading(false)
    }
  }

  const paymentMethods = [
    { key: 'cash' as const, icon: Banknote, label: 'Cash', color: 'text-green-600' },
    { key: 'upi' as const, icon: Smartphone, label: 'UPI', color: 'text-primary' },
    { key: 'card' as const, icon: CreditCard, label: 'Card', color: 'text-blue-600' },
    { key: 'split' as const, icon: FileText, label: 'Split', color: 'text-amber-600' },
    ...(canSplitByItem
      ? [{ key: 'by_item' as const, icon: LayoutList, label: 'By item', color: 'text-teal-600' }]
      : []),
    ...(coverCount >= 2
      ? [{ key: 'covers' as const, icon: Users, label: `${coverCount} covers`, color: 'text-violet-600' }]
      : []),
  ]

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          txnMode === 'return' ? 'bg-red-50' : ''
        }`}>
          <div>
            <h2 className="text-lg font-semibold">{isRefund ? 'Refund' : 'Payment'}</h2>
            <p className="text-sm text-gray-500">
              Subtotal: <span className="font-bold">{formatCurrency(total)}</span>
              {(tipAmount > 0 || serviceChargeAmount > 0) && (
                <span className="ml-2 text-primary font-bold">→ {formatCurrency(grandTotal)}</span>
              )}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {!isRefund && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
              <div>
                <label className="text-xs text-amber-700 font-medium block mb-1">Tip (₹)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={tipAmount || ''}
                  placeholder="0"
                  onChange={e => setTipAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full h-8 rounded-md border border-amber-200 bg-white px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-amber-700 font-medium block mb-1">Service charge (₹)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={serviceChargeAmount || ''}
                  placeholder="0"
                  onChange={e => setServiceChargeAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full h-8 rounded-md border border-amber-200 bg-white px-2 text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">{isRefund ? 'Refund Method' : 'Payment Method'}</Label>
            <div className={`grid gap-2 ${paymentMethods.length > 4 ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-4'}`}>
              {paymentMethods.map(m => (
                <button key={m.key} onClick={() => setMethod(m.key)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${
                    method === m.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {method === 'cash' && !isRefund && (
            <div className="space-y-2">
              <Label>Cash Received</Label>
              <Input type="number" min={total} value={cashReceived} onChange={e => setCashReceived(Number(e.target.value))} />
              {changeDue > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-green-700">Change</span>
                  <span className="text-xl font-bold text-green-700">{formatCurrency(changeDue)}</span>
                </div>
              )}
            </div>
          )}

          {method === 'cash' && isRefund && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-700">Cash to return</span>
                <span className="text-xl font-bold text-red-700">{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          {method === 'split' && (
            <div className="space-y-2">
              <div className="flex gap-2 items-center"><Label className="w-12 shrink-0">Cash</Label><Input type="number" min={0} value={splitCash} onChange={e => setSplitCash(Number(e.target.value))} /></div>
              <div className="flex gap-2 items-center"><Label className="w-12 shrink-0">UPI</Label><Input type="number" min={0} value={splitUpi} onChange={e => setSplitUpi(Number(e.target.value))} /></div>
              <div className="flex gap-2 items-center"><Label className="w-12 shrink-0">Card</Label><Input type="number" min={0} value={splitCard} onChange={e => setSplitCard(Number(e.target.value))} /></div>
              <p className={`text-sm font-medium ${splitCash + splitUpi + splitCard >= grandTotal ? 'text-green-600' : 'text-red-600'}`}>
                Split: {formatCurrency(splitCash + splitUpi + splitCard)} / {formatCurrency(grandTotal)}
              </p>
            </div>
          )}

          {method === 'covers' && coverCount >= 2 && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 space-y-2">
              <p className="text-sm text-violet-900">
                Equal split across <strong>{coverCount}</strong> covers from the table order.
              </p>
              <p className="text-lg font-bold text-violet-800">{formatCurrency(perCoverAmount)} per cover</p>
              <p className="text-xs text-violet-600">
                Records {coverCount} cash payments (one per cover). Adjust tip or service charge above before paying.
              </p>
            </div>
          )}

          {method === 'by_item' && canSplitByItem && (
            <div className="rounded-lg border border-teal-200 bg-teal-50/80 p-3 space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-teal-900">
                Assign each line to a cover ({coverCount} guests). Totals include tax and discounts.
              </p>
              {cart.map((item, idx) => (
                <div key={`${item.product_id}-${idx}`} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 min-w-0 truncate text-gray-800">
                    {item.qty}× {item.name}
                  </span>
                  <span className="text-xs font-mono text-teal-800 shrink-0">
                    {formatCurrency(lineAmounts[idx] ?? 0)}
                  </span>
                  <select
                    className="h-8 rounded border border-teal-200 bg-white px-2 text-xs shrink-0"
                    value={itemCover[idx] ?? 0}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10)
                      setItemCover(prev => {
                        const next = [...prev]
                        next[idx] = v
                        return next
                      })
                    }}
                  >
                    {Array.from({ length: coverCount }, (_, c) => (
                      <option key={c} value={c}>Cover {c + 1}</option>
                    ))}
                  </select>
                </div>
              ))}
              <p className="text-xs text-teal-700 pt-1 border-t border-teal-100">
                {Array.from({ length: coverCount }, (_, c) => {
                  const sum = cart.reduce(
                    (s, __, idx) => s + ((itemCover[idx] ?? 0) === c ? (lineAmounts[idx] ?? 0) : 0),
                    0,
                  )
                  return `Cover ${c + 1}: ${formatCurrency(sum)}`
                }).join(' · ')}
              </p>
            </div>
          )}

          {txnMode !== 'sale' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Reason</Label>
              <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
                value={returnDetailNotes} onChange={e => { setReturnDetailNotes(e.target.value) }}
                placeholder={txnMode === 'return' ? 'Reason for return...' : 'Details...'} />
            </div>
          )}

          <Button
            className={`w-full gap-2 ${txnMode === 'return' ? 'bg-red-600 hover:bg-red-700' : ''}`}
            size="lg" onClick={handlePay}
            disabled={
              loading ||
              (method === 'split' && splitCash + splitUpi + splitCard < grandTotal) ||
              (!isRefund && method === 'cash' && cashReceived < grandTotal)
            }
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <IndianRupee className="w-5 h-5" />}
            {txnMode === 'sale' ? 'Complete Sale' : 'Process Refund'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Post-Sale Receipt ────────────────────────────────────────────

function PostSaleReceipt({ data, invSettings, vendor, posSettings, onClose, onNewSale }: {
  data: Record<string, unknown>; invSettings: Partial<InvoiceSettings>; vendor?: any
  posSettings: Partial<InvoiceSettings>
  onClose: () => void; onNewSale: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [showPrintForms, setShowPrintForms] = useState(false)
  const [enabledForms] = useState<PrintFormId[]>(() => loadEnabledForms())

  // Booking details & actions
  const [bookingDetails, setBookingDetails] = useState<Record<string, any>>({})
  const [bookingActionsId, setBookingActionsId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    if (!bookingNumbers.length) return
    bookingNumbers.forEach(async (bNum) => {
      try {
        const b = await vendorApi.getBooking(bNum)
        setBookingDetails(prev => ({ ...prev, [bNum]: b }))
      } catch { /* booking may not be fetchable by number directly */ }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancelBooking = async (bookingId: string, status: 'cancelled' | 'no_show') => {
    setCancellingId(bookingId)
    try {
      await vendorApi.updateBookingStatus(bookingId, {
        status,
        cancel_reason: cancelReason || (status === 'no_show' ? 'Customer no-show' : 'Cancelled at POS'),
      })
      setBookingDetails(prev => ({
        ...prev,
        [bookingId]: { ...prev[bookingId], status },
      }))
      toast.success(status === 'no_show' ? 'Marked as no-show' : 'Booking cancelled')
      setBookingActionsId(null)
      setCancelReason('')
    } catch (err) {
      toast.error(extractApiError(err, 'Could not update booking'))
    }
    setCancellingId(null)
  }
  const txnNumber = data.transaction_number as string
  const orderNumber = data.order_number as string
  const invoiceNumber = data.invoice_number as string
  const invoiceId = data.invoice_id as string
  const bookingNumbers = (data.booking_numbers as string[]) || []
  const total = data.total as number
  const changeDue = data.change_due as number
  const customerName = data.customer_name as string
  const paymentMethod = data.payment_method as string
  const items = (data.items || []) as Record<string, unknown>[]
  const txnMode = data.txn_mode as string
  const loyaltyEarned = (data.loyalty_points_earned as number) || 0
  const loyaltyRedeemed = (data.loyalty_points_redeemed as number) || 0
  const couponDiscount = (data.coupon_discount as number) || 0
  const appliedCoupon = data.coupon_code as string | null

  const buildInvoiceDataFromTxn = (): Record<string, unknown> => ({
    invoice_number: invoiceNumber || txnNumber,
    invoice_type: 'invoice',
    document_type: vendor?.gstin ? 'tax_invoice' : 'bill_of_supply',
    created_at: new Date().toISOString(),
    customer_name: customerName || 'Walk-in',
    vendor_name: vendor?.display_name || vendor?.business_name || '',
    vendor_gstin: vendor?.gstin || '',
    vendor_pan: vendor?.pan_number || '',
    vendor_address: [vendor?.street_address, vendor?.city, vendor?.state, vendor?.postal_code].filter(Boolean).join(', '),
    vendor_logo_url: vendor?.logo_url || '',
    items: items.map((it: any) => ({
      name: it.name,
      description: '',
      hsn_sac: it.hsn_code || '',
      qty: it.qty,
      rate: it.price,
      discount: it.discount || 0,
      taxable_value: it.taxable || (it.price * it.qty - (it.discount || 0)),
      tax_rate: it.tax_rate || 0,
      tax_amount: it.tax_amount || 0,
      total: it.total || it.price * it.qty,
    })),
    subtotal: data.subtotal || 0,
    discount_amount: data.discount_amount || 0,
    taxable_amount: (data.subtotal as number || 0) - (data.discount_amount as number || 0),
    total_tax: data.tax_amount || 0,
    total: total,
    amount_paid: total,
    balance_due: 0,
    status: 'paid',
    is_gst: !!vendor?.gstin,
    is_inter_state: false,
    payment_terms: 'Paid',
    notes: `POS Transaction: ${txnNumber}${orderNumber ? ` | Order: ${orderNumber}` : ''}`,
  })

  // POS-specific overrides (template, paper size, color, toggles) take precedence
  // over the vendor's general invoice settings.
  const mergedSettings = (): Partial<InvoiceSettings> => ({ ...invSettings, ...posSettings })

  const handlePrintInvoice = async () => {
    setLoadingInvoice(true)
    try {
      const inv = invoiceId ? await vendorApi.getInvoice(invoiceId) : buildInvoiceDataFromTxn()
      await printInvoice(inv as Record<string, unknown>, mergedSettings())
    } catch (err) {
      toast.error(extractApiError(err, 'Could not load invoice for printing'))
    }
    setLoadingInvoice(false)
  }

  const handleDownloadPdf = async () => {
    setLoadingInvoice(true)
    try {
      const inv = invoiceId ? await vendorApi.getInvoice(invoiceId) : buildInvoiceDataFromTxn()
      const s = mergedSettings()
      const rawLogo = resolveInvoiceTemplateLogoPath(s, (inv as Record<string, unknown>).vendor_logo_url as string)
      const rawSig  = s.signature_url || ''
      const [logoDataUrl, sigDataUrl] = await Promise.all([
        rawLogo ? fetchAsDataUrl(rawLogo) : Promise.resolve(''),
        rawSig  ? fetchAsDataUrl(rawSig)  : Promise.resolve(''),
      ])
      const enriched = { ...s, logo_url: logoDataUrl || undefined, signature_url: sigDataUrl || undefined }
      const html = generateInvoiceHtml({ ...(inv as Record<string, unknown>), vendor_logo_url: logoDataUrl || (inv as Record<string, unknown>).vendor_logo_url }, enriched, '')
      await downloadAsPdf(html, `${(invoiceNumber || txnNumber).replace(/\//g, '-')}.pdf`, { margin: s.pdf_margin ?? 5, orientation: s.pdf_orientation ?? 'portrait', imageQuality: s.pdf_image_quality ?? 0.98 })
    } catch (err) {
      toast.error(extractApiError(err, 'Could not generate PDF'))
    }
    setLoadingInvoice(false)
  }

  const customerPhone = data.customer_phone as string | null

  const buildMessage = () => buildShareMessage({
    type: 'receipt',
    number: invoiceNumber || txnNumber,
    vendorName: vendor?.display_name || vendor?.business_name || '',
    customerOrSupplier: customerName || 'Customer',
    total,
    date: new Date().toLocaleDateString('en-IN'),
    status: 'Paid',
    items: items.map((it: Record<string, unknown>) => ({
      name: String(it.name || ''),
      qty: Number(it.qty || 0),
      amount: Number(it.total || (Number(it.price) * Number(it.qty)) || 0),
    })),
  })

  const handleWhatsApp = async () => {
    setLoadingInvoice(true)
    try {
      const inv = invoiceId ? await vendorApi.getInvoice(invoiceId) : buildInvoiceDataFromTxn()
      const s = mergedSettings()
      const rawLogo = resolveInvoiceTemplateLogoPath(s, (inv as Record<string, unknown>).vendor_logo_url as string)
      const logoDataUrl = rawLogo ? await fetchAsDataUrl(rawLogo) : ''
      const enriched = { ...s, logo_url: logoDataUrl || undefined }
      const html = generateInvoiceHtml(
        { ...(inv as Record<string, unknown>), vendor_logo_url: logoDataUrl || (inv as Record<string, unknown>).vendor_logo_url },
        enriched, '',
      )
      await shareInvoiceViaWhatsApp({
        html,
        filename: `${(invoiceNumber || txnNumber).replace(/\//g, '-')}.pdf`,
        phone: customerPhone,
        textMessage: buildMessage(),
        pdfOpts: { margin: s.pdf_margin ?? 5, orientation: s.pdf_orientation ?? 'portrait', imageQuality: s.pdf_image_quality ?? 0.98 },
      })
    } catch {
      shareViaWhatsApp(buildMessage(), customerPhone)
    }
    setLoadingInvoice(false)
  }
  const handleSms      = () => shareViaSms(buildMessage(), customerPhone)

  const handleQuickReceipt = () => {
    const w = window.open('', '_blank', 'width=400,height=600')
    if (!w) return
    const itemRows = items.map((i: any) =>
      `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">₹${(i.total || i.price * i.qty).toFixed(2)}</td></tr>`
    ).join('')
    w.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto}
      table{width:100%;border-collapse:collapse}td{padding:2px 4px}hr{border:none;border-top:1px dashed #999;margin:6px 0}
      .center{text-align:center}.right{text-align:right}.bold{font-weight:bold}</style></head><body>
      <div class="center bold">${txnMode === 'return' ? 'REFUND' : 'RECEIPT'}</div>
      <hr/><div>Txn: ${txnNumber}</div>${orderNumber ? `<div>Order: ${orderNumber}</div>` : ''}
      ${invoiceNumber ? `<div>Invoice: ${invoiceNumber}</div>` : ''}
      ${bookingNumbers.length ? `<div>Booking: ${bookingNumbers.join(', ')}</div>` : ''}
      <div>Customer: ${customerName}</div><div>Date: ${new Date().toLocaleString('en-IN')}</div>
      <hr/><table><tr class="bold"><td>Item</td><td class="center">Qty</td><td class="right">Amt</td></tr>${itemRows}</table>
      <hr/><div class="right bold">Total: ₹${total.toFixed(2)}</div>
      <div class="right">Paid: ${paymentMethod?.toUpperCase()}</div>
      ${changeDue > 0 ? `<div class="right">Change: ₹${changeDue.toFixed(2)}</div>` : ''}
      <hr/><div class="center">Thank you!</div></body></html>`)
    w.document.close()
    w.print()
  }

  const copyTxnNumber = () => {
    navigator.clipboard.writeText(txnNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto py-8 space-y-6">
      <div className="bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className={`px-6 py-5 text-center ${txnMode === 'return' ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${txnMode === 'return' ? 'bg-red-100' : 'bg-green-100'}`}>
            <Check className={`w-7 h-7 ${txnMode === 'return' ? 'text-red-600' : 'text-green-600'}`} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{txnMode === 'return' ? 'Refund Processed' : 'Sale Complete'}</h2>
          <p className="text-3xl font-bold mt-2">{formatCurrency(total)}</p>
          {changeDue > 0 && <p className="text-sm text-green-700 mt-1">Change: {formatCurrency(changeDue)}</p>}
        </div>

        <div className="px-6 py-4 space-y-3 border-t">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Transaction</span><p className="font-medium flex items-center gap-1">
              {txnNumber}
              <button onClick={copyTxnNumber} className="p-0.5 hover:bg-gray-100 rounded">
                {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
              </button>
            </p></div>
            {orderNumber && <div><span className="text-gray-500">Order</span><p className="font-semibold text-blue-600">{orderNumber}</p></div>}
            {invoiceNumber && <div><span className="text-gray-500">Invoice</span><p className="font-medium">{invoiceNumber}</p></div>}
            {bookingNumbers.length > 0 && <div><span className="text-gray-500">Booking</span><p className="font-medium text-primary">{bookingNumbers.join(', ')}</p></div>}
            <div><span className="text-gray-500">Customer</span><p className="font-medium">{customerName}</p></div>
            <div><span className="text-gray-500">Payment</span><p className="font-medium capitalize">{paymentMethod}</p></div>
          </div>

          {/* Coupon & Loyalty info */}
          {(appliedCoupon || loyaltyEarned > 0 || loyaltyRedeemed > 0) && (
            <div className="flex flex-wrap gap-2">
              {appliedCoupon && (
                <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                  <Tag className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-700">{appliedCoupon}</span>
                  <span className="text-xs text-green-600">-{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              {loyaltyEarned > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-amber-700">+{loyaltyEarned} points earned</span>
                </div>
              )}
              {loyaltyRedeemed > 0 && (
                <div className="flex items-center gap-1.5 bg-accent border border-primary/30 rounded-lg px-3 py-1.5">
                  <Gift className="w-3.5 h-3.5 text-primary/80" />
                  <span className="text-xs font-medium text-primary">{loyaltyRedeemed} points redeemed</span>
                </div>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-xs text-gray-500"><th className="px-3 py-1.5 text-left"><TableColumnLabel>Item</TableColumnLabel></th><th className="px-3 py-1.5 text-center"><TableColumnLabel>Qty</TableColumnLabel></th><th className="px-3 py-1.5 text-right"><TableColumnLabel>Amount</TableColumnLabel></th></tr></thead>
                <tbody className="divide-y">{items.map((it: any, i) => (
                  <tr key={i}><td className="px-3 py-1.5 flex items-center gap-1.5">
                    {it.item_type === 'service' ? <Wrench className="w-3 h-3 text-primary/70" /> : <Package className="w-3 h-3 text-blue-400" />}
                    <span className="truncate">{it.name}</span>
                    {it.booking_number && <span className="text-xs text-primary ml-1">({it.booking_number})</span>}
                  </td><td className="px-3 py-1.5 text-center">{it.qty}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(it.total || it.price * it.qty)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* ── Booking Details & Actions ── */}
          {bookingNumbers.length > 0 && (
            <div className="border border-primary/30 rounded-xl overflow-hidden">
              <div className="bg-accent px-4 py-2.5 flex items-center gap-2 border-b border-primary/20">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Booking{bookingNumbers.length > 1 ? 's' : ''} Created</span>
                <span className="ml-auto text-xs font-bold bg-primary/12 text-primary px-2 py-0.5 rounded-full">{bookingNumbers.length}</span>
              </div>

              <div className="divide-y divide-primary/10">
                {items.filter((it: any) => it.item_type === 'service').map((it: any, idx: number) => {
                  const bNum = bookingNumbers[idx]
                  const bDetail = bNum ? bookingDetails[bNum] : null
                  const bId = bDetail?.id || bNum
                  const status = bDetail?.status || 'confirmed'
                  const isCancelled = ['cancelled', 'no_show'].includes(status)

                  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
                    confirmed:  { label: 'Confirmed',  color: 'bg-green-100 text-green-700' },
                    pending:    { label: 'Pending',    color: 'bg-amber-100 text-amber-700' },
                    cancelled:  { label: 'Cancelled',  color: 'bg-red-100 text-red-700' },
                    no_show:    { label: 'No-Show',    color: 'bg-gray-100 text-gray-600' },
                    completed:  { label: 'Completed',  color: 'bg-blue-100 text-blue-700' },
                  }
                  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.confirmed

                  return (
                    <div key={idx} className="px-4 py-3 space-y-2">
                      {/* Service name + status + booking ref */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Wrench className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{it.name}</p>
                            {bNum && <p className="text-xs text-gray-400 font-mono">{bNum}</p>}
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${sc.color}`}>{sc.label}</span>
                      </div>

                      {/* Date / time / duration row */}
                      <div className="flex flex-wrap gap-3">
                        {(bDetail?.booking_date || it.booking_date) && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Calendar className="w-3.5 h-3.5 text-primary/70" />
                            <span className="font-medium">{new Date(bDetail?.booking_date || it.booking_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        )}
                        {(bDetail?.booking_time || it.booking_time) && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Clock className="w-3.5 h-3.5 text-primary/70" />
                            <span className="font-medium">{bDetail?.booking_time || it.booking_time}</span>
                          </div>
                        )}
                        {(bDetail?.duration_minutes || it.duration_minutes) && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Info className="w-3 h-3 text-gray-400" />
                            <span>{bDetail?.duration_minutes || it.duration_minutes} min</span>
                          </div>
                        )}
                        {bDetail?.assigned_staff_name && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span>{bDetail.assigned_staff_name}</span>
                          </div>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="text-xs text-gray-500">
                        Amount: <span className="font-semibold text-gray-800">{formatCurrency(it.total || it.price * it.qty)}</span>
                      </div>

                      {/* Actions — Cancel / No-Show */}
                      {!isCancelled && bId && (
                        <>
                          {bookingActionsId === bId ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                              <p className="text-xs font-medium text-red-700">Cancel or mark no-show?</p>
                              <input
                                type="text"
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                placeholder="Reason (optional)…"
                                className="w-full h-7 text-xs border border-red-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCancelBooking(bId, 'cancelled')}
                                  disabled={cancellingId === bId}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                                >
                                  {cancellingId === bId ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                  Cancel Booking
                                </button>
                                <button
                                  onClick={() => handleCancelBooking(bId, 'no_show')}
                                  disabled={cancellingId === bId}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-60"
                                >
                                  {cancellingId === bId ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                                  No-Show
                                </button>
                                <button
                                  onClick={() => { setBookingActionsId(null); setCancelReason('') }}
                                  className="px-3 py-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  Keep
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setBookingActionsId(bId)}
                              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors border border-red-100"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Cancel / No-Show
                            </button>
                          )}
                        </>
                      )}
                      {isCancelled && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Booking {status === 'no_show' ? 'marked as no-show' : 'cancelled'}
                          {bDetail?.cancel_reason && ` · ${bDetail.cancel_reason}`}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Print / Share actions */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Print & Share</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={handlePrintInvoice} disabled={loadingInvoice}
              className="flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
              {loadingInvoice ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <FileText className="w-4 h-4 text-blue-600" />}
              <span className="text-sm font-medium text-blue-700">Print Invoice</span>
            </button>
            <button onClick={handleDownloadPdf} disabled={loadingInvoice}
              className="flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-red-100 bg-red-50 hover:bg-red-100 transition-colors">
              {loadingInvoice ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Download className="w-4 h-4 text-red-500" />}
              <span className="text-sm font-medium text-red-600">Download PDF</span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleQuickReceipt}
              className="flex flex-col items-center gap-1 py-2 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
              <Receipt className="w-4 h-4 text-gray-600" />
              <span className="text-xs">Quick Receipt</span>
            </button>
            <button onClick={handleWhatsApp} className="flex flex-col items-center gap-1 py-2 rounded-lg border bg-white hover:bg-green-50 transition-colors">
              <MessageSquare className="w-4 h-4 text-green-600" />
              <span className="text-xs">WhatsApp</span>
            </button>
            <button onClick={handleSms} className="flex flex-col items-center gap-1 py-2 rounded-lg border bg-white hover:bg-amber-50 transition-colors">
              <Phone className="w-4 h-4 text-amber-600" />
              <span className="text-xs">SMS</span>
            </button>
          </div>

          {/* ── Print Forms ── */}
          <div className="mt-3 border-t pt-3">
            <button
              onClick={() => setShowPrintForms(v => !v)}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Printer className="w-4 h-4" />
                Print Forms
                {enabledForms.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">{enabledForms.length} available</span>
                )}
              </span>
              {showPrintForms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showPrintForms && (
              <div className="mt-2 space-y-1">
                {enabledForms.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">
                    No forms enabled. Go to{' '}
                    <button className="text-blue-600 underline" onClick={() => toast.info('Open POS Settings → Print Forms tab to enable forms')}>
                      POS Settings → Print Forms
                    </button>{' '}
                    to enable document types.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 pt-1">
                    {PRINT_FORM_TYPES.filter(f => enabledForms.includes(f.id)).map(form => (
                      <div
                        key={form.id}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-100 bg-white"
                      >
                        <span className="text-xl shrink-0">{form.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{form.label}</p>
                          <p className="text-xs text-gray-400">{form.category}</p>
                        </div>
                        {/* Print button */}
                        <button
                          title={`Print ${form.label}`}
                          onClick={() => {
                            const html = generatePrintFormHtml(form.id, data, vendor)
                            openPrintWindow(html)
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium transition-colors shrink-0"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print
                        </button>
                        {/* Download PDF button */}
                        <button
                          title={`Download ${form.label} as PDF`}
                          onClick={async () => {
                            const html = generatePrintFormHtml(form.id, data, vendor)
                            const txnRef = ((data.invoice_number || data.transaction_number) as string || 'doc').replace(/\//g, '-')
                            await downloadAsPdf(html, `${form.id}-${txnRef}.pdf`, { margin: 8, orientation: 'portrait' })
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 gap-2" onClick={onClose}><ArrowLeft className="w-4 h-4" /> Back to POS</Button>
        <Button className="flex-1 gap-2" onClick={onNewSale}><Plus className="w-4 h-4" /> New Sale</Button>
      </div>
    </div>
  )
}

// ── Transaction History ──────────────────────────────────────────

function POSTransactionHistory({
  orders, loading, page, totalPages, total, pageSize, onPageChange, onPageSizeChange,
  search, onSearchChange, sortKey, sortDir, onSortKeyChange, onSortDirChange,
  typeFilter, onTypeFilterChange, selectedTxn, onSelectTxn, onBack,
  invSettings, vendor, posSettings,
}: {
  orders: any[]; loading: boolean; page: number; totalPages: number; total: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  search: string; onSearchChange: (v: string) => void
  sortKey: string; sortDir: SortDir; onSortKeyChange: (k: string) => void; onSortDirChange: (d: SortDir) => void
  typeFilter: string; onTypeFilterChange: (v: string) => void
  selectedTxn: Record<string, unknown> | null; onSelectTxn: (t: Record<string, unknown> | null) => void
  onBack: () => void
  invSettings: Partial<InvoiceSettings>; vendor?: any; posSettings: Partial<InvoiceSettings>
}) {
  const typeColors: Record<string, string> = {
    sale: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
    return: 'bg-red-100 text-red-800',
    returned: 'bg-red-100 text-red-800',
  }

  if (selectedTxn) return (
    <TransactionDetail txn={selectedTxn} onBack={() => onSelectTxn(null)}
      invSettings={invSettings} vendor={vendor} posSettings={posSettings} />
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1"><ChevronLeft className="w-4 h-4" /> Billing</Button>
          <h1 className="text-lg font-bold">Transaction History</h1>
        </div>
        <p className="text-sm text-gray-500">{total} transaction{total !== 1 ? 's' : ''}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <TableToolbar
              search={search} onSearchChange={onSearchChange}
              searchPlaceholder="Search by order #, customer, POS #..."
              sortOptions={[
                { value: 'created_at', label: 'Date' },
                { value: 'order_number', label: 'Number' },
                { value: 'customer_name', label: 'Customer' },
                { value: 'total', label: 'Total' },
                { value: 'status', label: 'Status' },
              ]}
              sortKey={sortKey} sortDir={sortDir}
              onSortKeyChange={onSortKeyChange} onSortDirChange={onSortDirChange}
            />
            <select value={typeFilter} onChange={e => onTypeFilterChange(e.target.value)}
              className="text-xs border rounded-md px-2 py-1.5 h-9"
              title="Sales and returns only. Credit and debit memos: Finance → Credit & Debit Memos"
            >
              <option value="">Sales &amp; returns</option>
              <option value="sale">Sale</option>
              <option value="return">Return</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12"><Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" /><p className="text-sm text-gray-500">No transactions found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <ResizableTable tableId="pos-orders" defaultWidths={[120, 100, 80, 140, 60, 90, 100, 80, 50]}>
                <thead><tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-4 py-2.5"><TableColumnLabel>Date</TableColumnLabel></th>
                  <th className="px-4 py-2.5"><TableColumnLabel>Order #</TableColumnLabel></th>
                  <th className="px-4 py-2.5"><TableColumnLabel>POS #</TableColumnLabel></th>
                  <th className="px-4 py-2.5"><TableColumnLabel>Customer</TableColumnLabel></th>
                  <th className="px-4 py-2.5 text-center"><TableColumnLabel>Items</TableColumnLabel></th>
                  <th className="px-4 py-2.5 text-right"><TableColumnLabel>Total</TableColumnLabel></th>
                  <th className="px-4 py-2.5"><TableColumnLabel>Payment</TableColumnLabel></th>
                  <th className="px-4 py-2.5"><TableColumnLabel>Type</TableColumnLabel></th>
                  <th className="px-4 py-2.5"></th>
                </tr></thead>
                <tbody className="divide-y">
                  {orders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={onClickableTableRow(() => onSelectTxn(o))}>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        <span className="text-gray-400 ml-1">{new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-blue-600">{o.order_number}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{o.transaction_number}</td>
                      <td className="px-4 py-2.5 text-gray-600">{o.customer_name || <span className="text-gray-400 italic">Walk-in</span>}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{o.item_count}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(o.total)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 text-xs capitalize">
                          {o.payment_method === 'cash' && <Banknote className="w-3.5 h-3.5 text-green-600" />}
                          {o.payment_method === 'upi' && <Smartphone className="w-3.5 h-3.5 text-primary" />}
                          {o.payment_method === 'card' && <CreditCard className="w-3.5 h-3.5 text-blue-600" />}
                          {o.payment_method || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${typeColors[o.transaction_type] || typeColors[o.status] || 'bg-gray-100 text-gray-700'}`}>
                          {(o.transaction_type || o.status || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5"><Eye className="w-4 h-4 text-gray-400" /></td>
                    </tr>
                  ))}
                </tbody>
              </ResizableTable>
            </div>
          )}

          {total > 0 && (
            <TablePagination
              page={page}
              pages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              itemLabel="transactions"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Transaction Detail ───────────────────────────────────────────

function TransactionDetail({ txn, onBack, invSettings, vendor, posSettings }: {
  txn: any; onBack: () => void
  invSettings: Partial<InvoiceSettings>; vendor?: any; posSettings: Partial<InvoiceSettings>
}) {
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [showPrintForms, setShowPrintForms] = useState(false)
  const [enabledForms] = useState<PrintFormId[]>(() => loadEnabledForms())
  const items = (txn.items || []) as Record<string, unknown>[]
  const pms = (txn.payment_methods || []) as { method: string; amount: number }[]
  const txnType = (txn.transaction_type as string) || 'sale'

  const typeColors: Record<string, string> = {
    sale: 'bg-green-100 text-green-800',
    return: 'bg-red-100 text-red-800',
    credit_memo: 'bg-orange-100 text-orange-800',
    debit_memo: 'bg-blue-100 text-blue-800',
  }

  const txnSettings = (): Partial<InvoiceSettings> => ({ ...invSettings, ...posSettings })

  const buildTxnInvoiceData = (): Record<string, unknown> => ({
    invoice_number: (txn.invoice_number as string) || (txn.transaction_number as string),
    invoice_type: 'invoice',
    created_at: txn.created_at,
    customer_name: (txn.customer_name as string) || 'Walk-in',
    vendor_name: vendor?.display_name || vendor?.business_name || '',
    vendor_gstin: vendor?.gstin || '',
    vendor_address: [vendor?.street_address, vendor?.city, vendor?.state, vendor?.postal_code].filter(Boolean).join(', '),
    vendor_logo_url: vendor?.logo_url || '',
    items: items.map((it: any) => ({
      name: it.name, hsn_sac: it.hsn_code || '', qty: it.qty, rate: it.price,
      discount: it.discount || 0, taxable_value: it.taxable || (it.price * it.qty),
      tax_rate: it.tax_rate || 0, tax_amount: it.tax_amount || 0, total: it.total || it.price * it.qty,
    })),
    subtotal: txn.subtotal || 0,
    discount_amount: txn.discount_amount || 0,
    total_tax: txn.tax_amount || 0,
    total: txn.total || 0,
    amount_paid: txn.total || 0,
    balance_due: 0,
    status: 'paid',
    is_gst: !!vendor?.gstin,
    notes: `POS: ${txn.transaction_number}`,
  })

  const handlePrintInvoice = async () => {
    setLoadingInvoice(true)
    try {
      const inv = txn.invoice_id
        ? await vendorApi.getInvoice(txn.invoice_id as string)
        : buildTxnInvoiceData()
      await printInvoice(inv as Record<string, unknown>, txnSettings())
    } catch (err) {
      toast.error(extractApiError(err, 'Could not load invoice for printing'))
    }
    setLoadingInvoice(false)
  }

  const handleDownloadPdf = async () => {
    setLoadingInvoice(true)
    try {
      const inv = txn.invoice_id
        ? await vendorApi.getInvoice(txn.invoice_id as string) as Record<string, unknown>
        : buildTxnInvoiceData()
      const s = txnSettings()
      const rawLogo = resolveInvoiceTemplateLogoPath(s, (inv as Record<string, unknown>).vendor_logo_url as string)
      const rawSig  = s.signature_url || ''
      const [logoDataUrl, sigDataUrl] = await Promise.all([
        rawLogo ? fetchAsDataUrl(rawLogo) : Promise.resolve(''),
        rawSig  ? fetchAsDataUrl(rawSig)  : Promise.resolve(''),
      ])
      const enriched = { ...s, logo_url: logoDataUrl || undefined, signature_url: sigDataUrl || undefined }
      const html = generateInvoiceHtml({ ...(inv as Record<string, unknown>), vendor_logo_url: logoDataUrl || (inv as Record<string, unknown>).vendor_logo_url }, enriched, '')
      await downloadAsPdf(html, `${((txn.invoice_number || txn.transaction_number) as string).replace(/\//g, '-')}.pdf`, { margin: s.pdf_margin ?? 5, orientation: s.pdf_orientation ?? 'portrait', imageQuality: s.pdf_image_quality ?? 0.98 })
    } catch (err) {
      toast.error(extractApiError(err, 'Could not generate PDF'))
    }
    setLoadingInvoice(false)
  }

  const txnMessage = () => buildShareMessage({
    type: 'receipt',
    number: (txn.invoice_number || txn.transaction_number) as string,
    vendorName: vendor?.display_name || vendor?.business_name || '',
    customerOrSupplier: (txn.customer_name as string) || 'Customer',
    total: txn.total as number,
    date: txn.created_at ? new Date(txn.created_at as string).toLocaleDateString('en-IN') : '',
    status: txnType,
    items: items.map((it: any) => ({ name: it.name, qty: it.qty, amount: it.total || it.price * it.qty })),
  })

  const handleWhatsApp = async () => {
    setLoadingInvoice(true)
    try {
      const inv = txn.invoice_id
        ? await vendorApi.getInvoice(txn.invoice_id as string) as Record<string, unknown>
        : buildTxnInvoiceData()
      const s = txnSettings()
      const rawLogo = resolveInvoiceTemplateLogoPath(s, (inv as Record<string, unknown>).vendor_logo_url as string)
      const rawSig  = s.signature_url || ''
      const [logoDataUrl, sigDataUrl] = await Promise.all([
        rawLogo ? fetchAsDataUrl(rawLogo) : Promise.resolve(''),
        rawSig  ? fetchAsDataUrl(rawSig)  : Promise.resolve(''),
      ])
      const enriched = { ...s, logo_url: logoDataUrl || undefined, signature_url: sigDataUrl || undefined }
      const html = generateInvoiceHtml(
        { ...inv, vendor_logo_url: logoDataUrl || inv.vendor_logo_url },
        enriched, '',
      )
      await shareInvoiceViaWhatsApp({
        html,
        filename: `${((txn.invoice_number || txn.transaction_number) as string).replace(/\//g, '-')}.pdf`,
        phone: txn.customer_phone as string | null,
        textMessage: txnMessage(),
        pdfOpts: { margin: s.pdf_margin ?? 5, orientation: s.pdf_orientation ?? 'portrait', imageQuality: s.pdf_image_quality ?? 0.98 },
      })
    } catch {
      shareViaWhatsApp(txnMessage(), txn.customer_phone as string | null)
    }
    setLoadingInvoice(false)
  }
  const handleSms      = () => shareViaSms(txnMessage(), txn.customer_phone as string | null)

  const handleQuickReceipt = () => {
    const w = window.open('', '_blank', 'width=400,height=600')
    if (!w) return
    const itemRows = items.map((i: any) =>
      `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">₹${(i.total || i.price * i.qty).toFixed(2)}</td></tr>`
    ).join('')
    w.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto}
      table{width:100%;border-collapse:collapse}td{padding:2px 4px}hr{border:none;border-top:1px dashed #999;margin:6px 0}
      .center{text-align:center}.right{text-align:right}.bold{font-weight:bold}</style></head><body>
      <div class="center bold">RECEIPT</div><hr/>
      <div>Order: ${txn.order_number || txn.transaction_number}</div>
      ${txn.invoice_number ? `<div>Invoice: ${txn.invoice_number}</div>` : ''}
      <div>Customer: ${txn.customer_name || 'Walk-in'}</div>
      <div>Date: ${txn.created_at ? new Date(txn.created_at as string).toLocaleString('en-IN') : ''}</div>
      <hr/><table><tr class="bold"><td>Item</td><td class="center">Qty</td><td class="right">Amt</td></tr>${itemRows}</table>
      <hr/><div class="right bold">Total: ₹${(txn.total as number)?.toFixed(2)}</div>
      <hr/><div class="center">Thank you!</div></body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1"><ChevronLeft className="w-4 h-4" /> Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintInvoice} disabled={loadingInvoice} className="gap-1">
            {loadingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={loadingInvoice} className="gap-1">
            {loadingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-red-500" />} PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleQuickReceipt} className="gap-1"><Receipt className="w-4 h-4" /> Receipt</Button>
          {txn.invoice_id && (
            <Button variant="outline" size="sm" onClick={() => window.open(`/invoices/${txn.invoice_id}`, '_blank')} className="gap-1">
              <ExternalLink className="w-4 h-4" /> View Invoice
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{txn.order_number || txn.transaction_number}</h2>
              <p className="text-sm text-gray-500">POS: {txn.transaction_number}</p>
              {txn.invoice_number && <p className="text-sm text-gray-500">Invoice: {txn.invoice_number as string}</p>}
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize ${typeColors[txnType] || 'bg-gray-100'}`}>
                {txnType.replace('_', ' ')}
              </span>
              <p className="text-2xl font-bold mt-1">{formatCurrency(txn.total as number)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Customer</p>
              <p className="font-medium mt-0.5">{(txn.customer_name as string) || 'Walk-in'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Payment</p>
              <p className="font-medium mt-0.5 capitalize">{pms.map(p => `${p.method}: ${formatCurrency(p.amount)}`).join(', ') || (txn.payment_method as string) || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Date</p>
              <p className="font-medium mt-0.5">{txn.created_at ? new Date(txn.created_at as string).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
            </div>
          </div>

          {/* Items table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
                <th className="px-4 py-2 text-left"><TableColumnLabel>#</TableColumnLabel></th>
                <th className="px-4 py-2 text-left"><TableColumnLabel>Item</TableColumnLabel></th>
                <th className="px-4 py-2 text-center"><TableColumnLabel>Qty</TableColumnLabel></th>
                <th className="px-4 py-2 text-right"><TableColumnLabel>Rate</TableColumnLabel></th>
                <th className="px-4 py-2 text-right"><TableColumnLabel>Tax</TableColumnLabel></th>
                <th className="px-4 py-2 text-right"><TableColumnLabel>Amount</TableColumnLabel></th>
              </tr></thead>
              <tbody className="divide-y">
                {items.map((it: any, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        {it.item_type === 'service' ? <Wrench className="w-3 h-3 text-primary/70" /> : <Package className="w-3 h-3 text-blue-400" />}
                        <span>{it.name}</span>
                      </div>
                      {it.booking_number && <p className="text-xs text-primary ml-5">Booking: {it.booking_number}</p>}
                    </td>
                    <td className="px-4 py-2 text-center">{it.qty}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(it.price)}</td>
                    <td className="px-4 py-2 text-right text-amber-600">{it.tax_amount ? formatCurrency(it.tax_amount) : '—'}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(it.total || it.price * it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(txn.subtotal as number || 0)}</span></div>
              {(txn.discount_amount as number) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatCurrency(txn.discount_amount as number)}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatCurrency(txn.tax_amount as number || 0)}</span></div>
              <div className="flex justify-between text-lg font-bold border-t pt-1"><span>Total</span><span>{formatCurrency(txn.total as number)}</span></div>
            </div>
          </div>

          {txn.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{txn.notes as string}</p>
            </div>
          )}

          {/* Print & Share */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Print & Share</p>

            {/* Primary actions row */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={handlePrintInvoice} disabled={loadingInvoice}
                className="gap-1.5 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 justify-center py-2.5">
                {loadingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Print Invoice
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={loadingInvoice}
                className="gap-1.5 border-red-100 bg-red-50 hover:bg-red-100 text-red-600 justify-center py-2.5">
                {loadingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download PDF
              </Button>
            </div>

            {/* Secondary actions row */}
            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" size="sm" onClick={handleQuickReceipt}
                className="flex flex-col items-center gap-1 h-auto py-2 text-xs">
                <Receipt className="w-4 h-4 text-gray-600" /> Quick Receipt
              </Button>
              {txn.invoice_id ? (
                <Button variant="outline" size="sm" onClick={() => window.open(`/invoices/${txn.invoice_id}`, '_blank')}
                  className="flex flex-col items-center gap-1 h-auto py-2 text-xs">
                  <ExternalLink className="w-4 h-4 text-indigo-500" /> View Invoice
                </Button>
              ) : (
                <div />
              )}
              <Button variant="outline" size="sm" onClick={handleWhatsApp}
                className="flex flex-col items-center gap-1 h-auto py-2 text-xs">
                <MessageSquare className="w-4 h-4 text-green-600" /> WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={handleSms}
                className="flex flex-col items-center gap-1 h-auto py-2 text-xs">
                <Phone className="w-4 h-4 text-amber-600" /> SMS
              </Button>
            </div>

            {/* Print Forms collapsible */}
            <div className="border-t pt-3">
              <button
                onClick={() => setShowPrintForms(v => !v)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  Other Document Types
                  {enabledForms.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">
                      {enabledForms.length} available
                    </span>
                  )}
                </span>
                {showPrintForms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showPrintForms && (
                <div className="mt-2 space-y-1">
                  {enabledForms.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">
                      No forms enabled. Go to{' '}
                      <button
                        className="text-blue-600 underline"
                        onClick={() => toast.info('Open POS Settings → Print Forms tab to enable forms')}
                      >
                        POS Settings → Print Forms
                      </button>{' '}
                      to enable document types.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 pt-1">
                      {PRINT_FORM_TYPES.filter(f => enabledForms.includes(f.id)).map(form => (
                        <div
                          key={form.id}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-100 bg-white"
                        >
                          <span className="text-xl shrink-0">{form.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-800 truncate">{form.label}</p>
                            <p className="text-xs text-gray-400">{form.description}</p>
                          </div>
                          <button
                            title={`Print ${form.label}`}
                            onClick={() => {
                              const html = generatePrintFormHtml(form.id, buildTxnInvoiceData(), vendor)
                              openPrintWindow(html)
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium transition-colors shrink-0"
                          >
                            <Printer className="w-3.5 h-3.5" /> Print
                          </button>
                          <button
                            title={`Download ${form.label} as PDF`}
                            onClick={async () => {
                              const html = generatePrintFormHtml(form.id, buildTxnInvoiceData(), vendor)
                              const ref = ((txn.invoice_number || txn.transaction_number) as string || 'doc').replace(/\//g, '-')
                              await downloadAsPdf(html, `${form.id}-${ref}.pdf`, { margin: 8, orientation: 'portrait' })
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── POS Invoice Settings Modal with Live Preview ─────────────────

const SAMPLE_POS_INVOICE = {
  invoice_number: 'POS-INV/2025-26/001',
  invoice_type: 'invoice',
  status: 'paid',
  created_at: new Date().toISOString(),
  customer_name: 'John Doe',
  customer_email: 'john@example.com',
  customer_phone: '+91 98765 43210',
  billing_address: { street: '123 Main St', city: 'Mumbai', state: 'Maharashtra', postal_code: '400001' },
  items: [
    { name: 'Premium Haircut', description: 'Men\'s styling', hsn_sac: '998871', qty: 1, rate: 500, discount: 0, taxable_value: 500, tax_rate: 18, tax_amount: 90, total: 590 },
    { name: 'Hair Serum', description: 'Organic serum 100ml', hsn_sac: '33059090', qty: 2, rate: 350, discount: 50, taxable_value: 650, tax_rate: 18, tax_amount: 117, total: 767 },
  ],
  subtotal: 1200,
  discount_amount: 50,
  taxable_amount: 1150,
  cgst_amount: 103.5,
  sgst_amount: 103.5,
  total_tax: 207,
  total: 1357,
  amount_paid: 1357,
  balance_due: 0,
  is_gst: true,
  is_inter_state: false,
  place_of_supply: 'Maharashtra',
  payment_terms: 'Paid',
  notes: 'POS Transaction: POS-000042',
}

// ── Print Form Types ─────────────────────────────────────────────────────────

export type PrintFormId =
  | 'sales_invoice' | 'sales_order' | 'delivery_note' | 'quotation'
  | 'prescription' | 'service_agreement' | 'warranty_card' | 'cash_receipt'
  | 'credit_note' | 'proforma_invoice' | 'work_order' | 'purchase_order'

export interface PrintFormType {
  id: PrintFormId
  label: string
  description: string
  category: string
  categoryColor: string
  icon: string          // emoji
  fields: string[]      // notable fields shown in the form
}

export const PRINT_FORM_TYPES: PrintFormType[] = [
  { id: 'sales_invoice',    label: 'Sales Invoice',      description: 'Standard GST tax invoice for completed sales', category: 'Sales', categoryColor: 'bg-blue-100 text-blue-700', icon: '🧾', fields: ['Items', 'GST', 'Payment', 'Customer'] },
  { id: 'sales_order',      label: 'Sales Order',        description: 'Order confirmation with delivery details', category: 'Sales', categoryColor: 'bg-blue-100 text-blue-700', icon: '📦', fields: ['Items', 'Delivery date', 'Shipping address'] },
  { id: 'quotation',        label: 'Quotation / Estimate', description: 'Price quote valid for a specified period', category: 'Sales', categoryColor: 'bg-blue-100 text-blue-700', icon: '💬', fields: ['Items', 'Valid until', 'Terms'] },
  { id: 'proforma_invoice', label: 'Proforma Invoice',   description: 'Preliminary bill before final invoice', category: 'Sales', categoryColor: 'bg-blue-100 text-blue-700', icon: '📝', fields: ['Items', 'Advance', 'Bank details'] },
  { id: 'delivery_note',    label: 'Delivery Note',      description: 'Packing slip accompanying goods dispatched', category: 'Logistics', categoryColor: 'bg-emerald-100 text-emerald-700', icon: '🚚', fields: ['Items', 'Qty', 'Driver', 'Signature box'] },
  { id: 'purchase_order',   label: 'Purchase Order',     description: 'Order issued to a supplier / vendor', category: 'Logistics', categoryColor: 'bg-emerald-100 text-emerald-700', icon: '🏭', fields: ['Items', 'Supplier', 'Expected delivery'] },
  { id: 'prescription',     label: 'Prescription',       description: 'Medical / optical / pharmacy prescription', category: 'Healthcare', categoryColor: 'bg-rose-100 text-rose-700', icon: '💊', fields: ['Medicines', 'Dosage', 'Doctor', 'Patient'] },
  { id: 'service_agreement',label: 'Service Agreement',  description: 'Terms & conditions for service engagement', category: 'Legal', categoryColor: 'bg-primary/10 text-primary', icon: '📜', fields: ['Scope', 'Duration', 'Signatures'] },
  { id: 'warranty_card',    label: 'Warranty Card',      description: 'Product warranty with serial number & terms', category: 'Legal', categoryColor: 'bg-primary/10 text-primary', icon: '🛡️', fields: ['Product', 'Serial no.', 'Expiry date'] },
  { id: 'work_order',       label: 'Work Order',         description: 'Job card for repair / service tasks', category: 'Service', categoryColor: 'bg-amber-100 text-amber-700', icon: '🔧', fields: ['Job description', 'Technician', 'Status'] },
  { id: 'cash_receipt',     label: 'Cash Receipt',       description: 'Simple cash memo for quick transactions', category: 'Service', categoryColor: 'bg-amber-100 text-amber-700', icon: '💵', fields: ['Amount', 'Payment mode', 'Cashier'] },
  { id: 'credit_note',      label: 'Credit / Return Note', description: 'Document for returns, refunds, or adjustments', category: 'Service', categoryColor: 'bg-amber-100 text-amber-700', icon: '↩️', fields: ['Original ref', 'Reason', 'Refund amount'] },
]

function generatePrintFormHtml(
  formId: PrintFormId,
  txnData: Record<string, unknown>,
  vendor?: any,
): string {
  const v = vendor || {}
  const vendorName = v.display_name || v.business_name || 'Your Business'
  const vendorAddr = [v.street_address, v.city, v.state, v.postal_code].filter(Boolean).join(', ')
  const vendorPhone = v.primary_phone || ''
  const vendorEmail = v.primary_email || ''
  const vendorGstin = v.gstin || ''
  const vendorLogo  = v.logo_url || ''

  const customerName  = (txnData.customer_name as string) || 'Walk-in Customer'
  const txnNumber     = (txnData.transaction_number as string) || ''
  const invoiceNumber = (txnData.invoice_number as string) || txnNumber
  const items         = ((txnData.items || []) as any[])
  const total         = (txnData.total as number) || 0
  const subtotal      = (txnData.subtotal as number) || 0
  const taxAmount     = (txnData.tax_amount as number) || 0
  const discountAmt   = (txnData.discount_amount as number) || 0
  const paymentMethod = (txnData.payment_method as string) || ''
  const dateStr       = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr       = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const baseStyle = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 24px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
      .brand { display: flex; align-items: center; gap: 12px; }
      .logo { width: 52px; height: 52px; object-fit: contain; border-radius: 8px; }
      .logo-placeholder { width: 52px; height: 52px; background: #eff6ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
      .doc-title { font-size: 20px; font-weight: 700; color: #1e3a5f; letter-spacing: -0.3px; }
      .doc-meta { font-size: 11px; color: #6b7280; margin-top: 2px; }
      .vendor-name { font-weight: 700; font-size: 15px; color: #111827; }
      .vendor-info { font-size: 11px; color: #6b7280; line-height: 1.5; margin-top: 2px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
      .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      .info-box-label { font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
      .info-box-value { font-size: 13px; font-weight: 600; color: #111827; }
      .info-box-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      thead tr { background: #f3f4f6; }
      th { padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
      th:last-child, td:last-child { text-align: right; }
      td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
      .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-bottom: 20px; }
      .total-row { display: flex; gap: 32px; font-size: 13px; color: #374151; }
      .total-row.grand { font-size: 16px; font-weight: 700; color: #111827; border-top: 2px solid #e5e7eb; padding-top: 8px; margin-top: 4px; }
      .total-row span:last-child { min-width: 100px; text-align: right; }
      .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 32px; }
      .sig-box { border-top: 1px solid #9ca3af; padding-top: 6px; font-size: 11px; color: #6b7280; text-align: center; }
      .footer { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 24px; padding-top: 12px; border-top: 1px dashed #e5e7eb; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; letter-spacing: 0.4px; }
      .badge-blue { background: #dbeafe; color: #1d4ed8; }
      .badge-green { background: #dcfce7; color: #15803d; }
      .badge-amber { background: #fef3c7; color: #d97706; }
      .fields-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
      .field-item { flex: 1; min-width: 120px; }
      .field-label { font-size: 10px; color: #9ca3af; font-weight: 600; text-transform: uppercase; }
      .field-value { font-size: 13px; font-weight: 500; color: #111827; margin-top: 2px; }
      .blank-field { border-bottom: 1px solid #d1d5db; min-height: 24px; margin-top: 4px; }
      @media print { body { padding: 16px; } }
    </style>`

  const headerBlock = `
    <div class="header">
      <div class="brand">
        ${vendorLogo ? `<img src="${vendorLogo}" class="logo" alt="logo">` : `<div class="logo-placeholder">🏪</div>`}
        <div>
          <div class="vendor-name">${vendorName}</div>
          <div class="vendor-info">${vendorAddr}${vendorPhone ? `<br>${vendorPhone}` : ''}${vendorEmail ? ` · ${vendorEmail}` : ''}${vendorGstin ? `<br>GSTIN: ${vendorGstin}` : ''}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="doc-title">__TITLE__</div>
        <div class="doc-meta">#__REF__ · ${dateStr} ${timeStr}</div>
        __EXTRA_META__
      </div>
    </div>`

  const itemRows = items.map(it => `
    <tr>
      <td>${it.name || ''}</td>
      <td style="text-align:center">${it.qty ?? 1}</td>
      <td style="text-align:right">₹${Number(it.price || 0).toFixed(2)}</td>
      <td style="text-align:right">₹${Number(it.total || (it.price * it.qty) || 0).toFixed(2)}</td>
    </tr>`).join('')

  const itemTable = `
    <table>
      <thead><tr><th><TableColumnLabel>Item / Description</TableColumnLabel></th><th style="text-align:center"><TableColumnLabel>Qty</TableColumnLabel></th><th style="text-align:right"><TableColumnLabel>Rate</TableColumnLabel></th><th style="text-align:right"><TableColumnLabel>Amount</TableColumnLabel></th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>`

  const totalsBlock = `
    <div class="totals">
      ${subtotal ? `<div class="total-row"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>` : ''}
      ${discountAmt ? `<div class="total-row"><span>Discount</span><span>-₹${discountAmt.toFixed(2)}</span></div>` : ''}
      ${taxAmount ? `<div class="total-row"><span>Tax</span><span>₹${taxAmount.toFixed(2)}</span></div>` : ''}
      <div class="total-row grand"><span>Total</span><span>₹${total.toFixed(2)}</span></div>
    </div>`

  const sigBlock = `
    <div class="sig-row">
      <div class="sig-box">Authorised Signatory</div>
      <div class="sig-box">Customer Signature</div>
    </div>`

  const footer = `<div class="footer">Generated by ${vendorName} · ${dateStr}</div>`

  const buildDoc = (title: string, ref: string, body: string, extraMeta = '') => `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>${baseStyle}</head>
    <body>
      ${headerBlock.replace('__TITLE__', title).replace('__REF__', ref).replace('__EXTRA_META__', extraMeta)}
      ${body}
      ${footer}
    </body></html>`

  switch (formId) {
    case 'sales_invoice':
    case 'proforma_invoice': {
      const label = formId === 'proforma_invoice' ? 'Proforma Invoice' : 'Sales Invoice'
      return buildDoc(label, invoiceNumber || txnNumber, `
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Bill To</div><div class="info-box-value">${customerName}</div></div>
          <div class="info-box"><div class="info-box-label">Payment</div><div class="info-box-value">${paymentMethod || 'Cash'}</div></div>
        </div>
        ${itemTable}${totalsBlock}${sigBlock}`)
    }
    case 'sales_order': {
      return buildDoc('Sales Order', invoiceNumber || txnNumber, `
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Customer</div><div class="info-box-value">${customerName}</div></div>
          <div class="info-box"><div class="info-box-label">Expected Delivery</div><div class="blank-field"></div></div>
        </div>
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Shipping Address</div><div class="blank-field" style="min-height:40px"></div></div>
          <div class="info-box"><div class="info-box-label">Special Instructions</div><div class="blank-field" style="min-height:40px"></div></div>
        </div>
        ${itemTable}${totalsBlock}${sigBlock}`)
    }
    case 'delivery_note': {
      return buildDoc('Delivery Note', txnNumber, `
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Deliver To</div><div class="info-box-value">${customerName}</div><div class="blank-field" style="min-height:32px"></div></div>
          <div class="info-box"><div class="info-box-label">Driver / Courier</div><div class="blank-field"></div><div class="info-box-label" style="margin-top:8px">Vehicle No.</div><div class="blank-field"></div></div>
        </div>
        <table>
          <thead><tr><th><TableColumnLabel>Item</TableColumnLabel></th><th style="text-align:center"><TableColumnLabel>Ordered</TableColumnLabel></th><th style="text-align:center"><TableColumnLabel>Delivered</TableColumnLabel></th><th><TableColumnLabel>Remarks</TableColumnLabel></th></tr></thead>
          <tbody>${items.map(it => `<tr><td>${it.name}</td><td style="text-align:center">${it.qty}</td><td style="text-align:center"></td><td></td></tr>`).join('')}</tbody>
        </table>
        <div class="sig-row" style="margin-top:40px">
          <div class="sig-box">Driver Signature</div>
          <div class="sig-box">Receiver Signature &amp; Stamp</div>
        </div>`)
    }
    case 'quotation': {
      return buildDoc('Quotation', txnNumber, `
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Quote For</div><div class="info-box-value">${customerName}</div></div>
          <div class="info-box"><div class="info-box-label">Valid Until</div><div class="blank-field"></div></div>
        </div>
        ${itemTable}${totalsBlock}
        <div class="info-box" style="margin-bottom:16px"><div class="info-box-label">Terms &amp; Conditions</div><div class="blank-field" style="min-height:48px"></div></div>
        ${sigBlock}`, `<span class="badge badge-amber">QUOTATION</span>`)
    }
    case 'prescription': {
      return buildDoc('Prescription', txnNumber, `
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Patient Name</div><div class="info-box-value">${customerName}</div></div>
          <div class="info-box">
            <div class="info-box-label">Doctor / Practitioner</div><div class="blank-field"></div>
            <div class="info-box-label" style="margin-top:8px">Reg. No.</div><div class="blank-field"></div>
          </div>
        </div>
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Age / Gender</div><div class="blank-field"></div></div>
          <div class="info-box"><div class="info-box-label">Diagnosis</div><div class="blank-field"></div></div>
        </div>
        <table>
          <thead><tr><th><TableColumnLabel>#</TableColumnLabel></th><th><TableColumnLabel>Medicine / Item</TableColumnLabel></th><th><TableColumnLabel>Dosage</TableColumnLabel></th><th><TableColumnLabel>Duration</TableColumnLabel></th><th><TableColumnLabel>Instructions</TableColumnLabel></th></tr></thead>
          <tbody>${items.map((it, i) => `<tr><td>${i + 1}</td><td>${it.name}</td><td></td><td></td><td></td></tr>`).join('')}
          ${Array(Math.max(0, 3 - items.length)).fill(0).map(() => `<tr><td></td><td>&nbsp;</td><td></td><td></td><td></td></tr>`).join('')}
          </tbody>
        </table>
        <div class="info-box" style="margin-bottom:16px"><div class="info-box-label">Additional Notes / Follow-up</div><div class="blank-field" style="min-height:40px"></div></div>
        <div class="sig-row">
          <div class="sig-box">Doctor Signature &amp; Stamp</div>
          <div class="sig-box">Next Visit Date: ___________</div>
        </div>`)
    }
    case 'service_agreement': {
      return buildDoc('Service Agreement', txnNumber, `
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Service Provider</div><div class="info-box-value">${vendorName}</div><div class="info-box-sub">${vendorAddr}</div></div>
          <div class="info-box"><div class="info-box-label">Client</div><div class="info-box-value">${customerName}</div></div>
        </div>
        ${itemTable}
        <div class="info-box" style="margin-bottom:12px"><div class="info-box-label">Scope of Work</div><div class="blank-field" style="min-height:56px"></div></div>
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Start Date</div><div class="blank-field"></div></div>
          <div class="info-box"><div class="info-box-label">End Date</div><div class="blank-field"></div></div>
        </div>
        <div class="info-box" style="margin-bottom:12px"><div class="info-box-label">Terms &amp; Conditions</div><div class="blank-field" style="min-height:56px"></div></div>
        ${totalsBlock}
        <div class="sig-row" style="margin-top:40px">
          <div class="sig-box">Service Provider Signature &amp; Seal</div>
          <div class="sig-box">Client Signature &amp; Date</div>
        </div>`)
    }
    case 'warranty_card': {
      return buildDoc('Warranty Card', txnNumber, `
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Customer</div><div class="info-box-value">${customerName}</div></div>
          <div class="info-box"><div class="info-box-label">Purchase Date</div><div class="info-box-value">${dateStr}</div></div>
        </div>
        <table>
          <thead><tr><th><TableColumnLabel>Product</TableColumnLabel></th><th><TableColumnLabel>Serial No.</TableColumnLabel></th><th><TableColumnLabel>Warranty Period</TableColumnLabel></th><th><TableColumnLabel>Expiry Date</TableColumnLabel></th></tr></thead>
          <tbody>${items.map(it => `<tr><td>${it.name}</td><td></td><td></td><td></td></tr>`).join('')}</tbody>
        </table>
        <div class="info-box" style="margin-bottom:12px"><div class="info-box-label">Warranty Terms</div>
          <p style="font-size:11px;color:#6b7280;margin-top:6px;line-height:1.6">This warranty covers manufacturing defects under normal use. Damage due to misuse, accidents, or unauthorised repair voids this warranty. Please retain this card as proof of purchase.</p>
        </div>
        ${sigBlock}`)
    }
    case 'work_order': {
      return buildDoc('Work Order / Job Card', txnNumber, `
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Customer</div><div class="info-box-value">${customerName}</div></div>
          <div class="info-box"><div class="info-box-label">Technician</div><div class="blank-field"></div></div>
        </div>
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Device / Item</div><div class="blank-field"></div></div>
          <div class="info-box"><div class="info-box-label">Serial / IMEI</div><div class="blank-field"></div></div>
        </div>
        <div class="info-box" style="margin-bottom:12px"><div class="info-box-label">Problem Description</div><div class="blank-field" style="min-height:48px"></div></div>
        ${itemTable}
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Estimated Completion</div><div class="blank-field"></div></div>
          <div class="info-box"><div class="info-box-label">Status</div>
            <div style="display:flex;gap:12px;margin-top:6px">
              ${['Received','In Progress','Done'].map(s => `<label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="checkbox"> ${s}</label>`).join('')}
            </div>
          </div>
        </div>
        ${totalsBlock}${sigBlock}`)
    }
    case 'cash_receipt': {
      return buildDoc('Cash Receipt', txnNumber, `
        <div style="max-width:340px;margin:0 auto;font-family:monospace;text-align:center">
          <p style="font-size:12px;margin-bottom:12px">Received from: <strong>${customerName}</strong></p>
          <p style="font-size:28px;font-weight:700;margin:16px 0">₹${total.toFixed(2)}</p>
          <p style="font-size:12px">Mode: ${paymentMethod || 'Cash'} · Ref: ${txnNumber}</p>
          <table style="margin:16px auto;text-align:left">
            ${items.map(it => `<tr><td style="padding:2px 8px">${it.name}</td><td style="padding:2px 8px;text-align:right">×${it.qty}</td><td style="padding:2px 8px;text-align:right">₹${Number(it.total || it.price * it.qty).toFixed(2)}</td></tr>`).join('')}
          </table>
          <hr style="border:none;border-top:1px dashed #999;margin:12px 0">
          <p style="font-size:11px;color:#888">Thank you for your payment!</p>
        </div>
        ${sigBlock}`)
    }
    case 'credit_note': {
      return buildDoc('Credit / Return Note', txnNumber, `
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Customer</div><div class="info-box-value">${customerName}</div></div>
          <div class="info-box"><div class="info-box-label">Original Invoice / Ref</div><div class="blank-field"></div></div>
        </div>
        <div class="info-box" style="margin-bottom:12px"><div class="info-box-label">Reason for Return / Credit</div><div class="blank-field" style="min-height:36px"></div></div>
        ${itemTable}${totalsBlock}${sigBlock}`, `<span class="badge badge-green">CREDIT NOTE</span>`)
    }
    case 'purchase_order': {
      return buildDoc('Purchase Order', txnNumber, `
        <div class="grid2">
          <div class="info-box"><div class="info-box-label">Supplier / Vendor</div><div class="blank-field"></div></div>
          <div class="info-box"><div class="info-box-label">Expected Delivery</div><div class="blank-field"></div></div>
        </div>
        ${itemTable}${totalsBlock}
        <div class="info-box" style="margin-bottom:12px"><div class="info-box-label">Delivery Instructions</div><div class="blank-field" style="min-height:36px"></div></div>
        ${sigBlock}`)
    }
    default:
      return buildDoc('Print Form', txnNumber, itemTable + totalsBlock)
  }
}

const POS_ENABLED_FORMS_KEY = 'pos_enabled_forms'
function loadEnabledForms(): PrintFormId[] {
  try { return JSON.parse(localStorage.getItem(POS_ENABLED_FORMS_KEY) || '[]') as PrintFormId[] }
  catch { return [] }
}
function saveEnabledForms(ids: PrintFormId[]) {
  localStorage.setItem(POS_ENABLED_FORMS_KEY, JSON.stringify(ids))
}

function POSInvoiceSettingsModal({
 invSettings, vendor, posSettings, onSettingsChange, onClose,
  defaultCustomerId, defaultCustomerName, onDefaultCustomerSave, loyaltyProgram, onLoyaltyProgramSave,
}: {
  invSettings: Partial<InvoiceSettings>; vendor?: any
  posSettings: Partial<InvoiceSettings>
  onSettingsChange: (s: Partial<InvoiceSettings>) => void
  onClose: () => void
  defaultCustomerId?: string | null
  defaultCustomerName?: string | null
  onDefaultCustomerSave?: (customerId: string | null, customerName: string | null) => void
  loyaltyProgram?: { is_active: boolean; currency_per_point: number; min_redeem_points: number; max_redeem_percent: number; points_per_rupee?: number; points_per_sale?: number; bronze_threshold?: number; silver_threshold?: number; gold_threshold?: number } | null
  onLoyaltyProgramSave?: (program: Record<string, unknown>) => Promise<void>
}) {
  const merged = { ...invSettings, ...posSettings }
  const [activeTab, setActiveTab] = useState<'template' | 'prints' | 'setup'>('template')
  const [enabledForms, setEnabledForms] = useState<PrintFormId[]>(() => loadEnabledForms())
  const [previewHtml, setPreviewHtml] = useState('')
  const [localTemplate, setLocalTemplate] = useState<InvoiceSettings['template']>(
    (merged.template as InvoiceSettings['template']) || 'classic'
  )
  const [localPaper, setLocalPaper]           = useState<PaperSize>(merged.paper_size || 'A4')
  const [localColor, setLocalColor]           = useState(merged.color || '#2563eb')
  const [showLogo, setShowLogo]               = useState(merged.show_logo !== false)
  const [showHsn, setShowHsn]                 = useState(merged.show_hsn !== false)
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(merged.show_tax_breakdown !== false)
  const [showNotes, setShowNotes]             = useState(merged.show_notes !== false)
  const [showSignature, setShowSignature]     = useState(merged.show_signature !== false)

  // Default customer picker
  const [custSearch, setCustSearch] = useState('')
  const [custResults, setCustResults] = useState<{ id: string; full_name: string; phone?: string; email?: string }[]>([])
  const [custLoading, setCustLoading] = useState(false)
  const [pendingDefault, setPendingDefault] = useState<{ id: string; full_name: string } | null>(
    defaultCustomerId && defaultCustomerName ? { id: defaultCustomerId, full_name: defaultCustomerName } : null
  )
  const [savingDefault, setSavingDefault] = useState(false)

  // Loyalty program config
  const [loyaltyActive, setLoyaltyActive] = useState(loyaltyProgram?.is_active ?? false)
  const [pointsPerRupee, setPointsPerRupee] = useState(loyaltyProgram?.points_per_rupee ?? 0.1)
  const [pointsPerSale, setPointsPerSale] = useState(loyaltyProgram?.points_per_sale ?? 0)
  const [currencyPerPoint, setCurrencyPerPoint] = useState(loyaltyProgram?.currency_per_point ?? 1)
  const [minRedeemPoints, setMinRedeemPoints] = useState(loyaltyProgram?.min_redeem_points ?? 100)
  const [maxRedeemPercent, setMaxRedeemPercent] = useState(loyaltyProgram?.max_redeem_percent ?? 20)
  const [bronzeThreshold, setBronzeThreshold] = useState(loyaltyProgram?.bronze_threshold ?? 0)
  const [silverThreshold, setSilverThreshold] = useState(loyaltyProgram?.silver_threshold ?? 5000)
  const [goldThreshold, setGoldThreshold] = useState(loyaltyProgram?.gold_threshold ?? 20000)
  const [savingLoyalty, setSavingLoyalty] = useState(false)

  const currentSettings = (): Partial<InvoiceSettings> => ({
    ...invSettings,
    template: localTemplate,
    paper_size: localPaper,
    color: localColor,
    show_logo: showLogo,
    show_hsn: showHsn,
    show_tax_breakdown: showTaxBreakdown,
    show_notes: showNotes,
    show_signature: showSignature,
  })

  useEffect(() => {
    const sampleData = {
      ...SAMPLE_POS_INVOICE,
      vendor_name: vendor?.display_name || vendor?.business_name || 'Your Business',
      vendor_gstin: vendor?.gstin || '29AABCU9603R1ZM',
      vendor_address: vendor?.street_address
        ? { street: vendor.street_address, city: vendor.city || '', state: vendor.state || '', postal_code: vendor.postal_code || '' }
        : { street: '456 Business Park', city: 'Mumbai', state: 'Maharashtra', postal_code: '400001' },
      vendor_logo_url: vendor?.logo_url || '',
    }
    setPreviewHtml(generateInvoiceHtml(sampleData, currentSettings(), window.location.origin))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTemplate, localPaper, localColor, showLogo, showHsn, showTaxBreakdown, showNotes, showSignature, vendor])

  // Customer search with debounce
  useEffect(() => {
    if (custSearch.length < 2) { setCustResults([]); return }
    setCustLoading(true)
    const t = setTimeout(() => {
      vendorApi.listCustomers({ search: custSearch, size: 8 }).then(r => {
        setCustResults(r.items || [])
        setCustLoading(false)
      }).catch(() => setCustLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch])

  const handleApply = () => {
    const s = currentSettings()
    onSettingsChange(s)
    toast.success('POS invoice template saved!')
    onClose()
  }

  const handleSaveDefaultCustomer = async () => {
    setSavingDefault(true)
    await onDefaultCustomerSave?.(pendingDefault?.id ?? null, pendingDefault?.full_name ?? null)
    setSavingDefault(false)
    toast.success(pendingDefault ? `${pendingDefault.full_name} set as default POS customer` : 'Default customer cleared')
  }

  const handleSaveLoyalty = async () => {
    setSavingLoyalty(true)
    await onLoyaltyProgramSave?.({
      is_active: loyaltyActive,
      points_per_rupee: pointsPerRupee,
      points_per_sale: pointsPerSale,
      currency_per_point: currencyPerPoint,
      min_redeem_points: minRedeemPoints,
      max_redeem_percent: maxRedeemPercent,
      bronze_threshold: bronzeThreshold,
      silver_threshold: silverThreshold,
      gold_threshold: goldThreshold,
    })
    setSavingLoyalty(false)
  }

  const isNarrow    = localPaper !== 'A4'
  const previewWidth = isNarrow ? (localPaper === '2inch' ? 220 : localPaper === '3inch' ? 302 : 394) : 500

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-3.5 border-b bg-gray-50">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" /> POS Settings
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Configure receipt template, default customer & loyalty program.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open('/invoices/templates', '_blank')} className="gap-1.5 text-xs">
              <ExternalLink className="w-3.5 h-3.5" /> Full Template Editor
            </Button>
            <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b bg-gray-50 px-6">
          {([
            { key: 'template', label: 'Receipt Template', icon: FileText },
            { key: 'prints',   label: 'Print Forms',      icon: Printer },
            { key: 'setup',    label: 'POS Setup',         icon: Settings },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <tab.icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'prints' ? (
          /* ── Print Forms Tab ── */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Printer className="w-4 h-4 text-blue-600" />Print Form Library</h3>
                <p className="text-xs text-gray-500 mt-0.5">Enable the forms you need. Enabled forms will appear in the "Print Forms" panel after each sale.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { const all = PRINT_FORM_TYPES.map(f => f.id); setEnabledForms(all); saveEnabledForms(all) }}
                  className="text-xs text-blue-600 hover:underline">Enable all</button>
                <span className="text-gray-300">·</span>
                <button onClick={() => { setEnabledForms([]); saveEnabledForms([]) }}
                  className="text-xs text-gray-500 hover:underline">Clear all</button>
              </div>
            </div>

            {/* Group by category */}
            {Array.from(new Set(PRINT_FORM_TYPES.map(f => f.category))).map(category => (
              <div key={category} className="mb-6">
                <FormColumnLabel className="tracking-wide mb-2">{category}</FormColumnLabel>
                <div className="grid sm:grid-cols-2 gap-3">
                  {PRINT_FORM_TYPES.filter(f => f.category === category).map(form => {
                    const isEnabled = enabledForms.includes(form.id)
                    return (
                      <div key={form.id} className={`rounded-xl border p-3.5 transition-all ${isEnabled ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-white'}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl mt-0.5 shrink-0">{form.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900">{form.label}</p>
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${form.categoryColor}`}>{form.category}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{form.description}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {form.fields.map(f => <span key={f} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{f}</span>)}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <button
                              onClick={() => {
                                const next = isEnabled ? enabledForms.filter(id => id !== form.id) : [...enabledForms, form.id]
                                setEnabledForms(next); saveEnabledForms(next)
                              }}
                              className={`relative w-10 h-5.5 rounded-full transition-colors flex items-center px-0.5 ${isEnabled ? 'bg-blue-500' : 'bg-gray-200'}`}
                              title={isEnabled ? 'Disable' : 'Enable'}
                            >
                              <span className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                            <button
                              onClick={() => {
                                const sampleData = {
                                  transaction_number: 'PREVIEW-001', invoice_number: 'INV-PREVIEW',
                                  customer_name: 'Preview Customer', total: 1500, subtotal: 1300, tax_amount: 200, discount_amount: 0,
                                  payment_method: 'Cash',
                                  items: [{ name: 'Sample Product A', qty: 2, price: 500, total: 1000 }, { name: 'Sample Service B', qty: 1, price: 300, total: 300 }],
                                }
                                const html = generatePrintFormHtml(form.id, sampleData, vendor)
                                openPrintWindow(html)
                              }}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              <Eye className="w-3 h-3" /> Preview
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="text-xs text-gray-400 bg-gray-50 border rounded-lg p-3 mt-2">
              <strong>Tip:</strong> You can print any enabled form right from the sale receipt screen. Each form is auto-filled with the sale's data — items, customer, totals — with blank fields for manual entry where needed.
            </div>
          </div>
        ) : activeTab === 'template' ? (
          <div className="flex flex-1 overflow-hidden">
            {/* ── Left: Controls ── */}
            <div className="w-80 shrink-0 border-r overflow-y-auto p-5 space-y-5">

              {/* Template */}
              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Template</Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {INVOICE_TEMPLATE_IDS.map(t => (
                    <button key={t} onClick={() => setLocalTemplate(t)}
                      className={`py-2 px-2 rounded-lg border-2 text-xs font-medium transition-colors ${
                        localTemplate === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                      }`}>{INVOICE_TEMPLATE_LABELS[t]}</button>
                  ))}
                </div>
              </div>

              {/* Paper Size */}
              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Paper Size</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PAPER_SIZES.map(ps => (
                    <button key={ps.id} onClick={() => setLocalPaper(ps.id)}
                      className={`py-2 px-2 rounded-lg border-2 text-xs font-medium transition-colors ${
                        localPaper === ps.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                      }`}>
                      <div>{ps.label}</div>
                      <div className="text-xs text-gray-400 font-normal">{ps.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Accent Color</Label>
                <InvoiceAccentColorPicker value={localColor} onChange={setLocalColor} />
              </div>

              {/* Display Options */}
              <div className="space-y-2.5">
                <Label className="text-xs text-gray-500 uppercase tracking-wide block">Display Options</Label>
                {[
                  { label: 'Show Logo',                    checked: showLogo,         onChange: setShowLogo },
                  { label: 'Show HSN/SAC Codes',           checked: showHsn,           onChange: setShowHsn },
                  { label: 'Tax Breakdown (CGST/SGST)',    checked: showTaxBreakdown, onChange: setShowTaxBreakdown },
                  { label: 'Show Notes',                   checked: showNotes,        onChange: setShowNotes },
                  { label: 'Show Signature',               checked: showSignature,    onChange: setShowSignature },
                ].map(opt => (
                  <label key={opt.label} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={opt.checked} onChange={e => opt.onChange(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-xs text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>

              <p className="text-xs text-gray-400 leading-relaxed border-t pt-3">
                For bank details, signature upload, GST options & more, use the{' '}
                <button onClick={() => window.open('/invoices/templates', '_blank')} className="text-blue-600 underline">
                  Full Template Editor
                </button>{' '}
                — those settings are also applied here automatically.
              </p>
            </div>

            {/* ── Right: Live Preview ── */}
            <div className="flex-1 bg-gray-100 overflow-auto flex justify-center p-6">
              <div style={{ width: previewWidth, minHeight: 400 }} className="bg-white shadow-lg rounded-lg overflow-hidden max-h-[90vh] overflow-y-auto">
                {previewHtml ? (
                  <iframe srcDoc={previewHtml} title="POS Invoice Preview" className="w-full border-0"
                    style={{
                      height: isNarrow ? 600 : 800,
                      transform: isNarrow ? 'scale(1)' : 'scale(0.85)',
                      transformOrigin: 'top center',
                      width: isNarrow ? '100%' : '118%',
                      marginLeft: isNarrow ? 0 : '-9%',
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── POS Setup Tab ── */
          <div className="flex-1 overflow-y-auto p-6 space-y-8">

            {/* Default Customer */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Default Walk-in Customer</h3>
              </div>
              <p className="text-xs text-gray-500 -mt-2">This customer is pre-selected for every POS sale, useful for repetitive walk-in billing. You can still override per transaction.</p>

              {/* Current default */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Currently set</p>
                    <p className="font-semibold text-blue-900 mt-0.5">
                      {pendingDefault ? pendingDefault.full_name : <span className="text-gray-400 font-normal italic">None</span>}
                    </p>
                  </div>
                  {pendingDefault && (
                    <button type="button" aria-label="Close" onClick={() => setPendingDefault(null)}
                      className="text-blue-300 hover:text-red-500 p-1 rounded">
                <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search & pick */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Search & pick a customer</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input type="text" value={custSearch} onChange={e => setCustSearch(e.target.value)}
                    placeholder="Type name, phone or email..."
                    className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  {custLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />}
                </div>
                {custResults.length > 0 && (
                  <div className="border rounded-lg overflow-hidden divide-y">
                    {custResults.map(c => (
                      <button key={c.id}
                        onClick={() => { setPendingDefault({ id: c.id, full_name: c.full_name }); setCustSearch(''); setCustResults([]) }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 text-sm transition-colors ${pendingDefault?.id === c.id ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium">{c.full_name}</span>
                        </div>
                        <span className="text-xs text-gray-400">{c.phone || c.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button size="sm" onClick={handleSaveDefaultCustomer} disabled={savingDefault} className="gap-1.5">
                {savingDefault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Default Customer
              </Button>
            </div>

            {/* Loyalty Program */}
            <div className="border-t pt-8 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-gray-900">Loyalty Program</h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-gray-500">{loyaltyActive ? 'Active' : 'Inactive'}</span>
                  <div onClick={() => setLoyaltyActive(p => !p)}
                    className={`w-10 h-5.5 rounded-full relative transition-colors cursor-pointer ${loyaltyActive ? 'bg-amber-500' : 'bg-gray-200'}`}
                    style={{ width: 40, height: 22 }}>
                    <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${loyaltyActive ? 'translate-x-5' : 'translate-x-0.5'}`}
                      style={{ width: 18, height: 18, top: 2, transform: loyaltyActive ? 'translateX(20px)' : 'translateX(2px)' }} />
                  </div>
                </label>
              </div>

              <div className={`space-y-6 ${!loyaltyActive ? 'opacity-40 pointer-events-none' : ''}`}>

                {/* Earning rules */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-5">
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Earning Rules</p>

                  {/* Points per ₹ spent */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Points per ₹ spent</Label>
                    <div className="flex items-stretch rounded-lg overflow-hidden border border-amber-300 bg-white shadow-sm">
                      <div className="flex items-center px-3 bg-amber-100 border-r border-amber-300">
                        <span className="text-xs font-medium text-amber-700">pts</span>
                      </div>
                      <input
                        type="number" min={0} step={0.01} value={pointsPerRupee}
                        onChange={e => setPointsPerRupee(Number(e.target.value))}
                        className="flex-1 h-9 px-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 rounded-r-lg"
                      />
                      <div className="flex items-center px-3 bg-amber-100 border-l border-amber-300">
                        <span className="text-xs font-medium text-amber-700">/ ₹1</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                        <span>⚡</span>
                        {pointsPerRupee > 0
                          ? `Spend ₹${Math.round(1 / pointsPerRupee).toLocaleString('en-IN')} → earn 1 pt`
                          : 'Enter a value above 0'}
                      </span>
                      {pointsPerRupee > 0 && (
                        <span className="text-xs text-gray-400">
                          (₹100 spend = {(pointsPerRupee * 100).toFixed(1)} pts)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bonus points per sale */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">Bonus points per sale</Label>
                    <div className="flex items-stretch rounded-lg overflow-hidden border border-amber-300 bg-white shadow-sm">
                      <div className="flex items-center px-3 bg-amber-100 border-r border-amber-300">
                        <span className="text-xs font-medium text-amber-700">+pts</span>
                      </div>
                      <input
                        type="number" min={0} step={1} value={pointsPerSale}
                        onChange={e => setPointsPerSale(Number(e.target.value))}
                        className="flex-1 h-9 px-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 rounded-r-lg"
                      />
                      <div className="flex items-center px-3 bg-amber-100 border-l border-amber-300">
                        <span className="text-xs font-medium text-amber-700">flat</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                      <span>🎁</span>
                      {pointsPerSale > 0
                        ? `Every transaction earns +${pointsPerSale} bonus pts`
                        : 'No flat bonus (set 0 to skip)'}
                    </span>
                  </div>
                </div>

                {/* Redemption rules */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-5">
                  <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Redemption Rules</p>

                  {/* ₹ value per point */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">₹ value per point</Label>
                    <div className="flex items-stretch rounded-lg overflow-hidden border border-green-300 bg-white shadow-sm">
                      <div className="flex items-center px-3 bg-green-100 border-r border-green-300">
                        <span className="text-xs font-medium text-green-700">₹</span>
                      </div>
                      <input
                        type="number" min={0.01} step={0.01} value={currencyPerPoint}
                        onChange={e => setCurrencyPerPoint(Number(e.target.value))}
                        className="flex-1 h-9 px-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-400 rounded-r-lg"
                      />
                      <div className="flex items-center px-3 bg-green-100 border-l border-green-300">
                        <span className="text-xs font-medium text-green-700">/ pt</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                      <span>💰</span>
                      {currencyPerPoint > 0
                        ? `100 pts = ₹${(currencyPerPoint * 100).toFixed(2)} discount`
                        : 'Enter a value above 0'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Min points to redeem */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Min points to redeem</Label>
                      <div className="flex items-stretch rounded-lg overflow-hidden border border-green-300 bg-white shadow-sm">
                        <div className="flex items-center px-3 bg-green-100 border-r border-green-300">
                          <span className="text-xs font-medium text-green-700">≥</span>
                        </div>
                        <input
                          type="number" min={0} step={1} value={minRedeemPoints}
                          onChange={e => setMinRedeemPoints(Number(e.target.value))}
                          className="flex-1 h-9 px-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
                        />
                        <div className="flex items-center px-3 bg-green-100 border-l border-green-300">
                          <span className="text-xs font-medium text-green-700">pts</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                        <span>🔒</span>
                        {`Need ≥ ${minRedeemPoints} pts to redeem`}
                      </span>
                    </div>

                    {/* Max redeem % */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Max redeem % per txn</Label>
                      <div className="flex items-stretch rounded-lg overflow-hidden border border-green-300 bg-white shadow-sm">
                        <input
                          type="number" min={0} max={100} step={1} value={maxRedeemPercent}
                          onChange={e => setMaxRedeemPercent(Number(e.target.value))}
                          className="flex-1 h-9 px-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-400 rounded-l-lg"
                        />
                        <div className="flex items-center px-3 bg-green-100 border-l border-green-300">
                          <span className="text-xs font-medium text-green-700">%</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                        <span>🧾</span>
                        {`Cap: up to ${maxRedeemPercent}% of bill value`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tier thresholds (lifetime spend) */}
                <div className="bg-accent border border-primary/30 rounded-xl p-4 space-y-4">
                  <p className="text-xs font-medium text-primary uppercase tracking-wide">Customer Tiers <span className="font-normal text-primary/80">(lifetime spend thresholds)</span></p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: '🥉 Bronze from (₹)', value: bronzeThreshold, onChange: setBronzeThreshold, note: 'Usually ₹0 (everyone starts here)' },
                      { label: '🥈 Silver from (₹)', value: silverThreshold, onChange: setSilverThreshold, note: 'e.g. ₹5,000 lifetime' },
                      { label: '🥇 Gold from (₹)', value: goldThreshold, onChange: setGoldThreshold, note: 'e.g. ₹20,000 lifetime' },
                    ].map(tier => (
                      <div key={tier.label}>
                        <Label className="text-xs text-gray-600">{tier.label}</Label>
                        <p className="text-xs text-gray-400 mb-1">{tier.note}</p>
                        <Input type="number" min={0} step={100} value={tier.value}
                          onChange={e => tier.onChange(Number(e.target.value))} className="h-8 text-sm" />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><span>🥉</span> Bronze ≥ ₹{bronzeThreshold.toLocaleString('en-IN')}</span>
                    <span>→</span>
                    <span className="flex items-center gap-1"><span>🥈</span> Silver ≥ ₹{silverThreshold.toLocaleString('en-IN')}</span>
                    <span>→</span>
                    <span className="flex items-center gap-1"><span>🥇</span> Gold ≥ ₹{goldThreshold.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <Button size="sm" onClick={handleSaveLoyalty} disabled={savingLoyalty} className="gap-1.5 bg-amber-500 hover:bg-amber-600">
                {savingLoyalty ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                Save Loyalty Settings
              </Button>
            </div>

          </div>
        )}

        <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50">
          <p className="text-xs text-gray-500">
            {activeTab === 'template' ? 'Template settings saved to this device.' : 'POS Setup settings are saved to your account.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            {activeTab === 'template' && (
              <Button size="sm" onClick={handleApply} className="gap-1.5 bg-primary hover:bg-primary/90">
                <Check className="w-3.5 h-3.5" /> Save & Apply
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


// ── Modifier Picker Modal ─────────────────────────────────────────
import type { ModifierGroup, SelectedModifier } from '@/api/vendor'

function ModifierPickerModal({
  item,
  onConfirm,
  onClose,
}: {
  item: { id: string; variant_id?: string; name: string; sku?: string; price: number; tax_rate?: number; hsn_code?: string; sac_code?: string; item_type: 'product' | 'service'; image_url?: string; duration_minutes?: number }
  onConfirm: (itemWithModifiers: typeof item & { modifiers: SelectedModifier[] }) => void
  onClose: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-modifiers', item.id],
    queryFn: () => vendorApi.productListModifiers(item.id),
  })

  const groups = (data?.items ?? []).filter(g => g.is_active && g.options?.some(o => o.is_active))

  const [selected, setSelected] = useState<Record<string, Set<string>>>({})

  useEffect(() => {
    if (!groups.length) return
    const defaults: Record<string, Set<string>> = {}
    for (const g of groups) {
      const defOpts = g.options.filter(o => o.is_default && o.is_active)
      if (defOpts.length) defaults[g.id] = new Set(defOpts.map(o => o.id))
    }
    setSelected(defaults)
  }, [groups.length])

  function toggleOption(group: ModifierGroup, optionId: string) {
    setSelected(prev => {
      const cur = new Set(prev[group.id] ?? [])
      if (group.selection_type === 'single') {
        return { ...prev, [group.id]: new Set([optionId]) }
      }
      if (cur.has(optionId)) { cur.delete(optionId) } else { cur.add(optionId) }
      return { ...prev, [group.id]: cur }
    })
  }

  function isValid() {
    for (const g of groups) {
      if (g.is_required) {
        const count = selected[g.id]?.size ?? 0
        if (count < (g.min_select || 1)) return false
      }
    }
    return true
  }

  function buildModifiers(): SelectedModifier[] {
    const result: SelectedModifier[] = []
    for (const g of groups) {
      const selIds = selected[g.id] ?? new Set()
      for (const opt of g.options) {
        if (selIds.has(opt.id)) {
          result.push({ group_id: g.id, group_name: g.name, option_id: opt.id, option_name: opt.name, price_delta: opt.price_delta })
        }
      }
    }
    return result
  }

  const totalExtra = buildModifiers().reduce((s, m) => s + m.price_delta, 0)

  if (!isLoading && !groups.length) {
    onConfirm({ ...item, modifiers: [] })
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Customise your order</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}
          {groups.map(g => (
            <div key={g.id}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800">{g.name}</span>
                <span className="text-xs text-gray-400">
                  {g.is_required ? 'Required' : 'Optional'}
                  {g.selection_type === 'multiple' ? ' · pick many' : ' · pick one'}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.options.filter(o => o.is_active).map(opt => {
                  const checked = selected[g.id]?.has(opt.id) ?? false
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleOption(g, opt.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-left transition-colors',
                        checked ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 hover:border-gray-300',
                      )}
                    >
                      <span>{opt.name}</span>
                      <span className={cn('text-xs', opt.price_delta > 0 ? 'text-emerald-600' : 'text-gray-400')}>
                        {opt.price_delta > 0 ? `+${formatCurrency(opt.price_delta)}` : opt.price_delta < 0 ? formatCurrency(opt.price_delta) : 'free'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-700">
            <span className="font-semibold">{formatCurrency(item.price + totalExtra)}</span>
            {totalExtra > 0 && <span className="text-xs text-gray-400 ml-1">(+{formatCurrency(totalExtra)} extras)</span>}
          </div>
          <Button className="flex-1" disabled={!isValid()} onClick={() => onConfirm({ ...item, modifiers: buildModifiers() })}>
            Add to cart
          </Button>
        </div>
      </div>
    </div>
  )
}
