import { useMemo, useState } from 'react'
import { Plus, Scissors, Trash2, Pencil, Loader2, Copy, Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ModalOverlay, ModalPanel, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Select } from '@/components/ui/select'
import { askConfirm } from '@/components/common/ConfirmProvider'
import {
  useYieldProfiles, useYieldTemplates, useSaveYieldProfile, useDeleteYieldProfile,
} from '@/hooks/useYield'
import type { YieldProfile, YieldProfileInput, YieldProfileLine, YieldProfileTemplate } from '@/api/yield'
import { formatQty, yieldPercent } from '@/lib/yieldCalc'
import { convertWeight } from '@/lib/stockConversion'
import { UOM_GROUPS, UOM_OPTIONS } from '@/lib/uomOptions'

const UOM_SELECT_OPTIONS = UOM_GROUPS.flatMap(group =>
  UOM_OPTIONS.filter(u => u.group === group).map(u => ({ value: u.value, label: u.label, group })),
)

const PART_UOM_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'piece', label: 'piece' },
]

const EMPTY_LINE: YieldProfileLine = { cut_name: '', input_uom: 'kg', input_per_output: 1 }

function lineUom(line: YieldProfileLine, profileUom?: string | null) {
  return line.input_uom || profileUom || 'kg'
}

/** Raw amount expressed in the profile stock unit, so yield % stays comparable. */
function rawInProfileUnit(line: YieldProfileLine, profileUom?: string | null) {
  const uom = lineUom(line, profileUom)
  const stock = profileUom || 'kg'
  return convertWeight(Number(line.input_per_output), uom, stock) ?? Number(line.input_per_output)
}

function ProfileEditor({
  initial, id, onClose,
}: { initial: YieldProfileInput; id?: string; onClose: () => void }) {
  const [form, setForm] = useState<YieldProfileInput>(initial)
  const save = useSaveYieldProfile()

  const setLine = (i: number, patch: Partial<YieldProfileLine>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))

  const valid = form.name.trim() && form.lines.every((l) => l.cut_name.trim() && l.input_per_output > 0)

  const submit = () => {
    if (!valid) return
    save.mutate(
      {
        id,
        data: {
          ...form,
          category: form.category?.trim() || form.name.trim(),
          input_uom: 'kg',
          lines: form.lines.map((l) => ({
            cut_name: l.cut_name.trim(),
            input_uom: lineUom(l, 'kg'),
            input_per_output: Number(l.input_per_output),
            part_per_raw: Number(l.part_per_raw) > 0 ? Number(l.part_per_raw) : null,
            part_uom: l.part_uom || 'kg',
          })),
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <ModalOverlay onClose={onClose}>
        <ModalPanel className="w-[46rem] max-w-[calc(100vw-2rem)]">
        <ModalHeader
          title={id ? 'Edit yield profile' : 'New yield profile'}
          subtitle={<p className="text-xs text-muted-foreground">Name, unit, and raw amount for 1 kg sold. Boneless 1.3 kg, leg pieces 500 grams.</p>}
          onClose={onClose}
        />
        <ModalBody className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Name *</span>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value
                  setForm((f) => ({
                    ...f,
                    name,
                    category: !f.category || f.category === f.name ? name : f.category,
                  }))
                }}
                placeholder="Chicken"
                className="h-8"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Product category</span>
              <Input value={form.category ?? ''} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Chicken" className="h-8" />
            </label>
          </div>

          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[24%]" />
                <col className="w-[10%]" />
                <col className="w-10" />
              </colgroup>
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium">Cut</th>
                  <th className="text-left px-2 py-1.5 font-medium">UOM</th>
                  <th className="text-left px-2 py-1.5 font-medium">Raw</th>
                  <th className="text-left px-2 py-1.5 font-medium">In 1 kg raw</th>
                  <th className="text-right px-2 py-1.5 font-medium">Yield</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l, i) => {
                  const pct = yieldPercent(rawInProfileUnit(l, 'kg'))
                  return (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1">
                      <Input value={l.cut_name} onChange={(e) => setLine(i, { cut_name: e.target.value })} placeholder="Boneless" className="h-8 w-full" />
                    </td>
                    <td className="px-2 py-1">
                      <Select
                        value={lineUom(l, 'kg')}
                        onChange={(uom) => setLine(i, { input_uom: uom })}
                        options={UOM_SELECT_OPTIONS}
                        searchPlaceholder="Search UOM…"
                        menuMinWidth={280}
                        className="h-8 w-full"
                        wrapperClassName="w-full"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number" step="0.01" min="0.01"
                        value={l.input_per_output || ''}
                        onChange={(e) => setLine(i, { input_per_output: Number(e.target.value) })}
                        placeholder={lineUom(l, 'kg') === 'g' ? '500' : '1.30'}
                        className="h-8 w-full tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" step="0.01" min="0"
                          value={l.part_per_raw ?? ''}
                          onChange={(e) => setLine(i, { part_per_raw: e.target.value ? Number(e.target.value) : null })}
                          placeholder="0.25"
                          className="h-8 w-16 tabular-nums"
                        />
                        <Select
                          value={l.part_uom || 'kg'}
                          onChange={(uom) => setLine(i, { part_uom: uom })}
                          options={PART_UOM_OPTIONS}
                          className="h-8 w-16"
                          wrapperClassName="w-16"
                        />
                      </div>
                    </td>
                    <td className="w-14 px-2 py-1.5 text-right text-muted-foreground tabular-nums">
                      {pct != null ? `${pct}%` : '—'}
                    </td>
                    <td className="px-2 py-1.5">
                      <Button
                        type="button" variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}
                        aria-label="Remove cut"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active !== false} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              Active
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))}>
              <Plus className="h-4 w-4 mr-1" /> Add cut
            </Button>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

const norm = (s: string | null | undefined) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

let calcRowSeq = 0
const nextCalcRowId = () => {
  calcRowSeq += 1
  return `calc-${calcRowSeq}`
}

function profilesForCategory(profiles: YieldProfile[], category: string): YieldProfile[] {
  const c = norm(category)
  if (!c) return []
  const exact = profiles.filter((p) => norm(p.category) === c || norm(p.name) === c)
  if (exact.length) return exact
  return profiles.filter((p) => {
    const pc = norm(p.category)
    return !!pc && (c.includes(pc) || pc.includes(c))
  })
}

function cutsForCategory(
  profiles: YieldProfile[],
  templates: YieldProfileTemplate[],
  category: string,
): YieldProfileLine[] {
  const saved = profilesForCategory(profiles, category)
  const c = norm(category)
  const sources = saved.length
    ? saved
    : templates.filter((t) => norm(t.category) === c || norm(t.name) === c)
  const seen = new Set<string>()
  const lines: YieldProfileLine[] = []
  for (const profile of sources) {
    for (const line of profile.lines) {
      const key = norm(line.cut_name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      lines.push(line)
    }
  }
  return lines
}

function categoryNames(profiles: YieldProfile[], templates: YieldProfileTemplate[]): string[] {
  const seen = new Set<string>()
  const list: string[] = []
  const add = (name: string | null | undefined) => {
    const trimmed = (name || '').trim()
    const key = norm(trimmed)
    if (!key || seen.has(key)) return
    seen.add(key)
    list.push(trimmed)
  }
  for (const template of templates) add(template.name || template.category)
  for (const profile of profiles) add(profile.category || profile.name)
  return list
}

function defaultOrderUom(line: YieldProfileLine | undefined): string {
  if (line && Number(line.part_per_raw) > 0 && line.part_uom) return line.part_uom
  return 'kg'
}

/** Raw chicken for this line alone: order in kg × the profile Raw factor. Each cut uses its own bird. */
function rawKgForLine(line: YieldProfileLine | undefined, orderQty: number, orderUom: string): number | null {
  if (!line || !(orderQty > 0)) return null
  const factorKg = convertWeight(Number(line.input_per_output), line.input_uom || 'kg', 'kg')
  const orderKg = convertWeight(orderQty, orderUom, 'kg')
  if (factorKg == null || orderKg == null || !(factorKg > 0)) return null
  return Math.round(orderKg * factorKg * 10000) / 10000
}

type CalcRow = { id: string; cut: string; uom: string; order: string }

function rowsForCategory(profiles: YieldProfile[], templates: YieldProfileTemplate[], category: string): CalcRow[] {
  return cutsForCategory(profiles, templates, category).map((line) => ({
    id: nextCalcRowId(),
    cut: line.cut_name,
    uom: defaultOrderUom(line),
    order: '',
  }))
}

function RawChickenCalculator({
  profiles, templates, onClose,
}: { profiles: YieldProfile[]; templates: YieldProfileTemplate[]; onClose: () => void }) {
  const categories = useMemo(() => categoryNames(profiles, templates), [profiles, templates])

  const [category, setCategory] = useState(categories[0] ?? '')
  const cuts = useMemo(() => cutsForCategory(profiles, templates, category), [profiles, templates, category])
  const cutByName = useMemo(() => {
    const map = new Map<string, YieldProfileLine>()
    for (const line of cuts) map.set(norm(line.cut_name), line)
    return map
  }, [cuts])
  const [rows, setRows] = useState<CalcRow[]>(() => rowsForCategory(profiles, templates, categories[0] ?? ''))

  const applyCategory = (next: string) => {
    setCategory(next)
    setRows(rowsForCategory(profiles, templates, next))
  }

  const lineRaw = useMemo(
    () => rows.map((row) => rawKgForLine(cutByName.get(norm(row.cut)), Number(row.order) || 0, row.uom)),
    [rows, cutByName],
  )
  const totalRaw = lineRaw.reduce((sum, kg) => sum + (kg ?? 0), 0)

  const cutOptions = cuts.map((line) => ({ value: line.cut_name, label: line.cut_name }))

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="w-[52rem] max-w-[calc(100vw-2rem)]">
        <ModalHeader
          title="Raw item calculator"
          subtitle={<p className="text-xs text-muted-foreground">Pick the category and enter the order. Each cut needs its own raw chicken. Whole with skin uses the whole bird, so boneless and breast are added on top. Raw chicken needed is the total.</p>}
          onClose={onClose}
        />
        <ModalBody className="space-y-3">
          <label className="block space-y-1 text-sm max-w-xs">
            <span className="text-xs font-medium text-muted-foreground">Category</span>
            <Select
              value={category}
              onChange={applyCategory}
              options={categories.length ? categories.map((name) => ({ value: name, label: name })) : [{ value: '', label: 'No category yet' }]}
              placeholder="Select category"
              className="w-56"
            />
          </label>
          {cuts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cuts for this category. Add them on the profile first.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[22%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-10" />
                </colgroup>
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium">Cut</th>
                    <th className="text-left px-2 py-1.5 font-medium">UOM</th>
                    <th className="text-left px-2 py-1.5 font-medium">Order</th>
                    <th className="text-right px-2 py-1.5 font-medium">Raw for this</th>
                    <th className="text-right px-2 py-1.5 font-medium">Left over</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const rawKg = lineRaw[index]
                    const typed = Number(row.order) > 0
                    const mismatch = typed && rawKg == null
                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-2 py-1.5">
                          <Select
                            value={row.cut}
                            onChange={(cut) => {
                              const next = cutByName.get(norm(cut))
                              setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, cut, uom: defaultOrderUom(next) } : item)))
                            }}
                            options={cutOptions}
                            className="w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select
                            value={row.uom}
                            onChange={(uom) => setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, uom } : item)))}
                            options={UOM_SELECT_OPTIONS}
                            searchPlaceholder="Search UOM…"
                            menuMinWidth={280}
                            className="w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.order}
                            onChange={(e) => setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, order: e.target.value } : item)))}
                            placeholder="0"
                            className="h-8 w-full tabular-nums"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {rawKg == null ? '—' : formatQty(rawKg, 'kg')}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {mismatch || rawKg == null ? '—' : formatQty(0, 'kg')}
                        </td>
                        <td className="px-1 py-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Remove line"
                            onClick={() => setRows((prev) => prev.filter((item) => item.id !== row.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cuts.length === 0}
              onClick={() => setRows((prev) => [...prev, { id: nextCalcRowId(), cut: cuts[0]?.cut_name ?? '', uom: defaultOrderUom(cuts[0]), order: '' }])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add line
            </Button>
            <p className="text-sm">
              Raw chicken needed:{' '}
              <strong>{totalRaw > 0 ? formatQty(totalRaw, 'kg') : '—'}</strong>
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}

export default function YieldProfilesPage() {
  const { data: profiles = [], isLoading } = useYieldProfiles()
  const { data: templates = [] } = useYieldTemplates()
  const remove = useDeleteYieldProfile()
  const [editing, setEditing] = useState<{ id?: string; initial: YieldProfileInput } | null>(null)
  const [calculatorOpen, setCalculatorOpen] = useState(false)

  const edit = (p: YieldProfile) =>
    setEditing({ id: p.id, initial: { name: p.name, category: p.category, input_uom: p.input_uom, is_active: p.is_active, lines: p.lines } })

  const handleDelete = async (p: YieldProfile) => {
    if (await askConfirm(`Delete the "${p.name}" yield profile? Products keep the factors already set on their cuts.`)) {
      remove.mutate(p.id)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scissors className="h-6 w-6" /> Yield Profiles
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Raw stock each cut needs per 1 kg sold. Products in the matching category use these factors on their Yield &amp; Cutting tab.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCalculatorOpen(true)} disabled={profiles.length === 0 && templates.length === 0}>
            <Calculator className="h-4 w-4 mr-1" /> Raw item calculator
          </Button>
          <Button onClick={() => setEditing({ initial: { name: '', input_uom: 'kg', is_active: true, lines: [{ ...EMPTY_LINE }] } })}>
            <Plus className="h-4 w-4 mr-1" /> New profile
          </Button>
        </div>
      </div>

      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Start from a template</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Button
                key={t.name} variant="outline" size="sm"
                onClick={() => setEditing({ initial: { name: t.name, category: t.category, input_uom: t.input_uom, is_active: true, lines: t.lines } })}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> {t.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No yield profiles yet. Start from a template above, then adjust the factors to what your cutters really get.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {p.name}
                    {!p.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.category ? `Category: ${p.category}` : 'No category'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => edit(p)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(p)} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium py-1">Cut</th>
                      <th className="text-right font-medium py-1">Raw</th>
                      <th className="text-right font-medium py-1">In 1 kg raw</th>
                      <th className="text-right font-medium py-1">Yield</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.lines.map((l) => (
                      <tr key={l.id ?? l.cut_name} className="border-t border-border">
                        <td className="py-1.5">{l.cut_name}</td>
                        <td className="py-1.5 text-right tabular-nums">{l.input_per_output.toFixed(2)} {lineUom(l, p.input_uom)}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {Number(l.part_per_raw) > 0 ? `${Number(l.part_per_raw)} ${l.part_uom || 'kg'}` : '—'}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">{yieldPercent(rawInProfileUnit(l, p.input_uom))}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && <ProfileEditor id={editing.id} initial={editing.initial} onClose={() => setEditing(null)} />}
      {calculatorOpen && (
        <RawChickenCalculator profiles={profiles} templates={templates} onClose={() => setCalculatorOpen(false)} />
      )}
    </div>
  )
}
