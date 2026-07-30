import { useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Select } from '@/components/ui/select'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { ResizableTable } from '@/components/table/ResizableTable'
import {
  Factory, Package, ShoppingCart, Users, Calendar, CheckCircle,
  Download, FileText, User, Paperclip, ClipboardList,
  PlayCircle, Trash2, BarChart3, Edit2, Lock, Check,
  PackagePlus, IndianRupee, ArrowLeft, Search, X, Truck, Loader2,
  Info, Layers, Route, Copy, MapPin, Tag, LayoutList,
} from 'lucide-react'
import {
  ClickableImageButton,
  ImageLightboxSession,
  urlsToLightboxItems,
} from '@/components/common/ImageAttachmentLightbox'
import { useTeamMembers, useSuppliers, usePlants, useStorageLocationTree } from '@/hooks/useVendor'
import {
  useProductionOrder,
  useUpdateProductionOrder,
  useDeleteProductionOrder,
  useProductionOrdersBootstrap,
} from '@/hooks/useProductionOrders'
import { MRPReportModal } from '@/components/mrp/MRPReportModal'
import { ProductionRoutingPanel } from '@/components/production/ProductionRoutingPanel'
import {
  type ProductionOrder,
  type POStatus,
  type Assignee,
  type StockDispatch,
  type Attachment,
  type AuditAction,
  STATUS_CONFIG,
  WORKFLOW_STEPS,
  makeAudit,
  StatusBadge,
  TypeBadge,
  PriorityDot,
} from './productionShared'

const FIELD_H = 'h-8'

export default function ProductionOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  useProductionOrdersBootstrap()

  const { data: orderRaw, isLoading } = useProductionOrder(orderId ?? null)
  const order = orderRaw as ProductionOrder | undefined

  const updateOrderMut = useUpdateProductionOrder()
  const deleteOrderMut = useDeleteProductionOrder()
  const { data: teamData } = useTeamMembers({ size: 100 })
  const { data: suppliersData } = useSuppliers({ size: 100 })

  const teamMembers = teamData?.items || []
  const suppliers = suppliersData?.items || []

  // Resolve plant name and storage location name from IDs
  const { data: plantsData } = usePlants(order?.store_id ?? null)
  const { data: locationsData } = useStorageLocationTree(order?.store_id ?? null, order?.plant_id ?? null)
  const plantName = useMemo(() => {
    if (!order?.plant_id) return null
    return (plantsData?.plants ?? []).find((p: { id: string; name: string; code?: string }) => p.id === order.plant_id)?.name ?? null
  }, [plantsData, order?.plant_id])
  const locationName = useMemo(() => {
    if (!order?.output_storage_location_id) return null
    return (locationsData?.locations ?? []).find((l: { id: string; name: string }) => l.id === order.output_storage_location_id)?.name ?? null
  }, [locationsData, order?.output_storage_location_id])

  const [detailTab, setDetailTab] = useState<'details' | 'items' | 'routing' | 'stock' | 'history'>('details')
  const [mrpOpen, setMrpOpen] = useState(false)
  const [dispatchQty, setDispatchQty] = useState('')
  const [dispatchBy, setDispatchBy] = useState('')
  const [dispatchNotes, setDispatchNotes] = useState('')
  const [editStatus, setEditStatus] = useState<POStatus | ''>('')
  const [editProgress, setEditProgress] = useState(0)

  const [editAssigneesMode, setEditAssigneesMode] = useState(false)
  const [detailEditAssignees, setDetailEditAssignees] = useState<Assignee[]>([])
  const [detailAssigneeSearch, setDetailAssigneeSearch] = useState('')
  const [detailAssigneeDropOpen, setDetailAssigneeDropOpen] = useState(false)
  const [detailAssigneeTab, setDetailAssigneeTab] = useState<'team' | 'supplier'>('team')
  const [editNotesMode, setEditNotesMode] = useState(false)
  const [detailEditNotes, setDetailEditNotes] = useState('')
  const [detailAttachLightboxIndex, setDetailAttachLightboxIndex] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const detailImageAttachments = useMemo(
    () => (order?.attachments ?? []).filter((a) => a.type.startsWith('image/')),
    [order?.attachments],
  )
  const detailLightboxItems = useMemo(
    () => urlsToLightboxItems(
      detailImageAttachments.map((a) => a.dataUrl),
      { idPrefix: 'prod-detail', altText: (i) => detailImageAttachments[i]?.name ?? `Attachment ${i + 1}` },
    ),
    [detailImageAttachments],
  )

  useEscapeToClose(() => setDetailAssigneeDropOpen(false), detailAssigneeDropOpen)

  const filteredDetailTeam = useMemo(() => {
    if (!detailAssigneeSearch.trim()) return teamMembers.slice(0, 10)
    const q = detailAssigneeSearch.toLowerCase()
    return teamMembers.filter((m: { full_name?: string; role?: string; email?: string }) =>
      m.full_name?.toLowerCase().includes(q) || m.role?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q),
    ).slice(0, 10)
  }, [teamMembers, detailAssigneeSearch])

  const filteredDetailSuppliers = useMemo(() => {
    if (!detailAssigneeSearch.trim()) return suppliers.slice(0, 10)
    const q = detailAssigneeSearch.toLowerCase()
    return suppliers.filter((s: { company_name?: string; contact_name?: string }) =>
      s.company_name?.toLowerCase().includes(q) || s.contact_name?.toLowerCase().includes(q),
    ).slice(0, 10)
  }, [suppliers, detailAssigneeSearch])

  const updateOrder = useCallback((id: string, patch: Partial<ProductionOrder>, auditEvent?: ReturnType<typeof makeAudit>) => {
    const data: Record<string, unknown> = { ...patch }
    if (auditEvent) data.audit_event = auditEvent
    updateOrderMut.mutate({ id, data })
  }, [updateOrderMut])

  function deleteOrder(id: string) {
    deleteOrderMut.mutate(id, {
      onSuccess: () => navigate('/production'),
    })
  }

  function advanceStatus(o: ProductionOrder) {
    const idx = WORKFLOW_STEPS.findIndex(s => s.status === o.status)
    if (idx === -1 || idx >= WORKFLOW_STEPS.length - 1) return
    const nextStatus = WORKFLOW_STEPS[idx + 1].status
    const autoProgress = ({ draft: 0, confirmed: 10, in_production: 40, qc: 90, completed: 100, cancelled: 0, on_hold: o.progress } as Record<string, number>)[nextStatus] ?? o.progress
    updateOrder(
      o.id,
      { status: nextStatus, progress: autoProgress },
      makeAudit('status_changed', `Status changed from ${STATUS_CONFIG[o.status].label} → ${STATUS_CONFIG[nextStatus].label}`, { from: o.status, to: nextStatus, progress: autoProgress }),
    )
    toast.success(`Order ${o.ref} moved to ${STATUS_CONFIG[nextStatus].label}`)
  }

  function addStockDispatch(o: ProductionOrder) {
    if (!dispatchQty || Number(dispatchQty) <= 0) { toast.error('Enter a valid qty.'); return }
    const dispatch: StockDispatch = {
      id: Date.now().toString(), date: new Date().toISOString().slice(0, 10),
      qty: Number(dispatchQty), notes: dispatchNotes, by: dispatchBy,
    }
    const newDispatches = [...o.stock_dispatches, dispatch]
    const totalDispatched = newDispatches.reduce((s, d) => s + d.qty, 0)
    const totalRequired = o.items.reduce((s, i) => s + i.qty, 0)
    const newProgress = Math.min(100, Math.round((totalDispatched / totalRequired) * 100))
    const autoComplete = totalDispatched >= totalRequired && o.status !== 'completed'
    updateOrder(
      o.id,
      {
        stock_dispatches: newDispatches,
        progress: Math.max(o.progress, newProgress),
        status: autoComplete ? 'completed' : o.status,
      },
      makeAudit('stock_dispatched',
        `${dispatch.qty} unit${dispatch.qty !== 1 ? 's' : ''} dispatched to stock${dispatchBy ? ` by ${dispatchBy}` : ''}${dispatchNotes ? ` — ${dispatchNotes}` : ''}`,
        { qty: dispatch.qty, total_dispatched: totalDispatched, total_required: totalRequired },
      ),
    )
    setDispatchQty(''); setDispatchBy(''); setDispatchNotes('')
    toast.success(`${dispatch.qty} units dispatched to stock.`)
  }

  function applyStatusEdit(o: ProductionOrder) {
    if (!editStatus) return
    const newProgress = editProgress || o.progress
    const statusChanged = editStatus !== o.status
    const progressChanged = newProgress !== o.progress
    const detail = [
      statusChanged && `Status: ${STATUS_CONFIG[o.status].label} → ${STATUS_CONFIG[editStatus as POStatus].label}`,
      progressChanged && `Progress: ${o.progress}% → ${newProgress}%`,
    ].filter(Boolean).join(', ')
    updateOrder(
      o.id,
      { status: editStatus, progress: newProgress },
      makeAudit('status_changed', detail || 'Status/progress reviewed', { from: o.status, to: editStatus, progress: newProgress }),
    )
    setEditStatus('')
    toast.success('Status updated.')
  }

  function exportXLS(o: ProductionOrder) {
    const rows = o.items.map(i => [o.ref, o.type.toUpperCase(), i.name, i.qty, i.produced ?? 0, o.status, o.team, o.target_date])
    const tableHtml = [
      '<table border="1">',
      `<tr>${['Ref', 'Type', 'Product', 'Qty', 'Produced', 'Status', 'Team', 'Target Date'].map(h => `<th>${h}</th>`).join('')}</tr>`,
      ...rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`),
      '</table>',
    ].join('')
    const blob = new Blob([`\uFEFF<html><head><meta charset="UTF-8"></head><body>${tableHtml}</body></html>`], { type: 'application/vnd.ms-excel;charset=UTF-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${o.ref}-production.xls`; a.click()
    URL.revokeObjectURL(url)
  }

  function openAssigneeEdit(o: ProductionOrder) {
    setDetailEditAssignees(o.assignees ? [...o.assignees] : [])
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

  function saveAssigneeEdit(o: ProductionOrder) {
    const names = detailEditAssignees.map(a => a.name).join(', ') || 'None'
    updateOrder(
      o.id,
      { assignees: detailEditAssignees },
      makeAudit('assignees_updated', `Assigned to: ${names}`, { count: detailEditAssignees.length }),
    )
    setEditAssigneesMode(false)
    toast.success('Assignees updated.')
  }

  function openNotesEdit(o: ProductionOrder) {
    setDetailEditNotes(o.notes || '')
    setEditNotesMode(true)
  }

  function saveNotesEdit(o: ProductionOrder) {
    const preview = detailEditNotes.trim().slice(0, 60) + (detailEditNotes.trim().length > 60 ? '…' : '')
    updateOrder(
      o.id,
      { notes: detailEditNotes },
      makeAudit('notes_updated', `Instructions updated: "${preview || '(cleared)'}"`),
    )
    setEditNotesMode(false)
    toast.success('Notes updated.')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <button
            type="button"
            onClick={() => navigate('/production')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Production Orders
          </button>
          <p className="text-center py-20 text-muted-foreground">Production order not found.</p>
        </div>
      </div>
    )
  }

  const totalRequired = order.items.reduce((s, i) => s + i.qty, 0)
  const totalDispatched = order.stock_dispatches.reduce((s, d) => s + d.qty, 0)
  const curStepIdx = WORKFLOW_STEPS.findIndex(s => s.status === order.status)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* Back navigation */}
        <button
          type="button"
          onClick={() => navigate('/production')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Production Orders
        </button>

        {/* Main card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">

          {/* Header */}
          <div className={`px-5 py-4 border-b flex items-start gap-3 ${order.type === 'mto' ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'bg-teal-50 dark:bg-teal-950/30'}`}>
            <div className={`p-2 rounded-xl shrink-0 ${order.type === 'mto' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-teal-100 dark:bg-teal-900/50'}`}>
              {order.type === 'mto'
                ? <ShoppingCart className="w-5 h-5 text-indigo-600" />
                : <Package className="w-5 h-5 text-teal-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-gray-900 dark:text-gray-100 font-mono text-lg">{order.ref}</h1>
                <TypeBadge type={order.type} />
                <StatusBadge status={order.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Created {new Date(order.created_at).toLocaleDateString('en-IN')} · Template: {order.template}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setMrpOpen(true)}
                title="Material Requirement Plan"
                className="flex items-center gap-1 rounded-lg p-1.5 px-2 text-xs font-medium text-primary transition-colors hover:bg-muted hover:text-foreground"
              >
                <BarChart3 className="w-3.5 h-3.5" /> MRP
              </button>
              <button
                type="button"
                onClick={() => exportXLS(order)}
                title="Export Excel"
                className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => deleteOrder(order.id)}
                title="Delete"
                className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Workflow stepper — grid-cols-5, no horizontal scroll */}
          <div className="px-4 sm:px-5 py-3 border-b border-border bg-card">
            <div className="grid grid-cols-5 gap-1">
              {WORKFLOW_STEPS.map((step, i) => {
                const done = i < curStepIdx
                const active = i === curStepIdx
                const cancelled = order.status === 'cancelled'
                return (
                  <div key={step.status} className="flex flex-col items-center min-w-0">
                    <div className="relative flex items-center justify-center w-full h-8">
                      {i > 0 && (
                        <div className={`absolute left-0 right-1/2 top-1/2 h-0.5 -translate-y-1/2 ${i <= curStepIdx ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                      )}
                      {i < WORKFLOW_STEPS.length - 1 && (
                        <div className={`absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2 ${i < curStepIdx ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                      )}
                      <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                        cancelled ? 'border-red-300 bg-red-50 text-red-400' :
                        done ? 'border-green-500 bg-green-500 text-white' :
                        active ? 'border-primary bg-primary text-white' :
                        'border-border bg-card text-muted-foreground'
                      }`}>
                        {done ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">{i + 1}</span>}
                      </div>
                    </div>
                    <p className={`text-[10px] sm:text-xs font-medium mt-1 text-center truncate w-full px-0.5 ${active ? 'text-primary' : done ? 'text-green-700 dark:text-green-400' : 'text-gray-400'}`}>
                      {step.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b bg-gray-50/60 dark:bg-muted/30">
            {([
              { id: 'details',  label: 'Details',        icon: Info },
              { id: 'items',    label: 'Items',           icon: Layers },
              { id: 'routing',  label: 'Routing',         icon: Route },
              { id: 'stock',    label: 'Stock Dispatch',  icon: PackagePlus },
              { id: 'history',  label: 'Attachments',     icon: Paperclip },
            ] as const).map(({ id: tab, label, icon: Icon }) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDetailTab(tab)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] sm:text-xs font-medium transition-all border-b-2 ${detailTab === tab ? 'border-primary text-primary bg-card' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Tab content — no max-h scroll trap */}
          <div className="p-5 space-y-4">

            {/* DETAILS tab */}
            {detailTab === 'details' && (
              <div className="space-y-4">
                {/* Progress + actions in one row area */}
                <div className="bg-gray-50 dark:bg-muted/40 rounded-2xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Production Progress</span>
                        <span className="text-xs font-bold text-primary">{order.progress}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${order.status === 'completed' ? 'bg-green-500' : 'bg-primary'}`}
                          style={{ width: `${order.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {order.status !== 'completed' && order.status !== 'cancelled' && curStepIdx < WORKFLOW_STEPS.length - 1 && (
                        <button
                          type="button"
                          onClick={() => advanceStatus(order)}
                          className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Advance to {WORKFLOW_STEPS[curStepIdx + 1]?.label}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setEditStatus(order.status); setEditProgress(order.progress) }}
                        className="flex items-center gap-1.5 border border-gray-200 dark:border-border px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted transition-colors"
                      >
                        <Edit2 className="w-3 h-3" /> Edit Status / Progress
                      </button>
                    </div>
                  </div>
                  {editStatus !== '' && (
                    <div className="space-y-2 pt-3 mt-3 border-t border-gray-200 dark:border-border">
                      <div className="flex flex-wrap gap-2">
                        <Select
                          value={editStatus}
                          onChange={(v) => setEditStatus(v as POStatus)}
                          options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                          aria-label="Production order status"
                          className={`flex-1 min-w-[140px] ${FIELD_H}`}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editProgress}
                          onChange={e => setEditProgress(Number(e.target.value))}
                          className={`w-24 border border-gray-200 dark:border-border rounded-lg px-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring ${FIELD_H}`}
                          placeholder="Progress%"
                        />
                        <button
                          type="button"
                          onClick={() => applyStatusEdit(order)}
                          className={`bg-primary text-white px-3 rounded-lg text-xs font-bold hover:bg-primary/90 ${FIELD_H}`}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditStatus('')}
                          className={`px-2 text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted rounded-lg text-xs ${FIELD_H}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-gray-50 dark:bg-muted/40 rounded-xl p-2.5">
                    <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                      <LayoutList className="w-3 h-3" /> Priority
                    </p>
                    <PriorityDot priority={order.priority} />
                  </div>
                  <div className="bg-gray-50 dark:bg-muted/40 rounded-xl p-2.5">
                    <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Team
                    </p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{order.team || <span className="text-gray-400 font-normal italic">None</span>}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-muted/40 rounded-xl p-2.5">
                    <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Target Date
                    </p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{order.target_date || '—'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-muted/40 rounded-xl p-2.5">
                    <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Template
                    </p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{order.template}</p>
                  </div>
                  {order.plant_id && (
                    <div className="bg-gray-50 dark:bg-muted/40 rounded-xl p-2.5 col-span-2">
                      <p className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wide">
                        <Factory className="w-3 h-3" /> Plant
                      </p>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {plantName ?? (
                            <code className="font-mono text-xs text-gray-500 dark:text-gray-400" title={order.plant_id}>
                              {order.plant_id.slice(0, 8)}…
                            </code>
                          )}
                        </p>
                        <button
                          type="button"
                          title={`Copy plant ID: ${order.plant_id}`}
                          onClick={() => { navigator.clipboard.writeText(order.plant_id!); toast.success('Plant ID copied') }}
                          className="text-gray-400 hover:text-primary transition-colors shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  {order.output_storage_location_id && (
                    <div className="bg-gray-50 dark:bg-muted/40 rounded-xl p-2.5 col-span-2">
                      <p className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wide">
                        <MapPin className="w-3 h-3" /> Output Storage Location
                      </p>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {locationName ?? (
                            <code className="font-mono text-xs text-gray-500 dark:text-gray-400" title={order.output_storage_location_id}>
                              {order.output_storage_location_id.slice(0, 8)}…
                            </code>
                          )}
                        </p>
                        <button
                          type="button"
                          title={`Copy location ID: ${order.output_storage_location_id}`}
                          onClick={() => { navigator.clipboard.writeText(order.output_storage_location_id!); toast.success('Location ID copied') }}
                          className="text-gray-400 hover:text-primary transition-colors shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {(order.planned_material_cost != null || order.planned_labor_cost != null || order.actual_material_cost != null || order.actual_labor_cost != null) && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5" /> Cost Roll-up
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-amber-600 dark:text-amber-400 mb-0.5">Material — Planned / Actual</p>
                        <p className="font-bold text-amber-900 dark:text-amber-100 text-sm">
                          ₹{(order.planned_material_cost ?? 0).toFixed(2)}
                          {order.actual_material_cost != null && <span className="text-green-700 dark:text-green-400"> / ₹{order.actual_material_cost.toFixed(2)}</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-amber-600 dark:text-amber-400 mb-0.5">Labor — Planned / Actual</p>
                        <p className="font-bold text-amber-900 dark:text-amber-100 text-sm">
                          ₹{(order.planned_labor_cost ?? 0).toFixed(2)}
                          {order.actual_labor_cost != null && <span className="text-green-700 dark:text-green-400"> / ₹{order.actual_labor_cost.toFixed(2)}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between">
                      <span className="text-amber-600 dark:text-amber-400">Total Cost (Planned / Actual)</span>
                      <span className="font-bold text-amber-900 dark:text-amber-100">
                        ₹{((order.planned_material_cost ?? 0) + (order.planned_labor_cost ?? 0)).toFixed(2)}
                        {(order.actual_material_cost != null || order.actual_labor_cost != null) && (
                          <span className="text-green-700 dark:text-green-400"> / ₹{((order.actual_material_cost ?? 0) + (order.actual_labor_cost ?? 0)).toFixed(2)}</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {order.type === 'mto' ? (
                  <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-indigo-800 dark:text-indigo-200 flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5" /> Customer / Order Details
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-indigo-500 mb-0.5">Customer</p>
                        {order.customer_id ? (
                          <>
                            <Link
                              to={`/customers/${order.customer_id}`}
                              className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
                            >
                              {order.customer_name || 'Customer'}
                            </Link>
                            <Link
                              to={`/customers/${order.customer_id}`}
                              className="mt-0.5 block font-mono text-xs text-indigo-400 hover:underline"
                            >
                              {order.customer_id}
                            </Link>
                          </>
                        ) : (
                          <p className="font-semibold">{order.customer_name || '—'}</p>
                        )}
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
                      <div><p className="text-indigo-500 mb-0.5">Special Requirements</p><p className="font-medium text-indigo-800 dark:text-indigo-200">{order.special_requirements}</p></div>
                    )}
                  </div>
                ) : (
                  <div className="bg-teal-50 dark:bg-teal-950/30 rounded-2xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-teal-800 dark:text-teal-200 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" /> Stock Replenishment Details
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div><p className="text-teal-500 mb-0.5">Target Stock Level</p><p className="font-bold text-teal-800 dark:text-teal-200 text-base">{order.target_stock_level ?? '—'}</p></div>
                      <div><p className="text-teal-500 mb-0.5">Total to Produce</p><p className="font-bold text-teal-800 dark:text-teal-200 text-base">{totalRequired}</p></div>
                      <div><p className="text-teal-500 mb-0.5">Sent to Stock</p><p className="font-bold text-green-700 dark:text-green-400 text-base">{totalDispatched}</p></div>
                    </div>
                  </div>
                )}

                {/* Assignees */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Assigned To
                    </p>
                    {!editAssigneesMode && (
                      <button
                        type="button"
                        onClick={() => openAssigneeEdit(order)}
                        className="flex items-center gap-1 text-xs text-primary hover:bg-accent px-2 py-1 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </div>

                  {editAssigneesMode ? (
                    <div className="space-y-2 bg-accent border border-primary/30 rounded-xl p-3">
                      <div className="flex gap-1 mb-1">
                        {(['team', 'supplier'] as const).map(tab => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setDetailAssigneeTab(tab)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${detailAssigneeTab === tab ? 'bg-primary text-white' : 'bg-card text-muted-foreground border border-border hover:bg-accent'}`}
                          >
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
                          className={`w-full border border-border rounded-xl pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card ${FIELD_H}`}
                        />
                        {detailAssigneeDropOpen && (detailAssigneeTab === 'team' ? filteredDetailTeam : filteredDetailSuppliers).length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden max-h-44 overflow-y-auto">
                            {(detailAssigneeTab === 'team' ? filteredDetailTeam : filteredDetailSuppliers).map((m: { id: string; full_name?: string; company_name?: string; role?: string; email?: string }) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => addDetailAssignee({
                                  id: m.id,
                                  name: detailAssigneeTab === 'team' ? (m.full_name || '') : (m.company_name || ''),
                                  role: m.role || (detailAssigneeTab === 'team' ? 'Team Member' : 'Vendor'),
                                  type: detailAssigneeTab,
                                })}
                                className="w-full text-left px-3 py-2.5 hover:bg-accent border-b last:border-b-0 flex items-center gap-2.5 text-sm"
                              >
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

                      {detailEditAssignees.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {detailEditAssignees.map(a => (
                            <div key={a.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium ${a.type === 'team' ? 'bg-primary/12 text-primary' : 'bg-blue-100 text-blue-800'}`}>
                              {a.type === 'team' ? <User className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                              {a.name} <span className="opacity-60 text-xs">({a.role})</span>
                              <button type="button" aria-label="Remove assignee" onClick={() => removeDetailAssignee(a.id)} className="ml-0.5 opacity-60 hover:opacity-100">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No assignees — search above to add one.</p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => saveAssigneeEdit(order)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditAssigneesMode(false)}
                          className="btn-cancel px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {order.assignees && order.assignees.length > 0 ? order.assignees.map(a => (
                        <div
                          key={a.id}
                          className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border text-xs font-medium ${
                            a.type === 'team'
                              ? 'bg-primary/8 border-primary/25 text-primary'
                              : 'bg-blue-50 border-blue-200 text-blue-800'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${a.type === 'team' ? 'bg-primary/20' : 'bg-blue-100'}`}>
                            {a.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate max-w-[100px] leading-none">{a.name}</p>
                            {a.role && a.role !== 'Team Member' && a.role !== 'Vendor' && (
                              <p className="text-[9px] opacity-60 leading-none mt-0.5">{a.role}</p>
                            )}
                          </div>
                        </div>
                      )) : (
                        <p className="text-xs text-gray-400 italic bg-gray-50 dark:bg-muted/40 rounded-xl px-3 py-2">None assigned</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground font-semibold">Instructions / Notes</p>
                    {!editNotesMode && (
                      <button
                        type="button"
                        onClick={() => openNotesEdit(order)}
                        className="flex items-center gap-1 text-xs text-primary hover:bg-accent px-2 py-1 rounded-lg transition-colors"
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
                        <button
                          type="button"
                          onClick={() => saveNotesEdit(order)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditNotesMode(false)}
                          className="btn-cancel px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : order.notes ? (
                    <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-muted/40 rounded-xl p-3 whitespace-pre-wrap">{order.notes}</p>
                  ) : (
                    <p className="text-xs text-gray-400 italic bg-gray-50 dark:bg-muted/40 rounded-xl p-3">No instructions added yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* ITEMS tab */}
            {detailTab === 'items' && (
              <div className="space-y-3">
                {(order.materials_reserved_at || order.inventory_posted_at) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {order.materials_reserved_at && !order.inventory_posted_at && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 font-medium">
                        <Lock className="w-3 h-3" /> Materials reserved {new Date(order.materials_reserved_at).toLocaleDateString('en-IN')}
                      </span>
                    )}
                    {order.inventory_posted_at && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 text-green-700 px-2.5 py-1 font-medium">
                        <CheckCircle className="w-3 h-3" /> Stock posted {new Date(order.inventory_posted_at).toLocaleDateString('en-IN')} — components consumed, finished goods received
                      </span>
                    )}
                    <button type="button" onClick={() => setMrpOpen(true)} className="text-primary hover:underline font-medium">View materials</button>
                  </div>
                )}
                <div className="border border-gray-200 dark:border-border rounded-xl overflow-hidden">
                  <ResizableTable tableId="production-bom-detail" defaultWidths={[40, 200, 120, 80, 90, 90, 80]}>
                    <thead className="bg-gray-50 dark:bg-muted/40 border-b">
                      <tr className="text-xs font-medium text-muted-foreground uppercase">
                        <th className="py-2 px-3 text-center w-8"><TableColumnLabel>#</TableColumnLabel></th>
                        <th className="py-2 px-3 text-left"><TableColumnLabel>Item</TableColumnLabel></th>
                        <th className="py-2 px-3 text-left hidden sm:table-cell"><TableColumnLabel>Variant / SKU</TableColumnLabel></th>
                        <th className="py-2 px-3 text-left hidden sm:table-cell"><TableColumnLabel>Type</TableColumnLabel></th>
                        <th className="py-2 px-3 text-right"><TableColumnLabel>Required</TableColumnLabel></th>
                        <th className="py-2 px-3 text-right"><TableColumnLabel>Produced</TableColumnLabel></th>
                        <th className="py-2 px-3 text-right hidden sm:table-cell"><TableColumnLabel>Priority</TableColumnLabel></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {order.items.map((item, idx) => (
                        <tr key={`${item.product_id}__${item.variant_id ?? idx}`} className="hover:bg-gray-50 dark:hover:bg-muted/30">
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-muted text-xs font-bold text-muted-foreground">{idx + 1}</span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-sm">{item.name}</td>
                          <td className="py-2.5 px-3 hidden sm:table-cell">
                            {item.variant_sku
                              ? <span className="font-mono text-xs text-gray-600 bg-gray-100 dark:bg-muted px-1.5 py-0.5 rounded">{item.variant_sku}</span>
                              : item.sku
                                ? <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                                : <span className="text-gray-300 text-xs">—</span>}
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
                    <tfoot className="bg-gray-50 dark:bg-muted/40 border-t">
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

            {/* ROUTING tab */}
            {detailTab === 'routing' && (
              <ProductionRoutingPanel orderId={order.id} />
            )}

            {/* STOCK DISPATCH tab */}
            {detailTab === 'stock' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-gray-50 dark:bg-muted/40 rounded-xl p-3 text-center">
                    <p className="text-muted-foreground mb-1">Total Required</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{totalRequired}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-3 text-center">
                    <p className="text-green-600 mb-1">Sent to Stock</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{totalDispatched}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-center">
                    <p className="text-amber-600 mb-1">Remaining</p>
                    <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{Math.max(0, totalRequired - totalDispatched)}</p>
                  </div>
                </div>

                {order.stock_dispatches.length > 0 && (
                  <div className="border border-gray-200 dark:border-border rounded-xl overflow-hidden">
                    <ResizableTable tableId="production-dispatches-detail" defaultWidths={[120, 80, 100, 200]}>
                      <thead className="bg-gray-50 dark:bg-muted/40 border-b">
                        <tr className="font-semibold text-muted-foreground uppercase">
                          <th className="py-2 px-3 text-left"><TableColumnLabel>Date</TableColumnLabel></th>
                          <th className="py-2 px-3 text-right"><TableColumnLabel>Qty</TableColumnLabel></th>
                          <th className="py-2 px-3"><TableColumnLabel>By</TableColumnLabel></th>
                          <th className="py-2 px-3"><TableColumnLabel>Notes</TableColumnLabel></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {order.stock_dispatches.map(d => (
                          <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-muted/30">
                            <td className="py-2 px-3 text-gray-600">{d.date}</td>
                            <td className="py-2 px-3 text-right font-bold text-green-700 dark:text-green-400">{d.qty}</td>
                            <td className="py-2 px-3 text-gray-600">{d.by || '—'}</td>
                            <td className="py-2 px-3 text-muted-foreground">{d.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-green-50 dark:bg-green-950/30 border-t">
                        <tr><td className="py-2 px-3 text-xs font-bold text-green-800 dark:text-green-300" colSpan={2}>Total: {totalDispatched} units</td><td colSpan={2} /></tr>
                      </tfoot>
                    </ResizableTable>
                  </div>
                )}

                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-green-800 dark:text-green-200 flex items-center gap-1.5">
                    <PackagePlus className="w-3.5 h-3.5" /> Dispatch to Stock
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="number"
                      min={1}
                      value={dispatchQty}
                      onChange={e => setDispatchQty(e.target.value)}
                      placeholder="Qty"
                      className={`w-24 border border-gray-200 dark:border-border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${FIELD_H}`}
                    />
                    <input
                      value={dispatchBy}
                      onChange={e => setDispatchBy(e.target.value)}
                      placeholder="Dispatched by"
                      className={`border border-gray-200 dark:border-border rounded-lg px-2.5 text-sm flex-1 min-w-[110px] focus:outline-none focus:ring-2 focus:ring-green-400 ${FIELD_H}`}
                    />
                    <input
                      value={dispatchNotes}
                      onChange={e => setDispatchNotes(e.target.value)}
                      placeholder="Notes"
                      className={`border border-gray-200 dark:border-border rounded-lg px-2.5 text-sm flex-1 min-w-[110px] focus:outline-none focus:ring-2 focus:ring-green-400 ${FIELD_H}`}
                    />
                    <button
                      type="button"
                      onClick={() => addStockDispatch(order)}
                      className={`flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 rounded-lg text-sm font-bold transition-colors ${FIELD_H}`}
                    >
                      <PackagePlus className="w-3.5 h-3.5" /> Dispatch
                    </button>
                  </div>
                  {order.type === 'mts' && (
                    <p className="text-xs text-green-700 dark:text-green-400">Dispatching will update inventory stock levels for MTS orders.</p>
                  )}
                  {order.type === 'mto' && (
                    <p className="text-xs text-indigo-700 dark:text-indigo-400">Dispatching records delivery to customer for MTO orders.</p>
                  )}
                </div>
              </div>
            )}

            {/* HISTORY / ATTACHMENTS tab */}
            {detailTab === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Attachments ({order.attachments.length})</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs font-medium text-primary bg-accent hover:bg-primary/12 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> Attach File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
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
                    }}
                  />
                </div>
                {order.attachments.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 bg-gray-50 dark:bg-muted/40 rounded-2xl border border-dashed border-gray-300 dark:border-border">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No attachments yet</p>
                    <p className="text-xs mt-1">Attach production drawings, quality reports, or photos</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {order.attachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-muted/40 border border-gray-200 dark:border-border rounded-xl p-2.5">
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
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{a.name}</p>
                          <p className="text-xs text-gray-400">{(a.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <a href={a.dataUrl} download={a.name} className="p-1 hover:bg-gray-200 dark:hover:bg-muted rounded-lg text-muted-foreground shrink-0">
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
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" /> Key Dates
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 dark:bg-muted/40 rounded-lg p-2.5">
                        <p className="text-gray-400 text-xs font-medium uppercase mb-0.5">Created</p>
                        <p className="font-mono text-gray-700 dark:text-gray-300">{new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-muted/40 rounded-lg p-2.5">
                        <p className="text-gray-400 text-xs font-medium uppercase mb-0.5">Last Updated</p>
                        <p className="font-mono text-gray-700 dark:text-gray-300">{new Date(order.updated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-muted/40 rounded-lg p-2.5">
                        <p className="text-gray-400 text-xs font-medium uppercase mb-0.5">Target Date</p>
                        <p className="font-mono text-gray-700 dark:text-gray-300">{order.target_date || '—'}</p>
                      </div>
                      {order.type === 'mto' && order.delivery_deadline && (
                        <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2.5">
                          <p className="text-red-400 text-xs font-medium uppercase mb-0.5">Delivery Deadline</p>
                          <p className="font-mono text-red-700 dark:text-red-400 font-semibold">{order.delivery_deadline}</p>
                        </div>
                      )}
                      <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2.5 col-span-2">
                        <p className="text-green-600 text-xs font-medium uppercase mb-0.5">Stock Dispatches</p>
                        <p className="font-semibold text-green-700 dark:text-green-400">{order.stock_dispatches.length} dispatch{order.stock_dispatches.length !== 1 ? 'es' : ''} · {order.stock_dispatches.reduce((s, d) => s + d.qty, 0)} units total</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-gray-400" /> Activity Log
                      <span className="ml-auto text-xs font-normal text-gray-400">{(order.audit_log || []).length} event{(order.audit_log || []).length !== 1 ? 's' : ''}</span>
                    </p>
                    {(order.audit_log || []).length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 dark:bg-muted/40 rounded-xl">No activity recorded yet.</p>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-3.5 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />
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
                                <div className={`absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${c.dot} ${isFirst ? 'ring-2 ring-offset-1 ring-primary/30' : ''}`} />
                                <div className={`flex-1 min-w-0 rounded-xl px-3 py-2.5 ${isFirst ? 'bg-accent border border-primary/20' : 'bg-gray-50 dark:bg-muted/40'}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={`text-xs font-medium leading-tight ${isFirst ? c.text : 'text-gray-700 dark:text-gray-300'}`}>
                                      <span className="mr-1">{c.icon}</span>
                                      {ev.detail}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400 font-mono">
                                      {new Date(ev.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
      </div>

      {mrpOpen && (
        <MRPReportModal
          orderId={order.id}
          orderType="production_order"
          orderRef={order.ref}
          items={order.items
            .filter(i => i.item_type === 'product' && i.product_id)
            .map(i => ({ product_id: i.product_id, qty: i.qty, name: i.name }))}
          storeId={order.store_id}
          autoManaged={!!order.materials_reserved_at}
          onClose={() => setMrpOpen(false)}
        />
      )}
    </div>
  )
}
