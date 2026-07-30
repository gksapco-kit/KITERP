import { useState, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { ModalBody, ModalCloseButton, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useNavigate } from 'react-router-dom'
import { useVendorStore } from '@/stores/vendorStore'
import { formatCurrency, cn, searchFieldInnerInputClassName, searchFieldShellClassName } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Factory, Plus, Search, X, ChevronDown, ChevronLeft, Filter,
  Package, Users, RefreshCw, Calendar, CheckCircle, Hammer,
  ShoppingCart, User, Paperclip, ClipboardList, CircleDot, AlertCircle,
  ChevronRight, PackagePlus,
  BarChart3, Lock, ScanLine, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ClickableImageButton,
  ImageLightboxSession,
  urlsToLightboxItems,
} from '@/components/common/ImageAttachmentLightbox'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useProducts, useServices, useCustomers, useCreateCustomer, useTeamMembers, useSuppliers, useOrderReservations, usePlants, useStorageLocationTree } from '@/hooks/useVendor'
import {
  useProductionOrders,
  useCreateProductionOrder,
  useProductionOrdersBootstrap,
} from '@/hooks/useProductionOrders'
import { MRPReportModal } from '@/components/mrp/MRPReportModal'
import { vendorApi } from '@/api/vendor'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'
import {
  type POType,
  type POStatus,
  type Priority,
  type POItem,
  type Assignee,
  type Attachment,
  type ProductionOrder,
  genRef,
  makeAudit,
  StatusBadge,
  TypeBadge,
  ProgressBar,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
} from './productionShared'

// ─── Constants ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 'standard',  label: 'Standard',  emoji: '🏭', desc: 'Regular batch production' },
  { id: 'urgent',    label: 'Urgent',    emoji: '🔴', desc: 'Fast-track, priority queue' },
  { id: 'batch',     label: 'Batch',     emoji: '📦', desc: 'Multiple batches, same product' },
  { id: 'rework',    label: 'Rework',    emoji: '🔧', desc: 'Fix defective units' },
  { id: 'assembly',  label: 'Assembly',  emoji: '⚙️', desc: 'Assemble from components' },
  { id: 'custom',    label: 'Custom',    emoji: '✏️', desc: 'Custom requirements' },
]

/** Uniform control height in the create-order modal */
const CREATE_FIELD_H = 'h-8 min-h-8'
const CREATE_INPUT_CLS = `w-full ${CREATE_FIELD_H} border border-border rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring`
const CREATE_SELECT_TRIGGER_CLS = `${CREATE_FIELD_H} !h-8 py-0 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-ring`

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProductionOrdersPage() {
  const navigate = useNavigate()
  const { vendor, selectedStore } = useVendorStore()
  const storeId = selectedStore?.id
  useProductionOrdersBootstrap()

  // Business unit selected in the create form (scopes the catalog below).
  const [formStoreId, setFormStoreId] = useState('')
  const [formBranchId, setFormBranchId] = useState('')
  const effectiveFormStoreId = formBranchId || formStoreId
  const [formPlantId, setFormPlantId] = useState('')
  const [formOutputLocationId, setFormOutputLocationId] = useState('')
  const { data: plantsData } = usePlants(effectiveFormStoreId || null)
  const formPlants = plantsData?.plants ?? []
  const { data: formLocationsData } = useStorageLocationTree(effectiveFormStoreId || null, formPlantId || null)
  const formLocations = formLocationsData?.locations ?? []
  const { data: productsData }  = useProducts({ page: 1, size: 200, store_id: effectiveFormStoreId || undefined })
  const { data: servicesData }  = useServices({ page: 1, size: 200, store_id: effectiveFormStoreId || undefined })
  const { data: customersData } = useCustomers({ size: 200 })
  const { data: teamData }      = useTeamMembers({ size: 100 })
  const { data: suppliersData } = useSuppliers({ size: 100 })
  const createCustomer          = useCreateCustomer()

  const listParams = useMemo(() => ({
    ...(storeId ? { store_id: storeId } : {}),
  }), [storeId])

  const { data: ordersRaw = [], isLoading: ordersLoading } = useProductionOrders(listParams)
  const createOrder = useCreateProductionOrder()

  const orders = ordersRaw as unknown as ProductionOrder[]

  const products  = productsData?.items  || []
  const services  = servicesData?.items  || []
  const customers = customersData?.items || []
  const teamMembers = teamData?.items    || []
  const suppliers = suppliersData?.items || []
  const [search, setSearch]             = useState('')
  const [typeFilter, setTypeFilter]     = useState<'all' | POType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | POStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all')
  const [mrpOrder, setMrpOrder]         = useState<ProductionOrder | null>(null)
  const [showCreate, setShowCreate]     = useState(false)
  const [createType, setCreateType]     = useState<POType | null>(null)
  const [showFilters, setShowFilters]   = useState(false)

  // ── Form state ───────────────────────────────────────────────────────────
  const [formRef,          setFormRef]          = useState('')
  const [formTemplate,     setFormTemplate]     = useState('standard')
  const [formPriority,     setFormPriority]     = useState<Priority>('medium')
  const [formTeam,         setFormTeam]         = useState('')
  const [formTargetDate,   setFormTargetDate]   = useState(() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10) })
  const [formNotes,        setFormNotes]        = useState('')
  const [formItems,        setFormItems]        = useState<POItem[]>([])
  const [formAttachments,  setFormAttachments]  = useState<Attachment[]>([])
  const [formAttachLightboxIndex, setFormAttachLightboxIndex] = useState<number | null>(null)
  const formImageAttachments = useMemo(
    () => formAttachments.filter((a) => a.type.startsWith('image/')),
    [formAttachments],
  )
  const formLightboxItems = useMemo(
    () => urlsToLightboxItems(
      formImageAttachments.map((a) => a.dataUrl),
      { idPrefix: 'prod-form', altText: (i) => formImageAttachments[i]?.name ?? `Attachment ${i + 1}` },
    ),
    [formImageAttachments],
  )
  // MTO customer fields
  const [customerSearch,      setCustomerSearch]      = useState('')
  const [customerDropOpen,    setCustomerDropOpen]    = useState(false)
  const [selectedCustomerId,  setSelectedCustomerId]  = useState('')
  const [formCustomerName,    setFormCustomerName]    = useState('')
  const [formCustomerPhone,   setFormCustomerPhone]   = useState('')
  const [formCustomerEmail,   setFormCustomerEmail]   = useState('')
  const [showNewCustomer,     setShowNewCustomer]     = useState(false)
  const [newCustName,         setNewCustName]         = useState('')
  const [newCustPhone,        setNewCustPhone]        = useState('')
  const [newCustEmail,        setNewCustEmail]        = useState('')
  const [formOrderRef,        setFormOrderRef]        = useState('')
  const [formDeadline,        setFormDeadline]        = useState('')
  const [formSpecialReq,      setFormSpecialReq]      = useState('')
  // MTS fields
  const [formTargetStock,     setFormTargetStock]     = useState('')
  // Item picker — products + services
  const [itemSearch,          setItemSearch]          = useState('')
  const [itemQty,             setItemQty]             = useState('1')
  const [itemTab,             setItemTab]             = useState<'product' | 'service'>('product')
  // Variant picker — shown when a product has active variants
  const [variantPickerProduct, setVariantPickerProduct] = useState<any | null>(null)
  const [variantPickerSearch,  setVariantPickerSearch]  = useState('')
  // Barcode scanner
  const [showCameraScanner,   setShowCameraScanner]   = useState(false)
  const [scanLoading,         setScanLoading]         = useState(false)
  // Assignee picker
  const [assigneeSearch,      setAssigneeSearch]      = useState('')
  const [assigneeDropOpen,    setAssigneeDropOpen]    = useState(false)
  const [assigneeTab,         setAssigneeTab]         = useState<'team' | 'supplier'>('team')
  const [formAssignees,       setFormAssignees]       = useState<Assignee[]>([])
  const assigneeAnchorRef                             = useRef<HTMLDivElement>(null)
  const [assigneeDropStyle,   setAssigneeDropStyle]   = useState<React.CSSProperties>({})

  const closeCreateModal = useCallback(() => {
    setShowCreate(false)
    setCreateType(null)
  }, [])

  // Background handlers — disabled while the create modal is open so Esc closes the modal.
  // Variant picker Escape is handled by its ModalOverlay (portaled above create).
  useEscapeToClose(() => setShowNewCustomer(false), showNewCustomer)
  useEscapeToClose(() => setMrpOrder(null), !!mrpOrder)
  // Create modal — register before inner dropdowns so nested pickers close first on Esc.
  useEscapeToClose(closeCreateModal, showCreate)
  useEscapeToClose(() => setCustomerDropOpen(false), customerDropOpen && showCreate)
  useEscapeToClose(() => setAssigneeDropOpen(false), assigneeDropOpen && showCreate)

  // Hardware barcode scanner (keyboard-wedge) — only active when the create modal is open
  useBarcodeScanner({
    onScan: useCallback((code: string) => {
      if (showCreate && createType) { handleBarcodeScan(code) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCreate, createType]),
    enabled: showCreate && !!createType,
  })

  // ── Computed ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: orders.length,
    mto: orders.filter(o => o.type === 'mto').length,
    mts: orders.filter(o => o.type === 'mts').length,
    inProd: orders.filter(o => o.status === 'in_production').length,
    completed: orders.filter(o => o.status === 'completed').length,
    draft: orders.filter(o => o.status === 'draft').length,
    urgent: orders.filter(o => o.priority === 'urgent').length,
  }), [orders])

  const filtered = useMemo(() => {
    let rows = orders
    if (typeFilter !== 'all')     rows = rows.filter(o => o.type === typeFilter)
    if (statusFilter !== 'all')   rows = rows.filter(o => o.status === statusFilter)
    if (priorityFilter !== 'all') rows = rows.filter(o => o.priority === priorityFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(o =>
        o.ref.toLowerCase().includes(q) ||
        o.items.some(i => i.name.toLowerCase().includes(q)) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.order_ref || '').toLowerCase().includes(q),
      )
    }
    return [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [orders, typeFilter, statusFilter, priorityFilter, search])

  const filteredProducts = useMemo(() => {
    if (!itemSearch.trim()) return products.slice(0, 20)
    const q = itemSearch.toLowerCase()
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)).slice(0, 20)
  }, [products, itemSearch])

  const filteredServices = useMemo(() => {
    if (!itemSearch.trim()) return services.slice(0, 20)
    const q = itemSearch.toLowerCase()
    return services.filter(s => s.name.toLowerCase().includes(q)).slice(0, 20)
  }, [services, itemSearch])

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 10)
    const q = customerSearch.toLowerCase()
    return customers.filter((c: { full_name: string; phone?: string; email?: string; id: string }) =>
      c.full_name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.id?.toLowerCase().includes(q),
    ).slice(0, 10)
  }, [customers, customerSearch])

  const filteredTeam = useMemo(() => {
    if (!assigneeSearch.trim()) return teamMembers.slice(0, 10)
    const q = assigneeSearch.toLowerCase()
    return teamMembers.filter((m: any) =>
      m.full_name?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q) || m.role?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q),
    ).slice(0, 10)
  }, [teamMembers, assigneeSearch])

  const filteredSuppliers = useMemo(() => {
    if (!assigneeSearch.trim()) return suppliers.slice(0, 10)
    const q = assigneeSearch.toLowerCase()
    return suppliers.filter((s: { company_name?: string; contact_name?: string; id: string }) =>
      s.company_name?.toLowerCase().includes(q) || s.contact_name?.toLowerCase().includes(q),
    ).slice(0, 10)
  }, [suppliers, assigneeSearch])

  // ── Form helpers ─────────────────────────────────────────────────────────
  function resetForm() {
        setFormStoreId(selectedStore?.id || '')
        setFormBranchId('')
        setFormPlantId('')
        setFormOutputLocationId('')
    setFormRef(''); setFormTemplate('standard'); setFormPriority('medium')
    setFormTeam(''); setFormTargetDate((() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10) })())
    setFormNotes(''); setFormItems([]); setFormAttachments([])
    setCustomerSearch(''); setSelectedCustomerId(''); setFormCustomerName('')
    setFormCustomerPhone(''); setFormCustomerEmail('')
    setShowNewCustomer(false); setNewCustName(''); setNewCustPhone(''); setNewCustEmail('')
    setFormOrderRef(''); setFormDeadline(''); setFormSpecialReq(''); setFormTargetStock('')
    setItemSearch(''); setItemQty('1'); setItemTab('product')
    setFormAssignees([]); setAssigneeSearch('')
  }

  function selectCustomer(c: { id: string; full_name: string; phone?: string; email?: string }) {
    setSelectedCustomerId(c.id)
    setFormCustomerName(c.full_name)
    setFormCustomerPhone(c.phone || '')
    setFormCustomerEmail(c.email || '')
    setCustomerSearch(c.full_name)
    setCustomerDropOpen(false)
    setShowNewCustomer(false)
  }

  async function createNewCustomer() {
    if (!newCustName.trim()) { toast.error('Customer name is required.'); return }
    if (!newCustPhone.trim() && !newCustEmail.trim()) { toast.error('Provide phone or email.'); return }
    try {
      const result = await createCustomer.mutateAsync({ full_name: newCustName, phone: newCustPhone || undefined, email: newCustEmail || undefined })
      selectCustomer({ id: result.id || '', full_name: newCustName, phone: newCustPhone, email: newCustEmail })
      setShowNewCustomer(false); setNewCustName(''); setNewCustPhone(''); setNewCustEmail('')
      toast.success('Customer created and linked.')
    } catch { /* handled by hook */ }
  }

  function addItem(item: {
    id: string; name: string; sku?: string; type: 'product' | 'service';
    variant_id?: string; variant_name?: string; variant_sku?: string; variant_barcode?: string;
  }) {
    const qty = parseInt(itemQty) || 1
    const displayName = item.variant_name ? `${item.name} — ${item.variant_name}` : item.name
    const existing = formItems.find(i =>
      i.product_id === item.id && (i.variant_id ?? '') === (item.variant_id ?? ''),
    )
    if (existing) {
      setFormItems(prev => prev.map(i =>
        i.product_id === item.id && (i.variant_id ?? '') === (item.variant_id ?? '')
          ? { ...i, qty: i.qty + qty }
          : i,
      ))
    } else {
      setFormItems(prev => [...prev, {
        product_id: item.id,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
        variant_sku: item.variant_sku,
        variant_barcode: item.variant_barcode,
        item_type: item.type,
        name: displayName,
        sku: item.variant_sku || item.sku,
        qty,
        priority: formPriority,
        produced: 0,
      }])
    }
    setItemSearch(''); setItemQty('1')
    toast.success(`${displayName} added`)
  }

  async function handleBarcodeScan(code: string) {
    setScanLoading(true)
    try {
      const result = await vendorApi.barcodeLookup(code)
      const p = result.product
      const v = result.variant
      addItem({
        id: p.id,
        name: p.name,
        sku: p.sku,
        type: 'product',
        variant_id: v?.id,
        variant_name: v?.name,
        variant_sku: v?.sku,
        variant_barcode: v?.barcode,
      })
    } catch (err: any) {
      if (err?.response?.status === 404) {
        toast.error(`Product not found for barcode: ${code}`)
      } else {
        toast.error('Barcode scan error. Please try again.')
      }
    }
    setScanLoading(false)
  }

  function openAssigneeDrop() {
    const el = assigneeAnchorRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow >= 180) {
        setAssigneeDropStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width })
      } else {
        setAssigneeDropStyle({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width })
      }
    }
    setAssigneeDropOpen(true)
    setCustomerDropOpen(false)
  }

  function addAssignee(a: Assignee) {
    if (formAssignees.some(x => x.id === a.id)) { toast.info('Already assigned.'); return }
    setFormAssignees(prev => [...prev, a])
    setAssigneeSearch(''); setAssigneeDropOpen(false)
  }

  function removeAssignee(id: string) {
    setFormAssignees(prev => prev.filter(a => a.id !== id))
  }

  function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        setFormAttachments(prev => [...prev, { name: file.name, dataUrl: ev.target?.result as string, type: file.type, size: file.size }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function submitCreate() {
    if (!createType) return
    if (!formItems.length) { toast.error('Add at least one item.'); return }
    const ref = formRef.trim() || genRef(createType)
    const customerLabel = formCustomerName ? ` for ${formCustomerName}` : ''
    const payload: Record<string, unknown> = {
      ref,
      type: createType,
      store_id: effectiveFormStoreId || storeId || null,
      plant_id: formPlantId || null,
      output_storage_location_id: formOutputLocationId || null,
      template: TEMPLATES.find(t => t.id === formTemplate)?.label || formTemplate,
      status: 'draft',
      progress: 0,
      priority: formPriority,
      items: formItems,
      team: formTeam,
      target_date: formTargetDate || null,
      assignees: formAssignees,
      notes: formNotes,
      attachments: formAttachments,
      stock_dispatches: [],
      audit_log: [
        makeAudit('created', `Order ${ref} created as Draft${customerLabel}`, { items: formItems.length, type: createType }),
      ],
      ...(createType === 'mto' ? {
        customer_id: selectedCustomerId || null,
        customer_name: formCustomerName,
        customer_phone: formCustomerPhone,
        customer_email: formCustomerEmail,
        order_ref: formOrderRef,
        delivery_deadline: formDeadline || null,
        special_requirements: formSpecialReq,
      } : {
        target_stock_level: Number(formTargetStock) || 0,
      }),
    }
    createOrder.mutate(payload, {
      onSuccess: (row) => {
        setShowCreate(false)
        setCreateType(null)
        resetForm()
        if (row?.id) {
          navigate(`/production/orders/${row.id}`)
        }
      },
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Factory className="w-6 h-6 text-primary" /> Production Orders
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage Make-To-Order &amp; Make-To-Stock Production Workflows</p>
            <p className="text-xs mt-2 px-2.5 py-1 rounded-lg border bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-200 inline-block">
              {storeId ? (
                <>Showing orders for <strong>{selectedStore?.name}</strong></>
              ) : (
                <>Showing orders for <strong>all business units</strong> — pick a business unit in the header to filter</>
              )}
            </p>
          </div>
          <Button onClick={() => { setShowCreate(true); setCreateType(null) }}
            className="bg-primary hover:bg-primary/90 text-white gap-1.5 shrink-0">
            <Plus className="w-4 h-4" /> New Order
          </Button>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total Orders', value: stats.total, icon: ClipboardList, bg: 'bg-accent', color: 'text-primary' },
            { label: 'MTO (Customer)', value: stats.mto, icon: ShoppingCart, bg: 'bg-indigo-50 dark:bg-indigo-950/40', color: 'text-indigo-600 dark:text-indigo-300' },
            { label: 'MTS (Stock)', value: stats.mts, icon: Package, bg: 'bg-teal-50 dark:bg-teal-950/40', color: 'text-teal-600 dark:text-teal-300' },
            { label: 'In Production', value: stats.inProd, icon: Factory, bg: 'bg-amber-50 dark:bg-amber-950/40', color: 'text-amber-600 dark:text-amber-300' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle, bg: 'bg-green-50 dark:bg-green-950/40', color: 'text-green-600 dark:text-green-300' },
            { label: 'Draft', value: stats.draft, icon: CircleDot, bg: 'bg-gray-100 dark:bg-gray-800', color: 'text-gray-600 dark:text-gray-300' },
            { label: 'Urgent', value: stats.urgent, icon: AlertCircle, bg: 'bg-red-50 dark:bg-red-950/40', color: 'text-red-600 dark:text-red-300' },
          ].map(s => (
            <button key={s.label} onClick={() => {
              if (s.label === 'MTO (Customer)') setTypeFilter('mto')
              else if (s.label === 'MTS (Stock)') setTypeFilter('mts')
              else if (s.label === 'In Production') setStatusFilter('in_production')
              else if (s.label === 'Completed') setStatusFilter('completed')
              else if (s.label === 'Draft') setStatusFilter('draft')
              else if (s.label === 'Urgent') setPriorityFilter('urgent')
            }}
              className={`${s.bg} rounded-2xl p-3 text-left hover:opacity-80 transition-opacity`}>
              <s.icon className={`w-4 h-4 ${s.color} mb-1.5`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>

        {/* ── MTO vs MTS explainer strip ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 dark:bg-indigo-500/10 dark:border-indigo-500/30">
            <ShoppingCart className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-indigo-900">Make to Order (MTO)</p>
              <p className="text-xs text-indigo-700 mt-0.5">Customer-specific production. Each order is tied to a customer or sales order. Products are manufactured on demand and dispatched directly to the customer upon completion.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3 dark:bg-teal-500/10 dark:border-teal-500/30">
            <Package className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-teal-900">Make to Stock (MTS)</p>
              <p className="text-xs text-teal-700 mt-0.5">Inventory replenishment. Products are manufactured to maintain or build up stock levels. When complete, finished goods are dispatched directly to the store inventory.</p>
            </div>
          </div>
        </div>

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            data-kiterp-search-field
            className={cn(searchFieldShellClassName, 'px-3 py-2 flex-1 min-w-[180px] max-w-sm shadow-sm')}
          >
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              data-kiterp-no-field-focus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ref, product, customer…"
              className={cn(searchFieldInnerInputClassName, 'text-sm text-foreground placeholder:text-muted-foreground')}
            />
            {search && <button type="button" aria-label="Close" onClick={() => setSearch('')}>
                <X className="w-3 h-3 text-gray-400" /></button>}
          </div>

          {/* Type filter */}
          <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5">
            {(['all', 'mto', 'mts'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${typeFilter === t ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                {t === 'all' ? 'All Types' : t === 'mto' ? '🛒 MTO' : '📦 MTS'}
              </button>
            ))}
          </div>

          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 bg-card transition-colors ${showFilters ? 'border-primary/60 text-primary' : 'border-border hover:bg-accent'}`}>
            <Filter className="w-3.5 h-3.5" /> More Filters
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={() => navigate('/production/schedule')}
              className="flex items-center gap-1.5 text-xs font-medium border border-border rounded-lg px-3 py-1.5 bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
              <Calendar className="w-3.5 h-3.5" /> Schedule
            </button>
            <button onClick={() => navigate('/production/analytics')}
              className="flex items-center gap-1.5 text-xs font-medium border border-border rounded-lg px-3 py-1.5 bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </button>
          </div>

          {(typeFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all') && (
            <button type="button" aria-label="Close" onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setPriorityFilter('all') }}
              className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 bg-card border border-border rounded-2xl p-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1.5">Status</p>
              <div className="flex flex-wrap gap-1">
                {(['all', ...Object.keys(STATUS_CONFIG)] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s as 'all' | POStatus)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                    {s === 'all' ? 'All' : STATUS_CONFIG[s as POStatus].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1.5">Priority</p>
              <div className="flex flex-wrap gap-1">
                {(['all', 'low', 'medium', 'high', 'urgent'] as const).map(p => (
                  <button key={p} onClick={() => setPriorityFilter(p)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${priorityFilter === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                    {p === 'all' ? 'All' : PRIORITY_CONFIG[p].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Order list ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          {ordersLoading ? (
            <div className="bg-card rounded-2xl border border-border text-center py-16 text-gray-400">
              Loading production orders…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border text-center py-20 text-gray-400">
              <Factory className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-muted-foreground">No production orders yet</p>
              <p className="text-sm mt-1">Click "New Order" to create your first MTO or MTS order.</p>
              <Button onClick={() => { setShowCreate(true); setCreateType(null) }} className="mt-4 bg-primary hover:bg-primary/90 text-white gap-1.5 text-sm">
                <Plus className="w-3.5 h-3.5" /> New Order
              </Button>
            </div>
          ) : filtered.map(order => {
            const totalDispatched = order.stock_dispatches.reduce((s, d) => s + d.qty, 0)
            return (
              <ProductionOrderCard
                key={order.id}
                order={order}
                totalDispatched={totalDispatched}
                onSelect={() => navigate(`/production/orders/${order.id}`)}
                onMRP={e => { e.stopPropagation(); setMrpOrder(order) }}
              />
            )
          })}
        </div>
      </div>

      {/* Create order: portaled ModalOverlay (escape handled by ModalOverlay) */}
      {showCreate && (
        <ModalOverlay
          onClose={closeCreateModal}
          className="z-[100] overflow-y-auto overscroll-contain bg-black/60 p-2 sm:p-3"
        >
          <ModalPanel
            className={cn(
              'my-auto w-full !rounded-lg',
              !createType
                ? 'max-w-md min-h-[min(28rem,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1rem)]'
                : 'max-w-2xl max-h-[calc(100dvh-1rem)]',
            )}
          >

            {/* Step 1: choose type */}
            {!createType ? (
              <>
                <div className="flex shrink-0 items-center gap-2.5 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Factory className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold leading-tight text-foreground">New Production Order</h2>
                    <p className="text-xs text-muted-foreground">Choose the production type</p>
                  </div>
                  <ModalCloseButton onClose={() => setShowCreate(false)} />
                </div>
                <ModalBody className="flex flex-1 flex-col justify-center space-y-3 overflow-y-auto px-4 pb-5 pt-1">
                  <button
                    type="button"
                    onClick={() => { setCreateType('mto'); setFormRef(genRef('mto')) }}
                    className="flex w-full flex-col items-start gap-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4 text-left transition-all hover:border-indigo-400 hover:bg-indigo-100"
                  >
                    <div className="flex w-full items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-indigo-100 p-2.5">
                        <ShoppingCart className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-indigo-900">Make to Order (MTO)</p>
                        <p className="mt-1 text-xs leading-snug text-indigo-700">
                          Customer-specific production linked to a sales order.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-[3.25rem]">
                      {['Customer-specific', 'Direct dispatch'].map(t => (
                        <span key={t} className="rounded-full bg-indigo-200/80 px-2 py-0.5 text-[10px] font-medium text-indigo-800">{t}</span>
                      ))}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreateType('mts'); setFormRef(genRef('mts')) }}
                    className="flex w-full flex-col items-start gap-3 rounded-xl border-2 border-teal-200 bg-teal-50 p-4 text-left transition-all hover:border-teal-400 hover:bg-teal-100"
                  >
                    <div className="flex w-full items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-teal-100 p-2.5">
                        <Package className="h-5 w-5 text-teal-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-teal-900">Make to Stock (MTS)</p>
                        <p className="mt-1 text-xs leading-snug text-teal-700">
                          Replenish inventory — finished goods go to store stock.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-[3.25rem]">
                      {['Stock replenishment', 'Adds to inventory'].map(t => (
                        <span key={t} className="rounded-full bg-teal-200/80 px-2 py-0.5 text-[10px] font-medium text-teal-800">{t}</span>
                      ))}
                    </div>
                  </button>
                </ModalBody>
              </>
            ) : (
              /* Step 2: fill details */
              <>
                <div className={`flex shrink-0 items-center gap-2 px-3 py-2.5 ${createType === 'mto' ? 'bg-indigo-50/80' : 'bg-teal-50/80'}`}>
                  <div className={`shrink-0 rounded-md p-1 ${createType === 'mto' ? 'bg-indigo-100' : 'bg-teal-100'}`}>
                    {createType === 'mto' ? <ShoppingCart className="h-3.5 w-3.5 text-indigo-600" /> : <Package className="h-3.5 w-3.5 text-teal-600" />}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">{createType === 'mto' ? 'Make to Order' : 'Make to Stock'}</h2>
                    <span className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{formRef}</span>
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">· {createType === 'mto' ? 'Customer-specific' : 'Stock replenishment'}</span>
                  </div>
                  <button type="button" onClick={() => setCreateType(null)} className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground rounded px-1 py-0.5 hover:bg-black/5 transition-colors">
                    <ChevronLeft className="h-3 w-3" /> Back
                  </button>
                  <ModalCloseButton onClose={() => { setShowCreate(false); setCreateType(null); resetForm() }} showEscHint={false} />
                </div>
                <ModalBody className="min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto px-3 pb-3 pt-2">

                  {/* Template — inline single row */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Template</span>
                    {TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => setFormTemplate(t.id)} title={t.desc}
                        className={cn(
                          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[11px] font-medium transition-all',
                          formTemplate === t.id
                            ? 'border-primary/50 bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/30',
                        )}>
                        <span className="text-xs leading-none">{t.emoji}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Core fields — 12-column grid, max fields per row */}
                  <div className="grid grid-cols-12 gap-x-2 gap-y-1.5">
                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Business unit</label>
                      <BusinessUnitSelect
                        value={formStoreId}
                        onChange={(id) => { setFormStoreId(id); setFormBranchId(''); setFormItems([]); setFormPlantId(''); setFormOutputLocationId('') }}
                        className="w-full"
                        triggerClassName={CREATE_SELECT_TRIGGER_CLS}
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Branch</label>
                      <BranchSelect
                        businessUnitId={formStoreId || null}
                        value={formBranchId}
                        onChange={(id) => { setFormBranchId(id); setFormItems([]); setFormPlantId(''); setFormOutputLocationId('') }}
                        allowAll
                        className="w-full"
                        triggerClassName={CREATE_SELECT_TRIGGER_CLS}
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Work Order Ref</label>
                      <div className="flex gap-1">
                        <input value={formRef} onChange={e => setFormRef(e.target.value)}
                          className={`${CREATE_INPUT_CLS} font-mono flex-1 min-w-0`} />
                        <button
                          type="button"
                          onClick={() => setFormRef(genRef(createType!))}
                          title="Generate new reference"
                          className={`${CREATE_FIELD_H} w-8 flex items-center justify-center rounded-md border border-border bg-card hover:bg-accent shrink-0 transition-colors`}
                        >
                          <RefreshCw className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Priority</label>
                      <Select
                        value={formPriority}
                        onChange={(v) => setFormPriority(v as Priority)}
                        options={[
                          { value: 'low',    label: '● Low' },
                          { value: 'medium', label: '● Medium' },
                          { value: 'high',   label: '● High' },
                          { value: 'urgent', label: '● Urgent' },
                        ]}
                        aria-label="Priority"
                        className="w-full"
                        triggerClassName={cn(
                          CREATE_SELECT_TRIGGER_CLS,
                          formPriority === 'low'    && '[&>span:first-child]:text-green-500',
                          formPriority === 'medium' && '[&>span:first-child]:text-blue-500',
                          formPriority === 'high'   && '[&>span:first-child]:text-orange-500',
                          formPriority === 'urgent' && '[&>span:first-child]:text-red-500',
                        )}
                      />
                    </div>
                    {formStoreId && formPlants.length > 0 && (
                      <div className="col-span-6 sm:col-span-3">
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Plant <span className="opacity-60">(opt.)</span></label>
                        <Select
                          value={formPlantId}
                          onChange={(v) => { setFormPlantId(v); setFormOutputLocationId('') }}
                          options={selectOptionsWithBlank('— No plant —', formPlants.map(p => ({ value: p.id, label: `${p.name}${p.code ? ` (${p.code})` : ''}` })))}
                          aria-label="Plant"
                          className="w-full"
                          triggerClassName={CREATE_SELECT_TRIGGER_CLS}
                        />
                      </div>
                    )}
                    {formPlantId && formLocations.length > 0 && (
                      <div className="col-span-6 sm:col-span-3">
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Output location</label>
                        <Select
                          value={formOutputLocationId}
                          onChange={setFormOutputLocationId}
                          options={selectOptionsWithBlank('— None —', formLocations.map(l => ({ value: l.id, label: l.name })))}
                          aria-label="Output storage location"
                          className="w-full"
                          triggerClassName={CREATE_SELECT_TRIGGER_CLS}
                        />
                      </div>
                    )}
                    <div className="col-span-6 sm:col-span-3">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Production Team</label>
                      <input value={formTeam} onChange={e => setFormTeam(e.target.value)} placeholder="e.g. Line A"
                        className={CREATE_INPUT_CLS} />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Target Completion</label>
                      <input type="date" value={formTargetDate} onChange={e => setFormTargetDate(e.target.value)}
                        className={CREATE_INPUT_CLS} />
                    </div>
                    {createType === 'mts' && (
                      <div className="col-span-12 sm:col-span-3">
                        <label className="block text-[10px] font-medium text-teal-800 mb-0.5">Target Stock (units)</label>
                        <input type="number" min={0} value={formTargetStock} onChange={e => setFormTargetStock(e.target.value)} placeholder="500"
                          className={`${CREATE_INPUT_CLS} focus:ring-teal-400/60`} />
                      </div>
                    )}
                  </div>

                  {/* MTO — customer row */}
                  {createType === 'mto' && (
                    <div className="grid grid-cols-12 gap-x-2 gap-y-1.5 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2">
                      <div
                        className={cn(
                          'col-span-12 sm:col-span-5 relative',
                          customerDropOpen && !selectedCustomerId && 'z-50',
                        )}
                      >
                        <label className="block text-[10px] font-medium text-indigo-800 mb-0.5">Customer</label>
                        <div className={`flex items-center ${CREATE_FIELD_H} border border-border rounded-md overflow-hidden bg-card focus-within:ring-1 focus-within:ring-indigo-400/60`}>
                          <Search className="w-3 h-3 text-muted-foreground ml-2 shrink-0 pointer-events-none" />
                          <input
                            value={customerSearch}
                            onChange={e => { setCustomerSearch(e.target.value); setCustomerDropOpen(true); setSelectedCustomerId('') }}
                            onFocus={() => { if (!selectedCustomerId) setCustomerDropOpen(true) }}
                            placeholder="Search name, phone, email…"
                            className="flex-1 px-1.5 text-sm outline-none bg-transparent min-w-0 h-full"
                          />
                          {selectedCustomerId && <CheckCircle className="w-3 h-3 text-green-500 mr-1.5 shrink-0" />}
                          {(customerSearch || selectedCustomerId) && (
                            <button
                              type="button"
                              aria-label="Clear"
                              onClick={() => {
                                setCustomerSearch('')
                                setSelectedCustomerId('')
                                setFormCustomerName('')
                                setFormCustomerPhone('')
                                setFormCustomerEmail('')
                                setCustomerDropOpen(false)
                              }}
                              className="pr-1.5"
                            >
                              <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                        {customerDropOpen && !selectedCustomerId && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                            {filteredCustomers.length > 0 ? filteredCustomers.map((c: { id: string; full_name: string; phone?: string; email?: string }) => (
                              <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                                className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b last:border-b-0 flex items-center gap-2.5">
                                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-indigo-600">{c.full_name?.[0]?.toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-800 truncate">{c.full_name}</p>
                                  <p className="text-xs text-gray-400 truncate">{c.phone || ''}{c.phone && c.email ? ' · ' : ''}{c.email || ''}</p>
                                </div>
                              </button>
                            )) : (
                              <div className="px-3 py-3 text-xs text-muted-foreground text-center">No customers found</div>
                            )}
                            <button type="button" onClick={() => { setCustomerDropOpen(false); setShowNewCustomer(true) }}
                              className="w-full text-left px-3 py-2.5 bg-indigo-50 text-indigo-700 text-xs font-medium flex items-center gap-2 hover:bg-indigo-100 transition-colors border-t">
                              <Plus className="w-3.5 h-3.5" /> Create new customer
                            </button>
                          </div>
                        )}
                        {customerDropOpen && !selectedCustomerId && (
                          <div className="fixed inset-0 z-40" onClick={() => setCustomerDropOpen(false)} />
                        )}
                        {selectedCustomerId && (
                          <div className="mt-1 flex items-center gap-1.5 bg-indigo-100/60 border border-indigo-200 rounded-md px-2 py-1">
                            <div className="w-5 h-5 bg-indigo-200 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-indigo-700">{formCustomerName?.[0]?.toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-indigo-900 truncate leading-none">{formCustomerName}</p>
                              {formCustomerPhone && <p className="text-[10px] text-indigo-600 truncate leading-none mt-0.5">{formCustomerPhone}</p>}
                            </div>
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          </div>
                        )}
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Sales Order Ref</label>
                        <input value={formOrderRef} onChange={e => setFormOrderRef(e.target.value)} placeholder="SO-12345"
                          className={`${CREATE_INPUT_CLS} font-mono focus:ring-indigo-400/60`} />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Delivery Deadline</label>
                        <input type="date" value={formDeadline} onChange={e => setFormDeadline(e.target.value)}
                          className={`${CREATE_INPUT_CLS} focus:ring-indigo-400/60`} />
                      </div>
                      <div className="col-span-12 sm:col-span-3">
                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Special Requirements</label>
                        <input value={formSpecialReq} onChange={e => setFormSpecialReq(e.target.value)} placeholder="Customisation notes…"
                          className={`${CREATE_INPUT_CLS} focus:ring-indigo-400/60`} />
                      </div>

                      {showNewCustomer && (
                        <div className="col-span-12 grid grid-cols-12 gap-x-2 gap-y-1 bg-card rounded-md border border-indigo-200 p-2">
                          <div className="col-span-12 sm:col-span-4">
                            <input value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="New customer name *"
                              className={CREATE_INPUT_CLS} />
                          </div>
                          <div className="col-span-6 sm:col-span-3"><PhoneInput value={newCustPhone} onChange={setNewCustPhone} defaultCountryIso="IN" /></div>
                          <div className="col-span-6 sm:col-span-3">
                            <input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} placeholder="Email"
                              className={CREATE_INPUT_CLS} />
                          </div>
                          <div className="col-span-12 sm:col-span-2 flex items-end gap-1">
                            <button type="button" onClick={createNewCustomer} disabled={createCustomer.isPending}
                              className={`flex-1 flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-2 ${CREATE_FIELD_H} rounded-md text-[11px] font-semibold disabled:opacity-50`}>
                              {createCustomer.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Add'}
                            </button>
                            <button type="button" onClick={() => setShowNewCustomer(false)} className={`px-2 ${CREATE_FIELD_H} text-[11px] border border-border rounded-md`}>✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items — full width so search/results never collide with Assign/Notes */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className="block text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                        <Hammer className="w-3 h-3" /> Items to Produce
                        <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      {formItems.length > 0 && (
                        <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
                          {formItems.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex gap-1.5 items-center">
                        <div className="flex-1 relative min-w-0">
                          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                          <input
                            value={itemSearch}
                            onChange={e => {
                              setItemSearch(e.target.value)
                              setCustomerDropOpen(false)
                              setAssigneeDropOpen(false)
                            }}
                            onFocus={() => {
                              setCustomerDropOpen(false)
                              setAssigneeDropOpen(false)
                            }}
                            placeholder="Search product or SKU…"
                            className={`w-full ${CREATE_FIELD_H} border border-border rounded-md pl-6 pr-6 text-sm focus:outline-none focus:ring-1 focus:ring-ring`}
                          />
                          {itemSearch && (
                            <button type="button" aria-label="Clear" onClick={() => setItemSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                              <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col items-center shrink-0 gap-0">
                          <span className="text-[9px] text-muted-foreground font-medium leading-none mb-0.5">Qty</span>
                          <input
                            type="number"
                            min={1}
                            value={itemQty}
                            onChange={e => setItemQty(e.target.value)}
                            title="Quantity to add"
                            className={`w-16 ${CREATE_FIELD_H} border border-border rounded-md px-2 text-sm text-center`}
                          />
                        </div>
                        <button type="button" onClick={() => setShowCameraScanner(true)} title="Scan"
                          className={`${CREATE_FIELD_H} w-8 flex items-center justify-center rounded-md border border-border bg-card hover:bg-accent shrink-0`}>
                          {scanLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ScanLine className="w-3 h-3" />}
                        </button>
                      </div>
                      {itemSearch.trim() && filteredProducts.length > 0 && (
                        <div className="border border-border rounded-md overflow-hidden max-h-28 overflow-y-auto bg-card">
                          {filteredProducts.map((p: any) => {
                            const activeVariants = (p.variants || []).filter((v: any) => v.is_active !== false)
                            const hasVariants = activeVariants.length > 0
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setCustomerDropOpen(false)
                                  setAssigneeDropOpen(false)
                                  if (hasVariants) {
                                    setVariantPickerSearch('')
                                    setVariantPickerProduct(p)
                                  } else {
                                    addItem({ id: p.id, name: p.name, sku: p.sku, type: 'product' })
                                  }
                                }}
                                className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent border-b last:border-b-0 flex items-center gap-1.5"
                              >
                                <span className="flex-1 font-medium truncate">{p.name}</span>
                                {hasVariants && (
                                  <span className="text-[10px] font-bold bg-primary/12 text-primary px-1 py-0.5 rounded-full shrink-0">
                                    {activeVariants.length} var
                                  </span>
                                )}
                                <Plus className="w-3 h-3 text-primary/70 shrink-0" />
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {formItems.length === 0 && !itemSearch && (
                      <div className="border border-dashed border-border rounded-md py-4 flex flex-col items-center justify-center gap-1 text-center">
                        <Hammer className="w-5 h-5 text-muted-foreground/30" />
                        <p className="text-[11px] text-muted-foreground">Search above and click a product to add items</p>
                      </div>
                    )}
                    {formItems.length > 0 && (
                      <div className="border border-border rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 border-b">
                            <tr className="text-[10px] font-medium text-muted-foreground uppercase">
                              <th className="py-1 px-2 text-left">Item</th>
                              <th className="py-1 px-2 text-right w-24">Qty</th>
                              <th className="py-1 w-8" />
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {formItems.map((item) => {
                              const rowKey = `${item.product_id}__${item.variant_id ?? ''}`
                              return (
                                <tr key={rowKey}>
                                  <td className="py-1.5 px-2 font-medium truncate max-w-[240px]">{item.name}</td>
                                  <td className="py-1.5 px-2 text-right">
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.qty}
                                      onChange={e => setFormItems(prev => prev.map(i =>
                                        i.product_id === item.product_id && (i.variant_id ?? '') === (item.variant_id ?? '')
                                          ? { ...i, qty: Number(e.target.value) }
                                          : i,
                                      ))}
                                      className={`w-16 ${CREATE_FIELD_H} border border-border rounded px-2 text-right text-sm ml-auto`}
                                    />
                                  </td>
                                  <td className="py-1.5 px-1">
                                    <button
                                      type="button"
                                      aria-label="Remove"
                                      onClick={() => setFormItems(prev => prev.filter(i =>
                                        !(i.product_id === item.product_id && (i.variant_id ?? '') === (item.variant_id ?? '')),
                                      ))}
                                    >
                                      <X className="w-3 h-3 text-red-400" />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Assign + Notes — separate row below items */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Assign To
                      </label>
                      <div className="flex gap-1.5 items-center">
                        <div className={`flex items-center bg-muted rounded-md p-0.5 shrink-0 ${CREATE_FIELD_H}`}>
                          <button type="button" onClick={() => setAssigneeTab('team')}
                            className={`px-2.5 h-full rounded text-xs font-medium min-w-[2.75rem] ${assigneeTab === 'team' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}>Emp</button>
                          <button type="button" onClick={() => setAssigneeTab('supplier')}
                            className={`px-2.5 h-full rounded text-xs font-medium min-w-[2.75rem] ${assigneeTab === 'supplier' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}>Vendor</button>
                        </div>
                        <div ref={assigneeAnchorRef} className="relative flex-1 min-w-0">
                          <input
                            value={assigneeSearch}
                            onChange={e => { setAssigneeSearch(e.target.value); openAssigneeDrop() }}
                            onFocus={() => openAssigneeDrop()}
                            placeholder="Search…"
                            className={`w-full ${CREATE_FIELD_H} border border-border rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring`}
                          />
                          {assigneeDropOpen && createPortal(
                            <>
                              {/* Backdrop — closes on outside click */}
                              <div className="fixed inset-0 z-[299]" onClick={() => setAssigneeDropOpen(false)} />
                              {/* Dropdown — always above modal */}
                              <div
                                className="fixed bg-card border border-border rounded-xl shadow-2xl z-[300] overflow-hidden"
                                style={{ ...assigneeDropStyle, maxHeight: '12rem' }}
                              >
                                {(assigneeTab === 'team' ? filteredTeam : filteredSuppliers).length === 0 ? (
                                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                                    {assigneeSearch.trim()
                                      ? `No ${assigneeTab === 'team' ? 'employees' : 'vendors'} match "${assigneeSearch}"`
                                      : `No ${assigneeTab === 'team' ? 'employees' : 'vendors'} found`}
                                  </div>
                                ) : (
                                  <div className="overflow-y-auto max-h-[12rem]">
                                    {(assigneeTab === 'team' ? filteredTeam : filteredSuppliers).map((m: { id: string; full_name?: string; name?: string; company_name?: string; contact_name?: string; role?: string; email?: string }) => {
                                      const displayName = assigneeTab === 'team'
                                        ? (m.full_name || m.name || '')
                                        : (m.company_name || m.contact_name || '')
                                      const subtitle = assigneeTab === 'team'
                                        ? (m.role || m.email || 'Team Member')
                                        : (m.contact_name || 'Vendor')
                                      return (
                                        <button
                                          key={m.id}
                                          type="button"
                                          onClick={() => addAssignee({
                                            id: m.id,
                                            name: displayName,
                                            role: m.role || (assigneeTab === 'team' ? 'Team Member' : 'Vendor'),
                                            type: assigneeTab,
                                          })}
                                          className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 flex items-center gap-2.5 transition-colors"
                                        >
                                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${assigneeTab === 'team' ? 'bg-primary/10 text-primary' : 'bg-blue-100 text-blue-700'}`}>
                                            {displayName?.[0]?.toUpperCase() || '?'}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold text-foreground truncate">{displayName || <span className="italic text-muted-foreground">No name</span>}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
                                          </div>
                                          <Plus className="w-3 h-3 text-primary/50 shrink-0" />
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </>,
                            document.body,
                          )}
                        </div>
                      </div>
                      {formAssignees.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {formAssignees.map(a => (
                            <div
                              key={a.id}
                              className={`flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full border text-xs font-medium ${
                                a.type === 'team'
                                  ? 'bg-primary/8 border-primary/25 text-primary'
                                  : 'bg-blue-50 border-blue-200 text-blue-800'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${a.type === 'team' ? 'bg-primary/20' : 'bg-blue-100'}`}>
                                {a.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <span className="truncate max-w-[90px]">{a.name || 'Unknown'}</span>
                              {a.role && a.role !== 'Team Member' && a.role !== 'Vendor' && (
                                <span className="opacity-60 text-[9px] hidden sm:inline">· {a.role}</span>
                              )}
                              <button
                                type="button"
                                aria-label={`Remove ${a.name}`}
                                onClick={() => removeAssignee(a.id)}
                                className="ml-0.5 rounded-full hover:bg-black/10 p-0.5 transition-colors shrink-0"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <label className="block text-[10px] font-medium text-muted-foreground">Notes &amp; Attachments</label>
                      <textarea
                        value={formNotes}
                        onChange={e => setFormNotes(e.target.value)}
                        placeholder="Instructions, production notes…"
                        rows={2}
                        className="w-full border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-snug"
                      />
                      <div className="flex items-center gap-1 flex-wrap">
                        {formAttachments.map((a, i) => (
                          <div key={i} className="flex items-center gap-0.5 bg-muted rounded px-1 py-0.5 text-[10px]">
                            <span className="truncate max-w-[60px]">{a.name}</span>
                            <button type="button" aria-label="Remove" onClick={() => setFormAttachments(prev => prev.filter((_, j) => j !== i))}><X className="w-2.5 h-2.5" /></button>
                          </div>
                        ))}
                        <label className="inline-flex items-center gap-1 cursor-pointer text-[10px] text-muted-foreground hover:text-foreground border border-dashed border-border rounded px-1.5 py-0.5">
                          <Paperclip className="w-3 h-3" /> Attach
                          <input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleAttachFile} className="hidden" />
                        </label>
                      </div>
                      <ImageLightboxSession
                        items={formLightboxItems}
                        openIndex={formAttachLightboxIndex}
                        onClose={() => setFormAttachLightboxIndex(null)}
                      />
                    </div>
                  </div>

                </ModalBody>
                <div className="relative z-[60] flex shrink-0 gap-2 border-t border-border bg-card px-3 py-2">
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setCreateType(null); resetForm() }}
                    className="btn-cancel flex-1 rounded-md border border-border py-1.5 text-sm font-medium text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitCreate}
                    disabled={createOrder.isPending}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-semibold text-white disabled:opacity-60 ${createType === 'mto' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-600 hover:bg-teal-700'}`}
                  >
                    {createOrder.isPending
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : createType === 'mto'
                        ? <ShoppingCart className="h-3.5 w-3.5" />
                        : <Package className="h-3.5 w-3.5" />
                    }
                    {createOrder.isPending ? 'Creating…' : `Create ${createType.toUpperCase()} Order`}
                  </button>
                </div>
              </>
            )}
          </ModalPanel>
        </ModalOverlay>
      )}

      {/* ── Variant Picker Modal (portaled above create modal) ───────────────── */}
      {variantPickerProduct && (
        <ModalOverlay
          onClose={() => { setVariantPickerProduct(null); setVariantPickerSearch('') }}
          className="z-[120] overflow-y-auto overscroll-contain bg-black/50 p-4"
        >
          <ModalPanel className="w-full max-w-sm max-h-[90vh] overflow-hidden rounded-xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm truncate">{variantPickerProduct.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Select a variant to add to the order</p>
              </div>
              <ModalCloseButton onClose={() => { setVariantPickerProduct(null); setVariantPickerSearch('') }} showEscHint={false} />
            </div>
            <div className="px-3 pt-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  autoFocus
                  value={variantPickerSearch}
                  onChange={e => setVariantPickerSearch(e.target.value)}
                  placeholder="Search variant name, SKU, barcode…"
                  className="w-full h-8 border border-border rounded-md pl-7 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="p-3 space-y-1 max-h-72 overflow-y-auto min-h-0 flex-1">
              {(() => {
                const q = variantPickerSearch.trim().toLowerCase()
                const variants = (variantPickerProduct.variants || [])
                  .filter((v: any) => v.is_active !== false)
                  .filter((v: any) => {
                    if (!q) return true
                    return (
                      (v.name || '').toLowerCase().includes(q) ||
                      (v.sku || '').toLowerCase().includes(q) ||
                      (v.barcode || '').toLowerCase().includes(q)
                    )
                  })
                  .slice(0, q ? 100 : 50)
                if (variants.length === 0) {
                  return <p className="text-xs text-muted-foreground text-center py-6">No variants match</p>
                }
                return variants.map((v: any) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      addItem({
                        id: variantPickerProduct.id,
                        name: variantPickerProduct.name,
                        sku: variantPickerProduct.sku,
                        type: 'product',
                        variant_id: v.id,
                        variant_name: v.name,
                        variant_sku: v.sku,
                        variant_barcode: v.barcode,
                      })
                      setVariantPickerProduct(null)
                      setVariantPickerSearch('')
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border hover:bg-accent hover:border-primary/30 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{v.name || variantPickerProduct.name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        {v.sku && <span className="mr-2">{v.sku}</span>}
                        {v.barcode && <span className="text-gray-300">{v.barcode}</span>}
                      </p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-xs text-muted-foreground">Stock: {v.quantity ?? '—'}</p>
                      <Plus className="w-3.5 h-3.5 text-primary/70 ml-auto mt-1" />
                    </div>
                  </button>
                ))
              })()}
            </div>
          </ModalPanel>
        </ModalOverlay>
      )}

      {/* ── Camera Barcode Scanner ───────────────────────────────────────────── */}
      <BarcodeScannerModal
        open={showCameraScanner}
        onScan={code => { setShowCameraScanner(false); handleBarcodeScan(code) }}
        onClose={() => setShowCameraScanner(false)}
        title="Scan Item Barcode"
      />

      {/* MRP Report Modal */}
      {mrpOrder && (
        <MRPReportModal
          orderId={mrpOrder.id}
          orderType="production_order"
          orderRef={mrpOrder.ref}
          items={mrpOrder.items
            .filter(i => i.item_type === 'product' && i.product_id)
            .map(i => ({ product_id: i.product_id, qty: i.qty, name: i.name }))}
          storeId={mrpOrder.store_id}
          autoManaged={!!mrpOrder.materials_reserved_at}
          onClose={() => setMrpOrder(null)}
        />
      )}
    </div>
  )
}

// ── ProductionOrderCard (with MRP button + reservation badge) ─────────────────

function ProductionOrderCard({
  order,
  totalDispatched,
  onSelect,
  onMRP,
}: {
  order: ProductionOrder
  totalDispatched: number
  onSelect: () => void
  onMRP: (e: React.MouseEvent) => void
}) {
  const productItems = order.items.filter(i => i.item_type === 'product' && i.product_id)
  const { data: reservationsRaw } = useOrderReservations('production_order', order.id)
  const reservations = (reservationsRaw || []) as Array<{ status: string }>
  const hasActiveReservations = reservations.some(r => r.status === 'active')

  return (
    <div
      className="w-full bg-card rounded-2xl border border-border transition-all hover:shadow-md hover:border-primary/30 cursor-pointer"
      onClick={onSelect}
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 p-2 rounded-xl ${order.type === 'mto' ? 'bg-indigo-100' : 'bg-teal-100'}`}>
            {order.type === 'mto' ? <ShoppingCart className="w-4 h-4 text-indigo-600" /> : <Package className="w-4 h-4 text-teal-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 font-mono text-sm">{order.ref}</span>
              <TypeBadge type={order.type} />
              <StatusBadge status={order.status} />
              {order.priority === 'urgent' && (
                <span className="text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">🔴 URGENT</span>
              )}
              {hasActiveReservations && (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                  <Lock className="w-2.5 h-2.5" /> Stock Reserved
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {order.type === 'mto'
                ? `Customer: ${order.customer_name || '—'} · Order: ${order.order_ref || '—'}`
                : `Stock replenishment · Target: ${order.target_stock_level ?? '—'} units`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''} · Team: {order.team || '—'} · Target: {order.target_date}
            </p>
            <div className="mt-2">
              <ProgressBar value={order.progress} status={order.status} />
            </div>
            {totalDispatched > 0 && (
              <p className="text-xs text-green-600 font-semibold mt-1 flex items-center gap-1">
                <PackagePlus className="w-3 h-3" /> {totalDispatched} units sent to stock
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {productItems.length > 0 && (
              <button
                onClick={onMRP}
                title="Material Requirement Plan"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-muted/70 dark:hover:text-foreground"
              >
                <BarChart3 className="w-3.5 h-3.5" /> MRP
              </button>
            )}
            <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
          </div>
        </div>
      </div>
    </div>
  )
}
