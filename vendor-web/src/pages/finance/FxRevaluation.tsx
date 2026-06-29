/**
 * FX Revaluation & Year-End Carry-Forward page.
 */
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { RefreshCw, DollarSign, ArrowRightLeft, Calendar } from 'lucide-react'
import {
  useExchangeRates,
  useUpsertExchangeRate,
  useFxRevalRuns,
  useSimulateFxReval,
  useCarryForwards,
  useRunCarryForward,
} from '@/hooks/useFinance'

const today = new Date().toISOString().slice(0, 10)

// ── Exchange Rates tab ───────────────────────────────────────────────────────
function ExchangeRatesTab() {
  const { data: rates = [], isLoading } = useExchangeRates()
  const upsert = useUpsertExchangeRate()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    from_currency: '', to_currency: 'INR', rate: '', rate_date: today, rate_type: 'M',
  })

  const handleSave = async () => {
    await upsert.mutateAsync({
      from_currency: form.from_currency,
      to_currency: form.to_currency,
      rate: parseFloat(form.rate),
      rate_date: form.rate_date,
      rate_type: form.rate_type,
    })
    setOpen(false)
    setForm({ from_currency: '', to_currency: 'INR', rate: '', rate_date: today, rate_type: 'M' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Maintain daily or period exchange rates used for FX revaluation and multi-currency postings.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Add / Update Rate
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['From', 'To', 'Type', 'Rate', 'Date'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rates.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-mono font-medium">{r.from_currency}</td>
                  <td className="px-3 py-2 font-mono">{r.to_currency}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{r.rate_type}</Badge>
                  </td>
                  <td className="px-3 py-2">{r.rate}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.rate_date}</td>
                </tr>
              ))}
              {rates.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No rates yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add / Update Exchange Rate</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>From</Label>
                <Input placeholder="USD" value={form.from_currency}
                  onChange={e => setForm(f => ({ ...f, from_currency: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input placeholder="INR" value={form.to_currency}
                  onChange={e => setForm(f => ({ ...f, to_currency: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.rate_type} onValueChange={v => setForm(f => ({ ...f, rate_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['M', 'B', 'S', 'P'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Rate</Label>
                <Input type="number" step="0.0001" placeholder="83.50"
                  value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.rate_date}
                  onChange={e => setForm(f => ({ ...f, rate_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.from_currency || !form.rate || upsert.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── FX Revaluation tab ───────────────────────────────────────────────────────
function FxRevalTab() {
  const { data: runs = [], isLoading } = useFxRevalRuns()
  const simulate = useSimulateFxReval()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ currency: '', run_date: today, local_currency: 'INR', rate_type: 'M' })

  const handleRun = async () => {
    await simulate.mutateAsync(form)
    setOpen(false)
  }

  const statusColor = (s: string) =>
    s === 'posted' ? 'default' : s === 'reversed' ? 'destructive' : 'secondary'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Revalue open foreign-currency items at the current exchange rate.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
          Run Revaluation
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Run Date', 'Currency', 'Rate', 'Total Gain', 'Total Loss', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2">{r.run_date}</td>
                  <td className="px-3 py-2 font-mono font-medium">{r.currency}</td>
                  <td className="px-3 py-2">{r.rate_used}</td>
                  <td className="px-3 py-2 text-emerald-600">+{r.total_gain}</td>
                  <td className="px-3 py-2 text-red-500">-{r.total_loss}</td>
                  <td className="px-3 py-2"><Badge variant={statusColor(r.status)}>{r.status}</Badge></td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No revaluation runs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Run FX Revaluation</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label>Foreign Currency</Label>
              <Input placeholder="USD" value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Run Date</Label>
                <Input type="date" value={form.run_date}
                  onChange={e => setForm(f => ({ ...f, run_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Local Currency</Label>
                <Input value={form.local_currency}
                  onChange={e => setForm(f => ({ ...f, local_currency: e.target.value.toUpperCase() }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleRun} disabled={!form.currency || simulate.isPending}>Run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Year-End Carry-Forward tab ───────────────────────────────────────────────
function CarryForwardTab() {
  const currYear = new Date().getFullYear()
  const { data: cfs = [], isLoading } = useCarryForwards()
  const run = useRunCarryForward()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    from_fiscal_year: currYear - 1,
    to_fiscal_year: currYear,
  })
  const [result, setResult] = useState<{ carried_accounts: number } | null>(null)

  const handleRun = async () => {
    const res = await run.mutateAsync(form)
    setResult(res)
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Carry balance-sheet account closing balances forward as opening balances for the new fiscal year.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Calendar className="h-3.5 w-3.5 mr-1.5" />
          Run Carry-Forward
        </Button>
      </div>

      {result && (
        <Card className="border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="py-3 text-sm text-emerald-700 dark:text-emerald-300">
            Successfully carried forward {result.carried_accounts} account(s).
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['From FY', 'To FY', 'Account', 'Closing Balance', 'Carried At'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cfs.map(cf => (
                <tr key={cf.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2">{cf.from_fiscal_year}</td>
                  <td className="px-3 py-2">{cf.to_fiscal_year}</td>
                  <td className="px-3 py-2 font-mono text-xs">{cf.account_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2 font-medium">{cf.closing_balance}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {cf.carried_forward_at ? new Date(cf.carried_forward_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {cfs.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No carry-forwards yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Year-End Balance Carry-Forward</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label>From Fiscal Year</Label>
              <Input type="number" value={form.from_fiscal_year}
                onChange={e => setForm(f => ({ ...f, from_fiscal_year: parseInt(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>To Fiscal Year</Label>
              <Input type="number" value={form.to_fiscal_year}
                onChange={e => setForm(f => ({ ...f, to_fiscal_year: parseInt(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleRun} disabled={run.isPending}>
              {run.isPending ? 'Running…' : 'Execute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FxRevaluation() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" />
          FX Revaluation & Year-End Close
        </h1>
        <p className="text-muted-foreground mt-1">
          Maintain exchange rates, run FX revaluation, and carry year-end balances forward.
        </p>
      </div>

      <Tabs defaultValue="rates">
        <TabsList>
          <TabsTrigger value="rates" className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Exchange Rates
          </TabsTrigger>
          <TabsTrigger value="reval" className="flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            FX Revaluation
          </TabsTrigger>
          <TabsTrigger value="carry-forward" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Year-End Carry-Forward
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="mt-4"><ExchangeRatesTab /></TabsContent>
        <TabsContent value="reval" className="mt-4"><FxRevalTab /></TabsContent>
        <TabsContent value="carry-forward" className="mt-4"><CarryForwardTab /></TabsContent>
      </Tabs>
    </div>
  )
}
