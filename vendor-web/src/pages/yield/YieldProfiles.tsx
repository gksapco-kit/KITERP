import { useState } from 'react'
import { Plus, Scissors, Trash2, Pencil, Loader2, Copy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ModalOverlay, ModalPanel, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { askConfirm } from '@/components/common/ConfirmProvider'
import {
  useYieldProfiles, useYieldTemplates, useSaveYieldProfile, useDeleteYieldProfile,
} from '@/hooks/useYield'
import type { YieldProfile, YieldProfileInput, YieldProfileLine } from '@/api/yield'
import { yieldPercent } from '@/lib/yieldCalc'

const EMPTY_LINE: YieldProfileLine = { cut_name: '', input_per_output: 1 }

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
          lines: form.lines.map((l) => ({
            cut_name: l.cut_name.trim(),
            input_per_output: Number(l.input_per_output),
            rounding_step: l.rounding_step ? Number(l.rounding_step) : null,
            byproduct: l.byproduct?.trim() || null,
          })),
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-3xl w-full">
        <ModalHeader
          title={id ? 'Edit yield profile' : 'New yield profile'}
          subtitle={<p className="text-xs text-muted-foreground">How much raw stock each cut needs to give 1 {form.input_uom || 'kg'} to the customer.</p>}
          onClose={onClose}
        />
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Name *</span>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Chicken" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Product category</span>
              <Input value={form.category ?? ''} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Chicken" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Raw stock unit</span>
              <Input value={form.input_uom ?? 'kg'} onChange={(e) => setForm({ ...form, input_uom: e.target.value })} placeholder="kg" />
            </label>
          </div>

          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Cut</th>
                  <th className="text-left px-3 py-2 font-medium w-36">Raw per 1 {form.input_uom || 'kg'}</th>
                  <th className="text-left px-3 py-2 font-medium w-20">Yield</th>
                  <th className="text-left px-3 py-2 font-medium w-28">Round to</th>
                  <th className="text-left px-3 py-2 font-medium">By-product</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5">
                      <Input value={l.cut_name} onChange={(e) => setLine(i, { cut_name: e.target.value })} placeholder="Boneless" className="h-8" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number" step="0.01" min="0.01"
                        value={l.input_per_output || ''}
                        onChange={(e) => setLine(i, { input_per_output: Number(e.target.value) })}
                        className="h-8"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                      {yieldPercent(l.input_per_output) != null ? `${yieldPercent(l.input_per_output)}%` : '—'}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number" step="0.01" min="0"
                        value={l.rounding_step ?? ''}
                        onChange={(e) => setLine(i, { rounding_step: e.target.value ? Number(e.target.value) : null })}
                        placeholder="0.05"
                        className="h-8"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input value={l.byproduct ?? ''} onChange={(e) => setLine(i, { byproduct: e.target.value })} placeholder="Bones, skin…" className="h-8" />
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
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))}>
            <Plus className="h-4 w-4 mr-1" /> Add cut
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={form.is_active !== false} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            Active
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

export default function YieldProfilesPage() {
  const { data: profiles = [], isLoading } = useYieldProfiles()
  const { data: templates = [] } = useYieldTemplates()
  const remove = useDeleteYieldProfile()
  const [editing, setEditing] = useState<{ id?: string; initial: YieldProfileInput } | null>(null)

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
            <Scissors className="h-6 w-6" /> Cutting Yield Profiles
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Raw stock each cut needs per 1 kg sold. Products in the matching category use these factors on their Yield &amp; Cutting tab.
          </p>
        </div>
        <Button onClick={() => setEditing({ initial: { name: '', input_uom: 'kg', is_active: true, lines: [{ ...EMPTY_LINE }] } })}>
          <Plus className="h-4 w-4 mr-1" /> New profile
        </Button>
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
                    {p.category ? `Category: ${p.category}` : 'No category'} · raw stock in {p.input_uom}
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
                      <th className="text-right font-medium py-1">Raw per 1 {p.input_uom}</th>
                      <th className="text-right font-medium py-1">Yield</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.lines.map((l) => (
                      <tr key={l.id ?? l.cut_name} className="border-t border-border">
                        <td className="py-1.5">
                          {l.cut_name}
                          {l.byproduct && <span className="text-xs text-muted-foreground"> · {l.byproduct}</span>}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{l.input_per_output.toFixed(2)} {p.input_uom}</td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">{yieldPercent(l.input_per_output)}%</td>
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
    </div>
  )
}
