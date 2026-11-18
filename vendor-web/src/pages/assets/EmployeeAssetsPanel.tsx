/** What an employee holds, with one-click recovery. Used on the Custody page and inside HR > Employee. */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAm, useAmMutation, useAssetPerms, type Row } from './api'
import { Button } from '@/components/ui/button'
import { CONDITIONS } from './api'
import { DataTable, Dialog, Field, Loading, Pill, Sel, fmtDate, money, optList } from './ui'

export default function EmployeeAssetsPanel({ employeeId, hideWhenEmpty }: { employeeId: string; hideWhenEmpty?: boolean }) {
  const nav = useNavigate()
  const perms = useAssetPerms()
  const { data, isLoading, error } = useAm<Row>(`/employees/${employeeId}/summary`, undefined, { staleTime: 5_000 })
  const [open, setOpen] = useState(false)

  if (isLoading) return <Loading />
  if (error || !data) return hideWhenEmpty ? null : <p className="text-sm text-muted-foreground">Assets are not available for this employee.</p>

  const assets: Row[] = data.assets ?? []
  const licenses: Row[] = data.licenses ?? []
  if (hideWhenEmpty && assets.length === 0 && licenses.length === 0 && !data.history_count) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {assets.length} asset(s) · {licenses.length} licence seat(s) · total cost {money(data.total_value)} · {data.history_count} past or present assignment(s)
        </div>
        {perms.manage && data.outstanding > 0 ? <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Recover everything (offboard)</Button> : null}
      </div>
      <DataTable rows={assets.map((a): Row => ({ ...a, id: a.assignment_id }))} empty="No company assets with this employee."
        onRow={(a) => nav(`/assets/register/${a.asset_id}`)}
        cols={[
          { key: 'asset_tag', header: 'Tag', render: (a) => <span className="font-mono font-semibold">{a.asset_tag}</span> },
          { key: 'name', header: 'Asset' },
          { key: 'serial_number', header: 'Serial' },
          { key: 'assigned_at', header: 'Since', render: (a) => fmtDate(a.assigned_at) },
          { key: 'due_back_on', header: 'Due back', render: (a) => <span className={a.is_overdue ? 'font-semibold text-red-600' : ''}>{fmtDate(a.due_back_on)}</span> },
          { key: 'ack', header: 'Received', render: (a) => a.acknowledged ? <Pill tone="green">Yes</Pill> : <Pill tone="amber">Not yet</Pill> },
        ]} />
      {licenses.length ? (
        <div className="text-sm"><span className="text-muted-foreground">Licences: </span>{licenses.map((l) => l.name).join(', ')}</div>
      ) : null}
      {open ? <OffboardDialog employeeId={employeeId} summary={data} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

function OffboardDialog({ employeeId, summary, onClose }: { employeeId: string; summary: Row; onClose: () => void }) {
  const [cond, setCond] = useState('')
  const m = useAmMutation({
    onSuccess: (r) => { toast.success(`Recovered ${r?.assets_returned ?? 0} asset(s) and revoked ${r?.licenses_revoked ?? 0} licence seat(s). Asset clearance is marked done.`); onClose() },
  })
  return (
    <Dialog title={`Recover assets from ${summary.employee_name}`} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button>
        <Button disabled={m.isPending} onClick={() => m.mutate({ path: `/employees/${employeeId}/offboard`, body: { condition_in: cond || undefined } })}>
          {m.isPending ? 'Working…' : 'Mark all returned'}</Button></>}>
      <p className="text-sm">This checks in {summary.assets.length} asset(s), revokes {summary.licenses.length} licence seat(s), cancels future bookings, and ticks “assets” on the exit clearance.</p>
      <Field label="Condition of returned assets" hint="Damaged assets are sent to maintenance. To record different conditions, check items in one by one first.">
        <Sel value={cond} onChange={setCond} blank="Leave as recorded" options={optList(CONDITIONS)} />
      </Field>
    </Dialog>
  )
}
