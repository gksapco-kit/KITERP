import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, Pencil, Plus, Printer, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { extractApiError } from '@/lib/errorMessages'
import { mediaUrl } from '@/lib/utils'
import {
  DOC_TYPES, fetchBlobUrl, openBlob, uploadAssetDocument, useAm, useAmMutation, useAssetPerms, type Page, type Row,
} from './api'
import { CheckinDialog, CheckoutDialog, CoverageDialog, PlanDialog, WorkOrderDialog } from './dialogs'
import {
  Check, DataTable, Dialog, Empty, ErrorNote, Field, Loading, PageHeader, Panel, Pill, Sel, StatusBadge, Tabs, TextArea,
  fmtDate, fmtDateTime, money, optList, titleCase,
} from './ui'
import { useQueryClient } from '@tanstack/react-query'

type Tab = 'overview' | 'custody' | 'documents' | 'maintenance' | 'coverage' | 'finance' | 'timeline'

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v || v === 0 ? v : '—'}</dd>
    </div>
  )
}

export default function AssetDetail() {
  const { assetId = '' } = useParams()
  const nav = useNavigate()
  const perms = useAssetPerms()
  const [tab, setTab] = useState<Tab>('overview')
  const [dlg, setDlg] = useState<null | 'checkout' | 'checkin' | 'reassign' | 'dispose' | 'status' | 'capitalize' | 'link'>(null)

  const { data: a, isLoading, error } = useAm<Row>(`/${assetId}`)
  if (isLoading) return <Loading />
  if (error || !a) return <ErrorNote error={error} />

  const closed = a.status === 'disposed'
  const showFinance = a.is_capitalized || perms.finance
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' }, { id: 'custody', label: 'Custody' }, { id: 'documents', label: 'Documents' },
    { id: 'maintenance', label: 'Maintenance' }, { id: 'coverage', label: 'Warranty & cover' },
    ...(showFinance ? [{ id: 'finance' as Tab, label: 'Finance' }] : []), { id: 'timeline', label: 'Timeline' },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${a.asset_tag} · ${a.name}`}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge value={a.status} />{a.condition ? <Pill tone="gray">{titleCase(a.condition)}</Pill> : null}{a.category_name ? <span>{a.category_name}</span> : null}</span>}
        actions={
          <>
            <Button variant="outline" onClick={() => openBlob('post', '/labels', { body: { asset_ids: [a.id] }, inline: true }).catch((e) => toast.error(extractApiError(e, 'Could not build label')))}><Printer className="h-4 w-4" /> Label</Button>
            {perms.manage && !closed ? (
              <>
                <Button variant="outline" onClick={() => nav(`/assets/register/${a.id}/edit`)}><Pencil className="h-4 w-4" /> Edit</Button>
                {a.status === 'in_stock' ? <Button onClick={() => setDlg('checkout')}>Check out</Button> : null}
                {a.status === 'assigned' ? <><Button variant="outline" onClick={() => setDlg('reassign')}>Reassign</Button><Button onClick={() => setDlg('checkin')}>Check in</Button></> : null}
                {['in_stock', 'under_maintenance', 'lost', 'retired'].includes(a.status) ? <Button variant="outline" onClick={() => setDlg('status')}>Change status</Button> : null}
                <Button variant="outline" onClick={() => setDlg('dispose')}>Dispose</Button>
              </>
            ) : null}
          </>
        }
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' ? <Overview a={a} onOpen={(id) => nav(`/assets/register/${id}`)} /> : null}
      {tab === 'custody' ? <CustodyTab a={a} /> : null}
      {tab === 'documents' ? <DocumentsTab a={a} canEdit={perms.manage && !closed} /> : null}
      {tab === 'maintenance' ? <MaintenanceTab a={a} canEdit={perms.manage && !closed} /> : null}
      {tab === 'coverage' ? <CoverageTab a={a} canEdit={perms.manage && !closed} /> : null}
      {tab === 'finance' ? <FinanceTab a={a} onCapitalize={() => setDlg('capitalize')} onLink={() => setDlg('link')} /> : null}
      {tab === 'timeline' ? <TimelineTab a={a} /> : null}

      {dlg === 'checkout' ? <CheckoutDialog asset={a} onClose={() => setDlg(null)} /> : null}
      {dlg === 'reassign' ? <CheckoutDialog asset={a} reassign onClose={() => setDlg(null)} /> : null}
      {dlg === 'checkin' ? <CheckinDialog asset={a} onClose={() => setDlg(null)} /> : null}
      {dlg === 'status' ? <StatusDialog asset={a} onClose={() => setDlg(null)} /> : null}
      {dlg === 'dispose' ? <DisposeDialog asset={a} canGl={perms.finance} onClose={() => setDlg(null)} /> : null}
      {dlg === 'capitalize' ? <CapitalizeDialog asset={a} onClose={() => setDlg(null)} /> : null}
      {dlg === 'link' ? <LinkDialog asset={a} onClose={() => setDlg(null)} /> : null}
    </div>
  )
}

/* ── Overview ───────────────────────────────────────────────────────────────── */
function Overview({ a, onOpen }: { a: Row; onOpen: (id: string) => void }) {
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    let url: string | null = null
    let live = true
    fetchBlobUrl(`/${a.id}/qr.svg`).then((u) => { url = u; if (live) setQr(u) }).catch(() => undefined)
    return () => { live = false; if (url) URL.revokeObjectURL(url) }
  }, [a.id])
  const attrs = Object.entries((a.attributes as Record<string, unknown>) ?? {})
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Panel title="Details">
          <dl>
            <KV k="Manufacturer / model" v={[a.manufacturer, a.model].filter(Boolean).join(' ')} />
            <KV k="Serial number" v={a.serial_number} />
            <KV k="Barcode" v={a.barcode} />
            <KV k="Location" v={a.location_name} />
            <KV k="Store" v={a.store_name} />
            <KV k="Held by" v={a.employee_name || a.department_name} />
            <KV k="Acquired" v={fmtDate(a.acquisition_date)} />
            <KV k="Cost" v={money(a.acquisition_cost)} />
            <KV k="Supplier" v={a.supplier_name} />
            <KV k="PO / invoice" v={a.purchase_ref} />
            {a.is_reservable ? <KV k="Bookable" v="Yes, shared asset" /> : null}
            {a.meter_reading != null ? <KV k="Meter" v={`${a.meter_reading} ${a.meter_unit ?? ''}`} /> : null}
            {a.status === 'disposed' ? <KV k="Disposed on" v={fmtDate(a.disposed_on)} /> : null}
          </dl>
          {a.description ? <p className="mt-3 text-sm text-muted-foreground">{a.description}</p> : null}
          {a.notes ? <p className="mt-2 text-sm">{a.notes}</p> : null}
        </Panel>
        {attrs.length ? <Panel title="Specifications"><dl>{attrs.map(([k, v]) => <KV key={k} k={k} v={String(v)} />)}</dl></Panel> : null}
        {(a.components ?? []).length || a.parent ? (
          <Panel title="Related assets">
            {a.parent ? <p className="mb-2 text-sm text-muted-foreground">Part of <span className="font-mono">{a.parent.asset_tag}</span> {a.parent.name}</p> : null}
            <ul className="space-y-1">
              {(a.components as Row[]).map((c) => (
                <li key={c.id}><button type="button" className="text-sm hover:underline" onClick={() => onOpen(c.id)}><span className="font-mono font-semibold">{c.asset_tag}</span> · {c.name}</button> <StatusBadge value={c.status} /></li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
      <Panel title="QR label">
        <div className="flex flex-col items-center gap-2">
          {qr ? <img src={qr} alt={`QR code for ${a.asset_tag}`} className="h-44 w-44 rounded bg-white p-2" /> : <div className="h-44 w-44 animate-pulse rounded bg-muted" />}
          <span className="font-mono text-sm font-semibold">{a.asset_tag}</span>
          <span className="text-center text-xs text-muted-foreground">Scan to open this asset, move it, or confirm it during an audit.</span>
        </div>
      </Panel>
    </div>
  )
}

/* ── Custody ────────────────────────────────────────────────────────────────── */
function CustodyTab({ a }: { a: Row }) {
  const { data, isLoading } = useAm<Page>('/assignments', { asset_id: a.id, size: 100 })
  const ack = useAmMutation({ success: 'Acknowledged' })
  const perms = useAssetPerms()
  if (isLoading) return <Loading />
  return (
    <DataTable rows={data?.items ?? []} empty="This asset has never been checked out."
      cols={[
        { key: 'assignee_label', header: 'Held by', render: (r) => <span className="font-medium">{r.assignee_label || '—'}</span> },
        { key: 'assigned_at', header: 'From', render: (r) => fmtDateTime(r.assigned_at) },
        { key: 'due_back_on', header: 'Due back', render: (r) => <span className={r.is_overdue ? 'font-semibold text-red-600' : ''}>{fmtDate(r.due_back_on)}</span> },
        { key: 'returned_at', header: 'Returned', render: (r) => r.returned_at ? fmtDateTime(r.returned_at) : <Pill tone="blue">Holding now</Pill> },
        { key: 'condition', header: 'Condition', render: (r) => `${titleCase(r.condition_out)}${r.condition_in ? ` → ${titleCase(r.condition_in)}` : ''}` },
        { key: 'ack', header: 'Acknowledged', render: (r) => r.acknowledged_at ? fmtDate(r.acknowledged_at) : r.returned_at || r.assignee_type !== 'employee' ? '—' : (
          perms.manage ? <Button size="xs" variant="outline" disabled={ack.isPending} onClick={() => ack.mutate({ path: `/assignments/${r.id}/acknowledge` })}>Mark received</Button> : <Pill tone="amber">Waiting</Pill>) },
        { key: 'notes', header: 'Notes', render: (r) => r.return_notes || r.notes || '—' },
      ]} />
  )
}

/* ── Documents ──────────────────────────────────────────────────────────────── */
function DocumentsTab({ a, canEdit }: { a: Row; canEdit: boolean }) {
  const qc = useQueryClient()
  const { data = [], isLoading } = useAm<Row[]>(`/${a.id}/documents`)
  const [type, setType] = useState('photo')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const del = useAmMutation({ success: 'Document removed' })

  const onFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      await uploadAssetDocument(a.id, file, type)
      qc.invalidateQueries({ queryKey: ['am'] })
      toast.success('Document uploaded')
    } catch (e) {
      toast.error(extractApiError(e, 'Upload failed'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
          <div className="w-48"><Field label="Type"><Sel value={type} onChange={setType} options={optList(DOC_TYPES)} /></Field></div>
          <input ref={input} type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
          <Button disabled={busy} onClick={() => input.current?.click()}><Upload className="h-4 w-4" /> {busy ? 'Uploading…' : 'Upload file'}</Button>
        </div>
      ) : null}
      {isLoading ? <Loading /> : data.length === 0 ? <Empty>No documents yet. Add the invoice, manuals and photos.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((d) => (
            <div key={d.id} className="overflow-hidden rounded-xl border border-border bg-card">
              {d.is_image ? <a href={mediaUrl(d.file_url)} target="_blank" rel="noreferrer"><img src={mediaUrl(d.file_url)} alt={d.name} className="h-36 w-full object-cover" /></a>
                : <a href={mediaUrl(d.file_url)} target="_blank" rel="noreferrer" className="flex h-36 items-center justify-center bg-muted"><FileText className="h-10 w-10 text-muted-foreground" /></a>}
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium" title={d.name}>{d.name}</div>
                  <div className="text-xs text-muted-foreground">{titleCase(d.doc_type)} · {fmtDate(d.created_at)}</div>
                </div>
                {canEdit ? <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => { if (window.confirm(`Delete ${d.name}?`)) del.mutate({ method: 'delete', path: `/${a.id}/documents/${d.id}` }) }}><Trash2 className="h-4 w-4" /></Button> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Maintenance ────────────────────────────────────────────────────────────── */
function MaintenanceTab({ a, canEdit }: { a: Row; canEdit: boolean }) {
  const { data: plans = [] } = useAm<Row[]>('/maintenance/plans', { asset_id: a.id })
  const { data: wos } = useAm<Page>('/work-orders', { asset_id: a.id, size: 50 })
  const [dlg, setDlg] = useState<null | 'wo' | 'plan'>(null)
  return (
    <div className="space-y-5">
      <Panel title="Preventive plans" actions={canEdit ? <Button size="sm" variant="outline" onClick={() => setDlg('plan')}><Plus className="h-4 w-4" /> Plan</Button> : undefined}>
        <DataTable rows={plans} empty="No recurring maintenance. Add a plan to be reminded."
          cols={[
            { key: 'name', header: 'Plan' },
            { key: 'every', header: 'Every', render: (p) => [p.interval_days ? `${p.interval_days} days` : '', p.interval_meter ? `${p.interval_meter} ${p.meter_unit ?? ''}` : ''].filter(Boolean).join(' or ') },
            { key: 'next_due_on', header: 'Next due', render: (p) => <span className={p.is_due ? 'font-semibold text-red-600' : ''}>{fmtDate(p.next_due_on)}</span> },
            { key: 'last_done_on', header: 'Last done', render: (p) => fmtDate(p.last_done_on) },
          ]} />
      </Panel>
      <Panel title="Work orders" actions={canEdit ? <Button size="sm" variant="outline" onClick={() => setDlg('wo')}><Plus className="h-4 w-4" /> Work order</Button> : undefined}>
        <DataTable rows={wos?.items ?? []} empty="No work orders."
          cols={[
            { key: 'wo_no', header: 'No.', render: (w) => <span className="font-mono">{w.wo_no}</span> },
            { key: 'title', header: 'Title' },
            { key: 'wo_type', header: 'Type', render: (w) => titleCase(w.wo_type) },
            { key: 'status', header: 'Status', render: (w) => <StatusBadge value={w.status} /> },
            { key: 'scheduled_on', header: 'Scheduled', render: (w) => fmtDate(w.scheduled_on) },
            { key: 'cost_total', header: 'Cost', className: 'text-right', render: (w) => money(w.cost_total) },
          ]} />
      </Panel>
      {dlg === 'wo' ? <WorkOrderDialog assetId={a.id} onClose={() => setDlg(null)} /> : null}
      {dlg === 'plan' ? <PlanDialog assetId={a.id} onClose={() => setDlg(null)} /> : null}
    </div>
  )
}

/* ── Coverage ───────────────────────────────────────────────────────────────── */
function CoverageTab({ a, canEdit }: { a: Row; canEdit: boolean }) {
  const { data = [], isLoading } = useAm<Row[]>('/coverage', { asset_id: a.id })
  const [open, setOpen] = useState<null | 'new' | Row>(null)
  const del = useAmMutation({ success: 'Removed' })
  return (
    <div className="space-y-3">
      {canEdit ? <div className="flex justify-end"><Button size="sm" onClick={() => setOpen('new')}><Plus className="h-4 w-4" /> Add warranty / insurance / AMC</Button></div> : null}
      {isLoading ? <Loading /> : (
        <DataTable rows={data} empty="No warranty or insurance recorded."
          cols={[
            { key: 'coverage_type', header: 'Type', render: (c) => <span className="font-medium">{c.coverage_type === 'amc' ? 'AMC' : titleCase(c.coverage_type)}</span> },
            { key: 'provider', header: 'Provider' },
            { key: 'reference_no', header: 'Reference' },
            { key: 'period', header: 'Period', render: (c) => `${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}` },
            { key: 'state', header: 'State', render: (c) => <span className="inline-flex items-center gap-2"><StatusBadge value={c.state} />{c.days_left != null && c.state !== 'expired' ? <span className="text-xs text-muted-foreground">{c.days_left}d left</span> : null}</span> },
            { key: 'act', header: '', render: (c) => canEdit ? (
              <span className="flex gap-1">
                <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setOpen(c)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => { if (window.confirm('Remove this cover?')) del.mutate({ method: 'delete', path: `/coverage/${c.id}` }) }}><Trash2 className="h-4 w-4" /></Button>
              </span>) : null },
          ]} />
      )}
      {open ? <CoverageDialog assetId={a.id} coverage={open === 'new' ? undefined : open} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

/* ── Finance ────────────────────────────────────────────────────────────────── */
function FinanceTab({ a, onCapitalize, onLink }: { a: Row; onCapitalize: () => void; onLink: () => void }) {
  const perms = useAssetPerms()
  const nav = useNavigate()
  const unlink = useAmMutation({ success: 'Unlinked from Finance' })
  const f = a.finance as Row | undefined
  if (!a.is_capitalized) {
    return (
      <Panel title="Not in the fixed-asset register">
        <p className="text-sm text-muted-foreground">This asset is tracked physically only. Capitalise it to create the fixed asset, post the acquisition journal and start depreciation, or link it to a fixed asset that already exists.</p>
        {perms.finance && a.status !== 'disposed' ? (
          <div className="mt-3 flex gap-2"><Button onClick={onCapitalize}>Capitalise in Finance</Button><Button variant="outline" onClick={onLink}>Link existing fixed asset</Button></div>
        ) : null}
      </Panel>
    )
  }
  if (!f) return <Panel title="Finance"><p className="text-sm text-muted-foreground">This asset is capitalised. You need the Finance asset permission to see the figures.</p></Panel>
  return (
    <div className="space-y-5">
      <Panel title={`Fixed asset ${f.asset_code ?? ''}`} actions={<span className="flex gap-2"><Button size="sm" variant="outline" onClick={() => nav('/finance/assets')}>Open in Finance</Button>
        {perms.finance && f.status === 'active' ? <Button size="sm" variant="ghost" onClick={() => { if (window.confirm('Unlink from the fixed asset? This only works before depreciation is posted.')) unlink.mutate({ method: 'delete', path: `/${a.id}/finance/link` }) }}>Unlink</Button> : null}</span>}>
        <dl>
          <KV k="Status" v={<StatusBadge value={f.status} />} />
          <KV k="Category" v={f.category_name} />
          <KV k="Cost" v={money(f.purchase_cost)} />
          <KV k="Accumulated depreciation" v={money(f.accumulated_depreciation)} />
          <KV k="Net book value" v={<strong>{money(f.net_book_value)}</strong>} />
          <KV k="Method" v={titleCase(f.depreciation_method)} />
          <KV k="Useful life" v={f.useful_life_years ? `${f.useful_life_years} years` : null} />
          {f.disposal_date ? <KV k="Disposed" v={`${fmtDate(f.disposal_date)} for ${money(f.disposal_value)}`} /> : null}
        </dl>
      </Panel>
      <Panel title="Recent depreciation">
        <DataTable rows={f.depreciation_entries ?? []} empty="No depreciation posted yet."
          cols={[
            { key: 'date', header: 'Date', render: (e) => fmtDate(e.date) },
            { key: 'amount', header: 'Amount', className: 'text-right', render: (e) => money(e.amount) },
            { key: 'book_value_after', header: 'Book value after', className: 'text-right', render: (e) => money(e.book_value_after) },
          ]} />
      </Panel>
    </div>
  )
}

/* ── Timeline ───────────────────────────────────────────────────────────────── */
function TimelineTab({ a }: { a: Row }) {
  const { data = [], isLoading } = useAm<Row[]>(`/${a.id}/timeline`)
  if (isLoading) return <Loading />
  if (!data.length) return <Empty>No history yet.</Empty>
  return (
    <ol className="space-y-0 rounded-xl border border-border bg-card">
      {data.map((e) => (
        <li key={e.id} className="flex items-start justify-between gap-4 border-b border-border px-4 py-2.5 text-sm last:border-0">
          <div><span className="font-medium">{e.summary || titleCase(e.event_type)}</span> <Pill tone="gray" className="ml-1">{titleCase(e.event_type)}</Pill></div>
          <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span>
        </li>
      ))}
    </ol>
  )
}

/* ── Dialogs ────────────────────────────────────────────────────────────────── */
function StatusDialog({ asset, onClose }: { asset: Row; onClose: () => void }) {
  const [status, setStatus] = useState(asset.status)
  const [reason, setReason] = useState('')
  const m = useAmMutation({ success: 'Status updated', onSuccess: onClose })
  return (
    <Dialog title="Change status" subtitle={`${asset.asset_tag} · ${asset.name}`} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button>
        <Button disabled={m.isPending || status === asset.status} onClick={() => m.mutate({ method: 'put', path: `/${asset.id}`, body: { status, status_reason: reason || undefined } })}>Save</Button></>}>
      <Field label="Status"><Sel value={status} onChange={setStatus} options={[{ value: 'in_stock', label: 'In stock' }, { value: 'under_maintenance', label: 'Under maintenance' }, { value: 'lost', label: 'Lost' }, { value: 'retired', label: 'Retired' }]} /></Field>
      <Field label="Reason"><TextArea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <p className="text-xs text-muted-foreground">Assigned, in transit and disposed are set by check-out, transfers and disposal.</p>
    </Dialog>
  )
}

function DisposeDialog({ asset, canGl, onClose }: { asset: Row; canGl: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const [method, setMethod] = useState('scrapped')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const blocked = asset.is_capitalized && !canGl
  const m = useAmMutation({
    onSuccess: (r) => {
      if (r?.gl?.warning) toast.warning(r.gl.warning)
      else toast.success(r?.gl?.posted ? `Disposed. Finance posted a ${Number(r.gl.gain_loss) >= 0 ? 'gain' : 'loss'} of ${money(Math.abs(Number(r.gl.gain_loss)))}` : 'Asset disposed')
      onClose()
      nav('/assets/register')
    },
  })
  return (
    <Dialog title={`Dispose ${asset.asset_tag}`} subtitle={asset.name} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" disabled={m.isPending || blocked} onClick={() => m.mutate({ path: `/${asset.id}/dispose`, body: { disposal_method: method, sale_price: price ? Number(price) : 0, disposal_date: date, notes: notes || undefined } })}>
          {m.isPending ? 'Disposing…' : 'Dispose'}</Button></>}>
      {asset.is_capitalized ? <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">This asset is a fixed asset in Finance. Disposing it posts the gain or loss journal and closes the fixed asset.{blocked ? ' You need the Finance asset permission to do this.' : ''}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Method"><Sel value={method} onChange={setMethod} options={[{ value: 'scrapped', label: 'Scrapped' }, { value: 'sold', label: 'Sold' }, { value: 'donated', label: 'Donated' }, { value: 'written_off', label: 'Written off' }]} /></Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {method === 'sold' ? <Field label="Sale price"><Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field> : null}
      </div>
      <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <p className="text-xs text-muted-foreground">Disposal cannot be undone. Open bookings are cancelled and maintenance plans stop.</p>
    </Dialog>
  )
}

function CapitalizeDialog({ asset, onClose }: { asset: Row; onClose: () => void }) {
  const { data: cats = [] } = useAm<Row[]>('/pickers/fin-categories')
  const [cat, setCat] = useState('')
  const [cost, setCost] = useState(asset.acquisition_cost ? String(asset.acquisition_cost) : '')
  const [life, setLife] = useState('')
  const [method, setMethod] = useState('')
  const [post, setPost] = useState(true)
  const m = useAmMutation({
    onSuccess: (r) => { if (r?.gl?.warning) toast.warning(r.gl.warning); else toast.success('Capitalised in Finance'); onClose() },
  })
  return (
    <Dialog title={`Capitalise ${asset.asset_tag}`} subtitle="Creates the fixed asset and links it to this record." onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button>
        <Button disabled={m.isPending} onClick={() => {
          if (!(Number(cost) > 0)) return toast.error('Enter the cost')
          m.mutate({ path: `/${asset.id}/capitalize`, body: { fin_category_id: cat || undefined, cost: Number(cost), useful_life_years: life ? Number(life) : undefined, depreciation_method: method || undefined, post_gl: post } })
        }}>{m.isPending ? 'Saving…' : 'Capitalise'}</Button></>}>
      <Field label="Finance asset category" hint="Decides the GL accounts. Leave blank to use the asset category's mapping."><Sel value={cat} onChange={setCat} blank="Use category default" options={cats.map((c) => ({ value: c.id, label: c.name }))} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Cost" required><Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="Useful life (years)"><Input type="number" min={1} value={life} onChange={(e) => setLife(e.target.value)} /></Field>
        <Field label="Method"><Sel value={method} onChange={setMethod} blank="From category" options={[{ value: 'straight_line', label: 'Straight line' }, { value: 'wdv', label: 'Written down value' }, { value: 'units_of_production', label: 'Units of production' }]} /></Field>
      </div>
      <Check checked={post} onChange={setPost} label="Post the acquisition journal now" />
    </Dialog>
  )
}

function LinkDialog({ asset, onClose }: { asset: Row; onClose: () => void }) {
  const [q, setQ] = useState('')
  const { data = [] } = useAm<Row[]>('/pickers/fin-assets', { q: q || undefined })
  const m = useAmMutation({ success: 'Linked to Finance', onSuccess: onClose })
  return (
    <Dialog title="Link to an existing fixed asset" subtitle={`${asset.asset_tag} · ${asset.name}`} onClose={onClose}>
      <Input placeholder="Search fixed assets…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-64 overflow-y-auto rounded-md border border-border">
        {data.length === 0 ? <div className="p-3 text-sm text-muted-foreground">No unlinked fixed assets found.</div> : data.map((f) => (
          <button key={f.id} type="button" disabled={m.isPending} onClick={() => m.mutate({ path: `/${asset.id}/finance/link`, body: { fin_asset_id: f.id } })}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent">
            <span>{f.name}</span><span className="font-mono text-xs text-muted-foreground">{f.asset_code}</span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}
