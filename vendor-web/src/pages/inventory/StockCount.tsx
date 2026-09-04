import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { vendorApi } from '@/api/vendor'
import { apiError } from '@/lib/errorMessages'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel,
} from '@/components/ui/Modal'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  ClipboardList, Plus, Play, Send, CheckCircle2, XCircle,
  ArrowLeft, Download, Loader2, ChevronRight, AlertTriangle,
  TrendingUp, TrendingDown, Minus, RefreshCw, Eye,
} from 'lucide-react'
import { useStores } from '@/hooks/useVendor'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StockCountSummary {
  id: string
  reference_number: string
  count_type: string
  status: string
  store_id: string | null
  description: string | null
  count_date: string | null
  created_at: string
  posted_at: string | null
}

interface StockCountLine {
  id: string
  count_id: string
  product_id: string
  variant_id: string | null
  storage_location_id: string | null
  product_name: string
  sku: string
  variant_name: string
  system_qty: number
  counted_qty: number | null
  variance: number | null
  status: string
  notes: string | null
  counted_at: string | null
}

interface StockCountDetail extends StockCountSummary {
  notes: string | null
  started_at: string | null
  lines: StockCountLine[]
  summary: {
    total_lines: number
    counted_lines: number
    uncounted_lines: number
    variance_lines: number
    completion_pct: number
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COUNT_TYPE_LABELS: Record<string, string> = {
  cycle_count: 'Cycle Count',
  full_count: 'Full Physical Count',
  spot_check: 'Spot Check',
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  draft: { label: 'Draft', variant: 'outline', color: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', variant: 'default', color: 'text-blue-600' },
  counting: { label: 'Counting', variant: 'default', color: 'text-amber-600' },
  under_review: { label: 'Under Review', variant: 'secondary', color: 'text-purple-600' },
  completed: { label: 'Completed', variant: 'default', color: 'text-green-600' },
  cancelled: { label: 'Cancelled', variant: 'destructive', color: 'text-red-500' },
}

const VENDOR_KEYS_SC = {
  list: (params?: Record<string, unknown>) => ['vendor', 'stock-counts', params] as const,
  detail: (id: string) => ['vendor', 'stock-count', id] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useStockCounts(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: VENDOR_KEYS_SC.list(params),
    queryFn: () => vendorApi.listStockCounts(params),
  })
}

function useStockCountDetail(id: string | null) {
  return useQuery({
    queryKey: VENDOR_KEYS_SC.detail(id ?? ''),
    queryFn: () => vendorApi.getStockCount(id!),
    enabled: !!id,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const, color: '' }
  return (
    <Badge variant={cfg.variant} className={cn('text-xs capitalize', cfg.color)}>
      {cfg.label}
    </Badge>
  )
}

function VariancePill({ variance }: { variance: number | null }) {
  if (variance === null) return <span className="text-muted-foreground text-sm">—</span>
  if (variance === 0) return (
    <span className="inline-flex items-center gap-1 text-sm text-green-600 font-medium">
      <Minus className="h-3 w-3" /> 0
    </span>
  )
  if (variance > 0) return (
    <span className="inline-flex items-center gap-1 text-sm text-blue-600 font-semibold">
      <TrendingUp className="h-3 w-3" /> +{variance}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-sm text-red-500 font-semibold">
      <TrendingDown className="h-3 w-3" /> {variance}
    </span>
  )
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateCountModal({
  open,
  onClose,
  stores,
}: {
  open: boolean
  onClose: () => void
  stores: { id: string; name: string }[]
}) {
  const qc = useQueryClient()
  const [countType, setCountType] = useState('cycle_count')
  const [storeId, setStoreId] = useState('')
  const [description, setDescription] = useState('')
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10))

  const create = useMutation({
    mutationFn: () =>
      vendorApi.createStockCount({
        count_type: countType,
        store_id: storeId || undefined,
        description: description || undefined,
        count_date: countDate || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'stock-counts'] })
      toast.success('Stock count session created')
      onClose()
      setDescription('')
      setStoreId('')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  if (!open) return null
  return (
    <ModalOverlay open={open} onClose={onClose}>
      <ModalPanel size="md">
        <ModalHeader onClose={onClose}>New Stock Count Session</ModalHeader>
        <ModalBody className="space-y-4">
          <div className="space-y-1">
            <Label>Count Type</Label>
            <Select value={countType} onChange={(e) => setCountType(e.target.value)}>
              <option value="cycle_count">Cycle Count</option>
              <option value="full_count">Full Physical Count</option>
              <option value="spot_check">Spot Check</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Business Unit (optional)</Label>
            <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">All Locations (Global)</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              When a business unit is selected, the count will be scoped to its inventory only.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Count Date</Label>
            <Input type="date" value={countDate} onChange={(e) => setCountDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <Input
              placeholder="e.g. Q3 monthly cycle count — electronics shelf"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Session
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

// ── Session List ──────────────────────────────────────────────────────────────

function SessionList({
  onSelect,
}: {
  onSelect: (id: string) => void
}) {
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []

  const { data, isLoading, refetch } = useStockCounts(
    statusFilter ? { status: statusFilter } : undefined
  )
  const items: StockCountSummary[] = data?.items ?? []

  const storeMap = useMemo(() => {
    const m: Record<string, string> = {}
    stores.forEach((s: { id: string; name: string }) => { m[s.id] = s.name })
    return m
  }, [stores])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44 text-sm"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </Select>
          <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Count
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 gap-3 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground opacity-40" />
            <p className="font-medium text-muted-foreground">No stock count sessions yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Create a session to start counting inventory and reconciling variances.
            </p>
            <Button onClick={() => setShowCreate(true)} className="mt-2">
              <Plus className="mr-2 h-4 w-4" /> New Count
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((sc) => (
            <Card
              key={sc.id}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => onSelect(sc.id)}
            >
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <ClipboardList className="h-8 w-8 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{sc.reference_number}</span>
                    <StatusBadge status={sc.status} />
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {COUNT_TYPE_LABELS[sc.count_type] ?? sc.count_type}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {sc.description || 'No description'}
                    {sc.store_id && storeMap[sc.store_id] && (
                      <span className="ml-2 font-medium">· {storeMap[sc.store_id]}</span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <div>{fmtDate(sc.count_date ?? sc.created_at)}</div>
                  {sc.posted_at && <div className="text-green-600">Posted {fmtDate(sc.posted_at)}</div>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateCountModal open={showCreate} onClose={() => setShowCreate(false)} stores={stores} />
    </div>
  )
}

// ── Line Entry Row ────────────────────────────────────────────────────────────

function LineRow({
  line,
  editable,
  onSave,
}: {
  line: StockCountLine
  editable: boolean
  onSave: (lineId: string, qty: number, notes: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [qty, setQty] = useState<string>(line.counted_qty !== null ? String(line.counted_qty) : '')
  const [notes, setNotes] = useState(line.notes ?? '')

  function handleSave() {
    const n = parseInt(qty, 10)
    if (isNaN(n) || n < 0) { toast.error('Enter a valid quantity (0 or more)'); return }
    onSave(line.id, n, notes)
    setEditing(false)
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-2 px-3">
        <div className="font-medium text-sm">{line.product_name}</div>
        {line.variant_name && <div className="text-xs text-muted-foreground">{line.variant_name}</div>}
        {line.sku && <div className="text-xs text-muted-foreground font-mono">{line.sku}</div>}
      </td>
      <td className="py-2 px-3 text-center font-mono text-sm">{line.system_qty}</td>
      <td className="py-2 px-3 text-center">
        {editing ? (
          <Input
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-20 h-7 text-center text-sm font-mono"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          />
        ) : (
          <button
            onClick={() => editable && setEditing(true)}
            className={cn(
              'w-20 h-7 rounded border text-sm font-mono text-center',
              editable ? 'hover:bg-primary/5 hover:border-primary/40 cursor-pointer' : 'cursor-default',
              line.counted_qty === null ? 'text-muted-foreground border-dashed' : 'font-semibold'
            )}
          >
            {line.counted_qty !== null ? line.counted_qty : '—'}
          </button>
        )}
      </td>
      <td className="py-2 px-3 text-center">
        <VariancePill variance={line.variance} />
      </td>
      <td className="py-2 px-3 text-center">
        {line.status === 'counted' ? (
          <span className="text-xs text-green-600 font-medium">Counted</span>
        ) : (
          <span className="text-xs text-muted-foreground">Pending</span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <Input
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-7 w-28 text-xs"
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditing(false)}>✕</Button>
          </div>
        ) : (
          editable && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
              Enter Count
            </Button>
          )
        )}
      </td>
    </tr>
  )
}

// ── Detail View ───────────────────────────────────────────────────────────────

function CountDetail({
  countId,
  onBack,
}: {
  countId: string
  onBack: () => void
}) {
  const qc = useQueryClient()
  const { data: sc, isLoading } = useStockCountDetail(countId) as { data: StockCountDetail | undefined; isLoading: boolean }
  const [lineFilter, setLineFilter] = useState<'all' | 'pending' | 'counted' | 'variance'>('all')

  const start = useMutation({
    mutationFn: () => vendorApi.startStockCount(countId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: VENDOR_KEYS_SC.detail(countId) }); toast.success('Count started') },
    onError: (e) => toast.error(apiError(e)),
  })

  const submitReview = useMutation({
    mutationFn: () => vendorApi.submitStockCountForReview(countId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: VENDOR_KEYS_SC.detail(countId) }); toast.success('Submitted for review') },
    onError: (e) => toast.error(apiError(e)),
  })

  const post = useMutation({
    mutationFn: () => vendorApi.postStockCount(countId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: VENDOR_KEYS_SC.detail(countId) })
      qc.invalidateQueries({ queryKey: ['vendor', 'stock-counts'] })
      qc.invalidateQueries({ queryKey: ['vendor', 'inventory-summary'] })
      toast.success(`Count posted — ${res.adjustments_made} adjustments applied`)
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const cancel = useMutation({
    mutationFn: () => vendorApi.cancelStockCount(countId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VENDOR_KEYS_SC.detail(countId) })
      qc.invalidateQueries({ queryKey: ['vendor', 'stock-counts'] })
      toast.success('Count cancelled')
      onBack()
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const updateLine = useMutation({
    mutationFn: ({ lineId, qty, notes }: { lineId: string; qty: number; notes: string }) =>
      vendorApi.updateStockCountLine(countId, lineId, { counted_qty: qty, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: VENDOR_KEYS_SC.detail(countId) }),
    onError: (e) => toast.error(apiError(e)),
  })

  if (isLoading || !sc) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isEditable = sc.status === 'in_progress' || sc.status === 'counting'
  const canStart = sc.status === 'draft'
  const canReview = sc.status === 'in_progress' || sc.status === 'counting'
  const canPost = sc.status === 'counting' || sc.status === 'under_review'
  const canCancel = !['completed', 'cancelled'].includes(sc.status)

  const filteredLines = (sc.lines ?? []).filter((l) => {
    if (lineFilter === 'pending') return l.counted_qty === null
    if (lineFilter === 'counted') return l.counted_qty !== null
    if (lineFilter === 'variance') return l.variance !== null && l.variance !== 0
    return true
  })

  const summary = sc.summary ?? { total_lines: 0, counted_lines: 0, uncounted_lines: 0, variance_lines: 0, completion_pct: 0 }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{sc.reference_number}</h2>
            <StatusBadge status={sc.status} />
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {COUNT_TYPE_LABELS[sc.count_type] ?? sc.count_type}
            </span>
          </div>
          {sc.description && <p className="text-sm text-muted-foreground mt-0.5">{sc.description}</p>}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {canStart && (
            <Button onClick={() => start.mutate()} disabled={start.isPending} variant="default" size="sm">
              {start.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
              Start Counting
            </Button>
          )}
          {canReview && (
            <Button onClick={() => submitReview.mutate()} disabled={submitReview.isPending} variant="outline" size="sm">
              {submitReview.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
              Submit for Review
            </Button>
          )}
          {canPost && (
            <Button
              onClick={() => post.mutate()}
              disabled={post.isPending}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {post.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
              Post Variances
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Lines</p>
            <p className="text-2xl font-bold">{summary.total_lines}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Counted</p>
            <p className="text-2xl font-bold text-green-600">{summary.counted_lines}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-2xl font-bold text-amber-600">{summary.uncounted_lines}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Variances</p>
            <p className={cn('text-2xl font-bold', summary.variance_lines > 0 ? 'text-red-500' : 'text-muted-foreground')}>
              {summary.variance_lines}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      {summary.total_lines > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Counting progress</span>
            <span className="font-medium">{summary.completion_pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${summary.completion_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Lines table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Count Lines</CardTitle>
          <div className="flex items-center gap-2">
            {isEditable && summary.uncounted_lines > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Click any cell in the Count Qty column to enter a count
              </span>
            )}
            <div className="flex border rounded text-xs overflow-hidden">
              {(['all', 'pending', 'counted', 'variance'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLineFilter(f)}
                  className={cn(
                    'px-2 py-1 capitalize transition-colors',
                    lineFilter === f ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                >
                  {f === 'variance' ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Variances
                      {summary.variance_lines > 0 && (
                        <span className="ml-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                          {summary.variance_lines}
                        </span>
                      )}
                    </span>
                  ) : (
                    f.charAt(0).toUpperCase() + f.slice(1)
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLines.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {lineFilter === 'pending' ? 'All lines have been counted.' :
               lineFilter === 'variance' ? 'No variances found.' :
               'No lines match this filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground text-xs">Product</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">System Qty</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Count Qty</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Variance</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Status</th>
                    <th className="py-2 px-3 text-right font-medium text-muted-foreground text-xs w-40">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      editable={isEditable}
                      onSave={(lineId, qty, notes) => updateLine.mutate({ lineId, qty, notes })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post info */}
      {sc.status === 'completed' && sc.posted_at && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Variances posted to inventory on {fmtDate(sc.posted_at)}. All adjustments are visible in the movement history.
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StockCountPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        {selectedId && (
          <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Inventory Counting & Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conduct cycle counts, full physical counts, and reconcile stock variances
          </p>
        </div>
      </div>

      {selectedId ? (
        <CountDetail countId={selectedId} onBack={() => setSelectedId(null)} />
      ) : (
        <SessionList onSelect={setSelectedId} />
      )}
    </div>
  )
}
