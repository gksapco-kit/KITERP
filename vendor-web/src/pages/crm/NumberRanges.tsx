import { useState, Fragment } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hash, Loader2, RefreshCw, Save } from 'lucide-react'
import { crmApi, type CrmNumberRange } from '@/api/crm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { toast } from 'sonner'

const ENTITY_ORDER = ['lead', 'contact', 'account', 'deal', 'activity', 'ticket']

const SERIES_OPTIONS = [
  { value: 'Leads', label: 'Leads', prefix: 'LED' },
  { value: 'Contacts', label: 'Contacts', prefix: 'ACC' },
  { value: 'Accounts', label: 'Accounts', prefix: 'ACC' },
  { value: 'Deals', label: 'Deals', prefix: 'DEAL' },
  { value: 'Tasks', label: 'Tasks', prefix: 'TSK' },
  { value: 'Tickets', label: 'Tickets', prefix: 'TCK' },
] as const

function usagePct(nr: CrmNumberRange) {
  const span = nr.number_to - nr.number_from
  if (span <= 0) return 0
  const used = Math.max(0, nr.current_number - nr.number_from)
  return Math.min(100, Math.round((used / span) * 100))
}

function EditRangeForm({
  range,
  onSaved,
}: {
  range: CrmNumberRange
  onSaved: () => void
}) {
  const knownName = SERIES_OPTIONS.some((o) => o.value === range.name)
    ? range.name
    : (SERIES_OPTIONS.find((o) => o.prefix === range.prefix)?.value ?? 'Leads')

  const [form, setForm] = useState({
    name: knownName,
    prefix: range.prefix,
    number_from: range.number_from,
    number_to: range.number_to,
    current_number: range.current_number,
    pad_width: range.pad_width,
  })

  const save = useMutation({
    mutationFn: () =>
      crmApi.updateNumberRange(range.entity_type, {
        name: form.name,
        prefix: form.prefix,
        number_from: form.number_from,
        number_to: form.number_to,
        current_number: form.current_number,
        pad_width: form.pad_width,
      }),
    onSuccess: () => {
      toast.success(`${form.name} number range saved`)
      onSaved()
    },
    onError: (err: any) => {
      const d = err?.response?.data?.detail
      toast.error(typeof d === 'string' ? d : 'Failed to save number range')
    },
  })

  const preview = `${(form.prefix || 'LED').toUpperCase()}-${String(form.current_number).padStart(Math.max(1, form.pad_width || 6), '0')}`

  const nameOptions = SERIES_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Select
            value={form.name}
            options={nameOptions}
            placeholder="Select series"
            onChange={(value) => {
              const opt = SERIES_OPTIONS.find((o) => o.value === value)
              setForm((f) => ({
                ...f,
                name: value,
                prefix: opt?.prefix ?? f.prefix,
              }))
            }}
          />
        </div>
        <div className="space-y-1">
          <Label>Prefix</Label>
          <Input
            className="font-mono uppercase"
            value={form.prefix}
            onChange={(e) =>
              setForm((f) => ({ ...f, prefix: e.target.value.toUpperCase().replace(/\s/g, '') }))
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>From</Label>
          <Input
            type="number"
            min={1}
            value={form.number_from}
            onChange={(e) => setForm((f) => ({ ...f, number_from: Number(e.target.value) || 1 }))}
          />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input
            type="number"
            min={1}
            value={form.number_to}
            onChange={(e) => setForm((f) => ({ ...f, number_to: Number(e.target.value) || 1 }))}
          />
        </div>
        <div className="space-y-1">
          <Label>Next number</Label>
          <Input
            type="number"
            min={1}
            value={form.current_number}
            onChange={(e) =>
              setForm((f) => ({ ...f, current_number: Number(e.target.value) || 1 }))
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div className="space-y-1">
          <Label>Zero-padding</Label>
          <Input
            type="number"
            min={1}
            max={12}
            value={form.pad_width}
            onChange={(e) =>
              setForm((f) => ({ ...f, pad_width: Math.min(12, Math.max(1, Number(e.target.value) || 6)) }))
            }
          />
        </div>
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Next label: </span>
          <span className="font-mono font-semibold">{preview}</span>
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save range
        </Button>
      </div>
    </div>
  )
}

export default function CrmNumberRanges() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>('lead')

  const { data: ranges = [], isLoading } = useQuery({
    queryKey: ['crm', 'number-ranges'],
    queryFn: () => crmApi.listNumberRanges(),
  })

  const seed = useMutation({
    mutationFn: () => crmApi.seedNumberRanges(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'number-ranges'] })
      toast.success('Default number ranges ready')
    },
  })

  const sorted = [...ranges].sort(
    (a, b) => ENTITY_ORDER.indexOf(a.entity_type) - ENTITY_ORDER.indexOf(b.entity_type),
  )
  const lead = sorted.find((r) => r.entity_type === 'lead')

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Hash className="w-6 h-6 text-primary" />
            CRM Number Ranges
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Maintain prefix, range, and next number for CRM documents — especially Leads
            (e.g. LED-000001).
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
        >
          {seed.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Seed defaults
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/40" />
        </div>
      ) : (
        <>
          {lead && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Leads
                  <Badge variant="secondary" className="font-mono">{lead.preview}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EditRangeForm
                  key={`${lead.id}-${lead.current_number}-${lead.prefix}`}
                  range={lead}
                  onSaved={() => qc.invalidateQueries({ queryKey: ['crm', 'number-ranges'] })}
                />
              </CardContent>
            </Card>
          )}

          <div className="rounded-md border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Entity', 'Prefix', 'From', 'To', 'Next', 'Padding', 'Usage', ''].map((h) => (
                    <th key={h || 'a'} className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((nr) => {
                  const pct = usagePct(nr)
                  const open = editing === nr.entity_type
                  return (
                    <Fragment key={nr.id}>
                      <tr className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">
                          {nr.name}
                          {nr.entity_type === 'lead' && (
                            <Badge className="ml-2" variant="outline">Primary</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">{nr.prefix}</td>
                        <td className="px-3 py-2 text-muted-foreground">{nr.number_from.toLocaleString()}</td>
                        <td className="px-3 py-2 text-muted-foreground">{nr.number_to.toLocaleString()}</td>
                        <td className="px-3 py-2 font-mono font-medium">{nr.preview}</td>
                        <td className="px-3 py-2">{nr.pad_width}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(open ? null : nr.entity_type)}
                          >
                            {open ? 'Close' : 'Edit'}
                          </Button>
                        </td>
                      </tr>
                      {open && nr.entity_type !== 'lead' && (
                        <tr className="border-t bg-muted/20">
                          <td colSpan={8} className="px-4 py-4">
                            <EditRangeForm
                              key={`${nr.id}-${nr.current_number}`}
                              range={nr}
                              onSaved={() => {
                                qc.invalidateQueries({ queryKey: ['crm', 'number-ranges'] })
                                setEditing(null)
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No ranges yet. Click Seed defaults to create the Leads series.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
