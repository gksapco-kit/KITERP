import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAm, useAmMutation, useAssetPerms, type Page, type Row } from './api'
import {
  AssetPicker, Check, CategorySelect, DataTable, Dialog, Field, Loading, LocationSelect, PageHeader, Pager, Pill, Sel, StatusBadge,
  StoreSelect, Tabs, TextArea, fmtDate, fmtDateTime, optList, titleCase,
} from './ui'

type Tab = 'transfers' | 'requests'

export default function Transfers() {
  const [tab, setTab] = useState<Tab>('transfers')
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Transfers & Requests" subtitle="Move assets between locations with approval, and handle requests for new assets." />
      <Tabs tabs={[{ id: 'transfers', label: 'Transfers' }, { id: 'requests', label: 'Asset requests' }]} value={tab} onChange={setTab} />
      {tab === 'transfers' ? <TransferList /> : <RequestList />}
    </div>
  )
}

/* ── Transfers ──────────────────────────────────────────────────────────────── */
function TransferList() {
  const perms = useAssetPerms()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [create, setCreate] = useState(false)
  const [view, setView] = useState<Row | null>(null)
  const { data, isLoading } = useAm<Page>('/transfers', { status: status || undefined, page, size: 30 })
  const act = useAmMutation({ success: 'Done' })
  const run = (id: string, what: string, body?: unknown) => act.mutate({ path: `/transfers/${id}/${what}`, body })

  const actions = (t: Row) => (
    <span className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {t.status === 'draft' && perms.manage ? <Button size="xs" onClick={() => run(t.id, 'submit')}>Submit</Button> : null}
      {t.status === 'requested' && perms.approve ? (
        <>
          <Button size="xs" onClick={() => run(t.id, 'approve')}>Approve</Button>
          <Button size="xs" variant="outline" onClick={() => { const n = window.prompt('Reason for rejecting (optional)'); if (n !== null) run(t.id, 'reject', { notes: n }) }}>Reject</Button>
        </>
      ) : null}
      {t.status === 'approved' && perms.manage ? <Button size="xs" onClick={() => run(t.id, 'dispatch')}>Dispatch</Button> : null}
      {t.status === 'in_transit' && perms.manage ? <Button size="xs" onClick={() => { if (window.confirm('Receive all assets on this transfer?')) run(t.id, 'receive', {}) }}>Receive all</Button> : null}
      {['draft', 'requested', 'approved'].includes(t.status) && perms.manage ? <Button size="xs" variant="ghost" onClick={() => { if (window.confirm('Cancel this transfer?')) run(t.id, 'cancel') }}>Cancel</Button> : null}
    </span>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-56"><Sel value={status} onChange={(v) => { setStatus(v); setPage(1) }} blank="All statuses" options={optList(['draft', 'requested', 'approved', 'in_transit', 'received', 'rejected', 'cancelled'])} /></div>
        {perms.manage ? <Button onClick={() => setCreate(true)}><Plus className="h-4 w-4" /> New transfer</Button> : null}
      </div>
      {isLoading ? <Loading /> : (
        <>
          <DataTable rows={data?.items ?? []} empty="No transfers yet." onRow={setView}
            cols={[
              { key: 'transfer_no', header: 'No.', render: (t) => <span className="font-mono font-semibold">{t.transfer_no}</span> },
              { key: 'dest', header: 'To', render: (t) => t.to_location_name || t.to_store_name || '—' },
              { key: 'n', header: 'Assets', render: (t) => (t.lines ?? []).length },
              { key: 'status', header: 'Status', render: (t) => <StatusBadge value={t.status} /> },
              { key: 'created_at', header: 'Raised', render: (t) => fmtDate(t.created_at) },
              { key: 'act', header: '', render: actions },
            ]} />
          <Pager page={page} size={30} total={data?.total ?? 0} onPage={setPage} />
        </>
      )}
      {create ? <CreateTransfer onClose={() => setCreate(false)} /> : null}
      {view ? (
        <Dialog wide title={view.transfer_no} subtitle={`To ${view.to_location_name || view.to_store_name || '—'}`} onClose={() => setView(null)}>
          <div className="flex flex-wrap items-center gap-2 text-sm"><StatusBadge value={view.status} />{view.reason ? <span className="text-muted-foreground">{view.reason}</span> : null}</div>
          {view.decision_notes ? <p className="text-sm">Decision notes: {view.decision_notes}</p> : null}
          <DataTable rows={view.lines ?? []} cols={[
            { key: 'asset_tag', header: 'Tag', render: (l) => <span className="font-mono">{l.asset_tag}</span> },
            { key: 'asset_name', header: 'Asset' },
            { key: 'received', header: 'Received', render: (l) => l.received ? <Pill tone="green">Yes</Pill> : '—' },
          ]} />
          <div className="text-xs text-muted-foreground">Approved {fmtDateTime(view.approved_at)} · Dispatched {fmtDateTime(view.dispatched_at)} · Received {fmtDateTime(view.received_at)}</div>
        </Dialog>
      ) : null}
    </div>
  )
}

function CreateTransfer({ onClose }: { onClose: () => void }) {
  const [picked, setPicked] = useState<Row[]>([])
  const [slot, setSlot] = useState<Row | null>(null)
  const [toLoc, setToLoc] = useState('')
  const [toStore, setToStore] = useState('')
  const [reason, setReason] = useState('')
  const [submit, setSubmit] = useState(true)
  const m = useAmMutation({ success: 'Transfer created', onSuccess: onClose })
  const add = (a: Row | null) => {
    if (!a) return
    if (!picked.some((p) => p.id === a.id)) setPicked((p) => [...p, a])
    setSlot(null)
  }
  const go = () => {
    if (!picked.length) return toast.error('Add at least one asset')
    if (!toLoc && !toStore) return toast.error('Choose a destination location or store')
    m.mutate({ path: '/transfers', body: { asset_ids: picked.map((p) => p.id), to_location_id: toLoc || undefined, to_store_id: toStore || undefined, reason: reason || undefined, submit } })
  }
  return (
    <Dialog wide title="New transfer" subtitle="Only assets that are in stock can be transferred." onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={m.isPending}>{m.isPending ? 'Saving…' : submit ? 'Submit for approval' : 'Save draft'}</Button></>}>
      <Field label="Add assets"><AssetPicker value={slot} onChange={add} status="in_stock" /></Field>
      {picked.length ? (
        <div className="flex flex-wrap gap-2">
          {picked.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              <span className="font-mono font-semibold">{a.asset_tag}</span> {a.name}
              <button type="button" aria-label="Remove" onClick={() => setPicked((p) => p.filter((x) => x.id !== a.id))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Destination location"><LocationSelect value={toLoc} onChange={setToLoc} blank="None" /></Field>
        <Field label="Destination store"><StoreSelect value={toStore} onChange={setToStore} blank="None" /></Field>
      </div>
      <Field label="Reason"><TextArea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <Check checked={submit} onChange={setSubmit} label="Send for approval now" />
    </Dialog>
  )
}

/* ── Requests ───────────────────────────────────────────────────────────────── */
function RequestList() {
  const perms = useAssetPerms()
  const [mine, setMine] = useState(false)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [create, setCreate] = useState(false)
  const [fulfil, setFulfil] = useState<Row | null>(null)
  const { data, isLoading } = useAm<Page>('/requests', { mine: mine || undefined, status: status || undefined, page, size: 50 })
  const act = useAmMutation({ success: 'Done' })
  const run = (id: string, what: string, body?: unknown) => act.mutate({ path: `/requests/${id}/${what}`, body })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56"><Sel value={status} onChange={(v) => { setStatus(v); setPage(1) }} blank="All statuses" options={optList(['pending', 'approved', 'rejected', 'fulfilled', 'cancelled'])} /></div>
          <Check checked={mine} onChange={(v) => { setMine(v); setPage(1) }} label="My requests" />
        </div>
        <Button onClick={() => setCreate(true)}><Plus className="h-4 w-4" /> Request an asset</Button>
      </div>
      {isLoading ? <Loading /> : (
        <>
          <DataTable rows={data?.items ?? []} empty="No requests."
            cols={[
              { key: 'request_no', header: 'No.', render: (r) => <span className="font-mono font-semibold">{r.request_no}</span> },
              { key: 'title', header: 'Request', render: (r) => <div><div className="font-medium">{r.title}</div><div className="text-xs text-muted-foreground">{r.quantity} × {r.category_name || 'any category'} · {titleCase(r.request_type)}</div></div> },
              { key: 'requester_name', header: 'Requested by' },
              { key: 'priority', header: 'Priority', render: (r) => <StatusBadge value={r.priority} /> },
              { key: 'needed_by', header: 'Needed by', render: (r) => fmtDate(r.needed_by) },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              { key: 'act', header: '', render: (r) => (
                <span className="flex flex-wrap gap-1">
                  {r.status === 'pending' && perms.approve ? (
                    <>
                      <Button size="xs" onClick={() => run(r.id, 'approve')}>Approve</Button>
                      <Button size="xs" variant="outline" onClick={() => { const n = window.prompt('Reason for rejecting (optional)'); if (n !== null) run(r.id, 'reject', { notes: n }) }}>Reject</Button>
                    </>
                  ) : null}
                  {r.status === 'approved' && perms.manage ? <Button size="xs" onClick={() => setFulfil(r)}>Issue asset</Button> : null}
                  {['pending', 'approved'].includes(r.status) ? <Button size="xs" variant="ghost" onClick={() => { if (window.confirm('Cancel this request?')) run(r.id, 'cancel') }}>Cancel</Button> : null}
                </span>) },
            ]} />
          <Pager page={page} size={50} total={data?.total ?? 0} onPage={setPage} />
        </>
      )}
      {create ? <CreateRequest onClose={() => setCreate(false)} /> : null}
      {fulfil ? <FulfilDialog req={fulfil} onClose={() => setFulfil(null)} /> : null}
    </div>
  )
}

function CreateRequest({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ title: '', request_type: 'new', category_id: '', quantity: '1', priority: 'medium', needed_by: '', justification: '' })
  const m = useAmMutation({ success: 'Request sent for approval', onSuccess: onClose })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  return (
    <Dialog title="Request an asset" onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button>
        <Button disabled={m.isPending} onClick={() => {
          if (!f.title.trim()) return toast.error('Say what you need')
          m.mutate({ path: '/requests', body: { ...f, title: f.title.trim(), category_id: f.category_id || undefined, quantity: Number(f.quantity) || 1, needed_by: f.needed_by || undefined, justification: f.justification || undefined } })
        }}>{m.isPending ? 'Sending…' : 'Send request'}</Button></>}>
      <Field label="What do you need?" required><Input value={f.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder="Laptop for new designer" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type"><Sel value={f.request_type} onChange={(v) => set('request_type', v)} options={[{ value: 'new', label: 'New' }, { value: 'replacement', label: 'Replacement' }]} /></Field>
        <Field label="Category"><CategorySelect value={f.category_id} onChange={(v) => set('category_id', v)} blank="Any" /></Field>
        <Field label="Quantity"><Input type="number" min={1} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
        <Field label="Priority"><Sel value={f.priority} onChange={(v) => set('priority', v)} options={optList(['low', 'medium', 'high', 'urgent'])} /></Field>
        <Field label="Needed by"><Input type="date" value={f.needed_by} onChange={(e) => set('needed_by', e.target.value)} /></Field>
      </div>
      <Field label="Why?"><TextArea value={f.justification} onChange={(e) => set('justification', e.target.value)} /></Field>
    </Dialog>
  )
}

function FulfilDialog({ req, onClose }: { req: Row; onClose: () => void }) {
  const [asset, setAsset] = useState<Row | null>(null)
  const [due, setDue] = useState('')
  const m = useAmMutation({ success: 'Asset issued', onSuccess: onClose })
  return (
    <Dialog title={`Issue an asset for ${req.request_no}`} subtitle={req.title} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button>
        <Button disabled={m.isPending || !asset} onClick={() => m.mutate({ path: `/requests/${req.id}/fulfill`, body: { asset_id: asset?.id, due_back_on: due || undefined } })}>Issue</Button></>}>
      <p className="text-sm text-muted-foreground">The asset is checked out to {req.requester_name || 'the requester'}. If nothing in stock fits, raise a purchase requisition in Procurement first.</p>
      <Field label="Asset from stock" required><AssetPicker value={asset} onChange={setAsset} status="in_stock" /></Field>
      <Field label="Due back (optional)"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
    </Dialog>
  )
}
