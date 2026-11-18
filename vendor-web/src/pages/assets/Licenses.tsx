import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAm, useAmMutation, useAssetPerms, type Row } from './api'
import { AssetPicker, Check, DataTable, Dialog, EmployeeSelect, Field, Loading, PageHeader, Panel, Pill, Sel, TextArea, fmtDate, money } from './ui'

const TYPES = [
  { value: 'per_seat', label: 'Per seat' },
  { value: 'site', label: 'Site / unlimited' },
  { value: 'subscription', label: 'Subscription' },
]

export default function Licenses() {
  const perms = useAssetPerms()
  const { data = [], isLoading } = useAm<Row[]>('/licenses')
  const [edit, setEdit] = useState<null | 'new' | Row>(null)
  const [seatsFor, setSeatsFor] = useState<string | null>(null)
  const del = useAmMutation({ success: 'Licence removed' })
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Software Licences" subtitle="Seats bought, seats used, and renewal dates."
        actions={perms.manage ? <Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Add licence</Button> : null} />
      {isLoading ? <Loading /> : (
        <DataTable rows={data} empty="No licences recorded." onRow={(l) => setSeatsFor(l.id)}
          cols={[
            { key: 'name', header: 'Software', render: (l) => <div><div className="font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.publisher}</div></div> },
            { key: 'license_type', header: 'Type', render: (l) => TYPES.find((t) => t.value === l.license_type)?.label ?? l.license_type },
            { key: 'seats', header: 'Seats', render: (l) => l.license_type === 'per_seat' || l.total_seats ? (
              <span className={l.available_seats != null && l.available_seats < 0 ? 'font-semibold text-red-600' : ''}>{l.used_seats} / {l.total_seats ?? '∞'}</span>) : `${l.used_seats} used` },
            { key: 'expiry_date', header: 'Expires', render: (l) => l.expiry_date
              ? <span className="inline-flex items-center gap-2">{fmtDate(l.expiry_date)}{l.is_expired ? <Pill tone="red">Expired</Pill> : l.days_left != null && l.days_left <= (l.renewal_alert_days ?? 30) ? <Pill tone="amber">{l.days_left}d left</Pill> : null}</span>
              : '—' },
            { key: 'cost', header: 'Cost', className: 'text-right', render: (l) => money(l.cost) },
            { key: 'act', header: '', render: (l) => perms.manage ? (
              <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="xs" variant="outline" onClick={() => setEdit(l)}>Edit</Button>
                <Button size="xs" variant="ghost" onClick={() => { if (window.confirm(`Delete ${l.name}?`)) del.mutate({ method: 'delete', path: `/licenses/${l.id}` }) }}>Delete</Button>
              </span>) : null },
          ]} />
      )}
      {edit ? <LicenseDialog license={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} /> : null}
      {seatsFor ? <SeatsDialog id={seatsFor} onClose={() => setSeatsFor(null)} /> : null}
    </div>
  )
}

function LicenseDialog({ license, onClose }: { license?: Row; onClose: () => void }) {
  const [f, setF] = useState({
    name: license?.name ?? '', publisher: license?.publisher ?? '', license_type: license?.license_type ?? 'per_seat',
    license_key: license?.license_key ?? '', total_seats: license?.total_seats != null ? String(license.total_seats) : '',
    purchase_date: license?.purchase_date ?? '', expiry_date: license?.expiry_date ?? '', cost: license?.cost != null ? String(license.cost) : '',
    renewal_alert_days: String(license?.renewal_alert_days ?? 30), notes: license?.notes ?? '', is_active: license?.is_active ?? true,
  })
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))
  const m = useAmMutation({ success: license ? 'Licence updated' : 'Licence added', onSuccess: onClose })
  const submit = () => {
    if (!f.name.trim()) return toast.error('Software name is required')
    const body: Row = {
      name: f.name.trim(), publisher: f.publisher || null, license_type: f.license_type,
      total_seats: f.total_seats === '' ? null : Number(f.total_seats),
      purchase_date: f.purchase_date || null, expiry_date: f.expiry_date || null,
      cost: f.cost === '' ? null : Number(f.cost), renewal_alert_days: Number(f.renewal_alert_days) || 30,
      notes: f.notes || null, is_active: f.is_active,
    }
    // Only send the key when it was typed; never overwrite a stored key with an empty value.
    if (f.license_key) body.license_key = f.license_key
    m.mutate({ method: license ? 'put' : 'post', path: license ? `/licenses/${license.id}` : '/licenses', body })
  }
  return (
    <Dialog title={license ? 'Edit licence' : 'Add licence'} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button disabled={m.isPending} onClick={submit}>{m.isPending ? 'Saving…' : 'Save'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Software" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Publisher"><Input value={f.publisher} onChange={(e) => set('publisher', e.target.value)} /></Field>
        <Field label="Type"><Sel value={f.license_type} onChange={(v) => set('license_type', v)} options={TYPES} /></Field>
        <Field label="Total seats" hint="Leave empty for unlimited."><Input type="number" min={0} value={f.total_seats} onChange={(e) => set('total_seats', e.target.value)} /></Field>
        <Field label="Purchased on"><Input type="date" value={f.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} /></Field>
        <Field label="Expires on"><Input type="date" value={f.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} /></Field>
        <Field label="Cost"><Input type="number" min={0} step="0.01" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
        <Field label="Remind before (days)"><Input type="number" min={0} value={f.renewal_alert_days} onChange={(e) => set('renewal_alert_days', e.target.value)} /></Field>
      </div>
      <Field label="Licence key" hint={license?.has_license_key ? 'A key is stored. Type a new one only to replace it.' : undefined}>
        <Input autoComplete="off" value={f.license_key} onChange={(e) => set('license_key', e.target.value)} placeholder={license?.has_license_key ? '•••••••• (stored)' : ''} />
      </Field>
      <Field label="Notes"><TextArea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      <Check checked={f.is_active} onChange={(v) => set('is_active', v)} label="Active" />
    </Dialog>
  )
}

function SeatsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const perms = useAssetPerms()
  const { data, isLoading } = useAm<Row>(`/licenses/${id}`, undefined, { staleTime: 0 })
  const [mode, setMode] = useState<'employee' | 'asset'>('employee')
  const [emp, setEmp] = useState('')
  const [asset, setAsset] = useState<Row | null>(null)
  const assign = useAmMutation({ success: 'Seat assigned', onSuccess: () => { setEmp(''); setAsset(null) } })
  const revoke = useAmMutation({ success: 'Seat revoked' })
  const full = data && data.total_seats != null && data.used_seats >= data.total_seats
  return (
    <Dialog wide title={data?.name ?? 'Licence'} subtitle={data ? `${data.used_seats} of ${data.total_seats ?? '∞'} seats used` : undefined} onClose={onClose}
      footer={<Button variant="cancel" onClick={onClose}>Close</Button>}>
      {isLoading || !data ? <Loading /> : (
        <>
          {data.license_key ? <Panel title="Licence key"><code className="select-all break-all text-sm">{data.license_key}</code></Panel> : null}
          {perms.manage ? (
            <Panel title="Assign a seat">
              <div className="mb-2 flex gap-2">
                <Button size="sm" variant={mode === 'employee' ? 'default' : 'outline'} onClick={() => setMode('employee')}>To an employee</Button>
                <Button size="sm" variant={mode === 'asset' ? 'default' : 'outline'} onClick={() => setMode('asset')}>To a device</Button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  {mode === 'employee' ? <EmployeeSelect value={emp} onChange={setEmp} /> : <AssetPicker value={asset} onChange={setAsset} />}
                </div>
                <Button disabled={assign.isPending || full || (mode === 'employee' ? !emp : !asset)}
                  onClick={() => assign.mutate({ path: `/licenses/${id}/seats`, body: mode === 'employee' ? { employee_id: emp } : { asset_id: asset!.id } })}>Assign</Button>
              </div>
              {full ? <p className="mt-2 text-xs text-amber-600">All seats are in use. Revoke one first.</p> : null}
            </Panel>
          ) : null}
          <DataTable rows={data.seats ?? []} empty="No seats assigned."
            cols={[
              { key: 'who', header: 'Assigned to', render: (s) => s.employee_name ?? (s.asset_tag ? <span className="font-mono">{s.asset_tag}</span> : '—') },
              { key: 'assigned_at', header: 'Since', render: (s) => fmtDate(s.assigned_at) },
              { key: 'act', header: '', render: (s) => perms.manage ? <Button size="xs" variant="ghost" onClick={() => revoke.mutate({ method: 'delete', path: `/licenses/seats/${s.id}` })}>Revoke</Button> : null },
            ]} />
        </>
      )}
    </Dialog>
  )
}
