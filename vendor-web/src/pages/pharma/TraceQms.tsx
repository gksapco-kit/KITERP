import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { pharmaApi } from '@/api/pharma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useHasPermission } from '@/hooks/usePermissions'
import {
  GenealogyNode,
  PharmaBatchSelect,
  PharmaCard,
  PharmaEmpty,
  PharmaESignDialog,
  PharmaLoading,
  PharmaPageHeader,
  PharmaStatusBadge,
  PharmaToolbar,
  isUuid,
  type PharmaESignPayload,
} from './pharmaShared'

export function PharmaGenealogyPage() {
  const [params] = useSearchParams()
  const [batchId, setBatchId] = useState(params.get('batch') || '')
  const [tree, setTree] = useState<any>(null)
  const [raw, setRaw] = useState(false)

  const run = (id = batchId) => {
    if (!isUuid(id)) {
      toast.error('Select a batch first')
      return
    }
    pharmaApi
      .genealogy(id.trim())
      .then(setTree)
      .catch((e) => toast.error(e?.response?.data?.detail || 'Failed'))
  }

  useEffect(() => {
    const fromUrl = params.get('batch')
    if (fromUrl && isUuid(fromUrl)) {
      setBatchId(fromUrl)
      run(fromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Genealogy"
        subtitle="Forward and backward lot traceability from batch transactions."
      />
      <PharmaCard className="mb-4">
        <PharmaToolbar>
          <PharmaBatchSelect className="w-96" value={batchId} onChange={setBatchId} />
          <Button onClick={() => run()}>Trace</Button>
          {tree ? (
            <Button size="sm" variant="outline" onClick={() => setRaw((v) => !v)}>
              {raw ? 'Tree view' : 'JSON'}
            </Button>
          ) : null}
        </PharmaToolbar>
      </PharmaCard>
      {tree ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <PharmaCard>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium">{tree.batch_number}</span>
              <PharmaStatusBadge status={tree.quality_status} />
              <span className="text-xs text-muted-foreground">qty {tree.quantity_available}</span>
            </div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upstream (components)</h3>
            {(tree.upstream || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No upstream links</p>
            ) : (
              tree.upstream.map((n: any, i: number) => <GenealogyNode key={i} node={n} />)
            )}
          </PharmaCard>
          <PharmaCard>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Downstream (usage)</h3>
            {(tree.downstream || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No downstream links</p>
            ) : (
              tree.downstream.map((n: any, i: number) => <GenealogyNode key={i} node={n} />)
            )}
          </PharmaCard>
          {raw ? (
            <PharmaCard className="lg:col-span-2">
              <pre className="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(tree, null, 2)}</pre>
            </PharmaCard>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function PharmaRecallsPage() {
  const canManage = useHasPermission('pharma.manage')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ goods_batch_id: '', reason: '' })
  const [expanded, setExpanded] = useState<string | null>(null)
  const load = () => {
    setLoading(true)
    pharmaApi.listRecalls().then((r) => setItems(r.items || [])).catch(() => toast.error('Failed')).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Recalls"
        subtitle="Block the lot, snapshot genealogy, log notify/investigate actions, then close."
      />
      {canManage ? (
        <PharmaCard className="mb-4">
          <PharmaToolbar>
            <PharmaBatchSelect
              className="w-80"
              value={form.goods_batch_id}
              onChange={(id) => setForm({ ...form, goods_batch_id: id })}
            />
            <Input
              className="w-72"
              placeholder="Reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
            <Button
              onClick={() => {
                if (!isUuid(form.goods_batch_id) || !form.reason.trim()) {
                  toast.error('Select a batch and enter a reason')
                  return
                }
                pharmaApi.createRecall(form).then(() => {
                  toast.success('Recall opened — lot blocked')
                  setForm({ goods_batch_id: '', reason: '' })
                  load()
                })
              }}
            >
              Start recall
            </Button>
          </PharmaToolbar>
        </PharmaCard>
      ) : null}
      <PharmaCard>
        {loading ? <PharmaLoading /> : items.length === 0 ? <PharmaEmpty label="No recalls" /> : null}
        <ul className="divide-y divide-border/60">
          {items.map((r) => {
            const open = expanded === r.id
            const snap = r.affected_summary || {}
            const gene = snap.genealogy || {}
            return (
              <li key={r.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.recall_number}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <PharmaStatusBadge status={r.status} />
                      <PharmaStatusBadge status={r.severity} />
                      <span className="text-xs text-muted-foreground">{(r.actions || []).length} action(s)</span>
                      {snap.qty_on_hand != null ? (
                        <span className="text-xs text-muted-foreground">qty on hand {snap.qty_on_hand}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 max-w-xl text-xs text-muted-foreground">{r.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        pharmaApi.exportRecallCsv(r.id).then((blob) => {
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `recall-${r.recall_number}.csv`
                          a.click()
                          URL.revokeObjectURL(url)
                        }).catch(() => toast.error('Export failed'))
                      }}
                    >
                      Export CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        pharmaApi.exportRecallPdf(r.id).then((blob) => {
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `recall-${r.recall_number}.pdf`
                          a.click()
                          URL.revokeObjectURL(url)
                        }).catch(() => toast.error('PDF export failed'))
                      }}
                    >
                      Export PDF
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : r.id)}>
                      {open ? 'Hide snapshot' : 'Snapshot'}
                    </Button>
                    {r.status !== 'closed' && canManage ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            pharmaApi.updateRecall(r.id, { status: 'investigating', action: 'Investigation started' }).then(load)
                          }
                        >
                          Investigate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            pharmaApi.updateRecall(r.id, { status: 'notified', action: 'Customers notified' }).then(load)
                          }
                        >
                          Notify
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            pharmaApi.updateRecall(r.id, { status: 'closed', action: 'Recall closed' }).then(() => {
                              toast.success('Closed')
                              load()
                            })
                          }
                        >
                          Close
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                {open ? (
                  <div className="mt-3 grid gap-3 rounded-md border border-border/70 bg-muted/30 p-3 lg:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Upstream at recall</div>
                      {(gene.upstream || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">None</p>
                      ) : (
                        gene.upstream.map((n: any, i: number) => <GenealogyNode key={i} node={n} />)
                      )}
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Downstream at recall</div>
                      {(gene.downstream || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">None</p>
                      ) : (
                        gene.downstream.map((n: any, i: number) => <GenealogyNode key={i} node={n} />)
                      )}
                    </div>
                    {(r.actions || []).length ? (
                      <div className="lg:col-span-2">
                        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Action log</div>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {r.actions.map((a: any, idx: number) => (
                            <li key={idx} className="flex flex-wrap items-baseline gap-1">
                              <span className="shrink-0 font-mono text-muted-foreground/70">
                                {(a.at || a.created_at || '').slice(0, 19) || '—'}
                              </span>
                              <span className="shrink-0">·</span>
                              {a.action || a.note ? (
                                <span>{a.action || a.note}</span>
                              ) : (
                                Object.entries(a)
                                  .filter(([k]) => !['at', 'created_at'].includes(k))
                                  .map(([k, v]) => (
                                    <span key={k} className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                                      {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                                    </span>
                                  ))
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </PharmaCard>
    </div>
  )
}

export function PharmaDeviationsPage() {
  const canManage = useHasPermission('pharma.manage')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    title: '',
    severity: 'minor',
    description: '',
    goods_batch_id: '',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const load = () => {
    setLoading(true)
    pharmaApi.listDeviations().then((r) => setItems(r.items || [])).catch(() => toast.error('Failed')).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Deviations"
        subtitle="Open → investigate → link CAPA. Closing CAPA closes the deviation."
      />
      {canManage ? (
      <PharmaCard className="mb-4 space-y-3">
        <PharmaToolbar>
          <Input
            className="w-72"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Select
            value={form.severity}
            onChange={(severity) => setForm({ ...form, severity })}
            options={[
              { value: 'minor', label: 'Minor' },
              { value: 'major', label: 'Major' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
          <PharmaBatchSelect
            className="w-72"
            value={form.goods_batch_id}
            onChange={(goods_batch_id) => setForm({ ...form, goods_batch_id })}
            placeholder="Link batch (optional)…"
          />
        </PharmaToolbar>
        <textarea
          className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Description / investigation notes"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Button
          onClick={() => {
            if (!form.title.trim()) {
              toast.error('Title required')
              return
            }
            pharmaApi
              .createDeviation({
                title: form.title,
                severity: form.severity,
                description: form.description.trim() || undefined,
                goods_batch_id: isUuid(form.goods_batch_id) ? form.goods_batch_id : undefined,
              })
              .then(() => {
                setForm({ title: '', severity: 'minor', description: '', goods_batch_id: '' })
                load()
              })
          }}
        >
          Create
        </Button>
      </PharmaCard>
      ) : null}
      <PharmaCard>
        {loading ? <PharmaLoading /> : items.length === 0 ? <PharmaEmpty label="No deviations" /> : null}
        <ul className="divide-y divide-border/60">
          {items.map((d) => (
            <li key={d.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {d.number} · {d.title}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <PharmaStatusBadge status={d.status} />
                    <PharmaStatusBadge status={d.severity} />
                    {d.goods_batch_id ? (
                      <span className="text-xs text-muted-foreground">batch {String(d.goods_batch_id).slice(0, 8)}…</span>
                    ) : null}
                  </div>
                  {d.description ? <p className="mt-1 max-w-xl text-xs text-muted-foreground">{d.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {d.status !== 'closed' && canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditId(d.id)
                        setEditDesc(d.description || '')
                      }}
                    >
                      Notes
                    </Button>
                  ) : null}
                  {d.status === 'open' && canManage ? (
                    <Button size="sm" variant="outline" onClick={() => pharmaApi.updateDeviation(d.id, { status: 'investigating' }).then(load)}>
                      Investigate
                    </Button>
                  ) : null}
                  {d.status !== 'closed' && canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        pharmaApi.createCapa({ title: `CAPA for ${d.number}`, deviation_id: d.id }).then(() => {
                          toast.success('CAPA linked')
                          load()
                        })
                      }
                    >
                      Create CAPA
                    </Button>
                  ) : null}
                </div>
              </div>
              {editId === d.id ? (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-3">
                  <textarea
                    className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Investigation notes"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        pharmaApi
                          .updateDeviation(d.id, {
                            description: editDesc,
                            status: d.status === 'open' ? 'investigating' : d.status,
                          })
                          .then(() => {
                            toast.success('Updated')
                            setEditId(null)
                            load()
                          })
                      }
                    >
                      Save notes
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
    </div>
  )
}

export function PharmaCapasPage() {
  const canManage = useHasPermission('pharma.manage')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [signId, setSignId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    root_cause: '',
    corrective: '',
    preventive: '',
    effectiveness_check: '',
  })
  const load = () => {
    setLoading(true)
    pharmaApi.listCapas().then((r) => setItems(r.items || [])).catch(() => toast.error('Failed')).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])

  const openEdit = (c: any) => {
    setEditId(c.id)
    setEditForm({
      root_cause: c.root_cause || '',
      corrective: (c.corrective_actions || []).map((a: any) => (typeof a === 'string' ? a : a?.text || '')).join('\n'),
      preventive: (c.preventive_actions || []).map((a: any) => (typeof a === 'string' ? a : a?.text || '')).join('\n'),
      effectiveness_check: c.effectiveness_check || '',
    })
  }

  const saveEdit = async () => {
    if (!editId) return
    try {
      await pharmaApi.updateCapa(editId, {
        root_cause: editForm.root_cause.trim() || undefined,
        corrective_actions: editForm.corrective
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        preventive_actions: editForm.preventive
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        effectiveness_check: editForm.effectiveness_check.trim() || undefined,
        status: 'in_progress',
      })
      toast.success('CAPA updated')
      setEditId(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Update failed')
    }
  }

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="CAPA"
        subtitle="Corrective / preventive actions — effectiveness check + e-sign required to close."
      />
      {canManage ? (
        <PharmaCard className="mb-4">
          <PharmaToolbar>
            <Input className="w-80" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button
              onClick={() => {
                if (!title.trim()) return
                pharmaApi.createCapa({ title }).then(() => {
                  setTitle('')
                  load()
                })
              }}
            >
              Create CAPA
            </Button>
          </PharmaToolbar>
        </PharmaCard>
      ) : null}
      <PharmaCard>
        {loading ? <PharmaLoading /> : items.length === 0 ? <PharmaEmpty label="No CAPAs" /> : null}
        <ul className="divide-y divide-border/60">
          {items.map((c) => (
            <li key={c.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {c.number} · {c.title}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <PharmaStatusBadge status={c.status} />
                    {c.root_cause ? <span className="text-xs text-muted-foreground">RC recorded</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.status !== 'closed' && canManage ? (
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                  ) : null}
                  {c.status === 'open' && canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        pharmaApi.updateCapa(c.id, { status: 'in_progress' }).then(load)
                      }
                    >
                      Start
                    </Button>
                  ) : null}
                  {c.status !== 'closed' && canManage ? (
                    <Button size="sm" onClick={() => openEdit(c)}>
                      Close…
                    </Button>
                  ) : null}
                </div>
              </div>
              {editId === c.id ? (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-3">
                  <Input
                    placeholder="Root cause"
                    value={editForm.root_cause}
                    onChange={(e) => setEditForm({ ...editForm, root_cause: e.target.value })}
                  />
                  <textarea
                    className="min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Corrective actions (one per line)"
                    value={editForm.corrective}
                    onChange={(e) => setEditForm({ ...editForm, corrective: e.target.value })}
                  />
                  <textarea
                    className="min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Preventive actions (one per line)"
                    value={editForm.preventive}
                    onChange={(e) => setEditForm({ ...editForm, preventive: e.target.value })}
                  />
                  <Input
                    placeholder="Effectiveness check (required to close)"
                    value={editForm.effectiveness_check}
                    onChange={(e) => setEditForm({ ...editForm, effectiveness_check: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!editForm.effectiveness_check.trim()) {
                          toast.error('Effectiveness check required to close')
                          return
                        }
                        setSignId(c.id)
                      }}
                    >
                      Sign &amp; close
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
        open={!!signId}
        title="Sign CAPA closure"
        description="Confirm effectiveness and re-authenticate to close this CAPA."
        defaultMeaning="approver"
        confirmLabel="Sign & close"
        onClose={() => setSignId(null)}
        onConfirm={async (payload: PharmaESignPayload) => {
          if (!signId) return
          const effectiveness =
            editForm.effectiveness_check.trim() ||
            items.find((c) => c.id === signId)?.effectiveness_check
          if (!effectiveness) {
            throw new Error('Enter effectiveness check before closing')
          }
          const res = await pharmaApi.updateCapa(signId, {
            status: 'closed',
            root_cause: editForm.root_cause.trim() || undefined,
            corrective_actions: editForm.corrective
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
            preventive_actions: editForm.preventive
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
            effectiveness_check: effectiveness,
            ...payload,
          })
          if (res?.esign && res.esign.complete === false) {
            toast.message(res.esign.message || 'Awaiting second signature')
          } else {
            toast.success('CAPA closed')
          }
          setEditId(null)
          load()
        }}
      />
    </div>
  )
}

export function PharmaChangeControlPage() {
  const canManage = useHasPermission('pharma.manage')
  const canRelease = useHasPermission('pharma.release')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    title: '',
    change_type: 'mbr',
    description: '',
    impact_assessment: '',
  })
  const [signId, setSignId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [edit, setEdit] = useState({ description: '', impact_assessment: '' })
  const load = () => {
    setLoading(true)
    pharmaApi.listChangeControls().then((r) => setItems(r.items || [])).catch(() => toast.error('Failed')).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Change control"
        subtitle="Draft → review → e-sign approve (pharma.release) → implement."
      />
      {canManage ? (
        <PharmaCard className="mb-4 space-y-3">
          <PharmaToolbar>
            <Input
              className="w-72"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Select
              value={form.change_type}
              onChange={(change_type) => setForm({ ...form, change_type })}
              options={[
                { value: 'mbr', label: 'MBR' },
                { value: 'bom', label: 'BOM' },
                { value: 'spec', label: 'Spec' },
                { value: 'process', label: 'Process' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </PharmaToolbar>
          <textarea
            className="min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Description / justification"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <textarea
            className="min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Impact assessment"
            value={form.impact_assessment}
            onChange={(e) => setForm({ ...form, impact_assessment: e.target.value })}
          />
          <Button
            onClick={() => {
              if (!form.title.trim()) return
              pharmaApi
                .createChangeControl({
                  title: form.title,
                  change_type: form.change_type,
                  description: form.description.trim() || undefined,
                  impact_assessment: form.impact_assessment.trim() || undefined,
                })
                .then(() => {
                  setForm({ title: '', change_type: 'mbr', description: '', impact_assessment: '' })
                  load()
                })
            }}
          >
            Create
          </Button>
        </PharmaCard>
      ) : null}
      <PharmaCard>
        {loading ? <PharmaLoading /> : items.length === 0 ? <PharmaEmpty label="No change controls" /> : null}
        <ul className="divide-y divide-border/60">
          {items.map((c) => (
            <li key={c.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {c.number} · {c.title}
                  </div>
                  <div className="mt-1 flex gap-2">
                    <PharmaStatusBadge status={c.status} />
                    <span className="text-xs uppercase text-muted-foreground">{c.change_type}</span>
                  </div>
                  {c.description ? <p className="mt-1 max-w-xl text-xs text-muted-foreground">{c.description}</p> : null}
                  {c.impact_assessment ? (
                    <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">Impact: {c.impact_assessment}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {['draft', 'in_review'].includes(c.status) && canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditId(c.id)
                        setEdit({
                          description: c.description || '',
                          impact_assessment: c.impact_assessment || '',
                        })
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {c.status === 'draft' && canManage ? (
                    <Button size="sm" variant="outline" onClick={() => pharmaApi.updateChangeControl(c.id, { status: 'in_review' }).then(load)}>
                      Submit
                    </Button>
                  ) : null}
                  {['draft', 'in_review'].includes(c.status) && canRelease ? (
                    <Button size="sm" onClick={() => setSignId(c.id)}>
                      Approve
                    </Button>
                  ) : null}
                  {c.status === 'approved' && canManage ? (
                    <Button size="sm" variant="outline" onClick={() => pharmaApi.updateChangeControl(c.id, { status: 'implemented' }).then(load)}>
                      Mark implemented
                    </Button>
                  ) : null}
                </div>
              </div>
              {editId === c.id ? (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-3">
                  <textarea
                    className="min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Description / justification"
                    value={edit.description}
                    onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  />
                  <textarea
                    className="min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Impact assessment"
                    value={edit.impact_assessment}
                    onChange={(e) => setEdit({ ...edit, impact_assessment: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        pharmaApi
                          .updateChangeControl(c.id, {
                            description: edit.description,
                            impact_assessment: edit.impact_assessment,
                          })
                          .then(() => {
                            toast.success('Updated')
                            setEditId(null)
                            load()
                          })
                      }
                    >
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
        open={!!signId}
        title="Sign change control approval"
        description="Re-authenticate to approve this change."
        defaultMeaning="approver"
        confirmLabel="Sign & approve"
        onClose={() => setSignId(null)}
        onConfirm={async (payload: PharmaESignPayload) => {
          if (!signId) return
          const res = await pharmaApi.approveChangeControl(signId, payload)
          if (res?.esign && res.esign.complete === false) {
            toast.message(res.esign.message || 'Awaiting second signature')
          } else {
            toast.success('Approved')
          }
          load()
        }}
      />
    </div>
  )
}

export function PharmaAuditPage() {
  const [events, setEvents] = useState<any[]>([])
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    pharmaApi
      .audit({
        entity_type: entityType.trim() || undefined,
        entity_id: isUuid(entityId) ? entityId.trim() : undefined,
      })
      .then((r) => setEvents(r.events || []))
      .catch(() => toast.error('Failed to load audit'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="E-sign & audit"
        subtitle="Append-only GxP audit with password-verified e-sign, meaning-of-signature, and failed-attempt logging (pharma.audit)."
      />
      <PharmaCard className="mb-4">
        <PharmaToolbar>
          <Select
            value={entityType}
            onChange={setEntityType}
            options={[
              { value: '', label: 'All entity types' },
              { value: 'goods_batch', label: 'goods_batch' },
              { value: 'pharma_inspection_lot', label: 'pharma_inspection_lot' },
              { value: 'pharma_bpr', label: 'pharma_bpr' },
              { value: 'pharma_mbr', label: 'pharma_mbr' },
              { value: 'pharma_capa', label: 'pharma_capa' },
              { value: 'pharma_deviation', label: 'pharma_deviation' },
              { value: 'pharma_recall', label: 'pharma_recall' },
              { value: 'pharma_change_control', label: 'pharma_change_control' },
            ]}
          />
          <Input
            className="w-72"
            placeholder="Entity UUID (optional)"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          />
          <Button onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Filter'}
          </Button>
        </PharmaToolbar>
      </PharmaCard>
      <PharmaCard>
        {events.length === 0 ? <PharmaEmpty label="No audit events yet" /> : null}
        <ul className="divide-y divide-border/60">
          {events.map((e) => (
            <li key={e.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                <span>{e.action}</span>
                {e.meaning ? <PharmaStatusBadge status={e.meaning} /> : null}
                {e.esign_verified ? <PharmaStatusBadge status="approved" /> : null}
                {e.action === 'esign_failed' ? <PharmaStatusBadge status="rejected" /> : null}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {e.entity_type}
                {e.entity_id ? ` · ${String(e.entity_id).slice(0, 8)}…` : ''} · {e.actor_name || '—'} ·{' '}
                {e.created_at?.slice?.(0, 19)} · {e.signature_hash?.slice(0, 16)}…
              </div>
            </li>
          ))}
        </ul>
      </PharmaCard>
    </div>
  )
}

export function PharmaSerializationPage() {
  const canManage = useHasPermission('pharma.manage')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [batchId, setBatchId] = useState('')
  const [form, setForm] = useState({ serial_number: '', level: 'unit' })
  const [commissionQty, setCommissionQty] = useState('5')
  const [parentSn, setParentSn] = useState('')
  const [parentLevel, setParentLevel] = useState('pack')
  const [selected, setSelected] = useState<string[]>([])
  const [signTarget, setSignTarget] = useState<{ id: string; status: string } | null>(null)

  const load = (gid = batchId) => {
    setLoading(true)
    pharmaApi
      .listSerials(isUuid(gid) ? { goods_batch_id: gid } : undefined)
      .then((r) => setItems(r.items || []))
      .catch(() => toast.error('Failed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Serialization"
        subtitle="Commission units, aggregate into packs/cases, transition active → shipped / recalled / destroyed."
      />
      <PharmaCard className="mb-4 space-y-3">
        <PharmaToolbar>
          <PharmaBatchSelect
            className="w-80"
            value={batchId}
            onChange={(id) => {
              setBatchId(id)
              setSelected([])
              load(id)
            }}
          />
          <Button size="sm" variant="outline" onClick={() => load()}>
            Refresh
          </Button>
        </PharmaToolbar>
        {canManage ? (
          <>
            <PharmaToolbar>
              <Input
                className="w-48"
                placeholder="Serial"
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              />
              <Select
                value={form.level}
                onChange={(level) => setForm({ ...form, level })}
                options={[
                  { value: 'unit', label: 'Unit' },
                  { value: 'pack', label: 'Pack' },
                  { value: 'case', label: 'Case' },
                  { value: 'pallet', label: 'Pallet' },
                ]}
              />
              <Button
                onClick={() => {
                  if (!isUuid(batchId) || !form.serial_number.trim()) {
                    toast.error('Select batch and enter serial')
                    return
                  }
                  pharmaApi.createSerial({ goods_batch_id: batchId, ...form }).then(() => {
                    toast.success('Serial added')
                    setForm({ ...form, serial_number: '' })
                    load()
                  })
                }}
              >
                Add serial
              </Button>
              <Input
                className="w-20"
                type="number"
                min={1}
                value={commissionQty}
                onChange={(e) => setCommissionQty(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (!isUuid(batchId)) {
                    toast.error('Select a batch')
                    return
                  }
                  pharmaApi
                    .commissionSerials({
                      goods_batch_id: batchId,
                      quantity: Math.max(1, Number(commissionQty) || 1),
                    })
                    .then((r) => {
                      toast.success(`Commissioned ${r.count} serials`)
                      load()
                    })
                    .catch((e: any) => toast.error(e?.response?.data?.detail || 'Commission failed'))
                }}
              >
                Auto-commission
              </Button>
            </PharmaToolbar>
            <PharmaToolbar>
              <Input
                className="w-48"
                placeholder="Parent serial"
                value={parentSn}
                onChange={(e) => setParentSn(e.target.value)}
              />
              <Select
                value={parentLevel}
                onChange={setParentLevel}
                options={[
                  { value: 'pack', label: 'Pack' },
                  { value: 'case', label: 'Case' },
                  { value: 'pallet', label: 'Pallet' },
                ]}
              />
              <Button
                variant="outline"
                disabled={selected.length === 0}
                onClick={() => {
                  if (!isUuid(batchId) || !parentSn.trim()) {
                    toast.error('Batch + parent serial required')
                    return
                  }
                  pharmaApi
                    .aggregateSerials({
                      goods_batch_id: batchId,
                      parent_serial_number: parentSn.trim(),
                      parent_level: parentLevel,
                      child_ids: selected,
                    })
                    .then(() => {
                      toast.success('Aggregated')
                      setSelected([])
                      setParentSn('')
                      load()
                    })
                    .catch((e: any) => toast.error(e?.response?.data?.detail || 'Aggregate failed'))
                }}
              >
                Aggregate selected ({selected.length})
              </Button>
            </PharmaToolbar>
          </>
        ) : null}
      </PharmaCard>
      <PharmaCard>
        {loading ? <PharmaLoading /> : items.length === 0 ? <PharmaEmpty label="No serials" /> : null}
        <ul className="divide-y divide-border/60">
          {items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  disabled={s.status !== 'active'}
                />
                <span className="font-mono text-xs font-medium">{s.serial_number}</span>
                {s.parent_id ? <span className="text-xs text-muted-foreground">nested</span> : null}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <PharmaStatusBadge status={s.level} />
                <PharmaStatusBadge status={s.status} />
                {s.status === 'active' && canManage ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setSignTarget({ id: s.id, status: 'shipped' })}>
                      Ship
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSignTarget({ id: s.id, status: 'recalled' })}>
                      Recall
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSignTarget({ id: s.id, status: 'destroyed' })}>
                      Destroy
                    </Button>
                    {!s.parent_id && s.level !== 'unit' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => {
                          pharmaApi
                            .disaggregateSerial(s.id)
                            .then((r: any) => {
                              toast.success(`Disaggregated — ${r.count} children released`)
                              setSelected([])
                              load()
                            })
                            .catch((e: any) => toast.error(e?.response?.data?.detail || 'Disaggregate failed'))
                        }}
                      >
                        Disaggregate
                      </Button>
                    ) : null}
                  </>
                ) : null}
                {s.status === 'shipped' && canManage ? (
                  <Button size="sm" variant="outline" onClick={() => setSignTarget({ id: s.id, status: 'recalled' })}>
                    Recall
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </PharmaCard>
      <PharmaESignDialog
        open={!!signTarget}
        title={`Sign serial → ${signTarget?.status}`}
        description="Re-authenticate to change serial status (cascades to children when applicable)."
        defaultMeaning="approver"
        confirmLabel="Sign & transition"
        onClose={() => setSignTarget(null)}
        onConfirm={async (payload: PharmaESignPayload) => {
          if (!signTarget) return
          await pharmaApi.transitionSerial(signTarget.id, { status: signTarget.status, ...payload })
          toast.success(`Marked ${signTarget.status}`)
          load()
        }}
      />
    </div>
  )
}

// ── Stage B: Complaints ───────────────────────────────────────────────────────

export function PharmaComplaintsPage() {
  const canManage = useHasPermission('pharma.manage')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState({
    complaint_type: 'customer',
    severity: 'minor',
    title: '',
    description: '',
    reported_by: '',
  })
  const [investForm, setInvestForm] = useState<Record<string, { notes: string; disposition: string }>>({})

  const load = () => {
    setLoading(true)
    pharmaApi
      .listComplaints()
      .then((r) => setItems(r.items || []))
      .catch(() => toast.error('Failed to load complaints'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const submit = () => {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    pharmaApi
      .createComplaint(form)
      .then(() => {
        toast.success('Complaint logged')
        setForm({ complaint_type: 'customer', severity: 'minor', title: '', description: '', reported_by: '' })
        load()
      })
      .catch((e: any) => toast.error(e?.response?.data?.detail || 'Failed'))
  }

  const advance = (id: string, status: string) => {
    pharmaApi
      .updateComplaint(id, { status })
      .then(() => { toast.success('Updated'); load() })
      .catch((e: any) => toast.error(e?.response?.data?.detail || 'Failed'))
  }

  const saveInvest = (id: string) => {
    const f = investForm[id] || {}
    pharmaApi
      .updateComplaint(id, { investigation_notes: f.notes, disposition: f.disposition })
      .then(() => { toast.success('Saved'); load() })
      .catch((e: any) => toast.error(e?.response?.data?.detail || 'Failed'))
  }

  const TYPES = [
    { value: 'customer', label: 'Customer' },
    { value: 'adverse_event', label: 'Adverse Event' },
    { value: 'product_defect', label: 'Product Defect' },
    { value: 'packaging', label: 'Packaging' },
  ]
  const SEVERITIES = [
    { value: 'minor', label: 'Minor' },
    { value: 'major', label: 'Major' },
    { value: 'critical', label: 'Critical' },
  ]
  const DISPOSITIONS = [
    { value: '', label: 'Select disposition' },
    { value: 'no_action', label: 'No action required' },
    { value: 'product_corrected', label: 'Product corrected' },
    { value: 'recall_initiated', label: 'Recall initiated' },
    { value: 'regulatory_reported', label: 'Regulatory reported' },
  ]

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Complaints"
        subtitle="Log and investigate customer complaints, adverse events, and product defects."
      />

      {canManage ? (
        <PharmaCard className="mb-4 space-y-3">
          <div className="text-sm font-medium">Log new complaint</div>
          <PharmaToolbar>
            <Select
              value={form.complaint_type}
              onChange={(v) => setForm({ ...form, complaint_type: v })}
              options={TYPES}
            />
            <Select
              value={form.severity}
              onChange={(v) => setForm({ ...form, severity: v })}
              options={SEVERITIES}
            />
            <Input
              className="w-72"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </PharmaToolbar>
          <PharmaToolbar>
            <Input
              className="w-72"
              placeholder="Reported by"
              value={form.reported_by}
              onChange={(e) => setForm({ ...form, reported_by: e.target.value })}
            />
            <Input
              className="flex-1"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Button onClick={submit}>Log complaint</Button>
          </PharmaToolbar>
        </PharmaCard>
      ) : null}

      <PharmaCard>
        {loading ? (
          <PharmaLoading />
        ) : items.length === 0 ? (
          <PharmaEmpty label="No complaints on record" />
        ) : null}
        <ul className="divide-y divide-border/60">
          {items.map((c) => {
            const open = expanded === c.id
            const inv = investForm[c.id] || { notes: c.investigation_notes || '', disposition: c.disposition || '' }
            return (
              <li key={c.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{c.number} — {c.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <PharmaStatusBadge status={c.status} />
                      <PharmaStatusBadge status={c.severity} />
                      <span className="text-xs text-muted-foreground capitalize">{c.complaint_type.replace('_', ' ')}</span>
                      {c.reported_by ? (
                        <span className="text-xs text-muted-foreground">by {c.reported_by}</span>
                      ) : null}
                    </div>
                    {c.description ? (
                      <p className="mt-1 max-w-xl text-xs text-muted-foreground">{c.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : c.id)}>
                      {open ? 'Hide' : 'Investigate'}
                    </Button>
                    {c.status === 'open' && canManage ? (
                      <Button size="sm" variant="outline" onClick={() => advance(c.id, 'investigating')}>
                        Start investigation
                      </Button>
                    ) : null}
                    {c.status === 'investigating' && canManage ? (
                      <Button size="sm" onClick={() => advance(c.id, 'closed')}>
                        Close
                      </Button>
                    ) : null}
                  </div>
                </div>
                {open ? (
                  <div className="mt-3 space-y-2 rounded-md border border-border/70 bg-muted/30 p-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Investigation notes</div>
                    <textarea
                      className="w-full rounded-md border border-border bg-background p-2 text-xs"
                      rows={3}
                      placeholder="Root cause, investigation findings…"
                      value={inv.notes}
                      readOnly={!canManage || c.status === 'closed'}
                      onChange={(e) =>
                        setInvestForm((prev) => ({ ...prev, [c.id]: { ...inv, notes: e.target.value } }))
                      }
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={inv.disposition}
                        onChange={(v) =>
                          setInvestForm((prev) => ({ ...prev, [c.id]: { ...inv, disposition: v } }))
                        }
                        options={DISPOSITIONS}
                      />
                      {canManage && c.status !== 'closed' ? (
                        <Button size="sm" variant="outline" onClick={() => saveInvest(c.id)}>
                          Save notes
                        </Button>
                      ) : null}
                    </div>
                    {c.closed_at ? (
                      <p className="text-xs text-muted-foreground">Closed {c.closed_at.slice(0, 10)}</p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </PharmaCard>
    </div>
  )
}
