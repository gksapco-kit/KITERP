import { useState, Fragment } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hash, Loader2, Save, Trash2, Info } from 'lucide-react'
import { vendorApi, type ProcNumberRange, type ProcNumberRangeIn } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { BusinessUnitSelect, useDefaultBusinessUnitId } from '@/components/common/BusinessUnitSelect'

// ─── constants ───────────────────────────────────────────────────────────────

const PROC_PREFIXES = ['PR', 'PO', 'RFQ', 'SQ', 'GRN', 'GRNR', 'PRET'] as const
type ProcPrefix = (typeof PROC_PREFIXES)[number]

const PREFIX_LABELS: Record<ProcPrefix, string> = {
  PR:   'Purchase Requisition',
  PO:   'Purchase Order',
  RFQ:  'Request for Quotation',
  SQ:   'Supplier Quotation',
  GRN:  'Goods Receipt Note',
  GRNR: 'GRN Reversal',
  PRET: 'Purchase Return',
}

const PREFIX_WIDTHS: Record<ProcPrefix, number> = {
  PR: 6, PO: 4, RFQ: 6, SQ: 6, GRN: 6, GRNR: 5, PRET: 6,
}

function usagePct(nr: ProcNumberRange) {
  const span = nr.number_to - nr.number_from
  if (span <= 0) return 0
  const used = Math.max(0, nr.last_value - nr.number_from + 1)
  return Math.min(100, Math.round((used / span) * 100))
}

// ─── edit form ───────────────────────────────────────────────────────────────

interface EditFormProps {
  range: ProcNumberRange
  storeId: string | null
  onSaved: () => void
  onDeleted?: () => void
}

function EditRangeForm({ range, storeId, onSaved, onDeleted }: EditFormProps) {
  const defaultWidth = PREFIX_WIDTHS[range.prefix as ProcPrefix] ?? 6

  const [form, setForm] = useState({
    number_from: range.number_from,
    number_to:   range.number_to,
    last_value:  range.last_value,
    width:       range.width || defaultWidth,
  })

  const save = useMutation({
    mutationFn: () => {
      const payload: ProcNumberRangeIn = {
        store_id:    storeId || null,
        prefix:      range.prefix,
        number_from: form.number_from,
        number_to:   form.number_to,
        last_value:  form.last_value,
        width:       form.width,
      }
      return vendorApi.upsertProcNumberRange(payload)
    },
    onSuccess: () => {
      toast.success(`${PREFIX_LABELS[range.prefix as ProcPrefix] ?? range.prefix} range saved`)
      onSaved()
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof d === 'string' ? d : 'Failed to save number range')
    },
  })

  const del = useMutation({
    mutationFn: () => vendorApi.deleteProcNumberRange(range.id as string),
    onSuccess: () => {
      toast.success('Number range deleted')
      onDeleted?.()
    },
    onError: () => toast.error('Failed to delete number range'),
  })

  const nextNum = form.last_value + 1
  const preview = `${range.prefix}-${String(nextNum).padStart(Math.max(1, form.width || defaultWidth), '0')}`

  return (
    <div className="space-y-4">
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
            min={0}
            value={form.last_value}
            onChange={(e) =>
              setForm((f) => ({ ...f, last_value: Number(e.target.value) || 0 }))
            }
          />
          <p className="text-xs text-muted-foreground">Counter value (next = this + 1)</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div className="space-y-1">
          <Label>Zero-padding</Label>
          <Input
            type="number"
            min={1}
            max={12}
            value={form.width}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                width: Math.min(12, Math.max(1, Number(e.target.value) || defaultWidth)),
              }))
            }
          />
        </div>
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Next label: </span>
          <span className="font-mono font-semibold">{preview}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || del.isPending}>
            {save.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Save range
          </Button>
        </div>
        {range.id && onDeleted && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => del.mutate()}
            disabled={del.isPending || save.isPending}
          >
            {del.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Trash2 className="w-4 h-4 mr-1" />
            )}
            Delete override
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function ProcurementNumberRanges() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)

  const { defaultId, stores } = useDefaultBusinessUnitId()
  const [selectedBu, setSelectedBu] = useState<string>('')

  // Resolve the active BU id: '' means vendor-level default
  const activeBuId = selectedBu || null

  const { data: ranges = [], isLoading } = useQuery({
    queryKey: ['procurement', 'number-ranges', activeBuId],
    queryFn: () => vendorApi.listProcNumberRanges(activeBuId),
  })

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['procurement', 'number-ranges'] })

  const activeBuName = activeBuId
    ? (stores.find((s) => s.id === activeBuId)
        ? (stores.find((s) => s.id === activeBuId)!.code
            ? `${stores.find((s) => s.id === activeBuId)!.code} — ${stores.find((s) => s.id === activeBuId)!.name}`
            : stores.find((s) => s.id === activeBuId)!.name)
        : activeBuId)
    : 'Vendor-wide default'

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Hash className="w-6 h-6 text-primary" />
            Procurement Number Ranges
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure document number series (prefix, range, padding) for each procurement
            document type. Ranges can be set globally or overridden per business unit.
          </p>
        </div>
      </div>

      {/* ── business-unit selector ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Business Unit</CardTitle>
          <CardDescription>
            Select a business unit to view and edit its document series. Choose{' '}
            <span className="font-medium">Vendor-wide default</span> to manage the global
            fallback used by all BUs that don't have their own override.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 max-w-sm">
            <BusinessUnitSelect
              value={selectedBu}
              onChange={setSelectedBu}
              allowAll
              autoSelectDefault={false}
              triggerClassName="w-full"
            />
          </div>
          {activeBuId && (
            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" />
              Ranges shown for <span className="font-medium">{activeBuName}</span>. Rows
              without an override will fall back to the vendor-wide defaults at runtime.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── number range table ── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/40" />
        </div>
      ) : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {[
                  'Document Type',
                  'Prefix',
                  'From',
                  'To',
                  'Next',
                  'Pad',
                  'Usage',
                  'Status',
                  '',
                ].map((h) => (
                  <th
                    key={h || '_action'}
                    className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranges.map((nr) => {
                const pct  = usagePct(nr)
                const open = editing === nr.prefix
                const isOverride = nr.id !== null && nr.store_id !== null
                const hasRange   = nr.id !== null

                return (
                  <Fragment key={nr.prefix}>
                    <tr className="border-t hover:bg-muted/30 transition-colors">
                      {/* Document type */}
                      <td className="px-3 py-2 font-medium">
                        {nr.label}
                        {isOverride && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            BU override
                          </Badge>
                        )}
                        {!hasRange && activeBuId && (
                          <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
                            Using default
                          </Badge>
                        )}
                      </td>

                      {/* Prefix */}
                      <td className="px-3 py-2 font-mono text-xs font-semibold tracking-wider">
                        {nr.prefix}
                      </td>

                      {/* From / To */}
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">
                        {hasRange ? nr.number_from.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">
                        {hasRange ? nr.number_to.toLocaleString() : '—'}
                      </td>

                      {/* Next label */}
                      <td className="px-3 py-2 font-mono font-medium">{nr.preview}</td>

                      {/* Padding */}
                      <td className="px-3 py-2 text-muted-foreground">{nr.width}</td>

                      {/* Usage bar */}
                      <td className="px-3 py-2">
                        {hasRange ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-3 py-2">
                        {hasRange ? (
                          <Badge variant="default" className="text-xs">
                            Configured
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Not set
                          </Badge>
                        )}
                      </td>

                      {/* Edit / close */}
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(open ? null : nr.prefix)}
                        >
                          {open ? 'Close' : hasRange ? 'Edit' : 'Set up'}
                        </Button>
                      </td>
                    </tr>

                    {/* Inline edit row */}
                    {open && (
                      <tr className="border-t bg-muted/20">
                        <td colSpan={9} className="px-4 py-4">
                          <EditRangeForm
                            key={`${nr.prefix}-${nr.id ?? 'new'}-${nr.last_value}`}
                            range={nr}
                            storeId={activeBuId}
                            onSaved={() => {
                              invalidate()
                              setEditing(null)
                            }}
                            onDeleted={
                              isOverride
                                ? () => {
                                    invalidate()
                                    setEditing(null)
                                  }
                                : undefined
                            }
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── legend ── */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How it works</p>
        <p>
          <span className="font-medium">Vendor-wide default</span> — the counter used for
          all business units unless they have a specific override configured here.
        </p>
        <p>
          <span className="font-medium">BU override</span> — when a business unit has its
          own range set up, documents created for that BU will draw from its dedicated
          counter instead of the global one, giving each branch its own number series.
        </p>
        <p>
          <span className="font-medium">Next number</span> = last counter value + 1. Editing
          <em> Next number</em> directly lets you reset or advance the series without gaps.
        </p>
      </div>
    </div>
  )
}
