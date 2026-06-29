/**
 * PostingControls page
 * Manages: Posting Keys · Field Status Groups · Tolerance Groups
 */
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SelectRoot as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Plus, RefreshCw, Key, ShieldCheck, Shield, Sliders } from 'lucide-react'
import {
  usePostingKeys,
  useSeedPostingKeys,
  useCreatePostingKey,
  useDeletePostingKey,
  useFieldStatusGroups,
  useSeedFieldStatusGroups,
  useDeleteFieldStatusGroup,
  useToleranceGroups,
  useSeedToleranceGroup,
  useCreateToleranceGroup,
  useUpdateToleranceGroup,
  useDeleteToleranceGroup,
} from '@/hooks/useFinance'
import type { PostingKey, FieldStatusGroup, ToleranceGroup } from '@/api/finance'

// ── Posting Keys tab ────────────────────────────────────────────────────────
function PostingKeysTab() {
  const { data: keys = [], isLoading } = usePostingKeys()
  const seed = useSeedPostingKeys()
  const del = useDeletePostingKey()
  const create = useCreatePostingKey()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Omit<PostingKey, 'id' | 'is_active'>>({
    code: '', name: '', side: 'debit', account_type: null, reversal_key: null,
  })

  const handleCreate = async () => {
    await create.mutateAsync(form)
    setOpen(false)
    setForm({ code: '', name: '', side: 'debit', account_type: null, reversal_key: null })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Posting keys define the debit/credit side of a journal line and control field behaviour.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => seed.mutate(undefined)} disabled={seed.isPending}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Seed defaults
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Code', 'Name', 'Side', 'Account Type', 'Reversal Key', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map(pk => (
                <tr key={pk.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-mono font-medium">{pk.code}</td>
                  <td className="px-3 py-2">{pk.name}</td>
                  <td className="px-3 py-2">
                    <Badge variant={pk.side === 'debit' ? 'default' : 'secondary'}>
                      {pk.side}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{pk.account_type ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{pk.reversal_key ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => del.mutate(pk.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Posting Key</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code</Label>
                <Input placeholder="e.g. 40" value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Side</Label>
                <Select value={form.side} onValueChange={v => setForm(f => ({ ...f, side: v as 'debit' | 'credit' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input placeholder="e.g. GL Debit" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Account Type (optional)</Label>
                <Input placeholder="asset / income / …" value={form.account_type ?? ''}
                  onChange={e => setForm(f => ({ ...f, account_type: e.target.value || null }))} />
              </div>
              <div className="space-y-1">
                <Label>Reversal Key (optional)</Label>
                <Input placeholder="e.g. 50" value={form.reversal_key ?? ''}
                  onChange={e => setForm(f => ({ ...f, reversal_key: e.target.value || null }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.code || !form.name || create.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Field Status Groups tab ─────────────────────────────────────────────────
const FSG_FIELDS = ['cost_center', 'project', 'assignment', 'text', 'payment_terms', 'tax_code']
const STATUS_OPTIONS = ['required', 'optional', 'suppressed'] as const

function FieldStatusGroupsTab() {
  const { data: groups = [], isLoading } = useFieldStatusGroups()
  const seed = useSeedFieldStatusGroups()
  const del = useDeleteFieldStatusGroup()
  const [selected, setSelected] = useState<FieldStatusGroup | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Field Status Groups control which line fields are required, optional, or suppressed on GL accounts.
        </p>
        <Button size="sm" variant="outline" onClick={() => seed.mutate(undefined)} disabled={seed.isPending}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Seed defaults
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {groups.map(g => (
              <div
                key={g.id}
                className={`rounded-lg border p-3 cursor-pointer hover:border-primary transition-colors ${selected?.id === g.id ? 'border-primary bg-primary/5' : ''}`}
                onClick={() => setSelected(g)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium font-mono text-sm">{g.code}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                    onClick={e => { e.stopPropagation(); del.mutate(g.id) }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{g.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{g.rules.length} rule(s)</p>
              </div>
            ))}
          </div>

          {selected && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{selected.code} — {selected.name}</CardTitle>
                <CardDescription>Field rules</CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left pb-2 text-muted-foreground font-medium">Field</th>
                      <th className="text-left pb-2 text-muted-foreground font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FSG_FIELDS.map(field => {
                      const rule = selected.rules.find(r => r.field_name === field)
                      const status = rule?.status ?? 'optional'
                      return (
                        <tr key={field} className="border-t">
                          <td className="py-1.5 font-mono">{field}</td>
                          <td className="py-1.5">
                            <Badge variant={
                              status === 'required' ? 'default' :
                              status === 'suppressed' ? 'destructive' : 'secondary'
                            }>
                              {status}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tolerance Groups tab ────────────────────────────────────────────────────
type TgForm = Omit<ToleranceGroup, 'id'>

const BLANK_TG: TgForm = {
  code: '', name: '', max_line_amount: null, max_document_amount: null,
  payment_diff_abs: null, payment_diff_pct: null, currency: 'INR',
}

function ToleranceGroupsTab() {
  const { data: groups = [], isLoading } = useToleranceGroups()
  const seed = useSeedToleranceGroup()
  const create = useCreateToleranceGroup()
  const update = useUpdateToleranceGroup()
  const del = useDeleteToleranceGroup()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ToleranceGroup | null>(null)
  const [form, setForm] = useState<TgForm>(BLANK_TG)

  const openNew = () => { setEditing(null); setForm(BLANK_TG); setOpen(true) }
  const openEdit = (g: ToleranceGroup) => {
    setEditing(g)
    setForm({ code: g.code, name: g.name, max_line_amount: g.max_line_amount,
              max_document_amount: g.max_document_amount, payment_diff_abs: g.payment_diff_abs,
              payment_diff_pct: g.payment_diff_pct, currency: g.currency })
    setOpen(true)
  }

  const handleSave = async () => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, data: form })
    } else {
      await create.mutateAsync(form)
    }
    setOpen(false)
  }

  const numField = (label: string, key: keyof TgForm) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        placeholder="unlimited"
        value={form[key] == null ? '' : String(form[key])}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value === '' ? null : parseFloat(e.target.value) }))}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tolerance groups define per-user or company-wide limits on posting amounts and payment differences.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => seed.mutate(undefined)} disabled={seed.isPending}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Seed default
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Code', 'Name', 'Max Line', 'Max Document', 'Pay. Diff (abs)', 'Pay. Diff (%)', 'Currency', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id} className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => openEdit(g)}>
                  <td className="px-3 py-2 font-mono">{g.code || '(default)'}</td>
                  <td className="px-3 py-2">{g.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.max_line_amount ?? '∞'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.max_document_amount ?? '∞'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.payment_diff_abs ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.payment_diff_pct != null ? `${g.payment_diff_pct}%` : '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.currency}</td>
                  <td className="px-3 py-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={e => { e.stopPropagation(); del.mutate(g.id) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'New'} Tolerance Group</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code</Label>
                <Input placeholder="leave empty for default" value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {numField('Max line amount', 'max_line_amount')}
              {numField('Max document amount', 'max_document_amount')}
              {numField('Payment diff (absolute)', 'payment_diff_abs')}
              {numField('Payment diff (%)', 'payment_diff_pct')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || create.isPending || update.isPending}>
              {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function PostingControls() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Posting Controls
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure posting keys, field status groups, and tolerance limits.
        </p>
      </div>

      <Tabs defaultValue="posting-keys">
        <TabsList>
          <TabsTrigger value="posting-keys" className="flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5" />
            Posting Keys
          </TabsTrigger>
          <TabsTrigger value="field-status" className="flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5" />
            Field Status Groups
          </TabsTrigger>
          <TabsTrigger value="tolerance" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Tolerance Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posting-keys" className="mt-4">
          <PostingKeysTab />
        </TabsContent>
        <TabsContent value="field-status" className="mt-4">
          <FieldStatusGroupsTab />
        </TabsContent>
        <TabsContent value="tolerance" className="mt-4">
          <ToleranceGroupsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
