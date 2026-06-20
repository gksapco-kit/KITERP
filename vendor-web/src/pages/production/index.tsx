import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { ModalEscapeHandler } from '@/components/ui/ModalEscapeHandler'
import { useNavigate } from 'react-router-dom'
import { ResizableTable } from '@/components/table/ResizableTable'
import { useVendorStore } from '@/stores/vendorStore'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Factory, Plus, Search, X, ChevronDown, Filter,
  Truck, Package, Users, Calendar, CheckCircle, Clock,
  AlertCircle, Download, FileText, Hammer, Settings2,
  ArrowUpRight, Layers, CircleDot, RefreshCw,
  ShoppingCart, User, Paperclip, ClipboardList,
  PlayCircle, PauseCircle, CheckSquare, Trash2,
  ChevronRight, BadgeAlert, BadgeCheck, PackagePlus,
  BarChart3, Edit2, Eye, Lock, ScanLine, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ClickableImageButton,
  ImageLightboxSession,
  urlsToLightboxItems,
} from '@/components/common/ImageAttachmentLightbox'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useProducts, useServices, useCustomers, useCreateCustomer, useTeamMembers, useSuppliers, useOrderReservations } from '@/hooks/useVendor'
import {
  useProductionOrders,
  useProductionOrder,
  useCreateProductionOrder,
  useUpdateProductionOrder,
  useDeleteProductionOrder,
  useProductionOrdersBootstrap,
} from '@/hooks/useProductionOrders'
import { MRPReportModal } from '@/components/mrp/MRPReportModal'
import { vendorApi } from '@/api/vendor'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { BarcodeScannerModal } from '@/components/scanner/BarcodeScannerModal'

// ─── Types ──────────────────────────────────────────────────────────────────
type POType = 'mto' | 'mts'
type POStatus = 'draft' | 'confirmed' | 'in_production' | 'qc' | 'completed' | 'on_hold' | 'cancelled'
type Priority = 'low' | 'medium' | 'high' | 'urgent'

interface POItem {
  product_id: string
  variant_id?: string
  variant_name?: string
  variant_sku?: string
  variant_barcode?: string
  item_type: 'product' | 'service'
  name: string
  sku?: string
  qty: number
  produced?: number
  priority: Priority
}

interface Assignee {
  id: string
  name: string
  role: string
  type: 'team' | 'supplier'
}

interface StockDispatch {
  id: string; date: string; qty: number; notes: string; by: string
}

interface Attachment {
  name: string; dataUrl: string; type: string; size: number
}

type AuditAction =
  | 'created'
  | 'status_changed'
  | 'progress_updated'
  | 'assignees_updated'
  | 'notes_updated'
  | 'stock_dispatched'
  | 'file_attached'
  | 'file_removed'
  | 'item_added'
  | 'priority_changed'

interface AuditEvent {
  id: string
  action: AuditAction
  actor: string
  timestamp: string
  detail: string
  meta?: Record<string, string | number>
}

interface ProductionOrder {
  id: string
  store_id?: string | null
  ref: string
  type: POType
  template: string
  status: POStatus
  progress: number
  priority: Priority
  items: POItem[]
  // MTO specific
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  order_ref?: string
  delivery_deadline?: string
  special_requirements?: string
  // MTS specific
  target_stock_level?: number
  // Common
  assignees: Assignee[]
  team: string
  target_date: string
  notes: string
  attachments: Attachment[]
  stock_dispatches: StockDispatch[]
  audit_log: AuditEvent[]
  created_at: string
  updated_at: string
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 'standard',  label: 'Standard',  emoji: '🏭', desc: 'Regular batch production' },
  { id: 'urgent',    label: 'Urgent',    emoji: '🔴', desc: 'Fast-track, priority queue' },
  { id: 'batch',     label: 'Batch',     emoji: '📦', desc: 'Multiple batches, same product' },
  { id: 'rework',    label: 'Rework',    emoji: '🔧', desc: 'Fix defective units' },
  { id: 'assembly',  label: 'Assembly',  emoji: '⚙️', desc: 'Assemble from components' },
  { id: 'custom',    label: 'Custom',    emoji: '✏️', desc: 'Custom requirements' },
]

const STATUS_CONFIG: Record<POStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:         { label: 'Draft',        color: 'text-gray-600 dark:text-gray-300',   bg: 'bg-gray-100 dark:bg-gray-800',    icon: CircleDot },
  confirmed:     { label: 'Confirmed',    color: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-100 dark:bg-blue-950/50',    icon: CheckSquare },
  in_production: { label: 'In Production',color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-100 dark:bg-amber-950/50',   icon: Factory },
  qc:            { label: 'QC Check',     color: 'text-primary', bg: 'bg-primary/10',  icon: BadgeAlert },
  completed:     { label: 'Completed',    color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-100 dark:bg-green-950/50',   icon: CheckCircle },
  on_hold:       { label: 'On Hold',      color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-950/50',  icon: PauseCircle },
  cancelled:     { label: 'Cancelled',    color: 'text-red-700 dark:text-red-300',    bg: 'bg-red-100 dark:bg-red-950/50',     icon: X },
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  low:    { label: 'Low',    color: 'text-muted-foreground',   dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'text-blue-600',   dot: 'bg-blue-400' },
  high:   { label: 'High',   color: 'text-orange-600', dot: 'bg-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-600',    dot: 'bg-red-500' },
}

const WORKFLOW_STEPS: { status: POStatus; label: string }[] = [
  { status: 'draft',         label: 'Draft' },
  { status: 'confirmed',     label: 'Confirmed' },
  { status: 'in_production', label: 'In Production' },
  { status: 'qc',            label: 'QC Check' },
  { status: 'completed',     label: 'Completed' },
]

function genRef(type: POType) {
  return `${type.toUpperCase()}-${Date.now().toString().slice(-6)}`
}

function makeAudit(action: AuditAction, detail: string, meta?: Record<string, string | number>): AuditEvent {
  return { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), action, actor: 'You', timestamp: new Date().toISOString(), detail, meta }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: POStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  )
}

function TypeBadge({ type }: { type: POType }) {
  return type === 'mto'
    ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800"><ShoppingCart className="w-3 h-3" /> MTO</span>
    : <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800"><Package className="w-3 h-3" /> MTS</span>
}

function PriorityDot({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} /> {cfg.label}
    </span>
  )
}

function ProgressBar({ value, status }: { value: number; status: POStatus }) {
  const color = status === 'completed' ? 'bg-green-500' : status === 'on_hold' ? 'bg-orange-400' : status === 'cancelled' ? 'bg-red-400' : 'bg-primary'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-7 text-right">{value}%</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProductionOrdersPage() {
  const navigate = useNavigate()
  const { vendor, selectedStore } = useVendorStore()
  const storeId = selectedStore?.id
  useProductionOrdersBootstrap()

  // Business unit selected in the create form (scopes the catalog below).
  const [formStoreId, setFormStoreId] = useState('')
  const { data: productsData }  = useProducts({ page: 1, size: 200, store_id: formStoreId || undefined })
  const { data: servicesData }  = useServices({ page: 1, size: 200, store_id: formStoreId || undefined })
  const { data: customersData } = useCustomers({ size: 200 })
  const { data: teamData }      = useTeamMembers({ size: 100 })
  const { data: suppliersData } = useSuppliers({ size: 100 })
  const createCustomer          = useCreateCustomer()

  const listParams = useMemo(() => ({
    ...(storeId ? { store_id: storeId } : {}),
  }), [storeId])

  const { data: ordersRaw = [], isLoading: ordersLoading } = useProductionOrders(listParams)
  const createOrder = useCreateProductionOrder()
  const updateOrderMut = useUpdateProductionOrder()
  const deleteOrderMut = useDeleteProductionOrder()

  const orders = ordersRaw as ProductionOrder[]

  const products  = productsData?.items  || []
  const services  = servicesData?.items  || []
  const customers = customersData?.items || []
  const teamMembers = teamData?.items    || []
  const suppliers = suppliersData?.items || []
  const [search, setSearch]             = useState('')
  const [typeFilter, setTypeFilter]     = useState<'all' | POType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | POStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all')
  const [viewOrderId, setViewOrderId]   = useState<string | null>(null)
  const { data: viewOrderDetail } = useProductionOrder(viewOrderId)
  const viewOrder = (viewOrderDetail ?? orders.find(o => o.id === viewOrderId) ?? null) as ProductionOrder | null

  const detailImageAttachments = useMemo(
    () => (viewOrder?.attachments ?? []).filter((a) => a.type.startsWith('image/')),
    [viewOrder?.attachments],
  )
  const detailLightboxItems = useMemo(
    () => urlsToLightboxItems(
      detailImageAttachments.map((a) => a.dataUrl),
      { idPrefix: 'prod-detail', altText: (i) => detailImageAttachments[i]?.name ?? `Attachment ${i + 1}` },
    ),
    [detailImageAttachments],
  )

  useEffect(() => {
    setViewOrderId(null)
  }, [storeId])
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
  const [detailAttachLightboxIndex, setDetailAttachLightboxIndex] = useState<number | null>(null)
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
  // Barcode scanner
  const [showCameraScanner,   setShowCameraScanner]   = useState(false)
  const [scanLoading,         setScanLoading]         = useState(false)
  // Assignee picker
  const [assigneeSearch,      setAssigneeSearch]      = useState('')
  const [assigneeDropOpen,    setAssigneeDropOpen]    = useState(false)
  const [assigneeTab,         setAssigneeTab]         = useState<'team' | 'supplier'>('team')
  const [formAssignees,       setFormAssignees]       = useState<Assignee[]>([])

  // Detail pane state
  const [detailTab,        setDetailTab]        = useState<'details' | 'items' | 'stock' | 'history'>('details')
  const [dispatchQty,      setDispatchQty]      = useState('')
  const [dispatchBy,       setDispatchBy]       = useState('')
  const [dispatchNotes,    setDispatchNotes]    = useState('')
  const [editStatus,       setEditStatus]       = useState<POStatus | ''>('')
  const [editProgress,     setEditProgress]     = useState(0)

  // Inline edit — assignees & notes in the detail pane
  const [editAssigneesMode,    setEditAssigneesMode]    = useState(false)
  const [detailEditAssignees,  setDetailEditAssignees]  = useState<Assignee[]>([])
  const [detailAssigneeSearch, setDetailAssigneeSearch] = useState('')
  const [detailAssigneeDropOpen, setDetailAssigneeDropOpen] = useState(false)
  const [detailAssigneeTab,    setDetailAssigneeTab]    = useState<'team' | 'supplier'>('team')
  const [editNotesMode,        setEditNotesMode]        = useState(false)
  const [detailEditNotes,      setDetailEditNotes]      = useState('')

  const closeCreateModal = useCallback(() => {
    setShowCreate(false)
    setCreateType(null)
  }, [])

  // Background handlers — disabled while the create modal is open so Esc closes the modal.
  useEscapeToClose(() => setDetailAssigneeDropOpen(false), detailAssigneeDropOpen && !showCreate)
  useEscapeToClose(() => setVariantPickerProduct(null), !!variantPickerProduct)
  useEscapeToClose(() => setShowNewCustomer(false), showNewCustomer)
  useEscapeToClose(() => setMrpOrder(null), !!mrpOrder)
  // Create modal — register before inner dropdowns so nested pickers close first on Esc.
  useEscapeToClose(closeCreateModal, showCreate)
  useEscapeToClose(() => setCustomerDropOpen(false), customerDropOpen && showCreate)
  useEscapeToClose(() => setAssigneeDropOpen(false), assigneeDropOpen && showCreate)

  const filteredDetailTeam = useMemo(() => {
    if (!detailAssigneeSearch.trim()) return teamMembers.slice(0, 10)
    const q = detailAssigneeSearch.toLowerCase()
    return teamMembers.filter((m: any) =>
      m.full_name?.toLowerCase().includes(q) || m.role?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q),
    ).slice(0, 10)
  }, [teamMembers, detailAssigneeSearch])

  const filteredDetailSuppliers = useMemo(() => {
    if (!detailAssigneeSearch.trim()) return suppliers.slice(0, 10)
    const q = detailAssigneeSearch.toLowerCase()
    return suppliers.filter((s: { company_name?: string; contact_name?: string; id: string }) =>
      s.company_name?.toLowerCase().includes(q) || s.contact_name?.toLowerCase().includes(q),
    ).slice(0, 10)
  }, [suppliers, detailAssigneeSearch])

  function openAssigneeEdit(order: ProductionOrder) {
    setDetailEditAssignees(order.assignees ? [...order.assignees] : [])
    setDetailAssigneeSearch('')
    setDetailAssigneeDropOpen(false)
    setDetailAssigneeTab('team')
    setEditAssigneesMode(true)
  }

  function addDetailAssignee(a: Assignee) {
    if (detailEditAssignees.some(x => x.id === a.id)) { toast.info('Already assigned.'); return }
    setDetailEditAssignees(prev => [...prev, a])
    setDetailAssigneeSearch('')
    setDetailAssigneeDropOpen(false)
  }

  function removeDetailAssignee(id: string) {
    setDetailEditAssignees(prev => prev.filter(a => a.id !== id))
  }

  function saveAssigneeEdit(order: ProductionOrder) {
    const names = detailEditAssignees.map(a => a.name).join(', ') || 'None'
    updateOrder(
      order.id,
      { assignees: detailEditAssignees },
      makeAudit('assignees_updated', `Assigned to: ${names}`, { count: detailEditAssignees.length }),
    )
    setEditAssigneesMode(false)
    toast.success('Assignees updated.')
  }

  function openNotesEdit(order: ProductionOrder) {
    setDetailEditNotes(order.notes || '')
    setEditNotesMode(true)
  }

  function saveNotesEdit(order: ProductionOrder) {
    const action = order.notes ? 'notes_updated' : 'notes_updated'
    const preview = detailEditNotes.trim().slice(0, 60) + (detailEditNotes.trim().length > 60 ? '…' : '')
    updateOrder(
      order.id,
      { notes: detailEditNotes },
      makeAudit(action, `Instructions updated: "${preview || '(cleared)'}"`)
    )
    setEditNotesMode(false)
    toast.success('Notes updated.')
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

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
      store_id: formStoreId || storeId || null,
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
          setViewOrderId(String(row.id))
          setDetailTab('details')
        }
      },
    })
  }

  // ── Detail helpers ───────────────────────────────────────────────────────
  function updateOrder(id: string, patch: Partial<ProductionOrder>, auditEvent?: AuditEvent) {
    const data: Record<string, unknown> = { ...patch }
    if (auditEvent) data.audit_event = auditEvent
    updateOrderMut.mutate({ id, data })
  }

  function deleteOrder(id: string) {
    deleteOrderMut.mutate(id, {
      onSuccess: () => setViewOrderId(null),
    })
  }

  function advanceStatus(order: ProductionOrder) {
    const idx = WORKFLOW_STEPS.findIndex(s => s.status === order.status)
    if (idx === -1 || idx >= WORKFLOW_STEPS.length - 1) return
    const nextStatus = WORKFLOW_STEPS[idx + 1].status
    const autoProgress = ({ draft: 0, confirmed: 10, in_production: 40, qc: 90, completed: 100, cancelled: 0, on_hold: order.progress } as Record<string, number>)[nextStatus] ?? order.progress
    updateOrder(
      order.id,
      { status: nextStatus, progress: autoProgress },
      makeAudit('status_changed', `Status changed from ${STATUS_CONFIG[order.status].label} → ${STATUS_CONFIG[nextStatus].label}`, { from: order.status, to: nextStatus, progress: autoProgress }),
    )
    toast.success(`Order ${order.ref} moved to ${STATUS_CONFIG[nextStatus].label}`)
  }

  function addStockDispatch(order: ProductionOrder) {
    if (!dispatchQty || Number(dispatchQty) <= 0) { toast.error('Enter a valid qty.'); return }
    const dispatch: StockDispatch = {
      id: Date.now().toString(), date: new Date().toISOString().slice(0, 10),
      qty: Number(dispatchQty), notes: dispatchNotes, by: dispatchBy,
    }
    const newDispatches = [...order.stock_dispatches, dispatch]
    const totalDispatched = newDispatches.reduce((s, d) => s + d.qty, 0)
    const totalRequired = order.items.reduce((s, i) => s + i.qty, 0)
    const newProgress = Math.min(100, Math.round((totalDispatched / totalRequired) * 100))
    const autoComplete = totalDispatched >= totalRequired && order.status !== 'completed'
    updateOrder(
      order.id,
      {
        stock_dispatches: newDispatches,
        progress: Math.max(order.progress, newProgress),
        status: autoComplete ? 'completed' : order.status,
      },
      makeAudit('stock_dispatched',
        `${dispatch.qty} unit${dispatch.qty !== 1 ? 's' : ''} dispatched to stock${dispatchBy ? ` by ${dispatchBy}` : ''}${dispatchNotes ? ` — ${dispatchNotes}` : ''}`,
        { qty: dispatch.qty, total_dispatched: totalDispatched, total_required: totalRequired },
      ),
    )
    setDispatchQty(''); setDispatchBy(''); setDispatchNotes('')
    toast.success(`${dispatch.qty} units dispatched to stock.`)
  }

  function applyStatusEdit(order: ProductionOrder) {
    if (!editStatus) return
    const newProgress = editProgress || order.progress
    const statusChanged = editStatus !== order.status
    const progressChanged = newProgress !== order.progress
    const detail = [
      statusChanged && `Status: ${STATUS_CONFIG[order.status].label} → ${STATUS_CONFIG[editStatus as POStatus].label}`,
      progressChanged && `Progress: ${order.progress}% → ${newProgress}%`,
    ].filter(Boolean).join(', ')
    updateOrder(
      order.id,
      { status: editStatus, progress: newProgress },
      makeAudit('status_changed', detail || 'Status/progress reviewed', { from: order.status, to: editStatus, progress: newProgress }),
    )
    setEditStatus('')
    toast.success('Status updated.')
  }

  function exportXLS(order: ProductionOrder) {
    const rows = order.items.map(i => [order.ref, order.type.toUpperCase(), i.name, i.qty, i.produced ?? 0, order.status, order.team, order.target_date])
    const tableHtml = [
      '<table border="1">',
      `<tr>${['Ref','Type','Product','Qty','Produced','Status','Team','Target Date'].map(h => `<th>${h}</th>`).join('')}</tr>`,
      ...rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`),
      '</table>',
    ].join('')
    const blob = new Blob([`\uFEFF<html><head><meta charset="UTF-8"></head><body>${tableHtml}</body></html>`], { type: 'application/vnd.ms-excel;charset=UTF-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${order.ref}-production.xls`; a.click()
    URL.revokeObjectURL(url)
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
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 flex-1 min-w-[180px] max-w-sm shadow-sm max-h-[90vh] overflow-y-auto">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ref, product, customer…"
              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400" />
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

        {/* ── Main content: list + detail panel ──────────────────────────── */}
        <div className={`flex gap-4 ${viewOrderId ? 'items-start' : ''}`}>

          {/* List */}
          <div className={`${viewOrderId ? 'hidden lg:block lg:w-[44%] shrink-0' : 'w-full'} space-y-2`}>
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
              const isActive = viewOrder?.id === order.id
              return (
                <ProductionOrderCard
                  key={order.id}
                  order={order}
                  isActive={isActive}
                  totalDispatched={totalDispatched}
                  onSelect={() => { setViewOrderId(order.id); setDetailTab('details'); setEditStatus('') }}
                  onMRP={e => { e.stopPropagation(); setMrpOrder(order) }}
                />
              )
            })}
          </div>

          {/* Detail panel */}
          {viewOrder && (() => {
            const order = orders.find(o => o.id === viewOrder.id) || viewOrder
            const totalRequired = order.items.reduce((s, i) => s + i.qty, 0)
            const totalDispatched = order.stock_dispatches.reduce((s, d) => s + d.qty, 0)
            const curStepIdx = WORKFLOW_STEPS.findIndex(s => s.status === order.status)

            return (
              <div className="flex-1 bg-card rounded-2xl border border-border shadow-sm overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Panel header */}
                <div className={`px-5 py-4 border-b flex items-start gap-3 ${order.type === 'mto' ? 'bg-indigo-50' : 'bg-teal-50'}`}>
                  <div className={`p-2 rounded-xl ${order.type === 'mto' ? 'bg-indigo-100' : 'bg-teal-100'}`}>
                    {order.type === 'mto' ? <ShoppingCart className={`w-5 h-5 text-indigo-600`} /> : <Package className={`w-5 h-5 text-teal-600`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-gray-900 font-mono">{order.ref}</h2>
                      <TypeBadge type={order.type} />
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(order.created_at).toLocaleDateString('en-IN')} · Template: {order.template}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setMrpOrder(order)} title="Material Requirement Plan"
                      className="flex items-center gap-1 rounded-lg p-1.5 px-2 text-xs font-medium text-primary transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-muted/70 dark:hover:text-foreground">
                      <BarChart3 className="w-3.5 h-3.5" /> MRP
                    </button>
                    <button onClick={() => exportXLS(order)} title="Export Excel"
                      className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground transition-colors"><Download className="w-4 h-4" /></button>
                    <button onClick={() => deleteOrder(order.id)} title="Delete"
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    <button type="button" aria-label="Close" onClick={() => setViewOrderId(null)}
                      className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground transition-colors">
                <X className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Workflow stepper */}
                <div className="px-5 py-3 border-b border-border bg-card overflow-x-auto">
                  <div className="flex items-center gap-0 min-w-max">
                    {WORKFLOW_STEPS.map((step, i) => {
                      const done = i < curStepIdx
                      const active = i === curStepIdx
                      const cancelled = order.status === 'cancelled'
                      return (
                        <div key={step.status} className="flex items-center">
                          <div className="flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                              cancelled ? 'border-red-300 bg-red-50 text-red-400' :
                              done ? 'border-green-500 bg-green-500 text-white' :
                              active ? 'border-primary bg-primary text-white' :
                              'border-border bg-card text-muted-foreground'
                            }`}>
                              {done ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">{i + 1}</span>}
                            </div>
                            <p className={`text-xs font-medium mt-1 ${active ? 'text-primary' : done ? 'text-green-700' : 'text-gray-400'}`}>{step.label}</p>
                          </div>
                          {i < WORKFLOW_STEPS.length - 1 && (
                            <div className={`w-8 sm:w-12 h-0.5 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b bg-gray-50/60">
                  {(['details', 'items', 'stock', 'history'] as const).map(tab => (
                    <button key={tab} onClick={() => setDetailTab(tab)}
                      className={`flex-1 text-xs font-medium py-2.5 capitalize transition-all border-b-2 ${detailTab === tab ? 'border-primary text-primary bg-card' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                      {tab === 'stock' ? 'Stock Dispatch' : tab === 'history' ? 'Attachments' : tab}
                    </button>
                  ))}
                </div>

                <div className="p-5 space-y-4 max-h-[calc(100vh-22rem)] overflow-y-auto">

                  {/* DETAILS tab */}
                  {detailTab === 'details' && (
                    <div className="space-y-4">
                      {/* Progress + Status edit */}
                      <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600">Production Progress</span>
                            <span className="text-xs font-bold text-primary">{order.progress}%</span>
                          </div>
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${order.status === 'completed' ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${order.progress}%` }} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {order.status !== 'completed' && order.status !== 'cancelled' && curStepIdx < WORKFLOW_STEPS.length - 1 && (
                            <button onClick={() => advanceStatus(order)}
                              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                              <PlayCircle className="w-3.5 h-3.5" /> Advance to {WORKFLOW_STEPS[curStepIdx + 1]?.label}
                            </button>
                          )}
                          <button onClick={() => { setEditStatus(order.status); setEditProgress(order.progress) }}
                            className="flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            <Edit2 className="w-3 h-3" /> Edit Status / Progress
                          </button>
                        </div>
                        {editStatus !== '' && (
                          <div className="space-y-2 pt-2 border-t">
                            <div className="flex gap-2">
                              <Select
                                value={editStatus}
                                onChange={(v) => setEditStatus(v as POStatus)}
                                options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                                aria-label="Production order status"
                                className="flex-1"
                              />
                              <input type="number" min={0} max={100} value={editProgress} onChange={e => setEditProgress(Number(e.target.value))}
                                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Progress%" />
                              <button onClick={() => applyStatusEdit(order)} className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90">Save</button>
                              <button onClick={() => setEditStatus('')} className="px-2 py-1.5 text-muted-foreground hover:bg-gray-100 rounded-lg text-xs">✕</button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-gray-50 rounded-xl p-3"><p className="text-muted-foreground mb-1">Priority</p><PriorityDot priority={order.priority} /></div>
                        <div className="bg-gray-50 rounded-xl p-3"><p className="text-muted-foreground mb-1">Team</p><p className="font-semibold">{order.team || '—'}</p></div>
                        <div className="bg-gray-50 rounded-xl p-3"><p className="text-muted-foreground mb-1">Target Date</p><p className="font-semibold">{order.target_date}</p></div>
                        <div className="bg-gray-50 rounded-xl p-3"><p className="text-muted-foreground mb-1">Template</p><p className="font-semibold">{order.template}</p></div>
                      </div>

                      {order.type === 'mto' ? (
                        <div className="bg-indigo-50 rounded-2xl p-4 space-y-2 text-xs">
                          <p className="font-bold text-indigo-800 flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5" /> Customer / Order Details</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-indigo-500 mb-0.5">Customer</p>
                              <p className="font-semibold">{order.customer_name || '—'}</p>
                              {order.customer_id && <p className="font-mono text-xs text-indigo-400 mt-0.5">{order.customer_id}</p>}
                            </div>
                            <div>
                              <p className="text-indigo-500 mb-0.5">Phone / Email</p>
                              <p className="font-semibold">{order.customer_phone || '—'}</p>
                              {order.customer_email && <p className="text-indigo-600 mt-0.5">{order.customer_email}</p>}
                            </div>
                            <div><p className="text-indigo-500 mb-0.5">Sales Order Ref</p><p className="font-mono font-semibold">{order.order_ref || '—'}</p></div>
                            <div><p className="text-indigo-500 mb-0.5">Delivery Deadline</p><p className="font-semibold">{order.delivery_deadline || '—'}</p></div>
                          </div>
                          {order.special_requirements && (
                            <div><p className="text-indigo-500 mb-0.5">Special Requirements</p><p className="font-medium text-indigo-800">{order.special_requirements}</p></div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-teal-50 rounded-2xl p-4 space-y-2 text-xs">
                          <p className="font-bold text-teal-800 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Stock Replenishment Details</p>
                          <div className="grid grid-cols-3 gap-3">
                            <div><p className="text-teal-500 mb-0.5">Target Stock Level</p><p className="font-bold text-teal-800 text-base">{order.target_stock_level ?? '—'}</p></div>
                            <div><p className="text-teal-500 mb-0.5">Total to Produce</p><p className="font-bold text-teal-800 text-base">{totalRequired}</p></div>
                            <div><p className="text-teal-500 mb-0.5">Sent to Stock</p><p className="font-bold text-green-700 text-base">{totalDispatched}</p></div>
                          </div>
                        </div>
                      )}

                      {/* Assignees — inline editable */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" /> Assigned To
                          </p>
                          {!editAssigneesMode && (
                            <button
                              onClick={() => openAssigneeEdit(order)}
                              className="flex items-center gap-1 text-xs text-primary hover:text-primary hover:bg-accent px-2 py-1 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                          )}
                        </div>

                        {editAssigneesMode ? (
                          <div className="space-y-2 bg-accent border border-primary/30 rounded-xl p-3">
                            {/* Assignee tab + search */}
                            <div className="flex gap-1 mb-1">
                              {(['team', 'supplier'] as const).map(tab => (
                                <button key={tab} onClick={() => setDetailAssigneeTab(tab)}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${detailAssigneeTab === tab ? 'bg-primary text-white' : 'bg-card text-muted-foreground border border-border hover:bg-accent'}`}>
                                  {tab === 'team' ? '👤 Team' : '🚚 Supplier'}
                                </button>
                              ))}
                            </div>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                              <input
                                value={detailAssigneeSearch}
                                onChange={e => { setDetailAssigneeSearch(e.target.value); setDetailAssigneeDropOpen(true) }}
                                onFocus={() => setDetailAssigneeDropOpen(true)}
                                placeholder={detailAssigneeTab === 'team' ? 'Search team member…' : 'Search supplier / vendor…'}
                                className="w-full border border-border rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                              />
                              {detailAssigneeDropOpen && (detailAssigneeTab === 'team' ? filteredDetailTeam : filteredDetailSuppliers).length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden max-h-44 overflow-y-auto">
                                  {(detailAssigneeTab === 'team' ? filteredDetailTeam : filteredDetailSuppliers).map((m: any) => (
                                    <button key={m.id}
                                      onClick={() => addDetailAssignee({
                                        id: m.id,
                                        name: detailAssigneeTab === 'team' ? (m.full_name || '') : (m.company_name || ''),
                                        role: m.role || (detailAssigneeTab === 'team' ? 'Team Member' : 'Vendor'),
                                        type: detailAssigneeTab,
                                      })}
                                      className="w-full text-left px-3 py-2.5 hover:bg-accent border-b last:border-b-0 flex items-center gap-2.5 text-sm">
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${detailAssigneeTab === 'team' ? 'bg-primary/12 text-primary' : 'bg-blue-100 text-blue-600'}`}>
                                        {(detailAssigneeTab === 'team' ? m.full_name : m.company_name)?.[0]?.toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="font-medium">{detailAssigneeTab === 'team' ? m.full_name : m.company_name}</p>
                                        <p className="text-xs text-gray-400">{m.role || m.email}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {detailAssigneeDropOpen && <div className="fixed inset-0 z-20" onClick={() => setDetailAssigneeDropOpen(false)} />}
                            </div>

                            {/* Selected assignees */}
                            {detailEditAssignees.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {detailEditAssignees.map(a => (
                                  <div key={a.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium ${a.type === 'team' ? 'bg-primary/12 text-primary' : 'bg-blue-100 text-blue-800'}`}>
                                    {a.type === 'team' ? <User className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                                    {a.name} <span className="opacity-60 text-xs">({a.role})</span>
                                    <button type="button" aria-label="Close" onClick={() => removeDetailAssignee(a.id)} className="ml-0.5 opacity-60 hover:opacity-100">
                <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {detailEditAssignees.length === 0 && (
                              <p className="text-xs text-gray-400 italic">No assignees — search above to add one.</p>
                            )}

                            <div className="flex gap-2 pt-1">
                              <button onClick={() => saveAssigneeEdit(order)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors">
                                <Check className="w-3.5 h-3.5" /> Save
                              </button>
                              <button onClick={() => setEditAssigneesMode(false)}
                                className="btn-cancel px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {order.assignees && order.assignees.length > 0 ? order.assignees.map(a => (
                              <div key={a.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium ${a.type === 'team' ? 'bg-primary/12 text-primary' : 'bg-blue-100 text-blue-800'}`}>
                                {a.type === 'team' ? <User className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                                {a.name} <span className="opacity-60">({a.role})</span>
                              </div>
                            )) : (
                              <p className="text-xs text-gray-400 italic">None assigned</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Instructions / Notes — inline editable */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-muted-foreground font-semibold">Instructions / Notes</p>
                          {!editNotesMode && (
                            <button
                              onClick={() => openNotesEdit(order)}
                              className="flex items-center gap-1 text-xs text-primary hover:text-primary hover:bg-accent px-2 py-1 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3 h-3" /> {order.notes ? 'Edit' : 'Add Note'}
                            </button>
                          )}
                        </div>

                        {editNotesMode ? (
                          <div className="space-y-2">
                            <textarea
                              value={detailEditNotes}
                              onChange={e => setDetailEditNotes(e.target.value)}
                              rows={3}
                              placeholder="Production instructions, quality requirements, safety notes…"
                              className="w-full border border-primary/40 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button onClick={() => saveNotesEdit(order)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors">
                                <Check className="w-3.5 h-3.5" /> Save
                              </button>
                              <button onClick={() => setEditNotesMode(false)}
                                className="btn-cancel px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : order.notes ? (
                          <p className="text-xs text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{order.notes}</p>
                        ) : (
                          <p className="text-xs text-gray-400 italic bg-gray-50 rounded-xl p-3">No instructions added yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ITEMS tab */}
                  {detailTab === 'items' && (
                    <div className="space-y-3">
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <ResizableTable tableId="production-bom" defaultWidths={[40, 200, 120, 80, 90, 90, 80]}>
                          <thead className="bg-gray-50 border-b"><tr className="text-xs font-medium text-muted-foreground uppercase">
                            <th className="py-2 px-3 text-center w-8"><TableColumnLabel>#</TableColumnLabel></th>
                            <th className="py-2 px-3 text-left"><TableColumnLabel>Item</TableColumnLabel></th>
                            <th className="py-2 px-3 text-left hidden sm:table-cell"><TableColumnLabel>Variant / SKU</TableColumnLabel></th>
                            <th className="py-2 px-3 text-left hidden sm:table-cell"><TableColumnLabel>Type</TableColumnLabel></th>
                            <th className="py-2 px-3 text-right"><TableColumnLabel>Required</TableColumnLabel></th>
                            <th className="py-2 px-3 text-right"><TableColumnLabel>Produced</TableColumnLabel></th>
                            <th className="py-2 px-3 text-right hidden sm:table-cell"><TableColumnLabel>Priority</TableColumnLabel></th>
                          </tr></thead>
                          <tbody className="divide-y">
                            {order.items.map((item, idx) => (
                              <tr key={`${item.product_id}__${item.variant_id ?? idx}`} className="hover:bg-gray-50">
                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-xs font-bold text-muted-foreground">{idx + 1}</span>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-sm">{item.name}</td>
                                <td className="py-2.5 px-3 hidden sm:table-cell">
                                  {item.variant_sku
                                    ? <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{item.variant_sku}</span>
                                    : item.sku
                                      ? <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                                      : <span className="text-gray-300 text-xs">—</span>
                                  }
                                </td>
                                <td className="py-2.5 px-3 hidden sm:table-cell">
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${item.item_type === 'service' ? 'bg-accent text-primary' : 'bg-blue-50 text-blue-700'}`}>
                                    {item.item_type === 'service' ? '⚙️ Service' : '📦 Product'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold">{item.qty}</td>
                                <td className="py-2.5 px-3 text-right">
                                  <span className={`font-semibold ${(item.produced ?? 0) >= item.qty ? 'text-green-600' : 'text-muted-foreground'}`}>{item.produced ?? 0}</span>
                                </td>
                                <td className="py-2.5 px-3 text-right hidden sm:table-cell"><PriorityDot priority={item.priority} /></td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t">
                            <tr>
                              <td className="py-2 px-3 text-xs font-bold text-gray-600 uppercase" colSpan={2}>Total ({order.items.length} items)</td>
                              <td className="hidden sm:table-cell" />
                              <td className="py-2 px-3 text-right font-bold">{totalRequired}</td>
                              <td className="py-2 px-3 text-right font-bold text-green-600">{order.items.reduce((s, i) => s + (i.produced ?? 0), 0)}</td>
                              <td className="hidden sm:table-cell" />
                            </tr>
                          </tfoot>
                        </ResizableTable>
                      </div>
                    </div>
                  )}

                  {/* STOCK DISPATCH tab */}
                  {detailTab === 'stock' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-muted-foreground mb-1">Total Required</p><p className="text-xl font-bold text-gray-800">{totalRequired}</p></div>
                        <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-green-600 mb-1">Sent to Stock</p><p className="text-xl font-bold text-green-700">{totalDispatched}</p></div>
                        <div className="bg-amber-50 rounded-xl p-3 text-center"><p className="text-amber-600 mb-1">Remaining</p><p className="text-xl font-bold text-amber-700">{Math.max(0, totalRequired - totalDispatched)}</p></div>
                      </div>

                      {order.stock_dispatches.length > 0 && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <ResizableTable tableId="production-dispatches" defaultWidths={[120, 80, 100, 200]}>
                            <thead className="bg-gray-50 border-b"><tr className="font-semibold text-muted-foreground uppercase">
                              <th className="py-2 px-3 text-left"><TableColumnLabel>Date</TableColumnLabel></th>
                              <th className="py-2 px-3 text-right"><TableColumnLabel>Qty</TableColumnLabel></th>
                              <th className="py-2 px-3"><TableColumnLabel>By</TableColumnLabel></th>
                              <th className="py-2 px-3"><TableColumnLabel>Notes</TableColumnLabel></th>
                            </tr></thead>
                            <tbody className="divide-y">
                              {order.stock_dispatches.map(d => (
                                <tr key={d.id} className="hover:bg-gray-50">
                                  <td className="py-2 px-3 text-gray-600">{d.date}</td>
                                  <td className="py-2 px-3 text-right font-bold text-green-700">{d.qty}</td>
                                  <td className="py-2 px-3 text-gray-600">{d.by || '—'}</td>
                                  <td className="py-2 px-3 text-muted-foreground">{d.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-green-50 border-t">
                              <tr><td className="py-2 px-3 text-xs font-bold text-green-800" colSpan={2}>Total: {totalDispatched} units</td><td colSpan={2} /></tr>
                            </tfoot>
                          </ResizableTable>
                        </div>
                      )}

                      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
                        <p className="text-xs font-bold text-green-800 flex items-center gap-1.5"><PackagePlus className="w-3.5 h-3.5" /> Dispatch to Stock</p>
                        <div className="flex flex-wrap gap-2">
                          <input type="number" min={1} value={dispatchQty} onChange={e => setDispatchQty(e.target.value)}
                            placeholder="Qty" className="w-24 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                          <input value={dispatchBy} onChange={e => setDispatchBy(e.target.value)}
                            placeholder="Dispatched by" className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm flex-1 min-w-[110px] focus:outline-none focus:ring-2 focus:ring-green-400" />
                          <input value={dispatchNotes} onChange={e => setDispatchNotes(e.target.value)}
                            placeholder="Notes" className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm flex-1 min-w-[110px] focus:outline-none focus:ring-2 focus:ring-green-400" />
                          <button onClick={() => addStockDispatch(order)}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                            <PackagePlus className="w-3.5 h-3.5" /> Dispatch
                          </button>
                        </div>
                        {order.type === 'mts' && (
                          <p className="text-xs text-green-700">Dispatching will update inventory stock levels for MTS orders.</p>
                        )}
                        {order.type === 'mto' && (
                          <p className="text-xs text-indigo-700">Dispatching records delivery to customer for MTO orders.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* HISTORY / ATTACHMENTS tab */}
                  {detailTab === 'history' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-600">Attachments ({order.attachments.length})</p>
                        <button onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 text-xs font-medium text-primary bg-accent hover:bg-primary/12 px-3 py-1.5 rounded-lg transition-colors">
                          <Paperclip className="w-3.5 h-3.5" /> Attach File
                        </button>
                        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden"
                          onChange={e => {
                            const files = Array.from(e.target.files || [])
                            const currentOrder = order
                            const newAttachments: Attachment[] = []
                            let loaded = 0
                            files.forEach(file => {
                              const reader = new FileReader()
                              reader.onload = ev => {
                                newAttachments.push({ name: file.name, dataUrl: ev.target?.result as string, type: file.type, size: file.size })
                                loaded++
                                if (loaded === files.length) {
                                  const names = newAttachments.map(a => a.name).join(', ')
                                  updateOrder(
                                    currentOrder.id,
                                    { attachments: [...currentOrder.attachments, ...newAttachments] },
                                    makeAudit('file_attached', `${files.length} file${files.length > 1 ? 's' : ''} attached: ${names}`, { count: files.length }),
                                  )
                                  toast.success(`${files.length} file${files.length > 1 ? 's' : ''} attached.`)
                                }
                              }
                              reader.readAsDataURL(file)
                            })
                            e.target.value = ''
                          }} />
                      </div>
                      {order.attachments.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                          <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No attachments yet</p>
                          <p className="text-xs mt-1">Attach production drawings, quality reports, or photos</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {order.attachments.map((a, i) => (
                            <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2.5">
                              {a.type.startsWith('image/')
                                ? (
                                  <ClickableImageButton
                                    src={a.dataUrl}
                                    alt={a.name}
                                    title="View image"
                                    className="w-10 h-10 rounded-lg shrink-0"
                                    imgClassName="w-10 h-10 object-cover rounded-lg"
                                    onClick={() => setDetailAttachLightboxIndex(
                                      order.attachments.slice(0, i).filter((x) => x.type.startsWith('image/')).length,
                                    )}
                                  />
                                )
                                : <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-blue-600" /></div>}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{a.name}</p>
                                <p className="text-xs text-gray-400">{(a.size / 1024).toFixed(1)} KB</p>
                              </div>
                              <a href={a.dataUrl} download={a.name} className="p-1 hover:bg-gray-200 rounded-lg text-muted-foreground shrink-0">
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                      <ImageLightboxSession
                        items={detailLightboxItems}
                        openIndex={detailAttachLightboxIndex}
                        onClose={() => setDetailAttachLightboxIndex(null)}
                      />
                      <div className="border-t pt-3 space-y-4">
                        {/* Key dates summary */}
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" /> Key Dates
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-gray-50 rounded-lg p-2.5">
                              <p className="text-gray-400 text-xs font-medium uppercase mb-0.5">Created</p>
                              <p className="font-mono text-gray-700">{new Date(order.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2.5">
                              <p className="text-gray-400 text-xs font-medium uppercase mb-0.5">Last Updated</p>
                              <p className="font-mono text-gray-700">{new Date(order.updated_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2.5">
                              <p className="text-gray-400 text-xs font-medium uppercase mb-0.5">Target Date</p>
                              <p className="font-mono text-gray-700">{order.target_date || '—'}</p>
                            </div>
                            {order.type === 'mto' && order.delivery_deadline && (
                              <div className="bg-red-50 rounded-lg p-2.5">
                                <p className="text-red-400 text-xs font-medium uppercase mb-0.5">Delivery Deadline</p>
                                <p className="font-mono text-red-700 font-semibold">{order.delivery_deadline}</p>
                              </div>
                            )}
                            <div className="bg-green-50 rounded-lg p-2.5 col-span-2">
                              <p className="text-green-600 text-xs font-medium uppercase mb-0.5">Stock Dispatches</p>
                              <p className="font-semibold text-green-700">{order.stock_dispatches.length} dispatch{order.stock_dispatches.length !== 1 ? 'es' : ''} · {order.stock_dispatches.reduce((s, d) => s + d.qty, 0)} units total</p>
                            </div>
                          </div>
                        </div>

                        {/* Audit log timeline */}
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-3 flex items-center gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5 text-gray-400" /> Activity Log
                            <span className="ml-auto text-xs font-normal text-gray-400">{(order.audit_log || []).length} event{(order.audit_log || []).length !== 1 ? 's' : ''}</span>
                          </p>
                          {(order.audit_log || []).length === 0 ? (
                            <p className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl">No activity recorded yet.</p>
                          ) : (
                            <div className="relative">
                              {/* vertical line */}
                              <div className="absolute left-3.5 top-2 bottom-2 w-px bg-gray-200" />
                              <div className="space-y-1">
                                {[...(order.audit_log || [])].reverse().map((ev, i) => {
                                  const cfg: Record<AuditAction, { icon: string; dot: string; text: string }> = {
                                    created:           { icon: '🏭', dot: 'bg-primary/70', text: 'text-primary' },
                                    status_changed:    { icon: '🔄', dot: 'bg-blue-400',   text: 'text-blue-700' },
                                    progress_updated:  { icon: '📊', dot: 'bg-indigo-400', text: 'text-indigo-700' },
                                    assignees_updated: { icon: '👤', dot: 'bg-primary/50', text: 'text-primary' },
                                    notes_updated:     { icon: '📝', dot: 'bg-amber-400',  text: 'text-amber-700' },
                                    stock_dispatched:  { icon: '📦', dot: 'bg-green-400',  text: 'text-green-700' },
                                    file_attached:     { icon: '📎', dot: 'bg-sky-400',    text: 'text-sky-700' },
                                    file_removed:      { icon: '🗑️', dot: 'bg-red-400',   text: 'text-red-700' },
                                    item_added:        { icon: '➕', dot: 'bg-teal-400',   text: 'text-teal-700' },
                                    priority_changed:  { icon: '⚡', dot: 'bg-orange-400', text: 'text-orange-700' },
                                  }
                                  const c = cfg[ev.action] || { icon: '•', dot: 'bg-gray-400', text: 'text-gray-600' }
                                  const isFirst = i === 0
                                  return (
                                    <div key={ev.id} className="relative flex items-start gap-3 pl-7">
                                      {/* dot */}
                                      <div className={`absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${c.dot} ${isFirst ? 'ring-2 ring-offset-1 ring-primary/30' : ''}`} />
                                      <div className={`flex-1 min-w-0 rounded-xl px-3 py-2.5 ${isFirst ? 'bg-accent border border-primary/20' : 'bg-gray-50'}`}>
                                        <div className="flex items-start justify-between gap-2">
                                          <p className={`text-xs font-medium leading-tight ${isFirst ? c.text : 'text-gray-700'}`}>
                                            <span className="mr-1">{c.icon}</span>
                                            {ev.detail}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-xs text-gray-400 font-mono">
                                            {new Date(ev.timestamp).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                                          </span>
                                          {ev.actor && (
                                            <span className="text-xs text-gray-400">· {ev.actor}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── Create Order Drawer ──────────────────────────────────────────────── */}
      {showCreate && (
        <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm backdrop-blur-sm overflow-y-auto" onClick={() => { setShowCreate(false); setCreateType(null) }}>
          <ModalEscapeHandler onClose={closeCreateModal} />
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Step 1: choose type */}
            {!createType ? (
              <div>
                <div className="flex items-center gap-3 px-6 py-5 border-b bg-gradient-to-r from-accent to-primary/10">
                  <div className="p-2 bg-primary/12 rounded-xl"><Factory className="w-5 h-5 text-primary" /></div>
                  <div className="flex-1"><h2 className="font-bold text-gray-900">New Production Order</h2><p className="text-xs text-muted-foreground">Choose the production type</p></div>
                  <button type="button" data-escape-close aria-label="Close" onClick={() => setShowCreate(false)} className="p-2 hover:bg-primary/12 rounded-xl">
                <X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button onClick={() => { setCreateType('mto'); setFormRef(genRef('mto')) }}
                      className="flex flex-col items-start gap-3 p-5 rounded-2xl border-2 border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 transition-all text-left">
                      <div className="p-3 bg-indigo-100 rounded-xl"><ShoppingCart className="w-6 h-6 text-indigo-600" /></div>
                      <div>
                        <p className="font-bold text-indigo-900 text-base">Make to Order (MTO)</p>
                        <p className="text-xs text-indigo-700 mt-1 leading-relaxed">Produce for a specific customer order. Links to customer details and sales order reference. Products are dispatched directly to the customer.</p>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-1">
                        {['Customer-specific', 'Direct dispatch', 'Order linked'].map(t => (
                          <span key={t} className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">{t}</span>
                        ))}
                      </div>
                    </button>
                    <button onClick={() => { setCreateType('mts'); setFormRef(genRef('mts')) }}
                      className="flex flex-col items-start gap-3 p-5 rounded-2xl border-2 border-teal-200 bg-teal-50 hover:border-teal-400 hover:bg-teal-100 transition-all text-left">
                      <div className="p-3 bg-teal-100 rounded-xl"><Package className="w-6 h-6 text-teal-600" /></div>
                      <div>
                        <p className="font-bold text-teal-900 text-base">Make to Stock (MTS)</p>
                        <p className="text-xs text-teal-700 mt-1 leading-relaxed">Produce to replenish inventory. Finished goods are added directly to your store's stock when production completes.</p>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-1">
                        {['Stock replenishment', 'Adds to inventory', 'Demand-driven'].map(t => (
                          <span key={t} className="text-xs bg-teal-200 text-teal-800 px-2 py-0.5 rounded-full font-semibold">{t}</span>
                        ))}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Step 2: fill details */
              <div>
                <div className={`flex items-center gap-3 px-6 py-5 border-b ${createType === 'mto' ? 'bg-indigo-50' : 'bg-teal-50'}`}>
                  <div className={`p-2 rounded-xl ${createType === 'mto' ? 'bg-indigo-100' : 'bg-teal-100'}`}>
                    {createType === 'mto' ? <ShoppingCart className="w-5 h-5 text-indigo-600" /> : <Package className="w-5 h-5 text-teal-600" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-gray-900">{createType === 'mto' ? 'Make to Order' : 'Make to Stock'} Order</h2>
                      <span className="text-xs font-mono bg-card border border-border text-gray-600 px-2 py-0.5 rounded-lg">{formRef}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{createType === 'mto' ? 'Customer-specific production' : 'Stock replenishment production'}</p>
                  </div>
                  <button onClick={() => setCreateType(null)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mr-2"><ChevronDown className="w-3 h-3 rotate-90" /> Back</button>
                  <button type="button" data-escape-close aria-label="Close" onClick={() => { setShowCreate(false); setCreateType(null); resetForm() }} className="p-2 hover:bg-accent rounded-xl">
                <X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="p-6 space-y-5">

                  {/* Template */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Production Template</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TEMPLATES.map(t => (
                        <button key={t.id} onClick={() => setFormTemplate(t.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${formTemplate === t.id ? 'border-primary/60 bg-accent' : 'border-gray-200 hover:border-primary/30'}`}>
                          <span className="text-base">{t.emoji}</span>
                          <div><p className={`text-xs font-medium leading-tight ${formTemplate === t.id ? 'text-primary' : 'text-gray-700'}`}>{t.label}</p></div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Core fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Business unit</label>
                      <BusinessUnitSelect
                        value={formStoreId}
                        onChange={(id) => { setFormStoreId(id); setFormItems([]) }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Only items available at this business unit can be added below.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Work Order Ref</label>
                      <input value={formRef} onChange={e => setFormRef(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Priority</label>
                      <Select
                        value={formPriority}
                        onChange={(v) => setFormPriority(v as Priority)}
                        options={[
                          { value: 'low', label: '🟢 Low' },
                          { value: 'medium', label: '🔵 Medium' },
                          { value: 'high', label: '🟠 High' },
                          { value: 'urgent', label: '🔴 Urgent' },
                        ]}
                        aria-label="Priority"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Production Team</label>
                      <input value={formTeam} onChange={e => setFormTeam(e.target.value)} placeholder="e.g. Assembly Line A"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Target Completion</label>
                      <input type="date" value={formTargetDate} onChange={e => setFormTargetDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                  </div>

                  {/* MTO specific — customer search */}
                  {createType === 'mto' && (
                    <div className="bg-indigo-50 rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-bold text-indigo-800 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Customer / Order Details</p>

                      {/* Customer search */}
                      <div className="relative">
                        <Label className="block text-xs font-medium text-gray-600 mb-1">Search Customer</Label>
                        <div className="flex items-center border border-border rounded-xl overflow-hidden bg-card focus-within:ring-2 focus-within:ring-indigo-400">
                          <Search className="w-3.5 h-3.5 text-gray-400 ml-3 shrink-0" />
                          <input
                            value={customerSearch}
                            onChange={e => { setCustomerSearch(e.target.value); setCustomerDropOpen(true); setSelectedCustomerId('') }}
                            onFocus={() => setCustomerDropOpen(true)}
                            placeholder="Name, phone, email or customer ID…"
                            className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
                          />
                          {selectedCustomerId && <CheckCircle className="w-4 h-4 text-green-500 mr-2 shrink-0" />}
                          {customerSearch && !selectedCustomerId && (
                            <button type="button" aria-label="Close" onClick={() => { setCustomerSearch(''); setSelectedCustomerId(''); setFormCustomerName(''); setFormCustomerPhone(''); setFormCustomerEmail('') }} className="pr-2">
                <X className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                          )}
                        </div>
                        {/* Customer dropdown */}
                        {customerDropOpen && !selectedCustomerId && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden max-h-52 overflow-y-auto">
                            {filteredCustomers.length > 0 ? filteredCustomers.map((c: { id: string; full_name: string; phone?: string; email?: string }) => (
                              <button key={c.id} onClick={() => selectCustomer(c)}
                                className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b last:border-b-0 flex items-start gap-2.5">
                                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-xs font-bold text-indigo-600">{c.full_name?.[0]?.toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-800">{c.full_name}</p>
                                  <p className="text-xs text-gray-400 truncate">{c.phone || ''}{c.phone && c.email ? ' · ' : ''}{c.email || ''}</p>
                                  <p className="text-xs font-mono text-gray-300">{c.id}</p>
                                </div>
                              </button>
                            )) : (
                              <div className="px-3 py-3 text-xs text-muted-foreground text-center">No customers found</div>
                            )}
                            <button onClick={() => { setCustomerDropOpen(false); setShowNewCustomer(true) }}
                              className="w-full text-left px-3 py-2.5 bg-indigo-50 text-indigo-700 text-xs font-medium flex items-center gap-2 hover:bg-indigo-100 transition-colors border-t">
                              <Plus className="w-3.5 h-3.5" /> Create new customer
                            </button>
                          </div>
                        )}
                        {customerDropOpen && <div className="fixed inset-0 z-20" onClick={() => setCustomerDropOpen(false)} />}
                      </div>

                      {/* Selected customer chip */}
                      {selectedCustomerId && (
                        <div className="flex items-center gap-2 bg-card border border-indigo-300 dark:border-indigo-700 rounded-xl px-3 py-2">
                          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-indigo-600">{formCustomerName?.[0]?.toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{formCustomerName}</p>
                            <p className="text-xs text-muted-foreground">{formCustomerPhone}{formCustomerPhone && formCustomerEmail ? ' · ' : ''}{formCustomerEmail}</p>
                          </div>
                          <button type="button" aria-label="Close" onClick={() => { setSelectedCustomerId(''); setCustomerSearch(''); setFormCustomerName(''); setFormCustomerPhone(''); setFormCustomerEmail('') }}
                            className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-3.5 h-3.5 text-gray-400" /></button>
                        </div>
                      )}

                      {/* Create new customer inline */}
                      {showNewCustomer && (
                        <div className="bg-card rounded-xl border border-indigo-200 dark:border-indigo-800 p-3 space-y-2">
                          <p className="text-xs font-bold text-indigo-700 flex items-center gap-1"><Plus className="w-3 h-3" /> New Customer</p>
                          <input value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="Full name *"
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                          <div className="grid grid-cols-2 gap-2">
                            <PhoneInput value={newCustPhone} onChange={setNewCustPhone} defaultCountryIso="IN" />
                            <input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} placeholder="Email (or phone)"
                              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                          </div>
                          <p className="text-xs text-gray-400">At least phone or email is required to create a customer.</p>
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => navigate('/master-data/new?returnTo=/production')}
                              className="text-xs text-primary hover:text-primary hover:underline flex items-center gap-1"
                            >
                              Enter more details
                            </button>
                            <div className="flex gap-2">
                              <button onClick={createNewCustomer} disabled={createCustomer.isPending}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                                {createCustomer.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Create &amp; Link
                              </button>
                              <button onClick={() => setShowNewCustomer(false)} className="btn-cancel px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg">Cancel</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Order details */}
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="block text-xs font-medium text-gray-600 mb-1">Sales Order Ref</Label>
                          <input value={formOrderRef} onChange={e => setFormOrderRef(e.target.value)} placeholder="e.g. SO-12345"
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
                        <div><Label className="block text-xs font-medium text-gray-600 mb-1">Delivery Deadline</Label>
                          <input type="date" value={formDeadline} onChange={e => setFormDeadline(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
                      </div>
                      <div><Label className="block text-xs font-medium text-gray-600 mb-1">Special Requirements</Label>
                        <textarea value={formSpecialReq} onChange={e => setFormSpecialReq(e.target.value)} rows={2} placeholder="Customer-specific requirements, customisation notes…"
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
                    </div>
                  )}

                  {/* MTS specific */}
                  {createType === 'mts' && (
                    <div className="bg-teal-50 rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-bold text-teal-800 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Stock Target</p>
                      <div><Label className="block text-xs font-medium text-gray-600 mb-1">Target Stock Level (units)</Label>
                        <input type="number" min={0} value={formTargetStock} onChange={e => setFormTargetStock(e.target.value)} placeholder="e.g. 500"
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" /></div>
                    </div>
                  )}

                  {/* Items picker — Products & Services */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5"><Hammer className="w-3.5 h-3.5 text-primary/80" /> Items to Produce</p>
                    {/* Tab + search row */}
                    <div className="flex gap-2 mb-2">
                      <div className="flex items-center bg-muted rounded-xl p-0.5 shrink-0">
                        <button onClick={() => setItemTab('product')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${itemTab === 'product' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}>
                          <Package className="w-3 h-3" /> Product
                        </button>
                        <button onClick={() => setItemTab('service')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${itemTab === 'service' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}>
                          <Layers className="w-3 h-3" /> Service
                        </button>
                      </div>
                      <div className="flex-1 relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                          placeholder={itemTab === 'product' ? 'Search product name or SKU…' : 'Search service name…'}
                          className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                        {itemSearch && <button type="button" aria-label="Close" onClick={() => setItemSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-gray-400" /></button>}
                      </div>
                      <input type="number" min={1} value={itemQty} onChange={e => setItemQty(e.target.value)} placeholder="Qty"
                        className="w-16 border border-gray-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring" />
                      {/* Camera barcode scanner button */}
                      <button
                        type="button"
                        onClick={() => setShowCameraScanner(true)}
                        title="Scan barcode"
                        className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors shrink-0"
                      >
                        {scanLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Results list */}
                    {(itemSearch || itemTab === 'product' ? filteredProducts : filteredServices).length > 0 && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 max-h-44 overflow-y-auto shadow-sm">
                        {(itemTab === 'product' ? filteredProducts : filteredServices).map((p: any) => {
                          const activeVariants = (p.variants || []).filter((v: any) => v.is_active !== false)
                          const hasVariants = activeVariants.length > 0
                          return (
                            <button key={p.id} onClick={() => {
                              if (hasVariants) {
                                setVariantPickerProduct(p)
                              } else {
                                addItem({ id: p.id, name: p.name, sku: p.sku, type: itemTab })
                              }
                            }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b last:border-b-0 flex items-center gap-2">
                              <span className="text-base">{itemTab === 'product' ? '📦' : '⚙️'}</span>
                              <span className="flex-1 font-medium">{p.name}</span>
                              {p.sku && <span className="text-xs text-gray-400 font-mono">{p.sku}</span>}
                              {hasVariants && (
                                <span className="text-xs font-bold bg-primary/12 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                                  {activeVariants.length} variants
                                </span>
                              )}
                              <Plus className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                            </button>
                          )
                        })}
                        {(itemTab === 'product' ? filteredProducts : filteredServices).length === 0 && (
                          <p className="text-center py-4 text-xs text-gray-400">No {itemTab}s found</p>
                        )}
                      </div>
                    )}
                    {formItems.length > 0 && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <ResizableTable tableId="production-form-bom" defaultWidths={[40, 200, 120, 80, 80, 40]}>
                          <thead className="bg-gray-50 border-b"><tr className="text-xs font-medium text-muted-foreground uppercase">
                            <th className="py-2 px-3 text-center w-8"><TableColumnLabel>#</TableColumnLabel></th>
                            <th className="py-2 px-3 text-left"><TableColumnLabel>Item</TableColumnLabel></th>
                            <th className="py-2 px-3 text-left hidden sm:table-cell"><TableColumnLabel>Variant / SKU</TableColumnLabel></th>
                            <th className="py-2 px-3 text-left hidden sm:table-cell"><TableColumnLabel>Type</TableColumnLabel></th>
                            <th className="py-2 px-3 text-right"><TableColumnLabel>Qty</TableColumnLabel></th>
                            <th className="py-2 px-2 w-8" />
                          </tr></thead>
                          <tbody className="divide-y">
                            {formItems.map((item, idx) => {
                              const rowKey = `${item.product_id}__${item.variant_id ?? ''}`
                              return (
                                <tr key={rowKey} className="hover:bg-gray-50">
                                  <td className="py-2 px-3 text-center">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-xs font-bold text-muted-foreground">{idx + 1}</span>
                                  </td>
                                  <td className="py-2 px-3 font-medium text-sm">{item.name}</td>
                                  <td className="py-2 px-3 hidden sm:table-cell">
                                    {item.variant_sku
                                      ? <span className="font-mono text-xs text-muted-foreground">{item.variant_sku}</span>
                                      : item.sku
                                        ? <span className="font-mono text-xs text-gray-400">{item.sku}</span>
                                        : <span className="text-gray-300 text-xs">—</span>
                                    }
                                  </td>
                                  <td className="py-2 px-3 hidden sm:table-cell">
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${item.item_type === 'product' ? 'bg-blue-50 text-blue-700' : 'bg-accent text-primary'}`}>
                                      {item.item_type === 'product' ? '📦 Product' : '⚙️ Service'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <input type="number" min={1} value={item.qty}
                                      onChange={e => setFormItems(prev => prev.map(i =>
                                        i.product_id === item.product_id && (i.variant_id ?? '') === (item.variant_id ?? '')
                                          ? { ...i, qty: Number(e.target.value) }
                                          : i,
                                      ))}
                                      className="w-16 border border-gray-200 rounded-lg px-2 py-0.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                                  </td>
                                  <td className="py-2 px-2">
                                    <button type="button" aria-label="Close" onClick={() => setFormItems(prev => prev.filter(i =>
                                      !(i.product_id === item.product_id && (i.variant_id ?? '') === (item.variant_id ?? '')),
                                    ))}>
                <X className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </ResizableTable>
                      </div>
                    )}
                  </div>

                  {/* Assignee picker — Team member or Vendor/Supplier */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary/80" /> Assign To (Employee / Vendor)</p>
                    <div className="flex gap-2 mb-2">
                      <div className="flex items-center bg-muted rounded-xl p-0.5 shrink-0">
                        <button onClick={() => setAssigneeTab('team')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${assigneeTab === 'team' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}>
                          <User className="w-3 h-3" /> Employee
                        </button>
                        <button onClick={() => setAssigneeTab('supplier')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${assigneeTab === 'supplier' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}>
                          <Truck className="w-3 h-3" /> Vendor
                        </button>
                      </div>
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input value={assigneeSearch} onChange={e => { setAssigneeSearch(e.target.value); setAssigneeDropOpen(true) }}
                          onFocus={() => setAssigneeDropOpen(true)}
                          placeholder={assigneeTab === 'team' ? 'Search team member…' : 'Search supplier / vendor…'}
                          className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                        {assigneeDropOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden max-h-44 overflow-y-auto">
                            {(assigneeTab === 'team' ? filteredTeam : filteredSuppliers).map((m: { id: string; full_name?: string; company_name?: string; role?: string; email?: string }) => (
                              <button key={m.id}
                                onClick={() => addAssignee({ id: m.id, name: assigneeTab === 'team' ? (m.full_name || '') : (m.company_name || ''), role: m.role || (assigneeTab === 'team' ? 'Team Member' : 'Vendor'), type: assigneeTab })}
                                className="w-full text-left px-3 py-2.5 hover:bg-accent border-b last:border-b-0 flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${assigneeTab === 'team' ? 'bg-primary/12' : 'bg-blue-100'}`}>
                                  <span className={`text-xs font-bold ${assigneeTab === 'team' ? 'text-primary' : 'text-blue-600'}`}>
                                    {(assigneeTab === 'team' ? m.full_name : m.company_name)?.[0]?.toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-800">{assigneeTab === 'team' ? m.full_name : m.company_name}</p>
                                  <p className="text-xs text-gray-400">{m.role || m.email || ''}</p>
                                </div>
                                <Plus className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                              </button>
                            ))}
                            {(assigneeTab === 'team' ? filteredTeam : filteredSuppliers).length === 0 && (
                              <p className="text-center py-4 text-xs text-gray-400">No {assigneeTab === 'team' ? 'team members' : 'vendors'} found</p>
                            )}
                          </div>
                        )}
                        {assigneeDropOpen && <div className="fixed inset-0 z-20" onClick={() => setAssigneeDropOpen(false)} />}
                      </div>
                    </div>
                    {formAssignees.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {formAssignees.map(a => (
                          <div key={a.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium ${a.type === 'team' ? 'bg-primary/12 text-primary' : 'bg-blue-100 text-blue-800'}`}>
                            {a.type === 'team' ? <User className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                            {a.name}
                            <span className="text-xs opacity-60 ml-0.5">({a.role})</span>
                            <button type="button" aria-label="Close" onClick={() => removeAssignee(a.id)} className="ml-0.5 opacity-60 hover:opacity-100">
                <X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Instructions / Notes</label>
                    <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
                      placeholder="Production instructions, quality requirements, safety notes…"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>

                  {/* Attachments */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Attachments (optional)</p>
                    {formAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {formAttachments.map((a, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-700">
                            {a.type.startsWith('image/') ? (
                              <ClickableImageButton
                                src={a.dataUrl}
                                alt={a.name}
                                title="View image"
                                className="w-8 h-8 rounded-lg shrink-0"
                                imgClassName="w-8 h-8 object-cover rounded-lg"
                                onClick={() => setFormAttachLightboxIndex(
                                  formAttachments.slice(0, i).filter((x) => x.type.startsWith('image/')).length,
                                )}
                              />
                            ) : (
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-blue-600" />
                              </div>
                            )}
                            <span className="truncate max-w-[120px]">{a.name}</span>
                            <button type="button" aria-label="Close" onClick={(e) => { e.stopPropagation(); setFormAttachments(prev => prev.filter((_, j) => j !== i)) }}>
                <X className="w-3 h-3 text-red-400" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <ImageLightboxSession
                      items={formLightboxItems}
                      openIndex={formAttachLightboxIndex}
                      onClose={() => setFormAttachLightboxIndex(null)}
                    />
                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border border-dashed border-gray-300 rounded-xl px-4 py-2.5 hover:bg-gray-100 text-sm text-muted-foreground transition-colors">
                      <Paperclip className="w-4 h-4" /> Attach images or documents
                      <input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleAttachFile} className="hidden" />
                    </label>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setShowCreate(false); setCreateType(null); resetForm() }}
                      className="btn-cancel flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 transition-colors">Cancel</button>
                    <button onClick={submitCreate}
                      className={`flex-1 text-white rounded-xl py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${createType === 'mto' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-600 hover:bg-teal-700'}`}>
                      <Factory className="w-4 h-4" /> Create {createType.toUpperCase()} Order
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Variant Picker Modal ─────────────────────────────────────────────── */}
      {variantPickerProduct && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 overflow-y-auto" onClick={() => setVariantPickerProduct(null)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{variantPickerProduct.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Select a variant to add to the order</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setVariantPickerProduct(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-3 space-y-1 max-h-72 overflow-y-auto">
              {(variantPickerProduct.variants || [])
                .filter((v: any) => v.is_active !== false)
                .map((v: any) => (
                  <button
                    key={v.id}
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
                ))}
            </div>
          </div>
        </div>
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
          onClose={() => setMrpOrder(null)}
        />
      )}
    </div>
  )
}

// ── ProductionOrderCard (with MRP button + reservation badge) ─────────────────

function ProductionOrderCard({
  order,
  isActive,
  totalDispatched,
  onSelect,
  onMRP,
}: {
  order: ProductionOrder
  isActive: boolean
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
      className={`w-full bg-card rounded-2xl border transition-all hover:shadow-md cursor-pointer ${isActive ? 'border-primary/60 shadow-md ring-2 ring-primary/15' : 'border-border hover:border-border/80'}`}
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
