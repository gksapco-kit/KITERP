/** Dialogs shared across asset pages (custody, maintenance, coverage). */
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CONDITIONS, COVERAGE_TYPES, useAmMutation, useAssetPerms, type Row } from './api'
import {
  AssetPicker, Check, DepartmentSelect, Dialog, EmployeeSelect, Field, LocationSelect, NO_PROVIDER, ProviderPicker, Sel,
  StoreSelect, SupplierDocLinks, TextArea, optList, type Provider,
} from './ui'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const today = () => new Date().toISOString().slice(0, 10)

/* ── check-out / reassign ───────────────────────────────────────────────────── */
export function CheckoutDialog({ asset, reassign, onClose }: { asset: Row; reassign?: boolean; onClose: () => void }) {
  const [type, setType] = useState('employee')
  const [employee, setEmployee] = useState('')
  const [department, setDepartment] = useState('')
  const [store, setStore] = useState('')
  const [location, setLocation] = useState('')
  const [due, setDue] = useState('')
  const [condOut, setCondOut] = useState(asset.condition ?? 'good')
  const [condIn, setCondIn] = useState(asset.condition ?? 'good')
  const [notes, setNotes] = useState('')
  const m = useAmMutation({ success: reassign ? 'Asset reassigned' : 'Asset checked out', onSuccess: onClose })

  const go = () => {
    const target = { employee, department, store, location }[type as 'employee']
    if (!target) return toast.error('Choose who receives the asset')
    m.mutate({
      path: `/${asset.id}/${reassign ? 'reassign' : 'checkout'}`,
      body: {
        assignee_type: type, employee_id: type === 'employee' ? employee : undefined,
        department_id: type === 'department' ? department : undefined, store_id: type === 'store' ? store : undefined,
        location_id: type === 'location' ? location : undefined, due_back_on: due || undefined,
        condition_out: condOut, notes: notes || undefined, condition_in: reassign ? condIn : undefined,
      },
    })
  }

  return (
    <Dialog title={reassign ? `Reassign ${asset.asset_tag}` : `Check out ${asset.asset_tag}`} subtitle={asset.name} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={m.isPending}>{m.isPending ? 'Saving…' : reassign ? 'Reassign' : 'Check out'}</Button></>}>
      {reassign ? <Field label="Condition as returned by current holder"><Sel value={condIn} onChange={setCondIn} options={optList(CONDITIONS)} /></Field> : null}
      <Field label="Assign to">
        <Sel value={type} onChange={setType} options={[{ value: 'employee', label: 'Employee' }, { value: 'department', label: 'Department' }, { value: 'store', label: 'Store' }, { value: 'location', label: 'Location' }]} />
      </Field>
      {type === 'employee' ? <Field label="Employee" required><EmployeeSelect value={employee} onChange={setEmployee} /></Field> : null}
      {type === 'department' ? <Field label="Department" required><DepartmentSelect value={department} onChange={setDepartment} /></Field> : null}
      {type === 'store' ? <Field label="Store" required><StoreSelect value={store} onChange={setStore} /></Field> : null}
      {type === 'location' ? <Field label="Location" required><LocationSelect value={location} onChange={setLocation} /></Field> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Due back (optional)"><Input type="date" min={today()} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Field label="Condition handed over"><Sel value={condOut} onChange={setCondOut} options={optList(CONDITIONS)} /></Field>
      </div>
      <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Accessories handed over, purpose…" /></Field>
    </Dialog>
  )
}

/* ── check-in ───────────────────────────────────────────────────────────────── */
export function CheckinDialog({ asset, onClose }: { asset: Row; onClose: () => void }) {
  const [cond, setCond] = useState(asset.condition ?? 'good')
  const [next, setNext] = useState('')
  const [location, setLocation] = useState(asset.location_id ?? '')
  const [notes, setNotes] = useState('')
  const m = useAmMutation({ success: 'Asset checked in', onSuccess: onClose })
  return (
    <Dialog title={`Check in ${asset.asset_tag}`} subtitle={asset.name} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button>
        <Button disabled={m.isPending} onClick={() => m.mutate({ path: `/${asset.id}/checkin`, body: { condition_in: cond, next_status: next || undefined, location_id: location || undefined, notes: notes || undefined } })}>
          {m.isPending ? 'Saving…' : 'Check in'}</Button></>}>
      <Field label="Condition on return"><Sel value={cond} onChange={setCond} options={optList(CONDITIONS)} /></Field>
      <Field label="Then" hint="Damaged assets go to maintenance unless you choose otherwise.">
        <Sel value={next} onChange={setNext} blank="Back in stock (or maintenance if damaged)" options={[{ value: 'under_maintenance', label: 'Send to maintenance' }, { value: 'lost', label: 'Mark lost' }, { value: 'retired', label: 'Retire' }]} />
      </Field>
      <Field label="Returned to location"><LocationSelect value={location} onChange={setLocation} blank="Keep current location" /></Field>
      <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </Dialog>
  )
}

/* ── work orders ────────────────────────────────────────────────────────────── */
export function WorkOrderDialog({ assetId, onClose }: { assetId?: string; onClose: () => void }) {
  const [asset, setAsset] = useState<Row | null>(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('corrective')
  const [priority, setPriority] = useState('medium')
  const [when, setWhen] = useState(today())
  const [provider, setProvider] = useState<Provider>(NO_PROVIDER)
  const [poId, setPoId] = useState('')
  const [billId, setBillId] = useState('')
  const [desc, setDesc] = useState('')
  const perms = useAssetPerms()
  const m = useAmMutation({ success: 'Work order created', onSuccess: onClose })
  const changeProvider = (p: Provider) => { setProvider(p); setPoId(''); setBillId('') }
  const go = () => {
    const id = assetId ?? asset?.id
    if (!id) return toast.error('Choose an asset')
    if (!title.trim()) return toast.error('Give the work order a title')
    m.mutate({
      path: '/work-orders',
      body: {
        asset_id: id, title: title.trim(), wo_type: type, priority, scheduled_on: when, description: desc || undefined,
        supplier_id: provider.id || undefined, service_provider: provider.name || undefined,
        purchase_order_id: poId || undefined, vendor_bill_id: billId || undefined,
      },
    })
  }
  return (
    <Dialog title="New work order" onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Create'}</Button></>}>
      {!assetId ? <Field label="Asset" required><AssetPicker value={asset} onChange={setAsset} /></Field> : null}
      <Field label="Title" required><Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Screen replacement, annual service…" /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type"><Sel value={type} onChange={setType} options={optList(['corrective', 'preventive', 'inspection'])} /></Field>
        <Field label="Priority"><Sel value={priority} onChange={setPriority} options={optList(PRIORITIES)} /></Field>
        <Field label="Scheduled"><Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
      </div>
      <Field label="Service provider"><ProviderPicker value={provider} onChange={changeProvider} /></Field>
      {perms.manage ? <SupplierDocLinks supplierId={provider.id} poId={poId} billId={billId} onPo={setPoId} onBill={setBillId} /> : null}
      <Field label="Details"><TextArea value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
    </Dialog>
  )
}

/** Tag an existing work order with its supplier, purchase order and supplier bill. */
export function WorkOrderLinksDialog({ wo, onClose }: { wo: Row; onClose: () => void }) {
  const [provider, setProvider] = useState<Provider>({ id: wo.supplier_id ?? '', name: wo.service_provider ?? '' })
  const [poId, setPoId] = useState<string>(wo.purchase_order_id ?? '')
  const [billId, setBillId] = useState<string>(wo.vendor_bill_id ?? '')
  const m = useAmMutation({ success: 'Links saved', onSuccess: onClose })
  const changeProvider = (p: Provider) => { setProvider(p); setPoId(''); setBillId('') }
  return (
    <Dialog title={`Supplier, PO & bill · ${wo.wo_no}`} subtitle={`${wo.asset_tag} · ${wo.title}`} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button>
        <Button disabled={m.isPending} onClick={() => m.mutate({
          method: 'put', path: `/work-orders/${wo.id}/links`,
          body: { supplier_id: provider.id || null, service_provider: provider.name || null, purchase_order_id: poId || null, vendor_bill_id: billId || null },
        })}>{m.isPending ? 'Saving…' : 'Save'}</Button></>}>
      <Field label="Service provider"><ProviderPicker value={provider} onChange={changeProvider} /></Field>
      <SupplierDocLinks supplierId={provider.id} poId={poId} billId={billId} onPo={setPoId} onBill={setBillId} />
    </Dialog>
  )
}

export function CompleteWorkOrderDialog({ wo, onClose }: { wo: Row; onClose: () => void }) {
  const perms = useAssetPerms()
  const [labor, setLabor] = useState('')
  const [parts, setParts] = useState<{ name: string; qty: string; unit_cost: string }[]>([])
  const [downtime, setDowntime] = useState('')
  const [meter, setMeter] = useState('')
  const [after, setAfter] = useState('')
  const [notes, setNotes] = useState('')
  const [post, setPost] = useState(!!wo.asset_is_capitalized)
  const [capitalize, setCapitalize] = useState(false)
  const [poId, setPoId] = useState<string>(wo.purchase_order_id ?? '')
  const [billId, setBillId] = useState<string>(wo.vendor_bill_id ?? '')
  const m = useAmMutation({
    onSuccess: (r) => {
      const gl = r?.gl
      if (gl?.linked_bill) toast.success(`Work order completed. Cost is booked by bill ${gl.bill_no ?? ''}`.trim())
      else if (gl?.posted) toast.success('Work order completed and cost posted to the ledger')
      else if (gl?.warning) toast.warning(gl.warning)
      else toast.success('Work order completed')
      onClose()
    },
  })
  const total = (Number(labor) || 0) + parts.reduce((s, p) => s + (Number(p.qty) || 1) * (Number(p.unit_cost) || 0), 0)
  const go = () => m.mutate({
    path: `/work-orders/${wo.id}/complete`,
    body: {
      cost_labor: Number(labor) || 0,
      parts: parts.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), qty: Number(p.qty) || 1, unit_cost: Number(p.unit_cost) || 0 })),
      downtime_hours: downtime ? Number(downtime) : undefined, meter_reading: meter ? Number(meter) : undefined,
      condition_after: after || undefined, resolution_notes: notes || undefined,
      // A linked supplier bill books the cost itself, so nothing is posted from here.
      ...(perms.finance && !billId ? { post_to_gl: post, capitalize } : { post_to_gl: false }),
      ...(wo.supplier_id ? { purchase_order_id: poId || null, vendor_bill_id: billId || null } : {}),
    },
  })
  return (
    <Dialog wide title={`Complete ${wo.wo_no}`} subtitle={`${wo.asset_tag} · ${wo.title}`} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Complete'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Labour cost"><Input type="number" min={0} step="0.01" value={labor} onChange={(e) => setLabor(e.target.value)} /></Field>
        <Field label="Downtime (hours)"><Input type="number" min={0} step="0.5" value={downtime} onChange={(e) => setDowntime(e.target.value)} /></Field>
        <Field label="Meter reading"><Input type="number" min={0} value={meter} onChange={(e) => setMeter(e.target.value)} /></Field>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><span className="text-sm font-medium">Parts used</span>
          <Button variant="outline" size="sm" onClick={() => setParts((p) => [...p, { name: '', qty: '1', unit_cost: '' }])}><Plus className="h-4 w-4" /> Add part</Button></div>
        {parts.map((p, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2">
            <Input placeholder="Part" value={p.name} onChange={(e) => setParts((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input type="number" min={0} placeholder="Qty" value={p.qty} onChange={(e) => setParts((a) => a.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
            <Input type="number" min={0} step="0.01" placeholder="Unit cost" value={p.unit_cost} onChange={(e) => setParts((a) => a.map((x, j) => (j === i ? { ...x, unit_cost: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setParts((a) => a.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Parts are recorded on the work order only. Stock is not reduced.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Condition after"><Sel value={after} onChange={setAfter} blank="Unchanged" options={optList(CONDITIONS)} /></Field>
        <div className="flex items-end text-sm font-semibold">Total cost: {total.toFixed(2)}</div>
      </div>
      <Field label="Resolution notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      {wo.supplier_id ? (
        <div className="space-y-1">
          <span className="text-sm font-medium">Supplier: {wo.service_provider}</span>
          <SupplierDocLinks supplierId={wo.supplier_id} poId={poId} billId={billId} onPo={setPoId} onBill={setBillId} />
        </div>
      ) : null}
      {perms.finance && billId ? (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          The linked supplier bill books this cost, so it will not be posted to the ledger again from here.
        </p>
      ) : perms.finance ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <Check checked={post} onChange={setPost} label={wo.asset_is_capitalized ? 'Post the cost to the ledger' : 'Post the cost to the ledger as an expense (this asset is not capitalised)'} />
          {post && wo.asset_is_capitalized ? <Check checked={capitalize} onChange={setCapitalize} label="Capitalise it (add to the asset's book value) instead of expensing" /> : null}
        </div>
      ) : null}
    </Dialog>
  )
}

/* ── maintenance plan ───────────────────────────────────────────────────────── */
export function PlanDialog({ assetId, plan, onClose }: { assetId?: string; plan?: Row; onClose: () => void }) {
  const [asset, setAsset] = useState<Row | null>(null)
  const [name, setName] = useState(plan?.name ?? '')
  const [days, setDays] = useState(plan?.interval_days != null ? String(plan.interval_days) : '')
  const [meter, setMeter] = useState(plan?.interval_meter != null ? String(plan.interval_meter) : '')
  const [last, setLast] = useState(plan?.last_done_on ?? '')
  const [priority, setPriority] = useState(plan?.priority ?? 'medium')
  const [cost, setCost] = useState(plan?.estimated_cost != null ? String(plan.estimated_cost) : '')
  const [provider, setProvider] = useState<Provider>({ id: plan?.supplier_id ?? '', name: plan?.service_provider ?? '' })
  const [desc, setDesc] = useState(plan?.description ?? '')
  const m = useAmMutation({ success: plan ? 'Plan updated' : 'Plan created', onSuccess: onClose })
  const go = () => {
    const id = plan ? plan.asset_id : assetId ?? asset?.id
    if (!id) return toast.error('Choose an asset')
    if (!name.trim()) return toast.error('Give the plan a name')
    if (!days && !meter) return toast.error('Set an interval in days, in meter units, or both')
    const body = {
      asset_id: id, name: name.trim(), interval_days: days ? Number(days) : null, interval_meter: meter ? Number(meter) : null,
      last_done_on: last || null, priority, estimated_cost: cost ? Number(cost) : 0, supplier_id: provider.id || null, service_provider: provider.name || null, description: desc || null,
    }
    if (plan) m.mutate({ method: 'put', path: `/maintenance/plans/${plan.id}`, body })
    else m.mutate({ path: '/maintenance/plans', body })
  }
  return (
    <Dialog title={plan ? 'Edit maintenance plan' : 'New maintenance plan'} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</Button></>}>
      {!plan && !assetId ? <Field label="Asset" required><AssetPicker value={asset} onChange={setAsset} /></Field> : null}
      <Field label="Plan name" required><Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="Quarterly service" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Every (days)"><Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        <Field label="Or every (meter units)" hint="Uses the asset's meter reading."><Input type="number" min={0} value={meter} onChange={(e) => setMeter(e.target.value)} /></Field>
        <Field label="Last done on"><Input type="date" value={last} onChange={(e) => setLast(e.target.value)} /></Field>
        <Field label="Priority"><Sel value={priority} onChange={setPriority} options={optList(PRIORITIES)} /></Field>
        <Field label="Estimated cost"><Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
      </div>
      <Field label="Service provider"><ProviderPicker value={provider} onChange={setProvider} /></Field>
      <Field label="What it covers"><TextArea value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
    </Dialog>
  )
}

/* ── warranty / insurance / AMC ─────────────────────────────────────────────── */
export function CoverageDialog({ assetId, coverage, onClose }: { assetId?: string; coverage?: Row; onClose: () => void }) {
  const [asset, setAsset] = useState<Row | null>(null)
  const [type, setType] = useState(coverage?.coverage_type ?? 'warranty')
  const [provider, setProvider] = useState<Provider>({ id: coverage?.supplier_id ?? '', name: coverage?.provider ?? '' })
  const [ref, setRef] = useState(coverage?.reference_no ?? '')
  const [start, setStart] = useState(coverage?.start_date ?? '')
  const [end, setEnd] = useState(coverage?.end_date ?? '')
  const [cost, setCost] = useState(coverage?.cost != null ? String(coverage.cost) : '')
  const [amount, setAmount] = useState(coverage?.coverage_amount != null ? String(coverage.coverage_amount) : '')
  const [contact, setContact] = useState(coverage?.contact ?? '')
  const [alertDays, setAlertDays] = useState(String(coverage?.renewal_alert_days ?? 30))
  const [terms, setTerms] = useState(coverage?.terms ?? '')
  const m = useAmMutation({ success: coverage ? 'Cover updated' : 'Cover added', onSuccess: onClose })
  const go = () => {
    const id = coverage ? coverage.asset_id : assetId ?? asset?.id
    if (!id) return toast.error('Choose an asset')
    if (start && end && end < start) return toast.error('End date must be after the start date')
    const body = {
      asset_id: id, coverage_type: type, supplier_id: provider.id || null, provider: provider.name || null, reference_no: ref || null, start_date: start || null,
      end_date: end || null, cost: cost ? Number(cost) : 0, coverage_amount: amount ? Number(amount) : null,
      contact: contact || null, renewal_alert_days: Number(alertDays) || 30, terms: terms || null,
    }
    if (coverage) m.mutate({ method: 'put', path: `/coverage/${coverage.id}`, body })
    else m.mutate({ path: '/coverage', body })
  }
  return (
    <Dialog title={coverage ? 'Edit cover' : 'Add warranty, insurance or AMC'} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</Button></>}>
      {!coverage && !assetId ? <Field label="Asset" required><AssetPicker value={asset} onChange={setAsset} /></Field> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type"><Sel value={type} onChange={setType} options={COVERAGE_TYPES.map((c) => ({ value: c, label: c === 'amc' ? 'AMC (maintenance contract)' : c === 'warranty' ? 'Warranty' : 'Insurance' }))} /></Field>
        <Field label="Policy / contract no."><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <Field label="Contact"><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email for claims" /></Field>
        <Field label="Start"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="End"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        <Field label="Premium / cost"><Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="Sum insured / covered"><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Remind me (days before end)"><Input type="number" min={0} max={365} value={alertDays} onChange={(e) => setAlertDays(e.target.value)} /></Field>
      </div>
      <Field label="Provider"><ProviderPicker value={provider} onChange={setProvider} /></Field>
      <Field label="Terms & exclusions"><TextArea value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
    </Dialog>
  )
}
