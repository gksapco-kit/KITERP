/**
 * Posting Rules page: Validation rules, Substitution rules, Number Ranges.
 */
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  SelectRoot as Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, CheckCircle, ArrowRightLeft, Hash, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  useValidationRules,
  useCreateValidationRule,
  useUpdateValidationRule,
  useDeleteValidationRule,
  useSubstitutionRules,
  useCreateSubstitutionRule,
  useDeleteSubstitutionRule,
  useNumberRanges,
  useSeedNumberRanges,
  useCreateNumberRange,
} from '@/hooks/useFinance'
import type { ValidationRule, SubstitutionRule, NumberRange } from '@/api/finance'

const currYear = new Date().getFullYear()

// ── Validation Rules tab ──────────────────────────────────────────────────────
type VRForm = Omit<ValidationRule, 'id' | 'is_active'>
const BLANK_VR: VRForm = {
  name: '', description: null, call_point: 'document',
  prerequisite_expr: null, check_expr: '', error_message: '', sort_order: 10,
}

function ValidationsTab() {
  const { data: rules = [], isLoading } = useValidationRules()
  const create = useCreateValidationRule()
  const update = useUpdateValidationRule()
  const del = useDeleteValidationRule()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ValidationRule | null>(null)
  const [form, setForm] = useState<VRForm>(BLANK_VR)

  const openNew = () => { setEditing(null); setForm(BLANK_VR); setOpen(true) }
  const openEdit = (r: ValidationRule) => {
    setEditing(r)
    setForm({ name: r.name, description: r.description, call_point: r.call_point,
               prerequisite_expr: r.prerequisite_expr, check_expr: r.check_expr,
               error_message: r.error_message, sort_order: r.sort_order })
    setOpen(true)
  }
  const isSaving = create.isPending || update.isPending

  const fmtErr = (e: any) => {
    const d = e?.response?.data?.detail
    if (!d) return 'Save failed'
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((x: any) => x?.msg ?? JSON.stringify(x)).join('; ')
    return JSON.stringify(d)
  }

  const handleSave = async () => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: form })
      else await create.mutateAsync(form)
      toast.success(editing ? 'Rule updated.' : 'Rule created.')
      setOpen(false)
    } catch (e: any) {
      toast.error(fmtErr(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define conditions that must hold true for every posting. If a check fails the document is rejected.
        </p>
        <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1.5" />New Rule</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>{['#', 'Name', 'Point', 'Check expression', 'Active', ''].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(r)}>
                  <td className="px-3 py-2 text-muted-foreground">{r.sort_order}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{r.call_point}</Badge></td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[200px]">{r.check_expr}</td>
                  <td className="px-3 py-2"><Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'active' : 'off'}</Badge></td>
                  <td className="px-3 py-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={e => { e.stopPropagation(); del.mutate(r.id) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No rules yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Validation Rule</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Call Point</Label>
                <Select value={form.call_point} onValueChange={v => setForm(f => ({ ...f, call_point: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Prerequisite expression (optional) — when False, rule is skipped</Label>
              <Input placeholder="e.g. total_debit > 0" value={form.prerequisite_expr ?? ''}
                onChange={e => setForm(f => ({ ...f, prerequisite_expr: e.target.value || null }))} />
            </div>
            <div className="space-y-1">
              <Label>Check expression — must evaluate to True</Label>
              <Input placeholder='e.g. total_debit == total_credit' value={form.check_expr}
                onChange={e => setForm(f => ({ ...f, check_expr: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Error message shown when check fails</Label>
              <Input value={form.error_message} onChange={e => setForm(f => ({ ...f, error_message: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.check_expr || isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Substitution Rules tab ────────────────────────────────────────────────────
type SRForm = Omit<SubstitutionRule, 'id' | 'is_active'>
const BLANK_SR: SRForm = {
  name: '', description: null, call_point: 'line', prerequisite_expr: null,
  target_field: '', substitution_expr: '', sort_order: 10,
}

function SubstitutionsTab() {
  const { data: rules = [], isLoading } = useSubstitutionRules()
  const create = useCreateSubstitutionRule()
  const del = useDeleteSubstitutionRule()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SRForm>(BLANK_SR)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Silently replace field values before a line is saved — e.g. default cost centre based on account.
        </p>
        <Button size="sm" onClick={() => { setForm(BLANK_SR); setOpen(true) }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />New Rule
        </Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>{['#', 'Name', 'Point', 'Target field', 'Expression', ''].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground">{r.sort_order}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{r.call_point}</Badge></td>
                  <td className="px-3 py-2 font-mono text-xs">{r.target_field}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[200px]">{r.substitution_expr}</td>
                  <td className="px-3 py-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => del.mutate(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No rules yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Substitution Rule</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Call Point</Label>
                <Select value={form.call_point} onValueChange={v => setForm(f => ({ ...f, call_point: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Prerequisite expression (optional)</Label>
              <Input placeholder="e.g. account_type == 'expense'" value={form.prerequisite_expr ?? ''}
                onChange={e => setForm(f => ({ ...f, prerequisite_expr: e.target.value || null }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Target field</Label>
                <Input placeholder="cost_center_id" value={form.target_field}
                  onChange={e => setForm(f => ({ ...f, target_field: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Substitution expression</Label>
              <Input placeholder='e.g. "default-cc-id"' value={form.substitution_expr}
                onChange={e => setForm(f => ({ ...f, substitution_expr: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>Cancel</Button>
            <Button
              disabled={!form.name || !form.target_field || !form.substitution_expr || create.isPending}
              onClick={async () => {
                try {
                  await create.mutateAsync(form)
                  toast.success('Substitution rule created.')
                  setOpen(false)
                } catch (e: any) {
                  const d = e?.response?.data?.detail
                  toast.error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: any) => x?.msg ?? '').join('; ') : 'Failed to create rule')
                }
              }}
            >
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Number Ranges tab ─────────────────────────────────────────────────────────
type NRForm = Omit<NumberRange, 'id' | 'current_number'>
const BLANK_NR: NRForm = {
  document_type: 'SA', fiscal_year: currYear,
  number_from: 1000000, number_to: 1999999, prefix: null, is_external: false,
}

function NumberRangesTab() {
  const { data: ranges = [], isLoading } = useNumberRanges()
  const seed = useSeedNumberRanges()
  const create = useCreateNumberRange()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NRForm>(BLANK_NR)
  const [seedFy, setSeedFy] = useState(currYear)

  const pct = (nr: NumberRange) => {
    const used = nr.current_number - nr.number_from
    const total = nr.number_to - nr.number_from
    return total > 0 ? Math.round((used / total) * 100) : 0
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define document number series per type and fiscal year.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input type="number" className="w-24 h-8 text-sm" value={seedFy}
              onChange={e => setSeedFy(parseInt(e.target.value))} />
            <Button size="sm" variant="outline" onClick={() => seed.mutate(seedFy)} disabled={seed.isPending}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Seed FY
            </Button>
          </div>
          <Button size="sm" onClick={() => { setForm(BLANK_NR); setOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />New
          </Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>{['Type', 'FY', 'Prefix', 'From', 'To', 'Current', 'Usage', 'Mode'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {ranges.map(nr => (
                <tr key={nr.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono font-medium">{nr.document_type}</td>
                  <td className="px-3 py-2">{nr.fiscal_year}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{nr.prefix ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{nr.number_from.toLocaleString()}</td>
                  <td className="px-3 py-2 text-muted-foreground">{nr.number_to.toLocaleString()}</td>
                  <td className="px-3 py-2 font-medium">{nr.current_number.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct(nr)}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{pct(nr)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={nr.is_external ? 'secondary' : 'default'}>
                      {nr.is_external ? 'external' : 'internal'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {ranges.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No number ranges yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Number Range</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Document Type</Label>
                <Input placeholder="SA" value={form.document_type}
                  onChange={e => setForm(f => ({ ...f, document_type: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1">
                <Label>Fiscal Year</Label>
                <Input type="number" value={form.fiscal_year}
                  onChange={e => setForm(f => ({ ...f, fiscal_year: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="number" value={form.number_from}
                  onChange={e => setForm(f => ({ ...f, number_from: parseInt(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="number" value={form.number_to}
                  onChange={e => setForm(f => ({ ...f, number_to: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Prefix (optional)</Label>
              <Input placeholder="e.g. INV" value={form.prefix ?? ''}
                onChange={e => setForm(f => ({ ...f, prefix: e.target.value || null }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>Cancel</Button>
            <Button
              disabled={!form.document_type || create.isPending}
              onClick={async () => {
                try {
                  await create.mutateAsync(form)
                  toast.success('Number range created.')
                  setOpen(false)
                } catch (e: any) {
                  const d = e?.response?.data?.detail
                  toast.error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: any) => x?.msg ?? '').join('; ') : 'Failed to create number range')
                }
              }}
            >
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PostingRules() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-primary" />
          Posting Rules & Number Ranges
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure validation rules, substitutions, and document number series.
        </p>
      </div>

      <Tabs defaultValue="validations">
        <TabsList>
          <TabsTrigger value="validations" className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            Validation Rules
          </TabsTrigger>
          <TabsTrigger value="substitutions" className="flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Substitution Rules
          </TabsTrigger>
          <TabsTrigger value="number-ranges" className="flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5" />
            Number Ranges
          </TabsTrigger>
        </TabsList>

        <TabsContent value="validations" className="mt-4"><ValidationsTab /></TabsContent>
        <TabsContent value="substitutions" className="mt-4"><SubstitutionsTab /></TabsContent>
        <TabsContent value="number-ranges" className="mt-4"><NumberRangesTab /></TabsContent>
      </Tabs>
    </div>
  )
}
