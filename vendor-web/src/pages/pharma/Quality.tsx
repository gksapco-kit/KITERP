import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { pharmaApi } from '@/api/pharma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useHasPermission } from '@/hooks/usePermissions'
import {
  PharmaBatchSelect,
  PharmaBatchSummary,
  PharmaCard,
  PharmaEmpty,
  PharmaESignDialog,
  PharmaLoading,
  PharmaPageHeader,
  PharmaProductSelect,
  PharmaProgress,
  PharmaStatusBadge,
  PharmaToolbar,
  downloadPharmaBlob,
  isUuid,
  type PharmaESignPayload,
  fmtErr,
} from './pharmaShared'

export function PharmaMbrPage() {
  const canManage = useHasPermission('pharma.manage')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ product_id: '', code: '', title: '' })
  const [createOps, setCreateOps] = useState<{ seq: number; name: string }[]>([
    { seq: 10, name: 'Blend' },
    { seq: 20, name: 'Compress' },
    { seq: 30, name: 'Package' },
  ])
  const [editId, setEditId] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<string | null>(null)
  const [edit, setEdit] = useState({
    title: '',
    batch_size: '',
    batch_size_uom: '',
    notes: '',
    operations: [] as { seq: number; name: string }[],
    ipc_checks: [] as { name: string; required: boolean }[],
    line_clearance: [] as { name: string; required: boolean }[],
  })

  const load = () => {
    setLoading(true)
    pharmaApi.listMbr().then((r) => setItems(r.items || [])).catch(() => toast.error('Failed to load MBR')).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    if (!isUuid(form.product_id)) {
      toast.error('Select a product first')
      return
    }
    if (!form.code.trim() || !form.title.trim()) {
      toast.error('Code and title are required')
      return
    }
    const validOps = createOps.filter((o) => o.name.trim())
    if (validOps.length === 0) {
      toast.error('Add at least one operation step')
      return
    }
    try {
      await pharmaApi.createMbr({
        product_id: form.product_id,
        code: form.code,
        title: form.title,
        operations: validOps,
        line_clearance: [{ name: 'Line cleared', required: true }],
        ipc_checks: [
          { name: 'Weight check', required: true },
          { name: 'Appearance', required: true },
        ],
      })
      toast.success('MBR created with ops / IPC / clearance')
      setForm({ product_id: '', code: '', title: '' })
      setCreateOps([
        { seq: 10, name: 'Blend' },
        { seq: 20, name: 'Compress' },
        { seq: 30, name: 'Package' },
      ])
      load()
    } catch (e: any) {
      toast.error(fmtErr(e, 'Create failed'))
    }
  }

  const openEdit = (m: any) => {
    setEditId(m.id)
    setEdit({
      title: m.title || '',
      batch_size: m.batch_size != null ? String(m.batch_size) : '',
      batch_size_uom: m.batch_size_uom || '',
      notes: m.notes || '',
      operations: (m.operations || []).map((o: any, i: number) => ({
        seq: Number(o.seq ?? (i + 1) * 10),
        name: String(o.name || ''),
      })),
      ipc_checks: (m.ipc_checks || []).map((c: any) => ({
        name: String(c.name || ''),
        required: c.required !== false,
      })),
      line_clearance: (m.line_clearance || []).map((c: any) => ({
        name: String(c.name || ''),
        required: c.required !== false,
      })),
    })
  }

  const saveEdit = async () => {
    if (!editId) return
    try {
      await pharmaApi.updateMbr(editId, {
        title: edit.title.trim(),
        batch_size: edit.batch_size ? Number(edit.batch_size) : null,
        batch_size_uom: edit.batch_size_uom.trim() || null,
        notes: edit.notes.trim() || null,
        operations: edit.operations.filter((o) => o.name.trim()).map((o, i) => ({
          seq: o.seq || (i + 1) * 10,
          name: o.name.trim(),
        })),
        ipc_checks: edit.ipc_checks.filter((c) => c.name.trim()),
        line_clearance: edit.line_clearance.filter((c) => c.name.trim()),
      })
      toast.success('MBR draft saved')
      setEditId(null)
      load()
    } catch (e: any) {
      toast.error(fmtErr(e, 'Save failed'))
    }
  }

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Master Batch Record"
        subtitle="Approved templates seed each BPR with operations, line clearance, and IPC checks."
      />
      {canManage ? (
        <PharmaCard className="mb-4">
          <h2 className="mb-3 text-sm font-semibold">New MBR (draft)</h2>
          <div className="space-y-3">
            <PharmaToolbar>
              <PharmaProductSelect className="w-64" value={form.product_id} onChange={(product_id) => setForm({ ...form, product_id })} />
              <Input className="w-32" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <Input className="w-48" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </PharmaToolbar>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Operations</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateOps((ops) => [...ops, { seq: (ops.at(-1)?.seq ?? 0) + 10, name: '' }])}
                >
                  + Step
                </Button>
              </div>
              {createOps.map((op, idx) => (
                <div key={idx} className="mb-1 flex flex-wrap items-center gap-2">
                  <Input
                    className="w-20"
                    type="number"
                    value={op.seq}
                    onChange={(e) => {
                      const next = [...createOps]
                      next[idx] = { ...op, seq: Number(e.target.value) || 0 }
                      setCreateOps(next)
                    }}
                    placeholder="Seq"
                  />
                  <Input
                    className="w-48"
                    placeholder="Step name"
                    value={op.name}
                    onChange={(e) => {
                      const next = [...createOps]
                      next[idx] = { ...op, name: e.target.value }
                      setCreateOps(next)
                    }}
                  />
                  {createOps.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setCreateOps((ops) => ops.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={create}>Create MBR</Button>
          </div>
        </PharmaCard>
      ) : null}
      <PharmaCard>
        {loading ? <PharmaLoading /> : items.length === 0 ? <PharmaEmpty label="No MBRs yet" hint="Create a draft, then approve it before starting BPRs." /> : null}
        <ul className="divide-y divide-border/60">
          {items.map((m) => (
            <li key={m.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {m.code} <span className="text-muted-foreground">v{m.version}</span> · {m.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <PharmaStatusBadge status={m.status} />
                    <span className="text-xs text-muted-foreground">
                      {(m.operations || []).length} ops · {(m.ipc_checks || []).length} IPC · {(m.line_clearance || []).length} clearance
                    </span>
                  </div>
                </div>
                {m.status === 'draft' && canManage ? (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                      Edit
                    </Button>
                    <Button size="sm" onClick={() => setApproveTarget(m.id)}>
                      Approve
                    </Button>
                  </div>
                ) : null}
              </div>
              {editId === m.id ? (
                <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Input className="w-64" placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                    <Input className="w-28" placeholder="Batch size" value={edit.batch_size} onChange={(e) => setEdit({ ...edit, batch_size: e.target.value })} />
                    <Input className="w-24" placeholder="UOM" value={edit.batch_size_uom} onChange={(e) => setEdit({ ...edit, batch_size_uom: e.target.value })} />
                  </div>
                  <Input placeholder="Notes" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Operations</div>
                    {edit.operations.map((o, idx) => (
                      <div key={idx} className="mb-1 flex flex-wrap gap-2">
                        <Input
                          className="w-20"
                          type="number"
                          value={o.seq}
                          onChange={(e) => {
                            const next = [...edit.operations]
                            next[idx] = { ...o, seq: Number(e.target.value) || 0 }
                            setEdit({ ...edit, operations: next })
                          }}
                        />
                        <Input
                          className="w-48"
                          placeholder="Step name"
                          value={o.name}
                          onChange={(e) => {
                            const next = [...edit.operations]
                            next[idx] = { ...o, name: e.target.value }
                            setEdit({ ...edit, operations: next })
                          }}
                        />
                        <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, operations: edit.operations.filter((_, j) => j !== idx) })}>
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEdit({ ...edit, operations: [...edit.operations, { seq: (edit.operations.length + 1) * 10, name: '' }] })}>
                      Add op
                    </Button>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">IPC checks</div>
                    {edit.ipc_checks.map((c, idx) => (
                      <div key={idx} className="mb-1 flex flex-wrap items-center gap-2">
                        <Input
                          className="w-48"
                          value={c.name}
                          onChange={(e) => {
                            const next = [...edit.ipc_checks]
                            next[idx] = { ...c, name: e.target.value }
                            setEdit({ ...edit, ipc_checks: next })
                          }}
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={c.required}
                            onChange={(e) => {
                              const next = [...edit.ipc_checks]
                              next[idx] = { ...c, required: e.target.checked }
                              setEdit({ ...edit, ipc_checks: next })
                            }}
                          />
                          Required
                        </label>
                        <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, ipc_checks: edit.ipc_checks.filter((_, j) => j !== idx) })}>
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEdit({ ...edit, ipc_checks: [...edit.ipc_checks, { name: '', required: true }] })}>
                      Add IPC
                    </Button>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Line clearance</div>
                    {edit.line_clearance.map((c, idx) => (
                      <div key={idx} className="mb-1 flex flex-wrap items-center gap-2">
                        <Input
                          className="w-48"
                          value={c.name}
                          onChange={(e) => {
                            const next = [...edit.line_clearance]
                            next[idx] = { ...c, name: e.target.value }
                            setEdit({ ...edit, line_clearance: next })
                          }}
                        />
                        <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, line_clearance: edit.line_clearance.filter((_, j) => j !== idx) })}>
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEdit({ ...edit, line_clearance: [...edit.line_clearance, { name: '', required: true }] })}>
                      Add clearance
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>
                      Save draft
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </PharmaCard>
      <PharmaESignDialog
        open={!!approveTarget}
        title="Approve Master Batch Record"
        description="Re-authenticate to approve this MBR. Once approved, the recipe is locked and prior versions are superseded."
        defaultMeaning="approver"
        confirmLabel="Sign & approve"
        onClose={() => setApproveTarget(null)}
        onConfirm={async (payload: PharmaESignPayload) => {
          if (!approveTarget) return
          await pharmaApi.approveMbr(approveTarget, {
            password: payload.password,
            meaning: payload.meaning,
            totp_code: payload.totp_code,
          })
          toast.success('MBR approved')
          load()
        }}
      />
    </div>
  )
}

export function PharmaBprPage() {
  const canManage = useHasPermission('pharma.manage')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ product_id: '', batch_number: '', planned_qty: '' })
  const [actualQty, setActualQty] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [signTarget, setSignTarget] = useState<{ id: string; qty: number } | null>(null)
  const [ipcTarget, setIpcTarget] = useState<string | null>(null)
  const [ipcForm, setIpcForm] = useState({ name: 'Weight check', value: '', passed: true, notes: '' })
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    pharmaApi.listBpr().then((r) => setItems(r.items || [])).catch(() => toast.error('Failed to load BPR')).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    if (!isUuid(form.product_id)) {
      toast.error('Select a product first')
      return
    }
    if (!form.batch_number.trim()) {
      toast.error('Batch number required')
      return
    }
    try {
      await pharmaApi.createBpr({
        product_id: form.product_id,
        batch_number: form.batch_number,
        planned_qty: form.planned_qty ? Number(form.planned_qty) : undefined,
      })
      toast.success('BPR created (seeded from approved MBR if available)')
      setForm({ product_id: '', batch_number: '', planned_qty: '' })
      load()
    } catch (e: any) {
      toast.error(fmtErr(e, 'Create failed'))
    }
  }

  const completeNextStep = async (b: any) => {
    const next = (b.operation_log || []).find((s: any) => s.status === 'pending' || s.status === 'in_progress')
    if (!next) {
      toast.message('No pending steps')
      return
    }
    try {
      await pharmaApi.logBprStep(b.id, {
        seq: next.seq,
        name: next.name,
        status: 'completed',
        notes: stepNotes[`${b.id}:${next.seq}`] || undefined,
      })
      toast.success(`Completed ${next.name}`)
      load()
    } catch (e: any) {
      toast.error(fmtErr(e, 'Step failed'))
    }
  }

  const logStep = async (bprId: string, body: { seq: number; name: string; status: string; notes?: string }) => {
    try {
      await pharmaApi.logBprStep(bprId, body)
      toast.success(body.status === 'skipped' ? `Skipped ${body.name}` : `Completed ${body.name}`)
      load()
    } catch (e: any) {
      toast.error(fmtErr(e, 'Step failed'))
    }
  }

  const openIpc = (b: any) => {
    const pending = (b.ipc_results || []).find((r: any) => r.status !== 'done')
    setIpcTarget(b.id)
    setIpcForm({
      name: pending?.name || b.ipc_results?.[0]?.name || 'Weight check',
      value: '',
      passed: true,
      notes: '',
    })
  }

  const submitIpc = async () => {
    if (!ipcTarget || !ipcForm.name.trim() || !ipcForm.value.trim()) {
      toast.error('IPC name and value required')
      return
    }
    try {
      await pharmaApi.logBprIpc(ipcTarget, {
        name: ipcForm.name.trim(),
        value: ipcForm.value.trim(),
        passed: ipcForm.passed,
        notes: ipcForm.notes.trim() || undefined,
      })
      toast.success('IPC logged')
      setIpcTarget(null)
      load()
    } catch (e: any) {
      toast.error(fmtErr(e, 'IPC failed'))
    }
  }

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Batch Production Record"
        subtitle="Clearance → log steps → IPC → complete with yield."
      />
      {canManage ? (
        <PharmaCard className="mb-4">
          <h2 className="mb-3 text-sm font-semibold">Start BPR</h2>
          <PharmaToolbar>
            <PharmaProductSelect className="w-64" value={form.product_id} onChange={(product_id) => setForm({ ...form, product_id })} />
            <Input className="w-40" placeholder="Batch number" value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
            <Input className="w-28" placeholder="Planned qty" value={form.planned_qty} onChange={(e) => setForm({ ...form, planned_qty: e.target.value })} />
            <Button onClick={create}>Create BPR</Button>
          </PharmaToolbar>
        </PharmaCard>
      ) : null}
      <PharmaCard>
        {loading ? <PharmaLoading /> : items.length === 0 ? <PharmaEmpty label="No BPRs yet" /> : null}
        <ul className="divide-y divide-border/60">
          {items.map((b) => {
            const ops = b.operation_log || []
            const doneOps = ops.filter((s: any) => ['completed', 'skipped'].includes(s.status)).length
            const open = expanded === b.id
            return (
              <li key={b.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium">{b.batch_number}</span>
                      <PharmaStatusBadge status={b.status} />
                      {b.clearance_done ? <PharmaStatusBadge status="done" /> : <span className="text-xs text-amber-800">Clearance pending</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      <PharmaProgress done={doneOps} total={ops.length || 0} label="Operations" />
                      <span className="text-xs text-muted-foreground">
                        Planned {b.planned_qty ?? '—'}
                        {b.yield_pct != null ? ` · Yield ${b.yield_pct}%` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : b.id)}>
                      {open ? 'Hide' : 'Steps'}
                    </Button>
                    {!b.clearance_done && canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          pharmaApi.updateBpr(b.id, { clearance_done: true, status: 'in_progress' }).then(() => {
                            toast.success('Clearance done')
                            load()
                          })
                        }
                      >
                        Clearance
                      </Button>
                    ) : null}
                    {canManage ? (
                      <Button size="sm" variant="outline" onClick={() => completeNextStep(b)}>
                        Next step
                      </Button>
                    ) : null}
                    {canManage ? (
                      <Button size="sm" variant="outline" onClick={() => openIpc(b)}>
                        Log IPC
                      </Button>
                    ) : null}
                    {b.status !== 'completed' && b.status !== 'closed' && canManage ? (
                      <>
                        <Input
                          className="w-24"
                          placeholder="Actual"
                          value={actualQty[b.id] || ''}
                          onChange={(e) => setActualQty({ ...actualQty, [b.id]: e.target.value })}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const qty = Number(actualQty[b.id])
                            if (!qty) {
                              toast.error('Enter actual qty')
                              return
                            }
                            setSignTarget({ id: b.id, qty })
                          }}
                        >
                          Complete
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          pharmaApi
                            .getBprPdfBlob(b.id)
                            .then((blob) => downloadPharmaBlob(blob, `BPR-${b.batch_number || b.id}.pdf`))
                            .catch((e: any) => toast.error(fmtErr(e, 'PDF failed')))
                        }
                      >
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
                {ipcTarget === b.id ? (
                  <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">IPC entry</div>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="w-40"
                        placeholder="Check name"
                        value={ipcForm.name}
                        onChange={(e) => setIpcForm({ ...ipcForm, name: e.target.value })}
                      />
                      <Input
                        className="w-32"
                        placeholder="Value"
                        value={ipcForm.value}
                        onChange={(e) => setIpcForm({ ...ipcForm, value: e.target.value })}
                      />
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={ipcForm.passed}
                          onChange={(e) => setIpcForm({ ...ipcForm, passed: e.target.checked })}
                        />
                        Pass
                      </label>
                      <Input
                        className="w-48"
                        placeholder="Notes"
                        value={ipcForm.notes}
                        onChange={(e) => setIpcForm({ ...ipcForm, notes: e.target.value })}
                      />
                      <Button size="sm" onClick={submitIpc}>
                        Save IPC
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIpcTarget(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
                {open ? (
                  <div className="mt-3 rounded-md border border-border/70 bg-muted/30 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operation log</div>
                    <ul className="space-y-1.5">
                      {ops.length === 0 ? <li className="text-xs text-muted-foreground">No steps (no approved MBR linked)</li> : null}
                      {ops.map((s: any, idx: number) => {
                        const pending = !['completed', 'skipped'].includes(s.status)
                        return (
                          <li key={`${s.seq}-${idx}`} className="rounded border border-border/50 bg-background/60 p-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span>
                                <span className="font-mono text-muted-foreground">{s.seq}</span> {s.name}
                                {s.notes ? <span className="text-muted-foreground"> · {s.notes}</span> : null}
                              </span>
                              <PharmaStatusBadge status={s.status} />
                            </div>
                            {pending && b.clearance_done && b.status !== 'completed' && b.status !== 'closed' ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                <Input
                                  className="h-8 w-40"
                                  placeholder="Step notes"
                                  value={stepNotes[`${b.id}:${s.seq}`] || ''}
                                  onChange={(e) =>
                                    setStepNotes({ ...stepNotes, [`${b.id}:${s.seq}`]: e.target.value })
                                  }
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    logStep(b.id, {
                                      seq: s.seq,
                                      name: s.name,
                                      status: 'completed',
                                      notes: stepNotes[`${b.id}:${s.seq}`],
                                    })
                                  }
                                >
                                  Complete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    logStep(b.id, {
                                      seq: s.seq,
                                      name: s.name,
                                      status: 'skipped',
                                      notes: stepNotes[`${b.id}:${s.seq}`] || 'Skipped',
                                    })
                                  }
                                >
                                  Skip
                                </Button>
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                    <div className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">IPC</div>
                    <ul className="space-y-1.5">
                      {(b.ipc_results || []).map((r: any, idx: number) => (
                        <li key={`${r.name}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                          <span>
                            {r.name}
                            {r.value ? ` · ${r.value}` : ''}
                          </span>
                          <PharmaStatusBadge status={r.status || (r.pass === false ? 'rejected' : r.pass ? 'done' : 'pending')} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </PharmaCard>
      <PharmaESignDialog
        open={!!signTarget}
        title="Sign BPR completion"
        description="Re-authenticate to complete this Batch Production Record. Dual-sign vendors need reviewer then approver."
        defaultMeaning="approver"
        confirmLabel="Sign & complete"
        onClose={() => setSignTarget(null)}
        onConfirm={async (payload: PharmaESignPayload) => {
          if (!signTarget) return
          const res = await pharmaApi.completeBpr(signTarget.id, {
            actual_qty: signTarget.qty,
            ...payload,
          })
          if (res?.esign && res.esign.complete === false) {
            toast.message(res.esign.message || 'Awaiting second signature')
          } else {
            toast.success('BPR completed')
          }
          load()
        }}
      />
    </div>
  )
}

function suggestNextQcCode(codes: string[], fallback = '00001'): string {
  let max = 0
  let width = 5
  let found = false
  for (const raw of codes) {
    const c = String(raw || '').trim()
    if (/^\d+$/.test(c)) {
      found = true
      max = Math.max(max, parseInt(c, 10))
      width = Math.max(width, c.length)
    }
  }
  return found ? String(max + 1).padStart(width, '0') : fallback
}

export function PharmaQcSpecsPage() {
  const canManage = useHasPermission('pharma.manage')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [suggestedCode, setSuggestedCode] = useState('00001')
  const [form, setForm] = useState({ product_id: '', code: '', title: '' })
  const [codeTouched, setCodeTouched] = useState(false)
  const [titleTouched, setTitleTouched] = useState(false)
  const [creating, setCreating] = useState(false)
  const [filterProductId, setFilterProductId] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<string | null>(null)
  const [edit, setEdit] = useState({
    title: '',
    notes: '',
    items: [] as { name: string; min: string; max: string; uom: string; required: boolean }[],
  })

  const load = (opts?: { fillSuggestedCode?: boolean }) => {
    setLoading(true)
    return pharmaApi
      .listQcSpecs()
      .then((r) => {
        const rows = r.items || []
        setItems(rows)
        const next = r.suggested_code || suggestNextQcCode(rows.map((x: any) => x.code))
        setSuggestedCode(next)
        if (opts?.fillSuggestedCode) {
          setForm((prev) => ({ ...prev, code: next }))
        } else {
          setForm((prev) => (prev.code.trim() ? prev : { ...prev, code: next }))
        }
        return next as string
      })
      .catch(() => {
        toast.error('Failed to load specs')
        return suggestedCode
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load({ fillSuggestedCode: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openEdit = (s: any) => {
    setEditId(s.id)
    setEdit({
      title: s.title || '',
      notes: s.notes || '',
      items: (s.items || []).map((it: any) => ({
        name: String(it.name || ''),
        min: it.min != null ? String(it.min) : '',
        max: it.max != null ? String(it.max) : '',
        uom: String(it.uom || ''),
        required: it.required !== false,
      })),
    })
  }

  const saveEdit = async () => {
    if (!editId) return
    try {
      await pharmaApi.updateQcSpec(editId, {
        title: edit.title.trim(),
        notes: edit.notes.trim() || null,
        items: edit.items
          .filter((it) => it.name.trim())
          .map((it) => ({
            name: it.name.trim(),
            min: it.min === '' ? undefined : Number(it.min),
            max: it.max === '' ? undefined : Number(it.max),
            uom: it.uom.trim() || undefined,
            required: it.required,
          })),
      })
      toast.success('QC spec saved')
      setEditId(null)
      load()
    } catch (e: any) {
      toast.error(fmtErr(e, 'Save failed'))
    }
  }

  const createSpec = async () => {
    if (!isUuid(form.product_id)) {
      toast.error('Select a product first')
      return
    }
    if (!form.code.trim() || !form.title.trim()) {
      toast.error('Code and title are required')
      return
    }
    setCreating(true)
    try {
      await pharmaApi.createQcSpec({
        product_id: form.product_id,
        code: form.code.trim(),
        title: form.title.trim(),
        items: [
          { name: 'Assay', min: 95, max: 105, uom: '%', required: true },
          { name: 'Dissolution', min: 80, uom: '%', required: true },
        ],
      })
      toast.success('Created — edit tests before approve')
      setCodeTouched(false)
      setTitleTouched(false)
      setForm({ product_id: '', code: '', title: '' })
      await load({ fillSuggestedCode: true })
    } catch (e: any) {
      toast.error(fmtErr(e, 'Create failed'))
    } finally {
      setCreating(false)
    }
  }

  const visibleItems = filterProductId
    ? items.filter((s) => s.product_id === filterProductId)
    : items
  const codeIsSuggested = !codeTouched && form.code === suggestedCode && !!suggestedCode

  return (
    <div className="p-6">
      <PharmaPageHeader title="QC specifications" subtitle="Test specs used during inspection and release." />
      {canManage ? (
        <PharmaCard className="mb-4">
          <h2 className="mb-3 text-sm font-semibold">New QC spec (draft)</h2>
          <div className="space-y-2">
            <div className="grid grid-cols-[minmax(0,1.4fr)_7.5rem_minmax(0,1fr)_auto] items-end gap-2">
              <div className="min-w-0">
                <label className="mb-0.5 block text-[10px] text-muted-foreground">Product *</label>
                <PharmaProductSelect
                  className="w-full"
                  value={form.product_id}
                  onChange={(product_id, product) => {
                    setForm((prev) => ({
                      ...prev,
                      product_id,
                      title: !titleTouched && product?.name ? product.name : prev.title,
                    }))
                  }}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  Code *
                  {codeIsSuggested ? (
                    <span className="rounded bg-emerald-50 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-emerald-700">
                      Suggested
                    </span>
                  ) : null}
                </label>
                <Input
                  className="w-full font-mono"
                  placeholder="Code"
                  value={form.code}
                  onChange={(e) => {
                    setCodeTouched(true)
                    setForm({ ...form, code: e.target.value })
                  }}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[10px] text-muted-foreground">Title *</label>
                <Input
                  className="w-full"
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => {
                    setTitleTouched(true)
                    setForm({ ...form, title: e.target.value })
                  }}
                />
              </div>
              <div className="flex items-center gap-1.5 pb-px">
                {!codeIsSuggested && suggestedCode ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCodeTouched(false)
                      setForm((prev) => ({ ...prev, code: suggestedCode }))
                    }}
                  >
                    Use {suggestedCode}
                  </Button>
                ) : null}
                <Button onClick={createSpec} disabled={creating}>
                  {creating ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Code auto-suggests the next number. Title fills from the product name — both are editable.
            </p>
          </div>
        </PharmaCard>
      ) : null}
      <PharmaCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">All specs</h2>
          <PharmaProductSelect
            className="w-64"
            value={filterProductId}
            emptyLabel="All products"
            placeholder="Filter by product…"
            onChange={(id) => setFilterProductId(id)}
          />
        </div>
        {loading ? (
          <PharmaLoading />
        ) : visibleItems.length === 0 ? (
          <PharmaEmpty
            label={filterProductId ? 'No QC specs for this product' : 'No QC specs'}
            hint={canManage ? 'Create a draft above, then edit tests before approving.' : undefined}
          />
        ) : null}
        <ul className="divide-y divide-border/60">
          {visibleItems.map((s) => (
            <li key={s.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {s.code} v{s.version} · {s.title}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {s.product_name || 'Product'}
                    {s.product_sku ? ` · ${s.product_sku}` : ''}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <PharmaStatusBadge status={s.status} />
                    <span className="text-xs text-muted-foreground">{(s.items || []).length} test(s)</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {s.status === 'draft' && canManage ? (
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                      Edit
                    </Button>
                  ) : null}
                  {s.status === 'draft' && canManage ? (
                    <Button size="sm" variant="outline" onClick={() => setApproveTarget(s.id)}>
                      Approve
                    </Button>
                  ) : null}
                </div>
              </div>
              {editId === s.id ? (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-3">
                  <Input placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                  <Input placeholder="Notes" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
                  {edit.items.map((it, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <Input
                        className="w-36"
                        placeholder="Test"
                        value={it.name}
                        onChange={(e) => {
                          const next = [...edit.items]
                          next[idx] = { ...it, name: e.target.value }
                          setEdit({ ...edit, items: next })
                        }}
                      />
                      <Input
                        className="w-20"
                        placeholder="Min"
                        value={it.min}
                        onChange={(e) => {
                          const next = [...edit.items]
                          next[idx] = { ...it, min: e.target.value }
                          setEdit({ ...edit, items: next })
                        }}
                      />
                      <Input
                        className="w-20"
                        placeholder="Max"
                        value={it.max}
                        onChange={(e) => {
                          const next = [...edit.items]
                          next[idx] = { ...it, max: e.target.value }
                          setEdit({ ...edit, items: next })
                        }}
                      />
                      <Input
                        className="w-16"
                        placeholder="UOM"
                        value={it.uom}
                        onChange={(e) => {
                          const next = [...edit.items]
                          next[idx] = { ...it, uom: e.target.value }
                          setEdit({ ...edit, items: next })
                        }}
                      />
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={it.required}
                          onChange={(e) => {
                            const next = [...edit.items]
                            next[idx] = { ...it, required: e.target.checked }
                            setEdit({ ...edit, items: next })
                          }}
                        />
                        Req
                      </label>
                      <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, items: edit.items.filter((_, j) => j !== idx) })}>
                        Remove
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEdit({
                          ...edit,
                          items: [...edit.items, { name: '', min: '', max: '', uom: '', required: true }],
                        })
                      }
                    >
                      Add test
                    </Button>
                    <Button size="sm" onClick={saveEdit}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </PharmaCard>
      <PharmaESignDialog
        open={!!approveTarget}
        title="Approve QC Specification"
        description="Re-authenticate to approve this QC spec. Once approved, it supersedes prior versions and can be used on inspections."
        defaultMeaning="approver"
        confirmLabel="Sign & approve"
        onClose={() => setApproveTarget(null)}
        onConfirm={async (payload: PharmaESignPayload) => {
          if (!approveTarget) return
          await pharmaApi.approveQcSpec(approveTarget, {
            password: payload.password,
            meaning: payload.meaning,
            totp_code: payload.totp_code,
          })
          toast.success('QC spec approved')
          load()
        }}
      />
    </div>
  )
}

export function PharmaInspectionsPage() {
  const canManage = useHasPermission('pharma.manage')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ goods_batch_id: '', product_id: '' })
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null)
  const [filter, setFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [resultRows, setResultRows] = useState<
    { name: string; value: string; uom: string; pass: boolean }[]
  >([])
  const [oosPanel, setOosPanel] = useState<string | null>(null)
  const [oosForm, setOosForm] = useState<Record<string, { root_cause: string; disposition: string; notes: string }>>({})

  const load = () => {
    setLoading(true)
    pharmaApi
      .listInspections(filter ? { status: filter } : undefined)
      .then((r) => setItems(r.items || []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [filter])

  const openResults = (insp: any) => {
    const existing = (insp.results || []).filter((r: any) => r?.name)
    setEditingId(insp.id)
    setResultRows(
      existing.length
        ? existing.map((r: any) => ({
            name: String(r.name || ''),
            value: r.value != null ? String(r.value) : '',
            uom: String(r.uom || ''),
            pass: r.pass !== false,
          }))
        : [
            { name: 'Assay', value: '', uom: '%', pass: true },
            { name: 'Appearance', value: '', uom: '', pass: true },
          ],
    )
  }

  const saveResults = async () => {
    if (!editingId) return
    const results = resultRows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        value: r.value.trim() === '' ? null : Number.isNaN(Number(r.value)) ? r.value.trim() : Number(r.value),
        uom: r.uom.trim() || undefined,
        pass: r.pass,
      }))
    if (!results.length) {
      toast.error('Add at least one result row')
      return
    }
    try {
      await pharmaApi.saveInspectionResults(editingId, {
        results,
        status: 'pending_release',
      })
      toast.success('Results saved — ready for release')
      setEditingId(null)
      load()
    } catch (e: any) {
      toast.error(fmtErr(e, 'Save failed'))
    }
  }

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Inspection lots"
        subtitle="QI receipts/production auto-open inspections. Enter results, then release."
      />
      {canManage ? (
        <PharmaCard className="mb-4">
          <h2 className="mb-3 text-sm font-semibold">Create / reopen inspection</h2>
          <div className="space-y-2">
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] items-end gap-2">
              <div className="min-w-0">
                <label className="mb-0.5 block text-[10px] text-muted-foreground">
                  QI batch * <span className="font-normal">(lots in quality inspection)</span>
                </label>
                <PharmaBatchSelect
                  className="w-full"
                  qualityStatus="quality_inspection"
                  value={form.goods_batch_id}
                  onChange={(goods_batch_id, batch) => {
                    setSelectedBatch(goods_batch_id ? batch || null : null)
                    setForm({
                      goods_batch_id,
                      product_id: batch?.product_id || (goods_batch_id ? form.product_id : ''),
                    })
                  }}
                  placeholder="Select QI batch…"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[10px] text-muted-foreground">Product *</label>
                <PharmaProductSelect
                  className="w-full"
                  value={form.product_id}
                  onChange={(product_id) => setForm({ ...form, product_id })}
                />
              </div>
              <Button
                onClick={() => {
                  if (!isUuid(form.goods_batch_id) || !isUuid(form.product_id)) {
                    toast.error('Select a batch and product')
                    return
                  }
                  pharmaApi
                    .createInspection(form)
                    .then(() => {
                      toast.success('Created')
                      setForm({ goods_batch_id: '', product_id: '' })
                      setSelectedBatch(null)
                      load()
                    })
                    .catch((e: any) => toast.error(fmtErr(e, 'Create failed')))
                }}
              >
                Create inspection
              </Button>
            </div>
            <PharmaBatchSummary batch={selectedBatch} />
            {!selectedBatch ? (
              <p className="text-[11px] text-muted-foreground">
                Each option shows source, quantity, and expiry under the batch number. Empty if no lots are in QI yet.
              </p>
            ) : null}
          </div>
        </PharmaCard>
      ) : null}
      <PharmaToolbar>
        {[
          ['', 'All'],
          ['open', 'Open'],
          ['pending_release', 'Pending release'],
          ['released', 'Released'],
          ['rejected', 'Rejected'],
        ].map(([v, label]) => (
          <Button key={v || 'all'} size="sm" variant={filter === v ? 'default' : 'outline'} onClick={() => setFilter(v)}>
            {label}
          </Button>
        ))}
      </PharmaToolbar>
      <PharmaCard>
        {loading ? <PharmaLoading /> : items.length === 0 ? <PharmaEmpty label="No inspections" /> : null}
        <ul className="divide-y divide-border/60">
          {items.map((i) => (
            <li key={i.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {i.product_name || '—'}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · Batch{' '}
                      {i.goods_batch_id ? (
                        <Link className="font-mono text-foreground hover:underline" to={`/pharma/batches/${i.goods_batch_id}`}>
                          {i.batch_number || i.id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="font-mono">{i.batch_number || i.id.slice(0, 8)}</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {i.source_label ? (
                      <span>
                        Source: <span className="font-medium text-foreground/80">{i.source_label}</span>
                      </span>
                    ) : (
                      <span className="capitalize">Origin: {i.origin || '—'}</span>
                    )}
                    {i.supplier_batch_number ? (
                      <span>· Supplier lot {i.supplier_batch_number}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <PharmaStatusBadge status={i.status} />
                    {i.origin ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {i.origin}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['open', 'testing'].includes(i.status) && canManage ? (
                    <Button size="sm" variant="outline" onClick={() => openResults(i)}>
                      Enter results
                    </Button>
                  ) : null}
                  {i.status === 'rejected' && !i.oos_status && canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        pharmaApi
                          .openOos(i.id, { notes: '' })
                          .then(() => { toast.success('OOS investigation opened'); load() })
                          .catch((e: any) => toast.error(fmtErr(e, 'Failed')))
                      }}
                    >
                      Open OOS
                    </Button>
                  ) : null}
                  {i.oos_status === 'open' && canManage ? (
                    <Button
                      size="sm"
                      variant={oosPanel === i.id ? 'default' : 'outline'}
                      onClick={() => {
                        setOosPanel(oosPanel === i.id ? null : i.id)
                        if (!oosForm[i.id]) {
                          setOosForm((prev) => ({ ...prev, [i.id]: { root_cause: '', disposition: 'reject', notes: '' } }))
                        }
                      }}
                    >
                      OOS investigation
                    </Button>
                  ) : null}
                  {i.oos_status === 'closed' ? (
                    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800 ring-1 ring-inset ring-green-600/20">
                      OOS closed
                    </span>
                  ) : null}
                </div>
              </div>
              {oosPanel === i.id && i.oos_status === 'open' ? (
                <div className="mt-3 space-y-2 rounded-md border border-amber-200 bg-amber-50/50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">OOS Investigation</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Root cause</label>
                      <Input
                        placeholder="Root cause analysis"
                        value={oosForm[i.id]?.root_cause || ''}
                        onChange={(e) =>
                          setOosForm((prev) => ({ ...prev, [i.id]: { ...prev[i.id], root_cause: e.target.value } }))
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Disposition</label>
                      <Select
                        value={oosForm[i.id]?.disposition || 'reject'}
                        onChange={(v) =>
                          setOosForm((prev) => ({ ...prev, [i.id]: { ...prev[i.id], disposition: v } }))
                        }
                        options={[
                          { value: 'reject', label: 'Reject lot' },
                          { value: 'rework', label: 'Rework' },
                          { value: 'release_conditional', label: 'Conditional release' },
                          { value: 'recall', label: 'Initiate recall' },
                        ]}
                      />
                    </div>
                  </div>
                  <textarea
                    className="w-full rounded-md border border-border bg-background p-2 text-xs"
                    rows={2}
                    placeholder="Additional notes…"
                    value={oosForm[i.id]?.notes || ''}
                    onChange={(e) =>
                      setOosForm((prev) => ({ ...prev, [i.id]: { ...prev[i.id], notes: e.target.value } }))
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        const f = oosForm[i.id]
                        if (!f?.root_cause?.trim()) { toast.error('Root cause required'); return }
                        pharmaApi
                          .closeOos(i.id, { root_cause: f.root_cause, disposition: f.disposition, notes: f.notes })
                          .then(() => { toast.success('OOS investigation closed'); setOosPanel(null); load() })
                          .catch((e: any) => toast.error(fmtErr(e, 'Failed')))
                      }}
                    >
                      Close investigation
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setOosPanel(null)}>Cancel</Button>
                  </div>
                </div>
              ) : null}
              {editingId === i.id ? (
                <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Test results</div>
                  <div className="space-y-2">
                    {resultRows.map((row, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <Input
                          className="w-36"
                          placeholder="Test"
                          value={row.name}
                          onChange={(e) => {
                            const next = [...resultRows]
                            next[idx] = { ...row, name: e.target.value }
                            setResultRows(next)
                          }}
                        />
                        <Input
                          className="w-28"
                          placeholder="Value"
                          value={row.value}
                          onChange={(e) => {
                            const next = [...resultRows]
                            next[idx] = { ...row, value: e.target.value }
                            setResultRows(next)
                          }}
                        />
                        <Input
                          className="w-20"
                          placeholder="UOM"
                          value={row.uom}
                          onChange={(e) => {
                            const next = [...resultRows]
                            next[idx] = { ...row, uom: e.target.value }
                            setResultRows(next)
                          }}
                        />
                        <label className="flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={row.pass}
                            onChange={(e) => {
                              const next = [...resultRows]
                              next[idx] = { ...row, pass: e.target.checked }
                              setResultRows(next)
                            }}
                          />
                          Pass
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setResultRows(resultRows.filter((_, j) => j !== idx))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResultRows([...resultRows, { name: '', value: '', uom: '', pass: true }])}
                    >
                      Add row
                    </Button>
                    <Button size="sm" onClick={saveResults}>
                      Save &amp; submit for release
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </PharmaCard>
    </div>
  )
}

async function printCoa(id: string) {
  const html = await pharmaApi.getCoaPrintHtml(id)
  const w = window.open('', '_blank')
  if (!w) throw new Error('Pop-up blocked')
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

export function PharmaReleasePage() {
  const canRelease = useHasPermission('pharma.release')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [coa, setCoa] = useState<any>(null)
  const [tab, setTab] = useState<'pending_release' | 'released'>('pending_release')
  const [signTarget, setSignTarget] = useState<{ id: string; decision: 'release' | 'reject' } | null>(null)

  const load = () => {
    setLoading(true)
    pharmaApi
      .listInspections({ status: tab })
      .then((r) => setItems(r.items || []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [tab])

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Release & CoA"
        subtitle="Formal batch release (requires pharma.release + e-sign). Print Certificate of Analysis after release."
      />
      <PharmaToolbar>
        <Button size="sm" variant={tab === 'pending_release' ? 'default' : 'outline'} onClick={() => setTab('pending_release')}>
          Pending release
        </Button>
        <Button size="sm" variant={tab === 'released' ? 'default' : 'outline'} onClick={() => setTab('released')}>
          Released
        </Button>
      </PharmaToolbar>
      <PharmaCard className="mb-4">
        {loading ? (
          <PharmaLoading />
        ) : items.length === 0 ? (
          <PharmaEmpty label={tab === 'pending_release' ? 'No lots pending release' : 'No released lots yet'} />
        ) : null}
        <ul className="divide-y divide-border/60">
          {items.map((i) => {
            const sigs: any[] = i.coa_data?.esignatures || []
            const awaitingSecond = sigs.length === 1
            const firstSigner = sigs[0]
            return (
              <li key={i.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {i.product_name || '—'}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        · Batch <span className="font-mono text-foreground">{i.batch_number || i.id.slice(0, 8)}</span>
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {i.source_label ? (
                        <>Source: <span className="font-medium text-foreground/80">{i.source_label}</span></>
                      ) : (
                        <span className="capitalize">Origin: {i.origin || '—'}</span>
                      )}
                      {i.supplier_batch_number ? <> · Supplier lot {i.supplier_batch_number}</> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <PharmaStatusBadge status={i.status} />
                      {i.coa_number ? <span className="text-xs text-muted-foreground">{i.coa_number}</span> : null}
                      {awaitingSecond ? (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                          Awaiting 2nd signature
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {i.status === 'pending_release' && canRelease ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setSignTarget({ id: i.id, decision: 'release' })}
                        >
                          {awaitingSecond ? 'Sign (2nd)' : 'Release'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSignTarget({ id: i.id, decision: 'reject' })}>
                          Reject
                        </Button>
                      </>
                    ) : i.status === 'pending_release' ? (
                      <span className="text-xs text-muted-foreground italic">Requires pharma.release</span>
                    ) : null}
                    {i.status === 'released' ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => pharmaApi.getCoa(i.id).then(setCoa)}>
                          View CoA
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            printCoa(i.id).catch((e: any) => toast.error(e?.message || fmtErr(e, 'Failed')))
                          }
                        >
                          Print CoA
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            pharmaApi
                              .getCoaPdfBlob(i.id)
                              .then((blob) => downloadPharmaBlob(blob, `${i.coa_number || 'coa'}.pdf`))
                              .catch((e: any) => toast.error(fmtErr(e, 'PDF failed')))
                          }
                        >
                          PDF
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                {sigs.length > 0 ? (
                  <div className="mt-2 space-y-0.5">
                    {sigs.map((s: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">{idx + 1}</span>
                        <span className="font-medium text-foreground">{s.by_name || s.actor_name || 'Unknown'}</span>
                        <span className="capitalize">{s.meaning || 'signed'}</span>
                        <span>
                          {(s.at || s.signed_at)
                            ? new Date(s.at || s.signed_at).toLocaleString()
                            : ''}
                        </span>
                      </div>
                    ))}
                    {awaitingSecond ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-dashed border-amber-400 text-amber-600 text-[10px] font-bold">2</span>
                        <span className="italic">Second signature required — must be a different user</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </PharmaCard>
      <PharmaESignDialog
        open={!!signTarget}
        title={signTarget?.decision === 'reject' ? 'Sign rejection' : 'Sign batch release'}
        description={
          signTarget?.decision === 'release'
            ? 'Password re-authentication required. If dual-sign is enabled, a second approver must also sign before release completes.'
            : 'Password re-authentication required. Notes are mandatory for rejection.'
        }
        defaultMeaning={signTarget?.decision === 'reject' ? 'approver' : 'reviewer'}
        confirmLabel={signTarget?.decision === 'reject' ? 'Sign & reject' : 'Sign & release'}
        showNotes
        notesLabel="Decision notes"
        notesRequired={signTarget?.decision === 'reject'}
        onClose={() => setSignTarget(null)}
        onConfirm={async (payload: PharmaESignPayload) => {
          if (!signTarget) return
          const { notes, ...esign } = payload
          const res = await pharmaApi.decideInspection(signTarget.id, {
            decision: signTarget.decision,
            notes,
            ...esign,
          })
          if (res?.esign && res.esign.complete === false) {
            toast.message(res.esign.message || 'First signature recorded — awaiting second signature from a different user')
          } else {
            toast.success(signTarget.decision === 'reject' ? 'Lot rejected' : 'Lot released')
          }
          load()
        }}
      />
      {coa ? (
        <PharmaCard>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-medium">CoA {coa.coa_number}</h2>
            <Button size="sm" variant="ghost" onClick={() => setCoa(null)}>
              Close
            </Button>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted-foreground">Batch</span>
              <div className="font-mono">{coa.batch?.batch_number || '—'}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Released</span>
              <div>{coa.coa_data?.released_at?.slice?.(0, 19) || '—'}</div>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {(coa.inspection?.results || []).map((r: any, idx: number) => (
              <li key={idx} className="flex justify-between border-b border-border/50 py-1">
                <span>
                  {r.name}: {r.value}
                  {r.uom ? ` ${r.uom}` : ''}
                </span>
                <PharmaStatusBadge status={r.pass ? 'released' : 'rejected'} />
              </li>
            ))}
          </ul>
        </PharmaCard>
      ) : null}
    </div>
  )
}
