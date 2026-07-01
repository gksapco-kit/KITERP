import {
  Factory, Package, ShoppingCart, CircleDot, CheckSquare, BadgeAlert,
  CheckCircle, PauseCircle, X,
} from 'lucide-react'

export type POType = 'mto' | 'mts'
export type POStatus = 'draft' | 'confirmed' | 'in_production' | 'qc' | 'completed' | 'on_hold' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface POItem {
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

export interface Assignee {
  id: string
  name: string
  role: string
  type: 'team' | 'supplier'
}

export interface StockDispatch {
  id: string
  date: string
  qty: number
  notes: string
  by: string
}

export interface Attachment {
  name: string
  dataUrl: string
  type: string
  size: number
}

export type AuditAction =
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

export interface AuditEvent {
  id: string
  action: AuditAction
  actor: string
  timestamp: string
  detail: string
  meta?: Record<string, string | number>
}

export interface ProductionOrder {
  id: string
  store_id?: string | null
  plant_id?: string | null
  output_storage_location_id?: string | null
  ref: string
  type: POType
  template: string
  status: POStatus
  progress: number
  priority: Priority
  items: POItem[]
  materials_reserved_at?: string | null
  inventory_posted_at?: string | null
  planned_material_cost?: number | null
  planned_labor_cost?: number | null
  actual_material_cost?: number | null
  actual_labor_cost?: number | null
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  order_ref?: string
  delivery_deadline?: string
  special_requirements?: string
  target_stock_level?: number
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

export const STATUS_CONFIG: Record<POStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:         { label: 'Draft',        color: 'text-gray-600 dark:text-gray-300',   bg: 'bg-gray-100 dark:bg-gray-800',    icon: CircleDot },
  confirmed:     { label: 'Confirmed',    color: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-100 dark:bg-blue-950/50',    icon: CheckSquare },
  in_production: { label: 'In Production',color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-100 dark:bg-amber-950/50',   icon: Factory },
  qc:            { label: 'QC Check',     color: 'text-primary', bg: 'bg-primary/10',  icon: BadgeAlert },
  completed:     { label: 'Completed',    color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-100 dark:bg-green-950/50',   icon: CheckCircle },
  on_hold:       { label: 'On Hold',      color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-950/50',  icon: PauseCircle },
  cancelled:     { label: 'Cancelled',    color: 'text-red-700 dark:text-red-300',    bg: 'bg-red-100 dark:bg-red-950/50',     icon: X },
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  low:    { label: 'Low',    color: 'text-muted-foreground',   dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'text-blue-600',   dot: 'bg-blue-400' },
  high:   { label: 'High',   color: 'text-orange-600', dot: 'bg-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-600',    dot: 'bg-red-500' },
}

export const WORKFLOW_STEPS: { status: POStatus; label: string }[] = [
  { status: 'draft',         label: 'Draft' },
  { status: 'confirmed',     label: 'Confirmed' },
  { status: 'in_production', label: 'In Production' },
  { status: 'qc',            label: 'QC Check' },
  { status: 'completed',     label: 'Completed' },
]

export function genRef(type: POType) {
  return `${type.toUpperCase()}-${Date.now().toString().slice(-6)}`
}

export function makeAudit(action: AuditAction, detail: string, meta?: Record<string, string | number>): AuditEvent {
  return { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), action, actor: 'You', timestamp: new Date().toISOString(), detail, meta }
}

export function StatusBadge({ status }: { status: POStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  )
}

export function TypeBadge({ type }: { type: POType }) {
  return type === 'mto'
    ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800"><ShoppingCart className="w-3 h-3" /> MTO</span>
    : <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800"><Package className="w-3 h-3" /> MTS</span>
}

export function PriorityDot({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} /> {cfg.label}
    </span>
  )
}

export function ProgressBar({ value, status }: { value: number; status: POStatus }) {
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
