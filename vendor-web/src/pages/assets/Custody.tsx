import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAm, useAmMutation, useAssetPerms, type Page, type Row } from './api'
import { CheckinDialog } from './dialogs'
import EmployeeAssetsPanel from './EmployeeAssetsPanel'
import {
  AssetPicker, Check, DataTable, Dialog, EmployeeSelect, ErrorNote, Field, Loading, PageHeader, Pager, Pill, Panel,
  StatusBadge, Tabs, fmtDate, fmtDateTime, localInputToIso,
} from './ui'

type Tab = 'open' | 'bookings' | 'employee'

export default function Custody() {
  const [tab, setTab] = useState<Tab>('open')
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Custody & Bookings" subtitle="Who holds what, what is overdue, and who has booked shared assets." />
      <Tabs tabs={[{ id: 'open', label: 'Held now' }, { id: 'bookings', label: 'Bookings' }, { id: 'employee', label: 'By employee' }]} value={tab} onChange={setTab} />
      {tab === 'open' ? <OpenCustody /> : null}
      {tab === 'bookings' ? <Bookings /> : null}
      {tab === 'employee' ? <ByEmployee /> : null}
    </div>
  )
}

function OpenCustody() {
  const nav = useNavigate()
  const perms = useAssetPerms()
  const [overdue, setOverdue] = useState(false)
  const [page, setPage] = useState(1)
  const [checkin, setCheckin] = useState<Row | null>(null)
  const { data, isLoading, error } = useAm<Page>('/assignments', { open_only: true, overdue_only: overdue || undefined, page, size: 50 })
  const ack = useAmMutation({ success: 'Marked as received' })
  if (error) return <ErrorNote error={error} />
  return (
    <div className="space-y-3">
      <Check checked={overdue} onChange={(v) => { setOverdue(v); setPage(1) }} label="Overdue only" />
      {isLoading ? <Loading /> : (
        <>
          <DataTable rows={data?.items ?? []} empty={overdue ? 'Nothing is overdue.' : 'No assets are checked out.'}
            onRow={(r) => nav(`/assets/register/${r.asset_id}`)}
            cols={[
              { key: 'asset_tag', header: 'Tag', render: (r) => <span className="font-mono font-semibold">{r.asset_tag}</span> },
              { key: 'asset_name', header: 'Asset' },
              { key: 'assignee_label', header: 'Held by', render: (r) => <span className="font-medium">{r.assignee_label}</span> },
              { key: 'assigned_at', header: 'Since', render: (r) => fmtDate(r.assigned_at) },
              { key: 'due_back_on', header: 'Due back', render: (r) => r.is_overdue ? <Pill tone="red">{fmtDate(r.due_back_on)}</Pill> : fmtDate(r.due_back_on) },
              { key: 'ack', header: 'Received', render: (r) => r.assignee_type !== 'employee' ? '—' : r.acknowledged_at ? <Pill tone="green">Yes</Pill> : (
                perms.manage ? <span onClick={(e) => e.stopPropagation()}><Button size="xs" variant="outline" onClick={() => ack.mutate({ path: `/assignments/${r.id}/acknowledge` })}>Mark received</Button></span> : <Pill tone="amber">Not yet</Pill>) },
              { key: 'act', header: '', render: (r) => perms.manage ? <span onClick={(e) => e.stopPropagation()}><Button size="xs" onClick={() => setCheckin({ id: r.asset_id, asset_tag: r.asset_tag, name: r.asset_name, condition: r.condition_out })}>Check in</Button></span> : null },
            ]} />
          <Pager page={page} size={50} total={data?.total ?? 0} onPage={setPage} />
        </>
      )}
      {checkin ? <CheckinDialog asset={checkin} onClose={() => setCheckin(null)} /> : null}
    </div>
  )
}

function Bookings() {
  const from = useMemo(() => new Date(Date.now() - 24 * 3600 * 1000).toISOString(), [])
  const { data = [], isLoading } = useAm<Row[]>('/reservations', { date_from: from })
  const [open, setOpen] = useState(false)
  const cancel = useAmMutation({ success: 'Booking cancelled' })
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Book an asset</Button></div>
      {isLoading ? <Loading /> : (
        <DataTable rows={data} empty="No upcoming bookings. Mark an asset as bookable to let people reserve it."
          cols={[
            { key: 'asset_tag', header: 'Asset', render: (r) => <span><span className="font-mono font-semibold">{r.asset_tag}</span> {r.asset_name}</span> },
            { key: 'when', header: 'When', render: (r) => `${fmtDateTime(r.start_at)} → ${fmtDateTime(r.end_at)}` },
            { key: 'employee_name', header: 'Booked by' },
            { key: 'purpose', header: 'Purpose' },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
            { key: 'act', header: '', render: (r) => r.status === 'booked' ? (
              <Button size="xs" variant="ghost" onClick={() => { if (window.confirm('Cancel this booking?')) cancel.mutate({ path: `/reservations/${r.id}/cancel` }) }}>Cancel</Button>) : null },
          ]} />
      )}
      {open ? <BookDialog onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

function BookDialog({ onClose }: { onClose: () => void }) {
  const [asset, setAsset] = useState<Row | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [purpose, setPurpose] = useState('')
  const m = useAmMutation({ success: 'Booked', onSuccess: onClose })
  const go = () => {
    if (!asset) return toast.error('Choose an asset')
    const s = localInputToIso(start), e = localInputToIso(end)
    if (!s || !e) return toast.error('Choose a start and an end time')
    m.mutate({ path: '/reservations', body: { asset_id: asset.id, start_at: s, end_at: e, purpose: purpose || undefined } })
  }
  return (
    <Dialog title="Book a shared asset" onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={m.isPending}>{m.isPending ? 'Booking…' : 'Book'}</Button></>}>
      <Field label="Asset" required hint="Only assets marked as bookable can be reserved."><AssetPicker value={asset} onChange={setAsset} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From" required><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Until" required><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="Purpose"><Input value={purpose} maxLength={300} onChange={(e) => setPurpose(e.target.value)} /></Field>
    </Dialog>
  )
}

function ByEmployee() {
  const [emp, setEmp] = useState('')
  return (
    <div className="space-y-4">
      <div className="max-w-md"><Field label="Employee"><EmployeeSelect value={emp} onChange={setEmp} blank="Choose an employee…" /></Field></div>
      {emp ? <Panel><EmployeeAssetsPanel key={emp} employeeId={emp} /></Panel> : null}
    </div>
  )
}
