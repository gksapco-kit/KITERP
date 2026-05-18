import { useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ResizableTable } from '@/components/table/ResizableTable'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProducts, useServices, useCreateCustomer, vendorKeys } from '@/hooks/useVendor'
import { useCompanies, useFiscalYears, usePeriods } from '@/hooks/useFinance'
import type { Company } from '@/types/finance'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { vendorApi } from '@/api/vendor'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import {
  Search, Plus, Minus, Trash2, Receipt,
  IndianRupee, CreditCard, Smartphone, Banknote, Loader2,
  X, Package, Wrench, FilePlus, FileMinus, UserPlus, User,
  ChevronLeft, ChevronRight, Printer, Mail,
  MessageSquare, Phone, FileText, Eye, Calendar, Clock,
  Copy, Check, ExternalLink, ArrowLeft, ShoppingCart, History, Sparkles,
  Pencil, Ban,
} from 'lucide-react'
import type { Order, OrderItem } from '@/types'

type MemoMode = 'credit_memo' | 'debit_memo'

interface MemoItem {
  product_id: string
  name: string
  sku?: string
  price: number
  qty: number
  tax_rate: number
  hsn_code?: string
  discount: number
  item_type: 'product' | 'service'
}

type LineCatalogRow = {
  id: string
  name: string
  sku?: string
  price: number
  tax_rate: number
  hsn_code?: string
  item_type: 'product' | 'service'
}

type AuditLogEntry = { id: string; at: string; text: string }

const orderToMemoItems = (order: Order): MemoItem[] => {
  return (order.items || []).map((it: OrderItem, i: number) => {
    const x = it as OrderItem & {
      tax_rate?: number
      hsn_code?: string
      sac_code?: string
      item_type?: string
      discount?: number
      sku?: string
    }
    return {
      product_id: x.product_id || `ord-line-${i}`,
      name: x.name,
      sku: x.sku,
      price: Number(x.price) || 0,
      qty: Math.max(1, Number(x.qty) || 1),
      tax_rate: Number(x.tax_rate) || 0,
      hsn_code: x.hsn_code || x.sac_code,
      discount: Math.max(0, Number(x.discount) || 0),
      item_type: (x.item_type as 'product' | 'service') || 'product',
    }
  })
}

export default function CreditDebitMemos() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'list' | 'create'>('list')
  const [memoMode, setMemoMode] = useState<MemoMode>('credit_memo')
  const [cart, setCart] = useState<MemoItem[]>([])
  const [search, setSearch] = useState('')
  const [cartDiscount, setCartDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat')
  const [filter, setFilter] = useState<'all' | 'products' | 'services'>('all')
  const [memoNotes, setMemoNotes] = useState('')
  const [paymentModal, setPaymentModal] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)

  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [postingDate, setPostingDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [salesOrderRef, setSalesOrderRef] = useState('')
  const [soDropOpen, setSoDropOpen] = useState(false)
  const [soDebounced, setSoDebounced] = useState('')
  const [particularsOpenIdx, setParticularsOpenIdx] = useState<number | null>(null)
  const [pickerBox, setPickerBox] = useState<{ top: number; left: number; width: number } | null>(null)

  const [linkedOrder, setLinkedOrder] = useState<{ id: string; order_number: string; item_count: number; total: number } | null>(null)
  const [soOrderLoading, setSoOrderLoading] = useState(false)
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])

  const { data: companies = [] } = useCompanies() as { data: Company[] }
  const companiesList = companies as Company[]
  const defaultCompany = useMemo(
    () => companiesList.find((c) => c.is_default) || companiesList[0],
    [companiesList],
  )
  const [headerCompanyId, setHeaderCompanyId] = useState<string>('')
  const [headerFiscalYearId, setHeaderFiscalYearId] = useState('')
  const [headerPeriodId, setHeaderPeriodId] = useState('')
  const [headerText, setHeaderText] = useState('')
  const [headerCurrency, setHeaderCurrency] = useState('INR')
  const [particularsCatalogTab, setParticularsCatalogTab] = useState<'all' | 'product' | 'service'>('all')

  const { data: fiscalYears = [] } = useFiscalYears(headerCompanyId || undefined)
  const { data: finPeriods = [] } = usePeriods(headerFiscalYearId || '')

  const selectedHeaderCompany = useMemo(
    () => companiesList.find((c) => c.id === headerCompanyId) || null,
    [companiesList, headerCompanyId],
  )

  useEffect(() => {
    if (defaultCompany && !headerCompanyId) {
      setHeaderCompanyId(defaultCompany.id)
      setHeaderCurrency(defaultCompany.currency || 'INR')
    }
  }, [defaultCompany, headerCompanyId])

  useEffect(() => {
    if (selectedHeaderCompany?.currency) setHeaderCurrency(selectedHeaderCompany.currency)
  }, [selectedHeaderCompany?.id, selectedHeaderCompany?.currency])

  const addAudit = useCallback((text: string) => {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const at = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setAuditLog((prev) => [...prev, { id, at, text }].slice(-80))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { setSoDebounced(salesOrderRef.trim()) }, 300)
    return () => { clearTimeout(t) }
  }, [salesOrderRef])

  // Reference lookup
  const [refLookup, setRefLookup] = useState('')
  const [refDropOpen, setRefDropOpen] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [originalTxn, setOriginalTxn] = useState<Record<string, unknown> | null>(null)

  // Live search of transactions as ref is typed
  const { data: refSearchData, isFetching: refSearching } = useQuery({
    queryKey: ['ref-txn-search', refLookup],
    queryFn: () => vendorApi.posListTransactions({
      search: refLookup.trim(),
      size: 8,
      transaction_type: 'sale,completed,return',
    }),
    enabled: refLookup.trim().length >= 2 && refDropOpen,
    staleTime: 10_000,
  })
  const refSuggestions: Record<string, unknown>[] = useMemo(() => {
    const items = (refSearchData?.items || []) as Record<string, unknown>[]
    return items.filter((t: any) =>
      !['credit_memo', 'debit_memo'].includes(t.transaction_type)
    )
  }, [refSearchData])

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; full_name: string; phone?: string; email?: string } | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<{ id: string; full_name: string; phone?: string; email?: string }[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const createCustomerMut = useCreateCustomer()

  // Post-create receipt
  const [receiptData, setReceiptData] = useState<Record<string, unknown> | null>(null)

  // History
  const [histPage, setHistPage] = useState(1)
  const histPageSize = 20
  const [histSearch, setHistSearch] = useState('')
  const [histSortKey, setHistSortKey] = useState('created_at')
  const [histSortDir, setHistSortDir] = useState<SortDir>('desc')
  const [histTypeFilter, setHistTypeFilter] = useState<string>('')
  const [includeVoided, setIncludeVoided] = useState(false)
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null)
  const [memoRowBusyId, setMemoRowBusyId] = useState<string | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null)

  // POS session needed for transactions
  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    vendorApi.posGetCurrentSession().then((data) => {
      setSession(data.session)
      setSessionLoading(false)
    }).catch(() => setSessionLoading(false))
  }, [])

  const { data: memosData, isLoading: memosLoading } = useQuery({
    queryKey: [
      ...vendorKeys.all,
      'memos',
      { page: histPage, size: histPageSize, search: histSearch, type: histTypeFilter, includeVoided },
    ],
    queryFn: () => {
      const transactionType = histTypeFilter || 'credit_memo,debit_memo'
      return vendorApi.posListTransactions({
        page: histPage,
        size: histPageSize,
        search: histSearch.trim() || undefined,
        transaction_type: transactionType,
        include_voided: includeVoided,
      })
    },
  })

  const allMemos = useMemo(
    () => (memosData?.items || []) as Record<string, unknown>[],
    [memosData],
  )

  const filteredMemos = useMemo(() => {
    return processRows(
      allMemos, '', (o: any) => [o.order_number, o.transaction_number, o.customer_name || '', o.payment_method || '', String(o.total)],
      histSortKey, histSortDir,
      {
        created_at: (o: any) => o.created_at,
        order_number: (o: any) => o.order_number,
        customer_name: (o: any) => o.customer_name || '',
        total: (o: any) => o.total,
        transaction_type: (o: any) => o.transaction_type,
      },
    )
  }, [allMemos, histSortKey, histSortDir])

  const totalHistPages = Math.max(1, Math.ceil((memosData?.total || 0) / histPageSize))

  const { data: productsData } = useProducts({ size: 500, status: 'active', search: search || undefined })
  const { data: servicesData } = useServices({ size: 500, status: 'active', search: search || undefined })
  const products = productsData?.items || []
  const services = servicesData?.items || []

  const { data: allProductsData } = useProducts({ size: 500, status: 'active' })
  const { data: allServicesData } = useServices({ size: 500, status: 'active' })
  const allProductsList = allProductsData?.items || []
  const allServicesList = allServicesData?.items || []

  const lineItemCatalog = useMemo((): LineCatalogRow[] => {
    const rows: LineCatalogRow[] = []
    for (const p of allProductsList) {
      rows.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.price || 0,
        tax_rate: p.tax_rate || (p as { gst_rate?: number }).gst_rate || 0,
        hsn_code: p.hsn_code,
        item_type: 'product',
      })
    }
    for (const s of allServicesList) {
      rows.push({
        id: s.id,
        name: s.name,
        price: s.price || 0,
        tax_rate: s.tax_rate || (s as { gst_rate?: number }).gst_rate || 0,
        hsn_code: (s as { sac_code?: string }).sac_code,
        item_type: 'service',
      })
    }
    return rows
  }, [allProductsList, allServicesList])

  const filterLineCatalog = useCallback((q: string) => {
    const x = q.trim().toLowerCase()
    if (!x) return lineItemCatalog.slice(0, 20)
    const rank = (r: LineCatalogRow) => {
      const n = r.name.toLowerCase()
      const s = (r.sku || '').toLowerCase()
      if (n.startsWith(x)) return 0
      if (s.startsWith(x)) return 1
      const ni = n.indexOf(x)
      const si = s.indexOf(x)
      if (ni === 0) return 0
      if (ni >= 0) return 2 + Math.min(ni, 5)
      if (si >= 0) return 8 + Math.min(si, 5)
      return 999
    }
    return lineItemCatalog
      .map((r) => ({ r, k: rank(r) }))
      .filter((o) => o.k < 999)
      .sort((a, b) => a.k - b.k || a.r.name.localeCompare(b.r.name))
      .slice(0, 20)
      .map((o) => o.r)
  }, [lineItemCatalog])

  const filterLineCatalogForTab = useCallback(
    (q: string, tab: 'all' | 'product' | 'service') => {
      const rows = filterLineCatalog(q)
      if (tab === 'all') return rows
      return rows.filter((r) => r.item_type === tab)
    },
    [filterLineCatalog]
  )

  const { data: soSearchData, isFetching: soSearching } = useQuery({
    queryKey: ['memo-so-orders', soDebounced],
    queryFn: () => vendorApi.listOrders({ search: soDebounced, size: 8, page: 1 }),
    enabled: soDebounced.length >= 2 && soDropOpen,
    staleTime: 10_000,
  })
  const soOrderSuggestions: Order[] = (soSearchData?.items || []) as Order[]

  const fullMemoNotesForApi = useMemo(() => {
    const parts: string[] = []
    if (memoNotes.trim()) parts.push(memoNotes.trim())
    const meta: string[] = []
    if (documentDate) meta.push(`Document date: ${documentDate}`)
    if (postingDate) meta.push(`Posting date: ${postingDate}`)
    if (salesOrderRef.trim()) meta.push(`Sales order: ${salesOrderRef.trim()}`)
    if (linkedOrder) meta.push(`Linked order: ${linkedOrder.order_number} (${linkedOrder.item_count} items)`)
    const fin: string[] = []
    if (selectedHeaderCompany) fin.push(`Company: ${selectedHeaderCompany.code} (${selectedHeaderCompany.name})`)
    if (headerCurrency.trim()) fin.push(`Currency: ${headerCurrency.trim().toUpperCase()}`)
    const fyRow = (fiscalYears as { id: string; name: string }[]).find((f) => f.id === headerFiscalYearId)
    if (fyRow) fin.push(`Fiscal year: ${fyRow.name}`)
    const perRow = (finPeriods as { id: string; name: string; period_number?: number; start_date?: string; end_date?: string }[]).find(
      (p) => p.id === headerPeriodId
    )
    if (perRow) {
      const pl = [perRow.name, perRow.period_number != null ? `#${perRow.period_number}` : ''].filter(Boolean).join(' · ')
      const dr = [perRow.start_date, perRow.end_date].filter(Boolean).join(' – ')
      fin.push(`Posting period: ${pl}${dr ? ` (${dr})` : ''}`)
    }
    if (headerText.trim()) fin.push(`Header: ${headerText.trim()}`)
    if (fin.length) meta.push(fin.join(' | '))
    if (meta.length) parts.push(meta.join(' · '))
    if (auditLog.length) {
      const trail = auditLog
        .slice(-25)
        .map((a) => `[${a.at}] ${a.text}`)
        .join(' · ')
      parts.push(`Activity (audit): ${trail}`)
    }
    return parts.join(' | ')
  }, [
    memoNotes,
    documentDate,
    postingDate,
    salesOrderRef,
    linkedOrder,
    selectedHeaderCompany,
    headerCurrency,
    fiscalYears,
    finPeriods,
    headerFiscalYearId,
    headerPeriodId,
    headerText,
    auditLog,
  ])

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

  const handleQuickCreate = () => {
    if (!newCustName) { toast.error('Name is required'); return }
    createCustomerMut.mutate(
      { full_name: newCustName, phone: newCustPhone || undefined, email: newCustEmail || undefined },
      {
        onSuccess: (data: any) => {
          setSelectedCustomer({ id: data.id, full_name: data.full_name, phone: data.phone, email: data.email })
          setShowQuickCreate(false)
          setNewCustName(''); setNewCustPhone(''); setNewCustEmail('')
        },
      }
    )
  }

  const selectCustomer = (cust: { id: string; full_name: string; phone?: string; email?: string }) => {
    setSelectedCustomer(cust)
    setCustomerSearch('')
    setShowCustomerDropdown(false)
  }

  const applySalesOrderToForm = useCallback(
    (order: Order) => {
      setSalesOrderRef(order.order_number)
      setLinkedOrder({
        id: order.id,
        order_number: order.order_number,
        item_count: order.item_count || order.items?.length || 0,
        total: order.total,
      })
      setOriginalTxn(null)
      setRefLookup('')
      const lines = orderToMemoItems(order)
      setCart(lines)
      if (order.customer_id) {
        setSelectedCustomer({
          id: order.customer_id,
          full_name: order.customer_name || 'Customer',
          phone: order.customer_phone,
          email: order.customer_email,
        })
      }
      setSoDropOpen(false)
      addAudit(
        `Sales order ${order.order_number}: ${lines.length} line(s) loaded · order total ${formatCurrency(order.total)}`
      )
      toast.success(
        `Loaded ${lines.length} line${lines.length === 1 ? '' : 's'} from sales order ${order.order_number}`
      )
    },
    [addAudit]
  )

  const loadOrderLinesByRef = useCallback(async () => {
    if (!salesOrderRef.trim()) {
      toast.error('Enter a sales order #')
      return
    }
    setSoOrderLoading(true)
    try {
      const res = await vendorApi.listOrders({ search: salesOrderRef.trim(), size: 20, page: 1 })
      const q = salesOrderRef.trim().toLowerCase()
      const exact = res.items.find((o) => o.order_number?.toLowerCase() === q)
      const single = res.items.length === 1 ? res.items[0] : null
      const pick = exact || single
      if (!pick) {
        toast.error('No unique order — use search and select an order, or narrow the #')
        return
      }
      const order = await vendorApi.getOrder(pick.id)
      applySalesOrderToForm(order)
    } catch {
      toast.error('Could not load sales order lines')
    } finally {
      setSoOrderLoading(false)
    }
  }, [salesOrderRef, applySalesOrderToForm])

  const applyTxnToMemo = (txn: Record<string, unknown>) => {
    setOriginalTxn(txn)
    setRefLookup((txn.order_number || txn.transaction_number) as string)
    setRefDropOpen(false)
    setLinkedOrder(null)
    setSalesOrderRef('')
    const items: MemoItem[] = ((txn.items || []) as Record<string, unknown>[]).map(i => ({
      product_id: i.product_id as string,
      name: i.name as string,
      sku: i.sku as string | undefined,
      price: i.price as number,
      qty: i.qty as number,
      tax_rate: (i.tax_rate as number) || 0,
      hsn_code: i.hsn_code as string | undefined,
      discount: (i.discount as number) || 0,
      item_type: (i.item_type as 'product' | 'service') || 'product',
    }))
    setCart(items)
    if (txn.customer_id) {
      setSelectedCustomer({
        id: txn.customer_id as string,
        full_name: (txn.customer_name as string) || 'Customer',
        phone: txn.customer_phone as string | undefined,
      })
    }
    addAudit(
      `Reference transaction ${String(txn.order_number || txn.transaction_number || '')}: ${items.length} line(s) from POS/invoice`
    )
    toast.success(`Loaded ${items.length} item${items.length !== 1 ? 's' : ''} from ${txn.order_number || txn.transaction_number}`)
  }

  const lookupOriginalTxn = async () => {
    if (!refLookup.trim()) return
    setLookupLoading(true)
    try {
      const txn = await vendorApi.posLookupTransaction(refLookup.trim())
      applyTxnToMemo(txn)
    } catch {
      toast.error('Transaction not found — check the reference number')
    }
    setLookupLoading(false)
  }

  const loadMemoForEdit = useCallback(async (txnId: string) => {
    setMemoRowBusyId(txnId)
    setSelectedTxn(null)
    try {
      const full = (await vendorApi.posGetTransaction(txnId)) as Record<string, unknown>
      if ((full.status as string) === 'voided') {
        toast.error('Voided memos cannot be edited')
        return
      }
      const t = (full.transaction_type as string) || 'credit_memo'
      if (t !== 'credit_memo' && t !== 'debit_memo') {
        toast.error('Only credit or debit memos can be edited here')
        return
      }
      setEditingMemoId(txnId)
      setMemoMode(t as MemoMode)
      const lines: MemoItem[] = ((full.items || []) as Record<string, unknown>[]).map((i) => ({
        product_id: (i.product_id as string) || `line-${Math.random().toString(36).slice(2, 9)}`,
        name: (i.name as string) || '',
        sku: i.sku as string | undefined,
        price: Number(i.price) || 0,
        qty: Math.max(1, Number(i.qty) || 1),
        tax_rate: Number(i.tax_rate) || 0,
        hsn_code: i.hsn_code as string | undefined,
        discount: Math.max(0, Number(i.discount) || 0),
        item_type: (i.item_type as string) === 'service' ? 'service' : 'product',
      }))
      setCart(lines)
      const dType = (full.discount_type as string) || 'flat'
      setDiscountType(dType === 'percentage' ? 'percentage' : 'flat')
      setCartDiscount(Number(full.discount_value) || 0)
      const rawNotes = String(full.notes || '')
      const userNotes = rawNotes.split(/\n\[VOIDED\]/)[0] ?? rawNotes
      setMemoNotes(userNotes)
      if (full.customer_id) {
        try {
          const c = await vendorApi.getCustomer(full.customer_id as string)
          setSelectedCustomer({
            id: c.id,
            full_name: c.full_name,
            phone: c.phone,
            email: c.email,
          })
        } catch {
          setSelectedCustomer({ id: full.customer_id as string, full_name: 'Customer' })
        }
      } else {
        setSelectedCustomer(null)
      }
      setOriginalTxn(null)
      setRefLookup('')
      setLinkedOrder(null)
      setSalesOrderRef('')
      setView('create')
    } catch {
      toast.error('Could not load memo for editing')
    } finally {
      setMemoRowBusyId(null)
    }
  }, [])

  const voidMemo = useCallback(
    async (id: string, label: string) => {
      if (
        !window.confirm(
          `Void memo ${label}? The document stays in the system (audit) but will be marked voided and excluded from normal totals where applicable.`,
        )
      ) {
        return
      }
      setVoidingId(id)
      try {
        await vendorApi.posVoidMemo(id, {})
        toast.success('Memo voided')
        await queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, 'memos'] })
        await queryClient.invalidateQueries({ queryKey: ['pos-txn-detail'] })
        setSelectedTxn(null)
      } catch {
        toast.error('Could not void memo')
      } finally {
        setVoidingId(null)
      }
    },
    [queryClient],
  )

  const addToCart = useCallback((item: {
    id: string; name: string; sku?: string; price: number;
    tax_rate?: number; hsn_code?: string; sac_code?: string;
    item_type: 'product' | 'service'
  }) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product_id === item.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 }
        return updated
      }
      return [...prev, {
        product_id: item.id,
        name: item.name,
        sku: item.sku,
        price: item.price,
        qty: 1,
        tax_rate: item.tax_rate || 0,
        hsn_code: item.hsn_code || item.sac_code,
        discount: 0,
        item_type: item.item_type,
      }]
    })
  }, [])

  const removeFromCart = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx))

  const updateLine = useCallback((idx: number, patch: Partial<MemoItem>) => {
    setCart(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }, [])

  const applyLineFromCatalog = useCallback((lineIdx: number, row: LineCatalogRow) => {
    updateLine(lineIdx, {
      product_id: row.id,
      name: row.name,
      sku: row.sku,
      price: row.price,
      tax_rate: row.tax_rate,
      hsn_code: row.hsn_code,
      item_type: row.item_type,
    })
    addAudit(`Line ${lineIdx + 1}: added "${row.name}" (${row.item_type}) from catalog`)
    setParticularsOpenIdx(null)
    setPickerBox(null)
  }, [updateLine, addAudit])

  const addManualLine = useCallback(() => {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `memo-line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setCart(prev => [
      ...prev,
      {
        product_id: id,
        name: '',
        price: 0,
        qty: 1,
        tax_rate: 0,
        discount: 0,
        item_type: 'product',
      },
    ])
    addAudit('Blank line added')
  }, [addAudit])

  const repositionParticularsPicker = useCallback(() => {
    if (particularsOpenIdx === null) return
    const el = document.querySelector<HTMLInputElement>(`[data-memo-line-input="${particularsOpenIdx}"]`)
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = Math.min(Math.max(320, r.width), window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
    setPickerBox({ top: r.bottom + 6, left, width: w })
  }, [particularsOpenIdx])

  useLayoutEffect(() => {
    if (particularsOpenIdx === null) {
      setPickerBox(null)
      return
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => repositionParticularsPicker())
    })
    const onV = () => repositionParticularsPicker()
    window.addEventListener('scroll', onV, true)
    window.addEventListener('resize', onV)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onV, true)
      window.removeEventListener('resize', onV)
    }
  }, [particularsOpenIdx, repositionParticularsPicker, cart])

  useEffect(() => {
    if (particularsOpenIdx === null) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setParticularsOpenIdx(null)
        setPickerBox(null)
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [particularsOpenIdx])

  const resetForm = () => {
    setCart([])
    setCartDiscount(0)
    setMemoNotes('')
    setSelectedCustomer(null)
    setCustomerSearch('')
    setEditingMemoId(null)
    setOriginalTxn(null)
    setRefLookup('')
    setRefDropOpen(false)
    setCatalogOpen(false)
    setDocumentDate(new Date().toISOString().slice(0, 10))
    setPostingDate(new Date().toISOString().slice(0, 10))
    setSalesOrderRef('')
    setSoDropOpen(false)
    setParticularsOpenIdx(null)
    setPickerBox(null)
    setLinkedOrder(null)
    setSoOrderLoading(false)
    setAuditLog([])
    setHeaderCompanyId('')
    setHeaderFiscalYearId('')
    setHeaderPeriodId('')
    setHeaderText('')
    setHeaderCurrency('INR')
    setParticularsCatalogTab('all')
    setEditingMemoId(null)
  }

  const itemDiscountTotal = cart.reduce((s, i) => s + i.discount, 0)
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const totalTax = cart.reduce((s, i) => {
    const taxable = i.price * i.qty - i.discount
    return s + taxable * i.tax_rate / 100
  }, 0)
  const effectiveDiscount = (discountType === 'percentage' ? subtotal * cartDiscount / 100 : cartDiscount) + itemDiscountTotal
  const grandTotal = Math.round(subtotal - effectiveDiscount + totalTax)

  if (receiptData) return (
    <MemoReceipt
      data={receiptData}
      onClose={() => { setReceiptData(null); setView('list') }}
      onNewMemo={() => { setReceiptData(null); resetForm() }}
    />
  )

  if (selectedTxn) {
    return (
      <MemoDetail
        txn={selectedTxn}
        onBack={() => setSelectedTxn(null)}
        onEdit={(id) => { void loadMemoForEdit(id) }}
        onVoid={voidMemo}
        voidingId={voidingId}
      />
    )
  }

  if (view === 'list') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Credit & Debit Memos</h1>
          <p className="text-sm text-gray-500">Issue credit notes, debit notes, and adjustments</p>
        </div>
        <Button
          onClick={() => { resetForm(); setView('create') }}
          className="gap-2"
          disabled={sessionLoading || !session}
        >
          <Plus className="w-4 h-4" /> New Memo
        </Button>
      </div>

      {!session && !sessionLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>Posting session required:</strong> Memos are saved as financial documents, but the server records them
          in the same posting pipeline as the register, which is tied to an <strong>open till session</strong>. Open a
          session on the POS page, then return here to create a memo — you do not use the POS sale screen for memos.
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <TableToolbar
              search={histSearch} onSearchChange={setHistSearch}
              searchPlaceholder="Search by memo #, customer..."
              sortOptions={[
                { value: 'created_at', label: 'Date' },
                { value: 'order_number', label: 'Number' },
                { value: 'customer_name', label: 'Customer' },
                { value: 'total', label: 'Total' },
              ]}
              sortKey={histSortKey} sortDir={histSortDir}
              onSortKeyChange={setHistSortKey} onSortDirChange={setHistSortDir}
            />
            <select
              value={histTypeFilter}
              onChange={(e) => setHistTypeFilter(e.target.value)}
              className="text-xs border rounded-md px-2 py-1.5 h-9"
            >
              <option value="">All Memos</option>
              <option value="credit_memo">Credit Memos</option>
              <option value="debit_memo">Debit Memos</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={includeVoided}
                onChange={(e) => { setIncludeVoided(e.target.checked); setHistPage(1) }}
              />
              Show voided
            </label>
          </div>

          {memosLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : filteredMemos.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No memos found</p>
              <p className="text-xs text-gray-400 mt-1">Create a credit or debit memo to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <ResizableTable tableId="credit-debit-memos" defaultWidths={[110, 100, 80, 72, 150, 60, 90, 100, 88]}>
                <thead><tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Memo #</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5 text-center">Items</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5">Payment</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr></thead>
                <tbody className="divide-y">
                  {filteredMemos.map((m: any) => {
                    const voided = m.status === 'voided'
                    return (
                      <tr
                        key={m.id}
                        className={`hover:bg-gray-50 cursor-pointer ${voided ? 'opacity-60' : ''}`}
                        onClick={() => setSelectedTxn(m)}
                      >
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                          {new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-blue-600">{m.order_number || m.transaction_number}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.transaction_type === 'credit_memo' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {m.transaction_type === 'credit_memo' ? 'Credit' : 'Debit'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {voided ? (
                            <span className="text-red-600 font-medium">Voided</span>
                          ) : (
                            <span className="text-gray-500">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{m.customer_name || <span className="text-gray-400 italic">—</span>}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{m.item_count}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${m.transaction_type === 'credit_memo' ? 'text-orange-600' : 'text-blue-600'}`}>
                          {m.transaction_type === 'credit_memo' ? '-' : '+'}{formatCurrency(m.total)}
                        </td>
                        <td className="px-4 py-2.5 text-xs capitalize text-gray-500">{m.payment_method || '—'}</td>
                        <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="View"
                              onClick={() => setSelectedTxn(m)}
                            >
                              <Eye className="w-4 h-4 text-gray-500" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Edit"
                              disabled={voided || memoRowBusyId === m.id}
                              onClick={() => { void loadMemoForEdit(m.id) }}
                            >
                              {memoRowBusyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-4 h-4 text-gray-600" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Void (soft delete)"
                              disabled={voided || voidingId === m.id}
                              onClick={() => { void voidMemo(m.id, m.order_number || m.transaction_number) }}
                            >
                              {voidingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-4 h-4 text-red-500" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </ResizableTable>
            </div>
          )}

          {totalHistPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-gray-500">Page {histPage} of {totalHistPages}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={histPage <= 1} onClick={() => setHistPage(histPage - 1)} className="h-8 w-8 p-0"><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" disabled={histPage >= totalHistPages} onClick={() => setHistPage(histPage + 1)} className="h-8 w-8 p-0"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  // ── Create Memo View (document / credit note layout) ──
  const memoLinesInvalid = !cart.length || cart.some((i) => !String(i.name || '').trim())
  const lineRowTotal = (i: MemoItem) => {
    const taxable = i.price * i.qty - i.discount
    return Math.max(0, Math.round(taxable + taxable * (i.tax_rate || 0) / 100))
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100/90 pb-10">
      <div className="w-full max-w-7xl 2xl:max-w-[88rem] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="sm" onClick={() => { setView('list'); resetForm() }} className="gap-1 shrink-0">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <h1 className="text-sm font-medium text-slate-500 truncate">
              {editingMemoId ? 'Edit' : 'New'} {memoMode === 'credit_memo' ? 'credit' : 'debit'} document
            </h1>
          </div>
        </div>

        <div
          className="bg-white border border-slate-200/90 shadow-sm text-slate-900"
          style={{ boxShadow: '0 1px 0 rgba(0,0,0,.06), 0 12px 32px -12px rgba(15,23,42,.12)' }}
         onClick={e => e.stopPropagation()}>
          <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-slate-200/80">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">Document</p>
            <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-serif font-bold tracking-tight text-slate-900">
                  {editingMemoId && <span className="text-slate-500 font-sans text-base font-medium mr-2">Edit</span>}
                  {memoMode === 'credit_memo' ? 'Credit note' : 'Debit note'}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5 max-w-prose">
                  {memoMode === 'credit_memo'
                    ? 'Tax document reducing amount owed to the customer (refund, correction, return value).'
                    : 'Tax document for additional charges (missed lines, post-bill adjustment).'}
                </p>
              </div>
              <div className="text-right text-sm text-slate-600 space-y-2 shrink-0">
                <div>
                  <Label className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500 block">Document date</Label>
                  <input
                    type="date"
                    className="mt-0.5 font-mono text-sm tabular-nums font-medium text-slate-800 border border-slate-200 rounded-md px-2 py-1 bg-white"
                    value={documentDate}
                    onChange={e => setDocumentDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500 block">Posting date</Label>
                  <input
                    type="date"
                    className="mt-0.5 font-mono text-sm tabular-nums font-medium text-slate-800 border border-slate-200 rounded-md px-2 py-1 bg-white"
                    value={postingDate}
                    onChange={e => setPostingDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1 rounded-md bg-slate-100/90 p-1 max-w-sm">
              <button
                type="button"
                onClick={() => { setMemoMode('credit_memo'); resetForm() }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-sm font-medium transition-colors ${
                  memoMode === 'credit_memo' ? 'bg-white text-orange-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <FilePlus className="w-4 h-4" /> Credit
              </button>
              <button
                type="button"
                onClick={() => { setMemoMode('debit_memo'); resetForm() }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-sm font-medium transition-colors ${
                  memoMode === 'debit_memo' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <FileMinus className="w-4 h-4" /> Debit
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">Posting &amp; company</p>
              <p className="text-xs text-slate-500 mt-1 mb-3 max-w-3xl">Company, currency, and GL period for this document. Shown for control and included in the memo record on finalise.</p>
              {companiesList.length === 0 ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Add a company in Finance to fill company code, currency, and period fields.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-xs text-slate-600">Company (code)</Label>
                    <select
                      className="mt-1 w-full h-9 text-sm border border-slate-200 rounded-md bg-white"
                      value={headerCompanyId}
                      onChange={(e) => {
                        setHeaderCompanyId(e.target.value)
                        setHeaderFiscalYearId('')
                        setHeaderPeriodId('')
                      }}
                    >
                      {companiesList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                    {selectedHeaderCompany && (
                      <p className="mt-1 text-[10px] text-slate-400 font-mono">Code: {selectedHeaderCompany.code}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Currency</Label>
                    <input
                      className="mt-1 w-full h-9 text-sm border border-slate-200 rounded-md px-2 font-mono uppercase"
                      value={headerCurrency}
                      onChange={(e) => setHeaderCurrency(e.target.value.toUpperCase())}
                      placeholder="INR"
                      maxLength={8}
                    />
                    <p className="mt-1 text-[10px] text-slate-400">Defaults from company; edit if needed</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Fiscal year</Label>
                    <select
                      className="mt-1 w-full h-9 text-sm border border-slate-200 rounded-md bg-white"
                      value={headerFiscalYearId}
                      onChange={(e) => {
                        setHeaderFiscalYearId(e.target.value)
                        setHeaderPeriodId('')
                      }}
                    >
                      <option value="">— Select —</option>
                      {(fiscalYears as { id: string; name: string }[]).map((fy) => (
                        <option key={fy.id} value={fy.id}>{fy.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Posting period</Label>
                    <select
                      className="mt-1 w-full h-9 text-sm border border-slate-200 rounded-md bg-white disabled:bg-slate-50"
                      value={headerPeriodId}
                      onChange={(e) => setHeaderPeriodId(e.target.value)}
                      disabled={!headerFiscalYearId}
                    >
                      <option value="">— Select —</option>
                      {(finPeriods as { id: string; name: string; period_number?: number; start_date?: string; end_date?: string }[]).map(
                        (p) => (
                          <option key={p.id} value={p.id}>
                            {p.period_number != null ? `${p.period_number} · ` : ''}{p.name}
                            {p.start_date && p.end_date ? ` (${p.start_date} – ${p.end_date})` : ''}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div className="sm:col-span-2 xl:col-span-4">
                    <Label className="text-xs text-slate-600">Header text</Label>
                    <input
                      className="mt-1 w-full h-9 text-sm border border-slate-200 rounded-md px-2"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      placeholder="Printed or internal document title / descriptor"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 max-w-2xl">
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Sales order reference</p>
              <p className="text-xs text-slate-500 mb-2">Search and select an order to <span className="font-medium text-slate-700">load its line items</span> into this document, or type a free-text reference only.</p>
              <div className="relative">
                <div className="flex flex-wrap gap-2">
                  <div className="flex-1 min-w-[12rem] relative">
                    <ShoppingCart className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    {(soSearching || soOrderLoading) && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
                    <input
                      type="text"
                      className="w-full h-10 pl-8 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm"
                      placeholder="Order # — search, select, or Load lines"
                      value={salesOrderRef}
                      onChange={e => {
                        setSalesOrderRef(e.target.value)
                        setSoDropOpen(true)
                        if (linkedOrder && e.target.value.trim() !== linkedOrder.order_number) setLinkedOrder(null)
                      }}
                      onFocus={() => setSoDropOpen(true)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') setSoDropOpen(false)
                        if (e.key === 'Enter') { e.preventDefault(); void loadOrderLinesByRef() }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10"
                    disabled={soOrderLoading || !salesOrderRef.trim()}
                    onClick={() => { void loadOrderLinesByRef() }}
                  >
                    {soOrderLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span className="ml-1.5">Load lines</span>
                  </Button>
                </div>
                {linkedOrder && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-emerald-900">
                      <span className="font-semibold">{linkedOrder.order_number}</span>
                      <span className="text-emerald-800/80"> · {linkedOrder.item_count} lines · {formatCurrency(linkedOrder.total)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        addAudit('Sales order link removed (lines kept; clear lines manually if needed)')
                        setLinkedOrder(null)
                        setSalesOrderRef('')
                      }}
                      className="text-xs text-red-600 hover:text-red-800 ml-auto"
                    >
                      Unlink
                    </button>
                  </div>
                )}
                {soDropOpen && soDebounced.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-40 max-h-56 overflow-y-auto">
                    {soSearching ? (
                      <div className="py-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                      </div>
                    ) : soOrderSuggestions.length === 0 ? (
                      <p className="py-3 text-center text-xs text-slate-400">No order match — use free text or fix the #</p>
                    ) : (
                      <ul className="divide-y divide-slate-50">
                        {soOrderSuggestions.map((o) => (
                          <li key={o.id}>
                            <button
                              type="button"
                              onMouseDown={e => {
                                e.preventDefault()
                                setSoOrderLoading(true)
                                vendorApi
                                  .getOrder(o.id)
                                  .then((ord) => applySalesOrderToForm(ord))
                                  .catch(() => { toast.error('Could not load order') })
                                  .finally(() => { setSoOrderLoading(false) })
                              }}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50"
                            >
                              <span className="font-medium">{o.order_number || o.id}</span>
                              {o.status && <span className="text-xs text-slate-500 ml-2">{o.status}</span>}
                              <span className="float-right text-slate-700 tabular-nums">{formatCurrency(o.total)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <details className="group border-b border-slate-100 open:bg-slate-50/50">
            <summary className="px-6 sm:px-8 py-3 text-xs font-semibold text-slate-600 cursor-pointer list-none flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-open:bg-emerald-500" />
              Reference transaction
              <span className="font-normal text-slate-400">(optional — loads lines & customer)</span>
            </summary>
            <div className="px-6 sm:px-8 pb-4 -mt-1">
              <div className={`rounded-lg border p-3 space-y-2.5 ${originalTxn ? 'bg-emerald-50/80 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Link to original sale or invoice
                  </p>
                  {originalTxn && (
                    <button type="button" aria-label="Close"
                      type="button"
                      onClick={() => { setOriginalTxn(null); setRefLookup(''); setCart([]) }}
                      className="text-[10px] text-red-600 hover:text-red-800 flex items-center gap-0.5"
                    >
                <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
                {originalTxn ? (
                  <div className="bg-white rounded-md border border-emerald-200/80 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-600" />
                          {(originalTxn.order_number || originalTxn.transaction_number) as string}
                        </p>
                        {Boolean(originalTxn.transaction_number && originalTxn.order_number) && (
                          <p className="text-xs text-slate-500 ml-5">TXN: {String(originalTxn.transaction_number)}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-slate-800">{formatCurrency(originalTxn.total as number)}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 ml-5 text-xs text-slate-500">
                      {Boolean(originalTxn.customer_name) && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{String(originalTxn.customer_name)}</span>
                      )}
                      {Boolean(originalTxn.created_at) && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(String(originalTxn.created_at)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-emerald-800 font-medium">
                        <Receipt className="w-3 h-3" />
                        {((originalTxn.items as unknown[]) || []).length} lines
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          {refSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
                          <input
                            className="w-full h-9 pl-8 pr-8 text-sm border border-slate-200 rounded-md bg-white"
                            placeholder="Order #, invoice #, or customer…"
                            value={refLookup}
                            onChange={(e) => { setRefLookup(e.target.value); setRefDropOpen(true) }}
                            onFocus={() => setRefDropOpen(true)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { setRefDropOpen(false); void lookupOriginalTxn() }
                              if (e.key === 'Escape') setRefDropOpen(false)
                            }}
                          />
                        </div>
                        <Button size="sm" variant="outline" onClick={() => { void lookupOriginalTxn() }} disabled={lookupLoading || !refLookup.trim()} className="h-9 gap-1 shrink-0">
                          {lookupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                          Lookup
                        </Button>
                      </div>
                      {refDropOpen && refLookup.trim().length >= 2 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-40 max-h-56 overflow-y-auto">
                          {refSearching ? (
                            <div className="py-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                            </div>
                          ) : refSuggestions.length === 0 ? (
                            <p className="py-3 text-center text-xs text-slate-400">No match</p>
                          ) : (
                            <ul className="divide-y divide-slate-50">
                              {refSuggestions.map((t: any) => (
                                <li key={t.id}>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); applyTxnToMemo(t) }}
                                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50"
                                  >
                                    <span className="font-medium">{t.order_number || t.transaction_number}</span>
                                    <span className="float-right text-slate-800">{formatCurrency(t.total)}</span>
                                    {t.customer_name && <p className="text-xs text-slate-500 mt-0.5">{t.customer_name}</p>}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </details>

          <div className="px-6 sm:px-8 py-4 border-b border-slate-100">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500 mb-2">Customer</p>
            {selectedCustomer ? (
              <div className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2.5 bg-slate-50/50">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <User className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="font-medium text-slate-900 truncate">{selectedCustomer.full_name}</span>
                  {selectedCustomer.phone && <span className="text-xs text-slate-500 hidden sm:inline">{selectedCustomer.phone}</span>}
                </div>
                <button type="button" aria-label="Close" type="button" onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                    placeholder="Search customer by name or phone…"
                    className="w-full h-9 pl-8 pr-3 text-sm border border-slate-200 rounded-md"
                  />
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow z-30 max-h-40 overflow-y-auto">
                      {customerResults.map(c => (
                        <button
                          type="button"
                          key={c.id}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                          onMouseDown={() => selectCustomer(c)}
                        >
                          <span className="font-medium">{c.full_name}</span>
                          <span className="text-xs text-slate-500 ml-2">{c.phone || c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setShowQuickCreate(true)} title="New customer">
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 py-2">
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">Line items</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCatalogOpen(o => !o)}>
                  {catalogOpen ? 'Hide catalog' : 'Add from catalog'}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addManualLine}>
                  Add line
                </Button>
              </div>
            </div>

            {catalogOpen && (
              <div className="mb-3 mx-1 sm:mx-2 p-3 rounded-md border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex gap-1 rounded-md bg-slate-100/90 p-0.5 w-fit">
                  {(['all', 'products', 'services'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 text-xs rounded ${filter === f ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                    >
                      {f === 'all' ? 'All' : f === 'products' ? 'Products' : 'Services'}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input placeholder="Search catalog…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-0.5 text-sm">
                  {(filter === 'all' || filter === 'products') && products.map((p: any) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => { addToCart({ id: p.id, name: p.name, sku: p.sku, price: p.price, tax_rate: p.tax_rate || p.gst_rate || 0, hsn_code: p.hsn_code, item_type: 'product' }) }}
                      className="w-full text-left flex justify-between py-1.5 px-1 rounded hover:bg-white border-b border-slate-100/80 last:border-0"
                    >
                      <span className="truncate text-slate-800">{p.name}</span>
                      <span className="text-slate-600 tabular-nums ml-2 shrink-0">{formatCurrency(p.price)}</span>
                    </button>
                  ))}
                  {(filter === 'all' || filter === 'services') && services.map((s: any) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => { addToCart({ id: s.id, name: s.name, price: s.price || 0, tax_rate: s.tax_rate || s.gst_rate || 0, sac_code: s.sac_code, item_type: 'service' }) }}
                      className="w-full text-left flex justify-between py-1.5 px-1 rounded hover:bg-white border-b border-slate-100/80 last:border-0"
                    >
                      <span className="truncate text-slate-800">{s.name}</span>
                      <span className="text-slate-600 tabular-nums ml-2 shrink-0">{formatCurrency(s.price || 0)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto border-t border-b border-slate-200/90 [scrollbar-gutter:stable]">
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr className="bg-slate-50/95 text-left text-[0.65rem] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="pl-3 sm:pl-4 py-2.5 w-8">#</th>
                    <th className="py-2.5 pr-2 w-[40%] min-w-[20rem] sm:min-w-[24rem]">Particulars</th>
                    <th className="py-2.5 w-20">HSN / SAC</th>
                    <th className="py-2.5 w-16 text-right">Qty</th>
                    <th className="py-2.5 w-24 text-right">Rate</th>
                    <th className="py-2.5 w-20 text-right">Disc.</th>
                    <th className="py-2.5 w-16 text-right">Tax %</th>
                    <th className="py-2.5 w-24 text-right pr-1">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!cart.length && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400 text-sm">
                        <FileText className="w-8 h-8 mx-auto mb-1 opacity-50" />
                        Add lines, search product/service in Particulars, or set a reference above.
                      </td>
                    </tr>
                  )}
                  {cart.map((item, idx) => (
                    <tr key={idx} className="text-slate-800 align-top">
                      <td className="pl-3 sm:pl-4 py-2 text-slate-400 text-xs">{idx + 1}</td>
                      <td className="py-1.5 pr-2 align-top w-[40%] min-w-[20rem] sm:min-w-[24rem]">
                        <div className="relative min-w-0 z-[5]">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <input
                              data-memo-line-input={idx}
                              className="w-full min-w-[12rem] text-sm h-9 pl-8 pr-2 border border-slate-200 rounded-md bg-white shadow-sm hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-200/80 focus:outline-none"
                              value={item.name}
                              onChange={e => { updateLine(idx, { name: e.target.value }); setParticularsOpenIdx(idx) }}
                              onFocus={() => { setParticularsOpenIdx(idx) }}
                              onBlur={() => { setTimeout(() => { setParticularsOpenIdx(p => (p === idx ? null : p)) }, 220) }}
                              placeholder="Search product or service…"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                        <span className="text-[0.65rem] text-slate-400 mt-1 inline-block">
                          {item.item_type === 'service' ? 'Service' : 'Product'}
                        </span>
                      </td>
                      <td className="py-1.5">
                        <input
                          className="w-full text-xs font-mono border border-transparent hover:border-slate-200 rounded px-1"
                          value={item.hsn_code || ''}
                          onChange={e => updateLine(idx, { hsn_code: e.target.value || undefined })}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          min={1}
                          className="w-14 text-right text-sm border border-slate-200 rounded px-1 py-0.5 tabular-nums"
                          value={item.qty}
                          onChange={e => updateLine(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full max-w-[6.5rem] text-right text-sm border border-slate-200 rounded px-1 py-0.5 tabular-nums"
                          value={item.price}
                          onChange={e => updateLine(idx, { price: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          min={0}
                          className="w-16 text-right text-sm border border-slate-200 rounded px-1 py-0.5 tabular-nums"
                          value={item.discount}
                          onChange={e => updateLine(idx, { discount: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          min={0}
                          className="w-14 text-right text-sm border border-slate-200 rounded px-1 py-0.5 tabular-nums"
                          value={item.tax_rate}
                          onChange={e => updateLine(idx, { tax_rate: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td className="py-2 pr-1 text-right font-medium tabular-nums text-slate-800">{formatCurrency(lineRowTotal(item))}</td>
                      <td className="py-1.5">
                        <button type="button" onClick={() => removeFromCart(idx)} className="p-1 text-slate-400 hover:text-red-600 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="group mt-3 rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700">
                <History className="w-4 h-4 text-slate-500" />
                Document activity (audit trail)
                <span className="font-normal text-slate-500">
                  {auditLog.length ? `· ${auditLog.length} event${auditLog.length === 1 ? '' : 's'}` : '· no events yet'}
                </span>
                <span className="ml-auto text-[10px] font-medium text-slate-400 group-open:hidden">Show</span>
                <span className="ml-auto text-[10px] font-medium text-slate-400 hidden group-open:inline">Hide</span>
              </summary>
              <div className="border-t border-slate-100 px-3 pb-3">
                <p className="text-[10px] text-slate-500 pt-2 pb-1.5">
                  Logged for this draft. The same summary is appended to the memo <span className="font-medium">notes on finalise</span> for server-side audit.
                </p>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-xs leading-relaxed text-slate-700">
                  {auditLog.length === 0 ? (
                    <li className="text-slate-400">Activity will appear when you load a sales order, link a reference, or pick from the catalog.</li>
                  ) : (
                    auditLog.map((a) => (
                      <li key={a.id} className="flex gap-2 border-l-2 border-slate-200 pl-2.5">
                        <span className="shrink-0 font-mono text-[10px] text-slate-400 tabular-nums">{a.at}</span>
                        <span>{a.text}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </details>
          </div>

          <div className="px-6 sm:px-8 py-4 space-y-3 border-b border-slate-100">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500">Header discount</Label>
                <div className="mt-1 flex items-center gap-2">
                  <select className="text-xs border border-slate-200 rounded h-8 px-2" value={discountType} onChange={e => setDiscountType(e.target.value as 'flat' | 'percentage')}>
                    <option value="flat">Flat</option>
                    <option value="percentage">%</option>
                  </select>
                  <Input type="number" min={0} value={cartDiscount} onChange={e => setCartDiscount(Number(e.target.value))} className="h-8 text-sm w-24" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Document notes</Label>
                <input
                  type="text"
                  value={memoNotes}
                  onChange={e => setMemoNotes(e.target.value)}
                  placeholder="Reason / internal reference"
                  className="mt-1 w-full h-8 text-sm border border-slate-200 rounded-md px-2"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end sm:items-end gap-2 pt-1">
              <div className="w-full sm:max-w-xs space-y-1 text-sm text-slate-700">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal)}</span></div>
                {effectiveDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>Discounts</span><span className="tabular-nums">−{formatCurrency(effectiveDiscount)}</span></div>}
                <div className="flex justify-between"><span className="text-slate-500">Total tax</span><span className="tabular-nums">{formatCurrency(totalTax)}</span></div>
                <div className={`flex justify-between text-lg font-bold border-t border-slate-200 pt-1.5 mt-0.5 ${memoMode === 'credit_memo' ? 'text-orange-600' : 'text-blue-600'}`}>
                  <span>Total</span>
                  <span className="tabular-nums">
                    {memoMode === 'credit_memo' ? '−' : '+'}
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-4 bg-slate-50/60 border-t border-slate-200/80">
            <Button
              type="button"
              className={`w-full gap-2 h-11 text-base ${memoMode === 'credit_memo' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-primary hover:bg-primary/90'}`}
              size="lg"
              disabled={memoLinesInvalid}
              onClick={() => setPaymentModal(true)}
            >
              {memoMode === 'credit_memo' ? <FilePlus className="w-5 h-5" /> : <FileMinus className="w-5 h-5" />}
              {editingMemoId
                ? `Save changes — ${formatCurrency(grandTotal)}`
                : `Finalise ${memoMode === 'credit_memo' ? 'credit' : 'debit'} — ${formatCurrency(grandTotal)}`}
            </Button>
            {memoLinesInvalid && cart.length > 0 && <p className="text-xs text-amber-700 mt-2 text-center">Enter a description on every line.</p>}
          </div>
        </div>
      </div>

      {(() => {
        const pIdx = particularsOpenIdx
        if (pIdx === null || !pickerBox || typeof document === 'undefined' || !cart[pIdx]) return null
        const matches = filterLineCatalogForTab(cart[pIdx].name, particularsCatalogTab)
        return createPortal(
          <>
            <div
              className="fixed inset-0 z-[100] bg-slate-900/20"
              aria-hidden
              onMouseDown={() => {
                setParticularsOpenIdx(null)
                setPickerBox(null)
              }}
            />
            <div
              className="fixed z-[110] flex min-w-[20rem] max-w-[min(28rem,100vw-1rem)] max-h-[24rem] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-300/20"
              style={{
                top: pickerBox.top,
                left: pickerBox.left,
                width: Math.max(pickerBox.width, 360),
                maxHeight: 'min(24rem, calc(100vh - 8px))',
              }}
              role="dialog"
              aria-label="Product and service catalog"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-3 py-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="truncate text-xs font-semibold text-slate-800">Catalog</span>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {matches.length} in tab
                </span>
              </div>
              <div className="shrink-0 flex gap-0.5 border-b border-slate-100 bg-slate-50/90 px-2 py-1.5">
                {(['all', 'product', 'service'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setParticularsCatalogTab(tab)}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      particularsCatalogTab === tab
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                        : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                    }`}
                  >
                    {tab === 'all' ? 'All' : tab === 'product' ? 'Products' : 'Services'}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
                {matches.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-500 leading-relaxed">
                    No catalog match. Refine your search, or keep the text as a free-form line and set rate below.
                  </p>
                ) : (
                  matches.map((r) => (
                    <button
                      key={`${r.item_type}-${r.id}`}
                      type="button"
                      role="option"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        applyLineFromCatalog(pIdx, r)
                      }}
                      className="mb-1 flex w-full items-start gap-2.5 rounded-lg border border-transparent px-2.5 py-2.5 text-left text-sm transition-colors hover:border-slate-200 hover:bg-slate-50"
                    >
                      {r.item_type === 'service' ? (
                        <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                      ) : (
                        <Package className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium leading-snug text-slate-900 break-words">{r.name}</span>
                        {r.sku && <span className="mt-0.5 block font-mono text-[10px] text-slate-500">SKU {r.sku}</span>}
                      </span>
                      <span className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-slate-800">{formatCurrency(r.price)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )
      })()}

      {showQuickCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowQuickCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><UserPlus className="w-5 h-5 text-emerald-600" /> New customer</h3>
              <button type="button" aria-label="Close" type="button" onClick={() => setShowQuickCreate(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><Label className="text-xs">Full name *</Label><Input className="mt-1 h-9" value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="Name" /></div>
              <div><Label className="text-xs">Phone</Label><PhoneInput value={newCustPhone} onChange={setNewCustPhone} defaultCountryIso="IN" /></div>
              <div><Label className="text-xs">Email</Label><Input className="mt-1 h-9" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} placeholder="email@…" /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="cancel" size="sm" onClick={() => setShowQuickCreate(false)}>Cancel</Button>
              <Button type="button" size="sm" onClick={handleQuickCreate} disabled={!newCustName || createCustomerMut.isPending} className="gap-1.5">
                {createCustomerMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {paymentModal && (session || editingMemoId) && (
        <MemoPaymentModal
          total={grandTotal}
          sessionId={session?.id as string | undefined}
          editTxnId={editingMemoId}
          cart={cart}
          discountType={discountType}
          discountValue={cartDiscount}
          memoMode={memoMode}
          originalTxnId={originalTxn?.id as string | undefined}
          selectedCustomer={selectedCustomer}
          notes={fullMemoNotesForApi}
          onClose={() => setPaymentModal(false)}
          onComplete={(result, isEdit) => {
            setPaymentModal(false)
            if (isEdit) {
              setEditingMemoId(null)
              setView('list')
              void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, 'memos'] })
              void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, 'pos-transactions'] })
              void queryClient.invalidateQueries({ queryKey: ['pos-txn-detail'] })
              toast.success('Memo updated')
            } else {
              resetForm()
              void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, 'memos'] })
              void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, 'pos-transactions'] })
              if (result) setReceiptData(result)
            }
          }}
        />
      )}
    </div>
  )
}

// ── Payment Modal ────────────────────────────────────────────────

function MemoPaymentModal({ total, sessionId, editTxnId, cart, discountType, discountValue, memoMode, originalTxnId, selectedCustomer, notes, onClose, onComplete }: {
  total: number
  sessionId?: string
  editTxnId: string | null
  cart: MemoItem[]; discountType: string; discountValue: number
  memoMode: MemoMode; originalTxnId?: string; selectedCustomer?: { id: string; full_name: string } | null
  notes?: string; onClose: () => void
  onComplete: (result: Record<string, unknown> | null, isEdit?: boolean) => void
}) {
  const isCredit = memoMode === 'credit_memo'
  const isEdit = Boolean(editTxnId)
  const [method, setMethod] = useState<'cash' | 'upi' | 'card' | 'adjustment'>('adjustment')
  const [loading, setLoading] = useState(false)

  const buildNotes = () =>
    `${memoMode === 'credit_memo' ? 'CREDIT MEMO' : 'DEBIT MEMO'}${notes ? ` - ${notes}` : ''}`

  const buildItems = () =>
    cart.map((i) => ({
      product_id: i.product_id,
      name: i.name,
      sku: i.sku,
      qty: i.qty,
      price: i.price,
      discount: i.discount,
      tax_rate: i.tax_rate,
      hsn_code: i.hsn_code,
      item_type: i.item_type,
    }))

  const handleSubmit = async () => {
    if (!isEdit && !sessionId) {
      toast.error('No open register session')
      return
    }
    setLoading(true)
    const payments = method === 'adjustment'
      ? [{ method: 'adjustment', amount: total }]
      : [{ method, amount: total }]

    try {
      if (isEdit && editTxnId) {
        const result = await vendorApi.posUpdateMemo(editTxnId, {
          customer_id: selectedCustomer?.id || undefined,
          items: buildItems(),
          discount_type: discountValue > 0 ? discountType : undefined,
          discount_value: discountValue,
          payment_methods: payments,
          cash_received: 0,
          notes: buildNotes(),
        })
        onComplete(
          { ...result, customer_name: selectedCustomer?.full_name || '—', payment_method: method, memo_mode: memoMode },
          true,
        )
        setLoading(false)
        return
      }
      const result = await vendorApi.posCreateTransaction({
        session_id: sessionId as string,
        transaction_type: memoMode,
        customer_id: selectedCustomer?.id || undefined,
        items: buildItems(),
        discount_type: discountValue > 0 ? discountType : undefined,
        discount_value: discountValue,
        payment_methods: payments,
        cash_received: 0,
        notes: buildNotes(),
        return_of: originalTxnId || undefined,
      })
      toast.success(isCredit ? 'Credit memo issued!' : 'Debit memo issued!')
      onComplete({
        ...result,
        customer_name: selectedCustomer?.full_name || '—',
        payment_method: method,
        memo_mode: memoMode,
      }, false)
    } catch {
      toast.error(isEdit ? 'Could not update memo' : 'Could not issue memo — verify all items and amounts are correct')
    } finally {
      setLoading(false)
    }
  }

  const paymentMethods = [
    { key: 'adjustment' as const, icon: FileText, label: 'Adjustment', color: 'text-gray-600' },
    { key: 'cash' as const, icon: Banknote, label: 'Cash', color: 'text-green-600' },
    { key: 'upi' as const, icon: Smartphone, label: 'UPI', color: 'text-primary' },
    { key: 'card' as const, icon: CreditCard, label: 'Card', color: 'text-blue-600' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isCredit ? 'bg-orange-50' : 'bg-blue-50'}`}>
          <div>
            <h2 className="text-lg font-semibold">
              {isEdit ? (isCredit ? 'Save credit memo' : 'Save debit memo') : (isCredit ? 'Issue Credit Memo' : 'Issue Debit Memo')}
            </h2>
            <p className="text-sm text-gray-500">Amount: <span className="font-bold">{formatCurrency(total)}</span></p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">{isCredit ? 'Credit Method' : 'Debit Method'}</Label>
            <div className="grid grid-cols-4 gap-2">
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

          <div className={`rounded-lg p-3 ${isCredit ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isCredit ? 'text-orange-700' : 'text-blue-700'}`}>
                {isCredit ? 'Amount to credit' : 'Amount to debit'}
              </span>
              <span className={`text-xl font-bold ${isCredit ? 'text-orange-700' : 'text-blue-700'}`}>{formatCurrency(total)}</span>
            </div>
          </div>

          <Button
            className={`w-full gap-2 ${isCredit ? 'bg-orange-600 hover:bg-orange-700' : 'bg-primary hover:bg-primary/90'}`}
            size="lg" onClick={handleSubmit} disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isCredit ? <FilePlus className="w-5 h-5" /> : <FileMinus className="w-5 h-5" />}
            {isEdit ? 'Save changes' : (isCredit ? 'Issue Credit Memo' : 'Issue Debit Memo')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Memo Receipt ─────────────────────────────────────────────────

function MemoReceipt({ data, onClose, onNewMemo }: {
  data: Record<string, unknown>; onClose: () => void; onNewMemo: () => void
}) {
  const [copied, setCopied] = useState(false)
  const txnNumber = data.transaction_number as string
  const orderNumber = data.order_number as string
  const invoiceNumber = data.invoice_number as string
  const total = data.total as number
  const customerName = data.customer_name as string
  const paymentMethod = data.payment_method as string
  const items = (data.items || []) as Record<string, unknown>[]
  const memoMode = data.memo_mode as string
  const isCredit = memoMode === 'credit_memo'

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=400,height=600')
    if (!w) return
    const itemRows = items.map((i: any) =>
      `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">₹${(i.total || i.price * i.qty).toFixed(2)}</td></tr>`
    ).join('')
    w.document.write(`<html><head><title>${isCredit ? 'Credit Memo' : 'Debit Memo'}</title><style>body{font-family:monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto}
      table{width:100%;border-collapse:collapse}td{padding:2px 4px}hr{border:none;border-top:1px dashed #999;margin:6px 0}
      .center{text-align:center}.right{text-align:right}.bold{font-weight:bold}</style></head><body>
      <div class="center bold">${isCredit ? 'CREDIT MEMO' : 'DEBIT MEMO'}</div>
      <hr/><div>Ref: ${txnNumber}</div>${orderNumber ? `<div>Order: ${orderNumber}</div>` : ''}
      ${invoiceNumber ? `<div>Invoice: ${invoiceNumber}</div>` : ''}
      <div>Customer: ${customerName}</div><div>Date: ${new Date().toLocaleString('en-IN')}</div>
      <hr/><table><tr class="bold"><td>Item</td><td class="center">Qty</td><td class="right">Amt</td></tr>${itemRows}</table>
      <hr/><div class="right bold">Total: ₹${total.toFixed(2)}</div>
      <div class="right">Method: ${paymentMethod?.toUpperCase()}</div>
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
      <div className="bg-white rounded-2xl border shadow-lg overflow-hidden">
        <div className={`px-6 py-5 text-center ${isCredit ? 'bg-orange-50' : 'bg-blue-50'}`}>
          <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${isCredit ? 'bg-orange-100' : 'bg-blue-100'}`}>
            <Check className={`w-7 h-7 ${isCredit ? 'text-orange-600' : 'text-blue-600'}`} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{isCredit ? 'Credit Memo Issued' : 'Debit Memo Issued'}</h2>
          <p className={`text-3xl font-bold mt-2 ${isCredit ? 'text-orange-600' : 'text-blue-600'}`}>
            {isCredit ? '-' : '+'}{formatCurrency(total)}
          </p>
        </div>
        <div className="px-6 py-4 space-y-3 border-t">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Reference</span><p className="font-medium flex items-center gap-1">
              {txnNumber}
              <button onClick={copyTxnNumber} className="p-0.5 hover:bg-gray-100 rounded">
                {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
              </button>
            </p></div>
            {orderNumber && <div><span className="text-gray-500">Order</span><p className="font-semibold text-blue-600">{orderNumber}</p></div>}
            <div><span className="text-gray-500">Customer</span><p className="font-medium">{customerName}</p></div>
            <div><span className="text-gray-500">Method</span><p className="font-medium capitalize">{paymentMethod}</p></div>
          </div>
        </div>
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handlePrint} className="flex flex-col items-center gap-1 py-2.5 rounded-lg border bg-white hover:bg-gray-50"><Printer className="w-4 h-4 text-gray-600" /><span className="text-xs">Print</span></button>
            <button onClick={() => toast.info('Email sending coming soon')} className="flex flex-col items-center gap-1 py-2.5 rounded-lg border bg-white hover:bg-blue-50"><Mail className="w-4 h-4 text-blue-600" /><span className="text-xs">Email</span></button>
            <button onClick={() => toast.info('WhatsApp sharing coming soon')} className="flex flex-col items-center gap-1 py-2.5 rounded-lg border bg-white hover:bg-green-50"><MessageSquare className="w-4 h-4 text-green-600" /><span className="text-xs">WhatsApp</span></button>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 gap-2" onClick={onClose}><ArrowLeft className="w-4 h-4" /> Back to List</Button>
        <Button className="flex-1 gap-2" onClick={onNewMemo}><Plus className="w-4 h-4" /> New Memo</Button>
      </div>
    </div>
  )
}

// ── Memo Detail ──────────────────────────────────────────────────

function MemoDetail({ txn, onBack, onEdit, onVoid, voidingId }: {
  txn: Record<string, unknown>
  onBack: () => void
  onEdit: (id: string) => void
  onVoid: (id: string, label: string) => void
  voidingId: string | null
}) {
  const { data: fullTxn, isLoading: detailLoading } = useQuery({
    queryKey: ['pos-txn-detail', txn.id],
    queryFn: () => vendorApi.posGetTransaction(String(txn.id)),
  })
  const row = useMemo(
    () => ({ ...txn, ...(fullTxn && typeof fullTxn === 'object' ? fullTxn : {}) }) as Record<string, unknown>,
    [txn, fullTxn],
  )
  const items = (row.items || []) as Record<string, unknown>[]
  const pms = (row.payment_methods || []) as { method: string; amount: number }[]
  const txnType = (row.transaction_type as string) || 'credit_memo'
  const isCredit = txnType === 'credit_memo'
  const voided = row.status === 'voided'
  const id = String(row.id)

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=400,height=600')
    if (!w) return
    const itemRows = items.map((i: { name?: string; qty?: number; total?: number; price?: number; tax_rate?: number; discount?: number }) => {
      const t = (i.total as number) || (Number(i.price) * Number(i.qty)) || 0
      return `<tr><td>${i.name || ''}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">₹${t.toFixed(2)}</td></tr>`
    }).join('')
    w.document.write(`<html><head><title>Memo</title><style>body{font-family:monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto}
      table{width:100%;border-collapse:collapse}td{padding:2px 4px}hr{border:none;border-top:1px dashed #999;margin:6px 0}
      .center{text-align:center}.right{text-align:right}.bold{font-weight:bold}</style></head><body>
      <div class="center bold">${isCredit ? 'CREDIT MEMO' : 'DEBIT MEMO'}</div><hr/>
      <div>Ref: ${row.order_number || row.transaction_number}</div>
      <div>Customer: ${row.customer_name || '—'}</div>
      <div>Date: ${row.created_at ? new Date(String(row.created_at)).toLocaleString('en-IN') : ''}</div>
      <hr/><table><tr class="bold"><td>Item</td><td class="center">Qty</td><td class="right">Amt</td></tr>${itemRows}</table>
      <hr/><div class="right bold">Total: ₹${(row.total as number)?.toFixed(2)}</div>
      <hr/><div class="center">Thank you!</div></body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1"><ChevronLeft className="w-4 h-4" /> Back</Button>
        <div className="flex flex-wrap items-center gap-2">
          {detailLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handlePrint}
            disabled={detailLoading}
          >
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => onEdit(id)}
            disabled={voided || detailLoading}
          >
            <Pencil className="w-4 h-4" /> Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => onVoid(id, String(row.order_number || row.transaction_number))}
            disabled={voided || voidingId === id || detailLoading}
          >
            {voidingId === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            {voided ? 'Voided' : 'Void'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{String(row.order_number ?? row.transaction_number ?? '')}</h2>
              <p className="text-sm text-gray-500">POS: {String(row.transaction_number)}</p>
            </div>
            <div className="text-right space-y-1">
              {voided && (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Voided</span>
              )}
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${isCredit ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                {isCredit ? 'Credit Memo' : 'Debit Memo'}
              </span>
              <p className={`text-2xl font-bold mt-1 ${isCredit ? 'text-orange-600' : 'text-blue-600'}`}>
                {isCredit ? '-' : '+'}{formatCurrency(row.total as number)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Customer</p>
              <p className="font-medium mt-0.5">{(txn.customer_name as string) || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Method</p>
              <p className="font-medium mt-0.5 capitalize">{pms.map(p => p.method).join(', ') || (txn.payment_method as string) || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Date</p>
              <p className="font-medium mt-0.5">{row.created_at ? new Date(String(row.created_at)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Item</th>
                <th className="px-4 py-2 text-center">Qty</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr></thead>
              <tbody className="divide-y">
                {items.map((it: { item_type?: string; name?: string; qty?: number; price?: number; total?: number }, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 flex items-center gap-1.5">
                      {it.item_type === 'service' ? <Wrench className="w-3 h-3 text-primary/70" /> : <Package className="w-3 h-3 text-blue-400" />}
                      {it.name}
                    </td>
                    <td className="px-4 py-2 text-center">{it.qty}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(Number(it.price) || 0)}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatCurrency(Number(it.total) || (Number(it.price) * Number(it.qty)) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(Number(row.subtotal) || 0)}</span></div>
              {(Number(row.discount_amount) || 0) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatCurrency(Number(row.discount_amount))}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatCurrency(Number(row.tax_amount) || 0)}</span></div>
              <div className={`flex justify-between text-lg font-bold border-t pt-1 ${isCredit ? 'text-orange-600' : 'text-blue-600'}`}>
                <span>Total</span>
                <span>{isCredit ? '-' : '+'}{formatCurrency(row.total as number)}</span>
              </div>
            </div>
          </div>

          {row.notes != null && String(row.notes) !== '' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{String(row.notes)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
