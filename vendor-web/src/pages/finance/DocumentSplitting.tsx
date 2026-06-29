/**
 * Document Splitting page.
 * Allows configuring split rules and inspecting split items per JE.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SelectRoot as Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, GitBranch } from 'lucide-react'
import { useSplitRules, useCreateSplitRule, useDeleteSplitRule, useSplitItems } from '@/hooks/useFinance'
import type { SplitRule } from '@/api/finance'
import { toast } from 'sonner'

const ACCOUNT_TYPES = ['expense', 'income', 'asset', 'liability', 'equity']
const DIMENSIONS    = ['profit_center', 'segment', 'cost_center']

type SRForm = Omit<SplitRule, 'id' | 'is_active'>
const BLANK: SRForm = { name: '', dimension: 'profit_center', base_account_types: ['expense'], split_method: 'proportional' }

function SplitRuleCard({ rule, onDelete }: { rule: SplitRule; onDelete: (id: string) => void }) {
  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{rule.name}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
            onClick={() => onDelete(rule.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Dimension:</span>
          <Badge variant="default">{rule.dimension.replace('_', ' ')}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Method:</span>
          <Badge variant="secondary">{rule.split_method}</Badge>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-28">Base types:</span>
          <div className="flex flex-wrap gap-1">
            {rule.base_account_types.map(t => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Status:</span>
          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
            {rule.is_active ? 'active' : 'inactive'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function SplitItemsInspector() {
  const [jeId, setJeId] = useState('')
  const [query, setQuery] = useState<string | null>(null)
  const { data: items = [], isLoading } = useSplitItems(query)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          className="max-w-sm"
          placeholder="Journal entry UUID…"
          value={jeId}
          onChange={e => setJeId(e.target.value)}
        />
        <Button size="sm" onClick={() => setQuery(jeId.trim() || null)}>
          Inspect
        </Button>
      </div>

      {query && isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {query && !isLoading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">No split items for this journal entry.</p>
      )}
      {items.length > 0 && (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Line', 'Profit Center', 'Segment', 'Debit', 'Credit', 'Split %'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{item.journal_line_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{item.profit_center_id ? item.profit_center_id.slice(0, 8) + '…' : '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{item.segment_id ? item.segment_id.slice(0, 8) + '…' : '—'}</td>
                  <td className="px-3 py-2 text-emerald-600">{item.debit !== '0.0000' ? item.debit : '—'}</td>
                  <td className="px-3 py-2 text-red-500">{item.credit !== '0.0000' ? item.credit : '—'}</td>
                  <td className="px-3 py-2 font-medium">{item.split_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DocumentSplitting() {
  const { data: rules = [], isLoading } = useSplitRules()
  const create = useCreateSplitRule()
  const del = useDeleteSplitRule()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SRForm>(BLANK)

  const toggleType = (t: string) => {
    setForm(f => ({
      ...f,
      base_account_types: f.base_account_types.includes(t)
        ? f.base_account_types.filter(x => x !== t)
        : [...f.base_account_types, t],
    }))
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-primary" />
          Document Splitting
        </h1>
        <p className="text-muted-foreground mt-1">
          Automatically apportion clearing lines (bank, tax) proportionally across profit centres or segments.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Split Rules</h2>
          <Button size="sm" onClick={() => { setForm(BLANK); setOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Rule
          </Button>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          rules.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No split rules configured. Create one to enable automatic document splitting.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.map(r => (
                <SplitRuleCard key={r.id} rule={r} onDelete={id => del.mutate(id)} />
              ))}
            </div>
          )
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Inspect Split Items</h2>
        <SplitItemsInspector />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Split Rule</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label>Rule Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Dimension</Label>
                <Select value={form.dimension} onValueChange={v => setForm(f => ({ ...f, dimension: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIMENSIONS.map(d => <SelectItem key={d} value={d}>{d.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Method</Label>
                <Select value={form.split_method} onValueChange={v => setForm(f => ({ ...f, split_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proportional">Proportional</SelectItem>
                    <SelectItem value="equal">Equal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Base Account Types (allocation source)</Label>
              <div className="grid grid-cols-2 gap-2">
                {ACCOUNT_TYPES.map(t => (
                  <div key={t} className="flex items-center gap-2">
                    <Checkbox
                      checked={form.base_account_types.includes(t)}
                      onCheckedChange={() => toggleType(t)}
                    />
                    <span className="text-sm">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>Cancel</Button>
            <Button
              disabled={!form.name || form.base_account_types.length === 0 || create.isPending}
              onClick={async () => {
                try {
                  await create.mutateAsync(form)
                  toast.success('Split rule created.')
                  setOpen(false)
                } catch (e: any) {
                  const detail = e?.response?.data?.detail
                  const msg = typeof detail === 'string' ? detail
                    : Array.isArray(detail) ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
                    : 'Failed to create split rule'
                  toast.error(msg)
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
