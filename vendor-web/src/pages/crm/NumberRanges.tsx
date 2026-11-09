import { useState, Fragment } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hash, Loader2, Pencil, RefreshCw, Save } from 'lucide-react'
import { crmApi, type CrmNumberRange } from '@/api/crm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

function usageTone(pct: number) {
  if (pct >= 90) return 'bg-destructive'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-primary'
}

function EditRangeForm({
  range,
  onSaved,
  layout = 'compact',
}: {
  range: CrmNumberRange
  onSaved: () => void
  /** `panel` — primary Leads card; `compact` — table inline editor */
  layout?: 'panel' | 'compact'
}) {
  const compact = layout === 'compact'
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

  const fieldClass = cn(compact ? 'h-8 text-sm' : 'h-8', 'w-full')

  const labelClass = 'text-[11px] font-medium leading-none text-muted-foreground'

  const nameSelect = (
    <Select
      value={form.name}
      options={nameOptions}
      placeholder="Select series"
      className={cn(fieldClass, 'min-h-8 py-0 text-sm')}
      onChange={(value) => {
        const opt = SERIES_OPTIONS.find((o) => o.value === value)
        setForm((f) => ({
          ...f,
          name: value,
          prefix: opt?.prefix ?? f.prefix,
        }))
      }}
    />
  )

  const fields = (
    <>
      <div className="space-y-1">
        <Label className={labelClass}>Name</Label>
        {nameSelect}
      </div>
      <div className="space-y-1">
        <Label className={labelClass}>Prefix</Label>
        <Input
          className={cn(fieldClass, 'font-mono uppercase tracking-wide')}
          maxLength={12}
          value={form.prefix}
          onChange={(e) =>
            setForm((f) => ({ ...f, prefix: e.target.value.toUpperCase().replace(/\s/g, '') }))
          }
        />
      </div>
      <div className="space-y-1">
        <Label className={labelClass}>From</Label>
        <Input
          className={cn(fieldClass, 'tabular-nums')}
          type="number"
          min={1}
          value={form.number_from}
          onChange={(e) => setForm((f) => ({ ...f, number_from: Number(e.target.value) || 1 }))}
        />
      </div>
      <div className="space-y-1">
        <Label className={labelClass}>To</Label>
        <Input
          className={cn(fieldClass, 'tabular-nums')}
          type="number"
          min={1}
          value={form.number_to}
          onChange={(e) => setForm((f) => ({ ...f, number_to: Number(e.target.value) || 1 }))}
        />
      </div>
      <div className="space-y-1">
        <Label className={labelClass}>Next #</Label>
        <Input
          className={cn(fieldClass, 'tabular-nums')}
          type="number"
          min={1}
          value={form.current_number}
          onChange={(e) =>
            setForm((f) => ({ ...f, current_number: Number(e.target.value) || 1 }))
          }
        />
      </div>
      <div className="space-y-1">
        <Label className={labelClass}>Pad</Label>
        <Input
          className={cn(fieldClass, 'tabular-nums')}
          type="number"
          min={1}
          max={12}
          value={form.pad_width}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              pad_width: Math.min(12, Math.max(1, Number(e.target.value) || 6)),
            }))
          }
        />
      </div>
    </>
  )

  const saveButton = (
    <Button
      size="sm"
      className={cn('h-8 shrink-0 gap-1.5 px-3', compact && 'gap-1 px-2.5 text-xs')}
      onClick={() => save.mutate()}
      disabled={save.isPending}
    >
      {save.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Save className="h-3.5 w-3.5" />
      )}
      {layout === 'panel' ? 'Save range' : 'Save'}
    </Button>
  )

  if (layout === 'panel') {
    const panelGrid =
      'grid w-full grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 lg:grid-cols-6'

    return (
      <div className="w-full space-y-2">
        <div className={cn(panelGrid, 'items-end')}>{fields}</div>
        <div
          className={cn(
            panelGrid,
            'items-end rounded-lg border border-border/60 bg-muted/25 py-2.5',
          )}
        >
          <div className="col-span-2 min-w-0 sm:col-span-2 lg:col-span-5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Next document ID
            </p>
            <p className="truncate font-mono text-base font-semibold tracking-tight tabular-nums">
              {preview}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <div className="[&_button]:h-8 [&_button]:w-full">{saveButton}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-fit max-w-full space-y-1.5">
      <div className="grid grid-cols-[minmax(9rem,11.5rem)_4.25rem] items-end gap-x-2 gap-y-2">
        <div className="space-y-0.5">
          <Label className={labelClass}>Name</Label>
          {nameSelect}
        </div>
        <div className="space-y-0.5">
          <Label className={labelClass}>Prefix</Label>
          <Input
            className={cn(fieldClass, 'font-mono uppercase tracking-wide')}
            maxLength={12}
            value={form.prefix}
            onChange={(e) =>
              setForm((f) => ({ ...f, prefix: e.target.value.toUpperCase().replace(/\s/g, '') }))
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-4 items-end gap-x-2 sm:grid-cols-[3.25rem_5rem_3.25rem_2.75rem]">
        <div className="space-y-0.5">
          <Label className={labelClass}>From</Label>
          <Input
            className={cn(fieldClass, 'tabular-nums')}
            type="number"
            min={1}
            value={form.number_from}
            onChange={(e) => setForm((f) => ({ ...f, number_from: Number(e.target.value) || 1 }))}
          />
        </div>
        <div className="space-y-0.5">
          <Label className={labelClass}>To</Label>
          <Input
            className={cn(fieldClass, 'tabular-nums')}
            type="number"
            min={1}
            value={form.number_to}
            onChange={(e) => setForm((f) => ({ ...f, number_to: Number(e.target.value) || 1 }))}
          />
        </div>
        <div className="space-y-0.5">
          <Label className={labelClass}>Next #</Label>
          <Input
            className={cn(fieldClass, 'tabular-nums')}
            type="number"
            min={1}
            value={form.current_number}
            onChange={(e) =>
              setForm((f) => ({ ...f, current_number: Number(e.target.value) || 1 }))
            }
          />
        </div>
        <div className="space-y-0.5">
          <Label className={labelClass}>Pad</Label>
          <Input
            className={cn(fieldClass, 'tabular-nums')}
            type="number"
            min={1}
            max={12}
            value={form.pad_width}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                pad_width: Math.min(12, Math.max(1, Number(e.target.value) || 6)),
              }))
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 text-xs">
          <span className="text-muted-foreground">Next label</span>
          <span className="font-mono font-semibold tabular-nums">{preview}</span>
        </span>
        {saveButton}
      </div>
    </div>
  )
}

export default function CrmNumberRanges() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)

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
    <div className="w-full max-w-6xl space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            <Hash className="h-5 w-5 shrink-0 text-primary" />
            CRM Number Ranges
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prefix, range, and next number for CRM documents (e.g.{' '}
            <span className="font-mono text-xs">LED-000001</span>).
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
        >
          {seed.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Seed defaults
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
        </div>
      ) : (
        <>
          {lead && (
            <Card className="w-full overflow-hidden border-border/80 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold leading-tight">Leads</CardTitle>
                  <CardDescription className="mt-0.5 text-[11px] leading-snug">
                    New leads only — existing numbers stay as they are.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="shrink-0 font-mono text-[11px] font-normal tabular-nums">
                  Live: {lead.preview}
                </Badge>
              </div>
              <CardContent className="p-4">
                <EditRangeForm
                  layout="panel"
                  key={`${lead.id}-${lead.current_number}-${lead.prefix}`}
                  range={lead}
                  onSaved={() => qc.invalidateQueries({ queryKey: ['crm', 'number-ranges'] })}
                />
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="space-y-0 border-b bg-muted/25 px-4 py-3">
              <CardTitle className="text-sm font-semibold">All CRM series</CardTitle>
              <CardDescription className="text-xs">
                Edit other entity types from the table below.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {['Entity', 'Prefix', 'From', 'To', 'Next ID', 'Pad', 'Usage', ''].map((h) => (
                        <th
                          key={h || 'action'}
                          className={cn(
                            'px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground',
                            h === '' && 'text-right',
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/80">
                    {sorted.map((nr) => {
                      const pct = usagePct(nr)
                      const open = editing === nr.entity_type
                      const isLead = nr.entity_type === 'lead'

                      return (
                        <Fragment key={nr.id}>
                          <tr
                            className={cn(
                              'transition-colors hover:bg-muted/25',
                              open && 'bg-muted/35',
                              isLead && 'bg-primary/[0.03]',
                            )}
                          >
                            <td className="px-3 py-2 font-medium text-foreground">
                              <div className="flex flex-wrap items-center gap-2">
                                {nr.name}
                                {isLead && (
                                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                    Primary
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="rounded-md bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide">
                                {nr.prefix}
                              </span>
                            </td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {nr.number_from.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {nr.number_to.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs font-semibold">{nr.preview}</td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{nr.pad_width}</td>
                            <td className="px-3 py-2">
                              <div className="flex min-w-[5.5rem] items-center gap-2">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={cn('h-full rounded-full transition-[width]', usageTone(pct))}
                                    style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                                  />
                                </div>
                                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                                  {pct}%
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {isLead ? (
                                <span className="text-xs text-muted-foreground">Edit above</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant={open ? 'secondary' : 'outline'}
                                  className="h-8 gap-1 px-2.5 text-xs"
                                  onClick={() => setEditing(open ? null : nr.entity_type)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  {open ? 'Close' : 'Edit'}
                                </Button>
                              )}
                            </td>
                          </tr>
                          {open && !isLead && (
                            <tr className="bg-muted/20">
                              <td colSpan={8} className="border-t border-border/60 px-3 py-3 sm:px-4">
                                <EditRangeForm
                                  layout="compact"
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
                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                          No ranges yet. Use <span className="font-medium">Seed defaults</span> to create the
                          Leads series and other CRM counters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
