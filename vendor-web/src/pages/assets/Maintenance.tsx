import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAm, useAmMutation, useAssetPerms, type Page, type Row } from './api'
import { CompleteWorkOrderDialog, PlanDialog, WorkOrderDialog, WorkOrderLinksDialog } from './dialogs'
import { DataTable, Loading, PageHeader, Pager, Pill, Sel, StatusBadge, Tabs, fmtDate, money, optList, titleCase } from './ui'
import { useNavigate } from 'react-router-dom'

type Tab = 'orders' | 'plans'

export default function Maintenance() {
  const [tab, setTab] = useState<Tab>('orders')
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Maintenance" subtitle="Preventive plans that raise work orders on time, and repairs when something breaks." />
      <Tabs tabs={[{ id: 'orders', label: 'Work orders' }, { id: 'plans', label: 'Preventive plans' }]} value={tab} onChange={setTab} />
      {tab === 'orders' ? <WorkOrders /> : <Plans />}
    </div>
  )
}

function WorkOrders() {
  const nav = useNavigate()
  const perms = useAssetPerms()
  const [status, setStatus] = useState('open,in_progress')
  const [page, setPage] = useState(1)
  const [create, setCreate] = useState(false)
  const [complete, setComplete] = useState<Row | null>(null)
  const [links, setLinks] = useState<Row | null>(null)
  const { data, isLoading } = useAm<Page>('/work-orders', { status: status || undefined, page, size: 50 })
  const act = useAmMutation({ success: 'Done' })
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-60"><Sel value={status} onChange={(v) => { setStatus(v); setPage(1) }} blank="All"
          options={[{ value: 'open,in_progress', label: 'Active' }, ...optList(['open', 'in_progress', 'completed', 'cancelled'])]} /></div>
        {perms.manage ? <Button onClick={() => setCreate(true)}><Plus className="h-4 w-4" /> New work order</Button> : null}
      </div>
      {isLoading ? <Loading /> : (
        <>
          <DataTable rows={data?.items ?? []} empty="No work orders." onRow={(w) => nav(`/assets/register/${w.asset_id}`)}
            cols={[
              { key: 'wo_no', header: 'No.', render: (w) => <span className="font-mono font-semibold">{w.wo_no}</span> },
              { key: 'asset', header: 'Asset', render: (w) => <span><span className="font-mono">{w.asset_tag}</span> {w.asset_name}</span> },
              { key: 'title', header: 'Work', render: (w) => <div><div className="font-medium">{w.title}</div><div className="text-xs text-muted-foreground">{titleCase(w.wo_type)}{w.plan_id ? ' · from plan' : ''}</div></div> },
              { key: 'provider', header: 'Provider', render: (w) => (w.service_provider || w.po_number || w.bill_no) ? (
                <div className="space-y-1">
                  <div className="text-sm">{w.service_provider ?? '—'}</div>
                  <div className="flex flex-wrap gap-1">
                    {w.po_number ? <Pill tone="blue">PO {w.po_number}{w.po_status ? ` · ${titleCase(w.po_status)}` : ''}</Pill> : null}
                    {w.bill_no ? <Pill tone={w.bill_status === 'paid' ? 'green' : 'amber'}>Bill {w.bill_no}{w.bill_status ? ` · ${titleCase(w.bill_status)}` : ''}</Pill> : null}
                  </div>
                </div>) : '—' },
              { key: 'priority', header: 'Priority', render: (w) => <StatusBadge value={w.priority} /> },
              { key: 'scheduled_on', header: 'Scheduled', render: (w) => w.is_overdue ? <Pill tone="red">{fmtDate(w.scheduled_on)}</Pill> : fmtDate(w.scheduled_on) },
              { key: 'status', header: 'Status', render: (w) => <StatusBadge value={w.status} /> },
              { key: 'cost_total', header: 'Cost', className: 'text-right', render: (w) => (w.status === 'completed' ? money(w.cost_total) : '—') },
              { key: 'act', header: '', render: (w) => perms.manage ? (
                <span className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                  {w.status === 'open' ? <Button size="xs" variant="outline" onClick={() => act.mutate({ path: `/work-orders/${w.id}/start` })}>Start</Button> : null}
                  {['open', 'in_progress'].includes(w.status) ? <Button size="xs" onClick={() => setComplete(w)}>Complete</Button> : null}
                  {w.status !== 'cancelled' ? <Button size="xs" variant="ghost" onClick={() => setLinks(w)}>Links</Button> : null}
                  {['open', 'in_progress'].includes(w.status) ? <Button size="xs" variant="ghost" onClick={() => { if (window.confirm('Cancel this work order?')) act.mutate({ path: `/work-orders/${w.id}/cancel` }) }}>Cancel</Button> : null}
                </span>) : null },
            ]} />
          <Pager page={page} size={50} total={data?.total ?? 0} onPage={setPage} />
        </>
      )}
      {create ? <WorkOrderDialog onClose={() => setCreate(false)} /> : null}
      {complete ? <CompleteWorkOrderDialog wo={complete} onClose={() => setComplete(null)} /> : null}
      {links ? <WorkOrderLinksDialog wo={links} onClose={() => setLinks(null)} /> : null}
    </div>
  )
}

function Plans() {
  const nav = useNavigate()
  const perms = useAssetPerms()
  const { data = [], isLoading } = useAm<Row[]>('/maintenance/plans')
  const [dlg, setDlg] = useState<null | 'new' | Row>(null)
  const gen = useAmMutation({ onSuccess: (r) => toast.success(r?.created ? `Created ${r.created} work order(s)` : 'Nothing is due yet') })
  const del = useAmMutation({ success: 'Plan removed' })
  const toggle = useAmMutation()
  return (
    <div className="space-y-3">
      {perms.manage ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={gen.isPending} onClick={() => gen.mutate({ path: '/maintenance/plans/generate' })}><Wand2 className="h-4 w-4" /> Create due work orders now</Button>
          <Button onClick={() => setDlg('new')}><Plus className="h-4 w-4" /> New plan</Button>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">Work orders are also raised automatically every day for plans due within 7 days, and you get a notification.</p>
      {isLoading ? <Loading /> : (
        <DataTable rows={data} empty="No preventive plans yet." onRow={(p) => nav(`/assets/register/${p.asset_id}`)}
          cols={[
            { key: 'name', header: 'Plan', render: (p) => <span className="font-medium">{p.name}</span> },
            { key: 'asset', header: 'Asset', render: (p) => <span><span className="font-mono">{p.asset_tag}</span> {p.asset_name}</span> },
            { key: 'every', header: 'Every', render: (p) => [p.interval_days ? `${p.interval_days} days` : '', p.interval_meter ? `${p.interval_meter} ${p.meter_unit ?? ''}` : ''].filter(Boolean).join(' or ') },
            { key: 'next_due_on', header: 'Next due', render: (p) => p.is_due ? <Pill tone="red">{fmtDate(p.next_due_on) === '—' ? 'Meter due' : fmtDate(p.next_due_on)}</Pill> : fmtDate(p.next_due_on) },
            { key: 'last_done_on', header: 'Last done', render: (p) => fmtDate(p.last_done_on) },
            { key: 'is_active', header: 'Active', render: (p) => (p.is_active ? <Pill tone="green">Yes</Pill> : <Pill>Paused</Pill>) },
            { key: 'act', header: '', render: (p) => perms.manage ? (
              <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="xs" variant="outline" onClick={() => setDlg(p)}>Edit</Button>
                <Button size="xs" variant="ghost" onClick={() => toggle.mutate({ method: 'put', path: `/maintenance/plans/${p.id}`, body: { is_active: !p.is_active } })}>{p.is_active ? 'Pause' : 'Resume'}</Button>
                <Button size="xs" variant="ghost" onClick={() => { if (window.confirm('Delete this plan?')) del.mutate({ method: 'delete', path: `/maintenance/plans/${p.id}` }) }}>Delete</Button>
              </span>) : null },
          ]} />
      )}
      {dlg ? <PlanDialog plan={dlg === 'new' ? undefined : dlg} onClose={() => setDlg(null)} /> : null}
    </div>
  )
}
