/**
 * FI Document Number Ranges (SAP FBN1).
 * Series per document type and fiscal year.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SelectRoot as Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Hash, Plus, Trash2, RefreshCw, FileText } from 'lucide-react'
import { toast } from 'sonner'
import {
  useNumberRanges,
  useSeedNumberRanges,
  useCreateNumberRange,
  useUpdateNumberRange,
  useDeleteNumberRange,
  useDocumentTypes,
} from '@/hooks/useFinance'
import type { NumberRange } from '@/api/finance'
import { onClickableTableRow } from '@/lib/clickableTableRow'

const currYear = new Date().getFullYear()

type NRForm = Omit<NumberRange, 'id'>
const BLANK_NR: NRForm = {
  document_type: 'SA', fiscal_year: currYear,
  number_from: 1000000, number_to: 1999999, current_number: 1000000,
  prefix: null, is_external: false,
}

function fmtErr(e: unknown) {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (!d) return 'Save failed'
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x: { msg?: string }) => x?.msg ?? JSON.stringify(x)).join('; ')
  return JSON.stringify(d)
}

export default function NumberRanges() {
  const { data: ranges = [], isLoading } = useNumberRanges()
  const { data: docTypes = [] } = useDocumentTypes(true)
  const seed = useSeedNumberRanges()
  const create = useCreateNumberRange()
  const update = useUpdateNumberRange()
  const del = useDeleteNumberRange()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<NumberRange | null>(null)
  const [form, setForm] = useState<NRForm>(BLANK_NR)
  const [seedFy, setSeedFy] = useState(currYear)

  const isSaving = create.isPending || update.isPending

  const pct = (nr: NumberRange) => {
    const used = nr.current_number - nr.number_from
    const total = nr.number_to - nr.number_from
    return total > 0 ? Math.round((used / total) * 100) : 0
  }

  const openNew = () => {
    setEditing(null)
    const first = docTypes[0]
    setForm({
      ...BLANK_NR,
      document_type: first?.code ?? 'SA',
      prefix: first?.number_range_prefix ?? null,
    })
    setOpen(true)
  }

  const openEdit = (nr: NumberRange) => {
    setEditing(nr)
    setForm({
      document_type: nr.document_type,
      fiscal_year: nr.fiscal_year,
      number_from: nr.number_from,
      number_to: nr.number_to,
      current_number: nr.current_number,
      prefix: nr.prefix,
      is_external: nr.is_external,
    })
    setOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: form })
        toast.success('Number range updated.')
      } else {
        const { current_number: _c, ...createData } = form
        await create.mutateAsync(createData)
        toast.success('Number range created.')
      }
      setOpen(false)
    } catch (e) {
      toast.error(fmtErr(e))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Hash className="h-6 w-6 text-primary" />
            Number Ranges
          </h1>
          <p className="text-muted-foreground mt-1">
            Document number series per type and fiscal year.{' '}
            <Link to="/finance/document-types" className="text-primary underline-offset-2 hover:underline">
              Manage document types
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/finance/document-types">
              <FileText className="h-4 w-4 mr-1.5" />
              Document Types
            </Link>
          </Button>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              className="w-24 h-9 text-sm"
              value={seedFy}
              onChange={e => setSeedFy(parseInt(e.target.value))}
            />
            <Button variant="outline" onClick={() => seed.mutate(seedFy)} disabled={seed.isPending}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${seed.isPending ? 'animate-spin' : ''}`} />
              Seed FY
            </Button>
          </div>
          <Button onClick={openNew} disabled={docTypes.length === 0}>
            <Plus className="h-4 w-4 mr-1.5" />
            New range
          </Button>
        </div>
      </div>

      {docTypes.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          No active document types found.{' '}
          <Link to="/finance/document-types" className="underline font-medium">
            Create or seed document types
          </Link>{' '}
          before adding number ranges.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    {['Type', 'FY', 'Prefix', 'From', 'To', 'Current', 'Usage', 'Mode', ''].map(h => (
                      <th key={h || 'actions'} className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranges.map(nr => (
                    <tr
                      key={nr.id}
                      className="border-t hover:bg-muted/30 cursor-pointer"
                      onClick={onClickableTableRow(() => openEdit(nr))}
                    >
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
                      <td className="px-3 py-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => del.mutate(nr.id, {
                            onSuccess: () => toast.success('Number range deleted.'),
                            onError: (e) => toast.error(fmtErr(e)),
                          })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {ranges.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                        No number ranges yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'New'} Number Range</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Document Type</Label>
                <Select
                  value={form.document_type}
                  onValueChange={code => {
                    const dt = docTypes.find(d => d.code === code)
                    setForm(f => ({
                      ...f,
                      document_type: code,
                      prefix: dt?.number_range_prefix ?? f.prefix,
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {docTypes.map(dt => (
                      <SelectItem key={dt.id} value={dt.code}>
                        {dt.code} — {dt.name}
                      </SelectItem>
                    ))}
                    {editing && !docTypes.some(d => d.code === form.document_type) && (
                      <SelectItem value={form.document_type}>{form.document_type}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fiscal Year</Label>
                <Input
                  type="number"
                  value={form.fiscal_year}
                  onChange={e => setForm(f => ({ ...f, fiscal_year: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>From</Label>
                <Input
                  type="number"
                  value={form.number_from}
                  onChange={e => setForm(f => ({ ...f, number_from: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input
                  type="number"
                  value={form.number_to}
                  onChange={e => setForm(f => ({ ...f, number_to: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            {editing && (
              <div className="space-y-1">
                <Label>Current (next number)</Label>
                <Input
                  type="number"
                  value={form.current_number}
                  onChange={e => setForm(f => ({ ...f, current_number: parseInt(e.target.value) }))}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Prefix (optional)</Label>
              <Input
                placeholder="e.g. INV"
                value={form.prefix ?? ''}
                onChange={e => setForm(f => ({ ...f, prefix: e.target.value || null }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="nr-external">External numbering</Label>
              <Switch
                id="nr-external"
                checked={form.is_external}
                onCheckedChange={v => setForm(f => ({ ...f, is_external: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button disabled={!form.document_type || isSaving} onClick={handleSave}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
