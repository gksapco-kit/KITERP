/**
 * Profit Centers & Segments page
 */
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, TrendingUp, PieChart, RefreshCw } from 'lucide-react'
import {
  useProfitCenters,
  useCreateProfitCenter,
  useUpdateProfitCenter,
  useDeleteProfitCenter,
  useProfitCenterPnl,
  useSegments,
  useCreateSegment,
  useDeleteSegment,
  useSegmentPnl,
} from '@/hooks/useFinance'
import type { ProfitCenter, Segment, PnlRow } from '@/api/finance'

// ── Formatting ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'decimal', maximumFractionDigits: 2 }).format(n)

const PnlBar = ({ income, expense, net }: { income: number; expense: number; net: number }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="text-emerald-600">▲ {fmt(income)}</span>
    <span className="text-red-500">▼ {fmt(expense)}</span>
    <span className={`font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
      Net: {fmt(net)}
    </span>
  </div>
)

// ── Date range helper ─────────────────────────────────────────────────────────
const today = new Date()
const fyStart = new Date(today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1, 3, 1)
const fyEnd   = new Date(fyStart.getFullYear() + 1, 2, 31)
const toISO = (d: Date) => d.toISOString().slice(0, 10)

// ── Profit Centers tab ────────────────────────────────────────────────────────
type PcForm = Omit<ProfitCenter, 'id' | 'is_active'>
const BLANK_PC: PcForm = { code: '', name: '', description: null, parent_id: null, manager: null }

function ProfitCentersTab() {
  const { data: centers = [], isLoading } = useProfitCenters()
  const createMut = useCreateProfitCenter()
  const updateMut = useUpdateProfitCenter()
  const deleteMut = useDeleteProfitCenter()
  const [dateRange] = useState({ from_date: toISO(fyStart), to_date: toISO(fyEnd) })
  const { data: pnl = [] } = useProfitCenterPnl(dateRange)
  const pnlMap = Object.fromEntries(pnl.map(r => [r.dimension_id ?? 'null', r]))

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProfitCenter | null>(null)
  const [form, setForm] = useState<PcForm>(BLANK_PC)

  const openNew = () => { setEditing(null); setForm(BLANK_PC); setOpen(true) }
  const openEdit = (pc: ProfitCenter) => {
    setEditing(pc)
    setForm({ code: pc.code, name: pc.name, description: pc.description,
              parent_id: pc.parent_id, manager: pc.manager })
    setOpen(true)
  }
  const handleSave = async () => {
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data: form })
    } else {
      await createMut.mutateAsync(form)
    }
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Profit centers enable internal P&L reporting at a finer granularity than cost centres.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Profit Center
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : centers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No profit centers yet. Create one to start tracking internal P&L.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Code', 'Name', 'Manager', 'P&L (current FY)', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {centers.map(pc => {
                const row: PnlRow | undefined = pnlMap[pc.id]
                return (
                  <tr key={pc.id} className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openEdit(pc)}>
                    <td className="px-3 py-2 font-mono font-medium">{pc.code}</td>
                    <td className="px-3 py-2">{pc.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{pc.manager ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row ? (
                        <PnlBar income={row.income} expense={row.expense} net={row.net} />
                      ) : (
                        <span className="text-muted-foreground text-xs">No postings</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={e => { e.stopPropagation(); deleteMut.mutate(pc.id) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'New'} Profit Center</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Manager (optional)</Label>
                <Input value={form.manager ?? ''} onChange={e => setForm(f => ({ ...f, manager: e.target.value || null }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={form.description ?? ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.code || !form.name}>
              {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Segments tab ──────────────────────────────────────────────────────────────
type SegForm = Omit<Segment, 'id' | 'is_active'>
const BLANK_SEG: SegForm = { code: '', name: '', description: null }

function SegmentsTab() {
  const { data: segments = [], isLoading } = useSegments()
  const createMut = useCreateSegment()
  const deleteMut = useDeleteSegment()
  const [dateRange] = useState({ from_date: toISO(fyStart), to_date: toISO(fyEnd) })
  const { data: pnl = [] } = useSegmentPnl(dateRange)
  const pnlMap = Object.fromEntries(pnl.map(r => [r.dimension_id ?? 'null', r]))

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SegForm>(BLANK_SEG)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Segments support IFRS 8 operating-segment disclosure and top-level management reporting.
        </p>
        <Button size="sm" onClick={() => { setForm(BLANK_SEG); setOpen(true) }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Segment
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : segments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No segments yet. Create one to start segment reporting.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Code', 'Name', 'Description', 'P&L (current FY)', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segments.map(seg => {
                const row: PnlRow | undefined = pnlMap[seg.id]
                return (
                  <tr key={seg.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-mono font-medium">{seg.code}</td>
                    <td className="px-3 py-2">{seg.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{seg.description ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row ? (
                        <PnlBar income={row.income} expense={row.expense} net={row.net} />
                      ) : (
                        <span className="text-muted-foreground text-xs">No postings</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => deleteMut.mutate(seg.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Segment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={form.description ?? ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={async () => { await createMut.mutateAsync(form); setOpen(false) }}
              disabled={!form.code || !form.name}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfitCenters() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Profit Centers & Segments
        </h1>
        <p className="text-muted-foreground mt-1">
          Define internal P&L reporting units (profit centres) and top-level dimensions (segments).
        </p>
      </div>

      <Tabs defaultValue="profit-centers">
        <TabsList>
          <TabsTrigger value="profit-centers" className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Profit Centers
          </TabsTrigger>
          <TabsTrigger value="segments" className="flex items-center gap-1.5">
            <PieChart className="h-3.5 w-3.5" />
            Segments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profit-centers" className="mt-4">
          <ProfitCentersTab />
        </TabsContent>
        <TabsContent value="segments" className="mt-4">
          <SegmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
