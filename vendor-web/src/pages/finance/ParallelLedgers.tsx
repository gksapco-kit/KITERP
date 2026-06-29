/**
 * Parallel Ledgers / Multi-GAAP page.
 * Configure named ledgers (Leading, IFRS, Tax, …), assign them to companies,
 * and view per-ledger trial balances.
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
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, BookMarked, BarChart3 } from 'lucide-react'
import {
  useLedgers, useCreateLedger, useUpdateLedger, useDeleteLedger,
  useLedgerTrialBalance,
} from '@/hooks/useFinance'
import type { Ledger, LedgerTrialBalanceRow } from '@/api/finance'

type LedgerForm = Omit<Ledger, 'id' | 'is_active'>
const BLANK: LedgerForm = { code: '', name: '', description: null, is_leading: false, currency: 'INR' }

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'SGD', 'JPY', 'CNY']

// ── Ledger card ───────────────────────────────────────────────────────────────
function LedgerCard({
  ledger, onDelete, onToggleActive,
}: {
  ledger: Ledger
  onDelete: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
}) {
  return (
    <Card className={ledger.is_leading ? 'border-primary/50 bg-primary/5' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-primary" />
            <span>{ledger.name}</span>
            {ledger.is_leading && <Badge>Leading</Badge>}
          </span>
          {!ledger.is_leading && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
              onClick={() => onDelete(ledger.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-24">Code:</span>
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{ledger.code}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-24">Currency:</span>
          <Badge variant="outline">{ledger.currency}</Badge>
        </div>
        {ledger.description && (
          <p className="text-muted-foreground text-xs">{ledger.description}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-muted-foreground w-24">Active:</span>
          <Switch
            checked={ledger.is_active}
            onCheckedChange={v => onToggleActive(ledger.id, v)}
            disabled={ledger.is_leading}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Trial balance panel ────────────────────────────────────────────────────────
function TrialBalancePanel({ ledgers }: { ledgers: Ledger[] }) {
  const [selectedId, setSelectedId] = useState<string>('')
  const { data: rows = [], isLoading } = useLedgerTrialBalance(selectedId || null)

  const totalDebit  = rows.reduce((s, r) => s + parseFloat(r.debit),  0)
  const totalCredit = rows.reduce((s, r) => s + parseFloat(r.credit), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select ledger…" />
          </SelectTrigger>
          <SelectContent>
            {ledgers.map(l => (
              <SelectItem key={l.id} value={l.id}>
                {l.name} {l.is_leading ? '(Leading)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedId && isLoading && (
          <span className="text-sm text-muted-foreground">Loading…</span>
        )}
      </div>

      {selectedId && !isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No posted entries for this ledger.</p>
      )}

      {rows.length > 0 && (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {['Code', 'Account', 'Type', 'Debit', 'Credit', 'Net'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r: LedgerTrialBalanceRow) => (
                <tr key={r.account_id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs font-medium">{r.account_code}</td>
                  <td className="px-3 py-2">{r.account_name}</td>
                  <td className="px-3 py-2"><Badge variant="secondary" className="text-xs">{r.account_type}</Badge></td>
                  <td className="px-3 py-2 text-emerald-600 font-mono">{parseFloat(r.debit) > 0 ? r.debit : '—'}</td>
                  <td className="px-3 py-2 text-red-500 font-mono">{parseFloat(r.credit) > 0 ? r.credit : '—'}</td>
                  <td className={`px-3 py-2 font-mono font-medium ${parseFloat(r.net) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {r.net}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50 font-semibold text-sm">
              <tr className="border-t-2">
                <td colSpan={3} className="px-3 py-2 text-right">Totals</td>
                <td className="px-3 py-2 text-emerald-600 font-mono">{totalDebit.toFixed(4)}</td>
                <td className="px-3 py-2 text-red-500 font-mono">{totalCredit.toFixed(4)}</td>
                <td className="px-3 py-2 font-mono">
                  {(totalDebit - totalCredit).toFixed(4)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ParallelLedgers() {
  const { data: ledgers = [], isLoading } = useLedgers()
  const create = useCreateLedger()
  const update = useUpdateLedger()
  const del    = useDeleteLedger()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<LedgerForm>(BLANK)

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-primary" />
          Parallel Ledgers
        </h1>
        <p className="text-muted-foreground mt-1">
          Maintain multiple accounting views (Local GAAP, IFRS, Tax) on the same transaction data.
        </p>
      </div>

      {/* Ledger cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ledgers</h2>
          <Button size="sm" onClick={() => { setForm(BLANK); setOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Ledger
          </Button>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          ledgers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No ledgers configured. Create a leading ledger first.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ledgers.map(l => (
                <LedgerCard
                  key={l.id}
                  ledger={l}
                  onDelete={id => del.mutate(id)}
                  onToggleActive={(id, v) => update.mutate({ id, data: { is_active: v } })}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Trial Balance per ledger */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Trial Balance by Ledger
        </h2>
        <TrialBalancePanel ledgers={ledgers} />
      </div>

      {/* New ledger dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Ledger</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code</Label>
                <Input maxLength={10} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_leading}
                onCheckedChange={v => setForm(f => ({ ...f, is_leading: v }))}
              />
              <Label>Mark as Leading Ledger</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => { await create.mutateAsync(form); setOpen(false) }}
              disabled={!form.code || !form.name}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
